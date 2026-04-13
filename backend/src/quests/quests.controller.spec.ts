import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Stub guard — always allows
const AlwaysAllowGuard = { canActivate: (_ctx: ExecutionContext) => true };

describe('QuestsController', () => {
  let controller: QuestsController;

  const questsServiceMock = {
    getAvailableQuests: jest.fn(),
    handleSwipe: jest.fn(),
    getMatch: jest.fn(),
    getActiveMatch: jest.fn(),
    updateMatchStatus: jest.fn(),
    leaveReview: jest.fn(),
    getHistory: jest.fn(),
    getMessages: jest.fn(),
    proposeDate: jest.fn(),
    confirmDate: jest.fn(),
    getQuestTemplate: jest.fn(),
    getLobbyCountForQuest: jest.fn(),
    getMapQuests: jest.fn(),
    confirmSlot: jest.fn(),
    declineSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestsController],
      providers: [{ provide: QuestsService, useValue: questsServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(AlwaysAllowGuard)
      .compile();

    controller = module.get<QuestsController>(QuestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
