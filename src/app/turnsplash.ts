// "Tocca a Pippo!": when a player's turn begins, a slanted band in their colour crosses the
// screen with their avatar in a circle over it (asked by the user, 2026-11-18, mock-up 2B without
// the chopper). It goes by itself after a few seconds, or at a click or a key.

import { finalFive, type Decision, type Player } from '../game/trv/engine';
import { avatarSvg, inkOn } from '../view/vector/art';
import { g, mySeat } from './game';
import { PORTRAITS } from './info';
import { P } from './presentation';
import { replaying } from './replay';
import { S } from './state';
import { esc } from './util';

/** The turn the splash was last shown for: the turn lines in the log and the player on turn. */
let shownFor = '';
let timer = 0;

/** Which of their turns of the round this is for `p` (1-3): the cars already moved or coasted, plus one. */
function turnOfRound(p: Player): number {
  const cars = g!.vehicles.filter(v => v.owner === p.id);
  const dice = cars.filter(v => v.moved).length + cars.reduce((n, v) => n + v.coasts, 0);
  // The Final Five place two dice a turn (BRaFF p7), one of them maybe on a command.
  // The Big Rig places one die a turn on a section not used yet this round (BRaFF p4).
  if (p.rig) return p.rig.used.length + 1;
  if (p.team === 'final_five') return Math.floor((dice + (p.commandUsed ? 1 : 0)) / finalFive().turn.dice_per_turn) + 1;
  return dice + 1;
}

/** Shows the splash when `d` is the first question of a person's turn (never for a bot, never in a replay). */
export function maybeTurnSplash(d: Decision | null): void {
  // While beats play (the roll for the first player, the round's dice) the splash waits for them.
  if (!g || !d || replaying || S.playing || d.kind !== 'assign' || d.player !== g.current || g.round < 1) return;
  const p = g.players[d.player];
  if (p.bot) return;
  // The game's seed too: a new game whose first turn looks like the last one still gets its splash.
  const key = `${S.saved?.setup.seed ?? ''}:${g.log.filter(l => l.kind === 'turn').length}:${g.current}`;
  if (key === shownFor) return;
  shownFor = key;
  showTurnSplash(p);
}

/** Takes the splash away (with its fade). */
export function closeTurnSplash(): void {
  const el = document.getElementById('turnsplash');
  clearTimeout(timer);
  removeEventListener('keydown', onKey, true);
  if (!el || el.classList.contains('out')) return;
  el.classList.add('out');
  setTimeout(() => el.remove(), 320);
}

/** Any key closes the splash and does nothing else. */
function onKey(e: KeyboardEvent): void {
  e.preventDefault();
  e.stopPropagation();
  closeTurnSplash();
}

/** The splash for `p`, in the middle of the screen. */
export function showTurnSplash(p: Player): void {
  document.getElementById('turnsplash')?.remove();
  const pic = p.leader ? PORTRAITS[p.leader] : undefined;
  const me = !!S.net && p.id === mySeat();
  const el = document.createElement('div');
  el.id = 'turnsplash';
  el.style.setProperty('--c', p.color);
  el.style.setProperty('--ink', inkOn(p.color));
  el.innerHTML = `<div class="veil"></div><div class="stage"><div class="slash"><i></i></div>`
    + `<div class="row"><div class="av">${pic ? `<img src="${pic}" alt="">` : avatarSvg(p.color, p.name)}</div>`
    + `<div class="txt"><small>ROUND ${g!.round} · TURNO ${Math.min(turnOfRound(p), 3)} DI 3</small>`
    + `<b class="gothic">${me ? 'TOCCA A TE!' : `TOCCA A ${esc(p.name.toUpperCase())}!`}</b></div></div></div>`
    + `<div class="hint">Clicca o premi un tasto per iniziare</div>`;
  el.onclick = closeTurnSplash;
  document.body.append(el);
  addEventListener('keydown', onKey, true);
  clearTimeout(timer);
  timer = window.setTimeout(closeTurnSplash, P.turnSplash.seconds * 1000);
}
