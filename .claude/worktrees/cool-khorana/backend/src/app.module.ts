import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule'; // Импорт крона
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { QuestsModule } from './quests/quests.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module'; // Импорт нашего модуля
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Обязательно запускаем крон
    AuthModule, 
    UsersModule, 
    QuestsModule, 
    ChatModule, 
    NotificationsModule
  ], 
  providers: [PrismaService],
})
export class AppModule {}