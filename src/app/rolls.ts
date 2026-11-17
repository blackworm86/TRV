// The FX dice (road, stunt, slam, shooting, direction, fire) rolled on the table, and the
// round banner.

import * as THREE from 'three';
import { type Frame } from '../game/trv/engine';
import { GRID } from '../view/board3d';
import { avatarSvg } from '../view/vector/art';
import { makeDie } from '../view/dice3d';
import { AWAY, DIE_W, FORWARD, FX_ORDER, FX_SCALE, TRAY_SCALE, TRAY_Z, TableDie, fxSupply } from './board';
import { g } from './game';
import { dieHtml } from './hud';
import { BOARD_X0, KX, PITCH_W, TILE_H, TILE_W, scene, world } from './stage';
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
}

/** Sends the dice out on the road back to their resting places, showing the face they rolled. */
export function fxGoHome(): void {
  S.fxHomeAt = null;
  for (const td of S.trayDice) {
    td.from = td.d.mesh.position.clone();
    td.to = fxRestSpot(td.kind);
    td.q0 = td.d.mesh.quaternion.clone();
    td.q1 = td.q0.clone();
    td.t = 0; td.dur = 0.6; td.hop = 0.9;
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
  const at = f.at ? world(f.at) : car?.pos ? world(car.pos) : null;
  // A die already out stays where it is and is rolled again there.
  let to = S.trayDice.includes(td) ? td.to.clone() : null;
  if (!to && at) to = fxSpot(at, S.trayDice.map(t => t.to), f.snap);
  to ??= fxRestSpot(f.die.die).add(new THREE.Vector3(0, 0, -1.2));
  if (!S.trayDice.includes(td)) S.trayDice.push(td);
  td.from = td.d.mesh.position.clone();
  td.to = to;
  td.q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
  td.q1 = td.d.orientation(f.die.face, f.die.die === 'direction' ? FORWARD : AWAY); // all square to the road: a tidy row
  td.t = 0; td.dur = 0.75; td.hop = 2.2;
}

/**
 * Where an FX die lands near the action at `c`. The first die of an effect takes the free spot
 * nearest the action (two rings of spots around it, the camera's side first); the next ones line
 * up beside it, in a row along the road. A spot is free when it is on the road and clear of the
 * vehicles, the spaces that can be picked and the dice already there.
 */
export function fxSpot(c: THREE.Vector3, dice: THREE.Vector3[], snap: Frame['snap']): THREE.Vector3 | null {
  const space = GRID.pitch * KX; // one road space, in world units
  const gap = DIE_W * FX_SCALE * 1.45;
  const cars = snap.vehicles.filter(v => v.pos && v.status !== 'elim').map(v => world(v.pos!));
  const roadZ = TILE_H / 2 - DIE_W * FX_SCALE;
  const free = (p: THREE.Vector3): boolean => Math.abs(p.z) <= roadZ && p.x >= BOARD_X0 + 0.5
    && !cars.some(v => Math.hypot(v.x - p.x, v.z - p.z) < space * 0.75)
    && !S.markers.some(m => Math.hypot(m.at.x - p.x, m.at.z - p.z) < space * 0.6)
    && !dice.some(q => Math.hypot(q.x - p.x, q.z - p.z) < gap * 0.95);
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
  for (const r of [0.95, 1.25, 1.5, 1.8, 2.1]) {
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

/** Start of a round: every crew rolls its movement dice, the first player rolls the road die. */
export function showRound(f: Frame): void {
  if (!g || !f.round) return;
  const r = f.round;
  const t0 = performance.now();
  const box = $('roundbox');
  box.innerHTML = `<h2 class="gothic">Round ${r.n}</h2>` + r.dice.map((d, k) => {
    const p = g!.players[d.player];
    return `<div class="row"><div class="av">${avatarSvg(p.color, p.name)}</div><span class="gothic">${esc(p.name)}</span>`
      + d.values.map((v, j) => dieHtml('movement', v, p.color, '', `data-roll="${t0 + k * 120 + j * 40}"`)).join('')
      + (d.player === r.roller ? `<em>dado strada</em>${dieHtml('road', r.roadDie, undefined, 'road', `data-roll="${t0 + 500}"`)}` : '') + '</div>';
  }).join('');
  box.classList.add('show');
  window.setTimeout(() => box.classList.remove('show'), 2500);
}
