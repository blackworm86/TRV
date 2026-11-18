import { describe, it, expect } from 'vitest';
import { newGame, play, vehiclesAt } from '../../../src/game/trv/engine';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'a');
const PLAYERS = [
  { name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' },
  { name: 'Verde', color: '#3a3' }, { name: 'Giallo', color: '#db2' },
];
/** Games played for the check, per setup. */
const GAMES = 120;

describe('road vehicles under a chopper', () => {
  // Base rulebook p. 7, Obstacles, Chopper: a road vehicle that ends a turn in a chopper's space,
  // by its own movement, a slam or damage, is eliminated. So no turn may begin with one there.
  it('are gone by the time the next turn begins, with and without the expansions', () => {
    let turns = 0;
    const left: string[] = [];
    for (const extra of [{}, { leaders: true, upgrades: true, carnage: true }]) {
      for (let s = 1; s <= GAMES; s++) {
        const g = newGame({ seed: SEED(s), players: PLAYERS.slice(0, 2 + (s % 3)), startSide: 'a', ...extra } as Parameters<typeof newGame>[0]);
        const game = play(g);
        let r = game.next(0);
        let x = s * 7919;
        for (let k = 0; !r.done && k < 20000; k++) {
          if (r.value.kind === 'assign') {
            turns++;
            for (const pl of g.players) if (pl.chopper && vehiclesAt(g, pl.chopper).length) left.push(`seed ${s}, round ${g.round}`);
          }
          x = (x * 1103515245 + 12345) & 0x7fffffff;
          r = game.next(x % r.value.options.length);
        }
      }
    }
    expect(turns).toBeGreaterThan(1000);
    expect(left).toEqual([]);
  });
});
