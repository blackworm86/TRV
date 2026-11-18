// The Big Rig's Missile Launcher (BRaFF p6), asked by the user on 2026-11-18: the spaces it strikes
// (two ahead of the cab and the six around it) light up in red, then a salvo of rockets rises from
// the cab one after another, like a rocket battery, and rains on them; each lands with a blast.
// Timings in data/trv/presentation_base.json, `salvo`.

import * as THREE from 'three';
import { TILE_COLS, type Pos } from '../game/trv/engine';
import { GRID, spaceRimGeometry } from '../view/board3d';
import { effects } from './beats';
import { HAZ_SIZE, carObjs } from './board';
import { explode, smokeTex, word } from './effects';
import { P } from './presentation';
import { BOARD_X0, KX, PITCH_W, TILE_H, TILE_T, TILE_W, scene, world } from './stage';

const SALVO = P.salvo;
/** A road space, in world units. */
const SPACE = TILE_W / 8;

/** The rocket: a body, a red nose and four fins, along +x, and its flame. */
function rocket(): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a8f7a, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), skin);
  body.rotation.z = -Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.5 }));
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 0.21;
  g.add(body, nose);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.004, 0.06), skin);
    fin.position.set(-0.13, Math.cos(a) * 0.035, Math.sin(a) * 0.035);
    fin.rotation.x = a;
    g.add(fin);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xffb040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.position.x = -0.2;
  flame.scale.setScalar(0.16);
  g.add(flame);
  return g;
}

/** A struck space lit in red on the table for `life` seconds, pulsing, fading out at the end. */
function markSpace(q: Pos, life: number): void {
  const slot = Math.floor(q.c / TILE_COLS), rc = q.c - slot * TILE_COLS;
  const mat = (opacity: number, add: boolean): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({
    color: 0xff2d2d, transparent: true, opacity, depthWrite: false, toneMapped: false, ...(add ? { blending: THREE.AdditiveBlending } : {}),
  });
  const g = new THREE.Group();
  const rim = new THREE.Mesh(spaceRimGeometry(q.r, rc, TILE_W, TILE_H, 0.97, 0.78), mat(1, false));
  const halo = new THREE.Mesh(spaceRimGeometry(q.r, rc, TILE_W, TILE_H, 1.08, 0.97), mat(0.4, true));
  rim.renderOrder = halo.renderOrder = 10;
  g.add(rim, halo);
  g.rotation.x = -Math.PI / 2;
  g.position.set(BOARD_X0 + slot * PITCH_W + (GRID.frameW / 2) * KX, TILE_T + HAZ_SIZE.thickness + 0.03, 0);
  scene.add(g);
  effects.push({ life, t: 0, step: u => {
    const k = u < 0.08 ? u / 0.08 : u > 0.85 ? (1 - u) / 0.15 : 0.75 + 0.25 * Math.sin(u * 40);
    (rim.material as THREE.MeshBasicMaterial).opacity = k;
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.4 * k;
    if (u >= 1) { scene.remove(g); rim.geometry.dispose(); halo.geometry.dispose(); }
  } });
}

/**
 * Fires the salvo of the Big Rig's section `launcherId` (standing at `from`) on `spaces`: the spaces
 * lit, `perSpace` rockets on each, launched one after another, arcing high and landing with a blast.
 */
export function salvo(launcherId: string | undefined, from: THREE.Vector3, spaces: Pos[]): void {
  const launcher = launcherId ? carObjs.get(launcherId) : undefined;
  const base = (launcher?.position ?? from).clone();
  const n = spaces.length * SALVO.perSpace;
  const lastHit = SALVO.stagger * (n - 1) + SALVO.flight;
  for (const q of spaces) markSpace(q, lastHit + SALVO.mark);
  word('SALVA!', base, '#ff6a2a', true);
  // The spaces in a scattered order, so the rockets do not fall in a line.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => ((a * 7919) % n) - ((b * 7919) % n));
  order.forEach((k, i) => {
    const q = spaces[k % spaces.length];
    // A little off the space's middle, so two rockets never land on one point.
    const off = new THREE.Vector3(Math.cos(k * 2.4) * 0.22, 0, Math.sin(k * 2.4) * 0.22).multiplyScalar(SPACE);
    fire(base, world(q).add(off).setY(TILE_T + 0.05), i * SALVO.stagger, i % 2 === 0);
  });
}

/** One rocket from the launcher at `base` to `to`, leaving after `delay` seconds; `big` ones blow up larger. */
function fire(base: THREE.Vector3, to: THREE.Vector3, delay: number, big: boolean): void {
  const life = delay + SALVO.flight;
  const start = base.clone().add(new THREE.Vector3(0, 0.45, 0));
  const mid = start.clone().lerp(to, 0.5).setY(Math.max(start.y, to.y) + SALVO.apex * SPACE);
  const r = rocket();
  r.visible = false;
  scene.add(r);
  const p = new THREE.Vector3(), ahead = new THREE.Vector3();
  const at = (t: number, out: THREE.Vector3): THREE.Vector3 => {
    const a = 1 - t;
    return out.set(0, 0, 0).addScaledVector(start, a * a).addScaledVector(mid, 2 * a * t).addScaledVector(to, t * t);
  };
  let launched = false, lastPuff = 0;
  effects.push({ life, t: 0, step: u => {
    const time = u * life;
    if (time < delay && u < 1) return;
    const t = Math.min(1, (time - delay) / SALVO.flight);
    if (!launched) { launched = true; r.visible = true; puff(start, 0.35, 0xd8d0c0); }
    at(t, p);
    at(Math.min(1, t + 0.02), ahead);
    r.position.copy(p);
    r.lookAt(ahead);
    r.rotateY(-Math.PI / 2); // the rocket points along +x; lookAt turns +z toward the target
    if (time - lastPuff > 0.035) { lastPuff = time; puff(p, 0.16, 0xbdb6aa); }
    if (u >= 1) { scene.remove(r); explode(to, big ? 0.45 : 0.3); }
  } });
}

/** A puff of smoke at `at` that swells and fades. */
function puff(at: THREE.Vector3, size: number, color: number): void {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.55, depthWrite: false }));
  const p0 = at.clone();
  s.position.copy(p0);
  scene.add(s);
  effects.push({ life: 0.9, t: 0, step: u => {
    s.scale.setScalar(size * (0.6 + u * 1.6));
    s.position.y = p0.y + u * 0.25;
    s.material.opacity = 0.55 * (1 - u);
    if (u >= 1) { scene.remove(s); s.material.dispose(); }
  } });
}
