import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class QuestsService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
    private notifications: NotificationsService,
    private pushService: PushService
  ) {}

  async getAvailableSubcategories(city: string | null): Promise<string[]> {
    const where: any = {};
    if (city && city !== 'other') {
      // Показываем subcategory если есть квест в нужном городе ИЛИ без привязки к городу (city=null)
      where.OR = [
        { city: city },
        { city: null },
      ];
    }
    // Если city = null или 'other' — нет ограничений, показываем всё
    const templates = await this.prisma.questTemplate.findMany({
      where,
      select: { subcategory: true },
      distinct: ['subcategory'],
    });
    return templates.map(t => t.subcategory);
  }

  async getAvailableQuests(userId: number, filters?: any) {
    // Проверка бана
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { 
        interests: true, bannedUntil: true, age: true, gender: true, 
        prefAgeMin: true, prefAgeMax: true, prefGender: true,
        blocksGiven: { select: { blockedId: true } },
        blocksReceived: { select: { blockerId: true } }
      }
    });
    if (!currentUser) return [];

    if (currentUser.bannedUntil && new Date(currentUser.bannedUntil) > new Date()) {
      const daysLeft = Math.ceil((new Date(currentUser.bannedUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      throw new ForbiddenException(`Ты забанен на ${daysLeft} дн. из-за низкой репутации`);
    }

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const interests = currentUser.interests.length > 0 ? currentUser.interests : ['_unlikely_interest_'];
    
    const hostConditions = [];
    const prefAgeMin = filters?.ageMin !== undefined ? filters.ageMin : currentUser.prefAgeMin;
    const prefAgeMax = filters?.ageMax !== undefined ? filters.ageMax : currentUser.prefAgeMax;
    const prefGender = (filters?.prefGender && filters.prefGender !== 'any') 
      ? filters.prefGender 
      : (currentUser.prefGender !== 'any' ? currentUser.prefGender : null);

    if (prefAgeMin) hostConditions.push({ age: { gte: prefAgeMin } });
    if (prefAgeMax) hostConditions.push({ age: { lte: prefAgeMax } });
    if (prefGender) hostConditions.push({ gender: prefGender });
    
    if (currentUser.age) {
      hostConditions.push({ OR: [{ prefAgeMin: null }, { prefAgeMin: { lte: currentUser.age } }] });
      hostConditions.push({ OR: [{ prefAgeMax: null }, { prefAgeMax: { gte: currentUser.age } }] });
    }
    if (currentUser.gender) {
      hostConditions.push({ OR: [{ prefGender: null }, { prefGender: 'any' }, { prefGender: currentUser.gender }] });
    }

    const blockedIds = [
      ...(currentUser.blocksGiven?.map(b => b.blockedId) || []),
      ...(currentUser.blocksReceived?.map(b => b.blockerId) || [])
    ];

    const lobbyWhere: any = {
      status: 'WAITING',
      hostId: { notIn: [userId, ...blockedIds] },
      createdAt: { gte: fifteenMinsAgo },
      ...(hostConditions.length > 0 ? { host: { AND: hostConditions } } : {})
    };

    let results = [];

    let templateCondition = {};
    if (filters?.category) {
      templateCondition = { category: filters.category };
    }

    // Приоритет 1: Есть активные лобби + совпадает по интересам
    const tier1 = await this.prisma.questTemplate.findMany({
      where: {
        ...templateCondition,
        subcategory: { in: interests },
        lobbies: { some: lobbyWhere }
      },
      include: { lobbies: { where: lobbyWhere } },
      take: 20
    });
    results.push(...tier1);

    // Приоритет 2: Есть активные лобби + НЕ совпадает по интересам
    if (results.length < 20) {
      const tier2 = await this.prisma.questTemplate.findMany({
        where: {
          ...templateCondition,
          subcategory: { notIn: interests },
          lobbies: { some: lobbyWhere }
        },
        include: { lobbies: { where: lobbyWhere } },
        take: 20 - results.length
      });
      results.push(...tier2);
    }

    // Приоритет 3: НЕТ активных лобби + совпадает по интересам
    if (results.length < 20) {
      const tier3 = await this.prisma.questTemplate.findMany({
        where: {
          ...templateCondition,
          subcategory: { in: interests },
          lobbies: { none: lobbyWhere }
        },
        include: { lobbies: { where: lobbyWhere } },
        take: 20 - results.length
      });
      results.push(...tier3);
    }

    // Приоритет 4: НЕТ активных лобби + НЕ совпадает по интересам
    if (results.length < 20) {
      const tier4 = await this.prisma.questTemplate.findMany({
        where: {
          ...templateCondition,
          subcategory: { notIn: interests },
          lobbies: { none: lobbyWhere }
        },
        include: { lobbies: { where: lobbyWhere } },
        take: 20 - results.length
      });
      results.push(...tier4);
    }

    // ── Спонсорские квесты: вставляем каждый 5-й ─────────────────────────────
    const sponsored = await this.prisma.questTemplate.findMany({
      where: { sponsored: true, sponsorBudget: { gt: 0 } },
      take: 4,
    });

    if (sponsored.length > 0) {
      let sIdx = 0;
      const injected = [];
      for (let i = 0; i < results.length; i++) {
        if ((i + 1) % 5 === 0 && sIdx < sponsored.length) {
          // Помечаем как спонсорский для фронтенда
          injected.push({ ...sponsored[sIdx], _sponsored: true });
          sIdx++;
        }
        injected.push(results[i]);
      }
      // Списываем бюджет у использованных спонсоров
      const usedIds = sponsored.slice(0, sIdx).map(s => s.id);
      if (usedIds.length > 0) {
        await this.prisma.$executeRaw`
          UPDATE "QuestTemplate"
          SET "sponsorBudget" = "sponsorBudget" - 1
          WHERE id = ANY(${usedIds}::text[]) AND "sponsorBudget" > 0
        `;
      }
      return injected;
    }

    return results;
  }

  async getMapQuests(userId: number, category?: string) {
    const where: any = { lat: { not: null }, lon: { not: null } };
    if (category) where.category = category;

    const templates = await this.prisma.questTemplate.findMany({
      where,
      select: {
        id: true, title: true, description: true, category: true, subcategory: true,
        imageUrl: true, address: true, price: true, lat: true, lon: true,
        sponsored: true, sponsorName: true, sponsorLogo: true,
        lobbies: {
          where: { status: 'WAITING' },
          select: { id: true },
        },
      },
      take: 200,
    });

    return templates.map(t => ({
      ...t,
      _waitingCount: t.lobbies.length,
      lobbies: undefined,
    }));
  }

  async handleSwipe(userId: number, questId: string, action: 'like' | 'dislike') {
    if (action === 'dislike') return { status: 'ignored' };

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { 
        age: true, gender: true, prefAgeMin: true, prefAgeMax: true, prefGender: true,
        blocksGiven: { select: { blockedId: true } },
        blocksReceived: { select: { blockerId: true } }
      }
    });
    if (!currentUser) return { status: 'error', message: 'User not found' };

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

      const hostConditions = [];
      if (currentUser.prefAgeMin) hostConditions.push({ age: { gte: currentUser.prefAgeMin } });
      if (currentUser.prefAgeMax) hostConditions.push({ age: { lte: currentUser.prefAgeMax } });
      if (currentUser.prefGender && currentUser.prefGender !== 'any') hostConditions.push({ gender: currentUser.prefGender });
      
      if (currentUser.age) {
        hostConditions.push({ OR: [{ prefAgeMin: null }, { prefAgeMin: { lte: currentUser.age } }] });
        hostConditions.push({ OR: [{ prefAgeMax: null }, { prefAgeMax: { gte: currentUser.age } }] });
      }
      if (currentUser.gender) {
        hostConditions.push({ OR: [{ prefGender: null }, { prefGender: 'any' }, { prefGender: currentUser.gender }] });
      }

      const blockedIds = [
        ...(currentUser.blocksGiven?.map(b => b.blockedId) || []),
        ...(currentUser.blocksReceived?.map(b => b.blockerId) || [])
      ];

      const existingLobby = await tx.questLobby.findFirst({
        where: {
          templateId: questId,
          status: 'WAITING',
          hostId: { notIn: [userId, ...blockedIds] },
          createdAt: { gte: fifteenMinsAgo },
          ...(hostConditions.length > 0 ? { host: { AND: hostConditions } } : {})
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

        // WEB PUSH для обоих
        this.pushService.sendToUser(
          match.hostId,
          'У тебя новый матч! 🌟',
          `${participant.firstName} тоже хочет пойти на "${match.template.title}"`,
          `/match/${match.id}/schedule`
        ).catch(() => {});

        this.pushService.sendToUser(
          userId,
          'У тебя новый матч! 🌟',
          `${match.host.firstName} тоже хочет пойти на "${match.template.title}"`,
          `/match/${match.id}/schedule`
        ).catch(() => {});
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
        host: { include: { photos: { orderBy: { order: 'asc' } }, achievements: true } },
        participant: { include: { photos: { orderBy: { order: 'asc' } }, achievements: true } },
        template: true,
        // Грузим последние 50 сообщений — дальше через /messages?cursor=
        messages: { orderBy: { createdAt: 'desc' }, take: 50, include: { reactions: true } },
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
      include: { reactions: true },
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

    const configs = await this.prisma.appConfig.findMany();
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    
    // Бонус не даётся при COMPLETED — он перенесён в leaveReview
    const penalty = parseFloat(configMap['repFailedPenalty']) || 1.0;
    const threshold = parseFloat(configMap['repBanThreshold']) || 2.0;
    const banDays = parseInt(configMap['repBanDays'], 10) || 30;

    const reputationDelta = status === 'COMPLETED' ? 0 : -penalty;
    const userIds = [match.hostId, ...(match.participantId ? [match.participantId] : [])];
    const banUntil = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000);

    const [updated] = await this.prisma.$transaction([
      // 1. Обновляем статус матча
      this.prisma.questLobby.update({ where: { id: matchId }, data: { status } }),
    ]);

    // 2. Обновляем репутацию каждого участника атомарно
    await this.prisma.$transaction(async (tx) => {
      for (const uid of userIds) {
        const current = await tx.user.findUnique({
          where: { id: uid },
          select: { reputation: true, bannedUntil: true, xp: true },
        });
        if (!current) continue;

        const newReputation = Math.max(0, current.reputation + reputationDelta);
        const newXp = status === 'COMPLETED' ? current.xp + 100 : current.xp;

        await tx.user.update({
          where: { id: uid },
          data: {
            reputation: newReputation,
            xp: newXp,
            // Бан: если упала ниже порога и ещё не забанен
            ...(newReputation < threshold && !current.bannedUntil ? { bannedUntil: banUntil } : {}),
          },
        });

        // РЕФЕРАЛЬНЫЙ БОНУС
        if (status === 'COMPLETED') {
          const uData = await tx.user.findUnique({ where: { id: uid }, select: { referredById: true } });
          if (uData?.referredById) {
            const completedCount = await tx.questLobby.count({
              where: {
                id: { not: matchId },
                status: 'COMPLETED',
                OR: [{ hostId: uid }, { participantId: uid }]
              }
            });
            if (completedCount === 0) {
              const referrer = await tx.user.findUnique({ where: { id: uData.referredById }, select: { reputation: true } });
              if (referrer) {
                await tx.user.update({
                  where: { id: uData.referredById },
                  data: { reputation: referrer.reputation + 0.3 }
                });
              }
            }
          }
        }
      }
    });

    if (status === 'COMPLETED') {
      try {
        await this.prisma.userAchievement.createMany({
          data: userIds.map(uid => ({ userId: uid, badgeId: 'FIRST_MATCH' })),
          skipDuplicates: true,
        });
      } catch (e) {}
    }

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

    const configs = await this.prisma.appConfig.findMany();
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    const bonus = parseFloat(configMap['repCompletedBonus']) || 0.5;
    const penalty = parseFloat(configMap['repFailedPenalty']) || 1.0;

    const reviews = await this.prisma.matchReview.findMany({
      where: { reviewerId: userId, matchId: { in: lobbies.map(l => l.id) } },
      select: { matchId: true }
    });
    const reviewedSet = new Set(reviews.map(r => r.matchId));

    return lobbies.map(l => ({
      id: l.id,
      title: l.template.title,
      subcategory: l.template.subcategory,
      imageUrl: l.template.imageUrl,
      status: l.status,
      // Чтобы не путать пользователя, показываем бонус только если он реально был.
      reputationDelta: l.status === 'COMPLETED' ? `+${bonus}` : l.status === 'FAILED' ? `-${penalty}` : '0',
      reviewed: reviewedSet.has(l.id),
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

  async leaveReview(matchId: number, reviewerId: number, rating: number, comment?: string) {
    const match = await this.prisma.questLobby.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Матч не найден');

    if (match.status !== 'COMPLETED') {
      throw new Error('Оценивать можно только завершенные встречи');
    }

    if (match.hostId !== reviewerId && match.participantId !== reviewerId) {
      throw new Error('Доступ запрещен');
    }

    const targetId = match.hostId === reviewerId ? match.participantId : match.hostId;
    if (!targetId) throw new Error('Оппонент не найден');

    const existing = await this.prisma.matchReview.findUnique({
      where: { matchId_reviewerId: { matchId, reviewerId } }
    });
    if (existing) throw new Error('Вы уже оставили отзыв на эту встречу');

    const review = await this.prisma.matchReview.create({
      data: { matchId, reviewerId, targetId, rating, comment }
    });

    const configs = await this.prisma.appConfig.findMany();
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
    
    // Бонус тому, КОГО оценили (максимальный при 5 звездах)
    const maxBonus = parseFloat(configMap['repCompletedBonus']) || 0.5;
    const targetMultiplier = (rating - 1) / 4; // 1->0, 3->0.5, 5->1
    const targetBonus = Math.max(0, maxBonus * targetMultiplier);

    // Бонус тому, КТО оценивает (фиксированно)
    const reviewerBonus = 0.1;
    const reviewerXpBonus = 20;
    const targetXpBonus = rating === 5 ? 30 : (rating >= 4 ? 10 : 0);

    await this.prisma.$transaction(async (tx) => {
       const revUser = await tx.user.findUnique({ where: { id: reviewerId }, select: { reputation: true, xp: true } });
       if (revUser) {
          await tx.user.update({ where: { id: reviewerId }, data: { reputation: revUser.reputation + reviewerBonus, xp: revUser.xp + reviewerXpBonus } });
       }

       const tgtUser = await tx.user.findUnique({ where: { id: targetId }, select: { reputation: true, xp: true } });
       if (tgtUser) {
          await tx.user.update({ where: { id: targetId }, data: { reputation: tgtUser.reputation + targetBonus, xp: tgtUser.xp + targetXpBonus } });
       }

       const reviews = await tx.matchReview.aggregate({
         where: { targetId },
         _avg: { rating: true },
         _count: { id: true }
       });
       if (reviews._count.id >= 10 && reviews._avg.rating && reviews._avg.rating >= 4.9) {
          try {
             await tx.userAchievement.create({
                data: { userId: targetId, badgeId: 'PERFECT_RATING' }
             });
          } catch(e) {}
       }
    });

    return review;
  }

  async getQuestTemplate(id: string) {
    return this.prisma.questTemplate.findUnique({
      where: { id }
    });
  }

  async getLobbyCountForQuest(templateId: string) {
    return this.prisma.questLobby.count({
      where: {
        templateId,
        status: { in: ['WAITING', 'MATCHED'] }
      }
    });
  }
}