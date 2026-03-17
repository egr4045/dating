import { Controller, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('generate')
  generateToken() {
    return this.authService.generateLoginCode();
  }

  @Get('status')
  checkStatus(@Query('token') token: string) {
    return this.authService.checkStatus(token);
  }
}