import { Controller, Get, Post, Body, Param, UseGuards, Request, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SwipeQuestDto } from './dto/swipe-quest.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';

@Controller('quests')
@UseGuards(JwtAuthGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get('feed')
  getFeed(@Request() req: any) {
    return this.questsService.getAvailableQuests(req.user.id);
  }

  @Post('swipe')
  async swipe(
    @Request() req: any,
    @Body() body: SwipeQuestDto
  ) {
    return this.questsService.handleSwipe(req.user.id, body.questId, body.action);
  }

  @Get('match/:id')
  async getMatch(@Request() req: any, @Param('id') id: string) {
    const matchId = parseInt(id);
    if (isNaN(matchId)) throw new NotFoundException('Invalid Match ID');

    const match = await this.questsService.getMatch(matchId);
    if (!match) throw new NotFoundException('Match not found');

    if (match.hostId !== req.user.id && match.participantId !== req.user.id) {
      throw new UnauthorizedException('Access denied');
    }
    return match;
  }

  @Get('active')
  async getActiveMatch(@Request() req: any) {
    const match = await this.questsService.getActiveMatch(req.user.id);
    return match ? { hasActiveMatch: true, matchId: match.id } : { hasActiveMatch: false };
  }

  @Post('match/:id/status')
  async updateMatchStatus(
    @Request() req: any,
    @Param('id') id: string, 
    @Body() body: UpdateMatchStatusDto
  ) {
    const matchId = parseInt(id);
    if (isNaN(matchId)) throw new NotFoundException('Invalid Match ID');

    const match = await this.questsService.getMatch(matchId);
    if (!match) throw new NotFoundException('Match not found');

    if (match.hostId !== req.user.id && match.participantId !== req.user.id) {
      throw new UnauthorizedException('Access denied');
    }
    return this.questsService.updateMatchStatus(matchId, body.status);
  }
}
