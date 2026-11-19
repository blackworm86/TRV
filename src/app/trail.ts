// What a moving car throws up behind it (asked by the user, 2026-11-19): dust on the road, sand off
// it, white dust on the salt flats, clods of mud, splashes of green toxic slime, glints of desert
// glass, embers on fire; and a burning car trails its flames. Every grain is a sprite of the
// smoke texture, from one pool, left in the world where it was thrown so it stays behind the car.

import * as THREE from 'three';
import type { Terrain } from '../game/trv/engine';
import { carObjs } from './board';
import { DRIVE } from './cars';
import { smokeTex } from './effects';
import { LEVELS, settings } from './settings';
import { TILE_T, TILE_W, scene } from './stage';
import { S } from './state';

/**
 * How each ground looks thrown up: colour, grains per second at full speed, size from and to (in
 * spaces), life (s), opacity, how fast it rises, gravity, how widely it spreads, glowing or not.
 */
interface Look { color: number; rate: number; size: [number, number]; life: number; alpha: number; up: number; grav: number; spread: number; glow?: boolean }
const DUST: Look = { color: 0xcdbfa8, rate: 48, size: [0.22, 1.0], life: 1.0, alpha: 0.5, up: 0.25, grav: 0, spread: 0.35 };
const SAND: Look = { color: 0xe2bd83, rate: 70, size: [0.25, 1.25], life: 1.3, alpha: 0.6, up: 0.35, grav: 0, spread: 0.5 };
const LOOKS: Partial<Record<Terrain, Look[]>> = {
  R: [DUST],
  o: [SAND],
  X: [SAND],
  P: [SAND],
  S: [{ ...SAND, color: 0xf2efe6, alpha: 0.4 }],
  M: [{ color: 0x8a5a32, rate: 60, size: [0.16, 0.11], life: 0.7, alpha: 1, up: 1.5, grav: 6, spread: 0.8 }, { ...DUST, color: 0x8d6a48, rate: 14 }],
  G: [{ color: 0x6cff2e, rate: 60, size: [0.15, 0.1], life: 0.7, alpha: 0.9, up: 1.2, grav: 5.5, spread: 0.7, glow: true }, { ...DUST, color: 0x8fd24c, rate: 18, alpha: 0.4 }],
  D: [{ color: 0xdff4ff, rate: 40, size: [0.1, 0.06], life: 0.5, alpha: 0.95, up: 0.9, grav: 4, spread: 0.6, glow: true }, { ...SAND, rate: 24 }],
  F: [{ color: 0xffa040, rate: 50, size: [0.12, 0.04], life: 0.7, alpha: 1, up: 1.1, grav: -0.4, spread: 0.6, glow: true }, DUST],
};
/** The flames a burning car trails: they rise and stay behind as it drives on. */
const FIRE: Look = { color: 0xff6a12, rate: 26, size: [0.3, 0.06], life: 0.45, alpha: 0.6, up: 0.9, grav: -0.6, spread: 0.25, glow: true };
const FIRE_SMOKE: Look = { color: 0x2a2622, rate: 16, size: [0.3, 1.1], life: 1.3, alpha: 0.45, up: 0.7, grav: -0.2, spread: 0.3 };

interface Grain { sp: THREE.Sprite; vel: THREE.Vector3; age: number; life: number; size: [number, number]; alpha: number; grav: number }
const POOL = 900;
const grains: Grain[] = [];
let nextGrain = 0;
/** A grain from the pool (the oldest one is reused once all are in use). */
function grain(): Grain {
  if (grains.length < POOL) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false;
    scene.add(sp);
    grains.push({ sp, vel: new THREE.Vector3(), age: 0, life: 0, size: [0, 0], alpha: 0, grav: 0 });
  }
  const gr = grains[nextGrain];
  nextGrain = (nextGrain + 1) % POOL;
  return gr;
}

/** Where each car was last frame, and the grains it still owes (rates are not whole per frame). */
const last = new Map<THREE.Object3D, { p: THREE.Vector3; owed: Map<Look, number> }>();

function emit(o: THREE.Object3D, look: Look, n: number, speed: number, fwd: THREE.Vector3, back: number, height: number): void {
  const space = TILE_W / 8;
  const halfW = ((o.userData.modelSize as THREE.Vector3 | undefined)?.z ?? space * 0.4) / 2;
  for (let i = 0; i < n; i++) {
    const gr = grain(), m = gr.sp.material;
    const side = (Math.random() < 0.5 ? -1 : 1) * halfW * (0.4 + Math.random() * 0.5);
    gr.sp.position.set(o.position.x - fwd.x * back + fwd.z * side, Math.max(TILE_T, o.position.y) + height, o.position.z - fwd.z * back - fwd.x * side);
    const kick = speed * (0.15 + Math.random() * 0.2);
    gr.vel.set(-fwd.x * kick + (Math.random() - 0.5) * look.spread, look.up * (0.6 + Math.random() * 0.8), -fwd.z * kick + (Math.random() - 0.5) * look.spread);
    gr.age = 0;
    gr.life = look.life * (0.7 + Math.random() * 0.6);
    gr.size = [look.size[0] * space, look.size[1] * space];
    gr.alpha = look.alpha;
    gr.grav = look.grav;
    m.color.setHex(look.color);
    const blend = look.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (m.blending !== blend) { m.blending = blend; m.needsUpdate = true; }
    gr.sp.visible = true;
  }
}

/** Every frame (loop.ts): throws up the grains of the cars that move, and moves and fades the rest. */
export function updateTrail(dt: number): void {
  if (dt <= 0) return;
  const amount = settings.effects ? LEVELS[S.level].particles : 0;
  for (const o of carObjs.values()) {
    const rec = last.get(o) ?? { p: o.position.clone(), owed: new Map<Look, number>() };
    last.set(o, rec);
    const speed = Math.hypot(o.position.x - rec.p.x, o.position.z - rec.p.z) / dt;
    rec.p.copy(o.position);
    if (!amount || !o.visible || o.userData.wreck || o.userData.jump) continue;
    const moving = speed > 0.3 ? Math.min(1, speed / DRIVE.speed) : 0;
    const flames = !!o.userData.flames;
    if (!moving && !flames) continue;
    const yaw = (o.userData.yaw ?? 0) as number;
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const len = ((o.userData.modelSize as THREE.Vector3 | undefined)?.x ?? TILE_W / 8 * 0.6) / 2;
    const height = (o.userData.height ?? 0.4) as number;
    const owe = (look: Look, rate: number, back: number, up: number): void => {
      const due = (rec.owed.get(look) ?? 0) + rate * amount * dt;
      const n = Math.floor(due);
      rec.owed.set(look, due - n);
      if (n) emit(o, look, n, speed, fwd, back, up);
    };
    if (moving) for (const look of LOOKS[(o.userData.ground ?? 'R') as Terrain] ?? [DUST]) owe(look, look.rate * moving, len * 1.05, 0.03);
    // A burning car: its flames go with it, and on the move they stream out behind.
    // They start on the roof, over the flames that ride on it, and stream out behind on the move.
    if (flames) { owe(FIRE, FIRE.rate * (0.35 + moving), len * 0.3, height * 1.05); owe(FIRE_SMOKE, FIRE_SMOKE.rate * (0.4 + moving), len * 0.5, height * 1.3); }
  }
  for (const gr of grains) {
    if (!gr.sp.visible) continue;
    gr.age += dt;
    const u = gr.age / gr.life;
    if (u >= 1) { gr.sp.visible = false; continue; }
    gr.vel.y -= gr.grav * dt;
    gr.vel.multiplyScalar(1 - Math.min(1, dt * 1.6));
    gr.sp.position.addScaledVector(gr.vel, dt);
    // Clods and splashes land and lie flat a moment before they fade.
    if (gr.sp.position.y < TILE_T) { gr.sp.position.y = TILE_T; gr.vel.set(0, 0, 0); }
    gr.sp.scale.setScalar(gr.size[0] + (gr.size[1] - gr.size[0]) * u);
    gr.sp.material.opacity = gr.alpha * Math.min(1, u * 6) * (1 - u);
  }
}
