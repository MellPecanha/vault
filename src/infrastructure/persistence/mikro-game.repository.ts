import { Injectable } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import type { GameRepository, GameResult, Player } from '../../application/game';
import { GameResultEntity } from './game-result.entity';
import { PlayerEntity } from './player.entity';

@Injectable()
export class MikroGameRepository implements GameRepository {
  constructor(private readonly em: EntityManager) {}

  async transactional<T>(work: (repository: GameRepository) => Promise<T>): Promise<T> {
    return this.em.transactional((transactionalEm) => work(new MikroGameRepository(transactionalEm)));
  }

  async findOrCreatePlayer(publicId: string, lockForUpdate = false): Promise<Player> {
    const timestamp = new Date();
    await this.em
      .getConnection()
      .execute(
        'insert into players (id, public_id, coin_balance, personal_record, created_at, updated_at) values (?, ?, ?, ?, ?, ?) on conflict (public_id) do nothing',
        [randomUUID(), publicId, 100, 0, timestamp, timestamp],
      );
    const entity = await this.em.findOneOrFail(
      PlayerEntity,
      { publicId },
      lockForUpdate ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {},
    );
    return this.toPlayer(entity);
  }

  async savePlayer(player: Player): Promise<void> {
    const entity = await this.em.findOneOrFail(PlayerEntity, { id: player.id });
    entity.coinBalance = player.coinBalance;
    entity.personalRecord = player.personalRecord;
    await this.em.flush();
  }

  async createResult(result: Omit<GameResult, 'id'>): Promise<GameResult> {
    const player = await this.em.findOneOrFail(PlayerEntity, { id: result.playerId });
    const entity = this.em.create(GameResultEntity, { ...result, player });
    await this.em.persistAndFlush(entity);
    return this.toResult(entity);
  }

  async findResultForPlayer(playerId: string, resultId: string): Promise<GameResult | null> {
    const entity = await this.em.findOne(
      GameResultEntity,
      { id: resultId, player: { id: playerId } },
      { populate: ['player'], lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    return entity === null ? null : this.toResult(entity);
  }

  async findPendingResultForPlayer(playerId: string): Promise<GameResult | null> {
    const entity = await this.em.findOne(
      GameResultEntity,
      { player: { id: playerId }, settledAt: null },
      { orderBy: { createdAt: 'desc' }, populate: ['player'], lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    return entity === null ? null : this.toResult(entity);
  }

  async saveResult(result: GameResult): Promise<void> {
    const entity = await this.em.findOneOrFail(GameResultEntity, { id: result.id });
    entity.reels = result.reels;
    entity.evaluation = result.evaluation;
    entity.pendingPrize = result.pendingPrize;
    entity.settledAt = result.settledAt;
    entity.updatedAt = result.updatedAt;
    await this.em.flush();
  }

  async listResultsForPlayer(playerId: string, limit: number, offset: number): Promise<GameResult[]> {
    const entities = await this.em.find(
      GameResultEntity,
      { player: { id: playerId } },
      { orderBy: { createdAt: 'desc' }, limit, offset },
    );
    return entities.map((entity) => this.toResult(entity));
  }

  async countResultsForPlayer(playerId: string): Promise<number> {
    return this.em.count(GameResultEntity, { player: { id: playerId } });
  }

  private toPlayer(entity: PlayerEntity): Player {
    return {
      id: entity.id,
      publicId: entity.publicId,
      coinBalance: entity.coinBalance,
      personalRecord: entity.personalRecord,
    };
  }

  private toResult(entity: GameResultEntity): GameResult {
    return {
      id: entity.id,
      playerId: entity.player.id,
      reels: entity.reels,
      evaluation: entity.evaluation,
      pendingPrize: entity.pendingPrize,
      settledAt: entity.settledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
