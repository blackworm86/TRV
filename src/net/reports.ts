/**
 * Reports from the Beta testers (asked by the user, 2026-11-22): what went wrong or could be better,
 * with the game it happened in and a picture of the table, read by the admins in the admin page.
 *
 * Two places in the store, so the list stays light:
 * - `reports/<id>`: the card (kind, text, who, where, when, status and the admins' note);
 * - `reportData/<id>`: the heavy part, the whole game (setup and choices, to open it again at that
 *   point) and the picture.
 * Testers write new reports only; admins read them and change status and note (database.rules.json).
 * Two stores with the same shape: Firebase, and this browser's storage for checks on one computer.
 * The pure parts are unit-tested in tests/unit/net/reports.test.ts.
 */

import type { FirebaseConfig } from './firebase-config';

/** What a report is about, with the words the pages show. */
export const REPORT_KINDS = {
  bug: 'Bug',
  regola: 'Regola applicata male',
  grafica: 'Grafica o animazione',
  idea: 'Suggerimento',
  altro: 'Altro',
} as const;
export type ReportKind = keyof typeof REPORT_KINDS;

/** Where a report stands for the admins, with the words the page shows. */
export const REPORT_STATUSES = { nuova: 'Nuova', vista: 'Vista', risolta: 'Risolta', scartata: 'Scartata' } as const;
export type ReportStatus = keyof typeof REPORT_STATUSES;

/** Longest text kept, in characters. */
export const MAX_REPORT_TEXT = 4000;
/** Longest game kept (its JSON), in characters: far more than any real game. */
export const MAX_REPORT_GAME = 400_000;
/** Longest picture kept (a JPEG data URL), in characters. */
export const MAX_REPORT_SHOT = 600_000;
/** Longest admin note kept, in characters. */
export const MAX_REPORT_NOTE = 2000;

/** The card of a report. */
export interface Report {
  id: string;
  kind: ReportKind;
  text: string;
  /** When it was sent, ms since 1970. */
  at: number;
  uid: string;
  /** The name the tester plays with. */
  name: string;
  /** The game's version (the Menu's), the browser and the window size. */
  version: string;
  ua: string;
  screen: string;
  /** In a local (hot seat) game, online, or outside a game (the first screen). */
  where: 'locale' | 'online' | 'menu';
  room?: string;
  round?: number;
  /** Whose turn it was. */
  turn?: string;
  status: ReportStatus;
  note: string;
}

/** The heavy part of a report. `game`: the JSON of the saved game ({setup, choices}); `shot`: a JPEG data URL. */
export interface ReportData { game?: string; shot?: string }

/** A report as the tester writes it: the store adds id, status and note. */
export type NewReport = Omit<Report, 'id' | 'status' | 'note'>;

/**
 * Checks and tidies a report before it is sent: the text trimmed and cut to its length, the kind
 * known, the game and picture dropped when they are too long. Null when there is nothing to send.
 */
export function cleanReport(r: NewReport, data: ReportData): { report: NewReport; data: ReportData } | null {
  const text = r.text.trim().slice(0, MAX_REPORT_TEXT);
  if (!text || !(r.kind in REPORT_KINDS)) return null;
  const out: ReportData = {};
  if (data.game && data.game.length <= MAX_REPORT_GAME) out.game = data.game;
  if (data.shot && data.shot.length <= MAX_REPORT_SHOT && data.shot.startsWith('data:image/jpeg;base64,')) out.shot = data.shot;
  return {
    report: { ...r, text, name: r.name.slice(0, 24), version: r.version.slice(0, 80), ua: r.ua.slice(0, 300), screen: r.screen.slice(0, 20) },
    data: out,
  };
}

/** How many reports still wait to be looked at. */
export const unseen = (list: Report[]): number => list.filter(r => r.status === 'nuova').length;

/** Sends, lists and follows up the reports. */
export interface ReportStore {
  /** Sends a new report; resolves with its id. Rejects when there is nothing to send. */
  send(report: NewReport, data: ReportData): Promise<string>;
  /** Every report, newest first (admins). */
  list(): Promise<Report[]>;
  /** The game and the picture of report `id` (admins). */
  data(id: string): Promise<ReportData>;
  /** Changes the status of report `id` (admins). */
  setStatus(id: string, status: ReportStatus): Promise<void>;
  /** Writes the admins' note on report `id` (admins). */
  setNote(id: string, note: string): Promise<void>;
  /** Where the reports are kept, in words, for the page. */
  where: string;
}

const newestFirst = (a: Report, b: Report): number => b.at - a.at;
const LOCAL_KEY = 'trv-reports';

/** Reports kept in `storage` (localStorage in the page), on this computer only: for checks with ?net=local and ?admin=local. */
export function localReportStore(storage: Storage, now: () => number = Date.now): ReportStore {
  type Saved = { cards: Record<string, Report>; data: Record<string, ReportData> };
  const read = (): Saved => {
    try { return { cards: {}, data: {}, ...JSON.parse(storage.getItem(LOCAL_KEY) ?? '{}') as Partial<Saved> }; } catch { return { cards: {}, data: {} }; }
  };
  const write = (s: Saved): void => storage.setItem(LOCAL_KEY, JSON.stringify(s));
  const edit = (id: string, change: Partial<Report>): void => {
    const s = read();
    if (s.cards[id]) { Object.assign(s.cards[id], change); write(s); }
  };
  return {
    where: 'solo in questo browser (modalità locale)',
    send: async (report, data) => {
      const clean = cleanReport(report, data);
      if (!clean) throw new Error('Segnalazione vuota');
      const s = read();
      const id = `r${now()}-${Object.keys(s.cards).length}`;
      s.cards[id] = { ...clean.report, id, status: 'nuova', note: '' };
      s.data[id] = clean.data;
      write(s);
      return id;
    },
    list: async () => Object.values(read().cards).sort(newestFirst),
    data: async id => read().data[id] ?? {},
    setStatus: async (id, status) => edit(id, { status }),
    setNote: async (id, note) => edit(id, { note: note.trim().slice(0, MAX_REPORT_NOTE) }),
  };
}

/** Reads a card from a raw store value; null when it is not one. */
export function readReport(id: string, raw: unknown): Report | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (typeof r.text !== 'string' || typeof r.at !== 'number') return null;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    id, text: r.text, at: r.at, uid: str(r.uid), name: str(r.name), version: str(r.version), ua: str(r.ua), screen: str(r.screen),
    kind: (str(r.kind) in REPORT_KINDS ? r.kind : 'altro') as ReportKind,
    where: (['locale', 'online', 'menu'].includes(str(r.where)) ? r.where : 'menu') as Report['where'],
    ...(typeof r.room === 'string' ? { room: r.room } : {}),
    ...(typeof r.round === 'number' ? { round: r.round } : {}),
    ...(typeof r.turn === 'string' ? { turn: r.turn } : {}),
    status: (str(r.status) in REPORT_STATUSES ? r.status : 'nuova') as ReportStatus,
    note: str(r.note),
  };
}

/**
 * Reports in the Firebase Realtime Database of the project in `config`: testers send, admins read.
 * Loads the Firebase SDK on demand.
 */
export async function firebaseReportStore(config: FirebaseConfig): Promise<ReportStore> {
  const [{ firebaseApp }, db] = await Promise.all([import('./admin-auth'), import('firebase/database')]);
  const base = db.getDatabase(firebaseApp(config));
  const val = async (path: string): Promise<unknown> => (await db.get(db.ref(base, path))).val() as unknown;
  return {
    where: 'nel database del progetto (Firebase), visibili a tutti gli admin',
    send: async (report, data) => {
      const clean = cleanReport(report, data);
      if (!clean) throw new Error('Segnalazione vuota');
      const id = db.push(db.ref(base, 'reports')).key!;
      // The heavy part first: the rules accept it only while the card does not exist yet.
      await db.set(db.ref(base, `reportData/${id}`), { uid: clean.report.uid, ...clean.data });
      await db.set(db.ref(base, `reports/${id}`), { ...clean.report, status: 'nuova', note: '' });
      return id;
    },
    list: async () => {
      const all = (await val('reports') ?? {}) as Record<string, unknown>;
      return Object.entries(all).map(([id, raw]) => readReport(id, raw)).filter((r): r is Report => !!r).sort(newestFirst);
    },
    data: async id => {
      const d = (await val(`reportData/${id}`) ?? {}) as Record<string, unknown>;
      return { ...(typeof d.game === 'string' ? { game: d.game } : {}), ...(typeof d.shot === 'string' ? { shot: d.shot } : {}) };
    },
    setStatus: (id, status) => db.set(db.ref(base, `reports/${id}/status`), status),
    setNote: (id, note) => db.set(db.ref(base, `reports/${id}/note`), note.trim().slice(0, MAX_REPORT_NOTE)),
  };
}
