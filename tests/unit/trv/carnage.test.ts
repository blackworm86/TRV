import { describe, it, expect, afterEach } from 'vitest';
import {
  newGame, play, key, neighbor, terrainAt, tileDef, vehiclesAt, __test,
  type CarnageNumbers, type FireFace, type Game, type Vehicle, type Pos, type Decision,
} from '../../../src/game/trv/engine';
import base from '../../../data/trv/game_base.json';

const SEED = 'c4'.repeat(32);
const PLAYERS = [{ name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' }];

/**
 * Test numbers for what the rulebook does not give (data/trv/carnage.json `_missing`): one token of
 * each kind, a fire die chosen per test, a two-card ongoing effect deck. Not the real components.
 */
function fixture(fireDie: FireFace[] = ['+1', '+1', '+2', 'out', 'out', 'eliminated']): CarnageNumbers {
  return {
    hazards: { quake: 1, sand_worm: 1, desert_glass: 1, ramp: 1, fire: 1, pit_trap: 1 },
    damage: { on_fire: 1, ongoing_effect: 1 },
    fireDie,
    ongoing: ['transmission_failure', 'card_without_text'],
  };
}

/** A two-player game with the expansion, an empty board (no hazards) and every car in the starting area. */
function game(fireDie?: FireFace[]): Game {
  const g = newGame({ seed: SEED, players: PLAYERS, startSide: 'a', carnage: fixture(fireDie) });
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

/** Runs a rules generator to the end, answering every decision with `pick` (0: the first option). */
function run<T>(gen: Generator<Decision, T, number>, pick = (_d: Decision): number => 0): T {
  let r = gen.next(0);
  while (!r.done) r = gen.next(pick(r.value));
  return r.value;
}

/** A face-up hazard on a space. */
const hazard = (g: Game, at: Pos, type: Parameters<Game['hazards']['set']>[1]['type'], faceUp = true): void => {
  g.hazards.set(key(at), { type, faceUp });
};

// Printed terrain is changed only for the tests that need G (toxic goo) or S (salt flats), and put back.
let restore: (() => void) | null = null;
function printTerrain(g: Game, at: Pos, code: string): void {
  const def = tileDef(g.board[Math.floor(at.c / 8)]);
  const before = def.terrain;
  const row = def.terrain[at.r];
  def.terrain = def.terrain.map((r, i) => (i === at.r ? row.slice(0, at.c % 8) + code + row.slice(at.c % 8 + 1) : r));
  restore = () => { def.terrain = before; };
}
afterEach(() => { restore?.(); restore = null; });

const AT: Pos = { r: 2, c: 4 };
const BEHIND: Pos = neighbor(AT, 'B');

describe('Carnage at Devil’s Run setup', () => {
  it('refuses to start the expansion while its numbers are missing from the data file', () => {
    expect(() => newGame({ seed: SEED, players: PLAYERS, startSide: 'a', carnage: true })).toThrow(/missing data in carnage\.json: .*dice\.fire/);
  });
  it('mixes the new hazard and damage tokens into the piles', () => {
    const g = newGame({ seed: SEED, players: PLAYERS, startSide: 'a', carnage: fixture() });
    const all = [...g.hazardPile, ...[...g.hazards.values()].map(h => h.type)];
    const baseCount = Object.values(base.hazard_tokens).reduce((a, b) => a + b, 0);
    expect(all).toHaveLength(baseCount + 6);
    for (const t of ['quake', 'sand_worm', 'desert_glass', 'ramp', 'fire', 'pit_trap']) expect(all).toContain(t);
    expect(g.damagePile.filter(t => t.type === 'on_fire' || t.type === 'ongoing_effect')).toHaveLength(2);
  });
  it('leaves a game without the expansion as it was', () => {
    const g = newGame({ seed: SEED, players: PLAYERS, startSide: 'a' });
    expect(g.carnage).toBeNull();
    expect(g.damagePile.some(t => t.type === 'on_fire')).toBe(false);
  });
});

describe('new terrain', () => {
  it('stops a car on toxic goo, losing its remaining moves', () => {
    const g = game();
    printTerrain(g, AT, 'G');
    const v = place(g, 'p0M', BEHIND);
    expect(run(__test.enter(g, v, AT, { left: 3 }, 'F'))).toBe(true);
    expect(v.pos).toEqual(AT);
  });
  it('stops a car on toxic goo first, then slams it with the car already there', () => {
    const g = game();
    printTerrain(g, AT, 'G');
    place(g, 'p1M', AT);
    const v = place(g, 'p0M', BEHIND);
    const ctx = { left: 3 };
    expect(run(__test.enter(g, v, AT, ctx, 'F'))).toBe(true);
    expect(ctx.left).toBe(0);
    const stop = g.log.findIndex(l => l.text.includes('melma tossica'));
    const slam = g.log.findIndex(l => l.text.startsWith('SLAM'));
    expect(stop).toBeGreaterThanOrEqual(0);
    expect(slam).toBeGreaterThan(stop);
  });
  it('slides a car one more space the way it was going on desert glass, without spending a move', () => {
    const g = game();
    hazard(g, AT, 'desert_glass');
    expect(terrainAt(g, AT)).toBe('D');
    const v = place(g, 'p0M', neighbor(AT, 'BL'));
    const ctx = { left: 2 };
    run(__test.enter(g, v, AT, ctx, 'FR'));
    expect(v.pos).toEqual(neighbor(AT, 'FR'));
    expect(ctx.left).toBe(2);
  });
  it('makes a car entering a ramp from behind jump the stunt die forward and lose its moves', () => {
    const g = game();
    hazard(g, AT, 'ramp');
    const v = place(g, 'p0M', BEHIND);
    const ctx = { left: 3 };
    expect(run(__test.enter(g, v, AT, ctx, 'F'))).toBe(true);
    const stunt = g.lastRoll.filter(d => d.die === 'stunt').pop()!.value as number;
    expect(v.pos).toEqual({ r: AT.r, c: AT.c + stunt });
    expect(ctx.left).toBe(0);
    expect(g.frames.some(f => f.kind === 'jump')).toBe(true);
  });
  it('eliminates a car entering a ramp from any other space', () => {
    const g = game();
    hazard(g, AT, 'ramp');
    const v = place(g, 'p0M', neighbor(AT, 'BL'));
    run(__test.enter(g, v, AT, { left: 3 }, 'FR'));
    expect(v.status).toBe('elim');
  });
  it('sets a car entering a fire space on fire, once', () => {
    const g = game();
    hazard(g, AT, 'fire');
    const v = place(g, 'p0M', BEHIND);
    run(__test.enter(g, v, AT, { left: 1 }, 'F'));
    expect(v.onFire).toBe(true);
    run(__test.enter(g, v, AT, { left: 1 }, 'F'));
    expect(g.frames.filter(f => f.kind === 'fire' && f.why === 'on')).toHaveLength(1);
  });
  it('sets any number of cars on fire: the ON FIRE! tokens are unlimited', () => {
    const g = game();
    hazard(g, AT, 'fire');
    for (const id of ['p0S', 'p0M', 'p0L', 'p1S', 'p1M', 'p1L']) {
      const v = place(g, id, BEHIND);
      run(__test.enter(g, v, AT, { left: 1 }, 'F'));
      expect(v.onFire).toBe(true);
      v.pos = null; v.inStart = true; // off the space again, for the next car
    }
  });
  it('allows the road die after a car crosses salt flats', () => {
    const g = game();
    printTerrain(g, AT, 'S');
    const v = place(g, 'p0M', BEHIND);
    const ctx: { left: number; salt?: boolean } = { left: 1 };
    run(__test.enter(g, v, AT, ctx, 'F'));
    expect(ctx.salt).toBe(true);
  });
});

describe('new hazards', () => {
  it('turns a revealed pit trap into an impassable space and eliminates the car only on a hit', () => {
    for (let s = 0; s < 12; s++) {
      const g = newGame({ seed: SEED.slice(0, 62) + s.toString(16).padStart(2, '0'), players: PLAYERS, startSide: 'a', carnage: fixture() });
      g.hazards.clear();
      hazard(g, AT, 'pit_trap', false);
      const v = place(g, 'p0M', BEHIND);
      run(__test.enter(g, v, AT, { left: 2 }, 'F'));
      const f = g.lastRoll.filter(d => d.die === 'shooting').pop()!.value;
      const hit = f === 'ANY' || f === 'M' || f === 'SM';
      expect(v.status).toBe(hit ? 'elim' : 'ok');
      expect(terrainAt(g, AT)).toBe('X');
    }
  });
  it('eliminates every road vehicle tied farthest back when a sand worm is revealed', () => {
    const g = game();
    const a = place(g, 'p1S', { r: 0, c: 2 });
    const b = place(g, 'p1M', { r: 4, c: 2 });
    const c = place(g, 'p1L', { r: 1, c: 2 }); // odd row: half a space forward
    hazard(g, AT, 'sand_worm', false);
    const v = place(g, 'p0M', BEHIND);
    run(__test.enter(g, v, AT, { left: 2 }, 'F'));
    expect([a.status, b.status, c.status, v.status]).toEqual(['elim', 'elim', 'ok', 'ok']);
    expect(g.hazards.has(key(AT))).toBe(false);
  });
  it('makes the landing spaces of a quake reveal their hazards, in some order', () => {
    // Each landing space in every direction holds a face-down mine: whatever the die, a car lands on one.
    for (let s = 0; s < 6; s++) {
      const g = newGame({ seed: SEED.slice(0, 62) + s.toString(16).padStart(2, '0'), players: PLAYERS, startSide: 'a', carnage: fixture() });
      g.hazards.clear();
      const far: Pos = { r: 2, c: 12 };
      place(g, 'p1M', far);
      for (const d of ['F', 'FL', 'FR', 'B', 'BL', 'BR'] as const) hazard(g, neighbor(far, d), 'mine', false);
      hazard(g, AT, 'quake', false);
      const v = place(g, 'p0M', BEHIND);
      run(__test.enter(g, v, AT, { left: 2 }, 'F'));
      // The quake, then the mine where the car lands; unless that space is printed impassable on this
      // seed's tile, and then the car is eliminated there.
      const other = g.vehicles.find(x => x.id === 'p1M')!;
      const blocked = g.log.some(l => l.text.includes('Blu') && l.text.includes('invalicabile nel terremoto'));
      expect(blocked ? other.status === 'elim' : g.frames.filter(f => f.kind === 'reveal').length >= 2).toBe(true);
    }
  });
  it('brings in the new tile when a quake pushes a vehicle past the front edge', () => {
    for (let s = 0; s < 40; s++) {
      const g = newGame({ seed: SEED.slice(0, 62) + s.toString(16).padStart(2, '0'), players: PLAYERS, startSide: 'a', carnage: fixture() });
      g.hazards.clear();
      const front = place(g, 'p1M', { r: 2, c: 23 });
      hazard(g, AT, 'quake', false);
      const v = place(g, 'p0M', BEHIND);
      const tiles = g.tilesPlaced;
      run(__test.enter(g, v, AT, { left: 2 }, 'F'));
      if (g.lastRoll.find(x => x.die === 'direction')?.value !== 'F') continue; // only this seed's roll decides
      expect(g.tilesPlaced).toBe(tiles + 1);
      expect(front.pos).toEqual({ r: 2, c: 24 - 8 });
      return;
    }
    throw new Error('no seed rolled F for the quake');
  });
  it('moves every road vehicle one space the rolled way when a quake is revealed', () => {
    const g = game();
    const other = place(g, 'p1M', { r: 2, c: 10 });
    hazard(g, AT, 'quake', false);
    const v = place(g, 'p0M', BEHIND);
    run(__test.enter(g, v, AT, { left: 2 }, 'F'));
    const d = g.lastRoll.filter(x => x.die === 'direction').pop()!.value as Parameters<typeof neighbor>[1];
    expect(other.pos).toEqual(neighbor({ r: 2, c: 10 }, d));
    expect(v.status === 'elim' || JSON.stringify(v.pos) === JSON.stringify(neighbor(AT, d))).toBe(true);
  });
});

describe('ON FIRE!', () => {
  it('adds the fire die’s moves before moving, all to be made', () => {
    const g = game(Array(6).fill('+2'));
    const v = place(g, 'p0M', AT);
    v.onFire = true;
    const mv = { moves: 3 };
    expect(__test.beforeMove(g, v, mv)).toEqual({ fixed: false, mustMoveAll: true });
    expect(mv.moves).toBe(5);
  });
  it('puts the fire out on that face, the token back in the supply', () => {
    const g = game(Array(6).fill('out'));
    const v = place(g, 'p0M', AT);
    hazard(g, neighbor(AT, 'F'), 'fire');
    run(__test.enter(g, v, neighbor(AT, 'F'), { left: 1 }, 'F'));
    expect(v.onFire).toBe(true);
    __test.beforeMove(g, v, { moves: 2 });
    expect(v.onFire).toBe(false);
  });
  it('eliminates the car on the skull', () => {
    const g = game(Array(6).fill('eliminated'));
    const v = place(g, 'p0M', AT);
    v.onFire = true;
    __test.beforeMove(g, v, { moves: 2 });
    expect(v.status).toBe('elim');
  });
  it('removes the ON FIRE! token from a car that becomes inoperable', () => {
    const g = game();
    const v = place(g, 'p0M', AT);
    v.onFire = true;
    run(__test.damageWith(g, v, { type: 'dent' }));
    run(__test.damageWith(g, v, { type: 'dent' }));
    expect([v.status, v.onFire]).toEqual(['inop', false]);
  });
});

describe('new damage tokens', () => {
  it('sets the car on fire with an ON FIRE damage token, the token counting as damage', () => {
    const g = game();
    const v = place(g, 'p0M', AT);
    run(__test.damageWith(g, v, { type: 'on_fire' }));
    expect([v.onFire, v.damage.map(t => t.type)]).toEqual([true, ['on_fire']]);
  });
  it('puts an ongoing effect card under the token until it is repaired', () => {
    const g = game();
    const v = place(g, 'p0M', AT);
    run(__test.damageWith(g, v, { type: 'ongoing_effect' }));
    const card = v.damage[0].card!;
    expect(['transmission_failure', 'card_without_text']).toContain(card);
    run(__test.repair(g, g.players[0]));
    expect(v.damage).toHaveLength(0);
    expect(g.carnage!.discard).toEqual([card]);
  });
  it('sets the move to 1 with Transmission Failure, and no fire bonus', () => {
    const g = game(Array(6).fill('+2'));
    const v = place(g, 'p0M', AT);
    v.damage.push({ type: 'ongoing_effect', card: 'transmission_failure' });
    v.onFire = true;
    const mv = { moves: 5 };
    expect(__test.beforeMove(g, v, mv)).toEqual({ fixed: true, mustMoveAll: false });
    expect(mv.moves).toBe(1);
  });
});

it('keeps vehicles in one piece on the board', () => {
  // A guard for the test helpers: placing cars never stacks two on a space here.
  const g = game();
  place(g, 'p0M', AT);
  expect(vehiclesAt(g, AT)).toHaveLength(1);
});

describe('whole games with Carnage at Devil’s Run', () => {
  it('ends every random game with a winner, with the new hazards and damage in play', () => {
    let fires = 0, cards = 0;
    for (let s = 1; s <= 40; s++) {
      const g = newGame({ seed: s.toString(16).padStart(8, '0').padEnd(64, 'b'), players: PLAYERS, startSide: 'a', carnage: fixture() });
      const it = play(g);
      let r = it.next(0);
      let x = s * 7919;
      for (let k = 0; !r.done; k++) {
        if (k > 20000) throw new Error('game did not end');
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        const safe = r.value.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
        const pool = safe.length ? safe : r.value.options.map((o, i) => ({ o, i }));
        r = it.next(pool[x % pool.length].i);
      }
      expect(g.winner).not.toBeNull();
      fires += g.frames.filter(f => f.kind === 'fire' && f.why === 'on').length;
      cards += g.log.filter(l => l.text.startsWith('Effetto continuo')).length;
    }
    expect(fires).toBeGreaterThan(0);
    expect(cards).toBeGreaterThan(0);
  }, 60_000);
});
