// Where a die can lie on the table without going through a piece (src/app/spots.ts).
import { describe, expect, it } from 'vitest';
import { clearOf, type Box, type Round } from '../../../src/app/spots';

const HALF = 0.15;
const CAR: Round = { x: 0, z: 0, r: 0.4 };
const TOKEN: Box = { x: 2, z: 0, hx: 0.7, hz: 0.6 };

describe('clearOf', () => {
  it('is clear with nothing on the table', () => {
    expect(clearOf(0, 0, HALF, [], [])).toBe(true);
  });

  it('is blocked by a car closer than its radius and the die', () => {
    expect(clearOf(0.5, 0, HALF, [CAR], [])).toBe(false);
  });

  it('is clear just past a car', () => {
    expect(clearOf(0.56, 0, HALF, [CAR], [])).toBe(true);
  });

  it('is blocked over a hazard token, and clear beside it', () => {
    expect(clearOf(2.5, 0.3, HALF, [], [TOKEN])).toBe(false);
    expect(clearOf(2, 0.8, HALF, [], [TOKEN])).toBe(true);
  });
});
