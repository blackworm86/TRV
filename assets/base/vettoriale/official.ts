// Faithful vector art of the official components, built from the traced scans (traced/*.json,
// made by tools/asset-pipeline/trace.py) and the fonts embedded in the rulebook (fonts/*.json,
// made by tools/asset-pipeline/pdf_fonts.py). LICENSED MATERIAL: this folder is not in git and
// never goes into a public repository. src/view/vector/art.ts loads this module when it exists and
// falls back to its own open drawings otherwise.

import type { DieFace, DashboardArt, CommandBoardArt, ArtDir } from '../../../src/view/vector/art';
import dice from './traced/dice.json';
import hazards from './traced/hazards.json';
import damage from './traced/damage.json';
import boards from './traced/boards.json';
import compacta from './fonts/CompactaBT-BoldItalic.json';
import gothic from './fonts/TradeGothicNextLTPro-Cn.json';

type Layer = [string, string, string];
interface Traced { box: number[]; bg: string; layers: Layer[]; outline?: string }
interface Font { upm: number; glyphs: Record<string, { d: string; w: number }> }

/** The open drawings of art.ts, used here for the parts the official art has no picture of. */
export interface BaseArt { dieSvg(f: DieFace, extra?: string): string }

const svg = (w: number, h: number, body: string, extra = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;
const inner = (s: string): string => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const paths = (layers: Layer[], recolor: Record<string, string> = {}): string =>
  layers.map(([name, color, d]) => d ? `<path fill="${recolor[name] ?? color}" fill-rule="evenodd" d="${d}"/>` : '').join('');

/** Mixes two #rrggbb colours (t = 0 gives a, 1 gives b). */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * Text set in one of the official fonts, as paths (so it renders the same in the page and in a
 * texture, where web fonts are not available). `unslant` straightens an italic cut (degrees).
 */
function text(font: Font, s: string, x: number, y: number, size: number, o: { anchor?: 'start' | 'middle' | 'end'; fill?: string; unslant?: number; track?: number } = {}): string {
  const k = size / font.upm, track = (o.track ?? 0) * size;
  const glyphs = [...s].map(ch => font.glyphs[ch] ?? (ch === ' ' ? { d: '', w: font.upm * 0.22 } : null)).filter((g): g is { d: string; w: number } => !!g);
  const width = glyphs.reduce((a, g) => a + g.w * k + track, -track);
  let cx = x - (o.anchor === 'middle' ? width / 2 : o.anchor === 'end' ? width : 0);
  let body = '';
  for (const g of glyphs) {
    if (g.d) body += `<path transform="translate(${cx.toFixed(2)} ${y}) scale(${k} ${-k})${o.unslant ? ` skewX(${-o.unslant})` : ''}" d="${g.d}"/>`;
    cx += g.w * k + track;
  }
  return `<g fill="${o.fill ?? '#000'}">${body}</g>`;
}

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

// ------------------------------------------------------------------------------- damage tokens

const DMG = damage as unknown as Record<string, Traced>;

/** Damage token at its traced size (about 525 x 480), torn bottom edge. */
function damageTokenSvg(type: string | null, faceUp: boolean, _dir?: ArtDir, extra = ''): string | null {
  const key = faceUp && type ? type : 'back';
  const t = DMG[key];
  if (!t) return null;
  const [W, H] = t.box;
  return svg(W, H, `<defs><clipPath id="trv-dm-${key}"><path d="${t.outline}"/></clipPath></defs>`
    + `<g clip-path="url(#trv-dm-${key})"><rect width="${W}" height="${H}" fill="${t.bg}"/>${paths(t.layers)}</g>`
    + `<path d="${t.outline}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2"/>`, extra);
}

// ------------------------------------------------------------------------------- boards

const BRD = boards as unknown as Record<string, Traced>;
const HOT = '#4cff7a';

/** Where the slots are on each dashboard, in board units (the board is 1000 wide). */
const DASH_ZONES: Record<string, { any: number[]; coast: number[]; pips: number[][] }> = {
  S: { any: [433, 154, 569, 290], coast: [804, 255, 90], pips: [[878, 305], [895, 288]] },
  M: { any: [436, 146, 561, 273], coast: [806, 236, 84], pips: [[868, 284], [892, 268]] },
  L: { any: [433, 154, 569, 290], coast: [846, 260, 88], pips: [[919, 305], [936, 287]] },
};

function placed(base: BaseArt, x: number, y: number, s: number, value: number, color: string): string {
  return `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none" data-die3d="movement|${value}|${color}">${inner(base.dieSvg({ kind: 'movement', value, color }))}</g>`;
}

/** The traced board: outline, crew-coloured layers, cut edge. In board units scaled by k. */
function board(t: Traced, id: string, k: number, recolor: Record<string, string>): string {
  return `<defs><clipPath id="${id}"><path d="${t.outline}"/></clipPath></defs><g transform="scale(${k})">`
    + `<path d="${t.outline}" fill="${t.bg}"/><g clip-path="url(#${id})">${paths(t.layers, recolor)}</g>`
    + `<path d="${t.outline}" fill="none" stroke="#1d1b20" stroke-width="3" stroke-linejoin="round"/></g>`;
}

/** A car dashboard: the official board (1000 wide) with its damage tokens hanging below. */
function dashboardSvg(base: BaseArt, d: DashboardArt, extra = ''): string | null {
  const t = BRD[`dash_${d.size}`];
  if (!t) return null;
  const [W, H] = t.box;
  const k = 1000 / W, bh = H * k, vh = Math.round(bh + 120);
  const dead = d.status !== 'ok';
  const crew = dead ? '#6d6b70' : d.color;
  const z = DASH_ZONES[d.size];
  let b = '';
  // Damage tokens first, so the board covers their top edge.
  const back = DMG.back;
  for (let i = 0; i < Math.min(2, d.damage); i++) {
    const s = 190 / back.box[0];
    b += `<g transform="translate(${300 + i * 210} ${bh - 70}) scale(${s})">${inner(damageTokenSvg(null, false)!)}</g>`;
  }
  b += board(t, `trv-dash-${d.size}`, k, { crew, brown: mix(crew, '#1c1416', 0.62) });
  if (d.pick) b += `<g transform="scale(${k})"><path d="${t.outline}" fill="none" stroke="${HOT}" stroke-width="10"/></g>`;
  if (!dead) {
    const [x0, y0, x1, y1] = z.any;
    const move = d.placed.find(p => !p.coast);
    const coast = d.placed.filter(p => p.coast);
    b += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="14" fill="#000" fill-opacity="${d.dropMove ? 0.25 : 0}" stroke="${d.dropMove ? HOT : 'none'}" stroke-width="7" data-drop="move:${d.carId}"/>`;
    if (move) b += placed(base, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) * 0.86, move.value, d.color);
    const [cx, cy, r] = z.coast;
    b += `<path d="M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy}Z" fill="#000" fill-opacity="${d.dropCoast ? 0.25 : 0}" stroke="${d.dropCoast ? HOT : 'none'}" stroke-width="7" stroke-linejoin="round" data-drop="coast:${d.carId}"/>`;
    if (coast.length) b += placed(base, cx, cy, r * 1.05, coast[coast.length - 1].value, d.color);
    z.pips.forEach(([px, py], i) => { if (i < coast.length) b += `<circle cx="${px}" cy="${py}" r="9" fill="#f4ead8" stroke="#1d1b20" stroke-width="2"/>`; });
  }
  if (d.status === 'inop') {
    b += `<g transform="scale(${k})"><path d="${t.outline}" fill="#000" opacity=".45"/></g>`;
    b += `<g transform="translate(500 ${bh / 2}) rotate(-8)"><rect x="-230" y="-48" width="460" height="96" rx="8" fill="#d42f30" stroke="#1d1b20" stroke-width="6"/>`
      + text(gothic as Font, 'FUORI USO', 0, 34, 96, { anchor: 'middle', fill: '#f4ead8', track: 0.04 }) + '</g>';
  }
  if (d.status === 'elim') b += `<path d="M120 60 L880 ${bh - 60} M880 60 L120 ${bh - 60}" stroke="#d42f30" stroke-width="22" stroke-linecap="round" opacity=".85"/>`;
  return svg(1000, vh, b, `data-car="${d.carId}" style="aspect-ratio:1000/${vh}" ${extra}`);
}

/** Command board slots and rule text, in board units (1000 x 874), measured on the scan. */
const CMD = {
  slots: { airstrike: [144, 126], nitro: [869, 125], drift: [148, 744], repair: [867, 745] } as Record<string, number[]>,
  quarter: { airstrike: [143, 113, 498, 418], nitro: [498, 113, 880, 418], drift: [143, 418, 498, 780], repair: [498, 418, 880, 780] } as Record<string, number[]>,
  text: {
    airstrike: { title: 'AIRSTRIKE', x: 462, y: 236, anchor: 'end', lines: ['Place your chopper', 'on an empty space', 'and shoot with it.'], y0: 292 },
    nitro: { title: 'NITRO', x: 529, y: 236, anchor: 'start', lines: ['This car gains moves', 'equal to the value of', 'this die.'], y0: 292 },
    drift: { title: 'DRIFT', x: 462, y: 487, anchor: 'end', lines: ['Ignore the first slam', 'your car would', 'have this turn.'], y0: 542 },
    repair: { title: 'REPAIR', x: 529, y: 487, anchor: 'start', lines: ['Remove one damage', 'token from one of', 'your cars.'], y0: 542 },
  } as Record<string, { title: string; x: number; y: number; anchor: 'start' | 'end'; lines: string[]; y0: number }>,
};

/** Command board (1000 x 874): the official board with the rule text set in its own fonts. */
function commandBoardSvg(base: BaseArt, c: CommandBoardArt, extra = ''): string | null {
  const t = BRD.command;
  if (!t) return null;
  const [W, H] = t.box;
  const k = 1000 / W, vh = Math.round(H * k);
  const ink = mix(c.color, '#1e1416', 0.68);
  let b = board(t, 'trv-cmd', k, { crew: c.color });
  for (const [cmd, tx] of Object.entries(CMD.text)) {
    const dim = !!c.used && c.used.cmd !== cmd;
    const [qx0, qy0, qx1, qy1] = CMD.quarter[cmd];
    const hot = c.drop?.includes(cmd);
    b += `<rect x="${qx0}" y="${qy0}" width="${qx1 - qx0}" height="${qy1 - qy0}" fill="${hot ? HOT : '#000'}" fill-opacity="${hot ? 0.16 : 0}" data-drop="cmd:${cmd}"/>`;
    b += `<g opacity="${dim ? 0.35 : 1}" pointer-events="none">`
      + text(compacta as Font, tx.title, tx.x, tx.y, 56, { anchor: tx.anchor, fill: ink })
      + tx.lines.map((l, i) => text(gothic as Font, l, tx.x, tx.y0 + i * 43, 41, { anchor: tx.anchor, fill: ink })).join('')
      + '</g>';
    const [sx, sy] = CMD.slots[cmd];
    const r = 92;
    b += `<path d="M${sx} ${sy - r} L${sx + r} ${sy} L${sx} ${sy + r} L${sx - r} ${sy}Z" fill="#000" fill-opacity="0" stroke="${hot ? HOT : 'none'}" stroke-width="8" stroke-linejoin="round" data-drop="cmd:${cmd}"/>`;
    if (c.used?.cmd === cmd) b += placed(base, sx, sy, 100, c.used.value, c.color);
  }
  return svg(1000, vh, b, extra);
}

/** The official art, bound to the open drawings it builds on. */
export function makeOfficial(base: BaseArt) {
  return {
    dieSvg,
    hazardTokenSvg,
    damageTokenSvg,
    dashboardSvg: (d: DashboardArt, extra = '') => dashboardSvg(base, d, extra),
    commandBoardSvg: (c: CommandBoardArt, extra = '') => commandBoardSvg(base, c, extra),
  };
}
