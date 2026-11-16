import { describe, it, expect } from 'vitest';
import { proceduralTerrain } from '../../../src/view/terrain/procedural';
import { GRID, spaceCenterPx, type TileData } from '../../../src/view/tile-grid';
import { fireDieSvg, onFireTokenSvg, type FireFace } from '../../../src/view/vector/art';
import rules from '../../../data/trv/game_base.json';
import carnage from '../../../data/trv/carnage.json';

const WIDTH = 300; // small maps keep the test fast
const BASE = (rules.tiles as unknown as TileData[])[0];
/** The first tile with one row made of the expansion's terrain codes (G D P F S). */
const EXPANSION_ROW = 'GDPFSRRR';
const TILE: TileData = { ...BASE, name: 'Prova', terrain: [EXPANSION_ROW, ...BASE.terrain.slice(1)] };

function heightAt(m: ReturnType<typeof proceduralTerrain>, fx: number, fy: number): number {
  const i = Math.min(m.w - 1, Math.floor(fx / GRID.frameW * m.w));
  const j = Math.min(m.h - 1, Math.floor(fy / GRID.frameH * m.h));
  return m.height[j * m.w + i];
}

describe("Carnage at Devil's Run look", () => {
  it('draws every expansion terrain code of the data file as flat road ground', () => {
    expect(Object.keys(carnage.terrain).filter(k => !k.startsWith('_')).sort()).toEqual([...'DFGPS']);
    const m = proceduralTerrain(TILE, { width: WIDTH, seed: 1 });
    const road = proceduralTerrain({ ...TILE, terrain: ['RRRRRRRR', ...BASE.terrain.slice(1)] }, { width: WIDTH, seed: 1 });
    for (let c = 0; c < 5; c++) {
      const [x, y] = spaceCenterPx(0, c);
      expect(heightAt(m, x, y)).toBeCloseTo(heightAt(road, x, y), 5);
    }
  });
  it('has a fire die face for each kind of result in the rulebook', () => {
    expect(carnage.on_fire.face_kinds).toEqual(['+1', '+2', 'out', 'eliminated']);
    for (const f of carnage.on_fire.face_kinds as FireFace[]) expect(fireDieSvg(f)).toMatch(/^<svg [^>]*viewBox="0 0 100 100"/);
    expect(fireDieSvg('+2')).toContain('>+2<');
  });
  it('draws the ON FIRE token with its name', () => {
    expect(onFireTokenSvg()).toContain('ON FIRE!');
  });
});
