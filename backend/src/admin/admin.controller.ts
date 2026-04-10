import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, ParseIntPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Авторизация (публичный) ────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { login: string; password: string }) {
    return this.adminService.login(body.login, body.password);
  }

  // ── Пользователи ──────────────────────────────────────────────────────────

  @Get('users')
  @UseGuards(AdminAuthGuard)
  getUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers(search, Number(page) || 1, Number(limit) || 30);
  }

  @Get('users/:id')
  @UseGuards(AdminAuthGuard)
  getUserDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/ban')
  @UseGuards(AdminAuthGuard)
  banUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { days: number },
  ) {
    return this.adminService.banUser(id, body.days);
  }

  @Delete('users/:id')
  @UseGuards(AdminAuthGuard)
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }

  // ── Матчи ──────────────────────────────────────────────────────────────────

  @Get('matches')
  @UseGuards(AdminAuthGuard)
  getMatches(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getMatches(status, search, Number(page) || 1, Number(limit) || 30);
  }

  @Get('matches/:id')
  @UseGuards(AdminAuthGuard)
  getMatchDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getMatchDetail(id);
  }

  // ── Чаты ───────────────────────────────────────────────────────────────────

  @Get('chats')
  @UseGuards(AdminAuthGuard)
  getChats(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getChats(Number(page) || 1, Number(limit) || 30);
  }

  // ── Аналитика ───────────────────────────────────────────────────────────────

  // Публичный эндпоинт — принимает события с фронтенда без авторизации
  @Post('analytics/event')
  @HttpCode(HttpStatus.OK)
  trackEvent(
    @Body() body: {
      event: string;
      sessionId: string;
      userId?: number | null;
      meta?: any;
    },
  ) {
    return this.adminService.trackEvent(
      body.userId ?? null,
      body.sessionId,
      body.event,
      body.meta,
    );
  }

  @Get('analytics/summary')
  @UseGuards(AdminAuthGuard)
  getAnalyticsSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.adminService.getAnalyticsSummary(fromDate, toDate);
  }

  @Get('analytics/events')
  @UseGuards(AdminAuthGuard)
  getAnalyticsEvents(
    @Query('event') event?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAnalyticsEvents(
      event,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      Number(page) || 1,
      Number(limit) || 50,
    );
  }

  @Get('analytics/top-users')
  @UseGuards(AdminAuthGuard)
  getTopUsers(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.adminService.getTopUsers(fromDate, toDate);
  }
}
