import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-admin-token'];

    if (!token) {
      throw new UnauthorizedException('Admin token not provided');
    }

    try {
      const secret = process.env.ADMIN_JWT_SECRET || 'admin-secret';
      const payload = await this.jwtService.verifyAsync(token, { secret });
      request.admin = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    return true;
  }
}
