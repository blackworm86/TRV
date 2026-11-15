/**
 * ChaCha20 block function (RFC 8439, section 2.3), synchronous and in pure JavaScript.
 *
 * Only portable 32-bit operations are used (`+` followed by `>>> 0`, `^`, rotations), so the
 * output is identical in every JavaScript engine (GDD #2, RNG-3 and RNG-15).
 */

/** "expand 32-byte k" as four little-endian words (RFC 8439, 2.3). */
const SIGMA = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574] as const;

function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function quarterRound(s: Uint32Array, a: number, b: number, c: number, d: number): void {
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 7);
}

/**
 * Computes one 64-byte ChaCha20 block as sixteen 32-bit words.
 *
 * @param key     eight 32-bit words (the 256-bit key, little-endian words)
 * @param counter the 32-bit block counter
 * @param nonce   three 32-bit words (the 96-bit nonce)
 * @returns the sixteen output words; serialised little-endian they are the keystream bytes
 */
export function chachaBlock(
  key: ArrayLike<number>,
  counter: number,
  nonce: ArrayLike<number>,
): Uint32Array {
  const init = new Uint32Array(16);
  init[0] = SIGMA[0]; init[1] = SIGMA[1]; init[2] = SIGMA[2]; init[3] = SIGMA[3];
  for (let i = 0; i < 8; i++) init[4 + i] = key[i] >>> 0;
  init[12] = counter >>> 0;
  init[13] = nonce[0] >>> 0; init[14] = nonce[1] >>> 0; init[15] = nonce[2] >>> 0;

  const s = init.slice();
  for (let round = 0; round < 10; round++) {
    quarterRound(s, 0, 4, 8, 12);
    quarterRound(s, 1, 5, 9, 13);
    quarterRound(s, 2, 6, 10, 14);
    quarterRound(s, 3, 7, 11, 15);
    quarterRound(s, 0, 5, 10, 15);
    quarterRound(s, 1, 6, 11, 12);
    quarterRound(s, 2, 7, 8, 13);
    quarterRound(s, 3, 4, 9, 14);
  }
  for (let i = 0; i < 16; i++) s[i] = (s[i] + init[i]) >>> 0;
  return s;
}

/** Serialises block words to bytes, little-endian (RFC 8439, 2.3). */
export function blockToBytes(words: Uint32Array): Uint8Array {
  const out = new Uint8Array(words.length * 4);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out[4 * i] = w & 0xff;
    out[4 * i + 1] = (w >>> 8) & 0xff;
    out[4 * i + 2] = (w >>> 16) & 0xff;
    out[4 * i + 3] = (w >>> 24) & 0xff;
  }
  return out;
}
