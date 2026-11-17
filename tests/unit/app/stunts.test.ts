// Which stunt a ramp jump makes (src/app/stunts.ts).
import { describe, expect, it } from 'vitest';
import { hash01, pickStunt, type JumpStunt } from '../../../src/app/stunts';

/** Odds for the checks, independent of the data file. */
const ODDS: Record<number, Partial<Record<JumpStunt, number>>> = {
  1: { flat: 0.8, oneWheel: 0.2 },
  4: { flat: 0.7, oneWheel: 0.2, barrel: 0.06, backflip: 0.04 },
};

describe('pickStunt', () => {
  it('picks along the odds in their order', () => {
    expect(pickStunt(4, 0, ODDS)).toBe('flat');
    expect(pickStunt(4, 0.69, ODDS)).toBe('flat');
    expect(pickStunt(4, 0.7, ODDS)).toBe('oneWheel');
    expect(pickStunt(4, 0.91, ODDS)).toBe('barrel');
    expect(pickStunt(4, 0.97, ODDS)).toBe('backflip');
  });

  it('falls back to the plain jump for a length with no odds', () => {
    expect(pickStunt(6, 0.5, ODDS)).toBe('flat');
  });

  it('makes the rare stunts rare over many jumps', () => {
    // Arrange: 20 000 jumps, each drawn from its own text as the game does.
    const count: Record<string, number> = {};
    // Act
    for (let i = 0; i < 20_000; i++) {
      const s = pickStunt(4, hash01(`car${i % 12}|${i}|${i % 7}`), ODDS);
      count[s] = (count[s] ?? 0) + 1;
    }
    // Assert: each share within a point of its odds.
    expect(Math.abs(count.flat / 20_000 - 0.7)).toBeLessThan(0.01);
    expect(Math.abs(count.backflip / 20_000 - 0.04)).toBeLessThan(0.01);
    expect(Math.abs(count.barrel / 20_000 - 0.06)).toBeLessThan(0.01);
  });
});

describe('hash01', () => {
  it('gives the same number for the same text, in [0, 1)', () => {
    const a = hash01('p0M|2,5|8|3');
    expect(hash01('p0M|2,5|8|3')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it('gives a different number for a different jump', () => {
    expect(hash01('p0M|2,5|8|3')).not.toBe(hash01('p0M|2,5|8|4'));
  });
});
