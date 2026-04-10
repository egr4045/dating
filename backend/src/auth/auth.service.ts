import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { Telegraf, Markup } from 'telegraf';

@Injectable()
export class AuthService implements OnModuleInit {
  private bot: Telegraf;
  // Временное хранилище в памяти: token -> { status, jwt, user }
  private loginSessions = new Map<string, any>();

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

        if (payload && this.loginSessions.has(payload)) {
          const tgUser = ctx.from;
          
          let user = await this.prisma.user.findUnique({
            where: { telegramId: tgUser.id.toString() },
          });

          if (!user) {
            user = await this.prisma.user.create({
              data: {
                telegramId: tgUser.id.toString(),
                firstName: tgUser.first_name,
                username: tgUser.username,
              },
            });
          }

          const jwt = this.jwtService.sign({ sub: user.id, telegramId: user.telegramId });
          this.loginSessions.set(payload, { status: 'authenticated', jwt, user });

          const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:4173';
          
          await ctx.reply(
              `Привет, ${user.firstName}! Ты успешно вошел.\n\nНажми кнопку ниже или перейди по ссылке:\n${frontendUrl}`,
              Markup.inlineKeyboard([
                  Markup.button.url('Вернуться на сайт 🚀', frontendUrl)
              ])
          );
        } else {
          ctx.reply('Привет! Я бот Party Finder. Чтобы войти на сайт, нажми кнопку логина там.');
        }
      });

      this.bot.launch()
        .then(() => console.log('🤖 Telegram Бот запущен и слушает команды!'))
        .catch(err => console.error('Ошибка при запуске (launch) Telegram бота:', err));

    } catch (err) {
      console.error('Критическая ошибка инициализации бота:', err);
    }
  }

  // Генерация уникального кода для фронтенда
  generateLoginCode() {
    const token = uuidv4();
    this.loginSessions.set(token, { status: 'pending' });
    
    // Удаляем код через 5 минут, чтобы не засорять память
    setTimeout(() => this.loginSessions.delete(token), 5 * 60 * 1000);
    
    return { token };
  }

  // Фронтенд будет стучаться сюда каждую секунду и спрашивать "Ну что?"
  checkStatus(token: string) {
    const session = this.loginSessions.get(token);
    if (!session) return { status: 'expired' };
    
    if (session.status === 'authenticated') {
      this.loginSessions.delete(token); // Одноразовый код отдаем только один раз
      return session;
    }
    
    return { status: 'pending' };
  }
}