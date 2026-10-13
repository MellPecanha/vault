import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MikroORM } from '@mikro-orm/postgresql';
import { GameService, type GameRepository } from '../application/game';
import { GameController } from './game.controller';
import { CryptoRandomSource } from '../infrastructure/random/crypto-random.source';
import { GameResultEntity } from '../infrastructure/persistence/game-result.entity';
import { MikroGameRepository } from '../infrastructure/persistence/mikro-game.repository';
import { PlayerEntity } from '../infrastructure/persistence/player.entity';

@Module({
  imports: [MikroOrmModule.forFeature([PlayerEntity, GameResultEntity])],
  controllers: [GameController],
  providers: [
    {
      provide: MikroGameRepository,
      useFactory: (orm: MikroORM) => new MikroGameRepository(orm.em.fork()),
      inject: [MikroORM],
    },
    {
      provide: GameService,
      useFactory: (repository: GameRepository) => new GameService(repository, new CryptoRandomSource()),
      inject: [MikroGameRepository],
    },
  ],
})
export class GameModule {}
