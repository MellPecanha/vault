# The Vault Algorithm

Backend MVP for a four-reel slot machine. The API is the sole source of truth: it generates symbols, calculates prizes, controls the balance, and stores every anonymous player's history. There is no real money, authentication, or external wallet.

Built with NestJS, TypeScript, PostgreSQL, and MikroORM. The project demonstrates pure game rules, transactional balance updates, database migrations, and automated API tests.

## Run

Node 22+ and Docker are required for the full workflow. PostgreSQL exposes port `15432` on the host to avoid collisions with local installations; containers use the standard `5432` port.

```bash
npm ci
cp .env.example .env
docker compose up --build
```

With Docker, the API is available at `http://localhost:3002` and Swagger documentation at `http://localhost:3002/docs` (the default local/internal application port is `3000`). The compose setup is development-oriented: source code is mounted into the container, Nest watches `src`, and files in `public` are served directly from the mounted directory. Save a change and refresh the browser, without rebuilding the image. When creating a migration, restart the service with `docker compose up --build` so it runs at startup.

## Game client

With the application running, open `http://localhost:3002` to play in the browser. The client is static and has no additional dependencies: it creates a UUID with `crypto.randomUUID()`, stores it in `localStorage` under `vault-anonymous-player-id`, and sends it in the `x-anonymous-player-id` header for every action.

When the game opens, controls remain disabled until the server resolves the player and returns their persisted balance and record. Returning players therefore never see a temporary starting balance. The four reels display only the result returned by the server. If a prize is pending, select `Spin again` to settle it and start the next spin, `Claim prize` to settle it without a new spin, or select a reel and use `Bonus spin`. The history also belongs to the same anonymous player. To reset a local demo, delete that key from browser storage.

For local development, start only the database (`docker compose up postgres -d`), set `DATABASE_URL`, and run:

```bash
npm run migration:up
npm run start:dev
```

Migrations are explicit; the application never changes the schema automatically.

## Anonymous identity

The client must create a cryptographically secure UUID on the first visit, for example with `crypto.randomUUID()`, and store it in `localStorage` under `vault-anonymous-player-id`. Send it as `x-anonymous-player-id` in every request below.

```ts
const key = 'vault-anonymous-player-id';
let playerId = localStorage.getItem(key);
if (!playerId || !/^[0-9a-f-]{36}$/i.test(playerId)) {
  playerId = crypto.randomUUID();
  localStorage.setItem(key, playerId);
}
```

The server validates UUIDs, creates a player idempotently on first use, and never accepts client-supplied symbols, score, balance, or record. The identifier is pseudonymous only, not authentication: anyone who knows it can access the associated game data. Clearing browser storage loses the local association unless the identifier was saved elsewhere.

## API

Every endpoint requires `x-anonymous-player-id: <uuid>`.

| Operation    | Endpoint                                 | Body                                                                                                                          |
| ------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Regular spin | `POST /v1/spins`                         | Empty for the first spin; `{ "pendingResultId": "<uuid>" }` is required when a prize is pending, to settle it and spin again. |
| Bonus spin   | `POST /v1/results/:resultId/bonus-spins` | `{ "reelIndex": 0 }` (from 0 to 3)                                                                                            |
| Claim prize  | `POST /v1/results/:resultId/redeem`      | None                                                                                                                          |
| Own history  | `GET /v1/history?limit=20&offset=0`      | None                                                                                                                          |

Example spin:

```bash
curl -X POST http://localhost:3002/v1/spins \
  -H 'x-anonymous-player-id: 550e8400-e29b-41d4-a716-446655440000' \
  -H 'content-type: application/json' -d '{}'
```

A response includes the current balance, personal record, and result with `reels`, evaluation, `pendingPrize`, and `settledAt`. A prize stays pending until `redeem` or until it is passed to the next regular spin; the API rejects a spin that tries to bypass it. History returns `{ player, items, pagination }` with the current player state and `total`, `limit`, and `offset`. UUID and validation errors return 400; a missing result or one owned by another player returns 404; an unsettled or already-settled prize returns 409; and insufficient balance returns 422.

## Rules

Each regular and bonus spin costs 1 coin; a new player starts with 100. A bonus spin replaces exactly one reel on a pending result and may be repeated before settlement.

| Combination                          |       Prize |
| ------------------------------------ | ----------: |
| Exactly 3 coins                      |           3 |
| 4 coins                              |           5 |
| Each clover                          |          10 |
| 4 crowns                             |         100 |
| Exactly 3 coin-bag symbols           |           9 |
| 4 coin-bag symbols                   |          15 |
| Snake protected by at least one trap | 3 per snake |

A snake without a trap cancels every prize. Each `multiplier-2x` cumulatively doubles the subtotal after the other rules. Non-winning combinations return a zero prize.

### Per-reel probabilities

Results are generated exclusively on the server. Each of the four reels independently uses the table below; `blank` has no prize and `coin-bag` is the visual money-bag symbol.

| Symbol                          | Probability |
| ------------------------------- | ----------: |
| Coin (`coin`)                   |         30% |
| Blank (`blank`)                 |         27% |
| Coin bag (`coin-bag`)           |         10% |
| 2x multiplier (`multiplier-2x`) |         10% |
| Snake (`snake`)                 |         10% |
| Crown (`crown`)                 |          8% |
| Trap (`trap`)                   |          4% |
| Clover (`clover`)               |          1% |

Probabilities apply to each reel, not the final combination. The weight table lives in `src/domain/symbols.ts`; the cryptographic source maps a random ticket from 0 through 99 to a server-side symbol.

## Architecture

- `src/domain`: symbols, injectable randomness, and pure score calculation.
- `src/application`: balance, pending-prize, bonus, and persistence-contract orchestration.
- `src/infrastructure`: MikroORM/PostgreSQL adapters, cryptographic randomness, and HTTP.
- `src/game`: NestJS controllers and integration.

`players.public_id` is unique and `game_results` has an index by player and creation date. Results belong to the player resolved from the header; no parameter can read another player's history. Balance- and result-changing operations are transactional and use pessimistic locks to serialize concurrent actions for the same player or result.

The player lock ensures that simultaneous redemption requests cannot credit the same prize twice. The database transaction also rolls back the balance and result together if persistence fails. Game rules remain independent of HTTP and database entities, so deterministic tests can supply a known sequence of symbols.

## Verification

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Domain and use-case tests are deterministic and do not require PostgreSQL. For e2e tests, keep Docker PostgreSQL running and execute:

```bash
TEST_DATABASE_URL=postgresql://vault:vault@localhost:15432/vault_e2e npm run test:e2e
```

This command creates and removes only the `vault_e2e` database.

