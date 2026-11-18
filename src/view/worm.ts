// The sand worm (Carnage at Devil's Run): the model comes as bare geometry, with no colours and
// no skeleton, so both are made here. Colours are painted on its vertices from where each one
// sits (hide in rings, pale belly, bone spines, red maw, teeth); the "rig" bends the body along
// its height and opens or shuts the jaws around the throat, by moving the vertices themselves.
// Presentation only: three.js maths and one mesh, no scene and no DOM.

import * as THREE from 'three';

/**
 * Where the parts of the worm model are, in the model's own coordinates (y up, mouth toward +z),
 * and its colours (view/models-config.ts, `WORM`). `hinge`: the throat, where the jaws turn;
 * `axis`: the way the mouth points; `jaw`: how far the jaws reach from the hinge; `root`: the
 * share of the height, from the bottom, that stays straight in the ground.
 */
export interface WormSpec {
  hinge: [number, number, number];
  axis: [number, number, number];
  jaw: number;
  root: number;
  colors: { hide: number; hideDark: number; belly: number; bone: number; boneTip: number; flesh: number; throat: number };
}

/** A pose: `bend` radians the body leans in all, toward `dir` (radians about y, 0 = the mouth's side); `gape` radians the jaws open (negative: shut). */
export interface WormPose { bend: number; dir: number; gape: number }

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash3(x: number, y: number, z: number): number {
  let n = Math.imul(Math.floor(x), 374761393) ^ Math.imul(Math.floor(y), 668265263) ^ Math.imul(Math.floor(z), 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * The worm, ready to pose: its mesh stands with the middle of its base on the origin.
 * Example: `const w = new Worm(geometry, WORM); w.pose({ bend: 0.4, dir: 0, gape: 0.5 }); scene.add(w.mesh)`.
 */
export class Worm {
  readonly mesh: THREE.Mesh;
  /** Height and greatest width of the body at rest, model units. */
  readonly height: number;
  readonly width: number;
  private readonly rest: Float32Array;
  private readonly hinge: THREE.Vector3;
  private readonly axis: THREE.Vector3;
  private readonly rootY: number;

  constructor(source: THREE.BufferGeometry, private readonly spec: WormSpec) {
    const geo = source.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    // The middle of the base: where the worm leaves the ground.
    let bx = 0, bz = 0, bn = 0;
    const low = box.min.y + (box.max.y - box.min.y) * 0.08;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < low) { bx += pos.getX(i); bz += pos.getZ(i); bn++; }
    const shift = new THREE.Vector3(-bx / Math.max(1, bn), -box.min.y, -bz / Math.max(1, bn));
    geo.translate(shift.x, shift.y, shift.z);
    this.height = box.max.y - box.min.y;
    this.hinge = new THREE.Vector3(...spec.hinge).add(shift);
    this.axis = new THREE.Vector3(...spec.axis).normalize();
    this.rootY = this.height * spec.root;
    this.rest = Float32Array.from(pos.array as ArrayLike<number>);
    geo.computeVertexNormals();
    this.width = paint(geo, this.rest, this.hinge, this.axis, spec, this.height);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
  }

  /** Moves the vertices to the pose. */
  pose(p: WormPose): void {
    const pos = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const out = pos.array as Float32Array, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(this.rest[i * 3], this.rest[i * 3 + 1], this.rest[i * 3 + 2]);
      this.jaws(v, p.gape);
      this.bend(v, p);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  /** The middle of the open mouth in that pose, and the way it points (both in the mesh's own space). */
  mouth(p: WormPose, at: THREE.Vector3, dir?: THREE.Vector3): THREE.Vector3 {
    at.copy(this.hinge).addScaledVector(this.axis, this.spec.jaw * 0.45);
    if (dir) {
      const tip = at.clone().addScaledVector(this.axis, 0.05);
      this.bend(tip, p); this.bend(at, p);
      dir.copy(tip).sub(at).normalize();
      return at;
    }
    return this.bend(at, p);
  }

  /** The jaws: everything past the throat swings out from the mouth's axis (or in, to shut). */
  private jaws(v: THREE.Vector3, gape: number): void {
    const dx = v.x - this.hinge.x, dy = v.y - this.hinge.y, dz = v.z - this.hinge.z;
    const a = dx * this.axis.x + dy * this.axis.y + dz * this.axis.z;
    if (a <= 0 || gape === 0) return;
    const rx = dx - a * this.axis.x, ry = dy - a * this.axis.y, rz = dz - a * this.axis.z;
    const r = Math.hypot(rx, ry, rz);
    if (r < 1e-6) return;
    const g = gape * smooth(0, this.spec.jaw * 0.5, a), c = Math.cos(g), s = Math.sin(g);
    const a2 = a * c - r * s, r2 = Math.max(r * 0.12, r * c + a * s), k = r2 / r;
    v.set(this.hinge.x + a2 * this.axis.x + rx * k, this.hinge.y + a2 * this.axis.y + ry * k, this.hinge.z + a2 * this.axis.z + rz * k);
  }

  /** The body: above its root it follows an arc of a circle, leaning `bend` radians at the top. */
  private bend(v: THREE.Vector3, p: WormPose): THREE.Vector3 {
    const s = v.y - this.rootY;
    if (s <= 0 || p.bend === 0) return v;
    const k = p.bend / (this.height - this.rootY), th = k * s;
    const dxn = Math.sin(p.dir), dzn = Math.cos(p.dir);
    const u = v.x * dxn + v.z * dzn; // across the body, the way it leans
    const along = (1 - Math.cos(th)) / k + u * Math.cos(th), up = Math.sin(th) / k - u * Math.sin(th);
    v.x += (along - u) * dxn; v.z += (along - u) * dzn; v.y = this.rootY + up;
    return v;
  }
}

/** Paints the vertices from where they sit; returns the body's greatest width. */
function paint(geo: THREE.BufferGeometry, rest: Float32Array, hinge: THREE.Vector3, axis: THREE.Vector3, spec: WormSpec, height: number): number {
  const n = rest.length / 3, BINS = 24;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  // Slices of the body: their middle and mean radius, to tell hide from spines and grooves from rings.
  const sx = new Float64Array(BINS), sz = new Float64Array(BINS), sn = new Float64Array(BINS), sr = new Float64Array(BINS);
  const bin = (y: number): number => Math.min(BINS - 1, Math.max(0, Math.floor(y / height * BINS)));
  for (let i = 0; i < n; i++) { const b = bin(rest[i * 3 + 1]); sx[b] += rest[i * 3]; sz[b] += rest[i * 3 + 2]; sn[b]++; }
  for (let b = 0; b < BINS; b++) if (sn[b]) { sx[b] /= sn[b]; sz[b] /= sn[b]; }
  for (let i = 0; i < n; i++) { const b = bin(rest[i * 3 + 1]); sr[b] += Math.hypot(rest[i * 3] - sx[b], rest[i * 3 + 2] - sz[b]) / sn[b]; }
  // Smoothed, and read between slices, so the colours do not step from one slice to the next.
  for (const arr of [sx, sz, sr]) for (let pass = 0; pass < 2; pass++) {
    const old = Float64Array.from(arr);
    for (let b = 0; b < BINS; b++) arr[b] = (old[Math.max(0, b - 1)] + 2 * old[b] + old[Math.min(BINS - 1, b + 1)]) / 4;
  }
  const slice = (arr: Float64Array, y: number): number => {
    const f = Math.min(BINS - 1, Math.max(0, y / height * BINS - 0.5)), b0 = Math.floor(f), b1 = Math.min(BINS - 1, b0 + 1);
    return arr[b0] + (arr[b1] - arr[b0]) * (f - b0);
  };
  // How much each vertex stands out from its neighbours: teeth and spines do, grooves do the opposite.
  const mx = new Float64Array(n), my = new Float64Array(n), mz = new Float64Array(n), mc = new Float64Array(n), ml = new Float64Array(n);
  const idx = geo.getIndex();
  if (idx) for (let f = 0; f < idx.count; f += 3) for (let e = 0; e < 3; e++) {
    const a = idx.getX(f + e), b = idx.getX(f + (e + 1) % 3);
    mx[a] += rest[b * 3]; my[a] += rest[b * 3 + 1]; mz[a] += rest[b * 3 + 2]; mc[a]++;
    mx[b] += rest[a * 3]; my[b] += rest[a * 3 + 1]; mz[b] += rest[a * 3 + 2]; mc[b]++;
    const len = Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
    ml[a] += len; ml[b] += len;
  }
  const C = spec.colors, col = (h: number): THREE.Color => new THREE.Color(h);
  const hide = col(C.hide), dark = col(C.hideDark), belly = col(C.belly), bone = col(C.bone), tip = col(C.boneTip), flesh = col(C.flesh), throat = col(C.throat);
  const out = new Float32Array(n * 3), c = new THREE.Color();
  let width = 0;
  for (let b = 0; b < BINS; b++) if ((b + 0.5) / BINS * height < hinge.y - spec.jaw * 0.3) width = Math.max(width, sr[b] * 2);
  for (let i = 0; i < n; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    const ox = x - slice(sx, y), oz = z - slice(sz, y), r = Math.hypot(ox, oz) || 1e-6, rel = r / (slice(sr, y) || 1);
    const outward = (nx * ox + nz * oz) / r; // 1: the surface faces straight out of the body
    const stand = mc[i] ? ((x - mx[i] / mc[i]) * nx + (y - my[i] / mc[i]) * ny + (z - mz[i] / mc[i]) * nz) / (ml[i] / mc[i] || 1) : 0;
    const mottle = 0.93 + 0.14 * hash3(x * 140, y * 140, z * 140);
    // In the head: along the mouth's axis from the throat, and out from it.
    const dx = x - hinge.x, dy = y - hinge.y, dz = z - hinge.z;
    const a = dx * axis.x + dy * axis.y + dz * axis.z;
    const rx = dx - a * axis.x, ry = dy - a * axis.y, rz = dz - a * axis.z, rr = Math.hypot(rx, ry, rz) || 1e-6;
    const inward = -(nx * rx + ny * ry + nz * rz) / rr;
    const inMouth = a > -spec.jaw * 0.25 && (inward > 0.2 || rr < spec.jaw * 0.22);
    if (inMouth) {
      // The maw: dark down the throat, red on the jaws, teeth of bone.
      c.copy(throat).lerp(flesh, smooth(-spec.jaw * 0.2, spec.jaw * 0.7, a) * (0.55 + 0.45 * smooth(0, spec.jaw * 0.5, rr)));
      c.lerp(bone, smooth(0.3, 0.6, stand) * smooth(-0.05, 0.1, a));
      c.multiplyScalar(0.9 + 0.2 * hash3(x * 90, y * 90, z * 90));
    } else if (a < 0 && rel > 1.1 && outward < 0.5) {
      // A spine: bone, darker to its point.
      c.copy(bone).lerp(tip, smooth(1.2, 1.55, rel));
    } else {
      // The hide: rust on the back, pale on the belly, darker in the grooves between the rings.
      const front = oz / r;
      c.copy(hide).lerp(dark, smooth(0.2, -0.9, front) * 0.55);
      c.lerp(belly, smooth(0.25, 0.9, front) * 0.7 * smooth(height * 0.02, height * 0.15, y));
      c.multiplyScalar((0.6 + 0.4 * smooth(-0.3, 0.08, stand)) * (0.8 + 0.2 * smooth(0.9, 1.05, rel)) * mottle);
      c.lerp(belly, smooth(0.25, 0.6, stand) * 0.3); // worn ridges
    }
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return width;
}
