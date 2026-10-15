export const REEL_COUNT = 4;

export const SYMBOLS = ['coin', 'blank', 'coin-bag', 'multiplier-2x', 'snake', 'crown', 'trap', 'clover'] as const;

export type Symbol = (typeof SYMBOLS)[number];
export type Reels = readonly [Symbol, Symbol, Symbol, Symbol];

export interface RandomSource {
  nextSymbol(): Symbol;
}

/**
 * Server-owned probability table. `coin-bag` is the game's existing name for
 * the triple-coin symbol. Weights are per reel and intentionally sum to 100
 * so the percentages are easy to audit.
 */
export const SYMBOL_WEIGHTS: ReadonlyArray<readonly [Symbol, number]> = [
  ['coin', 30],
  ['blank', 27],
  ['coin-bag', 10],
  ['multiplier-2x', 10],
  ['snake', 10],
  ['crown', 8],
  ['trap', 4],
  ['clover', 1],
];

export const TOTAL_SYMBOL_WEIGHT = SYMBOL_WEIGHTS.reduce((total, [, weight]) => total + weight, 0);

export function isSymbol(value: unknown): value is Symbol {
  return typeof value === 'string' && SYMBOLS.includes(value as Symbol);
}

function nextValidSymbol(random: RandomSource): Symbol {
  const symbol = random.nextSymbol();

  if (!isSymbol(symbol)) {
    throw new Error('Random source returned an invalid symbol.');
  }

  return symbol;
}

export function spinAll(random: RandomSource): Reels {
  return [nextValidSymbol(random), nextValidSymbol(random), nextValidSymbol(random), nextValidSymbol(random)];
}

export function bonusSpin(reels: Reels, reelIndex: number, random: RandomSource): Reels {
  if (!Number.isInteger(reelIndex) || reelIndex < 0 || reelIndex >= REEL_COUNT) {
    throw new RangeError(`Reel index must be between 0 and ${REEL_COUNT - 1}.`);
  }

  const nextReels = [...reels] as [Symbol, Symbol, Symbol, Symbol];
  nextReels[reelIndex] = nextValidSymbol(random);
  return nextReels;
}
