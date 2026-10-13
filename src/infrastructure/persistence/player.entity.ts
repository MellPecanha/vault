import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'players' })
@Unique({ properties: ['publicId'] })
export class PlayerEntity {
  @PrimaryKey()
  id: string = randomUUID();

  @Property({ fieldName: 'public_id', length: 36 })
  publicId!: string;

  @Property({ fieldName: 'coin_balance', default: 100 })
  coinBalance = 100;

  @Property({ fieldName: 'personal_record', default: 0 })
  personalRecord = 0;

  @Property({ fieldName: 'created_at' })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();
}
