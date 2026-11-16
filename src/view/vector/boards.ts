// The command board and the three car dashboards drawn from the project owner's own vector drawing
// (one SVG with all four boards side by side: outlines and lines only, layers "background",
// "foreground", "lines"). This module splits the drawing into its boards, colours them for a crew,
// and adds what the drawing leaves out: the writing, the dice slots' behaviour, the damage tokens.
// art.ts uses it when the drawing is present.

import type { DashboardArt, CommandBoardArt, ArtSize } from './art';
import { ONGOING_PANEL_TOP, CARD_RED } from '../cards';

/** What this module needs from art.ts (passed in, so the two files do not import each other). */
export interface BoardBase {
  dieSvg(f: { kind: string; value: number | string; color?: string }, extra?: string): string;
  damageTokenSvg(type: string | null, faceUp: boolean): string;
  /** The ON FIRE! token (Carnage at Devil's Run), 120 x 120. */
  onFireTokenSvg(): string;
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
/**
 * The crew leader board (Choppe Shoppe) is the owner's second drawing, twice as tall: its command
 * panel is the standard one, moved down by LEAD_DY. In the strip the board is moved up by as much,
 * so the commands stay where they are and the leader's part rises above the dashboards.
 */
const LEAD_DY = 252.91, LEAD_W = 292.54, LEAD_H = 512.4;
/** Room on the left of the strip for the crew leader's power tab, pulled out (see stripSvg). */
export const LEAD_PANEL_W = 236;
/** Height of the crew leader's name plate above the command board, and width of the power tab's handle. */
export const LEAD_NAME_H = 60;
const LEAD_HANDLE = 40;
const LEAD_PANEL = [42.56, 295.41, 248.4, 470.67];
/** Where the leader board is cut to show its upper part alone: just under the title. */
const LEAD_HEAD_H = 272;
/** The strip's frame with a crew leader board: the same strip, grown upward. */
export const STRIP_BOX_TALL = { x: 0, y: -LEAD_DY, w: DRAW_W, h: STRIP_BOX.h + LEAD_DY };
/** The command board's coloured panel: left, top, right, bottom. */
const PANEL = [42.5, 42.5, 248.4, 217.8];

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
export function makeBoards(raw: string, base: BoardBase, leaderRaw?: string): {
  dashboardSvg(d: DashboardArt, extra?: string): string;
  commandBoardSvg(c: CommandBoardArt, extra?: string): string;
  stripSvg(c: CommandBoardArt, dashes: DashboardArt[], extra?: string): string;
  /**
   * The upper part of the crew leader board alone (portrait, name, title, command tokens), for an
   * interface that shows the commands in the strip and the power as text. Null without the drawing.
   */
  leaderHeadSvg(c: CommandBoardArt, extra?: string): string | null;
  /** True when the crew leader drawing is there: a board with `leader` makes the strip tall. */
  hasLeaderBoard: boolean;
} {
  const all = parse(raw);
  const lead = leaderRaw ? parse(leaderRaw) : null;
  const of = (id: BoardId): El[] => all.filter(e => boardOf(e.x) === id);
  const svg = (box: string, body: string, extra: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" ${extra}>${body}</svg>`;
  /** Running text (what a power, a command or a card does): a plain sans-serif reads better than the display font. */
  const prose = (s: string, x: number, y: number, size: number, fill: string, anchor = 'start'): string =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, 'Segoe UI', Roboto, sans-serif" font-weight="600" pointer-events="none">${esc(s)}</text>`;
  const text = (s: string, x: number, y: number, size: number, fill: string, anchor = 'start', extra = ''): string =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${base.font} pointer-events="none" ${extra}>${esc(s)}</text>`;
  const die = (x: number, y: number, s: number, value: number, color: string): string =>
    `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none" data-die3d="movement|${value}|${color}">${inner(base.dieSvg({ kind: 'movement', value, color }))}</g>`;
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
    if (c.leader && lead) return svg(`0 0 ${LEAD_W} ${LEAD_H}`, leaderBody(c), `style="aspect-ratio:${LEAD_W}/${LEAD_H}" ${extra}`);
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

  /**
   * The crew leader board in its drawing's own coordinates: the power top left, the portrait top
   * right, the name across the middle, the four commands below as on the standard board.
   */
  function leaderBody(c: CommandBoardArt, head = false): string {
    const els = lead!, L = c.leader!;
    const ink = base.inkOn(c.color);
    const corner = els.filter(e => e.tag === 'rect');
    const cross = els.filter(e => e.tag === 'line');
    const midX = num(cross.find(e => num(e.attrs, 'x1') === num(e.attrs, 'x2'))!.attrs, 'x1');
    const midY = num(cross.find(e => num(e.attrs, 'y1') === num(e.attrs, 'y2'))!.attrs, 'y1');
    const bg = els.find(e => e.layer === 'background')!;
    const panel = els.find(e => e.layer === 'foreground' && e.tag === 'polygon')!;
    const frame = els.find(e => e.layer === 'foreground' && e.tag === 'path')!;
    const tag = els.find(e => e.layer === 'lines' && e.tag === 'polygon')!;
    let b = `<path ${bg.attrs.trim()} fill="${DARK}"/><polygon ${panel.attrs.trim()} fill="${c.color}"/>`;
    for (const e of cross) b += `<line ${e.attrs.trim()} stroke="${ink}" stroke-opacity=".35" stroke-width="1"/>`;
    b += `<polygon ${tag.attrs.trim()} fill="${METAL}"/>`;
    // The portrait fills its frame; without an image, the crew colour and the leader's initial.
    const [fx, fy, fw, fh] = [130, 6, 137, 178];
    b += `<clipPath id="leader-portrait"><path ${frame.attrs.trim()}/></clipPath>`;
    b += L.portrait
      ? `<image href="${L.portrait}" x="${fx}" y="${fy}" width="${fw}" height="${fh}" preserveAspectRatio="xMidYMid slice" clip-path="url(#leader-portrait)"/>`
      : `<path ${frame.attrs.trim()} fill="${c.color}"/>` + text(L.name.charAt(0).toUpperCase(), fx + fw / 2, fy + fh / 2 + 34, 100, ink, 'middle', 'opacity=".45"');
    b += `<path ${frame.attrs.trim()} fill="none" stroke="${LINE}" stroke-width="2"/>`;
    // The special power, in the dark space beside the portrait.
    if (head) {
      // The head alone: the power is written beside it by the interface; here, the command tokens left.
      b += text('SEGNALINI', 34, 44, 15, METAL, 'start', 'letter-spacing="1"') + text('COMANDO', 34, 60, 15, METAL, 'start', 'letter-spacing="1"');
      b += L.tokens ? text('★'.repeat(L.tokens), 34, 96, 30, '#f6c46a') : text('—', 34, 96, 30, METAL);
    } else {
      // In the dark space left of the portrait (x 30-126): the name of the power, then what it does.
      const title = wrap(L.power.toUpperCase(), 12);
      title.forEach((l, i) => { b += text(l, 30, 40 + i * 17, 18, '#f6c46a'); });
      wrap(L.powerText, 16).forEach((l, i) => { b += prose(l, 30, 46 + title.length * 17 + i * 15, 13, CREAM); });
    }
    // Name and title, across the board.
    const name = L.name.toUpperCase();
    b += text(name, LEAD_W / 2, 238, Math.min(48, 500 / name.length), CREAM, 'middle');
    b += text(L.title.toUpperCase(), LEAD_W / 2, 258, 14, METAL, 'middle', 'letter-spacing="1"');
    if (head) return `<g>${b}</g>`;
    b += commandsPart(c, { corner, midX, midY, panel: LEAD_PANEL, yTop: 70 + LEAD_DY, yBottom: 153 + LEAD_DY }, ink);
    b += text(c.caption ?? (L.tokens ? `${'★'.repeat(L.tokens)}` : 'NESSUN SEGNALINO'), LEAD_W / 2, 503.5, 12, DARK, 'middle');
    return `<g>${b}</g>`;
  }

  /** The crew leader board's upper part, cut just under the title (see the returned type). */
  function leaderHeadSvg(c: CommandBoardArt, extra = ''): string | null {
    if (!c.leader || !lead) return null;
    return svg(`0 0 ${LEAD_W} ${LEAD_HEAD_H}`, leaderBody(c, true), `style="aspect-ratio:${LEAD_W}/${LEAD_HEAD_H}" ${extra}`);
  }

  /** The four commands of a board: their writing, drop zones, dice and command tokens. */
  function commandsPart(c: CommandBoardArt, geo: { corner: El[]; midX: number; midY: number; panel: number[]; yTop: number; yBottom: number }, ink: string): string {
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
      b += `<rect x="${qx}" y="${qy}" width="${k.left ? midX - PANEL[0] : PANEL[2] - midX}" height="${k.top ? midY - PANEL[1] : PANEL[3] - midY}" fill="${hot ? HOT : '#000'}" fill-opacity="${hot ? 0.25 : 0}" data-drop="cmd:${k.cmd}"><title>${esc(`${k.name} (${k.dice}): ${k.lines.join(' ')}`)}</title></rect>`;
      const tx = k.left ? midX - 7 : midX + 7, anchor = k.left ? 'end' : 'start';
      const y0 = k.top ? geo.yTop : geo.yBottom;
      b += `<g opacity="${dim ? 0.35 : 1}">${text(k.name, tx, y0, k.name.length > 8 ? 15.5 : 23, ink, anchor)}`
        + k.lines.map((l, i) => text(l, tx, y0 + 17 + i * 14.5, 13.5, ink, anchor)).join('') + '</g>';
      b += `<path d="${diamond(sx, sy, r)}" fill="${hot ? '#1f5a30' : DARK}" stroke="${hot ? HOT : LINE}" stroke-width="${hot ? 3 : 1}" stroke-linejoin="round" data-drop="cmd:${k.cmd}"/>`;
      if (active) b += die(sx, sy, r * 0.95, c.used!.value, c.color);
      // A command token: a cream disc with a star, in the die space.
      else if (token) b += `<circle cx="${sx}" cy="${sy}" r="${r * 0.62}" fill="${CREAM}" stroke="${DARK}" stroke-width="2"/>` + text('★', sx, sy + 6.5, 19, DARK, 'middle');
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
    // With a crew leader the strip has the leader's name above the command board and, on its left,
    // room for the tab with the leader's power to be pulled out; boards and dashboards as always.
    const x = c.leader ? -LEAD_PANEL_W : 0, y = c.leader ? -LEAD_NAME_H : 0, w = DRAW_W - x, h = STRIP_BOX.h - y;
    const board = c.leader
      ? leaderTab(c) + leaderName(c) + cmdBody({ ...c, caption: c.caption ?? (c.leader.tokens ? '★'.repeat(c.leader.tokens) : 'NESSUN SEGNALINO') })
      : cmdBody(c);
    return svg(`${x} ${y} ${w} ${h}`, board + order.map(dashBody).join(''), `style="aspect-ratio:${w}/${h}" ${extra}`);
  }

  /** The crew leader's name and title on a plate above the command board, its foot behind the board. */
  function leaderName(c: CommandBoardArt): string {
    const L = c.leader!, x0 = 26, x1 = SPAN.cmd[1] - 26, y0 = -LEAD_NAME_H + 4, y1 = 24, k = 14, mid = SPAN.cmd[1] / 2;
    const name = L.name.toUpperCase();
    return `<path d="M${x0 + k} ${y0} H${x1 - k} L${x1} ${y0 + k} V${y1} H${x0} V${y0 + k}Z" fill="${DARK}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>`
      + text(name, mid, y0 + 33, Math.min(34, 400 / name.length), CREAM, 'middle')
      + text(L.title.toUpperCase(), mid, y0 + 49, 13, METAL, 'middle', 'letter-spacing="1"');
  }

  /**
   * The crew leader's power on a pull-out tab: one solid block slid behind the command board from
   * the left, only its handle showing (the power's name, written upward). With the pointer on it
   * the tab comes out (CSS: `.leadtab` and `--pull`) and shows what the power does. Being behind
   * the board, it also closes the notches of the board's left edge.
   */
  function leaderTab(c: CommandBoardArt): string {
    const L = c.leader!;
    const pull = LEAD_PANEL_W - LEAD_HANDLE - 6; // how far it comes out
    const x0 = -LEAD_HANDLE, x1 = pull + 70, y0 = 40, y1 = 220, k = 14; // pulled out, 70 units stay behind the board
    let b = `<path d="M${x0 + k} ${y0} H${x1} V${y1} H${x0 + k} L${x0} ${y1 - k} V${y0 + k}Z" fill="${DARK}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>`;
    b += `<rect x="${x0 + 7}" y="${y0 + 16}" width="5" height="${y1 - y0 - 32}" rx="2.5" fill="${c.color}"/>`;
    const hx = x0 + 27, hy = (y0 + y1) / 2, power = L.power.toUpperCase();
    b += `<g transform="rotate(-90 ${hx} ${hy})">${text(power, hx, hy + 6, Math.min(19, 250 / power.length), '#f6c46a', 'middle')}</g>`;
    b += `<line x1="${x0 + LEAD_HANDLE - 2}" y1="${y0 + 12}" x2="${x0 + LEAD_HANDLE - 2}" y2="${y1 - 12}" stroke="${LINE}" stroke-opacity=".35"/>`;
    // What the power does: on the part that the board hides until the tab is out.
    const tx = 14;
    b += text(power, tx, y0 + 36, Math.min(26, 330 / power.length), '#f6c46a');
    wrap(L.powerText, 23).forEach((l, i) => { b += prose(l, tx, y0 + 60 + i * 18, 14.5, CREAM); });
    return `<g class="leadtab" style="--pull:${-pull}px"><title>${esc(`${L.power}: ${L.powerText}`)}</title>${b}</g>`;
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
    b += c.art ? `<image href="${c.art}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${DARK}"/>`;
    b += `<rect x="${x}" y="${panel}" width="${w}" height="${h}" fill="${CARD_RED}"/></g>`;
    const words = c.name.toUpperCase().split(' ');
    const lines = words.length > 1 && c.name.length > 11 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [c.name.toUpperCase()];
    lines.forEach((l, i) => { b += text(l, x + 6, panel + 15 + i * 14, 14, '#fff', 'start', 'font-style="italic"'); });
    return `<g data-ongoing="${esc(c.id)}" style="cursor:zoom-in">${b}</g>`;
  }

  function upgradeCard(d: DashboardArt): string {
    if (!d.upgrade) return '';
    const cw = RECESS.w - 3, ch = Math.round(cw * 88 / 63), x = DASH_MID[d.size] - cw / 2;
    const off = d.status !== 'ok', head = off ? '#6d6b70' : d.color;
    const top = RECESS.y - CARD_PEEK; // hidden: only the name band sticks out of the recess
    const rise = ch - CARD_PEEK - CARD_TUCK; // raised: the whole card above the recess, its foot still tucked in
    const name = d.upgrade.name.toUpperCase();
    let b = `<rect x="${x}" y="${top}" width="${cw}" height="${ch}" rx="7" fill="${DARK}" stroke="${head}" stroke-width="2.5"/>`;
    b += `<rect x="${x + 4}" y="${top + 4}" width="${cw - 8}" height="${CARD_PEEK - 6}" rx="4" fill="${head}"/>`;
    b += text(name, x + cw / 2, top + CARD_PEEK - 7.5, Math.min(19, 250 / name.length), base.inkOn(head), 'middle');
    const lines = wrap(d.upgrade.text, 21);
    const textTop = top + ch - CARD_TUCK - 8 - lines.length * 14;
    // The space for the card's art, to come: between the name and the effect. Art and effect show only
    // when the card is raised (class upbody), so nothing of them peeks out under the board.
    const artY = top + CARD_PEEK + 4, artH = Math.max(10, textTop - top - CARD_PEEK - 18);
    b += `<g class="upbody"><rect x="${x + 6}" y="${artY}" width="${cw - 12}" height="${artH}" rx="4" fill="#3a3540"/>`;
    if (d.upgrade.art) {
      // The official illustration (the card's top part, above its torn edge), framed in the art window.
      const ac = `upart-${d.carId}`;
      b += `<clipPath id="${ac}"><rect x="${x + 6}" y="${artY}" width="${cw - 12}" height="${artH}" rx="4"/></clipPath>`
        + `<image href="${d.upgrade.art}" x="${x + 6}" y="${artY - (cw - 12) * 0.08}" width="${cw - 12}" height="${(cw - 12) * 88 / 63}" preserveAspectRatio="none" clip-path="url(#${ac})"/>`;
    }
    lines.forEach((l, i) => { b += prose(l, x + 8, textTop + i * 14, 11.5, CREAM); });
    if (off) b += text('INATTIVO: AUTO FUORI USO', x + cw / 2, textTop - 8, 11, '#ff8a7a', 'middle');
    b += '</g>';
    // Cut at the recess floor: whatever of the card is behind the board never shows through its lower notches.
    const clip = `upclip-${d.carId}`;
    return `<clipPath id="${clip}"><rect x="${x - 4}" y="${RECESS.y - 2 * ch}" width="${cw + 8}" height="${2 * ch + 3}"/></clipPath>`
      + `<g clip-path="url(#${clip})"><g class="upcard" style="--rise:${-rise}px" opacity="${off ? 0.7 : 1}"><title>${esc(`${d.upgrade.name}: ${d.upgrade.text}`)}</title>${b}</g></g>`;
  }

  return { dashboardSvg, commandBoardSvg, stripSvg, leaderHeadSvg, hasLeaderBoard: !!lead };
}
