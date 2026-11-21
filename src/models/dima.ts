// The template of a vehicle (design/art/modelli-strutturati.md §17) and the check of its seats (§18,
// points 2-4): the standard figure (§15) is put in every seat, its hands on the grips and its feet on
// the rests, in the neutral position and at every extreme (steering wheel or handlebars fully turned,
// the gun at the ends of its elevation), and its reach, its joints and what it runs into are measured.
// Pure, in metres, in the vehicle's frame: +x ahead, +y up, +z its right, the ground at y = 0, the
// origin under the middle of its length. Unit-tested in tests/unit/models/dima.test.ts.

import { twoBoneIK, type P3 } from '../app/motion/rider';
import type { Rules } from '../admin/produzione';

/** A point or a size: x, y, z. */
export type V3 = [number, number, number];
/** A box of the template, between two opposite corners. */
export interface Volume {
  id: string;
  da: V3;
  a: V3;
  /** `sedile`, `comando` (steering wheel, handlebars, grips) and `vetro` may touch the figure; `pieno` (the default) may not. */
  uso?: 'pieno' | 'sedile' | 'comando' | 'vetro';
  /** The piece to generate it belongs to, when not the body: `arma`, `arma_base`, `avantreno`. */
  pezzo?: string;
}
/** An axle's wheels, one each side at `z` and `-z`. */
export interface DimaWheel { x: number; z: number; r: number; w: number; sterza?: boolean }
/** A way the grips move: turned about the axis through `centro` along `asse`, to each of `gradi`. */
export interface Move { nome: string; centro: V3; asse: V3; gradi: number[] }
/** A seat: where the hips are, what the hands hold and where the feet rest. */
export interface DimaSeat {
  id: string;
  posa: 'sit' | 'ride' | 'stand';
  ruolo: string;
  /** The hips. */
  anche: V3;
  /** 180 for a seat that faces backward (the Big Rig's rear gunner): its left hand is then at +z. */
  guarda?: 0 | 180;
  /** The backrest's lean backward, degrees (`sit`). */
  schienale?: number;
  prese: { L: V3; R: V3 };
  /** Where the soles rest. */
  piedi: { L: V3; R: V3 };
  mosse?: Move[];
}
/** The template of a vehicle. */
export interface Dima { volumi: Volume[]; ruote: DimaWheel[]; posti: DimaSeat[] }

const p3 = (v: V3): P3 => ({ x: v[0], y: v[1], z: v[2] });
const add = (a: P3, b: P3): P3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a: P3, k: number): P3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: P3, b: P3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: P3, b: P3): P3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a: P3): number => Math.hypot(a.x, a.y, a.z);
const unit = (a: P3): P3 => mul(a, 1 / (len(a) || 1e-9));
const dist = (a: P3, b: P3): number => len(sub(a, b));
const deg = (r: number): number => r * 180 / Math.PI;
const rad = (d: number): number => d * Math.PI / 180;
const U: P3 = { x: 0, y: 1, z: 0 }, RIGHT: P3 = { x: 0, y: 0, z: 1 };

/** `p` turned by `degrees` about the axis through `centre` along `axis`. */
export function turn(p: V3, centre: V3, axis: V3, degrees: number): V3 {
  const k = unit(p3(axis)), v = sub(p3(p), p3(centre)), c = Math.cos(rad(degrees)), s = Math.sin(rad(degrees));
  const r = add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
  return [r.x + centre[0], r.y + centre[1], r.z + centre[2]];
}

/** The positions a seat is checked in: the neutral one, then every extreme of its moves. */
export function positions(seat: DimaSeat): { nome: string; prese: { L: V3; R: V3 } }[] {
  const out = [{ nome: 'neutra', prese: seat.prese }];
  for (const m of seat.mosse ?? []) {
    for (const g of m.gradi) out.push({ nome: `${m.nome} ${g > 0 ? '+' : ''}${g}°`, prese: { L: turn(seat.prese.L, m.centro, m.asse, g), R: turn(seat.prese.R, m.centro, m.asse, g) } });
  }
  return out;
}

/** The joints of the standard figure in a seat. */
export interface Figure {
  /** The trunk's lean forward from upright, degrees. */
  lean: number;
  hips: P3; chest: P3; head: P3; top: P3;
  shoulderL: P3; shoulderR: P3; elbowL: P3; elbowR: P3; handL: P3; handR: P3;
  hipL: P3; hipR: P3; kneeL: P3; kneeR: P3; ankleL: P3; ankleR: P3;
}

/**
 * The standard figure in `seat`, its trunk leaning `lean` degrees forward, its hands toward `grips`
 * and its ankles over the foot rests: arms and legs by the two-bone reach, elbows down and out,
 * knees up, ahead and a little out (§15.3). A hand or a foot out of reach stops on the line to it.
 */
export function seatFigure(seat: DimaSeat, grips: { L: V3; R: V3 }, lean: number, r: Rules): Figure {
  if (seat.guarda === 180) {
    // Facing backward: the same figure, worked out turned half a turn about the upright and turned back.
    const back = (p: V3): V3 => [-p[0], p[1], -p[2]];
    const f = seatFigure({ ...seat, guarda: 0, anche: back(seat.anche), piedi: { L: back(seat.piedi.L), R: back(seat.piedi.R) } }, { L: back(grips.L), R: back(grips.R) }, lean, r);
    const out = { lean } as Figure;
    for (const [k, p] of Object.entries(f)) if (typeof p === 'object') (out as unknown as Record<string, P3>)[k] = { x: -p.x, y: p.y, z: -p.z };
    return out;
  }
  const m = r.figura.misure, c = Math.cos(rad(lean)), s = Math.sin(rad(lean));
  const t: P3 = { x: s, y: c, z: 0 };
  const hips = p3(seat.anche), chest = add(hips, mul(t, m.busto));
  const side = (k: number, half: number, at: P3): P3 => add(at, mul(RIGHT, k * half));
  const arm = (k: number, grip: V3): { mid: P3; end: P3 } =>
    twoBoneIK(side(k, m.spalle / 2, chest), p3(grip), m.braccio, m.avambraccio + m.mano, { x: -0.2, y: -1, z: 0.6 * k });
  const leg = (k: number, foot: V3): { mid: P3; end: P3 } =>
    twoBoneIK(side(k, m.anche / 2, hips), add(p3(foot), mul(U, m.caviglia)), m.coscia, m.stinco, { x: 0.6, y: 1, z: 0.25 * k });
  const aL = arm(-1, grips.L), aR = arm(1, grips.R), lL = leg(-1, seat.piedi.L), lR = leg(1, seat.piedi.R);
  return {
    lean, hips, chest, head: add(chest, mul(t, m.collo_testa - r.figura.capsule.testa)), top: add(chest, mul(t, m.collo_testa)),
    shoulderL: side(-1, m.spalle / 2, chest), shoulderR: side(1, m.spalle / 2, chest), elbowL: aL.mid, elbowR: aR.mid, handL: aL.end, handR: aR.end,
    hipL: side(-1, m.anche / 2, hips), hipR: side(1, m.anche / 2, hips), kneeL: lL.mid, kneeR: lR.mid, ankleL: lL.end, ankleR: lR.end,
  };
}

/** How upright the hips are in a pose, for a trunk leaning `lean`: the rest of the lean is the spine's. */
const pelvis = (seat: DimaSeat, lean: number): number => seat.posa === 'sit' ? -(seat.schienale ?? 15) : seat.posa === 'ride' ? lean / 2 : 0;
/** The lean a pose starts from, and how far it may go: the spine's limits about the hips. */
function leanRange(seat: DimaSeat, r: Rules): { want: number; lo: number; hi: number } {
  const [, , lo, hi] = r.figura.limiti_gradi.find(l => l[0] === 'Schiena' && l[1].startsWith('in avanti'))!;
  if (seat.posa === 'sit') { const back = -(seat.schienale ?? 15); return { want: back, lo: back + lo, hi: back + hi }; }
  return seat.posa === 'ride' ? { want: 20, lo: 2 * lo, hi: 2 * hi } : { want: 5, lo, hi };
}

/** The share of an arm's reach used by each hand, for a figure toward `grips`. */
function armShares(fig: Figure, grips: { L: V3; R: V3 }, r: Rules): [number, number] {
  const m = r.figura.misure, full = m.braccio + m.avambraccio + m.mano;
  return [dist(fig.shoulderL, p3(grips.L)) / full, dist(fig.shoulderR, p3(grips.R)) / full];
}

/**
 * The figure in `seat` with its hands toward `grips`: the trunk leans as little away from the pose's
 * own lean as it takes for both hands to hold with a share of reach inside the rules' limits (§19.2:
 * the trunk moves toward a grip as far as its limits allow, the grip is never chased beyond).
 */
export function poseFigure(seat: DimaSeat, grips: { L: V3; R: V3 }, r: Rules): Figure {
  const { want, lo, hi } = leanRange(seat, r), { min, max } = r.figura.portata;
  let best: Figure | null = null, bestOff = Infinity;
  const leans = Array.from({ length: Math.floor(hi - lo) + 1 }, (_, i) => lo + i).sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
  for (const lean of leans) {
    const fig = seatFigure(seat, grips, lean, r);
    const off = armShares(fig, grips, r).reduce((s, x) => s + Math.max(0, x - max, min - x), 0);
    if (off === 0) return fig;
    if (off < bestOff) { best = fig; bestOff = off; }
  }
  return best!;
}

/** One line of a check's report. */
export interface Row {
  posto: string;
  posizione: string;
  voce: string;
  valore: string;
  limite: string;
  /** `fuori`: the seat is wrong. `avviso`: outside a starting value of the rules, to look at. */
  esito: 'ok' | 'avviso' | 'fuori';
}

const fmt = (n: number, digits = 0): string => n.toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits });
/** The angle at `b` between the bones to `a` and to `c`, as a bend from straight (0: straight). */
const bend = (a: P3, b: P3, c: P3): number => 180 - deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(a, b)), unit(sub(c, b)))))));

/** The signed distance from `p` to the surface of box `v`: negative inside. */
function boxDistance(p: P3, v: Volume): number {
  const q = [p.x, p.y, p.z], d = [0, 1, 2].map(i => Math.max(Math.min(v.da[i], v.a[i]) - q[i], q[i] - Math.max(v.da[i], v.a[i])));
  const out = Math.hypot(Math.max(d[0], 0), Math.max(d[1], 0), Math.max(d[2], 0));
  return out > 0 ? out : Math.max(d[0], d[1], d[2]);
}

/** How far the figure's capsules sink into the solid boxes of the template: the worst, with where (metres; 0: nowhere). */
export function penetration(fig: Figure, dima: Dima, r: Rules): { depth: number; part: string; volume: string } {
  const c = r.figura.capsule;
  const bones: [string, P3, P3, number][] = [
    ['busto', fig.hips, fig.chest, c.busto], ['testa', fig.head, fig.head, c.testa],
    ['braccio sinistro', fig.shoulderL, fig.elbowL, c.braccio], ['braccio destro', fig.shoulderR, fig.elbowR, c.braccio],
    ['avambraccio sinistro', fig.elbowL, fig.handL, c.braccio], ['avambraccio destro', fig.elbowR, fig.handR, c.braccio],
    ['coscia sinistra', fig.hipL, fig.kneeL, c.coscia], ['coscia destra', fig.hipR, fig.kneeR, c.coscia],
    ['stinco sinistro', fig.kneeL, fig.ankleL, c.stinco], ['stinco destro', fig.kneeR, fig.ankleR, c.stinco],
  ];
  let worst = { depth: 0, part: '', volume: '' };
  for (const v of dima.volumi) {
    if (v.uso && v.uso !== 'pieno') continue;
    for (const [part, a, b, radius] of bones) {
      // Hands and feet touch what they hold: the last stretch of a forearm or a shin is left out.
      const end = part.startsWith('avambraccio') || part.startsWith('stinco') ? 0.75 : 1;
      for (let i = 0; i <= 8; i++) {
        const depth = radius - boxDistance(add(a, mul(sub(b, a), i / 8 * end)), v);
        if (depth > worst.depth) worst = { depth, part, volume: v.id };
      }
    }
  }
  return worst;
}

/**
 * The check of one seat of `dima` (§18, points 2-4): for the neutral position and every extreme, the
 * share of reach of each arm and leg, the joints against their limits, and what the figure runs into.
 * Then the seat's measures against the rules' starting values (§16.1), as notes to look at.
 */
export function checkSeat(seat: DimaSeat, dima: Dima, r: Rules): Row[] {
  const rows: Row[] = [], m = r.figura.misure, { min, max } = r.figura.portata;
  const limit = (joint: string, move: string): [number, number] => { const l = r.figura.limiti_gradi.find(x => x[0] === joint && x[1].startsWith(move))!; return [l[2], l[3]]; };
  const push = (posizione: string, voce: string, value: number, lo: number, hi: number, unitOf: string, digits = 0, soft = false): void => {
    const ok = value >= lo - 1e-9 && value <= hi + 1e-9;
    rows.push({ posto: seat.id, posizione, voce, valore: `${fmt(value, digits)}${unitOf}`, limite: `${fmt(lo, digits)} – ${fmt(hi, digits)}${unitOf}`, esito: ok ? 'ok' : soft ? 'avviso' : 'fuori' });
  };
  for (const pos of positions(seat)) {
    const fig = poseFigure(seat, pos.prese, r), [aL, aR] = armShares(fig, pos.prese, r);
    const way = seat.guarda === 180 ? -1 : 1; // which way along x the seat looks
    const legFull = m.coscia + m.stinco, t: P3 = { x: way * Math.sin(rad(fig.lean)), y: Math.cos(rad(fig.lean)), z: 0 }, ahead: P3 = { x: way * t.y, y: -way * t.x, z: 0 };
    const spine = fig.lean - pelvis(seat, fig.lean);
    push(pos.nome, 'Schiena: in avanti', spine, ...limit('Schiena', 'in avanti'), '°');
    push(pos.nome, 'Collo: su e giù', -fig.lean, ...limit('Collo e testa', 'su'), '°');
    for (const [name, k, share, shoulder, elbow, hand, hip, knee, ankle, foot] of [
      ['sinistro', -1, aL, fig.shoulderL, fig.elbowL, fig.handL, fig.hipL, fig.kneeL, fig.ankleL, seat.piedi.L],
      ['destro', 1, aR, fig.shoulderR, fig.elbowR, fig.handR, fig.hipR, fig.kneeR, fig.ankleR, seat.piedi.R]] as const) {
      const upper = unit(sub(elbow, shoulder)), thigh = unit(sub(knee, hip));
      push(pos.nome, `Braccio ${name}: portata`, share * 100, min * 100, max * 100, '%');
      push(pos.nome, `Gomito ${name}`, bend(shoulder, elbow, hand), ...limit('Gomito', 'flessione'), '°');
      push(pos.nome, `Spalla ${name}: in avanti`, deg(Math.atan2(dot(upper, ahead), -dot(upper, t))), ...limit('Spalla', 'in avanti'), '°');
      push(pos.nome, `Spalla ${name}: di lato`, deg(Math.asin(Math.max(-1, Math.min(1, upper.z * k * way)))), ...limit('Spalla', 'apertura'), '°');
      if (pos.nome !== 'neutra') continue; // the legs do not move with the grips
      push(pos.nome, `Gamba ${name === 'sinistro' ? 'sinistra' : 'destra'}: portata`, dist(hip, add(p3(foot), mul(U, m.caviglia))) / legFull * 100, min * 100, max * 100, '%');
      push(pos.nome, `Ginocchio ${name}`, bend(hip, knee, ankle), ...limit('Ginocchio', 'flessione'), '°');
      push(pos.nome, `Anca ${name === 'sinistro' ? 'sinistra' : 'destra'}: flessione`, deg(Math.atan2(dot(thigh, ahead), -dot(thigh, t))), ...limit('Anca', 'flessione'), '°');
      push(pos.nome, `Anca ${name === 'sinistro' ? 'sinistra' : 'destra'}: di lato`, deg(Math.asin(Math.max(-1, Math.min(1, thigh.z * k * way)))), ...limit('Anca', 'apertura'), '°');
    }
    const hit = penetration(fig, dima, r);
    rows.push({
      posto: seat.id, posizione: pos.nome, voce: 'Compenetrazione', valore: hit.depth > 0 ? `${fmt(hit.depth * 100, 1)} cm (${hit.part} in ${hit.volume})` : 'nessuna',
      limite: `al massimo ${fmt(Number(r.collaudo.compenetrazione_m) * 100)} cm`, esito: hit.depth <= Number(r.collaudo.compenetrazione_m) ? 'ok' : 'fuori',
    });
  }
  // The seat's own measures against the starting values of the rules: notes, since the rule that always holds is the one above.
  const col = { sit: 1, ride: 2, stand: 3 }[seat.posa], h = seat.anche, g = seat.prese, f = seat.piedi, look = seat.guarda === 180 ? -1 : 1;
  const measures: Record<string, number> = {
    'Prese delle mani: avanti': look * ((g.L[0] + g.R[0]) / 2 - h[0]), 'Prese delle mani: in alto': (g.L[1] + g.R[1]) / 2 - h[1], 'Prese delle mani: distanza tra loro': dist(p3(g.L), p3(g.R)),
    'Appoggi dei piedi: avanti': look * ((f.L[0] + f.R[0]) / 2 - h[0]), 'Appoggi dei piedi: in basso': h[1] - (f.L[1] + f.R[1]) / 2, 'Appoggi dei piedi: distanza tra loro': Math.abs(f.R[2] - f.L[2]),
    'Altezza della sella da terra': h[1],
  };
  for (const line of r.posti.misure) {
    const range = line[col] as [number | null, number | null] | null, value = measures[line[0]];
    if (range && value !== undefined) push('misure del posto', line[0], value, range[0] ?? -Infinity, range[1] ?? Infinity, ' m', 2, true);
  }
  return rows;
}

/** The size of the template: its length, height and width, and the middle of its length. */
export function dimaSize(dima: Dima, pieces: (v: Volume) => boolean = () => true): { length: number; height: number; width: number; middle: number } {
  const xs: number[] = [], ys: number[] = [], zs: number[] = [];
  for (const v of dima.volumi.filter(pieces)) { xs.push(v.da[0], v.a[0]); ys.push(v.da[1], v.a[1]); zs.push(v.da[2], v.a[2]); }
  for (const w of dima.ruote) { xs.push(w.x - w.r, w.x + w.r); ys.push(0, 2 * w.r); zs.push(-w.z - w.w / 2, w.z + w.w / 2); }
  return { length: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys), width: Math.max(...zs) - Math.min(...zs), middle: (Math.max(...xs) + Math.min(...xs)) / 2 };
}

/**
 * The check of a whole template against its class of vehicle (§16.3): its size without weapons within
 * the rules' tolerance, its wheels of the class's radius, its length inside a road space with the
 * margin at both ends, then every seat (see checkSeat).
 */
export function checkDima(dima: Dima, cls: { lunghezza: number | null; altezza: number | null; larghezza: number | null; ruota: number | null; gancio_a_gancio?: boolean }, r: Rules): Row[] {
  const rows: Row[] = [], size = dimaSize(dima, v => !v.pezzo?.startsWith('arma')), tol = Number(r.collaudo.proporzioni);
  const push = (voce: string, value: number, want: number | null): void => {
    if (want === null) return;
    rows.push({ posto: 'veicolo', posizione: 'ingombro', voce, valore: `${fmt(value, 2)} m`, limite: `${fmt(want, 2)} m ± ${fmt(tol * 100)}%`, esito: Math.abs(value - want) <= want * tol ? 'ok' : 'fuori' });
  };
  push('Lunghezza', size.length, cls.lunghezza);
  push('Altezza senza arma', size.height, cls.altezza);
  push('Larghezza', size.width, cls.larghezza);
  for (const w of dima.ruote) push(`Raggio della ruota a x = ${fmt(w.x, 2)}`, w.r, cls.ruota);
  // A section of the Big Rig is one road space long from hitch to hitch: no margin at its ends.
  const mm = size.length * r.scala.mm_per_metro, room = r.scala.casella_mm - (cls.gancio_a_gancio ? 0 : 2 * r.scala.margine_mm);
  rows.push({ posto: 'veicolo', posizione: 'sul tavolo', voce: 'Lunghezza nella casella', valore: `${fmt(mm, 1)} mm`, limite: `al massimo ${fmt(room)} mm`, esito: mm <= room + 1e-9 ? 'ok' : 'fuori' });
  rows.push({ posto: 'veicolo', posizione: 'ingombro', voce: 'Origine a metà lunghezza', valore: `${fmt(size.middle, 2)} m`, limite: '0,00 m ± 0,05', esito: Math.abs(size.middle) <= 0.05 ? 'ok' : 'fuori' });
  for (const s of dima.posti) rows.push(...checkSeat(s, dima, r));
  return rows;
}
