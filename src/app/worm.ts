// The sand worm's show (Carnage at Devil's Run), redone as asked by the user (2026-11-18): the
// ground swells into a mound under the car farthest back and shakes it; the mound bursts in clods
// and a cloud of dust and throws the car into the air; the worm comes up with its jaws wide, the car
// falls into them and is swallowed (no explosion: it is eaten); the worm dives back, the earth falls
// in and the dust settles. Presentation only: the rules have already taken the car off the table.

import * as THREE from 'three';
import { MODEL, WORM } from '../view/models-config';
import { Worm, type WormPose } from '../view/worm';
import { effects } from './beats';
import { carObjs } from './board';
import { smokeOff, smokeTex, word } from './effects';
import { models } from './pieces';
import { P } from './presentation';
import { settings } from './settings';
import { TILE_T, TILE_W, camera, renderer, scene } from './stage';
import { S } from './state';

let worm: Worm | null = null;
let asked: Promise<void> | null = null;

/** Fetches the worm's model, once: call it when a game can turn one up. Resolves once it is in. */
export function wormReady(): Promise<void> {
  if (asked || !MODEL.worm) return asked ?? Promise.resolve();
  asked = models.load(MODEL.worm).then(m => {
    let mesh: THREE.Mesh | null = null;
    m?.traverse(x => { if (!mesh && (x as THREE.Mesh).isMesh) mesh = x as THREE.Mesh; });
    if (!mesh) return;
    const found = mesh as THREE.Mesh, skin = Array.isArray(found.material) ? found.material[0] : found.material;
    // The model's own texture dresses it, when it has one.
    worm = new Worm(found.geometry, WORM, (skin as THREE.MeshStandardMaterial | undefined)?.map ? skin : undefined);
    // Only what is above the table is drawn: the worm comes out of the ground.
    renderer.localClippingEnabled = true;
    (worm.mesh.material as THREE.Material).clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_T)];
  });
  return asked;
}

const ease = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SAND = 0xd2ae7c, EARTH = 0x8a6038, CLOD = 0x6b4527;

/**
 * A cloud of dust: `n` grains thrown out of `at` (outward `out`, upward `up`, in scene units per
 * second), slowed by the air, falling a little, growing and fading over `life` seconds.
 */
function dustCloud(at: THREE.Vector3, n: number, out: number, up: number, life: number, size: number, color = SAND): void {
  if (!settings.effects || n <= 0) return;
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color(), base = new THREE.Color(color), dark = new THREE.Color(EARTH);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()), s = (0.35 + Math.random() * 0.65) * out;
    pos[i * 3] = at.x + Math.cos(a) * r * size * 0.4; pos[i * 3 + 1] = at.y + Math.random() * size * 0.2; pos[i * 3 + 2] = at.z + Math.sin(a) * r * size * 0.4;
    vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = (0.3 + Math.random()) * up; vel[i * 3 + 2] = Math.sin(a) * s;
    c.copy(base).lerp(dark, Math.random() * 0.45).multiplyScalar(0.85 + Math.random() * 0.3);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ map: smokeTex, size, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const g = -size * 1.6;
  let last = 0;
  effects.push({ life, t: 0, step: u => {
    const dt = (u - last) * life, drag = Math.exp(-2.6 * dt);
    last = u;
    for (let i = 0; i < n; i++) {
      vel[i * 3] *= drag; vel[i * 3 + 2] *= drag; vel[i * 3 + 1] = vel[i * 3 + 1] * drag + g * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.max(TILE_T, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    }
    geo.getAttribute('position').needsUpdate = true;
    mat.size = size * (1 + 2.2 * u);
    mat.opacity = 0.9 * (1 - u) ** 1.4;
    if (u >= 1) { scene.remove(pts); geo.dispose(); mat.dispose(); }
  } });
}

/** Clods of earth thrown out of `at`: they fly, spin, land and crumble into the sand. */
function clods(at: THREE.Vector3, n: number, out: number, up: number, size: number): void {
  if (!settings.effects) return;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const life = 1.6, gravity = -size * 60;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: i % 3 ? CLOD : EARTH, roughness: 1, flatShading: true, transparent: true }));
    const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random() * 0.8) * out, k = size * (0.4 + Math.random() * 0.9);
    const p = at.clone().add(new THREE.Vector3(Math.cos(a) * size, size * 0.5, Math.sin(a) * size));
    const v = new THREE.Vector3(Math.cos(a) * s, (0.5 + Math.random()) * up, Math.sin(a) * s), spin = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
    m.scale.set(k, k * (0.6 + Math.random() * 0.5), k);
    m.castShadow = true;
    scene.add(m);
    let last = 0, landed = -1;
    effects.push({ life, t: 0, step: u => {
      const dt = (u - last) * life;
      last = u;
      if (landed < 0) {
        v.y += gravity * dt;
        p.addScaledVector(v, dt);
        m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; m.rotation.z += spin.z * dt;
        if (p.y <= TILE_T + k * 0.3 && v.y < 0) { p.y = TILE_T + k * 0.3; landed = u; }
      } else {
        const f = ease(landed, 1, u);
        m.scale.y = k * 0.8 * (1 - f) + 0.0001;
        (m.material as THREE.MeshStandardMaterial).opacity = 1 - f;
      }
      m.position.copy(p);
      if (u >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); }
    } });
  }
}

/** A mound of earth, a little rough: a half sphere, its height set by `scale.y`. */
function mound(radius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), rough = 1 + 0.12 * Math.sin(a * 5 + v.y * 7) + 0.07 * Math.sin(a * 11 - v.y * 13);
    p.setXYZ(i, v.x * rough, v.y * (0.9 + 0.2 * Math.sin(a * 7)), v.z * rough);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 1, flatShading: true }));
  m.scale.set(radius, 0.0001, radius);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

/**
 * The worm swallows the piece `id`; the car does not blow up, it is eaten. False only when there
 * is no such piece. Without the worm's model (not loaded yet, or busy with another car) the ground
 * still swells, bursts and throws the car, which falls into the hole.
 * Example: `if (!wormEats(f.vehicleId)) crash(f.vehicleId, null, '')`.
 */
export function wormEats(id: string): boolean {
  const car = carObjs.get(id);
  if (!car) return false;
  const w = worm && !worm.mesh.parent ? worm : null;
  carObjs.delete(id); // from here on this effect owns the piece
  smokeOff(id);
  const K = P.sandWorm, space = TILE_W / 8, scale = w ? K.width * space / w.width : 1, tall = w ? w.height * scale : space * 2;
  const from = car.position.clone(), ground = new THREE.Vector3(from.x, TILE_T, from.z);
  const yaw0 = car.rotation.y, radius = K.width * space * 0.85, top = K.mound * space;
  // The worm turns its mouth to whoever is watching.
  const holder = new THREE.Group();
  holder.position.copy(ground);
  holder.rotation.y = Math.atan2(camera.position.x - from.x, camera.position.z - from.z);
  scene.add(holder);
  holder.updateMatrixWorld(true);
  // It comes up where its open mouth, turned to the sky, is right under the car.
  const up: WormPose = { bend: K.up, dir: 0, gape: K.gape }, pose: WormPose = { ...up };
  const m = new THREE.Vector3(), way = new THREE.Vector3();
  const keep = tall * WORM.root * 0.6; // its foot never leaves the ground
  let foot = new THREE.Vector3();
  if (w) {
    w.mesh.scale.setScalar(scale);
    w.pose(up);
    w.mouth(up, m);
    foot = new THREE.Vector3(-m.x * scale, -tall, -m.z * scale);
    w.mesh.position.copy(foot);
    holder.add(w.mesh);
  }
  // Where the car lands: the open mouth with the worm all the way out, or the hole.
  const target = w ? holder.localToWorld(m.clone().multiplyScalar(scale).add(foot.clone().setY(-keep))) : ground.clone();
  // The swelling ground, then the hole it leaves.
  const hill = mound(radius);
  hill.position.copy(ground);
  scene.add(hill);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.72, 28), new THREE.MeshBasicMaterial({ color: 0x1a0f08, transparent: true, opacity: 0.88, depthWrite: false }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.copy(ground).setY(TILE_T + 0.012);
  hole.scale.setScalar(0.001);
  scene.add(hole);
  const many = settings.quality === 'low' ? 0.5 : 1, grains = Math.round(K.dust * many);
  S.shakeUntil = performance.now() / 1000 + K.seconds * K.quake;
  let burst = false, gone = false, down = false, gulped = false, trickle = 0;
  let launchAt = from.clone();
  effects.push({ life: K.seconds, t: 0, step: u => {
    // The ground swells: the car rides the mound and shakes; dust trickles off its sides.
    const swell = ease(0, K.quake, u), heave = top * swell * (1 + 0.06 * Math.sin(u * 90));
    const after = ease(K.quake, K.quake + 0.05, u), settle = ease(K.dive, 0.97, u);
    // Once it bursts, the mound falls in to a low rim around the hole, and flat when the worm is gone.
    hill.scale.set(radius * (1 + 0.12 * after), Math.max(0.0001, heave * (1 - 0.6 * after) * (1 - settle)), radius * (1 + 0.12 * after));
    hole.scale.setScalar(Math.max(0.001, after * (1 - ease(0.9, 1, u))));
    if (!burst && u > trickle && u < K.quake) {
      trickle = u + 0.035;
      const a = Math.random() * Math.PI * 2;
      dustCloud(ground.clone().add(new THREE.Vector3(Math.cos(a) * radius, heave * 0.5, Math.sin(a) * radius)), Math.round(14 * many), space * 0.6, space * 0.6, 0.9, space * 0.35);
    }
    // The burst: clods and a cloud, the car thrown up.
    if (!burst && u >= K.quake) {
      burst = true;
      launchAt = car.position.clone();
      dustCloud(ground.clone().setY(TILE_T + top * 0.5), grains, space * 3.2, space * 4.2, 2.2, space * 0.7);
      dustCloud(ground, Math.round(grains * 0.5), space * 4.5, space * 0.8, 2.6, space * 0.9, 0xe2c79a);
      clods(ground.clone().setY(TILE_T + top * 0.4), Math.round(16 * many), space * 2.6, space * 5, space * 0.12);
      word('VERME!', ground.clone().setY(TILE_T + (w ? tall : space * 2)), '#e8b860', true);
      S.shakeUntil = performance.now() / 1000 + 0.6;
    }
    if (!down && u >= K.dive + 0.08) { down = true; dustCloud(ground, Math.round(grains * 0.6), space * 2.4, space * 1.2, 2, space * 0.8); }
    // The worm: out of the ground with the burst, jaws wide to the sky; they snap shut on the car;
    // then it leans about and straightens to dive.
    if (w) {
      const r = ease(K.quake, K.rise, u), over = Math.sin(Math.PI * ease(K.quake, K.rise + 0.08, u)) * 0.06;
      const rise = (r + over) * (1 - ease(K.dive, 0.98, u) ** 2);
      w.mesh.position.y = -(1 - rise) * tall - keep * rise;
      const swayIn = ease(K.gulp, K.gulp + 0.1, u), t = (u - K.gulp) * K.seconds;
      pose.gape = K.gape + (K.shut - K.gape) * ease(K.gulp - 0.012, K.gulp + 0.025, u);
      pose.bend = (K.up + (K.sway * 0.7 - K.up) * swayIn + Math.sin(t * 4.2) * K.sway * 0.35 * swayIn) * (1 - ease(K.dive, 0.95, u));
      pose.dir = Math.sin(t * 2.6) * 0.9 * swayIn;
      w.pose(pose);
    }
    // The car: on the mound, then thrown high and down into the jaws (or the hole), then gone.
    if (!gone) {
      if (u < K.quake) {
        car.position.set(from.x + (Math.random() - 0.5) * 0.04 * swell, from.y + heave * 0.92, from.z + (Math.random() - 0.5) * 0.04 * swell);
        car.rotation.set((Math.random() - 0.5) * 0.12 * swell, yaw0, (Math.random() - 0.5) * 0.12 * swell);
      } else if (u < K.gulp) {
        const s = (u - K.quake) / (K.gulp - K.quake), apex = Math.max(launchAt.y, target.y) - target.y + K.launch * space;
        car.position.lerpVectors(launchAt, target, s);
        car.position.y = launchAt.y + (target.y - launchAt.y) * s + 4 * apex * s * (1 - s);
        car.rotation.set(s * Math.PI * 2.4, yaw0 + s * 1.6, Math.sin(s * Math.PI) * 0.8);
      } else {
        // Swallowed: down the throat (or the hole), smaller and smaller.
        const sink = ease(K.gulp, K.gulp + 0.08, u);
        if (w) {
          w.mouth(pose, m, way);
          holder.localToWorld(m.multiplyScalar(scale).add(w.mesh.position));
          way.applyAxisAngle(THREE.Object3D.DEFAULT_UP, holder.rotation.y);
          car.position.copy(m).addScaledVector(way, -sink * tall * 0.25);
        } else car.position.set(target.x, TILE_T - sink * space, target.z);
        car.scale.setScalar(Math.max(0.001, 1 - sink));
        if (sink >= 1) gone = true;
      }
      if (u >= K.gulp && !gulped) {
        gulped = true;
        word('GULP!', target.clone(), '#ff5a3a', true);
        S.shakeUntil = performance.now() / 1000 + 0.25;
      }
      if (gone) scene.remove(car);
    }
    if (u >= 1) {
      scene.remove(holder, hill, hole);
      if (w) holder.remove(w.mesh);
      hill.geometry.dispose(); (hill.material as THREE.Material).dispose();
      hole.geometry.dispose(); (hole.material as THREE.Material).dispose();
      if (!gone) scene.remove(car);
    }
  } });
  return true;
}
