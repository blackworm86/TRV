// Production of the 3D models (design/art/modelli-strutturati.md §20): the rules every model follows
// (data/trv/modelli/regole.json) and one production sheet per model (data/trv/modelli/<id>.json),
// with the prompts for Gemini and Meshy put together from the shared blocks. Pure: unit-tested in
// tests/unit/admin/produzione.test.ts. The admin inspector draws it (src/admin/produzione-view.ts).

import RAW from '../../data/trv/modelli/regole.json';
import type { Dima } from '../models/dima';

/** A prompt as it was written and used, with what it is for. */
export interface Prompt { titolo: string; testo: string }
/** The prompts a piece was generated with before the specification, copied from the old prompt files. */
export interface UsedPrompts {
  /** The file the prompts were copied from. */
  fonte: string;
  gemini: Prompt[];
  meshy: Prompt[];
  /** Ready corrections: when the picture comes out wrong in this way, add this text. */
  correzioni?: { quando: string; testo: string }[];
  impostazioni?: Record<string, string | number>;
}
/** One generation of a piece: when, with what, with which prompt, how it ended. */
export interface Attempt { data: string; strumento: string; prompt: string; esito: string; sorgente?: string; nota?: string }
/** One file to generate: a body, a wheel, a weapon, a figure. */
export interface Piece {
  id: string;
  nome: string;
  /** A key of the rules' `tipi`. */
  tipo: string;
  /** The model in the repository, or null while it is not there. */
  file: string | null;
  /** Where the file is when it is not in this branch. */
  altrove?: string;
  /** The generated file as it came, in assets/sorgenti/ (outside git). */
  sorgente?: string;
  nota?: string;
  /** Painted in the player's colour: the prompt gets the paint and weathering block. */
  tinto?: boolean;
  /** Has seats or grips: the prompt gets the template block. */
  posti?: boolean;
  /** The triangles asked of Meshy. */
  triangoli?: number;
  /** The pictures to attach to the Gemini prompt. */
  allegati?: string[];
  /** What makes this piece its own; the shared blocks go around it. */
  specifico?: { gemini: string; meshy: string };
  usato?: UsedPrompts;
  tentativi: Attempt[];
}
/** The production sheet of one model (schema 1). */
export interface Sheet {
  schema: number;
  id: string;
  nome: string;
  /** A game of the asset catalogue: base, carnage, big_rig… */
  gioco: string;
  /** A key of the rules' `classi`. */
  classe: string;
  scopo: string;
  /** A key of the rules' `regimi`: born before the specification, or following it. */
  regime: string;
  /** The step of the workflow it has reached (rules' `passi`), how, and since when. */
  stato: { passo: number; esito: string; dal: string; nota: string };
  posti?: { id: string; posa: string; ruolo: string; nota?: string }[];
  pezzi: Piece[];
  collaudi: unknown[];
  decisioni: { data: string; testo: string }[];
  provenienza: { origine: string; strumento: string; fonte: string; data: string | null };
  /** The measures it has in the game today, when they are not the class's. */
  misure_oggi?: { lunghezza: number | null; tavolo_mm: number | null };
  /** Its assembly sheets (assets/<game>/modelli/schede/). */
  montaggio?: string[];
  /** The one-piece models it replaced, still in the repository. */
  precedente?: string[];
  note?: string[];
  /** Its template: the grey block-out with the seats, built before anything is generated (§17). */
  dima?: Dima;
}
/** A class of vehicle: real measures in metres, null where they are still to be set. */
export interface VehicleClass {
  nome: string; sagoma: string; lunghezza: number | null; altezza: number | null; larghezza: number | null; ruota: number | null; posti: string[];
  /** One road space long from hitch to hitch, with no margin at its ends (a section of the Big Rig). */
  gancio_a_gancio?: boolean;
}
/** A least and a most; null where there is none. */
export type Range = [number | null, number | null] | null;
/** The rules file (schema 1): only what the code reads is typed closely. */
export interface Rules {
  schema: number;
  documento: string;
  scala: { rapporto: number; mm_per_metro: number; casella_mm: number; margine_mm: number; nota: string };
  figura: {
    misure: Record<string, number>; nomi_misure: Record<string, string>; capsule: Record<string, number>;
    portata: { min: number; max: number }; tolleranza_ossa: number; ossa: string[]; nomi_meshy: Record<string, string>;
    riposo: string; limiti_gradi: [string, string, number, number][]; versi: Record<string, string>;
  };
  posti: { nomi: Record<string, string>; misure: [string, Range, Range, Range][] };
  classi: Record<string, VehicleClass | string>;
  parti_mobili: Record<string, Record<string, number | number[]> | string>;
  vernice: { quota_vernice: number[]; quota_usura: number[] };
  collaudo: Record<string, number | string>;
  budget: Record<string, { triangoli: number; texture: number; materiali: number } | string>;
  lod: {
    verificato: boolean; veicoli: { id: string; nome: string; px: [number, number | null]; triangoli?: number; triangoli_max?: number; texture: number }[];
    isteresi: number; qualita: number; livello_minimo_in_azione: string; tavolo_intero_triangoli: number; vista_mappa_triangoli: number; regola: string;
  };
  passi: { n: number; nome: string; chi: string; cancello: string }[];
  esiti: Record<string, string>;
  regimi: Record<string, string>;
  tipi: Record<string, string>;
  blocchi: {
    stile: string; camera: string; colore: string; dima: string; tipo: Record<string, string>;
    /** The approved concept attached to every Gemini prompt, from the project root. */
    riferimento_stile?: string;
    /** The camera and the template text of the kinds of piece that are not drawn like a body. */
    camera_per_tipo?: Record<string, string>; dima_per_tipo?: Record<string, string>;
    meshy: { coda: string; coda_per_tipo?: Record<string, string>; modo: string; impostazioni: Record<string, Record<string, string | number> | string>; esportazione: string };
    regole_gemini: string[];
  };
}

/** The rules as the repository has them. */
export const RULES = RAW as unknown as Rules;

const FILES = import.meta.glob<Sheet>('/data/trv/modelli/*.json', { eager: true, import: 'default' });
/** Every production sheet of the repository, the ones that follow the specification first, then by name. */
export const SHEETS: Sheet[] = Object.entries(FILES).filter(([p]) => !p.endsWith('/regole.json')).map(([, s]) => s)
  .sort((a, b) => Number(b.regime === 'specifica') - Number(a.regime === 'specifica') || a.nome.localeCompare(b.nome, 'it'));

/** The classes of the rules, without the note the file keeps beside them. */
export function classes(r: Rules = RULES): Record<string, VehicleClass> {
  return Object.fromEntries(Object.entries(r.classi).filter(([, c]) => typeof c === 'object')) as Record<string, VehicleClass>;
}

/** A real length in metres as millimetres on the table, at the one scale. Example: `tableMm(4.8)` → `38`. */
export function tableMm(metres: number, r: Rules = RULES): number {
  return Math.round(metres * r.scala.mm_per_metro);
}

/** The prompts of a piece, ready to paste, with Meshy's settings and the pictures to attach. */
export interface Composed { gemini: string; meshy: string; impostazioni: Record<string, string | number>; allegati: string[] }

/**
 * The prompts of `piece` put together from the shared blocks (§20.3), or null for a piece with no
 * part of its own (one made before the specification: its prompts are in `usato`).
 * Gemini: style, camera, kind of piece, template (a piece with seats), its own part, paint (a painted
 * piece). A figure has its own view, so no camera. Meshy: its own part, then the tail. Camera, template
 * and tail are the ones of the kind of piece when it has its own (a gun is drawn from the side).
 */
export function compose(piece: Piece, r: Rules = RULES): Composed | null {
  if (!piece.specifico) return null;
  const b = r.blocchi;
  const settings = b.meshy.impostazioni[piece.tipo];
  return {
    gemini: [
      b.stile, piece.tipo === 'figura' ? '' : b.camera_per_tipo?.[piece.tipo] ?? b.camera, b.tipo[piece.tipo] ?? '', piece.posti ? b.dima_per_tipo?.[piece.tipo] ?? b.dima : '',
      piece.specifico.gemini, piece.tinto ? b.colore : '',
    ].filter(Boolean).join('\n'),
    meshy: `${piece.specifico.meshy} ${b.meshy.coda_per_tipo?.[piece.tipo] ?? b.meshy.coda}`,
    impostazioni: { ...(typeof settings === 'object' ? settings : {}), ...(piece.triangoli ? { triangoli: piece.triangoli } : {}) },
    allegati: piece.allegati ?? [],
  };
}

/**
 * What is wrong with `sheet` against the rules, in words; empty when it is in order. `has(path)` says
 * whether a file of the repository exists (the tests pass the real answer, §18: "the check is also a test").
 */
export function problems(sheet: Sheet, r: Rules = RULES, has: (path: string) => boolean = () => true): string[] {
  const out: string[] = [];
  const cls = classes(r)[sheet.classe];
  if (!cls) out.push(`classe sconosciuta: ${sheet.classe}`);
  if (!(sheet.regime in r.regimi)) out.push(`regime sconosciuto: ${sheet.regime}`);
  if (!(sheet.stato.esito in r.esiti)) out.push(`esito sconosciuto: ${sheet.stato.esito}`);
  if (!r.passi.some(p => p.n === sheet.stato.passo)) out.push(`passo sconosciuto: ${sheet.stato.passo}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sheet.stato.dal)) out.push(`data non valida: ${sheet.stato.dal}`);
  if (!sheet.pezzi.length) out.push('nessun pezzo');
  if (new Set(sheet.pezzi.map(p => p.id)).size !== sheet.pezzi.length) out.push('due pezzi con lo stesso id');
  for (const p of sheet.pezzi) {
    if (!(p.tipo in r.tipi)) out.push(`${p.id}: tipo sconosciuto: ${p.tipo}`);
    if (p.file && !has(p.file)) out.push(`${p.id}: manca il file ${p.file}`);
    if (sheet.regime === 'specifica') {
      if (!p.specifico) out.push(`${p.id}: manca la parte specifica dei prompt`);
      else if (!(p.tipo in r.blocchi.tipo)) out.push(`${p.id}: nessun blocco dei prompt per il tipo ${p.tipo}`);
      if (!p.triangoli) out.push(`${p.id}: mancano i triangoli da chiedere a Meshy`);
    }
    for (const t of p.tentativi) if (!(t.esito in r.esiti)) out.push(`${p.id}: esito sconosciuto in un tentativo: ${t.esito}`);
  }
  if (sheet.stato.esito === 'in_gioco' && !sheet.pezzi.some(p => p.file)) out.push('è nel gioco ma nessun pezzo ha il suo file');
  // No vehicle is longer than a road space (§16.2); the margin at its ends is checked on its template (§17).
  if (cls?.lunghezza && tableMm(cls.lunghezza, r) > r.scala.casella_mm) out.push(`la classe ${sheet.classe} è più lunga della casella`);
  for (const s of sheet.posti ?? []) if (!(s.posa in r.posti.nomi)) out.push(`${s.id}: posa sconosciuta: ${s.posa}`);
  return out;
}
