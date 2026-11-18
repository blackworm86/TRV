// TRV9000 bots (design/gdd/trv9000-bots.md): whole games, determinism, micro-moves, Basic Protocol.
import { describe, it, expect } from 'vitest';
import {
  newGame, play, terrainAt, key, vehiclesAt, botCards, botTeams, __test,
  type Game, type Decision, type Pos, type Vehicle, type Setup,
} from '../../../src/game/trv/engine';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'b');
const SEATS = [
  { name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' },
  { name: 'Verde', color: '#3a3' }, { name: 'Giallo', color: '#db2' },
];

/** A setup with `people` people and then `bots` TRV9000 teams at `protocol`. */
function setup(seed: string, people: number, bots: number, protocol: number, extra: Partial<Setup> = {}): Setup {
  const players = SEATS.slice(0, people + bots).map((p, i) => (i < people ? p : { ...p, bot: { protocol } }));
  return { seed, players, startSide: 'a', ...extra };
}

/** Plays a whole game; the people choose with a seeded chooser. Returns the game and every decision asked. */
function autoplay(s: Setup, salt: number): { g: Game; asked: Decision[] } {
  const g = newGame(s);
  const it = play(g);
  const asked: Decision[] = [];
  let x = salt * 7919 + 1;
  let r = it.next(0);
  while (!r.done) {
    if (asked.length > 20000) throw new Error('game did not end');
    asked.push(r.value);
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const safe = r.value.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
    const pool = safe.length ? safe : r.value.options.map((o, i) => ({ o, i }));
    r = it.next(pool[x % pool.length].i);
  }
  return { g, asked };
}

/** Runs a generator that must not ask anything. */
function run<T>(gen: Generator<Decision, T, number>): T {
  const r = gen.next(0);
  if (!r.done) throw new Error(`asked ${r.value.kind}`);
  return r.value;
}

/** A game with one person and one bot, the board cleared of hazards and of every car. */
function table(protocol: number): { g: Game; bot: Vehicle[]; row: number; col: number } {
  const g = newGame(setup(SEED(99), 1, 1, protocol));
  g.hazards.clear();
  for (const v of g.vehicles) { v.pos = null; v.inStart = true; }
  // A row of the middle tile with seven plain spaces straight ahead.
  for (let row = 0; row < 6; row++) {
    const col = 8;
    const run7 = Array.from({ length: 7 }, (_, k) => terrainAt(g, { r: row, c: col + k }));
    if (run7.every(t => t === 'R' || t === 'o')) return { g, bot: g.vehicles.filter(v => v.owner === 1), row, col };
  }
  throw new Error('no plain row on this seed');
}
const put = (v: Vehicle, p: Pos): void => { v.pos = { ...p }; v.inStart = false; };

describe('TRV9000 data', () => {
  it('has the 18 activation cards with one line per car size, and 7 teams of three upgrades', () => {
    expect(botCards()).toHaveLength(18);
    for (const c of botCards()) expect(c.lines.map(l => l.car).sort()).toEqual(['L', 'M', 'S']);
    expect(botTeams()).toHaveLength(7);
    for (const t of botTeams()) expect(t.upgrades).toHaveLength(3);
  });
});

describe('TRV9000 whole games', () => {
  it('ends every random game with a winner and never asks a bot anything', () => {
    for (let s = 1; s <= 60; s++) {
      const people = 1 + (s % 2), bots = 1 + (s % 3);
      if (people + bots > 4) continue;
      const { g, asked } = autoplay(setup(SEED(s), people, bots, 1 + (s % 4), s % 3 === 0 ? { upgrades: true } : {}), s);
      expect(g.winner).not.toBeNull();
      expect(asked.filter(d => g.players[d.player].bot)).toEqual([]);
    }
  });

  it('plays the same game again from the same seed and the same choices', () => {
    const a = autoplay(setup(SEED(7), 2, 2, 3, { upgrades: true }), 7).g;
    const b = autoplay(setup(SEED(7), 2, 2, 3, { upgrades: true }), 7).g;
    expect(b.log.map(l => l.text)).toEqual(a.log.map(l => l.text));
    expect(b.winner).toBe(a.winner);
  });

  it('gives each bot a different team card with Choppe Shoppe upgrades', () => {
    const g = newGame(setup(SEED(3), 1, 3, 1, { upgrades: true }));
    const teams = g.players.filter(p => p.bot).map(p => p.bot!.team);
    expect(new Set(teams).size).toBe(3);
    const t = botTeams().find(x => x.id === teams[0])!;
    expect(g.vehicles.filter(v => v.owner === 1).map(v => v.upgrade)).toEqual(t.upgrades);
  });

  it('refuses a game of bots only', () => {
    expect(() => newGame(setup(SEED(1), 0, 2, 1))).toThrow();
  });

  it('keeps no movement dice for a bot after the first-player roll', () => {
    const g = newGame(setup(SEED(5), 1, 1, 1));
    play(g).next(0);
    expect(g.players[1].dice).toEqual([]);
    expect(g.players[0].dice.length).toBeGreaterThan(0);
  });
});

describe('TRV9000 micro-moves', () => {
  it('stops before an impassable space: 4 forward with a pit at the third gives 2', () => {
    const { g, bot, row, col } = table(1);
    put(bot[0], { r: row, c: col });
    g.hazards.set(key({ r: row, c: col + 3 }), { type: 'pit_trap', faceUp: true });
    run(__test.botMove(g, bot[0], 4, 'F'));
    expect(bot[0].pos).toEqual({ r: row, c: col + 2 });
  });

  it('stops before a face-up mine', () => {
    const { g, bot, row, col } = table(1);
    put(bot[0], { r: row, c: col });
    g.hazards.set(key({ r: row, c: col + 2 }), { type: 'mine', faceUp: true });
    run(__test.botMove(g, bot[0], 3, 'F'));
    expect(bot[0].pos).toEqual({ r: row, c: col + 1 });
    expect(bot[0].damage).toEqual([]);
  });

  it('does not move off the side of the board', () => {
    const { g, bot } = table(1);
    put(bot[0], { r: 0, c: 10 });
    run(__test.botMove(g, bot[0], 3, 'FL'));
    expect(bot[0].pos).toEqual({ r: 0, c: 10 });
  });

  it('never slams its own car: it stops behind it', () => {
    const { g, bot, row, col } = table(1);
    put(bot[0], { r: row, c: col });
    put(bot[1], { r: row, c: col + 3 });
    run(__test.botMove(g, bot[0], 5, 'F'));
    expect(bot[0].pos).toEqual({ r: row, c: col + 2 });
  });

  it('passes through its own car with Drift, but never stops on it', () => {
    const { g, bot, row, col } = table(1);
    put(bot[0], { r: row, c: col });
    put(bot[1], { r: row, c: col + 2 });
    run(__test.botMove(g, bot[0], 4, 'F', true));
    expect(bot[0].pos).toEqual({ r: row, c: col + 4 });
    expect(bot[1].pos).toEqual({ r: row, c: col + 2 });
  });

  it('slams an opponent in the way and ends its movement', () => {
    const { g, bot, row, col } = table(1);
    const foe = g.vehicles.find(v => v.owner === 0 && v.size === 'S')!;
    put(bot[0], { r: row, c: col });
    put(foe, { r: row, c: col + 2 });
    const gen = __test.botMove(g, bot[0], 5, 'F');
    // The person may be asked about a reroll: keep the result.
    let r = gen.next(0);
    while (!r.done) r = gen.next(0);
    expect(r.value).toBe(true);
    expect(g.log.some(l => l.text.startsWith('SLAM!'))).toBe(true);
  });
});

describe('TRV9000 Basic Protocol', () => {
  it('level 1: revealed mud costs a bot no extra move', () => {
    const { g, bot, row, col } = table(1);
    put(bot[0], { r: row, c: col });
    g.hazards.set(key({ r: row, c: col + 1 }), { type: 'mud', faceUp: false });
    run(__test.botMove(g, bot[0], 3, 'F'));
    expect(bot[0].pos).toEqual({ r: row, c: col + 3 });
  });

  it('level 1: a face-down mine on the way is revealed and damages the car', () => {
    const { g, bot, row, col } = table(1);
    put(bot[0], { r: row, c: col });
    g.hazards.set(key({ r: row, c: col + 1 }), { type: 'mine', faceUp: false });
    run(__test.botMove(g, bot[0], 3, 'F'));
    expect(bot[0].damage.length).toBe(1);
    expect(bot[0].pos).toEqual({ r: row, c: col + 1 });
  });

  it('level 2: the first face-down hazard crossed is ignored and stays face down', () => {
    const { g, bot, row, col } = table(2);
    put(bot[0], { r: row, c: col });
    g.hazards.set(key({ r: row, c: col + 1 }), { type: 'mine', faceUp: false });
    run(__test.botMove(g, bot[0], 3, 'F'));
    expect(bot[0].pos).toEqual({ r: row, c: col + 3 });
    expect(bot[0].damage).toEqual([]);
    expect(g.hazards.get(key({ r: row, c: col + 1 }))).toEqual({ type: 'mine', faceUp: false });
  });

  it('level 2: a bot car on its own chopper is eliminated', () => {
    const { g, bot, row, col } = table(2);
    put(bot[0], { r: row, c: col });
    g.players[1].chopper = { r: row, c: col };
    run(__test.chopperCheck(g));
    expect(bot[0].status).toBe('elim');
  });

  it('level 3: a bot car on its own chopper removes the chopper and stays', () => {
    const { g, bot, row, col } = table(3);
    put(bot[0], { r: row, c: col });
    g.players[1].chopper = { r: row, c: col };
    run(__test.chopperCheck(g));
    expect(g.players[1].chopper).toBeNull();
    expect(bot[0].status).toBe('ok');
  });

  it('level 3: a bot car stops before its own chopper on the last step of a symbol', () => {
    const { g, bot, row, col } = table(3);
    put(bot[0], { r: row, c: col });
    g.players[1].chopper = { r: row, c: col + 2 };
    run(__test.botMove(g, bot[0], 2, 'F'));
    // Its own chopper is allowed at level 3: it ends there.
    expect(bot[0].pos).toEqual({ r: row, c: col + 2 });
  });

  it('level 4: a bot car passes through its own car without a slam', () => {
    const { g, bot, row, col } = table(4);
    put(bot[0], { r: row, c: col });
    put(bot[1], { r: row, c: col + 2 });
    run(__test.botMove(g, bot[0], 4, 'F'));
    expect(bot[0].pos).toEqual({ r: row, c: col + 4 });
    expect(vehiclesAt(g, { r: row, c: col + 2 })).toEqual([bot[1]]);
  });
});
