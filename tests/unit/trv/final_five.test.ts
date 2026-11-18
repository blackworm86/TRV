// The Final Five (design/gdd/big-rig-final-five.md §9; BRaFF p3, p7 and the FAQ): setup, dice,
// the two-motorcycle turn, coasting, drifting, slams, minor damage and whole games.
import { describe, it, expect } from 'vitest';
import {
  newGame, play, terrainAt, vehiclesAt, commandsOf, __test,
  type Game, type Decision, type Pos, type Vehicle, type Setup, type Player,
} from '../../../src/game/trv/engine';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'f');
const BIKER = { name: 'Moto', color: '#db2', team: 'final_five' as const };
const CARS = [{ name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' }, { name: 'Verde', color: '#3a3' }];

/** Runs a generator, answering each decision with `choose` (default: the first option). */
function drive<T>(gen: Generator<Decision, T, number>, choose: (d: Decision) => number = () => 0, asked: Decision[] = []): T {
  let r = gen.next(0);
  for (let n = 0; !r.done; n++) {
    if (n > 20000) throw new Error('too many decisions');
    asked.push(r.value);
    r = gen.next(choose(r.value));
  }
  return r.value;
}

/** Plays a whole game with a seeded chooser that avoids dangerous options when it can. */
function autoplay(s: Setup, salt: number): Game {
  const g = newGame(s);
  let x = salt * 7919 + 1;
  drive(play(g), d => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const safe = d.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
    const pool = safe.length ? safe : d.options.map((o, i) => ({ o, i }));
    return pool[x % pool.length].i;
  });
  return g;
}

/** A game of the Final Five against one car crew, the table cleared, in round 2, with a plain row of seven spaces. */
function table(): { g: Game; p: Player; bikes: Vehicle[]; row: number; col: number } {
  for (let s = 1; s < 50; s++) {
    const g = newGame({ seed: SEED(s), players: [BIKER, CARS[0]], startSide: 'a' });
    g.hazards.clear();
    g.round = 2;
    for (const v of g.vehicles) { v.pos = null; v.inStart = true; }
    for (const row of [2, 3]) {
      const col = 8;
      if (Array.from({ length: 7 }, (_, k) => terrainAt(g, { r: row, c: col + k })).every(t => t === 'R')) {
        const p = g.players[0];
        return { g, p, bikes: g.vehicles.filter(v => v.owner === 0), row, col };
      }
    }
  }
  throw new Error('no plain row');
}
const put = (v: Vehicle, q: Pos): void => { v.pos = { ...q }; v.inStart = false; };
const dice = (p: Player, values: number[]): void => { p.dice = [...values]; p.used = values.map(() => false); };
/** Picks the option of an assign decision for a vehicle (move or coast) and a die value. */
const pick = (d: Decision, carId: string, value: number, coast = false): number =>
  d.options.findIndex(o => o.carId === carId && o.dieValue === value && !!o.coast === coast);

describe('Final Five setup', () => {
  it('gives the player five small motorcycles with their markings and no leader or upgrade', () => {
    const g = newGame({ seed: SEED(1), players: [{ ...BIKER, leader: 'bumpo', upgrades: ['spoiler', null, null] }, CARS[0]], startSide: 'a', leaders: true, upgrades: true });
    const bikes = g.vehicles.filter(v => v.owner === 0);
    expect(bikes.map(v => [v.size, v.bike, v.upgrade])).toEqual([0, 1, 2, 3, 4].map(k => ['S', k, null]));
    expect(g.players[0].leader).toBeNull();
    expect(g.players[0].tokens).toBe(0);
    expect(commandsOf(g.players[0]).map(c => [c.id, c.values])).toEqual([['airstrike', [1, 2, 3, 4, 5, 6]], ['nitro', [1, 2]], ['repair', [6]]]);
  });

  it('refuses two Final Five players and a TRV9000 Final Five', () => {
    expect(() => newGame({ seed: SEED(1), players: [BIKER, { ...BIKER, name: 'Altro' }], startSide: 'a' })).toThrow();
    expect(() => newGame({ seed: SEED(1), players: [CARS[0], { ...BIKER, bot: { protocol: 1 } }], startSide: 'a' })).toThrow();
  });

  it('rolls six dice of 1-6 for the Final Five in the first round and asks no leader or draft of them', () => {
    const g = newGame({ seed: SEED(3), players: [BIKER, CARS[0], CARS[1]], startSide: 'a', leaders: true, upgrades: true });
    const asked: Decision[] = [];
    const it = play(g);
    let r = it.next(0);
    while (!r.done && !(r.value.kind === 'assign' && r.value.player === 0)) { asked.push(r.value); r = it.next(0); }
    expect(g.players[0].dice).toHaveLength(6);
    expect(asked.filter(d => d.player === 0 && ['leader', 'draft', 'upgradeAssign'].includes(d.kind))).toEqual([]);
  });
});

describe('First-player roll', () => {
  it('rolls each crew its own dice, shows the roll and starts with the lowest total', () => {
    for (let s = 1; s <= 10; s++) {
      const g = newGame({ seed: SEED(s), players: [BIKER, CARS[0], CARS[1]], startSide: 'a' });
      play(g).next(0);
      const orders = g.frames.filter(f => f.kind === 'order').map(f => f.order!);
      expect(orders.length).toBeGreaterThan(0);
      for (const o of orders) expect(o.rolls.map(r => r.values.length)).toEqual([6, 4, 4]);
      const last = orders[orders.length - 1];
      const totals = last.rolls.map(r => r.values.reduce((a, b) => a + b, 0));
      expect(last.first).toBe(totals.indexOf(Math.min(...totals)));
      expect(g.firstPlayer).toBe(last.first);
      // The dice of the roll are the first round's dice.
      expect(g.players[0].dice).toEqual(last.rolls[0].values);
    }
  });
});

describe('Final Five turn', () => {
  it('moves two motorcycles with two dice, in the order the player chooses', () => {
    const { g, p, bikes, row, col } = table();
    put(bikes[0], { r: row, c: col }); put(bikes[1], { r: row === 2 ? 4 : 1, c: col });
    dice(p, [2, 3, 1, 1, 5, 4]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => {
      if (d.kind === 'assign') return asked.filter(x => x.kind === 'assign').length === 1 ? pick(d, bikes[0].id, 2) : pick(d, bikes[1].id, 3);
      if (d.kind === 'first') return 1;
      if (d.kind === 'step') return 1;
      return 0;
    }, asked);
    expect(asked.filter(d => d.kind === 'assign')).toHaveLength(2);
    expect(asked.find(d => d.kind === 'first')!.options.map(o => o.carId)).toEqual([bikes[0].id, bikes[1].id]);
    expect(bikes[0].pos).toEqual({ r: row, c: col + 2 });
    expect(bikes[1].moved && bikes[0].moved).toBe(true);
    expect(p.used.filter(Boolean)).toHaveLength(2);
    // The second motorcycle chosen moved first.
    const moves = g.frames.filter(f => f.kind === 'move').map(f => f.vehicleId);
    expect(moves[0]).toBe(bikes[1].id);
  });

  it('once per round puts one die on a command, here Nitro on the motorcycle that moves', () => {
    const { g, p, bikes, row, col } = table();
    put(bikes[0], { r: row, c: col });
    dice(p, [1, 4, 6, 6, 5, 5]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => {
      if (d.kind === 'assign') {
        const n = asked.filter(x => x.kind === 'assign').length;
        return n === 1 ? d.options.findIndex(o => o.command === 'nitro') : pick(d, bikes[0].id, 4);
      }
      return d.kind === 'step' ? 1 : 0;
    }, asked);
    expect(bikes[0].pos).toEqual({ r: row, c: col + 5 });
    expect(p.commandUsed).toBe(true);
    // The second assignment offers no command any more.
    expect(asked.filter(d => d.kind === 'assign')[1].options.some(o => o.command)).toBe(false);
  });

  it('coasts a motorcycle up to four times a round, twice in one turn with the same one', () => {
    const { g, p, bikes, row, col } = table();
    for (const b of bikes) b.moved = true;
    put(bikes[0], { r: row, c: col });
    bikes[0].coasts = 2;
    dice(p, [3, 5]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? pick(d, bikes[0].id, d.options.find(o => o.carId === bikes[0].id)!.dieValue!, true) : d.kind === 'step' ? 1 : 0), asked);
    expect(bikes[0].coasts).toBe(4);
    expect(bikes[0].pos).toEqual({ r: row, c: col + 2 });
    // A fifth coast is not offered.
    p.used = [false];
    p.dice = [2];
    const again: Decision[] = [];
    drive(__test.turn(g, p), d => d.options.findIndex(o => o.carId !== bikes[0].id), again);
    expect(again.find(d => d.kind === 'assign')!.options.some(o => o.carId === bikes[0].id)).toBe(false);
  });
});

describe('Final Five on the road', () => {
  it('drifts through another vehicle while it has moves left', () => {
    const { g, p, bikes, row, col } = table();
    const car = g.vehicles.find(v => v.owner === 1)!;
    put(bikes[0], { r: row, c: col }); put(car, { r: row, c: col + 1 });
    dice(p, [3]);
    drive(__test.turn(g, p), d => (d.kind === 'step' ? 1 : 0));
    expect(bikes[0].pos).toEqual({ r: row, c: col + 3 });
    expect(car.pos).toEqual({ r: row, c: col + 1 });
    expect(g.frames.some(f => f.kind === 'slam')).toBe(false);
  });

  it('slams where its move ends: only the direction die, and the motorcycle moves', () => {
    const { g, p, bikes, row, col } = table();
    const car = g.vehicles.find(v => v.owner === 1)!;
    put(bikes[0], { r: row, c: col }); put(car, { r: row, c: col + 1 });
    dice(p, [1]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'step' ? 1 : 0), asked);
    expect(g.frames.some(f => f.kind === 'slam')).toBe(true);
    expect(g.lastRoll.map(r => r.die)).toEqual(['direction']);
    expect(asked.some(d => d.kind === 'slamReroll' || d.kind === 'dirReroll')).toBe(false);
    expect(car.pos).toEqual({ r: row, c: col + 1 });
    expect(bikes[0].pos).not.toEqual(car.pos);
  });

  it('lets the player choose which of two motorcycles a slam moves', () => {
    const { g, bikes, row, col } = table();
    put(bikes[0], { r: row, c: col }); put(bikes[1], { r: row, c: col });
    bikes[1].z = 1;
    const asked: Decision[] = [];
    drive(__test.slam(g, { r: row, c: col }), d => (d.kind === 'bikeSlam' ? d.options.findIndex(o => o.carId === bikes[0].id) : 0), asked);
    expect(asked.map(d => d.kind)).toContain('bikeSlam');
    expect(bikes[1].pos).toEqual({ r: row, c: col });
    expect(bikes[0].pos).not.toEqual({ r: row, c: col });
  });

  it('takes a minor damage token, becomes inoperable and is repaired without touching the damage pile', () => {
    const { g, p, bikes, row, col } = table();
    put(bikes[0], { r: row, c: col });
    const pile = g.damagePile.length;
    drive(__test.damage(g, bikes[0]));
    expect(bikes[0].status).toBe('inop');
    expect(bikes[0].damage).toEqual([{ type: 'minor' }]);
    expect(g.damagePile.length).toBe(pile);
    drive(__test.damage(g, bikes[0]));
    expect(bikes[0].damage).toHaveLength(1);
    drive(__test.repair(g, p), d => d.options.findIndex(o => o.carId === bikes[0].id));
    expect(bikes[0].status).toBe('ok');
    expect(bikes[0].damage).toEqual([]);
    expect(g.damagePile.length).toBe(pile);
  });

  it('is out of the game when no motorcycle is operable', () => {
    const { g, bikes, row, col } = table();
    bikes.forEach((b, k) => put(b, { r: k % 6, c: col + 1 }));
    for (const b of bikes) drive(__test.damage(g, b));
    expect(g.players[0].out).toBe(true);
    expect(vehiclesAt(g, { r: row, c: col }).length).toBe(0);
  });
});

describe('Final Five whole games', () => {
  it('ends every random game with a winner, with cars, Choppe Shoppe, Carnage and TRV9000 teams', () => {
    for (let s = 1; s <= 40; s++) {
      const others = CARS.slice(0, 1 + (s % 3)).map((c, i) => (s % 4 === 0 && i === 0 ? { ...c, bot: { protocol: 1 + (s % 4) } } : c));
      const extra: Partial<Setup> = s % 3 === 0 ? { leaders: true, upgrades: true } : s % 3 === 1 ? { carnage: true } : {};
      const g = autoplay({ seed: SEED(s), players: [BIKER, ...others], startSide: s % 2 ? 'a' : 'b', ...extra }, s);
      expect(g.winner).not.toBeNull();
    }
  });
});
