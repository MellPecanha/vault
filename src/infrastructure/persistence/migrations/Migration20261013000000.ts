import { Migration } from '@mikro-orm/migrations';

export class Migration20261013000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "players" ("id" varchar(255) not null, "public_id" varchar(36) not null, "coin_balance" int not null default 100, "personal_record" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "players_pkey" primary key ("id"));',
    );
    this.addSql('alter table "players" add constraint "players_public_id_unique" unique ("public_id");');
    this.addSql(
      'create table "game_results" ("id" varchar(255) not null, "player_id" varchar(255) not null, "reels" jsonb not null, "evaluation" jsonb not null, "pending_prize" int not null, "settled_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "game_results_pkey" primary key ("id"));',
    );
    this.addSql(
      'alter table "game_results" add constraint "game_results_player_id_foreign" foreign key ("player_id") references "players" ("id") on update cascade on delete cascade;',
    );
    this.addSql(
      'create index "game_results_player_id_created_at_index" on "game_results" ("player_id", "created_at" desc);',
    );
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "game_results" cascade;');
    this.addSql('drop table if exists "players" cascade;');
  }
}
