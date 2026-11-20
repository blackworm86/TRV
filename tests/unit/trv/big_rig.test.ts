// The Big Rig (design/gdd/big-rig-final-five.md §3-8; BRaFF p3-6 and the FAQ): setup, the
// train move and the steering, Sturdy, Dependable and Solid, slams, shots at a command, the six
// minor damage tokens, being dumped off the rear tile, and whole games.
import { describe, it, expect } from 'vitest';
import {
  newGame, play, terrainAt, key, __test,
  type Game, type Decision, type Pos, type Vehicle, type Setup, type Player,
} from '../../../src/game/trv/engine';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'f');
const RIG = { name: 'Rig', color: '#c80', team: 'big_rig' as const };
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

const put = (v: Vehicle, q: Pos): void => { v.pos = { ...q }; v.inStart = false; };
const dice = (p: Player, values: number[]): void => { p.dice = [...values]; p.used = values.map(() => false); };
/** The index of the option putting a die of `value` on command `rig` (`section:command`). */
const on = (d: Decision, rig: string, value: number): number => d.options.findIndex(o => o.rig === rig && o.dieValue === value);

/**
 * A game of the Big Rig against one car crew, the table cleared, in round 2: the rig on a plain row
 * of nine spaces, rear at `col`, mid at `col + 1`, front at `col + 2`.
 */
function table(): { g: Game; p: Player; parts: Vehicle[]; car: Vehicle; row: number; col: number } {
  for (let s = 1; s < 80; s++) {
    const g = newGame({ seed: SEED(s), players: [RIG, CARS[0]], startSide: 'a' });
    g.hazards.clear();
    g.round = 2;
    g.roadDie = 2;
    for (const v of g.vehicles) { v.pos = null; v.inStart = true; }
    const col = 8;
    for (const row of [2, 3]) {
      if (Array.from({ length: 9 }, (_, k) => terrainAt(g, { r: row, c: col + k })).every(t => t === 'R')) {
        const parts = ['front', 'mid', 'rear'].map(sec => g.vehicles.find(v => v.rig === sec)!);
        put(parts[2], { r: row, c: col }); put(parts[1], { r: row, c: col + 1 }); put(parts[0], { r: row, c: col + 2 });
        return { g, p: g.players[0], parts, car: g.vehicles.find(v => v.owner === 1)!, row, col };
      }
    }
  }
  throw new Error('no plain row');
}

describe('Big Rig setup', () => {
  it('gives the player three large sections, four dice of 1-3 and no leader or upgrade', () => {
    const g = newGame({ seed: SEED(1), players: [{ ...RIG, leader: 'bumpo', upgrades: ['spoiler', null, null] }, CARS[0]], startSide: 'a', leaders: true, upgrades: true });
    const parts = g.vehicles.filter(v => v.owner === 0);
    expect(parts.map(v => [v.rig, v.size, v.upgrade])).toEqual([['front', 'L', null], ['mid', 'L', null], ['rear', 'L', null]]);
    expect(g.players[0].leader).toBeNull();
    expect(g.players[0].rig).toEqual({ steer: null, used: [], placed: {}, damaged: [] });
    const it = play(g);
    let r = it.next(0);
    while (!r.done && !(r.value.player === 0 && r.value.kind === 'steer')) r = it.next(0);
    expect(r.done).toBe(false);
    expect(g.players[0].dice).toHaveLength(4);
    expect(g.players[0].dice.every(v => v >= 1 && v <= 3)).toBe(true);
  });
});

describe('Big Rig turn', () => {
  it('puts a die on the steering in the first turn of the round, then moves like a train', () => {
    const { g, p, parts, row, col } = table();
    dice(p, [3, 2, 1, 1]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'steer' ? d.options.findIndex(o => o.dieValue === 1)
      : d.kind === 'assign' ? on(d, 'front:cow_catcher', 2) : 0), asked);
    expect(asked[0].kind).toBe('steer');
    expect(p.rig!.steer).toBe(1);
    expect(parts.map(v => v.pos)).toEqual([{ r: row, c: col + 4 }, { r: row, c: col + 3 }, { r: row, c: col + 2 }]);
    expect(p.rig!.used).toEqual(['front']);
    // The front section is used: its commands are not offered again this round.
    const again: Decision[] = [];
    drive(__test.turn(g, p), () => 0, again);
    expect(again.some(d => d.kind === 'steer')).toBe(false);
    expect(again.find(d => d.kind === 'assign')!.options.some(o => o.rig!.startsWith('front:'))).toBe(false);
  });

  it('changes lane only with the steering, one change for each point on it', () => {
    const { g, p, parts, row, col } = table();
    p.rig!.steer = 1;
    dice(p, [3]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'step' ? Math.max(0, d.options.findIndex(o => o.label.startsWith('Avanti-sinistra'))) : 0), asked);
    const steps = asked.filter(d => d.kind === 'step');
    expect(steps[0].options).toHaveLength(3);
    expect(steps[1].options).toHaveLength(1);
    expect(p.rig!.steer).toBe(0);
    expect(parts[0].pos!.r).not.toBe(row);
    // The sections behind follow the front one's track.
    expect(parts[1].pos!.r).toBe(parts[0].pos!.r);
    // After three steps the rear section is where the front one went on the first (the lane change).
    const firstStep = g.frames.find(f => f.kind === 'move' && f.vehicleId === parts[0].id)!.at;
    expect(parts[2].pos).toEqual(firstStep);
    expect(firstStep!.r).not.toBe(row);
    expect(col).toBe(8);
  });

  it('only moves with the die on a damaged command', () => {
    const { g, p, parts, row, col } = table();
    p.rig!.steer = 0;
    p.rig!.damaged = ['mid:airstrike'];
    dice(p, [2]);
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'mid:airstrike', 2) : 0));
    expect(parts[0].pos).toEqual({ r: row, c: col + 4 });
    expect(g.log.some(l => l.text.includes('danneggiato'))).toBe(true);
  });

  it('repairs a minor damage of its section with a 3 before moving', () => {
    const { g, p } = table();
    p.rig!.steer = 0;
    p.rig!.damaged = ['rear:hazard_dispenser', 'front:cow_catcher'];
    dice(p, [3]);
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'rear:repair', 3) : 0));
    expect(p.rig!.damaged).toEqual(['front:cow_catcher']);
  });

  it('uses the road die only with Traction Drive', () => {
    const { g, p, parts, row, col } = table();
    p.rig!.steer = 0;
    dice(p, [1, 1]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'mid:traction_drive', 1) : d.kind === 'roadDie' ? 1 : 0), asked);
    expect(parts[0].pos).toEqual({ r: row, c: col + 2 + 1 + g.roadDie });
    const plain: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'rear:targeting_computer', 1) : 0), plain);
    expect(plain.some(d => d.kind === 'roadDie')).toBe(false);
  });
});

describe('Big Rig on the road', () => {
  it('is Sturdy: an oil slick gives a minor damage, the space turns off-road and the rig goes on', () => {
    const { g, p, parts, row, col } = table();
    p.rig!.steer = 0;
    g.hazards.set(key({ r: row, c: col + 3 }), { type: 'oil', faceUp: true });
    dice(p, [2]);
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'front:cow_catcher', 2) : 0));
    expect(parts[0].pos).toEqual({ r: row, c: col + 4 });
    expect(p.rig!.damaged).toHaveLength(1);
    expect(g.hazards.has(key({ r: row, c: col + 3 }))).toBe(false);
    expect(terrainAt(g, { r: row, c: col + 3 })).toBe('o');
  });

  it('a minor damage of its own choosing goes only on the commands a shot may hit: never on Repair (BRaFF p5)', () => {
    // Arrange: an oil slick ahead, so Sturdy gives a minor damage its player places.
    const { g, p, row, col } = table();
    p.rig!.steer = 0;
    g.hazards.set(key({ r: row, c: col + 3 }), { type: 'oil', faceUp: true });
    dice(p, [2]);
    const asked: Decision[] = [];
    // Act
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'front:cow_catcher', 2) : 0), asked);
    // Assert: the six commands with the faded X, one damage on one of them.
    const where = asked.find(d => d.kind === 'rigDamage')!.options.map(o => o.rig!);
    expect(where).toHaveLength(6);
    expect(where.some(k => k.endsWith(':repair'))).toBe(false);
    expect(p.rig!.damaged.every(k => !k.endsWith(':repair'))).toBe(true);
  });

  it('is Dependable: a pit trap gives a minor damage, never an elimination', () => {
    const { g, p, parts, row, col } = table();
    p.rig!.steer = 0;
    g.hazards.set(key({ r: row, c: col + 3 }), { type: 'pit_trap', faceUp: false });
    dice(p, [1]);
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'front:cow_catcher', 1) : 0));
    expect(parts.every(v => v.status === 'ok')).toBe(true);
    expect(p.rig!.damaged).toHaveLength(1);
    expect(terrainAt(g, { r: row, c: col + 3 })).toBe('o');
  });

  it('slams with only the direction die: the other vehicle moves and the rig stops, undamaged', () => {
    const { g, p, parts, car, row, col } = table();
    p.rig!.steer = 0;
    put(car, { r: row, c: col + 3 });
    dice(p, [3]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'rear:targeting_computer', 3) : 0), asked);
    expect(g.frames.some(f => f.kind === 'slam')).toBe(true);
    expect(g.frames.filter(f => f.die).map(f => f.die!.die)).not.toContain('slam');
    expect(asked.some(d => d.kind === 'slamReroll' || d.kind === 'dirReroll')).toBe(false);
    expect(parts[0].pos).toEqual({ r: row, c: col + 3 });
    expect(car.pos).not.toEqual({ r: row, c: col + 3 });
    expect(p.rig!.damaged).toEqual([]);
  });

  it('pushes the first vehicle it meets to the side with the Cow Catcher, chosen by its owner', () => {
    const { g, p, parts, car, row, col } = table();
    p.rig!.steer = 0;
    put(car, { r: row, c: col + 3 });
    dice(p, [2]);
    const asked: Decision[] = [];
    drive(__test.turn(g, p), d => (d.kind === 'assign' ? on(d, 'front:cow_catcher', 2) : 0), asked);
    const cow = asked.find(d => d.kind === 'cowCatcher')!;
    expect(cow.player).toBe(1);
    expect(car.pos!.r).not.toBe(row);
    expect(parts[0].pos).toEqual({ r: row, c: col + 4 });
    expect(g.frames.some(f => f.kind === 'slam')).toBe(false);
  });

  it('is shot at a command the shooter picks, which takes the minor damage', () => {
    const { g, parts, car, row, col } = table();
    put(car, { r: row, c: col - 1 });
    let shot: Decision | undefined;
    for (let tries = 0; tries < 60 && !g.players[0].rig!.damaged.length; tries++) {
      const asked: Decision[] = [];
      drive(__test.shoot(g, 1, car), d => (d.kind === 'rigTarget' ? d.options.findIndex(o => o.rig === 'rear:targeting_computer') : d.kind === 'shoot' ? 1 : 0), asked);
      shot ??= asked.find(d => d.kind === 'rigTarget');
    }
    expect(shot!.options.map(o => o.rig)).toEqual(['rear:hazard_dispenser', 'rear:targeting_computer']);
    expect(g.players[0].rig!.damaged).toEqual(['rear:targeting_computer']);
    expect(parts[2].status).toBe('ok');
  });

  it('is out after six minor damage tokens, and the finish line comes at once', () => {
    const g = newGame({ seed: SEED(2), players: [RIG, CARS[0], CARS[1]], startSide: 'a' });
    const p = g.players[0];
    for (let k = 0; k < 5; k++) drive(__test.rigHit(g, p, 'prova'));
    expect(p.out).toBe(false);
    expect(g.finalTile).toBe(false);
    drive(__test.rigHit(g, p, 'prova'));
    expect(p.out).toBe(true);
    expect(g.vehicles.filter(v => v.owner === 0).every(v => v.status === 'elim')).toBe(true);
    expect(g.finalTile).toBe(true);
  });

  it('is not eliminated when the rear tile goes while a section is still on the middle tile', () => {
    const { g, p, parts, row } = table();
    put(parts[0], { r: row, c: 8 }); put(parts[1], { r: row, c: 7 }); put(parts[2], { r: row, c: 6 });
    __test.advanceBoard(g);
    expect(p.out).toBe(false);
    expect(parts.map(v => v.pos!.c)).toEqual([0, -1, -2]);
    __test.advanceBoard(g);
    expect(p.out).toBe(true);
  });

  it('is Solid: a chopper under a section gives a minor damage and goes back to its owner', () => {
    const { g, p, parts } = table();
    g.players[1].chopper = { ...parts[1].pos! };
    drive(__test.chopperCheck(g));
    expect(g.players[1].chopper).toBeNull();
    expect(p.rig!.damaged).toHaveLength(1);
    expect(parts.every(v => v.status === 'ok')).toBe(true);
  });

  it('stops the sand worm when one of its sections is farthest back', () => {
    const { g, parts, car, row, col } = table();
    put(car, { r: row === 2 ? 4 : 1, c: col + 1 });
    __test.sandWorm(g);
    expect(car.status).toBe('ok');
    expect(parts.every(v => v.status === 'ok')).toBe(true);
  });
});

describe('Big Rig whole games', () => {
  it('ends every random game with a winner, with cars, Choppe Shoppe, Carnage and TRV9000 teams', () => {
    for (let s = 1; s <= 40; s++) {
      const others = CARS.slice(0, 1 + (s % 3)).map((c, i) => (s % 4 === 0 && i === 0 ? { ...c, bot: { protocol: 1 + (s % 4) } } : c));
      const extra: Partial<Setup> = s % 3 === 0 ? { leaders: true, upgrades: true } : s % 3 === 1 ? { carnage: true } : {};
      const g = autoplay({ seed: SEED(s), players: [RIG, ...others], startSide: s % 2 ? 'a' : 'b', ...extra }, s);
      expect(g.winner).not.toBeNull();
    }
  });

  it('plays the Big Rig and the Final Five in the same game', () => {
    for (let s = 1; s <= 10; s++) {
      const g = autoplay({ seed: SEED(s), players: [RIG, { name: 'Moto', color: '#db2', team: 'final_five' }, CARS[0]], startSide: 'a', carnage: s % 2 === 0 }, s);
      expect(g.winner).not.toBeNull();
    }
  });
});
