// Dice as 3D objects dressed with the vector faces of src/view/vector/art.ts. One rounded cube
// per die; its six faces carry the die's six values in the order of the rules data
// (data/trv/game_base.json "dice"), so a rolled face index from the engine shows directly.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { dieSvg } from './vector/art';
import { svgTexture } from './texture';
import { faceUpQuaternion } from './pieces3d';

/** Face values of each die kind, as in the rules data. */
export type DiceFaces = Record<string, (string | number)[]>;

/** A 3D die. */
export interface Die3D {
  mesh: THREE.Mesh;
  kind: string;
  /** Index of the face that shows `value`, or -1. */
  faceOf: (value: string | number) => number;
  /** Rotation that shows `face` on top (+y) with the art's top towards `forward`. */
  orientation: (face: number, forward: THREE.Vector3) => THREE.Quaternion;
}

const geoCache = new Map<number, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial[]>();

/**
 * Makes one die of `kind` (movement dice take the crew `color`), `size` world units wide.
 * Face art is drawn with forward at the image top, so the direction die lines up with the
 * board when `orientation` gets the road's forward (rulebook p. 10).
 */
export function makeDie(faces: DiceFaces, kind: string, size: number, color?: string): Die3D {
  const list = faces[kind] ?? [1, 2, 3, 4, 5, 6];
  let geo = geoCache.get(size);
  if (!geo) { geo = new RoundedBoxGeometry(size, size, size, 3, size * 0.14); geoCache.set(size, geo); }
  const key = `${kind}|${color ?? ''}`;
  let mats = matCache.get(key);
  if (!mats) {
    mats = list.map(v => new THREE.MeshStandardMaterial({
      map: svgTexture(dieSvg({ kind, value: v, color, forward: 'up' }), 256), roughness: 0.35,
    }));
    matCache.set(key, mats);
  }
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  return {
    mesh, kind,
    faceOf: value => list.findIndex(v => String(v) === String(value)),
    orientation: (face, forward) => faceUpQuaternion(face, forward),
  };
}

/** Gives the die its own (cloned) materials, for per-die opacity. */
export function withOwnMaterials(d: Die3D): Die3D {
  d.mesh.material = (d.mesh.material as THREE.MeshStandardMaterial[]).map(m => m.clone());
  return d;
}
