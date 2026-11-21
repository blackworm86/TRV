/**
 * The closed Beta: only invited players may open the game (asked by the user, 2026-11-21).
 *
 * Two lists, both written only by admins (database.rules.json):
 * - `testers/<email key>`: invited by email, from the admin page, before the person ever signs in;
 * - `testerUids/<uid>`: accounts let in by their identity, at first every account registered before
 *   the Beta (the admin page copies them once, `beta/imported` records when).
 * Admins (`admins/<uid>`) are always testers. A guest (anonymous sign-in) never is.
 *
 * The rules refuse rooms, lobby, friends and profiles to anyone else; the game's own gate (src/app/beta.ts)
 * only says so. The pure parts are unit-tested in tests/unit/net/testers.test.ts.
 */

import type { FirebaseConfig } from './firebase-config';

/** An email invited to the Beta. `key`: its database key (see {@link emailKey}). */
export interface InvitedEmail { key: string; email: string; at: number }
/** An account let in by its identity, with the names it had when it was added. */
export interface InvitedAccount { uid: string; name: string; user: string; at: number }
/** Both lists, newest first. */
export interface TesterLists { emails: InvitedEmail[]; accounts: InvitedAccount[] }

/** Reads and writes the lists of Beta testers. Only admins can, on the real database. */
export interface TesterStore {
  /** Both lists, newest first. */
  list(): Promise<TesterLists>;
  /** Invites `email`; rejects when it cannot be an email. */
  addEmail(email: string): Promise<void>;
  /** Invites every email in `emails` (already tidied, see {@link emailsIn}) in one write. */
  addEmails(emails: string[]): Promise<void>;
  /** Takes the invitation of the email with key `key` back. */
  removeEmail(key: string): Promise<void>;
  /** Takes the account `uid` off the list. */
  removeAccount(uid: string): Promise<void>;
  /**
   * The first time only: copies every account registered so far (a user name taken) to the accounts
   * list. Resolves with how many were added, or null when this was already done.
   */
  importOnce(): Promise<number | null>;
  /** Where the lists are kept, in words, for the page. */
  where: string;
}

/** Tidies a typed email: trimmed, lower case; '' when it cannot be one. Example: `cleanEmail(' Ada@Mail.IT ')` → `ada@mail.it`. */
export function cleanEmail(text: string): string {
  const e = text.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@#$[\]/]+@[^\s@#$[\]/]+\.[^\s@#$[\]/]+$/.test(e) ? e : '';
}

/**
 * Every email in a pasted text, tidied, each once, in the order met: a list one per line, separated
 * by commas or semicolons, `Name <email>`, or a whole file (such as Firebase's export of its users).
 * Example: `emailsIn('Ada <ada@x.it>; bob@y.com, ADA@x.it')` → `['ada@x.it', 'bob@y.com']`.
 */
export function emailsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/[^\s@<>()[\]{}"',;:]+@[^\s@<>()[\]{}"',;:]+/g)) {
    const e = cleanEmail(m[0].replace(/\.+$/, ''));
    if (e) out.add(e);
  }
  return [...out];
}

/**
 * The database key of an email: lower case, every `.` turned into `,` (Firebase keys refuse dots).
 * The rules compute the same from the signed-in account's email. Example: `emailKey('a.b@x.it')` → `a,b@x,it`.
 */
export function emailKey(email: string): string {
  return email.trim().toLowerCase().split('.').join(',');
}

/** The signed-in user, as the gate needs it. */
export interface GateUser { uid: string; email: string | null; anonymous: boolean }

/**
 * Whether `user` may play the Beta: an admin, an account on the list, or an invited email. `read`
 * reads one database path (null when missing). A guest never may. Resolves null when nothing could
 * be read (offline): the caller decides.
 */
export async function isTester(read: (path: string) => Promise<unknown>, user: GateUser): Promise<boolean | null> {
  if (user.anonymous) return false;
  const checks = [read(`admins/${user.uid}`).then(v => v === true), read(`testerUids/${user.uid}`).then(v => v != null)];
  if (user.email) checks.push(read(`testers/${emailKey(user.email)}`).then(v => v != null));
  const got = await Promise.all(checks.map(c => c.catch(() => null)));
  return got.some(v => v === true) ? true : got.every(v => v === null) ? null : false;
}

const LOCAL_KEY = 'trv-beta-testers';
const newestFirst = (a: { at: number }, b: { at: number }): number => b.at - a.at;

/** The lists in `storage` (localStorage in the page), on this computer only: for `?admin=local` checks. */
export function localTesterStore(storage: Storage, now: () => number = Date.now): TesterStore {
  type Saved = { emails: Record<string, InvitedEmail>; accounts: Record<string, InvitedAccount>; imported?: number };
  const read = (): Saved => {
    try { return { emails: {}, accounts: {}, ...JSON.parse(storage.getItem(LOCAL_KEY) ?? '{}') as Partial<Saved> }; } catch { return { emails: {}, accounts: {} }; }
  };
  const write = (s: Saved): void => storage.setItem(LOCAL_KEY, JSON.stringify(s));
  return {
    where: 'solo in questo browser (modalità locale)',
    list: async () => {
      const s = read();
      return { emails: Object.values(s.emails).sort(newestFirst), accounts: Object.values(s.accounts).sort(newestFirst) };
    },
    addEmail: async text => {
      const email = cleanEmail(text);
      if (!email) throw new Error('Email non valida');
      const s = read();
      s.emails[emailKey(email)] = { key: emailKey(email), email, at: now() };
      write(s);
    },
    addEmails: async list => {
      const s = read(), at = now();
      for (const email of list) s.emails[emailKey(email)] = { key: emailKey(email), email, at };
      write(s);
    },
    removeEmail: async key => { const s = read(); delete s.emails[key]; write(s); },
    removeAccount: async uid => { const s = read(); delete s.accounts[uid]; write(s); },
    importOnce: async () => {
      const s = read();
      if (s.imported) return null;
      s.imported = now();
      write(s);
      return 0; // no accounts on this computer
    },
  };
}

/**
 * The lists in the Firebase Realtime Database of the project in `config`, for the signed-in admin.
 * Loads the Firebase SDK on demand.
 */
export async function firebaseTesterStore(config: FirebaseConfig): Promise<TesterStore> {
  const [{ firebaseApp }, db] = await Promise.all([import('./admin-auth'), import('firebase/database')]);
  const base = db.getDatabase(firebaseApp(config));
  const val = async (path: string): Promise<unknown> => (await db.get(db.ref(base, path))).val() as unknown;
  const obj = (v: unknown): Record<string, Record<string, unknown>> => (v && typeof v === 'object' ? v as Record<string, Record<string, unknown>> : {});
  return {
    where: 'nel database del progetto (Firebase), visibili a tutti gli admin',
    list: async () => {
      const [emails, accounts] = await Promise.all([val('testers'), val('testerUids')]);
      return {
        emails: Object.entries(obj(emails)).map(([key, e]) => ({ key, email: String(e.email ?? key), at: Number(e.at) || 0 })).sort(newestFirst),
        accounts: Object.entries(obj(accounts)).map(([uid, a]) => ({ uid, name: String(a.name ?? ''), user: String(a.user ?? ''), at: Number(a.at) || 0 })).sort(newestFirst),
      };
    },
    addEmail: async text => {
      const email = cleanEmail(text);
      if (!email) throw new Error('Email non valida');
      await db.set(db.ref(base, `testers/${emailKey(email)}`), { email, at: Date.now() });
    },
    addEmails: async list => {
      const at = Date.now(), updates: Record<string, unknown> = {};
      for (const email of list) updates[`testers/${emailKey(email)}`] = { email, at };
      if (list.length) await db.update(db.ref(base), updates);
    },
    removeEmail: key => db.remove(db.ref(base, `testers/${key}`)),
    removeAccount: uid => db.remove(db.ref(base, `testerUids/${uid}`)),
    importOnce: async () => {
      if (await val('beta/imported') != null) return null;
      // Every registered account holds a user name (social.ts): usernames/<name> = uid.
      const names = Object.entries((await val('usernames') ?? {}) as Record<string, unknown>)
        .filter((e): e is [string, string] => typeof e[1] === 'string');
      const at = Date.now();
      const rows = await Promise.all(names.map(async ([user, uid]) => {
        const p = obj({ p: await val(`users/${uid}/profile`).catch(() => null) }).p ?? {};
        return [uid, { name: String(p.name ?? user).slice(0, 24), user, at }] as const;
      }));
      const updates: Record<string, unknown> = { 'beta/imported': at };
      for (const [uid, row] of rows) updates[`testerUids/${uid}`] = row;
      await db.update(db.ref(base), updates);
      return rows.length;
    },
  };
}
