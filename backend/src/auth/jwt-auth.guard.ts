import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Токен не найден');
    }

    const token = authHeader.split(' ')[1];

    try {
      const secret = process.env.JWT_SECRET || 'SUPER_SECRET_KEY';
      // console.log('DEBUG: Использую секрет:', secret); // Можно раскомментировать для проверки
      
      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      // Привязываем полезную нагрузку к объекту request
      request.user = { id: payload.sub, telegramId: payload.telegramId };
    } catch (err) {
      console.error('JWT Verification Error:', err.message);
      throw new UnauthorizedException('Неверный или просроченный токен');
    }

    return true;
  }
}
