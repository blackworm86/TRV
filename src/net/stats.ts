/**
 * The player's statistics (asked by the user, 2026-11-22): every online match an account finishes
 * leaves one record, `users/<uid>/results/<room>`, written by that account at the end; the profile
 * window adds them up. The record is worked out by playing the match again from its setup and
 * choices (the rules are deterministic), so it needs nothing the table did not already have.
 *
 * Local (hot seat) matches do not count: several people play on one device and none of them is
 * known to be the account. The pure parts are unit-tested in tests/unit/net/stats.test.ts.
 */

import { leaders, newGame, play, upgrades, type Setup } from '../game/trv/engine';

/** One finished match, from the side of one seat. */
export interface GameResult {
  /** When it was recorded, ms since 1970. */
  at: number;
  won: boolean;
  /** How many seats the match had, TRV9000 teams included. */
  players: number;
  /** The crew (colour) this seat played. */
  crew: string;
  /** Its crew leader (Choppe Shoppe), when the match dealt them. */
  leader: string | null;
  /** The Final Five or the Big Rig instead of three cars. */
  team: string | null;
  /** How many TRV9000 teams sat at the table, and the highest Basic Protocol level among them (0: none). */
  bots: number;
  botLevel: number;
  /** Carnage at Devil's Run in play. */
  carnage: boolean;
  /** The upgrade cards this seat had on its cars during the match. */
  upgrades: string[];
  /** Ramp jumps by this seat's vehicles (Carnage at Devil's Run). */
  jumps: number;
  /** The round the match ended in. */
  rounds: number;
}

/**
 * Plays the match of `setup` and `choices` again and tells how it went for seat `seat`; null when
 * the choices do not bring it to a winner.
 */
export function resultOf(setup: Setup, choices: number[], seat: number, at: number): GameResult | null {
  const g = newGame(setup);
  const gen = play(g);
  const owner = new Map<string, number>(), fitted = new Set<string>();
  const look = (): void => {
    for (const v of g.vehicles) {
      if (typeof v.owner !== 'number') continue;
      owner.set(v.id, v.owner);
      if (v.owner === seat && v.upgrade) fitted.add(`${v.id}\u0000${v.upgrade}`);
    }
  };
  let r = gen.next(0);
  look();
  for (const c of choices) {
    if (r.done) break;
    r = gen.next(c);
    look();
  }
  if (g.winner === null || !g.players[seat]) return null;
  const p = g.players[seat], bots = setup.players.filter(x => x.bot);
  return {
    at, won: g.winner === seat, players: setup.players.length, crew: p.crew ?? '', leader: p.leader ?? null, team: p.team ?? null,
    bots: bots.length, botLevel: Math.max(0, ...bots.map(x => x.bot!.protocol)), carnage: !!setup.carnage,
    upgrades: [...fitted].map(k => k.split('\u0000')[1]),
    jumps: g.frames.filter(f => f.kind === 'jump' && f.vehicleId && owner.get(f.vehicleId) === seat).length,
    rounds: g.round,
  };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Reads the records under `users/<uid>/results`, oldest first; what is not a record is skipped. */
export function readResults(raw: unknown): GameResult[] {
  const all = raw && typeof raw === 'object' ? Object.values(raw as Record<string, unknown>) : [];
  const out: GameResult[] = [];
  for (const v of all) {
    const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    if (typeof r.won !== 'boolean' || typeof r.at !== 'number') continue;
    out.push({
      at: r.at, won: r.won, players: num(r.players), crew: str(r.crew), leader: str(r.leader) || null, team: str(r.team) || null,
      bots: num(r.bots), botLevel: num(r.botLevel), carnage: r.carnage === true,
      upgrades: Array.isArray(r.upgrades) ? r.upgrades.filter((u): u is string => typeof u === 'string') : [],
      jumps: num(r.jumps), rounds: num(r.rounds),
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** What the profile window shows: the records added up. */
export interface PlayerStats {
  played: number;
  won: number;
  /** Wins out of matches, 0-100, rounded. */
  winRate: number;
  /** The longest run of wins in a row. */
  bestStreak: number;
  /** Matches and wins per crew (colour). */
  byCrew: Record<string, { played: number; won: number }>;
  /** The leader played most, and the one with the most wins (ties: the one reached first). */
  favoriteLeader: { id: string; played: number } | null;
  bestLeader: { id: string; won: number } | null;
  /** The upgrade card fitted most often. */
  favoriteUpgrade: { id: string; times: number } | null;
  jumps: number;
  /** Matches against at least one TRV9000, and wins in them. */
  vsBots: { played: number; won: number };
  /** Matches as the Big Rig and as the Final Five. */
  bigRig: number;
  finalFive: number;
  /** Matches with Carnage at Devil's Run. */
  carnage: number;
}

/** The most counted key of `counts`, or null when nothing was counted. */
function top(counts: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const e of counts) if (e[1] > 0 && (!best || e[1] > best[1])) best = e;
  return best;
}
const bump = (m: Map<string, number>, k: string, by = 1): void => { m.set(k, (m.get(k) ?? 0) + by); };

/** Adds up `results` (in the order they were played). */
export function summarize(results: GameResult[]): PlayerStats {
  const byCrew: PlayerStats['byCrew'] = {};
  const leaderPlays = new Map<string, number>(), leaderWins = new Map<string, number>(), ups = new Map<string, number>();
  let won = 0, streak = 0, bestStreak = 0, jumps = 0, bigRig = 0, finalFive = 0, carnage = 0;
  const vsBots = { played: 0, won: 0 };
  for (const r of results) {
    if (r.won) { won++; streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
    if (r.crew) { const c = byCrew[r.crew] ??= { played: 0, won: 0 }; c.played++; if (r.won) c.won++; }
    if (r.leader) { bump(leaderPlays, r.leader); bump(leaderWins, r.leader, r.won ? 1 : 0); }
    for (const u of r.upgrades) bump(ups, u);
    jumps += r.jumps;
    if (r.bots) { vsBots.played++; if (r.won) vsBots.won++; }
    if (r.team === 'big_rig') bigRig++;
    if (r.team === 'final_five') finalFive++;
    if (r.carnage) carnage++;
  }
  const fl = top(leaderPlays), bl = top(leaderWins), fu = top(ups);
  return {
    played: results.length, won, winRate: results.length ? Math.round(won / results.length * 100) : 0, bestStreak, byCrew,
    favoriteLeader: fl && { id: fl[0], played: fl[1] }, bestLeader: bl && { id: bl[0], won: bl[1] },
    favoriteUpgrade: fu && { id: fu[0], times: fu[1] }, jumps, vsBots, bigRig, finalFive, carnage,
  };
}

/** The shown name of a crew leader or an upgrade card, by id (the id itself when unknown). */
export const leaderName = (id: string): string => leaders().find(l => l.id === id)?.name ?? id;
export const upgradeName = (id: string): string => upgrades().find(u => u.id === id)?.name ?? id;
