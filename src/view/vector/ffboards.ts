// Stand-in boards of the Final Five (BRaFF p7) until the project owner draws them (they will look
// like the base game's): the command board with its three commands and the five motorcycle
// dashboards in a row, each with its marking, move and coast slots, the coasts used (four at most)
// and the minor damage token that makes the motorcycle inoperable. Same drop zones and data
// attributes as the base boards (data-drop="move:<id>" / "coast:<id>" / "cmd:<id>", data-car), so the
// interface handles them the same way.

import { dieSvg, inkOn, type CommandBoardArt, type DashboardArt } from './art';
import { markingSvg } from './markings';

/** The strip's box: the size of the base game's strip, so it takes the same place on screen. */
export const FF_STRIP = { w: 1197, h: 292 };
const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const DARK = '#1b1f27', LINE = '#e8e0cf', HOT = '#4cff7a', CREAM = '#f3e9d2';

/** A dashboard of the strip: a motorcycle's, with its marking and its four coasts. */
export interface BikeDashArt extends DashboardArt { marking: number; coastMax: number }

const esc = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const text = (s: string, x: number, y: number, size: number, fill: string, anchor = 'middle', extra = ''): string =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT} pointer-events="none" ${extra}>${esc(s)}</text>`;
const inner = (s: string): string => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const die = (x: number, y: number, s: number, value: number, color: string): string =>
  `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none">${inner(dieSvg({ kind: 'movement', value, color, number: true, ui: true }))}</g>`;
const diamond = (x: number, y: number, r: number): string => `M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y}Z`;

/** A minor damage token (BRaFF p3): a dark four-pointed plate with the red warning sign. */
export function minorTokenAt(cx: number, cy: number, s: number): string {
  const k = s / 100;
  return `<g transform="translate(${cx} ${cy}) scale(${k})" pointer-events="none">`
    + '<path d="M-18 -50 H18 L26 -26 L50 -18 V18 L26 26 L18 50 H-18 L-26 26 L-50 18 V-18 L-26 -26Z" fill="#1d2433" stroke="#0b0d12" stroke-width="5"/>'
    + '<circle r="19" fill="none" stroke="#e0402f" stroke-width="7"/><rect x="-3.5" y="-12" width="7" height="15" fill="#e0402f"/><circle cy="9" r="3.8" fill="#e0402f"/></g>';
}

/** A minor damage token on its own, as an SVG drawing. */
export function minorTokenSvg(extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-55 -55 110 110" ${extra}>${minorTokenAt(0, 0, 100)}</svg>`;
}

/** The command board: Airstrike, Nitro and Repair, one under the other, each a drop zone. */
function commandBoard(c: CommandBoardArt): string {
  const ink = inkOn(c.color);
  const rows = c.commands ?? [];
  let b = `<path d="M18 8 H244 L258 22 V270 L244 284 H18 L4 270 V22Z" fill="${DARK}"/>`;
  b += `<path d="M24 16 H238 L250 28 V264 L238 276 H24 L12 264 V28Z" fill="${c.color}"/>`;
  b += text('MOTO', 131, 46, 30, ink);
  rows.forEach((k, i) => {
    const y = 60 + i * 70, hot = !!c.drop?.includes(k.cmd), active = c.used?.cmd === k.cmd;
    const dim = !!c.used && !active;
    b += `<rect x="20" y="${y}" width="222" height="64" rx="6" fill="${hot ? HOT : '#000'}" fill-opacity="${hot ? 0.25 : 0.12}" data-drop="cmd:${k.cmd}"`
      + ` data-cmd-name="${esc(k.name)}" data-cmd-dice="${esc(k.slot)}" data-cmd-text="${esc(k.lines.join(' '))}"/>`;
    const sx = 52, sy = y + 32, r = 25;
    b += `<path d="${diamond(sx, sy, r)}" fill="${hot ? '#1f5a30' : DARK}" stroke="${hot ? HOT : LINE}" stroke-width="${hot ? 3 : 1}" data-drop="cmd:${k.cmd}"/>`;
    b += active ? die(sx, sy, r * 1.3, c.used!.value, c.color) : text(k.slot, sx, sy + 6, 16, CREAM, 'middle', `opacity="${dim ? 0.4 : 1}"`);
    b += `<g opacity="${dim ? 0.4 : 1}">${text(k.name, 90, y + 27, 22, ink, 'start')}`
      + k.lines.slice(0, 2).map((l, j) => text(l, 90, y + 43 + j * 13, 12.5, ink, 'start')).join('') + '</g>';
  });
  return b;
}

/** One motorcycle dashboard at `x`, `w` wide. */
function dashboard(d: BikeDashArt, x: number, w: number): string {
  const dead = d.status !== 'ok', crew = dead ? '#6d6b70' : d.color, ink = inkOn(crew);
  const mid = x + w / 2;
  let b = '';
  // The minor damage token hangs under the dashboard (one slot); an empty slot is a faint outline.
  if (d.damage > 0) b += minorTokenAt(mid, 238, 52);
  else if (d.status !== 'elim') b += `<circle cx="${mid}" cy="238" r="22" fill="#000" fill-opacity=".18" stroke="${LINE}" stroke-opacity=".3" stroke-dasharray="4 4"/>`;
  b += `<path d="M${x + 10} 14 H${x + w - 10} L${x + w} 26 V196 L${x + w - 10} 208 H${x + 10} L${x} 196 V26Z" fill="${DARK}" stroke="${d.pick ? HOT : 'rgba(0,0,0,.6)'}" stroke-width="${d.pick ? 5 : 2}"/>`;
  b += `<path d="M${x + 10} 14 H${x + w - 10} L${x + w} 26 V70 H${x} V26Z" fill="${crew}"/>`;
  // The marking, as on the motorcycle (BRaFF p7), and where the motorcycle is.
  b += `<g transform="translate(${mid - 24} 18)">${markingSvg(d.marking, 48, ink === '#000' || ink === '#111' ? '#15171c' : CREAM)}</g>`;
  if (d.label) b += text(d.label, mid, 84, 11, CREAM, 'middle', 'opacity=".8"');
  if (!dead) {
    const move = d.placed.find(p => !p.coast), coasts = d.placed.filter(p => p.coast);
    const as = 52, ax = mid - as / 2, ay = 92;
    b += `<rect x="${ax}" y="${ay}" width="${as}" height="${as}" rx="5" fill="${d.dropMove ? '#1f5a30' : '#0e1015'}" stroke="${d.dropMove ? HOT : LINE}" stroke-width="${d.dropMove ? 3 : 1}" stroke-dasharray="${move || d.dropMove ? '0' : '3 3'}" data-drop="move:${d.carId}"/>`;
    b += move ? die(mid, ay + as / 2, as * 0.86, move.value, d.color) : text('DADO', mid, ay + as / 2 + 5, 13, CREAM);
    const cy = 176, cr = 18;
    b += `<path d="${diamond(mid, cy, cr)}" fill="${d.dropCoast ? '#1f5a30' : '#0e1015'}" stroke="${d.dropCoast ? HOT : LINE}" stroke-width="${d.dropCoast ? 3 : 1}" stroke-dasharray="${coasts.length || d.dropCoast ? '0' : '3 3'}" data-drop="coast:${d.carId}"/>`;
    b += coasts.length ? die(mid, cy, cr * 1.3, coasts[coasts.length - 1].value, d.color) : text('+1', mid, cy + 5, 14, CREAM);
    for (let i = 0; i < d.coastMax; i++) b += `<circle cx="${mid + 30 + (i % 2) * 10}" cy="${cy - 6 + Math.floor(i / 2) * 11}" r="3.4" fill="${i < coasts.length ? CREAM : 'none'}" stroke="${CREAM}" stroke-width="1"/>`;
  }
  if (dead) b += `<path d="M${x + 10} 14 H${x + w - 10} L${x + w} 26 V196 L${x + w - 10} 208 H${x + 10} L${x} 196 V26Z" fill="#000" opacity=".5"/>`;
  // Inoperable: the dashboard is turned over (BRaFF p7).
  if (d.status === 'inop') b += `<g transform="translate(${mid} 130) rotate(-8)"><rect x="-62" y="-15" width="124" height="30" rx="4" fill="#d42f30" stroke="#1d1b20" stroke-width="2"/>${text('FUORI USO', 0, 9, 24, CREAM)}</g>`;
  if (d.status === 'elim') b += `<g transform="translate(${mid} 130) rotate(-8)">${text('ELIMINATA', 0, 10, 28, '#ff5a4a')}</g>`;
  return `<g data-car="${d.carId}">${b}</g>`;
}

/** The Final Five's strip: command board on the left, the five dashboards in a row. */
export function ffStripSvg(c: CommandBoardArt, dashes: BikeDashArt[], extra = ''): string {
  const w = 176, gap = 9, x0 = 276;
  const body = commandBoard(c) + dashes.map((d, i) => dashboard(d, x0 + i * (w + gap), w)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FF_STRIP.w} ${FF_STRIP.h}" style="aspect-ratio:${FF_STRIP.w}/${FF_STRIP.h}" ${extra}>${body}</svg>`;
}
