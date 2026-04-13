import { Test, TestingModule } from '@nestjs/testing';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock';

// Mock the web-push module entirely
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import * as webpush from 'web-push';

const mockSendNotification = webpush.sendNotification as jest.Mock;

describe('PushService', () => {
  let service: PushService;
  let prismaMock: PrismaMock;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    mockSendNotification.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  // ── Нет подписок ────────────────────────────────────────────────────────────

  it('нет подписок → sendNotification не вызывается', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([]);

    await service.sendToUser(1, 'Заголовок', 'Тело');

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('нет подписок → возвращает undefined', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([]);

    const result = await service.sendToUser(1, 'Заголовок', 'Тело');

    expect(result).toBeUndefined();
  });

  // ── Успешная отправка ────────────────────────────────────────────────────────

  it('2 подписки → sendNotification вызывается 2 раза', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 1, endpoint: 'https://push1.example.com', p256dh: 'key1', auth: 'auth1' },
      { id: 2, endpoint: 'https://push2.example.com', p256dh: 'key2', auth: 'auth2' },
    ]);
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    await service.sendToUser(1, 'Test', 'Body');

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('payload содержит title, body, url, icon', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 1, endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' },
    ]);
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    await service.sendToUser(1, 'Привет', 'Текст', '/match/42', '/custom-icon.png');

    const payloadStr = mockSendNotification.mock.calls[0][1] as string;
    const payload = JSON.parse(payloadStr);

    expect(payload.title).toBe('Привет');
    expect(payload.body).toBe('Текст');
    expect(payload.url).toBe('/match/42');
    expect(payload.icon).toBe('/custom-icon.png');
  });

  it('без icon → fallback "/logo.png"', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 1, endpoint: 'https://push.example.com', p256dh: 'key', auth: 'auth' },
    ]);
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    await service.sendToUser(1, 'Title', 'Body');

    const payload = JSON.parse(mockSendNotification.mock.calls[0][1] as string);
    expect(payload.icon).toBe('/logo.png');
  });

  it('sendNotification вызывается с правильными ключами подписки', async () => {
    const sub = { id: 1, endpoint: 'https://fcm.googleapis.com/sub1', p256dh: 'myP256', auth: 'myAuth' };
    prismaMock.pushSubscription.findMany.mockResolvedValue([sub]);
    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    await service.sendToUser(1, 'T', 'B');

    expect(mockSendNotification).toHaveBeenCalledWith(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      expect.any(String)
    );
  });

  // ── Очистка невалидных подписок ──────────────────────────────────────────────

  it('statusCode 410 → pushSubscription.delete вызывается', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 5, endpoint: 'https://expired.example.com', p256dh: 'k', auth: 'a' },
    ]);
    const error: any = new Error('Gone');
    error.statusCode = 410;
    mockSendNotification.mockRejectedValue(error);
    prismaMock.pushSubscription.delete.mockResolvedValue({});

    await service.sendToUser(1, 'T', 'B');

    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it('statusCode 404 → pushSubscription.delete вызывается', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 6, endpoint: 'https://notfound.example.com', p256dh: 'k', auth: 'a' },
    ]);
    const error: any = new Error('Not Found');
    error.statusCode = 404;
    mockSendNotification.mockRejectedValue(error);
    prismaMock.pushSubscription.delete.mockResolvedValue({});

    await service.sendToUser(1, 'T', 'B');

    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 6 } });
  });

  it('statusCode 500 → pushSubscription.delete НЕ вызывается', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 7, endpoint: 'https://server-error.example.com', p256dh: 'k', auth: 'a' },
    ]);
    const error: any = new Error('Internal Server Error');
    error.statusCode = 500;
    mockSendNotification.mockRejectedValue(error);

    await service.sendToUser(1, 'T', 'B');

    expect(prismaMock.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('одна подписка 410, другая успешна → удаляется только невалидная', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 10, endpoint: 'https://expired.example.com', p256dh: 'k1', auth: 'a1' },
      { id: 11, endpoint: 'https://valid.example.com', p256dh: 'k2', auth: 'a2' },
    ]);
    const error: any = new Error('Gone');
    error.statusCode = 410;
    mockSendNotification
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ statusCode: 201 });
    prismaMock.pushSubscription.delete.mockResolvedValue({});

    await service.sendToUser(1, 'T', 'B');

    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  // ── Использует Promise.allSettled (не падает при частичных ошибках) ─────────

  it('одна подписка упала — не кидает исключение наружу', async () => {
    prismaMock.pushSubscription.findMany.mockResolvedValue([
      { id: 20, endpoint: 'https://broken.example.com', p256dh: 'k', auth: 'a' },
    ]);
    const error: any = new Error('Network error');
    error.statusCode = 503;
    mockSendNotification.mockRejectedValue(error);

    await expect(service.sendToUser(1, 'T', 'B')).resolves.not.toThrow();
  });
});
