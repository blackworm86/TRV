/**
 * Dice & Seeded RNG — GDD #2 (design/gdd/dice-seeded-rng.md).
 *
 * A pure core: every function receives the generator state and returns a NEW state plus a
 * result, never mutating its input (RNG-16) and never keeping generator state at module level
 * (RNG-3). The generator is ChaCha20 (RFC 8439) keyed directly by the 256-bit seed (RNG-15):
 * draw number `i` is word `i mod 16` of block `floor(i / 16)`, nonce zero.
 *
 * Errors are returned as values (`Result`), never thrown, and their text never contains the
 * seed or the state words (AC-30).
 *
 * @example
 * const created = createRng('00'.repeat(32));
 * if (created.ok) {
 *   const r = roll(created.value, { kind: 'roll', dice: [{ dieId: 'move', n: 6 }], cause: 'act-1' });
 *   if (r.ok) console.log(r.value.content.results[0].face); // an index 0..5
 * }
 */

import { chachaBlock } from './chacha20';

/** Id of the algorithm in the whitelist of RNG-15 (ADR-A). */
export const ALGORITHM_ID = 'chacha20-rfc8439';
/** Version of this implementation of the algorithm; part of every serialized state. */
export const ALGORITHM_VERSION = 1;
/** Largest number of faces of a die (F1). */
export const MAX_FACES = 65536;
/** Largest pile that can be shuffled (F3). */
export const MAX_PILE = 65536;
/** Draws available on one stream: 2^32 blocks of 16 words. */
export const MAX_DRAWS = 2 ** 36;

const TWO_POW_32 = 4294967296;
const NONCE = [0, 0, 0] as const;

/** The kinds of error #2 can return (RNG-16). */
export type RngErrorKind =
  | 'InvalidSeed'
  | 'InvalidDie'
  | 'InvalidPile'
  | 'InvalidRequest'
  | 'MissingRule'
  | 'SourceExhausted'
  | 'StreamExhausted'
  | 'MalformedState'
  | 'AlgorithmMismatch';

/** An error returned as a value. The message never contains secrets (RNG-11). */
export interface RngError {
  readonly kind: RngErrorKind;
  readonly message: string;
}

/** Success or error, as a value. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RngError };

/**
 * The generator state: plain, serializable data that lives inside the match state (RNG-3).
 * `draws` counts raw draws, rejected ones included.
 */
export interface RngState {
  readonly alg: string;
  readonly ver: number;
  /** The 256-bit key (= the seed) as eight unsigned 32-bit little-endian words. */
  readonly key: readonly number[];
  readonly draws: number;
}

/**
 * Where raw draws come from: the 32-bit value at absolute draw index `index` for `key`, or
 * `undefined` when the source is exhausted (only test sources run out).
 */
export type DrawSource = (key: readonly number[], index: number) => number | undefined;

/** A die as #2 sees it: an id from the content pack and its number of faces (RNG-5). */
export interface DieSpec {
  readonly dieId: string;
  readonly n: number;
}

/** Reference to the action or effect that asked for randomness; defined by #1. */
export type CauseRef = string;
/** Reference to an earlier result being replaced; #1 turns positions into event ids. */
export type ResultRef = string;
/** The seat that asked for a reroll. */
export type SeatRef = string;
/** The rule that allows a reroll: module id and rulebook page (RNG-8). */
export interface RuleRef {
  readonly moduleId: string;
  readonly page: string;
}

/** A request for randomness (RNG-17). Modules build these; executors satisfy them. */
export type RandomRequest = RollRequest | RerollRequest | ShuffleRequest;

/** Roll several dice together, in order (RNG-7). */
export interface RollRequest {
  readonly kind: 'roll';
  readonly dice: readonly DieSpec[];
  readonly cause: CauseRef;
}

/** Reroll results: the i-th die replaces the i-th reference (RNG-8, positional link). */
export interface RerollRequest {
  readonly kind: 'reroll';
  readonly dice: readonly DieSpec[];
  readonly replaces: readonly ResultRef[];
  readonly requester: SeatRef;
  readonly rule: RuleRef | undefined;
  readonly cause: CauseRef;
}

/** Shuffle a pile of `size` elements (RNG-9). */
export interface ShuffleRequest {
  readonly kind: 'shuffle';
  readonly pileId: string;
  readonly size: number;
  readonly cause: CauseRef;
}

/** One die result: the face index into the content pack's face list. */
export interface DieResult {
  readonly dieId: string;
  readonly n: number;
  readonly face: number;
}

/** Event content of a group roll: one content per group (RNG-10). */
export interface RollContent {
  readonly kind: 'roll';
  readonly cause: CauseRef;
  readonly results: readonly DieResult[];
}

/** Event content of a reroll: each new result linked to the one it replaces. */
export interface RerollContent {
  readonly kind: 'reroll';
  readonly cause: CauseRef;
  readonly requester: SeatRef;
  readonly rule: RuleRef;
  readonly results: readonly (DieResult & { readonly replaces: ResultRef })[];
}

/**
 * Event content of a shuffle. `permutation[i]` is the original position of the element that
 * ends up in position i. The permutation is HIDDEN information (RNG-11): #1 must project it
 * away before anything reaches a client.
 */
export interface ShuffleContent {
  readonly kind: 'shuffle';
  readonly cause: CauseRef;
  readonly pileId: string;
  readonly size: number;
  readonly permutation: readonly number[];
}

/** What an executor returns: the new state and the event content. */
export interface Resolved<C> {
  readonly state: RngState;
  readonly content: C;
}

// ---------------------------------------------------------------------------------- errors

function fail<T>(kind: RngErrorKind, message: string): Result<T> {
  return { ok: false, error: { kind, message } };
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

// ------------------------------------------------------------------------------ the source

/**
 * The real source: ChaCha20 keystream words. Pure — the same key and index always give the
 * same word.
 */
export const chachaSource: DrawSource = (key, index) => {
  if (index >= MAX_DRAWS) return undefined;
  return chachaBlock(key, Math.floor(index / 16), NONCE)[index % 16];
};

/**
 * A hand-written source for tests (AC "Sorgente iniettabile"): `values[i]` is draw number i
 * counted from the start of the stream, whatever the key.
 */
export function arraySource(values: readonly number[]): DrawSource {
  return (_key, index) => (index < values.length ? values[index] >>> 0 : undefined);
}

/** Draws from a source, caching one ChaCha block per call; the cache dies with the call. */
class Drawer {
  private draws: number;
  private cachedBlock = -1;
  private cachedWords: Uint32Array | null = null;

  constructor(private readonly state: RngState, private readonly source: DrawSource) {
    this.draws = state.draws;
  }

  /** The next raw draw, or undefined when the source is exhausted. */
  next(): number | undefined {
    const index = this.draws;
    let u: number | undefined;
    if (this.source === chachaSource) {
      if (index >= MAX_DRAWS) return undefined;
      const block = Math.floor(index / 16);
      if (block !== this.cachedBlock) {
        this.cachedWords = chachaBlock(this.state.key, block, NONCE);
        this.cachedBlock = block;
      }
      u = (this.cachedWords as Uint32Array)[index % 16];
    } else {
      u = this.source(this.state.key, index);
    }
    if (u === undefined) return undefined;
    this.draws = index + 1;
    return u >>> 0;
  }

  /** The state after the draws made so far. */
  result(): RngState {
    return { alg: this.state.alg, ver: this.state.ver, key: this.state.key, draws: this.draws };
  }
}

// ---------------------------------------------------------------------------------- F1, F3

/**
 * F1 acceptance test for one raw draw: the face index, or `null` when the draw is rejected.
 * `w` is the draw width in bits (32 in the game; smaller only for the exactness test AC-08f).
 *
 * @example acceptDraw(3141592653, 6) // 3
 * @example acceptDraw(4294967295, 6) // null (rejected: 4294967295 >= 4294967292)
 */
export function acceptDraw(u: number, n: number, w = 32): number | null {
  const range = 2 ** w; // Number arithmetic, never bitwise (F1 implementation note)
  const limit = range - (range % n);
  return u < limit ? u % n : null;
}

function isValidCount(x: unknown, min: number, max: number): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
}

/** Draws until F1 accepts; `undefined` if the source runs out. */
function drawFace(drawer: Drawer, n: number): number | undefined {
  for (;;) {
    const u = drawer.next();
    if (u === undefined) return undefined;
    const face = acceptDraw(u, n);
    if (face !== null) return face;
  }
}

function exhausted<T>(source: DrawSource): Result<T> {
  return source === chachaSource
    ? fail('StreamExhausted', 'The random stream of this match is exhausted.')
    : fail('SourceExhausted', 'The injected draw source is exhausted.');
}

function validateDice(dice: readonly DieSpec[]): RngError | null {
  if (!Array.isArray(dice) || dice.length === 0) {
    return { kind: 'InvalidRequest', message: 'A roll needs at least one die.' };
  }
  for (let i = 0; i < dice.length; i++) {
    if (!isValidCount(dice[i]?.n, 1, MAX_FACES)) {
      return { kind: 'InvalidDie', message: `Die at position ${i} has an invalid number of faces.` };
    }
  }
  return null;
}

function rollFaces(
  state: RngState,
  dice: readonly DieSpec[],
  source: DrawSource,
): Result<{ state: RngState; results: DieResult[] }> {
  const drawer = new Drawer(state, source);
  const results: DieResult[] = [];
  for (const die of dice) {
    const face = drawFace(drawer, die.n);
    if (face === undefined) return exhausted(source); // all or nothing (RNG-16)
    results.push({ dieId: die.dieId, n: die.n, face });
  }
  return ok({ state: drawer.result(), results });
}

/**
 * Rolls dice together, consuming the stream one die at a time in list order (RNG-7).
 * The whole request is validated before any draw (RNG-16).
 */
export function roll(
  state: RngState,
  request: RollRequest,
  source: DrawSource = chachaSource,
): Result<Resolved<RollContent>> {
  const invalid = validateDice(request.dice);
  if (invalid) return { ok: false, error: invalid };
  const rolled = rollFaces(state, request.dice, source);
  if (!rolled.ok) return rolled;
  return ok({
    state: rolled.value.state,
    content: { kind: 'roll', cause: request.cause, results: rolled.value.results },
  });
}

/**
 * Rerolls: new draws, each linked by position to the result it replaces (RNG-8).
 * A reroll without a rule reference is refused before any draw. How many rerolls are allowed
 * and who may ask is the module's rule, and whether the replaced result is still "Tirato" is
 * checked by #1 against the log.
 */
export function reroll(
  state: RngState,
  request: RerollRequest,
  source: DrawSource = chachaSource,
): Result<Resolved<RerollContent>> {
  const rule = request.rule;
  if (!rule || typeof rule.moduleId !== 'string' || rule.moduleId === '' || typeof rule.page !== 'string' || rule.page === '') {
    return fail('MissingRule', 'A reroll needs the reference of the rule that allows it.');
  }
  const invalid = validateDice(request.dice);
  if (invalid) return { ok: false, error: invalid };
  if (!Array.isArray(request.replaces) || request.replaces.length !== request.dice.length) {
    return fail('InvalidRequest', 'A reroll must name one replaced result per die.');
  }
  const rolled = rollFaces(state, request.dice, source);
  if (!rolled.ok) return rolled;
  return ok({
    state: rolled.value.state,
    content: {
      kind: 'reroll',
      cause: request.cause,
      requester: request.requester,
      rule,
      results: rolled.value.results.map((r, i) => ({ ...r, replaces: request.replaces[i] })),
    },
  });
}

/**
 * Shuffles a pile of `size` elements with F3 (Fisher–Yates from the last position down),
 * using F1 for every choice. Piles of 0 or 1 elements consume no draws but still produce the
 * content (RNG-10). Use `applyPermutation` to reorder the owner's pile.
 */
export function shuffle(
  state: RngState,
  request: ShuffleRequest,
  source: DrawSource = chachaSource,
): Result<Resolved<ShuffleContent>> {
  if (!isValidCount(request.size, 0, MAX_PILE)) {
    return fail('InvalidPile', 'The pile has an invalid size.');
  }
  const m = request.size;
  const order = Array.from({ length: m }, (_, i) => i);
  const drawer = new Drawer(state, source);
  for (let k = m - 1; k >= 1; k--) {
    const j = drawFace(drawer, k + 1);
    if (j === undefined) return exhausted(source);
    const tmp = order[k];
    order[k] = order[j];
    order[j] = tmp;
  }
  return ok({
    state: drawer.result(),
    content: { kind: 'shuffle', cause: request.cause, pileId: request.pileId, size: m, permutation: order },
  });
}

/** Reorders a pile with a shuffle's permutation: position i gets `items[permutation[i]]`. */
export function applyPermutation<T>(items: readonly T[], permutation: readonly number[]): T[] {
  return permutation.map((from) => items[from]);
}

// ------------------------------------------------------------------------------ executors

/** Any event content #2 can produce. */
export type RandomContent = RollContent | RerollContent | ShuffleContent;

/** The real executor: satisfies a request with the generator (RNG-12). */
export function resolve(
  state: RngState,
  request: RandomRequest,
  source: DrawSource = chachaSource,
): Result<Resolved<RandomContent>> {
  switch (request.kind) {
    case 'roll': return roll(state, request, source);
    case 'reroll': return reroll(state, request, source);
    case 'shuffle': return shuffle(state, request, source);
  }
}

/** What the simulation executor returns: it stops, it never rolls (RNG-12). */
export interface SimulationStop {
  readonly kind: 'needs-random';
  readonly request: RandomRequest;
}

/**
 * The simulation executor used by planning (#23). It takes no generator state at all, so it
 * cannot consume the stream or reveal a future outcome: it only reports where randomness
 * would be needed.
 */
export function simulate(request: RandomRequest): SimulationStop {
  return { kind: 'needs-random', request };
}

// ------------------------------------------------------------------------- seed and state

const SEED_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Creates a generator from a seed: exactly 64 lowercase hex characters (256 bits, RNG-2).
 * Anything else is refused, never normalized.
 */
export function createRng(seed: unknown): Result<RngState> {
  if (typeof seed !== 'string' || !SEED_PATTERN.test(seed)) {
    return fail('InvalidSeed', 'The seed must be 64 lowercase hexadecimal characters.');
  }
  const key: number[] = [];
  for (let w = 0; w < 8; w++) {
    let word = 0;
    for (let b = 3; b >= 0; b--) {
      const at = (w * 4 + b) * 2;
      word = word * 256 + parseInt(seed.slice(at, at + 2), 16); // little-endian words (RFC 8439)
    }
    key.push(word >>> 0);
  }
  return ok({ alg: ALGORITHM_ID, ver: ALGORITHM_VERSION, key, draws: 0 });
}

/**
 * Canonical serialization (RNG-3): fixed key order, so equal states give equal strings.
 * Goes only to disk, the server or a local hot-seat save — never to a client (RNG-11).
 */
export function serializeRng(state: RngState): string {
  return JSON.stringify({ alg: state.alg, ver: state.ver, key: [...state.key], draws: state.draws });
}

const CANONICAL_KEYS = ['alg', 'ver', 'key', 'draws'];

/** Reads a serialized state, validating everything; malformed input is refused (RNG-3). */
export function deserializeRng(text: string): Result<RngState> {
  const malformed = (): Result<RngState> => fail('MalformedState', 'The serialized generator state is malformed.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return malformed();
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return malformed();
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== CANONICAL_KEYS.length || keys.some((k, i) => k !== CANONICAL_KEYS[i])) return malformed();
  if (typeof record.alg !== 'string' || typeof record.ver !== 'number') return malformed();
  if (record.alg !== ALGORITHM_ID || record.ver !== ALGORITHM_VERSION) {
    return fail('AlgorithmMismatch', 'The state was produced by another generator algorithm or version.');
  }
  const key = record.key;
  if (!Array.isArray(key) || key.length !== 8 || !key.every((w) => isValidCount(w, 0, TWO_POW_32 - 1))) {
    return malformed();
  }
  if (!isValidCount(record.draws, 0, MAX_DRAWS)) return malformed();
  return ok({ alg: ALGORITHM_ID, ver: ALGORITHM_VERSION, key: [...(key as number[])], draws: record.draws });
}

/**
 * Test access to raw draws (AC-21, ADR-B): the next `count` 32-bit values, without F1.
 * Not for game rules — rules always go through `roll`, `reroll` or `shuffle`.
 */
export function rawDraws(
  state: RngState,
  count: number,
  source: DrawSource = chachaSource,
): Result<{ state: RngState; values: number[] }> {
  const drawer = new Drawer(state, source);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = drawer.next();
    if (u === undefined) return exhausted(source);
    values.push(u);
  }
  return ok({ state: drawer.result(), values });
}
