import { describe, it, expect } from 'vitest';
import { spaceOutlinePx, spaceCenterPx, TILE_PITCH_PX, GRID } from '../../../src/view/board3d';

describe('road tile geometry', () => {
  it('fits the last space of a row against the first space of the next tile', () => {
    for (let r = 0; r < GRID.rows; r++) {
      const last = spaceOutlinePx(r, GRID.cols - 1);
      const next = spaceOutlinePx(r, 0).map(([x, y]) => [x + TILE_PITCH_PX, y]);
      // The chevron point of the last space is the notch of the next one.
      expect(next[5][0]).toBeCloseTo(last[2][0]);
      expect(next[0][0]).toBeCloseTo(last[1][0]);
    }
  });
  it('offsets odd rows forward, so the tile edge zig-zags', () => {
    expect(spaceCenterPx(1, 0)[0] - spaceCenterPx(0, 0)[0]).toBe(GRID.x0Odd - GRID.x0Even);
  });
});
