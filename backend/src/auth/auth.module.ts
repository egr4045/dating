import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SUPER_SECRET_KEY', // В будущем вынесем это в .env для безопасности
      signOptions: { expiresIn: '7d' }, // Токен будет жить 7 дней, потом юзеру надо будет перелогиниться
    }),
  ],
  providers: [AuthService, PrismaService],
  controllers: [AuthController],
})
export class AuthModule {}