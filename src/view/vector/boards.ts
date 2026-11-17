// The command board and the three car dashboards drawn from the project owner's own vector drawing
// (one SVG with all four boards side by side: outlines and lines only, layers "background",
// "foreground", "lines"). This module splits the drawing into its boards, colours them for a crew,
// and adds what the drawing leaves out: the writing, the dice slots' behaviour, the damage tokens.
// art.ts uses it when the drawing is present.

import type { DashboardArt, CommandBoardArt, ArtSize } from './art';
import { ONGOING_PANEL_TOP, CARD_RED } from '../cards';

/** What this module needs from art.ts (passed in, so the two files do not import each other). */
export interface BoardBase {
  dieSvg(f: { kind: string; value: number | string; color?: string; number?: boolean }, extra?: string): string;
  damageTokenSvg(type: string | null, faceUp: boolean): string;
  /** The ON FIRE! token (Carnage at Devil's Run), 120 x 120. */
  onFireTokenSvg(): string;
  /** A command token centred on (cx, cy), `size` units wide. */
  commandToken(cx: number, cy: number, size: number): string;
  /** A command's icon centred on (cx, cy), `size` units wide, in `color` ('' when it has none). */
  commandIcon(cmd: string, cx: number, cy: number, size: number, color: string): string;
  inkOn(hex: string): string;
  /** The font-family attribute of the interface's display font. */
  font: string;
}

interface El { layer: string; tag: string; attrs: string; cls: string; x: number }
type BoardId = 'cmd' | ArtSize;

const HOT = '#4cff7a';
const DARK = '#26232b', METAL = '#aba3a6', LINE = '#aba3a6', CREAM = '#f3e6d0';
/** Left and right edge of each board in the drawing, and the dashboards' top and bottom. */
const SPAN: Record<BoardId, [number, number]> = { cmd: [0, 291], S: [268, 577], M: [579, 896.5], L: [887.5, 1196] };
const DASH_Y: [number, number] = [48, 252];
const CMD_H = 259.53;
const DRAW_W = 1197;
/** The middle of each dashboard, the two damage slots on its lower edge (left and right of the middle) and that edge's height. */
const DASH_MID: Record<ArtSize, number> = { S: 422.35, M: 731.94, L: 1041.53 };
const SLOT_DX = 65.5, SLOT_Y = 205.3;
/** The recess in the middle of a dashboard's top edge, where an upgrade card is slid in: its width and its floor. */
const RECESS = { w: 157.46, y: 57.43 };
/** How much of an upgrade card sticks out of the recess when hidden (its name), and how much stays tucked in when raised. */
const CARD_PEEK = 30, CARD_TUCK = 12;
/** A damage token under a dashboard: its width, and how far its top is tucked under the board. */
const TOKEN_W = 100, TOKEN_TUCK = 9;
/**
 * A token with an ongoing effect card under it (Carnage at Devil's Run) is pushed further under the
 * board by this much, so the card's red panel with its name shows below the token, as the rulebook
 * lays the card under the token. The card is as wide as the token (440 x 680 scans).
 */
const CARD_RAISE = 30, ONGOING_H = TOKEN_W * 680 / 440;
/**
 * The strip's frame in the drawing's units: the boards as the owner drew them (and as the rulebook
 * lays them out), plus the damage tokens hanging under the dashboards. Expansions grow it upward:
 * a card above each dashboard and a command board twice as tall; the page anchors the strip to the
 * bottom, so a taller frame only takes room from the table.
 */
export const STRIP_BOX = { x: 0, y: 0, w: DRAW_W, h: 292 };
/** The command board's coloured panel: left, top, right, bottom. */
const PANEL = [42.5, 42.5, 248.4, 217.8];

/**
 * The player strip of the owner's second drawing (assets/base/plance/plancia_striscia.svg, sent by
 * the user on 2026-11-17): the same three dashboards, moved by STRIP_SHIFT, beside a new command
 * board (narrower, its cross with four equal arms), with a pull-out tab on its left for the crew
 * leader's portrait and power, an Undo plate at the top of the board, the command tokens heaped at
 * its foot and a drawer behind its top edge for the player's dice (the page's #cmddock). The command
 * board is read from that drawing and moved back by STRIP_SHIFT, so it meets the first drawing's
 * dashboards exactly.
 */
const STRIP_SHIFT = { x: -18.45, y: -24.97 };
/**
 * The dice drawer behind the board's top edge (the page's #cmddock, placed by dock.ts), in the
 * strip's units: the board's top edge, the drawer's middle and width, and how much of it shows above
 * the board when closed (the drawing's drawer, moved by STRIP_SHIFT).
 */
export const DRAWER = { edge: 38.8 - 24.97, mid: 179.05 - 18.45, w: 146.3, peek: 20 };
/** How far the power tab slides out to the left (CSS `#strip.tab-open .ptab`); the rest stays under the board. */
export const TAB_PULL = 166;
/** The strip's left edge with a crew leader: room for the tab pulled out. */
const TAB_LEFT = -175;
/** The strip's left edge without a crew leader: just left of the command board. */
const STRIP_LEFT = 30;
/** The die slots of the corners, as in the first drawing (40.14-unit squares turned 45°). */
const SLOT = 40.14;
/** The tab's grey and its shape in the second drawing's units: the drawing's tab, 6 units longer so the power's text fits beside a narrower portrait (mockup approved 2026-11-17). */
const TAB_PATH = 'M280,76.1 L272,68 c-0.9-0.9-2.2-1.5-3.5-1.5 H27.9 c-1.3,0-2.6,0.5-3.5,1.5 l-8.1,8.1 c-0.9,0.9-1.5,2.2-1.5,3.5 v151 c0,1.3,0.5,2.6,1.5,3.5 l8.1,8.1 c0.9,0.9,2.2,1.5,3.5,1.5 h242.6 c1.3,0,2.6-0.5,3.5-1.5 l6-6 c0.9-0.9,1.5-2.2,1.5-3.5 V79.6 z';
/** The portrait's window on the tab: its left 90 units. */
const TAB_PORTRAIT = { x: 14, y: 66.5, w: 90, h: 177.2 };
const TAB_PORTRAIT_PATH = 'M27.9,66.5 H104 V243.7 H27.9 c-1.3,0-2.6-0.5-3.5-1.5 l-8.1-8.1 c-0.9-0.9-1.5-2.2-1.5-3.5 v-151 c0-1.3,0.5-2.6,1.5-3.5 l8.1-8.1 c0.9-0.9,2.2-1.5,3.5-1.5 z';
/** The glow of an upgrade card whose ability is available or has just fired, and of its word. */
const CUE_BLUE = '#2f7bff';
/**
 * The Undo plate: the COMANDI plate mirrored to the board's top. As COMANDI fills the board's rise at
 * its foot, centred on the bottom edge, Undo fills the rise at its top, centred on the top edge (38.8).
 */
const UNDO_PLATE = '141.8,38.8 149.7,30.9 208.4,30.9 216.3,38.8 208.4,46.7 149.7,46.7';
/** Command tokens heaped at the board's foot, over the left end of the COMANDI plate: centre, turn (degrees), in the second drawing's units. */
const TOKEN_HEAP: [number, number, number][] = [[146, 263, -14], [157, 255, 9], [168, 262, -5], [151, 249, 16], [163, 246, -9]];
const HEAP_SIZE = 28;

/** The command board of the second drawing, in that drawing's units (see parseStrip). */
interface StripBoard {
  board: string; orange: string; plaque: string;
  /** The two arms of the cross, as attributes of a <line>. */
  cross: string[];
  /** The centres of the four die slots: top left, top right, bottom left, bottom right. */
  slots: [number, number][];
  /** The cross's centre and the length of an arm: a command's sector is the square on two arms. */
  mid: [number, number]; arm: number;
  /** The coloured panel's box: left, top, right, bottom. */
  panel: number[];
}

/** The end points of a path's segments (M, L, H, V, C and their relative forms, Z): enough for the box of a shape. */
export function pathPoints(d: string): [number, number][] {
  const out: [number, number][] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const m of d.matchAll(/([MLHVCZmlhvcz])([^MLHVCZmlhvcz]*)/g)) {
    const n = (m[2].match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? []).map(Number);
    const rel = m[1] === m[1].toLowerCase();
    const step = { m: 2, l: 2, h: 1, v: 1, c: 6, z: 0 }[m[1].toLowerCase() as 'm']!;
    if (!step) { x = sx; y = sy; out.push([x, y]); continue; }
    for (let i = 0; i + step <= n.length; i += step) {
      const k = m[1].toLowerCase();
      if (k === 'h') x = rel ? x + n[i] : n[i];
      else if (k === 'v') y = rel ? y + n[i] : n[i];
      else { const ex = n[i + step - 2], ey = n[i + step - 1]; x = rel ? x + ex : ex; y = rel ? y + ey : ey; }
      if (k === 'm' && i === 0) { sx = x; sy = y; }
      out.push([x, y]);
    }
  }
  return out;
}
const boxOf = (pts: [number, number][]): number[] => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
const polyPoints = (s: string): [number, number][] => {
  const n = s.trim().split(/[\s,]+/).map(Number);
  return n.filter((_, i) => i % 2 === 0).map((v, i) => [v, n[i * 2 + 1]]);
};

/**
 * Reads the command board out of the second drawing, by the classes of its Illustrator export: the
 * board (the first `st1` path), its coloured panel (`st2`), the COMANDI plate (`st3`), the cross
 * (`st4`, two lines) and the four die slots (`st5`). Null when one is missing.
 */
export function parseStrip(raw: string): StripBoard | null {
  const first = (re: RegExp): string | undefined => re.exec(raw)?.[1];
  const board = first(/<path class="st1" d="([^"]+)"/), orange = first(/<polygon class="st2" points="([^"]+)"/), plaque = first(/<polygon class="st3" points="([^"]+)"/);
  const cross = [...raw.matchAll(/<line class="st4" ([^/>]*)\/>/g)].slice(0, 2).map(m => m[1].trim());
  const slots = [...raw.matchAll(/<path class="st5" d="([^"]+)"/g)].slice(0, 4).map(m => {
    const b = boxOf(pathPoints(m[1]));
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] as [number, number];
  });
  if (!board || !orange || !plaque || cross.length < 2 || slots.length < 4) return null;
  const at = (a: string, k: string): number => num(a, k);
  const across = cross.find(a => at(a, 'y1') === at(a, 'y2')), down = cross.find(a => at(a, 'x1') === at(a, 'x2'));
  if (!across || !down) return null;
  const mid: [number, number] = [at(down, 'x1'), at(across, 'y1')];
  const rank = (p: [number, number]): number => (p[1] > mid[1] ? 2 : 0) + (p[0] > mid[0] ? 1 : 0);
  slots.sort((p, q) => rank(p) - rank(q));
  return { board, orange, plaque, cross, slots, mid, arm: Math.abs(at(across, 'x2') - at(across, 'x1')) / 2, panel: boxOf(polyPoints(orange)) };
}

const num = (attrs: string, name: string): number => Number(new RegExp(`\\b${name}="([-\\d.]+)"`).exec(attrs)?.[1] ?? NaN);
const inner = (s: string): string => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Breaks a sentence into lines of at most `max` characters, at the spaces. */
function wrap(s: string, max: number): string[] {
  const out: string[] = [];
  for (const w of s.split(/\s+/)) {
    const last = out[out.length - 1];
    if (last !== undefined && last.length + 1 + w.length <= max) out[out.length - 1] = `${last} ${w}`;
    else out.push(w);
  }
  return out;
}

/** Splits the drawing into its shapes, each with the x that tells which board it belongs to. */
function parse(raw: string): El[] {
  const out: El[] = [];
  let layer = '';
  for (const m of raw.matchAll(/<g id="(\w+)">|<(path|polygon|rect|line|circle)\b([^>]*?)\/>/g)) {
    if (m[1]) { layer = m[1]; continue; }
    const tag = m[2], attrs = m[3];
    let x: number;
    if (tag === 'line') x = (num(attrs, 'x1') + num(attrs, 'x2')) / 2;
    else if (tag === 'rect') x = num(attrs, 'x') + num(attrs, 'width') / 2;
    else if (tag === 'circle') x = num(attrs, 'cx');
    else if (tag === 'polygon') {
      const p = (/points="([^"]+)"/.exec(attrs)?.[1] ?? '').trim().split(/[\s,]+/).map(Number);
      x = p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / (p.length / 2);
    } else x = Number(/d="M([-\d.]+)/.exec(attrs)?.[1] ?? NaN);
    if (tag === 'rect' && num(attrs, 'width') < 10) continue; // the joint between two dashboards
    out.push({ layer, tag, attrs: attrs.replace(/\s*class="[^"]*"/, ''), cls: /class="([^"]+)"/.exec(attrs)?.[1] ?? '', x });
  }
  return out;
}

const boardOf = (x: number): BoardId => (x < 270 ? 'cmd' : x < 578 ? 'S' : x < 897 ? 'M' : 'L');

/** Draws one shape of the drawing with the colours of its class (st0..st6 of the export). */
function shape(e: El, crew: string, override = ''): string {
  const style: Record<string, string> = {
    st4: `fill="${DARK}"`,
    st5: `fill="${crew}"`,
    st6: `fill="${METAL}"`,
    st0: `fill="none" stroke="${LINE}" stroke-width="2"`,
    st2: `fill="none" stroke="${LINE}" stroke-width="1"`,
    st3: `fill="none" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 3"`,
    st1: `fill="${DARK}" stroke="${LINE}" stroke-width="4" stroke-linecap="round"`,
  };
  return `<${e.tag} ${e.attrs.trim()} ${override || (style[e.cls] ?? '')}/>`;
}

const SIZE_LABEL: Record<ArtSize, string> = { S: 'PICCOLA', M: 'MEDIA', L: 'GRANDE' };

/** The four commands: where they sit, the dice they take and what they do (rulebook, command board). */
const COMMANDS: { cmd: string; name: string; dice: string; slot: string; lines: string[]; left: boolean; top: boolean }[] = [
  { cmd: 'airstrike', name: 'ATTACCO AEREO', dice: 'qualsiasi dado', slot: '1-6', lines: ['Piazza l’elicottero', 'su una casella vuota.', 'Dal 2° round spara.'], left: true, top: true },
  { cmd: 'nitro', name: 'NITRO', dice: 'dado 1 · 2 · 3', slot: '1-3', lines: ['Aggiungi il dado', 'al movimento', 'dell’auto.'], left: false, top: true },
  { cmd: 'drift', name: 'DRIFT', dice: 'dado 3 · 4 · 5', slot: '3-5', lines: ['Attraversa il primo', 'veicolo che incontri,', 'senza slam.'], left: true, top: false },
  { cmd: 'repair', name: 'RIPARA', dice: 'dado 6', slot: '6', lines: ['Togli un danno', 'da una tua auto.'], left: false, top: false },
];

/**
 * Builds the two board drawings from the owner's SVG text.
 * Example: `const b = makeBoards(rawSvg, { dieSvg, damageTokenSvg, inkOn, font })`.
 */
export function makeBoards(raw: string, base: BoardBase, stripRaw?: string): {
  dashboardSvg(d: DashboardArt, extra?: string): string;
  commandBoardSvg(c: CommandBoardArt, extra?: string): string;
  stripSvg(c: CommandBoardArt, dashes: DashboardArt[], extra?: string): string;
  /** The strip's frame (its viewBox), with or without a crew leader. */
  stripFrame(leader: boolean): { x: number; y: number; w: number; h: number };
} {
  const all = parse(raw);
  const strip = stripRaw ? parseStrip(stripRaw) : null;
  const of = (id: BoardId): El[] => all.filter(e => boardOf(e.x) === id);
  const svg = (box: string, body: string, extra: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" ${extra}>${body}</svg>`;
  /** Running text (what a power, a command or a card does): a plain sans-serif reads better than the display font. */
  const prose = (s: string, x: number, y: number, size: number, fill: string, anchor = 'start', opacity = '1'): string =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" fill-opacity="${opacity}" text-anchor="${anchor}" font-family="system-ui, 'Segoe UI', Roboto, sans-serif" font-weight="600" pointer-events="none">${esc(s)}</text>`;
  const text = (s: string, x: number, y: number, size: number, fill: string, anchor = 'start', extra = ''): string =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${base.font} pointer-events="none" ${extra}>${esc(s)}</text>`;
  const die = (x: number, y: number, s: number, value: number, color: string): string =>
    `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none">${inner(base.dieSvg({ kind: 'movement', value, color, number: true }))}</g>`;
  const diamond = (x: number, y: number, r: number): string => `M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y}Z`;

  /** A car dashboard: the board, its writing, the dice on it and the damage tokens hanging below. */
  function dashboardSvg(d: DashboardArt, extra = ''): string {
    const [x0, x1] = SPAN[d.size];
    const w = x1 - x0, h = STRIP_BOX.h - DASH_Y[0];
    return svg(`${x0} ${DASH_Y[0]} ${w} ${h}`, dashBody(d), `style="aspect-ratio:${w}/${h}" ${extra}`);
  }

  /** A dashboard in the drawing's own coordinates (see dashboardSvg). */
  function dashBody(d: DashboardArt): string {
    const els = of(d.size);
    const [x0, x1] = SPAN[d.size];
    const dead = d.status !== 'ok';
    const crew = dead ? '#6d6b70' : d.color;
    const ink = base.inkOn(crew);
    const slots = els.filter(e => e.tag === 'rect' && e.cls === 'st3');
    const any = slots.find(e => !/rotate/.test(e.attrs))!, coast = slots.find(e => /rotate/.test(e.attrs))!;
    const target = els.find(e => e.tag === 'circle')!;
    const ax = num(any.attrs, 'x'), ay = num(any.attrs, 'y'), as = num(any.attrs, 'width');
    const cx = num(coast.attrs, 'x') + num(coast.attrs, 'width') / 2, cy = num(coast.attrs, 'y') + num(coast.attrs, 'height') / 2;
    const cr = num(coast.attrs, 'width') / Math.SQRT2;
    const tx = num(target.attrs, 'cx'), ty = num(target.attrs, 'cy');
    const bg = els.find(e => e.layer === 'background')!;

    let b = upgradeCard(d);
    // Damage tokens first, so the board covers their top edge: one in each of the two slots under
    // the board (more than two overlap, shifted). An empty slot shows a faint outline.
    const token = base.damageTokenSvg(null, false);
    const vb = (/viewBox="([^"]+)"/.exec(token)?.[1] ?? '0 0 100 100').split(/\s+/).map(Number);
    const k = TOKEN_W / vb[2], th = vb[3] * k;
    for (let i = 0; i < Math.max(2, d.damage); i++) {
      const sx = DASH_MID[d.size] + (i % 2 ? SLOT_DX : -SLOT_DX) - TOKEN_W / 2 + Math.floor(i / 2) * 10;
      const card = i < d.damage ? d.cards?.[i] : null;
      const sy = SLOT_Y - TOKEN_TUCK + Math.floor(i / 2) * 8 - (card ? CARD_RAISE : 0);
      if (card) b += ongoingCard(card, sx, sy + th - 4 - ONGOING_PANEL_TOP * ONGOING_H, `${d.carId}-${i}`);
      if (i < d.damage) b += `<g transform="translate(${sx} ${sy}) scale(${k})">${inner(token)}</g>`;
      else if (!dead) b += `<rect x="${sx + 4}" y="${sy}" width="${TOKEN_W - 8}" height="${th - 12}" rx="6" fill="#000" fill-opacity=".18" stroke="${LINE}" stroke-opacity=".3" stroke-dasharray="4 4"><title>Slot danno</title></rect>`;
    }
    for (const e of els) {
      if (slots.includes(e) || (e.tag === 'rect' && e.cls === 'st4')) continue; // the slots are drawn below, with their state
      b += shape(e, crew);
    }
    if (d.pick) b += shape(bg, crew, `fill="none" stroke="${HOT}" stroke-width="5"`);

    // Writing: the size, where the car is, the target rings (one more per size).
    b += text(SIZE_LABEL[d.size], x0 + 26, 88, 27, ink);
    if (d.label) b += text(d.label, x0 + 26, 104, 12, ink, 'start', 'opacity=".8"');
    const rings = d.size === 'L' ? 3 : d.size === 'M' ? 2 : 1;
    for (let i = 0; i < rings; i++) b += `<circle cx="${tx}" cy="${ty}" r="${3.5 + i * 4.5}" fill="none" stroke="${crew}" stroke-width="2"/>`;

    if (!dead) {
      const move = d.placed.find(p => !p.coast), coasts = d.placed.filter(p => p.coast);
      // Move slot (any die).
      b += `<rect x="${ax}" y="${ay}" width="${as}" height="${as}" rx="5" fill="${d.dropMove ? '#1f5a30' : DARK}" stroke="${d.dropMove ? HOT : LINE}" stroke-width="${d.dropMove ? 3 : 1}" stroke-dasharray="${move || d.dropMove ? '0' : '3 3'}" data-drop="move:${d.carId}"/>`;
      if (move) b += die(ax + as / 2, ay + as / 2, as * 0.86, move.value, d.color);
      else b += text('DADO', ax + as / 2, ay + as / 2 + 4.5, 13, CREAM, 'middle');
      b += text('MOVIMENTO', ax + as / 2, ay + as + 34, 13, CREAM, 'middle', 'opacity=".85"');
      // A burning car: its ON FIRE! token lies over the move slot (asked by the user, 2026-11-16). It lets clicks through to the slot.
      if (d.onFire) {
        const ts = as * 1.15;
        b += `<g transform="translate(${ax + as / 2 - ts / 2} ${ay + as / 2 - ts / 2}) scale(${ts / 120})" pointer-events="none">${inner(base.onFireTokenSvg())}</g>`;
      }
      // Coast slot (+1).
      b += `<path d="${diamond(cx, cy, cr)}" fill="${d.dropCoast ? '#1f5a30' : DARK}" stroke="${d.dropCoast ? HOT : LINE}" stroke-width="${d.dropCoast ? 3 : 1}" stroke-dasharray="${coasts.length || d.dropCoast ? '0' : '3 3'}" stroke-linejoin="round" data-drop="coast:${d.carId}"/>`;
      if (coasts.length) b += die(cx, cy, cr * 0.95, coasts[coasts.length - 1].value, d.color);
      else b += text('+1', cx, cy + 5, 15, CREAM, 'middle');
      b += text('INERZIA', cx, cy + cr + 17, 13, CREAM, 'middle', 'opacity=".85"');
      for (let i = 0; i < 2; i++) b += `<circle cx="${cx - 6 + i * 12}" cy="${cy + cr + 27}" r="3.4" fill="${i < coasts.length ? CREAM : 'none'}" stroke="${CREAM}" stroke-width="1"/>`;
    }
    if (dead) b += shape(bg, crew, 'fill="#000" opacity=".5"');
    if (d.status === 'inop') {
      b += `<g transform="translate(${(x0 + x1) / 2} 132) rotate(-7)"><rect x="-74" y="-17" width="148" height="34" rx="4" fill="#d42f30" stroke="#1d1b20" stroke-width="2"/>${text('FUORI USO', 0, 11, 30, CREAM, 'middle')}</g>`;
    }
    if (d.status === 'elim') b += `<g transform="translate(${(x0 + x1) / 2} 132) rotate(-7)">${text('ELIMINATA', 0, 12, 36, '#ff5a4a', 'middle')}</g>`;
    return `<g data-car="${d.carId}">${b}</g>`;
  }

  /** The command board: four commands with what they do, a die slot in each corner. */
  function commandBoardSvg(c: CommandBoardArt, extra = ''): string {
    return svg(`0 0 ${SPAN.cmd[1]} ${CMD_H}`, cmdBody(c), `style="aspect-ratio:${SPAN.cmd[1]}/${CMD_H}" ${extra}`);
  }

  /** The command board in the drawing's own coordinates (see commandBoardSvg). */
  function cmdBody(c: CommandBoardArt): string {
    const els = of('cmd');
    const ink = base.inkOn(c.color);
    const corner = els.filter(e => e.tag === 'rect' && e.cls === 'st2');
    const cross = els.filter(e => e.tag === 'line');
    const midX = num(cross.find(e => num(e.attrs, 'x1') === num(e.attrs, 'x2'))!.attrs, 'x1');
    const midY = num(cross.find(e => num(e.attrs, 'y1') === num(e.attrs, 'y2'))!.attrs, 'y1');
    let b = '';
    for (const e of els) {
      if (corner.includes(e)) continue;
      b += e.tag === 'line' ? shape(e, c.color, `stroke="${ink}" stroke-opacity=".35" stroke-width="1"`) : shape(e, c.color);
    }
    b += commandsPart(c, { corner, midX, midY, panel: PANEL, yTop: 70, yBottom: 153 }, ink);
    b += text(c.caption ?? 'COMANDI', (SPAN.cmd[0] + SPAN.cmd[1]) / 2, 250.6, 12, DARK, 'middle');
    return `<g>${b}</g>`;
  }

  /** The four commands of a board: their writing, drop zones, dice and command tokens. */
  function commandsPart(c: CommandBoardArt, geo: { corner: El[]; midX: number; midY: number; panel: number[]; yTop: number; yBottom: number; arm?: number }, ink: string): string {
    const { corner, midX, midY, panel: PANEL } = geo;
    let b = '';
    const list = c.commands?.length === COMMANDS.length
      ? c.commands.map((k, i) => ({ ...k, dice: k.slot, left: i % 2 === 0, top: i < 2 }))
      : COMMANDS;
    for (const k of list) {
      const slot = corner.find(e => (num(e.attrs, 'x') < midX) === k.left && (num(e.attrs, 'y') < midY) === k.top)!;
      const sx = num(slot.attrs, 'x') + num(slot.attrs, 'width') / 2, sy = num(slot.attrs, 'y') + num(slot.attrs, 'height') / 2;
      const r = num(slot.attrs, 'width') / Math.SQRT2;
      const hot = !!c.drop?.includes(k.cmd), active = c.used?.cmd === k.cmd, token = !!c.tokenOn?.includes(k.cmd);
      const dim = !!c.used && !active && !token && !c.keepOpen;
      // The whole quarter takes the die, not only the diamond.
      const qx = k.left ? PANEL[0] : midX, qy = k.top ? PANEL[1] : midY;
      const qw = k.left ? midX - PANEL[0] : PANEL[2] - midX, qh = k.top ? midY - PANEL[1] : PANEL[3] - midY;
      // Name, die and effect go with the quarter, for the pop-up the interface shows on hover (src/app/cmdtip.ts).
      b += `<rect x="${qx}" y="${qy}" width="${qw}" height="${qh}" fill="${hot ? HOT : '#000'}" fill-opacity="${hot ? 0.25 : 0}" data-drop="cmd:${k.cmd}"`
        + ` data-cmd-name="${esc(k.name)}" data-cmd-dice="${esc(k.dice)}" data-cmd-text="${esc(k.lines.join(' '))}"/>`;
      // The command's icon: on the second drawing, centred in its sector, the square built on two
      // arms of the cross (asked by the user, 2026-11-17), as wide as 91.5% of an arm so the widest
      // drawing keeps a margin; on the first, in the middle of its quarter, a little toward the
      // board's centre. The written name and effect when it has none.
      const icon = geo.arm
        ? base.commandIcon(k.cmd, midX + (k.left ? -1 : 1) * geo.arm / 2, midY + (k.top ? -1 : 1) * geo.arm / 2, geo.arm * 0.915, ink)
        : base.commandIcon(k.cmd, qx + qw / 2 + (k.left ? 6 : -6), qy + qh / 2 + (k.top ? 5 : -5), Math.min(qw, qh) * 0.74, ink);
      if (icon) b += `<g opacity="${dim ? 0.35 : 1}" pointer-events="none">${icon}</g>`;
      else {
        const tx = k.left ? midX - 7 : midX + 7, anchor = k.left ? 'end' : 'start';
        const y0 = k.top ? geo.yTop : geo.yBottom;
        b += `<g opacity="${dim ? 0.35 : 1}" pointer-events="none">${text(k.name, tx, y0, k.name.length > 8 ? 15.5 : 23, ink, anchor)}`
          + k.lines.map((l, i) => text(l, tx, y0 + 17 + i * 14.5, 13.5, ink, anchor)).join('') + '</g>';
      }
      b += `<path d="${diamond(sx, sy, r)}" fill="${hot ? '#1f5a30' : DARK}" stroke="${hot ? HOT : LINE}" stroke-width="${hot ? 3 : 1}" stroke-linejoin="round" data-drop="cmd:${k.cmd}"/>`;
      if (active) b += die(sx, sy, r * 0.95, c.used!.value, c.color);
      // A command token: a cream disc with a star, in the die space.
      else if (token) b += base.commandToken(sx, sy, r * 1.35);
      else b += text(k.slot, sx, sy + 5.5, 16, CREAM, 'middle', `opacity="${dim ? 0.35 : 1}"`);
    }
    return b;
  }

  /**
   * The player's whole strip in one drawing, laid out as the owner drew it: command board on the
   * left, the three dashboards against it and against each other, damage tokens hanging below.
   */
  function stripSvg(c: CommandBoardArt, dashes: DashboardArt[], extra = ''): string {
    // The medium dashboard's side points lie over its neighbours, as in the drawing's layer order.
    const order = [...dashes].sort((a, b) => 'SLM'.indexOf(a.size) - 'SLM'.indexOf(b.size));
    if (strip) {
      // The second drawing: the tab under the board, the board, the dashboards over its right edge.
      const f = stripFrame(!!c.leader), { x: dx, y: dy } = STRIP_SHIFT;
      const defs = '<defs><filter id="tokshadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0.6" dy="1.2" stdDeviation="0.9" flood-opacity=".55"/></filter></defs>';
      const tab = c.leader ? `<g transform="translate(${dx} ${dy})">${powerTab(c)}</g>` : '';
      return svg(`${f.x} ${f.y} ${f.w} ${f.h}`, defs + tab + stripBoard(c) + order.map(dashBody).join(''), `data-strip="2" style="aspect-ratio:${f.w}/${f.h}" ${extra}`);
    }
    // Without the second drawing: the first one's command board and dashboards (no leader's tab).
    const { x, y, w, h } = STRIP_BOX;
    return svg(`${x} ${y} ${w} ${h}`, cmdBody(c) + order.map(dashBody).join(''), `style="aspect-ratio:${w}/${h}" ${extra}`);
  }

  /** The strip's frame: the first drawing's, or the second's (room on the left for the tab pulled out). */
  function stripFrame(leader: boolean): { x: number; y: number; w: number; h: number } {
    if (!strip) return STRIP_BOX;
    const x = leader ? TAB_LEFT : STRIP_LEFT;
    return { x, y: 0, w: DRAW_W - x, h: STRIP_BOX.h };
  }

  /**
   * The second drawing's command board, in the strip's units: board, panel, cross, the commands,
   * the COMANDI plate, the Undo plate (when `c.undo` is set) and the command tokens left, heaped.
   */
  function stripBoard(c: CommandBoardArt): string {
    const s = strip!, ink = base.inkOn(c.color), { x: dx, y: dy } = STRIP_SHIFT;
    const plaque = boxOf(polyPoints(s.plaque));
    let b = `<path d="${s.board}" fill="${DARK}"/><polygon points="${s.orange}" fill="${c.color}"/>`;
    b += s.cross.map(a => `<line ${a} stroke="${ink}" stroke-opacity=".35" stroke-width="1"/>`).join('');
    b += `<polygon points="${s.plaque}" fill="${METAL}"/>` + text(c.caption ?? 'COMANDI', (plaque[0] + plaque[2]) / 2, plaque[3] - 3.7, 12, DARK, 'middle', 'font-style="italic"');
    if (c.undo) {
      // Undo, always in view, on a plate like the COMANDI one (asked by the user, 2026-11-17).
      b += `<g class="undoplate${c.undo === 'off' ? ' off' : ''}" data-undo="1"><title>Annulla l’ultima scelta (Ctrl+Z)</title><polygon points="${UNDO_PLATE}" fill="${METAL}"/>`
        + `<path d="M159.5,38.9 a3.6,3.6 0 1 1 1.8,3.3 M157.4,36.8 L159.5,39.7 L161.9,37.1" fill="none" stroke="${DARK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
        + text('ANNULLA', 185, 43.2, 12, DARK, 'middle', 'font-style="italic"') + '</g>';
    }
    const corner: El[] = s.slots.map(([x, y]) => ({ layer: '', tag: 'rect', cls: '', x: x + dx, attrs: `x="${x + dx - SLOT / 2}" y="${y + dy - SLOT / 2}" width="${SLOT}" height="${SLOT}"` }));
    const panel = s.panel.map((v, i) => v + (i % 2 ? dy : dx));
    let out = `<g transform="translate(${dx} ${dy})">${b}</g>`;
    out += commandsPart(c, { corner, midX: s.mid[0] + dx, midY: s.mid[1] + dy, panel, yTop: panel[1] + 27, yBottom: s.mid[1] + dy + 23, arm: s.arm }, ink);
    // The command tokens left, heaped at the board's foot as a player leaves them (asked by the user, 2026-11-17).
    const n = c.leader?.tokens ?? 0;
    let heap = '';
    for (let i = 0; i < n; i++) {
      const [x, y, a] = TOKEN_HEAP[i % TOKEN_HEAP.length];
      const lift = Math.floor(i / TOKEN_HEAP.length) * -6;
      heap += `<g transform="rotate(${a} ${x} ${y + lift})" filter="url(#tokshadow)">${base.commandToken(x, y + lift, HEAP_SIZE)}</g>`;
    }
    if (heap) out += `<g class="tokenheap" transform="translate(${dx} ${dy})" pointer-events="none">${heap}</g>`;
    return out;
  }

  /**
   * The crew leader's tab (second drawing): the portrait on its left, beside it the name, the title,
   * the power and what it does. At rest only the portrait's left edge shows beside the board; a
   * click pulls it out by TAB_PULL (CSS `#strip.tab-open .ptab`), its right end always under the
   * board, so it stays a tab (asked by the user, 2026-11-17). In the second drawing's units.
   */
  function powerTab(c: CommandBoardArt): string {
    // In the player's colour, as the drawer above the board (asked by the user, 2026-11-17).
    const L = c.leader!, P0 = TAB_PORTRAIT, ink = base.inkOn(c.color);
    let b = `<path d="${TAB_PATH}" fill="${c.color}"/>`;
    b += `<clipPath id="ptab-portrait"><path d="${TAB_PORTRAIT_PATH}"/></clipPath>`;
    b += L.portrait
      ? `<image href="${L.portrait}" x="${P0.x}" y="${P0.y}" width="${P0.w}" height="${P0.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ptab-portrait)"/>`
      : `<path d="${TAB_PORTRAIT_PATH}" fill="${DARK}" opacity=".3"/>` + text(L.name.charAt(0).toUpperCase(), P0.x + P0.w / 2, P0.y + P0.h / 2 + 22, 64, ink, 'middle', 'opacity=".45"');
    const tx = 110;
    b += prose(`${L.name} · ${L.title}`.toUpperCase(), tx, 84, 8.5, ink, 'start', '.7');
    const title = wrap(L.power.toUpperCase(), 13);
    title.forEach((l, i) => { b += text(l, tx, 104 + i * 20, 21, ink, 'start', 'font-style="italic"'); });
    wrap(L.powerText, 23).forEach((l, i) => { b += prose(l, tx, 104 + title.length * 20 + 2 + i * 13.5, 10.5, ink); });
    return `<g class="ptab" data-ptab="1"><title>${esc(`${L.power}: ${L.powerText}`)}</title>${b}</g>`;
  }

  /**
   * A car's upgrade card (Choppe Shoppe), slid into the recess in the middle of the dashboard's top
   * edge (RECESS wide, as the owner drew it), behind the board. Only its name shows above the recess;
   * with the pointer on the dashboard the card rises (CSS: `.upcard` and `--rise`) and shows its effect.
   */
  /**
   * An ongoing effect card under a damage token, its top at `y`: the official art with the red panel
   * redrawn over the English text and the Italian name on it. Hovering it shows the whole card
   * (data-ongoing, read by the page).
   */
  function ongoingCard(c: { id: string; name: string; art?: string }, x: number, y: number, key: string): string {
    const w = TOKEN_W, h = ONGOING_H, panel = y + ONGOING_PANEL_TOP * h;
    const clip = `ogclip-${key}`;
    let b = `<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/></clipPath><g clip-path="url(#${clip})">`;
    b += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${DARK}"/>`;
    if (c.art) b += `<image href="${c.art}" x="${x}" y="${y}" width="${w}" height="${panel - y + 2}" preserveAspectRatio="xMidYMin slice"/>`;
    b += `<rect x="${x}" y="${panel}" width="${w}" height="${h}" fill="${CARD_RED}"/></g>`;
    const words = c.name.toUpperCase().split(' ');
    const lines = words.length > 1 && c.name.length > 11 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [c.name.toUpperCase()];
    lines.forEach((l, i) => { b += text(l, x + 6, panel + 15 + i * 14, 14, '#fff', 'start', 'font-style="italic"'); });
    return `<g data-ongoing="${esc(c.id)}" style="cursor:zoom-in">${b}</g>`;
  }

  function upgradeCard(d: DashboardArt): string {
    if (!d.upgrade) return '';
    const cw = RECESS.w - 3, ch = Math.round(cw * 88 / 63), x = DASH_MID[d.size] - cw / 2;
    const off = d.status !== 'ok', head = off ? '#6d6b70' : d.color, cue = off ? undefined : d.upgrade.cue;
    const top = RECESS.y - CARD_PEEK; // hidden: only the name band sticks out of the recess
    const rise = ch - CARD_PEEK - CARD_TUCK; // raised: the whole card above the recess, its foot still tucked in
    const name = d.upgrade.name.toUpperCase();
    let b = `<rect x="${x}" y="${top}" width="${cw}" height="${ch}" rx="7" fill="${DARK}" stroke="${cue ? CUE_BLUE : head}" stroke-width="${cue ? 5 : 2.5}"/>`;
    b += `<rect x="${x + 4}" y="${top + 4}" width="${cw - 8}" height="${CARD_PEEK - 6}" rx="4" fill="${head}"/>`;
    b += text(name, x + cw / 2, top + CARD_PEEK - 7.5, Math.min(19, 250 / name.length), base.inkOn(head), 'middle');
    const lines = wrap(d.upgrade.text, 21);
    const textTop = top + ch - CARD_TUCK - 8 - lines.length * 14;
    // The space for the card's art, to come: between the name and the effect. Art and effect show only
    // when the card is raised (class upbody), so nothing of them peeks out under the board.
    const artY = top + CARD_PEEK + 4, artH = Math.max(10, textTop - top - CARD_PEEK - 18);
    b += `<g class="upbody"><rect x="${x + 6}" y="${artY}" width="${cw - 12}" height="${artH}" rx="4" fill="#3a3540"/>`;
    if (d.upgrade.art) {
      // The official illustration (cut without the card's frame), filling the art window.
      const ac = `upart-${d.carId}`;
      b += `<clipPath id="${ac}"><rect x="${x + 6}" y="${artY}" width="${cw - 12}" height="${artH}" rx="4"/></clipPath>`
        + `<image href="${d.upgrade.art}" x="${x + 6}" y="${artY}" width="${cw - 12}" height="${artH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${ac})"/>`;
    }
    lines.forEach((l, i) => { b += prose(l, x + 8, textTop + i * 14, 11.5, CREAM); });
    if (off) b += text('INATTIVO: AUTO FUORI USO', x + cw / 2, textTop - 8, 11, '#ff8a7a', 'middle');
    b += '</g>';
    // Cut at the recess floor: whatever of the card is behind the board never shows through its lower notches.
    const clip = `upclip-${d.carId}`;
    return `<clipPath id="${clip}"><rect x="${x - 4}" y="${RECESS.y - 2 * ch}" width="${cw + 8}" height="${2 * ch + 3}"/></clipPath>`
      + `<g clip-path="url(#${clip})"><g class="upcard${cue ? ' cue' : ''}" style="--rise:${-rise}px" opacity="${off ? 0.7 : 1}"><title>${esc(`${d.upgrade.name}: ${d.upgrade.text}`)}</title>${b}</g></g>`
      // The glowing card's word, above it, outside the clip (asked by the user, 2026-11-17).
      + (cue ? `<g class="cuetag" pointer-events="none"><rect x="${x + cw / 2 - 52}" y="${top - 25}" width="104" height="20" rx="10" fill="${CUE_BLUE}"/>`
        + text(cue === 'use' ? 'PUOI USARLA' : 'SI ATTIVA', x + cw / 2, top - 9.5, 15, '#fff', 'middle') + '</g>' : '');
  }

  return { dashboardSvg, commandBoardSvg, stripSvg, stripFrame };
}
