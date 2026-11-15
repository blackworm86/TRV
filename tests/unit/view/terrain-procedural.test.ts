import { describe, it, expect } from 'vitest';
import { proceduralTerrain, cellAt, H_MIN, H_MAX, TERRAIN_STYLE } from '../../../src/view/terrain/procedural';
import { GRID, spaceCenterPx, type TileData } from '../../../src/view/tile-grid';
import rules from '../../../data/trv/game_base.json';

const TILES = rules.tiles as unknown as TileData[];
const WIDTH = 400; // small maps keep the tests fast; the shape of the result does not depend on it

/** Height at a frame point (nearest pixel). */
function heightAt(m: ReturnType<typeof proceduralTerrain>, fx: number, fy: number): number {
  const i = Math.min(m.w - 1, Math.floor(fx / GRID.frameW * m.w));
  const j = Math.min(m.h - 1, Math.floor(fy / GRID.frameH * m.h));
  return m.height[j * m.w + i];
}

describe('cellAt', () => {
  it('finds every space at its own centre', () => {
    for (let r = 0; r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        const [x, y] = spaceCenterPx(r, c);
        const cell = cellAt(x, y)!;
        expect([cell.r, cell.c, cell.s]).toEqual([r, c, 0]);
      }
    }
  });

  it('is null in the banner strip and beyond the last column', () => {
    expect(cellAt(1000, 50)).toBeNull();
    const [x, y] = spaceCenterPx(0, GRID.cols);
    expect(cellAt(x, y)).toBeNull();
  });
});

describe('proceduralTerrain', () => {
  it('covers the frame and stays in the height range on every face', () => {
    for (const t of TILES) {
      const m = proceduralTerrain(t, { width: WIDTH });
      expect(m.w).toBe(WIDTH);
      expect(m.h).toBe(Math.round(WIDTH * GRID.frameH / GRID.frameW));
      expect(m.albedo.length).toBe(m.w * m.h * 4);
      let lo = Infinity, hi = -Infinity;
      for (const v of m.height) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      expect(lo).toBeGreaterThanOrEqual(H_MIN);
      expect(hi).toBeLessThanOrEqual(H_MAX);
    }
  });

  it('masks the spaces in and the banner out', () => {
    const m = proceduralTerrain(TILES[0], { width: WIDTH });
    for (let r = 0; r < GRID.rows; r++) {
      for (let c = 0; c < GRID.cols; c++) {
        const [x, y] = spaceCenterPx(r, c);
        expect(m.mask[Math.floor(y / GRID.frameH * m.h) * m.w + Math.floor(x / GRID.frameW * m.w)]).toBe(255);
      }
    }
    expect(m.mask[2 * m.w + Math.floor(m.w / 2)]).toBe(0);
  });

  it('puts rock above sand, sand above road and mud lowest, at space centres', () => {
    const all: Record<string, number[]> = { R: [], o: [], M: [], X: [] };
    for (const t of TILES) {
      const m = proceduralTerrain(t, { width: WIDTH });
      t.terrain.forEach((row, r) => [...row].forEach((k, c) => {
        const [x, y] = spaceCenterPx(r, c);
        all[k].push(heightAt(m, x, y));
      }));
    }
    const avg = (k: string): number => all[k].reduce((a, b) => a + b, 0) / all[k].length;
    expect(avg('X')).toBeGreaterThan(avg('o'));
    expect(avg('o')).toBeGreaterThan(avg('R'));
    expect(avg('R')).toBeGreaterThan(avg('M'));
    expect(avg('X')).toBeGreaterThan(TERRAIN_STYLE.height.X - 1);
  });

  it('is deterministic, and the seed changes the look', () => {
    const a = proceduralTerrain(TILES[3], { width: WIDTH });
    const b = proceduralTerrain(TILES[3], { width: WIDTH });
    const c = proceduralTerrain(TILES[3], { width: WIDTH, seed: 12345 });
    expect(b.albedo).toEqual(a.albedo);
    expect(b.height).toEqual(a.height);
    expect(c.albedo).not.toEqual(a.albedo);
  });

  it('prints unused hazard spaces faint at that player count', () => {
    const t = TILES[0]; // 1a: hazard [2, 4, [2]] is used only with 2 players
    const [x, y] = spaceCenterPx(2, 4);
    const redAt = (players: number): number => {
      const m = proceduralTerrain(t, { width: 1000, players });
      let best = 0; // reddest pixel along the triangle's base edge
      for (let dy = -40; dy <= 40; dy += 2) {
        const i = Math.floor((x - 44) / GRID.frameW * m.w), j = Math.floor((y + dy) / GRID.frameH * m.h);
        const q = (j * m.w + i) * 4;
        best = Math.max(best, m.albedo[q] - m.albedo[q + 1]);
      }
      return best;
    };
    expect(redAt(2)).toBeGreaterThan(redAt(4) + 40);
  });
});
