/**
 * Where the usage records of src/net/usage.ts go and come from: the Firebase Realtime Database on
 * the real site, this browser's storage for checks on one computer (`?net=local`, `?admin=local`).
 * The game writes through a {@link UsageSink}; the admin page reads through a {@link UsageSource}.
 * Firebase is loaded on demand.
 */

import type { FirebaseConfig } from './firebase-config';
import { readResults, type GameResult } from './stats';
import { readErrors, readMatch, readSessions, type Account, type MatchRecord, type UsageData } from './usage';

/** Writes the records of one signed-in account. */
export interface UsageSink {
  uid: string;
  read(path: string): Promise<unknown>;
  write(path: string, value: unknown): Promise<void>;
}

/** Reads every record, for the admin page. */
export interface UsageSource {
  /** Where the records are kept, in words, for the page. */
  where: string;
  load(): Promise<UsageData>;
}

const LOCAL_KEY = 'trv-stats';
type Tree = Record<string, unknown>;

function at(tree: unknown, path: string): unknown {
  let node = tree;
  for (const k of path.split('/').filter(Boolean)) node = node && typeof node === 'object' ? (node as Tree)[k] : undefined;
  return node ?? null;
}

/** The records kept in `storage` under one key, written as account `uid`. */
export function localUsageSink(storage: Storage, uid: string): UsageSink {
  const load = (): Tree => { try { return JSON.parse(storage.getItem(LOCAL_KEY) ?? '{}') as Tree; } catch { return {}; } };
  return {
    uid,
    read: async path => at(load(), path),
    write: async (path, value) => {
      const tree = load(), keys = path.split('/').filter(Boolean);
      let node = tree;
      for (const k of keys.slice(0, -1)) node = (node[k] && typeof node[k] === 'object' ? node[k] : (node[k] = {})) as Tree;
      if (value === null || value === undefined) delete node[keys[keys.length - 1]];
      else node[keys[keys.length - 1]] = JSON.parse(JSON.stringify(value));
      storage.setItem(LOCAL_KEY, JSON.stringify(tree));
    },
  };
}

const matchesOf = (raw: unknown): MatchRecord[] =>
  Object.entries(raw && typeof raw === 'object' ? raw as Tree : {}).map(([id, v]) => readMatch(id, v)).filter((m): m is MatchRecord => !!m);

/** The records of this browser (`?admin=local`): no accounts list and no online results. */
export function localUsageSource(storage: Storage): UsageSource {
  return {
    where: 'solo in questo browser (modalità locale)',
    load: async () => {
      let tree: unknown = {};
      try { tree = JSON.parse(storage.getItem(LOCAL_KEY) ?? '{}'); } catch { /* empty */ }
      return { matches: matchesOf(at(tree, 'stats/matches')), sessions: readSessions(at(tree, 'stats/sessions')), errors: readErrors(at(tree, 'stats/errors')),
        accounts: [], results: {}, openRooms: 0 };
    },
  };
}

/**
 * The sink of the account signed in to the project in `config`: resolves once a Google account
 * (not the anonymous identity of the rooms) is signed in, which in the Beta is before any play.
 */
export async function firebaseUsageSink(config: FirebaseConfig): Promise<UsageSink> {
  const [{ firebaseApp, createAdminAuth }, db] = await Promise.all([import('./admin-auth'), import('firebase/database')]);
  const base = db.getDatabase(firebaseApp(config));
  const uid = await new Promise<string>(resolve => {
    let stop: (() => void) | null = null, done = false;
    stop = createAdminAuth(config).onUser(u => {
      if (done || !u || u.anonymous) return;
      done = true;
      resolve(u.uid);
      queueMicrotask(() => stop?.());
    });
  });
  return {
    uid,
    read: async path => (await db.get(db.ref(base, path))).val() as unknown,
    write: (path, value) => db.set(db.ref(base, path), value ?? null),
  };
}

/** Every record in the project in `config`, with the accounts and their online results (admins). */
export async function firebaseUsageSource(config: FirebaseConfig): Promise<UsageSource> {
  const [{ firebaseApp }, db] = await Promise.all([import('./admin-auth'), import('firebase/database')]);
  const base = db.getDatabase(firebaseApp(config));
  const val = async (path: string): Promise<unknown> => (await db.get(db.ref(base, path))).val() as unknown;
  const soft = (p: Promise<unknown>): Promise<unknown> => p.catch(() => null); // a part the rules do not open yet
  return {
    where: 'nel database del progetto (Firebase)',
    load: async () => {
      const [stats, names, lobby] = await Promise.all([val('stats'), soft(val('usernames')), soft(val('lobby'))]);
      const users = Object.entries(names && typeof names === 'object' ? names as Record<string, unknown> : {})
        .filter((e): e is [string, string] => typeof e[1] === 'string');
      const accounts: Account[] = [], results: Record<string, GameResult[]> = {};
      await Promise.all(users.map(async ([user, uid]) => {
        const [profile, res] = await Promise.all([soft(val(`users/${uid}/profile`)), soft(val(`users/${uid}/results`))]);
        const p = (profile && typeof profile === 'object' ? profile : {}) as Record<string, unknown>;
        accounts.push({ uid, user, name: typeof p.name === 'string' ? p.name : user });
        const list = readResults(res);
        if (list.length) results[uid] = list;
      }));
      return {
        matches: matchesOf(at(stats, 'matches')), sessions: readSessions(at(stats, 'sessions')), errors: readErrors(at(stats, 'errors')),
        accounts, results, openRooms: lobby && typeof lobby === 'object' ? Object.keys(lobby).length : 0,
      };
    },
  };
}
