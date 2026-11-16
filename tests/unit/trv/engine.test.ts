import { describe, it, expect } from 'vitest';
import { newGame, play, neighbor, chopperSpaces, key, type Game, type Decision } from '../../../src/game/trv/engine';

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
