// Visual effects: smoke, floating words, explosions, crashes, impact rings, gunfire bursts,
// sparks and flashes.
// Smoke: soft grey puffs rising from inoperable cars (always) and burning wrecks (for a while).

import * as THREE from 'three';
import { effects } from './beats';
import { carObjs, chopperObjs } from './board';
import { collectMaterials } from './pieces';
import { P } from './presentation';
import { settings } from './settings';
import { TILE_T, camera, renderer, scene } from './stage';
import { S } from './state';
import { $ } from './util';

export const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x2 = c.getContext('2d')!;
  const gr = x2.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
export interface Puff { sprite: THREE.Sprite; age: number; life: number; vel: THREE.Vector3 }
export interface Smoke { puffs: Puff[]; follow: THREE.Object3D; until: number; dark: boolean }
export const smokes = new Map<string, Smoke>();
export function smokeOn(id: string, follow: THREE.Object3D, until: number, dark: boolean): void {
  if (!settings.effects) return;
  const old = smokes.get(id);
  if (old) { old.until = until; old.follow = follow; old.dark = dark; return; }
  const puffs: Puff[] = [];
  for (let i = 0; i < 16; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: dark ? 0x2a2622 : 0x8d8a86, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(sprite);
    puffs.push({ sprite, age: -i * 0.15, life: 2.4, vel: new THREE.Vector3() });
  }
  smokes.set(id, { puffs, follow, until, dark });
}
export function smokeOff(id: string): void {
  const sm = smokes.get(id);
  if (!sm) return;
  for (const p of sm.puffs) { scene.remove(p.sprite); p.sprite.material.dispose(); }
  smokes.delete(id);
}
export function updateSmoke(dt: number, now: number): void {
  for (const [id, sm] of smokes) {
    const ending = now > sm.until;
    let alive = false;
    for (const p of sm.puffs) {
      p.age += dt;
      if (p.age >= p.life && !ending) {
        p.age = 0;
        p.sprite.position.copy(sm.follow.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.25, (Math.random() - 0.5) * 0.3));
        p.vel.set(0.15 + Math.random() * 0.2, 0.55 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15);
      }
      const u = p.age / p.life;
      if (p.age < 0 || u >= 1) { p.sprite.material.opacity = 0; continue; }
      alive = true;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(0.3 + u * 1.3);
      p.sprite.material.opacity = Math.sin(u * Math.PI) * (sm.dark ? 0.75 : 0.5);
    }
    if (ending && !alive) smokeOff(id);
  }
}

/** A comic word over a point of the table ("SLAM!", "BOOM!"): it pops, rises and fades. */
export interface Word { el: HTMLElement; at: THREE.Vector3; t: number; life: number }
export const words: Word[] = [];
export function word(text: string, at: THREE.Vector3, color: string, big = false): void {
  if (!settings.words) return;
  const el = document.createElement('div');
  el.className = `word${big ? ' big' : ''}`;
  el.textContent = text;
  el.style.setProperty('--wc', color);
  $('fx').appendChild(el);
  words.push({ el, at: at.clone(), t: 0, life: big ? 1.6 : 1.2 });
}
/** The label pinned over a car (one at a time), and until when (performance.now()). */
let tag: { el: HTMLElement; car: string; until: number } | null = null;
/**
 * Pins a small label over a car for `ms` milliseconds: what just happened to it, in a few words, so
 * the scene itself says it and nothing covers the car. `html` is trusted markup built by the caller.
 */
export function tagCar(carId: string, html: string, color: string, ms: number): void {
  tag?.el.remove();
  const el = document.createElement('div');
  el.className = 'fxtag';
  el.innerHTML = html;
  el.style.setProperty('--c', color);
  $('fx').appendChild(el);
  tag = { el, car: carId, until: performance.now() + ms };
}
/** Each frame: the label follows its car, above it, inside the window. */
export function updateTags(): void {
  if (!tag) return;
  const o = carObjs.get(tag.car);
  if (!o || performance.now() > tag.until) { tag.el.remove(); tag = null; return; }
  const rect = renderer.domElement.getBoundingClientRect();
  const p = o.position.clone().setY(o.position.y + 0.85).project(camera);
  const half = tag.el.offsetWidth / 2 + 8;
  const x = rect.left + (p.x * 0.5 + 0.5) * rect.width, y = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
  tag.el.style.left = `${Math.max(half, Math.min(innerWidth - half, x))}px`;
  tag.el.style.top = `${Math.max(tag.el.offsetHeight + 70, y)}px`;
}
export function updateWords(dt: number): void {
  const rect = renderer.domElement.getBoundingClientRect();
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    w.t += dt / w.life;
    if (w.t >= 1) { w.el.remove(); words.splice(i, 1); continue; }
    const p = w.at.clone().setY(w.at.y + 0.9 + w.t * 1.2).project(camera);
    const pop = w.t < 0.15 ? 0.4 + w.t / 0.15 * 0.8 : 1.2 - Math.min(0.2, (w.t - 0.15) * 1.5);
    w.el.style.left = `${rect.left + (p.x * 0.5 + 0.5) * rect.width}px`;
    w.el.style.top = `${rect.top + (-p.y * 0.5 + 0.5) * rect.height}px`;
    w.el.style.transform = `translate(-50%, -50%) scale(${pop}) rotate(${-6 + w.t * 4}deg)`;
    w.el.style.opacity = `${w.t < 0.7 ? 1 : (1 - w.t) / 0.3}`;
  }
}

/**
 * An explosion at a point of the table: a flash of light, fireballs that swell and darken, flying
 * debris, a shock ring, dark smoke and a scorch mark that fades. `size` 1 = a car blowing up.
 */
export function explode(at: THREE.Vector3, size = 1, now = performance.now() / 1000): void {
  const p0 = at.clone().setY(Math.max(at.y, TILE_T) + 0.25);
  S.shakeUntil = now + 0.5 * size;
  if (!settings.effects) return;
  const light = new THREE.PointLight(0xffb040, 60 * size, 14 * size);
  light.position.copy(p0).setY(p0.y + 0.8);
  scene.add(light);
  effects.push({ life: 0.5, t: 0, step: u => { light.intensity = 60 * size * (1 - u) ** 2; if (u >= 1) scene.remove(light); } });
  // Fireballs: bright and additive at first, then dark smoke.
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xfff0a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize();
    const speed = (0.8 + Math.random() * 1.6) * size, grow = (1.1 + Math.random() * 1.3) * size, delay = Math.random() * 0.12;
    s.position.copy(p0);
    scene.add(s);
    const hot = new THREE.Color(0xfff0a0), mid = new THREE.Color(0xff6a1a), cold = new THREE.Color(0x2a1a12);
    effects.push({ life: 0.9 + Math.random() * 0.4, t: 0, step: u => {
      const v = Math.max(0, u - delay);
      s.position.copy(p0).addScaledVector(dir, speed * (1 - (1 - v) ** 2)).setY(p0.y + dir.y * speed * v + v * 0.6);
      s.scale.setScalar(0.3 + grow * Math.sqrt(v));
      s.material.color.copy(v < 0.3 ? hot.clone().lerp(mid, v / 0.3) : mid.clone().lerp(cold, (v - 0.3) / 0.7));
      if (v > 0.45 && s.material.blending !== THREE.NormalBlending) { s.material.blending = THREE.NormalBlending; s.material.needsUpdate = true; }
      s.material.opacity = v < 0.1 ? v * 10 : 1 - v;
      if (u >= 1) { scene.remove(s); s.material.dispose(); }
    } });
  }
  // Debris: small dark chunks thrown up, falling back under gravity.
  const chunk = new THREE.BoxGeometry(0.09, 0.06, 0.12);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(chunk, new THREE.MeshStandardMaterial({ color: i % 3 ? 0x2a2622 : 0x8a4a2a, roughness: 0.8 }));
    const v0 = new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5).multiplyScalar(size);
    const spin = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    m.castShadow = true;
    scene.add(m);
    effects.push({ life: 1.3, t: 0, step: u => {
      const t = u * 1.3;
      m.position.copy(p0).addScaledVector(v0, t).setY(Math.max(TILE_T + 0.03, p0.y + v0.y * t - 9 * t * t));
      m.rotation.set(spin.x * t, spin.y * t, spin.z * t);
      if (u >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); }
    } });
  }
  impact(p0, 0xffd23a, 2.4 * size);
  // Scorch mark on the ground, fading slowly.
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.7 * size, 24), new THREE.MeshBasicMaterial({ map: smokeTex, color: 0x000000, transparent: true, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.copy(at).setY(Math.max(at.y, TILE_T) + 0.012);
  scorch.renderOrder = 2;
  scene.add(scorch);
  effects.push({ life: 9, t: 0, step: u => { (scorch.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - u * u); if (u >= 1) scene.remove(scorch); } });
  const puff = new THREE.Object3D();
  puff.position.copy(p0);
  smokeOn(`boom-${now}-${Math.random()}`, puff, now + 2.6, true);
}

/**
 * A vehicle is destroyed. With `into` (the space it was entering: an obstacle, or off the road) it
 * first lunges that way and blows up against it; then the wreck is thrown up, spinning, and is gone.
 */
export function crash(id: string, into: THREE.Vector3 | null, why: string): void {
  const o = carObjs.get(id);
  if (!o) return;
  carObjs.delete(id); // from here on this effect owns the piece: the table no longer drives it
  smokeOff(id);
  const from = o.position.clone();
  const hit = into ? from.clone().lerp(into, 0.6) : from.clone();
  const yaw0 = o.rotation.y;
  let blown = false;
  effects.push({ life: into ? 1.5 : 1.2, t: 0, step: u => {
    const lunge = into ? 0.2 : 0.02;
    if (u < lunge) {
      o.position.lerpVectors(from, hit, (u / lunge) ** 2);
      return;
    }
    if (!blown) {
      blown = true;
      explode(hit, 1);
      word('BOOM!', hit, '#ff6a2a', true);
      for (const m of collectMaterials(o)) { m.color.multiplyScalar(0.25); m.emissive.setRGB(1, 0.35, 0.05); m.emissiveIntensity = 0.8; }
    }
    const v = (u - lunge) / (1 - lunge), t = v * 1.3;
    // Thrown back from the obstacle and up, tumbling; it shrinks away as it lands.
    const back = into ? from.clone().sub(hit).setY(0).normalize() : new THREE.Vector3(0, 0, 0);
    o.position.copy(hit).addScaledVector(back, t * 1.6).setY(Math.max(TILE_T, hit.y + 5.5 * t - 6.5 * t * t));
    o.rotation.set(t * 7, yaw0 + t * 3, t * 4);
    o.scale.setScalar(v < 0.75 ? 1 : Math.max(0.01, 1 - (v - 0.75) / 0.25));
    if (u >= 1) scene.remove(o);
  } });
  void why;
}

/** A coloured ring that spreads and fades over a space. */
export function impact(at: THREE.Vector3, color: number, size: number): void {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthTest: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at).setY(TILE_T + 0.3);
  m.renderOrder = 12;
  scene.add(m);
  effects.push({ life: 0.6, t: 0, step: u => {
    m.scale.setScalar(1 + u * size * 2);
    (m.material as THREE.MeshBasicMaterial).opacity = 1 - u;
    if (u >= 1) { scene.remove(m); m.geometry.dispose(); }
  } });
}

/** How a burst is fired: time to aim, rounds, seconds between them, bullet speed (units/s), spread at the target. */
export const BURST = P.burst;
export const bulletGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6);
/**
 * A shot: the shooter (the car on that spot, or a chopper over it) turns its gun on the target
 * and fires a burst. Every round has a muzzle flash, a recoil, a tracer that flies to the target
 * and sparks where it lands. The die that follows says whether it did any damage.
 */
export function burst(from: THREE.Vector3, to: THREE.Vector3, targetId?: string): void {
  // Who is firing: a chopper standing over that spot, else the nearest car to it.
  let shooter: THREE.Object3D | undefined, flying = false;
  for (const o of chopperObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (!o.userData.parked && tg && Math.hypot(tg.x - from.x, tg.z - from.z) < 0.3) { shooter = o; flying = true; }
  }
  if (!shooter) {
    let best = 0.9;
    for (const [id, o] of carObjs) {
      if (id === targetId) continue;
      const d = Math.hypot(o.position.x - from.x, o.position.z - from.z);
      if (d < best) { best = d; shooter = o; }
    }
  }
  const origin = (shooter?.position ?? from).clone();
  const yaw = Math.atan2(-(to.z - origin.z), to.x - origin.x);
  if (shooter) shooter.userData.aim = yaw;
  const target = to.clone().setY(Math.max(to.y, TILE_T) + 0.3);
  const turret = shooter?.userData.turret as THREE.Object3D | undefined;
  const muzzleAt = (): THREE.Vector3 => {
    if (turret) return (turret.userData.muzzle as THREE.Object3D).getWorldPosition(new THREE.Vector3());
    const p = (shooter?.position ?? from).clone();
    return p.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(0.6)).setY(p.y + (flying ? -0.1 : 0.45));
  };
  const total = BURST.aim + BURST.rounds * BURST.gap + 0.5;
  let fired = 0;
  effects.push({ life: total, t: 0, step: u => {
    const t = u * total;
    while (fired < BURST.rounds && t >= BURST.aim + fired * BURST.gap) round(fired++);
    if (u >= 1 && shooter) shooter.userData.aim = null;
  } });
  word('RATATATA!', origin, '#ffe066');

  function round(n: number): void {
    const a = muzzleAt();
    const b = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * BURST.spread, (Math.random() - 0.3) * BURST.spread, (Math.random() - 0.5) * 2 * BURST.spread));
    if (turret) turret.userData.kick = 1; // the gun kicks back
    // Muzzle flash: a hot star at the barrel and a blink of light.
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xffe9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fl.position.copy(a);
    const light = new THREE.PointLight(0xffc860, 9, 5);
    light.position.copy(a);
    scene.add(fl, light);
    effects.push({ life: 0.09, t: 0, step: v => {
      fl.scale.setScalar(0.25 + v * 0.55); fl.material.opacity = 1 - v; light.intensity = 9 * (1 - v);
      if (v >= 1) { scene.remove(fl, light); fl.material.dispose(); }
    } });
    // A wisp of gun smoke left behind.
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xb0aaa0, transparent: true, opacity: 0, depthWrite: false }));
    puff.position.copy(a);
    scene.add(puff);
    effects.push({ life: 0.7, t: 0, step: v => {
      puff.position.y = a.y + v * 0.5; puff.scale.setScalar(0.15 + v * 0.5); puff.material.opacity = 0.35 * Math.sin(v * Math.PI);
      if (v >= 1) { scene.remove(puff); puff.material.dispose(); }
    } });
    // The tracer: a short bright streak that flies to the target.
    const dir = b.clone().sub(a), dist = dir.length();
    dir.normalize();
    const streak = Math.min(0.9, dist * 0.45);
    const m = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: n % 3 === 0 ? 0xfff6c8 : 0xffc23a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.scale.set(1, streak, 1);
    scene.add(m);
    effects.push({ life: Math.max(0.05, dist / BURST.speed), t: 0, step: v => {
      m.position.copy(a).addScaledVector(dir, Math.max(streak / 2, v * dist - streak / 2));
      if (v >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); sparks(b, dir); }
    } });
  }
}

/** Sparks where a round lands: a flash and a few bright bits thrown back. */
export function sparks(at: THREE.Vector3, dir: THREE.Vector3): void {
  if (!settings.effects) return;
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xfff0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fl.position.copy(at);
  scene.add(fl);
  effects.push({ life: 0.14, t: 0, step: v => { fl.scale.setScalar(0.2 + v * 0.5); fl.material.opacity = 1 - v; if (v >= 1) { scene.remove(fl); fl.material.dispose(); } } });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const v0 = dir.clone().multiplyScalar(-1.5).add(new THREE.Vector3((Math.random() - 0.5) * 4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 4));
    m.scale.set(0.6, 0.12, 0.6);
    scene.add(m);
    effects.push({ life: 0.35, t: 0, step: v => {
      const t = v * 0.35;
      m.position.copy(at).addScaledVector(v0, t).setY(Math.max(TILE_T + 0.02, at.y + v0.y * t - 9 * t * t));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v0.clone().setY(v0.y - 18 * t).normalize());
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - v;
      if (v >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); }
    } });
  }
}

/** The car glows red for a moment. */
export function flash(id: string): void {
  const o = carObjs.get(id);
  if (!o) return;
  const mats: THREE.MeshStandardMaterial[] = [];
  o.traverse(x => { const m = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.emissive && !mats.includes(m)) mats.push(m); });
  effects.push({ life: 0.65, t: 0, step: u => {
    for (const m of mats) { m.emissive.setRGB(1, 0.1, 0.05); m.emissiveIntensity = Math.sin(u * Math.PI * 3) ** 2 * (1 - u) * 1.5; }
  } });
}
