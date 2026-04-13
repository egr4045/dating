import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const AlwaysAllowGuard = { canActivate: (_ctx: ExecutionContext) => true };

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    updateInterests: jest.fn(),
    updateSlots: jest.fn(),
    addPhoto: jest.fn(),
    deletePhoto: jest.fn(),
    deleteAccount: jest.fn(),
    reportUser: jest.fn(),
    blockUser: jest.fn(),
    applyReferralCode: jest.fn(),
    testLogin: jest.fn(),
    savePushSubscription: jest.fn(),
    deletePushSubscription: jest.fn(),
    updateVideo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(AlwaysAllowGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
