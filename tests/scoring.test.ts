import { describe, expect, it } from 'vitest';
import { evaluateSpin } from '../src/domain/scoring';
import type { Reels } from '../src/domain/symbols';

describe('evaluateSpin', () => {
  it('awards the minor coin prize for exactly three coins', () => {
    expect(evaluateSpin(['coin', 'coin', 'coin', 'trap'] as Reels).prize).toBe(3);
  });

  it('awards the main coin prize for four coins', () => {
    expect(evaluateSpin(['coin', 'coin', 'coin', 'coin'] as Reels).prize).toBe(5);
  });

  it('awards 9 for exactly three triple-coin symbols and 15 for four', () => {
    expect(evaluateSpin(['coin-bag', 'coin-bag', 'coin-bag', 'blank'] as Reels).prize).toBe(9);
    expect(evaluateSpin(['coin-bag', 'coin-bag', 'coin-bag', 'coin-bag'] as Reels).prize).toBe(15);
  });

  it('does not award a triple-coin prize for fewer than three symbols', () => {
    expect(evaluateSpin(['coin-bag', 'coin-bag', 'blank', 'blank'] as Reels).prize).toBe(0);
  });

  it('awards each clover independently', () => {
    expect(evaluateSpin(['clover', 'clover', 'clover', 'clover'] as Reels).prize).toBe(40);
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
    expect(evaluateSpin(['clover', 'blank', 'multiplier-2x', 'multiplier-2x'] as Reels).prize).toBe(40);
  });
});
