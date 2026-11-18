// Faithful vector art of the official components, built from the traced scans (traced/*.json,
// made by tools/asset-pipeline/trace.py) and the fonts embedded in the rulebook (fonts/*.json,
// made by tools/asset-pipeline/pdf_fonts.py). LICENSED MATERIAL: this folder is not in git and
// never goes into a public repository. src/view/vector/art.ts loads this module when it exists and
// falls back to its own open drawings otherwise.

import type { DieFace } from '../../../src/view/vector/art';
import dice from './traced/dice.json';
import hazards from './traced/hazards.json';

type Layer = [string, string, string];
interface Traced { box: number[]; bg: string; layers: Layer[]; outline?: string }

/** The open drawings of art.ts, used here for the parts the official art has no picture of. */
export interface BaseArt { dieSvg(f: DieFace, extra?: string): string }

const svg = (w: number, h: number, body: string, extra = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;
const paths = (layers: Layer[], recolor: Record<string, string> = {}): string =>
  layers.map(([name, color, d]) => d ? `<path fill="${recolor[name] ?? color}" fill-rule="evenodd" d="${d}"/>` : '').join('');

// ------------------------------------------------------------------------------- dice

const DICE = dice as { bg: Record<string, string>; faces: Record<string, Layer[]> };

/** An official die face, 100 x 100, or null for the movement dice (plain pips, drawn by art.ts). */
function dieSvg(f: DieFace, extra = ''): string | null {
  const layers = DICE.faces[`${f.kind}|${f.value}`];
  if (!layers) return null;
  let body = paths(layers);
  // The pictures have forward up; on the board forward is to the right.
  if (f.kind === 'direction' && (f.forward ?? 'right') === 'right') body = `<g transform="rotate(90 50 50)">${body}</g>`;
  return svg(100, 100, `<defs><clipPath id="trv-die"><rect x="1" y="1" width="98" height="98" rx="11"/></clipPath></defs>`
    + `<rect x="1" y="1" width="98" height="98" rx="11" fill="${DICE.bg[f.kind]}"/><g clip-path="url(#trv-die)">${body}</g>`, extra);
}

// ------------------------------------------------------------------------------- hazard tokens

const HZ = hazards as unknown as Record<string, Traced>;
// The token covers its road space exactly (see art.ts): a chevron pointing right in 120 x 100.
const CHEVRON = 'M1.5 1.5 H104.7 L118.5 50 L104.7 98.5 H1.5 L15.3 50 Z';

/** Polyline for hand-drawn strokes, points in the traced grid of a token. */
const line = (pts: number[][]): string => 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L');

// Scan pixels -> traced grid for the hand-drawn parts (crop origin and step of each tracing).
const onOil = (pts: number[][]) => pts.map(([x, y]) => [x / 3, (y - 27) / 3]);
const onRoad = (pts: number[][]) => pts.map(([x, y]) => [(x - 3) / 3, (y - 36) / 3]);

/** Hand-drawn parts the tracing cannot separate from the print screen. */
function hazardExtra(type: string): string {
  if (type === 'oil') {
    // Airbrushed rainbow sheen, then the wet highlights along the edge (placed from the scan).
    const spots: [number, number, number, number, number, string][] = [
      [580, 290, 130, 90, -30, '#2c4a8e'], [480, 390, 100, 60, -40, '#1f7468'], [420, 480, 120, 60, -40, '#2f8a3c'],
      [350, 590, 90, 55, -35, '#9c9230'], [300, 690, 70, 45, -25, '#9a4426'], [600, 730, 110, 100, 0, '#3a2e72'],
    ];
    const sheen = spots.map(([x, y, rx, ry, r, c]) => {
      const [gx, gy] = [x / 3, (y - 27) / 3];
      return `<ellipse cx="${gx}" cy="${gy}" rx="${rx / 3}" ry="${ry / 3}" transform="rotate(${r} ${gx} ${gy})" fill="${c}"/>`;
    }).join('');
    const hi = [
      [[140, 235], [150, 280], [160, 330]], [[148, 420], [155, 500]],
      [[160, 570], [175, 650], [210, 730], [255, 790], [285, 805]], [[380, 785], [420, 800], [465, 790]],
      [[480, 772], [520, 778], [555, 792]], [[575, 860], [600, 900], [640, 925]],
    ].map(p => `<path d="${line(onOil(p))}"/>`).join('');
    return `<defs><filter id="trv-oil-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>`
      + `<clipPath id="trv-oil-clip"><path d="${HZ.oil.layers[0][2]}"/></clipPath></defs>`
      + `<g clip-path="url(#trv-oil-clip)"><g filter="url(#trv-oil-blur)" opacity=".7">${sheen}</g></g>`
      + `<g fill="none" stroke="#e6dab4" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">${hi}</g>`;
  }
  if (type === 'road') {
    const cracks = [
      [[415, 140], [430, 200], [470, 260], [500, 330], [520, 380], [560, 400]],
      [[500, 330], [470, 420], [430, 520], [420, 600], [380, 690], [300, 700], [230, 690]],
      [[440, 230], [380, 300], [330, 330]], [[560, 400], [640, 430], [700, 520], [760, 560]],
      [[100, 440], [130, 560], [210, 720], [260, 820], [380, 860], [470, 900]],
      [[620, 620], [700, 700], [740, 800]], [[560, 250], [620, 300]],
    ].map(p => `<path d="${line(onRoad(p))}"/>`).join('');
    return `<g fill="none" stroke="#4d4541" stroke-width="1.3" stroke-linejoin="round" opacity=".8">${cracks}</g>`;
  }
  return '';
}

/** Hazard token, 120 x 100: the traced art (drawn point up) turned to point right. */
function hazardTokenSvg(type: string | null, faceUp: boolean, extra = ''): string | null {
  const key = faceUp && type ? type : 'back';
  const t = HZ[key];
  if (!t) return null;
  const [W, H] = t.box;
  const layers = key === 'road' ? [] : t.layers;
  const art = `<rect width="${W}" height="${H}" fill="${t.bg}"/>${paths(layers)}${hazardExtra(key)}`;
  return svg(120, 100, `<defs><clipPath id="trv-hz"><path d="${CHEVRON}"/></clipPath></defs>`
    + `<g clip-path="url(#trv-hz)"><g transform="matrix(0 ${100 / W} ${-120 / H} 0 120 0)">${art}</g></g>`
    + `<path d="${CHEVRON}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/>`, extra);
}

/** The official art, bound to the open drawings it builds on. */
export function makeOfficial(_base: BaseArt) {
  return {
    dieSvg,
    hazardTokenSvg,
    // The damage tokens and the boards are the project owner's drawings now (src/view/vector/boards.ts,
    // art.ts printedDamage): their traced versions left the game on 2026-11-18, to lighten it.
    damageTokenSvg: (): string | null => null,
    dashboardSvg: (): string | null => null,
    commandBoardSvg: (): string | null => null,
  };
}
