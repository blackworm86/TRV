// The player's movement dice on the table (in the map view under the road, in the chase
// view beside the car), and where they are on screen.
// The dice of the player the interface shows lie on the table, in a row just under the road:
// they are picked up and dragged onto a board or onto a car.

import * as THREE from 'three';
import { type Player } from '../game/trv/engine';
import { makeDie, withOwnMaterials, type Die3D } from '../view/dice3d';
import { AWAY, DIE_W, FX_SCALE, HAZ_SIZE, TRAY_SCALE, TRAY_Z, carObjs, chopperObjs, hazardObjs } from './board';
import { SPACE_W, chase } from './chase';
import { dieUsable } from './game';
import { drag, pointer, ray } from './input';
import { P } from './presentation';
import { Box, Round, clearOf } from './spots';
import { BOARD_X0, PITCH_W, TILE_T, TILE_W, camera, renderer, scene } from './stage';
import { settings } from './settings';
import { S } from './state';
import { $, FACES, cssPx } from './util';

export interface TableMyDie { d: Die3D; base: THREE.Vector3; q: THREE.Quaternion; glow: THREE.Mesh }
/** A soft round light, drawn under a die that can be played. */
export const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 18, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
export const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export let tableDice: TableMyDie[] = [];
export let tableDiceKey = '';
export let tableDiceState: { used: boolean[]; idle: boolean[] } = { used: [], idle: [] };
/**
 * Whether the player's dice lie on the table in the map view. With the owner's strip drawing they
 * are in the drawer behind the command board instead (dock.ts); the chase view keeps them by the car.
 */
export let diceOnTable = true;
export function setDiceOnTable(on: boolean): void { diceOnTable = on; }

/** Where die `i` of `n` rests: centred under the road, one die and a half apart. */
export function tableDieSpot(i: number, n: number): THREE.Vector3 {
  const step = DIE_W * TRAY_SCALE * 1.55;
  const cx = BOARD_X0 + PITCH_W + TILE_W / 2 - 1.6;
  return new THREE.Vector3(cx + (i - (n - 1) / 2) * step, DIE_W * TRAY_SCALE / 2, TRAY_Z);
}

/** Puts the player's dice on the table (rebuilt when the player or the values change). */
export function syncTableDice(me: Player, mine: boolean): void {
  const key = me.dice.length ? `${me.id}|${me.color}|${me.dice.join(',')}` : '';
  if (key !== tableDiceKey) {
    tableDiceKey = key;
    for (const t of tableDice) { scene.remove(t.d.mesh, t.glow); (t.glow.material as THREE.Material).dispose(); for (const m of t.d.mesh.material as THREE.Material[]) m.dispose(); }
    tableDice = me.dice.map((v, i) => {
      const d = withOwnMaterials(makeDie(FACES, 'movement', DIE_W, me.color));
      d.mesh.scale.setScalar(TRAY_SCALE);
      const base = tableDieSpot(i, me.dice.length);
      // A little turned each, as dice lie when rolled; the same turn every time it is drawn.
      const q = d.orientation(Math.max(0, d.faceOf(v)), AWAY)
        .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((i * 7) % 5 - 2) * 0.09));
      d.mesh.position.copy(base);
      d.mesh.quaternion.copy(q);
      d.mesh.castShadow = true;
      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
        map: glowTex, color: 0x4cff7a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      glow.scale.setScalar(DIE_W * TRAY_SCALE * 2.6);
      glow.position.set(base.x, 0.02, base.z);
      glow.visible = false;
      scene.add(d.mesh, glow);
      return { d, base, q, glow };
    });
  }
  tableDiceState = { used: [...me.used], idle: me.dice.map((_, i) => !mine || !dieUsable(i)) };
}

/**
 * In the chase view the player's dice still to play lie on the table beside the followed car (asked
 * by the user, 2026-11-17: real dice by the car, in handy spots, never through other pieces). They
 * fill free spots in a small block on the car's left, then on its right, a little ahead of it so
 * they stay above the boards; a spot is free when the table under the whole die is flat and clear
 * (no car, chopper, hazard, ramp or pit). Used dice leave the table. While the car stands still the
 * spots are looked for again every `every` seconds (pieces around it may change); the dice slide to
 * them. They never follow the car as it drives: a die is placed before the move. All lengths are in road spaces:
 * `size` the die's edge, `side` the gap from the car's middle to the block, `gap` between dice,
 * `ahead` how far ahead of the car the first row lies.
 */
export const CHASE_DICE = P.chaseDice;
export let diceSpots: { at: number; key: string; spots: THREE.Vector3[] } = { at: -1, key: '', spots: [] };

/**
 * Whether a die of half-size `half` can lie at (x, z): clear of every car and chopper (a circle as
 * wide as the model is long) and of every hazard token with what stands on it (flames, ramps, pits
 * hang on the tokens). Plain distance checks: casting rays at the models made the game crawl.
 */
export function freeTable(x: number, z: number, half: number): boolean {
  const rounds: Round[] = [];
  for (const o of [...carObjs.values(), ...chopperObjs.values()]) {
    if (!o.visible) continue;
    const size = o.userData.modelSize as THREE.Vector3 | undefined;
    rounds.push({ x: o.position.x, z: o.position.z, r: (size ? Math.max(size.x, size.z) : SPACE_W * 0.5) / 2 });
  }
  const boxes: Box[] = [];
  for (const h of hazardObjs.values()) {
    if (h.gone !== undefined) continue;
    const p = h.obj.group.position;
    boxes.push({ x: p.x, z: p.z, hx: HAZ_SIZE.length / 2, hz: HAZ_SIZE.depth / 2 });
  }
  return clearOf(x, z, half, rounds, boxes);
}

/** Where the dice lie by car `o` (one spot per die still to play), looked for again when needed. */
export function chaseDiceSpots(o: THREE.Object3D, n: number, now: number): THREE.Vector3[] {
  // The dice are placed before the car moves (asked by the user): while it drives, or while the
  // beats play, they stay where they are; they are laid out again once it is still.
  const key = `${chase}|${n}`;
  const goal = o.userData.target as THREE.Vector3 | undefined;
  const moving = S.playing || !!o.userData.jump || (!!goal && Math.hypot(goal.x - o.position.x, goal.z - o.position.z) > 0.02);
  if (key === diceSpots.key && (moving || now - diceSpots.at < CHASE_DICE.every)) return diceSpots.spots;
  const half = CHASE_DICE.size * SPACE_W * 0.6;
  const boards = innerHeight - cssPx('--bottom') - 8;
  const spots: THREE.Vector3[] = [];
  for (const side of [-1, 1]) {
    for (let c = 0; c < CHASE_DICE.cols && spots.length < n; c++) for (let r = 0; r < CHASE_DICE.rows && spots.length < n; r++) {
      const x = o.position.x + (CHASE_DICE.ahead + r * CHASE_DICE.gap) * SPACE_W;
      const z = o.position.z + side * (CHASE_DICE.side + c * CHASE_DICE.gap) * SPACE_W;
      if (!freeTable(x, z, half)) continue;
      const spot = new THREE.Vector3(x, TILE_T + CHASE_DICE.size * SPACE_W / 2, z);
      const q = spot.clone().project(camera);
      if ((1 - q.y) / 2 * innerHeight > boards || Math.abs(q.x) > 0.95) continue; // under the boards or off screen
      spots.push(spot);
    }
  }
  // Nowhere room for all of them together: whatever free spots there are, then in front of the car.
  while (spots.length < n) spots.push(o.position.clone().add(new THREE.Vector3((CHASE_DICE.ahead + 0.6 + spots.length * 0.1) * SPACE_W, TILE_T - o.position.y + CHASE_DICE.size * SPACE_W / 2, (spots.length - n / 2) * CHASE_DICE.gap * SPACE_W)));
  diceSpots = { at: now, key, spots };
  return spots;
}

/** Each frame: used dice fade, the selected die lifts and sways, the one being dragged dims. */
export function animTableDice(now: number, dt = 1 / 60): void {
  const car = chase ? carObjs.get(chase) : undefined;
  const live = tableDice.map((_, i) => !tableDiceState.used[i]);
  const spots = car ? chaseDiceSpots(car, live.filter(Boolean).length, now) : [];
  const chaseScale = CHASE_DICE.size * SPACE_W / DIE_W;
  let k = 0;
  tableDice.forEach((t, i) => {
    const sel = S.selDie === i && !tableDiceState.used[i];
    const mesh = t.d.mesh;
    let scale = TRAY_SCALE;
    if (car) {
      // On the table by the car: used dice are gone, the others slide to their spots.
      mesh.visible = live[i];
      if (!live[i]) { t.glow.visible = false; return; }
      const spot = spots[k++];
      const fresh = !mesh.userData.chaseOn;
      mesh.userData.chaseOn = true;
      mesh.position.lerp(spot, fresh ? 1 : Math.min(1, dt * CHASE_DICE.slide));
      if (fresh) mesh.position.copy(spot);
      mesh.quaternion.copy(t.q);
      scale = chaseScale;
    } else {
      // A die placed on a car or on the command board leaves the table (asked by the user, 2026-11-17).
      // During a shot of the new director the player's dice leave the picture: they would stand in its foreground.
      mesh.visible = diceOnTable && live[i] && !(S.shot && settings.director2);
      if (!mesh.visible) { t.glow.visible = false; return; }
      mesh.userData.chaseOn = false;
      mesh.position.copy(t.base);
      mesh.quaternion.copy(t.q);
    }
    mesh.scale.setScalar(scale);
    mesh.renderOrder = 0;
    mesh.castShadow = true;
    if (sel) {
      mesh.position.y += DIE_W * scale * (0.45 + 0.08 * Math.sin(now * 5));
      mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(now * 3) * 0.3));
    }
    // The dice still to play glow, pulsing, so the player sees they must be played.
    const glowing = !tableDiceState.used[i] && !tableDiceState.idle[i];
    t.glow.visible = glowing;
    t.glow.scale.setScalar(DIE_W * scale * 2.6);
    t.glow.position.set(mesh.position.x, car ? mesh.position.y - DIE_W * scale / 2 + 0.004 : 0.02, mesh.position.z);
    if (glowing) (t.glow.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(now * 4 + i * 0.6);
    const fade = tableDiceState.used[i] ? 0.2 : drag?.moved && drag.die === i ? 0.35 : 1;
    for (const m of mesh.material as THREE.MeshStandardMaterial[]) { m.transparent = fade < 1; m.opacity = fade; m.depthTest = true; }
  });
}

/** The index of the player's die under the pointer, or -1. */
export function tableDieAt(e: PointerEvent): number {
  if (!tableDice.length || (!diceOnTable && !chase)) return -1;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(tableDice.map(t => t.d.mesh).filter(m => m.visible), false)[0];
  return hit ? tableDice.findIndex(t => t.d.mesh === hit.object) : -1;
}

/** The dice row on screen (for placing the choices beside it), or null with no dice. */
/** Where the FX dice just rolled are on screen (their landing spots), or null when there are none. */
export function fxDiceRect(): { left: number; right: number; top: number; bottom: number } | null {
  if (!S.trayDice.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const half = DIE_W * FX_SCALE * 0.6;
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (const d of S.trayDice) for (const dx of [-half, half]) for (const dz of [-half, half]) for (const dy of [-half, half]) {
    const q = d.to.clone().add(new THREE.Vector3(dx, dy, dz)).project(camera);
    const x = rect.left + (q.x * 0.5 + 0.5) * rect.width, y = rect.top + (-q.y * 0.5 + 0.5) * rect.height;
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  return { left: l, right: r, top: t, bottom: b };
}

export function tableDiceRect(): { left: number; right: number; top: number; bottom: number } | null {
  if (!tableDice.length || (!diceOnTable && !chase)) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const half = DIE_W * TRAY_SCALE * 0.6;
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (const d of tableDice) for (const dx of [-half, half]) for (const dz of [-half, half]) {
    const q = d.base.clone().add(new THREE.Vector3(dx, 0, dz)).project(camera);
    const x = rect.left + (q.x * 0.5 + 0.5) * rect.width, y = rect.top + (-q.y * 0.5 + 0.5) * rect.height;
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  return { left: l, right: r, top: t, bottom: b };
}
