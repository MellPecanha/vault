import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'players' })
@Unique({ properties: ['publicId'] })
export class PlayerEntity {
  @PrimaryKey({ type: 'string' })
  id: string = randomUUID();

  @Property({ type: 'string', fieldName: 'public_id', length: 36 })
  publicId!: string;

  @Property({ type: 'number', fieldName: 'coin_balance', default: 100 })
  coinBalance = 100;

  @Property({ type: 'number', fieldName: 'personal_record', default: 0 })
  personalRecord = 0;

  @Property({ type: 'datetime', fieldName: 'created_at', columnType: 'timestamptz' })
  createdAt = new Date();

  @Property({ type: 'datetime', fieldName: 'updated_at', columnType: 'timestamptz', onUpdate: () => new Date() })
  updatedAt = new Date();
}
