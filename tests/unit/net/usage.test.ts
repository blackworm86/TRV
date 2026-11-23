import { describe, expect, it } from 'vitest';
import {
  ABANDON_MS, IDLE_CAP_S, advanceMatch, dayKey, deviceOf, errorWhere, matchKey, matchState, newMatch, readErrors, readMatch,
  readSessions, summarizeUsage, type MatchRecord, type SessionRecord, type SetupLike, type UsageData,
} from '../../../src/net/usage';

const T0 = new Date(2026, 10, 23, 15, 0, 0).getTime();
const MIN = 60_000;

function setup(over: Partial<SetupLike> = {}): SetupLike {
  return { seed: 'abc.123', players: [{ color: 'red', crew: 'red' }, { color: 'blue', crew: 'blue', bot: { protocol: 2 } }], ...over };
}
function match(over: Partial<MatchRecord> = {}): MatchRecord {
  return { ...newMatch({ id: 'm', by: 'u1', mode: 'locale', setup: setup(), uids: ['u1'], now: T0, version: 'v1' }), choices: 5, ...over };
}
function session(over: Partial<SessionRecord> = {}): SessionRecord {
  return { uid: 'u1', day: dayKey(T0), name: 'Ada', first: T0, last: T0, active: 600, opens: 1, device: 'desktop', os: 'Windows', browser: 'Chrome',
    screen: '1280×800', style: 'modern', quality: 'auto', fps: 60, version: 'v1', ...over };
}
const empty = (over: Partial<UsageData> = {}): UsageData => ({ matches: [], sessions: [], errors: [], accounts: [], results: {}, openRooms: 0, ...over });

describe('match records', () => {
  it('starts with the table and what is in play', () => {
    const m = newMatch({ id: 'x', by: 'u1', mode: 'online', room: 'ABCDE', setup: setup({ carnage: true, bounties: true, players: [
      { color: 'red' }, { color: 'blue', team: 'big_rig' }, { color: 'green', bot: { protocol: 3 } }] }), uids: ['u1', 'u2', 'u1'], now: T0, version: 'v' });
    expect(m).toMatchObject({ players: 3, humans: 2, bots: 1, botLevel: 3, uids: ['u1', 'u2'], expansions: ['carnage', 'bounties'], teams: ['big_rig'], room: 'ABCDE' });
  });

  it('counts the time between moves, each pause up to the cap', () => {
    const m = newMatch({ id: 'x', by: 'u', mode: 'locale', setup: setup(), uids: ['u'], now: T0, version: 'v' });
    const a = advanceMatch(m, { rounds: 1, choices: 1, leaders: [], upgrades: [], winner: null }, T0 + 30_000, setup()).rec;
    const b = advanceMatch(a, { rounds: 1, choices: 2, leaders: [], upgrades: [], winner: null }, T0 + 30_000 + 60 * MIN, setup()).rec;
    expect(a.active).toBe(30);
    expect(b.active).toBe(30 + IDLE_CAP_S);
  });

  it('does not count time when no move was made', () => {
    const m = { ...match(), choices: 3 };
    const r = advanceMatch(m, { rounds: 0, choices: 3, leaders: [], upgrades: [], winner: null }, T0 + 120_000, setup());
    expect(r.rec.active).toBe(m.active);
    expect(r.changed).toBe(false);
  });

  it('records the winner once, with whether it was a TRV9000 team', () => {
    const m = match();
    const r = advanceMatch(m, { rounds: 4, choices: 6, leaders: ['l1'], upgrades: [], winner: 1 }, T0 + MIN, setup());
    expect(r.changed).toBe(true);
    expect(r.rec).toMatchObject({ end: T0 + MIN, winner: 'blue', winnerBot: true, rounds: 4, leaders: ['l1'] });
    const again = advanceMatch(r.rec, { rounds: 4, choices: 7, leaders: [], upgrades: [], winner: 1 }, T0 + 5 * MIN, setup());
    expect(again.rec.end).toBe(T0 + MIN);
  });

  it('tells finished, ongoing and abandoned matches apart', () => {
    expect(matchState(match({ end: T0 }), T0 + ABANDON_MS * 2)).toBe('finita');
    expect(matchState(match(), T0 + MIN)).toBe('in corso');
    expect(matchState(match(), T0 + ABANDON_MS + 1)).toBe('abbandonata');
  });

  it('makes keys Firebase accepts', () => {
    const k = matchKey('online', 'ABCDE', 'seed.with/odd#chars$[x]');
    expect(k).toMatch(/^O-ABCDE-[A-Za-z0-9_-]+$/);
    expect(k.length).toBeLessThanOrEqual(60);
  });
});

describe('device and errors', () => {
  it('tells tablets from desktops and names browser and system', () => {
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36 Edg/130', false))
      .toEqual({ device: 'desktop', os: 'Windows', browser: 'Edge' });
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36', true))
      .toEqual({ device: 'tablet', os: 'Android', browser: 'Chrome' });
    expect(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18 Safari/605.1.15', true))
      .toEqual({ device: 'tablet', os: 'iPadOS', browser: 'Safari' });
  });

  it('keeps the first line of the stack without the site address', () => {
    const stack = 'TypeError: x is undefined\n    at draw (https://trv.example.app/assets/index-abc.js:12:34)\n    at loop (https://trv.example.app/assets/index-abc.js:1:2)';
    expect(errorWhere(stack)).toBe('draw (assets/index-abc.js:12:34)');
    expect(errorWhere(undefined)).toBe('');
  });
});

describe('reading the store', () => {
  it('reads matches with lists stored as numbered objects, and skips what is not one', () => {
    const m = readMatch('id', { start: T0, uids: { 0: 'a', 1: 'b' }, expansions: ['carnage', 'nope'], mode: 'online' });
    expect(m).toMatchObject({ uids: ['a', 'b'], expansions: ['carnage'], mode: 'online', last: T0 });
    expect(readMatch('id', { nope: 1 })).toBeNull();
  });

  it('reads sessions by account and day, and errors', () => {
    expect(readSessions({ u1: { '2026-11-23': { first: T0, active: 60 }, bad: 3 } })).toHaveLength(1);
    expect(readErrors({ a: { at: T0, msg: 'boom' }, b: { at: 'x' } })).toHaveLength(1);
  });
});

describe('adding up', () => {
  it('counts players seen today, this week and this month', () => {
    const s = summarizeUsage(empty({
      accounts: [{ uid: 'u1', name: 'Ada', user: 'ada' }, { uid: 'u2', name: 'Bob', user: 'bob' }, { uid: 'u3', name: 'Cy', user: 'cy' }],
      sessions: [session({ uid: 'u1', last: T0 }), session({ uid: 'u2', last: T0 - 3 * 24 * 60 * MIN })],
    }), T0 + MIN);
    expect(s.players).toEqual({ known: 3, today: 1, week: 2, month: 2 });
  });

  it('adds up matches: finished, abandoned, ongoing, the average time and rounds, and leaves out those never played', () => {
    const s = summarizeUsage(empty({ matches: [
      match({ id: 'a', end: T0 + 30 * MIN, active: 30 * 60, rounds: 4, winner: 'red' }),
      match({ id: 'b', end: T0 + 50 * MIN, active: 50 * 60, rounds: 5, winner: 'blue', winnerBot: true, mode: 'online' }),
      match({ id: 'c', last: T0 - ABANDON_MS - MIN }),
      match({ id: 'd', last: T0 }),
      match({ id: 'e', choices: 0 }),
    ] }), T0 + MIN);
    expect(s.matches).toEqual({ total: 4, finished: 2, abandoned: 1, ongoing: 1, local: 3, online: 1, avgMinutes: 40, avgRounds: 4.5, botWins: 1 });
    expect(s.abandoned.map(m => m.id)).toEqual(['c']);
    expect(s.perDay[s.perDay.length - 1]).toEqual({ day: dayKey(T0), local: 3, online: 1 });
  });

  it('makes one row per player, with time, matches and online wins', () => {
    const s = summarizeUsage(empty({
      accounts: [{ uid: 'u1', name: 'Ada', user: 'ada' }],
      sessions: [session({ active: 600 }), session({ day: '2026-11-22', active: 300, last: T0 - 24 * 60 * MIN, device: 'tablet', browser: 'Safari' })],
      matches: [match({ uids: ['u1', 'u2'] })],
      results: { u1: [{ at: T0, won: true } as never, { at: T0, won: false } as never] },
    }), T0 + MIN);
    const ada = s.rows.find(r => r.uid === 'u1')!;
    expect(ada).toMatchObject({ name: 'Ada', matches: 1, online: 2, wins: 1, time: 900, days: 2, device: 'Desktop · Chrome' });
    expect(s.rows.map(r => r.uid).sort()).toEqual(['u1', 'u2']);
  });

  it('groups errors by message and place, most frequent first', () => {
    const s = summarizeUsage(empty({ errors: [
      { at: T0, uid: 'a', msg: 'x', where: 'f:1:1', version: 'v1', browser: 'Chrome' },
      { at: T0 + 1, uid: 'b', msg: 'x', where: 'f:1:1', version: 'v2', browser: 'Chrome' },
      { at: T0, uid: 'a', msg: 'y', where: 'g:1:1', version: 'v1', browser: 'Chrome' },
    ] }), T0);
    expect(s.errors[0]).toMatchObject({ msg: 'x', count: 2, users: 2, last: T0 + 1, versions: ['v1', 'v2'] });
    expect(s.errors).toHaveLength(2);
  });

  it('tallies devices, styles and expansions, most used first', () => {
    const s = summarizeUsage(empty({
      sessions: [session(), session({ uid: 'u2', style: 'arcade', device: 'tablet', fps: 30 }), session({ uid: 'u3', style: 'arcade', device: 'tablet', fps: 40 })],
      matches: [match({ expansions: ['carnage'] }), match({ expansions: ['carnage', 'bounties'] })],
    }), T0);
    expect(s.usage.styles).toEqual([['arcade', 2], ['modern', 1]]);
    expect(s.usage.expansions).toEqual([['carnage', 2], ['bounties', 1]]);
    expect(s.fps).toEqual({ desktop: 60, tablet: 35 });
  });
});
