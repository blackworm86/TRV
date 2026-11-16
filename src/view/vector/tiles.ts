// Road tiles and maps as flat SVG, seen from above: every space is its chevron polygon from the
// measured grid (src/view/tile-grid.ts), filled with its terrain colour (rulebook p. 7), with the
// double yellow border of impassable spaces, the red hazard mark and a "riga,colonna" label. Made
// as an editable template: one layer (<g id>) per kind of mark, one id per space. No three.js here.

import { GRID, TILE_PITCH_PX, spaceCenterPx, spaceOutlinePx, type TileData } from '../tile-grid';
import { PALETTE, hazardSymbol } from './art';

/** Terrain letter (data/trv/game_base.json) to fill colour and Italian name. */
export const TERRAIN_STYLE: Record<string, { fill: string; name: string }> = {
  R: { fill: PALETTE.road, name: 'Strada' },
  o: { fill: PALETTE.offroad, name: 'Fuoristrada' },
  M: { fill: PALETTE.mud, name: 'Fango' },
  X: { fill: PALETTE.impassable, name: 'Invalicabile' },
  // Carnage at Devil's Run (data/trv/carnage.json).
  G: { fill: PALETTE.toxicGoo, name: 'Melma tossica' },
  D: { fill: PALETTE.desertGlass, name: 'Vetro del deserto' },
  P: { fill: PALETTE.ramp, name: 'Rampa' },
  F: { fill: PALETTE.fire, name: 'Fuoco' },
  S: { fill: PALETTE.saltFlats, name: 'Saline' },
};

/** Options of {@link tileSvg} and {@link mapSvg}. */
export interface TileSvgOptions {
  /** Write "riga,colonna" in every space (default true). */
  labels?: boolean;
}

const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pts = (p: [number, number][]): string => p.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join(' ');

/** The marks of one tile face, shifted `dx` frame pixels along the road, split by layer. */
function tileLayers(tile: TileData, dx: number, o: TileSvgOptions, prefix: string): { spaces: string; borders: string; hazards: string; labels: string } {
  const shift = (p: [number, number][]): [number, number][] => p.map(([x, y]) => [x + dx, y]);
  const hazardAt = new Set(tile.hazards.map(h => `${h[0]},${h[1]}`));
  let spaces = '', borders = '', hazards = '', labels = '';
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      const t = tile.terrain[r]?.[c] ?? 'R';
      const style = TERRAIN_STYLE[t] ?? { fill: '#888888', name: t };
      spaces += `<polygon id="${prefix}space-${r}-${c}" data-terrain="${esc(t)}" points="${pts(shift(spaceOutlinePx(r, c, 0.97)))}" fill="${style.fill}" stroke="#1d1712" stroke-width="4"/>`;
      if (t === 'X') {
        for (const k of [0.87, 0.76]) borders += `<polygon points="${pts(shift(spaceOutlinePx(r, c, k)))}" fill="none" stroke="${PALETTE.impassableBorder}" stroke-width="9"/>`;
      }
      const [cx, cy] = spaceCenterPx(r, c);
      if (hazardAt.has(`${r},${c}`)) hazards += hazardSymbol(cx + dx - 6, cy, 46, PALETTE.hazardRed);
      // A ramp: an arrow toward the lead tile, the way it is jumped (CDR p3).
      if (t === 'P') hazards += `<path d="M${cx + dx - 40} ${cy - 12} h44 v-16 l30 28 l-30 28 v-16 h-44z" fill="#f6c46a" stroke="${PALETTE.ink}" stroke-width="4"/>`;
      if (o.labels ?? true) {
        const ink = 'oGDPS'.includes(t) ? PALETTE.ink : PALETTE.cream; // dark text on the light grounds
        labels += `<text x="${cx + dx}" y="${cy + GRID.rowPitch * 0.36}" text-anchor="middle" font-size="30" fill="${ink}" opacity=".75" ${FONT}>${r},${c}</text>`;
      }
    }
  }
  return { spaces, borders, hazards, labels };
}

/** The tile's name and face ("1a · The Parking Lot") for its banner. */
export function tileTitle(tile: TileData): string {
  const id = tile.tile !== undefined ? `${tile.tile}${tile.side ?? ''} · ` : '';
  return `${id}${tile.name}`;
}

/** The banner strip above row 0 with the tile's name. */
function banner(tile: TileData, dx: number): string {
  const h = GRID.y0 - GRID.rowPitch / 2;
  return `<rect x="${dx + 40}" y="${h * 0.18}" width="${GRID.frameW * 0.6}" height="${h * 0.6}" rx="10" fill="#2a1c14"/>`
    + `<text x="${dx + 70}" y="${h * 0.66}" font-size="${h * 0.48}" fill="#f6c46a" ${FONT}>${esc(tileTitle(tile).toUpperCase())}</text>`;
}

/**
 * One road tile face, top-down, in the 2000 x 1522 frame of the measured grid.
 * Example: `download(tileSvg(RULES.tiles[0]), 'trv_tessere_1a.svg')`.
 */
export function tileSvg(tile: TileData, o: TileSvgOptions = {}): string {
  const L = tileLayers(tile, 0, o, '');
  const W = GRID.frameW + GRID.tip * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${GRID.frameH}" width="${W}" height="${GRID.frameH}" data-tile="${esc(`${tile.tile ?? ''}${tile.side ?? ''}`)}">`
    + `<rect id="cardboard" width="${W}" height="${GRID.frameH}" fill="#2b211a"/>`
    + `<g id="banner">${banner(tile, 0)}</g><g id="spaces">${L.spaces}</g><g id="impassable-borders">${L.borders}</g>`
    + `<g id="hazards">${L.hazards}</g><g id="labels">${L.labels}</g></svg>`;
}

/**
 * Several tile faces in a row along the road (rear tile first), interlocked as on the table:
 * each tile is shifted {@link TILE_PITCH_PX} from the previous one. Space ids are prefixed "t<i>-".
 */
export function mapSvg(tiles: TileData[], o: TileSvgOptions = {}): string {
  const W = GRID.frameW + GRID.tip * 2 + TILE_PITCH_PX * Math.max(0, tiles.length - 1);
  let spaces = '', borders = '', hazards = '', labels = '', banners = '';
  tiles.forEach((t, i) => {
    const L = tileLayers(t, i * TILE_PITCH_PX, o, `t${i}-`);
    spaces += `<g id="tile-${i}" data-tile="${esc(`${t.tile ?? ''}${t.side ?? ''}`)}">${L.spaces}</g>`;
    borders += L.borders; hazards += L.hazards; labels += L.labels; banners += banner(t, i * TILE_PITCH_PX);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${GRID.frameH}" width="${W}" height="${GRID.frameH}">`
    + `<rect id="cardboard" width="${W}" height="${GRID.frameH}" fill="#2b211a"/>`
    + `<g id="banners">${banners}</g><g id="spaces">${spaces}</g><g id="impassable-borders">${borders}</g>`
    + `<g id="hazards">${hazards}</g><g id="labels">${labels}</g></svg>`;
}
