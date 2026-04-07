import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class QuestsService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
    private notifications: NotificationsService
    ){}

  async getAvailableQuests(userId: number) {
    // Проверка бана
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { interests: true, bannedUntil: true }
    });
    if (!currentUser) return [];

    if (currentUser.bannedUntil && new Date(currentUser.bannedUntil) > new Date()) {
      const daysLeft = Math.ceil((new Date(currentUser.bannedUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      throw new ForbiddenException(`Ты забанен на ${daysLeft} дн. из-за низкой репутации`);
    }

    // Показываем лобби только если они "свежие" (созданы не более 15 минут назад)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const allTemplates = await this.prisma.questTemplate.findMany({
      include: {
        lobbies: {
          where: { 
            status: 'WAITING', 
            hostId: { not: userId },
            createdAt: { gte: fifteenMinsAgo }
          }
        }
      }
    });

    return allTemplates.sort((a, b) => {
      const aIsPref = currentUser.interests.includes(a.subcategory);
      const bIsPref = currentUser.interests.includes(b.subcategory);
      const aHasWait = a.lobbies.length > 0;
      const bHasWait = b.lobbies.length > 0;
      if ((aHasWait && aIsPref) && !(bHasWait && bIsPref)) return -1;
      if (!(aHasWait && aIsPref) && (bHasWait && bIsPref)) return 1;
      if ((!aHasWait && aIsPref) && !(!bHasWait && bIsPref)) return -1;
      if (!(!aHasWait && aIsPref) && (!bHasWait && bIsPref)) return 1;
      if (!(aHasWait && !aIsPref) && (bHasWait && !bIsPref)) return 1;
      return 0;
    }).slice(0, 20);
  }

  async handleSwipe(userId: number, questId: string, action: 'like' | 'dislike') {
    if (action === 'dislike') return { status: 'ignored' };

    // Проверяем, существует ли шаблон вообще
    const template = await this.prisma.questTemplate.findUnique({ where: { id: questId } });
    if (!template) return { status: 'error', message: 'Quest template not found' };

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
      // ▶ НОВАЯ ЛОГИКА: Не матчим сразу — возвращаем слоты хоста для выбора
      return {
        status: 'slots_required',
        lobbyId: existingLobby.id,
        questId,
        hostSlots: existingLobby.hostSlots || [],
      };
    }

    // Никого нет — создаем свое ожидание, сохраняем слоты хоста
    const userSlots = await this.prisma.timeSlot.findMany({
      where: { userId },
      select: { dayOfWeek: true, timeFrom: true, timeTo: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    await this.prisma.questLobby.create({
      data: { 
        templateId: questId, 
        hostId: userId, 
        status: 'WAITING',
        hostSlots: userSlots,
      },
    });

    return { status: 'waiting' };
  }

  // Пользователь выбрал слот и подтвердил метч
  async confirmSlot(userId: number, lobbyId: number, selectedSlot: { dayOfWeek: number; timeFrom: string; timeTo: string }) {
    // ЗАЩИТА: проверяем активный мэтч
    const activeMatch = await this.prisma.questLobby.findFirst({
      where: {
        status: 'MATCHED',
        OR: [{ hostId: userId }, { participantId: userId }]
      }
    });
    if (activeMatch) {
      return { status: 'already_matched', matchId: activeMatch.id };
    }

    // Атомарное обновление
    const updateResult = await this.prisma.questLobby.updateMany({
      where: { id: lobbyId, status: 'WAITING' },
      data: { participantId: userId, status: 'MATCHED' },
    });

    if (updateResult.count === 0) {
      return { status: 'expired', message: 'Лобби уже занято или просрочено' };
    }

    // Получаем обновленный мэтч
    const match = await this.prisma.questLobby.findUnique({
      where: { id: lobbyId },
      include: { host: true, template: true }
    });

    if (!match) return { status: 'error' };

    // Отменяем другие лайки обоих
    await this.prisma.questLobby.updateMany({
      where: {
        status: 'WAITING',
        hostId: { in: [userId, match.hostId] }
      },
      data: { status: 'CANCELLED' }
    });

    // Кидаем сокет-событие для онлайна
    this.chatGateway.server.to(`user_${match.hostId}`).emit('matchFound', match.id);

    // Пуш в Телеграм
    const participant = await this.prisma.user.findUnique({ where: { id: userId } });
    if (participant) {
      this.notifications.sendTelegramPush(
        match.host.telegramId, 
        `🔥 Мэтч! ${participant.firstName} готов выполнить "${match.template.title}". Заходи в игру!`
      );
      this.notifications.sendTelegramPush(
        participant.telegramId, 
        `🔥 Мэтч! Напарник ${match.host.firstName} найден. Приступаем!`
      );
    }

    return { status: 'matched', match };
  }

  // Пользователю не подошли слоты — создаём его собственное лобби
  async declineSlots(userId: number, questId: string) {
    const userSlots = await this.prisma.timeSlot.findMany({
      where: { userId },
      select: { dayOfWeek: true, timeFrom: true, timeTo: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    await this.prisma.questLobby.create({
      data: { 
        templateId: questId, 
        hostId: userId, 
        status: 'WAITING',
        hostSlots: userSlots,
      },
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
        messages: { orderBy: { createdAt: 'asc' } }
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
    const match = await this.prisma.questLobby.findUnique({ where: { id: matchId } });
    if (!match) return null;

    // Обновляем статус
    const updated = await this.prisma.questLobby.update({
      where: { id: matchId },
      data: { status }
    });

    // Начисление/снятие очков репутации
    const reputationDelta = status === 'COMPLETED' ? 0.5 : -1.0;
    const userIds = [match.hostId];
    if (match.participantId) userIds.push(match.participantId);

    for (const uid of userIds) {
      const user = await this.prisma.user.update({
        where: { id: uid },
        data: { reputation: { increment: reputationDelta } }
      });

      // Проверка на бан: если репутация упала ниже 2.0 — бан на 30 дней
      if (user.reputation < 2.0 && !user.bannedUntil) {
        const banUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await this.prisma.user.update({
          where: { id: uid },
          data: { bannedUntil: banUntil }
        });
      }
    }

    return updated;
  }

  // --- ИСТОРИЯ ---
  async getHistory(userId: number) {
    const lobbies = await this.prisma.questLobby.findMany({
      where: {
        status: { in: ['MATCHED', 'COMPLETED', 'FAILED'] },
        OR: [{ hostId: userId }, { participantId: userId }]
      },
      include: {
        template: { select: { title: true, subcategory: true, imageUrl: true } },
        host: { select: { id: true, firstName: true } },
        participant: { select: { id: true, firstName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return lobbies.map(l => ({
      id: l.id,
      title: l.template.title,
      subcategory: l.template.subcategory,
      imageUrl: l.template.imageUrl,
      status: l.status,
      reputationDelta: l.status === 'COMPLETED' ? '+0.5' : l.status === 'FAILED' ? '-1.0' : '0',
      partner: l.hostId === userId 
        ? l.participant 
        : l.host,
      createdAt: l.createdAt,
    }));
  }

  // Запускается раз в 5 минут
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleLobbies() {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const result = await this.prisma.questLobby.updateMany({
      where: {
        status: 'WAITING',
        createdAt: { lt: fifteenMinsAgo }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    if (result.count > 0) {
      console.log(`[Cron] Cleared ${result.count} stale lobbies.`);
    }
  }
}