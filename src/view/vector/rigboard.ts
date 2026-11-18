// The Big Rig's strip (BRaFF p4-6), from the project owner's drawing (assets/big_rig/plance/
// plancia_big_rig.svg, sent on 2026-11-18): the three sections left to right as the rules show
// them (rear trailer, middle trailer, cab), then the steering board. The drawing's red is the
// crew's colour. In each section the two guide lines split the board in three columns, one per
// command: the crosses mark the two systems an opponent can aim at (their icon sits on the cross,
// a minor damage token covers it), drawn in the crew's colour a little darker, as slots (asked by
// the user, 2026-11-18); the middle column is the Repair; the dashed squares under
// the columns take the dice. On the steering board the diamond takes the Hydraulic Steering die, the
// six places of the damage track sit above its icon and Undo is the plate at its foot; the drawer
// behind its top edge is the page's dice drawer (#cmddock, placed by dock.ts from data-drawer).
// The command names and effects come up on hover (data-cmd-*), as on the other boards. Drop zones:
// data-drop="rig:<section>:<command>" and "steer"; a system to pick for a minor damage carries
// data-pick and has its slot shaded deeper, with a white outline.

import { commandIconAt, dieSvg, inkOn } from './art';
import { boxOf, draw, midX, midY, minorTokenAt, shapes, undoPlate, type Box, type Shape } from './ffboards';

const RAW = Object.values(import.meta.glob<string>('/assets/big_rig/plance/plancia_big_rig.svg', { eager: true, query: '?raw', import: 'default' }))[0] ?? '';
const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const DARK = '#26232B', METAL = '#ACA3A6', LINE = '#ACA3A6', HOT = '#4cff7a', CREAM = '#f3e9d2';

/** `hex` darkened by `k` (0 none, 1 black): the slots a minor damage token can cover. */
function darker(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - k)));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** One command of a section, as the board shows it. */
export interface RigCommandArt {
  /** `section:command`, the drop zone's name. */
  key: string;
  /** The command's id (its icon). */ cmd: string;
  name: string; slot: string; lines: string[];
  /** A die can go here now. */ hot: boolean;
  /** The die on it this round. */ die?: number;
  /** Covered by a minor damage token. */ damaged: boolean;
  /** One of the systems to choose from for a minor damage (lit in red). */ pick?: boolean;
}
/** The Big Rig's board: its colour, the three sections (rear first), the steering, the damage count and Undo. */
export interface RigBoardArt {
  color: string;
  sections: { sec: string; name: string; used: boolean; commands: RigCommandArt[] }[];
  /** The Hydraulic Steering: the die on it (the lane changes left), and its name and effect for the pop-up. */
  steer: { die: number | null; hot: boolean; name: string; text: string };
  damage: number; max: number;
  undo?: 'on' | 'off';
}

const esc = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const text = (s: string, x: number, y: number, size: number, fill: string, anchor = 'middle', extra = ''): string =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT} pointer-events="none" ${extra}>${esc(s)}</text>`;
const inner = (s: string): string => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const die = (x: number, y: number, s: number, value: number, color: string): string =>
  `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none">${inner(dieSvg({ kind: 'movement', value, color, number: true, ui: true }))}</g>`;
const rect = (b: Box, paint: string): string => `<rect x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}" ${paint}/>`;
const area = (b: Box): number => (b[2] - b[0]) * (b[3] - b[1]);

// ---------------------------------------------------------------- reading the drawing

/** A section of the drawing: its board and the three columns, left to right. */
interface SectionDrawing {
  body: Shape; color: Shape; plate: Shape; guides: Shape[]; pointers: Shape[];
  /** The three columns (between the colour's edges and the guide lines). */ cols: Box[];
  /** The red crosses of the first and third column. */ crosses: Shape[];
  /** The dice squares, one per column. */ squares: Shape[];
}
interface Drawing {
  view: string; w: number; h: number;
  sections: SectionDrawing[];
  steer: { body: Shape; color: Shape; slot: Shape; plate: Shape; drawer: Box; band: Box; track: Box };
}

/** Reads the drawing; null when it is missing or not shaped as expected. */
function read(raw: string): Drawing | null {
  const view = /viewBox="([^"]+)"/.exec(raw)?.[1];
  if (!view) return null;
  const [, , w, h] = view.split(/\s+/).map(Number);
  const all = shapes(raw).map(s => ({ s, b: boxOf(s) }));
  // The four boards (rear, mid, cab, steering): the tall dark bodies, left to right.
  const bodies = all.filter(x => x.s.cls === 'st2' && x.b[3] - x.b[1] > 200).sort((a, b) => midX(a.b) - midX(b.b));
  if (bodies.length !== 4) return null;
  // Every other shape belongs to the board whose middle is nearest.
  const groups = bodies.map(() => [] as { s: Shape; b: Box }[]);
  for (const x of all) {
    const near = bodies.reduce((best, y, i) => (Math.abs(midX(y.b) - midX(x.b)) < Math.abs(midX(bodies[best].b) - midX(x.b)) ? i : best), 0);
    groups[near].push(x);
  }
  const byX = (a: { b: Box }, b: { b: Box }): number => midX(a.b) - midX(b.b);
  const of = (g: { s: Shape; b: Box }[], cls: string): { s: Shape; b: Box }[] => g.filter(x => x.s.cls === cls).sort(byX);
  const sections: SectionDrawing[] = [];
  for (const g of groups.slice(0, 3)) {
    const color = of(g, 'st6')[0], plate = of(g, 'st5')[0], guides = of(g, 'st0'), crosses = of(g, 'st1'), squares = of(g, 'st3');
    if (!color || !plate || guides.length !== 2 || crosses.length !== 2 || squares.length !== 3) return null;
    const cb = color.b, top = guides[0].b[1], bottom = guides[0].b[3];
    const gx = guides.map(x => x.b[0]);
    sections.push({
      body: of(g, 'st2').reduce((a, b) => (area(b.b) > area(a.b) ? b : a)).s, color: color.s, plate: plate.s,
      guides: guides.map(x => x.s), pointers: of(g, 'st2').filter(x => area(x.b) < 400).map(x => x.s),
      cols: [[cb[0], top, gx[0], bottom], [gx[0], top, gx[1], bottom], [gx[1], top, cb[2], bottom]],
      crosses: crosses.map(x => x.s), squares: squares.map(x => x.s),
    });
  }
  const sg = groups[3];
  const color = of(sg, 'st6')[0], slot = of(sg, 'st4')[0], plate = of(sg, 'st5')[0], drawer = of(sg, 'st7')[0];
  if (!color || !slot || !plate || !drawer) return null;
  const cb = color.b, dx = drawer.b;
  // The colour band between the dark notch above and the dark foot below, as drawn: the notch's
  // diagonals run 40 units down from the colour's top, the foot's 35 units up from its bottom.
  const band: Box = [cb[0] + 57, cb[1] + 40.24, cb[2] - 51.5, cb[3] - 35];
  // The dark space above the band, under the drawer's opening: the damage track.
  const track: Box = [dx[0] + 8, bodies[3].b[1] + 14, dx[2] - 8, cb[1] + 34];
  return { view, w, h, sections, steer: { body: bodies[3].s, color: color.s, slot: slot.s, plate: plate.s, drawer: dx, band, track } };
}

const DRAWING = read(RAW);

// ---------------------------------------------------------------- drawing the strip

/** One section: its board, the commands' columns with their icons, dice and minor damage tokens. */
function section(d: SectionDrawing, a: RigBoardArt, s: RigBoardArt['sections'][number]): string {
  const ink = inkOn(a.color);
  let b = draw(d.body, `fill="${DARK}"`) + draw(d.color, `fill="${a.color}"`);
  b += d.guides.map(x => draw(x, `fill="none" stroke="#141414" stroke-opacity=".35"`)).join('');
  b += d.pointers.map(x => draw(x, `fill="${DARK}"`)).join('');
  const pb = boxOf(d.plate);
  b += draw(d.plate, `fill="${METAL}"`) + text(s.name.toUpperCase(), midX(pb), pb[1] + 19, 17, DARK, 'middle', 'font-style="italic"');
  const cr = boxOf(d.crosses[0]), crossY = midY(cr), crossW = cr[2] - cr[0];
  s.commands.slice(0, 3).forEach((c, i) => {
    const col = d.cols[i], sq = d.squares[i], sb = boxOf(sq);
    const cross = i === 0 ? d.crosses[0] : i === 2 ? d.crosses[1] : null;
    const cx = cross ? midX(boxOf(cross)) : midX(col);
    const dim = s.used && c.die === undefined && !c.pick;
    const tip = `data-drop="rig:${c.key}" data-cmd-name="${esc(c.name)}" data-cmd-dice="${esc(c.slot)}" data-cmd-text="${esc(c.lines.join(' '))}"${c.pick ? ` data-pick="${c.key}"` : ''}`;
    // The column takes the die too, and carries the name and the effect for the pop-up on hover.
    b += rect([col[0] + 2, col[1], col[2] - 2, col[3]], `fill="${c.hot ? HOT : '#000'}" fill-opacity="${c.hot ? 0.25 : 0}" ${tip}`);
    // A system to choose for a minor damage: its slot shaded deeper and outlined. The Repair has no
    // cross drawn: its slot is the same cross shape, shown only while it can be chosen.
    const slot = cross ?? (c.pick ? d.crosses[0] : null);
    const dx = cross ? 0 : cx - midX(boxOf(d.crosses[0]));
    if (slot) {
      b += `<g transform="translate(${dx} 0)" pointer-events="none">${draw(slot, c.pick
        ? `fill="${darker(a.color, 0.32)}" stroke="${CREAM}" stroke-width="3" stroke-dasharray="6 4"`
        : `fill="${darker(a.color, 0.14)}"`)}</g>`;
    }
    const icon = commandIconAt(c.cmd, cx, crossY, crossW * (cross ? 0.6 : 0.78), ink);
    b += `<g opacity="${dim ? 0.35 : 1}" pointer-events="none">${icon || text(c.name, cx, crossY + 6, 15, ink)}</g>`;
    // A minor damage token covers the system: it only moves the rig (BRaFF p5).
    if (c.damaged) b += minorTokenAt(cx, crossY, crossW);
    b += draw(sq, `fill="${c.hot ? '#1f5a30' : DARK}" stroke="${c.hot ? HOT : LINE}" stroke-width="${c.hot ? 3 : 1}" stroke-dasharray="${c.die !== undefined || c.hot ? '0' : '3 3'}" ${tip}`);
    if (c.die !== undefined) b += die(midX(sb), midY(sb), (sb[2] - sb[0]) * 0.92, c.die, a.color);
    else b += text(c.slot, midX(sb), midY(sb) + 5, 15, CREAM, 'middle', `opacity="${dim ? 0.4 : 1}"`);
  });
  return b;
}

/** The steering board: the Hydraulic Steering die and icon, the damage track and Undo. */
function steering(d: Drawing['steer'], a: RigBoardArt): string {
  const ink = inkOn(a.color);
  let b = draw(d.body, `fill="${DARK}"`) + draw(d.color, `fill="${a.color}"`);
  const tip = `data-drop="steer" data-cmd-name="${esc(a.steer.name)}" data-cmd-dice="1-3" data-cmd-text="${esc(a.steer.text)}"`;
  b += rect(d.band, `fill="${a.steer.hot ? HOT : '#000'}" fill-opacity="${a.steer.hot ? 0.25 : 0}" ${tip}`);
  b += `<g pointer-events="none">${commandIconAt('hydraulic_steering', midX(d.band), midY(d.band), (d.band[3] - d.band[1]) * 0.86, ink)}</g>`;
  const sb = boxOf(d.slot), r = (sb[2] - sb[0]) / 2;
  b += draw(d.slot, `fill="${a.steer.hot ? '#1f5a30' : DARK}" stroke="${a.steer.hot ? HOT : LINE}" stroke-width="${a.steer.hot ? 3 : 1}" ${tip}`);
  b += a.steer.die !== null ? die(midX(sb), midY(sb), r * 1.25, a.steer.die, a.color) : text('1-3', midX(sb), midY(sb) + 5, 15, CREAM);
  // Six minor damage tokens put the Big Rig out (BRaFF p5): one place for each, filled as they come.
  const t = d.track, step = (t[2] - t[0]) / a.max, ty = midY(t) + 7;
  b += text('DANNI', midX(t), t[1] + 8, 13, CREAM, 'middle', 'opacity=".8"');
  for (let i = 0; i < a.max; i++) {
    const cx = t[0] + step * (i + 0.5);
    b += i < a.damage ? minorTokenAt(cx, ty, step * 0.98)
      : `<circle cx="${cx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${(step * 0.34).toFixed(1)}" fill="#000" fill-opacity=".25" stroke="${CREAM}" stroke-opacity=".5" stroke-dasharray="3 3"/>`;
  }
  // Undo, on the plate at the board's foot (as on the Final Five's board).
  b += undoPlate(d.plate, a.undo, 'STERZO');
  return b;
}

/**
 * The Big Rig's strip: rear trailer, middle trailer and cab, then the steering board.
 * `data-strip="2"` and `data-drawer` (the board's top edge, the drawer's middle and width) tell
 * dock.ts where the dice drawer comes out, as on the other strips. '' without the drawing.
 */
export function rigStripSvg(a: RigBoardArt, extra = ''): string {
  const d = DRAWING;
  if (!d) return '';
  const body = d.sections.map((s, i) => (a.sections[i] ? section(s, a, a.sections[i]) : '')).join('') + steering(d.steer, a);
  const dr = d.steer.drawer;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.view}" style="aspect-ratio:${d.w}/${d.h}" data-strip="2"`
    + ` data-drawer="${(dr[1] + 20).toFixed(1)},${midX(dr).toFixed(2)},${(dr[2] - dr[0]).toFixed(1)}" ${extra}>${body}</svg>`;
}
