import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseIntPipe, Post, Query, ValidationPipe } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { GameService, type GameResult, type SpinResponse } from '../application/game';

class RegularSpinDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  pendingResultId?: string;
}

class BonusSpinDto {
  @IsInt()
  @Min(0)
  @Max(3)
  reelIndex!: number;
}

class HistoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset = 0;
}

@ApiTags('game')
@ApiHeader({ name: 'x-anonymous-player-id', required: true, description: 'Browser-generated UUID used only to scope anonymous data.' })
@Controller('v1')
export class GameController {
  constructor(@Inject(GameService) private readonly game: GameService) {}

  @Post('spins')
  @ApiOperation({ summary: 'Start a server-generated regular spin.' })
  regularSpin(@Headers('x-anonymous-player-id') playerId: string, @Body() body: RegularSpinDto) {
    return this.game.regularSpin(playerId, body.pendingResultId).then((response) => this.toResponse(response));
  }

  @Post('results/:resultId/bonus-spins')
  @ApiOperation({ summary: 'Pay one coin to re-spin one reel of a pending result.' })
  bonusSpin(
    @Headers('x-anonymous-player-id') playerId: string,
    @Param('resultId') resultId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: BonusSpinDto })) body: BonusSpinDto,
  ) {
    return this.game.bonusSpin(playerId, resultId, body.reelIndex).then((response) => this.toResponse(response));
  }

  @Post('results/:resultId/redeem')
  @HttpCode(200)
  @ApiOperation({ summary: 'Settle a pending prize into the player coin balance.' })
  redeem(@Headers('x-anonymous-player-id') playerId: string, @Param('resultId') resultId: string) {
    return this.game.redeemPrize(playerId, resultId).then((response) => this.toResponse(response));
  }

  @Get('history')
  @ApiOperation({ summary: 'List only the resolved anonymous player history.' })
  history(
    @Headers('x-anonymous-player-id') playerId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
  ) {
    return this.game.history(playerId, Math.min(Math.max(limit, 1), 50), Math.max(offset, 0))
      .then((results) => results.map((result) => this.toPublicResult(result)));
  }

  private toResponse(response: SpinResponse) {
    return { player: response.player, result: this.toPublicResult(response.result) };
  }

  private toPublicResult(result: GameResult) {
    const { playerId: _, ...publicResult } = result;
    return publicResult;
  }
}
