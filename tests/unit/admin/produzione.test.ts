// The production of the 3D models (src/admin/produzione.ts): the prompts put together from the shared
// blocks, the check of a sheet against the rules, and the rules and sheets the repository has
// (data/trv/modelli/), against the files they name and the specification they come from.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classes, compose, problems, RULES, SHEETS, tableMm, type Piece, type Sheet } from '../../../src/admin/produzione';

const B = RULES.blocchi;
const piece = (more: Partial<Piece>): Piece => ({ id: 'p', nome: 'Pezzo', tipo: 'carrozzeria', file: null, tentativi: [], ...more });
const OWN = { gemini: 'The model: a test car.', meshy: 'Low poly test car.' };
const sheet = (more: Partial<Sheet>): Sheet => ({
  schema: 1, id: 's', nome: 'Scheda', gioco: 'base', classe: 'car_m', scopo: '', regime: 'precedenti',
  stato: { passo: 9, esito: 'in_gioco', dal: '2026-11-20', nota: '' }, pezzi: [piece({ file: 'a.glb' })], collaudi: [], decisioni: [],
  provenienza: { origine: 'ai', strumento: '', fonte: '', data: null }, ...more,
});

describe('compose', () => {
  it('asks every piece of every sheet for a closed model, in Gemini and in Meshy', () => {
    for (const s of SHEETS) for (const p of s.pezzi) {
      const c = compose(p);
      if (!c) continue;
      expect(c.gemini, p.id).toContain(B.chiuso);
      expect(c.meshy, p.id).toContain('Watertight manifold mesh');
    }
  });

  it('puts a painted piece with seats together in order: style, camera, kind, template, its own part, paint', () => {
    // Arrange / Act
    const c = compose(piece({ specifico: OWN, tinto: true, posti: true }))!;
    // Assert
    expect(c.gemini).toBe([B.stile, B.camera, B.tipo.carrozzeria, B.dima, OWN.gemini, B.colore, B.chiuso].join('\n'));
  });

  it('leaves out the template and the paint for a piece with no seats that is not painted', () => {
    const c = compose(piece({ tipo: 'accessorio', specifico: OWN }))!;
    expect(c.gemini).toBe([B.stile, B.camera, B.tipo.accessorio, OWN.gemini, B.chiuso].join('\n'));
  });

  it('gives a gun its own camera and its own template text, not the ones of a body', () => {
    const c = compose(piece({ tipo: 'arma', specifico: OWN, posti: true }))!;
    expect(c.gemini).toBe([B.stile, B.camera_per_tipo!.arma, B.tipo.arma, B.dima_per_tipo!.arma, OWN.gemini, B.chiuso].join('\n'));
    expect(c.gemini).not.toContain('steering wheel');
  });

  it('ends the Meshy text of a wheel with the tail of wheels', () => {
    const c = compose(piece({ tipo: 'ruota', specifico: OWN }))!;
    expect(c.meshy).toBe(`${OWN.meshy} ${B.meshy.coda_per_tipo!.ruota} ${B.meshy.chiuso}`);
    expect(c.meshy).not.toContain('rivets');
  });

  it('gives a figure no camera: its kind of piece has its own view', () => {
    const c = compose(piece({ tipo: 'figura', specifico: OWN }))!;
    expect(c.gemini).not.toContain(B.camera);
    expect(c.gemini).toContain(B.tipo.figura);
  });

  it('ends the Meshy text with the shared tail and adds the triangles to the settings of its kind', () => {
    const c = compose(piece({ specifico: OWN, triangoli: 5000 }))!;
    expect(c.meshy).toBe(`${OWN.meshy} ${B.meshy.coda} ${B.meshy.chiuso}`);
    expect(c.impostazioni).toEqual({ ...(B.meshy.impostazioni.carrozzeria as object), triangoli: 5000 });
  });

  it('is null for a piece made before the specification', () => {
    expect(compose(piece({}))).toBeNull();
  });
});

describe('tableMm', () => {
  it('turns metres into millimetres on the table at the one scale', () => {
    expect(tableMm(4.8)).toBe(38);
    expect(tableMm(RULES.figura.misure.altezza)).toBe(14);
  });
});

describe('problems', () => {
  it('finds nothing wrong with a sheet in order', () => {
    expect(problems(sheet({}))).toEqual([]);
  });

  it('names an unknown class, outcome and kind of piece', () => {
    const bad = problems(sheet({ classe: 'tank', stato: { passo: 9, esito: 'boh', dal: '2026-11-20', nota: '' }, pezzi: [piece({ tipo: 'ala', file: 'a.glb' })] }));
    expect(bad).toEqual(expect.arrayContaining(['classe sconosciuta: tank', 'esito sconosciuto: boh', 'p: tipo sconosciuto: ala']));
  });

  it('names the file of a piece that is not in the repository', () => {
    expect(problems(sheet({}), RULES, () => false)).toContain('p: manca il file a.glb');
  });

  it('asks a sheet that follows the specification for the own part and the triangles of every piece', () => {
    const bad = problems(sheet({ regime: 'specifica', stato: { passo: 1, esito: 'bozza', dal: '2026-11-21', nota: '' }, pezzi: [piece({})] }));
    expect(bad).toEqual(expect.arrayContaining(['p: manca la parte specifica dei prompt', 'p: mancano i triangoli da chiedere a Meshy']));
  });

  it('refuses a model said to be in the game with no file at all', () => {
    expect(problems(sheet({ pezzi: [piece({})] }))).toContain('è nel gioco ma nessun pezzo ha il suo file');
  });
});

describe('the rules and sheets of the repository', () => {
  it('have no sheet with a problem, every file a piece names being there', () => {
    for (const s of SHEETS) expect(problems(s, RULES, existsSync), s.id).toEqual([]);
  });

  it('have one sheet for every model the game ships', () => {
    const files = new Set(SHEETS.flatMap(s => [...s.pezzi.map(p => p.file), ...(s.precedente ?? [])]));
    for (const f of ['Chopper', 'wreck_1', 'wreck_5', 'car_m_body', 'car_s_wheel']) {
      expect(files, f).toContain(`assets/base/modelli/${f}.glb`);
    }
    for (const f of ['big_rig_front_body', 'big_rig_launcher', 'motorcycle']) expect(files, f).toContain(`assets/big_rig/modelli/${f}.glb`);
    // The one-piece models the game no longer loads are kept in the archive, and their sheets say where.
    for (const f of ['Car_Small', 'Car_Medium', 'Car_Large']) expect(files, f).toContain(`assets/archivio/base/modelli/${f}.glb`);
    expect(files).toContain('assets/archivio/big_rig/modelli/big_rig.glb');
    for (const f of ['Ramp', 'sand_worm']) expect(files, f).toContain(`assets/carnage/modelli/${f}.glb`);
  });

  it('keep the prompts of the old files word for word', () => {
    const rig = SHEETS.find(s => s.id === 'big_rig')!;
    const front = rig.pezzi.find(p => p.id === 'big_rig_front_body')!.usato!;
    expect(front.gemini[0].testo.startsWith('Edit the road train image you made. Do not redesign anything:')).toBe(true);
    expect(front.meshy[0].testo.startsWith('Low poly game-ready body of an armoured post-apocalyptic truck tractor')).toBe(true);
    expect(SHEETS.find(s => s.id === 'ramp')!.pezzi[0].usato!.gemini[0].testo).toContain('a makeshift launch ramp');
  });

  it('put together the prompts of every piece of a sheet that follows the specification', () => {
    const next = SHEETS.filter(s => s.regime === 'specifica');
    expect(next.length).toBeGreaterThan(0);
    for (const s of next) for (const p of s.pezzi) expect(compose(p)?.gemini.startsWith(B.stile), p.id).toBe(true);
  });

  it('agree with the specification on the scale and on the length of every vehicle', () => {
    const doc = readFileSync(RULES.documento, 'utf-8');
    const it1 = (n: number): string => n.toLocaleString('it-IT', { minimumFractionDigits: 1 });
    expect(doc).toContain(`1 : ${RULES.scala.rapporto}`);
    for (const [id, c] of Object.entries(classes())) {
      if (!c.lunghezza) continue;
      expect(doc, id).toMatch(new RegExp(`\\| ${it1(c.lunghezza)} m \\| ${tableMm(c.lunghezza)} mm`));
      expect(tableMm(c.lunghezza), id).toBeLessThanOrEqual(RULES.scala.casella_mm);
    }
  });

  it('agree with the specification on the measures of the standard figure', () => {
    const doc = readFileSync(RULES.documento, 'utf-8');
    const m = RULES.figura.misure;
    const it2 = (n: number): string => n.toLocaleString('it-IT', { minimumFractionDigits: 2 });
    for (const [label, key] of [['Altezza', 'altezza'], ['Braccio (spalla-gomito)', 'braccio'], ['Avambraccio (gomito-polso)', 'avambraccio'],
      ['Coscia (anca-ginocchio)', 'coscia'], ['Stinco (ginocchio-caviglia)', 'stinco']] as const) {
      expect(doc, key).toContain(`| ${label} | ${it2(m[key])} |`);
    }
  });
});
