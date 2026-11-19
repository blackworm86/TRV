// A vehicle's box and its centre of mass, for the motions that tilt it (jumps, and later pushes,
// flips and crashes). `space` is a road space's length in world units. Pure: no page, no scene.

import * as THREE from 'three';

/** A car's box: half length, height, half width (world units); the origin is under its middle. */
export function carBox(o: THREE.Object3D, space: number): { half: number; high: number; halfW: number } {
  const size = o.userData.modelSize as THREE.Vector3 | undefined;
  return { half: (size?.x ?? space * 0.6) / 2, high: size?.y ?? space * 0.25, halfW: (size?.z ?? space * 0.3) / 2 };
}
/** From a car's origin (under its middle) to its centre of mass, half its height up, for a tilt. */
export function comOffset(o: THREE.Object3D, pitch: number, roll: number, space: number): THREE.Vector3 {
  return new THREE.Vector3(0, carBox(o, space).high / 2, 0).applyEuler(new THREE.Euler(roll, 0, pitch, 'YXZ'));
}
/** Puts the car so that its centre of mass is at `com`, with the rotation it has now. */
export function placeByCom(o: THREE.Object3D, com: THREE.Vector3, space: number): void {
  o.position.copy(com).sub(new THREE.Vector3(0, carBox(o, space).high / 2, 0).applyQuaternion(o.quaternion));
}
/** World height of the lowest corner of the car's box, as the car stands now. */
export function lowestCorner(o: THREE.Object3D, space: number): number {
  const { half, high, halfW } = carBox(o, space);
  let low = Infinity;
  const c = new THREE.Vector3();
  for (const x of [-half, half]) for (const y of [0, high]) for (const z of [-halfW, halfW]) {
    c.set(x, y, z).applyQuaternion(o.quaternion);
    low = Math.min(low, o.position.y + c.y);
  }
  return low;
}
