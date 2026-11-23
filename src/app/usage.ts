// What this page tells the admins' "Statistiche" page (src/net/usage.ts, asked by the user,
// 2026-11-23): the matches played here, the time with the game open, the device and settings, and
// the errors. Written as the signed-in account; on the real site only Beta accounts can write
// (database.rules.json), with ?net=local into this browser's storage, under the emulators nothing.

import { FIREBASE_CONFIG } from '../net/firebase-config';
import type { UsageSink } from '../net/usage-store';
import {
  HEARTBEAT_MS, MAX_ERRORS_PER_PAGE, advanceMatch, dayKey, deviceOf, errorWhere, matchKey, newMatch, readMatch, type MatchRecord, type SessionRecord,
} from '../net/usage';
import { g } from './game';
import { netMode, openStore } from './online';
import { fpsNow } from './quality';
import { settings } from './settings';
import { S } from './state';

declare const __BUILD__: string;
const VERSION = typeof __BUILD__ === 'string' ? __BUILD__ : 'locale';
/** The longest a match goes unwritten while moves are made (the round and the end are written at once). */
const MATCH_WRITE_MS = 60_000;

let sinkP: Promise<UsageSink | null> | null = null;
/** Where the records go: null when nothing is recorded (emulators, no project). */
function sink(): Promise<UsageSink | null> {
  sinkP ??= (async () => {
    const mode = netMode();
    if (mode === 'local') {
      const { localUsageSink } = await import('../net/usage-store');
      return localUsageSink(localStorage, await (await openStore()).uid());
    }
    if (mode !== 'firebase' || !FIREBASE_CONFIG) return null;
    const { firebaseUsageSink } = await import('../net/usage-store');
    return firebaseUsageSink(FIREBASE_CONFIG);
  })().catch(() => null);
  return sinkP;
}
const fail = (e: unknown): void => console.warn('Statistiche d’uso non salvate', e);

// ---------------------------------------------------------------- matches

/** The match followed now: its key, its record (null while the stored one is read) and when it was last written. */
let cur: { key: string; rec: MatchRecord | null; wrote: number } | null = null;

/**
 * Called after every choice (game.ts, persist): keeps the record of the match on
 * the table up to date. Online only the host writes it; a game opened from a report is not counted.
 */
export function trackMatch(): void {
  if (!g || !S.saved || S.scratch) return;
  const net = S.net;
  if (net && (!net.host || !net.room)) return;
  const setup = S.saved.setup, choices = S.saved.choices.length;
  void sink().then(s => {
    if (!s || !g || S.saved?.setup !== setup) return;
    const key = matchKey(net ? 'online' : 'locale', net ? net.code : s.uid, setup.seed);
    const path = `stats/matches/${key}`, now = Date.now();
    if (cur?.key !== key) {
      // A new match on the table, or one taken up again (a reload, the host's place taken over).
      const mine = { key, rec: null as MatchRecord | null, wrote: 0 };
      cur = mine;
      void s.read(path).then(raw => {
        if (cur !== mine) return;
        const uids = net?.room ? Object.entries(net.room.seats).filter(([, x]) => !x.bot).map(([u]) => u) : [s.uid];
        mine.rec = { ...(readMatch(key, raw) ?? newMatch({ id: key, by: s.uid, mode: net ? 'online' : 'locale', room: net?.code, setup, uids, now, version: VERSION })), by: s.uid };
        trackMatch();
      }).catch(fail);
      return;
    }
    if (!cur.rec) return;
    const leaders = g.players.flatMap(p => (p.leader ? [p.leader] : []));
    const upgrades = g.vehicles.flatMap(v => [v.upgrade, v.upgrade2].filter((u): u is string => !!u));
    const { rec, changed } = advanceMatch(cur.rec, { rounds: g.round, choices, leaders, upgrades, winner: g.winner }, now, setup);
    const moved = rec.choices !== cur.rec.choices;
    cur.rec = rec;
    if (!changed && !(moved && now - cur.wrote > MATCH_WRITE_MS)) return;
    cur.wrote = now;
    const { id: _id, ...stored } = rec;
    void s.write(path, stored).catch(fail);
  });
}

// ---------------------------------------------------------------- the day's session

let session: SessionRecord | null = null;
let tick = 0;

/** The device, settings and name of this page now. */
function about(): Pick<SessionRecord, 'device' | 'os' | 'browser' | 'screen' | 'style' | 'quality' | 'fps' | 'version' | 'name'> {
  return {
    ...deviceOf(navigator.userAgent, matchMedia('(pointer: coarse)').matches), screen: `${innerWidth}×${innerHeight}`,
    style: settings.style, quality: settings.quality === 'auto' ? `auto (${S.level})` : settings.quality,
    fps: Math.round(fpsNow), version: VERSION, name: ((document.getElementById('myname') as HTMLInputElement | null)?.value ?? '').trim().slice(0, 24),
  };
}

/** Adds the time since the last beat to today's session and writes it. */
async function beat(s: UsageSink, opened: boolean): Promise<void> {
  const now = Date.now(), day = dayKey(now), path = `stats/sessions/${s.uid}/${day}`;
  if (!session || session.day !== day) {
    const raw = await s.read(path) as Partial<SessionRecord> | null;
    session = { uid: s.uid, day, first: raw?.first ?? now, last: now, active: raw?.active ?? 0, opens: raw?.opens ?? 0, ...about() };
    tick = now;
  }
  if (opened) session.opens++;
  // Only the time with the page on screen, each beat counted up to two beats (a computer gone to sleep).
  if (document.visibilityState === 'visible') session.active += Math.round(Math.min(now - tick, 2 * HEARTBEAT_MS) / 1000);
  tick = now;
  session = { ...session, ...about(), last: now };
  const { uid: _u, day: _d, ...stored } = session;
  await s.write(path, stored);
}

// ---------------------------------------------------------------- errors

let sentErrors = 0;
const seenErrors = new Set<string>();
function report(msg: string, stack: string | undefined): void {
  const where = errorWhere(stack), k = `${msg}|${where}`;
  if (seenErrors.has(k) || sentErrors >= MAX_ERRORS_PER_PAGE) return;
  seenErrors.add(k);
  sentErrors++;
  void sink().then(s => {
    if (!s) return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return s.write(`stats/errors/${id}`, { at: Date.now(), uid: s.uid, msg: msg.slice(0, 500), where, version: VERSION, browser: deviceOf(navigator.userAgent, false).browser });
  }).catch(fail);
}

/** Starts recording at page load: today's session, a beat a minute, and the unhandled errors. */
export function startUsage(): void {
  addEventListener('error', e => report(String(e.message || e.error || 'Errore'), (e.error as Error | undefined)?.stack));
  addEventListener('unhandledrejection', e => {
    const r = e.reason as Error | undefined;
    report(String(r?.message ?? r ?? 'Promessa rifiutata'), r?.stack);
  });
  void sink().then(s => {
    if (!s) return;
    void beat(s, true).catch(fail);
    setInterval(() => { if (document.visibilityState === 'visible') void beat(s, false).catch(fail); }, HEARTBEAT_MS);
    // Leaving the page or hiding it: the time so far is written.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void beat(s, false).catch(fail); });
  });
}
