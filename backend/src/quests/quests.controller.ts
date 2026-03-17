import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { QuestsService } from './quests.service';

@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  /**
   * Получаем ленту квестов для конкретного пользователя.
   * Вызывается как: GET /quests/feed?userId=1
   */
  @Get('feed')
  getFeed(@Query('userId') userId: string) {
    // Превращаем строку из Query в число
    const id = parseInt(userId);
    return this.questsService.getAvailableQuests(id);
  }

  /**
   * Обрабатываем свайп (лайк или дизлайк).
   * Вызывается как: POST /quests/swipe
   */
  @Post('swipe')
  async swipe(
    @Body() body: { userId: number; questId: string; action: 'like' | 'dislike' }
  ) {
    return this.questsService.handleSwipe(body.userId, body.questId, body.action);
  }

  @Get('match/:id')
  getMatch(@Param('id') id: string) {
    return this.questsService.getMatch(parseInt(id));
  }

  @Get('active')
  async getActiveMatch(@Query('userId') userId: string) {
    const match = await this.questsService.getActiveMatch(parseInt(userId));
    return match ? { hasActiveMatch: true, matchId: match.id } : { hasActiveMatch: false };
  }

  @Post('match/:id/status')
  async updateMatchStatus(
    @Param('id') id: string, 
    @Body() body: { status: 'COMPLETED' | 'FAILED' }
  ) {
    return this.questsService.updateMatchStatus(parseInt(id), body.status);
  }
}