// Generates tests/unit/dice-rng/fixtures/golden-v1.json (GDD #2, AC-02b).
//
// INDEPENDENT of src/: raw draws come from OpenSSL's ChaCha20 (node:crypto), and F1/F3 are
// re-implemented here from the GDD text. The test then compares src/core/rng against this file,
// so a bug in src cannot certify itself.
//
// Run: node tools/rng/make-golden.mjs
import { createCipheriv } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';

const ALG = 'chacha20-rfc8439';
const VER = 1;
const SEEDS = [
  '0'.repeat(64),
  'f'.repeat(64),
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
];

// OpenSSL "chacha20" IV = 4-byte little-endian block counter + 12-byte nonce (zero here).
function keystreamWords(seedHex, count) {
  const cipher = createCipheriv('chacha20', Buffer.from(seedHex, 'hex'), Buffer.alloc(16));
  const bytes = cipher.update(Buffer.alloc(count * 4));
  const words = [];
  for (let i = 0; i < count; i++) words.push(bytes.readUInt32LE(i * 4));
  return words;
}

function makeStream(seedHex) {
  const words = keystreamWords(seedHex, 4096);
  let i = 0;
  return { next: () => words[i++], get count() { return i; } };
}

// F1, straight from the GDD: limit = 2^32 - (2^32 mod n); redraw until u < limit.
function f1(stream, n) {
  const limit = 4294967296 - (4294967296 % n);
  for (;;) { const u = stream.next(); if (u < limit) return u % n; }
}

// F3: for k from m-1 down to 1, j = F1(k+1), swap k and j.
function f3(stream, m) {
  const order = Array.from({ length: m }, (_, i) => i);
  for (let k = m - 1; k >= 1; k--) { const j = f1(stream, k + 1); [order[k], order[j]] = [order[j], order[k]]; }
  return order;
}

function keyWords(seedHex) {
  const b = Buffer.from(seedHex, 'hex');
  return Array.from({ length: 8 }, (_, w) => b.readUInt32LE(w * 4));
}

const cases = SEEDS.map((seed) => {
  const raw1000 = keystreamWords(seed, 1000);
  const s = makeStream(seed);
  const rolls100 = Array.from({ length: 100 }, () => f1(s, 6));
  const shuffle10 = f3(s, 10);
  const finalState = JSON.stringify({ alg: ALG, ver: VER, key: keyWords(seed), draws: s.count });
  return { seed, raw1000, rolls100, shuffle10, finalState };
});

const out = new URL('../../tests/unit/dice-rng/fixtures/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('golden-v1.json', out), JSON.stringify({ alg: ALG, ver: VER, source: 'OpenSSL ChaCha20 via node:crypto', cases }, null, 1) + '\n');
console.log('golden-v1.json written:', cases.length, 'seeds');
