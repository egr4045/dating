import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(@ConnectedSocket() client: Socket, @MessageBody() userId: number) {
    client.join(`user_${userId}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() matchId: number) {
    client.join(`match_${matchId}`);
  }

  // ФРОНТ СООБЩАЕТ: "Я ПРОЧИТАЛ"
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(@MessageBody() data: { matchId: number, userId: number }) {
    const lobby = await this.prisma.questLobby.findUnique({ where: { id: data.matchId } });
    if (!lobby) return;

    if (lobby.hostId === data.userId) {
      await this.prisma.questLobby.update({ where: { id: data.matchId }, data: { hostLastReadAt: new Date() } });
    } else {
      await this.prisma.questLobby.update({ where: { id: data.matchId }, data: { participantLastReadAt: new Date() } });
    }
  }

  // ОТПРАВКА СООБЩЕНИЯ
  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() data: { matchId: number, senderId: number, text: string }) {
    const message = await this.prisma.message.create({
      data: { matchId: data.matchId, senderId: data.senderId, text: data.text }
    });

    const lobby = await this.prisma.questLobby.findUnique({ where: { id: data.matchId } });
    if (lobby) {
      const isHost = lobby.hostId === data.senderId;
      await this.prisma.questLobby.update({
        where: { id: data.matchId },
        data: {
          lastMessageAt: new Date(),
          hostLastReadAt: isHost ? new Date() : undefined,
          participantLastReadAt: !isHost ? new Date() : undefined,
        }
      });
    }

    this.server.to(`match_${data.matchId}`).emit('newMessage', message);
    return message;
  }
}