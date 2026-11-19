// What a moving car throws up behind it (asked by the user, 2026-11-19): dust on the road, sand off
// it, white dust on the salt flats, glints of desert glass, embers on fire, and a burning car trails
// its flames. Mud and toxic slime are liquid: wet, shiny drops fly from the wheels in arcs, land and
// lie a moment as splats before they soak away. Every look is in presentation_base.json (`trail`).
// What is thrown stays where it was thrown, in the world, so it is left behind the car.

import * as THREE from 'three';
import type { Terrain } from '../game/trv/engine';
import { carObjs } from './board';
import { DRIVE } from './cars';
import { smokeTex } from './effects';
import { P, type TrailLiquid, type TrailLook } from './presentation';
import { LEVELS, settings } from './settings';
import { TILE_T, TILE_W, scene } from './stage';
import { S } from './state';

const T = P.trail;
const SPACE = TILE_W / 8;

// ---------------------------------------------------------------- soft sprites (dust, sand, fire)

interface Grain { sp: THREE.Sprite; vel: THREE.Vector3; age: number; life: number; size: [number, number]; alpha: number; grav: number }
const grains: Grain[] = [];
let nextGrain = 0;
/** A grain from the pool (the oldest one is reused once all are in use). */
function grain(): Grain {
  if (grains.length < T.pool) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false;
    scene.add(sp);
    grains.push({ sp, vel: new THREE.Vector3(), age: 0, life: 0, size: [0, 0], alpha: 0, grav: 0 });
  }
  const gr = grains[nextGrain];
  nextGrain = (nextGrain + 1) % T.pool;
  return gr;
}

/** Where a car throws from: its rear (`back` behind its centre), one side or the other, `height` up. */
interface Thrower { o: THREE.Object3D; fwd: THREE.Vector3; speed: number; halfW: number; ground: number }
function rearSpot(t: Thrower, back: number, height: number): THREE.Vector3 {
  const side = (Math.random() < 0.5 ? -1 : 1) * t.halfW * (0.45 + Math.random() * 0.45);
  return new THREE.Vector3(t.o.position.x - t.fwd.x * back + t.fwd.z * side, t.ground + height, t.o.position.z - t.fwd.z * back - t.fwd.x * side);
}

function puff(t: Thrower, look: TrailLook, back: number, height: number): void {
  const gr = grain(), m = gr.sp.material;
  gr.sp.position.copy(rearSpot(t, back, height));
  const kick = t.speed * (0.15 + Math.random() * 0.2);
  gr.vel.set(-t.fwd.x * kick + (Math.random() - 0.5) * look.spread, look.up * (0.6 + Math.random() * 0.8), -t.fwd.z * kick + (Math.random() - 0.5) * look.spread);
  gr.age = 0;
  gr.life = look.life * (0.7 + Math.random() * 0.6);
  gr.size = [look.size[0] * SPACE, look.size[1] * SPACE];
  gr.alpha = look.alpha;
  gr.grav = look.grav;
  m.color.set(look.color);
  const blend = look.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
  if (m.blending !== blend) { m.blending = blend; m.needsUpdate = true; }
  gr.sp.visible = true;
}

// ---------------------------------------------------------------- liquids (mud, slime)

interface Drop { pos: THREE.Vector3; vel: THREE.Vector3; r: number; age: number; life: number; ground: number; landed: number }
/** The drops of one liquid: one instanced mesh of small wet blobs, lit by the table's lights. */
interface Pool { look: TrailLiquid; mesh: THREE.InstancedMesh; drops: Drop[]; next: number }
const pools = new Map<string, Pool>();
const blob = new THREE.IcosahedronGeometry(1, 1);
function poolOf(ground: string): Pool | null {
  const look = T.liquids[ground];
  if (!look) return null;
  let pool = pools.get(ground);
  if (!pool) {
    const color = new THREE.Color(look.color);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: look.gloss, metalness: 0.1, emissive: color, emissiveIntensity: look.glow });
    const mesh = new THREE.InstancedMesh(blob, mat, T.drops);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.count = 0;
    scene.add(mesh);
    pool = { look, mesh, drops: [], next: 0 };
    pools.set(ground, pool);
  }
  return pool;
}

function splash(t: Thrower, pool: Pool, back: number): void {
  const { look } = pool;
  const d: Drop = { pos: rearSpot(t, back, 0.01), vel: new THREE.Vector3(), r: 0, age: 0, life: 0, ground: t.ground, landed: -1 };
  // Thrown back off the tyre and up, a little to the side.
  const kick = t.speed * look.kick * (0.6 + Math.random() * 0.8);
  const up = look.up[0] + Math.random() * (look.up[1] - look.up[0]);
  const side = (Math.random() - 0.5) * look.spread;
  d.vel.set(-t.fwd.x * kick + t.fwd.z * side, up, -t.fwd.z * kick - t.fwd.x * side);
  d.r = (look.size[0] + Math.random() * (look.size[1] - look.size[0])) * SPACE;
  d.life = look.life * (0.7 + Math.random() * 0.6);
  if (pool.drops.length < T.drops) pool.drops.push(d);
  else pool.drops[pool.next] = d;
  pool.next = (pool.next + 1) % T.drops;
}

const UP = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), DIR = new THREE.Vector3();
/** Moves the drops: in the air they stretch along their way; landed, they flatten into a splat and soak away. */
function updateDrops(pool: Pool, dt: number): void {
  const { look, mesh, drops } = pool;
  drops.forEach((d, i) => {
    d.age += dt;
    if (d.age >= d.life) { mesh.setMatrixAt(i, M4.makeScale(0, 0, 0)); return; }
    if (d.landed < 0) {
      d.vel.y -= look.gravity * dt;
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y <= d.ground + 0.004 && d.vel.y < 0) { d.pos.y = d.ground + 0.004; d.landed = d.age; }
      const v = d.vel.length();
      Q.setFromUnitVectors(UP, DIR.copy(d.vel).divideScalar(Math.max(v, 1e-4)));
      SC.set(d.r * 0.85, d.r * (1 + Math.min(3, v * 0.7)), d.r * 0.85);
    } else {
      // A splat: it spreads out fast, then shrinks and thins as it soaks in.
      const since = d.age - d.landed, u = since / Math.max(0.01, d.life - d.landed);
      const spread = d.r * look.splat * (0.55 + 0.45 * Math.min(1, since * 10)) * (1 - u * u * u);
      Q.identity();
      SC.set(spread, d.r * 0.12 * (1 - u), spread * (0.75 + 0.25 * Math.sin(i * 1.7)));
    }
    mesh.setMatrixAt(i, M4.compose(d.pos, Q, SC));
  });
  mesh.count = drops.length;
  mesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- every frame

/** Where each car was last frame, and the grains or drops it still owes (rates are not whole per frame). */
const last = new Map<THREE.Object3D, { p: THREE.Vector3; owed: Map<string, number> }>();

/** Every frame (loop.ts): throws up what the cars that move throw, and moves and fades the rest. */
export function updateTrail(dt: number): void {
  if (dt <= 0) return;
  const amount = settings.effects ? LEVELS[S.level].particles : 0;
  for (const o of carObjs.values()) {
    const rec = last.get(o) ?? { p: o.position.clone(), owed: new Map<string, number>() };
    last.set(o, rec);
    const speed = Math.hypot(o.position.x - rec.p.x, o.position.z - rec.p.z) / dt;
    rec.p.copy(o.position);
    if (!amount || !o.visible || o.userData.wreck || o.userData.jump) continue;
    const moving = speed > 0.3 ? Math.min(1, speed / DRIVE.speed) : 0;
    const flames = !!o.userData.flames;
    if (!moving && !flames) continue;
    const yaw = (o.userData.yaw ?? 0) as number;
    const size = o.userData.modelSize as THREE.Vector3 | undefined;
    const t: Thrower = {
      o, speed, fwd: new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
      halfW: (size?.z ?? SPACE * 0.4) / 2, ground: Math.max(TILE_T, ((o.userData.target as THREE.Vector3 | undefined)?.y ?? o.position.y)),
    };
    const len = (size?.x ?? SPACE * 0.6) / 2, height = (o.userData.height ?? 0.4) as number;
    /** How many of `key` are due this frame at `rate` per second. */
    const due = (key: string, rate: number): number => {
      const x = (rec.owed.get(key) ?? 0) + rate * amount * dt, n = Math.floor(x);
      rec.owed.set(key, x - n);
      return n;
    };
    if (moving) {
      const ground = (o.userData.ground ?? 'R') as Terrain;
      for (const name of T.ground[ground] ?? ['dust']) {
        const look = T.looks[name];
        if (look) for (let n = due(name, look.rate * moving); n > 0; n--) puff(t, look, len * 1.05, 0.03);
      }
      const pool = poolOf(ground);
      if (pool) for (let n = due(`liquid:${ground}`, pool.look.rate * moving); n > 0; n--) splash(t, pool, len * 0.85);
    }
    // A burning car: its flames go with it, from the roof, and on the move they stream out behind.
    if (flames) {
      for (let n = due('fire', T.looks.fire.rate * (0.35 + moving)); n > 0; n--) puff(t, T.looks.fire, len * 0.3, height * 1.05);
      for (let n = due('smoke', T.looks.smoke.rate * (0.4 + moving)); n > 0; n--) puff(t, T.looks.smoke, len * 0.5, height * 1.3);
    }
  }
  for (const gr of grains) {
    if (!gr.sp.visible) continue;
    gr.age += dt;
    const u = gr.age / gr.life;
    if (u >= 1) { gr.sp.visible = false; continue; }
    gr.vel.y -= gr.grav * dt;
    gr.vel.multiplyScalar(1 - Math.min(1, dt * 1.6));
    gr.sp.position.addScaledVector(gr.vel, dt);
    if (gr.sp.position.y < TILE_T) { gr.sp.position.y = TILE_T; gr.vel.set(0, 0, 0); }
    gr.sp.scale.setScalar(gr.size[0] + (gr.size[1] - gr.size[0]) * u);
    gr.sp.material.opacity = gr.alpha * Math.min(1, u * 6) * (1 - u);
  }
  for (const pool of pools.values()) updateDrops(pool, dt);
}
