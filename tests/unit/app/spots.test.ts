// Where a die can lie on the table without going through a piece (src/app/spots.ts).
import { describe, expect, it } from 'vitest';
import { clearOf, hidesView, type Box, type Round } from '../../../src/app/spots';

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

describe('hidesView', () => {
  // A camera at the origin looking along +x at a car 1.5 ahead, half-width 0.8 per unit of depth.
  const DEPTH = 1.5, SPREAD = 0.8;

  it('hides a chopper standing between the camera and the car', () => {
    expect(hidesView(0, 0, DEPTH, SPREAD, { x: 0.8, z: 0.6, r: 0.5 })).toBe(true);
  });

  it('hides a chopper the camera stands inside', () => {
    expect(hidesView(0, 0, DEPTH, SPREAD, { x: -0.3, z: 0.2, r: 0.5 })).toBe(true);
  });

  it('leaves a chopper behind the camera, past the car or off to the side', () => {
    expect(hidesView(0, 0, DEPTH, SPREAD, { x: -1, z: 0, r: 0.5 })).toBe(false);
    expect(hidesView(0, 0, DEPTH, SPREAD, { x: 2.5, z: 0, r: 0.5 })).toBe(false);
    expect(hidesView(0, 0, DEPTH, SPREAD, { x: 0.5, z: 2, r: 0.5 })).toBe(false);
  });
});
