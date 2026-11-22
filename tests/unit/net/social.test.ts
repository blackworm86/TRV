import { describe, it, expect } from 'vitest';
import { addBot, createRoom, joinRoom, readRoom, roomPath, setReady, startMatch, type Room, type RoomStore } from '../../../src/net/room';
import {
  FRIEND_CODE_LENGTH, ONLINE_MS, acceptFriend, claimUsername, cleanUsername, earlierName, readProfile, readProfiles, addFriend, cleanFriendCode, declineFriend, dropInvite, ensureProfile, forgetGame, gameRow, heartbeat,
  inviteFriend, isOnline, lobbyEntry, lobbyPath, mutualFriends, newFriendCode, publishLobby, readLobby, readPresence, readSocial, rememberGame,
  removeFriend, setAvatar, showFriendCode, userPath, wipeAccount, nextHost, takeOverHost,
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
/** Registers a player with an account: its user name (the first word of `name`, lower case, at least 3 long), then its profile. */
async function register(s: RoomStore, name: string, fill: (bytes: Uint8Array) => Uint8Array, now: number) {
  const user = name.trim().split(' ')[0].toLowerCase().padEnd(3, '_');
  expect(await claimUsername(s, user)).toBe('ok');
  return ensureProfile(s, { user, name }, fill, now);
}
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
    const pa = await register(a, '  Ada ', filler(3), NOW);
    expect(pa.name).toBe('Ada');
    // The same bytes give the same code: b must draw again and gets the next one.
    const pb = await register(b, 'Bo', filler(3, 1), NOW);
    expect(pb.code).not.toBe(pa.code);
    const again = await register(a, 'Ada Lovelace', filler(9), NOW + 1);
    expect(again.code).toBe(pa.code);
    expect((await social(a)).profile?.name).toBe('Ada Lovelace');
  });
});

describe('user names', () => {
  it('are tidied to lower case and refused when too short, too long or with other characters', () => {
    expect(cleanUsername(' Ada.L ')).toBe('ada.l');
    expect(cleanUsername('bo_99')).toBe('bo_99');
    expect(cleanUsername('ab')).toBe('');
    expect(cleanUsername('a'.repeat(21))).toBe('');
    expect(cleanUsername('ada lovelace')).toBe('');
    expect(cleanUsername('.ada')).toBe('');
    expect(cleanUsername('àda')).toBe('');
  });
  it('belong to the first who registers them; the owner may claim its own again', async () => {
    const [a, b] = clients(2);
    expect(await claimUsername(a, 'Ada')).toBe('ok');
    expect(await claimUsername(b, 'ada')).toBe('taken');
    expect(await claimUsername(a, 'ada')).toBe('ok');
    expect(await claimUsername(b, 'x')).toBe('invalid');
  });
  it('are needed for a profile, whose shown name starts as the user name and can change', async () => {
    const [a, b] = clients(2);
    await expect(ensureProfile(a, { user: 'ada', name: 'Ada' }, filler(1), NOW)).rejects.toThrow();
    await claimUsername(a, 'ada');
    // Someone else's user name is not one's own.
    await expect(ensureProfile(b, { user: 'ada', name: 'Bo' }, filler(2), NOW)).rejects.toThrow();
    expect((await ensureProfile(a, { user: 'ada', name: '  ' }, filler(1), NOW)).name).toBe('ada');
    expect((await ensureProfile(a, { user: 'ada', name: 'Ada L.' }, filler(1), NOW + 1)).name).toBe('Ada L.');
    expect((await social(a)).profile).toMatchObject({ user: 'ada', name: 'Ada L.' });
  });
  it('are missing from a profile made before them, which then reads as none but keeps its shown name', () => {
    const old = { name: ' Riccardo ', code: 'ABCDEF', at: 1 };
    expect(readProfile(old)).toBeNull();
    expect(earlierName(old)).toBe('Riccardo');
    expect(earlierName(null)).toBe('');
  });
});

describe('friends', () => {
  it('are shown by their current profile, not by the name they had when the friendship began', async () => {
    const [a, b] = clients(2);
    const pb = await register(b, 'Bo', filler(2), NOW);
    await register(a, 'Ada', filler(1), NOW);
    await addFriend(a, pb.code, 'Ada', NOW);
    // Bo changes his shown name after Ada added him: her list still has the old one, his profile the new.
    await ensureProfile(b, { user: pb.user, name: 'Bo Rossi' }, filler(2), NOW + 1);
    const bo = await b.uid();
    expect((await social(a)).friends[bo].name).toBe('Bo');
    expect((await readProfiles(a, [bo, 'nobody']))).toEqual({ [bo]: expect.objectContaining({ user: pb.user, name: 'Bo Rossi' }), nobody: null });
  });

  it('cannot be asked of a player without an account profile, and never under a blank name', async () => {
    const [a, b] = clients(2);
    const pa = await register(a, 'Ada', filler(1), NOW);
    // b has a friend code from before user names, but no profile with one.
    await b.write('friendCodes/WWWWWW', await b.uid());
    expect(await addFriend(a, 'WWWWWW', 'Ada', NOW)).toBe('not-found');
    await register(b, 'Bo', filler(2), NOW);
    await expect(addFriend(b, pa.code, '  ', NOW)).rejects.toThrow();
  });

  it('are friends once both sides have asked, and a request can be accepted or declined', async () => {
    const [a, b, c] = clients(3);
    await register(a, 'Ada', filler(1), NOW);
    const pb = await register(b, 'Bo', filler(2), NOW);
    const pc = await register(c, 'Cy', filler(3), NOW);

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
    const pa = await register(a, 'Ada', filler(1), NOW);
    const pb = await register(b, 'Bo', filler(2), NOW);
    await addFriend(a, pb.code, 'Ada', NOW);
    expect(await addFriend(b, pa.code, 'Bo', NOW)).toBe('friends');
    expect((await social(b)).requests).toEqual({});
    expect(await mutualFriends(a, ['u1'])).toEqual(new Set(['u1']));
  });
  it('cannot be oneself or an unknown code', async () => {
    const [a] = clients(1);
    const pa = await register(a, 'Ada', filler(1), NOW);
    expect(await addFriend(a, pa.code, 'Ada', NOW)).toBe('self');
    expect(await addFriend(a, newFriendCode(filler(20)), 'Ada', NOW)).toBe('not-found');
  });
});

describe('host handover', () => {
  // Asked by the user (2026-11-22): a match does not stop when the host leaves.
  /** A room with the host (u0) and two guests (u1, u2), started; its code. */
  async function started(stores: RoomStore[]): Promise<string> {
    const code = await createRoom(stores[0], { name: 'Ada', crew: 'red' }, OPTIONS, filler(7), NOW);
    for (let i = 1; i < stores.length; i++) { await joinRoom(stores[i], code, { name: `G${i}` }, CREWS, NOW + i); await setReady(stores[i], code, true); }
    await startMatch(stores[0], code, readRoom(await stores[0].read(roomPath(code)))!, 'ab'.repeat(32), c => c);
    return code;
  }
  it('keeps the host while the host is in the room', async () => {
    // Arrange
    const s = clients(3);
    const code = await started(s);
    for (const x of s) await heartbeat(x, NOW, code);
    const room = readRoom(await s[0].read(roomPath(code)))!;
    // Act / Assert
    expect(nextHost(room, code, { u0: { at: NOW, room: code }, u1: { at: NOW, room: code }, u2: { at: NOW, room: code } }, NOW + 1000)).toBe(null);
    expect(await takeOverHost(s[1], code, room, NOW + 1000)).toBe(false);
  });
  it('passes the host to the first player in sitting order who is in the room, once the host is away', async () => {
    // Arrange: the host last seen long ago; of the guests, only the one later in the order is in the room.
    const s = clients(3);
    const code = await started(s);
    const room = readRoom(await s[0].read(roomPath(code)))!;
    const later = NOW + ONLINE_MS + 1000;
    const [first, second] = room.order.filter(id => id !== 'u0');
    const seen = { u0: { at: NOW, room: code }, [first]: { at: later, room: 'OTHER' }, [second]: { at: later, room: code } };
    // Act / Assert: the one in the room takes over; nobody when no one else is there.
    expect(nextHost(room, code, seen, later)).toBe(second);
    expect(nextHost(room, code, { u0: { at: NOW, room: code } }, later)).toBe(null);
    // takeOverHost: the first in order who is here (this page counts as here) writes itself as host.
    await heartbeat(s[0], NOW, code);
    const firstStore = s[Number(first.slice(1))];
    expect(await takeOverHost(firstStore, code, room, later)).toBe(true);
    expect(readRoom(await s[0].read(roomPath(code)))!.host).toBe(first);
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
    await setReady(b, code, true);
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
    await setReady(b, code, true);
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

describe('the profile picture and deleting an account', () => {
  it('keeps the chosen picture when the profile is written again, and goes back to the initial', async () => {
    // Arrange
    const [a] = clients(1);
    await register(a, 'Ada', filler(3), NOW);
    // Act
    await setAvatar(a, 'betty');
    await register(a, 'Ada L', filler(3), NOW + 1);
    // Assert
    expect((await social(a)).profile?.avatar).toBe('betty');
    await setAvatar(a, null);
    expect((await social(a)).profile?.avatar).toBeUndefined();
    await expect(setAvatar(a, '../x')).rejects.toThrow();
  });

  it('wipes the account’s data, its side of friendships and its waiting seats, and frees its user name', async () => {
    // Arrange: Ada and Bo are friends, Ada sits in Bo's waiting room and hosts one of her own.
    const [a, b] = clients(2);
    const pa = await register(a, 'Ada', filler(3), NOW);
    const pb = await register(b, 'Bo', filler(4), NOW);
    await addFriend(a, pb.code, 'Ada', NOW);
    await acceptFriend(b, 'u0', 'Ada', NOW);
    const bo = await createRoom(b, { name: 'Bo', crew: 'red' }, OPTIONS, filler(7), NOW);
    expect((await joinRoom(a, bo, { name: 'Ada' }, CREWS, NOW)).ok).toBe(true);
    await rememberGame(a, bo, NOW);
    const own = await createRoom(a, { name: 'Ada', crew: 'red' }, OPTIONS, filler(9), NOW);
    await rememberGame(a, own, NOW);
    // Act
    await wipeAccount(a, await social(a));
    // Assert
    expect(await a.read(userPath('u0'))).toBeNull();
    expect((await social(b)).friends).toEqual({});
    expect(readRoom(await b.read(roomPath(bo)))!.seats.u0).toBeUndefined();
    expect(await a.read(roomPath(own))).toBeNull();
    expect(await a.read(`usernames/${pa.user}`)).toBeNull();
    expect(await a.read(`friendCodes/${pa.code}`)).toBeNull();
  });
});
