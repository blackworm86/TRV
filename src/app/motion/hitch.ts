// The Big Rig's trailers on their hitches (design/gdd/vehicle-motion.md; the naming contract's
// `hitch_front` and `hitch_rear`, design/art/modelli-strutturati.md §4): each trailer is pulled by its
// front hitch toward the rear hitch of the piece ahead, and turns toward the pull, as a real trailer
// follows its tractor: it cuts the corners a little and comes into line again on the straight.
// It never turns more than `motion.tow.max_angle` from the piece ahead.
// Pure apart from the node it places (unit-tested in tests/unit/motion/).

import * as THREE from 'three';
import { P } from '../presentation';

/** Heading difference wrapped to (-π, π]. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** How far ahead of its origin a trailer's front hitch is (world units, along its nose). */
export function hitchReach(trailer: THREE.Object3D, hitchFront: THREE.Object3D): number {
  trailer.updateMatrixWorld(true);
  const local = trailer.worldToLocal(hitchFront.getWorldPosition(new THREE.Vector3()));
  return local.x * trailer.scale.x;
}

/**
 * One frame of towing: places `trailer` (its x and z, and its heading) so its front hitch, `reach`
 * ahead of its origin, is on `pull` (the world position of the piece ahead's rear hitch), heading
 * toward it from where it was. `aheadYaw`: the heading of the piece ahead. Returns the trailer's heading.
 */
export function tow(trailer: THREE.Object3D, pull: THREE.Vector3, reach: number, aheadYaw: number): number {
  const dx = pull.x - trailer.position.x, dz = pull.z - trailer.position.z;
  let yaw = dx * dx + dz * dz > 1e-12 ? Math.atan2(-dz, dx) : trailer.rotation.y;
  const max = P.motion.tow.maxAngle;
  yaw = aheadYaw + Math.max(-max, Math.min(max, wrap(yaw - aheadYaw)));
  trailer.position.x = pull.x - Math.cos(yaw) * reach;
  trailer.position.z = pull.z + Math.sin(yaw) * reach;
  trailer.rotation.y = yaw;
  return yaw;
}
