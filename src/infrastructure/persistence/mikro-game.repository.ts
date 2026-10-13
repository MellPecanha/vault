import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import type { GameRepository, GameResult, Player } from '../../application/game';
import { GameResultEntity } from './game-result.entity';
import { PlayerEntity } from './player.entity';

@Injectable()
export class MikroGameRepository implements GameRepository {
  constructor(private readonly em: EntityManager) {}

  async transactional<T>(work: (repository: GameRepository) => Promise<T>): Promise<T> {
    return this.em.transactional((transactionalEm) => work(new MikroGameRepository(transactionalEm)));
  }

  async findOrCreatePlayer(publicId: string): Promise<Player> {
    let entity = await this.em.findOne(PlayerEntity, { publicId });
    if (entity === null) {
      const timestamp = new Date();
      entity = this.em.create(PlayerEntity, {
        publicId,
        coinBalance: 100,
        personalRecord: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      try {
        await this.em.persistAndFlush(entity);
      } catch (error) {
        // A concurrent first request can win the unique public_id constraint.
        // Reloading makes creation idempotent while preserving unrelated errors.
        this.em.clear();
        entity = await this.em.findOne(PlayerEntity, { publicId });
        if (entity === null) throw error;
      }
    }
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
    const entity = await this.em.findOne(GameResultEntity, { id: resultId, player: { id: playerId } }, { populate: ['player'] });
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
    const entities = await this.em.find(GameResultEntity, { player: { id: playerId } }, { orderBy: { createdAt: 'desc' }, limit, offset });
    return entities.map((entity) => this.toResult(entity));
  }

  private toPlayer(entity: PlayerEntity): Player {
    return { id: entity.id, publicId: entity.publicId, coinBalance: entity.coinBalance, personalRecord: entity.personalRecord };
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
