// The animation loop: every frame moves the cars, the camera, the effects and the dice.

import * as THREE from 'three';
import { tickFlames } from '../view/terrain/carnage3d';
import { ROTOR_SPEED, hover } from '../view/models-config';
import { SETTLE_MAX, applyBeat, beatLength, effects, finishBeats, queue, settled } from './beats';
import { carObjs, chopperObjs, fxSupply, hazardObjs } from './board';
import { carTimeScale, drive, hitchTrains } from './cars';
import { chaseCamera, clearSight } from './chase';
import { SHOT, actionSince, directorCamera } from './director';
import { placeActions, placeDock } from './dock';
import { impact, updateSmoke, updateTags, updateWords } from './effects';
import { hudCam, hudRenderer, hudScene, syncHudDice } from './hudDice';
import { moveCamera } from './keys';
import { tiltView } from './mapView';
import { placeBlockTips } from './markers';
import { placeRigPick } from './rigpick';
import { placeBikePick } from './bikepick';
import { placePath } from './waypoints';
import { onBoard, terrainAt, type Frame } from '../game/trv/engine';
import { g } from './game';
import { P } from './presentation';
import { makeRoute, type Route } from './route';
import { updateTrail } from './trail';
import { groundTick, render } from './pieces';
import { frameTimes } from './quality';
import { timeScale } from './replay';
import { fxGoHome } from './rolls';
import { SPEED_SCALE, settings } from './settings';
import { shotsTick } from './shots';
import { TILE_W, camera, controls, renderer, scene, tileSlots, world } from './stage';
import { holdForHand, tickHand } from './handroll';
import { S } from './state';
import { animTableDice } from './tableDice';
import { $, menuOpen } from './util';

export const timer = new THREE.Timer();
timer.connect(document);
/**
 * A car driving forward (asked by the user, 2026-11-19): the move beat, and the moves of the same
 * car right after it (a waypoint path run with Vai!, a slide on desert glass), are driven as one
 * route, as a driver would (route.ts). A car pushed back or sideways (a slam, a bump) slides to its
 * space as before. Every move beat also notes the ground the car drives on (trail.ts).
 * @returns true when the beat belongs to a route: its timing is the car's, not the beat's length.
 */
function startRoute(f: Frame): boolean {
  if (f.kind !== 'move' || !f.vehicleId || !f.at || !g) return false;
  const o = carObjs.get(f.vehicleId);
  if (!o) return false;
  const ground = (x: Frame): ReturnType<typeof terrainAt> => (onBoard(x.at!) ? terrainAt(g!, x.at!) : 'R');
  o.userData.ground = ground(f);
  const cur = o.userData.route as Route | undefined;
  if (cur?.frames.includes(f)) return true;
  // Forward only: each space ahead of the one before (a lane change goes half a space forward).
  const ahead = (from: THREE.Vector3, x: Frame): boolean => world(x.at!).x > from.x + TILE_W / 8 * 0.2;
  if (o.userData.hitch || !ahead(o.position, f)) { delete o.userData.route; return false; }
  const frames = [f];
  for (const x of queue) {
    if (x.kind === 'log') continue;
    if (x.kind === 'move' && x.vehicleId === f.vehicleId && x.at && ahead(world(frames[frames.length - 1].at!), x)) frames.push(x); else break;
  }
  // The Big Rig may stop at a slant; cars and motorcycles end along their lane.
  const rig = f.snap.vehicles.find(v => v.id === f.vehicleId)?.rig !== undefined;
  o.userData.route = makeRoute(o.position, frames.map(x => world(x.at!)), frames, frames.map(ground), P.route, !rig);
  return true;
}

/** Whether beat `f` waits: a car on a route has not got to the space it starts from, or is still driving. */
/** True while a car drives a route (its beats are paced by waitRoute). */
function driving(): boolean {
  for (const o of carObjs.values()) {
    const r = o.userData.route as Route | undefined;
    if (r && r.s < r.len) return true;
  }
  return false;
}

function waitRoute(f: Frame): boolean {
  for (const o of carObjs.values()) {
    const r = o.userData.route as Route | undefined;
    if (!r || r.s >= r.len) continue;
    const k = r.frames.indexOf(f);
    if (k >= 0) return r.s < r.marks[k];
    if (f.kind !== 'log') return true;
  }
  return false;
}

renderer.setAnimationLoop(t => {
  timer.update(t);
  // Behind the first screen nothing is drawn: it is a screen of its own, and the computer rests.
  if (menuOpen()) { $('cmdwrap').classList.remove('on'); return; }
  const rawDt = Math.min(timer.getDelta(), 0.1);
  frameTimes(rawDt);
  const dt = rawDt * timeScale * (S.playing ? SPEED_SCALE[settings.speed] : 1);
  const k = 1 - Math.exp(-dt * 10);
  const now = performance.now() / 1000;
  const carDt = dt * carTimeScale();
  for (const o of carObjs.values()) drive(o, carDt, 1 - Math.exp(-carDt * 10), now);
  updateTrail(carDt);
  hitchTrains(carObjs.values(), carDt);
  moveCamera(rawDt);
  for (const o of chopperObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (tg) o.position.lerp(tg, k);
    const aim = o.userData.aim as number | null | undefined;
    const wantYaw = aim ?? 0, dy = Math.atan2(Math.sin(wantYaw - o.rotation.y), Math.cos(wantYaw - o.rotation.y));
    o.rotation.y += dy * Math.min(1, dt * 8);
    o.rotation.z += ((aim === null || aim === undefined ? 0 : -0.3) - o.rotation.z) * Math.min(1, dt * 8); // nose down to strafe
    // On the ground it stands still, rotors idling; in the air it hovers.
    const idle = o.userData.parked && tg && o.position.distanceTo(tg) < 0.1 ? 0.08 : 1;
    const r = o.getObjectByName('rotor'); if (r) r.rotation.y += dt * 18 * idle;
    const model = o.userData.model as THREE.Object3D | undefined;
    if (model) hover(model, idle < 1 ? 0 : now, idle < 1 ? 0 : o.userData.phase ?? 0, idle < 1 ? 0 : o.userData.modelHeight ?? 0.5);
    for (const p of (o.userData.spin ?? []) as THREE.Object3D[]) {
      if (p.name === 'rotorMain') p.rotation.y += dt * ROTOR_SPEED.rotorMain * idle; else p.rotation.z += dt * ROTOR_SPEED.rotorTail * idle;
    }
  }
  for (const m of S.markers) (m.mesh.material as THREE.MeshBasicMaterial).opacity = (m.mesh.userData.hover ? 0.85 : 0.45) + Math.sin(now * 5) * 0.15;
  // Replay of the rules' beats, one at a time.
  // Beats follow the clock, not the frame rate: a slow frame plays every beat that is due.
  // While the director's camera moves into a shot, the beats wait for it (SHOT.wait seconds).
  if (S.playing && S.shot && now < actionSince + SHOT.wait) S.nextBeatAt = Math.max(S.nextBeatAt, now);
  // Dice to throw by hand: the playback waits for TIRA (handroll.ts).
  tickHand(now);
  while (S.playing && now >= S.nextBeatAt && !holdForHand(queue)) {
    // A car driving a route: each step's beat waits for the car to get there, the others for the end.
    if (queue.length && waitRoute(queue[0])) break;
    // One scene at a time (asked by the user, 2026-11-19): a beat starts only when what the last one set
    // going is over: cars parked, dice still, effects and words gone. A car driving its route is
    // waited for above, step by step. At most settle_max_s, in case something never stops.
    if (queue.length && !driving()) {
      if (!settled()) {
        if (!S.calmBy) S.calmBy = now + SETTLE_MAX;
        if (now < S.calmBy) break;
      }
      S.calmBy = 0;
    }
    const f = queue.shift();
    if (!f) {
      // The last beat is out: the table comes to rest before the next choice or the end of the game.
      // First the table as the rules have it now (a piece eliminated goes): its last changes animate
      // too, and are waited for.
      if (!S.settleBy) { S.settleBy = now + SETTLE_MAX; render(); }
      if (!settled() && now < S.settleBy) break;
      finishBeats();
      break;
    }
    S.settleBy = 0;
    applyBeat(f, now);
    S.nextBeatAt = Math.max(S.nextBeatAt, now - 0.5) + (startRoute(f) ? 0 : beatLength(f)) / (timeScale * SPEED_SCALE[settings.speed]);
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t = Math.min(1, e.t + dt / e.life);
    e.step(e.t);
    if (e.t >= 1) effects.splice(i, 1);
  }
  tickFlames(now, camera, renderer.domElement.height);
  groundTick(now);
  for (const grp of tileSlots) {
    if (!grp) continue;
    if (grp.userData.x !== undefined) grp.position.x += (grp.userData.x - grp.position.x) * k * 0.6;
    if (grp.userData.info) (grp.userData.info as THREE.Object3D).visible = settings.grid;
  }
  updateWords(dt);
  updateTags();
  updateSmoke(dt, now);
  for (const [k, h] of hazardObjs) {
    h.obj.update(dt);
    if (h.gone !== undefined && now > h.gone) { scene.remove(h.obj.group); hazardObjs.delete(k); }
  }
  if (S.fxHomeAt !== null && !S.playing && performance.now() / 1000 > S.fxHomeAt) fxGoHome();
  for (const td of fxSupply.values()) {
    if (td.t >= 1) continue;
    td.t = Math.min(1, td.t + dt / td.dur);
    const u = Math.max(0, td.t), e = 1 - Math.pow(1 - u, 3);
    if (td.throw) {
      // A thrown die follows its planned throw; a puff where it strikes a piece.
      td.throw.at(u, td.d.mesh.position, td.d.mesh.quaternion);
      if (!td.struck && td.throw.hit && td.throw.hitAt !== null && u >= td.throw.hitAt) { td.struck = true; impact(td.throw.hit, 0xd9b48a, 0.22); }
      continue;
    }
    td.d.mesh.position.lerpVectors(td.from, td.to, e);
    // A throw lands bouncing; the way home is one low arc.
    const rise = td.hop > 1.5 ? Math.abs(Math.cos(u * Math.PI * 1.5)) * (1 - u) * td.hop : Math.sin(u * Math.PI) * td.hop;
    td.d.mesh.position.y = THREE.MathUtils.lerp(td.from.y, td.to.y, e) + rise;
    td.d.mesh.quaternion.slerpQuaternions(td.q0, td.q1, e);
  }
  const shot = directorCamera(now, rawDt);
  const chased = !shot && chaseCamera(rawDt);
  clearSight(chased);
  shotsTick();
  if (!shot && !chased) {
    controls.update();
    tiltView();
  }
  animTableDice(now, rawDt);
  const shake = now < S.shakeUntil ? new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25) : null;
  if (shake) camera.position.add(shake);
  renderer.render(scene, camera);
  if (shake) camera.position.sub(shake);
  syncHudDice(now);
  placeActions();
  placeDock();
  placeBlockTips();
  placeRigPick();
  placeBikePick();
  placePath();
  hudRenderer.render(hudScene, hudCam);
});
