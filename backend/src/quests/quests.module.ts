import { Module } from '@nestjs/common';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module'; // <-- 1. Импортируем

@Module({
  imports: [ChatModule, NotificationsModule], // <-- 2. Добавляем в массив
  controllers: [QuestsController],
  providers: [QuestsService, PrismaService],
})
export class QuestsModule {}