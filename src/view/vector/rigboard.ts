// Stand-in board of the Big Rig (BRaFF p4-6) until the project owner draws it: the three sections
// side by side as the rules show them (rear, mid, front), each with its three commands, the die on a
// command, the minor damage tokens on the commands they cover, and the Hydraulic Steering slot on the
// front cab. Drop zones like the base boards: data-drop="rig:<section>:<command>" and "steer".

import { dieSvg, inkOn } from './art';
import { minorTokenAt } from './ffboards';

/** The strip's box: the size of the base game's strip, so it takes the same place on screen. */
export const RIG_STRIP = { w: 1197, h: 292 };
const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const DARK = '#1b1f27', LINE = '#e8e0cf', HOT = '#4cff7a', CREAM = '#f3e9d2';

/** One command of a section, as the board shows it. */
export interface RigCommandArt {
  /** `section:command`, the drop zone's name. */
  key: string; name: string; slot: string; lines: string[];
  /** A die can go here now. */ hot: boolean;
  /** The die on it this round. */ die?: number;
  /** Covered by a minor damage token. */ damaged: boolean;
}
/** The Big Rig's board: its colour, the three sections (rear first), the steering and the damage count. */
export interface RigBoardArt {
  color: string;
  sections: { sec: string; name: string; used: boolean; commands: RigCommandArt[] }[];
  steer: { die: number | null; left: number | null; hot: boolean };
  damage: number; max: number;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const text = (s: string, x: number, y: number, size: number, fill: string, anchor = 'middle', extra = ''): string =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${FONT} pointer-events="none" ${extra}>${esc(s)}</text>`;
const inner = (s: string): string => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');
const die = (x: number, y: number, s: number, value: number, color: string): string =>
  `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})" pointer-events="none">${inner(dieSvg({ kind: 'movement', value, color, number: true, ui: true }))}</g>`;
const diamond = (x: number, y: number, r: number): string => `M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y}Z`;

/** One section at `x`, `w` wide; the rear trailer shows the damage count, the front cab the steering. */
function section(a: RigBoardArt, s: RigBoardArt['sections'][number], x: number, w: number, k: number): string {
  const ink = inkOn(a.color);
  let b = `<path d="M${x + 12} 8 H${x + w - 12} L${x + w} 20 V272 L${x + w - 12} 284 H${x + 12} L${x} 272 V20Z" fill="${DARK}"/>`;
  b += `<path d="M${x + 16} 14 H${x + w - 16} L${x + w - 6} 24 V266 L${x + w - 16} 278 H${x + 16} L${x + 6} 266 V24Z" fill="${a.color}"/>`;
  b += text(s.name.toUpperCase(), x + 20, 40, 24, ink, 'start');
  if (s.used) b += text('usata in questo round', x + 20, 55, 12, ink, 'start', 'opacity=".75"');
  if (k === 0) {
    // Six minor damage tokens put the Big Rig out (BRaFF p5): one place for each, filled as they come.
    for (let i = 0; i < a.max; i++) {
      const cx = x + w - 30 - (a.max - 1 - i) * 24;
      b += i < a.damage ? minorTokenAt(cx, 34, 22) : `<circle cx="${cx}" cy="34" r="9" fill="#000" fill-opacity=".2" stroke="${ink}" stroke-opacity=".5" stroke-dasharray="3 3"/>`;
    }
  }
  if (k === 2) {
    // Hydraulic Steering (BRaFF p4): the die of the round and the lane changes left.
    const sx = x + w - 40, sy = 34;
    b += `<path d="${diamond(sx, sy, 22)}" fill="${a.steer.hot ? '#1f5a30' : DARK}" stroke="${a.steer.hot ? HOT : LINE}" stroke-width="${a.steer.hot ? 3 : 1}" data-drop="steer"`
      + ` data-cmd-name="Sterzo idraulico" data-cmd-dice="1-3" data-cmd-text="Al primo turno del round: quante volte il Big Rig può cambiare corsia in questo round."/>`;
    b += a.steer.die !== null ? die(sx, sy, 28, a.steer.die, a.color) : text('STERZO', sx, sy + 4, 11, CREAM);
    if (a.steer.left !== null) b += text(`cambi di corsia: ${a.steer.left}`, sx - 30, 55, 13, ink, 'end');
  }
  s.commands.forEach((c, i) => {
    const y = 62 + i * 72;
    const dim = s.used && c.die === undefined;
    b += `<rect x="${x + 14}" y="${y}" width="${w - 28}" height="66" rx="6" fill="${c.hot ? HOT : '#000'}" fill-opacity="${c.hot ? 0.25 : 0.12}" data-drop="rig:${c.key}"`
      + ` data-cmd-name="${esc(c.name)}" data-cmd-dice="${esc(c.slot)}" data-cmd-text="${esc(c.lines.join(' '))}"/>`;
    const sx = x + 46, sy = y + 33, r = 24;
    b += `<path d="${diamond(sx, sy, r)}" fill="${c.hot ? '#1f5a30' : DARK}" stroke="${c.hot ? HOT : LINE}" stroke-width="${c.hot ? 3 : 1}" data-drop="rig:${c.key}"/>`;
    b += c.die !== undefined ? die(sx, sy, r * 1.3, c.die, a.color) : text(c.slot, sx, sy + 6, 16, CREAM, 'middle', `opacity="${dim ? 0.4 : 1}"`);
    b += `<g opacity="${dim ? 0.4 : 1}">${text(c.name, x + 80, y + 27, 21, ink, 'start')}`
      + c.lines.slice(0, 2).map((l, j) => text(l, x + 80, y + 43 + j * 13, 12, ink, 'start')).join('') + '</g>';
    // A minor damage token covers the command: it only moves the rig (BRaFF p5).
    if (c.damaged) b += minorTokenAt(x + w - 44, sy, 50);
  });
  return b;
}

/** The Big Rig's strip: rear trailer, middle trailer and front cab, left to right. */
export function rigStripSvg(a: RigBoardArt, extra = ''): string {
  const gap = 9, w = (RIG_STRIP.w - 2 * gap - 8) / 3;
  const body = a.sections.map((s, i) => section(a, s, 4 + i * (w + gap), w, i)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RIG_STRIP.w} ${RIG_STRIP.h}" style="aspect-ratio:${RIG_STRIP.w}/${RIG_STRIP.h}" ${extra}>${body}</svg>`;
}
