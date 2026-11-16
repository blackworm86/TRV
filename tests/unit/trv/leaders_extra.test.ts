// Ms. Betty and Emberco (Choppe Shoppe), with the rulings of the rules owner (2026-11-16):
// Bring the Bling keeps one card more in the draft and the large car may take two; Tinker and Show
// Time pick any of the player's cars; Smokin' makes the eliminated face of the fire die do nothing.
import { describe, it, expect } from 'vitest';
import { newGame, play, carnageNumbers, __test, type Decision, type Game, type FireFace } from '../../../src/game/trv/engine';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'e');
const NAMES = [{ name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' }];

/** Plays a whole game; `pick` may answer a decision (else a pseudo-random safe option); `see` gets every decision. */
function run(seed: number, setup: Partial<Parameters<typeof newGame>[0]>, see: (d: Decision, g: Game) => void = () => {},
  pick: (d: Decision, g: Game) => number | undefined = () => undefined): Game {
  const g = newGame({ seed: SEED(seed), startSide: 'a', players: NAMES, ...setup });
  const it = play(g);
  let r = it.next(0);
  let x = seed * 104729 + 3;
  for (let k = 0; !r.done; k++) {
    if (k > 20000) throw new Error('game did not end');
    see(r.value, g);
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const safe = r.value.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
    const pool = safe.length ? safe : r.value.options.map((o, i) => ({ o, i }));
    r = it.next(pick(r.value, g) ?? pool[x % pool.length].i);
  }
  return g;
}

/** Prefer activating `cmd` whenever it is offered. */
const prefer = (cmd: string) => (d: Decision): number | undefined => {
  if (d.kind !== 'command' && d.kind !== 'token') return undefined;
  const i = d.options.findIndex(o => o.command === cmd);
  return i >= 0 ? i : undefined;
};

describe('Ms. Betty', () => {
  it('drafts four upgrade cards and can put two on her large car', () => {
    let twice = 0;
    for (let s = 1; s <= 12; s++) {
      const g = run(s, {
        upgrades: true, players: [{ ...NAMES[0], leader: 'betty' }, NAMES[1]],
      }, () => {}, d => {
        // Put cards on the large car first, so it takes two.
        if (d.kind !== 'upgradeAssign') return undefined;
        const i = d.options.findIndex(o => o.carId === 'p0L');
        return i >= 0 ? i : undefined;
      });
      const mine = g.vehicles.filter(v => v.owner === 0);
      const cards = mine.flatMap(v => [v.upgrade, v.upgrade2]).filter(Boolean);
      expect(cards).toHaveLength(4);
      if (g.vehicles.find(v => v.id === 'p0L')!.upgrade2) twice++;
      expect(g.vehicles.filter(v => v.owner === 1).flatMap(v => [v.upgrade, v.upgrade2]).filter(Boolean)).toHaveLength(3);
    }
    expect(twice).toBeGreaterThan(0);
  });
  it('swaps an upgrade of a car of her choice with Tinker', () => {
    let tinkered = 0;
    for (let s = 1; s <= 30 && !tinkered; s++) {
      run(s, { upgrades: true, players: [{ ...NAMES[0], leader: 'betty' }, NAMES[1]] }, (d, g) => {
        if (d.kind !== 'tinker') return;
        tinkered++;
        expect(d.options.every(o => g.vehicles.find(v => v.id === o.carId)!.owner === 0)).toBe(true);
      }, prefer('tinker'));
    }
    expect(tinkered).toBeGreaterThan(0);
  });
  it('is dealt only when the upgrade cards are in play', () => {
    for (let s = 1; s <= 20; s++) {
      run(s, { leaders: true }, d => {
        if (d.kind === 'leader') expect(d.options.some(o => o.leader === 'betty' || o.leader === 'emberco')).toBe(false);
      });
    }
  });
});

describe('Emberco', () => {
  const carnage = (die: FireFace[]): ReturnType<typeof carnageNumbers> => ({ ...carnageNumbers(), fireDie: die });
  it('sets a car of his own on fire with Show Time', () => {
    let shows = 0;
    for (let s = 1; s <= 20 && !shows; s++) {
      const g = run(s, { carnage: carnage(['+1', '+1', '+2', '+2', 'out', 'out']), players: [{ ...NAMES[0], leader: 'emberco' }, NAMES[1]] }, d => {
        if (d.kind === 'showTime') shows++;
      }, prefer('show_time'));
      if (shows) expect(g.frames.some(f => f.kind === 'fire' && f.why === 'on' && f.vehicleId?.startsWith('p0'))).toBe(true);
    }
    expect(shows).toBeGreaterThan(0);
  });
  it('ignores the eliminated face of the fire die (Smokin\')', () => {
    const g = newGame({ seed: SEED(1), startSide: 'a', players: [{ ...NAMES[0], leader: 'emberco' }, NAMES[1]], carnage: carnage(Array(6).fill('eliminated')) });
    const v = g.vehicles.find(x => x.id === 'p0M')!;
    v.pos = { r: 2, c: 4 }; v.inStart = false; v.onFire = true;
    __test.beforeMove(g, v, { moves: 2 });
    expect([v.status, v.onFire]).toEqual(['ok', true]);
    const w = g.vehicles.find(x => x.id === 'p1M')!;
    w.pos = { r: 3, c: 4 }; w.inStart = false; w.onFire = true;
    __test.beforeMove(g, w, { moves: 2 });
    expect(w.status).toBe('elim'); // the other player has no Smokin'
  });
  it('sets the target on fire when the Flamethrower hits', () => {
    let lit = 0;
    for (let s = 1; s <= 40 && !lit; s++) {
      run(s, { carnage: carnage(['+1', '+1', '+2', '+2', 'out', 'out']), players: [{ ...NAMES[0], leader: 'emberco' }, NAMES[1]] }, (d, g) => {
        if (g.fx.flamethrower) lit += g.frames.filter(f => f.kind === 'fire' && f.why === 'on' && f.vehicleId?.startsWith('p1')).length;
      }, prefer('flamethrower'));
    }
    expect(lit).toBeGreaterThan(0);
  });
});
