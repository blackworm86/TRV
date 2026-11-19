import { describe, it, expect } from 'vitest';
import {
  BOT_PREFIX, CODE_ALPHABET, CODE_LENGTH, acceptable, addBot, isBotSeat, removeBot, undoable, backToLobby, cleanCode, closeRoom, createRoom, freeCrew, joinRoom, leaveRoom,
  newRoomCode, readRoom, roomPath, seatOf, startMatch, startProblem, type Room, type RoomStore,
} from '../../../src/net/room';
import { createTreeStore, memoryBacking, type TreeBacking } from '../../../src/net/tree-store';
import { newGame, play, type Decision, type Game } from '../../../src/game/trv/engine';

const CREWS = ['red', 'blue', 'green', 'yellow'];
const COLOR = (crew: string): string => `#${crew}`;
const OPTIONS = { startSide: 'a' as const, leaders: false, upgrades: false };
const SEED = 'ab'.repeat(32);
const NOW = 1000;
/** Fills with a fixed byte, so room codes are known. */
const fillWith = (b: number) => (bytes: Uint8Array): Uint8Array => bytes.fill(b);
const CODE = CODE_ALPHABET[7].repeat(CODE_LENGTH);

function clients(n: number): { backing: TreeBacking; stores: RoomStore[] } {
  const backing = memoryBacking();
  return { backing, stores: Array.from({ length: n }, (_, i) => createTreeStore(backing, `u${i}`)) };
}
async function room(store: RoomStore, code = CODE): Promise<Room> {
  return readRoom(await store.read(roomPath(code)))!;
}
/** A room with `n` players seated (the first is the host). */
async function seated(n: number): Promise<RoomStore[]> {
  const { stores } = clients(n);
  await createRoom(stores[0], { name: 'Ada', crew: 'red' }, OPTIONS, fillWith(7), NOW);
  for (let i = 1; i < n; i++) await joinRoom(stores[i], CODE, { name: `G${i}` }, CREWS, NOW + i);
  return stores;
}

describe('room codes', () => {
  it('are made of unambiguous characters', () => {
    expect(newRoomCode(fillWith(7))).toBe(CODE);
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });
  it('are tidied from what a player types', () => {
    expect(cleanCode(` ${CODE.toLowerCase()} `)).toBe(CODE);
    expect(cleanCode('ABC')).toBe('');
    expect(cleanCode('ABCD0')).toBe('');
  });
});

describe('lobby', () => {
  it('creates a room with the host seated', async () => {
    const [host] = await seated(1);
    const r = await room(host);
    expect(r.host).toBe('u0');
    expect(r.status).toBe('lobby');
    expect(r.seats.u0).toEqual({ name: 'Ada', crew: 'red', joinedAt: NOW });
  });
  it('skips a code already in use', async () => {
    const { stores } = clients(2);
    let calls = 0;
    const fill = (bytes: Uint8Array): Uint8Array => bytes.fill(calls++ === 0 ? 7 : 9);
    await createRoom(stores[0], { name: 'Ada', crew: 'red' }, OPTIONS, fillWith(7), NOW);
    const second = await createRoom(stores[1], { name: 'Bo', crew: 'red' }, OPTIONS, fill, NOW);
    expect(second).toBe(CODE_ALPHABET[9].repeat(CODE_LENGTH));
  });
  it('seats a guest on a free crew and gives the same seat back on a second join', async () => {
    const [host, guest] = await seated(2);
    expect((await room(host)).seats.u1.crew).toBe('blue');
    const again = await joinRoom(guest, CODE, { name: 'Other' }, CREWS, NOW + 50);
    expect(again.ok && again.room.seats.u1.name).toBe('G1');
  });
  it('refuses an unknown room, a full room and a started match', async () => {
    const { stores } = clients(1);
    expect(await joinRoom(stores[0], CODE, { name: 'x' }, CREWS, NOW)).toEqual({ ok: false, error: 'not-found' });
    const four = await seated(4);
    const backing5 = createTreeStore(memoryBacking(), 'late');
    expect((await joinRoom(backing5, CODE, { name: 'x' }, CREWS, NOW)).ok).toBe(false);
    const r = await room(four[0]);
    expect(Object.keys(r.seats)).toHaveLength(4);
    expect(freeCrew(r, CREWS)).toBe('red'); // all taken: falls back to the first
  });
  it('refuses a fifth player and a late joiner', async () => {
    const backing = memoryBacking();
    const s = Array.from({ length: 5 }, (_, i) => createTreeStore(backing, `u${i}`));
    await createRoom(s[0], { name: 'Ada', crew: 'red' }, OPTIONS, fillWith(7), NOW);
    for (let i = 1; i < 4; i++) await joinRoom(s[i], CODE, { name: `G${i}` }, CREWS, NOW + i);
    expect(await joinRoom(s[4], CODE, { name: 'x' }, CREWS, NOW + 9)).toEqual({ ok: false, error: 'full' });
    await leaveRoom(s[3], CODE);
    await startMatch(s[0], CODE, await room(s[0]), SEED, COLOR);
    expect(await joinRoom(s[4], CODE, { name: 'x' }, CREWS, NOW + 9)).toEqual({ ok: false, error: 'started' });
  });
  it('says why a match cannot start', async () => {
    const [host] = await seated(1);
    expect(startProblem(await room(host))).toBe('few');
    const two = await seated(2);
    await two[1].write(roomPath(CODE, 'seats', 'u1', 'crew'), 'red');
    expect(startProblem(await room(two[0]))).toBe('crews');
    await two[1].write(roomPath(CODE, 'seats', 'u1', 'crew'), 'green');
    expect(startProblem(await room(two[0]))).toBe(null);
  });
  it('closes for everybody when the host closes it', async () => {
    const [host, guest] = await seated(2);
    const seen: unknown[] = [];
    guest.watch(roomPath(CODE), v => seen.push(v));
    await closeRoom(host, CODE);
    expect(seen[seen.length - 1]).toBe(null);
  });
});

describe('Final Five and Big Rig seats', () => {
  it('starts a match with the team of each seat in the setup, one of each per match', async () => {
    // Arrange: host (red) picks the Big Rig, the guest (blue) the Big Rig too.
    const [host, guest] = await seated(2);
    await host.write(roomPath(CODE, 'seats', 'u0', 'team'), 'big_rig');
    await guest.write(roomPath(CODE, 'seats', 'u1', 'team'), 'big_rig');
    expect(startProblem(await room(host))).toBe('teams');
    // Act: the guest takes the Final Five instead, and the host starts.
    await guest.write(roomPath(CODE, 'seats', 'u1', 'team'), 'final_five');
    expect(startProblem(await room(host))).toBe(null);
    await startMatch(host, CODE, await room(host), SEED, COLOR);
    // Assert
    const r = await room(host);
    expect(r.setup!.players.map(p => p.team)).toEqual(['big_rig', 'final_five']);
  });
  it('ignores an unknown team and a team on a TRV9000 seat', () => {
    const r = readRoom({ host: 'u0', seats: {
      u0: { name: 'A', crew: 'red', joinedAt: 1, team: 'tank' }, 'trv9000-1': { name: 'TRV9000 1', crew: 'blue', joinedAt: 2, bot: true, team: 'big_rig' },
      u1: { name: 'B', crew: 'green', joinedAt: 3, team: 'big_rig' } } })!;
    expect(startProblem(r)).toBe(null);
  });
});

describe('TRV9000 seats', () => {
  it('lets the host seat a team on a free crew, take it off, and not past four seats', async () => {
    // Arrange: host (red) and one guest (blue).
    const [host] = await seated(2);
    // Act
    const id = await addBot(host, CODE, await room(host), CREWS, NOW + 5);
    // Assert: a bot seat on the first free crew, counted as a player.
    let r = await room(host);
    expect(id).toBe(`${BOT_PREFIX}1`);
    expect(r.seats[id!]).toEqual({ name: 'TRV9000 1', crew: 'green', joinedAt: NOW + 5, bot: true });
    expect(isBotSeat(r, id!)).toBe(true);
    expect(isBotSeat(r, 'u1')).toBe(false);
    expect(await addBot(host, CODE, r, CREWS, NOW + 6)).toBe(`${BOT_PREFIX}2`);
    expect(await addBot(host, CODE, await room(host), CREWS, NOW + 7)).toBe(null); // four seats taken
    await removeBot(host, CODE, id!);
    r = await room(host);
    expect(Object.keys(r.seats).sort()).toEqual(['trv9000-2', 'u0', 'u1']);
    await expect(removeBot(host, CODE, 'u1')).rejects.toThrow();
  });
  it('needs at least one person to start', () => {
    const r = readRoom({ host: 'u0', seats: {
      'trv9000-1': { name: 'TRV9000 1', crew: 'red', joinedAt: 1, bot: true }, 'trv9000-2': { name: 'TRV9000 2', crew: 'blue', joinedAt: 2, bot: true } } })!;
    expect(startProblem(r)).toBe('bots');
  });
  it('starts a match with the bot in the setup, at the chosen level', async () => {
    const [host] = await seated(2);
    await host.write(roomPath(CODE, 'options', 'botLevel'), 3);
    await addBot(host, CODE, await room(host), CREWS, NOW + 5);
    await startMatch(host, CODE, await room(host), SEED, COLOR);
    const r = await room(host);
    expect(r.order).toEqual(['u0', 'u1', `${BOT_PREFIX}1`]);
    expect(r.setup!.players[2]).toEqual({ name: 'TRV9000 1', color: '#green', crew: 'green', bot: { protocol: 3 } });
    expect(r.setup!.players[1].bot).toBeUndefined();
  });
});

describe('match', () => {
  it('fixes the seats in sitting order and publishes the setup', async () => {
    const stores = await seated(3);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    const r = await room(stores[2]);
    expect(r.status).toBe('playing');
    expect(r.order).toEqual(['u0', 'u1', 'u2']);
    expect(r.setup).toEqual({ seed: SEED, startSide: 'a', players: [
      { name: 'Ada', color: '#red', crew: 'red' }, { name: 'G1', color: '#blue', crew: 'blue' }, { name: 'G2', color: '#green', crew: 'green' }] });
    expect(seatOf(r, 'u2')).toBe(2);
    expect(seatOf(r, 'nobody')).toBe(-1);
  });
  it('accepts an intent only from the deciding player, at the current log length, for a real option', async () => {
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    const pending = { player: 1, options: 3 };
    await stores[0].write(roomPath(CODE, 'intents', 'u0'), { n: 0, c: 1 }); // not their decision
    expect(acceptable(await room(stores[0]), 0, pending)).toBe(null);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 4, c: 1 }); // stale
    expect(acceptable(await room(stores[0]), 0, pending)).toBe(null);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 0, c: 3 }); // no such option
    expect(acceptable(await room(stores[0]), 0, pending)).toBe(null);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 0, c: 2 });
    expect(acceptable(await room(stores[0]), 0, pending)).toEqual({ uid: 'u1', choice: 2 });
    expect(acceptable(await room(stores[0]), 0, null)).toBe(null);
  });
  it('takes a planned path one choice at a time while the log is inside it', async () => {
    // Arrange: the guest planned three steps from log length 5.
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 5, c: 2, path: [2, 0, 1] });
    const asked = { player: 1, options: 3 };
    // Act + Assert: before the path, nothing; inside it, the choice for that place; after it, nothing.
    expect(acceptable(await room(stores[0]), 4, asked)).toBe(null);
    expect(acceptable(await room(stores[0]), 5, asked)).toEqual({ uid: 'u1', choice: 2 });
    expect(acceptable(await room(stores[0]), 6, asked)).toEqual({ uid: 'u1', choice: 0 });
    expect(acceptable(await room(stores[0]), 7, asked)).toEqual({ uid: 'u1', choice: 1 });
    expect(acceptable(await room(stores[0]), 8, asked)).toBe(null);
    // Another player asked, or an option that does not exist there: not taken.
    expect(acceptable(await room(stores[0]), 6, { player: 0, options: 3 })).toBe(null);
    expect(acceptable(await room(stores[0]), 5, { player: 1, options: 2 })).toBe(null);
  });
  it('keeps a draft pick made in advance until the rules ask that player, then takes its card', async () => {
    // Arrange: everyone picks at once; the guest picked "nitro_kit" in round 0 while the host was being asked.
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 0, c: 0, draft: { r: 0, card: 'nitro_kit' } });
    // Act + Assert: not taken while player 0 decides, nor for another round or a card not in hand.
    expect(acceptable(await room(stores[0]), 0, { player: 0, options: 4, draft: { r: 0, cards: ['a', 'b', 'c', 'd'] } })).toBe(null);
    expect(acceptable(await room(stores[0]), 1, { player: 1, options: 4, draft: { r: 1, cards: ['nitro_kit', 'b', 'c', 'd'] } })).toBe(null);
    expect(acceptable(await room(stores[0]), 1, { player: 1, options: 3, draft: { r: 0, cards: ['b', 'c', 'd'] } })).toBe(null);
    // Taken at any log length once player 1 is asked in that round: the card's place in the hand.
    expect(acceptable(await room(stores[0]), 1, { player: 1, options: 4, draft: { r: 0, cards: ['b', 'c', 'nitro_kit', 'd'] } })).toEqual({ uid: 'u1', choice: 2 });
  });
  it('keeps a crew leader picked in advance until the rules ask that player, then takes that board', async () => {
    // Arrange: everyone picks at once (asked by the user, 2026-11-19); the guest picked "abigail" while the host was being asked.
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 0, c: 0, leader: 'abigail' });
    // Act + Assert: not taken while player 0 decides, nor when that board is not in the player's hand.
    expect(acceptable(await room(stores[0]), 0, { player: 0, options: 2, leader: ['abigail', 'boudreaux'] })).toBe(null);
    expect(acceptable(await room(stores[0]), 1, { player: 1, options: 2, leader: ['boudreaux', 'vince_vamp'] })).toBe(null);
    // Taken once player 1 is asked: the board's place among the two.
    expect(acceptable(await room(stores[0]), 1, { player: 1, options: 2, leader: ['boudreaux', 'abigail'] })).toEqual({ uid: 'u1', choice: 1 });
  });
  it('places the upgrade cards a player planned in advance, in their order, when the rules ask that player', async () => {
    // Arrange: the guest planned two cards while the host was placing its own.
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 0, c: 0, assign: [{ card: 'nitro_kit', car: 'p1M' }, { card: 'spoiler', car: 'p1S' }] });
    const options = [{ card: 'spoiler', car: 'p1S' }, { card: 'spoiler', car: 'p1M' }, { card: 'nitro_kit', car: 'p1S' }, { card: 'nitro_kit', car: 'p1M' }];
    // Act + Assert: nothing while the host decides; then the first planned placement, at any log length.
    expect(acceptable(await room(stores[0]), 3, { player: 0, options: 4, assign: options })).toBe(null);
    expect(acceptable(await room(stores[0]), 7, { player: 1, options: 4, assign: options })).toEqual({ uid: 'u1', choice: 3 });
    // The first one placed: the next planned one.
    expect(acceptable(await room(stores[0]), 8, { player: 1, options: 1, assign: [{ card: 'spoiler', car: 'p1S' }] })).toEqual({ uid: 'u1', choice: 0 });
    // Nothing planned matches: wait.
    expect(acceptable(await room(stores[0]), 8, { player: 1, options: 1, assign: [{ card: 'spoiler', car: 'p1L' }] })).toBe(null);
  });
  it('takes a choice back only for the player who made it, while nothing final followed it', async () => {
    // Arrange: three choices in the log, by players 0, 1 and 1; the first is final (a die was rolled).
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    const deciders = [0, 1, 1];
    await stores[0].write(roomPath(CODE, 'intents', 'u0'), { n: 3, c: -1, undo: true });
    // Act + Assert: player 0 did not make the last choice.
    expect(undoable(await room(stores[0]), 3, 1, deciders)).toBe(null);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 2, c: -1, undo: true }); // stale
    expect(undoable(await room(stores[0]), 3, 1, deciders)).toBe(null);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 3, c: 0 }); // a move, not an undo
    expect(undoable(await room(stores[0]), 3, 1, deciders)).toBe(null);
    await stores[1].write(roomPath(CODE, 'intents', 'u1'), { n: 3, c: -1, undo: true });
    expect(undoable(await room(stores[0]), 3, 1, deciders)).toBe('u1');
    // Nothing to take back once everything in the log is final.
    expect(undoable(await room(stores[0]), 3, 3, deciders)).toBe(null);
  });
  it('goes back to the lobby with the same seats', async () => {
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    await stores[0].write(roomPath(CODE, 'log', '0'), 0);
    await backToLobby(stores[0], CODE);
    const r = await room(stores[1]);
    expect(r.status).toBe('lobby');
    expect(r.setup).toBe(null);
    expect(r.log).toEqual([]);
    expect(Object.keys(r.seats)).toEqual(['u0', 'u1']);
  });
  it('reads a log stored as a record with numeric keys', () => {
    const r = readRoom({ host: 'u0', log: { 0: 3, 1: 0, 2: 5 }, order: { 0: 'u0', 1: 'u1' } })!;
    expect(r.log).toEqual([3, 0, 5]);
    expect(r.order).toEqual(['u0', 'u1']);
  });
});

/** One browser at the table: its own copy of the rules, fed only by the room's log. */
class Table {
  game: Game | null = null;
  private gen: Generator<Decision, void, number> | null = null;
  decision: Decision | null = null;
  applied = 0;
  constructor(readonly store: RoomStore, readonly uid: string, readonly host: boolean) {
    store.watch(roomPath(CODE), raw => this.onRoom(readRoom(raw)));
  }
  private apply(c: number): void {
    const r = this.gen!.next(c);
    this.decision = r.done ? null : r.value;
    this.applied++;
  }
  private onRoom(r: Room | null): void {
    if (!r?.setup) return;
    if (!this.game) {
      this.game = newGame(r.setup);
      this.gen = play(this.game);
      const first = this.gen.next(0);
      this.decision = first.done ? null : first.value;
    }
    while (this.applied < r.log.length) this.apply(r.log[this.applied]);
    if (!this.host) return;
    for (;;) {
      const ok = acceptable(r, this.applied, this.decision && { player: this.decision.player, options: this.decision.options.length });
      if (!ok) break;
      this.choose(ok.choice);
    }
  }
  /** What the interface does when this player picks option `c`. */
  choose(c: number): void {
    if (this.host) { const n = this.applied; this.apply(c); void this.store.write(roomPath(CODE, 'log', String(n)), c); }
    else void this.store.write(roomPath(CODE, 'intents', this.uid), { n: this.applied, c });
  }
}

describe('host as referee', () => {
  it('keeps three tables on the same match, choice by choice', async () => {
    const stores = await seated(3);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    const tables = stores.map((s, i) => new Table(s, `u${i}`, i === 0));
    const STEPS = 120;
    for (let step = 0; step < STEPS && tables[0].decision; step++) {
      const d = tables[0].decision;
      const who = tables[d.player];
      expect(who.decision?.player).toBe(d.player); // the deciding player sees the same decision
      // A player who must not decide tries anyway: the host ignores it.
      const other = tables[(d.player + 1) % 3];
      if (!other.host) other.choose(0);
      who.choose(step % d.options.length);
      expect(tables.map(t => t.applied)).toEqual([step + 1, step + 1, step + 1]);
    }
    const r = await room(stores[0]);
    expect(r.log).toHaveLength(tables[0].applied);
    const state = (t: Table): string => JSON.stringify({ v: t.game!.vehicles, round: t.game!.round, cur: t.game!.current, p: t.game!.players.map(p => p.dice) });
    expect(state(tables[1])).toBe(state(tables[0]));
    expect(state(tables[2])).toBe(state(tables[0]));
  });
  it('keeps two tables on the same match with a TRV9000 team, which never asks anything', async () => {
    // Arrange: host, guest and a bot.
    const stores = await seated(2);
    await addBot(stores[0], CODE, await room(stores[0]), CREWS, NOW + 5);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    const tables = stores.map((s, i) => new Table(s, `u${i}`, i === 0));
    // Act: the people play; the bot's moves come from the rules on each table.
    for (let step = 0; step < 300 && tables[0].decision; step++) {
      const d = tables[0].decision;
      expect(d.player).toBeLessThan(2); // never the bot's seat
      tables[d.player].choose(step % d.options.length);
    }
    // Assert: both tables agree, and the bot has played.
    const g0 = tables[0].game!, state = (t: Table): string => JSON.stringify({ v: t.game!.vehicles, round: t.game!.round, cur: t.game!.current });
    expect(state(tables[1])).toBe(state(tables[0]));
    expect(g0.vehicles.filter(v => v.owner === 2).some(v => !v.inStart || v.status !== 'ok')).toBe(true);
  });
  it('lets a player who reloads catch up from the log', async () => {
    const stores = await seated(2);
    await startMatch(stores[0], CODE, await room(stores[0]), SEED, COLOR);
    const host = new Table(stores[0], 'u0', true), guest = new Table(stores[1], 'u1', false);
    for (let step = 0; step < 30 && host.decision; step++) (host.decision.player === 0 ? host : guest).choose(0);
    const back = new Table(stores[1], 'u1', false);
    expect(back.applied).toBe(host.applied);
    expect(back.decision?.prompt).toBe(host.decision?.prompt);
  });
});
