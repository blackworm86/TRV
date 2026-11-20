// The TRV9000 activation cards (fan-made expansion, design/gdd/trv9000-bots.md), redrawn in the
// game's own look (asked by the user, 2026-11-18: the cards are not used as printed images). The
// layout follows the printed card: the command at the top with the shooting and coasting priority,
// then one line per car size, read left to right.

import { commandIconAt, fireDieSvg, inkOn, type FireFace } from './art';
import { esc } from '../../core/markup';

/** What {@link botCardSvg} draws: one activation card, as data/trv/trv9000.json has it. */
export interface BotCardArt {
  id: number;
  command: string;
  /** Which space of the front arc first: ['L','F','R'] top to bottom, or the reverse. */
  priority: string[];
  /** Airstrike: behind the target, which space the chopper takes first. */
  chopper?: string[];
  lines: { car: string; steps: string[] }[];
}

/** How the card is shown: the team colour on the frame and the line playing now. */
export interface BotCardLook {
  color?: string;
  active?: number | null;
  /**
   * How many lines are uncovered, from the top (all when absent). As on the table, where the card
   * slides out from under a player board one line per turn: the later lines stay hidden.
   */
  shown?: number;
  /** Texts of the commands (Italian), from the data file. */
  commands: Record<string, string>;
  /** How many cards the deck has, for the number at the corner. */
  of?: number;
}

const FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
const BODY = `font-family="'Barlow Condensed', 'Arial Narrow', sans-serif"`;
const INK = '#17120e', CREAM = '#f3e6d0', PANEL = '#221b15', CHEVRON = '#c98a3c';
const SIZE_COLOR: Record<string, string> = { S: '#3fae4a', M: '#f2d22e', L: '#e0402e' };
const COMMAND_NAME: Record<string, string> = { airstrike: 'ATTACCO AEREO', drift: 'DRIFT', repair: 'RIPARAZIONE' };

/** Splits text into lines of at most `max` characters, at spaces. */
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + w.length > max) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

/** A chevron pointing forward (right on the card), its centre on (cx, cy). */
function chevron(cx: number, cy: number, w: number, filled: boolean): string {
  const h = w * 0.86, x = cx - w / 2, y = cy - h / 2, d = w * 0.36;
  const path = `M${x} ${y} H${x + w - d} L${x + w} ${cy} L${x + w - d} ${y + h} H${x} L${x + d} ${cy}Z`;
  return filled
    ? `<path d="${path}" fill="${CREAM}"/>`
    : `<path d="${path}" fill="none" stroke="${CHEVRON}" stroke-width="${(w * 0.13).toFixed(1)}" stroke-linejoin="round"/>`;
}

/** Three chevrons stacked (top: forward-left, middle: forward, bottom: forward-right), one of them filled. */
function chevrons(cx: number, cy: number, w: number, gap: number, filled: number): string {
  return [0, 1, 2].map(k => chevron(cx, cy + (k - 1) * gap, w, k === filled)).join('');
}

/** The inner markup of an SVG string, placed at (x, y) with size `s`. */
function nest(svgText: string, x: number, y: number, s: number): string {
  const body = svgText.replace(/^<svg[^>]*>|<\/svg>$/g, '');
  return `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 100 100">${body}</svg>`;
}

/** A gun sight, the shooting priority's mark. */
function sight(cx: number, cy: number, r: number): string {
  return `<g fill="none" stroke="#e23a3a" stroke-width="${r * 0.16}"><circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.45}"/>`
    + `<path d="M${cx - r * 1.35} ${cy} H${cx - r * 0.6} M${cx + r * 0.6} ${cy} H${cx + r * 1.35} M${cx} ${cy - r * 1.35} V${cy - r * 0.6} M${cx} ${cy + r * 0.6} V${cy + r * 1.35}"/></g>`;
}

/** A curved arrow beside the chevrons: down (top first) or up (bottom first). */
function orderArrow(x: number, top: number, bottom: number, down: boolean): string {
  const [a, b] = down ? [top, bottom] : [bottom, top];
  const mid = (top + bottom) / 2, bend = 14;
  const head = down ? `M${x - 11} ${b - 14} L${x} ${b} L${x + 11} ${b - 14}` : `M${x - 11} ${b + 14} L${x} ${b} L${x + 11} ${b + 14}`;
  return `<path d="M${x} ${a} Q${x + bend} ${mid} ${x} ${b}" fill="none" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>`
    + `<path d="${head}" fill="none" stroke="${CREAM}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const STEP_ROW: Record<string, number> = { L: 0, F: 1, R: 2 };

/** One step of a line: a number and its direction, or a fire die face (only when the car is on fire). */
function step(s: string, cx: number, cy: number): string {
  if (s.startsWith('fire:')) {
    const face = s.slice(5) as FireFace;
    return `<rect x="${cx - 46}" y="${cy - 46}" width="92" height="92" rx="14" fill="#4a3f2c"/>` + nest(fireDieSvg(face), cx - 38, cy - 38, 76);
  }
  const n = s.slice(0, -1), d = s.slice(-1);
  return `<text x="${cx - 14}" y="${cy + 34}" text-anchor="middle" font-size="98" fill="${CREAM}" ${FONT}>${esc(n)}</text>`
    + chevrons(cx + 30, cy, 28, 40, STEP_ROW[d] ?? 1);
}

/**
 * An activation card, 630 x 880 like the other cards: the command (icon, name, text), the
 * priority (gun sight, chevrons and the arrow of the order), then the three lines. `look.active`
 * lights the line playing now in the team colour.
 * Example: `botCardSvg(card, { color: '#d33', active: 1, commands })`.
 */
export function botCardSvg(c: BotCardArt, look: BotCardLook, extra = ''): string {
  const col = look.color ?? '#9aa3ad';
  let b = `<rect width="630" height="880" rx="34" fill="${INK}"/>`;
  b += `<rect x="18" y="18" width="594" height="844" rx="24" fill="${CREAM}" stroke="${col}" stroke-width="14"/>`;
  // The command: icon, name and text, and the priority box.
  b += `<rect x="40" y="40" width="160" height="250" rx="22" fill="${PANEL}"/>`;
  // The icon files carry bare attributes (data-centred), fine in HTML but not in an SVG file: the card goes out as an image.
  b += commandIconAt(c.command, 120, 130, 130, CREAM).replace(/\sdata-[\w-]+(?=[\s>/])/g, '');
  b += `<text x="120" y="270" text-anchor="middle" font-size="30" fill="${CREAM}" opacity=".7" ${FONT}>TRV9000</text>`;
  b += `<rect x="210" y="40" width="250" height="250" rx="22" fill="${PANEL}"/>`;
  const name = COMMAND_NAME[c.command] ?? c.command.toUpperCase();
  b += `<text x="335" y="92" text-anchor="middle" font-size="${name.length > 11 ? 46 : 54}" fill="${CREAM}" ${FONT}>${esc(name)}</text>`;
  const text = wrap(look.commands[c.command] ?? '', 22).slice(0, 6);
  b += `<g ${BODY} font-size="24" font-weight="600" fill="${CREAM}" text-anchor="middle">${text.map((l, i) => `<text x="335" y="${132 + i * 26}">${esc(l)}</text>`).join('')}</g>`;
  b += `<rect x="470" y="40" width="120" height="250" rx="22" fill="${PANEL}"/>`;
  b += sight(500, 112, 18) + chevrons(540, 112, 24, 36, -1) + orderArrow(568, 80, 144, c.priority[0] === 'L');
  b += `<text x="530" y="${c.chopper ? 202 : 222}" text-anchor="middle" font-size="27" fill="${CREAM}" ${FONT}>SPARO</text>`;
  b += `<text x="530" y="${c.chopper ? 230 : 252}" text-anchor="middle" font-size="27" fill="${CREAM}" ${FONT}>INERZIA</text>`;
  if (c.chopper) b += `<text x="530" y="270" text-anchor="middle" font-size="22" fill="#9fd3ff" ${FONT}>ELICOTTERO ${c.chopper[0] === 'R' ? '▲' : '▼'}</text>`;
  // The three lines, top to bottom; a small triangle between them shows the reading order.
  const rows = [318, 502, 686], h = 160;
  c.lines.forEach((line, i) => {
    const y = rows[i], on = look.active === i;
    if (i > 0) b += `<path d="M62 ${y - 20} L82 ${y - 20} L72 ${y - 6}Z" fill="${INK}" opacity=".45"/>`;
    if (on) b += `<rect x="28" y="${y - 10}" width="574" height="${h + 20}" rx="36" fill="${col}"/>`;
    b += `<rect x="40" y="${y}" width="550" height="${h}" rx="28" fill="${INK}"${on ? ` stroke="${inkOn(col) === INK ? CREAM : INK}" stroke-width="4"` : ''}/>`;
    b += `<text x="88" y="${y + h / 2 + 36}" text-anchor="middle" font-size="104" fill="${SIZE_COLOR[line.car] ?? CREAM}" ${FONT}>${esc(line.car)}</text>`;
    line.steps.forEach((s, k) => { b += step(s, 182 + k * 110, y + h / 2); });
  });
  b += `<text x="592" y="${rows[1] - 18}" text-anchor="end" font-size="22" fill="${INK}" opacity=".55" ${FONT}>${c.id}/${look.of ?? 18}</text>`;
  // The lines still to come, covered as by the player board the card slides out from under.
  const shown = Math.max(0, Math.min(c.lines.length, look.shown ?? c.lines.length));
  if (shown < c.lines.length) {
    const top = rows[shown] - 14;
    b += `<path d="M0 ${top} H630 V846 Q630 880 596 880 H34 Q0 880 0 846Z" fill="${PANEL}"/>`;
    b += `<rect x="0" y="${top}" width="630" height="10" fill="${col}"/>`;
    for (let y = top + 40; y < 870; y += 36) b += `<path d="M30 ${y} H600" stroke="${CREAM}" stroke-opacity=".06" stroke-width="10"/>`;
    const n = c.lines.length - shown;
    b += `<text x="315" y="${(top + 880) / 2 + 14}" text-anchor="middle" font-size="44" fill="${CREAM}" opacity=".5" ${FONT}>${n === 1 ? 'TURNO SUCCESSIVO COPERTO' : `${n} TURNI SUCCESSIVI COPERTI`}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" ${extra}>${b}</svg>`;
}
