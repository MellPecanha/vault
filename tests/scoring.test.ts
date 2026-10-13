import { describe, expect, it } from 'vitest';
import { evaluateSpin } from '../src/domain/scoring';
import type { Reels } from '../src/domain/symbols';

describe('evaluateSpin', () => {
  it('awards the minor coin prize for exactly three coins', () => {
    expect(evaluateSpin(['coin', 'coin', 'coin', 'trap'] as Reels).prize).toBe(5);
  });

  it('awards the main coin prize for four coins', () => {
    expect(evaluateSpin(['coin', 'coin', 'coin', 'coin'] as Reels).prize).toBe(15);
  });

  it('awards each clover independently', () => {
    expect(evaluateSpin(['clover', 'clover', 'clover', 'clover'] as Reels).prize).toBe(36);
  });

  it('awards the highest prize for four crowns', () => {
    expect(evaluateSpin(['crown', 'crown', 'crown', 'crown'] as Reels).prize).toBe(100);
  });

  it('cancels every prize when a snake has no trap', () => {
    expect(evaluateSpin(['snake', 'clover', 'coin-bag', 'multiplier-2x'] as Reels)).toMatchObject({
      prize: 0,
      outcome: 'snake-loss',
    });
  });

  it('protects the snake reward with a trap and applies multipliers', () => {
    expect(evaluateSpin(['snake', 'snake', 'trap', 'multiplier-2x'] as Reels)).toMatchObject({
      basePrize: 6,
      multiplier: 2,
      prize: 12,
      outcome: 'snake-protected',
    });
  });

  it('combines valid prizes and applies multipliers cumulatively', () => {
    expect(evaluateSpin(['clover', 'coin-bag', 'multiplier-2x', 'multiplier-2x'] as Reels).prize).toBe(116);
  });
});
