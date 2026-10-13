import { Entity, Index, JsonType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import type { Reels } from '../../domain/symbols';
import type { SpinEvaluation } from '../../domain/scoring';
import { PlayerEntity } from './player.entity';

@Entity({ tableName: 'game_results' })
@Index({ properties: ['player', 'createdAt'] })
export class GameResultEntity {
  @PrimaryKey()
  id: string = randomUUID();

  @ManyToOne(() => PlayerEntity, { deleteRule: 'cascade', fieldName: 'player_id' })
  player!: PlayerEntity;

  @Property({ type: JsonType, columnType: 'jsonb' })
  reels!: Reels;

  @Property({ type: JsonType, columnType: 'jsonb' })
  evaluation!: SpinEvaluation;

  @Property({ fieldName: 'pending_prize' })
  pendingPrize!: number;

  @Property({ fieldName: 'settled_at', nullable: true })
  settledAt: Date | null = null;

  @Property({ fieldName: 'created_at' })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();
}
