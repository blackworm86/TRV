// PROTOTYPE - NOT FOR PRODUCTION
// The generated models of the crews' pieces and wrecks: where they are, how long they are drawn,
// how the chopper's rotors and glass are found, and the idle motion (suspension, hovering).
// Shared by the game (main.ts) and the model check page (models.ts).

import * as THREE from 'three';
import type { SpinPart, Tint, WheelSpec } from '../../src/view/models3d';

// Imported through the bundler, so a build (GitHub Pages) ships the files and gets their real address.
const FILES = import.meta.glob<string>('/assets/models/*.glb', { eager: true, query: '?url', import: 'default' });
const file = (name: string): string => FILES[`/assets/models/${name}`];
export const MODEL = {
  car: { S: file('Car_Small.glb'), M: file('Car_Medium.glb'), L: file('Car_Large.glb') },
  chopper: file('Chopper.glb'),
  /** Wreck variants; each wreck on the table takes one, by its id. Add files here as they come. */
  wrecks: [file('wreck_1.glb')],
};

/**
 * Length on the table, in mm. Not the miniatures' measures: the sizes are drawn so they read at
 * a glance (asked by the user, 2026-11-15): the large car twice the small one, the medium halfway.
 * The large one fills a road space (about 46 mm). Wrecks count as small cars.
 */
export const SHOW_LENGTH_MM = { S: 22, M: 33, L: 44, chopper: 50, wreck: 22 };

/** Turn that brings a model's nose to +x (the direction of travel): these come with it at -x. */
export const MODEL_YAW = Math.PI;

/** The chopper model is one piece: its rotors are cut out by position (model coordinates, nose at -x). */
export const CHOPPER_PARTS: SpinPart[] = [
  { name: 'rotorMain', pivot: [-0.075, 0.14, 0], pick: (x, y, z) => y > 0.128 && Math.abs(z) < 0.035 && x < 0.27 },
  { name: 'rotorTail', pivot: [0.327, 0.024, 0.022], pick: (x, _y, z) => x > 0.285 && z > 0.017 },
];
/**
 * The gun each car model carries, in the model's own coordinates (nose at -x, y up): the vertices
 * that belong to it, the point it turns about (its mount) and the tip of its barrel. Read off the
 * models' side and top views; a model that changes needs these measured again.
 */
export interface GunSpec extends SpinPart { muzzle: [number, number, number] }
export const GUNS: Record<string, GunSpec> = {
  // Small: on top of the roll cage, barrel over the bonnet.
  [MODEL.car.S]: { name: 'gun', pivot: [0.05, 0.1, 0], muzzle: [-0.14, 0.118, 0],
    pick: (x, y, z) => y > 0.085 && x > -0.16 && x < 0.2 && Math.abs(z) < 0.05 },
  // Medium: on the bonnet, ahead of the windscreen.
  [MODEL.car.M]: { name: 'gun', pivot: [-0.26, 0.07, 0], muzzle: [-0.41, 0.082, 0],
    pick: (x, y, z) => y > 0.062 && x > -0.43 && x < -0.14 && Math.abs(z) < 0.06 },
  // Large: on the bed, barrel over the cab roof.
  [MODEL.car.L]: { name: 'gun', pivot: [0.17, 0.06, 0.005], muzzle: [-0.02, 0.077, 0.005],
    pick: (x, y, z) => Math.abs(z) < 0.07 && x < 0.3 && ((x > 0 && y > 0.04) || (x > -0.04 && y > 0.065)) },
};
/** Turning speed of the rotors, radians per second. */
export const ROTOR_SPEED: Record<string, number> = { rotorMain: 22, rotorTail: 34 };

/** The chopper's cockpit bubble, model coordinates: glass there is never painted. */
export const CHOPPER_GLASS: Tint['glass'] = { center: [-0.19, 0.02, 0], radius: [0.12, 0.12, 0.13] };

/** The crew colour on a piece; `glass` only for the chopper. */
export function crewTint(color: string, chopper = false): Tint {
  return { color, panels: 1, orange: 0, shade: 1, glass: chopper ? CHOPPER_GLASS : undefined };
}
/** Wrecks keep their own burnt look. */
export const WRECK_TINT: Tint = { color: '#000000', panels: 0, orange: 0, shade: 1 };

/** The wreck model for a wreck id (stable: the same wreck always looks the same). */
export function wreckModel(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MODEL.wrecks[h % MODEL.wrecks.length];
}

/** A stable phase in [0, 2π) for an id, so pieces do not move in step. */
export function phaseOf(id: string): number {
  let h = 7;
  for (const ch of id) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000 * Math.PI * 2;
}

/**
 * Wheels of each car model (model coordinates, nose at -x), read off the models: centre along the
 * car from where the tyres touch the ground, radius from the tyre height, tyre band across the car.
 */
export const WHEELS: Record<string, WheelSpec[]> = {
  [MODEL.car.S]: [
    { x: -0.31, r: 0.115, zIn: 0.16, zOut: 0.32, steer: true },
    { x: 0.27, r: 0.12, zIn: 0.16, zOut: 0.32, steer: false },
  ],
  [MODEL.car.M]: [
    { x: -0.265, r: 0.086, zIn: 0.118, zOut: 0.233, steer: true },
    { x: 0.266, r: 0.086, zIn: 0.118, zOut: 0.233, steer: false },
  ],
  [MODEL.car.L]: [
    { x: -0.267, r: 0.077, zIn: 0.085, zOut: 0.167, steer: true },
    { x: 0.12, r: 0.077, zIn: 0.085, zOut: 0.167, steer: false },
    { x: 0.262, r: 0.077, zIn: 0.085, zOut: 0.167, steer: false },
  ],
};

/** Engine and suspension feel. Angles in radians, lengths as a fraction of the car's height. */
export const RIG = {
  /** Engine running: a fast, small shake of the body. */
  engine: { lift: 0.006, roll: 0.004, freq: 46 },
  /** Body on its springs: how much it tips per unit of acceleration and turn, and the spring. */
  pitchPerAccel: 0.012, rollPerTurn: 0.05, maxTip: 0.12,
  /** Input limits (world units, seconds). */
  maxAccel: 12, maxTurnRate: 6, maxSpeed: 10,
  stiffness: 140, damping: 9,
  /** Steering: wheel angle per unit of turn still to make, and its limit. */
  steerGain: 1.4, maxSteer: 0.5,
};

/** Hover of the chopper: slow bob and sway. */
export const HOVER = { lift: 0.07, pitch: 0.05, roll: 0.06, speed: 1.7 };

/** Slow bob and sway of a hovering chopper around its rest pose (stored on first call). */
export function hover(model: THREE.Object3D, t: number, phase: number, height: number): void {
  const rest = (model.userData.rest ??= { pos: model.position.clone(), rot: model.rotation.clone() }) as { pos: THREE.Vector3; rot: THREE.Euler };
  const w = t * HOVER.speed + phase;
  model.position.set(rest.pos.x, rest.pos.y + (Math.sin(w) * 0.6 + Math.sin(w * 1.73 + 1.1) * 0.4) * HOVER.lift * height, rest.pos.z);
  model.rotation.set(rest.rot.x + Math.sin(w * 1.21 + 2) * HOVER.roll, rest.rot.y, rest.rot.z + Math.sin(w * 0.87 + 0.4) * HOVER.pitch);
}

/** A spring toward a target: value and speed. */
interface Spring { v: number; s: number }
function spring(x: Spring, target: number, dt: number): void {
  x.s += (RIG.stiffness * (target - x.v) - RIG.damping * x.s) * dt;
  x.v += x.s * dt;
}

/**
 * Drives one car model on the table: the wheels stay on the ground, roll with the distance
 * travelled and the front ones steer; the body shakes with the engine and tips on its springs.
 * `scale` is world units per model unit (the fitted model's scale).
 */
export class CarRig {
  private readonly body: THREE.Object3D | null;
  private readonly wheels: THREE.Object3D[] = [];
  private readonly rest: { pos: THREE.Vector3; rot: THREE.Euler } | null;
  private readonly pitch: Spring = { v: 0, s: 0 };
  private readonly roll: Spring = { v: 0, s: 0 };
  private steer = 0;

  constructor(model: THREE.Object3D, private readonly scale: number, private readonly height: number, private readonly phase: number) {
    let body: THREE.Object3D | null = null;
    model.traverse(o => {
      if (o.userData.body && !body) body = o;
      if (/^wheel\d+$/.test(o.name)) this.wheels.push(o);
    });
    this.body = body;
    this.rest = body ? { pos: (body as THREE.Object3D).position.clone(), rot: (body as THREE.Object3D).rotation.clone() } : null;
  }

  /**
   * One frame. `forward`: distance driven this frame (world units, negative when reversing);
   * `accel`: forward acceleration; `turn`: heading still to turn (radians, + = left);
   * `turnRate`: radians per second; `engine`: false for a car that is off (upside down).
   */
  update(dt: number, t: number, forward: number, accel: number, turn: number, turnRate: number, engine: boolean): void {
    // A slow frame (hidden tab) must not blow the springs up: clamp the inputs, step in small slices.
    accel = Math.max(-RIG.maxAccel, Math.min(RIG.maxAccel, accel));
    turnRate = Math.max(-RIG.maxTurnRate, Math.min(RIG.maxTurnRate, turnRate));
    const speed = Math.min(RIG.maxSpeed, Math.abs(forward) / Math.max(dt, 1e-3));
    const steerTo = Math.max(-RIG.maxSteer, Math.min(RIG.maxSteer, turn * RIG.steerGain));
    this.steer += (steerTo - this.steer) * Math.min(1, dt * 8);
    for (const w of this.wheels) {
      w.rotation.z += forward / (w.userData.r * this.scale);
      w.rotation.y = w.userData.steer ? this.steer : 0;
    }
    if (!this.body || !this.rest) return;
    const lim = (x: number): number => Math.max(-RIG.maxTip, Math.min(RIG.maxTip, x));
    // Nose (at -x of the model) lifts when speeding up and dives when braking; the body leans out of a turn.
    const slices = Math.max(1, Math.ceil(Math.min(dt, 0.1) / (1 / 240)));
    for (let i = 0; i < slices; i++) {
      spring(this.pitch, lim(-accel * RIG.pitchPerAccel), Math.min(dt, 0.1) / slices);
      spring(this.roll, lim(turnRate * speed * RIG.rollPerTurn), Math.min(dt, 0.1) / slices);
    }
    const e = engine ? 1 : 0;
    const w = t * RIG.engine.freq + this.phase;
    const shake = (Math.sin(w) * 0.6 + Math.sin(w * 1.53 + 1.3) * 0.4) * RIG.engine.lift * this.height / this.scale * e;
    const rollShake = Math.sin(w * 0.71 + 0.5) * RIG.engine.roll * e;
    this.body.position.set(this.rest.pos.x, this.rest.pos.y + shake, this.rest.pos.z);
    this.body.rotation.set(this.rest.rot.x + this.roll.v + rollShake, this.rest.rot.y, this.rest.rot.z + this.pitch.v);
  }
}
