// The sand worm's show (Carnage at Devil's Run): the ground shakes under the car farthest back,
// the worm bursts out beneath it with its jaws wide, lifts and swallows it, sways and dives back.
// Presentation only: the rules have already taken the car off the table.

import * as THREE from 'three';
import { MODEL, WORM } from '../view/models-config';
import { Worm, type WormPose } from '../view/worm';
import { effects } from './beats';
import { carObjs } from './board';
import { impact, smokeOff, smokeTex, word } from './effects';
import { models } from './pieces';
import { P } from './presentation';
import { settings } from './settings';
import { TILE_T, TILE_W, camera, renderer, scene } from './stage';
import { S } from './state';

let worm: Worm | null = null;
let asked = false;

/** Fetches the worm's model, once: call it when a game can turn one up. */
export function wormReady(): void {
  if (asked || !MODEL.worm) return;
  asked = true;
  void models.load(MODEL.worm).then(m => {
    let geo: THREE.BufferGeometry | null = null;
    m?.traverse(x => { if (!geo && (x as THREE.Mesh).isMesh) geo = (x as THREE.Mesh).geometry; });
    if (!geo) return;
    worm = new Worm(geo, WORM);
    // Only what is above the table is drawn: the worm comes out of the ground.
    renderer.localClippingEnabled = true;
    (worm.mesh.material as THREE.Material).clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_T)];
  });
}

const ease = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Sand thrown up around a point. */
function dust(at: THREE.Vector3, size: number): void {
  if (!settings.effects) return;
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd2ae7c, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, out = (0.5 + Math.random()) * size, up = (0.6 + Math.random() * 1.2) * size, grow = (0.5 + Math.random() * 0.7) * size;
    scene.add(s);
    effects.push({ life: 0.7 + Math.random() * 0.5, t: 0, step: u => {
      s.position.set(at.x + Math.cos(a) * out * u, at.y + up * u * (1.6 - u), at.z + Math.sin(a) * out * u);
      s.scale.setScalar(0.25 + grow * u);
      s.material.opacity = 0.75 * (1 - u);
      if (u >= 1) { scene.remove(s); s.material.dispose(); }
    } });
  }
}

/**
 * The worm swallows the piece `id`. False when it cannot be shown (no model yet, no such piece):
 * the caller then shows the elimination its usual way.
 * Example: `if (!wormEats(f.vehicleId)) crash(f.vehicleId, null, '')`.
 */
export function wormEats(id: string): boolean {
  const car = carObjs.get(id), w = worm;
  if (!car || !w || w.mesh.parent) return false;
  carObjs.delete(id); // from here on this effect owns the piece
  smokeOff(id);
  const K = P.sandWorm, space = TILE_W / 8, scale = K.width * space / w.width, tall = w.height * scale;
  const from = car.position.clone(), ground = new THREE.Vector3(from.x, TILE_T, from.z);
  const yaw0 = car.rotation.y;
  // The worm turns its mouth to whoever is watching.
  const holder = new THREE.Group();
  holder.position.copy(ground);
  holder.rotation.y = Math.atan2(camera.position.x - from.x, camera.position.z - from.z);
  w.mesh.scale.setScalar(scale);
  holder.add(w.mesh);
  scene.add(holder);
  // It comes up where its open mouth, turned to the sky, is right under the car.
  const up: WormPose = { bend: K.up, dir: 0, gape: K.gape }, pose: WormPose = { ...up };
  const m = new THREE.Vector3(), way = new THREE.Vector3();
  w.mouth(up, m);
  w.mesh.position.set(-m.x * scale, -tall, -m.z * scale);
  const keep = tall * WORM.root * 0.6; // its foot never leaves the ground
  // The hole it leaves in the sand while it is out.
  const hole = new THREE.Mesh(new THREE.CircleGeometry(K.width * space * 0.62, 28), new THREE.MeshBasicMaterial({ color: 0x1a0f08, transparent: true, opacity: 0.85, depthWrite: false }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.copy(w.mesh.position).setY(0.012);
  holder.add(hole);
  const now = performance.now() / 1000;
  S.shakeUntil = now + K.seconds * K.rise;
  impact(ground, 0xd9b48a, 0.5);
  let out = false, gone = false, down = false;
  effects.push({ life: K.seconds * 0.9, t: 0, step: u => {
    // How far out of the ground: bursting out with a little overshoot, then diving.
    const r = ease(K.quake, K.rise, u), over = Math.sin(Math.PI * ease(K.quake, K.rise + 0.08, u)) * 0.08;
    const rise = (r + over) * (1 - ease(K.dive, 0.98, u) ** 2);
    w.mesh.position.y = -(1 - rise) * tall - keep * rise;
    hole.scale.setScalar(ease(0, K.quake, u) * (1 - ease(0.94, 1, u)) + 0.001);
    // The pose: mouth to the sky, jaws wide; they snap shut on the car; then it leans about and straightens to dive.
    const after = ease(K.gulp, K.gulp + 0.12, u), t = (u - K.gulp) * K.seconds;
    pose.gape = K.gape + (K.shut - K.gape) * ease(K.gulp - 0.015, K.gulp + 0.03, u);
    pose.bend = (K.up + (K.sway * 0.7 - K.up) * after + Math.sin(t * 4.2) * K.sway * 0.35 * after) * (1 - ease(K.dive, 0.95, u));
    pose.dir = Math.sin(t * 2.6) * 0.9 * after;
    w.pose(pose);
    if (!out && u >= K.quake) { out = true; dust(ground, space * 1.4); word('VERME!', ground.clone().setY(TILE_T + tall), '#e8b860', true); }
    if (!down && u >= K.dive + 0.1) { down = true; dust(ground, space); impact(ground, 0xd9b48a, 0.4); }
    // The car: shaken, lifted on the open mouth, then down the throat.
    if (!gone) {
      w.mouth(pose, m, way);
      holder.localToWorld(m.multiplyScalar(scale).add(w.mesh.position));
      way.applyAxisAngle(THREE.Object3D.DEFAULT_UP, holder.rotation.y);
      const sink = ease(K.rise, K.gulp, u);
      if (u < K.quake) car.position.set(from.x + (Math.random() - 0.5) * 0.05, from.y, from.z + (Math.random() - 0.5) * 0.05);
      else car.position.set(m.x, Math.max(from.y, m.y + tall * 0.04), m.z).addScaledVector(way, -sink * tall * 0.22);
      car.rotation.set(sink * 1.1, yaw0 + sink * 1.5, Math.sin(u * 40) * 0.12 * (1 - sink));
      car.scale.setScalar(1 - sink * 0.6);
      if (u >= K.gulp) { gone = true; scene.remove(car); word('GULP!', m, '#ff5a3a', true); S.shakeUntil = performance.now() / 1000 + 0.25; }
    }
    if (u >= 1) {
      scene.remove(holder);
      holder.remove(w.mesh);
      hole.geometry.dispose();
      if (!gone) scene.remove(car);
    }
  } });
  return true;
}
