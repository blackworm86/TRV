import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { planThrow, type Bumper, type ThrowKnobs } from '../../../src/view/dice-throw';

const W = 0.8; // the die's width
const K: ThrowKnobs = { peak: 1.6, bounce: [0.45, 0.16], rollQuarters: 2, spin: 1.5, wobble: 0.6, ease: 1.8, reach: 5, detour: 3, hitHeight: 0.6, tossTurns: 2 };
const V = (x: number, z: number, y = W / 2): THREE.Vector3 => new THREE.Vector3(x, y, z);
const FACE = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI));
/** A steady stream of numbers, so every run plans the same throw. */
const steady = (): (() => number) => { let n = 0; return () => ((n += 0.37) % 1); };
const STEPS = 200;
/** The die along a throw, sampled from start to rest. */
function sample(t: ReturnType<typeof planThrow>): { pos: THREE.Vector3; quat: THREE.Quaternion }[] {
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    t.at(i / STEPS, pos, quat);
    return { pos, quat };
  });
}

describe('a die thrown on the table', () => {
  const from = V(0, 6), to = V(8, 0);

  it('starts where it lay and stops exactly on its spot, showing the face it rolled', () => {
    const path = sample(planThrow(from, to, FACE, W, [], steady(), K));
    expect(path[0].pos.distanceTo(from)).toBeLessThan(1e-6);
    expect(path[STEPS].pos.distanceTo(to)).toBeLessThan(1e-6);
    expect(path[STEPS].quat.angleTo(FACE)).toBeLessThan(1e-6);
  });
  it('rolls: it turns over several times on the way, and never sinks into the table', () => {
    const path = sample(planThrow(from, to, FACE, W, [], steady(), K));
    let turned = 0;
    for (let i = 1; i < path.length; i++) turned += path[i].quat.angleTo(path[i - 1].quat);
    expect(turned).toBeGreaterThan(Math.PI * 4);
    for (const p of path) expect(p.pos.y).toBeGreaterThanOrEqual(W / 2 - 1e-6);
  });
  it('bounces: it leaves the table and comes down more than once before it rolls to a stop', () => {
    const path = sample(planThrow(from, to, FACE, W, [], steady(), K));
    let landings = 0;
    for (let i = 1; i < path.length; i++) if (path[i - 1].pos.y > W / 2 + 0.02 && path[i].pos.y <= W / 2 + 0.02) landings++;
    expect(landings).toBeGreaterThanOrEqual(3);
  });
  it('tumbles its last stretch on its edges, a whole number of quarter turns', () => {
    const t = planThrow(from, to, FACE, W, [], steady(), K);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    // One die's width before the end it lies flat too: a quarter turn from the face it will show.
    const u = 1 - Math.pow(W / Math.hypot(8, 6), 1 / K.ease);
    t.at(u, pos, quat);
    expect(pos.y).toBeCloseTo(W / 2, 5);
    expect(quat.angleTo(FACE)).toBeCloseTo(Math.PI / 2, 4);
  });
});

describe('a die striking a piece', () => {
  const from = V(0, 6), to = V(6, 0);
  const car: Bumper = { x: 6, z: 3, r: 0.6 };

  it('glances off a piece standing by its way, touching its side', () => {
    const t = planThrow(from, to, FACE, W, [car], steady(), K);
    expect(t.hit).not.toBeNull();
    expect(Math.hypot(t.hit!.x - car.x, t.hit!.z - car.z)).toBeCloseTo(car.r + W / 2, 5);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    t.at(t.hitAt!, pos, quat);
    expect(Math.hypot(pos.x - t.hit!.x, pos.z - t.hit!.z)).toBeLessThan(1e-6);
  });
  it('never goes through the piece it strikes, and still ends on its spot with its face', () => {
    const path = sample(planThrow(from, to, FACE, W, [car], steady(), K));
    for (const p of path) expect(Math.hypot(p.pos.x - car.x, p.pos.z - car.z)).toBeGreaterThanOrEqual(car.r + W / 2 - 1e-6);
    expect(path[STEPS].pos.distanceTo(to)).toBeLessThan(1e-6);
    expect(path[STEPS].quat.angleTo(FACE)).toBeLessThan(1e-6);
  });
  it('leaves alone a piece standing right in its way (it flies over it), or far off', () => {
    expect(planThrow(from, to, FACE, W, [{ x: 3, z: 3, r: 0.6 }], steady(), K).hit).toBeNull();
    expect(planThrow(from, to, FACE, W, [{ x: -6, z: -2, r: 0.6 }], steady(), K).hit).toBeNull();
  });
});

describe('a die thrown again where it lies', () => {
  it('goes up turning and comes down on the same spot with its new face', () => {
    const at = V(3, 1);
    const path = sample(planThrow(at, at.clone(), FACE, W, [{ x: 4, z: 1, r: 0.5 }], steady(), K));
    for (const p of path) expect(Math.hypot(p.pos.x - at.x, p.pos.z - at.z)).toBeLessThan(1e-6);
    expect(Math.max(...path.map(p => p.pos.y))).toBeGreaterThan(at.y + W * 0.8);
    expect(path[STEPS].quat.angleTo(FACE)).toBeLessThan(1e-6);
  });
});
