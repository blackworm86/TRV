/**
 * Online rooms with the host's browser as referee.
 *
 * A match is a seed plus the list of choices made (the rules are deterministic), so a room is a
 * small shared record: who sits where, the setup, and the log of accepted choices. Only the host
 * writes the log. Every other player writes an *intent* ("at log length n, I choose option c");
 * the host checks it against its own copy of the rules and, if it is that player's decision,
 * appends it. Every client replays the log, so all tables show the same match.
 *
 * The record lives in a {@link RoomStore}: Firebase Realtime Database in play, an in-memory tree
 * in tests. Nothing here touches the network or the page.
 *
 * Known limit of this scheme: the seed is shared, so a modified client could work out hidden
 * information. It is meant for games among people who trust each other.
 */

import type { Setup } from '../game/trv/engine';

/** A tree of JSON values addressed by slash-separated paths, with change notifications. */
export interface RoomStore {
  /** The identity of this client, stable across reloads of the page. */
  uid(): Promise<string>;
  /** Reads the value at `path` (null when nothing is there). */
  read(path: string): Promise<unknown>;
  /** Replaces the value at `path`; null removes it. */
  write(path: string, value: unknown): Promise<void>;
  /** Calls `cb` now and after every change under `path`. Returns the function that stops it. */
  watch(path: string, cb: (value: unknown) => void): () => void;
}

/**
 * A player in the room, keyed by client identity. A TRV9000 team (design/gdd/trv9000-bots.md) has a
 * seat too, added by the host under a made-up key ({@link BOT_PREFIX}): nobody sits behind it, the
 * rules play it on every table alike, so it never sends intents.
 */
export interface Seat { name: string; crew: string; joinedAt: number; bot?: true }

/** What the host chooses before the start. */
export interface RoomOptions {
  startSide: 'a' | 'b'; leaders: boolean; upgrades: boolean; carnage?: boolean;
  /** The Basic Protocol level of the TRV9000 teams (1-4), when there are any. */
  botLevel?: number;
}

/**
 * A player's request to the host: at log length `n`, option `c` of the pending decision. A draft
 * pick says instead which card, in which round: it waits until the rules ask that player.
 */
export interface Intent {
  n: number; c: number; draft?: { r: number; card: string }; undo?: boolean;
  /** The upgrade cards placed in advance, card on car, in the order they were placed. */
  assign?: { card: string; car: string }[];
}

/** The shared record of a room, as read from the store and tidied by {@link readRoom}. */
export interface Room {
  host: string;
  createdAt: number;
  status: 'lobby' | 'playing';
  options: RoomOptions;
  seats: Record<string, Seat>;
  /** Client identities in seating order, fixed at the start: index = player number. */
  order: string[];
  setup: Setup | null;
  log: number[];
  intents: Record<string, Intent>;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const NAME_MAX = 24;
/** Room codes avoid look-alike characters (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
/** The key of a TRV9000 seat starts with this (a client identity never does). */
export const BOT_PREFIX = 'trv9000-';
export const BOT_LEVELS = [1, 2, 3, 4];

export type JoinError = 'not-found' | 'full' | 'started';
export type JoinResult = { ok: true; room: Room } | { ok: false; error: JoinError };

/** Path of a room (or of something inside it) in the store. */
export function roomPath(code: string, ...rest: string[]): string {
  return ['rooms', code, ...rest].join('/');
}

/** Makes a room code from random bytes (the shape of `crypto.getRandomValues`). */
export function newRoomCode(fill: (bytes: Uint8Array) => Uint8Array): string {
  const bytes = fill(new Uint8Array(CODE_LENGTH));
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

/** Tidies what a player typed or scanned into a room code ('' when it cannot be one). */
export function cleanCode(text: string): string {
  const code = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === CODE_LENGTH && [...code].every(ch => CODE_ALPHABET.includes(ch)) ? code : '';
}

/** A list stored as a list, or as a record with numeric keys (how Firebase may return it). */
function list<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!raw || typeof raw !== 'object') return [];
  const rec = raw as Record<string, T>;
  return Object.keys(rec).map(Number).sort((a, b) => a - b).map(k => rec[k]);
}

/** Reads a room from a raw store value; null when there is no room there. */
export function readRoom(raw: unknown): Room | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Room> & { setup?: Setup | null };
  if (typeof r.host !== 'string') return null;
  const setup = r.setup ? { ...r.setup, players: list<Setup['players'][number]>(r.setup.players) } : null;
  return {
    host: r.host,
    createdAt: Number(r.createdAt) || 0,
    status: r.status === 'playing' ? 'playing' : 'lobby',
    options: { startSide: r.options?.startSide === 'b' ? 'b' : 'a', leaders: !!r.options?.leaders, upgrades: !!r.options?.upgrades, ...(r.options?.carnage ? { carnage: true } : {}),
      ...(BOT_LEVELS.includes(Number(r.options?.botLevel)) ? { botLevel: Number(r.options!.botLevel) } : {}) },
    seats: (r.seats ?? {}) as Record<string, Seat>,
    order: list<string>(r.order),
    setup,
    log: list<number>(r.log),
    intents: (r.intents ?? {}) as Record<string, Intent>,
  };
}

/** Seated clients in the order they sat down (ties broken by identity, so every client agrees). */
export function seatOrder(room: Room): string[] {
  return Object.keys(room.seats).sort((a, b) => room.seats[a].joinedAt - room.seats[b].joinedAt || (a < b ? -1 : 1));
}

/** The first crew nobody in the room has taken, preferring `wanted`. */
export function freeCrew(room: Room | null, crews: string[], wanted?: string): string {
  const taken = new Set(Object.values(room?.seats ?? {}).map(s => s.crew));
  if (wanted && crews.includes(wanted) && !taken.has(wanted)) return wanted;
  return crews.find(c => !taken.has(c)) ?? crews[0];
}

function cleanName(name: string, fallback: string): string {
  return name.trim().slice(0, NAME_MAX) || fallback;
}

/**
 * Opens a room with this client as host and first seat. Tries fresh codes until one is unused.
 * @returns the room's code.
 */
export async function createRoom(store: RoomStore, me: { name: string; crew: string }, options: RoomOptions,
  fill: (bytes: Uint8Array) => Uint8Array, now: number): Promise<string> {
  const uid = await store.uid();
  for (let tries = 0; tries < 8; tries++) {
    const code = newRoomCode(fill);
    if (await store.read(roomPath(code, 'host')) !== null) continue;
    await store.write(roomPath(code), {
      host: uid, createdAt: now, status: 'lobby', options,
      seats: { [uid]: { name: cleanName(me.name, 'Host'), crew: me.crew, joinedAt: now } },
    });
    return code;
  }
  throw new Error('No free room code found.');
}

/**
 * Sits this client in a room. A client that already has a seat gets it back (a reload, or a
 * return to a match in progress); a new one gets in only before the start and while there is room.
 */
export async function joinRoom(store: RoomStore, code: string, me: { name: string; crew?: string }, crews: string[], now: number): Promise<JoinResult> {
  const uid = await store.uid();
  const room = readRoom(await store.read(roomPath(code)));
  if (!room) return { ok: false, error: 'not-found' };
  if (room.seats[uid]) return { ok: true, room };
  if (room.status !== 'lobby') return { ok: false, error: 'started' };
  if (Object.keys(room.seats).length >= MAX_PLAYERS) return { ok: false, error: 'full' };
  const seat: Seat = { name: cleanName(me.name, 'Giocatore'), crew: freeCrew(room, crews, me.crew), joinedAt: now };
  await store.write(roomPath(code, 'seats', uid), seat);
  return { ok: true, room: { ...room, seats: { ...room.seats, [uid]: seat } } };
}

/** Whether the seat with key `id` is a TRV9000 team. */
export const isBotSeat = (room: Room, id: string): boolean => id.startsWith(BOT_PREFIX) && !!room.seats[id]?.bot;

/**
 * Host: seats a TRV9000 team on a free crew, while there is room before the start.
 * @returns the seat's key, or null when the room is full.
 */
export async function addBot(store: RoomStore, code: string, room: Room, crews: string[], now: number): Promise<string | null> {
  if (room.status !== 'lobby' || Object.keys(room.seats).length >= MAX_PLAYERS) return null;
  let n = 1;
  while (room.seats[`${BOT_PREFIX}${n}`]) n++;
  const id = `${BOT_PREFIX}${n}`;
  await store.write(roomPath(code, 'seats', id), { name: `TRV9000 ${n}`, crew: freeCrew(room, crews), joinedAt: now, bot: true } satisfies Seat);
  return id;
}

/** Host: takes a TRV9000 team off its seat (before the start). */
export async function removeBot(store: RoomStore, code: string, id: string): Promise<void> {
  if (!id.startsWith(BOT_PREFIX)) throw new Error('Not a TRV9000 seat.');
  await store.write(roomPath(code, 'seats', id), null);
}

/** Why the host cannot start yet, or null when it can. A match needs at least one person. */
export function startProblem(room: Room): 'few' | 'many' | 'crews' | 'bots' | null {
  const seats = Object.values(room.seats);
  if (seats.length < MIN_PLAYERS) return 'few';
  if (seats.length > MAX_PLAYERS) return 'many';
  if (new Set(seats.map(s => s.crew)).size !== seats.length) return 'crews';
  if (seats.every(s => s.bot)) return 'bots';
  return null;
}

/**
 * Host: starts the match. Seats are fixed in sitting order and the setup (with the seed) is
 * published; a previous match's log and intents are cleared.
 * @param color maps a crew id to its colour.
 */
export async function startMatch(store: RoomStore, code: string, room: Room, seed: string, color: (crew: string) => string): Promise<void> {
  if (startProblem(room)) throw new Error('The room cannot start.');
  const order = seatOrder(room);
  const setup: Setup = {
    seed,
    players: order.map(uid => ({ name: room.seats[uid].name, color: color(room.seats[uid].crew), crew: room.seats[uid].crew,
      ...(isBotSeat(room, uid) ? { bot: { protocol: room.options.botLevel ?? 1 } } : {}) })),
    startSide: room.options.startSide,
    ...(room.options.leaders ? { leaders: true } : {}),
    ...(room.options.upgrades ? { upgrades: true } : {}),
    ...(room.options.carnage ? { carnage: true } : {}),
  };
  await store.write(roomPath(code, 'log'), null);
  await store.write(roomPath(code, 'intents'), null);
  await store.write(roomPath(code, 'order'), order);
  await store.write(roomPath(code, 'setup'), setup);
  await store.write(roomPath(code, 'status'), 'playing');
}

/** Host: ends the match and brings everybody back to the lobby (same room, same seats). */
export async function backToLobby(store: RoomStore, code: string): Promise<void> {
  await store.write(roomPath(code, 'status'), 'lobby');
  await store.write(roomPath(code, 'setup'), null);
  await store.write(roomPath(code, 'log'), null);
  await store.write(roomPath(code, 'intents'), null);
  await store.write(roomPath(code, 'order'), null);
}

/** Host: closes the room for everybody. */
export function closeRoom(store: RoomStore, code: string): Promise<void> {
  return store.write(roomPath(code), null);
}

/** Guest: gives the seat up (before the start). */
export async function leaveRoom(store: RoomStore, code: string): Promise<void> {
  await store.write(roomPath(code, 'seats', await store.uid()), null);
}

/** The player number of a client in the running match, or -1 for a spectator. */
export function seatOf(room: Room | null, uid: string): number {
  return room ? room.order.indexOf(uid) : -1;
}

/**
 * Host: the player whose request to take back the last choice it can grant, or null. Granted only
 * when the request was made at the current log length, the last choice was that player's own and
 * nothing final (a die, a reveal, a shot) followed it: `lock` is how many choices are final.
 * @param deciders the player who made each choice of the log, in order.
 */
export function undoable(room: Room, logLength: number, lock: number, deciders: number[]): string | null {
  if (logLength <= lock) return null;
  const uid = room.order[deciders[logLength - 1]];
  const intent = uid === undefined ? undefined : room.intents[uid];
  return intent?.undo && intent.n === logLength ? uid! : null;
}

/**
 * The pending decision as far as the referee needs it: who decides, among how many options; for an
 * upgrade draft pick, the round and the cards in that player's hand.
 */
export interface Pending {
  player: number; options: number; draft?: { r: number; cards: string[] };
  /** Placing an upgrade card: each option's card and car. */
  assign?: { card: string; car: string }[];
}

/**
 * Host: the next intent it can accept, or null. An intent counts only if it was made at the
 * current log length, by the player who must decide, for an option that exists.
 */
export function acceptable(room: Room, logLength: number, pending: Pending | null): { uid: string; choice: number } | null {
  if (!pending) return null;
  const uid = room.order[pending.player];
  const intent = uid === undefined ? undefined : room.intents[uid];
  // A draft pick made in advance (everyone picks at once): taken when the rules reach that player.
  if (intent?.draft && pending.draft) {
    if (intent.draft.r !== pending.draft.r) return null;
    const c = pending.draft.cards.indexOf(intent.draft.card);
    return c < 0 ? null : { uid: uid!, choice: c };
  }
  // Upgrade cards placed in advance: the first placement still to make among the options.
  if (intent?.assign && pending.assign) {
    for (const want of list<{ card: string; car: string }>(intent.assign)) {
      const c = pending.assign.findIndex(o => o.card === want.card && o.car === want.car);
      if (c >= 0) return { uid: uid!, choice: c };
    }
    return null;
  }
  if (!intent || intent.n !== logLength) return null;
  if (!Number.isInteger(intent.c) || intent.c < 0 || intent.c >= pending.options) return null;
  return { uid, choice: intent.c };
}
