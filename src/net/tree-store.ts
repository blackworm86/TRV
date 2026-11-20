/**
 * A {@link RoomStore} over a plain JSON tree, without a server: in memory for unit tests, and in
 * `localStorage` shared between tabs of one browser for trying the online flow by hand
 * (`?net=local`). Same contract as the Firebase store, so the room logic cannot tell them apart.
 */

import type { RoomStore } from './room';

type Tree = { [key: string]: Json };
type Json = string | number | boolean | null | Json[] | Tree;

/** Where a tree store keeps its tree, and how it hears of changes made by others. */
export interface TreeBacking {
  load(): Tree;
  save(tree: Tree): void;
  /** Calls `cb` when someone else saved. */
  listen(cb: () => void): void;
  /**
   * Runs `fn` (a load, a change and a save) so that no other client's write falls in between, when
   * other clients share the backing from other processes (the tabs of a browser). Without it a write
   * made at the same moment by another tab is lost: the two read the same tree and the last to save
   * wins (the guest of an online test never saw the host's moves, 2026-11-20).
   */
  atomic?(fn: () => void): Promise<void>;
}

function at(tree: Tree, path: string): Json {
  let node: Json = tree;
  for (const key of path.split('/').filter(Boolean)) {
    if (node === null || typeof node !== 'object') return null;
    node = (node as Tree)[key] ?? null;
  }
  return node ?? null;
}

/** Sets a value in the tree; null removes it and prunes the branches left empty, as Firebase does. */
function put(tree: Tree, path: string, value: Json): void {
  const keys = path.split('/').filter(Boolean);
  const trail: Tree[] = [tree];
  for (const key of keys.slice(0, -1)) {
    const node = trail[trail.length - 1];
    if (node[key] === null || typeof node[key] !== 'object') node[key] = {};
    trail.push(node[key] as Tree);
  }
  const last = keys[keys.length - 1];
  if (value !== null) { trail[trail.length - 1][last] = value; return; }
  delete trail[trail.length - 1][last];
  for (let i = trail.length - 1; i > 0 && !Object.keys(trail[i]).length; i--) delete trail[i - 1][keys[i - 1]];
}

/** A store over `backing`, for the client `uid`. */
export function createTreeStore(backing: TreeBacking, uid: string): RoomStore {
  const watchers = new Set<{ path: string; cb: (value: unknown) => void; last: string }>();
  const notify = (): void => {
    const tree = backing.load();
    for (const w of [...watchers]) {
      const value = at(tree, w.path), text = JSON.stringify(value);
      if (text === w.last) continue;
      w.last = text;
      w.cb(value);
    }
  };
  backing.listen(notify);
  return {
    uid: () => Promise.resolve(uid),
    read: path => Promise.resolve(at(backing.load(), path)),
    write: (path, value) => {
      const change = (): void => {
        const tree = backing.load();
        put(tree, path, JSON.parse(JSON.stringify(value ?? null)) as Json);
        backing.save(tree);
      };
      if (!backing.atomic) { change(); notify(); return Promise.resolve(); }
      return backing.atomic(change).then(notify);
    },
    watch: (path, cb) => {
      const value = at(backing.load(), path);
      const w = { path, cb, last: JSON.stringify(value) };
      watchers.add(w);
      cb(value);
      return () => { watchers.delete(w); };
    },
  };
}

/** A tree in memory shared by the stores made from it: several clients in one test. */
export function memoryBacking(): TreeBacking {
  let text = '{}';
  const listeners: (() => void)[] = [];
  return {
    load: () => JSON.parse(text) as Tree,
    save: tree => { text = JSON.stringify(tree); for (const l of [...listeners]) l(); },
    listen: cb => { listeners.push(cb); },
  };
}

/** A tree in `localStorage`, shared by the tabs of this browser. The identity is per tab. */
export function createLocalStore(): RoomStore {
  const KEY = 'trv-net-local', UID = 'trv-net-local-uid';
  let uid = sessionStorage.getItem(UID);
  if (!uid) { uid = `local-${Math.floor(performance.timeOrigin)}-${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem(UID, uid); }
  const channel = new BroadcastChannel(KEY);
  return createTreeStore({
    load: () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Tree; } catch { return {}; } },
    save: tree => { localStorage.setItem(KEY, JSON.stringify(tree)); channel.postMessage(1); },
    listen: cb => { channel.addEventListener('message', cb); addEventListener('storage', e => { if (e.key === KEY) cb(); }); },
    // One write at a time across the tabs (Web Locks), where the browser has them.
    ...(typeof navigator !== 'undefined' && navigator.locks ? { atomic: (fn: () => void) => navigator.locks.request(KEY, fn).then(() => undefined) } : {}),
  }, uid);
}
