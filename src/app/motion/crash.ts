// A vehicle destroyed (design/gdd/vehicle-motion.md §2, crash): the parts it is made of come off
// and fly, then bounce and come to rest on the ground; the body stays where it was, charred. With a
// model in parts these are its own parts (the wheels, the turret, the fork: the descriptor's
// detachable parts); an old one-piece model keeps today's grid cuts (app/wreckage.ts).
// Values in `motion.crash`. Pure apart from the scene graph it is given (unit-tested in tests/unit/motion/).

import * as THREE from 'three';
import { P } from '../presentation';
import type { PartsDescriptor } from '../../view/vehicle-rig';
import type { MotionPlan } from './plan';

const C = P.motion.crash;

/** One flying part: its node (now a child of the scene), its speed and spin, and whether it has come to rest. */
export interface Debris { node: THREE.Object3D; v: THREE.Vector3; axis: THREE.Vector3; spin: number; rest: boolean }

/** A crash in progress. */
export interface Crash { debris: Debris[]; plan: MotionPlan; t: number }

/** A number in [0, 1) from a seed and an index: the same crash always throws its parts the same way. */
function rand(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** The parts of a descriptor that can come off: the wheels, the turrets (with their guns), the fork. */
export function detachable(d: PartsDescriptor): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  for (const w of d.wheels) out.push(w.roll);
  for (const t of d.turrets) { const n = t.turret ?? t.gun; if (n) out.push(n); }
  if (d.fork) out.push(d.fork);
  // A part already inside another one goes with it (the front wheel of a motorcycle, on its fork).
  return out.filter(n => !out.some(o => o !== n && isInside(n, o)));
}
function isInside(n: THREE.Object3D, o: THREE.Object3D): boolean {
  for (let p = n.parent; p; p = p.parent) if (p === o) return true;
  return false;
}

/**
 * Starts the crash of vehicle `root`: its detachable parts move to `world` (keeping where they are)
 * and fly away from the vehicle's middle. `space`: a road space, world units; `seed`: which way each goes.
 */
export function makeCrash(root: THREE.Object3D, d: PartsDescriptor, world: THREE.Object3D, space: number, seed: number): Crash {
  root.updateMatrixWorld(true);
  const mid = root.getWorldPosition(new THREE.Vector3());
  const debris = detachable(d).map((node, i) => {
    world.attach(node);
    const at = node.getWorldPosition(new THREE.Vector3());
    const out = at.clone().sub(mid).setY(0);
    if (out.lengthSq() < 1e-8) out.set(rand(seed, i) - 0.5, 0, rand(seed, i + 7) - 0.5);
    out.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (rand(seed, i + 3) - 0.5) * 0.8);
    const speed = (C.speed[0] + (C.speed[1] - C.speed[0]) * rand(seed, i + 11)) * space;
    const up = (C.up[0] + (C.up[1] - C.up[0]) * rand(seed, i + 13)) * space;
    const axis = new THREE.Vector3(rand(seed, i + 17) - 0.5, rand(seed, i + 19) - 0.5, rand(seed, i + 23) - 0.5).normalize();
    return { node, v: out.multiplyScalar(speed).setY(up), axis, spin: C.spin * (0.4 + 0.6 * rand(seed, i + 29)), rest: false };
  });
  return { debris, t: 0, plan: { kind: 'crash', seconds: C.seconds, moments: [{ name: 'impact', at: 0 }, { name: 'end', at: C.seconds }] } };
}

/**
 * One frame of a crash: each part flies under gravity, spinning, and bounces off the ground at
 * `groundAt(x, z)` (world height) until it rests. `space`: a road space, world units. `done` at the plan's end.
 */
export function stepCrash(c: Crash, dt: number, space: number, groundAt: (x: number, z: number) => number): { done: boolean } {
  c.t = Math.min(c.plan.seconds, c.t + dt);
  const g = C.gravity * space;
  for (const b of c.debris) {
    if (b.rest) continue;
    b.v.y -= g * dt;
    b.node.position.addScaledVector(b.v, dt);
    b.node.rotateOnWorldAxis(b.axis, b.spin * dt);
    const floor = groundAt(b.node.position.x, b.node.position.z);
    if (b.node.position.y < floor) {
      b.node.position.y = floor;
      b.v.y = -b.v.y * C.bounce;
      b.v.x *= 0.6; b.v.z *= 0.6;
      b.spin *= 0.6;
      if (Math.abs(b.v.y) < 0.25 * space) b.rest = true;
    }
  }
  // At the end whatever still moves lies down where it is.
  if (c.t >= c.plan.seconds) for (const b of c.debris) { b.rest = true; b.node.position.y = Math.max(b.node.position.y, groundAt(b.node.position.x, b.node.position.z)); }
  return { done: c.t >= c.plan.seconds };
}

/** Turns the body's own materials to char (`motion.crash.char`): the burnt shell left behind. */
export function char(body: THREE.Object3D): void {
  const burnt = new THREE.Color(C.char);
  body.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.color.lerp(burnt, 0.8);
    mat.roughness = 1;
    m.material = mat;
  });
}
