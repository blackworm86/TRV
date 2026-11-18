// The Final Five's strip (BRaFF p7), from the project owner's drawing (assets/big_rig/plance/
// plancia_final_five.svg, sent on 2026-11-18; mock-up approved the same day): the command board on
// the left and the five motorcycle dashboards in a row, in the order of the markings. The drawing's
// yellow is the crew's colour. On the command board the three diamonds take the command die and the
// commands' icons sit in the three bands the drawing's guide lines mark (the names and effects come
// up on hover, as on the other boards); the drawer behind its top edge is the page's dice drawer
// (#cmddock, placed by dock.ts from data-drawer). On each dashboard the square takes the move die,
// the diamond the coast die, with the coasts used as pips beside it; a minor damage token lies on the
// motorcycle's body. Same drop zones and data attributes as the base boards (data-drop="move:<id>" /
// "coast:<id>" / "cmd:<id>", data-car, data-undo), so the interface handles them the same way.

import { commandIconAt, dieSvg, inkOn, type CommandBoardArt, type DashboardArt } from './art';
import { pathPoints } from './boards';

const RAW = Object.values(import.meta.glob<string>('/assets/big_rig/plance/plancia_final_five.svg', { eager: true, query: '?raw', import: 'default' }))[0] ?? '';
const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const DARK = '#26232B', METAL = '#ACA3A6', LINE = '#ACA3A6', HOT = '#4cff7a', CREAM = '#f3e9d2';

/** A dashboard of the strip: a motorcycle's, with its marking and its coasts per round. */
export interface BikeDashArt extends DashboardArt { marking: number; coastMax: number }

const esc = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const text = (s: string, x: number, y: number, size: number, fill: string, anchor = 'middle', extra = ''): string =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT} pointer-events="none" ${extra}>${esc(s)}</text>`;
const inner = (s: string): string => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const die = (x: number, y: number, s: number, value: number, color: string): string =>
  `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none">${inner(dieSvg({ kind: 'movement', value, color, number: true, ui: true }))}</g>`;

/** The minor damage token's drawing (assets/big_rig/segnalini/danno_minore.svg): its inner shapes and its size. */
const TOKEN_RAW = Object.values(import.meta.glob<string>('/assets/big_rig/segnalini/danno_minore.svg', { eager: true, query: '?raw', import: 'default' }))[0] ?? '';
const TOKEN_BODY = TOKEN_RAW.replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>|<\/svg>[\s\S]*$/g, '');
const TOKEN_SIZE = Number(/viewBox="0 0 ([\d.]+)/.exec(TOKEN_RAW)?.[1] ?? 93.1);

/** A minor damage token (BRaFF p3), `s` wide, centred on (cx, cy): the dark cross with the red warning light. */
export function minorTokenAt(cx: number, cy: number, s: number): string {
  const k = s / TOKEN_SIZE;
  return `<g transform="translate(${cx - s / 2} ${cy - s / 2}) scale(${k})" pointer-events="none">${TOKEN_BODY}</g>`;
}

/** A minor damage token on its own, as an SVG drawing. */
export function minorTokenSvg(extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-55 -55 110 110" ${extra}>${minorTokenAt(0, 0, 100)}</svg>`;
}

// ---------------------------------------------------------------- reading the drawing

/** One shape of the drawing: its tag, its class (the drawing's st0-st8) and its geometry attributes. */
interface Shape { tag: string; cls: string; attrs: string }
/** A box: left, top, right, bottom. */
type Box = [number, number, number, number];

/** The shapes of a piece of the drawing, in drawing order. */
function shapes(src: string): Shape[] {
  const out: Shape[] = [];
  for (const m of src.matchAll(/<(path|polygon|polyline|line|circle)\s+class="(st\d+)"([\s\S]*?)\/>/g)) {
    out.push({ tag: m[1], cls: m[2], attrs: m[3].replace(/\s+/g, ' ').trim() });
  }
  return out;
}
const attr = (s: Shape, name: string): string => new RegExp(`${name}="([^"]*)"`).exec(s.attrs)?.[1] ?? '';
/** The box of a shape (enough for paths, polygons, lines and circles). */
function boxOf(s: Shape): Box {
  let pts: [number, number][];
  if (s.tag === 'path') pts = pathPoints(attr(s, 'd'));
  else if (s.tag === 'polygon' || s.tag === 'polyline') {
    const n = attr(s, 'points').trim().split(/[\s,]+/).map(Number);
    pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  } else if (s.tag === 'line') pts = [[+attr(s, 'x1'), +attr(s, 'y1')], [+attr(s, 'x2'), +attr(s, 'y2')]];
  else { const cx = +attr(s, 'cx'), cy = +attr(s, 'cy'), r = +attr(s, 'r'); pts = [[cx - r, cy - r], [cx + r, cy + r]]; }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const midX = (b: Box): number => (b[0] + b[2]) / 2;
const midY = (b: Box): number => (b[1] + b[3]) / 2;
/** A shape again, with other paint. */
const draw = (s: Shape, paint: string): string => `<${s.tag} ${s.attrs} ${paint}/>`;

/** The command board and the five dashboards, read from the drawing once. */
interface Drawing {
  view: string; w: number; h: number;
  board: { body: Shape; color: Shape; plate: Shape; slots: Shape[]; pointers: Shape[]; guides: Shape[]; drawer: Box };
  /** The command bands: the box of each, top to bottom, where its icon goes. */
  bands: Box[];
  /** Left to right, in the order of the markings (data/trv/big_rig_final_five.json). */
  dashes: { body: Shape; color: Shape; move: Shape; coast: Shape; marks: Shape[]; cx: number }[];
}

/** Reads the drawing; null when it is missing or not shaped as expected. */
function read(raw: string): Drawing | null {
  const view = /viewBox="([^"]+)"/.exec(raw)?.[1];
  const groups = [...raw.matchAll(/<g>([\s\S]*?)<\/g>/g)].map(m => shapes(m[1]));
  // The markings are drawn after the groups, over the dashboards.
  const marks = shapes(raw.slice(raw.lastIndexOf('</g>')));
  if (!view || groups.length < 6) return null;
  const [, , w, h] = view.split(/\s+/).map(Number);
  const g0 = groups[0];
  const of = (cls: string, tag?: string): Shape[] => g0.filter(s => s.cls === cls && (!tag || s.tag === tag));
  const slots = of('st4').sort((a, b) => boxOf(a)[1] - boxOf(b)[1]);
  const guides = of('st5').sort((a, b) => boxOf(a)[1] - boxOf(b)[1]);
  const color = of('st2')[0], plate = of('st3')[0];
  if (!color || !plate || slots.length < 3 || guides.length < 2) return null;
  // The bands, as tall as the space between the two guide lines: above the first, between them, and
  // below the second down to the colour's inner edge at the board's foot (its notch over the plate).
  const gx0 = Math.min(...guides.map(s => boxOf(s)[0])), gx1 = Math.max(...guides.map(s => boxOf(s)[2]));
  const gy = guides.map(s => boxOf(s)[1]), step = gy[1] - gy[0];
  const notch = pathPoints(attr(color, 'd')).filter(p => p[0] > gx0 && p[0] < gx1 && p[1] > gy[1] && p[1] < boxOf(plate)[1]).map(p => p[1]);
  const floor = Math.min(gy[1] + step, ...notch);
  const bands: Box[] = [[gx0, gy[0] - step, gx1, gy[0]], [gx0, gy[0], gx1, gy[1]], [gx0, gy[1], gx1, floor]];
  const dashes = groups.slice(1).map(gs => {
    const pick = (cls: string): Shape => gs.find(s => s.cls === cls)!;
    const move = pick('st6');
    return { body: pick('st1'), color: pick('st2'), move, coast: pick('st7'), marks: [] as Shape[], cx: midX(boxOf(move)) };
  }).sort((a, b) => a.cx - b.cx);
  for (const m of marks) {
    const x = midX(boxOf(m));
    dashes.reduce((a, b) => (Math.abs(b.cx - x) < Math.abs(a.cx - x) ? b : a)).marks.push(m);
  }
  return {
    view, w, h, bands, dashes,
    board: { body: of('st1', 'path')[0], color, plate, slots, pointers: of('st1', 'polygon'), guides, drawer: boxOf(of('st0')[0]) },
  };
}

const DRAWING = read(RAW);

// ---------------------------------------------------------------- drawing the strip

/** The command board: the three commands top to bottom (Airstrike, Nitro, Repair), Undo on the plate. */
function commandBoard(d: Drawing, c: CommandBoardArt): string {
  const B = d.board, ink = inkOn(c.color);
  let b = draw(B.body, `fill="${DARK}"`) + draw(B.color, `fill="${c.color}"`);
  b += B.guides.map(s => draw(s, `fill="none" stroke="#141414" stroke-opacity=".35"`)).join('');
  b += B.pointers.map(s => draw(s, `fill="${DARK}"`)).join('');
  (c.commands ?? []).slice(0, 3).forEach((k, i) => {
    const slot = B.slots[i], sb = boxOf(slot), band = d.bands[i];
    const hot = !!c.drop?.includes(k.cmd), active = c.used?.cmd === k.cmd, token = !!c.tokenOn?.includes(k.cmd);
    const dim = !!c.used && !active && !token && !c.keepOpen;
    const tip = `data-drop="cmd:${k.cmd}" data-cmd-name="${esc(k.name)}" data-cmd-dice="${esc(k.slot)}" data-cmd-text="${esc(k.lines.join(' '))}"`;
    // The band takes the die too, and carries the name and the effect for the pop-up on hover.
    b += `<rect x="${band[0]}" y="${band[1]}" width="${band[2] - band[0]}" height="${band[3] - band[1]}" fill="${hot ? HOT : '#000'}" fill-opacity="${hot ? 0.25 : 0}" ${tip}/>`;
    // The icon, centred in its band, as big as the band allows with a margin.
    const size = Math.min(band[3] - band[1], band[2] - band[0]) * 0.86;
    const icon = commandIconAt(k.cmd, midX(band), midY(band), size, ink);
    b += icon ? `<g opacity="${dim ? 0.35 : 1}" pointer-events="none">${icon}</g>` : text(k.name, midX(band), midY(band) + 6, 16, ink, 'middle', `opacity="${dim ? 0.35 : 1}"`);
    b += draw(slot, `fill="${hot ? '#1f5a30' : DARK}" stroke="${hot ? HOT : LINE}" stroke-width="${hot ? 3 : 1}" stroke-linejoin="round" ${tip}`);
    const sx = midX(sb), sy = midY(sb), r = (sb[2] - sb[0]) / 2;
    if (active) b += die(sx, sy, r * 1.25, c.used!.value, c.color);
    else b += text(k.slot, sx, sy + 5, 15, CREAM, 'middle', `opacity="${dim ? 0.4 : 1}"`);
  });
  // Undo, on the plate at the board's foot (mock-up approved 2026-11-18).
  const pb = boxOf(B.plate);
  if (c.undo) {
    b += `<g class="undoplate${c.undo === 'off' ? ' off' : ''}" data-undo="1"><title>Annulla l’ultima scelta (Ctrl+Z)</title>${draw(B.plate, `fill="${METAL}"`)}`
      + text('ANNULLA', midX(pb), pb[3] - 4, 12, DARK, 'middle', 'font-style="italic"') + '</g>';
  } else b += draw(B.plate, `fill="${METAL}"`) + text('COMANDI', midX(pb), pb[3] - 4, 12, DARK, 'middle', 'font-style="italic"');
  return b;
}

/** One motorcycle dashboard: slots, dice, coasts, the minor damage token and its state. */
function dashboard(d: Drawing['dashes'][number], a: BikeDashArt): string {
  const dead = a.status !== 'ok', wing = dead ? '#8a8590' : a.color, ink = inkOn(wing);
  const cx = d.cx, mb = boxOf(d.move), kb = boxOf(d.coast);
  let b = draw(d.body, `fill="${DARK}" stroke="${a.pick ? HOT : 'none'}" stroke-width="${a.pick ? 5 : 0}"`) + draw(d.color, `fill="${wing}"`);
  // The marking, as on the motorcycle (BRaFF p7), in the ink that reads on the crew's colour.
  b += d.marks.map(m => draw(m, `fill="none" stroke="${ink}" stroke-width="4" stroke-miterlimit="10"`)).join('');
  if (a.status !== 'elim') {
    const move = a.placed.find(p => !p.coast), coasts = a.placed.filter(p => p.coast);
    b += draw(d.move, `fill="${a.dropMove ? '#1f5a30' : DARK}" stroke="${a.dropMove ? HOT : LINE}" stroke-width="${a.dropMove ? 3 : 1}" stroke-dasharray="${move || a.dropMove ? '0' : '3,3'}"${dead ? '' : ` data-drop="move:${a.carId}"`}`);
    if (move) b += die(cx, midY(mb), (mb[2] - mb[0]) * 0.9, move.value, a.color);
    else if (!dead) b += text('DADO', cx, midY(mb) + 5, 13, '#CAC8C3');
    b += draw(d.coast, `fill="${a.dropCoast ? '#1f5a30' : DARK}" stroke="${a.dropCoast ? HOT : LINE}" stroke-width="${a.dropCoast ? 3 : 1}" stroke-linejoin="round" stroke-dasharray="${coasts.length || a.dropCoast ? '0' : '3,3'}"${dead ? '' : ` data-drop="coast:${a.carId}"`}`);
    if (coasts.length) b += die(cx, midY(kb), (kb[2] - kb[0]) * 0.5, coasts[coasts.length - 1].value, a.color);
    else if (!dead) b += text('+1', cx, midY(kb) + 5, 14, '#CAC8C3');
    // The coasts used this round, as pips in the body beside the diamond.
    for (let i = 0; i < a.coastMax; i++) {
      const y = kb[1] + 9 + i * ((kb[3] - kb[1] - 18) / Math.max(1, a.coastMax - 1));
      b += `<circle cx="${kb[2] + 7}" cy="${y.toFixed(1)}" r="3.4" fill="${i < coasts.length ? CREAM : 'none'}" stroke="${CREAM}" stroke-width="1" pointer-events="none"/>`;
    }
    // The minor damage token, on the body between the two slots.
    if (a.damage > 0) b += minorTokenAt(cx, (mb[3] + kb[1]) / 2, Math.min(46, kb[1] - mb[3] - 6));
    if (a.label) b += text(a.label, cx, mb[3] + 16, 11, CREAM, 'middle', 'opacity=".85"');
  }
  // Inoperable: FUORI USO across the move slot (BRaFF p7: the dashboard is turned over).
  if (a.status === 'inop') b += `<g transform="translate(${cx} ${midY(mb)}) rotate(-8)" pointer-events="none"><rect x="-62" y="-15" width="124" height="30" rx="4" fill="#d42f30" stroke="#1d1b20" stroke-width="2"/>${text('FUORI USO', 0, 9, 22, CREAM)}</g>`;
  if (a.status === 'elim') b = `<g opacity=".45">${b}</g><g transform="translate(${cx} ${midY(kb) - 70}) rotate(-8)">${text('ELIMINATA', 0, 10, 30, '#ff5a4a')}</g>`;
  return `<g data-car="${a.carId}">${b}</g>`;
}

/**
 * The Final Five's strip: the command board, then the five dashboards in the order of the markings.
 * `data-strip="2"` and `data-drawer` (the board's top edge, the drawer's middle and width) tell
 * dock.ts where the dice drawer comes out, as on the base strip.
 */
export function ffStripSvg(c: CommandBoardArt, dashes: BikeDashArt[], extra = ''): string {
  const d = DRAWING;
  if (!d) return '';
  const B = d.board;
  // The board's top edge: the drawer shows 20 units above it, as drawn (and as on the base strip).
  const edge = B.drawer[1] + 20;
  const body = commandBoard(d, c) + dashes.map(a => (d.dashes[a.marking] ? dashboard(d.dashes[a.marking], a) : '')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.view}" style="aspect-ratio:${d.w}/${d.h}" data-strip="2"`
    + ` data-drawer="${edge.toFixed(1)},${midX(B.drawer).toFixed(2)},${(B.drawer[2] - B.drawer[0]).toFixed(1)}" ${extra}>${body}</svg>`;
}
