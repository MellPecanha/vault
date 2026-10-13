import { describe, expect, it } from 'vitest';
import { bonusSpin, spinAll, type RandomSource, type Reels } from '../src/domain/symbols';

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
