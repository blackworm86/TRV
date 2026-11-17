// The game being played: its saved setup and choices, the rules' generator, the decision
// waiting, undo, and where the player may put a die.

import { key, newGame, play, type Game, type Decision, type Setup, type Player } from '../game/trv/engine';
import { roomPath, seatOf, type Room, type RoomStore } from '../net/room';
import { playBeats, queue } from './beats';
import { netError } from './online';
import { render } from './pieces';
import { keepReplay } from './replay';
import { S } from './state';
import { $, SAVE_KEY } from './util';

export interface Saved {
  setup: Setup; choices: number[];
  /**
   * How many choices can no longer be taken back. A choice is final once what followed it rolled a
   * die, shuffled a pile or showed something hidden (a hazard turned, a tile drawn, a damage token
   * taken): placing the chopper can be taken back, its shot cannot (asked by the user, 2026-11-17).
   */
  lock?: number;
}

/** What a choice shows that was hidden: after one of these it cannot be taken back. */
const FINAL = new Set(['reveal', 'tile', 'damage', 'shot', 'roll', 'slam']);

/** True when Undo may take the last choice back: hot seat, and nothing rolled or revealed since. */
export function canUndo(): boolean {
  return !S.net && !!S.saved && S.saved.choices.length > (S.saved.lock ?? 0);
}
export let g: Game | null = null;
/** The decision this device may answer: the pending one in hot seat; online, only when it is this player's. */
export let decision: Decision | null = null;
/** The decision the rules are waiting on, whoever must take it. */
export let pending: Decision | null = null;

/** The online room this device is in (null: hot seat). See the "online" section below. */
export interface Net { store: RoomStore; code: string; uid: string; host: boolean; room: Room | null; stop: () => void; lobbyOpen: boolean; qrFor: string }

/** Online: the player number of this device in the running match (-1: hot seat, or a spectator). */
export function mySeat(): number {
  return S.net?.room ? seatOf(S.net.room, S.net.uid) : -1;
}
export function setPending(d: Decision | null): void {
  pending = d;
  decision = d && (!S.net || d.player === mySeat()) ? d : null;
}

export function startGame(s: Saved): void {
  S.replayFrames = null; // a replay belongs to the game it was seen in
  S.saved = s;
  g = newGame(s.setup);
  S.gen = play(g);
  let r = S.gen.next(0);
  for (const c of s.choices) { if (r.done) break; r = S.gen.next(c); }
  setPending(r.done ? null : r.value);
  S.selDie = null;
  S.lastDecider = -1;
  S.frameSeen = g.frames.length;
  queue.length = 0;
  S.playing = false;
  persist();
  render();
}

/** The player at this device picks option `i`. Online, a guest asks the host; the host applies and publishes. */
export function choose(i: number, sure = false): void {
  if (!S.gen || !decision || !S.saved || i < 0) return;
  // A step onto a face-down hazard: asked first, since it cannot be undone once the token is turned.
  const to = decision.kind === 'step' ? decision.options[i]?.pos : undefined;
  const h = to && g?.hazards.get(key(to));
  if (!sure && h && !h.faceUp) { confirmHazard(() => choose(i, true)); return; }
  if (S.net && !S.net.host) {
    void S.net.store.write(roomPath(S.net.code, 'intents', S.net.uid), { n: S.saved.choices.length, c: i }).catch(netError);
    decision = null; // asked: wait for the host's log
    S.selDie = null;
    render();
    return;
  }
  const n = S.saved.choices.length;
  applyChoice(i);
  if (S.net) void S.net.store.write(roomPath(S.net.code, 'log', String(n)), i).catch(netError);
}

/** Feeds an accepted choice to the rules and plays what it produced. */
export function applyChoice(i: number): void {
  if (!S.gen || !pending || !S.saved) return;
  S.saved.choices.push(i);
  const luck = JSON.stringify(g!.rng);
  const r = S.gen.next(i);
  setPending(r.done ? null : r.value);
  // Dice rolled, a pile shuffled or something hidden shown: from here on Undo cannot go back before this choice.
  if (JSON.stringify(g!.rng) !== luck || g!.frames.slice(S.frameSeen).some(f => FINAL.has(f.kind))) S.saved.lock = S.saved.choices.length;
  S.selDie = null;
  persist();
  const fresh = g!.frames.slice(S.frameSeen);
  S.frameSeen = g!.frames.length;
  keepReplay(fresh);
  playBeats(fresh);
}

export function undo(): void {
  if (!canUndo()) return; // online the log is shared, and a revealed hazard stays revealed
  S.winShown = false;
  $('win').style.display = 'none';
  const { setup, choices, lock } = S.saved!;
  startGame({ setup, choices: choices.slice(0, -1), ...(lock ? { lock } : {}) });
}

/**
 * "Vuoi entrare nella tessera pericolo?" with Sì and No, over the table (asked by the user,
 * 2026-11-17). Sì runs `yes`; No (or Esc) closes it and the step can be chosen again.
 */
function confirmHazard(yes: () => void): void {
  let box = document.getElementById('hzask');
  if (!box) {
    box = document.createElement('div');
    box.id = 'hzask';
    document.body.append(box);
  }
  box.innerHTML = '<div class="card"><p>Vuoi entrare nella tessera pericolo?</p>'
    + '<small>Scoperto il pericolo, la mossa non si potrà più annullare.</small>'
    + '<div class="row"><button class="yes" data-key="Enter">Sì</button><button class="no" data-key="Escape">No</button></div></div>';
  const close = (): void => { box!.style.display = 'none'; removeEventListener('keydown', keys, true); };
  const keys = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); yes(); }
  };
  box.querySelector<HTMLButtonElement>('.yes')!.onclick = () => { close(); yes(); };
  box.querySelector<HTMLButtonElement>('.no')!.onclick = close;
  box.style.display = 'flex';
  addEventListener('keydown', keys, true);
}

export function persist(): void {
  if (S.net) return; // an online match lives in the room, not in this browser
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.saved)); } catch { /* storage off: no resume */ }
}

/** The player the interface is showing: whoever must decide now. */
export function viewer(): Player | null {
  if (!g) return null;
  const seat = mySeat();
  if (seat >= 0) return g.players[seat]; // online: always my own boards
  return g.players[pending ? pending.player : g.winner ?? g.current];
}


/** Option index for dropping die `dieIdx` of the deciding player on `zone`, or -1. */
export function zoneOption(zone: string, dieIdx: number): number {
  if (!g || !decision) return -1;
  const v = g.players[decision.player].dice[dieIdx];
  const [kind, id] = zone.split(':');
  return decision.options.findIndex(o => {
    if (o.dieValue !== v) return false;
    if (decision!.kind === 'assign') return o.carId === id && !!o.coast === (kind === 'coast');
    if (decision!.kind === 'command') return kind === 'cmd' && o.command === id;
    return false;
  });
}

export function placing(): boolean {
  return !!decision && (decision.kind === 'assign' || decision.kind === 'command');
}

/** Zones that accept the selected die (or any free die when none is selected). */
export function hotZones(): Set<string> {
  const out = new Set<string>();
  if (!g || !decision || !placing()) return out;
  const p = g.players[decision.player];
  const dice = S.selDie !== null ? [S.selDie] : p.dice.map((_, i) => i).filter(i => !p.used[i]);
  for (const o of decision.options) {
    if (!dice.some(i => p.dice[i] === o.dieValue)) continue;
    if (decision.kind === 'assign' && o.carId) out.add(`${o.coast ? 'coast' : 'move'}:${o.carId}`);
    if (decision.kind === 'command' && o.command) out.add(`cmd:${o.command}`);
  }
  return out;
}

export function dieUsable(i: number): boolean {
  if (!g || !decision || !placing()) return false;
  const p = g.players[decision.player];
  return !p.used[i] && decision.options.some(o => o.dieValue === p.dice[i]);
}
