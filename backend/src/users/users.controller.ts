import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('interests')
  async setInterests(@Body() data: { userId: number, interests: string[] }) {
    return this.usersService.updateInterests(data.userId, data.interests);
  }

  @Post('test-login')
  async testLogin(@Body() body: { name: string }) {
    return this.usersService.testLogin(body.name);
  }
}