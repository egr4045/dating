import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ── Авторизация ────────────────────────────────────────────────────────────

  async login(login: string, password: string) {
    const expectedLogin = process.env.ADMIN_LOGIN;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedLogin || !expectedPassword) {
      throw new Error('Критическая ошибка: креды администратора не заданы в .env!');
    }

    if (login !== expectedLogin || password !== expectedPassword) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new Error('Критическая ошибка: ADMIN_JWT_SECRET не задан в .env!');
    }

    const token = this.jwtService.sign(
      { role: 'admin', login },
      { secret, expiresIn: '12h' },
    );

    return { token };
  }

  // ── Пользователи ───────────────────────────────────────────────────────────

  async getUsers(search?: string, page = 1, limit = 30, pendingVideo?: boolean) {
    const where: any = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
            { telegramId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    if (pendingVideo) {
      where.videoUrl = { not: null };
      where.videoVerified = false;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          firstName: true,
          username: true,
          telegramId: true,
          reputation: true,
          interests: true,
          bannedUntil: true,
          gender: true,
          age: true,
          city: true,
          createdAt: true,
          _count: {
            select: { hostedLobbies: true, joinedLobbies: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async getUser(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { 
        photos: true, timeSlots: true, reportsReceived: true, blocksReceived: true,
        achievements: true
      }
    });
  }

  async getUserDetail(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        timeSlots: true,
        hostedLobbies: {
          include: { template: true, participant: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        joinedLobbies: {
          include: { template: true, host: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) return null;

    // Активные ожидания
    const waitingLobbies = await this.prisma.questLobby.findMany({
      where: { hostId: userId, status: 'WAITING' },
      include: { template: true },
    });

    return { ...user, waitingLobbies };
  }

  async verifyUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.videoUrl) {
      // Пытаемся удалить физический файл
      try {
        const fs = require('fs');
        const path = require('path');
        const filename = user.videoUrl.split('/').pop();
        if (filename) fs.unlinkSync(path.join(process.cwd(), 'uploads', 'videos', filename));
      } catch (e) {
        console.warn('Не удалось удалить файл видео', e);
      }
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { videoVerified: true, videoUrl: null },
    });
  }

  async rejectVideo(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.videoUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const filename = user.videoUrl.split('/').pop();
        if (filename) fs.unlinkSync(path.join(process.cwd(), 'uploads', 'videos', filename));
      } catch (e) {
        console.warn('Не удалось удалить файл видео', e);
      }
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { videoVerified: false, videoUrl: null },
    });
  }

  async banUser(userId: number, days: number) {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.prisma.user.update({
      where: { id: userId },
      data: { bannedUntil: until }
    });
  }

  async grantAchievement(userId: number, badgeId: string) {
    try {
      await this.prisma.userAchievement.create({
        data: { userId, badgeId }
      });
      return { success: true };
    } catch(e) {
      return { success: false, message: 'Бейдж уже выдан' };
    }
  }

  async removeAchievement(userId: number, badgeId: string) {
    await this.prisma.userAchievement.deleteMany({
      where: { userId, badgeId }
    });
    return { success: true };
  }

  async deleteUser(userId: number) {
    // AnalyticsEvent не имеет внешнего ключа с каскадом, поэтому удаляем вручную
    await this.prisma.analyticsEvent.deleteMany({ where: { userId } });
    
    // Удаляем сообщения, которые юзер отправил как Participant (т.к. каскада нет)
    await this.prisma.message.deleteMany({ where: { senderId: userId } });
    
    // Лобби хоста удалятся через Cascade, но лобби где он участник - нет. 
    // Удаляем их, чтобы не плодить мертвые мэтчи.
    await this.prisma.questLobby.deleteMany({ where: { participantId: userId } });
    
    // TimeSlots и HostedLobbies удалятся каскадно автоматически через Prisma
    return this.prisma.user.delete({ where: { id: userId } });
  }

  // ── Карточки (QuestTemplate) ───────────────────────────────────────────────

  async getQuests(search?: string, category?: string, page = 1, limit = 50, sort = 'id', dir: 'asc' | 'desc' = 'desc') {
    const where: any = {};
    if (search) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { subcategory: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category && category !== 'all') where.category = category;

    const allowedSortFields = ['id', 'title', 'category', 'subcategory', 'createdAt'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'id';
    const sortDir = dir === 'asc' ? 'asc' : 'desc';

    const [quests, total] = await Promise.all([
      this.prisma.questTemplate.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { lobbies: true } } },
      }),
      this.prisma.questTemplate.count({ where }),
    ]);

    return { quests, total, page, limit };
  }

  async createQuest(data: {
    id: string; title: string; description: string;
    category: string; subcategory: string;
    imageUrl?: string; address?: string; price?: string; paymentRule?: string;
  }) {
    return this.prisma.questTemplate.create({ data: {
      id:          data.id.trim(),
      title:       data.title.trim(),
      description: data.description.trim(),
      category:    data.category,
      subcategory: data.subcategory.trim(),
      imageUrl:    data.imageUrl   || null,
      address:     data.address    || null,
      price:       data.price      || null,
      paymentRule: data.paymentRule || '50/50',
    }});
  }

  async updateQuest(id: string, data: {
    title?: string; description?: string;
    category?: string; subcategory?: string;
    imageUrl?: string; address?: string; price?: string; paymentRule?: string;
    lat?: number | null; lon?: number | null;
    sponsored?: boolean; sponsorName?: string; sponsorLogo?: string; sponsorBudget?: number;
  }) {
    return this.prisma.questTemplate.update({
      where: { id },
      data: {
        ...(data.title        !== undefined && { title:        data.title.trim()        }),
        ...(data.description  !== undefined && { description:  data.description.trim()  }),
        ...(data.category     !== undefined && { category:     data.category            }),
        ...(data.subcategory  !== undefined && { subcategory:  data.subcategory.trim()  }),
        ...(data.imageUrl     !== undefined && { imageUrl:     data.imageUrl  || null   }),
        ...(data.address      !== undefined && { address:      data.address   || null   }),
        ...(data.price        !== undefined && { price:        data.price     || null   }),
        ...(data.paymentRule  !== undefined && { paymentRule:  data.paymentRule          }),
        ...(data.lat          !== undefined && { lat:          data.lat                  }),
        ...(data.lon          !== undefined && { lon:          data.lon                  }),
        ...(data.sponsored    !== undefined && { sponsored:    data.sponsored             }),
        ...(data.sponsorName  !== undefined && { sponsorName:  data.sponsorName  || null }),
        ...(data.sponsorLogo  !== undefined && { sponsorLogo:  data.sponsorLogo  || null }),
        ...(data.sponsorBudget !== undefined && { sponsorBudget: data.sponsorBudget      }),
      },
    });
  }

  async deleteQuest(id: string) {
    // Проверяем, нет ли активных матчей
    const activeLobbies = await this.prisma.questLobby.count({
      where: { templateId: id, status: { in: ['WAITING', 'MATCHED'] } },
    });
    if (activeLobbies > 0) {
      throw new Error(`Нельзя удалить: есть ${activeLobbies} активных лобби`);
    }
    return this.prisma.questTemplate.delete({ where: { id } });
  }

  // ── Глобальные настройки (AppConfig) ───────────────────────────────────────

  async getConfig() {
    const list = await this.prisma.appConfig.findMany();
    const config: Record<string, string> = {
      repCompletedBonus: '0.5',
      repFailedPenalty: '1.0',
      repBanThreshold: '2.0',
      repBanDays: '30'
    };
    for (const item of list) {
      config[item.key] = item.value;
    }
    return config;
  }

  async updateConfig(newConfig: Record<string, string>) {
    for (const [key, value] of Object.entries(newConfig)) {
      await this.prisma.appConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }
    return { success: true };
  }

  // ── Матчи ──────────────────────────────────────────────────────────────────

  async getMatches(status?: string, search?: string, page = 1, limit = 30) {
    const where: any = {};
    if (status) where.status = status;
    if (search && !isNaN(Number(search))) {
      where.id = Number(search);
    }

    const [matches, total] = await Promise.all([
      this.prisma.questLobby.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          template: { select: { title: true, category: true } },
          host: { select: { id: true, firstName: true, username: true } },
          participant: { select: { id: true, firstName: true, username: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.questLobby.count({ where }),
    ]);

    return { matches, total, page, limit };
  }

  async getMatchDetail(matchId: number) {
    return this.prisma.questLobby.findUnique({
      where: { id: matchId },
      include: {
        template: true,
        host: { select: { id: true, firstName: true, username: true, photoUrl: true } },
        participant: { select: { id: true, firstName: true, username: true, photoUrl: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  // ── Чаты ──────────────────────────────────────────────────────────────────

  async getChats(page = 1, limit = 30) {
    const [chats, total] = await Promise.all([
      this.prisma.questLobby.findMany({
        where: { status: 'MATCHED' },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          template: { select: { title: true } },
          host: { select: { id: true, firstName: true } },
          participant: { select: { id: true, firstName: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.questLobby.count({ where: { status: 'MATCHED' } }),
    ]);

    return { chats, total, page, limit };
  }

  // ── Аналитика ───────────────────────────────────────────────────────────────

  async trackEvent(userId: number | null, sessionId: string, event: string, meta?: any) {
    return this.prisma.analyticsEvent.create({
      data: { userId, sessionId, event, meta },
    });
  }

  async getAnalyticsSummary(from: Date, to: Date) {
    const where = { createdAt: { gte: from, lte: to } };

    const [
      totalEvents,
      eventBreakdown,
      newUsers,
      newMatches,
      completedMatches,
      totalSwipeLikes,
      totalSwiperNopes,
    ] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.groupBy({
        by: ['event'],
        where,
        _count: { event: true },
        orderBy: { _count: { event: 'desc' } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.prisma.questLobby.count({
        where: { status: 'MATCHED', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.questLobby.count({
        where: { status: 'COMPLETED', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.analyticsEvent.count({ where: { ...where, event: 'swipe_like' } }),
      this.prisma.analyticsEvent.count({ where: { ...where, event: 'swipe_nope' } }),
    ]);

    // Активность по дням
    const dailyEvents = await this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE("createdAt")::text as day, COUNT(*)::bigint as count
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `;

    return {
      totalEvents,
      newUsers,
      newMatches,
      completedMatches,
      totalSwipeLikes,
      totalSwiperNopes,
      conversion: (totalSwipeLikes + totalSwiperNopes) > 0
        ? ((newMatches / (totalSwipeLikes + totalSwiperNopes)) * 100).toFixed(1) + '%'
        : '0%',
      eventBreakdown: eventBreakdown.map(e => ({ event: e.event, count: e._count.event })),
      dailyEvents: dailyEvents.map(d => ({ day: d.day, count: Number(d.count) })),
    };
  }

  async getAnalyticsEvents(event?: string, from?: Date, to?: Date, page = 1, limit = 50) {
    const where: any = {};
    if (event) where.event = event;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const [events, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.analyticsEvent.count({ where }),
    ]);

    return { events, total, page, limit };
  }

  // Топ активных юзеров за период
  async getTopUsers(from: Date, to: Date, limit = 20) {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: from, lte: to },
        userId: { not: null },
      },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    });

    const userIds = rows.map(r => r.userId as number);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, username: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return rows.map(r => ({
      userId: r.userId,
      eventCount: r._count.userId,
      firstName: userMap.get(r.userId as number)?.firstName ?? null,
      username: userMap.get(r.userId as number)?.username ?? null,
    }));
  }
}
