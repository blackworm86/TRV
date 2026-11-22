// The game being played: its saved setup and choices, the rules' generator, the decision
// waiting, undo, and where the player may put a die.

import { key, newGame, play, snapshot, type Game, type Decision, type Setup, type Player } from '../game/trv/engine';
import { roomPath, seatOf, type Room, type RoomStore } from '../net/room';
import { playBeats, queue } from './beats';
import { netError } from './online';
import { render } from './pieces';
import { keepReplay } from './replay';
import { resetScenes } from './scenePlayer';
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

/** The player who made each choice of the log, in order (rebuilt on every replay). */
export let deciders: number[] = [];

/**
 * True when Undo may take the last choice back: nothing rolled or revealed since. Online (asked by
 * the user, 2026-11-17) only the player who made that choice may take it back, through the host.
 */
export function canUndo(): boolean {
  if (!S.saved || S.saved.choices.length <= (S.saved.lock ?? 0)) return false;
  return !S.net || (S.net.room?.status === 'playing' && deciders[S.saved.choices.length - 1] === mySeat());
}
export let g: Game | null = null;
/** The decision this device may answer: the pending one in hot seat; online, only when it is this player's. */
export let decision: Decision | null = null;
/** The decision the rules are waiting on, whoever must take it. */
export let pending: Decision | null = null;

/** The online room this device is in (null: hot seat). See the "online" section below. */
export interface Net {
  store: RoomStore; code: string; uid: string; host: boolean; room: Room | null; stop: () => void; lobbyOpen: boolean; qrFor: string;
  /** Host: the lobby card last published (JSON), so it is written only when it changes. */
  posted?: string;
  /** Host: the log length last seen, to stamp the time of each new move. */
  logLen?: number;
}

/** Online: the player number of this device in the running match (-1: hot seat, or a spectator). */
export function mySeat(): number {
  return S.net?.room ? seatOf(S.net.room, S.net.uid) : -1;
}
export function setPending(d: Decision | null): void {
  pending = d;
  decision = d && (!S.net || d.player === mySeat()) ? d : null;
  // Online, the upgrade cards are placed by everyone at once: my own placing, whoever the rules ask.
  if (S.net && d?.kind === 'upgradeAssign') decision = myAssign();
}

/** Online: my upgrade cards placed in advance on my cars (card on car), sent to the host. */
export let assignPlan: { card: string; car: string }[] = [];

/**
 * Online, while the upgrade cards go on the cars: my placing as a decision of its own, made of the
 * cards and places I have not planned yet; null once all are planned (or outside that moment).
 * The single last card goes on the single last place by itself, as the rules do.
 */
function myAssign(): Decision | null {
  const seat = mySeat();
  if (!g?.assign || seat < 0) return null;
  const { left, cars } = unplanned(seat);
  if (!left.length || !cars.length || (left.length === 1 && cars.length === 1)) return null;
  const p = g.players[seat];
  return {
    kind: 'upgradeAssign', player: seat, prompt: `${p.name}: trascina un potenziamento su un’auto.`,
    options: left.flatMap(id => cars.map(car => ({ label: id, upgrade: id, carId: car }))),
  };
}

/** My upgrade cards and places the rules have not filled and my plan does not name. */
function unplanned(seat: number): { left: string[]; cars: string[] } {
  const left = [...g!.assign!.left[seat]], cars = [...g!.assign!.cars[seat]];
  for (const p of assignPlan) {
    const ci = left.indexOf(p.card), vi = cars.indexOf(p.car);
    if (ci >= 0 && vi >= 0) { left.splice(ci, 1); cars.splice(vi, 1); }
  }
  return { left, cars };
}

/** Online: the upgrade cards I planned for a car and the rules have not placed yet (drawn on its dashboard). */
export function plannedFor(carId: string): string[] {
  const seat = mySeat();
  if (!S.net || !g?.assign || seat < 0) return [];
  return assignPlan.filter(p => p.car === carId && g!.assign!.left[seat].includes(p.card)).map(p => p.card);
}

/** Online: places card `card` on car `car` in my plan and sends the plan to the host. */
export function planAssign(card: string, car: string): void {
  if (!S.net || !S.saved) return;
  assignPlan.push({ card, car });
  // The last card goes on the last place by itself: planned too, so its dashboard shows it now.
  const seat = mySeat(), rest = seat >= 0 && g?.assign ? unplanned(seat) : null;
  if (rest && rest.left.length === 1 && rest.cars.length === 1) assignPlan.push({ card: rest.left[0], car: rest.cars[0] });
  void S.net.store.write(roomPath(S.net.code, 'intents', S.net.uid), { n: S.saved.choices.length, c: 0, assign: assignPlan }).catch(netError);
  if (pending) setPending(pending);
  render();
}

/** Starts (or resumes) a game; `opening`: a game just created, whose first beats are played (the roll for the first player). */
export function startGame(s: Saved, opening = false): void {
  S.replayFrames = null; // a replay belongs to the game it was seen in
  S.saved = s;
  S.draftSent = -1;
  S.leaderSent = false;
  assignPlan = [];
  g = newGame(s.setup);
  S.gen = play(g);
  let r = S.gen.next(0);
  deciders = [];
  // The replay finds again which choices are final, as applyChoice did (online the lock is not stored).
  for (const c of s.choices) {
    if (r.done) break;
    deciders.push(r.value.player);
    const luck = JSON.stringify(g.rng), seen = g.frames.length;
    r = S.gen.next(c);
    if (JSON.stringify(g.rng) !== luck || g.frames.slice(seen).some(f => FINAL.has(f.kind))) s.lock = Math.max(s.lock ?? 0, deciders.length);
  }
  setPending(r.done ? null : r.value);
  S.selDie = null;
  S.lastDecider = -1;
  S.frameSeen = g.frames.length;
  queue.length = 0;
  resetScenes();
  S.playing = false;
  S.settleBy = 0;
  persist();
  // A new game: what happened before the first question is played too, the roll for the first
  // player above all (asked by the user, 2026-11-18). A game resumed, taken back or joined later is not.
  if (opening && !s.choices.length && g.frames.length) playBeats(g.frames.slice());
  else render();
}

/**
 * Online upgrade draft (asked by the user, 2026-11-17): every player sees their own hand at once
 * and picks; the pick waits at the host until the rules reach that player, and the hands pass on
 * when everyone has picked. Null in hot seat (the picks come one after the other) or outside a draft.
 */
export function onlineDraft(): { round: number; hand: string[]; sent: boolean } | null {
  const seat = mySeat();
  if (!S.net || !g?.draft || pending?.kind !== 'draft' || seat < 0 || !g.draft.picks[seat]) return null;
  return { round: g.draft.round, hand: g.draft.hands[seat], sent: S.draftSent === g.draft.round };
}

/**
 * Online crew leaders (asked by the user, 2026-11-19): every player sees their own two boards at
 * once and picks, as in the upgrade draft; the pick waits at the host until the rules reach that
 * player. `chosen`: picked (sent, or already taken by the rules), waiting for the others. Null in hot
 * seat (one screen: the picks come one after the other) or outside that moment.
 */
export function onlineLeader(): { hand: string[]; chosen: boolean } | null {
  const seat = mySeat();
  if (!S.net || !g?.leaderHands || pending?.kind !== 'leader' || seat < 0) return null;
  const hand = g.leaderHands[seat] ?? [];
  if (!hand.length) return null;
  return { hand, chosen: S.leaderSent || !!g.players[seat].leader };
}

/** Online: sends this player's crew leader pick (see onlineLeader). */
export function leaderPick(id: string): void {
  if (!S.net || !S.saved || !g?.leaderHands) return;
  S.leaderSent = true;
  void S.net.store.write(roomPath(S.net.code, 'intents', S.net.uid), { n: S.saved.choices.length, c: 0, leader: id }).catch(netError);
  render();
}

/** Online: sends this player's draft pick for the current round (see onlineDraft). */
export function draftPick(card: string): void {
  if (!S.net || !S.saved || !g?.draft) return;
  S.draftSent = g.draft.round;
  void S.net.store.write(roomPath(S.net.code, 'intents', S.net.uid), { n: S.saved.choices.length, c: 0, draft: { r: g.draft.round, card } }).catch(netError);
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

/**
 * The player at this device runs a path planned with waypoints (waypoints.ts): the choices one
 * after the other. Online, a guest sends the whole path to the host, which takes it a choice at a time.
 */
export function choosePath(path: number[]): void {
  if (!S.gen || !decision || !S.saved || !path.length) return;
  if (S.net && !S.net.host) {
    void S.net.store.write(roomPath(S.net.code, 'intents', S.net.uid), { n: S.saved.choices.length, c: path[0], path }).catch(netError);
    decision = null; // asked: wait for the host's log
    S.selDie = null;
    render();
    return;
  }
  for (const c of path) {
    if (!decision) break;
    choose(c, true);
  }
}

/** Feeds an accepted choice to the rules and plays what it produced. */
export function applyChoice(i: number): void {
  if (!S.gen || !pending || !S.saved) return;
  S.saved.choices.push(i);
  deciders.push(pending.player);
  const luck = JSON.stringify(g!.rng);
  const before = S.playing ? undefined : snapshot(g!); // what the table shows until the first new beat
  const r = S.gen.next(i);
  setPending(r.done ? null : r.value);
  // Dice rolled, a pile shuffled or something hidden shown: from here on Undo cannot go back before this choice.
  if (JSON.stringify(g!.rng) !== luck || g!.frames.slice(S.frameSeen).some(f => FINAL.has(f.kind))) S.saved.lock = S.saved.choices.length;
  S.selDie = null;
  persist();
  const fresh = g!.frames.slice(S.frameSeen);
  S.frameSeen = g!.frames.length;
  keepReplay(fresh);
  playBeats(fresh, before);
}

export function undo(): void {
  if (!canUndo() || !S.saved) return; // a revealed hazard stays revealed
  if (S.net) {
    // Online the log is shared: the host takes the choice out of it, a guest asks the host.
    if (S.net.host) { takeBack(); return; }
    void S.net.store.write(roomPath(S.net.code, 'intents', S.net.uid), { n: S.saved.choices.length, c: -1, undo: true }).catch(netError);
    return;
  }
  S.winShown = false;
  $('win').style.display = 'none';
  const { setup, choices, lock } = S.saved!;
  startGame({ setup, choices: choices.slice(0, -1), ...(lock ? { lock } : {}) });
}

/** Online, host: takes the last choice out of the room's log and plays the match again without it. */
export function takeBack(uid?: string): void {
  if (!S.net || !S.saved) return;
  const n = S.saved.choices.length, { setup, choices, lock } = S.saved;
  startGame({ setup, choices: choices.slice(0, -1), ...(lock ? { lock } : {}) });
  const net = S.net;
  void (async () => {
    // The log first: with the shorter log the request no longer matches (it was made at length n).
    await net.store.write(roomPath(net.code, 'log', String(n - 1)), null);
    if (uid) await net.store.write(roomPath(net.code, 'intents', uid), null);
  })().catch(netError);
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

/** Hot seat: deletes the local game, here and in this browser's storage (the menu's Elimina). */
export function dropLocal(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
  S.saved = null;
  S.gen = null;
  S.replayFrames = null;
  g = null;
  setPending(null);
  queue.length = 0;
  resetScenes();
  S.playing = false;
}

export function persist(): void {
  if (S.net || S.scratch) return; // an online match lives in the room; a report's game is only looked at
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
    // The Big Rig: the steering slot, and a die on a command of a section (BRaFF p4).
    if (decision!.kind === 'steer') return zone === 'steer';
    // Bonus Commands: the die on the player's Bonus Command card (src/app/minis.ts).
    if (o.bonus) return zone === 'bonus';
    if (decision!.kind === 'assign' && o.rig) return zone === `rig:${o.rig}`;
    // The Final Five assign their command die among the motorcycles' dice (BRaFF p7).
    if (decision!.kind === 'assign' && o.command) return kind === 'cmd' && o.command === id;
    if (decision!.kind === 'assign') return o.carId === id && !!o.coast === (kind === 'coast');
    if (decision!.kind === 'command') return kind === 'cmd' && o.command === id;
    return false;
  });
}

export function placing(): boolean {
  return !!decision && (decision.kind === 'assign' || decision.kind === 'command' || decision.kind === 'steer');
}

/** Zones that accept the selected die (or any free die when none is selected). */
export function hotZones(): Set<string> {
  const out = new Set<string>();
  if (!g || !decision || !placing()) return out;
  const p = g.players[decision.player];
  const dice = S.selDie !== null ? [S.selDie] : p.dice.map((_, i) => i).filter(i => !p.used[i]);
  for (const o of decision.options) {
    if (!dice.some(i => p.dice[i] === o.dieValue)) continue;
    if (decision.kind === 'steer') out.add('steer');
    if (decision.kind === 'assign' && o.rig) out.add(`rig:${o.rig}`);
    if (decision.kind === 'assign' && o.carId) out.add(`${o.coast ? 'coast' : 'move'}:${o.carId}`);
    if ((decision.kind === 'command' || decision.kind === 'assign') && o.command) out.add(`cmd:${o.command}`);
    if (o.bonus) out.add('bonus');
  }
  return out;
}

export function dieUsable(i: number): boolean {
  if (!g || !decision || !placing()) return false;
  const p = g.players[decision.player];
  return !p.used[i] && decision.options.some(o => o.dieValue === p.dice[i]);
}
