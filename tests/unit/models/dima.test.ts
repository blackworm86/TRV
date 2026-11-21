// The template of a vehicle and the check of its seats (src/models/dima.ts): the standard figure put
// in a seat, its reach, its joints and what it runs into, on small seats made here and on the
// templates the repository has (data/trv/modelli/, design/art/modelli-strutturati.md §17, §18).
import { describe, expect, it } from 'vitest';
import { classes, RULES, SHEETS } from '../../../src/admin/produzione';
import { checkDima, checkSeat, dimaSize, penetration, poseFigure, positions, seatFigure, turn, type Dima, type DimaSeat, type Row } from '../../../src/models/dima';

const M = RULES.figura.misure;
/** A car seat in the open: hips 0.4 m up, a wheel 0.4 m ahead and 0.3 m up, pedals 0.65 m ahead and 0.27 m down. */
const seat = (more: Partial<DimaSeat> = {}): DimaSeat => ({
  id: 'seat_driver', posa: 'sit', ruolo: 'pilota', anche: [0, 0.4, 0], schienale: 15,
  prese: { L: [0.4, 0.7, -0.17], R: [0.4, 0.7, 0.17] }, piedi: { L: [0.65, 0.13, -0.12], R: [0.65, 0.13, 0.12] }, ...more,
});
const open: Dima = { volumi: [], ruote: [], posti: [] };
const bad = (rows: Row[]): string[] => rows.filter(r => r.esito === 'fuori').map(r => `${r.posto} · ${r.posizione} · ${r.voce}: ${r.valore} (${r.limite})`);
const at = (p: { x: number; y: number; z: number }): number[] => [p.x, p.y, p.z];

describe('turn', () => {
  it('turns a point about an axis through a centre', () => {
    const [x, y, z] = turn([1, 0, 0], [0, 0, 0], [0, 1, 0], 90);
    expect([x, y, z].map(n => Math.round(n * 1000) / 1000 + 0)).toEqual([0, 0, -1]);
  });
});

describe('positions', () => {
  it('are the neutral one and every extreme of every move', () => {
    const s = seat({ mosse: [{ nome: 'volante', centro: [0.4, 0.7, 0], asse: [-1, 0, 0], gradi: [-90, 90] }] });
    expect(positions(s).map(p => p.nome)).toEqual(['neutra', 'volante -90°', 'volante +90°']);
    // A quarter turn of the wheel brings a hand from the side of the rim to its top or its bottom.
    expect(Math.abs(positions(s)[1].prese.L[1] - 0.7)).toBeCloseTo(0.17, 5);
  });
});

describe('seatFigure', () => {
  it('builds the trunk with the standard measures, leaning as asked', () => {
    const upright = seatFigure(seat(), seat().prese, 0, RULES);
    expect(at(upright.chest)).toEqual([0, 0.4 + M.busto, 0]);
    expect(upright.top.y).toBeCloseTo(0.4 + M.busto + M.collo_testa, 6);
    expect(upright.shoulderR.z - upright.shoulderL.z).toBeCloseTo(M.spalle, 6);
    expect(seatFigure(seat(), seat().prese, -15, RULES).chest.x).toBeLessThan(0);
  });

  it('puts the hands on the grips and the ankles over the foot rests when they are in reach', () => {
    const s = seat(), f = seatFigure(s, s.prese, -15, RULES);
    expect(at(f.handL)).toEqual(s.prese.L.map(n => expect.closeTo(n, 5)));
    expect(f.ankleR.y).toBeCloseTo(s.piedi.R[1] + M.caviglia, 5);
  });

  it('bends the elbows down and out and the knees up', () => {
    const s = seat(), f = seatFigure(s, s.prese, -15, RULES);
    expect(f.elbowL.y).toBeLessThan((f.shoulderL.y + f.handL.y) / 2);
    expect(f.elbowL.z).toBeLessThan(f.shoulderL.z);
    expect(f.kneeL.y).toBeGreaterThan((f.hipL.y + f.ankleL.y) / 2);
  });

  it('stops a hand on the line to a grip out of reach', () => {
    const far = { L: [2, 0.7, -0.17] as [number, number, number], R: [2, 0.7, 0.17] as [number, number, number] };
    const f = seatFigure(seat(), far, 0, RULES);
    expect(f.handL.x).toBeLessThan(1);
  });
});

describe('poseFigure', () => {
  it('keeps the lean of the backrest when the grips are in reach from there', () => {
    expect(poseFigure(seat(), seat().prese, RULES).lean).toBe(-15);
  });

  it('leans the trunk forward toward grips too far for the backrest lean', () => {
    const s = seat({ prese: { L: [0.72, 0.7, -0.17], R: [0.72, 0.7, 0.17] } });
    expect(poseFigure(s, s.prese, RULES).lean).toBeGreaterThan(-15);
  });
});

describe('checkSeat', () => {
  it('passes a seat with everything in reach', () => {
    expect(bad(checkSeat(seat(), open, RULES))).toEqual([]);
  });

  it('says which arm cannot reach a grip set too far', () => {
    const rows = bad(checkSeat(seat({ prese: { L: [1.3, 0.7, -0.17], R: [1.3, 0.7, 0.17] } }), open, RULES));
    expect(rows.some(r => r.includes('Braccio sinistro: portata'))).toBe(true);
  });

  it('says a knee is bent too far when the foot rest is right under the seat', () => {
    const rows = bad(checkSeat(seat({ piedi: { L: [0.05, 0.25, -0.12], R: [0.05, 0.25, 0.12] } }), open, RULES));
    expect(rows.some(r => r.includes('Gamba') || r.includes('Ginocchio'))).toBe(true);
  });

  it('checks every extreme of a move, not only the neutral position', () => {
    const s = seat({ mosse: [{ nome: 'volante', centro: [0.4, 0.7, 0], asse: [-1, 0, 0], gradi: [-90, 90] }] });
    expect(new Set(checkSeat(s, open, RULES).map(r => r.posizione))).toEqual(new Set(['neutra', 'volante -90°', 'volante +90°', 'misure del posto']));
  });

  it('notes a measure outside the starting values of the rules without refusing the seat', () => {
    const rows = checkSeat(seat({ prese: { L: [0.4, 0.7, -0.1], R: [0.4, 0.7, 0.1] } }), open, RULES);
    expect(rows.find(r => r.voce === 'Prese delle mani: distanza tra loro')!.esito).toBe('avviso');
  });
});

describe('penetration', () => {
  it('finds the trunk inside a solid box behind the seat, and nothing in a seat or a control', () => {
    const s = seat(), f = seatFigure(s, s.prese, -15, RULES);
    const wall = { id: 'paratia', da: [-0.3, 0.3, -0.5] as [number, number, number], a: [-0.1, 1.2, 0.5] as [number, number, number] };
    expect(penetration(f, { ...open, volumi: [wall] }, RULES)).toMatchObject({ volume: 'paratia' });
    expect(penetration(f, { ...open, volumi: [{ ...wall, uso: 'sedile' }] }, RULES).depth).toBe(0);
  });

  it('refuses a seat whose figure sinks into the body', () => {
    const dima: Dima = { ...open, volumi: [{ id: 'paratia', da: [-0.3, 0.3, -0.5], a: [-0.1, 1.2, 0.5] }] };
    expect(bad(checkSeat(seat(), dima, RULES)).some(r => r.includes('Compenetrazione'))).toBe(true);
  });
});

describe('dimaSize', () => {
  it('measures boxes and wheels together', () => {
    const dima: Dima = { volumi: [{ id: 'scocca', da: [-2, 0.2, -0.6], a: [2, 1, 0.6] }], ruote: [{ x: 1.5, z: 0.8, r: 0.36, w: 0.3 }], posti: [] };
    const size = dimaSize(dima);
    expect([size.length, size.height, size.middle]).toEqual([4, 1, 0]);
    expect(size.width).toBeCloseTo(1.9, 9);
  });
});

describe('the templates of the repository', () => {
  const withDima = SHEETS.filter(s => s.dima);

  it('are there for the sheets that follow the specification', () => {
    expect(withDima.map(s => s.id)).toEqual(expect.arrayContaining(['car_m_v2']));
  });

  it('pass the check of their class and of every seat', () => {
    for (const s of withDima) expect(bad(checkDima(s.dima!, classes()[s.classe], RULES)), s.id).toEqual([]);
  });

  it('name a template seat for every seat of the sheet', () => {
    for (const s of withDima) expect(s.dima!.posti.map(p => p.id).sort(), s.id).toEqual((s.posti ?? []).map(p => p.id).sort());
  });
});
