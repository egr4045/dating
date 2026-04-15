import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  async sendTelegramPush(telegramId: string | null | undefined, text: string) {
    if (!telegramId) return;
    await this.telegramService.sendMessage(telegramId, text);
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
      if (lastMsg > lobby.hostLastReadAt && lastMsg > lobby.hostNotifiedAt && lobby.host.notifyMessage) {
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
      if (lastMsg > lobby.participantLastReadAt && lastMsg > lobby.participantNotifiedAt && lobby.participant.notifyMessage) {
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