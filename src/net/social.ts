/**
 * The player's side of online play around the rooms: a profile with a friend code, friends,
 * invitations to a room, the public lobby, the list of one's games and who is online.
 *
 * Everything lives in the same {@link RoomStore} as the rooms, at these paths:
 * - `users/<uid>/profile`: name and friend code, readable by everyone signed in;
 * - `users/<uid>/friends/<other>`: whom `uid` counts as a friend (written by `uid`). Two people are
 *   friends when each has the other here; one side only is a request still waiting;
 * - `users/<uid>/requests/<from>`: a friend request to `uid` (written by `from`);
 * - `users/<uid>/invites/<room>`: an invitation to a room (written by a friend);
 * - `users/<uid>/games/<room>`: the rooms `uid` sits in (written by `uid`);
 * - `friendCodes/<code>`: the uid behind a friend code;
 * - `presence/<uid>`: when `uid` was last seen, and in which room;
 * - `lobby/<room>`: a short card of each room open to the lobby (written by its host).
 *
 * Nothing here touches the page; the database rules (database.rules.json) say who may write what.
 */

import { CODE_ALPHABET, NAME_MAX, isBotSeat, roomSeats, seatOrder, type Room, type RoomStore } from './room';

/** Length of a friend code (without the shown `TRV-` prefix). */
export const FRIEND_CODE_LENGTH = 6;
/** Someone seen within this long (ms) counts as online. */
export const ONLINE_MS = 90_000;
/** How often (ms) an open page says it is still there; well inside {@link ONLINE_MS}. */
export const HEARTBEAT_MS = 30_000;

/** Path of something of a user's in the store. */
export const userPath = (uid: string, ...rest: string[]): string => ['users', uid, ...rest].join('/');
/** Path of a room's card in the lobby, or of the whole lobby. */
export const lobbyPath = (code?: string): string => code ? `lobby/${code}` : 'lobby';
const codePath = (code: string): string => `friendCodes/${code}`;
const presencePath = (uid: string): string => `presence/${uid}`;

/** A player's public card. */
export interface Profile { name: string; code: string; at: number }
/** Someone named in one's lists, with when it was written. */
export interface Named { name: string; at: number }
/** An invitation to room `code` (the key), from `from`. */
export interface Invite { from: string; name: string; at: number }
/** Where a player was last seen. */
export interface Presence { at: number; room?: string }

/** Everything under `users/<uid>`, tidied. */
export interface Social {
  profile: Profile | null;
  friends: Record<string, Named>;
  requests: Record<string, Named>;
  invites: Record<string, Invite>;
  games: Record<string, { at: number }>;
}

/** Makes a friend code from random bytes (the shape of `crypto.getRandomValues`). */
export function newFriendCode(fill: (bytes: Uint8Array) => Uint8Array): string {
  let code = '';
  for (const b of fill(new Uint8Array(FRIEND_CODE_LENGTH))) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

/** Tidies a typed friend code, with or without `TRV-` ('' when it cannot be one). */
export function cleanFriendCode(text: string): string {
  const code = text.trim().toUpperCase().replace(/^TRV-?/, '').replace(/[^A-Z0-9]/g, '');
  return code.length === FRIEND_CODE_LENGTH && [...code].every(ch => CODE_ALPHABET.includes(ch)) ? code : '';
}

/** A friend code as players see it. Example: `showFriendCode('7K4QZP')` → `TRV-7K4QZP`. */
export const showFriendCode = (code: string): string => `TRV-${code}`;

const obj = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' ? raw as Record<string, unknown> : {});
const named = (raw: unknown): Named | null => {
  const r = obj(raw);
  return typeof r.name === 'string' ? { name: r.name.slice(0, NAME_MAX), at: Number(r.at) || 0 } : null;
};
function records<T>(raw: unknown, read: (v: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(obj(raw))) { const x = read(v); if (x) out[k] = x; }
  return out;
}

/** Reads a profile from a raw store value; null when there is none. */
export function readProfile(raw: unknown): Profile | null {
  const r = obj(raw);
  return typeof r.code === 'string' && cleanFriendCode(r.code) ? { name: typeof r.name === 'string' ? r.name.slice(0, NAME_MAX) : '', code: r.code, at: Number(r.at) || 0 } : null;
}

/** Reads what is under `users/<uid>`. */
export function readSocial(raw: unknown): Social {
  const r = obj(raw);
  return {
    profile: readProfile(r.profile),
    friends: records(r.friends, named),
    requests: records(r.requests, named),
    invites: records(r.invites, v => { const n = named(v), from = obj(v).from; return n && typeof from === 'string' ? { ...n, from } : null; }),
    games: records(r.games, v => ({ at: Number(obj(v).at) || 0 })),
  };
}

/**
 * Makes sure this client has a profile with a friend code, and sets its name. A code already
 * owned is kept; a new one is drawn until a free one is found.
 */
export async function ensureProfile(store: RoomStore, name: string, fill: (bytes: Uint8Array) => Uint8Array, now: number): Promise<Profile> {
  const uid = await store.uid();
  const had = readProfile(await store.read(userPath(uid, 'profile')));
  let code = had?.code ?? '';
  for (let tries = 0; !code && tries < 8; tries++) {
    const c = newFriendCode(fill);
    if (await store.read(codePath(c)) !== null) continue;
    await store.write(codePath(c), uid);
    code = c;
  }
  if (!code) throw new Error('No free friend code found.');
  const profile: Profile = { name: name.trim().slice(0, NAME_MAX), code, at: now };
  await store.write(userPath(uid, 'profile'), profile);
  return profile;
}

/** What came of asking for a friendship. */
export type AddResult = 'sent' | 'friends' | 'self' | 'not-found';

/**
 * Asks the owner of friend code `code` to be friends. If that player had already asked this one,
 * the two are friends at once.
 * @param myName how the other player will see this one.
 */
export async function addFriend(store: RoomStore, code: string, myName: string, now: number): Promise<AddResult> {
  const uid = await store.uid();
  const other = await store.read(codePath(code));
  if (typeof other !== 'string') return 'not-found';
  if (other === uid) return 'self';
  const them = readProfile(await store.read(userPath(other, 'profile')));
  await store.write(userPath(uid, 'friends', other), { name: them?.name || 'Giocatore', at: now } satisfies Named);
  if (named(await store.read(userPath(uid, 'requests', other)))) {
    await store.write(userPath(uid, 'requests', other), null);
    return 'friends';
  }
  await store.write(userPath(other, 'requests', uid), { name: myName.trim().slice(0, NAME_MAX) || 'Giocatore', at: now } satisfies Named);
  return 'sent';
}

/** Accepts the friend request of `from` (named `name`). */
export async function acceptFriend(store: RoomStore, from: string, name: string, now: number): Promise<void> {
  const uid = await store.uid();
  await store.write(userPath(uid, 'friends', from), { name, at: now } satisfies Named);
  await store.write(userPath(uid, 'requests', from), null);
}

/** Turns down the friend request of `from`. */
export async function declineFriend(store: RoomStore, from: string): Promise<void> {
  await store.write(userPath(await store.uid(), 'requests', from), null);
}

/** Stops counting `other` as a friend (the friendship ends on both sides: it needs both). */
export async function removeFriend(store: RoomStore, other: string): Promise<void> {
  await store.write(userPath(await store.uid(), 'friends', other), null);
}

/** Which of `friends` count this client as a friend too: the real friendships. */
export async function mutualFriends(store: RoomStore, friends: string[]): Promise<Set<string>> {
  const uid = await store.uid();
  const back = await Promise.all(friends.map(f => store.read(userPath(f, 'friends', uid))));
  return new Set(friends.filter((_, i) => named(back[i])));
}

/** Says this client is here (and in which room). */
export async function heartbeat(store: RoomStore, now: number, room?: string): Promise<void> {
  await store.write(presencePath(await store.uid()), { at: now, ...(room ? { room } : {}) } satisfies Presence);
}

/** When each of `uids` was last seen (null: never). */
export async function readPresence(store: RoomStore, uids: string[]): Promise<Record<string, Presence | null>> {
  const raw = await Promise.all(uids.map(u => store.read(presencePath(u))));
  return Object.fromEntries(uids.map((u, i) => {
    const r = obj(raw[i]);
    return [u, typeof r.at === 'number' ? { at: r.at, ...(typeof r.room === 'string' ? { room: r.room } : {}) } : null];
  }));
}

/** Whether a player last seen as `p` counts as online at `now`. */
export const isOnline = (p: Presence | null | undefined, now: number): boolean => !!p && now - p.at < ONLINE_MS;

/** A room's card in the lobby. */
export interface LobbyEntry {
  code: string;
  host: string; hostUid: string;
  /** The crews seated, in sitting order. */
  crews: string[];
  /** How many seats the room has. */
  seats: number;
  bots: number;
  vis: 'public' | 'friends';
  startSide: 'a' | 'b'; leaders: boolean; upgrades: boolean; carnage: boolean; teams: boolean;
  at: number;
}

/** The lobby card of a room, or null when the room is not in the lobby (started, or by invitation only). */
export function lobbyEntry(code: string, room: Room): LobbyEntry | null {
  const vis = room.options.vis;
  if (room.status !== 'lobby' || (vis !== 'public' && vis !== 'friends')) return null;
  const ids = seatOrder(room);
  return {
    code, host: room.seats[room.host]?.name ?? 'Host', hostUid: room.host,
    crews: ids.map(id => room.seats[id].crew), seats: roomSeats(room.options), bots: ids.filter(id => isBotSeat(room, id)).length,
    vis, startSide: room.options.startSide, leaders: room.options.leaders, upgrades: room.options.upgrades,
    carnage: !!room.options.carnage, teams: room.options.teams !== false, at: room.createdAt,
  };
}

/** Host: puts the room's card in the lobby, or takes it out (`room` null, started or private). */
export async function publishLobby(store: RoomStore, code: string, room: Room | null): Promise<void> {
  const entry = room && lobbyEntry(code, room);
  if (!entry) { await store.write(lobbyPath(code), null); return; }
  const { code: _, ...card } = entry;
  await store.write(lobbyPath(code), card);
}

/**
 * The lobby as this client sees it: public rooms and its friends' rooms, not full, friends' first
 * and then the newest.
 * @param raw the value at {@link lobbyPath}().
 * @param friends the uids of this client's friends.
 */
export function readLobby(raw: unknown, friends: Set<string>): LobbyEntry[] {
  const out: LobbyEntry[] = [];
  for (const [code, v] of Object.entries(obj(raw))) {
    const r = obj(v);
    if (typeof r.hostUid !== 'string' || typeof r.host !== 'string') continue;
    const vis = r.vis === 'friends' ? 'friends' : 'public';
    const crews = Array.isArray(r.crews) ? r.crews.filter((c): c is string => typeof c === 'string') : [];
    const seats = Number(r.seats) || 4;
    if (vis === 'friends' && !friends.has(r.hostUid)) continue;
    if (crews.length >= seats) continue;
    out.push({ code, host: r.host.slice(0, NAME_MAX), hostUid: r.hostUid, crews, seats, bots: Number(r.bots) || 0, vis,
      startSide: r.startSide === 'b' ? 'b' : 'a', leaders: !!r.leaders, upgrades: !!r.upgrades, carnage: !!r.carnage, teams: r.teams !== false, at: Number(r.at) || 0 });
  }
  const fr = (e: LobbyEntry): number => friends.has(e.hostUid) ? 0 : 1;
  return out.sort((a, b) => fr(a) - fr(b) || b.at - a.at);
}

/** Notes that this client sits in room `code`, for its list of games on every device. */
export async function rememberGame(store: RoomStore, code: string, now: number): Promise<void> {
  await store.write(userPath(await store.uid(), 'games', code), { at: now });
}

/** Takes room `code` off this client's list of games. */
export async function forgetGame(store: RoomStore, code: string): Promise<void> {
  await store.write(userPath(await store.uid(), 'games', code), null);
}

/** Where a game of one's list stands. */
export type GameState = 'turn' | 'playing' | 'waiting' | 'ended';

/** One's game as the list shows it. */
export interface GameRow {
  code: string; state: GameState;
  /** Seated players in order: name and crew. */
  players: { name: string; crew: string }[];
  seats: number;
  /** Whose turn it is (name), while a match runs. */
  turnName: string | null;
  moveAt: number;
  host: boolean;
  winner: string | null;
}

/** How room `code` looks in the list of games of `uid`. */
export function gameRow(code: string, room: Room, uid: string): GameRow {
  const ids = room.status === 'playing' && room.order.length ? room.order : seatOrder(room);
  const state: GameState = room.status === 'lobby' ? 'waiting' : room.ended !== null ? 'ended' : room.turn === uid ? 'turn' : 'playing';
  return {
    code, state, players: ids.filter(id => room.seats[id]).map(id => ({ name: room.seats[id].name, crew: room.seats[id].crew })),
    seats: roomSeats(room.options), turnName: room.status === 'playing' && room.turn ? room.seats[room.turn]?.name ?? null : null,
    moveAt: room.moveAt || room.createdAt, host: room.host === uid, winner: room.ended,
  };
}

/** Invites friend `to` into room `code`. */
export async function inviteFriend(store: RoomStore, to: string, code: string, myName: string, now: number): Promise<void> {
  await store.write(userPath(to, 'invites', code), { from: await store.uid(), name: myName.trim().slice(0, NAME_MAX) || 'Giocatore', at: now } satisfies Invite);
}

/** Drops this client's invitation into room `code` (taken or turned down). */
export async function dropInvite(store: RoomStore, code: string): Promise<void> {
  await store.write(userPath(await store.uid(), 'invites', code), null);
}
