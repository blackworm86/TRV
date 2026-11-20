// The test vehicles of the integration plan (docs/piano-integrazione-veicoli.md): models built in
// code from simple shapes, one colour per part, with the node names of the naming contract
// (design/art/modelli-strutturati.md §4), so the parts descriptor (vehicle-rig.ts) reads them as it
// will read a real GLB. Each one is described by its assembly sheet (§9) in assets/<game>/modelli/schede/.
// The same builder mounts a real vehicle from its parts (2026-11-20, the Big Rig): a part whose
// `source` is a model file takes that model, placed by the sheet's `mesh`, instead of simple shapes.

import * as THREE from 'three';

type V3 = [number, number, number];

/** One simple shape of a part (see the `_note` of a sheet). */
export interface SheetShape {
  box?: V3;
  /** Cylinder: radius and length along `axis`. */
  cyl?: [number, number];
  /** Torus: radius and tube thickness, around `axis`. */
  ring?: [number, number];
  sphere?: number;
  /** Open frame of bars `bar` thick: four posts and the top edges. */
  cage?: V3;
  bar?: number;
  axis?: 'x' | 'y' | 'z';
  /** Centre of the shape in its part's frame. */
  at?: V3;
  color: string;
}

/**
 * One axle of a sheet's wheel entry. `track`: distance of each wheel from the middle line; `sides`:
 * its wheels (L and R by default, C for one wheel on the middle line, as on a motorcycle); `parent`:
 * the node it hangs from when not the root (a motorcycle's fork), its `x` still measured from the root.
 */
export interface SheetAxle { x: number; track: number; steer: boolean; drive?: boolean; max?: number; radius: number; travel: [number, number]; sides?: ('L' | 'R' | 'C')[]; parent?: string }

/**
 * How a part's own model sits in its node: scaled (model units to the sheet's metres), turned about y
 * (the generated models have their nose toward -x, the sheets toward +x), then moved.
 */
export interface SheetMesh { scale: number; yaw?: number; at?: V3; squash?: SheetSquash }

/**
 * Shortens a stretch of a part's model along its own x (model units, before `scale` and `yaw`): the
 * points between `from` and `to` are drawn toward `from` by `scale` (0.5 halves the stretch), those
 * beyond `to` follow in one piece, keeping their shape. `lift` raises the far end by that much, the
 * stretch sloping up to it. For a tow bar generated too long: its ring keeps its shape and comes
 * nearer, and up to the pin it hooks on.
 */
export interface SheetSquash { from: number; to: number; scale: number; lift?: number }

/** Where `squash` puts a point of the model (x and y; z never changes). */
export function squashed(x: number, y: number, q: SheetSquash): [number, number] {
  const t = (x - q.from) / (q.to - q.from);
  if (t <= 0) return [x, y];
  const lift = q.lift ?? 0;
  if (t >= 1) return [x + (q.to - q.from) * (q.scale - 1), y + lift];
  return [q.from + (x - q.from) * q.scale, y + lift * t];
}

/** A part of a sheet: a node, where it hangs, its shapes; any other key becomes the node's extras. */
export interface SheetPart {
  node: string;
  /** `proc`: built from `shapes`; a file name: that model, when the builder is given it (`sources`). */
  source?: string;
  parent?: string;
  pivot?: V3;
  shapes?: SheetShape[];
  mesh?: SheetMesh;
  /** Only on the `wheel` entry: tyre width and the axles. */
  width?: number;
  axles?: SheetAxle[];
  [extra: string]: unknown;
}

/** A crew place (§5.1): a node with its extras. */
export interface SheetSeat { node: string; parent?: string; at: V3; role: string; pose: string; operates?: string; visible?: string; exit?: string; clear?: V3 }

/** An assembly sheet (§9), as the test vehicles use it. */
export interface VehicleSheet {
  id: string;
  out?: string;
  /** Real length, metres. */
  length_m: number;
  /** Length on the table, mm. */
  show_mm: number;
  capabilities: string[];
  parts: SheetPart[];
  seats?: SheetSeat[];
}

/** Keys of a part that are not extras. */
const RESERVED = new Set(['node', 'source', 'parent', 'pivot', 'at', 'shapes', 'axles', 'width', 'mesh']);
const TYRE = '#262626', HUB = '#b9b9b9', STRIPE = '#f2d25c', STRUT = '#d83c3c', KNUCKLE = '#8a5cd8', DUMMY = '#d9d4cc';

/** One material per colour, shared by the whole vehicle. */
function materials(): (color: string) => THREE.MeshStandardMaterial {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  return color => {
    let m = cache.get(color);
    if (!m) cache.set(color, m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15 }));
    return m;
  };
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, at: V3 = [0, 0, 0]): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A cylinder or torus geometry turned to lie along `axis` (three.js builds cylinders along y, tori around z). */
function along(geo: THREE.BufferGeometry, axis: 'x' | 'y' | 'z', builtAlong: 'y' | 'z'): THREE.BufferGeometry {
  if (axis === builtAlong) return geo;
  if (axis === 'x') return builtAlong === 'y' ? geo.rotateZ(Math.PI / 2) : geo.rotateY(Math.PI / 2);
  return geo.rotateX(Math.PI / 2);
}

/** The meshes of one shape. */
function shapeMeshes(s: SheetShape, mat: (c: string) => THREE.MeshStandardMaterial): THREE.Mesh[] {
  const m = mat(s.color), at = s.at ?? [0, 0, 0], axis = s.axis ?? 'y';
  if (s.box) return [mesh(new THREE.BoxGeometry(...s.box), m, at)];
  if (s.cyl) return [mesh(along(new THREE.CylinderGeometry(s.cyl[0], s.cyl[0], s.cyl[1], 20), axis, 'y'), m, at)];
  if (s.ring) return [mesh(along(new THREE.TorusGeometry(s.ring[0], s.ring[1], 8, 28), axis, 'z'), m, at)];
  if (s.sphere) return [mesh(new THREE.SphereGeometry(s.sphere, 16, 12), m, at)];
  if (s.cage) {
    const [x, y, z] = s.cage, b = s.bar ?? 0.05, out: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(mesh(new THREE.BoxGeometry(b, y, b), m, [at[0] + sx * x / 2, at[1], at[2] + sz * z / 2]));
    for (const sz of [-1, 1]) out.push(mesh(new THREE.BoxGeometry(x, b, b), m, [at[0], at[1] + y / 2, at[2] + sz * z / 2]));
    for (const sx of [-1, 1]) out.push(mesh(new THREE.BoxGeometry(b, b, z), m, [at[0] + sx * x / 2, at[1] + y / 2, at[2]]));
    return out;
  }
  return [];
}

/** A pivot node with its extras and, under it, `<name>_mesh` holding its shapes. */
function pivotNode(name: string, pivot: V3 | undefined, extras: Record<string, unknown>, shapes: SheetShape[] | undefined, mat: (c: string) => THREE.MeshStandardMaterial): THREE.Group {
  const n = new THREE.Group();
  n.name = name;
  if (pivot) n.position.set(...pivot);
  Object.assign(n.userData, extras);
  if (shapes?.length) {
    const g = new THREE.Group();
    g.name = `${name}_mesh`;
    for (const s of shapes) for (const m of shapeMeshes(s, mat)) g.add(m);
    n.add(g);
  }
  return n;
}

/** A copy of a part's model placed as its sheet says, in a group named `<node>_mesh`. */
function modelMesh(name: string, src: THREE.Object3D, m: SheetMesh): THREE.Group {
  const g = new THREE.Group();
  g.name = `${name}_mesh`;
  const held = new THREE.Group();
  const copy = src.clone(true);
  const q = m.squash;
  // Its own geometry: the model it is copied from is shared by every vehicle made of it.
  if (q) copy.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry.clone(), pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const [x, y] = squashed(pos.getX(i), pos.getY(i), q);
      pos.setXY(i, x, y);
    }
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    mesh.geometry = geo;
  });
  held.add(copy);
  held.scale.setScalar(m.scale);
  held.rotation.y = m.yaw ?? 0;
  held.position.set(...(m.at ?? [0, 0, 0]));
  g.add(held);
  return g;
}

/**
 * A copy of the wheel model for one wheel: its middle on the wheel's node, as large as `radius`,
 * its hub outward (the model's hub faces +z, the right side of a vehicle with its nose toward +x).
 */
function wheelMesh(name: string, src: THREE.Object3D, radius: number, side: 'L' | 'R' | 'C'): THREE.Group {
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const k = radius / (Math.max(size.x, size.y) / 2);
  const copy = src.clone(true);
  copy.position.copy(mid).multiplyScalar(-1);
  return modelMesh(name, new THREE.Group().add(copy), { scale: k, yaw: side === 'L' ? Math.PI : 0 });
}

/** The wheels of a sheet: axle_N → susp_N{L,R} → steer_N{L,R} (steering axles) → wheel_N{L,R}. */
function wheels(root: THREE.Object3D, part: SheetPart, mat: (c: string) => THREE.MeshStandardMaterial, src?: THREE.Object3D): void {
  const w = part.width ?? 0.3;
  (part.axles ?? []).forEach((a, i) => {
    const axle = pivotNode(`axle_${i}`, [a.x, a.radius, 0], { steer: a.steer, drive: a.drive ?? false }, undefined, mat);
    root.add(axle);
    if (a.parent) {
      const p = root.getObjectByName(a.parent);
      if (!p) throw new Error(`asse ${i}: il genitore ${a.parent} non c'è ancora`);
      root.updateMatrixWorld(true);
      p.attach(axle);
    }
    for (const side of a.sides ?? ['L', 'R'] as const) {
      const z = side === 'L' ? -a.track : side === 'R' ? a.track : 0;
      // The strut on the inner side of the wheel (on a middle wheel, on its left).
      const inSide = side === 'R' ? -1 : 1;
      // A real wheel has no coloured strut, knuckle or stripe: those show what moves on a test vehicle.
      const susp = pivotNode(`susp_${i}${side}`, [0, 0, z], { travel: a.travel },
        src ? undefined : [{ box: [0.06, 0.4, 0.06], at: [0, 0.22, inSide * w * 0.7 * (side === 'C' ? -1 : 1)], color: STRUT }], mat);
      axle.add(susp);
      let inner: THREE.Object3D = susp;
      if (a.steer) {
        const steer = pivotNode(`steer_${i}${side}`, undefined, { max: a.max ?? 0.5 },
          src ? undefined : [{ box: [0.14, 0.14, 0.08], at: [0, 0, side === 'R' ? -w * 0.62 : w * 0.62], color: KNUCKLE }], mat);
        susp.add(steer);
        inner = steer;
      }
      const wheel = pivotNode(`wheel_${i}${side}`, undefined, { radius: a.radius }, src ? undefined : [
        { cyl: [a.radius, w], axis: 'z', color: TYRE },
        { cyl: [a.radius * 0.55, w + 0.02], axis: 'z', color: HUB },
        { box: [0.09, a.radius * 1.92, w + 0.04], color: STRIPE },
      ], mat);
      if (src) wheel.add(wheelMesh(wheel.name, src, a.radius, side));
      inner.add(wheel);
    }
  });
}

/** A cylinder between two points, for the dummy's arms. */
function limb(from: THREE.Vector3, to: THREE.Vector3, r: number, m: THREE.Material): THREE.Mesh {
  const d = to.clone().sub(from);
  const out = mesh(new THREE.CylinderGeometry(r, r, Math.max(1e-3, d.length()), 10), m);
  out.position.copy(from).addScaledVector(d, 0.5);
  out.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return out;
}

/**
 * A plain dummy on a seat (not a crew member: the crew comes later, ADR-0005), to see that the
 * seat, its pose and its grips are where a person fits. Named `dummy_<role>`, which the parts
 * descriptor ignores. The hands reach the grips of the node the seat works, as they are now.
 */
function dummy(seat: THREE.Object3D, s: SheetSeat, root: THREE.Object3D, mat: (c: string) => THREE.MeshStandardMaterial): void {
  const m = mat(DUMMY);
  const g = new THREE.Group();
  g.name = `dummy_${s.role}`;
  g.add(mesh(new THREE.BoxGeometry(0.28, 0.16, 0.36), m));
  g.add(mesh(new THREE.BoxGeometry(0.22, 0.52, 0.38), m, [0, 0.34, 0]));
  g.add(mesh(new THREE.SphereGeometry(0.11, 16, 12), m, [0, 0.76, 0]));
  for (const z of [-0.1, 0.1]) {
    if (s.pose === 'ride') continue;
    if (s.pose === 'sit') {
      g.add(mesh(new THREE.BoxGeometry(0.44, 0.13, 0.13), m, [0.22, 0, z]));
      g.add(mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), m, [0.44, -0.22, z]));
    } else g.add(mesh(new THREE.BoxGeometry(0.13, 0.88, 0.13), m, [0, -0.46, z]));
  }
  seat.add(g);
  root.updateMatrixWorld(true);
  // Astride (a motorcycle): the legs go down to the footrests.
  if (s.pose === 'ride') for (const side of ['L', 'R'] as const) {
    const hip = new THREE.Vector3(0, 0, side === 'L' ? -0.12 : 0.12);
    const foot = root.getObjectByName(`foot_${side}`);
    const to = foot ? seat.worldToLocal(foot.getWorldPosition(new THREE.Vector3())) : hip.clone().add(new THREE.Vector3(0.2, -0.6, 0));
    const knee = hip.clone().lerp(to, 0.5).add(new THREE.Vector3(0.22, 0.08, 0));
    g.add(limb(hip, knee, 0.06, m), limb(knee, to, 0.055, m));
  }
  const works = s.operates ? root.getObjectByName(s.operates) : undefined;
  for (const side of ['L', 'R'] as const) {
    const shoulder = new THREE.Vector3(0, 0.56, side === 'L' ? -0.21 : 0.21);
    const grip = works?.getObjectByName(`grip_${side}`);
    const hand = grip ? seat.worldToLocal(grip.getWorldPosition(new THREE.Vector3())) : shoulder.clone().add(new THREE.Vector3(0.05, -0.5, 0));
    g.add(limb(shoulder, hand, 0.045, m));
  }
}

/** The model files a sheet's parts are made of (every `source` that is not `proc`), each once. */
export function sheetSources(sheet: VehicleSheet): string[] {
  return [...new Set(sheet.parts.map(p => p.source).filter((s): s is string => !!s && s !== 'proc'))];
}

/**
 * Builds a vehicle from its sheet, at real scale (metres). `crew: false` leaves the dummies out.
 * `sources`: the loaded models of its parts, by file name; a part whose model is not given is built
 * from its shapes, as on a test vehicle.
 */
export function buildTestVehicle(sheet: VehicleSheet, opts: { crew?: boolean; sources?: Record<string, THREE.Object3D> } = {}): THREE.Group {
  const mat = materials();
  const root = new THREE.Group();
  root.name = 'vehicle';
  root.userData.sheet = sheet.id;
  const parentOf = (name: string | undefined): THREE.Object3D => {
    if (!name) return root;
    const p = root.getObjectByName(name);
    if (!p) throw new Error(`scheda ${sheet.id}: il genitore ${name} non c'è ancora`);
    return p;
  };
  for (const part of sheet.parts) {
    const src = part.source ? opts.sources?.[part.source] : undefined;
    if (part.axles) { wheels(root, part, mat, src); continue; }
    const extras = Object.fromEntries(Object.entries(part).filter(([k]) => !RESERVED.has(k)));
    const node = pivotNode(part.node, part.pivot ?? (part.at as V3 | undefined), extras, src && part.mesh ? undefined : part.shapes, mat);
    if (src && part.mesh) node.add(modelMesh(part.node, src, part.mesh));
    parentOf(part.parent).add(node);
  }
  for (const s of sheet.seats ?? []) {
    const { node, parent, at, ...extras } = s;
    parentOf(parent).add(pivotNode(node, at, extras, undefined, mat));
  }
  if (opts.crew !== false) for (const s of sheet.seats ?? []) dummy(root.getObjectByName(s.node)!, s, root, mat);
  root.updateMatrixWorld(true);
  return root;
}

/** Scales a test vehicle from metres to its length on the table (world units per mm given). */
export function toTable(v: THREE.Object3D, sheet: VehicleSheet, worldPerMm: number): void {
  v.scale.setScalar(sheet.show_mm * worldPerMm / sheet.length_m);
}
