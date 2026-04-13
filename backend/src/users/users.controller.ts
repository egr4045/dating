import { Controller, Post, Patch, Get, Delete, Body, Param, UseGuards, Request, ForbiddenException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: './uploads/videos',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadVideo(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new ForbiddenException('Файл не загружен');
    const videoUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/videos/${file.filename}`;
    return this.usersService.updateVideo(req.user.id, videoUrl);
  }

  @Post('photos')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/photos',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadPhoto(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new ForbiddenException('Файл не загружен');
    const photoUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/photos/${file.filename}`;
    return this.usersService.addPhoto(req.user.id, photoUrl);
  }

  @Delete('photos/:id')
  @UseGuards(JwtAuthGuard)
  async deletePhoto(@Request() req: any, @Param('id') id: string) {
    return this.usersService.deletePhoto(req.user.id, parseInt(id));
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

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Request() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async reportUser(
    @Request() req: any,
    @Param('id') reportedId: string,
    @Body('reason') reason: string,
  ) {
    if (!reason) throw new ForbiddenException('Причина не указана');
    return this.usersService.reportUser(req.user.id, parseInt(reportedId), reason);
  }

  @Post(':id/block')
  @UseGuards(JwtAuthGuard)
  async blockUser(@Request() req: any, @Param('id') blockedId: string) {
    return this.usersService.blockUser(req.user.id, parseInt(blockedId));
  }

  @Post('referral/apply')
  @UseGuards(JwtAuthGuard)
  async applyReferral(@Request() req: any, @Body('code') code: string) {
    if (!code) throw new ForbiddenException('Код не указан');
    return this.usersService.applyReferralCode(req.user.id, code);
  }

  @Post('push-subscription')
  @UseGuards(JwtAuthGuard)
  async savePushSub(@Request() req: any, @Body() body: any) {
    return this.usersService.savePushSubscription(req.user.id, body);
  }

  @Delete('push-subscription')
  @UseGuards(JwtAuthGuard)
  async deletePushSub(@Request() req: any, @Body() body: { endpoint: string }) {
    return this.usersService.deletePushSubscription(req.user.id, body.endpoint);
  }

  @Post('test-login')
  async testLogin(@Body() body: { name: string }) {
    if (process.env.ALLOW_TEST_LOGIN !== 'true') {
      throw new ForbiddenException('Тестовый вход отключен. Установите ALLOW_TEST_LOGIN=true для разработки.');
    }
    return this.usersService.testLogin(body.name);
  }
}
