import { describe, it, expect } from 'vitest';
import { newGame, play, neighbor, type Game, type Decision } from '../../../src/game/trv/engine';

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
  it('replays the same game from the same seed and choices', () => {
    const pick = (d: Decision, k: number): number => k % d.options.length;
    const a = autoplay(SEED(42), 3, pick).g;
    const b = autoplay(SEED(42), 3, pick).g;
    expect(b.log).toEqual(a.log);
  });
});
