import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock';

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: PrismaMock;

  const jwtMock = { sign: jest.fn().mockReturnValue('test-token') };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getProfile — streak logic
  // ══════════════════════════════════════════════════════════════════════════

  describe('getProfile — streak logic', () => {
    const makeUser = (overrides = {}) => ({
      lastActiveAt: new Date(),
      streakDays: 1,
      maxStreak: 1,
      xp: 0,
      ...overrides,
    });

    const makeFullUser = (overrides = {}) => ({
      id: 1,
      firstName: 'Test',
      username: null,
      reputation: 5.0,
      interests: [],
      bannedUntil: null,
      age: null,
      gender: null,
      city: null,
      bio: null,
      photoUrl: null,
      photos: [],
      videoUrl: null,
      videoVerified: false,
      prefGender: null,
      prefAgeMin: null,
      prefAgeMax: null,
      ghostCount: 0,
      timeSlots: [],
      achievements: [],
      xp: 0,
      streakDays: 1,
      maxStreak: 1,
      referralCode: 'ABC123',
      referredById: null,
      ...overrides,
    });

    it('тот же день (lastActive < 4 часов) → streakDays не меняется, update не вызывается', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeUser({ lastActiveAt: twoHoursAgo, streakDays: 3 }))
        .mockResolvedValueOnce(makeFullUser({ streakDays: 3, referralCode: 'CODE1' }));

      await service.getProfile(1);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('следующий день → streakDays увеличивается на 1 и вызывается update', async () => {
      const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeUser({ lastActiveAt: yesterday, streakDays: 2, maxStreak: 2 }))
        .mockResolvedValueOnce(makeFullUser({ streakDays: 3, referralCode: 'CODE1' }));

      await service.getProfile(1);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.streakDays).toBe(3);
    });

    it('следующий день → maxStreak обновляется если новый рекорд', async () => {
      const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeUser({ lastActiveAt: yesterday, streakDays: 5, maxStreak: 5 }))
        .mockResolvedValueOnce(makeFullUser({ referralCode: 'CODE1' }));

      await service.getProfile(1);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.maxStreak).toBe(6);
    });

    it('следующий день → +5 XP', async () => {
      const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeUser({ lastActiveAt: yesterday, streakDays: 1, xp: 100 }))
        .mockResolvedValueOnce(makeFullUser({ referralCode: 'CODE1' }));

      await service.getProfile(1);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.xp).toBe(105);
    });

    it('пропущен день (разрыв > 1) → streak сбрасывается в 1', async () => {
      const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeUser({ lastActiveAt: threeDaysAgo, streakDays: 7 }))
        .mockResolvedValueOnce(makeFullUser({ referralCode: 'CODE1' }));

      await service.getProfile(1);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.streakDays).toBe(1);
    });

    it('tот же день, прошло > 4 часов → update вызывается (обновляет lastActiveAt)', async () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeUser({ lastActiveAt: fiveHoursAgo, streakDays: 1 }))
        .mockResolvedValueOnce(makeFullUser({ referralCode: 'CODE1' }));

      await service.getProfile(1);

      expect(prismaMock.user.update).toHaveBeenCalled();
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.lastActiveAt).toBeInstanceOf(Date);
    });

    it('если referralCode отсутствует → генерируется новый код', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(makeUser({ lastActiveAt: new Date(Date.now() - 5 * 60 * 60 * 1000) }))
        .mockResolvedValueOnce(makeFullUser({ referralCode: null }));
      prismaMock.user.update
        .mockResolvedValueOnce({}) // first update (streak)
        .mockResolvedValueOnce({ referralCode: 'NEW123' }); // second update (referral)

      const result = await service.getProfile(1);

      // second call to update should set referralCode
      const updateCalls = prismaMock.user.update.mock.calls;
      const referralUpdate = updateCalls.find(c => c[0].data.referralCode !== undefined);
      expect(referralUpdate).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // applyReferralCode
  // ══════════════════════════════════════════════════════════════════════════

  describe('applyReferralCode', () => {
    it('пользователь не найден → ForbiddenException', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.applyReferralCode(1, 'CODE1')).rejects.toThrow(ForbiddenException);
    });

    it('уже использовал реферальный код → ForbiddenException', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: 1, referredById: 42 });

      await expect(service.applyReferralCode(1, 'CODE1')).rejects.toThrow(ForbiddenException);
    });

    it('код не найден → ForbiddenException', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 1, referredById: null }) // current user
        .mockResolvedValueOnce(null); // referrer not found

      await expect(service.applyReferralCode(1, 'BADCODE')).rejects.toThrow(ForbiddenException);
    });

    it('самореферал → ForbiddenException', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 1, referredById: null })
        .mockResolvedValueOnce({ id: 1, referralCode: 'MYCODE' }); // same user

      await expect(service.applyReferralCode(1, 'MYCODE')).rejects.toThrow(ForbiddenException);
    });

    it('валидный код → user.update с referredById', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 1, referredById: null })
        .mockResolvedValueOnce({ id: 99, referralCode: 'REF99' });
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.applyReferralCode(1, 'REF99');

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { referredById: 99 } })
      );
      expect(result).toEqual({ success: true });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // checkFullProfileBadge
  // ══════════════════════════════════════════════════════════════════════════

  describe('checkFullProfileBadge', () => {
    const makeFullProfileUser = (overrides = {}) => ({
      id: 1,
      photoUrl: 'https://example.com/photo.jpg',
      photos: [],
      bio: 'Люблю квесты',
      city: 'Москва',
      interests: ['games', 'sports'],
      ...overrides,
    });

    it('все поля заполнены → userAchievement.create вызывается с FULL_PROFILE', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeFullProfileUser());
      prismaMock.userAchievement.create.mockResolvedValue({});

      await service.checkFullProfileBadge(1);

      expect(prismaMock.userAchievement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ badgeId: 'FULL_PROFILE' }) })
      );
    });

    it('нет bio → ачивка не создаётся', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeFullProfileUser({ bio: null }));

      await service.checkFullProfileBadge(1);

      expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
    });

    it('пустой bio → ачивка не создаётся', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeFullProfileUser({ bio: '  ' }));

      await service.checkFullProfileBadge(1);

      expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
    });

    it('нет city → ачивка не создаётся', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeFullProfileUser({ city: null }));

      await service.checkFullProfileBadge(1);

      expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
    });

    it('пустые interests → ачивка не создаётся', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeFullProfileUser({ interests: [] }));

      await service.checkFullProfileBadge(1);

      expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
    });

    it('нет фото (ни photoUrl, ни photos) → ачивка не создаётся', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeFullProfileUser({ photoUrl: null, photos: [] }));

      await service.checkFullProfileBadge(1);

      expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
    });

    it('есть фото только в photos[] → ачивка создаётся', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        makeFullProfileUser({ photoUrl: null, photos: [{ id: 1, url: 'https://photo.com/1.jpg' }] })
      );
      prismaMock.userAchievement.create.mockResolvedValue({});

      await service.checkFullProfileBadge(1);

      expect(prismaMock.userAchievement.create).toHaveBeenCalled();
    });

    it('дубликат ачивки (уникальность) → не кидает ошибку наружу', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeFullProfileUser());
      prismaMock.userAchievement.create.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(service.checkFullProfileBadge(1)).resolves.not.toThrow();
    });

    it('пользователь не найден → ничего не делает', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.checkFullProfileBadge(999);

      expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // blockUser
  // ══════════════════════════════════════════════════════════════════════════

  describe('blockUser', () => {
    it('самоблокировка → ForbiddenException', async () => {
      await expect(service.blockUser(1, 1)).rejects.toThrow(ForbiddenException);
    });

    it('валидный блок → block.upsert вызывается', async () => {
      prismaMock.block.upsert.mockResolvedValue({});
      prismaMock.questLobby.updateMany.mockResolvedValue({ count: 0 });

      await service.blockUser(1, 2);

      expect(prismaMock.block.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ blockerId: 1, blockedId: 2 }),
        })
      );
    });

    it('активные лобби между двумя пользователями отменяются', async () => {
      prismaMock.block.upsert.mockResolvedValue({});
      prismaMock.questLobby.updateMany.mockResolvedValue({ count: 2 });

      await service.blockUser(1, 2);

      expect(prismaMock.questLobby.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED' },
        })
      );
    });

    it('возвращает { success: true }', async () => {
      prismaMock.block.upsert.mockResolvedValue({});
      prismaMock.questLobby.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.blockUser(1, 2);

      expect(result).toEqual({ success: true });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // updateProfile
  // ══════════════════════════════════════════════════════════════════════════

  describe('updateProfile', () => {
    it('вызывает prisma.user.update и checkFullProfileBadge', async () => {
      const updatedUser = { id: 1, firstName: 'Новый', bio: 'Test', city: 'Москва', interests: ['games'], photoUrl: null, photos: [] };
      prismaMock.user.update.mockResolvedValue(updatedUser);
      prismaMock.user.findUnique.mockResolvedValue(updatedUser);
      prismaMock.userAchievement.create.mockResolvedValue({});

      const result = await service.updateProfile(1, { firstName: 'Новый' });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { firstName: 'Новый' } })
      );
      expect(result).toEqual(updatedUser);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // savePushSubscription / deletePushSubscription
  // ══════════════════════════════════════════════════════════════════════════

  describe('savePushSubscription', () => {
    it('корректный subscription → pushSubscription.upsert вызывается', async () => {
      prismaMock.pushSubscription.upsert.mockResolvedValue({ id: 1 });

      await service.savePushSubscription(1, {
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'key', auth: 'auth' },
      });

      expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { endpoint: 'https://push.example.com' },
          create: expect.objectContaining({ userId: 1, endpoint: 'https://push.example.com' }),
        })
      );
    });

    it('нет endpoint → ничего не делает', async () => {
      await service.savePushSubscription(1, { keys: { p256dh: 'k', auth: 'a' } });
      expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('deletePushSubscription', () => {
    it('вызывает pushSubscription.deleteMany с userId и endpoint', async () => {
      prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      await service.deletePushSubscription(1, 'https://push.example.com');

      expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1, endpoint: 'https://push.example.com' },
      });
    });
  });
});
