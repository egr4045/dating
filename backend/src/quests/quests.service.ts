import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuestsService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
    private notifications: NotificationsService
    ){}

  // ... (getAvailableQuests оставляем без изменений, но для чистоты вот он)
  async getAvailableQuests(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { interests: true }
    });
    if (!user) return [];

    // Показываем лобби только если они "свежие" (созданы не более 15 минут назад)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const allTemplates = await this.prisma.questTemplate.findMany({
      include: {
        lobbies: {
          where: { 
            status: 'WAITING', 
            hostId: { not: userId },
            createdAt: { gte: fifteenMinsAgo } // Берем только ГОРЯЧИЕ заявки
          }
        }
      }
    });

    return allTemplates.sort((a, b) => {
      // ... (сортировка остается такой же, как мы делали)
      const aIsPref = user.interests.includes(a.subcategory);
      const bIsPref = user.interests.includes(b.subcategory);
      const aHasWait = a.lobbies.length > 0;
      const bHasWait = b.lobbies.length > 0;
      if ((aHasWait && aIsPref) && !(bHasWait && bIsPref)) return -1;
      if (!(aHasWait && aIsPref) && (bHasWait && bIsPref)) return 1;
      if ((!aHasWait && aIsPref) && !(!bHasWait && bIsPref)) return -1;
      if (!(!aHasWait && aIsPref) && (!bHasWait && bIsPref)) return 1;
      if ((aHasWait && !aIsPref) && !(bHasWait && !bIsPref)) return -1;
      if (!(aHasWait && !aIsPref) && (bHasWait && !bIsPref)) return 1;
      return 0;
    });
  }

  async handleSwipe(userId: number, questId: string, action: 'like' | 'dislike') {
    if (action === 'dislike') return { status: 'ignored' };

    // ЗАЩИТА: Проверяем, нет ли у юзера уже активного мэтча
    const activeMatch = await this.prisma.questLobby.findFirst({
      where: {
        status: 'MATCHED',
        OR: [{ hostId: userId }, { participantId: userId }]
      }
    });

    if (activeMatch) {
      return { status: 'already_matched', matchId: activeMatch.id };
    }

    // Ищем ГОРЯЧЕГО напарника (заявке не больше 15 минут)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existingLobby = await this.prisma.questLobby.findFirst({
      where: { 
        templateId: questId, 
        status: 'WAITING', 
        hostId: { not: userId },
        createdAt: { gte: fifteenMinsAgo }
      },
    });

    if (existingLobby) {
      // 1. Создаем мэтч
      const match = await this.prisma.questLobby.update({
        where: { id: existingLobby.id },
        data: { participantId: userId, status: 'MATCHED' },
        include: { host: true, template: true }
      });

      // 2. Отменяем старые лайки
      await this.prisma.questLobby.updateMany({
        where: {
          status: 'WAITING',
          hostId: { in: [userId, existingLobby.hostId] }
        },
        data: { status: 'CANCELLED' }
      });

      // 3. Кидаем сокет-событие для онлайна
      this.chatGateway.server.to(`user_${existingLobby.hostId}`).emit('matchFound', match.id);

      // --- 4. МГНОВЕННЫЙ ПУШ В ТЕЛЕГРАМ ---
      const participant = await this.prisma.user.findUnique({ where: { id: userId } });
      if (participant) {
        // Пуш создателю лобби (хосту)
        this.notifications.sendTelegramPush(
          match.host.telegramId, 
          `🔥 Мэтч! ${participant.firstName} готов выполнить "${match.template.title}". Заходи в игру!`
        );
        // Пуш тому, кто сейчас свайпнул (напарнику)
        this.notifications.sendTelegramPush(
          participant.telegramId, 
          `🔥 Мэтч! Напарник ${match.host.firstName} найден. Приступаем!`
        );
      }
      // ------------------------------------

      return { status: 'matched', match };
    }

    // Никого нет — создаем свое ожидание
    await this.prisma.questLobby.create({
      data: { templateId: questId, hostId: userId, status: 'WAITING' },
    });

    return { status: 'waiting' };
  }

  async getMatch(matchId: number) {
    return this.prisma.questLobby.findUnique({
      where: { id: matchId },
      include: { 
        host: true, 
        participant: true, 
        template: true,
        messages: { orderBy: { createdAt: 'asc' } } // <--- Добавили подгрузку истории чата
      }
    });
  }

  async getActiveMatch(userId: number) {
    return this.prisma.questLobby.findFirst({
      where: {
        status: 'MATCHED',
        OR: [{ hostId: userId }, { participantId: userId }]
      }
    });
  }

  async updateMatchStatus(matchId: number, status: 'COMPLETED' | 'FAILED') {
    return this.prisma.questLobby.update({
      where: { id: matchId },
      data: { status }
    });
  }
}