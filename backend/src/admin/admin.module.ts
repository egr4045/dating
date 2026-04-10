import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      // Используем разные секреты: ADMIN_JWT_SECRET для админки
      secret: process.env.ADMIN_JWT_SECRET || 'admin-secret',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard, PrismaService],
})
export class AdminModule {}
