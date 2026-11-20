import { describe, expect, it } from 'vitest';
import { createTreeStore, memoryBacking, type TreeBacking } from '../../../src/net/tree-store';

// The tree store (src/net/tree-store.ts): with a backing shared by other processes (the tabs of a
// browser, `?net=local`) a write is made under the backing's lock, so two tabs writing at once do
// not lose one of the writes (2026-11-20: the guest of an online test never saw the host's moves).

describe('the tree store', () => {
  it('makes a write inside the backing’s lock and tells the watchers only after it', async () => {
    // Arrange: a backing whose lock runs the write later, and records when it is inside.
    const inner = memoryBacking();
    let inside = false;
    const order: string[] = [];
    const backing: TreeBacking = {
      ...inner,
      save: tree => { order.push(inside ? 'saved inside the lock' : 'saved outside the lock'); inner.save(tree); },
      atomic: fn => Promise.resolve().then(() => { inside = true; fn(); inside = false; }),
    };
    const store = createTreeStore(backing, 'u0');
    const seen: unknown[] = [];
    store.watch('rooms/A/log', v => seen.push(v));
    // Act
    const writing = store.write('rooms/A/log', ['first']);
    const before = await store.read('rooms/A/log');
    await writing;
    // Assert
    expect(before).toBeNull();
    expect(order).toEqual(['saved inside the lock']);
    expect(await store.read('rooms/A/log')).toEqual(['first']);
    expect(seen).toEqual([null, ['first']]);
  });

  it('keeps both writes of two clients writing at once under the lock', async () => {
    // Arrange: one lock for both clients, a chain of promises as the browser's Web Locks.
    const inner = memoryBacking();
    let chain = Promise.resolve();
    const backing: TreeBacking = { ...inner, atomic: fn => (chain = chain.then(fn)) };
    const host = createTreeStore(backing, 'host'), guest = createTreeStore(backing, 'guest');
    // Act
    await Promise.all([host.write('rooms/A/log/0', 1), guest.write('rooms/A/intents/guest', { n: 0, c: 1 })]);
    // Assert
    expect(await host.read('rooms/A/log/0')).toBe(1);
    expect(await guest.read('rooms/A/intents/guest')).toEqual({ n: 0, c: 1 });
  });
});
