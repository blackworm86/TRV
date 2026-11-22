import { describe, expect, it } from 'vitest';
import { MAX_REPORT_GAME, MAX_REPORT_TEXT, cleanReport, localReportStore, readReport, unseen, type NewReport } from '../../../src/net/reports';

/** A stand-in for localStorage. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: i => [...m.keys()][i] ?? null,
    getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: k => { m.delete(k); },
  };
}

/** A report as the game writes it, with what a test changes. */
const report = (more: Partial<NewReport> = {}): NewReport => ({
  kind: 'bug', text: 'La macchina è passata sopra la roccia.', at: 1000, uid: 'u1', name: 'Ada',
  version: 'abc1234', ua: 'Test', screen: '1366×800', where: 'locale', round: 3, turn: 'Ada', ...more,
});
const SHOT = 'data:image/jpeg;base64,AAAA';

describe('a report before it is sent', () => {
  it('keeps the text trimmed and the game and picture attached', () => {
    const c = cleanReport(report({ text: '  Bug qui  ' }), { game: '{"setup":{},"choices":[1]}', shot: SHOT })!;
    expect(c.report.text).toBe('Bug qui');
    expect(c.data).toEqual({ game: '{"setup":{},"choices":[1]}', shot: SHOT });
  });
  it('has nothing to send without text', () => {
    expect(cleanReport(report({ text: '   ' }), {})).toBeNull();
  });
  it('refuses a kind it does not know', () => {
    expect(cleanReport(report({ kind: 'spam' as NewReport['kind'] }), {})).toBeNull();
  });
  it('cuts a text too long to its length', () => {
    expect(cleanReport(report({ text: 'x'.repeat(MAX_REPORT_TEXT + 10) }), {})!.report.text).toHaveLength(MAX_REPORT_TEXT);
  });
  it('drops a game too long and a picture that is not a JPEG', () => {
    const c = cleanReport(report(), { game: 'x'.repeat(MAX_REPORT_GAME + 1), shot: 'data:image/png;base64,AAAA' })!;
    expect(c.data).toEqual({});
  });
});

describe('reports on one computer', () => {
  it('lists a sent report as new, with its game and picture', async () => {
    const store = localReportStore(memoryStorage(), () => 5);
    const id = await store.send(report(), { game: '{"choices":[]}', shot: SHOT });
    const [r] = await store.list();
    expect(r).toMatchObject({ id, status: 'nuova', note: '', name: 'Ada', round: 3 });
    expect(await store.data(id)).toEqual({ game: '{"choices":[]}', shot: SHOT });
  });
  it('lists the newest first and counts the new ones', async () => {
    const store = localReportStore(memoryStorage());
    await store.send(report({ at: 1 }), {});
    const late = await store.send(report({ at: 2 }), {});
    const list = await store.list();
    expect(list.map(r => r.id)[0]).toBe(late);
    await store.setStatus(late, 'risolta');
    expect(unseen(await store.list())).toBe(1);
  });
  it('keeps the admins’ note, trimmed', async () => {
    const store = localReportStore(memoryStorage());
    const id = await store.send(report(), {});
    await store.setNote(id, '  Visto nel round 3  ');
    expect((await store.list())[0].note).toBe('Visto nel round 3');
  });
  it('refuses an empty report', async () => {
    await expect(localReportStore(memoryStorage()).send(report({ text: '' }), {})).rejects.toThrow('Segnalazione vuota');
  });
});

describe('a report read from the store', () => {
  it('takes an unknown kind or status as the default one', () => {
    expect(readReport('a', { text: 't', at: 1, kind: 'x', status: 'y' })).toMatchObject({ kind: 'altro', status: 'nuova', where: 'menu' });
  });
  it('is not a report without text or time', () => {
    expect(readReport('a', { kind: 'bug' })).toBeNull();
  });
});
