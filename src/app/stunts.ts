// Which stunt a ramp jump makes: chosen by the jump's length among rare variants of a plain jump,
// from a number derived from the jump itself, so a replay or another device draws the same one.
// Pure: no page, no scene (unit-tested in tests/unit/app/).

import { P } from './presentation';

/**
 * The ways a jump can go: `flat` is the plain jump (by far the most common), `oneWheel` comes
 * down leaning on one side, `barrel` turns a full roll along the car's length, `backflip` a full
 * somersault backwards. Short jumps cannot turn over: they lack the time in the air.
 */
export type JumpStunt = 'flat' | 'oneWheel' | 'barrel' | 'backflip';
/** The odds of each stunt by jump length in spaces (1-4), from the presentation data. */
export const JUMP_ODDS = P.jump.odds as Record<number, Partial<Record<JumpStunt, number>>>;

/** The stunt for a draw 0..1 among the odds of a jump of `n` spaces. */
export function pickStunt(n: number, draw: number, odds: Record<number, Partial<Record<JumpStunt, number>>> = JUMP_ODDS): JumpStunt {
  let acc = 0;
  for (const [k, w] of Object.entries(odds[n] ?? {})) { acc += w ?? 0; if (draw < acc) return k as JumpStunt; }
  return 'flat';
}

/** A number 0..1 from a text (FNV-1a): the same jump always picks the same stunt, in replays too. */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
