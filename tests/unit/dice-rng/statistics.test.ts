// GDD #2 — statistical acceptance criteria AC-06, AC-10, AC-13a (p = 1e-4, registered seeds).
// Each is a deterministic regression on a fixed seed, with a 10 s ceiling (performance guard).
import { describe, expect, it } from 'vitest';
import { createRng, roll, shuffle, type Result, type RngState } from '../../../src/core/rng/rng';
import { CHI2_CRITICAL_P1E4, SEED_AC06, SEED_AC10, SEED_AC13 } from './fixtures/seeds';

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function chiSquare(observed: readonly number[], expected: readonly number[]): number {
  return observed.reduce((sum, o, i) => sum + (o - expected[i]) ** 2 / expected[i], 0);
}

function rollFaces(seed: string, n: number, times: number): number[] {
  const counts = new Array<number>(n).fill(0);
  let s: RngState = must(createRng(seed));
  for (let i = 0; i < times; i++) {
    const r = must(roll(s, { kind: 'roll', dice: [{ dieId: 'd', n }], cause: 'stat' }));
    counts[r.content.results[0].face]++;
    s = r.state;
  }
  return counts;
}

function shuffleCounts(seed: string, m: number, times: number): Map<string, number> {
  const counts = new Map<string, number>();
  let s: RngState = must(createRng(seed));
  for (let i = 0; i < times; i++) {
    const r = must(shuffle(s, { kind: 'shuffle', pileId: 'p', size: m, cause: 'stat' }));
    const key = r.content.permutation.join('');
    counts.set(key, (counts.get(key) ?? 0) + 1);
    s = r.state;
  }
  return counts;
}

describe('statistics at p = 1e-4', () => {
  it('keeps the six faces of a d6 uniform over 600 000 rolls (AC-06)', () => {
    const counts = rollFaces(SEED_AC06, 6, 600_000);
    const x2 = chiSquare(counts, new Array(6).fill(100_000));
    console.info(`AC-06 chi-square = ${x2.toFixed(4)} (df 5)`);
    expect(x2).toBeLessThan(CHI2_CRITICAL_P1E4.df5);
  }, 10_000);

  it('gives a label printed on 2 of 6 faces a frequency of 1/3 over 600 000 rolls (AC-10)', () => {
    const labels = ['X', 'X', 'a', 'b', 'c', 'd'];
    const counts = rollFaces(SEED_AC10, 6, 600_000);
    const x = counts.reduce((sum, c, face) => sum + (labels[face] === 'X' ? c : 0), 0);
    const x2 = chiSquare([x, 600_000 - x], [200_000, 400_000]);
    console.info(`AC-10 chi-square = ${x2.toFixed(4)} (df 1)`);
    expect(x2).toBeLessThan(CHI2_CRITICAL_P1E4.df1);
  }, 10_000);

  it('makes every permutation of 3 and of 4 elements equally likely (AC-13a)', () => {
    const c3 = shuffleCounts(SEED_AC13, 3, 60_000);
    const c4 = shuffleCounts(SEED_AC13, 4, 240_000);
    expect(c3.size).toBe(6);
    expect(c4.size).toBe(24);
    const x3 = chiSquare([...c3.values()], new Array(6).fill(10_000));
    const x4 = chiSquare([...c4.values()], new Array(24).fill(10_000));
    console.info(`AC-13a chi-square = ${x3.toFixed(4)} (df 5), ${x4.toFixed(4)} (df 23)`);
    expect(x3).toBeLessThan(CHI2_CRITICAL_P1E4.df5);
    expect(x4).toBeLessThan(CHI2_CRITICAL_P1E4.df23);
  }, 10_000);
});
