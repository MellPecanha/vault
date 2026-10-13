import type { Reels, Symbol } from './symbols';

export const SCORING = {
  threeCoins: 5,
  fourCoins: 15,
  clover: 9,
  fourCrowns: 100,
  coinBag: 20,
  snakeWithTrap: 3,
} as const;

export interface SpinEvaluation {
  basePrize: number;
  multiplier: number;
  prize: number;
  outcome: 'win' | 'loss' | 'snake-loss' | 'snake-protected';
  counts: Readonly<Partial<Record<Symbol, number>>>;
}

function countSymbols(reels: Reels): Partial<Record<Symbol, number>> {
  return reels.reduce<Partial<Record<Symbol, number>>>((counts, symbol) => {
    counts[symbol] = (counts[symbol] ?? 0) + 1;
    return counts;
  }, {});
}

export function evaluateSpin(reels: Reels): SpinEvaluation {
  const counts = countSymbols(reels);
  const snakes = counts.snake ?? 0;
  const hasTrap = (counts.trap ?? 0) > 0;
  const multipliers = counts['multiplier-2x'] ?? 0;

  if (snakes > 0 && !hasTrap) {
    return {
      basePrize: 0,
      multiplier: 2 ** multipliers,
      prize: 0,
      outcome: 'snake-loss',
      counts,
    };
  }

  let basePrize = 0;
  const coins = counts.coin ?? 0;

  if (coins === 3) basePrize += SCORING.threeCoins;
  if (coins === 4) basePrize += SCORING.fourCoins;
  basePrize += (counts.clover ?? 0) * SCORING.clover;
  basePrize += (counts['coin-bag'] ?? 0) * SCORING.coinBag;
  if ((counts.crown ?? 0) === 4) basePrize += SCORING.fourCrowns;
  if (snakes > 0) basePrize += snakes * SCORING.snakeWithTrap;

  const multiplier = 2 ** multipliers;
  const prize = basePrize * multiplier;

  return {
    basePrize,
    multiplier,
    prize,
    outcome: snakes > 0 ? 'snake-protected' : prize > 0 ? 'win' : 'loss',
    counts,
  };
}
