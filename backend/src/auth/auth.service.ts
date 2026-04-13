import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { Telegraf, Markup } from 'telegraf';

@Injectable()
export class AuthService implements OnModuleInit {
  private bot: Telegraf;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  onModuleInit() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    console.log('Проверка токена бота:', botToken ? `ЗАДАН (длина: ${botToken.length})` : 'ОТСУТСТВУЕТ');

    if (!botToken) {
      console.warn('⚠️  TELEGRAM_BOT_TOKEN не задан — Telegram бот отключён.');
      return;
    }

    try {
      this.bot = new Telegraf(botToken);

      this.bot.catch((err) => {
        console.error('Ошибка внутри Telegraf:', err);
      });

      // Слушаем переход по диплинку: t.me/bot?start=12345
      this.bot.start(async (ctx) => {
        console.log('Получена команда /start от:', ctx.from.username);
        const payload = ctx.message.text.split(' ')[1];

        if (payload) {
          const session = await this.prisma.loginSession.findUnique({
            where: { token: payload },
          });

          if (session && session.expiresAt > new Date() && session.status === 'pending') {
            const tgUser = ctx.from;
            
            let user = await this.prisma.user.findUnique({
              where: { telegramId: tgUser.id.toString() },
            });

            if (!user) {
              const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              user = await this.prisma.user.create({
                data: {
                  telegramId: tgUser.id.toString(),
                  firstName: tgUser.first_name,
                  username: tgUser.username,
                  referralCode,
                },
              });
            }

            const jwt = this.jwtService.sign(
              { sub: user.id, telegramId: user.telegramId },
              { expiresIn: '7d' },
            );

            await this.prisma.loginSession.update({
              where: { token: payload },
              data: { status: 'authenticated', jwt, userId: user.id },
            });

            const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:4173';
            
            await ctx.reply(
                `Привет, ${user.firstName}! Ты успешно вошел.\n\nНажми кнопку ниже или перейди по ссылке:\n${frontendUrl}`,
                Markup.inlineKeyboard([
                    Markup.button.url('Вернуться на сайт 🚀', frontendUrl)
                ])
            );
            return;
          }
        }
        
        ctx.reply('Привет! Я бот Party Finder. Чтобы войти на сайт, нажми кнопку логина там.');
      });

      this.bot.launch()
        .then(() => console.log('🤖 Telegram Бот запущен и слушает команды!'))
        .catch(err => console.error('Ошибка при запуске (launch) Telegram бота:', err));

    } catch (err) {
      console.error('Критическая ошибка инициализации бота:', err);
    }
  }

  // Генерация уникального кода для фронтенда
  async generateLoginCode() {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут
    
    await this.prisma.loginSession.create({
      data: { token, status: 'pending', expiresAt },
    });
    
    return { token };
  }

  // Фронтенд будет стучаться сюда каждую секунду
  async checkStatus(token: string) {
    const session = await this.prisma.loginSession.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return { status: 'expired' };
    }
    
    if (session.status === 'authenticated') {
      // Отдаем токен только один раз и удаляем сессию за ненадобностью
      await this.prisma.loginSession.delete({ where: { token } });
      return {
        status: session.status,
        jwt: session.jwt,
        user: session.user
      };
    }
    
    return { status: 'pending' };
  }
}