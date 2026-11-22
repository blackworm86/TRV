// How the client presents the table (timings, camera shots, jumps, dice), from
// data/trv/presentation_base.json. The file's keys are snake_case, as every data file of the
// project; here they become camelCase once, so the code reads them as it always has.

import RAW from '../../data/trv/presentation_base.json';
import type { ThrowKnobs } from '../view/dice-throw';
import type { RouteKnobs } from './route';

/** snake_case -> camelCase. */
const camel = (k: string): string => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** A copy of `v` with every object key in camelCase; keys starting with `_` (notes) are left out. */
export function camelKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(camelKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, x]) => [camel(k), camelKeys(x)]));
  }
  return v;
}

type Stunt = 'flat' | 'oneWheel' | 'barrel' | 'backflip';
/** A soft sprite a moving car throws up (app/trail.ts): see the data file. */
export interface TrailLook { color: string; rate: number; size: [number, number]; life: number; alpha: number; up: number; grav: number; spread: number; glow?: boolean }
/** Wet drops a car throws up from mud or slime (app/trail.ts): see the data file. */
export interface TrailLiquid { color: string; rate: number; size: [number, number]; life: number; up: [number, number]; kick: number; spread: number; gravity: number; gloss: number; glow: number; splat: number }
/** The presentation values, as the modules use them (see the data file for what each one means). */
export interface Presentation {
  beats: { seconds: Record<string, number>; speedScale: { full: number; fast: number; skip: number }; settleMaxS: number };
  drive: { speed: number; turnRate: number; parkTurnRate: number; maxYaw: number };
  /** How a car drives forward through spaces (app/route.ts). */
  route: RouteKnobs;
  /** What a moving car throws up (app/trail.ts): looks by name, the looks of each ground, the liquids of mud and slime. */
  trail: { pool: number; drops: number; looks: Record<string, TrailLook>; ground: Record<string, string[]>; liquids: Record<string, TrailLiquid> };
  jump: {
    climb: number; land: number; gravity: number; minAngle: number; maxAngle: number; short: number; minFlight: number; maxDive: number;
    bySpaces: Record<number, { follow: number; tail: number }>;
    odds: Record<number, Partial<Record<Stunt, number>>>;
    lean: number; wobble: number; flipLift: number;
    slowMotion: { from: number; to: number; speed: number };
  };
  /** How an FX die is thrown (view/dice-throw.ts), how long it takes, and how wide the pieces it bounces off are (road spaces). */
  diceThrow: ThrowKnobs & { seconds: number; carR: number; rockR: number; sameAction: number; farthest: number; clear: [number, number] };
  /** The director's scenes (app/scenes.ts): see the data file. */
  scenes: { takes: Record<string, string[]>; pushMoves: number; aloneDice: string[]; aloneLogs: string[]; prep: number; hold: Record<string, number> };
  director: {
    diceDist: number; shot: { blendIn: number; blendOut: number; wait: number; follow: number }; lift: number;
    /** The new director (shots.ts): see the data file. */
    hold: number; refresh: number; floor: number; merge: number;
    subject: { car: number; close: number; slam: number; chopper: number; chopperUp: number; die: number; worm: number; wormUp: number };
    blocker: { rockR: number; rockH: number; carR: number; carH: number; chopperR: number };
    shots: Record<string, { id: string; yaw: number; elev: number; fill: number; near?: number; orbit?: number }[]>;
  };
  chase: { enabled: boolean; fov: number; back: number; up: number; pitch: number; lift: number; follow: number };
  chaseDice: { size: number; side: number; gap: number; ahead: number; rows: number; cols: number; every: number; slide: number };
  mapView: { fit: { side: number; high: number; gap: number }; swap: number; elevNear: number };
  replay: { speed: number; before: number; after: number; camera: [number, number, number] };
  /** The sand worm swallowing a car (app/worm.ts): see the data file. */
  sandWorm: { seconds: number; width: number; up: number; gape: number; shut: number; sway: number; mound: number; launch: number; dust: number; quake: number; rise: number; gulp: number; dive: number };
  /** The players' bubbles (app/hud.ts): how long one slides when the turn order changes. */
  bubbles: { slideS: number };
  /** The "Tocca a..." splash at the start of a turn (app/turnsplash.ts). */
  turnSplash: { seconds: number; softSeconds: number };
  /** End Turn pressed by itself (settings.autoEnd, app/dock.ts). */
  endTurn: { autoMs: number };
  /** A gun's burst; it fires after the shooting die (aimBeat, afterDie), hitting (debris) or missing (missOffset). */
  burst: { aim: number; rounds: number; gap: number; speed: number; spread: number; aimBeat: number; afterDie: number; missOffset: number; debris: { pieces: number; speed: number; lift: number; life: number; size: number };
    /** The spent casings thrown out at every round (app/motion/casing.ts). */
    casings: { breech: number; side: number; up: number; back: number; gravity: number; bounce: number; life: number; fade: number; length: number; radius: number; spin: number; color: string } };
  salvo: { seconds: number; perSpace: number; stagger: number; flight: number; apex: number; mark: number };
  /** How a vehicle moves on its springs and how a motorcycle leans (view/models-config.ts, app/cars.ts; design/gdd/vehicle-motion.md). */
  motion: {
    car: {
      engine: { lift: number; roll: number; freq: number };
      pitchPerAccel: number; rollPerTurn: number; maxTip: number;
      maxAccel: number; maxTurnRate: number; maxSpeed: number;
      steerGain: number; maxSteer: number;
    };
    spring: { body: { k: number; c: number }; susp: { k: number; c: number } };
    aim: { speed: number; elevSpeed: number; gap: number; recoil: number; hold: number; bodyKick: number; flash: number };
    drive: { minSpeed: number; lookAhead: number };
    ride: { rate: number };
    settleEps: { x: number; v: number };
    bike: { lean: number; leanMax: number; speedCap: number; leanRate: number; drift: number; gLean: number };
    /** A helicopter holding its place in the air (app/motion/hover.ts). */
    hover: import('./motion/hover').HoverTuning;
    /** The motorcycle's rider (app/motion/rider.ts). */
    rider: import('./motion/rider').RiderTuning;
    moves: {
      pushSpeed: number; pushHop: number; pushSettle: number; pushKick: number;
      hitLunge: number; hitSeconds: number; hitKick: number;
      skidAngle: number; skidSeconds: number; skidSlide: number;
      flipSeconds: number; flipHop: number;
      fallSeconds: number; fallDepth: number; fallTip: number;
      spinSeconds: number; spinTurns: number; spinSwing: number;
      slewSeconds: number; slewAngle: number;
      quakeSeconds: number; quakeHops: number; quakeHop: number; quakeShake: number;
      hopSeconds: number; hopHigh: number;
    };
    crash: { seconds: number; speed: [number, number]; up: [number, number]; gravity: number; spin: number; bounce: number; char: string };
    tow: { maxAngle: number };
  };
  /** The Shrapnel damage token's piece of metal (app/shrapnel.ts). */
  shrapnel: { windup: number; speed: number; minFlight: number; after: number; apex: number; height: number; hitHeight: number; size: number; spin: number; bits: number; color: string; metal: number; glint: number };
  /** A destroyed car goes to pieces, a car falls into a pit (app/wreckage.ts). */
  wreckage: {
    grid: [number, number, number]; char: number; glow: number; cool: number; heap: number; flight: [number, number];
    settle: number; lift: number; spin: number; bounce: number; ground: number; flames: number;
    pit: { roll: number; drop: number; after: number; depth: number; tip: number; blast: number };
  };
}

/** The values in use. */
export const P = camelKeys(RAW) as Presentation;
