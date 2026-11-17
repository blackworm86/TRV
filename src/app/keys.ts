// Keyboard camera controls: pan, focus on a car, cycle through the cars.

import * as THREE from 'three';
import { carObjs } from './board';
import { chase } from './chase';
import { g, viewer } from './game';
import { fitDist, homeView, toggleGrid, toggleZenith } from './mapView';
import { startReplay } from './replay';
import { camera, controls } from './stage';
import { S } from './state';
import { menuOpen } from './util';

// WASD (or arrows) slide the view over the table; Tab / Shift+Tab jump between the cars of the
// player on turn, 1 2 3 go to their small, medium and large car, F to the car that is acting.
export const held = new Set<string>();
export const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
};
export let focusIdx = -1;
export function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
/** The cars (still in play) of the player the interface is showing, small to large. */
export function myCars(): THREE.Object3D[] {
  const me = viewer();
  if (!g || !me) return [];
  const idx = g.players.indexOf(me);
  return g.vehicles.filter(v => v.owner === idx && v.status !== 'elim')
    .sort((a, b) => 'SML'.indexOf(a.size) - 'SML'.indexOf(b.size))
    .map(v => carObjs.get(v.id)).filter((o): o is THREE.Group => !!o);
}
/** Slides the view to `o`; with `close`, it also comes nearer, as for a look at that car. */
export function focusOn(o: THREE.Object3D | undefined, close = false): void {
  if (o && close) S.focusDist = fitDist * 0.5;
  if (o) S.focusGoal = (o.userData.target as THREE.Vector3 | undefined)?.clone().setY(0) ?? o.position.clone().setY(0);
}
addEventListener('keydown', e => {
  if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || menuOpen()) return;
  const key = e.key.toLowerCase();
  if (PAN_KEYS[key]) { held.add(key); S.focusGoal = null; S.focusDist = null; e.preventDefault(); return; }
  const cars = myCars();
  if (key === 'tab') {
    e.preventDefault();
    if (!cars.length) return;
    focusIdx = (focusIdx + (e.shiftKey ? -1 : 1) + cars.length) % cars.length;
    focusOn(cars[focusIdx]);
  } else if (key === '1' || key === '2' || key === '3') {
    const me = viewer();
    const v = g && me ? g.vehicles.find(x => x.owner === g!.players.indexOf(me) && x.size === 'SML'[Number(key) - 1] && x.status !== 'elim') : undefined;
    if (v) focusOn(carObjs.get(v.id));
  } else if (key === 'v') {
    if (chase || S.shot || S.shotBack) homeView();
    else toggleZenith();
  } else if (key === 'home') {
    homeView();
  } else if (key === 'g') {
    toggleGrid();
  } else if (key === 'r') {
    startReplay();
  } else if (key === 'f') {
    focusOn([...carObjs.values()].find(o => o.userData.active) ?? cars[0]);
  }
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());
/** Camera speed with the keys: a share of the distance to the table per second. */
export const KEY_PAN = 0.9;
export function moveCamera(dt: number): void {
  const move = new THREE.Vector3();
  if (held.size) {
    const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    for (const k of held) { const [x, y] = PAN_KEYS[k] ?? [0, 0]; move.addScaledVector(right, x).addScaledVector(fwd, y); }
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(camera.position.distanceTo(controls.target) * KEY_PAN * dt);
  } else if (S.focusGoal) {
    move.subVectors(S.focusGoal, controls.target).setY(0).multiplyScalar(Math.min(1, dt * 6));
    if (move.length() < 0.002) S.focusGoal = null;
  }
  if (move.lengthSq() > 0) { controls.target.add(move); camera.position.add(move); }
  if (S.focusDist !== null) {
    // Zooming toward the car: tiltView then turns the view for the new distance.
    const off = camera.position.clone().sub(controls.target), d = off.length();
    const nd = d + (S.focusDist - d) * Math.min(1, dt * 6);
    camera.position.copy(controls.target).addScaledVector(off.normalize(), nd);
    if (Math.abs(nd - S.focusDist) < 0.05) S.focusDist = null;
  }
}
