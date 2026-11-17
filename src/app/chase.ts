// The view from behind a car (the chase view), picked from a dashboard.
// The view from behind a car, picked from its dashboard; a second click on the dashboard, the
// Vista button or V bring the usual view back.

import * as THREE from 'three';
import { carObjs, chopperObjs } from './board';
import { g } from './game';
import { drawHud } from './hud';
import { fit } from './mapView';
import { P } from './presentation';
import { TILE_T, TILE_W, camera, controls } from './stage';
import { hidesView } from './spots';
import { S } from './state';
import { $ } from './util';

export const SPACE_W = TILE_W / 8;
/**
 * The chase view (rebuilt at the user's request, 2026-11-17: it must show where the car can go).
 * The camera stands low behind the car and always looks down the road (+x), whatever way the car
 * faces, tilted down by `pitch` radians so the horizon stays in the picture. It sees wider than the
 * map view (`fov`, vertical degrees). `back` and `up` are in road spaces; `lift` shifts the picture
 * up (a share of the window's height) so the car sits just above the boards; `follow` is how fast
 * the camera catches up with the car (1/s).
 */
export const CHASE = P.chase;
/** The map view's field of view (vertical degrees), given back when the chase view ends. */
export const MAP_FOV = camera.fov;
export let chase: string | null = null;
export const chaseLook = new THREE.Vector3();
/** Sets the camera's field of view and picture shift for the chase view (on) or the map (off). */
export function chaseLens(on: boolean): void {
  camera.fov = on ? CHASE.fov : MAP_FOV;
  if (on) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * CHASE.lift, innerWidth, innerHeight);
  else { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
}
/** Turns the chase view on for car `id`, or off when it is already on (or `id` is null). */
export function setChase(id: string | null): void {
  chase = CHASE.enabled && id && chase !== id ? id : null;
  controls.enabled = !chase;
  chaseLens(!!chase);
  S.focusGoal = null;
  S.focusDist = null;
  if (chase) { const o = carObjs.get(chase); if (o) { camera.position.copy(chasePose(o)); chaseLook.copy(chaseAim(camera.position)); } }
  else fit();
  drawHud();
}
/** Where the chase camera stands for car `o`: behind it along the road, a little above. */
export function chasePose(o: THREE.Object3D): THREE.Vector3 {
  return new THREE.Vector3(o.position.x - CHASE.back * SPACE_W, TILE_T + CHASE.up * SPACE_W, o.position.z);
}
/** The point the chase camera looks at from `pos`: down the road, tilted down by CHASE.pitch. */
export function chaseAim(pos: THREE.Vector3): THREE.Vector3 {
  return pos.clone().add(new THREE.Vector3(Math.cos(CHASE.pitch), -Math.sin(CHASE.pitch), 0).multiplyScalar(4 * SPACE_W));
}
/**
 * A button on each of the player's dashboards (top right corner) for the view from behind that
 * car; on the car being followed it brings the map back. Only the button does it (asked by the
 * user, 2026-11-16): the rest of the dashboard keeps its own clicks (dice, repairs, cards).
 */
export function chaseButtons(): void {
  const strip = $('strip');
  strip.querySelectorAll('.chasebtn').forEach(b => b.remove());
  if (!CHASE.enabled) return; // switched off for now (user, 2026-11-17): data/trv/presentation_base.json, chase.enabled
  const box = strip.getBoundingClientRect();
  for (const el of strip.querySelectorAll<SVGElement>('[data-car]')) {
    const id = el.dataset.car!;
    const v = g?.vehicles.find(x => x.id === id);
    if (!v || v.status === 'elim' || !carObjs.has(id)) continue;
    const r = el.getBoundingClientRect();
    const b = document.createElement('button');
    b.className = `chasebtn${chase === id ? ' on' : ''}`;
    b.title = chase === id ? 'Torna alla vista della mappa (V)' : 'Vista alle spalle di questa auto';
    b.innerHTML = chase === id ? '✕ Mappa' : '🎥 Vista auto';
    b.style.left = `${r.right - box.left - 8}px`;
    b.style.top = `${r.top - box.top + 8}px`;
    b.addEventListener('click', e => { e.stopPropagation(); setChase(id); });
    strip.append(b);
  }
}
addEventListener('resize', () => requestAnimationFrame(chaseButtons));

/** One frame of the chase view; false when there is none (or its car is gone). */
export function chaseCamera(dt: number): boolean {
  if (!chase) return false;
  const o = carObjs.get(chase);
  if (!o || !o.visible) { setChase(null); return false; }
  // The camera keeps behind the car along the road; its height does not follow jumps and bumps.
  const k = 1 - Math.exp(-dt * CHASE.follow);
  camera.position.lerp(chasePose(o), k);
  chaseLook.copy(chaseAim(camera.position));
  camera.lookAt(chaseLook);
  controls.target.copy(chaseLook);
  return true;
}

const sightBox = new THREE.Box3();
const sightSize = new THREE.Vector3();
/**
 * Keeps the chase view clear (asked by the user, 2026-11-17): a chopper standing between the camera
 * and the followed car (the parked ones wait right behind the start area, where the camera stands)
 * is hidden while the chase camera is on (`on`); every chopper shows again otherwise.
 */
export function clearSight(on: boolean): void {
  const car = on && chase ? carObjs.get(chase) : undefined;
  const spread = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  for (const o of chopperObjs.values()) {
    if (!car) { o.visible = true; continue; }
    if (o.userData.sightR === undefined) {
      o.visible = true;
      sightBox.setFromObject(o).getSize(sightSize);
      o.userData.sightR = Math.max(sightSize.x, sightSize.z) / 2;
    }
    const depth = car.position.x - camera.position.x;
    o.visible = !hidesView(camera.position.x, camera.position.z, depth, spread,
      { x: o.position.x, z: o.position.z, r: o.userData.sightR as number });
  }
}
