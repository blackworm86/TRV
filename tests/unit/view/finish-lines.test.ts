import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FINISH_CUT, FINISH_LINES, FINISH_TERRAIN, buildFinishFeature, finishGroundEnd, finishPx } from '../../../src/view/terrain/finish3d';
import { GRID, spaceCenterPx } from '../../../src/view/tile-grid';
import { newGame } from '../../../src/game/trv/engine';
import look from '../../../data/trv/finish_lines.json';

const line = (kind: string) => FINISH_LINES.find(l => l.kind === kind)!;
/** Frame y of the middle of each row, and of points between. */
const ACROSS = Array.from({ length: 60 }, (_, i) => GRID.y0 - GRID.rowPitch / 2 + (i + 0.5) / 60 * GRID.rows * GRID.rowPitch);
const SEED = 'a'.repeat(64);
const PLAYERS = [{ name: 'A', color: 'grey' }, { name: 'B', color: 'green' }];

describe('the finish lines', () => {
  it('are the four of the official sheet, each with a row of ground for every row of a tile', () => {
    expect(FINISH_LINES.map(l => l.kind).sort()).toEqual(['cliff', 'dome', 'grid', 'wall']);
    expect(FINISH_TERRAIN).toHaveLength(GRID.rows);
  });
  it('reach past the points of the rows they lock into, so every row has ground on the piece', () => {
    for (let r = 0; r < GRID.rows; r++) {
      const [cx] = spaceCenterPx(r, 0), tip = cx - GRID.pitch / 2 + GRID.tip;
      for (const l of FINISH_LINES) for (const y of ACROSS) expect(finishGroundEnd(l, y), `${l.id} row ${r}`).toBeGreaterThan(tip);
    }
  });
  it('are cut straight, all but the cliff, whose edge is broken and never passes the cut', () => {
    for (const kind of ['wall', 'grid', 'dome']) for (const y of ACROSS) expect(finishGroundEnd(line(kind), y)).toBe(FINISH_CUT);
    const edge = ACROSS.map(y => finishGroundEnd(line('cliff'), y));
    expect(Math.max(...edge)).toBeLessThan(FINISH_CUT);
    expect(Math.max(...edge) - Math.min(...edge)).toBeGreaterThan(GRID.pitch * look.cliff.jag * 0.5);
    expect(ACROSS.map(y => finishGroundEnd(line('cliff'), y))).toEqual(edge);
  });
  it('stand their structure past the last spaces: nothing of it over a tile', () => {
    for (const kind of ['wall', 'grid', 'dome'] as const) expect(finishPx(look[kind].at), kind).toBeGreaterThan(GRID.x0Odd - GRID.pitch / 2 + GRID.tip);
  });
  it('build the cliff as a canyon going down below the table, with nothing left unplaced', () => {
    const SIZE = { width: 20, depth: 20 * GRID.frameH / GRID.frameW, thickness: 0.1 };
    const g = buildFinishFeature(line('cliff'), { ...SIZE, ground: () => 0.02 });
    const box = new THREE.Box3().setFromObject(g);
    const space = GRID.pitch * SIZE.width / GRID.frameW;
    expect(box.min.y).toBeLessThan(-space * look.cliff.depth * 0.95);
    for (const v of [box.min, box.max]) expect(Number.isFinite(v.x + v.y + v.z)).toBe(true);
  });
});

describe('the finish line of a game', () => {
  it('comes from the seed, the same every time, and is one of those there are', () => {
    const of = (seed: string): number => newGame({ seed, players: PLAYERS, startSide: 'a' }).finishLine;
    expect(of(SEED)).toBe(of(SEED));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => of(SEED.slice(0, 62) + i.toString(16).padStart(2, '0'))));
    for (const i of seen) expect(i).toBeGreaterThanOrEqual(0), expect(i).toBeLessThan(FINISH_LINES.length);
    expect(seen.size).toBe(FINISH_LINES.length);
  });
});
