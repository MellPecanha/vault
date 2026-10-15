import { describe, expect, it } from 'vitest';
import {
  SYMBOL_WEIGHTS,
  TOTAL_SYMBOL_WEIGHT,
  bonusSpin,
  spinAll,
  type RandomSource,
  type Reels,
} from '../src/domain/symbols';
import { symbolForWeightTicket } from '../src/infrastructure/random/crypto-random.source';

class SequenceRandom implements RandomSource {
  private position = 0;

  constructor(private readonly sequence: RandomSource['nextSymbol'] extends () => infer T ? T[] : never) {}

  nextSymbol() {
    const symbol = this.sequence[this.position];
    this.position += 1;
    if (!symbol) throw new Error('Random sequence exhausted.');
    return symbol;
  }
}

describe('reel generation', () => {
  it('defines the datamined per-reel weights as a complete 100% table', () => {
    expect(SYMBOL_WEIGHTS).toEqual([
      ['coin', 30],
      ['blank', 27],
      ['coin-bag', 10],
      ['multiplier-2x', 10],
      ['snake', 10],
      ['crown', 8],
      ['trap', 4],
      ['clover', 1],
    ]);
    expect(TOTAL_SYMBOL_WEIGHT).toBe(100);
  });

  it('maps every weighted ticket to the intended symbol boundary', () => {
    expect(symbolForWeightTicket(0)).toBe('coin');
    expect(symbolForWeightTicket(29)).toBe('coin');
    expect(symbolForWeightTicket(30)).toBe('blank');
    expect(symbolForWeightTicket(56)).toBe('blank');
    expect(symbolForWeightTicket(57)).toBe('coin-bag');
    expect(symbolForWeightTicket(99)).toBe('clover');
    expect(() => symbolForWeightTicket(100)).toThrow('Weight ticket must be an integer between 0 and 99.');
  });

  it('generates exactly four symbols', () => {
    const random = new SequenceRandom(['coin', 'clover', 'snake', 'crown']);
    expect(spinAll(random)).toEqual(['coin', 'clover', 'snake', 'crown']);
  });

  it('changes only the selected reel during a Bonus Spin', () => {
    const reels: Reels = ['coin', 'clover', 'snake', 'crown'];
    expect(bonusSpin(reels, 2, new SequenceRandom(['coin-bag']))).toEqual(['coin', 'clover', 'coin-bag', 'crown']);
  });

  it('rejects an invalid reel index', () => {
    expect(() => bonusSpin(['coin', 'clover', 'snake', 'crown'], 4, new SequenceRandom(['coin']))).toThrow(
      'Reel index must be between 0 and 3.',
    );
  });

  it('rejects an invalid symbol from a random source at runtime', () => {
    const invalidRandom: RandomSource = { nextSymbol: () => 'invalid' as never };
    expect(() => spinAll(invalidRandom)).toThrow('Random source returned an invalid symbol.');
  });
});
