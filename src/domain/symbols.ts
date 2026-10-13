export const REEL_COUNT = 4;

export const SYMBOLS = ['coin', 'clover', 'snake', 'trap', 'crown', 'coin-bag', 'multiplier-2x'] as const;

export type Symbol = (typeof SYMBOLS)[number];
export type Reels = readonly [Symbol, Symbol, Symbol, Symbol];

export interface RandomSource {
  nextSymbol(): Symbol;
}

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
