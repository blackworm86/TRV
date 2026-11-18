// TRV9000 (design/gdd/trv9000-bots.md, 9): each bot's activation card of the round beside the
// players, redrawn in the game's look, with the line playing now lit. Only the command and the
// lines played so far are uncovered: the later ones stay hidden, as under the player board the
// card slides out from on the table (asked by the user, 2026-11-18). It follows the beats: during a
// replay it shows the card as the table was at that beat.

import trv9000 from '../../data/trv/trv9000.json';
import { botCards, snapshot, type Snapshot } from '../game/trv/engine';
import { dataUrl } from '../view/vector/art';
import { botCardSvg } from '../view/vector/trv9000';
import { g } from './game';
import { $, esc } from './util';

const COMMANDS = trv9000.commands as Record<string, string>;
/** The drawings already made, by card, line and colour (a beat redraws the panel often). */
const drawn = new Map<string, string>();
let shown = '';

/** Draws the bots' cards as the table is in `snap` (now, when not given). */
export function drawBotCards(snap?: Snapshot): void {
  const el = $('botcards');
  const s = g?.trv9000 ? snap ?? snapshot(g) : null;
  const items = (s?.bots ?? []).flatMap((b, i) => (b && b.card !== null ? [{ seat: i, card: b.card, active: b.active, shown: Math.max(b.line ?? 3, (b.active ?? -1) + 1) }] : []));
  const key = items.map(x => `${x.seat}:${x.card}:${x.active}:${x.shown}`).join('|');
  if (key === shown) return;
  shown = key;
  el.innerHTML = items.map(x => {
    const p = g!.players[x.seat];
    const id = `${x.card}|${x.active}|${x.shown}|${p.color}`;
    let url = drawn.get(id);
    if (!url) {
      const card = botCards().find(c => c.id === x.card)!;
      url = dataUrl(botCardSvg(card, { color: p.color, active: x.active, shown: x.shown, commands: COMMANDS, of: botCards().length }));
      drawn.set(id, url);
    }
    return `<figure class="${x.active !== null ? 'on' : ''}" style="--c:${p.color}"><img src="${url}" alt="Carta TRV9000 ${x.card}"><figcaption>${esc(p.name)}</figcaption></figure>`;
  }).join('');
}
