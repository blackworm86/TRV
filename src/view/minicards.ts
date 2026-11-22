// The cards of the mini expansions (Bonus Commands, One Shots, Bounties, Road Conditions, Advanced
// Airstrikes), as the game shows them: the official card, straightened and cleaned of its English
// rules text (tools/art/save_mini_cards.py → assets/mini_espansioni/carte/<family>/<id>.jpg), with
// the Italian text (data/trv/<family>.json) set where the English was (layout.json). The name and
// the card's kind stay as printed.

import LAYOUT from '../../assets/mini_espansioni/carte/layout.json';
import AIRSTRIKES from '../../data/trv/advanced_airstrikes.json';
import BONUS from '../../data/trv/bonus_commands.json';
import BOUNTIES from '../../data/trv/bounties.json';
import ONE_SHOTS from '../../data/trv/one_shots.json';
import ROADS from '../../data/trv/road_conditions.json';
import { esc } from '../core/markup';
import { TEXT_FONT, fitText } from './cards';

/** The five mini expansions, by the name of their data file. */
export type MiniFamily = 'bonus_commands' | 'one_shots' | 'bounties' | 'road_conditions' | 'advanced_airstrikes';
export const MINI_FAMILIES: MiniFamily[] = ['bonus_commands', 'one_shots', 'bounties', 'road_conditions', 'advanced_airstrikes'];

/** One card of a mini expansion: its name and Italian text (a Bounty has two: the task, the reward). */
export interface MiniCard { id: string; name: string; text: string | string[]; range?: string }

const DATA: Record<MiniFamily, MiniCard[]> = {
  bonus_commands: BONUS.cards, one_shots: ONE_SHOTS.cards, bounties: BOUNTIES.cards,
  road_conditions: ROADS.cards, advanced_airstrikes: AIRSTRIKES.cards,
};
/** The cards of a mini expansion, in the order of their data file. */
export const miniCards = (family: MiniFamily): MiniCard[] => DATA[family];
/** One card, or undefined. */
export const miniCard = (family: MiniFamily, id: string): MiniCard | undefined => DATA[family].find(c => c.id === id);

const ART: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/mini_espansioni/carte/*/*.jpg', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.split('/').slice(-2).join('/').replace(/\.jpg$/, ''), url]));
/** The cleaned card's picture (no rules text), or undefined. */
export const miniCardArt = (family: MiniFamily, id: string): string | undefined => ART[`${family}/${id}`];

/** The card's size, in the units of the drawing (the cleaned card's pixels). */
export const MINI_CARD = { w: 744, h: 1040 } as const;
/** The radius of the card's corners, in the same units (3 mm of the card's 63). */
const CORNER = 35;

/**
 * How the text is set on each kind of card: its colour, whether lines are centred (the Bonus
 * Commands), the lowest the text may go (Italian runs longer than English: it may take the panel's
 * room under the printed text), and the size it starts from: larger than the printed one, for the
 * screen (asked by the user, 2026-11-22), shrunk where the text does not fit.
 */
const STYLE: Record<MiniFamily, { ink: string[]; center?: boolean; bottom?: number; right?: number; size: number }> = {
  bonus_commands: { ink: ['#efe6d2'], center: true, bottom: 962, right: 668, size: 50 },
  one_shots: { ink: ['#17130f'], bottom: 964, right: 672, size: 50 },
  road_conditions: { ink: ['#17130f'], bottom: 964, right: 680, size: 50 },
  advanced_airstrikes: { ink: ['#101418'], bottom: 952, right: 670, size: 50 },
  // The task on the purple box, the reward on the orange one: each fills its own box.
  bounties: { ink: ['#f4efe6', '#17130f'], size: 50 },
};

/**
 * A mini expansion card, drawn: the official card cleaned of its English text, with the Italian
 * text in its place. 744 x 1040 units, scaled by the page (width/height 100%).
 * Example: `miniCardSvg('road_conditions', 'icy')`.
 */
export function miniCardSvg(family: MiniFamily, id: string): string {
  const { w, h } = MINI_CARD;
  const card = miniCard(family, id), art = miniCardArt(family, id);
  const boxes = (LAYOUT as Record<string, Record<string, number[][]>>)[family]?.[id] ?? [];
  const style = STYLE[family];
  // Rounded as the printed card (3 mm on 63 mm): the scans' corners are cut away.
  const clip = `mc-${family}-${id}`;
  let b = art ? `<clipPath id="${esc(clip)}"><rect width="${w}" height="${h}" rx="${CORNER}"/></clipPath><image href="${art}" width="${w}" height="${h}" clip-path="url(#${esc(clip)})"/>`
    : `<rect width="${w}" height="${h}" rx="${CORNER}" fill="#2b2630"/>`;
  const texts = card ? (Array.isArray(card.text) ? card.text : [card.text]) : [];
  texts.forEach((text, i) => {
    const box = boxes[i];
    if (!box) return;
    // The printed text's box, as wide as the panel lets it (the English lines were often shorter);
    // the Bonus Commands' text stays centred on the card.
    const [x0, y, w0, bh] = box;
    const x = style.center ? w - (style.right ?? x0 + w0) : x0;
    const bw = style.right ? style.right - x : w0;
    const pad = family === 'bounties' ? 24 : 0;
    const room = (style.bottom ? Math.max(bh, style.bottom - y) : bh) - pad * 2;
    const fit = fitText(text, () => bw - pad * 2, room, style.size, 24, 1.16);
    // Centred vertically in a Bounty's box; from the top elsewhere, where the printed text began.
    const used = fit.lines.length ? fit.lines[fit.lines.length - 1].y + fit.size * 0.3 : 0;
    const top = y + pad + (family === 'bounties' ? Math.max(0, (room - used) / 2) : 0);
    const ink = style.ink[i] ?? style.ink[0];
    const tx = style.center ? x + bw / 2 : x + pad;
    b += `<g ${TEXT_FONT} font-weight="500" font-size="${fit.size}" fill="${ink}"${style.center ? ' text-anchor="middle"' : ''}>`
      + fit.lines.map(l => `<text x="${tx}" y="${(top + l.y).toFixed(1)}">${esc(l.text)}</text>`).join('') + '</g>';
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" data-id="${esc(id)}">${b}</svg>`;
}
