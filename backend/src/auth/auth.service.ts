import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateTelegramData(telegramData: any) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN не задан в .env');

    // Отделяем хэш от остальных данных
    const { hash, ...data } = telegramData;

    // 1. Формируем строку по правилам Telegram (сортируем ключи по алфавиту)
    const dataCheckString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    // 2. Создаем секретный ключ из токена бота
    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    // 3. Хэшируем данные и сравниваем с подписью от Telegram
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hmac !== hash) {
      throw new UnauthorizedException('Неверная подпись Telegram. Данные скомпрометированы.');
    }

    // Если всё честно — логиним или регистрируем юзера
    return this.loginUser(data);
  }

  private async loginUser(data: any) {
    // Ищем юзера по telegramId в базе
    let user = await this.prisma.user.findUnique({
      where: { telegramId: data.id.toString() },
    });

    // Если такого нет — это новая регистрация, создаем запись
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId: data.id.toString(),
          firstName: data.first_name,
          username: data.username,
          avatarUrl: data.photo_url,
        },
      });
    }

    // Генерируем цифровой пропуск (JWT)
    const payload = { sub: user.id, telegramId: user.telegramId };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}