import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  onModuleInit() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задан — бот отключён.');
      return;
    }

    try {
      const proxy = process.env.TELEGRAM_PROXY;
      if (proxy) {
        this.logger.log(`Используем прокси: ${proxy}`);
        const agent = new HttpsProxyAgent(proxy);
        this.bot = new Telegraf(botToken, {
          telegram: { agent }
        });
      } else {
        this.bot = new Telegraf(botToken);
      }

      this.bot.catch((err) => {
        this.logger.error('Ошибка в Telegraf:', err);
      });

      this.bot.launch()
        .then(() => this.logger.log('🤖 Telegram Бот запущен!'))
        .catch(err => this.logger.error('Ошибка при запуске бота:', err));
    } catch (err) {
      this.logger.error('Критическая ошибка инициализации бота:', err);
    }
  }

  getBot(): Telegraf {
    return this.bot;
  }

  async sendMessage(chatId: string | number, text: string, extra?: any) {
    if (!this.bot) return;
    try {
      // Игнорируем тестовые ID
      if (typeof chatId === 'string' && chatId.startsWith('test-')) return;
      
      await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (err) {
      this.logger.error(`Не удалось отправить сообщение в ТГ (${chatId}):`, err);
    }
  }
}
