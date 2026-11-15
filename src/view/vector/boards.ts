// The command board and the three car dashboards drawn from the project owner's own vector drawing
// (one SVG with all four boards side by side: outlines and lines only, layers "background",
// "foreground", "lines"). This module splits the drawing into its boards, colours them for a crew,
// and adds what the drawing leaves out: the writing, the dice slots' behaviour, the damage tokens.
// art.ts uses it when the drawing is present.

import type { DashboardArt, CommandBoardArt, ArtSize } from './art';

/** What this module needs from art.ts (passed in, so the two files do not import each other). */
export interface BoardBase {
  dieSvg(f: { kind: string; value: number | string; color?: string }, extra?: string): string;
  damageTokenSvg(type: string | null, faceUp: boolean): string;
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
/** The command board's coloured panel: left, top, right, bottom. */
const PANEL = [42.5, 42.5, 248.4, 217.8];

const num = (attrs: string, name: string): number => Number(new RegExp(`\\b${name}="([-\\d.]+)"`).exec(attrs)?.[1] ?? NaN);
const inner = (s: string): string => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

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
export function makeBoards(raw: string, base: BoardBase): {
  dashboardSvg(d: DashboardArt, extra?: string): string;
  commandBoardSvg(c: CommandBoardArt, extra?: string): string;
} {
  const all = parse(raw);
  const of = (id: BoardId): El[] => all.filter(e => boardOf(e.x) === id);
  const svg = (box: string, body: string, extra: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" ${extra}>${body}</svg>`;
  const text = (s: string, x: number, y: number, size: number, fill: string, anchor = 'start', extra = ''): string =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${base.font} pointer-events="none" ${extra}>${esc(s)}</text>`;
  const die = (x: number, y: number, s: number, value: number, color: string): string =>
    `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none" data-die3d="movement|${value}|${color}">${inner(base.dieSvg({ kind: 'movement', value, color }))}</g>`;
  const diamond = (x: number, y: number, r: number): string => `M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y}Z`;

  /** A car dashboard: the board, its writing, the dice on it and the damage tokens hanging below. */
  function dashboardSvg(d: DashboardArt, extra = ''): string {
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

    let b = '';
    // Damage tokens first, so the board covers their top edge.
    const token = base.damageTokenSvg(null, false);
    const vb = (/viewBox="([^"]+)"/.exec(token)?.[1] ?? '0 0 100 100').split(/\s+/).map(Number);
    for (let i = 0; i < d.damage; i++) {
      const k = 46 / vb[2];
      b += `<g transform="translate(${x0 + 86 + i * 54} ${DASH_Y[1] - vb[3] * k - 2}) scale(${k})">${inner(token)}</g>`;
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
      // Coast slot (+1).
      b += `<path d="${diamond(cx, cy, cr)}" fill="${d.dropCoast ? '#1f5a30' : DARK}" stroke="${d.dropCoast ? HOT : LINE}" stroke-width="${d.dropCoast ? 3 : 1}" stroke-dasharray="${coasts.length || d.dropCoast ? '0' : '3 3'}" stroke-linejoin="round" data-drop="coast:${d.carId}"/>`;
      if (coasts.length) b += die(cx, cy, cr * 0.95, coasts[coasts.length - 1].value, d.color);
      else b += text('+1', cx, cy + 5, 15, CREAM, 'middle');
      b += text('INERZIA', cx, cy + cr + 17, 13, CREAM, 'middle', 'opacity=".85"');
      for (let i = 0; i < 2; i++) b += `<circle cx="${cx - 6 + i * 12}" cy="${cy + cr + 27}" r="3.4" fill="${i < coasts.length ? CREAM : 'none'}" stroke="${CREAM}" stroke-width="1"/>`;
    }
    if (d.damage) b += text(`DANNI ${d.damage}`, x0 + 26, 186, 13, '#ff9b8a');
    if (dead) b += shape(bg, crew, 'fill="#000" opacity=".5"');
    if (d.status === 'inop') {
      b += `<g transform="translate(${(x0 + x1) / 2} 132) rotate(-7)"><rect x="-74" y="-17" width="148" height="34" rx="4" fill="#d42f30" stroke="#1d1b20" stroke-width="2"/>${text('FUORI USO', 0, 11, 30, CREAM, 'middle')}</g>`;
    }
    if (d.status === 'elim') b += `<g transform="translate(${(x0 + x1) / 2} 132) rotate(-7)">${text('ELIMINATA', 0, 12, 36, '#ff5a4a', 'middle')}</g>`;
    const w = x1 - x0, h = DASH_Y[1] - DASH_Y[0];
    return svg(`${x0} ${DASH_Y[0]} ${w} ${h}`, b, `data-car="${d.carId}" style="aspect-ratio:${w}/${h}" ${extra}`);
  }

  /** The command board: four commands with what they do, a die slot in each corner. */
  function commandBoardSvg(c: CommandBoardArt, extra = ''): string {
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
    for (const k of COMMANDS) {
      const slot = corner.find(e => (num(e.attrs, 'x') < midX) === k.left && (num(e.attrs, 'y') < midY) === k.top)!;
      const sx = num(slot.attrs, 'x') + num(slot.attrs, 'width') / 2, sy = num(slot.attrs, 'y') + num(slot.attrs, 'height') / 2;
      const r = num(slot.attrs, 'width') / Math.SQRT2;
      const hot = !!c.drop?.includes(k.cmd), active = c.used?.cmd === k.cmd, dim = !!c.used && !active;
      // The whole quarter takes the die, not only the diamond.
      const qx = k.left ? PANEL[0] : midX, qy = k.top ? PANEL[1] : midY;
      b += `<rect x="${qx}" y="${qy}" width="${k.left ? midX - PANEL[0] : PANEL[2] - midX}" height="${k.top ? midY - PANEL[1] : PANEL[3] - midY}" fill="${hot ? HOT : '#000'}" fill-opacity="${hot ? 0.25 : 0}" data-drop="cmd:${k.cmd}"><title>${esc(`${k.name} (${k.dice}): ${k.lines.join(' ')}`)}</title></rect>`;
      const tx = k.left ? midX - 7 : midX + 7, anchor = k.left ? 'end' : 'start';
      const y0 = k.top ? 70 : 153;
      b += `<g opacity="${dim ? 0.35 : 1}">${text(k.name, tx, y0, k.name.length > 8 ? 15.5 : 23, ink, anchor)}`
        + k.lines.map((l, i) => text(l, tx, y0 + 17 + i * 14.5, 13.5, ink, anchor)).join('') + '</g>';
      b += `<path d="${diamond(sx, sy, r)}" fill="${hot ? '#1f5a30' : DARK}" stroke="${hot ? HOT : LINE}" stroke-width="${hot ? 3 : 1}" stroke-linejoin="round" data-drop="cmd:${k.cmd}"/>`;
      if (active) b += die(sx, sy, r * 0.95, c.used!.value, c.color);
      else b += text(k.slot, sx, sy + 5.5, 16, CREAM, 'middle', `opacity="${dim ? 0.35 : 1}"`);
    }
    b += text('COMANDI', (SPAN.cmd[0] + SPAN.cmd[1]) / 2, 250.6, 12, DARK, 'middle');
    return svg(`0 0 ${SPAN.cmd[1]} ${CMD_H}`, b, `style="aspect-ratio:${SPAN.cmd[1]}/${CMD_H}" ${extra}`);
  }

  return { dashboardSvg, commandBoardSvg };
}
