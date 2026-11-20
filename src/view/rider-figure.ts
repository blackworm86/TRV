// The motorcycle rider's stand-in figure (asked by the user, 2026-11-20): a jointed figurine of simple
// pieces, each named after its bone in the crew's skeleton (design/art/modelli-strutturati.md §5.4):
// hips, chest, head, upper_arm_L, lower_arm_L, hand_L, thigh_L, shin_L, boot_L and the right ones.
// (The boots are `boot_*`, not `foot_*`, which is the name of the footrests on the bike.)
// It is placed every frame on the joints of app/motion/rider.ts; the rider generated with Meshy
// (design/art/moto-pilota-prompts.md) will take its place on the same joints. Seat frame, metres.

import * as THREE from 'three';
import type { P3, RiderJoints, RiderPose } from '../app/motion/rider';

/** The figure's colours: jacket, trousers, boots and gloves, skin, goggles, the uzi. */
const LOOK = { jacket: '#3b2b21', trousers: '#4b4236', boots: '#1d1b19', skin: '#c99a76', goggles: '#9fd3c7', gun: '#2b2d2f' };

const v = (p: P3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);
const UP = new THREE.Vector3(0, 1, 0);

/** A piece of unit length along +y from its origin, stretched to its bone each frame. */
function bone(name: string, r: number, mat: THREE.Material): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 1, 10), mat);
  m.position.y = 0.5;
  m.castShadow = true;
  o.add(m);
  return o;
}

/** A piece of fixed shape set at a joint, turned by the body's frame. */
function block(name: string, ...meshes: THREE.Mesh[]): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  for (const m of meshes) { m.castShadow = true; o.add(m); }
  return o;
}

/**
 * Builds the figure, its helmet and shoulders in the team's colour `team`. The uzi (`uzi`) is in the
 * left hand and shows only while it fires.
 */
export function buildRider(team: string): THREE.Group {
  const mat = (c: string, metal = 0.1): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: metal });
  const jacket = mat(LOOK.jacket), trousers = mat(LOOK.trousers), boots = mat(LOOK.boots), teamMat = mat(team, 0.2);
  const g = new THREE.Group();
  g.name = 'rider';
  // A box `w` across (z), `h` high (y), `d` deep (x), its middle `y` up its piece.
  const box = (w: number, h: number, d: number, m: THREE.Material, y = 0): THREE.Mesh => { const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), m); b.position.set(0, y, 0); return b; };
  g.add(block('hips', box(0.34, 0.16, 0.24, trousers)));
  g.add(block('chest', box(0.4, 0.5, 0.24, jacket, 0.25), box(0.46, 0.1, 0.26, teamMat, 0.46)));
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), teamMat);
  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), mat(LOOK.goggles, 0.6));
  goggles.position.set(0.11, 0.01, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1), mat(LOOK.skin));
  neck.position.y = -0.13;
  g.add(block('head', helmet, goggles, neck));
  for (const s of ['L', 'R']) {
    g.add(bone(`upper_arm_${s}`, 0.055, jacket), bone(`lower_arm_${s}`, 0.05, jacket));
    g.add(block(`hand_${s}`, new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), boots)));
    g.add(bone(`thigh_${s}`, 0.075, trousers), bone(`shin_${s}`, 0.065, trousers));
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.11), boots);
    boot.position.set(0.05, -0.02, 0);
    g.add(block(`boot_${s}`, boot));
  }
  // The uzi: its grip at the hand, its barrel along +x of its piece.
  const gun = mat(LOOK.gun, 0.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.05), gun);
  body.position.set(0.08, 0.06, 0);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.045), gun);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1).rotateZ(Math.PI / 2), gun);
  barrel.position.set(0.25, 0.07, 0);
  const muzzle = new THREE.Object3D();
  muzzle.name = 'uzi_muzzle';
  muzzle.position.set(0.3, 0.07, 0);
  const uzi = block('uzi', body, grip, barrel);
  uzi.add(muzzle);
  uzi.visible = false;
  g.add(uzi);
  return g;
}

/** Stretches piece `name` of `g` from `a` to `b`. */
function span(g: THREE.Object3D, name: string, a: P3, b: P3): void {
  const o = g.getObjectByName(name)!;
  const d = v(b).sub(v(a));
  o.position.copy(v(a));
  o.quaternion.setFromUnitVectors(UP, d.clone().normalize());
  o.scale.set(1, Math.max(1e-3, d.length()), 1);
}

/**
 * Places the figure `g` (a child of the seat) on the joints `j` of pose `p`. `uziAt`: where the uzi
 * points (seat frame), while it fires.
 */
export function placeRider(g: THREE.Object3D, j: RiderJoints, p: RiderPose, uziAt?: P3): void {
  const body = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(j.fwd), v(j.up), v(j.right)));
  const at = (name: string, p3: P3, q: THREE.Quaternion): void => {
    const o = g.getObjectByName(name)!;
    o.position.copy(v(p3));
    o.quaternion.copy(q);
  };
  at('hips', j.hips, body);
  at('chest', j.hips, body);
  // The head on the chest, turned back toward level and toward the road (roll, turn, then pitch).
  at('head', j.head, body.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.headRoll, p.headTurn, p.headPitch, 'XYZ'))));
  for (const s of ['L', 'R'] as const) {
    span(g, `upper_arm_${s}`, j[`shoulder${s}`], j[`elbow${s}`]);
    span(g, `lower_arm_${s}`, j[`elbow${s}`], j[`hand${s}`]);
    at(`hand_${s}`, j[`hand${s}`], body);
    span(g, `thigh_${s}`, j[`hip${s}`], j[`knee${s}`]);
    span(g, `shin_${s}`, j[`knee${s}`], j[`foot${s}`]);
    // The boot flat on its footrest, toes along the bike.
    at(`boot_${s}`, j[`foot${s}`], new THREE.Quaternion());
  }
  const uzi = g.getObjectByName('uzi')!;
  uzi.visible = p.uzi && !!uziAt;
  if (uzi.visible) {
    uzi.position.copy(v(j.handL));
    uzi.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), v(uziAt!).sub(v(j.handL)).normalize());
  }
}
