import { describe, it, expect } from 'vitest';
import { newGame, play, neighbor, oneShotCards, key, __test, type Decision, type Game, type Pos, type Vehicle } from '../../../src/game/trv/engine';

const SEED = '05'.repeat(32);
const PLAYERS = [{ name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' }];

/** A two-player game with One Shots, an empty board and every car in the starting area. */
function game(): Game {
  const g = newGame({ seed: SEED, players: PLAYERS, startSide: 'a', oneShots: true });
  g.hazards.clear();
  return g;
}
/** Puts a car on a space. */
function place(g: Game, id: string, at: Pos): Vehicle {
  const v = g.vehicles.find(x => x.id === id)!;
  v.pos = { ...at };
  v.inStart = false;
  return v;
}
/** Runs a rules generator to the end, answering with `pick` and keeping every question asked. */
function run<T>(gen: Generator<Decision, T, number>, pick: (d: Decision) => number, asked: Decision[] = []): T {
  let r = gen.next(0);
  while (!r.done) { asked.push(r.value); r = gen.next(pick(r.value)); }
  return r.value;
}
/** Answers: play the One Shot (`yes`), shoot the first target, the first option otherwise. */
const answer = (yes: boolean) => (d: Decision): number => (d.kind === 'playCard' ? (yes ? 1 : 0) : d.kind === 'shoot' ? 1 : 0);

const AT: Pos = { r: 2, c: 4 };

describe('One Shots setup', () => {
  it('deals one card to each person and none to a TRV9000 team', () => {
    const g = newGame({ seed: SEED, players: [...PLAYERS, { name: 'Bot', color: '#999', bot: { protocol: 1 } }], startSide: 'a', oneShots: true });
    play(g).next(0);
    const ids = oneShotCards().map(c => c.id);
    expect(ids).toHaveLength(6);
    expect(ids).toContain(g.oneShots![0]);
    expect(ids).toContain(g.oneShots![1]);
    expect(g.oneShots![0]).not.toBe(g.oneShots![1]);
    expect(g.oneShots![2]).toBeNull();
  });
  it('deals nothing when the module is off', () => {
    const g = newGame({ seed: SEED, players: PLAYERS, startSide: 'a' });
    play(g).next(0);
    expect(g.oneShots).toBeNull();
  });
});

describe('the One Shot cards', () => {
  it('Guided Missile: the shot hits without the shooting die, and the card leaves the game', () => {
    const g = game();
    g.oneShots = ['guided_missile', null];
    const car = place(g, 'p0M', AT), target = place(g, 'p1M', neighbor(AT, 'F'));
    const asked: Decision[] = [];
    run(__test.shoot(g, 0, car), answer(true), asked);
    expect(asked.some(d => d.kind === 'playCard')).toBe(true);
    expect(g.frames.some(f => f.kind === 'roll' && f.die?.die === 'shooting')).toBe(false);
    expect(target.damage).toHaveLength(1);
    expect(g.oneShots![0]).toBeNull();
  });
  it('Guided Missile kept: the die is rolled and the card stays in hand', () => {
    const g = game();
    g.oneShots = ['guided_missile', null];
    const car = place(g, 'p0M', AT);
    place(g, 'p1M', neighbor(AT, 'F'));
    run(__test.shoot(g, 0, car), answer(false));
    expect(g.frames.some(f => f.kind === 'roll' && f.die?.die === 'shooting')).toBe(true);
    expect(g.oneShots![0]).toBe('guided_missile');
  });
  it('Camouflage Coating: the vehicle takes no damage token', () => {
    const g = game();
    g.oneShots = [null, 'camouflage_coating'];
    const v = place(g, 'p1M', AT);
    run(__test.damageWith(g, v, { type: 'dent' }), answer(true));
    expect(v.damage).toHaveLength(0);
    expect(g.oneShots![1]).toBeNull();
  });
  it('Camouflage Coating is not asked for an inoperable car', () => {
    const g = game();
    g.oneShots = [null, 'camouflage_coating'];
    const v = place(g, 'p1M', AT);
    v.status = 'inop';
    const asked: Decision[] = [];
    run(__test.damageWith(g, v, { type: 'dent' }), answer(true), asked);
    expect(asked).toHaveLength(0);
    expect(g.oneShots![1]).toBe('camouflage_coating');
  });
  it('Grapeshot: a second shot at the same target while it is still in the arc', () => {
    const g = game();
    g.oneShots = ['grapeshot', null];
    const car = place(g, 'p0L', AT);
    place(g, 'p1L', neighbor(AT, 'F'));
    run(__test.shoot(g, 0, car), answer(true));
    expect(g.frames.filter(f => f.kind === 'shot' && !f.why)).toHaveLength(2);
    expect(g.oneShots![0]).toBeNull();
  });
  it('Grapeshot is not offered when the player does not shoot', () => {
    const g = game();
    g.oneShots = ['grapeshot', null];
    const car = place(g, 'p0L', AT);
    place(g, 'p1L', neighbor(AT, 'F'));
    const asked: Decision[] = [];
    run(__test.shoot(g, 0, car), d => (d.kind === 'shoot' ? 0 : 1), asked);
    expect(asked.some(d => d.kind === 'playCard')).toBe(false);
  });
  it('AI Danger Avoidance: the car goes to a chosen space next to it instead of being eliminated', () => {
    const g = game();
    g.oneShots = ['ai_danger_avoidance', null];
    const car = place(g, 'p0M', AT);
    const wall = neighbor(AT, 'F');
    // A face-up pit trap makes the space impassable (CDR p3).
    g.hazards.set(key(wall), { type: 'pit_trap', faceUp: true });
    const asked: Decision[] = [];
    run(__test.enter(g, car, wall, { left: 1 }, 'F'), d => (d.kind === 'playCard' ? 1 : 0), asked);
    const dodge = asked.find(d => d.kind === 'dodge')!;
    expect(car.status).toBe('ok');
    expect(car.pos).toEqual(dodge.options[0].pos);
    expect(g.oneShots![0]).toBeNull();
  });
  it('AI Danger Avoidance onto a free space: the move goes on from there', () => {
    const g = game();
    g.oneShots = ['ai_danger_avoidance', null];
    const car = place(g, 'p0M', AT);
    const wall = neighbor(AT, 'F');
    g.hazards.set(key(wall), { type: 'pit_trap', faceUp: true });
    const ctx = { left: 2, drift: true, driftUsed: false };
    const stop = run(__test.enter(g, car, wall, ctx, 'F'), d => (d.kind === 'playCard' ? 1 : 0));
    expect(stop).toBe(false);
    expect(ctx.left).toBe(2);
    expect(g.frames.some(f => f.kind === 'slam')).toBe(false);
  });
  it('AI Danger Avoidance onto an occupied space: the move stops there with a slam, without drift', () => {
    const g = game();
    g.oneShots = ['ai_danger_avoidance', null];
    const car = place(g, 'p0M', AT);
    const wall = neighbor(AT, 'F');
    g.hazards.set(key(wall), { type: 'pit_trap', faceUp: true });
    const ctx = { left: 2, drift: true, driftUsed: false };
    const asked: Decision[] = [];
    // The first space offered is taken by an opponent's car.
    run(__test.enter(g, car, wall, { left: 0, drift: false, driftUsed: false }, 'F'), d => (d.kind === 'playCard' ? 1 : 0), asked);
    const first = asked.find(d => d.kind === 'dodge')!.options[0].pos!;
    const g2 = game();
    g2.oneShots = ['ai_danger_avoidance', null];
    const car2 = place(g2, 'p0M', AT);
    g2.hazards.set(key(wall), { type: 'pit_trap', faceUp: true });
    place(g2, 'p1L', first);
    const stop = run(__test.enter(g2, car2, wall, ctx, 'F'), d => (d.kind === 'playCard' ? 1 : 0));
    expect(stop).toBe(true);
    expect(ctx.left).toBe(0);
    expect(g2.frames.some(f => f.kind === 'slam')).toBe(true);
  });
});

describe('whole games with One Shots', () => {
  it('end with a winner, a card played is never offered again, with the other modules and the Big Rig in play', () => {
    let plays = 0;
    for (let s = 1; s <= 30; s++) {
      const players = s % 3 === 0
        ? [...PLAYERS, { name: 'Rig', color: '#0a0', team: 'big_rig' as const }]
        : [...PLAYERS, { name: 'Bot', color: '#999', bot: { protocol: 2 } }];
      const g = newGame({ seed: s.toString(16).padStart(8, '0').padEnd(64, '5'), players, startSide: 'a', oneShots: true, leaders: s % 2 === 0, upgrades: s % 2 === 0 });
      const gone = new Set<string>();
      const it = play(g);
      let r = it.next(0), x = s * 7919;
      for (let k = 0; !r.done; k++) {
        if (k > 20000) throw new Error('game did not end');
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        const d = r.value;
        if (d.kind === 'playCard') {
          const id = d.options[1].card!;
          expect(gone.has(id)).toBe(false);
          expect(g.players[d.player].bot).toBeUndefined();
          // Play it half of the time.
          if (x % 2) { gone.add(id); plays++; }
          r = it.next(x % 2);
          if (x % 2) expect(g.oneShots![d.player]).toBeNull();
          continue;
        }
        const safe = d.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
        const pool = safe.length ? safe : d.options.map((o, i) => ({ o, i }));
        r = it.next(pool[x % pool.length].i);
      }
      expect(g.winner).not.toBeNull();
    }
    expect(plays).toBeGreaterThan(0);
  }, 120_000);
});
