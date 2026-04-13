import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PushService } from '../push/push.service';
import { createPrismaMock, PrismaMock } from '../../test/helpers/prisma-mock';

// Helper: create a fake Socket
const makeSocket = (userId?: number, token = 'valid-token') => ({
  id: `socket-${Math.random()}`,
  data: { userId },
  handshake: { auth: { token } },
  join: jest.fn(),
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  disconnect: jest.fn(),
});

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let prismaMock: PrismaMock;

  const jwtMock = {
    verifyAsync: jest.fn().mockResolvedValue({ sub: 1 }),
  };

  const pushMock = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
  };

  // Mock server
  const serverMock = {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: PushService, useValue: pushMock },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    // Inject mock server
    (gateway as any).server = serverMock;

    // Reset mocks
    jest.clearAllMocks();
    serverMock.to.mockReturnValue({ emit: jest.fn() });
    pushMock.sendToUser.mockResolvedValue(undefined);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleConnection
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleConnection', () => {
    it('валидный токен → устанавливает client.data.userId и вызывает join', async () => {
      const client = makeSocket(undefined) as any;
      jwtMock.verifyAsync.mockResolvedValueOnce({ sub: 42 });

      await gateway.handleConnection(client);

      expect(client.data.userId).toBe(42);
      expect(client.join).toHaveBeenCalledWith('user_42');
    });

    it('нет токена → client.disconnect()', async () => {
      const client = makeSocket(undefined, '') as any;
      client.handshake.auth.token = undefined;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('невалидный JWT → client.disconnect()', async () => {
      jwtMock.verifyAsync.mockRejectedValueOnce(new Error('Invalid token'));
      const client = makeSocket(undefined, 'bad-token') as any;

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleMessage — XSS sanitization
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleMessage — XSS и санитизация', () => {
    const makeLobby = (overrides = {}) => ({
      id: 1,
      hostId: 1,
      participantId: 2,
      status: 'MATCHED',
      ...overrides,
    });

    const makeMessage = (text: string) => ({
      id: 100,
      matchId: 1,
      senderId: 1,
      text,
      reactions: [],
    });

    beforeEach(() => {
      prismaMock.questLobby.findUnique.mockResolvedValue(makeLobby());
      prismaMock.questLobby.update.mockResolvedValue({});
      prismaMock.user.findUnique.mockResolvedValue({ id: 1, firstName: 'User1', telegramId: 'tg1' });
    });

    it('<script>alert(1)</script>hello → теги удалены, контент остаётся ("alert(1)hello")', async () => {
      const savedText = ref('');
      prismaMock.message.create.mockImplementation(async ({ data }: any) => {
        savedText.value = data.text;
        return makeMessage(data.text);
      });
      const client = makeSocket(1) as any;

      await gateway.handleMessage(client, { matchId: 1, text: '<script>alert(1)</script>hello' });

      // Реализация удаляет теги (/<[^>]*>/g), но не содержимое между ними
      expect(savedText.value).toBe('alert(1)hello');
      // Ключевое: HTML-теги НЕ сохраняются в БД
      expect(savedText.value).not.toContain('<script>');
      expect(savedText.value).not.toContain('</script>');
    });

    it('<b>bold</b> text → HTML-теги удалены из текста', async () => {
      const savedText = ref('');
      prismaMock.message.create.mockImplementation(async ({ data }: any) => {
        savedText.value = data.text;
        return makeMessage(data.text);
      });
      const client = makeSocket(1) as any;

      await gateway.handleMessage(client, { matchId: 1, text: '<b>bold</b> text' });

      expect(savedText.value).not.toContain('<b>');
      expect(savedText.value).not.toContain('</b>');
      expect(savedText.value).toContain('bold');
      expect(savedText.value).toContain('text');
    });

    it('текст длиннее 1000 символов → обрезается до 1000', async () => {
      let savedLen = 0;
      prismaMock.message.create.mockImplementation(async ({ data }: any) => {
        savedLen = data.text.length;
        return makeMessage(data.text);
      });
      const client = makeSocket(1) as any;
      const longText = 'a'.repeat(2000);

      await gateway.handleMessage(client, { matchId: 1, text: longText });

      expect(savedLen).toBe(1000);
    });

    it('нормальный текст → сохраняется без изменений', async () => {
      const savedText = ref('');
      prismaMock.message.create.mockImplementation(async ({ data }: any) => {
        savedText.value = data.text;
        return makeMessage(data.text);
      });
      const client = makeSocket(1) as any;

      await gateway.handleMessage(client, { matchId: 1, text: 'Привет, как дела?' });

      expect(savedText.value).toBe('Привет, как дела?');
    });

    it('пустой текст (после sanitize) → message.create не вызывается', async () => {
      const client = makeSocket(1) as any;

      await gateway.handleMessage(client, { matchId: 1, text: '<script></script>' });

      expect(prismaMock.message.create).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleMessage — авторизация
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleMessage — авторизация', () => {
    it('пользователь не является участником матча → message.create не вызывается', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue({
        id: 1, hostId: 10, participantId: 11, status: 'MATCHED',
      });
      const client = makeSocket(99) as any; // userId 99 — не хост и не участник

      await gateway.handleMessage(client, { matchId: 1, text: 'Привет' });

      expect(prismaMock.message.create).not.toHaveBeenCalled();
    });

    it('лобби не найдено → message.create не вызывается', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue(null);
      const client = makeSocket(1) as any;

      await gateway.handleMessage(client, { matchId: 999, text: 'Привет' });

      expect(prismaMock.message.create).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleMarkAsRead
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleMarkAsRead', () => {
    it('хост вызывает → обновляется hostLastReadAt', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue({
        id: 1, hostId: 1, participantId: 2,
      });
      prismaMock.questLobby.update.mockResolvedValue({});
      const client = makeSocket(1) as any;

      await gateway.handleMarkAsRead(client, { matchId: 1 });

      expect(prismaMock.questLobby.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hostLastReadAt: expect.any(Date) }),
        })
      );
    });

    it('участник вызывает → обновляется participantLastReadAt', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue({
        id: 1, hostId: 1, participantId: 2,
      });
      prismaMock.questLobby.update.mockResolvedValue({});
      const client = makeSocket(2) as any;

      await gateway.handleMarkAsRead(client, { matchId: 1 });

      expect(prismaMock.questLobby.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ participantLastReadAt: expect.any(Date) }),
        })
      );
    });

    it('не участник → update не вызывается', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue({
        id: 1, hostId: 1, participantId: 2,
      });
      const client = makeSocket(99) as any;

      await gateway.handleMarkAsRead(client, { matchId: 1 });

      expect(prismaMock.questLobby.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleToggleReaction
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleToggleReaction', () => {
    const makeMsg = () => ({
      id: 1,
      matchId: 1,
      match: { id: 1, hostId: 1, participantId: 2 },
    });

    it('реакции нет → messageReaction.create вызывается', async () => {
      prismaMock.message.findUnique.mockResolvedValue(makeMsg());
      prismaMock.messageReaction.findUnique.mockResolvedValue(null);
      prismaMock.messageReaction.create.mockResolvedValue({ id: 1 });
      const client = makeSocket(1) as any;

      await gateway.handleToggleReaction(client, { messageId: 1, emoji: '❤️' });

      expect(prismaMock.messageReaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ messageId: 1, userId: 1, emoji: '❤️' }),
        })
      );
    });

    it('реакция уже есть → messageReaction.delete вызывается', async () => {
      prismaMock.message.findUnique.mockResolvedValue(makeMsg());
      prismaMock.messageReaction.findUnique.mockResolvedValue({ id: 5, emoji: '❤️' });
      prismaMock.messageReaction.delete.mockResolvedValue({});
      const client = makeSocket(1) as any;

      await gateway.handleToggleReaction(client, { messageId: 1, emoji: '❤️' });

      expect(prismaMock.messageReaction.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5 } })
      );
    });

    it('не участник матча → create не вызывается', async () => {
      prismaMock.message.findUnique.mockResolvedValue(makeMsg());
      const client = makeSocket(99) as any;

      await gateway.handleToggleReaction(client, { messageId: 1, emoji: '😂' });

      expect(prismaMock.messageReaction.create).not.toHaveBeenCalled();
    });

    it('сообщение не найдено → ничего не происходит', async () => {
      prismaMock.message.findUnique.mockResolvedValue(null);
      const client = makeSocket(1) as any;

      await gateway.handleToggleReaction(client, { messageId: 999, emoji: '❤️' });

      expect(prismaMock.messageReaction.create).not.toHaveBeenCalled();
      expect(prismaMock.messageReaction.delete).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleJoinRoom
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleJoinRoom', () => {
    it('хост вызывает joinRoom → client.join(`match_N`)', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue({ id: 1, hostId: 1, participantId: 2 });
      const client = makeSocket(1) as any;

      await gateway.handleJoinRoom(client, 1);

      expect(client.join).toHaveBeenCalledWith('match_1');
    });

    it('не участник → client.join не вызывается', async () => {
      prismaMock.questLobby.findUnique.mockResolvedValue({ id: 1, hostId: 1, participantId: 2 });
      const client = makeSocket(99) as any;

      await gateway.handleJoinRoom(client, 1);

      expect(client.join).not.toHaveBeenCalled();
    });
  });
});

// Helper to create reactive ref (since this is not Vue)
function ref<T>(value: T) {
  return { value };
}
