// Comments on the assets, written in the admin inspector (src/net/asset-comments.ts).
import { describe, expect, it } from 'vitest';
import { assetKey, cleanComment, localCommentStore, MAX_COMMENT } from '../../../src/net/asset-comments';

/** A Storage in memory, as localStorage behaves. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: k => m.get(k) ?? null,
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

describe('cleanComment', () => {
  it('trims the text and keeps it', () => {
    expect(cleanComment('  il retro è storto \n')).toBe('il retro è storto');
  });

  it('refuses an empty comment', () => {
    expect(cleanComment('   ')).toBeNull();
  });

  it('cuts a comment longer than the limit', () => {
    expect(cleanComment('x'.repeat(MAX_COMMENT + 50))).toHaveLength(MAX_COMMENT);
  });
});

describe('assetKey', () => {
  it('joins category and item into one key with none of the characters Firebase refuses', () => {
    const k = assetKey('plancia', 'a.b#c$d[e]f/g');
    expect(k).toBe('plancia__a_b_c_d_e_f_g');
    expect(k).not.toMatch(/[.#$[\]/]/);
  });
});

describe('localCommentStore', () => {
  it('lists the comments of an asset, oldest first, and keeps assets apart', async () => {
    // Arrange
    let now = 1000;
    const store = localCommentStore(memoryStorage(), () => now++);
    // Act
    await store.add('dadi__road', 'primo', 'io');
    await store.add('dadi__slam', 'altro asset', 'io');
    await store.add('dadi__road', 'secondo', 'tu');
    const road = await store.list('dadi__road');
    // Assert
    expect(road.map(c => c.text)).toEqual(['primo', 'secondo']);
    expect(road[1]).toMatchObject({ author: 'tu', at: 1002 });
    expect((await store.list('dadi__slam')).map(c => c.text)).toEqual(['altro asset']);
  });

  it('does not save an empty comment', async () => {
    const store = localCommentStore(memoryStorage(), () => 1);
    await expect(store.add('x__y', '  ', 'io')).rejects.toThrow();
    expect(await store.list('x__y')).toEqual([]);
  });
});
