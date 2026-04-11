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
    const interests = currentUser.interests.length > 0 ? currentUser.interests : ['_unlikely_interest_'];
    
    let results = [];

    // Приоритет 1: Есть активные лобби + совпадает по интересам
    const tier1 = await this.prisma.questTemplate.findMany({
      where: {
        subcategory: { in: interests },
        lobbies: { some: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } }
      },
      include: { lobbies: { where: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } } },
      take: 20
    });
    results.push(...tier1);

    // Приоритет 2: Есть активные лобби + НЕ совпадает по интересам
    if (results.length < 20) {
      const tier2 = await this.prisma.questTemplate.findMany({
        where: {
          subcategory: { notIn: interests },
          lobbies: { some: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } }
        },
        include: { lobbies: { where: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } } },
        take: 20 - results.length
      });
      results.push(...tier2);
    }

    // Приоритет 3: НЕТ активных лобби + совпадает по интересам
    if (results.length < 20) {
      const tier3 = await this.prisma.questTemplate.findMany({
        where: {
          subcategory: { in: interests },
          lobbies: { none: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } }
        },
        include: { lobbies: { where: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } } },
        take: 20 - results.length
      });
      results.push(...tier3);
    }

    // Приоритет 4: НЕТ активных лобби + НЕ совпадает по интересам
    if (results.length < 20) {
      const tier4 = await this.prisma.questTemplate.findMany({
        where: {
          subcategory: { notIn: interests },
          lobbies: { none: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } }
        },
        include: { lobbies: { where: { status: 'WAITING', hostId: { not: userId }, createdAt: { gte: fifteenMinsAgo } } } },
        take: 20 - results.length
      });
      results.push(...tier4);
    }

    return results;
  }

  async handleSwipe(userId: number, questId: string, action: 'like' | 'dislike') {
    if (action === 'dislike') return { status: 'ignored' };

    // Проверяем, существует ли шаблон вообще
    const template = await this.prisma.questTemplate.findUnique({ where: { id: questId } });
    if (!template) return { status: 'error', message: 'Quest template not found' };

    // ЗАЩИТА: быстрая проверка активного мэтча (вне транзакции)
    const activeMatch = await this.prisma.questLobby.findFirst({
      where: { status: 'MATCHED', OR: [{ hostId: userId }, { participantId: userId }] },
    });
    if (activeMatch) {
      return { status: 'already_matched', matchId: activeMatch.id };
    }

    // Вся логика матчинга — в транзакции, исключаем рейс-кондишн
    const txResult = await this.prisma.$transaction(async (tx) => {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      const existingLobby = await tx.questLobby.findFirst({
        where: {
          templateId: questId,
          status: 'WAITING',
          hostId: { not: userId },
          createdAt: { gte: fifteenMinsAgo },
        },
      });

      if (!existingLobby) {
        // Никого нет — создаём своё лобби
        await tx.questLobby.create({
          data: { templateId: questId, hostId: userId, status: 'WAITING' },
        });
        return { status: 'waiting' as const };
      }

      // Атомарно захватываем лобби
      const updateResult = await tx.questLobby.updateMany({
        where: { id: existingLobby.id, status: 'WAITING' },
        data: { participantId: userId, status: 'MATCHED', schedulingStatus: 'PENDING' },
      });

      if (updateResult.count === 0) {
        // Лобби захвачено параллельным запросом — создаём своё
        await tx.questLobby.create({
          data: { templateId: questId, hostId: userId, status: 'WAITING' },
        });
        return { status: 'waiting' as const };
      }

      const match = await tx.questLobby.findUnique({
        where: { id: existingLobby.id },
        include: { host: true, participant: true, template: true },
      });
      if (!match) return { status: 'error' as const };

      // Отменяем другие ожидания обоих пользователей
      await tx.questLobby.updateMany({
        where: { status: 'WAITING', hostId: { in: [userId, match.hostId] } },
        data: { status: 'CANCELLED' },
      });

      return { status: 'matched' as const, match };
    });

    // Сайд-эффекты вне транзакции (сокеты, Telegram-пуши)
    if (txResult.status === 'matched' && txResult.match) {
      const { match } = txResult;
      this.chatGateway.server.to(`user_${match.hostId}`).emit('matchFound', match.id);
      this.chatGateway.server.to(`user_${userId}`).emit('matchFound', match.id);

      const participant = await this.prisma.user.findUnique({ where: { id: userId } });
      if (participant) {
        this.notifications.sendTelegramPush(
          match.host.telegramId,
          `🎉 Мэтч! ${participant.firstName} тоже хочет "${match.template.title}". Выберите дату!`,
        );
        this.notifications.sendTelegramPush(
          participant.telegramId,
          `🎉 Мэтч! ${match.host.firstName} тоже хочет "${match.template.title}". Выберите дату!`,
        );
      }
    }

    return txResult;
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
        // Грузим последние 50 сообщений — дальше через /messages?cursor=
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  // Пагинация сообщений через курсор (для подгрузки истории вверх)
  async getMessages(matchId: number, userId: number, cursor?: number) {
    const lobby = await this.prisma.questLobby.findUnique({ where: { id: matchId } });
    if (!lobby || (lobby.hostId !== userId && lobby.participantId !== userId)) return null;

    const messages = await this.prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return messages.reverse(); // возвращаем в хронологическом порядке
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

    const reputationDelta = status === 'COMPLETED' ? 0.5 : -1.0;
    const userIds = [match.hostId, ...(match.participantId ? [match.participantId] : [])];
    const banUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Всё в одной транзакции: статус матча + репутация + бан
    const [updated] = await this.prisma.$transaction([
      // 1. Обновляем статус матча
      this.prisma.questLobby.update({ where: { id: matchId }, data: { status } }),
    ]);

    // 2. Обновляем репутацию каждого участника атомарно (read → clamp → write)
    await this.prisma.$transaction(async (tx) => {
      for (const uid of userIds) {
        const current = await tx.user.findUnique({
          where: { id: uid },
          select: { reputation: true, bannedUntil: true },
        });
        if (!current) continue;

        const newReputation = Math.max(0, current.reputation + reputationDelta);

        await tx.user.update({
          where: { id: uid },
          data: {
            reputation: newReputation,
            // Бан: если упала ниже 2.0 и ещё не забанен
            ...(newReputation < 2.0 && !current.bannedUntil ? { bannedUntil: banUntil } : {}),
          },
        });
      }
    });

    return updated;
  }

  // --- СОГЛАСОВАНИЕ ДАТЫ ---

  async proposeDate(matchId: number, userId: number, proposedDate: Date) {
    const match = await this.prisma.questLobby.findUnique({ where: { id: matchId } });
    if (!match || match.schedulingStatus === 'CONFIRMED') return null;

    const updated = await this.prisma.questLobby.update({
      where: { id: matchId },
      data: { proposedDate, proposedBy: userId, schedulingStatus: 'PROPOSED' },
    });

    // Уведомляем партнёра
    const partnerId = match.hostId === userId ? match.participantId : match.hostId;
    if (partnerId) {
      this.chatGateway.server.to(`user_${partnerId}`).emit('dateProposed', { matchId, proposedDate, proposedBy: userId });
    }

    return updated;
  }

  async confirmDate(matchId: number, userId: number, accept: boolean, counterDate?: Date) {
    const match = await this.prisma.questLobby.findUnique({
      where: { id: matchId },
      include: { host: true, participant: true }
    });
    if (!match) return null;

    if (accept && match.proposedDate) {
      const updated = await this.prisma.questLobby.update({
        where: { id: matchId },
        data: { scheduledAt: match.proposedDate, schedulingStatus: 'CONFIRMED' },
      });

      // Уведомляем обоих об открытии чата
      this.chatGateway.server.to(`user_${match.hostId}`).emit('dateConfirmed', matchId);
      if (match.participantId) {
        this.chatGateway.server.to(`user_${match.participantId}`).emit('dateConfirmed', matchId);
      }

      const proposerName = match.proposedBy === match.hostId
        ? match.host.firstName
        : match.participant?.firstName;

      if (match.host) {
        this.notifications.sendTelegramPush(
          match.host.telegramId,
          `✅ Дата встречи подтверждена! Чат открыт.`
        );
      }
      if (match.participant) {
        this.notifications.sendTelegramPush(
          match.participant.telegramId,
          `✅ Дата встречи подтверждена! Чат открыт.`
        );
      }

      return updated;
    }

    if (!accept && counterDate) {
      // Предлагаем встречную дату
      const updated = await this.prisma.questLobby.update({
        where: { id: matchId },
        data: { proposedDate: counterDate, proposedBy: userId, schedulingStatus: 'PROPOSED' },
      });

      const partnerId = match.hostId === userId ? match.participantId : match.hostId;
      if (partnerId) {
        this.chatGateway.server.to(`user_${partnerId}`).emit('dateProposed', { matchId, proposedDate: counterDate, proposedBy: userId });
      }

      return updated;
    }

    return null;
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