// The path simulator of the waypoint movement (waypoints.ts): what a car's planned steps would do,
// found by replaying the game with them. Pure: no view, no network.

import { newGame, play, type Decision, type Frame, type Pos, type Setup } from '../game/trv/engine';

/**
 * What one planned step leads to:
 * - `go`: the same car moves on (another step decision for it);
 * - `road`: the moves are over and the road die is offered;
 * - `stop`: the movement stops here (something happens the player cannot see in advance: a hazard
 *   turned up, a slam, a die rolled, a shot, damage, a jump, a new tile, an elimination);
 * - `end`: the movement is over and the turn goes on with another question.
 */
export type StepKind = 'go' | 'road' | 'stop' | 'end';

export interface SimStep {
  /** The option chosen in the decision. */
  choice: number;
  kind: StepKind;
  /**
   * Where the car is after this step: a slide the rules make certain (no die) included; after a
   * step that draws on the dice or a pile, only the space entered. Null before it enters.
   */
  at: Pos | null;
  /** Moves left after this step, when the car moves on. */
  left: number | null;
  /** The decision asked after this step (null once the game is over, and after a stop: it could tell a die). */
  next: Decision | null;
  /** The option's label: what the space is, as the rules name it before entering. */
  label: string;
}

/** Frames that end a planned path: what follows them is not known before the move is made. */
export const STOP_FRAMES: ReadonlySet<Frame['kind']> = new Set<Frame['kind']>(['reveal', 'slam', 'roll', 'shot', 'damage', 'elim', 'tile', 'jump', 'fire', 'chopper']);

/** The moves left in a step decision, read from its prompt ("… 3 movimenti rimasti"). */
export function movesLeft(d: Decision | null): number | null {
  const m = d?.kind === 'step' ? /(\d+) moviment/.exec(d.prompt) : null;
  return m ? Number(m[1]) : null;
}

/** A decision a path can answer: a step, or the road die after the moves. */
export const plannable = (d: Decision | null): boolean => d?.kind === 'step' || d?.kind === 'roadDie';

/**
 * Replays the game from `setup` with the choices made so far, then with the `path` choices,
 * and says what each of them does. The path is cut at the first step that stops or ends the
 * movement, and at the first choice that is not a step or road die decision, or not one of its
 * options: nothing beyond that is ever shown.
 * @returns the decision being planned (null when the game is over) and the steps simulated.
 */
export function simulatePath(setup: Setup, choices: readonly number[], path: readonly number[]): { start: Decision | null; steps: SimStep[] } {
  const g = newGame(setup);
  const it = play(g);
  let r = it.next(0);
  for (const c of choices) {
    if (r.done) return { start: null, steps: [] };
    r = it.next(c);
  }
  const start = r.done ? null : r.value;
  const steps: SimStep[] = [];
  let d = start;
  for (const c of path) {
    if (!d || !plannable(d) || !Number.isInteger(c) || c < 0 || c >= d.options.length) break;
    const seen = g.frames.length, car = g.activeCar, opt = d.options[c], luck = g.rng;
    r = it.next(c);
    const fresh = g.frames.slice(seen);
    // The simulation runs on the real seed, so it knows every die before it is rolled. A step that
    // draws on the dice or a pile (a ramp, an oil slick, a slam, a hazard turned up...) is a stop,
    // and of it only what the rules say before entering is told: the space entered, nothing after.
    const blind = g.rng !== luck || fresh.some(f => STOP_FRAMES.has(f.kind));
    const next = r.done || blind ? null : r.value;
    const moved = fresh.filter(f => f.kind === 'move' && f.at && (!car || f.vehicleId === car));
    const before = opt.pos ?? steps[steps.length - 1]?.at ?? null;
    const at = blind ? before : moved.length ? moved[moved.length - 1].at! : before;
    const same = !!next && next.player === d.player && g.activeCar === car;
    const kind: StepKind = blind ? 'stop'
      : same && next.kind === 'step' ? 'go'
      : same && next.kind === 'roadDie' ? 'road' : 'end';
    steps.push({ choice: c, kind, at, left: kind === 'go' ? movesLeft(next) : null, next, label: opt.label });
    if (kind === 'stop' || kind === 'end') break;
    d = next;
  }
  return { start, steps };
}
