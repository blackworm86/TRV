// The Shrapnel damage token (asked by the user, 2026-11-19): a jagged piece of sheet metal torn off
// the damaged car flies, spinning, the way the direction die says, with a few smaller bits. When it
// reaches the first vehicle in that line it strikes it (sparks, the car flashes) and the damage
// beat follows; when it hits nobody it flies off the road and drops onto the table. The rules are in
// engine.ts (damageEffect, 'shrapnel'); the look is in data/trv/presentation_base.json, `shrapnel`.

import * as THREE from 'three';
import { effects } from './beats';
import { carObjs } from './board';
import { flash, impact, word } from './effects';
import { P } from './presentation';
import { TILE_T, TILE_W, scene } from './stage';

const K = P.shrapnel;
/** A road space, in world units. */
const SPACE = TILE_W / 8;

/** Seconds in the air from `from` to `to`. */
function flightOf(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.max(K.minFlight, Math.hypot(to.x - from.x, to.z - from.z) / (K.speed * SPACE));
}

/** How long the shrapnel's beat lasts, from the damaged car at `from` to where the piece ends at `to`. */
export function shrapnelSeconds(from: THREE.Vector3, to: THREE.Vector3): number {
  return K.windup + flightOf(from, to) + K.after;
}

/** A jagged, slightly bent piece of sheet metal `size` world units across. */
function shard(size: number, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(), n = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const r = size * (i % 2 ? 0.28 + Math.random() * 0.2 : 0.45 + Math.random() * 0.25);
    if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: size * 0.05, bevelEnabled: false });
  geo.center();
  // A little bend, as torn metal has.
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + (pos.getX(i) / size) ** 2 * size * 0.35);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/**
 * The piece flies from the damaged car at `from` toward `to`: the space of the vehicle it hits
 * (`targetId`), or the last space on the road when it hits nobody, and then on to `past`, off it.
 */
export function shrapnel(from: THREE.Vector3, to: THREE.Vector3, targetId?: string, past?: THREE.Vector3 | null): void {
  // The damaged car: the one standing on `from`.
  let src: THREE.Object3D | undefined, best = SPACE * 0.6;
  for (const [id, o] of carObjs) {
    if (id === targetId) continue;
    const d = Math.hypot(o.position.x - from.x, o.position.z - from.z);
    if (d < best) { best = d; src = o; }
  }
  const target = targetId ? carObjs.get(targetId) : undefined;
  const ground = Math.max(TILE_T, to.y);
  const start = (src?.position ?? from).clone().setY(ground + K.height * SPACE);
  const end = target ? target.position.clone().setY(ground + K.hitHeight * SPACE) : (past ?? to).clone().setY(ground);
  const dir = end.clone().sub(start).setY(0).normalize();
  const flight = flightOf(start, end), total = K.windup + flight + K.after;

  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(K.color), metalness: K.metal, roughness: 0.38, emissive: new THREE.Color(K.color), emissiveIntensity: K.glint, side: THREE.DoubleSide, transparent: true });
  const pieces = [shard(K.size * SPACE, mat), ...Array.from({ length: K.bits }, () => shard(K.size * SPACE * (0.3 + Math.random() * 0.25), mat))];
  // Each bit: its own spin axis, a little behind and beside the main piece.
  const spin = pieces.map(() => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize());
  const lag = pieces.map((_, i) => (i ? 0.04 + Math.random() * 0.12 : 0));
  const side = pieces.map((_, i) => (i ? (Math.random() - 0.5) * SPACE * 0.5 : 0));
  for (const m of pieces) { m.visible = false; scene.add(m); }
  const across = new THREE.Vector3(-dir.z, 0, dir.x);
  let launched = false, arrived = false;

  effects.push({ life: total, t: 0, step: u => {
    const t = u * total;
    if (t >= K.windup && !launched) {
      launched = true;
      impact(start.clone(), 0xffb050, 0.45); // torn off with a spark
    }
    pieces.forEach((m, i) => {
      const k = Math.min(1, Math.max(0, (t - K.windup - lag[i] * flight) / flight));
      m.visible = launched && (k < 1 || !target);
      if (!m.visible) return;
      const p = start.clone().lerp(end, k).addScaledVector(across, side[i] * k);
      p.y += Math.sin(Math.PI * k) * K.apex * SPACE * (target ? 1 : 1.3);
      if (!target && k >= 1) {
        // Off the road: it lies flat on the table, then fades out.
        p.y = ground + 0.01;
        m.rotation.set(-Math.PI / 2, 0, i);
        mat.opacity = Math.max(0, 1 - (t - K.windup - flight) / K.after);
      } else m.quaternion.setFromAxisAngle(spin[i], K.spin * (t - K.windup) * (i ? 1.6 : 1));
      m.position.copy(p);
    });
    if (t >= K.windup + flight && !arrived) {
      arrived = true;
      if (target && targetId) {
        // The strike: sparks on the car it hits, the car flashes, the word.
        impact(end.clone(), 0xffd27a, 1.0);
        flash(targetId);
        word('SCHEGGE!', end.clone(), '#ffd070');
      } else impact(end.clone(), 0xb8a890, 0.4);
    }
    if (u >= 1) {
      for (const m of pieces) { scene.remove(m); m.geometry.dispose(); }
      mat.dispose();
    }
  } });
}
