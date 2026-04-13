import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SwipeQuestDto } from './dto/swipe-quest.dto';
import { UpdateMatchStatusDto } from './dto/update-match-status.dto';
import { ConfirmSlotDto } from './dto/confirm-slot.dto';
import { DeclineSlotsDto } from './dto/decline-slots.dto';
import { ProposeDateDto, ConfirmDateDto } from './dto/propose-date.dto';

@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get('public/:id')
  async getPublicQuest(@Param('id') id: string) {
    const quest = await this.questsService.getQuestTemplate(id);
    if (!quest) throw new NotFoundException('Quest not found');
    
    // Считаем сколько сейчас активных лобби для этого квеста (социальное доказательство)
    const count = await this.questsService.getLobbyCountForQuest(id);
    return { ...quest, waitingCount: count };
  }

  @Get('map')
  @UseGuards(JwtAuthGuard)
  async getMapQuests(
    @Request() req: any,
    @Query('category') category?: string,
  ) {
    return this.questsService.getMapQuests(req.user.id, category);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  getFeed(
    @Request() req: any,
    @Query('prefGender') prefGender?: string,
    @Query('ageMin') ageMin?: string,
    @Query('ageMax') ageMax?: string,
    @Query('category') category?: string,
    @Query('todayOnly') todayOnly?: string,
  ) {
    const filters = {
      prefGender,
      ageMin: ageMin ? parseInt(ageMin) : undefined,
      ageMax: ageMax ? parseInt(ageMax) : undefined,
      category,
      todayOnly: todayOnly === 'true'
    };
    return this.questsService.getAvailableQuests(req.user.id, filters);
  }

  @Post('swipe')
  @UseGuards(JwtAuthGuard)
  async swipe(
    @Request() req: any,
    @Body() body: SwipeQuestDto
  ) {
    return this.questsService.handleSwipe(req.user.id, body.questId, body.action);
  }

  // Пользователь выбрал слот из лобби — подтверждаем метч
  @Post('confirm-slot')
  @UseGuards(JwtAuthGuard)
  async confirmSlot(@Request() req: any, @Body() body: ConfirmSlotDto) {
    return this.questsService.confirmSlot(req.user.id, body.lobbyId, body.selectedSlot);
  }

  // Пользователю не подошли слоты — создаёт своё лобби
  @Post('decline-slots')
  @UseGuards(JwtAuthGuard)
  async declineSlots(@Request() req: any, @Body() body: DeclineSlotsDto) {
    return this.questsService.declineSlots(req.user.id, body.questId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Request() req: any) {
    return this.questsService.getHistory(req.user.id);
  }

  @Get('match/:id')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async getActiveMatch(@Request() req: any) {
    const match = await this.questsService.getActiveMatch(req.user.id);
    return match ? { hasActiveMatch: true, matchId: match.id } : { hasActiveMatch: false };
  }

  @Get('match/:id/messages')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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

  @Post('match/:id/review')
  @UseGuards(JwtAuthGuard)
  async leaveReview(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { rating: number; comment?: string }
  ) {
    const matchId = parseInt(id);
    if (isNaN(matchId)) throw new NotFoundException('Invalid Match ID');
    if (!body.rating || body.rating < 1 || body.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    return this.questsService.leaveReview(matchId, req.user.id, body.rating, body.comment);
  }
}