import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, ValidationPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { GameService, type GameResult, type HistoryPage, type SpinResponse } from '../application/game';

class RegularSpinDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Current pending result to settle before starting the new spin.',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  pendingResultId?: string;
}

class BonusSpinDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 3, description: 'Zero-based reel index to re-spin.' })
  @IsInt()
  @Min(0)
  @Max(3)
  reelIndex!: number;
}

class HistoryQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

class ErrorResponseDto {
  @ApiProperty({ type: Number, example: 409 })
  statusCode!: number;

  @ApiProperty({ type: String, example: 'The current pending prize must be settled before starting another spin.' })
  message!: string;
}

class PlayerResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  publicId!: string;

  @ApiProperty({ type: Number, example: 99 })
  coinBalance!: number;

  @ApiProperty({ type: Number, example: 100 })
  personalRecord!: number;
}

class EvaluationResponseDto {
  @ApiProperty({ type: Number, example: 20 })
  basePrize!: number;

  @ApiProperty({ type: Number, example: 2 })
  multiplier!: number;

  @ApiProperty({ type: Number, example: 40 })
  prize!: number;

  @ApiProperty({ type: String, enum: ['win', 'loss', 'snake-loss', 'snake-protected'] })
  outcome!: string;

  @ApiProperty({ type: Object, example: { clover: 1, 'multiplier-2x': 1 } })
  counts!: Record<string, number>;
}

class ResultResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: ['coin', 'clover', 'trap', 'multiplier-2x'], isArray: true })
  reels!: string[];

  @ApiProperty({ type: EvaluationResponseDto })
  evaluation!: EvaluationResponseDto;

  @ApiProperty({ type: Number, example: 40 })
  pendingPrize!: number;

  @ApiProperty({ type: String, nullable: true, example: null })
  settledAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

class SpinResponseDto {
  @ApiProperty({ type: PlayerResponseDto })
  player!: PlayerResponseDto;

  @ApiProperty({ type: ResultResponseDto })
  result!: ResultResponseDto;
}

class HistoryResponseDto {
  @ApiProperty({ type: PlayerResponseDto })
  player!: PlayerResponseDto;

  @ApiProperty({ type: ResultResponseDto, isArray: true })
  items!: ResultResponseDto[];

  @ApiProperty({ type: Object, example: { total: 12, limit: 20, offset: 0 } })
  pagination!: { total: number; limit: number; offset: number };
}

@ApiTags('game')
@ApiHeader({
  name: 'x-anonymous-player-id',
  required: true,
  description: 'Browser-generated UUID used only to scope anonymous data.',
})
@Controller('v1')
export class GameController {
  constructor(@Inject(GameService) private readonly game: GameService) {}

  @Post('spins')
  @ApiOperation({ summary: 'Start a server-generated regular spin.' })
  @ApiBody({ type: RegularSpinDto })
  @ApiCreatedResponse({ type: SpinResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  regularSpin(
    @Headers('x-anonymous-player-id') playerId: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        expectedType: RegularSpinDto,
      }),
    )
    body: RegularSpinDto,
  ) {
    return this.game.regularSpin(playerId, body.pendingResultId).then((response) => this.toResponse(response));
  }

  @Post('results/:resultId/bonus-spins')
  @ApiOperation({ summary: 'Pay one coin to re-spin one reel of a pending result.' })
  @ApiBody({ type: BonusSpinDto })
  @ApiCreatedResponse({ type: SpinResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
  bonusSpin(
    @Headers('x-anonymous-player-id') playerId: string,
    @Param('resultId') resultId: string,
    @Body(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, expectedType: BonusSpinDto }),
    )
    body: BonusSpinDto,
  ) {
    return this.game.bonusSpin(playerId, resultId, body.reelIndex).then((response) => this.toResponse(response));
  }

  @Post('results/:resultId/redeem')
  @HttpCode(200)
  @ApiOperation({ summary: 'Settle a pending prize into the player coin balance.' })
  @ApiOkResponse({ type: SpinResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  redeem(@Headers('x-anonymous-player-id') playerId: string, @Param('resultId') resultId: string) {
    return this.game.redeemPrize(playerId, resultId).then((response) => this.toResponse(response));
  }

  @Get('history')
  @ApiOperation({ summary: 'List only the resolved anonymous player history.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 50, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, minimum: 0, example: 0 })
  @ApiOkResponse({ type: HistoryResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  history(
    @Headers('x-anonymous-player-id') playerId: string,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        expectedType: HistoryQueryDto,
      }),
    )
    query: HistoryQueryDto,
  ) {
    return this.game.history(playerId, query.limit, query.offset).then((page) => this.toHistoryResponse(page));
  }

  private toResponse(response: SpinResponse) {
    return { player: response.player, result: this.toPublicResult(response.result) };
  }

  private toPublicResult(result: GameResult) {
    return {
      id: result.id,
      reels: result.reels,
      evaluation: result.evaluation,
      pendingPrize: result.pendingPrize,
      settledAt: result.settledAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  private toHistoryResponse(page: HistoryPage) {
    return {
      player: page.player,
      items: page.results.map((result) => this.toPublicResult(result)),
      pagination: { total: page.total, limit: page.limit, offset: page.offset },
    };
  }
}
