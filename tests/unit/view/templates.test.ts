import { describe, it, expect } from 'vitest';
import rules from '../../../data/trv/game_base.json';
import { tileSvg, mapSvg, tileTitle, TERRAIN_STYLE } from '../../../src/view/vector/tiles';
import { cardSvg, sheetSvg, standaloneSvg, svgSize, templateFileName, wrapText, slug } from '../../../src/view/vector/templates';
import { GRID, TILE_PITCH_PX, type TileData } from '../../../src/view/tile-grid';

const TILES = rules.tiles as unknown as (TileData & { tile: number; side: string })[];
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

describe('tile SVG template', () => {
  it('draws one polygon per space, coloured by its terrain', () => {
    for (const t of TILES) {
      const s = tileSvg(t);
      expect(count(s, /id="space-\d-\d"/g)).toBe(GRID.rows * GRID.cols);
      for (let r = 0; r < GRID.rows; r++) {
        for (let c = 0; c < GRID.cols; c++) {
          const terr = t.terrain[r][c];
          expect(s).toMatch(new RegExp(`id="space-${r}-${c}" data-terrain="${terr}" points="[^"]+" fill="${TERRAIN_STYLE[terr].fill}"`));
        }
      }
    }
  });
  it('marks every hazard space and labels the spaces "row,col"', () => {
    const t = TILES[0];
    const s = tileSvg(t);
    const hazards = s.slice(s.indexOf('<g id="hazards">'), s.indexOf('<g id="labels">'));
    expect(count(hazards, /<g fill="none"/g)).toBe(t.hazards.length);
    expect(s).toContain('>0,0</text>');
    expect(s).toContain(`>${GRID.rows - 1},${GRID.cols - 1}</text>`);
    expect(tileSvg(t, { labels: false })).not.toContain('>0,0</text>');
    expect(s).toContain(tileTitle(t).toUpperCase());
  });
  it('draws a double yellow border on every impassable space', () => {
    const t = TILES.find(x => x.terrain.join('').includes('X'))!;
    const n = t.terrain.join('').split('').filter(ch => ch === 'X').length;
    expect(count(tileSvg(t), /fill="none" stroke="#e9b83a"/g)).toBe(n * 2);
  });
  it('lines tiles up a tile pitch apart in a map', () => {
    const s = mapSvg(TILES.slice(0, 3));
    expect(count(s, /id="t\d-space-/g)).toBe(3 * GRID.rows * GRID.cols);
    expect(svgSize(s)![0]).toBe(GRID.frameW + GRID.tip * 2 + 2 * TILE_PITCH_PX);
  });
});

describe('template helpers', () => {
  it('names files trv_<category>_<id>.<ext>', () => {
    expect(templateFileName('potenziamenti', 'rail_gun', 'svg')).toBe('trv_potenziamenti_rail_gun.svg');
    expect(templateFileName('Modelli 3D', 'Car_Small', 'GLB')).toBe('trv_modelli-3d_car_small.glb');
    expect(templateFileName('tessere', '1a', 'svg')).toBe('trv_tessere_1a.svg');
    expect(slug('Città / Ms. Betty!')).toBe('citta-ms-betty');
  });
  it('wraps text at spaces without passing the limit', () => {
    const lines = wrapText('Spara fino a tre caselle dritto davanti a sé.', 12);
    expect(lines.join(' ')).toBe('Spara fino a tre caselle dritto davanti a sé.');
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
    expect(wrapText('', 10)).toEqual([]);
  });
  it('lays drawings out in a sheet, each nested at its cell', () => {
    const box = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="7"><rect width="100" height="100"/></svg>';
    const s = sheetSvg([{ svg: box, caption: 'A' }, { svg: box }, { svg: box }], { cols: 2, cell: 100, gap: 10 });
    expect(svgSize(s)).toEqual([10 + 2 * 110, 10 + 2 * (100 + 16 + 10)]);
    expect(s).toContain('<svg x="120" y="10" width="100" height="100" xmlns=');
    expect(s).not.toContain('width="7"');
    expect(s).toContain('<rect width="100" height="100"/>');
  });
  it('draws a card with name, number and text', () => {
    const s = cardSvg({ id: 'rail_gun', name: 'Rail Gun', text: 'Spara lontano & bene', n: 3, kicker: 'Potenziamento' });
    expect(svgSize(s)).toEqual([630, 880]);
    expect(s).toContain('RAIL GUN');
    expect(s).toContain('&amp; bene');
    expect(s).toContain('id="number"');
    expect(cardSvg({ name: 'X', text: '' })).not.toContain('id="number"');
  });
  it('makes an SVG string a standalone file', () => {
    const f = standaloneSvg('<svg viewBox="0 0 30 20"><image xlink:href="a.png"/></svg>');
    expect(f.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
    expect(f).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(f).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(f).toContain('width="30" height="20"');
    expect(standaloneSvg(f)).toBe(f);
  });
});
