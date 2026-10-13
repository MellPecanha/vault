import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { GameModule } from './game/game.module';
import { GameResultEntity } from './infrastructure/persistence/game-result.entity';
import { PlayerEntity } from './infrastructure/persistence/player.entity';

@Module({
  imports: [
    MikroOrmModule.forRoot({
      driver: PostgreSqlDriver,
      clientUrl: process.env.DATABASE_URL ?? 'postgresql://vault:vault@localhost:5432/vault',
      entities: [PlayerEntity, GameResultEntity],
      extensions: [Migrator],
      migrations: { path: 'dist/src/infrastructure/persistence/migrations', pathTs: 'src/infrastructure/persistence/migrations' },
      allowGlobalContext: false,
    }),
    GameModule,
  ],
})
export class AppModule {}
