import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'SUPER_SECRET_KEY',
    }),
  ],
  providers: [ChatGateway, PrismaService],
  exports: [ChatGateway],
})
export class ChatModule {}