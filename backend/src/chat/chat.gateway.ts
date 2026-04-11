import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

// Разрешённые origins для WebSocket — берём из ALLOWED_ORIGINS или ставим дефолт для dev
const WS_ALLOWED_ORIGINS: (string | RegExp)[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

@WebSocketGateway({
  path: '/api-socket',
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || WS_ALLOWED_ORIGINS.some(p => typeof p === 'string' ? p === origin : p.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error('WebSocket CORS: origin not allowed'));
      }
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    console.log(`[Socket] Попытка подключения: ${client.id}`);
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        console.warn(`[Socket] ${client.id}: Нет токена`);
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET || 'SUPER_SECRET_KEY' });
      client.data.userId = payload.sub;
      client.join(`user_${payload.sub}`);
      console.log(`[Socket] ${client.id}: Успешная авторизация (User ID: ${payload.sub})`);
    } catch (e) {
      console.error(`[Socket] ${client.id}: Ошибка JWT:`, e.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[Socket] Отключился клиент: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() matchId: number) {
    const userId = client.data.userId;
    const lobby = await this.prisma.questLobby.findUnique({ where: { id: matchId } });
    if (lobby && (lobby.hostId === userId || lobby.participantId === userId)) {
      client.join(`match_${matchId}`);
    }
  }

  // ФРОНТ СООБЩАЕТ: "Я ПРОЧИТАЛ"
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId: number }) {
    const userId = client.data.userId;
    const lobby = await this.prisma.questLobby.findUnique({ where: { id: data.matchId } });
    if (!lobby || (lobby.hostId !== userId && lobby.participantId !== userId)) return;

    if (lobby.hostId === userId) {
      await this.prisma.questLobby.update({ where: { id: data.matchId }, data: { hostLastReadAt: new Date() } });
    } else {
      await this.prisma.questLobby.update({ where: { id: data.matchId }, data: { participantLastReadAt: new Date() } });
    }
    // Уведомляем собеседника — его сообщения прочитаны
    client.to(`match_${data.matchId}`).emit('messagesRead');
  }

  private rateLimits = new Map<number, number>();

  private checkRateLimit(userId: number, limitMs: number = 300): boolean {
    const now = Date.now();
    const lastTime = this.rateLimits.get(userId) || 0;
    if (now - lastTime < limitMs) {
      return false; // Слишком часто
    }
    this.rateLimits.set(userId, now);
    return true;
  }

  // ИНДИКАТОР НАБОРА ТЕКСТА
  @SubscribeMessage('typing')
  async handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId: number }) {
    const userId = client.data.userId;
    if (!this.checkRateLimit(userId, 1000)) return; // Ограничение: 1 статус печатает в секунду

    const lobby = await this.prisma.questLobby.findUnique({ where: { id: data.matchId } });
    if (!lobby || (lobby.hostId !== userId && lobby.participantId !== userId)) return;
    // Отправляем событие партнёру (всем в комнате кроме себя)
    client.to(`match_${data.matchId}`).emit('partnerTyping');
  }

  // ОТПРАВКА СООБЩЕНИЯ
  @SubscribeMessage('sendMessage')
  async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() data: { matchId: number, text: string }) {
    const senderId = client.data.userId;
    if (!this.checkRateLimit(senderId, 500)) return; // Ограничение: 2 сообщения в секунду

    // Валидация текста: санитизация и ограничение длины
    const text = (data.text ?? '').trim().slice(0, 1000);
    if (!text) return;

    const lobby = await this.prisma.questLobby.findUnique({ where: { id: data.matchId } });
    if (!lobby || (lobby.hostId !== senderId && lobby.participantId !== senderId)) return;

    const message = await this.prisma.message.create({
      data: { matchId: data.matchId, senderId, text }
    });

    const isHost = lobby.hostId === senderId;
    await this.prisma.questLobby.update({
      where: { id: data.matchId },
      data: {
        lastMessageAt: new Date(),
        hostLastReadAt: isHost ? new Date() : undefined,
        participantLastReadAt: !isHost ? new Date() : undefined,
      }
    });

    this.server.to(`match_${data.matchId}`).emit('newMessage', message);
    return message;
  }
}