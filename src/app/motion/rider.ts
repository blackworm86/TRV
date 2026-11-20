// The motorcycle's rider (asked by the user, 2026-11-20): a figurine astride the bike that moves with
// it — it leans into the turns more than the bike, faces where it is going in a drift, leans forward
// in a wheelie, stands on the pegs in a jump and takes the landing in its legs — and fires either the
// gun mounted on the bike (crouched) or an uzi in its LEFT hand, the arm raised to the target.
// Pure: the pose and the joints, in the seat's frame (+x where the rider looks, +y up, +z its right),
// in metres. view/rider-figure.ts places the figure's pieces on these joints. Unit-tested.

/** A point in the seat's frame, metres. */
export interface P3 { x: number; y: number; z: number }

/** The rider's measures (metres) and how much it moves with the bike (radians per radian, metres). */
export interface RiderTuning {
  /** Lengths: hips to shoulders, neck plus head, shoulder and hip half-widths, the limbs. */
  torso: number; head: number; shoulder: number; hip: number;
  upperArm: number; lowerArm: number; thigh: number; shin: number;
  /** Forward bend of the back when riding, to reach the grips. */
  ride: number;
  /** Extra lean of the body, as a share of the bike's lean (it leans in more than the bike). */
  leanIn: number;
  /** Share of the bike's roll and pitch the head takes back, to keep its eyes level. */
  level: number;
  /** Chest turn toward the path, as a share of the drift angle; the head turns `look` times as much. */
  twist: number; look: number;
  /** Forward bend per radian of wheelie, and forward shift of the hips (m per radian). */
  wheelieBend: number; wheelieShift: number;
  /** How high it stands on the pegs in a jump, how low the landing takes it (m). */
  stand: number; absorb: number;
  /** Extra crouch behind the mounted gun while it fires. */
  crouch: number;
  /** How far the uzi arm reaches toward the target, as a share of the arm's length. */
  reach: number;
}

/** What the bike is doing, as the rider feels it. */
export interface RiderState {
  /** The bike's lean (radians, + its top to the right). */
  lean: number;
  /** The drift: the bike's heading minus its path's (radians, + nose turned left of the path). */
  slip: number;
  /** The bike's pitch (radians, + nose up: a wheelie, a ramp). */
  pitch: number;
  /** 1 in the air (a jump), 0 on the ground; in between while it takes off. */
  air: number;
  /** 0..1, the landing's squash, 1 at the hardest. */
  land: number;
  /** Firing: the mounted gun, or the uzi aimed at `target` (seat frame); null when not firing. */
  fire: null | { weapon: 'mount' } | { weapon: 'uzi'; target: P3 };
}

/** The rider's body angles and offsets, before the limbs reach their holds. */
export interface RiderPose {
  /** The hips' offset from the seat (m). */
  hipsFwd: number; hipsUp: number;
  /** The back: forward bend, roll (+ top to the right), turn (+ toward the left, about +y). */
  bend: number; roll: number; twist: number;
  /** The head, on the chest: roll, pitch (+ chin up), turn. */
  headRoll: number; headPitch: number; headTurn: number;
  /** Whether the left hand leaves its grip for the uzi. */
  uzi: boolean;
}

/**
 * The rider's pose for what the bike is doing (`s`), with the measures and gains of `R`.
 */
export function riderPose(s: RiderState, R: RiderTuning): RiderPose {
  const mounted = s.fire?.weapon === 'mount';
  const wheelie = Math.max(0, s.pitch) * (1 - s.air);
  const bend = R.ride + wheelie * R.wheelieBend + (mounted ? R.crouch : 0) - s.air * R.ride * 0.5;
  const roll = s.lean * R.leanIn;
  // The nose swung left of the path (slip > 0): the chest turns back right, toward where it is going.
  const twist = -s.slip * R.twist;
  return {
    hipsFwd: wheelie * R.wheelieShift,
    hipsUp: s.air * R.stand - s.land * R.absorb,
    bend, roll, twist,
    // The head keeps its eyes level and on the road: back by its share of the bike's and the body's tilt.
    headRoll: -(s.lean + roll) * R.level,
    headPitch: (bend + s.pitch) * R.level,
    headTurn: twist * (R.look - 1),
    uzi: s.fire?.weapon === 'uzi',
  };
}

/**
 * Two-bone reach (an arm, a leg): from `root` toward `target`, bones `a` then `b` long, the middle
 * joint bending toward `pole`. Returns the middle joint and the end, which is the target when it is
 * within reach, or as close as the bones allow on the line to it.
 */
export function twoBoneIK(root: P3, target: P3, a: number, b: number, pole: P3): { mid: P3; end: P3 } {
  const dx = target.x - root.x, dy = target.y - root.y, dz = target.z - root.z;
  const len = Math.hypot(dx, dy, dz) || 1e-9;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  const d = Math.min(a + b - 1e-6, Math.max(Math.abs(a - b) + 1e-6, len));
  const end = add(root, scale(dir, d));
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const along = a * cos, h = a * Math.sqrt(Math.max(0, 1 - cos * cos));
  // Toward the pole, square to the line; any square direction if the pole is on the line.
  let bend = sub(pole, scale(dir, dot(pole, dir)));
  if (Math.hypot(bend.x, bend.y, bend.z) < 1e-6) bend = Math.abs(dir.y) < 0.9 ? cross(dir, { x: 0, y: 1, z: 0 }) : cross(dir, { x: 1, y: 0, z: 0 });
  bend = norm(bend);
  return { mid: add(add(root, scale(dir, along)), scale(bend, h)), end };
}

/** Where the rider's hands and feet hold on: the grips and the footrests, in the seat's frame. */
export interface RiderHolds { gripL: P3; gripR: P3; footL: P3; footR: P3 }

/** The rider's joints in the seat's frame: what view/rider-figure.ts draws. */
export interface RiderJoints {
  hips: P3; chest: P3; head: P3;
  shoulderL: P3; shoulderR: P3; elbowL: P3; elbowR: P3; handL: P3; handR: P3;
  hipL: P3; hipR: P3; kneeL: P3; kneeR: P3; footL: P3; footR: P3;
  /** The body's frame: its forward, up and right directions (the back's turn, bend and roll). */
  fwd: P3; up: P3; right: P3;
}

/**
 * The joints of a rider in pose `p`, its hands and feet on `holds`; the uzi hand toward `uziAt`.
 */
export function riderJoints(p: RiderPose, holds: RiderHolds, R: RiderTuning, uziAt?: P3): RiderJoints {
  const hips = { x: p.hipsFwd, y: p.hipsUp, z: 0 };
  // The body's frame: turn about up, then bend forward, then roll about its forward line.
  const turn = (v: P3): P3 => ({ x: v.x * Math.cos(p.twist) + v.z * Math.sin(p.twist), y: v.y, z: -v.x * Math.sin(p.twist) + v.z * Math.cos(p.twist) });
  let fwd = turn({ x: 1, y: 0, z: 0 }), up: P3 = { x: 0, y: 1, z: 0 };
  // Bend: up tips toward forward.
  const up1 = add(scale(up, Math.cos(p.bend)), scale(fwd, Math.sin(p.bend)));
  fwd = add(scale(fwd, Math.cos(p.bend)), scale(up, -Math.sin(p.bend)));
  up = up1;
  let right = cross(fwd, up);
  // Roll: up tips toward right.
  const up2 = add(scale(up, Math.cos(p.roll)), scale(right, Math.sin(p.roll)));
  right = add(scale(right, Math.cos(p.roll)), scale(up, -Math.sin(p.roll)));
  up = up2;
  const chest = add(hips, scale(up, R.torso));
  const head = add(chest, scale(up, R.head * 0.5));
  const shoulderL = add(chest, scale(right, -R.shoulder)), shoulderR = add(chest, scale(right, R.shoulder));
  // Elbows out and down, knees forward and out.
  const elbowPole = (side: number): P3 => add(add(scale(right, side * 0.6), scale(up, -0.6)), scale(fwd, -0.3));
  const kneePole = (side: number): P3 => add(fwd, scale(right, side * 0.4));
  const handTarget = p.uzi && uziAt
    ? add(shoulderL, scale(norm(sub(uziAt, shoulderL)), (R.upperArm + R.lowerArm) * R.reach))
    : holds.gripL;
  const armL = twoBoneIK(shoulderL, handTarget, R.upperArm, R.lowerArm, elbowPole(-1));
  const armR = twoBoneIK(shoulderR, holds.gripR, R.upperArm, R.lowerArm, elbowPole(1));
  const hipL = add(hips, scale(right, -R.hip)), hipR = add(hips, scale(right, R.hip));
  const legL = twoBoneIK(hipL, holds.footL, R.thigh, R.shin, kneePole(-1));
  const legR = twoBoneIK(hipR, holds.footR, R.thigh, R.shin, kneePole(1));
  return {
    hips, chest, head, shoulderL, shoulderR, elbowL: armL.mid, elbowR: armR.mid, handL: armL.end, handR: armR.end,
    hipL, hipR, kneeL: legL.mid, kneeR: legR.mid, footL: legL.end, footR: legR.end, fwd, up, right,
  };
}

/** How long the rider's show on the bench lasts before it starts again (seconds). */
export const RIDER_DEMO_S = 16;

/**
 * The rider's show on the bench: what the bike does at time `t`, in a loop of `RIDER_DEMO_S` seconds:
 * straight, lean left and right, a drift, a wheelie, a jump with its landing, the mounted gun, the uzi.
 * `bike`: the bike's own roll, pitch, turn off its path (radians) and height over the ground (m).
 */
export function riderDemo(t: number, uziTarget: P3): { state: RiderState; bike: { roll: number; pitch: number; slip: number; lift: number }; label: string } {
  const u = ((t % RIDER_DEMO_S) + RIDER_DEMO_S) % RIDER_DEMO_S;
  const bell = (a: number, b: number): number => (u < a || u > b ? 0 : Math.sin(((u - a) / (b - a)) * Math.PI));
  const lean = -0.45 * bell(1, 3) + 0.45 * bell(3, 5);
  const slip = 0.5 * bell(5, 7);
  const pitch = 0.5 * bell(7, 9);
  const jump = u >= 9 && u < 10.6 ? (u - 9) / 1.6 : -1;
  const air = jump >= 0 ? Math.min(1, Math.sin(jump * Math.PI) * 3) : 0;
  const lift = jump >= 0 ? Math.sin(jump * Math.PI) * 0.8 : 0;
  const land = u >= 10.6 && u < 11.2 ? Math.sin(((u - 10.6) / 0.6) * Math.PI) : 0;
  const fire: RiderState['fire'] = u >= 11.5 && u < 13.5 ? { weapon: 'mount' } : u >= 13.8 && u < 15.8 ? { weapon: 'uzi', target: uziTarget } : null;
  const label = u < 1 ? 'dritto' : u < 3 ? 'piega a sinistra' : u < 5 ? 'piega a destra' : u < 7 ? 'derapata' : u < 9 ? 'impennata'
    : u < 10.6 ? 'salto' : u < 11.5 ? 'atterraggio' : u < 13.5 ? 'mitragliatrice' : u < 13.8 ? 'dritto' : u < 15.8 ? 'uzi' : 'dritto';
  return { state: { lean, slip, pitch, air, land, fire }, bike: { roll: lean, pitch, slip, lift }, label };
}

// ---- small vector helpers ----
function add(a: P3, b: P3): P3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a: P3, b: P3): P3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale(a: P3, k: number): P3 { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
function dot(a: P3, b: P3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: P3, b: P3): P3 { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function norm(a: P3): P3 { const l = Math.hypot(a.x, a.y, a.z) || 1; return scale(a, 1 / l); }
