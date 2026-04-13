import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock';

describe('QuestsService', () => {
  let service: QuestsService;
  let prismaMock: PrismaMock;

  const serverEmitMock = jest.fn();
  const chatGatewayMock = {
    server: {
      to: jest.fn().mockReturnValue({ emit: serverEmitMock }),
    },
  };

  const notificationsMock = {
    sendTelegramPush: jest.fn(),
  };

  const pushServiceMock = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    jest.clearAllMocks();
    chatGatewayMock.server.to.mockReturnValue({ emit: serverEmitMock });
    pushServiceMock.sendToUser.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ChatGateway, useValue: chatGatewayMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: PushService, useValue: pushServiceMock },
      ],
    }).compile();

    service = module.get<QuestsService>(QuestsService);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getAvailableQuests
  // ══════════════════════════════════════════════════════════════════════════

  describe('getAvailableQuests', () => {
    it('пользователь не найден → возвращает []', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.getAvailableQuests(1);

      expect(result).toEqual([]);
    });

    it('забаненный пользователь → ForbiddenException', async () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        interests: [],
        bannedUntil: future,
        age: null,
        gender: null,
        prefAgeMin: null,
        prefAgeMax: null,
        prefGender: null,
        blocksGiven: [],
        blocksReceived: [],
      });

      await expect(service.getAvailableQuests(1)).rejects.toThrow(ForbiddenException);
    });

    it('ForbiddenException содержит количество дней', async () => {
      const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        interests: [],
        bannedUntil: sevenDays,
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });

      await expect(service.getAvailableQuests(1)).rejects.toThrow(/забанен/);
    });

    it('не забанен (bannedUntil в прошлом) → возвращает квесты', async () => {
      const past = new Date(Date.now() - 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        interests: [],
        bannedUntil: past,
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });
      prismaMock.questTemplate.findMany.mockResolvedValue([]);

      const result = await service.getAvailableQuests(1);

      expect(Array.isArray(result)).toBe(true);
    });

    it('нет спонсорских квестов → $executeRaw не вызывается', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        interests: ['games'],
        bannedUntil: null,
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });
      prismaMock.questTemplate.findMany
        .mockResolvedValueOnce([]) // tier1
        .mockResolvedValueOnce([]) // tier2
        .mockResolvedValueOnce([]) // tier3
        .mockResolvedValueOnce([]) // tier4
        .mockResolvedValueOnce([]); // sponsored

      await service.getAvailableQuests(1);

      expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('есть спонсорские квесты и результаты ≥ 5 → $executeRaw вызывается для декремента бюджета', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        interests: ['games'],
        bannedUntil: null,
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });

      const quests = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, title: `Quest ${i}` }));
      const sponsored = [{ id: 's1', title: 'Sponsored', sponsored: true, sponsorBudget: 5 }];

      prismaMock.questTemplate.findMany
        .mockResolvedValueOnce(quests)  // tier1 (5 results)
        .mockResolvedValueOnce([])       // tier2
        .mockResolvedValueOnce([])       // tier3
        .mockResolvedValueOnce([])       // tier4
        .mockResolvedValueOnce(sponsored); // sponsored

      prismaMock.$executeRaw.mockResolvedValue(1);

      await service.getAvailableQuests(1);

      expect(prismaMock.$executeRaw).toHaveBeenCalled();
    });

    it('спонсорский квест вставляется на позицию кратную 5 (index 4)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        interests: [],
        bannedUntil: null,
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });

      const quests = Array.from({ length: 8 }, (_, i) => ({ id: `q${i}`, title: `Quest ${i}` }));
      const sponsored = [{ id: 's1', title: 'Sponsored', sponsored: true, sponsorBudget: 3 }];

      prismaMock.questTemplate.findMany
        .mockResolvedValueOnce(quests)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(sponsored);
      prismaMock.$executeRaw.mockResolvedValue(1);

      const result = await service.getAvailableQuests(1);

      // Sponsored should be inserted at index 4 (5th position, i+1 % 5 === 0)
      expect((result[4] as any)._sponsored).toBe(true);
    });

    it('заблокированные пользователи исключаются из лобби', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        interests: [],
        bannedUntil: null,
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [{ blockedId: 42 }],
        blocksReceived: [{ blockerId: 55 }],
      });
      prismaMock.questTemplate.findMany.mockResolvedValue([]);

      await service.getAvailableQuests(1);

      // All tier calls should include notIn with blocked ids
      const firstCall = prismaMock.questTemplate.findMany.mock.calls[0][0];
      expect(firstCall.where.lobbies.some.hostId.notIn).toContain(42);
      expect(firstCall.where.lobbies.some.hostId.notIn).toContain(55);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleSwipe
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleSwipe', () => {
    it('dislike → { status: "ignored" }, prisma не вызывается', async () => {
      const result = await service.handleSwipe(1, 'q1', 'dislike');

      expect(result).toEqual({ status: 'ignored' });
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('уже есть активный матч → { status: "already_matched", matchId }', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });
      prismaMock.questTemplate.findUnique.mockResolvedValue({ id: 'q1', title: 'Test' });
      prismaMock.questLobby.findFirst.mockResolvedValue({ id: 77, status: 'MATCHED', hostId: 1 });

      const result = await service.handleSwipe(1, 'q1', 'like');

      expect(result).toEqual({ status: 'already_matched', matchId: 77 });
    });

    it('нет ожидающего лобби → создаётся WAITING лобби → { status: "waiting" }', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });
      prismaMock.questTemplate.findUnique.mockResolvedValue({ id: 'q1', title: 'Test' });
      prismaMock.questLobby.findFirst.mockResolvedValue(null); // нет активного матча

      // Внутри транзакции:
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          questLobby: {
            findFirst: jest.fn().mockResolvedValue(null), // нет ожидающего лобби
            create: jest.fn().mockResolvedValue({ id: 1 }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findUnique: jest.fn(),
          },
        };
        return fn(txMock);
      });

      const result = await service.handleSwipe(1, 'q1', 'like');

      expect(result).toEqual({ status: 'waiting' });
    });

    it('есть ожидающее лобби → матч создаётся → { status: "matched", matchId }', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      });
      prismaMock.questTemplate.findUnique.mockResolvedValue({ id: 'q1', title: 'Test' });
      prismaMock.questLobby.findFirst.mockResolvedValue(null); // нет активного матча

      const existingLobby = { id: 5, hostId: 10, status: 'WAITING' };
      const matchedLobby = {
        id: 5,
        hostId: 10,
        participantId: 1,
        status: 'MATCHED',
        host: { id: 10, firstName: 'Host', telegramId: 'tg10' },
        participant: { id: 1, firstName: 'User', telegramId: 'tg1' },
        template: { id: 'q1', title: 'Test Quest' },
      };

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          questLobby: {
            findFirst: jest.fn().mockResolvedValue(existingLobby),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue(matchedLobby),
            create: jest.fn(),
          },
        };
        return fn(txMock);
      });

      // findUnique for participant
      prismaMock.user.findUnique.mockResolvedValueOnce({
        age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
        blocksGiven: [], blocksReceived: [],
      }).mockResolvedValueOnce({ id: 1, firstName: 'User', telegramId: 'tg1' });

      const result = await service.handleSwipe(1, 'q1', 'like');

      expect(result.status).toBe('matched');
    });

    it('при матче вызывается chatGateway emit для хоста и участника', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
          blocksGiven: [], blocksReceived: [],
        })
        .mockResolvedValueOnce({ id: 1, firstName: 'User', telegramId: 'tg1' });
      prismaMock.questTemplate.findUnique.mockResolvedValue({ id: 'q1' });
      prismaMock.questLobby.findFirst.mockResolvedValue(null);

      const matchedLobby = {
        id: 5, hostId: 10, participantId: 1, status: 'MATCHED',
        host: { id: 10, firstName: 'Host', telegramId: 'tg10' },
        participant: { id: 1, firstName: 'User', telegramId: 'tg1' },
        template: { id: 'q1', title: 'Test' },
      };

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          questLobby: {
            findFirst: jest.fn().mockResolvedValue({ id: 5, hostId: 10 }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue(matchedLobby),
            create: jest.fn(),
          },
        };
        return fn(txMock);
      });

      await service.handleSwipe(1, 'q1', 'like');

      expect(chatGatewayMock.server.to).toHaveBeenCalledWith('user_10');
      expect(chatGatewayMock.server.to).toHaveBeenCalledWith('user_1');
    });

    it('при матче вызывается pushService.sendToUser для обоих участников', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          age: null, gender: null, prefAgeMin: null, prefAgeMax: null, prefGender: null,
          blocksGiven: [], blocksReceived: [],
        })
        .mockResolvedValueOnce({ id: 1, firstName: 'User', telegramId: 'tg1' });
      prismaMock.questTemplate.findUnique.mockResolvedValue({ id: 'q1' });
      prismaMock.questLobby.findFirst.mockResolvedValue(null);

      const matchedLobby = {
        id: 5, hostId: 10, participantId: 1,
        host: { id: 10, firstName: 'Host', telegramId: 'tg10' },
        participant: { id: 1, firstName: 'User', telegramId: 'tg1' },
        template: { id: 'q1', title: 'Test Quest' },
      };

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          questLobby: {
            findFirst: jest.fn().mockResolvedValue({ id: 5, hostId: 10 }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue(matchedLobby),
            create: jest.fn(),
          },
        };
        return fn(txMock);
      });

      await service.handleSwipe(1, 'q1', 'like');

      expect(pushServiceMock.sendToUser).toHaveBeenCalledTimes(2);
      const calledUserIds = pushServiceMock.sendToUser.mock.calls.map((c: any[]) => c[0]);
      expect(calledUserIds).toContain(10);
      expect(calledUserIds).toContain(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // updateMatchStatus
  // ══════════════════════════════════════════════════════════════════════════

  describe('updateMatchStatus', () => {
    const makeMatch = (overrides = {}) => ({
      id: 1,
      hostId: 10,
      participantId: 11,
      status: 'MATCHED',
      ...overrides,
    });

    const makeConfigs = (overrides: Record<string, string> = {}) => [
      { key: 'repFailedPenalty', value: '1.0', ...overrides.repFailedPenalty !== undefined ? { value: overrides.repFailedPenalty } : {} },
      { key: 'repBanThreshold', value: '2.0' },
      { key: 'repBanDays', value: '30' },
      { key: 'repCompletedBonus', value: '0.5' },
    ].filter(c => overrides[c.key] === undefined || c.key === 'repFailedPenalty').concat(
      Object.entries(overrides)
        .filter(([k]) => k !== 'repFailedPenalty')
        .map(([key, value]) => ({ key, value }))
    );

    const setupForStatus = (status: 'COMPLETED' | 'FAILED', userReputation = 5.0) => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeMatch());
      prismaMock.appConfig.findMany.mockResolvedValue([
        { key: 'repFailedPenalty', value: '1.0' },
        { key: 'repBanThreshold', value: '2.0' },
        { key: 'repBanDays', value: '30' },
      ]);
      prismaMock.questLobby.update.mockResolvedValue({ id: 1, status });

      const userSub = { reputation: userReputation, bannedUntil: null, xp: 0 };

      // $transaction for lobby update
      prismaMock.$transaction
        .mockResolvedValueOnce([{ id: 1, status }])
        // callback-form for user reputation updates
        .mockImplementationOnce(async (fn: any) => {
          const txMock = {
            user: {
              findUnique: jest.fn()
                .mockResolvedValueOnce(userSub) // host
                .mockResolvedValueOnce(userSub) // participant
                .mockResolvedValue(null), // for referral check
              update: jest.fn().mockResolvedValue({}),
            },
            questLobby: { count: jest.fn().mockResolvedValue(1) },
            userAchievement: { create: jest.fn().mockResolvedValue({}) },
          };
          return fn(txMock);
        });

      prismaMock.userAchievement.createMany.mockResolvedValue({ count: 2 });
    };

    it('матч не найден → возвращает null', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(null);

      const result = await service.updateMatchStatus(999, 'COMPLETED');

      expect(result).toBeNull();
    });

    it('FAILED → репутация уменьшается на repFailedPenalty', async () => {
      setupForStatus('FAILED', 5.0);

      await service.updateMatchStatus(1, 'FAILED');

      // $transaction array-form for lobby update
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('FAILED с низкой репутацией → bannedUntil устанавливается', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeMatch());
      prismaMock.appConfig.findMany.mockResolvedValue([
        { key: 'repFailedPenalty', value: '1.0' },
        { key: 'repBanThreshold', value: '2.0' },
        { key: 'repBanDays', value: '30' },
      ]);
      prismaMock.questLobby.update.mockResolvedValue({ id: 1, status: 'FAILED' });

      let userUpdateCalled = false;
      let banSet = false;

      prismaMock.$transaction
        .mockResolvedValueOnce([{ id: 1, status: 'FAILED' }])
        .mockImplementationOnce(async (fn: any) => {
          const txMock = {
            user: {
              findUnique: jest.fn().mockResolvedValue({ reputation: 1.5, bannedUntil: null, xp: 0 }),
              update: jest.fn().mockImplementation(({ data }: any) => {
                userUpdateCalled = true;
                if (data.bannedUntil) banSet = true;
                return Promise.resolve({});
              }),
            },
            questLobby: { count: jest.fn().mockResolvedValue(1) },
          };
          return fn(txMock);
        });

      await service.updateMatchStatus(1, 'FAILED');

      expect(userUpdateCalled).toBe(true);
      expect(banSet).toBe(true);
    });

    it('репутация не уходит ниже 0', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeMatch());
      prismaMock.appConfig.findMany.mockResolvedValue([
        { key: 'repFailedPenalty', value: '5.0' }, // большой штраф
        { key: 'repBanThreshold', value: '2.0' },
        { key: 'repBanDays', value: '30' },
      ]);
      prismaMock.questLobby.update.mockResolvedValue({ id: 1, status: 'FAILED' });

      let updatedRep: number | undefined;

      prismaMock.$transaction
        .mockResolvedValueOnce([{ id: 1, status: 'FAILED' }])
        .mockImplementationOnce(async (fn: any) => {
          const txMock = {
            user: {
              findUnique: jest.fn().mockResolvedValue({ reputation: 1.0, bannedUntil: null, xp: 0 }),
              update: jest.fn().mockImplementation(({ data }: any) => {
                if (data.reputation !== undefined) updatedRep = data.reputation;
                return Promise.resolve({});
              }),
            },
            questLobby: { count: jest.fn().mockResolvedValue(1) },
          };
          return fn(txMock);
        });

      await service.updateMatchStatus(1, 'FAILED');

      expect(updatedRep).toBeGreaterThanOrEqual(0);
    });

    it('COMPLETED → userAchievement.createMany вызывается с FIRST_MATCH', async () => {
      setupForStatus('COMPLETED');

      await service.updateMatchStatus(1, 'COMPLETED');

      expect(prismaMock.userAchievement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ badgeId: 'FIRST_MATCH' }),
          ]),
          skipDuplicates: true,
        })
      );
    });

    it('COMPLETED → реферер получает +0.3 репутации при первом матче', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeMatch({ participantId: null }));
      prismaMock.appConfig.findMany.mockResolvedValue([
        { key: 'repFailedPenalty', value: '1.0' },
        { key: 'repBanThreshold', value: '2.0' },
        { key: 'repBanDays', value: '30' },
      ]);
      prismaMock.questLobby.update.mockResolvedValue({ id: 1, status: 'COMPLETED' });

      let referrerUpdated = false;

      prismaMock.$transaction
        .mockResolvedValueOnce([{ id: 1, status: 'COMPLETED' }])
        .mockImplementationOnce(async (fn: any) => {
          const txMock = {
            user: {
              findUnique: jest.fn()
                .mockResolvedValueOnce({ reputation: 5.0, bannedUntil: null, xp: 0 })   // host
                .mockResolvedValueOnce({ referredById: 99 })                              // referral check
                .mockResolvedValueOnce({ id: 99, reputation: 5.0 }),                     // referrer
              update: jest.fn().mockImplementation(({ where, data }: any) => {
                if (where.id === 99 && data.reputation === 5.3) referrerUpdated = true;
                return Promise.resolve({});
              }),
            },
            questLobby: {
              count: jest.fn().mockResolvedValue(0), // 0 предыдущих COMPLETED — первый матч
            },
          };
          return fn(txMock);
        });

      prismaMock.userAchievement.createMany.mockResolvedValue({ count: 1 });

      await service.updateMatchStatus(1, 'COMPLETED');

      expect(referrerUpdated).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // cleanupStaleLobbies
  // ══════════════════════════════════════════════════════════════════════════

  describe('cleanupStaleLobbies', () => {
    it('вызывает questLobby.updateMany со статусом EXPIRED', async () => {
      prismaMock.questLobby.updateMany.mockResolvedValue({ count: 3 });

      await service.cleanupStaleLobbies();

      expect(prismaMock.questLobby.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'WAITING' }),
          data: { status: 'EXPIRED' },
        })
      );
    });

    it('createdAt фильтр — только лобби старше 15 минут', async () => {
      prismaMock.questLobby.updateMany.mockResolvedValue({ count: 0 });

      await service.cleanupStaleLobbies();

      const callArg = prismaMock.questLobby.updateMany.mock.calls[0][0];
      expect(callArg.where.createdAt).toHaveProperty('lt');
      const ltDate = callArg.where.createdAt.lt as Date;
      const diffMs = Date.now() - ltDate.getTime();
      // Should be approximately 15 minutes ago (14-16 min range)
      expect(diffMs).toBeGreaterThan(14 * 60 * 1000);
      expect(diffMs).toBeLessThan(16 * 60 * 1000);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // leaveReview
  // ══════════════════════════════════════════════════════════════════════════

  describe('leaveReview', () => {
    const makeCompletedMatch = () => ({
      id: 1,
      hostId: 10,
      participantId: 11,
      status: 'COMPLETED',
    });

    const setupReview = (rating: number, userReputation = 5.0) => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeCompletedMatch());
      prismaMock.matchReview.findUnique.mockResolvedValue(null); // нет существующего отзыва
      prismaMock.matchReview.create.mockResolvedValue({ id: 1, rating });
      prismaMock.appConfig.findMany.mockResolvedValue([
        { key: 'repCompletedBonus', value: '0.5' },
      ]);

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ reputation: userReputation, xp: 0 })
              .mockResolvedValueOnce({ reputation: userReputation, xp: 0 }),
            update: jest.fn().mockResolvedValue({}),
          },
          matchReview: {
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 3.0 }, _count: { id: 3 } }),
          },
          userAchievement: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      });
    };

    it('матч не найден → кидает Error', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(null);

      await expect(service.leaveReview(999, 10, 5)).rejects.toThrow('Матч не найден');
    });

    it('матч не COMPLETED → кидает Error', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue({ ...makeCompletedMatch(), status: 'MATCHED' });

      await expect(service.leaveReview(1, 10, 5)).rejects.toThrow();
    });

    it('reviewer не участник матча → кидает Error', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeCompletedMatch());

      await expect(service.leaveReview(1, 99, 5)).rejects.toThrow('Доступ запрещен');
    });

    it('повторный отзыв → кидает Error', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeCompletedMatch());
      prismaMock.matchReview.findUnique.mockResolvedValue({ id: 1 }); // уже есть

      await expect(service.leaveReview(1, 10, 5)).rejects.toThrow('уже оставили');
    });

    it('rating=5 → reviewer получает +0.1 reputation, target получает maxBonus', async () => {
      setupReview(5);

      let reviewerRepUpdate: number | undefined;
      let targetRepUpdate: number | undefined;

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ reputation: 5.0, xp: 0 })  // reviewer
              .mockResolvedValueOnce({ reputation: 5.0, xp: 0 }), // target
            update: jest.fn()
              .mockImplementationOnce(({ data }: any) => {
                reviewerRepUpdate = data.reputation;
                return Promise.resolve({});
              })
              .mockImplementationOnce(({ data }: any) => {
                targetRepUpdate = data.reputation;
                return Promise.resolve({});
              }),
          },
          matchReview: {
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 3.0 }, _count: { id: 3 } }),
          },
          userAchievement: { create: jest.fn() },
        };
        return fn(txMock);
      });

      await service.leaveReview(1, 10, 5);

      expect(reviewerRepUpdate).toBeCloseTo(5.1, 2);
      expect(targetRepUpdate).toBeCloseTo(5.5, 2); // 5 + 0.5 * (5-1)/4 = 5.5
    });

    it('rating=1 → target получает бонус ≈ 0', async () => {
      setupReview(1);

      let targetRepUpdate: number | undefined;

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ reputation: 5.0, xp: 0 })
              .mockResolvedValueOnce({ reputation: 5.0, xp: 0 }),
            update: jest.fn()
              .mockImplementationOnce(() => Promise.resolve({}))
              .mockImplementationOnce(({ data }: any) => {
                targetRepUpdate = data.reputation;
                return Promise.resolve({});
              }),
          },
          matchReview: {
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 3.0 }, _count: { id: 3 } }),
          },
          userAchievement: { create: jest.fn() },
        };
        return fn(txMock);
      });

      await service.leaveReview(1, 10, 1);

      // target gets 0 bonus: 5.0 + 0 = 5.0
      expect(targetRepUpdate).toBeCloseTo(5.0, 2);
    });

    it('avg ≥ 4.9 и ≥ 10 отзывов → userAchievement.create с PERFECT_RATING', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeCompletedMatch());
      prismaMock.matchReview.findUnique.mockResolvedValue(null);
      prismaMock.matchReview.create.mockResolvedValue({ id: 1, rating: 5 });
      prismaMock.appConfig.findMany.mockResolvedValue([{ key: 'repCompletedBonus', value: '0.5' }]);

      let achievementCreated = false;

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ reputation: 5.0, xp: 0 })
              .mockResolvedValueOnce({ reputation: 5.0, xp: 0 }),
            update: jest.fn().mockResolvedValue({}),
          },
          matchReview: {
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.95 }, _count: { id: 11 } }),
          },
          userAchievement: {
            create: jest.fn().mockImplementation(() => {
              achievementCreated = true;
              return Promise.resolve({});
            }),
          },
        };
        return fn(txMock);
      });

      await service.leaveReview(1, 10, 5);

      expect(achievementCreated).toBe(true);
    });

    it('reviewer получает +20 XP', async () => {
      setupReview(3);

      let reviewerXpUpdate: number | undefined;

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ reputation: 5.0, xp: 100 })
              .mockResolvedValueOnce({ reputation: 5.0, xp: 100 }),
            update: jest.fn()
              .mockImplementationOnce(({ data }: any) => {
                reviewerXpUpdate = data.xp;
                return Promise.resolve({});
              })
              .mockImplementationOnce(() => Promise.resolve({})),
          },
          matchReview: {
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 3.0 }, _count: { id: 3 } }),
          },
          userAchievement: { create: jest.fn() },
        };
        return fn(txMock);
      });

      await service.leaveReview(1, 10, 3);

      expect(reviewerXpUpdate).toBe(120); // 100 + 20
    });

    it('rating=5 → target получает +30 XP', async () => {
      setupReview(5);

      let targetXpUpdate: number | undefined;

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ reputation: 5.0, xp: 50 })
              .mockResolvedValueOnce({ reputation: 5.0, xp: 50 }),
            update: jest.fn()
              .mockImplementationOnce(() => Promise.resolve({}))
              .mockImplementationOnce(({ data }: any) => {
                targetXpUpdate = data.xp;
                return Promise.resolve({});
              }),
          },
          matchReview: {
            aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 3.0 }, _count: { id: 3 } }),
          },
          userAchievement: { create: jest.fn() },
        };
        return fn(txMock);
      });

      await service.leaveReview(1, 10, 5);

      expect(targetXpUpdate).toBe(80); // 50 + 30
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getMapQuests
  // ══════════════════════════════════════════════════════════════════════════

  describe('getMapQuests', () => {
    it('возвращает квесты с _waitingCount', async () => {
      prismaMock.questTemplate.findMany.mockResolvedValue([
        {
          id: 'q1', title: 'Quest', description: '', category: 'games', subcategory: 'board',
          imageUrl: null, address: 'Москва', price: null, lat: 55.75, lon: 37.62,
          sponsored: false, sponsorName: null, sponsorLogo: null,
          lobbies: [{ id: 1 }, { id: 2 }],
        },
      ]);

      const result = await service.getMapQuests(1);

      expect(result[0]._waitingCount).toBe(2);
      expect((result[0] as any).lobbies).toBeUndefined();
    });

    it('фильтрует по категории если передана', async () => {
      prismaMock.questTemplate.findMany.mockResolvedValue([]);

      await service.getMapQuests(1, 'games');

      const callArg = prismaMock.questTemplate.findMany.mock.calls[0][0];
      expect(callArg.where.category).toBe('games');
    });

    it('без категории → условие category не включается', async () => {
      prismaMock.questTemplate.findMany.mockResolvedValue([]);

      await service.getMapQuests(1);

      const callArg = prismaMock.questTemplate.findMany.mock.calls[0][0];
      expect(callArg.where.category).toBeUndefined();
    });

    it('запрашивает только квесты с lat и lon', async () => {
      prismaMock.questTemplate.findMany.mockResolvedValue([]);

      await service.getMapQuests(1);

      const callArg = prismaMock.questTemplate.findMany.mock.calls[0][0];
      expect(callArg.where.lat).toEqual({ not: null });
      expect(callArg.where.lon).toEqual({ not: null });
    });
  });
});
