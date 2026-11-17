/**
 * Comments on the assets, written in the admin inspector. Two stores with the same shape: the
 * Firebase Realtime Database (`assetComments/<asset>/<id>`, which only admins can read and write:
 * database.rules.json) and the browser's storage, for `?admin=local` checks on one computer.
 * The pure parts (text cleaning, keys, the local store) are unit-tested in tests/unit/net/.
 */

import type { FirebaseConfig } from './firebase-config';

/** Longest comment kept, in characters. */
export const MAX_COMMENT = 2000;

/** One comment on one asset. */
export interface AssetComment {
  id: string;
  text: string;
  author: string;
  /** When it was written, ms since 1970. */
  at: number;
}

/** Reads and writes the comments of an asset (by its key, see assetKey). */
export interface CommentStore {
  /** The comments on `asset`, oldest first. */
  list(asset: string): Promise<AssetComment[]>;
  /** Adds a comment; rejects when the text is empty once trimmed. */
  add(asset: string, text: string, author: string): Promise<void>;
  /** Where the comments are kept, in words, for the page. */
  where: string;
}

/** The text as it is kept: trimmed and at most MAX_COMMENT long; null when nothing is left. */
export function cleanComment(text: string): string | null {
  const t = text.trim().slice(0, MAX_COMMENT);
  return t ? t : null;
}

/** The key of an inspector item: category and item id, without the characters Firebase keys refuse. Example: `assetKey('dadi', 'road')` → `'dadi__road'`. */
export function assetKey(catId: string, itemId: string): string {
  return `${catId}__${itemId}`.replace(/[.#$[\]/]/g, '_');
}

const LOCAL_KEY = 'trv-asset-comments';
const byTime = (a: AssetComment, b: AssetComment): number => a.at - b.at;

/** Comments kept in `storage` (localStorage in the page), on this computer only. */
export function localCommentStore(storage: Storage, now: () => number = Date.now): CommentStore {
  const read = (): Record<string, AssetComment[]> => {
    try { return JSON.parse(storage.getItem(LOCAL_KEY) ?? '{}') as Record<string, AssetComment[]>; } catch { return {}; }
  };
  return {
    where: 'solo in questo browser (modalità locale)',
    list: async asset => [...(read()[asset] ?? [])].sort(byTime),
    add: async (asset, text, author) => {
      const t = cleanComment(text);
      if (!t) throw new Error('Commento vuoto');
      const all = read();
      const list = (all[asset] ??= []);
      const at = now();
      list.push({ id: `${at}-${list.length}`, text: t, author, at });
      storage.setItem(LOCAL_KEY, JSON.stringify(all));
    },
  };
}

/**
 * Comments in the Firebase Realtime Database of the project in `config`, for the signed-in admin.
 * Loads the Firebase SDK on demand. Example: `const s = await firebaseCommentStore(FIREBASE_CONFIG);`
 */
export async function firebaseCommentStore(config: FirebaseConfig): Promise<CommentStore> {
  const [{ firebaseApp }, db] = await Promise.all([import('./admin-auth'), import('firebase/database')]);
  const base = db.getDatabase(firebaseApp(config));
  return {
    where: 'nel database del progetto (Firebase), visibili a tutti gli admin',
    list: async asset => {
      const snap = await db.get(db.ref(base, `assetComments/${asset}`));
      const val = (snap.val() ?? {}) as Record<string, Omit<AssetComment, 'id'>>;
      return Object.entries(val).map(([id, c]) => ({ id, ...c })).sort(byTime);
    },
    add: async (asset, text, author) => {
      const t = cleanComment(text);
      if (!t) throw new Error('Commento vuoto');
      await db.push(db.ref(base, `assetComments/${asset}`), { text: t, author: author.slice(0, 120), at: Date.now() });
    },
  };
}
