/**
 * How the game is used, for the admins' "Statistiche" page (asked by the user, 2026-11-23). Three
 * kinds of record, under `stats/` in the store (database.rules.json: Beta accounts write, admins read):
 *
 * - `stats/matches/<id>`: every match, local (hot seat) and online, from its start: who sat at the
 *   table, what was in play, the time played, the round reached and how it ended. Online only the
 *   host writes it, so a match counts once.
 * - `stats/sessions/<uid>/<day>`: one per account and day: the time with the game open, how many
 *   times it was opened, the device, the browser and the graphics settings.
 * - `stats/errors/<id>`: the program's unhandled errors, to see when something breaks.
 *
 * Only the pure parts are here (building, reading and adding up the records), unit-tested in
 * tests/unit/net/usage.test.ts; the game writes them (src/app/usage.ts), the admin page reads them
 * (src/net/usage-store.ts) and draws them (src/admin/stats-view.ts).
 */

import type { GameResult } from './stats';

/** The longest pause counted as time played: past it the match was left aside. */
export const IDLE_CAP_S = 300;
/** A match not ended and untouched for this long is counted as abandoned. */
export const ABANDON_MS = 2 * 60 * 60 * 1000;
/** How often an open page adds its time to the day's session. */
export const HEARTBEAT_MS = 60_000;
/** The most errors one page sends, so a loop cannot flood the store. */
export const MAX_ERRORS_PER_PAGE = 5;
/** How many days the "matches per day" chart covers. */
export const CHART_DAYS = 30;

/** The expansions and mini expansions a match can have, with the words the admin page shows. */
export const EXPANSIONS = {
  carnage: 'Carnage at Devil’s Run',
  leaders: 'Choppe Shoppe · leader',
  upgrades: 'Choppe Shoppe · upgrade',
  oneShots: 'One Shots',
  airstrikes: 'Advanced Airstrikes',
  bounties: 'Bounties',
  bonusCommands: 'Bonus Commands',
  roadConditions: 'Road Conditions',
} as const;
export type Expansion = keyof typeof EXPANSIONS;

/** One match, as the store keeps it. */
export interface MatchRecord {
  id: string;
  /** The account that writes it (the local player, or the online host). */
  by: string;
  mode: 'locale' | 'online';
  room?: string;
  /** Start, last move and end, ms since 1970; `end` only once someone won. */
  start: number;
  last: number;
  end?: number;
  /** Time played, seconds: the moves' time, each pause counted up to IDLE_CAP_S. */
  active: number;
  rounds: number;
  /** How many choices were made: a match left at 0 never really started. */
  choices: number;
  players: number;
  humans: number;
  bots: number;
  /** The highest Basic Protocol level among the TRV9000 teams (0: none). */
  botLevel: number;
  /** The accounts at the table: online the seats of people, local the account that plays. */
  uids: string[];
  expansions: Expansion[];
  /** Big Rig and Final Five seats. */
  teams: string[];
  /** The crew leaders and upgrade cards that came into play. */
  leaders: string[];
  upgrades: string[];
  /** The winning crew (colour), and whether it was a TRV9000 team. */
  winner?: string;
  winnerBot?: boolean;
  version: string;
}

/** One account's day with the game open. */
export interface SessionRecord {
  uid: string;
  /** The local date, YYYY-MM-DD. */
  day: string;
  name: string;
  first: number;
  last: number;
  /** Seconds with the page on screen. */
  active: number;
  opens: number;
  device: Device;
  os: string;
  browser: string;
  /** The window, `width×height` CSS pixels. */
  screen: string;
  style: string;
  quality: string;
  /** The frame rate last measured (0: unknown). */
  fps: number;
  version: string;
}

/** One unhandled error. */
export interface ErrorRecord {
  at: number;
  uid: string;
  msg: string;
  /** Where it was thrown: the first useful line of the stack. */
  where: string;
  version: string;
  browser: string;
}

export type Device = 'desktop' | 'tablet';

/** The setup fields the record reads (src/game/trv/engine.ts, Setup). */
export interface SetupLike {
  seed: string;
  players: { color: string; crew?: string; bot?: { protocol: number }; team?: string }[];
  carnage?: unknown; leaders?: boolean; upgrades?: boolean; oneShots?: boolean; airstrikes?: boolean;
  bounties?: boolean; bonusCommands?: boolean; roadConditions?: boolean;
}

/** What the game is now, as the record needs it. */
export interface MatchNow {
  rounds: number;
  choices: number;
  leaders: string[];
  upgrades: string[];
  /** The winning seat, null while the match goes on. */
  winner: number | null;
}

// ---------------------------------------------------------------- building

/** The local date of `ms`, YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The store key of a match: safe for Firebase (no `.#$[]/`), at most 60 characters. */
export function matchKey(mode: 'locale' | 'online', owner: string, seed: string): string {
  const safe = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${mode === 'online' ? 'O' : 'L'}-${safe(owner).slice(0, 28)}-${safe(seed).slice(0, 24)}`;
}

/** The record of a match that starts now. */
export function newMatch(o: { id: string; by: string; mode: 'locale' | 'online'; room?: string; setup: SetupLike; uids: string[]; now: number; version: string }): MatchRecord {
  const s = o.setup, bots = s.players.filter(p => p.bot);
  const expansions = (Object.keys(EXPANSIONS) as Expansion[]).filter(k => !!s[k]);
  return {
    id: o.id, by: o.by, mode: o.mode, ...(o.room ? { room: o.room } : {}), start: o.now, last: o.now, active: 0, rounds: 0, choices: 0,
    players: s.players.length, humans: s.players.length - bots.length, bots: bots.length,
    botLevel: Math.max(0, ...bots.map(p => p.bot!.protocol)), uids: [...new Set(o.uids)].slice(0, 8), expansions,
    teams: s.players.flatMap(p => (p.team ? [p.team] : [])), leaders: [], upgrades: [], version: o.version,
  };
}

/**
 * The record after the game moved on to `now`: the time since the last move added (up to
 * IDLE_CAP_S), the round, the cards in play and the winner. Returns a new record; `changed` says
 * whether anything the page shows is different (the time alone is not).
 */
export function advanceMatch(rec: MatchRecord, game: MatchNow, now: number, setup: SetupLike): { rec: MatchRecord; changed: boolean } {
  const out: MatchRecord = { ...rec };
  const moved = game.choices !== rec.choices;
  if (moved && rec.end === undefined) {
    out.active = rec.active + Math.min(Math.max(0, (now - rec.last) / 1000), IDLE_CAP_S);
    out.last = now;
  }
  out.choices = Math.max(rec.choices, game.choices);
  out.rounds = Math.max(rec.rounds, game.rounds);
  out.leaders = [...new Set([...rec.leaders, ...game.leaders])];
  out.upgrades = [...new Set([...rec.upgrades, ...game.upgrades])];
  if (game.winner !== null && rec.end === undefined) {
    const p = setup.players[game.winner];
    out.end = now;
    out.winner = p?.crew ?? p?.color ?? '';
    out.winnerBot = !!p?.bot;
  }
  const changed = out.rounds !== rec.rounds || out.end !== rec.end || out.leaders.length !== rec.leaders.length
    || out.upgrades.length !== rec.upgrades.length || (out.choices > 0 && rec.choices === 0);
  return { rec: out, changed };
}

/** Where a match stands at `now`. */
export function matchState(m: MatchRecord, now: number): 'finita' | 'in corso' | 'abbandonata' {
  if (m.end !== undefined) return 'finita';
  return now - m.last > ABANDON_MS ? 'abbandonata' : 'in corso';
}

/** The kind of device, its system and browser, from the user agent and whether the pointer is a finger. */
export function deviceOf(ua: string, coarse: boolean): { device: Device; os: string; browser: string } {
  const os = /Android/i.test(ua) ? 'Android' : /iPad|iPhone|iPod/i.test(ua) ? 'iPadOS' : /Macintosh/i.test(ua) ? (coarse ? 'iPadOS' : 'macOS')
    : /Windows/i.test(ua) ? 'Windows' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Altro';
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Altro';
  return { device: coarse || os === 'Android' || os === 'iPadOS' ? 'tablet' : 'desktop', os, browser };
}

/** The first line of a stack that points into the game's own code, without the address's origin. */
export function errorWhere(stack: string | undefined): string {
  const lines = (stack ?? '').split('\n').map(l => l.trim()).filter(l => /:\d+:\d+\)?$/.test(l));
  const line = lines[0] ?? '';
  return line.replace(/^at\s+/, '').replace(/https?:\/\/[^/\s)]+\//g, '').slice(0, 200);
}

// ---------------------------------------------------------------- reading

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** A list as the store gives it back: an array, or an object with numbered keys. */
const strs = (v: unknown): string[] => {
  const all = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v as object) : [];
  return all.filter((x): x is string => typeof x === 'string');
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});

/** A match from a raw store value; null when it is not one. */
export function readMatch(id: string, raw: unknown): MatchRecord | null {
  const r = obj(raw);
  if (typeof r.start !== 'number') return null;
  return {
    id, by: str(r.by), mode: r.mode === 'online' ? 'online' : 'locale', ...(typeof r.room === 'string' ? { room: r.room } : {}),
    start: r.start, last: num(r.last) || r.start, ...(typeof r.end === 'number' ? { end: r.end } : {}), active: num(r.active),
    rounds: num(r.rounds), choices: num(r.choices), players: num(r.players), humans: num(r.humans), bots: num(r.bots), botLevel: num(r.botLevel),
    uids: strs(r.uids), expansions: strs(r.expansions).filter((e): e is Expansion => e in EXPANSIONS), teams: strs(r.teams),
    leaders: strs(r.leaders), upgrades: strs(r.upgrades),
    ...(typeof r.winner === 'string' ? { winner: r.winner, winnerBot: r.winnerBot === true } : {}), version: str(r.version),
  };
}

/** The sessions under `stats/sessions` (uid → day → record). */
export function readSessions(raw: unknown): SessionRecord[] {
  const out: SessionRecord[] = [];
  for (const [uid, days] of Object.entries(obj(raw))) {
    for (const [day, v] of Object.entries(obj(days))) {
      const r = obj(v);
      if (typeof r.first !== 'number') continue;
      out.push({
        uid, day, name: str(r.name, 24), first: r.first, last: num(r.last) || r.first, active: num(r.active), opens: num(r.opens),
        device: r.device === 'tablet' ? 'tablet' : 'desktop', os: str(r.os, 40), browser: str(r.browser, 40), screen: str(r.screen, 20),
        style: str(r.style, 20), quality: str(r.quality, 20), fps: num(r.fps), version: str(r.version, 80),
      });
    }
  }
  return out;
}

/** The errors under `stats/errors`. */
export function readErrors(raw: unknown): ErrorRecord[] {
  return Object.values(obj(raw)).map(obj).filter(r => typeof r.at === 'number' && typeof r.msg === 'string')
    .map(r => ({ at: r.at as number, uid: str(r.uid), msg: str(r.msg, 500), where: str(r.where), version: str(r.version, 80), browser: str(r.browser, 40) }));
}

// ---------------------------------------------------------------- adding up

/** An account the admin page knows, from `usernames` and the profiles. */
export interface Account { uid: string; name: string; user: string }

/** Everything the page reads. */
export interface UsageData {
  matches: MatchRecord[];
  sessions: SessionRecord[];
  errors: ErrorRecord[];
  accounts: Account[];
  /** The online results each account saved (src/net/stats.ts), by uid. */
  results: Record<string, GameResult[]>;
  /** Rooms in the online list right now. */
  openRooms: number;
}

/** One line of the players' table. */
export interface PlayerRow {
  uid: string;
  name: string;
  user: string;
  /** Matches at the table (both kinds, started ones only). */
  matches: number;
  /** Online matches ended with a result, and how many won. */
  online: number;
  wins: number;
  /** Seconds with the game open, over every day. */
  time: number;
  days: number;
  /** The last time seen (0: never). */
  lastSeen: number;
  device: string;
}

/** A count by name, most first. */
export type Tally = [string, number][];

/** What the "Statistiche" page shows. */
export interface UsageSummary {
  /** Accounts known, and those seen today, in the last 7 and 30 days. */
  players: { known: number; today: number; week: number; month: number };
  matches: {
    total: number; finished: number; abandoned: number; ongoing: number; local: number; online: number;
    /** Over finished matches: minutes played and rounds, on average (0 when none). */
    avgMinutes: number; avgRounds: number;
    /** How many finished matches a TRV9000 team won. */
    botWins: number;
  };
  /** Matches started each of the last CHART_DAYS days, oldest first. */
  perDay: { day: string; local: number; online: number }[];
  /** Total time with the game open, seconds, and the average per account and day. */
  time: { total: number; perDay: number };
  rows: PlayerRow[];
  usage: {
    expansions: Tally; teams: Tally; botLevels: Tally; leaders: Tally; upgrades: Tally; playerCounts: Tally; winners: Tally;
    devices: Tally; os: Tally; browsers: Tally; styles: Tally; qualities: Tally; versions: Tally;
  };
  /** The frame rate of the sessions, on average, by device (0: none measured). */
  fps: { desktop: number; tablet: number };
  errors: { msg: string; where: string; count: number; last: number; users: number; versions: string[] }[];
  /** Matches left halfway, newest first. */
  abandoned: MatchRecord[];
}

function tally(values: Iterable<string>): Tally {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Adds up `data` as it is at `now`. Matches with no choice made are left out (opened and closed at once). */
export function summarizeUsage(data: UsageData, now: number): UsageSummary {
  const matches = data.matches.filter(m => m.choices > 0);
  const states = matches.map(m => matchState(m, now));
  const finished = matches.filter((_, i) => states[i] === 'finita');

  // Who was seen when: their sessions, and the matches they sat at.
  const seen = new Map<string, number>();
  const see = (uid: string, at: number): void => { if (uid && at > (seen.get(uid) ?? 0)) seen.set(uid, at); };
  for (const s of data.sessions) see(s.uid, s.last);
  for (const m of matches) for (const u of m.uids) see(u, m.last);
  const since = (ms: number): number => [...seen.values()].filter(at => at >= ms).length;
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);

  const perDay: UsageSummary['perDay'] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) perDay.push({ day: dayKey(midnight.getTime() - i * DAY_MS + 12 * 3600_000), local: 0, online: 0 });
  const dayAt = new Map(perDay.map(d => [d.day, d]));
  for (const m of matches) { const d = dayAt.get(dayKey(m.start)); if (d) d[m.mode === 'online' ? 'online' : 'local']++; }

  // The players' table: every account known, and every uid seen without one.
  const names = new Map(data.accounts.map(a => [a.uid, a]));
  const uids = new Set([...names.keys(), ...seen.keys(), ...Object.keys(data.results)]);
  const rows: PlayerRow[] = [...uids].map(uid => {
    const mine = data.sessions.filter(s => s.uid === uid).sort((a, b) => a.last - b.last);
    const res = data.results[uid] ?? [];
    const acc = names.get(uid);
    const latest = mine[mine.length - 1];
    return {
      uid, name: acc?.name || latest?.name || '', user: acc?.user ?? '',
      matches: matches.filter(m => m.uids.includes(uid)).length, online: res.length, wins: res.filter(r => r.won).length,
      time: mine.reduce((t, s) => t + s.active, 0), days: mine.length, lastSeen: seen.get(uid) ?? 0,
      device: latest ? `${latest.device === 'tablet' ? 'Tablet' : 'Desktop'} · ${latest.browser}` : '',
    };
  }).sort((a, b) => b.lastSeen - a.lastSeen || (a.name < b.name ? -1 : 1));

  type Group = UsageSummary['errors'][number] & { who: Set<string>; vs: Set<string> };
  const errs = new Map<string, Group>();
  for (const e of data.errors) {
    const k = `${e.msg}\u0000${e.where}`;
    const x: Group = errs.get(k) ?? { msg: e.msg, where: e.where, count: 0, last: 0, users: 0, versions: [], who: new Set(), vs: new Set() };
    x.count++; x.last = Math.max(x.last, e.at); x.who.add(e.uid); if (e.version) x.vs.add(e.version);
    errs.set(k, x);
  }
  const fpsOf = (d: Device): number => Math.round(avg(data.sessions.filter(s => s.device === d && s.fps > 0).map(s => s.fps)));
  const total = data.sessions.reduce((t, s) => t + s.active, 0);

  return {
    players: { known: uids.size, today: since(midnight.getTime()), week: since(now - 7 * DAY_MS), month: since(now - 30 * DAY_MS) },
    matches: {
      total: matches.length, finished: finished.length, abandoned: states.filter(s => s === 'abbandonata').length,
      ongoing: states.filter(s => s === 'in corso').length, local: matches.filter(m => m.mode === 'locale').length,
      online: matches.filter(m => m.mode === 'online').length,
      avgMinutes: Math.round(avg(finished.map(m => m.active / 60))), avgRounds: Math.round(avg(finished.map(m => m.rounds)) * 10) / 10,
      botWins: finished.filter(m => m.winnerBot).length,
    },
    perDay,
    time: { total, perDay: data.sessions.length ? Math.round(total / data.sessions.length) : 0 },
    rows,
    usage: {
      expansions: tally(matches.flatMap(m => m.expansions)), teams: tally(matches.flatMap(m => m.teams)),
      botLevels: tally(matches.filter(m => m.bots).map(m => `Livello ${m.botLevel}`)),
      leaders: tally(matches.flatMap(m => m.leaders)), upgrades: tally(matches.flatMap(m => m.upgrades)),
      playerCounts: tally(matches.map(m => `${m.players} giocatori`)), winners: tally(finished.map(m => m.winner ?? '')),
      devices: tally(data.sessions.map(s => s.device)), os: tally(data.sessions.map(s => s.os)), browsers: tally(data.sessions.map(s => s.browser)),
      styles: tally(data.sessions.map(s => s.style)), qualities: tally(data.sessions.map(s => s.quality)), versions: tally(data.sessions.map(s => s.version)),
    },
    fps: { desktop: fpsOf('desktop'), tablet: fpsOf('tablet') },
    errors: [...errs.values()].map(({ who, vs, ...e }) => ({ ...e, users: who.size, versions: [...vs] })).sort((a, b) => b.count - a.count || b.last - a.last),
    abandoned: matches.filter((_, i) => states[i] === 'abbandonata').sort((a, b) => b.last - a.last),
  };
}
