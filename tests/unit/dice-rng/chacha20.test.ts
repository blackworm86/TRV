// GDD #2 — AC-02a (RFC 8439 test vectors) and AC-02b (independent golden file from OpenSSL).
import { describe, expect, it } from 'vitest';
import { blockToBytes, chachaBlock } from '../../../src/core/rng/chacha20';
import { createRng, rawDraws, roll, serializeRng, shuffle, type RngState } from '../../../src/core/rng/rng';
import golden from './fixtures/golden-v1.json';

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const keyFromBytes = (bytes: number[]): number[] =>
  Array.from({ length: 8 }, (_, w) =>
    (bytes[4 * w] | (bytes[4 * w + 1] << 8) | (bytes[4 * w + 2] << 16) | (bytes[4 * w + 3] << 24)) >>> 0);

describe('ChaCha20 block function (AC-02a)', () => {
  it('matches the RFC 8439 section 2.3.2 block test vector', () => {
    // Arrange: key 00..1f, counter 1, nonce 00:00:00:09:00:00:00:4a:00:00:00:00
    const key = keyFromBytes(Array.from({ length: 32 }, (_, i) => i));
    const nonce = [0x09000000, 0x4a000000, 0x00000000];
    // Act
    const out = hex(blockToBytes(chachaBlock(key, 1, nonce)));
    // Assert
    expect(out).toBe(
      '10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4e'
      + 'd2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e',
    );
  });

  it('matches the RFC 8439 appendix A.1 vectors 1 and 2 (all-zero key)', () => {
    const zero = new Array(8).fill(0);
    expect(hex(blockToBytes(chachaBlock(zero, 0, [0, 0, 0])))).toBe(
      '76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7'
      + 'da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669b2ee6586',
    );
    expect(hex(blockToBytes(chachaBlock(zero, 1, [0, 0, 0])))).toBe(
      '9f07e7be5551387a98ba977c732d080dcb0f29a048e3656912c6533e32ee7aed'
      + '29b721769ce64e43d57133b074d839d531ed1f28510afb45ace10a1f4b794d6f',
    );
  });
});

describe('golden file from OpenSSL (AC-02b)', () => {
  for (const c of golden.cases) {
    it(`reproduces raw draws, rolls, shuffle and final state for seed ${c.seed.slice(0, 8)}…`, () => {
      // Arrange
      const created = createRng(c.seed);
      if (!created.ok) throw new Error(created.error.message);
      const fresh: RngState = created.value;

      // Act + Assert: first 1 000 raw draws
      const raw = rawDraws(fresh, 1000);
      if (!raw.ok) throw new Error(raw.error.message);
      expect(raw.value.values).toEqual(c.raw1000);

      // 100 d6 rolls, then a shuffle of 10, from a fresh generator
      let s = fresh;
      const faces: number[] = [];
      for (let i = 0; i < 100; i++) {
        const r = roll(s, { kind: 'roll', dice: [{ dieId: 'd6', n: 6 }], cause: 'golden' });
        if (!r.ok) throw new Error(r.error.message);
        faces.push(r.value.content.results[0].face);
        s = r.value.state;
      }
      expect(faces).toEqual(c.rolls100);
      const sh = shuffle(s, { kind: 'shuffle', pileId: 'p', size: 10, cause: 'golden' });
      if (!sh.ok) throw new Error(sh.error.message);
      expect(sh.value.content.permutation).toEqual(c.shuffle10);
      expect(serializeRng(sh.value.state)).toBe(c.finalState);
    });
  }
});
