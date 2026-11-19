// How a destroyed vehicle leaves the table (asked by the user, 2026-11-19).
// - Blown up: the car goes to pieces. Its own model is cut into chunks that fly apart in the blast
//   and fall back, charred, in a small heap on the last space it stood on; a few small flames and a
//   wisp of dark smoke stay on the heap. The heap is scenery only: it is not a wreck, the rules do not
//   see it, and it rides on its road tile (it goes when the tile leaves the table).
// - Into a pit trap: the car drives over the hole, tips nose first and drops into it, and only then
//   the pit blows up. Nothing is left on the table.
// Timings and sizes: data/trv/presentation_base.json, `wreckage`.

import * as THREE from 'three';
import { TILE_COLS, type Frame, type Pos } from '../game/trv/engine';
import { flameCluster } from '../view/terrain/carnage3d';
import { effects } from './beats';
import { explode, word } from './effects';
import { P } from './presentation';
import { TILE_T, TILE_W, scene, tileSlots } from './stage';

const W = P.wreckage;
/** One road space, in world units. */
const SP = TILE_W / 8;

/** A chunk of a shattered car: its mesh, where it flies from and lands, how it turns. */
interface Chunk { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; fall: number; spin: THREE.Vector3; rest: THREE.Quaternion; q0: THREE.Quaternion }

/**
 * Cuts the meshes of `o` into chunks: each triangle goes to the cell of a small grid over the car
 * (length x height x width, in the car's own frame) its middle falls in. Positions come out in world
 * space, each chunk centred on its own middle. The car itself is not touched.
 */
function cut(o: THREE.Object3D): { mesh: THREE.Mesh; mid: THREE.Vector3 }[] {
  o.updateMatrixWorld(true);
  const toCar = o.matrixWorld.clone().invert();
  const [nx, ny, nz] = W.grid;
  const parts: { geo: THREE.BufferGeometry; mat: THREE.Material; local: THREE.Vector3[] }[] = [];
  const box = new THREE.Box3();
  o.traverse(c => {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry.getAttribute('position')) return;
    const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    const pos = geo.getAttribute('position');
    const local: THREE.Vector3[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const m = new THREE.Vector3();
      for (let k = 0; k < 3; k++) m.add(p.fromBufferAttribute(pos, i + k));
      m.multiplyScalar(1 / 3).applyMatrix4(toCar);
      local.push(m);
      box.expandByPoint(m);
    }
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    parts.push({ geo, mat, local });
  });
  if (box.isEmpty()) return [];
  const size = box.getSize(new THREE.Vector3()).max(new THREE.Vector3(1e-6, 1e-6, 1e-6));
  const cell = (m: THREE.Vector3): number => {
    const ix = Math.min(nx - 1, Math.floor((m.x - box.min.x) / size.x * nx));
    const iy = Math.min(ny - 1, Math.floor((m.y - box.min.y) / size.y * ny));
    const iz = Math.min(nz - 1, Math.floor((m.z - box.min.z) / size.z * nz));
    return (ix * ny + iy) * nz + iz;
  };
  const out: { mesh: THREE.Mesh; mid: THREE.Vector3 }[] = [];
  for (const part of parts) {
    const groups = new Map<number, number[]>();
    part.local.forEach((m, t) => { const k = cell(m); (groups.get(k) ?? groups.set(k, []).get(k)!).push(t); });
    // Charred: dark, glowing hot at first (the glow fades as the chunks fly, see shatter).
    const mat = (part.mat as THREE.MeshStandardMaterial).clone();
    if (mat.color) mat.color.multiplyScalar(W.char);
    if (mat.emissive) { mat.emissive.setRGB(1, 0.35, 0.05); mat.emissiveIntensity = W.glow; }
    for (const tris of groups.values()) {
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(part.geo.attributes)) {
        const a = attr as THREE.BufferAttribute, n = a.itemSize;
        const data = new Float32Array(tris.length * 3 * n);
        tris.forEach((t, j) => { for (let k = 0; k < 3 * n; k++) data[j * 3 * n + k] = a.array[t * 3 * n + k] as number; });
        geo.setAttribute(name, new THREE.BufferAttribute(data, n));
      }
      geo.computeBoundingBox();
      const mid = geo.boundingBox!.getCenter(new THREE.Vector3());
      geo.translate(-mid.x, -mid.y, -mid.z);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.copy(mid);
      out.push({ mesh, mid });
    }
    part.geo.dispose();
  }
  return out;
}

/** The heaps on the table, by the vehicle each was. */
const heaps = new Map<string, THREE.Group>();

/**
 * Car `o` (vehicle `id`) blows up at `hit` and goes to pieces; the pieces land in a heap at `spot`, on
 * space `at` (its last space), where a few small flames go on burning.
 */
export function shatter(id: string, o: THREE.Object3D, hit: THREE.Vector3, at: Pos | null, spot: THREE.Vector3): void {
  const chunks: Chunk[] = [];
  const centre = spot.clone().setY(TILE_T + W.ground * SP);
  const pieces = cut(o);
  scene.remove(o);
  for (const { mesh, mid } of pieces) {
    scene.add(mesh);
    // Lands somewhere on the heap: a small disc on the car's last space.
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * W.heap * SP;
    const to = centre.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 1.2, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 1.2));
    chunks.push({
      m: mesh, from: mid.clone(), to, fall: W.flight[0] + Math.random() * (W.flight[1] - W.flight[0]),
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(W.spin), rest, q0: mesh.quaternion.clone(),
    });
  }
  explode(hit, 1);
  word('BOOM!', hit, '#ff6a2a', true);
  const life = W.flight[1] + W.settle;
  const spin = new THREE.Quaternion();
  effects.push({ life, t: 0, step: u => {
    const t = u * life;
    for (const c of chunks) {
      const k = Math.min(1, t / c.fall);
      // Thrown up out of the blast and down onto the heap.
      c.m.position.lerpVectors(c.from, c.to, k);
      c.m.position.y += 4 * W.lift * SP * k * (1 - k);
      // Tumbling in the air, coming to rest as it lands; a small bounce after.
      if (k < 1) {
        spin.setFromEuler(new THREE.Euler(c.spin.x * t, c.spin.y * t, c.spin.z * t));
        c.m.quaternion.copy(c.q0.clone().multiply(spin).slerp(c.rest, Math.max(0, (k - 0.7) / 0.3)));
      } else {
        const b = t - c.fall;
        c.m.position.y = c.to.y + Math.abs(Math.sin(b * 14)) * Math.exp(-b * 9) * W.bounce * SP;
        c.m.quaternion.copy(c.rest);
      }
      const mat = c.m.material as THREE.MeshStandardMaterial;
      if (mat.emissive) mat.emissiveIntensity = W.glow * Math.max(0, 1 - t / W.cool);
    }
    if (u < 1) return;
    // The heap stays on its tile, with its flames: scenery that rides away with the road.
    const tile = at ? tileSlots[Math.floor(at.c / TILE_COLS)] ?? null : null;
    const heap = new THREE.Group();
    (tile ?? scene).add(heap);
    for (const c of chunks) heap.attach(c.m);
    const fire = flameCluster(W.flames * SP, (id.length * 97 + id.charCodeAt(id.length - 1)) >>> 0);
    fire.position.copy(centre);
    heap.attach(fire);
    heaps.get(id)?.removeFromParent();
    heaps.set(id, heap);
  } });
}

/**
 * Car `o` drives onto the pit trap at `pit` (from wherever it stands), tips nose first and drops into
 * the hole; then the pit blows up.
 */
export function pitFall(o: THREE.Object3D, pit: THREE.Vector3): void {
  const from = o.position.clone();
  const over = pit.clone().setY(from.y);
  const yaw = o.rotation.y;
  const life = W.pit.roll + W.pit.drop + W.pit.after;
  let blown = false;
  effects.push({ life, t: 0, step: u => {
    const t = u * life;
    if (t < W.pit.roll) {
      // Onto the hole.
      const k = t / W.pit.roll;
      o.position.lerpVectors(from, over, k * k * (3 - 2 * k));
      return;
    }
    const d = Math.min(1, (t - W.pit.roll) / W.pit.drop);
    // Nose first (the nose is at +x of the piece), down into the dark.
    o.position.copy(over).setY(over.y - d * d * W.pit.depth * SP);
    o.rotation.set(0, yaw, -d * W.pit.tip);
    if (d >= 1 && !blown) {
      blown = true;
      scene.remove(o);
      explode(pit.clone().setY(TILE_T), W.pit.blast);
      word('BOOM!', pit, '#ff6a2a', true);
    }
  } });
}

/**
 * Drops the heaps that should not be on the table (called whenever the table is drawn): one left by a
 * vehicle that is no longer eliminated (an undo, another game), or whose road tile has left the table.
 */
export function pruneHeaps(snap: Frame['snap'] | null): void {
  for (const [id, heap] of heaps) {
    const v = snap?.vehicles.find(x => x.id === id);
    const holder = heap.parent;
    const onTable = holder === scene || (!!holder && tileSlots.includes(holder as THREE.Group) && !!holder.parent);
    if (!v || v.status !== 'elim' || !onTable) { heap.removeFromParent(); heaps.delete(id); }
  }
}
