import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async updateProfile(userId: number, data: {
    firstName?: string;
    age?: number;
    gender?: string;
    city?: string;
    bio?: string;
    photoUrl?: string;
    prefGender?: string;
    prefAgeMin?: number;
    prefAgeMax?: number;
  }) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    await this.checkFullProfileBadge(userId);
    return updated;
  }

  async updateVideo(userId: number, videoUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { videoUrl, videoVerified: false },
    });
  }

  async updateInterests(userId: number, interests: string[]) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { interests },
    });
    await this.checkFullProfileBadge(userId);
    return updated;
  }

  async updateSlots(userId: number, slots: { dayOfWeek: number; timeFrom: string; timeTo: string }[]) {
    // Удаляем старые слоты
    await this.prisma.timeSlot.deleteMany({ where: { userId } });
    // Создаём новые
    await this.prisma.timeSlot.createMany({
      data: slots.map(s => ({ userId, dayOfWeek: s.dayOfWeek, timeFrom: s.timeFrom, timeTo: s.timeTo })),
    });
    return { success: true };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveAt: true, streakDays: true, maxStreak: true, xp: true }
    });

    if (user) {
      const now = new Date();
      const last = new Date(user.lastActiveAt);
      
      const nowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const lastStart = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
      const diffDays = Math.floor((nowStart.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));

      let { streakDays, maxStreak, xp } = user;
      let needsUpdate = false;

      if (diffDays === 1) {
        streakDays += 1;
        if (streakDays > maxStreak) maxStreak = streakDays;
        xp += 5; // Бонус за стрик
        needsUpdate = true;
      } else if (diffDays > 1) {
        streakDays = 1; // Пропуск — сброс до 1, XP не даётся
        needsUpdate = true;
      } else if (now.getTime() - last.getTime() > 1000 * 60 * 60 * 4) {
        // Просто обновить дату если прошло больше 4 часов и это тот же день
        needsUpdate = true;
      }

      // Новички получают 1й день при первом заходе
      if (streakDays === 0) {
        streakDays = 1;
        maxStreak = 1;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { streakDays, maxStreak, xp, lastActiveAt: now }
        });
      }
    }

    const res = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        username: true,
        reputation: true,
        interests: true,
        bannedUntil: true,
        age: true,
        gender: true,
        city: true,
        bio: true,
        photoUrl: true,
        photos: {
          select: { id: true, url: true, order: true },
          orderBy: { order: 'asc' },
        },
        videoUrl: true,
        videoVerified: true,
        prefGender: true,
        prefAgeMin: true,
        prefAgeMax: true,
        ghostCount: true,
        timeSlots: {
          select: { id: true, dayOfWeek: true, timeFrom: true, timeTo: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        achievements: {
          select: { badgeId: true, grantedAt: true },
          orderBy: { grantedAt: 'asc' },
        },
        xp: true,
        streakDays: true,
        maxStreak: true,
        referralCode: true,
        referredById: true,
        notifyMatch: true,
        notifyMessage: true,
      },
    });

    // Если кода почему-то нет (старый юзер), генерируем его на лету
    if (res && !res.referralCode) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true }
      });
      res.referralCode = updated.referralCode;
    }

    return res;
  }

  async applyReferralCode(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ForbiddenException('Пользователь не найден');
    if (user.referredById) throw new ForbiddenException('Вы уже использовали реферальный код');

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code.toUpperCase() },
    });

    if (!referrer) throw new ForbiddenException('Неверный реферальный код');
    if (referrer.id === userId) throw new ForbiddenException('Нельзя использовать собственный код');

    await this.prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id },
    });

    return { success: true };
  }


  async testLogin(name: string) {
    // Ищем тестового юзера с таким именем
    let user = await this.prisma.user.findFirst({
      where: { firstName: name, telegramId: { startsWith: 'test-' } }
    });

    // Если нет — создаем с базовыми интересами
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId: `test-${Date.now()}`,
          firstName: name,
          interests: [], 
        }
      });
    }

    // Генерируем токен для тестового юзера
    const token = this.jwtService.sign({ sub: user.id, telegramId: user.telegramId });

    return { user, token };
  }

  async deleteAccount(userId: number) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async addPhoto(userId: number, url: string) {
    const lastPhoto = await this.prisma.userPhoto.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
    });
    const order = lastPhoto ? lastPhoto.order + 1 : 0;
    
    const photo = await this.prisma.userPhoto.create({
      data: { userId, url, order },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.photoUrl) {
      await this.prisma.user.update({ where: { id: userId }, data: { photoUrl: url } });
    }

    await this.checkFullProfileBadge(userId);
    return photo;
  }

  async deletePhoto(userId: number, photoId: number) {
    const photo = await this.prisma.userPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.userId !== userId) throw new ForbiddenException('Access denied');
    await this.prisma.userPhoto.delete({ where: { id: photoId } });
    
    // Если удалили главное фото, можно поставить первое из оставшихся
    const firstPhoto = await this.prisma.userPhoto.findFirst({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl: firstPhoto?.url || null }
    });

    return { success: true };
  }

  async reportUser(reporterId: number, reportedId: number, reason: string) {
    if (reporterId === reportedId) throw new ForbiddenException('Нельзя пожаловаться на себя');
    const existing = await this.prisma.report.findFirst({
      where: { reporterId, reportedId, status: 'PENDING' }
    });
    if (existing) return existing;
    
    return this.prisma.report.create({
      data: { reporterId, reportedId, reason }
    });
  }

  async blockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) throw new ForbiddenException('Нельзя заблокировать себя');
    
    try {
      await this.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        update: {},
        create: { blockerId, blockedId }
      });
    } catch (e) {
      // Игнорируем, если уже в блоке
    }

    // Отменяем активные матчи между ними без штрафа репутации
    await this.prisma.questLobby.updateMany({
      where: {
        status: { in: ['WAITING', 'MATCHED'] },
        OR: [
          { hostId: blockerId, participantId: blockedId },
          { hostId: blockedId, participantId: blockerId }
        ]
      },
      data: { status: 'CANCELLED' }
    });

    return { success: true };
  }

  async checkFullProfileBadge(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { photos: true },
    });
    if (!user) return;
    
    const hasPhoto = user.photoUrl || user.photos.length > 0;
    const hasBio = !!user.bio && user.bio.trim().length > 0;
    const hasCity = !!user.city && user.city.trim().length > 0;
    const hasInterests = user.interests && user.interests.length > 0;

    if (hasPhoto && hasBio && hasCity && hasInterests) {
      try {
        await this.prisma.userAchievement.create({
          data: { userId, badgeId: 'FULL_PROFILE' }
        });
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }
  }

  async updateNotificationPrefs(userId: number, prefs: { notifyMatch?: boolean; notifyMessage?: boolean }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: prefs,
      select: { notifyMatch: true, notifyMessage: true },
    });
  }

  async savePushSubscription(userId: number, subscription: any) {
    const { endpoint, keys } = subscription;
    if (!endpoint || !keys) return;

    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth }
    });
  }

  async deletePushSubscription(userId: number, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint }
    });
  }
}