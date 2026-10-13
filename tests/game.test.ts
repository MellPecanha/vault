import { describe, expect, it } from 'vitest';
import {
  GameService,
  InsufficientCoinsError,
  InvalidPlayerIdentifierError,
  PrizeAlreadySettledError,
  type GameRepository,
  type GameResult,
  type Player,
} from '../src/application/game';
import type { RandomSource, Symbol } from '../src/domain/symbols';

const PLAYER_ID = '89c0c392-9c3e-4a1f-9d6a-c139b1d44d46';

class SequenceRandom implements RandomSource {
  private index = 0;
  constructor(private readonly symbols: Symbol[]) {}
  nextSymbol(): Symbol {
    const symbol = this.symbols[this.index++];
    if (symbol === undefined) throw new Error('Random sequence exhausted.');
    return symbol;
  }
}

class InMemoryRepository implements GameRepository {
  readonly players = new Map<string, Player>();
  readonly results = new Map<string, GameResult>();
  private resultNumber = 0;

  async findOrCreatePlayer(publicId: string): Promise<Player> {
    const existing = this.players.get(publicId);
    if (existing) return existing;
    const player = { id: `player-${this.players.size + 1}`, publicId, coinBalance: 100, personalRecord: 0 };
    this.players.set(publicId, player);
    return player;
  }
  async savePlayer(player: Player): Promise<void> { this.players.set(player.publicId, player); }
  async createResult(result: Omit<GameResult, 'id'>): Promise<GameResult> {
    const created = { ...result, id: `result-${++this.resultNumber}` };
    this.results.set(created.id, created);
    return created;
  }
  async findResultForPlayer(playerId: string, resultId: string): Promise<GameResult | null> {
    const result = this.results.get(resultId);
    return result?.playerId === playerId ? result : null;
  }
  async saveResult(result: GameResult): Promise<void> { this.results.set(result.id, result); }
  async listResultsForPlayer(playerId: string, limit: number, offset: number): Promise<GameResult[]> {
    return [...this.results.values()].filter((result) => result.playerId === playerId).slice(offset, offset + limit);
  }
}

function game(symbols: Symbol[]): { service: GameService; repository: InMemoryRepository } {
  const repository = new InMemoryRepository();
  return { service: new GameService(repository, new SequenceRandom(symbols), () => new Date('2026-01-01T00:00:00.000Z')), repository };
}

describe('GameService', () => {
  it('creates a player idempotently, charges a regular spin and exposes its prize as pending', async () => {
    const { service, repository } = game(['coin', 'coin', 'coin', 'trap']);
    const response = await service.regularSpin(PLAYER_ID);

    expect(response.player).toEqual({ publicId: PLAYER_ID, coinBalance: 99, personalRecord: 5 });
    expect(response.result).toMatchObject({ reels: ['coin', 'coin', 'coin', 'trap'], pendingPrize: 5, settledAt: null });
    await service.redeemPrize(PLAYER_ID, response.result.id);
    expect(repository.players).toHaveLength(1);
  });

  it('settles a pending prize before a requested new regular spin', async () => {
    const { service } = game(['clover', 'trap', 'trap', 'trap', 'trap', 'trap', 'trap', 'trap']);
    const first = await service.regularSpin(PLAYER_ID);
    const second = await service.regularSpin(PLAYER_ID, first.result.id);

    expect(second.player.coinBalance).toBe(107); // 100 - 1 + 9 - 1
    expect(first.result.settledAt).toBeNull();
  });

  it('charges and re-evaluates only the selected reel on a Bonus Spin', async () => {
    const { service } = game(['snake', 'trap', 'trap', 'trap', 'clover']);
    const first = await service.regularSpin(PLAYER_ID);
    const bonus = await service.bonusSpin(PLAYER_ID, first.result.id, 2);

    expect(bonus.player.coinBalance).toBe(98);
    expect(bonus.result).toMatchObject({ reels: ['snake', 'trap', 'clover', 'trap'], pendingPrize: 12, settledAt: null });
  });

  it('does not settle a prize twice', async () => {
    const { service } = game(['clover', 'trap', 'trap', 'trap']);
    const spin = await service.regularSpin(PLAYER_ID);
    await service.redeemPrize(PLAYER_ID, spin.result.id);
    await expect(service.redeemPrize(PLAYER_ID, spin.result.id)).rejects.toBeInstanceOf(PrizeAlreadySettledError);
  });

  it('rejects malformed identifiers and spins without enough coins', async () => {
    const { service, repository } = game(['trap', 'trap', 'trap', 'trap']);
    await expect(service.regularSpin('not-a-uuid')).rejects.toBeInstanceOf(InvalidPlayerIdentifierError);
    repository.players.set(PLAYER_ID, { id: 'player-1', publicId: PLAYER_ID, coinBalance: 0, personalRecord: 0 });
    await expect(service.regularSpin(PLAYER_ID)).rejects.toBeInstanceOf(InsufficientCoinsError);
  });
});
