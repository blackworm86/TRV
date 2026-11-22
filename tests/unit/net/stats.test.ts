import { describe, expect, it } from 'vitest';
import { newGame, play, type CarnageNumbers, type Setup } from '../../../src/game/trv/engine';
import { readResults, resultOf, summarize, type GameResult } from '../../../src/net/stats';

/** Test numbers for Carnage (as in tests/unit/trv/carnage.test.ts): one token of each kind. */
const CARNAGE: CarnageNumbers = {
  hazards: { quake: 1, sand_worm: 1, desert_glass: 1, ramp: 1, fire: 1, pit_trap: 1 },
  damage: { on_fire: 1, ongoing_effect: 1 },
  fireDie: ['+1', '+1', '+2', 'out', 'out', 'eliminated'],
  ongoing: ['transmission_failure', 'card_without_text'],
};

/** A whole random match of `setup`, as the choices a table would have logged. */
function randomChoices(setup: Setup, salt: number): number[] {
  const g = newGame(setup), it = play(g), choices: number[] = [];
  let r = it.next(0), x = salt * 7919;
  for (let k = 0; !r.done; k++) {
    if (k > 20000) throw new Error('game did not end');
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const safe = r.value.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
    const pool = safe.length ? safe : r.value.options.map((o, i) => ({ o, i }));
    const c = pool[x % pool.length].i;
    choices.push(c);
    r = it.next(c);
  }
  return choices;
}

const setupFor = (s: number): Setup => ({
  seed: s.toString(16).padStart(8, '0').padEnd(64, 'e'), startSide: 'a', leaders: true, upgrades: true, carnage: CARNAGE,
  players: [{ name: 'Ada', color: '#b5382c', crew: 'crimson' }, { name: 'Bo', color: '#2f5f9e', crew: 'royal' }, { name: 'TRV', color: '#d9a427', crew: 'yellow', bot: { protocol: 2 } }],
});

/** A record as the store keeps it, with what a test changes. */
const rec = (more: Partial<GameResult> = {}): GameResult => ({
  at: 1, won: false, players: 2, crew: 'crimson', leader: null, team: null, bots: 0, botLevel: 0, carnage: false, upgrades: [], jumps: 0, rounds: 5, ...more,
});

describe('a finished match played again', () => {
  it('gives the winner a win, the others a loss, and every ramp jump to the seat that made it', () => {
    let jumps = 0;
    for (let s = 1; s <= 12 && jumps === 0; s++) {
      const setup = setupFor(s), choices = randomChoices(setup, s);
      const g = newGame(setup), it = play(g);
      it.next(0);
      for (const c of choices) it.next(c);
      const all = [0, 1, 2].map(seat => resultOf(setup, choices, seat, 99)!);
      expect(all.filter(x => x.won)).toHaveLength(1);
      expect(all.findIndex(x => x.won)).toBe(g.winner);
      expect(all.map(x => x.leader)).toEqual(g.players.map(p => p.leader));
      expect(all[0]).toMatchObject({ at: 99, players: 3, crew: 'crimson', bots: 1, botLevel: 2, carnage: true, rounds: g.round });
      expect(all[0].upgrades.length).toBeGreaterThan(0);
      const total = g.frames.filter(f => f.kind === 'jump').length;
      expect(all.reduce((n, x) => n + x.jumps, 0)).toBe(total);
      jumps += total;
    }
    expect(jumps).toBeGreaterThan(0);
  }, 60_000);

  it('is nothing when the choices stop before a winner', () => {
    const setup = setupFor(1);
    expect(resultOf(setup, randomChoices(setup, 1).slice(0, 5), 0, 1)).toBeNull();
  });
});

describe('the statistics of a player', () => {
  it('counts matches, wins, the rate and the best run of wins', () => {
    const s = summarize([rec({ won: true }), rec({ won: true }), rec(), rec({ won: true })]);
    expect(s).toMatchObject({ played: 4, won: 3, winRate: 75, bestStreak: 2 });
  });
  it('names the leader played most and the one that won most, which can differ', () => {
    const s = summarize([rec({ leader: 'betty' }), rec({ leader: 'betty' }), rec({ leader: 'cruft', won: true })]);
    expect(s.favoriteLeader).toEqual({ id: 'betty', played: 2 });
    expect(s.bestLeader).toEqual({ id: 'cruft', won: 1 });
  });
  it('has no best leader without a win with one', () => {
    expect(summarize([rec({ leader: 'betty' })]).bestLeader).toBeNull();
  });
  it('names the upgrade fitted most and adds up the ramp jumps', () => {
    const s = summarize([rec({ upgrades: ['snowplow', 'grappling_hook'], jumps: 2 }), rec({ upgrades: ['snowplow'], jumps: 1 })]);
    expect(s.favoriteUpgrade).toEqual({ id: 'snowplow', times: 2 });
    expect(s.jumps).toBe(3);
  });
  it('counts per crew, against bots, as the Big Rig and with Carnage', () => {
    const s = summarize([rec({ crew: 'royal', won: true, bots: 1 }), rec({ crew: 'royal', team: 'big_rig', carnage: true }), rec({ team: 'final_five' })]);
    expect(s.byCrew).toEqual({ royal: { played: 2, won: 1 }, crimson: { played: 1, won: 0 } });
    expect(s).toMatchObject({ vsBots: { played: 1, won: 1 }, bigRig: 1, finalFive: 1, carnage: 1 });
  });
  it('is all zero without matches', () => {
    expect(summarize([])).toMatchObject({ played: 0, won: 0, winRate: 0, bestStreak: 0, favoriteLeader: null, favoriteUpgrade: null });
  });
});

describe('records read from the store', () => {
  it('come oldest first and skip what is not a record', () => {
    const list = readResults({ B2: rec({ at: 5, won: true }), A1: rec({ at: 2 }), X: { at: 3 } });
    expect(list.map(r => r.at)).toEqual([2, 5]);
  });
});
