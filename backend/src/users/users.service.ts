import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async updateProfile(userId: number, data: {
    firstName?: string;
    age?: number;
    gender?: string;
    city?: string;
    bio?: string;
    photoUrl?: string;
    prefGender?: string;
    prefAgeMin?: number;
    prefAgeMax?: number;
  }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async updateVideo(userId: number, videoUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { videoUrl, videoVerified: false },
    });
  }

  async updateInterests(userId: number, interests: string[]) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { interests },
    });
  }

  async updateSlots(userId: number, slots: { dayOfWeek: number; timeFrom: string; timeTo: string }[]) {
    // Удаляем старые слоты
    await this.prisma.timeSlot.deleteMany({ where: { userId } });
    // Создаём новые
    await this.prisma.timeSlot.createMany({
      data: slots.map(s => ({ userId, dayOfWeek: s.dayOfWeek, timeFrom: s.timeFrom, timeTo: s.timeTo })),
    });
    return { success: true };
  }

  async getProfile(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        username: true,
        reputation: true,
        interests: true,
        bannedUntil: true,
        age: true,
        gender: true,
        city: true,
        bio: true,
        photoUrl: true,
        videoUrl: true,
        videoVerified: true,
        prefGender: true,
        prefAgeMin: true,
        prefAgeMax: true,
        ghostCount: true,
        timeSlots: {
          select: { id: true, dayOfWeek: true, timeFrom: true, timeTo: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });
  }


  async testLogin(name: string) {
    // Ищем тестового юзера с таким именем
    let user = await this.prisma.user.findFirst({
      where: { firstName: name, telegramId: { startsWith: 'test-' } }
    });

    // Если нет — создаем с базовыми интересами
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId: `test-${Date.now()}`,
          firstName: name,
          interests: [], 
        }
      });
    }

    // Генерируем токен для тестового юзера
    const token = this.jwtService.sign({ sub: user.id, telegramId: user.telegramId });

    return { user, token };
  }
}