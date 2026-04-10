import { Controller, Post, Patch, Get, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { UpdateSlotsDto } from './dto/update-slots.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req: any, @Body() data: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, data);
  }

  @Post('video')
  @UseGuards(JwtAuthGuard)
  async uploadVideo(@Request() req: any, @Body() body: { videoUrl: string }) {
    return this.usersService.updateVideo(req.user.id, body.videoUrl);
  }

  @Post('interests')
  @UseGuards(JwtAuthGuard)
  async setInterests(@Request() req: any, @Body() data: UpdateInterestsDto) {
    return this.usersService.updateInterests(req.user.id, data.interests);
  }

  @Post('slots')
  @UseGuards(JwtAuthGuard)
  async setSlots(@Request() req: any, @Body() data: UpdateSlotsDto) {
    return this.usersService.updateSlots(req.user.id, data.slots);
  }

  @Post('test-login')
  async testLogin(@Body() body: { name: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Тестовый вход отключен в продакшене');
    }
    return this.usersService.testLogin(body.name);
  }
}
