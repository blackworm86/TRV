import { describe, it, expect } from 'vitest';
import { depthAt, formationHeight, formationsOf, heightAt, type FormKnobs, type FormProfile } from '../../../src/view/terrain/formations';
import { buildObstacles, type ObstacleBlocker, type ObstacleKind } from '../../../src/view/terrain/obstacles';
import { cellAt } from '../../../src/view/terrain/procedural';
import { GRID, spaceCenterPx, type TileData } from '../../../src/view/tile-grid';
import rules from '../../../data/trv/game_base.json';
import look from '../../../data/trv/terrain_look.json';

const TILES = rules.tiles as unknown as TileData[];
const KNOBS: FormKnobs = { baseH: look.formation.base_h, grow: look.formation.grow, maxH: look.formation.max_h, inset: look.formation.inset };
const KINDS = look.kinds as Record<string, FormProfile>;
/** The kinds that are one solid body (ruins and barricades are walls and pieces on a low base). */
const SOLID = ['rocks', 'mesa', 'bunker'];
const face = (name: string): TileData => TILES.find(t => t.name === name)!;
/** A face made only of the given rows. */
const tileOf = (...terrain: string[]): TileData => ({ name: 'test', terrain, hazards: [] });
const SEED = 7;

describe('groups of impassable spaces', () => {
  it('makes one formation of the spaces that touch, and one of each space standing alone', () => {
    const f = formationsOf(face('Route Sixty Styx'), KNOBS);
    expect(f.map(x => x.cells.map(c => `${c.r},${c.c}`))).toEqual([['0,1'], ['1,3', '1,4'], ['4,3', '4,4']]);
    expect(f.map(x => x.shape)).toEqual(['single', 'pair', 'pair']);
  });
  it('joins spaces of neighbouring rows, which touch along half a side', () => {
    // Row 1 is shifted: its space 2 touches spaces 2 and 3 of row 0, not space 1.
    expect(formationsOf(tileOf('ooXooooo', 'ooXooooo'), KNOBS)).toHaveLength(1);
    expect(formationsOf(tileOf('oooXoooo', 'ooXooooo'), KNOBS)).toHaveLength(1);
    expect(formationsOf(tileOf('oXoooooo', 'ooXooooo'), KNOBS)).toHaveLength(2);
  });
  it('reads a row of spaces as a line along the road, a block as a mass, a bent chain as a corner', () => {
    const [line] = formationsOf(tileOf('oXXXXooo'), KNOBS);
    expect(line.shape).toBe('line');
    expect(Math.abs(Math.sin(line.axis))).toBeLessThan(0.05);
    expect(formationsOf(tileOf('oXXXoooo', 'oXXXoooo'), KNOBS)[0].shape).toBe('mass');
    expect(formationsOf(tileOf('XXXooooo', 'ooXooooo', 'oooXoooo'), KNOBS)[0].shape).toBe('corner');
  });
  it('covers every impassable space of every face exactly once', () => {
    for (const t of TILES) {
      const cells = formationsOf(t, KNOBS).flatMap(f => f.cells.map(c => `${c.r},${c.c}`));
      const wanted = t.terrain.flatMap((row, r) => [...row].flatMap((k, c) => (k === 'X' ? [`${r},${c}`] : [])));
      expect([...cells].sort()).toEqual([...wanted].sort());
    }
  });
});

describe('height of a formation', () => {
  it('grows with the spaces of the group, up to the cap', () => {
    expect(formationHeight(1, KNOBS)).toBeCloseTo(KNOBS.baseH);
    expect(formationHeight(3, KNOBS)).toBeCloseTo(KNOBS.baseH + 2 * KNOBS.grow);
    expect(formationHeight(40, KNOBS)).toBe(KNOBS.maxH);
  });
  it('gives every impassable space a body at least as high as one space alone, and none above the cap', () => {
    for (const t of TILES) for (const kind of SOLID) {
      const p = KINDS[kind];
      for (const f of formationsOf(t, KNOBS)) {
        for (const c of f.cells) expect(heightAt(f, c.x, c.y, KNOBS, p, SEED), `${t.name} ${kind} ${c.r},${c.c}`).toBeGreaterThanOrEqual(KNOBS.baseH * p.h - 1e-9);
        for (let y = 0; y < GRID.frameH; y += 37) for (let x = 0; x < GRID.frameW; x += 37) {
          expect(heightAt(f, x, y, KNOBS, p, SEED)).toBeLessThanOrEqual(KNOBS.maxH * p.h + 1e-9);
        }
      }
    }
  });
  it('is the same for the same seed', () => {
    // Small formations, well under the cap, so the lumps of the rock show in the heights.
    const forms = formationsOf(face('Route Sixty Styx'), KNOBS);
    const at = (seed: number): number[] => forms.flatMap(f => f.cells.map(c => heightAt(f, c.x + 30, c.y - 20, KNOBS, KINDS.rocks, seed)));
    expect(at(3)).toEqual(at(3));
    expect(at(3)).not.toEqual(at(4));
  });
});

describe('footprint of a formation', () => {
  it('never leaves the formation’s own spaces, on any face', () => {
    for (const t of TILES) for (const f of formationsOf(t, KNOBS)) {
      const own = new Set(f.cells.map(c => `${c.r},${c.c}`));
      for (let y = 0; y < GRID.frameH; y += 7) for (let x = 0; x < GRID.frameW; x += 7) {
        if (depthAt(f, x, y, KNOBS) <= 0) continue;
        const cell = cellAt(x, y);
        expect(cell && own.has(`${cell.r},${cell.c}`), `${t.name}: ${x},${y} is on ${cell?.r},${cell?.c}`).toBe(true);
      }
    }
  });
  it('holds the middle of each of its spaces and runs on across a shared side', () => {
    const [f] = formationsOf(tileOf('oXXooooo'), KNOBS);
    const [ax, ay] = spaceCenterPx(0, 1), [bx] = spaceCenterPx(0, 2);
    expect(depthAt(f, ax + GRID.tip / 2, ay, KNOBS)).toBeGreaterThan(60);
    expect(depthAt(f, (ax + bx) / 2 + GRID.tip / 2, ay, KNOBS)).toBeGreaterThan(40);
    expect(depthAt(f, ax - GRID.pitch, ay, KNOBS)).toBeLessThan(0);
  });
});

describe('obstacles built on the formations', () => {
  const SIZE = { width: 20, depth: 20 * GRID.frameH / GRID.frameW };
  const SPACE = GRID.pitch * SIZE.width / GRID.frameW;
  it('stands a body on every impassable space, whatever the kind, and tells the camera how much it hides', () => {
    for (const kind of ['rocks', 'mesa', 'bunker', 'ruin', 'barricade'] as ObstacleKind[]) {
      const t = face('Route Sixty Styx');
      const mesh = buildObstacles(t, kind, SIZE)!;
      const pos = mesh.geometry.getAttribute('position');
      let top = 0;
      for (let i = 0; i < pos.count; i++) {
        expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i)), kind).toBe(true);
        top = Math.max(top, pos.getY(i));
      }
      expect(top, kind).toBeGreaterThan(SPACE * 0.25);
      const blockers = mesh.userData.blockers as ObstacleBlocker[];
      expect(blockers, kind).toHaveLength(5);
      for (const b of blockers) expect(b.h, kind).toBeGreaterThan(SPACE * 0.25);
    }
  });
  it('builds nothing on a face with no impassable space', () => {
    expect(buildObstacles(face('The Parking Lot'), 'rocks', SIZE)).toBeNull();
  });
});
