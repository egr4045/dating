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
    const expectedLogin = process.env.ADMIN_LOGIN || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'changeme';

    if (login !== expectedLogin || password !== expectedPassword) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const secret = process.env.ADMIN_JWT_SECRET || 'admin-secret';
    const token = this.jwtService.sign(
      { role: 'admin', login },
      { secret, expiresIn: '12h' },
    );

    return { token };
  }

  // ── Пользователи ───────────────────────────────────────────────────────────

  async getUsers(search?: string, page = 1, limit = 30) {
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
            { telegramId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

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

  async banUser(userId: number, days: number) {
    const banUntil = days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.user.update({
      where: { id: userId },
      data: { bannedUntil: banUntil },
    });
  }

  async deleteUser(userId: number) {
    // Удаляем сначала зависимые записи
    await this.prisma.message.deleteMany({
      where: {
        OR: [
          { match: { hostId: userId } },
          { match: { participantId: userId } },
          { senderId: userId },
        ],
      },
    });
    await this.prisma.questLobby.deleteMany({
      where: { OR: [{ hostId: userId }, { participantId: userId }] },
    });
    await this.prisma.timeSlot.deleteMany({ where: { userId } });
    await this.prisma.analyticsEvent.deleteMany({ where: { userId } });
    return this.prisma.user.delete({ where: { id: userId } });
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
      conversion: totalSwipeLikes > 0
        ? ((newMatches / totalSwipeLikes) * 100).toFixed(1) + '%'
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
    return this.prisma.analyticsEvent.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: from, lte: to },
        userId: { not: null },
      },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    });
  }
}
