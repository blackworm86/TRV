import { describe, it, expect } from 'vitest';
import { addBot, createRoom, joinRoom, readRoom, roomPath, startMatch, type Room, type RoomStore } from '../../../src/net/room';
import {
  FRIEND_CODE_LENGTH, ONLINE_MS, acceptFriend, addFriend, cleanFriendCode, declineFriend, dropInvite, ensureProfile, forgetGame, gameRow, heartbeat,
  inviteFriend, isOnline, lobbyEntry, lobbyPath, mutualFriends, newFriendCode, publishLobby, readLobby, readPresence, readSocial, rememberGame,
  removeFriend, showFriendCode, userPath,
} from '../../../src/net/social';
import { createTreeStore, memoryBacking } from '../../../src/net/tree-store';

const CREWS = ['red', 'blue', 'green', 'yellow'];
const NOW = 5000;
/** Fills with a fixed byte, so codes are known; `step` makes each call draw a different code. */
function filler(start: number, step = 0): (bytes: Uint8Array) => Uint8Array {
  let b = start;
  return bytes => { bytes.fill(b); b += step; return bytes; };
}
function clients(n: number): RoomStore[] {
  const backing = memoryBacking();
  return Array.from({ length: n }, (_, i) => createTreeStore(backing, `u${i}`));
}
const social = async (s: RoomStore) => readSocial(await s.read(userPath(await s.uid())));
const OPTIONS = { startSide: 'a' as const, leaders: true, upgrades: false };

describe('friend codes', () => {
  it('are made of unambiguous characters and shown with TRV-', () => {
    const code = newFriendCode(filler(3));
    expect(code).toHaveLength(FRIEND_CODE_LENGTH);
    expect(showFriendCode(code)).toBe(`TRV-${code}`);
  });
  it('are tidied from what a player types, with or without the prefix', () => {
    const code = newFriendCode(filler(3));
    expect(cleanFriendCode(` trv-${code.toLowerCase()} `)).toBe(code);
    expect(cleanFriendCode(code)).toBe(code);
    expect(cleanFriendCode('TRV-ABC')).toBe('');
    expect(cleanFriendCode('TRV-0OOOOO')).toBe('');
  });
});

describe('profiles', () => {
  it('keeps the friend code across renames and skips a code already taken', async () => {
    const [a, b] = clients(2);
    const pa = await ensureProfile(a, '  Ada ', filler(3), NOW);
    expect(pa.name).toBe('Ada');
    // The same bytes give the same code: b must draw again and gets the next one.
    const pb = await ensureProfile(b, 'Bo', filler(3, 1), NOW);
    expect(pb.code).not.toBe(pa.code);
    const again = await ensureProfile(a, 'Ada Lovelace', filler(9), NOW + 1);
    expect(again.code).toBe(pa.code);
    expect((await social(a)).profile?.name).toBe('Ada Lovelace');
  });
});

describe('friends', () => {
  it('are friends once both sides have asked, and a request can be accepted or declined', async () => {
    const [a, b, c] = clients(3);
    await ensureProfile(a, 'Ada', filler(1), NOW);
    const pb = await ensureProfile(b, 'Bo', filler(2), NOW);
    const pc = await ensureProfile(c, 'Cy', filler(3), NOW);

    expect(await addFriend(a, pb.code, 'Ada', NOW)).toBe('sent');
    expect(await mutualFriends(a, ['u1'])).toEqual(new Set());
    expect((await social(b)).requests.u0?.name).toBe('Ada');
    await acceptFriend(b, 'u0', 'Ada', NOW);
    expect((await social(b)).requests).toEqual({});
    expect(await mutualFriends(a, ['u1'])).toEqual(new Set(['u1']));
    expect(await mutualFriends(b, ['u0'])).toEqual(new Set(['u0']));

    await addFriend(a, pc.code, 'Ada', NOW);
    await declineFriend(c, 'u0');
    expect((await social(c)).requests).toEqual({});
    expect(await mutualFriends(a, ['u2'])).toEqual(new Set());

    await removeFriend(b, 'u0');
    expect(await mutualFriends(a, ['u1'])).toEqual(new Set());
  });
  it('become friends at once when the other had already asked', async () => {
    const [a, b] = clients(2);
    const pa = await ensureProfile(a, 'Ada', filler(1), NOW);
    const pb = await ensureProfile(b, 'Bo', filler(2), NOW);
    await addFriend(a, pb.code, 'Ada', NOW);
    expect(await addFriend(b, pa.code, 'Bo', NOW)).toBe('friends');
    expect((await social(b)).requests).toEqual({});
    expect(await mutualFriends(a, ['u1'])).toEqual(new Set(['u1']));
  });
  it('cannot be oneself or an unknown code', async () => {
    const [a] = clients(1);
    const pa = await ensureProfile(a, 'Ada', filler(1), NOW);
    expect(await addFriend(a, pa.code, 'Ada', NOW)).toBe('self');
    expect(await addFriend(a, newFriendCode(filler(20)), 'Ada', NOW)).toBe('not-found');
  });
});

describe('presence', () => {
  it('counts a player online for a while after the last sign of life', async () => {
    const [a, b] = clients(2);
    await heartbeat(a, NOW, 'ABCDE');
    const p = await readPresence(b, ['u0', 'u1']);
    expect(p.u0).toEqual({ at: NOW, room: 'ABCDE' });
    expect(p.u1).toBe(null);
    expect(isOnline(p.u0, NOW + ONLINE_MS - 1)).toBe(true);
    expect(isOnline(p.u0, NOW + ONLINE_MS)).toBe(false);
  });
});

async function hostRoom(store: RoomStore, vis: 'public' | 'friends' | 'invite', maxPlayers = 4): Promise<{ code: string; room: Room }> {
  const code = await createRoom(store, { name: 'Ada', crew: 'red' }, { ...OPTIONS, vis, maxPlayers }, filler(7), NOW);
  return { code, room: readRoom(await store.read(roomPath(code)))! };
}

describe('the lobby', () => {
  it('lists public rooms and friends’ rooms, not private, started or full ones', async () => {
    const [a, b] = clients(2);
    const { code, room } = await hostRoom(a, 'public', 2);
    expect(lobbyEntry(code, room)).toMatchObject({ host: 'Ada', hostUid: 'u0', crews: ['red'], seats: 2, leaders: true, teams: true });
    await publishLobby(a, code, room);
    expect(readLobby(await b.read(lobbyPath()), new Set()).map(e => e.code)).toEqual([code]);

    // Friends only: only who counts the host as a friend sees it.
    await publishLobby(a, code, { ...room, options: { ...room.options, vis: 'friends' } });
    expect(readLobby(await b.read(lobbyPath()), new Set())).toEqual([]);
    expect(readLobby(await b.read(lobbyPath()), new Set(['u0']))).toHaveLength(1);

    // Full: two seats taken out of two.
    await joinRoom(b, code, { name: 'Bo' }, CREWS, NOW + 1);
    const full = readRoom(await a.read(roomPath(code)))!;
    await publishLobby(a, code, full);
    expect(readLobby(await b.read(lobbyPath()), new Set(['u0']))).toEqual([]);

    // By invitation only, or started: out of the lobby.
    expect(lobbyEntry(code, { ...full, options: { ...full.options, vis: 'invite' } })).toBe(null);
    expect(lobbyEntry(code, { ...full, status: 'playing' })).toBe(null);
    await publishLobby(a, code, null);
    expect(await b.read(lobbyPath(code))).toBe(null);
  });
  it('puts friends’ rooms first, then the newest', () => {
    const card = (host: string, at: number) => ({ host, hostUid: host, crews: ['red'], seats: 4, vis: 'public', at });
    const list = readLobby({ AAAAA: card('x', 1), BBBBB: card('y', 3), CCCCC: card('f', 0) }, new Set(['f']));
    expect(list.map(e => e.host)).toEqual(['f', 'y', 'x']);
  });
});

describe('a room’s seats', () => {
  it('stop at the room’s own number of seats', async () => {
    const [a, b, c] = clients(3);
    const { code } = await hostRoom(a, 'invite', 2);
    expect((await joinRoom(b, code, { name: 'Bo' }, CREWS, NOW)).ok).toBe(true);
    expect(await joinRoom(c, code, { name: 'Cy' }, CREWS, NOW)).toEqual({ ok: false, error: 'full' });
    expect(await addBot(a, code, readRoom(await a.read(roomPath(code)))!, CREWS, NOW)).toBe(null);
  });
  it('play three cars each when the room has no Big Rig and Final Five', async () => {
    const [a, b] = clients(2);
    const code = await createRoom(a, { name: 'Ada', crew: 'red' }, { ...OPTIONS, teams: false }, filler(7), NOW);
    await joinRoom(b, code, { name: 'Bo' }, CREWS, NOW);
    await b.write(roomPath(code, 'seats', 'u1', 'team'), 'big_rig');
    await startMatch(a, code, readRoom(await a.read(roomPath(code)))!, 'ab'.repeat(32), c => c);
    expect(readRoom(await a.read(roomPath(code)))!.setup!.players.map(p => p.team)).toEqual([undefined, undefined]);
  });
});

describe('one’s games', () => {
  it('are remembered per player and say whose turn it is', async () => {
    const [a, b] = clients(2);
    const { code } = await hostRoom(a, 'invite');
    await rememberGame(a, code, NOW);
    expect(Object.keys((await social(a)).games)).toEqual([code]);
    await joinRoom(b, code, { name: 'Bo' }, CREWS, NOW + 1);
    let room = readRoom(await a.read(roomPath(code)))!;
    expect(gameRow(code, room, 'u1')).toMatchObject({ state: 'waiting', host: false, seats: 4, players: [{ name: 'Ada' }, { name: 'Bo' }] });

    await startMatch(a, code, room, 'ab'.repeat(32), c => c);
    await a.write(roomPath(code, 'turn'), 'u1');
    room = readRoom(await a.read(roomPath(code)))!;
    expect(gameRow(code, room, 'u1')).toMatchObject({ state: 'turn', turnName: 'Bo' });
    expect(gameRow(code, room, 'u0')).toMatchObject({ state: 'playing', turnName: 'Bo', host: true });
    await a.write(roomPath(code, 'ended'), 'Ada');
    expect(gameRow(code, readRoom(await a.read(roomPath(code)))!, 'u1')).toMatchObject({ state: 'ended', winner: 'Ada' });

    await forgetGame(a, code);
    expect((await social(a)).games).toEqual({});
  });
});

describe('invitations', () => {
  it('reach the friend and go away once taken', async () => {
    const [a, b] = clients(2);
    await inviteFriend(a, 'u1', 'QWERT', 'Ada', NOW);
    expect((await social(b)).invites).toEqual({ QWERT: { from: 'u0', name: 'Ada', at: NOW } });
    await dropInvite(b, 'QWERT');
    expect((await social(b)).invites).toEqual({});
  });
});
