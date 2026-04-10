import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async sendTelegramPush(telegramId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !telegramId || telegramId.startsWith('test-')) return;

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramId, text }),
      });
    } catch (e) {
      console.error('Ошибка ТГ-пуша:', e);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkUnreadMessages() {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const lobbies = await this.prisma.questLobby.findMany({
      where: {
        status: 'MATCHED',
        lastMessageAt: { lte: oneMinuteAgo } // Ищем лобби, где давно не писали
      },
      include: { host: true, participant: true, template: true }
    });

    for (const lobby of lobbies) {
      if (!lobby.lastMessageAt || !lobby.participant) continue;

      // Хост не читал чат?
      if (lobby.lastMessageAt > lobby.hostLastReadAt && lobby.lastMessageAt > lobby.hostNotifiedAt) {
        await this.sendTelegramPush(
          lobby.host.telegramId,
          `💬 Новое сообщение от ${lobby.participant.firstName} в задании "${lobby.template.title}"!`
        );
        await this.prisma.questLobby.update({ where: { id: lobby.id }, data: { hostNotifiedAt: new Date() } });
      }

      // Напарник не читал чат?
      if (lobby.lastMessageAt > lobby.participantLastReadAt && lobby.lastMessageAt > lobby.participantNotifiedAt) {
        await this.sendTelegramPush(
          lobby.participant.telegramId,
          `💬 Новое сообщение от ${lobby.host.firstName} в задании "${lobby.template.title}"!`
        );
        await this.prisma.questLobby.update({ where: { id: lobby.id }, data: { participantNotifiedAt: new Date() } });
      }
    }
  }
}