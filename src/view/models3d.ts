// Generated 3D models (GLB) for the crews' pieces. One model per piece type, shared by every
// crew: the model is neutral (light grey panels, dark metal) and the crew colour is applied at
// draw time on the light, unsaturated panels. Models load at runtime; a missing file leaves the
// procedural stand-in in place, so the table still works without the model files.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Loads each GLB once; resolves to null when the file is missing or unreadable. */
export class ModelBank {
  private readonly cache = new Map<string, Promise<THREE.Object3D | null>>();
  private readonly loader = new GLTFLoader();

  /** Example: `bank.load(url).then(m => m && group.add(m.clone()))`. */
  load(url: string): Promise<THREE.Object3D | null> {
    let p = this.cache.get(url);
    if (!p) {
      p = this.loader.loadAsync(url).then(g => g.scene as THREE.Object3D, () => null);
      this.cache.set(url, p);
    }
    return p;
  }
}

/**
 * Scales `obj` so its length along x is `length` world units, turns it by `yaw` first (to bring
 * its nose to +x), centres it on x/z and sets its base on y = 0. Returns the resulting size.
 */
export function fitToLength(obj: THREE.Object3D, length: number, yaw = 0): THREE.Vector3 {
  obj.rotation.set(0, yaw, 0);
  obj.scale.setScalar(1);
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const s = length / Math.max(1e-6, box.max.x - box.min.x);
  obj.scale.setScalar(s);
  obj.updateMatrixWorld(true);
  box.setFromObject(obj);
  obj.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  return box.getSize(new THREE.Vector3());
}

/**
 * How the crew colour is laid on a model. A model made neutral has its colour zones as light,
 * unsaturated panels (`panels`); a model made with orange colour zones (the trial colour of the
 * concept prompts) has them as saturated orange (`orange`).
 */
export interface Tint {
  /** Crew colour (CSS). */
  color: string;
  /** 0..1: how much of the crew colour goes on light, unsaturated panels. */
  panels: number;
  /** 0..1: how much of the crew colour replaces saturated orange paint. */
  orange: number;
  /** Multiplies the whole texture: 1 = as made, lower = darker (a burnt wreck). */
  shade: number;
  /**
   * Optional glass (a cockpit): an ellipsoid in the model's own coordinates. Inside it, pixels
   * lighter than `lum` (linear luminance, a soft step from..to) are glass: darkened, glossy, never
   * painted; darker ones are the frame and get the crew colour like the rest.
   */
  glass?: { center: [number, number, number]; radius: [number, number, number]; lum?: [number, number] };
}

/**
 * A copy of `src` that paints the crew colour over the light, unsaturated parts of its texture
 * (the panels), keeping their shading; dark metal and coloured details stay as they are.
 */
export function tintedMaterial(src: THREE.MeshStandardMaterial, tint: Tint): THREE.MeshStandardMaterial {
  const m = src.clone();
  const team = { value: new THREE.Color(tint.color) };
  m.onBeforeCompile = sh => {
    sh.uniforms.teamColor = team;
    sh.uniforms.teamPanels = { value: tint.panels };
    sh.uniforms.teamOrange = { value: tint.orange };
    sh.uniforms.teamShade = { value: tint.shade };
    sh.uniforms.glassCenter = { value: new THREE.Vector3(...(tint.glass?.center ?? [0, 0, 0])) };
    sh.uniforms.glassRadius = { value: new THREE.Vector3(...(tint.glass?.radius ?? [1e-4, 1e-4, 1e-4])) };
    sh.uniforms.glassOn = { value: tint.glass ? 1 : 0 };
    sh.uniforms.glassLum = { value: new THREE.Vector2(...(tint.glass?.lum ?? [0.1, 0.2])) };
    sh.vertexShader = 'varying vec3 vModelPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vModelPos = position;');
    sh.fragmentShader = 'uniform vec3 teamColor;\nuniform float teamPanels;\nuniform float teamOrange;\nuniform float teamShade;\n' +
      'uniform vec3 glassCenter;\nuniform vec3 glassRadius;\nuniform float glassOn;\nuniform vec2 glassLum;\nvarying vec3 vModelPos;\n' +
      sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.12, teamGlass);')
        .replace('#include <map_fragment>', `#include <map_fragment>
  float teamGlass = 0.0;
  {
    vec3 c = diffuseColor.rgb;
    float hi = max(max(c.r, c.g), c.b), lo = min(min(c.r, c.g), c.b);
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float sat = (hi - lo) / max(1e-4, hi);
    // Hue in 0..1 (only its orange range matters: red is 0, yellow 1/6).
    float hue = hi == c.r ? (c.g - c.b) / max(1e-4, hi - lo) / 6.0 : 1.0;
    if (hue < 0.0) hue += 1.0;
    // Glass: light pixels inside the cockpit ellipsoid; the dark ones there are the frame.
    float inGlass = 1.0 - smoothstep(0.85, 1.0, length((vModelPos - glassCenter) / glassRadius));
    teamGlass = glassOn * inGlass * smoothstep(glassLum.x, glassLum.y, lum);
    float panel = smoothstep(0.05, 0.22, lum) * (1.0 - smoothstep(0.25, 0.5, sat)) * teamPanels * (1.0 - teamGlass);
    float orange = smoothstep(0.012, 0.035, hue) * (1.0 - smoothstep(0.13, 0.17, hue)) * smoothstep(0.45, 0.65, sat)
      * smoothstep(0.03, 0.08, lum) * teamOrange;
    vec3 onPanel = teamColor * clamp(lum * 2.6, 0.25, 1.25);
    vec3 onOrange = teamColor * clamp(lum / 0.36, 0.2, 1.4);
    c = mix(c, onPanel, panel);
    c = mix(c, onOrange, orange);
    // Darkened, cool and glossy, but the texture stays: its frame lines (the pillars) still show.
    c = mix(c, c * vec3(0.34, 0.42, 0.5) + vec3(0.004, 0.007, 0.01), teamGlass);
    diffuseColor.rgb = c * teamShade;
  }`);
  };
  m.customProgramCacheKey = () => 'team-tint';
  return m;
}

/**
 * A copy of `model` whose meshes have materials of their own (textures still shared): a light set on
 * one vehicle's parts (the active car's glow) does not show on another vehicle made of the same model.
 */
export function ownMaterials(model: THREE.Object3D): THREE.Object3D {
  const out = model.clone(true);
  out.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
  });
  return out;
}

/** Clones `model` and gives every mesh its own tinted material. */
export function dressed(model: THREE.Object3D, tint: Tint): THREE.Object3D {
  const out = model.clone(true);
  out.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map(x => x instanceof THREE.MeshStandardMaterial ? tintedMaterial(x, tint) : x);
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
  return out;
}

/** A part of a one-piece model that turns on its own, such as a rotor. */
export interface SpinPart {
  /** Name of the pivot group made for it (find it with `getObjectByName`). */
  name: string;
  /** True for a vertex of the part, in the model's own coordinates; a triangle moves when all three are. */
  pick: (x: number, y: number, z: number) => boolean;
  /** A point on the axis, in the model's own coordinates. */
  pivot: [number, number, number];
}

/**
 * Cuts the triangles of each part out of the model's meshes and hangs them on a pivot group
 * (named after the part) placed on the axis, so turning that group turns the part in place.
 * Works on the loaded model once; clones made afterwards keep the split.
 */
export function splitParts(model: THREE.Object3D, parts: SpinPart[]): void {
  const meshes: THREE.Mesh[] = [];
  model.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position');
    const index = geo.index ? Array.from(geo.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const isIn = parts.map(p => Array.from({ length: pos.count }, (_, i) => p.pick(pos.getX(i), pos.getY(i), pos.getZ(i))));
    const keep: number[] = [];
    const taken: number[][] = parts.map(() => []);
    for (let t = 0; t < index.length; t += 3) {
      const tri = [index[t], index[t + 1], index[t + 2]];
      const k = isIn.findIndex(sel => tri.every(v => sel[v]));
      (k < 0 ? keep : taken[k]).push(...tri);
    }
    if (taken.every(x => !x.length)) continue;
    geo.setIndex(keep);
    parts.forEach((p, k) => {
      if (!taken[k].length) return;
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(geo.attributes)) g.setAttribute(name, attr);
      g.setIndex(taken[k]);
      const piece = new THREE.Mesh(g, mesh.material);
      piece.position.set(-p.pivot[0], -p.pivot[1], -p.pivot[2]);
      const pivot = new THREE.Group();
      pivot.name = p.name;
      pivot.position.set(...p.pivot);
      pivot.add(piece);
      // A sibling of the body (in the body's frame), so the body can move without its parts.
      const frame = new THREE.Group();
      frame.applyMatrix4(mesh.matrix);
      frame.add(pivot);
      mesh.parent!.add(frame);
    });
    mesh.name = mesh.name || 'body';
    mesh.userData.body = true;
  }
}

/** A wheel of a one-piece car model, in the model's own coordinates. */
export interface WheelSpec {
  /** Centre of the wheel along the car (x) and its radius. */
  x: number;
  r: number;
  /** The tyre lies between these distances from the car's middle (|z|); the cut reaches further in, to take its inner side. */
  zIn: number;
  zOut: number;
  /** Front wheels steer. */
  steer: boolean;
}

/**
 * Cuts the wheels out of a one-piece car (see `splitParts`): each becomes a pivot group named
 * `wheel0`, `wheel1`… on its axle, with `userData.steer` and `userData.r` (model units).
 * Turn `rotation.z` to roll it and `rotation.y` to steer it (rotation order YZX).
 */
export function splitWheels(model: THREE.Object3D, wheels: WheelSpec[]): void {
  const box = new THREE.Box3().setFromObject(model);
  const parts: SpinPart[] = [];
  wheels.forEach(w => {
    for (const side of [1, -1]) {
      const yc = box.min.y + w.r;
      const z = side * (w.zIn + w.zOut) / 2;
      parts.push({
        name: `wheel${parts.length}`,
        pivot: [w.x, yc, z],
        pick: (x, y, zz) => (x - w.x) ** 2 + (y - yc) ** 2 <= (w.r * 1.04) ** 2 && zz * side >= w.zIn * 0.45 && zz * side <= w.zOut + 0.02,
      });
    }
  });
  splitParts(model, parts);
  parts.forEach((p, k) => {
    const g = model.getObjectByName(p.name);
    if (!g) return;
    g.rotation.order = 'YZX';
    g.userData.steer = wheels[Math.floor(k / 2)].steer;
    g.userData.r = wheels[Math.floor(k / 2)].r;
  });
}
