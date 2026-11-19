import { describe, it, expect } from 'vitest';
import { newGame, play, type Decision, type Setup } from '../../../src/game/trv/engine';
import { movesLeft, simulatePath } from '../../../src/app/pathsim';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'a');
const PLAYERS = [{ name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' }, { name: 'Verde', color: '#3a3' }];
const setupOf = (s: number): Setup => ({ seed: SEED(s), players: PLAYERS, startSide: 'a' });
/** The first option a cautious player picks: one that does not eliminate the car. */
const safe = (d: Decision): number => Math.max(0, d.options.findIndex(o => !o.danger));
const plain = (d: Decision): number => d.options.findIndex(o => o.pos && /: strada$/.test(o.label));

/** Plays from the start with `safe` choices until `want` holds for a decision; the choices made so far. */
function reach(setup: Setup, want: (d: Decision) => boolean, max = 3000): { choices: number[]; d: Decision } | null {
  const it = play(newGame(setup));
  let r = it.next(0);
  const choices: number[] = [];
  while (!r.done && choices.length < max) {
    if (want(r.value)) return { choices, d: r.value };
    const c = safe(r.value);
    choices.push(c);
    r = it.next(c);
  }
  return null;
}

describe('path simulator', () => {
  it('moves on along plain road, one move less at each step, and the start is the decision asked', () => {
    // Arrange: a car on the table with three moves or more, a plain road space ahead.
    let found: { s: number; choices: number[]; d: Decision } | null = null;
    for (let s = 1; s <= 40 && !found; s++) {
      const at = reach(setupOf(s), d => d.kind === 'step' && (movesLeft(d) ?? 0) >= 3 && !/Corsia/.test(d.options[0].label) && plain(d) >= 0);
      if (at) found = { s, ...at };
    }
    expect(found).not.toBeNull();
    const { s, choices, d } = found!;
    // Act
    const { start, steps } = simulatePath(setupOf(s), choices, [plain(d)]);
    // Assert
    expect(start?.prompt).toBe(d.prompt);
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('go');
    expect(steps[0].left).toBe(movesLeft(d)! - 1);
    expect(steps[0].at).toEqual(d.options[plain(d)].pos);
  });

  it('stops the path on a space with a car (a slam) and shows nothing beyond it', () => {
    // Arrange: a step onto a space where another car is.
    let found: { s: number; choices: number[]; d: Decision; c: number } | null = null;
    for (let s = 1; s <= 60 && !found; s++) {
      const at = reach(setupOf(s), d => d.kind === 'step' && d.options.some(o => /SLAM/.test(o.label) && !o.danger));
      if (at) found = { s, ...at, c: at.d.options.findIndex(o => /SLAM/.test(o.label) && !o.danger) };
    }
    expect(found).not.toBeNull();
    const { s, choices, c } = found!;
    // Act: the slam, then two more steps planned after it.
    const { steps } = simulatePath(setupOf(s), choices, [c, 0, 0]);
    // Assert
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('stop');
  });

  it('offers the road die after the last move on road, and goes on with its moves', () => {
    // Arrange: a step whose plain road option leads to the road die.
    let found: { s: number; path: number[]; choices: number[] } | null = null;
    for (let s = 1; s <= 60 && !found; s++) {
      const at = reach(setupOf(s), d => d.kind === 'step' && movesLeft(d) === 1 && plain(d) >= 0 && !/Corsia/.test(d.options[0].label));
      if (!at) continue;
      const one = simulatePath(setupOf(s), at.choices, [plain(at.d)]);
      if (one.steps[0]?.kind === 'road') found = { s, path: [plain(at.d), 1], choices: at.choices };
    }
    expect(found).not.toBeNull();
    // Act: the step, then "Sì" to the road die.
    const { steps } = simulatePath(setupOf(found!.s), found!.choices, found!.path);
    // Assert
    expect(steps.map(x => x.kind)).toEqual(['road', 'go']);
    expect(steps[1].left).toBeGreaterThanOrEqual(1);
    expect(steps[1].at).toEqual(steps[0].at); // the car stays where it is while the die is taken
  });

  it('never shows what the dice will do: on a ramp or an oil slick the path ends on the space entered', () => {
    // Arrange: a step onto a ramp (straight on) or an oil slick, whose outcome a die decides.
    const random = /: rampa$|olio/i;
    let found: { s: number; choices: number[]; d: Decision; c: number } | null = null;
    for (let s = 1; s <= 120 && !found; s++) {
      const at = reach(setupOf(s), d => d.kind === 'step' && d.options.some(o => random.test(o.label) && !o.danger));
      if (at) found = { s, ...at, c: at.d.options.findIndex(o => random.test(o.label) && !o.danger) };
    }
    expect(found).not.toBeNull();
    const { s, choices, d, c } = found!;
    // Act
    const { steps } = simulatePath(setupOf(s), choices, [c, 0, 0]);
    // Assert: the arrow stops on the space as the rules name it, and nothing after the roll is told.
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('stop');
    expect(steps[0].at).toEqual(d.options[c].pos);
    expect(steps[0].next).toBeNull();
  });

  it('cuts the path at a choice that is not an option', () => {
    const at = reach(setupOf(3), d => d.kind === 'step');
    expect(at).not.toBeNull();
    expect(simulatePath(setupOf(3), at!.choices, [99, 0]).steps).toHaveLength(0);
  });
});
