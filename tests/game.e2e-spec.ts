import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const FIRST_PLAYER_ID = '550e8400-e29b-41d4-a716-446655440000';
const SECOND_PLAYER_ID = '5ba145c1-9341-4b6a-b32d-8327df1a3f6d';
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl === undefined) {
  throw new Error('TEST_DATABASE_URL is required to run e2e tests.');
}

const testDatabase = new URL(testDatabaseUrl);
const databaseName = decodeURIComponent(testDatabase.pathname.slice(1));
if (databaseName !== 'vault_e2e') {
  throw new Error('TEST_DATABASE_URL must target the isolated vault_e2e database.');
}

const adminDatabaseUrl = new URL(testDatabaseUrl);
adminDatabaseUrl.pathname = '/postgres';
let app: INestApplication;
let orm: MikroORM;

async function withAdminDatabase(action: (client: Client) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: adminDatabaseUrl.toString() });
  await client.connect();
  try {
    await action(client);
  } finally {
    await client.end();
  }
}

describe('Game API (e2e)', () => {
  beforeAll(async () => {
    await withAdminDatabase(async (client) => {
      await client.query(`drop database if exists ${databaseName}`);
      await client.query(`create database ${databaseName}`);
    });

    process.env.DATABASE_URL = testDatabaseUrl;
    const { createApp } = await import('../src/main');
    app = await createApp();
    orm = app.get(MikroORM);
    await orm.getMigrator().up();
    await app.init();
  });

  beforeEach(async () => {
    await orm.em.getConnection().execute('truncate table game_results, players cascade');
  });

  afterAll(async () => {
    await app?.close();
    await withAdminDatabase(async (client) => {
      await client.query(`drop database if exists ${databaseName}`);
    });
  });

  it('creates an anonymous player and exposes a server-generated pending result', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/spins')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .send({})
      .expect(201);

    expect(response.body.player).toMatchObject({ publicId: FIRST_PLAYER_ID, coinBalance: 99 });
    expect(response.body.result).toMatchObject({ pendingPrize: expect.any(Number), settledAt: null });
    expect(response.body.result.reels).toHaveLength(4);
    expect(response.body.result).not.toHaveProperty('playerId');
  });

  it('rejects missing identifiers and invalid Bonus Spin payloads', async () => {
    await request(app.getHttpServer()).post('/v1/spins').send({}).expect(400);

    const spin = await request(app.getHttpServer())
      .post('/v1/spins')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/results/${spin.body.result.id}/bonus-spins`)
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .send({ reelIndex: 4 })
      .expect(400);
  });

  it('prevents an unresolved prize from being bypassed by another spin', async () => {
    await request(app.getHttpServer())
      .post('/v1/spins')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/spins')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .send({})
      .expect(409);
  });

  it('serializes concurrent first spins for the same anonymous player', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/v1/spins').set('x-anonymous-player-id', FIRST_PLAYER_ID).send({}),
      request(app.getHttpServer()).post('/v1/spins').set('x-anonymous-player-id', FIRST_PLAYER_ID).send({}),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const history = await request(app.getHttpServer())
      .get('/v1/history')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .expect(200);
    expect(history.body).toMatchObject({ pagination: { total: 1 } });
  });

  it('scopes history and result mutations to the resolved player', async () => {
    const spin = await request(app.getHttpServer())
      .post('/v1/spins')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .get('/v1/history')
      .set('x-anonymous-player-id', SECOND_PLAYER_ID)
      .expect(200)
      .expect({ items: [], pagination: { total: 0, limit: 20, offset: 0 } });

    await request(app.getHttpServer())
      .post(`/v1/results/${spin.body.result.id}/redeem`)
      .set('x-anonymous-player-id', SECOND_PLAYER_ID)
      .expect(404);
  });

  it('validates history pagination and returns pagination metadata', async () => {
    const spin = await request(app.getHttpServer())
      .post('/v1/spins')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/results/${spin.body.result.id}/redeem`)
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .expect(200);

    const history = await request(app.getHttpServer())
      .get('/v1/history?limit=1&offset=0')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .expect(200);

    expect(history.body).toMatchObject({ pagination: { total: 1, limit: 1, offset: 0 } });
    expect(history.body.items).toHaveLength(1);

    await request(app.getHttpServer())
      .get('/v1/history?limit=51')
      .set('x-anonymous-player-id', FIRST_PLAYER_ID)
      .expect(400);
  });
});
