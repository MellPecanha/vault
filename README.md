# The Vault Algorithm

Backend MVP de uma máquina de quatro rolos. A API é a única fonte de verdade: ela gera símbolos, calcula o prêmio, controla o saldo e guarda o histórico de cada jogador anônimo. Não há dinheiro real, autenticação ou carteira externa.

## Executar

Requer Node 22+ e Docker para o fluxo completo. O PostgreSQL expõe a porta `15432` no host para evitar colisão com instalações locais; entre containers ele usa a porta padrão `5432`.

```bash
npm ci
cp .env.example .env
docker compose up --build
```

A API via Docker fica em `http://localhost:3002` e a documentação Swagger em `http://localhost:3002/docs` (a porta interna/local padrão da aplicação é `3000`).

Para desenvolvimento local, inicie somente o banco (`docker compose up postgres -d`), defina `DATABASE_URL` e execute:

```bash
npm run migration:up
npm run start:dev
```

As migrações são explícitas; a aplicação nunca altera o schema automaticamente.

## Identidade anônima

O cliente deve gerar um UUID criptograficamente seguro na primeira visita, por exemplo com `crypto.randomUUID()`, e guardá-lo em `localStorage` sob a chave `vault-anonymous-player-id`. Em todas as requisições abaixo, envie-o como `x-anonymous-player-id`.

```ts
const key = 'vault-anonymous-player-id';
let playerId = localStorage.getItem(key);
if (!playerId || !/^[0-9a-f-]{36}$/i.test(playerId)) {
  playerId = crypto.randomUUID();
  localStorage.setItem(key, playerId);
}
```

O servidor valida UUIDs, cria o jogador idempotentemente quando ele aparece pela primeira vez e não aceita do cliente símbolos, pontuação, saldo ou recorde. O identificador é apenas pseudônimo e não é autenticação.

## API

Todos os endpoints exigem `x-anonymous-player-id: <uuid>`.

| Operação | Endpoint | Corpo |
| --- | --- | --- |
| Giro regular | `POST /v1/spins` | Vazio no primeiro giro; `{ "pendingResultId": "<uuid>" }` é obrigatório quando há prêmio pendente para liquidá-lo e rolar novamente |
| Giro bônus | `POST /v1/results/:resultId/bonus-spins` | `{ "reelIndex": 0 }` (de 0 a 3) |
| Resgatar prêmio | `POST /v1/results/:resultId/redeem` | nenhum |
| Histórico próprio | `GET /v1/history?limit=20&offset=0` | nenhum |

Exemplo de giro:

```bash
curl -X POST http://localhost:3002/v1/spins \
  -H 'x-anonymous-player-id: 550e8400-e29b-41d4-a716-446655440000' \
  -H 'content-type: application/json' -d '{}'
```

Uma resposta inclui o saldo atual, recorde pessoal e o resultado com `reels`, avaliação, `pendingPrize` e `settledAt`. O prêmio fica pendente até `redeem` ou até ser informado no próximo giro regular; a API rejeita um novo giro que tente contornar esse prêmio. O histórico retorna `{ items, pagination }`, com `total`, `limit` e `offset`. Erros de UUID e validação retornam 400; resultado de outro jogador ou inexistente retorna 404; prêmio pendente não liquidado ou já liquidado retorna 409; e saldo insuficiente retorna 422.

## Regras

Cada giro regular e bônus custa 1 moeda; um novo jogador começa com 100. Giro bônus substitui exatamente um rolo de um resultado pendente e pode ser repetido antes da liquidação.

| Combinação | Prêmio |
| --- | ---: |
| Exatamente 3 moedas | 5 |
| 4 moedas | 15 |
| Cada trevo | 9 |
| 4 coroas | 100 |
| Cada saco de moedas | 20 |
| Cobra protegida por ao menos uma armadilha | 3 por cobra |

Uma cobra sem armadilha anula todos os ganhos. Cada `multiplier-2x` dobra cumulativamente o subtotal após as demais regras. Combinações não premiadas retornam prêmio zero.

## Arquitetura

- `src/domain`: símbolos, aleatoriedade injetável e cálculo puro de pontuação.
- `src/application`: orquestra saldo, prêmio pendente, bônus e contratos de persistência.
- `src/infrastructure`: adaptadores MikroORM/PostgreSQL, fonte criptográfica de aleatoriedade e HTTP.
- `src/game`: controladores e integração NestJS.

`players.public_id` é único e `game_results` tem índice por jogador e data de criação. Resultados pertencem ao jogador resolvido pelo header; não há parâmetro que permita consultar o histórico de terceiros. Operações que alteram saldo ou resultados são transacionais e usam locks pessimistas para serializar ações concorrentes do mesmo jogador ou resultado.

## Verificação

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Os testes de domínio e casos de uso são determinísticos e não exigem PostgreSQL. Para os testes e2e, mantenha o PostgreSQL Docker iniciado e execute:

```bash
TEST_DATABASE_URL=postgresql://vault:vault@localhost:15432/vault_e2e npm run test:e2e
```

Esse comando cria e remove exclusivamente o banco `vault_e2e`.
