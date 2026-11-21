// The Big Rig is one model made by the project owner (assets/big_rig/modelli/big_rig.glb, 2026-11-18,
// from data/trv/modelli/big_rig.json): the cab and two trailers in a row, nose toward -x. Here it
// is cut at its two hitch pins into the three sections the game moves on their own (src/view/rigchain.ts
// lays them as a hitched chain), each with its wheels cut out to roll.

import * as THREE from 'three';
import { splitWheels, type WheelSpec } from './models3d';

/** A section of the Big Rig, as the rules name them. */
export type RigPart = 'front' | 'mid' | 'rear';

/** Where the model is cut and where its wheels are, in the model's own coordinates (nose at -x, y up). */
export interface RigModelSpec {
  /** The two hitch pins along the model: cab to mid trailer, mid to rear trailer (x). */
  pins: [number, number];
  /** Each section's wheels. */
  wheels: Record<RigPart, WheelSpec[]>;
}

/** Hitch to hitch: the length of one section in model units (the mid trailer's, between its pins). */
export const rigSectionLength = (spec: RigModelSpec): number => spec.pins[1] - spec.pins[0];

/**
 * The middle of a section along the model (x): half a section from its hitch. The cab's is half a
 * section ahead of its pin (toward the nose, -x), the rear trailer's half a section behind its pin.
 */
export function rigSectionMiddle(spec: RigModelSpec, part: RigPart): number {
  const [a, b] = spec.pins, half = rigSectionLength(spec) / 2;
  return part === 'front' ? a - half : part === 'mid' ? (a + b) / 2 : b + half;
}

/** Which section a point of the model belongs to, by its place along the model. */
export function rigPartAt(spec: RigModelSpec, x: number): RigPart {
  return x < spec.pins[0] ? 'front' : x < spec.pins[1] ? 'mid' : 'rear';
}

/** Sets the bounding box and sphere of `geo` from the vertices its index uses (all, without one). */
function fitBounds(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position');
  if (!pos || !geo.index) return;
  const box = new THREE.Box3(), p = new THREE.Vector3();
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i++) box.expandByPoint(p.fromBufferAttribute(pos, idx[i]));
  if (box.isEmpty()) return;
  geo.boundingBox = box;
  geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
}

/**
 * Cuts the one-piece Big Rig into its three sections: each a copy of the model keeping the triangles
 * whose middle lies on its side of the pins, with its wheels cut out to roll (`splitWheels`). Done
 * once per loaded model; the copies are cached on it.
 */
export function cutRig(model: THREE.Object3D, spec: RigModelSpec): Record<RigPart, THREE.Object3D> {
  const cached = model.userData.rigCut as Record<RigPart, THREE.Object3D> | undefined;
  if (cached) return cached;
  model.updateMatrixWorld(true);
  const length = rigSectionLength(spec);
  const out = {} as Record<RigPart, THREE.Object3D>;
  for (const part of ['front', 'mid', 'rear'] as RigPart[]) {
    const copy = model.clone(true);
    copy.updateMatrixWorld(true);
    copy.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geo = mesh.geometry.clone();
      const pos = geo.getAttribute('position');
      const index = geo.index ? Array.from(geo.index.array) : Array.from({ length: pos.count }, (_, i) => i);
      const p = new THREE.Vector3(), keep: number[] = [];
      for (let t = 0; t < index.length; t += 3) {
        let x = 0, lo = Infinity, hi = -Infinity;
        for (let k = 0; k < 3; k++) {
          p.fromBufferAttribute(pos, index[t + k]).applyMatrix4(mesh.matrixWorld);
          x += p.x / 3;
          lo = Math.min(lo, p.x); hi = Math.max(hi, p.x);
        }
        // The base plate under the whole truck: its triangles are longer than a section.
        if (hi - lo > length) continue;
        if (rigPartAt(spec, x) === part) keep.push(index[t], index[t + 1], index[t + 2]);
      }
      geo.setIndex(keep);
      mesh.geometry = geo;
    });
    splitWheels(copy, spec.wheels[part]);
    // The copy keeps every vertex of the whole truck: its boxes must come from the triangles it
    // draws, or a section measures as the whole rig (its thumbnail came out tiny, 2026-11-18).
    copy.traverse(o => { if ((o as THREE.Mesh).isMesh) fitBounds((o as THREE.Mesh).geometry); });
    out[part] = copy;
  }
  model.userData.rigCut = out;
  return out;
}
