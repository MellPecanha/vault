import { bonusSpin, spinAll, type RandomSource, type Reels } from '../domain/symbols';
import { evaluateSpin, type SpinEvaluation } from '../domain/scoring';

export const INITIAL_COIN_BALANCE = 100;
export const SPIN_COST = 1;

export interface Player {
  id: string;
  publicId: string;
  coinBalance: number;
  personalRecord: number;
}

export interface GameResult {
  id: string;
  playerId: string;
  reels: Reels;
  evaluation: SpinEvaluation;
  pendingPrize: number;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Persistence boundary implemented later by the MikroORM adapter. */
export interface GameRepository {
  findOrCreatePlayer(publicId: string): Promise<Player>;
  savePlayer(player: Player): Promise<void>;
  createResult(result: Omit<GameResult, 'id'>): Promise<GameResult>;
  findResultForPlayer(playerId: string, resultId: string): Promise<GameResult | null>;
  saveResult(result: GameResult): Promise<void>;
  listResultsForPlayer(playerId: string, limit: number, offset: number): Promise<GameResult[]>;
}

export class InvalidPlayerIdentifierError extends Error {}
export class InsufficientCoinsError extends Error {}
export class ResultNotFoundError extends Error {}
export class PrizeAlreadySettledError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertAnonymousPlayerId(publicId: string): void {
  if (!UUID_PATTERN.test(publicId)) {
    throw new InvalidPlayerIdentifierError('Anonymous player identifier must be a valid UUID.');
  }
}

export interface SpinResponse {
  player: Pick<Player, 'publicId' | 'coinBalance' | 'personalRecord'>;
  result: GameResult;
}

export class GameService {
  constructor(
    private readonly repository: GameRepository,
    private readonly random: RandomSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async regularSpin(publicId: string, pendingResultId?: string): Promise<SpinResponse> {
    const player = await this.resolvePlayer(publicId);

    if (pendingResultId !== undefined) {
      await this.settlePendingPrize(player, pendingResultId);
    }

    this.chargeSpin(player);
    const result = await this.createPendingResult(player, spinAll(this.random));
    await this.repository.savePlayer(player);
    return { player: this.toPlayerResponse(player), result };
  }

  async bonusSpin(publicId: string, resultId: string, reelIndex: number): Promise<SpinResponse> {
    const player = await this.resolvePlayer(publicId);
    const result = await this.requirePendingResult(player, resultId);

    this.chargeSpin(player);
    const reels = bonusSpin(result.reels, reelIndex, this.random);
    const evaluation = evaluateSpin(reels);
    const updatedResult: GameResult = {
      ...result,
      reels,
      evaluation,
      pendingPrize: evaluation.prize,
      updatedAt: this.now(),
    };
    player.personalRecord = Math.max(player.personalRecord, evaluation.prize);

    await this.repository.saveResult(updatedResult);
    await this.repository.savePlayer(player);
    return { player: this.toPlayerResponse(player), result: updatedResult };
  }

  async redeemPrize(publicId: string, resultId: string): Promise<SpinResponse> {
    const player = await this.resolvePlayer(publicId);
    const result = await this.settlePendingPrize(player, resultId);
    await this.repository.savePlayer(player);
    return { player: this.toPlayerResponse(player), result };
  }

  async history(publicId: string, limit: number, offset: number): Promise<GameResult[]> {
    const player = await this.resolvePlayer(publicId);
    return this.repository.listResultsForPlayer(player.id, limit, offset);
  }

  private async resolvePlayer(publicId: string): Promise<Player> {
    assertAnonymousPlayerId(publicId);
    return this.repository.findOrCreatePlayer(publicId);
  }

  private chargeSpin(player: Player): void {
    if (player.coinBalance < SPIN_COST) {
      throw new InsufficientCoinsError('At least one coin is required to spin.');
    }
    player.coinBalance -= SPIN_COST;
  }

  private async createPendingResult(player: Player, reels: Reels): Promise<GameResult> {
    const evaluation = evaluateSpin(reels);
    player.personalRecord = Math.max(player.personalRecord, evaluation.prize);
    const timestamp = this.now();
    return this.repository.createResult({
      playerId: player.id,
      reels,
      evaluation,
      pendingPrize: evaluation.prize,
      settledAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  private async requirePendingResult(player: Player, resultId: string): Promise<GameResult> {
    const result = await this.repository.findResultForPlayer(player.id, resultId);
    if (result === null) throw new ResultNotFoundError('Game result was not found for this player.');
    if (result.settledAt !== null) throw new PrizeAlreadySettledError('Prize has already been settled.');
    return result;
  }

  private async settlePendingPrize(player: Player, resultId: string): Promise<GameResult> {
    const result = await this.requirePendingResult(player, resultId);
    player.coinBalance += result.pendingPrize;
    const settledResult: GameResult = {
      ...result,
      settledAt: this.now(),
      updatedAt: this.now(),
    };
    await this.repository.saveResult(settledResult);
    return settledResult;
  }

  private toPlayerResponse(player: Player): Pick<Player, 'publicId' | 'coinBalance' | 'personalRecord'> {
    return {
      publicId: player.publicId,
      coinBalance: player.coinBalance,
      personalRecord: player.personalRecord,
    };
  }
}
