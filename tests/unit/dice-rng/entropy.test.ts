// GDD #2 — AC-29: the entropy module is the only way a seed is born (RNG-2).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newSeed } from '../../../src/platform/entropy';
import { createRng } from '../../../src/core/rng/rng';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('match seed from the entropy source (AC-29)', () => {
  it('encodes 32 bytes from crypto.getRandomValues as a valid 64-character hex seed', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random used'); });
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { b.forEach((_, i) => { b[i] = i * 7; }); return b; } });
    const seed = newSeed();
    expect(seed).toEqual({
      ok: true,
      value: Array.from({ length: 32 }, (_, i) => ((i * 7) & 0xff).toString(16).padStart(2, '0')).join(''),
    });
    if (seed.ok) expect(createRng(seed.value).ok).toBe(true);
    expect(random).not.toHaveBeenCalled();
  });

  it('fails instead of falling back when no cryptographic source exists', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random used'); });
    vi.stubGlobal('crypto', undefined);
    const seed = newSeed();
    expect(seed.ok).toBe(false);
    expect(random).not.toHaveBeenCalled();
  });
});
