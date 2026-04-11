import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SwipeQuestDto } from './dto/swipe-quest.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';
import { ConfirmSlotDto } from './dto/confirm-slot.dto';
import { DeclineSlotsDto } from './dto/decline-slots.dto';
import { ProposeDateDto, ConfirmDateDto } from './dto/propose-date.dto';

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

  // Пользователь выбрал слот из лобби — подтверждаем метч
  @Post('confirm-slot')
  async confirmSlot(@Request() req: any, @Body() body: ConfirmSlotDto) {
    return this.questsService.confirmSlot(req.user.id, body.lobbyId, body.selectedSlot);
  }

  // Пользователю не подошли слоты — создаёт своё лобби
  @Post('decline-slots')
  async declineSlots(@Request() req: any, @Body() body: DeclineSlotsDto) {
    return this.questsService.declineSlots(req.user.id, body.questId);
  }

  @Get('history')
  getHistory(@Request() req: any) {
    return this.questsService.getHistory(req.user.id);
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

  @Get('match/:id/messages')
  async getMessages(
    @Request() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    const matchId = parseInt(id);
    if (isNaN(matchId)) throw new NotFoundException('Invalid Match ID');
    const result = await this.questsService.getMessages(matchId, req.user.id, cursor ? parseInt(cursor) : undefined);
    if (result === null) throw new UnauthorizedException('Access denied');
    return result;
  }

  @Post('match/:id/propose-date')
  async proposeDate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: ProposeDateDto,
  ) {
    const matchId = parseInt(id);
    if (isNaN(matchId)) throw new NotFoundException('Invalid Match ID');

    const proposedDate = new Date(body.proposedDate);
    if (proposedDate <= new Date()) {
      throw new BadRequestException('Дата встречи должна быть в будущем');
    }

    return this.questsService.proposeDate(matchId, req.user.id, proposedDate);
  }

  @Post('match/:id/confirm-date')
  async confirmDate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: ConfirmDateDto,
  ) {
    const matchId = parseInt(id);
    if (isNaN(matchId)) throw new NotFoundException('Invalid Match ID');

    let counterDate: Date | undefined;
    if (body.counterDate) {
      counterDate = new Date(body.counterDate);
      if (counterDate <= new Date()) {
        throw new BadRequestException('Встречная дата должна быть в будущем');
      }
    }

    return this.questsService.confirmDate(matchId, req.user.id, body.accept, counterDate);
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