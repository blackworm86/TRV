// The action director: a camera shot made for each big event, then the view handed back.
// The action camera (asked by the user): on a jump, a shot, a slam, a car catching fire or being
// destroyed, damage and an airstrike, the view cuts to a shot made for that event (a tracking
// shot along a jump, over the shooter's shoulder, low beside a slam...), following what moves.
// When the beats are over it hands the view back as it was (the map, or the chase view).
// Off in the Options menu; not during the instant replay (it frames its own shots) or when the
// animations are skipped.

import * as THREE from 'three';
import { type Frame } from '../game/trv/engine';
import { carObjs } from './board';
import { chase, chaseLens } from './chase';
import { carAt } from './inspect';
import { elevAt, fitDist } from './mapView';
import { P } from './presentation';
import { replaying } from './replay';
import { settings } from './settings';
import { TILE_W, camera, controls, world } from './stage';
import { S } from './state';

export const ACTION_BEATS = new Set<Frame['kind']>(['slam', 'shot', 'damage', 'elim', 'jump', 'fire', 'chopper']);
/** How close the camera comes to dice it shows (a question about them), as a share of the whole-map view's distance. */
export const ACTION_DIST = P.director.diceDist;
/**
 * Timing of the shots, in seconds: the move into a shot, the way back to the player's view, how
 * long the beats wait for the camera to arrive, and how fast a shot follows a moving subject.
 */
export const SHOT = P.director.shot;
/**
 * The picture of a shot is shifted up by this share of the window's height, so its subject sits in
 * the band left free between the players' bubbles and the boards (as the chase view does).
 */
export const SHOT_LIFT = P.director.lift;
/** Shifts the picture up for a shot, or back. */
export function liftView(on: boolean): void {
  if (on) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * SHOT_LIFT, innerWidth, innerHeight);
  else if (!chase) camera.clearViewOffset();
}
/** A camera shot: where the camera stands and what it looks at, as functions of the time (s). */
export interface Shot { t0: number; pos: (now: number) => THREE.Vector3; look: (now: number) => THREE.Vector3; from: { pos: THREE.Vector3; look: THREE.Vector3 } }
/** Where the shot camera is now (smoothed toward the shot's own path). */
export const shotCam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
/** The player's view to go back to (map view), and the way back once the action is over. */
export let actionSince = 0;
/** The beat the current shot was made for (null with no shot). */
export let shotFor: Frame['kind'] | null = null;

/** The map view's camera for a target and a distance (as tiltView places it). */
export function homePose(target: THREE.Vector3, d: number): THREE.Vector3 {
  const e = elevAt(d);
  return new THREE.Vector3(target.x, target.y + d * Math.sin(e), target.z + d * Math.cos(e));
}
/** Starts a shot, from wherever the camera is now. */
export function startShot(pos: Shot['pos'], look: Shot['look']): void {
  const now = performance.now() / 1000;
  if (!S.shot && !S.shotBack && !chase) S.camHome = { target: controls.target.clone(), dist: camera.position.distanceTo(controls.target) };
  const from = S.shot ? { pos: shotCam.pos.clone(), look: shotCam.look.clone() } : { pos: camera.position.clone(), look: controls.target.clone() };
  S.shot = { t0: now, pos, look, from };
  S.shotBack = null;
  shotCam.pos.copy(pos(now));
  shotCam.look.copy(look(now));
  actionSince = now;
  controls.enabled = false;
  liftView(true);
}
/** Whether the director may take the camera now. */
export function directing(): boolean {
  return settings.actionCam && !replaying && settings.speed !== 'skip';
}
/** A still shot on a point (used for dice a question is about): seen from the front, from close by. */
export function actionShot(at: THREE.Vector3): void {
  if (!directing()) return;
  const c = at.clone();
  const d = fitDist * ACTION_DIST;
  startShot(() => c.clone().add(new THREE.Vector3(0, d * 0.82, d * 0.57)), () => c.clone());
}
/** The action is over: the view goes back to the player's (the chase view takes itself back). */
export function actionDone(): void {
  shotFor = null;
  if (!S.shot) return;
  S.shotBack = { t0: performance.now() / 1000, from: { pos: shotCam.pos.clone(), look: shotCam.look.clone() } };
  S.shot = null;
}
/** A shot made for a beat, if it is one the director films. */
export function directBeat(f: Frame): void {
  if (!directing() || !ACTION_BEATS.has(f.kind)) return;
  const S = TILE_W / 8;
  const car = f.vehicleId ? carObjs.get(f.vehicleId) : undefined; // kept: a destroyed car leaves carObjs
  const at = f.at ? world(f.at) : car?.position.clone();
  if (!at) return;
  shotFor = f.kind;
  const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x * S, y * S, z * S);
  const carAt = (): THREE.Vector3 => (car ? car.position.clone() : at.clone());
  switch (f.kind) {
    case 'jump': {
      // A tracking shot from the side: the camera runs along the road with the car, from the
      // ramp to the landing space, far enough to keep the whole arc in the picture.
      const from = f.from ? world(f.from) : at, land = at, spaces = Math.max(1, (land.x - from.x) / S);
      startShot(
        () => { const p = carAt(), x = THREE.MathUtils.clamp(p.x, from.x, land.x); return new THREE.Vector3(x - 0.6 * S, from.y + (1.6 + spaces * 0.25) * S, p.z + (3.4 + spaces * 0.45) * S); },
        () => { const p = carAt(); return new THREE.Vector3(p.x + 0.4 * S, from.y + (p.y - from.y) * 0.6 + 0.3 * S, p.z); },
      );
      break;
    }
    case 'shot': {
      // Over the shooter's shoulder, the target ahead.
      const src = f.from ? world(f.from) : at;
      const dir = at.clone().sub(src).setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      if (side.z < 0) side.negate(); // the side toward the player
      const pos = src.clone().addScaledVector(dir, -2.3 * S).addScaledVector(side, 0.9 * S).add(V(0, 1.6, 0));
      const look = src.clone().lerp(at, 0.5).add(V(0, 0.1, 0));
      startShot(() => pos.clone(), () => look.clone());
      break;
    }
    case 'slam':
      // Low and from the side, at the impact.
      startShot(() => at.clone().add(V(-1.0, 0.7, 2.5)), () => at.clone().add(V(0, 0.2, 0)));
      break;
    case 'fire': {
      // A slow turn around the burning car.
      const t0 = performance.now() / 1000;
      startShot(
        now => { const a = -0.7 + (now - t0) * 0.55, c = carAt(); return c.add(V(Math.sin(a) * 2.4, 1.3, Math.cos(a) * 2.4)); },
        () => carAt().add(V(0, 0.25, 0)),
      );
      break;
    }
    case 'elim':
      // Following the wreck as it crashes and tumbles, then resting on it.
      startShot(() => carAt().add(V(-1.4, 1.6, 3.2)), () => carAt().add(V(0, 0.2, 0)));
      break;
    case 'damage':
      // Close on the car that was hit, while its damage token turns over.
      startShot(() => carAt().add(V(-1.0, 1.5, 2.6)), () => carAt().add(V(0, 0.25, 0)));
      break;
    case 'chopper':
      // From high above the chopper, onto the spaces below it.
      startShot(() => at.clone().add(V(0, 4.6, 1.6)), () => at.clone());
      break;
  }
}
/** One frame of the director; false when it does not hold the camera. */
export function directorCamera(now: number, dt: number): boolean {
  const ease = (u: number): number => { const x = THREE.MathUtils.clamp(u, 0, 1); return x * x * (3 - 2 * x); };
  if (S.shot) {
    const k = 1 - Math.exp(-dt * SHOT.follow);
    shotCam.pos.lerp(S.shot.pos(now), k);
    shotCam.look.lerp(S.shot.look(now), k);
    const u = ease((now - S.shot.t0) / SHOT.blendIn);
    camera.position.lerpVectors(S.shot.from.pos, shotCam.pos, u);
    const look = S.shot.from.look.clone().lerp(shotCam.look, u);
    camera.lookAt(look);
    controls.target.copy(look);
    return true;
  }
  if (S.shotBack) {
    if (chase) { S.shotBack = null; chaseLens(true); return false; } // the chase view takes itself back
    const home = S.camHome ?? { target: controls.target.clone(), dist: fitDist };
    const u = ease((now - S.shotBack.t0) / SHOT.blendOut);
    camera.position.lerpVectors(S.shotBack.from.pos, homePose(home.target, home.dist), u);
    const look = S.shotBack.from.look.clone().lerp(home.target, u);
    camera.lookAt(look);
    controls.target.copy(look);
    if (u >= 1) { S.shotBack = null; S.camHome = null; controls.enabled = true; controls.target.copy(home.target); liftView(false); }
    return true;
  }
  return false;
}
