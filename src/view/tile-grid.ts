// Space grid of a road tile, measured on the tiles: where each chevron space lies in a 2000 x 1522
// frame (row 0 = the tile's left edge, column 0 = its rear edge), and the face data of
// data/trv/game_base.json. No three.js here, so the rules-side and the terrain generator share it.

/** Space grid measured on the tiles, in pixels of a 2000 x 1522 frame (row 0 = left edge). */
export const GRID = {
  frameW: 2000, frameH: 1522,
  /** Centre x of column 0 on even and odd rows, column pitch, row 0 centre y, row pitch. */
  x0Even: 130, x0Odd: 220, pitch: 233, y0: 330, rowPitch: 216,
  /** Depth of the chevron point. */
  tip: 34,
  rows: 6, cols: 8,
};

/** Distance between consecutive tiles, in frame pixels: 8 columns, so rows continue seamlessly. */
export const TILE_PITCH_PX = GRID.cols * GRID.pitch;

export interface TileData {
  /** Tile number and face ('a' / 'b'): they name the face's terrain maps, when present. */
  tile?: number;
  side?: string;
  name: string;
  terrain: string[];
  /** [row, col, player counts?] */
  hazards: unknown[][];
}

/** Centre of a space in frame pixels. Columns may run past 0..7 (neighbouring tiles). */
export function spaceCenterPx(r: number, c: number): [number, number] {
  const odd = Math.abs(r % 2) === 1;
  return [(odd ? GRID.x0Odd : GRID.x0Even) + GRID.pitch * c, GRID.y0 + GRID.rowPitch * r];
}

/** Chevron outline of one space (pointing forward, +x), in frame pixels, scaled about its centre. */
export function spaceOutlinePx(r: number, c: number, scale = 1): [number, number][] {
  const [cx, cy] = spaceCenterPx(r, c);
  const hw = GRID.pitch / 2, hh = GRID.rowPitch / 2, t = GRID.tip;
  const pts: [number, number][] = [[-hw, -hh], [hw, -hh], [hw + t, 0], [hw, hh], [-hw, hh], [-hw + t, 0]];
  return pts.map(([x, y]) => [cx + x * scale, cy + y * scale]);
}
