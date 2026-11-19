// The FX dice (road, stunt, slam, shooting, direction, fire) rolled on the table, and the
// round banner.

import { wormReady } from './worm';
import * as THREE from 'three';
import { COLS, ROWS, neighbor, onBoard, terrainAt, type Dir, type Frame, type Pos } from '../game/trv/engine';
import { GRID } from '../view/board3d';
import { avatarSvg } from '../view/vector/art';
import { makeDie } from '../view/dice3d';
import { planThrow, type Bumper } from '../view/dice-throw';
import type { ObstacleBlocker } from '../view/terrain/obstacles';
import { AWAY, DIE_W, FORWARD, FX_ORDER, FX_SCALE, TRAY_SCALE, TRAY_Z, TableDie, fxSupply } from './board';
import { g } from './game';
import { P } from './presentation';
import { dieHtml } from './hud';
import type { Round } from './spots';
import { BOARD_X0, KX, KZ, PITCH_W, TILE_H, TILE_W, camera, scene, tileSlots, world } from './stage';
import { S } from './state';
import { $, FACES, esc } from './util';

/** Where an FX die rests off the board: a row to the right of the player's own dice, under the road. */
export function fxRestSpot(kind: string): THREE.Vector3 {
  const step = DIE_W * TRAY_SCALE * 1.55;
  const k = Math.max(0, FX_ORDER.indexOf(kind));
  return new THREE.Vector3(BOARD_X0 + PITCH_W + TILE_W / 2 - 1.6 + (3.2 + k * 1.05) * step, DIE_W * FX_SCALE / 2, TRAY_Z);
}

/** The FX die of a kind, made and put to rest on first use. */
export function fxDie(kind: string): TableDie {
  let td = fxSupply.get(kind);
  if (!td) {
    const d = makeDie(FACES, kind, DIE_W);
    d.mesh.scale.setScalar(FX_SCALE);
    const rest = fxRestSpot(kind);
    const q = d.orientation(0, kind === 'direction' ? FORWARD : AWAY);
    d.mesh.position.copy(rest);
    d.mesh.quaternion.copy(q);
    scene.add(d.mesh);
    td = { kind, d, from: rest.clone(), to: rest.clone(), q0: q.clone(), q1: q.clone(), t: 1, dur: 0.75, hop: 0 };
    fxSupply.set(kind, td);
  }
  return td;
}

/** Puts every FX die of the game in its resting place (the fire die only with Carnage at Devil's Run). */
export function syncFxSupply(): void {
  if (!g) return;
  for (const k of FX_ORDER) if (k !== 'fire' || g.carnage) fxDie(k);
  const fire = fxSupply.get('fire');
  if (fire) fire.d.mesh.visible = !!g.carnage;
  if (g.carnage) wormReady();
}

/** Sends the dice out on the road back to their resting places, showing the face they rolled. */
export function fxGoHome(): void {
  S.fxHomeAt = null;
  for (const td of S.trayDice) {
    td.from = td.d.mesh.position.clone();
    td.to = fxRestSpot(td.kind);
    td.q0 = td.d.mesh.quaternion.clone();
    td.q1 = td.q0.clone();
    td.t = 0; td.dur = 0.6; td.hop = 0.9; td.throw = null;
  }
  S.trayDice = [];
}

/**
 * A rolled FX die flies from wherever it is (its resting place, mostly) to the action: the space the
 * engine names for the roll (the shooter, the slam, the damaged vehicle), else the car whose turn it
 * is. The dice of one effect line up in a row there, on free road (asked by the user, 2026-11-16).
 */
export function rollOnTable(f: Frame): void {
  if (!f.die) return;
  if (S.trayFresh) { fxGoHome(); S.trayFresh = false; }
  S.fxHomeAt = null;
  const td = fxDie(f.die.die);
  td.d.mesh.visible = true;
  const car = f.snap.vehicles.find(v => v.id === f.snap.activeCar);
  const cell = f.at ?? car?.pos ?? null;
  const at = cell ? world(cell) : null;
  // Never on the action's space or the six around it (asked by the user, 2026-11-17): the dice
  // must not hide what happens there, a slam's push, a car going off. Nor on the spaces the car whose
  // turn it is may drive onto next, two steps ahead (asked by the user, 2026-11-19).
  const zone = cell ? actionZone(cell) : [];
  if (car?.pos) for (const q of aheadOf(car.pos)) zone.push(world(q));
  // A die already out stays where it is and is rolled again there, unless it lies in that ring.
  let to = S.trayDice.includes(td) ? td.to.clone() : null;
  if (to && zone.some(z => onSpace(z, to!))) to = null;
  if (!to && at) to = fxSpot(at, S.trayDice.filter(t => t !== td).map(t => t.to), f.snap, zone);
  to ??= fxRestSpot(f.die.die).add(new THREE.Vector3(0, 0, -1.2));
  if (!S.trayDice.includes(td)) S.trayDice.push(td);
  td.from = td.d.mesh.position.clone();
  td.to = to;
  td.q1 = td.d.orientation(f.die.face, f.die.die === 'direction' ? FORWARD : AWAY); // all square to the road: a tidy row
  td.q0 = td.d.mesh.quaternion.clone();
  // The throw: the die flies, bounces, glances off a vehicle or a rock by its way, and tumbles to a stop
  // on the spot chosen above, showing its face (view/dice-throw.ts). Where it lands is not the throw's to choose.
  const space = GRID.pitch * KX;
  const bumpers: Bumper[] = f.snap.vehicles.filter(v => v.pos && v.status !== 'elim').map(v => { const w = world(v.pos!); return { x: w.x, z: w.z, r: P.diceThrow.carR * space }; });
  for (const grp of tileSlots) {
    for (const b of (grp?.userData.blockers as ObstacleBlocker[] | undefined) ?? []) {
      const w = grp!.localToWorld(new THREE.Vector3(b.x, 0, b.z));
      bumpers.push({ x: w.x, z: w.z, r: P.diceThrow.rockR * space });
    }
  }
  td.throw = planThrow(td.from, td.to, td.q1, DIE_W * FX_SCALE, bumpers, Math.random, P.diceThrow);
  td.struck = false;
  td.t = 0; td.dur = P.diceThrow.seconds; td.hop = 0;
}

/** The spaces a car at `p` may reach in its next two steps (its front arc, and the front arc of those). */
function aheadOf(p: Pos): Pos[] {
  const arc = (q: Pos): Pos[] => (['FL', 'F', 'FR'] as Dir[]).map(d => neighbor(q, d)).filter(onBoard);
  const one = arc(p);
  return [...one, ...one.flatMap(arc)];
}

/** A formation of an impassable space, in world units: its middle, its radius and the height of its top. */
interface Rock { x: number; z: number; r: number; top: number }
/** The rocks, mesas and bunkers on the road tiles now (terrain/obstacles.ts lists them on each tile). */
function rocks(): Rock[] {
  const out: Rock[] = [];
  for (const grp of tileSlots) {
    for (const b of (grp?.userData.blockers as ObstacleBlocker[] | undefined) ?? []) {
      const w = grp!.localToWorld(new THREE.Vector3(b.x, b.h, b.z));
      const edge = grp!.localToWorld(new THREE.Vector3(b.x + b.r, b.h, b.z));
      out.push({ x: w.x, z: w.z, r: Math.hypot(edge.x - w.x, edge.z - w.z), top: w.y });
    }
  }
  return out;
}

/** True when a rock stands between the camera and `p`, high enough to hide a die there. */
function hiddenByRock(p: THREE.Vector3, list: Rock[]): boolean {
  const cam = camera.position;
  const dx = p.x - cam.x, dz = p.z - cam.z, len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return false;
  return list.some(k => {
    const t = THREE.MathUtils.clamp(((k.x - cam.x) * dx + (k.z - cam.z) * dz) / len2, 0, 1);
    if (t >= 0.999) return false;
    const near = Math.hypot(cam.x + dx * t - k.x, cam.z + dz * t - k.z);
    return near < k.r && cam.y + (p.y - cam.y) * t < k.top;
  });
}

/**
 * Where an FX die lands near the action at `c`. The first die of an effect takes the free spot
 * nearest the action (two rings of spots around it, the camera's side first); the next ones line
 * up beside it, in a row along the road. A spot is free when it is on the road and clear of the
 * vehicles, the spaces that can be picked, the dice already there, the impassable spaces and their
 * rocks, and no rock stands between it and the camera (asked by the user, 2026-11-19: the dice fell
 * among the rocks and were lost from sight).
 */
export function fxSpot(c: THREE.Vector3, dice: THREE.Vector3[], snap: Frame['snap'], zone: THREE.Vector3[] = []): THREE.Vector3 | null {
  const space = GRID.pitch * KX; // one road space, in world units
  const gap = DIE_W * FX_SCALE * 1.45;
  const half = DIE_W * FX_SCALE / 2;
  const cars = snap.vehicles.filter(v => v.pos && v.status !== 'elim').map(v => world(v.pos!));
  const roadZ = TILE_H / 2 - DIE_W * FX_SCALE;
  const stones = rocks();
  const blocked: THREE.Vector3[] = [];
  if (g) for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) if (terrainAt(g, { r, c: col }) === 'X') blocked.push(world({ r, c: col }));
  const free = (p: THREE.Vector3): boolean => Math.abs(p.z) <= roadZ && p.x >= BOARD_X0 + 0.5
    && !zone.some(z => onSpace(z, p))
    && !blocked.some(z => onSpace(z, p))
    && !stones.some(k => Math.hypot(k.x - p.x, k.z - p.z) < k.r + half * 1.4)
    && !cars.some(v => Math.hypot(v.x - p.x, v.z - p.z) < space * 0.75)
    && !S.markers.some(m => Math.hypot(m.at.x - p.x, m.at.z - p.z) < space * 0.6)
    && !dice.some(q => Math.hypot(q.x - p.x, q.z - p.z) < gap * 0.95)
    && !hiddenByRock(p, stones);
  if (dice.length) {
    // In the row of the first die: right beside the last one, then on either end.
    const row = dice[0];
    const xs = dice.map(q => q.x);
    for (const x of [Math.max(...xs) + gap, Math.min(...xs) - gap, Math.max(...xs) + 2 * gap, Math.min(...xs) - 2 * gap]) {
      const p = new THREE.Vector3(x, row.y, row.z);
      if (free(p)) return p;
    }
  }
  let best: THREE.Vector3 | null = null, bestScore = Infinity;
  for (const r of [0.95, 1.25, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0]) {
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      const p = new THREE.Vector3(c.x + Math.cos(ang) * r * space, c.y + DIE_W * FX_SCALE / 2, c.z + Math.sin(ang) * r * space);
      if (!free(p)) continue;
      // Room for a row of three: the spots on its sides count too.
      const room = [gap, -gap].filter(dx => free(p.clone().add(new THREE.Vector3(dx, 0, 0)))).length;
      const score = r * 10 - Math.sin(ang) * 2 - room * 3;
      if (score < bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}

/** The six directions around a space. */
const AROUND: Dir[] = ['F', 'FR', 'BR', 'B', 'BL', 'FL'];
/** The centres of a space and of the six around it, where the FX dice must not land. */
export function actionZone(p: Pos): THREE.Vector3[] {
  return [p, ...AROUND.map(d => neighbor(p, d))].map(world);
}
/** True when a die at `p` would lie, even partly, on the space centred at `z`. */
function onSpace(z: THREE.Vector3, p: THREE.Vector3): boolean {
  const die = DIE_W * FX_SCALE / 2;
  return Math.abs(p.x - z.x) < GRID.pitch * KX / 2 + die && Math.abs(p.z - z.z) < GRID.rowPitch * KZ / 2 + die;
}

/**
 * The roll for the first player (setup step 6), in the middle of the screen (asked by the user,
 * 2026-11-18): each crew's dice and total, the lowest marked as the first player, or the tie that
 * makes everyone roll again. The bubbles then slide into turn order (hud.ts).
 */
export function showOrder(f: Frame, seconds: number): void {
  if (!g || !f.order) return;
  const o = f.order;
  let box = document.getElementById('orderbox');
  if (!box) { box = document.createElement('div'); box.id = 'orderbox'; document.body.appendChild(box); }
  const t0 = performance.now();
  const totals = o.rolls.map(r => r.values.reduce((a, b) => a + b, 0));
  const low = Math.min(...totals);
  box.innerHTML = `<h2 class="gothic">Tiro per l’ordine di turno</h2><p>Parte per primo chi fa il totale più basso</p>`
    + o.rolls.map((r, k) => {
      const p = g!.players[r.player];
      const first = o.first === r.player, tied = o.first === null && totals[k] === low;
      return `<div class="row${first ? ' first' : ''}${tied ? ' tied' : ''}" style="--c:${p.color}"><div class="av">${avatarSvg(p.color, p.name)}</div><span class="gothic name">${esc(p.name)}</span>`
        + `<span class="dice">${r.values.map((v, j) => dieHtml('movement', v, p.color, '', `data-roll="${t0 + k * 160 + j * 50}"`)).join('')}</span>`
        + `<b class="gothic tot">${totals[k]}</b>${first ? '<em class="gothic">PARTE PER PRIMO</em>' : tied ? '<em class="gothic">PAREGGIO</em>' : '<em></em>'}</div>`;
    }).join('')
    + (o.first === null ? '<p class="again">Pareggio per il totale più basso: si ritira.</p>' : '');
  box.classList.add('show');
  window.clearTimeout(Number(box.dataset.timer ?? 0));
  box.dataset.timer = String(window.setTimeout(() => box!.classList.remove('show'), seconds * 1000));
}

/** Start of a round: every crew rolls its movement dice, the first player rolls the road die. */
export function showRound(f: Frame, seconds: number): void {
  if (!g || !f.round) return;
  const r = f.round;
  const t0 = performance.now();
  document.getElementById('orderbox')?.classList.remove('show'); // the roll for the first player is over
  $('rolls').classList.remove('show'); // a new round is a new phase: the last turn's dice and damage go
  const box = $('roundbox');
  box.innerHTML = `<h2 class="gothic">Round ${r.n}</h2>` + r.dice.map((d, k) => {
    const p = g!.players[d.player];
    return `<div class="row"><div class="av">${avatarSvg(p.color, p.name)}</div><span class="gothic">${esc(p.name)}</span>`
      + d.values.map((v, j) => dieHtml('movement', v, p.color, '', `data-roll="${t0 + k * 120 + j * 40}"`)).join('')
      + (d.player === r.roller ? `<em>dado strada</em>${dieHtml('road', r.roadDie, undefined, 'road', `data-roll="${t0 + 500}"`)}` : '') + '</div>';
  }).join('');
  box.classList.add('show');
  // Up for as long as its beat lasts at this speed: gone before the round's first turn starts.
  window.clearTimeout(Number(box.dataset.timer ?? 0));
  box.dataset.timer = String(window.setTimeout(() => box.classList.remove('show'), seconds * 1000));
}
