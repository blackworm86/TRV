import { describe, expect, it } from 'vitest';
import { cleanEmail, emailKey, emailsIn, isTester, localTesterStore } from '../../../src/net/testers';

/** A stand-in for localStorage. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: i => [...m.keys()][i] ?? null,
    getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: k => { m.delete(k); },
  };
}

/** A database read over a fixed tree of paths; `offline` makes every read fail. */
const reader = (tree: Record<string, unknown>, offline = false) => async (path: string): Promise<unknown> => {
  if (offline) throw new Error('Client is offline');
  return tree[path] ?? null;
};

const USER = { uid: 'u1', email: 'Ada.Lovelace@Mail.it', anonymous: false };

describe('emails of the Beta testers', () => {
  it('tidies a typed email to lower case without spaces', () => {
    expect(cleanEmail('  Ada.Lovelace@Mail.IT ')).toBe('ada.lovelace@mail.it');
  });
  it('refuses text that cannot be an email', () => {
    for (const bad of ['', 'ada', 'ada@mail', '@mail.it', 'a da@mail.it', 'ada@mail/it.x']) expect(cleanEmail(bad)).toBe('');
  });
  it('turns every dot of the key into a comma, as the rules do', () => {
    expect(emailKey('Ada.Lovelace@Mail.it')).toBe('ada,lovelace@mail,it');
  });
});

describe('emails in a pasted text', () => {
  it('finds them one per line, between commas and semicolons, and in angle brackets', () => {
    expect(emailsIn('ada@x.it\nBob <bob@y.com>; carl@z.org, dee@w.net')).toEqual(['ada@x.it', 'bob@y.com', 'carl@z.org', 'dee@w.net']);
  });
  it('keeps each email once, whatever its case', () => {
    expect(emailsIn('Ada@X.it ada@x.it ADA@x.IT')).toEqual(['ada@x.it']);
  });
  it('finds them inside an export file and drops a full stop after them', () => {
    const exported = JSON.stringify({ users: [{ localId: 'u1', email: 'ada@x.it', createdAt: '1' }, { localId: 'u2' }] });
    expect(emailsIn(exported + ' Scrivi a bob@y.com.')).toEqual(['ada@x.it', 'bob@y.com']);
  });
  it('finds nothing in text without emails', () => {
    expect(emailsIn('nessuna email qui, solo @ e parole')).toEqual([]);
  });
});

describe('who may play the Beta', () => {
  it('lets an invited email in', async () => {
    expect(await isTester(reader({ 'testers/ada,lovelace@mail,it': { email: 'x', at: 1 } }), USER)).toBe(true);
  });
  it('lets an account on the list in', async () => {
    expect(await isTester(reader({ 'testerUids/u1': { name: 'Ada', user: 'ada', at: 1 } }), USER)).toBe(true);
  });
  it('lets an admin in', async () => {
    expect(await isTester(reader({ 'admins/u1': true }), USER)).toBe(true);
  });
  it('keeps out an account that is on no list', async () => {
    expect(await isTester(reader({ 'testerUids/someone-else': { name: 'B', user: 'b', at: 1 } }), USER)).toBe(false);
  });
  it('keeps out a guest even when its identity is listed', async () => {
    expect(await isTester(reader({ 'testerUids/u1': { at: 1 } }), { ...USER, anonymous: true })).toBe(false);
  });
  it('answers null when nothing can be read', async () => {
    expect(await isTester(reader({}, true), USER)).toBeNull();
  });
});

describe('the lists on one computer', () => {
  it('keeps an invited email until it is taken back', async () => {
    const store = localTesterStore(memoryStorage(), () => 5);
    await store.addEmail(' Ada@Mail.it ');
    expect((await store.list()).emails).toEqual([{ key: 'ada@mail,it', email: 'ada@mail.it', at: 5 }]);
    await store.removeEmail('ada@mail,it');
    expect((await store.list()).emails).toEqual([]);
  });
  it('invites a whole list in one go', async () => {
    const store = localTesterStore(memoryStorage(), () => 7);
    await store.addEmails(['ada@x.it', 'bob@y.com']);
    expect((await store.list()).emails.map(e => e.email).sort()).toEqual(['ada@x.it', 'bob@y.com']);
  });
  it('refuses an invalid email', async () => {
    await expect(localTesterStore(memoryStorage()).addEmail('ada')).rejects.toThrow('Email non valida');
  });
  it('imports the existing accounts only the first time', async () => {
    const store = localTesterStore(memoryStorage());
    expect(await store.importOnce()).toBe(0);
    expect(await store.importOnce()).toBeNull();
  });
});
