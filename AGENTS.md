# The Vault Algorithm - Agent Guide

## Project Overview

The Vault Algorithm is a portfolio MVP that simulates a vintage slot machine. It is
intended to demonstrate skills relevant to a junior backend developer role,
with emphasis on API development, business logic, relational data modeling,
persistence, automated testing, and technical documentation.

The game has four reels, predefined symbols and combinations inspired by the
provided vintage slot-machine reference, and a score system.
Players do not need to register or log in. On the first visit, the browser
receives a unique anonymous player identifier that is reused on later visits
in that same browser. All outcomes, scores, records, and player history must
be generated, evaluated, and validated by the server.

## Primary Goals

- Build a functional REST API with NestJS and TypeScript.
- Keep game rules independent from the HTTP and persistence layers.
- Persist game results in PostgreSQL using MikroORM.
- Persist anonymous players, their personal records, and their game history.
- Implement deterministic, testable business rules.
- Write automated tests for game rules and API behavior.
- Provide a reproducible development environment with Docker.
- Document the API and the main architectural decisions.

## Scope and Constraints

- Backend-first development.
- The frontend is a secondary deliverable and must not compromise backend
  completion.
- This is not a real-money gambling product.
- No registration or login is required.
- Do not implement deposits, withdrawals, payments, or real-world cash
  redemption. The "Resgatar prêmio" action settles an in-game prize into the
  anonymous player's coin balance only.
- Avoid unnecessary microservices, queues, cloud infrastructure, or other
  operational complexity.
- A functional, tested MVP is more important than visual polish.

## Architecture Guidelines

Use a modular NestJS structure with clear boundaries:

- **Domain/application layer:** game rules, spin orchestration, score
  calculation, and use cases.
- **HTTP layer:** controllers, DTOs, validation, status codes, and API
  serialization.
- **Persistence layer:** MikroORM entities, repositories, migrations, and
  database configuration.
- **Infrastructure:** application bootstrap, environment configuration, and
  Docker integration.
- **Anonymous identity:** browser storage and request identity propagation,
  without coupling identity to network information.

Business rules must not depend on NestJS controllers, HTTP request objects, or
database entities. Prefer small services with explicit inputs and outputs.
Use dependency injection and repository abstractions where they improve
testability without adding unnecessary ceremony.

## Game Rules

- A spin produces exactly four reel symbols.
- The available symbols are `coin`, `clover`, `snake`, `trap`, `crown`,
  `coin-bag`, and `multiplier-2x`.
- Reel symbols and valid winning combinations must be predefined and explicit.
- The server is the source of truth for random outcomes, combination
  evaluation, and score calculation.
- Clients must not submit reel results, scores, or winning combinations.
- Keep the scoring table centralized and easy to extend.
- Scores are represented as coins. A completed result first exposes its
  calculated prize to the player as a pending prize before settlement.
- The player may choose either `Rolar novamente` or `Resgatar prêmio` to settle
  the pending prize into the player's coin balance. `Rolar novamente` then
  starts another regular spin, charging its one-coin cost; `Resgatar prêmio`
  settles the prize without starting another spin.
- There is no separate permanent money account: the pending prize belongs to
  the current result and is transferred to the player's in-game coin balance
  when either action is confirmed.
- Each regular spin costs one coin and requires the player to have at least
  one coin before the spin starts. The cost is debited before evaluating the
  result; valid winnings remain pending until the player confirms one of the
  settlement actions.
- Each Bonus Spin also costs one coin, can be used repeatedly for the same
  result, and lets the player choose exactly one of the four reels to
  re-spin while the other three symbols remain unchanged. Bonus Spins are
  applied before settling the pending prize, and the server validates the
  selected reel and performs the new spin.
- A new anonymous player starts with 100 coins.
- Coin combinations pay by exact count: three coins award a minor prize and
  four coins award the main coin prize.
- Each clover awards independently, regardless of the other symbols in the
  spin.
- Four crowns award the highest fixed prize.
- A snake normally cancels the spin's other winnings. When at least one trap
  appears together with snakes, the loss is prevented and the spin awards
  three coins per snake, regardless of the number of traps.
- Each `multiplier-2x` doubles the subtotal cumulatively after the other rules
  are evaluated, including the protected snake reward. For example, two snakes
  with a trap and one multiplier award 12 coins (`2 * 3 * 2`), while two
  multipliers apply a 4x multiplier.
- A coin bag awards an intermediate fixed prize and can be combined with other
  valid winnings.
- The initial scoring values are intentionally centralized and configurable:
  three coins = 5 coins, four coins = 15 coins, each clover = 10 coins,
  four crowns = 100 coins, and each coin bag = 20 coins. These values are
  balancing defaults, not client-controlled data.
- Define and document the behavior for non-winning combinations, winning
  combinations, invalid input, and failures.
- Use an injectable randomness boundary so business-rule tests can use
  deterministic sequences without relying on flaky randomness.

Unless the product requirements are changed explicitly, do not introduce
progressive jackpots, user wallets, betting, authentication, leaderboards, or
real-time features. Anonymous identification is not authentication: it only
associates a browser with its persisted game data.

## Anonymous Player Identity

The first game visit must generate a cryptographically strong, unique, opaque
player identifier in the browser, preferably with the platform's standard UUID
generation API. Store it in browser storage so a later visit in the same
browser can reuse it. Do not use the IP address, user-agent, browser
fingerprint, or other network/device characteristic as an identifier.

The client must send this identifier with player-scoped API requests using a
documented header or request mechanism. The server must:

- Validate the identifier format and reject malformed values.
- Create the player record idempotently when the identifier is first seen.
- Never accept player IDs, scores, reel results, records, or history as
  authoritative values from the client.
- Generate a new anonymous identity if the local browser identifier is absent
  or invalid, then continue using the new value.
- Avoid exposing sensitive information; the identifier is pseudonymous and
  must not be treated as an authentication credential.

Use a stable public identifier for API association and a separate database
primary key where appropriate. Enforce uniqueness at the database level and
handle concurrent first requests without creating duplicate players.

## API Expectations

Design a small REST API focused on the MVP. At minimum, provide an operation
that:

1. Resolves or creates the anonymous player from the browser identifier.
2. Starts a server-generated spin.
3. Evaluates the resulting combination.
4. Calculates and validates the score.
5. Persists the result for that player.
6. Updates the player's personal record when applicable.
7. Exposes the calculated pending prize before settlement.
8. Settles the pending prize when the player chooses `Rolar novamente` or
   `Resgatar prêmio`.
9. Returns the result, current record, coin balance, pending prize, and
   player-scoped metadata through a documented response DTO.

Provide a read-only player history endpoint if it is needed by the MVP. It
must scope results to the resolved anonymous player, use bounded pagination,
and never allow a caller to request another player's history by changing an
arbitrary ID. Validate request parameters with NestJS validation tools and
return consistent error responses. Do not expose persistence internals
directly from controllers.

Document endpoints, request and response schemas, status codes, and example
responses using OpenAPI/Swagger or the project’s established documentation
convention.

## Data Modeling and Persistence

Persist each anonymous player and completed spin with enough information to
retrieve and explain the result, such as:

### Player

- Internal database primary key.
- Unique opaque anonymous public identifier.
- Personal record/high score in coins.
- Creation and update timestamps.

### Game result

- The four generated symbols.
- The calculated score.
- The pending prize and its settlement status.
- The evaluated combination or outcome type.
- A relation to the player.
- Creation timestamp.

Use PostgreSQL through MikroORM. Prefer explicit migrations over implicit
schema changes. Add a uniqueness constraint for the anonymous public
identifier and an index supporting player history ordered by creation time.
Keep domain concepts separate from database concerns and avoid storing
redundant derived values unless they are useful for auditability and are kept
consistent by the application.

The coin balance, spin cost, score, and personal record must be calculated by
the backend. Treat any client-provided score, record, symbols, or outcome as
untrusted and ignore or reject it. A failed persistence operation must not be
reported as a successful spin.

Configuration must come from environment variables with safe development
defaults documented in the repository. Never commit credentials or secrets.

## Testing Requirements

Prioritize automated tests in this order:

1. Unit tests for symbol generation boundaries and game rules.
2. Unit tests for every scoring combination and non-winning outcomes.
3. Use-case tests proving that a spin is evaluated and persisted correctly.
4. Unit and integration tests proving anonymous player creation is idempotent,
   identifiers are unique, and concurrent first requests do not create
   duplicates.
5. API/e2e tests for successful spins, player-scoped history, malformed or
   missing identifiers, validation failures, and relevant persistence
   behavior.

Tests must be deterministic and should not depend on an external database
unless they are explicitly integration/e2e tests. Cover edge cases such as
repeated symbols, the lowest and highest valid scores, malformed requests, and
repository failures where practical. Verify that one anonymous player cannot
read or alter another player's record or history.

## Development Workflow

Before changing code:

1. Inspect the existing project structure, scripts, dependencies, and
   configuration.
2. Reuse established patterns and helpers.
3. Confirm that the proposed change supports the MVP and time constraints.

When implementing:

- Make small, focused changes.
- Keep TypeScript types explicit and avoid unsafe casts.
- Surface errors clearly; do not silently swallow failures.
- Keep HTTP concerns out of business-rule services.
- Update related tests and documentation with behavior changes.
- Do not add dependencies unless they are necessary and justified.

Before considering work complete, run the narrowest relevant formatter, linter,
type-check, and test commands. Then run the complete project validation when
the scope of the change warrants it.

## Documentation Requirements

Keep the README and API documentation aligned with the implementation. Explain:

- How to install and run the project.
- How to start PostgreSQL and the application with Docker.
- Required environment variables.
- Available API endpoints and example requests.
- The game rules and scoring table.
- The anonymous player identifier lifecycle, storage key/header convention,
  player-scoped endpoints, and data limitations.
- The main architectural decisions and trade-offs.
- How to run unit and e2e tests.

Documentation should favor reproducible commands and concrete examples over
generic descriptions.

## Delivery Priorities

When time is limited, implement in this order:

1. Core game rules and deterministic unit tests.
2. Anonymous player identity flow and player-scoped spin use case.
3. PostgreSQL/MikroORM persistence, relationships, constraints, and migrations.
4. API/e2e tests, history retrieval, and error handling.
5. Docker workflow and technical documentation.
6. Optional frontend polish.

If a feature threatens backend correctness, test coverage, or reproducibility, defer that feature rather than reducing the quality of the MVP.
