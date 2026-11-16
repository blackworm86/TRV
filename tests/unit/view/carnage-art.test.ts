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
  it('gives every expansion terrain code of the data file a look of its own', () => {
    expect(Object.keys(carnage.terrain).filter(k => !k.startsWith('_')).sort()).toEqual([...'DFGPS']);
    const m = proceduralTerrain(TILE, { width: WIDTH, seed: 1 });
    const colour = (c: number): number[] => {
      const [x, y] = spaceCenterPx(0, c);
      const i = Math.floor(x / GRID.frameW * m.w), j = Math.floor(y / GRID.frameH * m.h), q = (j * m.w + i) * 4;
      return [m.albedo[q], m.albedo[q + 1], m.albedo[q + 2]];
    };
    const [goo, glass, , fire, salt, road] = [0, 1, 2, 3, 4, 5].map(colour);
    expect(goo[1]).toBeGreaterThan(goo[0]); // green
    expect(glass[2]).toBeGreaterThan(glass[0]); // blue
    expect(salt.every(v => v > 190)).toBe(true); // white crust
    expect(fire[0]).toBeGreaterThan(fire[2]); // scorched, ember-lit
    expect(road[0]).toBeLessThan(150); // still asphalt next to them
    const [gx, gy] = spaceCenterPx(0, 0), [rx, ry] = spaceCenterPx(0, 6);
    expect(heightAt(m, gx, gy)).toBeLessThan(heightAt(m, rx, ry)); // the goo lies in a pool
  });
  it('draws a revealed oil slick as a dark, glossy blot on the asphalt', () => {
    const tile: TileData = { ...BASE, name: 'Olio', terrain: ['OOOORRRR', ...BASE.terrain.slice(1)] };
    const m = proceduralTerrain(tile, { width: WIDTH, seed: 1 });
    const at = (c: number): number => {
      const [x, y] = spaceCenterPx(0, c);
      return Math.floor(y / GRID.frameH * m.h) * m.w + Math.floor(x / GRID.frameW * m.w);
    };
    const oil = at(1), road = at(5);
    const lum = (p: number): number => m.albedo[p * 4] + m.albedo[p * 4 + 1] + m.albedo[p * 4 + 2];
    expect(lum(oil)).toBeLessThan(lum(road) * 0.7);
    expect(m.rough[oil]).toBeLessThan(m.rough[road] * 0.5);
    expect(heightAt(m, ...spaceCenterPx(0, 1))).toBeCloseTo(heightAt(m, ...spaceCenterPx(0, 5)), 0); // flat like the road
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
