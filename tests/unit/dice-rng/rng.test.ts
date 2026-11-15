// GDD #2 Dice & Seeded RNG — Logic acceptance criteria (design/gdd/dice-seeded-rng.md).
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  ALGORITHM_ID, acceptDraw, arraySource, createRng, deserializeRng, rawDraws, reroll, resolve,
  roll, serializeRng, shuffle, simulate,
  type DieResult, type DieSpec, type DrawSource, type RandomRequest, type Result, type RngState,
} from '../../../src/core/rng/rng';
import { SEED_AC19, SEED_AC21 } from './fixtures/seeds';

const SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ZERO_STATE: RngState = { alg: ALGORITHM_ID, ver: 1, key: [0, 0, 0, 0, 0, 0, 0, 0], draws: 0 };
const TWO32 = 4294967296;

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`unexpected ${r.error.kind}: ${r.error.message}`);
  return r.value;
}
const rng = (seed = SEED): RngState => must(createRng(seed));
const d = (n: number, dieId = `d${n}`): DieSpec => ({ dieId, n });
const rollReq = (...dice: DieSpec[]) => ({ kind: 'roll' as const, dice, cause: 'test' });
const RULE = { moduleId: 'slam-resolution', page: '9' };

/** Rolls once with a source; returns faces and how many raw draws were consumed. */
function rollWith(source: DrawSource, ...dice: DieSpec[]) {
  const r = must(roll(ZERO_STATE, rollReq(...dice), source));
  return { faces: r.content.results.map((x) => x.face), consumed: r.state.draws, state: r.state };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('determinism (RNG-3, RNG-4)', () => {
  const script = (start: RngState) => {
    let s = start;
    const out: unknown[] = [];
    const r1 = must(roll(s, rollReq(d(6), d(6), d(6), d(6)))); s = r1.state; out.push(r1.content);
    const r2 = must(reroll(s, { kind: 'reroll', dice: [d(6)], replaces: ['e1'], requester: 'seat-1', rule: RULE, cause: 'c' }));
    s = r2.state; out.push(r2.content);
    const r3 = must(shuffle(s, { kind: 'shuffle', pileId: 'hazards', size: 26, cause: 'c' })); s = r3.state; out.push(r3.content);
    return { out, final: serializeRng(s) };
  };

  it('gives the same results and canonical state when the same calls run twice (AC-01)', () => {
    const a = script(rng());
    const b = script(rng());
    expect(b.out).toEqual(a.out);
    expect(b.final).toBe(a.final);
  });

  it('gives the same results whatever the timers and async tasks in between (AC-04a)', async () => {
    const plain = script(rng());
    vi.useFakeTimers();
    let s = rng();
    const out: unknown[] = [];
    const r1 = must(roll(s, rollReq(d(6), d(6), d(6), d(6)))); s = r1.state; out.push(r1.content);
    vi.advanceTimersByTime(1234);
    await Promise.resolve();
    const r2 = must(reroll(s, { kind: 'reroll', dice: [d(6)], replaces: ['e1'], requester: 'seat-1', rule: RULE, cause: 'c' }));
    s = r2.state; out.push(r2.content);
    vi.advanceTimersByTime(99_999);
    await new Promise<void>((done) => { setTimeout(done, 5); vi.advanceTimersByTime(5); });
    const r3 = must(shuffle(s, { kind: 'shuffle', pileId: 'hazards', size: 26, cause: 'c' })); s = r3.state; out.push(r3.content);
    expect(out).toEqual(plain.out);
    expect(serializeRng(s)).toBe(plain.final);
  });

  it('advances the draw counter once at resolution, not when content is re-emitted (AC-04b)', () => {
    const resolved = must(roll(rng(), rollReq(d(6))));
    const before = resolved.state.draws;
    for (let i = 0; i < 3; i++) JSON.parse(JSON.stringify(resolved.content)); // emit, resend, reread
    expect(before).toBe(1);
    expect(resolved.state.draws).toBe(1);
  });

  it('gives each of two interleaved generators the same sequence as alone (AC-23)', () => {
    const run = (s: RngState, i: number) => (i % 3 === 0
      ? roll(s, rollReq(d(6), d(8)))
      : i % 3 === 1
        ? reroll(s, { kind: 'reroll', dice: [d(6)], replaces: ['x'], requester: 's', rule: RULE, cause: 'c' })
        : shuffle(s, { kind: 'shuffle', pileId: 'p', size: 7, cause: 'c' }));
    const alone = (seed: string) => {
      let s = rng(seed); const out: unknown[] = [];
      for (let i = 0; i < 1000; i++) { const r = must(run(s, i)); out.push(r.content); s = r.state; }
      return out;
    };
    for (const [sa, sb] of [[SEED, SEED_AC21], [SEED, SEED]]) {
      let a = rng(sa), b = rng(sb); const outA: unknown[] = [], outB: unknown[] = [];
      for (let i = 0; i < 1000; i++) {
        const ra = must(run(a, i)); outA.push(ra.content); a = ra.state;
        const rb = must(run(b, i)); outB.push(rb.content); b = rb.state;
      }
      expect(outA).toEqual(alone(sa));
      expect(outB).toEqual(alone(sb));
    }
  });

  it('gives the same next roll from the same state whatever happened before (AC-18)', () => {
    const x = serializeRng(must(roll(rng(), rollReq(d(6), d(6)))).state);
    const next = (history: () => void) => { history(); return must(roll(must(deserializeRng(x)), rollReq(d(6)))).content; };
    const sixes = next(() => { for (let i = 0; i < 6; i++) rollWith(arraySource([5]), d(6)); });
    const ones = next(() => { for (let i = 0; i < 6; i++) rollWith(arraySource([0]), d(6)); });
    const none = next(() => undefined);
    expect(ones).toEqual(sixes);
    expect(none).toEqual(sixes);
    // 100 identical draws, then a known u: the 101st roll is u mod n
    let s = ZERO_STATE;
    const source = arraySource([...new Array(100).fill(4), 1_000_003]);
    for (let i = 0; i < 100; i++) s = must(roll(s, rollReq(d(6)), source)).state;
    expect(must(roll(s, rollReq(d(6)), source)).content.results[0].face).toBe(1_000_003 % 6);
  });
});

describe('purity of the core (RNG-1)', () => {
  it('runs rolls, rerolls, shuffles and serialization with every clock and entropy source throwing (AC-03a)', () => {
    const boom = () => { throw new Error('forbidden global used by the rules core'); };
    vi.spyOn(Math, 'random').mockImplementation(boom);
    vi.spyOn(performance, 'now').mockImplementation(boom);
    vi.stubGlobal('Date', new Proxy(Date, { construct: boom, get: boom, apply: boom }));
    vi.stubGlobal('crypto', new Proxy({}, { get: boom }));
    vi.stubGlobal('setTimeout', boom);
    vi.stubGlobal('setInterval', boom);
    vi.stubGlobal('requestAnimationFrame', boom);
    let s = rng();
    s = must(roll(s, rollReq(d(6), d(6)))).state;
    s = must(reroll(s, { kind: 'reroll', dice: [d(6)], replaces: ['a'], requester: 's', rule: RULE, cause: 'c' })).state;
    s = must(shuffle(s, { kind: 'shuffle', pileId: 'p', size: 20, cause: 'c' })).state;
    const text = serializeRng(s);
    expect(must(deserializeRng(text)).draws).toBe(s.draws);
  });
});

describe('dice as data (RNG-5, RNG-6)', () => {
  it('takes a number of faces with no weights and returns an integer index (AC-05a)', () => {
    expectTypeOf<DieSpec>().toEqualTypeOf<{ readonly dieId: string; readonly n: number }>();
    expectTypeOf<DieResult['face']>().toEqualTypeOf<number>();
  });

  it('returns index 3, read as label D in the pack list, for draw 3 141 592 653 (AC-05b)', () => {
    const faces = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { faces: [face] } = rollWith(arraySource([3_141_592_653]), d(6));
    expect(face).toBe(3);
    expect(faces[face]).toBe('D');
  });
});

describe('F1 face index (exact rejection)', () => {
  it('rolls 0 on a one-face die and still consumes one draw (AC-07)', () => {
    const u1 = 123, u2 = 4_000_000_001;
    const s1 = must(roll(ZERO_STATE, rollReq(d(1)), arraySource([u1, u2])));
    const s2 = must(roll(s1.state, rollReq(d(6)), arraySource([u1, u2])));
    expect(s1.content.results[0].face).toBe(0);
    expect(s2.content.results[0].face).toBe(u2 % 6);
    expect(s2.state.draws).toBe(2);
  });

  it.each([
    ['rejects 2^32−1 then accepts 7 (AC-08a)', [TWO32 - 1, 7], 1, 2],
    ['accepts the largest value below the limit (AC-08b)', [4_294_967_291], 5, 1],
    ['rejects exactly the limit then accepts 0 (AC-08c)', [4_294_967_292, 0], 0, 2],
    ['follows the GDD example (AC-08d)', [3_141_592_653], 3, 1],
  ] as const)('%s', (_name, source, face, consumed) => {
    const r = rollWith(arraySource([...source]), d(6));
    expect(r.faces[0]).toBe(face);
    expect(r.consumed).toBe(consumed);
  });

  it('returns a source-exhausted error and an unchanged state when the source runs out after a rejection (AC-08e)', () => {
    const r = roll(ZERO_STATE, rollReq(d(6)), arraySource([TWO32 - 1]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('SourceExhausted');
    expect(ZERO_STATE.draws).toBe(0);
  });

  it('accepts exactly limit / n draws for every index with an 8-bit width (AC-08f)', () => {
    const ns = [...Array.from({ length: 20 }, (_, i) => i + 1), 255, 256];
    for (const n of ns) {
      const counts = new Array<number>(n).fill(0);
      for (let u = 0; u < 256; u++) {
        const face = acceptDraw(u, n, 8);
        if (face !== null) counts[face]++;
      }
      const limit = 256 - (256 % n);
      expect(counts.every((c) => c === limit / n)).toBe(true);
    }
  });

  it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, 65_537, '6', 6n] as unknown[])(
    'refuses n = %s as a value and leaves the state untouched (AC-09b)',
    (n) => {
      const x = must(roll(rng(), rollReq(d(6)))).state;
      const before = serializeRng(x);
      const r = roll(x, rollReq({ dieId: 'bad', n: n as number }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe('InvalidDie');
      expect(serializeRng(x)).toBe(before);
    },
  );

  it('rolls 65 535 on a 65 536-face die with one draw and no rejection (AC-09c)', () => {
    const r = rollWith(arraySource([TWO32 - 1]), d(65_536));
    expect(r.faces[0]).toBe(65_535);
    expect(r.consumed).toBe(1);
  });
});

describe('group rolls and rerolls (RNG-7, RNG-8, RNG-16)', () => {
  it('gives each die of a group the next draw in list order (AC-11a)', () => {
    expect(rollWith(arraySource([1, 2]), d(6), d(8)).faces).toEqual([1, 2]);
  });

  it('lets a rejection inside a group shift only the following dice (AC-11b)', () => {
    const r = rollWith(arraySource([5, TWO32 - 1, 9]), d(6), d(6));
    expect(r.faces).toEqual([5, 3]);
    expect(r.consumed).toBe(3);
  });

  it('produces one reroll content linking each new result to its replaced one by position (AC-12a)', () => {
    const u3 = 1001, u4 = 2002;
    const source = arraySource([11, 22, u3, u4]);
    const first = must(roll(ZERO_STATE, rollReq(d(6, 'slam'), d(8, 'direction')), source));
    const re = must(reroll(first.state, {
      kind: 'reroll', dice: [d(6, 'slam'), d(8, 'direction')], replaces: ['ev-7#0', 'ev-7#1'],
      requester: 'seat-2', rule: RULE, cause: 'slam-reroll',
    }, source));
    expect(re.content.results.map((r) => [r.face, r.replaces])).toEqual([[u3 % 6, 'ev-7#0'], [u4 % 8, 'ev-7#1']]);
    expect(re.content.requester).toBe('seat-2');
    expect(re.content.rule).toEqual(RULE);
  });

  it('refuses a reroll without a rule reference and consumes nothing (AC-12b)', () => {
    const s = must(roll(rng(), rollReq(d(6)))).state;
    const r = reroll(s, { kind: 'reroll', dice: [d(6)], replaces: ['e'], requester: 's', rule: undefined, cause: 'c' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('MissingRule');
    expect(s.draws).toBe(1);
  });

  it('rerolls a result that itself came from a reroll, consuming one draw (AC-12c)', () => {
    const u = 777;
    const source = arraySource([1, 2, u]);
    const a = must(roll(ZERO_STATE, rollReq(d(6)), source));
    const b = must(reroll(a.state, { kind: 'reroll', dice: [d(6)], replaces: ['r1'], requester: 's', rule: RULE, cause: 'c' }, source));
    const c = must(reroll(b.state, { kind: 'reroll', dice: [d(6)], replaces: ['r2'], requester: 's', rule: RULE, cause: 'c' }, source));
    expect(c.content.results[0]).toMatchObject({ face: u % 6, replaces: 'r2' });
    expect(c.state.draws - b.state.draws).toBe(1);
  });

  it('gives no result for the first two dice when the third is invalid (AC-28a)', () => {
    const x = must(roll(rng(), rollReq(d(6)))).state;
    const before = serializeRng(x);
    const r = roll(x, rollReq(d(6), d(6), { dieId: 'broken', n: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidDie');
    expect(serializeRng(x)).toBe(before);
  });
});

describe('F3 shuffle (RNG-9)', () => {
  it('turns [A, B, C] into [C, B, A] with draws [0, 1] (AC-13b)', () => {
    const r = must(shuffle(ZERO_STATE, { kind: 'shuffle', pileId: 'p', size: 3, cause: 'c' }, arraySource([0, 1])));
    expect(r.content.permutation.map((i) => 'ABC'[i]).join('')).toBe('CBA');
    expect(r.state.draws).toBe(2);
  });

  it.each([0, 1])('leaves a pile of %i unchanged, consumes nothing and still produces the content (AC-14a)', (m) => {
    const r = must(shuffle(ZERO_STATE, { kind: 'shuffle', pileId: 'p', size: m, cause: 'c' }, arraySource([])));
    expect(r.content).toMatchObject({ kind: 'shuffle', pileId: 'p', size: m });
    expect(r.content.permutation).toEqual(Array.from({ length: m }, (_, i) => i));
    expect(r.state.draws).toBe(0);
  });

  it('consumes m − 1 draws for a pile of 5 equal elements (AC-14b)', () => {
    const r = must(shuffle(ZERO_STATE, { kind: 'shuffle', pileId: 'p', size: 5, cause: 'c' }, arraySource([1, 2, 3, 4])));
    expect(r.state.draws).toBe(4);
  });

  it.each([65_537, -1, 2.5])('refuses a pile of %s and leaves the state untouched (AC-14c)', (m) => {
    const x = rng();
    const r = shuffle(x, { kind: 'shuffle', pileId: 'p', size: m, cause: 'c' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPile');
    expect(x.draws).toBe(0);
  });
});

describe('simulation never rolls (RNG-12)', () => {
  it('returns the request as a stop signal without touching any generator state (AC-17a)', () => {
    const x = rng();
    const before = serializeRng(x);
    const request: RandomRequest = { kind: 'roll', dice: [d(6, 'direction')], cause: 'planned-move' };
    const stop = simulate(request);
    expect(stop).toEqual({ kind: 'needs-random', request });
    expect(JSON.stringify(stop)).not.toMatch(/"key"|"draws"|"alg"/);
    expect(serializeRng(x)).toBe(before);
    // the real executor, by contrast, rolls
    expect(must(resolve(x, request)).state.draws).toBe(1);
  });
});

describe('serialization (RNG-3)', () => {
  it('round-trips at 0 draws, 1 draw, right after a rejection and after a shuffle, and resumes identically (AC-19)', () => {
    const points: RngState[] = [];
    let s = rng(SEED_AC19);
    points.push(s);
    s = must(roll(s, rollReq(d(6)))).state;
    points.push(s);
    let rejected = false;
    for (let i = 0; i < 5_000_000 && !rejected; i++) {
      const r = must(roll(s, rollReq(d(65_175))));
      rejected = r.state.draws - s.draws === 2; // the counter includes the rejected draw
      s = r.state;
    }
    expect(rejected).toBe(true);
    points.push(s);
    s = must(shuffle(s, { kind: 'shuffle', pileId: 'p', size: 12, cause: 'c' })).state;
    points.push(s);
    for (const p of points) {
      const text = serializeRng(p);
      const back = must(deserializeRng(text));
      expect(serializeRng(back)).toBe(text);
      expect(must(roll(back, rollReq(d(6), d(6)))).content).toEqual(must(roll(p, rollReq(d(6), d(6)))).content);
    }
  });

  it.each([
    ['another algorithm id', (o: Record<string, unknown>) => ({ ...o, alg: 'xoshiro128' })],
    ['another version', (o: Record<string, unknown>) => ({ ...o, ver: 2 })],
  ])('refuses a state from %s with AlgorithmMismatch (AC-20a)', (_name, change) => {
    const o = JSON.parse(serializeRng(rng())) as Record<string, unknown>;
    const r = deserializeRng(JSON.stringify(change(o)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('AlgorithmMismatch');
  });

  it('refuses truncated, reordered or out-of-range states as malformed (AC-20b)', () => {
    const good = serializeRng(must(roll(rng(), rollReq(d(6)))).state);
    const o = JSON.parse(good) as { alg: string; ver: number; key: number[]; draws: number };
    const cases = [
      good.slice(0, good.length - 5),
      JSON.stringify({ ver: o.ver, alg: o.alg, key: o.key, draws: o.draws }),
      JSON.stringify({ ...o, key: [TWO32, ...o.key.slice(1)] }),
      JSON.stringify({ ...o, key: [-1, ...o.key.slice(1)] }),
      JSON.stringify({ ...o, draws: 1.5 }),
      JSON.stringify({ ...o, draws: -1 }),
    ];
    for (const text of cases) {
      const r = deserializeRng(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.kind).toBe('MalformedState');
    }
  });
});

describe('seeds (RNG-2, RNG-15)', () => {
  it('gives three different sequences of at least 998 distinct draws for extreme and intermediate seeds (AC-21)', () => {
    const seqs = ['0'.repeat(64), 'f'.repeat(64), SEED_AC21].map((seed) => must(rawDraws(rng(seed), 1000)).values);
    for (const seq of seqs) expect(new Set(seq).size).toBeGreaterThanOrEqual(998);
    expect(seqs[0]).not.toEqual(seqs[1]);
    expect(seqs[0]).not.toEqual(seqs[2]);
    expect(seqs[1]).not.toEqual(seqs[2]);
  });

  it.each([
    'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), `0x${'a'.repeat(62)}`, ` ${'a'.repeat(63)}`,
    `${'a'.repeat(63)}g`, '', 123, 123n, null, undefined,
  ] as unknown[])('refuses the seed %s (AC-22)', (seed) => {
    const r = createRng(seed);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidSeed');
  });

  it('uses a whitelisted algorithm keyed by the full 256-bit seed (AC-27)', () => {
    const s = rng(SEED);
    expect(['chacha20-rfc8439']).toContain(s.alg);
    expect(s.key).toHaveLength(8); // 8 × 32 = 256 bits
    const bytes = s.key.flatMap((w) => [w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, (w >>> 24) & 0xff]);
    expect(bytes.map((b) => b.toString(16).padStart(2, '0')).join('')).toBe(SEED);
  });
});

describe('errors never leak secrets (RNG-11)', () => {
  it('keeps sentinel seed and state words out of every error text and field (AC-30)', () => {
    const sentinelSeed = 'deadbeef'.repeat(8);
    const sentinelWord = 0xdeadbeef; // 3 735 928 559
    const leaks = (e: unknown) => /deadbeef|3735928559/i.test(JSON.stringify(e));
    const badSeed = createRng(sentinelSeed.toUpperCase());
    const badState = deserializeRng(JSON.stringify({ alg: ALGORITHM_ID, ver: 1, key: new Array(8).fill(sentinelWord), draws: -1 }));
    const badDie = roll(rng(sentinelSeed), rollReq({ dieId: 'x', n: 0 }));
    for (const r of [badSeed, badState, badDie]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(leaks(r.error)).toBe(false);
    }
  });
});
