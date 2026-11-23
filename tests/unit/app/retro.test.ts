// The retro graphics styles' arithmetic (app/retroMath.ts; asked by the user, 2026-11-22).
import { describe, expect, it } from 'vitest';
import { renderRatio, snapGrid } from '../../../src/app/retroMath';
import { camelKeys } from '../../../src/app/presentation';
import raw from '../../../data/trv/presentation_base.json';

const RETRO = (camelKeys(raw) as { retro: Record<'console' | 'arcade', { pixel: number; levels: number; snapPx: number }> }).retro;

describe('retro styles', () => {
  it('draws each pixel the style’s CSS pixels wide, never finer than the screen', () => {
    expect(renderRatio(2, 1)).toBe(0.5);
    expect(renderRatio(2, 3)).toBe(0.5);
    expect(renderRatio(0.25, 1.5)).toBe(1.5);
    expect(renderRatio(0, 1.5)).toBe(1.5);
  });

  it('snaps the vertices every few drawn pixels, or not at all', () => {
    expect(snapGrid(320, 240, 2)).toEqual([80, 60]);
    expect(snapGrid(320, 240, 0)).toEqual([0, 0]);
  });

  it('gives both styles pixels of a readable size and a palette of at least two shades', () => {
    for (const k of ['console', 'arcade'] as const) {
      expect(RETRO[k].pixel).toBeGreaterThanOrEqual(1);
      expect(RETRO[k].pixel).toBeLessThanOrEqual(4);
      expect(RETRO[k].levels).toBeGreaterThanOrEqual(2);
    }
  });
});
