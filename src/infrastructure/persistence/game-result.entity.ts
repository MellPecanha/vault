import { Entity, Index, JsonType, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import type { Reels } from '../../domain/symbols';
import type { SpinEvaluation } from '../../domain/scoring';
import { PlayerEntity } from './player.entity';

@Entity({ tableName: 'game_results' })
@Index({ properties: ['player', 'createdAt'] })
export class GameResultEntity {
  @PrimaryKey({ type: 'string' })
  id: string = randomUUID();

  @ManyToOne(() => PlayerEntity, { deleteRule: 'cascade', fieldName: 'player_id' })
  player!: PlayerEntity;

  @Property({ type: JsonType, columnType: 'jsonb' })
  reels!: Reels;

  @Property({ type: JsonType, columnType: 'jsonb' })
  evaluation!: SpinEvaluation;

  @Property({ type: 'number', fieldName: 'pending_prize' })
  pendingPrize!: number;

  @Property({ type: 'datetime', fieldName: 'settled_at', columnType: 'timestamptz', nullable: true })
  settledAt: Date | null = null;

  @Property({ type: 'datetime', fieldName: 'created_at', columnType: 'timestamptz' })
  createdAt = new Date();

  @Property({ type: 'datetime', fieldName: 'updated_at', columnType: 'timestamptz', onUpdate: () => new Date() })
  updatedAt = new Date();
}
