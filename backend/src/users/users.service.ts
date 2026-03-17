import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateInterests(userId: number, interests: string[]) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { interests },
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
          interests: ['mc', 'dota', 'movie_online', 'chatting'], 
        }
      });
    }
    return user;
  }
}