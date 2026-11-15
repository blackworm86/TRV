/**
 * The ONLY place where external entropy enters a match (GDD #2, RNG-2). It sits outside the
 * rules core on purpose: the core never reads an entropy source (AC-03b).
 *
 * Browser and Node 20+ both expose `globalThis.crypto.getRandomValues`, so one path serves hot
 * seat and server. If it is missing, creation fails: there is never a fallback to Math.random
 * or the clock.
 *
 * @example
 * const seed = newSeed();
 * if (seed.ok) startMatch(seed.value); // 64 lowercase hex characters
 */

import type { Result } from '../core/rng/rng';

/** Fills a byte array with cryptographic randomness (the shape of `crypto.getRandomValues`). */
export type FillRandom = (bytes: Uint8Array) => Uint8Array;

function defaultFill(): FillRandom | undefined {
  const c = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') return undefined;
  const fn = c.getRandomValues as (b: Uint8Array) => Uint8Array;
  return (bytes) => fn.call(c, bytes);
}

/**
 * Creates a new 256-bit match seed as 64 lowercase hex characters.
 * Called once per match (and once per rematch), only at creation.
 */
export function newSeed(fill: FillRandom | undefined = defaultFill()): Result<string> {
  if (!fill) {
    return { ok: false, error: { kind: 'InvalidSeed', message: 'No cryptographic random source is available.' } };
  }
  const bytes = new Uint8Array(32);
  fill(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return { ok: true, value: hex };
}
