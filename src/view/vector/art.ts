// Vector art for the prototype: every component drawn as SVG from code, in the colours of the
// rulebook (pp. 3, 7, 10, 12). The same SVG string goes into the 2D interface (innerHTML) and,
// as a data URL, onto 3D pieces. These open drawings never copy the licensed artwork; the faithful
// official art, when present locally, takes their place (see "official art" below).

import { makeBoards, STRIP_BOX, STRIP_BOX_TALL, LEAD_PANEL_W, LEAD_NAME_H } from './boards';
import { ownerDieFaces, OWNER_DIE_ORDER } from './dice';
import { ownerDamage as cutOwnerDamage, FRONT_FIELD } from './damage';

/** Board-absolute direction names used by the rules (src/game/trv/engine.ts). */
export type ArtDir = 'F' | 'FL' | 'FR' | 'B' | 'BL' | 'BR';
export type ArtSize = 'S' | 'M' | 'L';

/** Rulebook colours (p. 3 parts list, p. 7 terrain legend). */
export const PALETTE = {
  road: '#7b7d80', offroad: '#f6c58a', mud: '#3d2a22', impassable: '#6b5236', impassableBorder: '#e9b83a',
  hazardRed: '#d42a2f', navy: '#1d2436', ink: '#141414', cream: '#f4ead8',
  dieRoad: '#55585b', dieStunt: '#b4d236', dieShooting: '#1f2a44', dieSlam: '#d8352b', dieDirection: '#6c4a9c',
  // Carnage at Devil's Run (CDR p2-3): the new terrains, the fire die and the ON FIRE! token.
  toxicGoo: '#7fd63a', desertGlass: '#a6dfe6', ramp: '#e8b46a', fire: '#ff6a1a', saltFlats: '#f3efe4',
  dieFire: '#f7c21b', fireRed: '#e8341c', fireOrange: '#ff8a1e',
} as const;

const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Wraps SVG content; `extra` adds attributes (class, data-*) to the root. */
function svg(w: number, h: number, body: string, extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;
}

/** The inner markup of an SVG string, to nest one drawing inside another. */
function inner(svgText: string): string {
  return svgText.replace(/^<svg[^>]*>|<\/svg>$/g, '');
}

/** SVG string as a data URL, for <img> or a three.js texture. */
export function dataUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

// ------------------------------------------------------------------------------- official art

/**
 * The faithful vector art of the official components, when its licensed files are present
 * (assets/licensed/vector/official.ts: derived from the publisher's artwork, never in git). Each
 * drawing below asks it first and falls back to its own open drawing, so the code runs without it.
 */
interface OfficialArt {
  dieSvg(f: DieFace, extra?: string): string | null;
  hazardTokenSvg(type: string | null, faceUp: boolean, extra?: string): string | null;
  damageTokenSvg(type: string | null, faceUp: boolean, dir?: ArtDir, extra?: string): string | null;
  dashboardSvg(d: DashboardArt, extra?: string): string | null;
  commandBoardSvg(c: CommandBoardArt, extra?: string): string | null;
}
type OfficialModule = { makeOfficial(base: { dieSvg(f: DieFace, extra?: string): string }): OfficialArt };
const officialModule = Object.values(import.meta.glob<OfficialModule>('/assets/licensed/vector/official.ts', { eager: true }))[0];
// `?art=open` in the page address shows the open drawings even when the official art is there.
const openOnly = typeof location !== 'undefined' && new URLSearchParams(location.search).get('art') === 'open';
/** True when the faithful official art is in use (licensed files present, not `?art=open`). */
export const OFFICIAL_ART = !!officialModule && !openOnly;
let official: OfficialArt | null | undefined;
/** The official art, made on first use (it builds on this module's own dice). */
function off(): OfficialArt | null {
  if (official === undefined) official = officialModule && !openOnly ? officialModule.makeOfficial({ dieSvg }) : null;
  return official;
}

// The project owner's own drawing of the command board and dashboards (one SVG, outlines only).
// When it is there, the boards are drawn from it (./boards.ts), also with `?art=open`: it is open material, in the repository.
const boardsRaw = Object.values(import.meta.glob<string>('/assets/ui/command_dashboard.svg', { eager: true, query: '?raw', import: 'default' }))[0];
// The owner's drawing of the crew leader command board (Choppe Shoppe), twice as tall.
const leaderBoardRaw = Object.values(import.meta.glob<string>('/assets/ui/command_dashboard_characters.svg', { eager: true, query: '?raw', import: 'default' }))[0];
// The owner's drawings of the dice (./dice.ts), one SVG per die. Like the boards, they win over
// both the open drawings below and the official art.
const ownerDiceRaw: Record<string, string | undefined> = {
  direction: Object.values(import.meta.glob<string>('/assets/ui/dice/direction.svg', { eager: true, query: '?raw', import: 'default' }))[0],
  slam: Object.values(import.meta.glob<string>('/assets/ui/dice/slam.svg', { eager: true, query: '?raw', import: 'default' }))[0],
};
const ownerDice = new Map<string, Map<string, string>>();
for (const [kind, raw] of Object.entries(ownerDiceRaw)) if (raw) ownerDice.set(kind, ownerDieFaces(raw, OWNER_DIE_ORDER[kind]));
// The owner's drawing of the damage token outline, front and back (./damage.ts): it wins too.
const damageRaw = Object.values(import.meta.glob<string>('/assets/ui/damage/template.svg', { eager: true, query: '?raw', import: 'default' }))[0];
const ownerDamage = damageRaw ? cutOwnerDamage(damageRaw) : null;
/** True when the boards come from the owner's drawing. */
export const USER_BOARDS = !!boardsRaw;
let userBoards: ReturnType<typeof makeBoards> | null | undefined;
function boards(): ReturnType<typeof makeBoards> | null {
  if (userBoards === undefined) {
    userBoards = USER_BOARDS ? makeBoards(boardsRaw, { dieSvg, damageTokenSvg: (t, up) => damageTokenSvg(t, up), onFireTokenSvg: () => onFireTokenSvg(), inkOn, font: FONT }, leaderBoardRaw) : null;
  }
  return userBoards;
}

/** Black or white ink, whichever reads on a background colour. */
export function inkOn(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
  return l > 0.55 ? PALETTE.ink : PALETTE.cream;
}

// ------------------------------------------------------------------------------- dice

/** One die face to draw. `kind` is the rules die id (movement, road, stunt, shooting, slam, direction). */
export interface DieFace {
  kind: string;
  /** Face value as the rules list it: 1-6, 'L', 'SM', 'top', 'F', ... */
  value: number | string;
  /** Movement dice: the crew colour. */
  color?: string;
  /** Direction die: where "forward" points on screen (the map runs left to right). */
  forward?: 'up' | 'right';
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

/** A die face, 100 x 100. */
export function dieSvg(f: DieFace, extra = ''): string {
  if (f.kind === 'fire') return fireDieSvg(f.value as FireFace, extra); // Carnage at Devil's Run
  const own = ownerDice.get(f.kind)?.get(String(f.value));
  if (own) {
    // The direction drawing has forward up; turn it when forward is to the right.
    const turn = f.kind === 'direction' && (f.forward ?? 'right') === 'right';
    return svg(100, 100, turn ? `<g transform="rotate(90 50 50)">${own}</g>` : own, extra);
  }
  const o = off()?.dieSvg(f, extra);
  if (o) return o;
  const bgOf: Record<string, string> = {
    road: PALETTE.dieRoad, stunt: PALETTE.dieStunt, shooting: PALETTE.dieShooting, slam: PALETTE.dieSlam, direction: PALETTE.dieDirection,
  };
  const bg = f.kind === 'movement' ? (f.color ?? '#e8742a') : (bgOf[f.kind] ?? '#888');
  let body = `<rect x="2" y="2" width="96" height="96" rx="16" fill="${bg}" stroke="rgba(0,0,0,.45)" stroke-width="3"/>`;
  const v = f.value;
  switch (f.kind) {
    case 'movement':
      for (const [x, y] of PIPS[Number(v)] ?? []) body += `<circle cx="${x}" cy="${y}" r="9" fill="${PALETTE.ink}"/>`;
      break;
    case 'road':
      body += `<text x="50" y="62" text-anchor="middle" font-size="56" fill="#f2c230" ${FONT}>${v}</text>`;
      body += [26, 44, 62].map(x => `<rect x="${x}" y="72" width="13" height="6" fill="#f2c230"/>`).join('');
      break;
    case 'stunt':
      body += `<text x="40" y="64" text-anchor="middle" font-size="58" font-style="italic" fill="${PALETTE.ink}" ${FONT}>${v}</text>`;
      for (let i = 0; i < 4; i++) {
        const h = 8 + i * 6;
        body += `<rect x="${54 + i * 10}" y="${88 - h}" width="7" height="${h}" fill="${i < Number(v) ? PALETTE.ink : 'rgba(0,0,0,.25)'}"/>`;
      }
      break;
    case 'shooting': {
      const label = v === 'SM' ? 'M-S' : String(v);
      const r = v === 'L' ? 24 : v === 'M' ? 18 : 15;
      body += `<g fill="none" stroke="${PALETTE.cream}" stroke-width="4"><circle cx="42" cy="42" r="${r}"/><circle cx="42" cy="42" r="${r * 0.45}"/>`
        + `<path d="M42 ${42 - r - 8}V${42 + r + 8}M${42 - r - 8} 42H${42 + r + 8}"/></g>`;
      if (v === 'SM') body += `<g fill="none" stroke="${PALETTE.cream}" stroke-width="3"><circle cx="76" cy="22" r="8"/><path d="M76 10V34M64 22H88"/></g>`;
      if (v === 'ANY') body += `<path d="M14 74 L80 10" stroke="${PALETTE.cream}" stroke-width="4"/>`;
      body += `<text x="${v === 'ANY' ? 50 : 76}" y="90" text-anchor="middle" font-size="26" fill="${PALETTE.cream}" ${FONT}>${label}</text>`;
      break;
    }
    case 'slam': {
      const top = v === 'top';
      const car = (y: number, solid: boolean): string =>
        `<g transform="translate(18 ${y})" fill="${solid ? PALETTE.ink : 'rgba(0,0,0,.28)'}"><path d="M2 18 L10 8 H40 L50 2 L62 10 V20 H2Z"/><circle cx="14" cy="22" r="7"/><circle cx="50" cy="22" r="7"/></g>`;
      body += car(12, top) + car(50, !top);
      body += `<rect x="12" y="${top ? 6 : 84}" width="76" height="6" fill="${PALETTE.ink}"/>`;
      break;
    }
    case 'direction': {
      // Neighbour offsets with forward up; rotated when forward is to the right.
      const off: Record<string, [number, number]> = { F: [0, -1], B: [0, 1], FL: [-0.87, -0.5], FR: [0.87, -0.5], BL: [-0.87, 0.5], BR: [0.87, 0.5] };
      const chev = (cx: number, cy: number, fill: string, stroke: string): string =>
        `<path d="M${cx - 11} ${cy + 10} V${cy - 4} L${cx} ${cy - 13} L${cx + 11} ${cy - 4} V${cy + 10} L${cx} ${cy + 2}Z" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>`;
      let g = '';
      for (const [dx, dy] of Object.values(off)) g += chev(50 + dx * 28, 50 + dy * 28, 'rgba(0,0,0,.22)', 'none');
      g += chev(50, 50, 'none', PALETTE.cream);
      const [dx, dy] = off[String(v)] ?? [0, -1];
      g += chev(50 + dx * 28, 50 + dy * 28, PALETTE.cream, 'none');
      body += (f.forward ?? 'right') === 'right' ? `<g transform="rotate(90 50 50)">${g}</g>` : g;
      break;
    }
    default:
      body += `<text x="50" y="62" text-anchor="middle" font-size="40" fill="#fff" ${FONT}>${esc(String(v))}</text>`;
  }
  return svg(100, 100, body, extra);
}

// ------------------------------------------------------------------------------- tokens

/** Chevron outline pointing right (forward), in a 120 x 100 box. */
// Hazard token outline: the same chevron as a road space (pitch 233 + point 34, row 216 px, see
// board3d GRID), in a 120 x 100 box, so a token covers its space exactly.
const CHEVRON = 'M1.5 1.5 H104.7 L118.5 50 L104.7 98.5 H1.5 L15.3 50 Z';

/** The red double triangle printed on hazard spaces and on the hazard token back. */
export function hazardSymbol(cx: number, cy: number, s: number, color: string): string {
  const tri = (k: number): string => `M${cx - s * k} ${cy - s * k * 1.1} L${cx + s * k * 1.2} ${cy} L${cx - s * k} ${cy + s * k * 1.1}Z`;
  return `<g fill="none" stroke="${color}" stroke-width="${s * 0.16}" stroke-linejoin="round"><path d="${tri(1)}"/><path d="${tri(0.55)}"/></g>`;
}

/** Hazard token, 120 x 100, chevron-shaped. `type` null or faceUp=false draws the back. */
export function hazardTokenSvg(type: string | null, faceUp: boolean, extra = ''): string {
  const o = off()?.hazardTokenSvg(type, faceUp, extra);
  if (o) return o;
  let fill: string = PALETTE.hazardRed, art = hazardSymbol(62, 50, 26, PALETTE.cream), label = '';
  if (faceUp && type) {
    switch (type) {
      case 'mud': fill = PALETTE.offroad; art = `<path d="M38 30 C52 14 84 22 86 42 C96 58 80 82 60 76 C40 86 26 66 34 52 C24 44 28 34 38 30Z" fill="${PALETTE.mud}"/>`; break;
      case 'road': fill = PALETTE.road; art = `<path d="M30 30 L52 44 L48 62 M70 22 L76 40 L96 46 M60 70 L80 80" stroke="rgba(0,0,0,.35)" stroke-width="3" fill="none"/>`; break;
      case 'oil': fill = PALETTE.road; art = `<defs><linearGradient id="oil" x1="0" x2="1"><stop offset="0" stop-color="#3cc"/><stop offset=".5" stop-color="#c3c"/><stop offset="1" stop-color="#cc3"/></linearGradient></defs>`
        + `<path d="M36 28 C56 18 90 30 84 50 C94 70 64 84 50 72 C30 80 26 60 38 50 C26 42 28 32 36 28Z" fill="#181818"/><path d="M44 40 C58 32 76 40 72 52 C76 64 58 70 50 62 C40 64 40 52 46 48Z" fill="url(#oil)" opacity=".85"/>`; break;
      case 'mine': fill = PALETTE.navy; art = `<path d="M30 62 L40 36 L48 52 L58 26 L64 50 L80 34 L76 62Z" fill="none" stroke="${PALETTE.hazardRed}" stroke-width="4" stroke-linejoin="round"/><path d="M28 66 H86" stroke="${PALETTE.hazardRed}" stroke-width="5"/>`; label = 'MINA'; break;
      // Carnage at Devil's Run (CDR p3): provisional drawings, not the official art.
      case 'desert_glass': fill = PALETTE.desertGlass; art = `<g fill="#e9fbff" stroke="#3a8a96" stroke-width="2"><path d="M34 60 L44 30 L52 58Z"/><path d="M52 64 L64 24 L74 62Z"/><path d="M72 62 L84 38 L90 64Z"/></g>`; break;
      case 'ramp': fill = PALETTE.road; art = `<path d="M30 64 L86 64 L86 40Z" fill="${PALETTE.ramp}" stroke="#3b2a12" stroke-width="3"/><path d="M42 58 H66 M58 50 L68 58 L58 66" stroke="#f7c21b" stroke-width="5" fill="none"/>`; break;
      case 'fire': fill = '#2a1a12'; art = `<path d="M60 22 C74 40 86 50 78 66 C74 76 46 78 42 66 C36 52 50 46 52 34 C58 44 62 40 60 22Z" fill="${PALETTE.fireOrange}"/><path d="M60 46 C68 56 70 64 64 70 C58 74 50 70 52 62 C54 56 58 54 60 46Z" fill="#ffd34a"/>`; break;
      case 'pit_trap': fill = PALETTE.offroad; art = `<ellipse cx="60" cy="52" rx="28" ry="18" fill="#1a120c"/><g stroke="#8a6a44" stroke-width="3"><path d="M40 46 L46 56 M56 40 L58 54 M70 42 L66 56 M80 48 L74 58"/></g>`; break;
      case 'quake': fill = PALETTE.navy; art = `<path d="M30 40 L46 52 L40 60 L58 66 L56 52 L72 58 L68 44 L88 50" fill="none" stroke="${PALETTE.hazardRed}" stroke-width="4" stroke-linejoin="round"/>`; label = 'TERREMOTO'; break;
      case 'sand_worm': fill = PALETTE.navy; art = `<path d="M30 66 C38 40 52 40 56 56 C60 70 74 70 78 50 C80 40 88 36 92 40" fill="none" stroke="${PALETTE.hazardRed}" stroke-width="7" stroke-linecap="round"/><circle cx="90" cy="38" r="5" fill="${PALETTE.hazardRed}"/>`; label = 'VERME'; break;
      case 'wreck': fill = PALETTE.navy; art = `<g fill="none" stroke="${PALETTE.hazardRed}" stroke-width="4" stroke-linejoin="round"><path d="M28 60 L36 44 H64 L72 34 H84 L88 46 V60 Z"/><circle cx="40" cy="62" r="7"/><circle cx="76" cy="62" r="7"/><path d="M50 44 L54 52 L48 56"/></g>`; label = 'RELITTO'; break;
    }
  }
  const text = label ? `<text x="60" y="90" text-anchor="middle" font-size="16" fill="${PALETTE.hazardRed}" ${FONT}>${label}</text>` : '';
  return svg(120, 100, `<defs><clipPath id="hz"><path d="${CHEVRON}"/></clipPath></defs><g clip-path="url(#hz)"><rect width="120" height="100" fill="${fill}"/>${art}${text}</g>`
    + `<path d="${CHEVRON}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="3"/>`, extra);
}

const DAMAGE_TITLE: Record<string, string> = { shrapnel: 'SCHEGGE', dazed: 'STORDITO', dent: 'AMMACCATURA', skid: 'SBANDATA', blastoff: 'DECOLLO', on_fire: 'IN FIAMME', ongoing_effect: 'EFFETTO' };

/** Damage token, 110 x 100, torn bottom edge. faceUp=false draws the back (brake warning). */
export function damageTokenSvg(type: string | null, faceUp: boolean, dir?: ArtDir, extra = ''): string {
  const own = ownerDamage;
  if (!own) {
    const o = off()?.damageTokenSvg(type, faceUp, dir, extra);
    if (o) return o;
  }
  const outline = 'M6 6 H104 V84 L92 76 L80 92 L66 80 L52 94 L38 80 L24 92 L14 80 L6 86 Z';
  if (!faceUp || !type) {
    if (own) return svg(110, 100, own.back, extra);
    return svg(110, 100, `<path d="${outline}" fill="#15171c" stroke="#000" stroke-width="2"/>`
      + `<g fill="none" stroke="${PALETTE.hazardRed}" stroke-width="5"><circle cx="55" cy="44" r="18"/><path d="M30 26 A30 30 0 0 0 30 62 M80 26 A30 30 0 0 1 80 62"/></g>`
      + `<path d="M55 33 V47" stroke="${PALETTE.hazardRed}" stroke-width="6"/><circle cx="55" cy="54" r="3.5" fill="${PALETTE.hazardRed}"/>`, extra);
  }
  const mini = (kind: string, x: number, val: number | string): string =>
    `<g transform="translate(${x} 44) scale(.26)">${inner(dieSvg({ kind, value: val, forward: 'right' }))}</g>`;
  let icon = '';
  switch (type) {
    case 'shrapnel': icon = mini('direction', 18, 'F') + `<path d="M50 57 H62 M57 52 L63 57 L57 62" stroke="${PALETTE.cream}" stroke-width="3" fill="none"/>`
      + `<g transform="translate(66 44) scale(.26)">${inner(damageTokenSvg(null, false))}</g>`; break;
    case 'dazed': icon = mini('stunt', 18, 4) + `<text x="56" y="66" text-anchor="middle" font-size="18" fill="${PALETTE.cream}" ${FONT}>×</text>` + mini('direction', 66, 'F'); break;
    case 'blastoff': icon = mini('direction', 18, 'F') + `<text x="56" y="66" text-anchor="middle" font-size="18" fill="${PALETTE.cream}" ${FONT}>+</text>` + mini('stunt', 66, 4); break;
    case 'on_fire': icon = `<path d="M55 42 C66 54 72 62 66 76 C62 86 46 86 42 76 C38 66 48 60 50 50 C54 58 56 54 55 42Z" fill="${PALETTE.fireOrange}"/>`; break;
    case 'ongoing_effect': icon = `<rect x="38" y="42" width="26" height="36" rx="3" fill="${PALETTE.cream}" transform="rotate(-10 51 60)"/><rect x="48" y="44" width="26" height="36" rx="3" fill="${PALETTE.cream}" stroke="#15171c" stroke-width="2"/><path d="M53 54 H69 M53 61 H69 M53 68 H64" stroke="#15171c" stroke-width="2.5"/>`; break;
    case 'dent': icon = `<path d="M55 41 L59 52 L71 47 L64 58 L76 63 L63 66 L67 79 L56 71 L46 80 L47 67 L34 64 L45 58 L38 47 L50 52Z" fill="none" stroke="${PALETTE.cream}" stroke-width="3" stroke-linejoin="round"/>`; break;
    case 'skid': {
      // Board directions with forward to the right: F east, FL north-east, FR south-east, ...
      const ang: Record<string, number> = { F: 0, FR: 60, BR: 120, B: 180, BL: 240, FL: 300 };
      icon = `<g transform="translate(55 60) rotate(${ang[dir ?? 'F'] ?? 0})"><path d="M-22 -9 H-4 L4 0 L-4 9 H-22 L-14 0Z" fill="none" stroke="${PALETTE.cream}" stroke-width="3"/><path d="M0 -9 H18 L26 0 L18 9 H0 L8 0Z" fill="${PALETTE.cream}"/></g>`;
      break;
    }
  }
  const title = `<text x="55" y="31" text-anchor="middle" font-size="20" fill="${PALETTE.cream}" ${FONT}>${DAMAGE_TITLE[type] ?? esc(type)}</text>`;
  if (own) {
    // The title band is joined to the top of the owner's red frame.
    const f = FRONT_FIELD;
    return svg(110, 100, own.front + `<rect x="${f.x}" y="${f.y - 0.5}" width="${f.right - f.x}" height="${36 - f.y + 0.5}" fill="${PALETTE.hazardRed}"/>` + title + icon, extra);
  }
  return svg(110, 100, `<path d="${outline}" fill="#15171c" stroke="${PALETTE.hazardRed}" stroke-width="6"/>`
    + `<rect x="10" y="12" width="90" height="24" fill="${PALETTE.hazardRed}" opacity=".9"/>`
    + `<text x="55" y="31" text-anchor="middle" font-size="20" fill="${PALETTE.cream}" ${FONT}>${DAMAGE_TITLE[type] ?? esc(type)}</text>${icon}`, extra);
}

// ------------------------------------------------------------------------------- boards

/** A die placed on a board, drawn inside a slot. */
function placedDie(x: number, y: number, s: number, value: number, color: string): string {
  return `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none" data-die3d="movement|${value}|${color}">${inner(dieSvg({ kind: 'movement', value, color }))}</g>`;
}

export interface DashboardArt {
  carId: string;
  size: ArtSize;
  color: string;
  status: 'ok' | 'inop' | 'elim';
  /** Dice on the dashboard this round: the move die, then coast dice. */
  placed: { value: number; coast: boolean }[];
  damage: number;
  /** Highlight the move or coast slot as a place to drop a die. */
  dropMove?: boolean;
  dropCoast?: boolean;
  /** Highlight the whole dashboard (choose this car, e.g. for repair). */
  pick?: boolean;
  label?: string;
  /** The car is burning (Carnage at Devil's Run): its ON FIRE! token lies over the move die slot. */
  onFire?: boolean;
  /** The car's upgrade card (Choppe Shoppe): drawn above the dashboard in the player's strip. */
  upgrade?: { name: string; text: string; /** URL of the official card art, when there is one (src/view/cards.ts). */ art?: string };
}

const SIZE_LABEL: Record<ArtSize, string> = { S: 'PICCOLA', M: 'MEDIA', L: 'GRANDE' };

/**
 * A car dashboard, 260 x 150: size, the move slot ("ANY"), the coast slot with its two pips,
 * and two damage slots below with face-down tokens hanging under them (rulebook p. 6).
 * Drop zones carry data-drop="move:<carId>" / "coast:<carId>"; the root carries data-car.
 */
/** Width over height of the player's strip (see playerStripSvg). */
export const STRIP_ASPECT = STRIP_BOX.w / STRIP_BOX.h;
/** Width over height of the player's strip with a crew leader (name plate above, room for the power tab on the left). */
export const STRIP_ASPECT_LEADER = (STRIP_BOX.w + LEAD_PANEL_W) / (STRIP_BOX.h + LEAD_NAME_H);
/** The share of that strip's height taken by the leader's name plate, above the boards. */
export const STRIP_LEADER_PLATE = LEAD_NAME_H / (STRIP_BOX.h + LEAD_NAME_H);
/** How many times taller the strip is with a crew leader board (1 without the leader drawing). */
export const STRIP_TALL = USER_BOARDS && leaderBoardRaw ? STRIP_BOX_TALL.h / STRIP_BOX.h : 1;
/**
 * The player's whole strip in one drawing: command board, the three dashboards against it as in
 * the rulebook, damage tokens under them. Null without the owner's drawing (assets/ui).
 * Example: `el.innerHTML = playerStripSvg(cmd, dashes) ?? ''`.
 */
export function playerStripSvg(c: CommandBoardArt, dashes: DashboardArt[], extra = ''): string | null {
  return boards()?.stripSvg(c, dashes, extra) ?? null;
}

/**
 * The upper part of a crew leader board alone: portrait, name, title and command tokens left.
 * Null without the owner's leader drawing or without `c.leader`.
 * Example: `el.innerHTML = leaderHeadSvg({ color, leader }) ?? ''`.
 */
export function leaderHeadSvg(c: CommandBoardArt, extra = ''): string | null {
  return boards()?.leaderHeadSvg(c, extra) ?? null;
}
/** Where the dashboards start in the strip, as a fraction of its width (to line things up with them). */
export const STRIP_DASH_START = 268 / STRIP_BOX.w;

export function dashboardSvg(d: DashboardArt, extra = ''): string {
  const u = boards()?.dashboardSvg(d, extra);
  if (u) return u;
  const o = off()?.dashboardSvg(d, extra);
  if (o) return o;
  const dead = d.status !== 'ok';
  const band = dead ? '#4a4a4a' : d.color;
  const ink = inkOn(band);
  let b = `<path d="M14 10 H246 L256 24 V92 L246 104 H14 L4 92 V24Z" fill="${dead ? '#2a2a2a' : '#1b1f27'}" stroke="${d.pick ? '#4cff7a' : 'rgba(0,0,0,.6)'}" stroke-width="${d.pick ? 6 : 3}"/>`;
  b += `<path d="M14 10 H246 L256 24 V52 H4 V24Z" fill="${band}"/>`;
  b += `<text x="16" y="44" font-size="26" fill="${ink}" ${FONT}>${SIZE_LABEL[d.size]}</text>`;
  if (d.label) b += `<text x="200" y="44" text-anchor="end" font-size="16" fill="${ink}" ${FONT}>${esc(d.label)}</text>`;
  const rings = d.size === 'L' ? 3 : d.size === 'M' ? 2 : 1;
  for (let i = 0; i < rings; i++) b += `<circle cx="226" cy="78" r="${5 + i * 6}" fill="none" stroke="${dead ? '#777' : d.color}" stroke-width="3"/>`;
  if (d.status === 'inop') {
    b += `<g transform="translate(130 76)" fill="${PALETTE.hazardRed}"><path d="M-24 -10 H10 L18 -16 H28 V16 H18 L10 10 H-24Z"/><path d="M-4 -14 L-10 2 H0 L-6 16" stroke="#2a2a2a" stroke-width="3" fill="none"/></g>`;
    b += `<text x="130" y="44" text-anchor="middle" font-size="16" fill="#ddd" ${FONT}>FUORI USO</text>`;
  }
  const moveDie = d.placed.find(p => !p.coast);
  const coastDice = d.placed.filter(p => p.coast);
  if (!dead) {
    b += `<path d="M84 100 A46 46 0 1 1 176 100" fill="none" stroke="#e8e0cf" stroke-width="5" stroke-dasharray="3 6"/>`;
    b += `<rect x="108" y="54" width="44" height="44" rx="6" fill="#11141a" stroke="${d.dropMove ? '#4cff7a' : '#e8e0cf'}" stroke-width="${d.dropMove ? 5 : 2}" stroke-dasharray="${moveDie ? '0' : '5 4'}" data-drop="move:${d.carId}"/>`;
    if (moveDie) b += placedDie(130, 76, 38, moveDie.value, d.color);
    else b += `<text x="130" y="82" text-anchor="middle" font-size="15" fill="#e8e0cf" ${FONT} pointer-events="none">ANY</text>`;
    b += `<path d="M58 56 L80 78 L58 100 L36 78Z" fill="#11141a" stroke="${d.dropCoast ? '#4cff7a' : '#e8e0cf'}" stroke-width="${d.dropCoast ? 5 : 2}" data-drop="coast:${d.carId}"/>`;
    if (coastDice.length) b += placedDie(58, 78, 26, coastDice[coastDice.length - 1].value, d.color);
    else b += `<text x="58" y="83" text-anchor="middle" font-size="12" fill="#e8e0cf" ${FONT} pointer-events="none">+1</text>`;
    for (let i = 0; i < 2; i++) b += `<circle cx="${50 + i * 16}" cy="112" r="4" fill="${i < coastDice.length ? d.color : '#555'}"/>`;
  }
  for (let i = 0; i < 2; i++) {
    const x = 100 + i * 70;
    b += `<path d="M${x} 104 h44 l-6 8 h-32z" fill="#0d0f13"/>`;
    if (i < d.damage) b += `<g transform="translate(${x} 106) scale(.4)">${inner(damageTokenSvg(null, false))}</g>`;
  }
  if (d.status === 'elim') b += `<path d="M20 20 L240 96 M240 20 L20 96" stroke="${PALETTE.hazardRed}" stroke-width="6" opacity=".8"/>`;
  return svg(260, 150, b, `data-car="${d.carId}" ${extra}`);
}

export interface CommandBoardArt {
  color: string;
  /** Command used this round and the die on it. */
  used: { cmd: string; value: number } | null;
  /** Commands that can take the die being placed: highlighted drop zones. */
  drop?: string[];
  /**
   * The four commands of a crew leader board (top-left, top-right, bottom-left, bottom-right),
   * in place of the standard ones. `slot` is the text in the die space ("1-3", "★").
   */
  commands?: { cmd: string; name: string; slot: string; lines: string[] }[];
  /** Commands holding a command token this round. */
  tokenOn?: string[];
  /** Text under the board in place of "COMANDI" (the leader's name and tokens). */
  caption?: string;
  /** Other commands stay usable after a die is placed (the player has command tokens). */
  keepOpen?: boolean;
  /**
   * A crew leader: the board is drawn from the owner's taller drawing, with the power, the name and
   * a portrait (`portrait` is an image address; without it, the crew colour and an initial).
   */
  leader?: { name: string; title: string; power: string; powerText: string; tokens: number; portrait?: string };
}

/** The four commands in the board's corners, with the die values each accepts (data/trv/game_base.json). */
export const COMMAND_SLOTS: { cmd: string; name: string; values: string; x: number; y: number }[] = [
  { cmd: 'airstrike', name: 'ATTACCO AEREO', values: 'ANY', x: 26, y: 26 },
  { cmd: 'nitro', name: 'NITRO', values: '1-3', x: 194, y: 26 },
  { cmd: 'drift', name: 'DRIFT', values: '3-5', x: 26, y: 164 },
  { cmd: 'repair', name: 'RIPARAZIONE', values: '6', x: 194, y: 164 },
];

/** Command board, 220 x 190: four command quarters, a diamond slot in each corner (data-drop="cmd:<id>"). */
export function commandBoardSvg(c: CommandBoardArt, extra = ''): string {
  const u = boards()?.commandBoardSvg(c, extra);
  if (u) return u;
  const o = off()?.commandBoardSvg(c, extra);
  if (o) return o;
  const ink = inkOn(c.color);
  let b = `<path d="M30 6 H190 L214 30 V160 L190 184 H30 L6 160 V30Z" fill="#1b1f27" stroke="rgba(0,0,0,.6)" stroke-width="3"/>`;
  b += `<path d="M40 22 H180 L198 40 V150 L180 168 H40 L22 150 V40Z" fill="${c.color}"/>`;
  b += `<path d="M110 30 V160 M30 95 H190" stroke="${ink}" stroke-opacity=".35" stroke-width="2"/>`;
  for (const s of COMMAND_SLOTS) {
    const tx = s.x < 100 ? 70 : 150, ty = s.y < 100 ? 72 : 128;
    const active = c.used?.cmd === s.cmd;
    const dim = !!c.used && !active;
    const hotQ = c.drop?.includes(s.cmd);
    // The whole quarter is a drop zone too, not only the diamond.
    b += `<rect x="${s.x < 100 ? 22 : 110}" y="${s.y < 100 ? 22 : 95}" width="88" height="73" fill="${hotQ ? '#4cff7a' : '#000'}" fill-opacity="${hotQ ? 0.18 : 0}" data-drop="cmd:${s.cmd}"/>`;
    b += `<text pointer-events="none" x="${tx}" y="${ty}" text-anchor="middle" font-size="${s.name.length > 8 ? 15 : 20}" fill="${ink}" opacity="${dim ? 0.35 : 1}" ${FONT}>${s.name}</text>`;
    const hot = c.drop?.includes(s.cmd);
    b += `<path d="M${s.x} ${s.y - 20} L${s.x + 20} ${s.y} L${s.x} ${s.y + 20} L${s.x - 20} ${s.y}Z" fill="#11141a" stroke="${hot ? '#4cff7a' : '#e8e0cf'}" stroke-width="${hot ? 5 : 2}" data-drop="cmd:${s.cmd}"/>`;
    if (active) b += placedDie(s.x, s.y, 26, c.used!.value, c.color);
    else b += `<text x="${s.x}" y="${s.y + 5}" text-anchor="middle" font-size="13" fill="#e8e0cf" ${FONT} pointer-events="none">${s.values}</text>`;
  }
  return svg(220, 190, b, extra);
}

// ------------------------------------------------------------------------------- pieces and people

/** Chopper icon, 100 x 100. `away`: placed on the board (drawn faded). */
export function chopperSvg(color: string, away = false, extra = ''): string {
  return svg(100, 100, `<g opacity="${away ? 0.35 : 1}"><path d="M8 22 H92" stroke="#222" stroke-width="6" stroke-linecap="round"/><path d="M50 22 V34" stroke="#222" stroke-width="5"/>`
    + `<ellipse cx="46" cy="48" rx="26" ry="15" fill="${color}" stroke="#111" stroke-width="3"/><path d="M70 46 H94 L96 38" stroke="${color}" stroke-width="7" fill="none"/>`
    + `<path d="M40 63 L36 84 M54 63 L58 84 M24 86 H74" stroke="#222" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="46" r="6" fill="#9fd3ff"/></g>`, extra);
}

/** Car seen from above, 120 x 60, nose to the right. */
export function carSvg(size: ArtSize, color: string, extra = ''): string {
  const L = size === 'L' ? 112 : size === 'M' ? 96 : 80, x0 = (120 - L) / 2;
  return svg(120, 60, `<path d="M${x0} 14 H${x0 + L - 20} L${x0 + L} 30 L${x0 + L - 20} 46 H${x0}Z" fill="${color}" stroke="#111" stroke-width="3"/>`
    + `<rect x="${x0 + L * 0.3}" y="20" width="${L * 0.32}" height="20" rx="3" fill="#1e232b"/>`
    + `<path d="M${x0 + L * 0.55} 30 H${x0 + L - 6}" stroke="#1e232b" stroke-width="4"/>`, extra);
}

/** Player avatar, 100 x 100: crew colour and initial. */
export function avatarSvg(color: string, name: string, extra = ''): string {
  const initial = esc((name.trim()[0] ?? '?').toUpperCase());
  return svg(100, 100, `<circle cx="50" cy="50" r="46" fill="${color}" stroke="#111" stroke-width="4"/>`
    + `<text x="50" y="66" text-anchor="middle" font-size="50" fill="${inkOn(color)}" ${FONT}>${initial}</text>`, extra);
}

// ------------------------------------------------------------------------------- Carnage at Devil's Run

/** The faces of the fire die (CDR p3): +1 or +2 moves, the fire goes out, the vehicle is eliminated. */
export type FireFace = '+1' | '+2' | 'out' | 'eliminated';

/** A flame, 100 units tall, its base centred on (cx, cy + 50) and scaled by `s`. */
function flame(cx: number, cy: number, s: number, outer: string, innerFill: string): string {
  const t = (x: number, y: number): string => `${(cx + x * s).toFixed(1)} ${(cy + y * s).toFixed(1)}`;
  return `<path d="M${t(0, 50)} C${t(-34, 50)} ${t(-40, 14)} ${t(-18, -8)} C${t(-16, 8)} ${t(-6, 10)} ${t(-4, 2)} C${t(-12, -20)} ${t(2, -40)} ${t(10, -50)} `
    + `C${t(8, -26)} ${t(30, -18)} ${t(32, 4)} C${t(36, 30)} ${t(24, 50)} ${t(0, 50)}Z" fill="${outer}"/>`
    + `<path d="M${t(0, 48)} C${t(-18, 48)} ${t(-20, 26)} ${t(-8, 12)} C${t(-6, 22)} ${t(2, 22)} ${t(2, 14)} C${t(0, 2)} ${t(10, -6)} ${t(14, -12)} `
    + `C${t(14, 4)} ${t(22, 14)} ${t(20, 28)} C${t(18, 42)} ${t(10, 48)} ${t(0, 48)}Z" fill="${innerFill}"/>`;
}

/** One face of the fire die, 100 x 100 (open drawing: yellow die, red flame and the face's sign). */
// The official fire die faces, traced from the scan (tools/art/trace_fire_die.py): licensed, used when present.
type TracedFireDie = { bg: string; ink: string; faces: Record<string, string> };
const tracedFire = Object.values(import.meta.glob<TracedFireDie>('/assets/licensed/vector/traced/fire_die.json', { eager: true, import: 'default' }))[0];

export function fireDieSvg(face: FireFace, extra = ''): string {
  if (tracedFire?.faces[face] && !openOnly) {
    return svg(100, 100, `<rect x="2" y="2" width="96" height="96" rx="16" fill="${tracedFire.bg}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`
      + `<path d="${tracedFire.faces[face]}" fill="${tracedFire.ink}" fill-rule="evenodd"/>`, extra);
  }
  let b = `<rect x="3" y="3" width="94" height="94" rx="16" fill="${PALETTE.dieFire}" stroke="#8a6a00" stroke-width="3"/>`;
  b += flame(50, 46, 0.78, PALETTE.fireRed, PALETTE.fireOrange);
  if (face === '+1' || face === '+2') {
    b += `<text x="50" y="66" text-anchor="middle" ${FONT} font-size="40" fill="#fff" stroke="${PALETTE.ink}" stroke-width="2.5" paint-order="stroke">${face}</text>`;
  } else if (face === 'out') {
    // The fire blown out: wind lines across the flame.
    for (const [y, w] of [[34, 56], [48, 66], [62, 50]] as const) b += `<path d="M${50 - w / 2} ${y} Q50 ${y - 8} ${50 + w / 2} ${y}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`;
  } else {
    // Eliminated: a skull over the flame.
    b += `<circle cx="50" cy="50" r="17" fill="#fff" stroke="${PALETTE.ink}" stroke-width="2"/><rect x="41" y="60" width="18" height="10" rx="3" fill="#fff" stroke="${PALETTE.ink}" stroke-width="2"/>`;
    b += `<circle cx="43.5" cy="49" r="4.5" fill="${PALETTE.ink}"/><circle cx="56.5" cy="49" r="4.5" fill="${PALETTE.ink}"/>`;
  }
  return svg(100, 100, b, extra);
}

/** The ON FIRE! token that sits on a burning car's dashboard (CDR p3), 120 x 120. */
export function onFireTokenSvg(extra = ''): string {
  let b = `<circle cx="60" cy="68" r="34" fill="none" stroke="${PALETTE.fireOrange}" stroke-width="14"/>`;
  b += `<circle cx="60" cy="68" r="34" fill="none" stroke="${PALETTE.dieFire}" stroke-width="5"/>`;
  b += flame(60, 44, 0.85, PALETTE.fireRed, PALETTE.fireOrange);
  b += `<text x="60" y="114" text-anchor="middle" ${FONT} font-size="20" fill="#fff" stroke="${PALETTE.ink}" stroke-width="3" paint-order="stroke">ON FIRE!</text>`;
  return svg(120, 120, b, extra);
}
