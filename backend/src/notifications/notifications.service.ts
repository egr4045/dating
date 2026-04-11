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
    const now = new Date();

    // Грузим все активные лобби с недавним сообщением
    const lobbies = await this.prisma.questLobby.findMany({
      where: { status: 'MATCHED', lastMessageAt: { lte: oneMinuteAgo, not: null } },
      include: { host: true, participant: true, template: true },
    });

    for (const lobby of lobbies) {
      if (!lobby.lastMessageAt || !lobby.participant) continue;
      const lastMsg = lobby.lastMessageAt;

      // Хост не читал чат после последнего сообщения?
      if (lastMsg > lobby.hostLastReadAt && lastMsg > lobby.hostNotifiedAt) {
        // Атомарно помечаем «уведомлён» ДО отправки пуша.
        // Если count=0 — параллельный крон уже обработал, пропускаем.
        const marked = await this.prisma.questLobby.updateMany({
          where: { id: lobby.id, hostNotifiedAt: { lt: lastMsg } },
          data: { hostNotifiedAt: now },
        });
        if (marked.count > 0) {
          await this.sendTelegramPush(
            lobby.host.telegramId,
            `💬 Новое сообщение от ${lobby.participant.firstName} в задании "${lobby.template.title}"!`,
          );
        }
      }

      // Напарник не читал чат после последнего сообщения?
      if (lastMsg > lobby.participantLastReadAt && lastMsg > lobby.participantNotifiedAt) {
        const marked = await this.prisma.questLobby.updateMany({
          where: { id: lobby.id, participantNotifiedAt: { lt: lastMsg } },
          data: { participantNotifiedAt: now },
        });
        if (marked.count > 0) {
          await this.sendTelegramPush(
            lobby.participant.telegramId,
            `💬 Новое сообщение от ${lobby.host.firstName} в задании "${lobby.template.title}"!`,
          );
        }
      }
    }
  }
}