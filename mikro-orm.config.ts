import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { GameResultEntity } from './src/infrastructure/persistence/game-result.entity';
import { PlayerEntity } from './src/infrastructure/persistence/player.entity';

export default defineConfig({
  clientUrl: process.env.DATABASE_URL ?? 'postgresql://vault:vault@localhost:5432/vault',
  entities: [PlayerEntity, GameResultEntity],
  extensions: [Migrator],
  migrations: { path: 'dist/src/infrastructure/persistence/migrations', pathTs: 'src/infrastructure/persistence/migrations' },
});
