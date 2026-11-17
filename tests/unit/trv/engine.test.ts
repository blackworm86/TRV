import { describe, it, expect } from 'vitest';
import { newGame, play, neighbor, chopperSpaces, key, onBoard, terrainAt, vehiclesAt, type Game, type Decision } from '../../../src/game/trv/engine';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'a');
const PLAYERS = [
  { name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' },
  { name: 'Verde', color: '#3a3' }, { name: 'Giallo', color: '#db2' },
];

/** Plays a whole game with a deterministic chooser; returns the game and the number of decisions. */
function autoplay(seed: string, players: number, choose: (d: Decision, k: number) => number, max = 20000): { g: Game; steps: number } {
  const g = newGame({ seed, players: PLAYERS.slice(0, players), startSide: 'a' });
  const it = play(g);
  let r = it.next(0);
  let steps = 0;
  while (!r.done) {
    if (++steps > max) throw new Error('game did not end');
    r = it.next(choose(r.value, steps));
  }
  return { g, steps };
}

describe('board geometry', () => {
  it('maps the front arc of an odd row half a space forward', () => {
    expect(neighbor({ r: 1, c: 0 }, 'FL')).toEqual({ r: 0, c: 1 });
    expect(neighbor({ r: 1, c: 0 }, 'FR')).toEqual({ r: 2, c: 1 });
  });
  it('maps the front arc of an even row onto the same column', () => {
    expect(neighbor({ r: 2, c: 3 }, 'FL')).toEqual({ r: 1, c: 3 });
    expect(neighbor({ r: 2, c: 3 }, 'BR')).toEqual({ r: 3, c: 2 });
  });
});

describe('whole games', () => {
  it('ends every random game with a winner, for 2 to 4 players', () => {
    for (let s = 1; s <= 150; s++) {
      const players = 2 + (s % 3);
      let x = s * 7919;
      const { g } = autoplay(SEED(s), players, d => {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        // Prefer safe options, so the race goes somewhere.
        const safe = d.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
        const pool = safe.length ? safe : d.options.map((o, i) => ({ o, i }));
        return pool[x % pool.length].i;
      });
      expect(g.winner).not.toBeNull();
    }
  });
  it('offers the road die also in round 1, to a car leaving the starting area on road', () => {
    let offered = 0;
    let firstRound = 0;
    for (let s = 1; s <= 40; s++) {
      const g = newGame({ seed: SEED(s), players: PLAYERS.slice(0, 3), startSide: 'a' });
      const it = play(g);
      let r = it.next(0);
      let x = s;
      for (let k = 0; !r.done && k < 5000; k++) {
        if (r.value.kind === 'roadDie') {
          offered++;
          if (g.round === 1) firstRound++;
        }
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        const safe = r.value.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
        r = it.next((safe.length ? safe : r.value.options.map((o, i) => ({ o, i })))[x % Math.max(1, safe.length || r.value.options.length)].i);
      }
    }
    expect(offered).toBeGreaterThan(0);
    expect(firstRound).toBeGreaterThan(0);
  });
  it('records a frame for every move, roll and log line, each with a table snapshot', () => {
    const pick = (d: Decision, k: number): number => k % d.options.length;
    const { g } = autoplay(SEED(7), 2, pick);
    const kinds = new Set(g.frames.map(f => f.kind));
    for (const k of ['log', 'move', 'roll', 'round']) expect(kinds.has(k as never)).toBe(true);
    expect(g.frames.filter(f => f.kind === 'log').length).toBe(g.log.length);
    expect(g.frames.every(f => f.snap.board.length === 3)).toBe(true);
  });
  it('replays the same game from the same seed and choices', () => {
    const pick = (d: Decision, k: number): number => k % d.options.length;
    const a = autoplay(SEED(42), 3, pick).g;
    const b = autoplay(SEED(42), 3, pick).g;
    expect(b.log).toEqual(a.log);
  });
});

describe('airstrike', () => {
  it('lets the chopper land on revealed road, mud and oil slick hazards but not on a face-down one', () => {
    const g = newGame({ seed: SEED(1), players: PLAYERS.slice(0, 2), startSide: 'a' });
    g.hazards.clear();
    const free = chopperSpaces(g).filter(p => p.c >= 8);
    const [a, b, c, d] = free;
    g.hazards.set(key(a), { type: 'road', faceUp: true });
    g.hazards.set(key(b), { type: 'mud', faceUp: true });
    g.hazards.set(key(c), { type: 'oil', faceUp: true });
    g.hazards.set(key(d), { type: 'mine', faceUp: false });
    const spaces = chopperSpaces(g).map(key);
    expect(spaces).toEqual(expect.arrayContaining([key(a), key(b), key(c)]));
    expect(spaces).not.toContain(key(d));
  });
});

describe('revealed mud', () => {
  /** Plays first options until a car has `min` moves or more left on a road step; returns that step. */
  function stepWith(min: number): { g: Game; it: ReturnType<typeof play>; d: Decision; to: number } {
    const g = newGame({ seed: SEED(3), players: PLAYERS.slice(0, 2), startSide: 'a' });
    const it = play(g);
    let r = it.next(0);
    for (let n = 0; n < 5000 && !r.done; n++) {
      const d = r.value;
      const left = Number(/(\d+) moviment/.exec(d.prompt)?.[1] ?? 0);
      const to = d.kind === 'step' ? d.options.findIndex(o => o.pos && !g.hazards.has(key(o.pos)) && onBoard(o.pos)
        && terrainAt(g, o.pos) === 'R' && !vehiclesAt(g, o.pos).length) : -1;
      if (d.kind === 'step' && left === min && to >= 0) return { g, it, d, to };
      r = it.next(d.kind === 'step' && to >= 0 ? to : 0);
    }
    throw new Error('no step found');
  }
  const leftOf = (d: Decision): number => Number(/(\d+) moviment/.exec(d.prompt)?.[1] ?? 0);

  it('costs the car that reveals it one more move: two in all (ruling of the rules owner)', () => {
    // Arrange: a face-down mud token on the road space the car is about to enter, 3 moves left.
    const { g, it, d, to } = stepWith(3);
    g.hazards.set(key(d.options[to].pos!), { type: 'mud', faceUp: false });
    // Act
    const next = it.next(to).value as Decision;
    // Assert: 1 move left, as for a muddy space.
    expect(g.hazards.get(key(d.options[to].pos!))!.faceUp).toBe(true);
    expect(next.kind).toBe('step');
    expect(leftOf(next)).toBe(1);
  });
  it('stops the car there when it entered with its last move', () => {
    // Arrange
    const { g, it, d, to } = stepWith(1);
    const at = d.options[to].pos!;
    g.hazards.set(key(at), { type: 'mud', faceUp: false });
    const car = g.activeCar;
    // Act
    it.next(to);
    // Assert: the car stays on the mud, told that it stops there.
    expect(g.vehicles.find(v => v.id === car)!.pos).toEqual(at);
    expect(g.log.some(l => /affonda nel fango e si ferma/.test(l.text))).toBe(true);
  });
  it('takes the road die away, as for any mud entered this turn', () => {
    // Arrange: a last move onto a road space after which the road die is offered; the same move
    // again, with a face-down token there (plain road as the control, mud as the case).
    const replay = (choices: number[]): { g: Game; d: Decision; it: ReturnType<typeof play> } => {
      const g = newGame({ seed: SEED(3), players: PLAYERS.slice(0, 2), startSide: 'a' });
      const it = play(g);
      let r = it.next(0);
      for (const c of choices) r = it.next(c);
      return { g, d: r.value as Decision, it };
    };
    const afterToken = (choices: number[], to: number, type: 'road' | 'mud'): Decision => {
      const { g, d, it } = replay(choices);
      g.hazards.set(key(d.options[to].pos!), { type, faceUp: false });
      return it.next(to).value as Decision;
    };
    const choices: number[] = [];
    let found: { choices: number[]; to: number } | null = null;
    const walk = replay([]);
    let d = walk.d;
    for (let n = 0; n < 5000 && !found; n++) {
      const to = d.kind === 'step' ? d.options.findIndex(o => o.pos && !walk.g.hazards.has(key(o.pos)) && onBoard(o.pos)
        && terrainAt(walk.g, o.pos) === 'R' && !vehiclesAt(walk.g, o.pos).length) : -1;
      if (d.kind === 'step' && leftOf(d) === 1 && to >= 0 && afterToken(choices, to, 'road').kind === 'roadDie') found = { choices: [...choices], to };
      const c = d.kind === 'step' && to >= 0 ? to : 0;
      choices.push(c);
      d = walk.it.next(c).value as Decision;
    }
    // Act
    const next = afterToken(found!.choices, found!.to, 'mud');
    // Assert
    expect(next.kind).not.toBe('roadDie');
  });
});

describe('damage pile', () => {
  it('holds six Skid tokens, one per direction (ruling base-01)', () => {
    const g = newGame({ seed: SEED(1), players: PLAYERS.slice(0, 2), startSide: 'a' });
    const skids = g.damagePile.filter(t => t.type === 'skid').map(t => t.dir).sort();
    expect(skids).toEqual(['B', 'BL', 'BR', 'F', 'FL', 'FR']);
  });
  it('holds the 20 base damage tokens of the summary sheet (rulebook p3)', () => {
    const g = newGame({ seed: SEED(1), players: PLAYERS.slice(0, 2), startSide: 'a' });
    const count = (type: string): number => g.damagePile.filter(t => t.type === type).length;
    expect(g.damagePile).toHaveLength(20);
    expect([count('blastoff'), count('dazed'), count('dent'), count('shrapnel'), count('skid')]).toEqual([5, 3, 3, 3, 6]);
  });
});
