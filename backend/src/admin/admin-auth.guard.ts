import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Admin token not provided');
    }

    const token = authHeader.split(' ')[1];

    try {
      const secret = process.env.ADMIN_JWT_SECRET;
      if (!secret) throw new Error('ADMIN_JWT_SECRET missing');
      
      const payload = await this.jwtService.verifyAsync(token, { secret });
      request.admin = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    return true;
  }
}
