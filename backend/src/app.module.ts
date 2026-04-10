import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { QuestsModule } from './quests/quests.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaService } from './prisma/prisma.service';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    QuestsModule,
    ChatModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}