// The other motions of phase 4 (docs/piano-integrazione-veicoli.md): pushed, hitting, skidding,
// tipping over, falling (src/app/motion/moves.ts), the crash by parts (crash.ts), the Big Rig's
// trailers on their hitches (hitch.ts), the motorcycle's lean (drive.ts bikeLean) and the test
// motorcycle and Big Rig built from their sheets (view/test-vehicles.ts).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { P } from '../../../src/app/presentation';
import { fallMove, flipMove, hitMove, hopMove, pushMove, quakeMove, skidMove, slewMove, spinMove, stepMove, type Move } from '../../../src/app/motion/moves';
import { detachable, makeCrash, stepCrash } from '../../../src/app/motion/crash';
import { hitchReach, tow } from '../../../src/app/motion/hitch';
import { bikeLean } from '../../../src/app/motion/drive';
import { MotionTrack } from '../../../src/app/motion/plan';
import { PartsRig } from '../../../src/app/motion/rig';
import { buildTestVehicle, type VehicleSheet } from '../../../src/view/test-vehicles';
import { describeVehicle, missingParts, type Capability } from '../../../src/view/vehicle-rig';
import CAR from '../../../assets/base/modelli/schede/collaudo_auto.json';
import BIKE from '../../../assets/base/modelli/schede/collaudo_moto.json';
import TRACTOR from '../../../assets/base/modelli/schede/collaudo_rig_motrice.json';
import TRAILER from '../../../assets/base/modelli/schede/collaudo_rig_rimorchio.json';

const DT = 1 / 60;
const SPACE = 1.64;

/** Runs a root motion on a node to its end; returns the time it took, the jolts and the moments seen. */
function play(mv: Move, o = new THREE.Object3D()): { o: THREE.Object3D; time: number; jolts: number; moments: string[] } {
  const track = new MotionTrack();
  track.begin(mv.plan);
  let time = 0, jolts = 0, done = false;
  const moments: string[] = [];
  while (!done && time < 10) {
    const res = stepMove(o, mv, DT);
    done = res.done;
    if (res.jolt) jolts++;
    time += DT;
    for (const m of track.advance(DT, done)) moments.push(m.name);
  }
  return { o, time, jolts, moments };
}

describe('root motions', () => {
  it('pushes a vehicle to its new space, keeping its heading, with one jolt at the blow', () => {
    // Arrange
    const from = new THREE.Vector3(0, 0, 0), to = new THREE.Vector3(0, 0, -1.2);
    // Act
    const mv = pushMove(from, to, 0.3, SPACE);
    const r = play(mv);
    // Assert
    expect(r.o.position.distanceTo(to)).toBeLessThan(1e-9);
    expect(r.o.rotation.y).toBeCloseTo(0.3, 9);
    expect(r.jolts).toBe(1);
    expect(r.moments).toEqual(['impact', 'end']);
    expect(Math.abs(r.time - mv.plan.seconds)).toBeLessThan(DT * 1.5);
    // Pushed to its left (−z with the nose on +x), its right side lifts: a negative roll.
    expect(pushMove(from, to, 0, SPACE).jolt!.roll).toBeLessThan(0);
  });

  it('lunges toward the one it hits and comes back to its place', () => {
    // Arrange
    const from = new THREE.Vector3(1, 0, 1);
    const mv = hitMove(from, new THREE.Vector3(1, 0, -1), 0, SPACE);
    const o = new THREE.Object3D();
    let reach = 0;
    // Act
    for (let i = 0; i < 200 && mv.t < mv.plan.seconds; i++) { stepMove(o, mv, DT); reach = Math.max(reach, from.z - o.position.z); }
    // Assert
    expect(reach).toBeCloseTo(P.motion.moves.hitLunge * SPACE, 2);
    expect(o.position.distanceTo(from)).toBeLessThan(1e-9);
    expect(mv.plan.moments.map(m => m.name)).toEqual(['impact', 'end']);
  });

  it('skids out of line and comes back to its heading and its space', () => {
    // Arrange
    const at = new THREE.Vector3(2, 0, 0);
    const mv = skidMove(at, 0.2, 1, SPACE);
    const o = new THREE.Object3D();
    let most = 0;
    // Act
    for (let i = 0; i < 200 && mv.t < mv.plan.seconds; i++) { stepMove(o, mv, DT); most = Math.max(most, o.rotation.y - 0.2); }
    // Assert
    expect(most).toBeCloseTo(P.motion.moves.skidAngle, 2);
    expect(o.rotation.y).toBeCloseTo(0.2, 9);
    expect(o.position.distanceTo(at)).toBeLessThan(1e-9);
  });

  it('tips onto its side, a quarter turn, resting on half its width', () => {
    // Arrange / Act
    const right = play(flipMove(new THREE.Vector3(), 0, 1, 0.3, 0.5)).o;
    const left = play(flipMove(new THREE.Vector3(), 0, -1, 0.3, 0.5)).o;
    // Assert
    expect(right.rotation.x).toBeCloseTo(Math.PI / 2, 9);
    expect(left.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
    expect(right.position.y).toBeCloseTo(0.3, 9);
  });

  it('rolls onto the pit and drops into it nose down', () => {
    // Arrange
    const pit = new THREE.Vector3(1.64, 0, 0);
    // Act
    const r = play(fallMove(new THREE.Vector3(), pit, 0, SPACE));
    // Assert
    expect(r.o.position.x).toBeCloseTo(pit.x, 9);
    expect(r.o.position.y).toBeCloseTo(-P.motion.moves.fallDepth * SPACE, 9);
    expect(r.o.rotation.z).toBeCloseTo(-P.motion.moves.fallTip, 9);
    expect(r.moments).toEqual(['impact', 'end']);
  });
});

describe('crash by parts', () => {
  it('throws the car\'s wheels and turret off and lays them on the ground', () => {
    // Arrange: the test car at real scale on flat ground.
    const world = new THREE.Group();
    const car = buildTestVehicle(CAR as unknown as VehicleSheet, { crew: false });
    world.add(car);
    const d = describeVehicle(car);
    // Act
    const c = makeCrash(car, d, world, 1, 3);
    let done = false;
    for (let i = 0; i < 600 && !done; i++) ({ done } = stepCrash(c, DT, 1, () => 0));
    // Assert: four wheels and the turret, all off the car, resting on or above the ground, away from it.
    expect(c.debris).toHaveLength(5);
    for (const b of c.debris) {
      expect(b.node.parent).toBe(world);
      expect(b.rest).toBe(true);
      expect(b.node.position.y).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(b.node.position.x, b.node.position.z)).toBeGreaterThan(0.5);
    }
    expect(c.plan.moments.map(m => m.name)).toEqual(['impact', 'end']);
  });

  it('takes the motorcycle\'s front wheel off with its fork', () => {
    // Arrange
    const bike = buildTestVehicle(BIKE as unknown as VehicleSheet, { crew: false });
    // Act
    const parts = detachable(describeVehicle(bike));
    // Assert: the fork and the rear wheel; the front wheel goes with the fork.
    expect(parts.map(p => p.name).sort()).toEqual(['fork', 'wheel_1C']);
  });
});

describe('the Big Rig on its hitches', () => {
  it('keeps each trailer on the hitch ahead and within its angle along a sharp bend', () => {
    // Arrange: a tractor and two trailers at real scale, in line.
    const tractor = buildTestVehicle(TRACTOR as unknown as VehicleSheet, { crew: false });
    const trailers = [0, 1].map(() => buildTestVehicle(TRAILER as unknown as VehicleSheet, { crew: false }));
    const reach = hitchReach(trailers[0], trailers[0].getObjectByName('hitch_front')!);
    trailers.forEach((t, i) => t.position.set(-6 * (i + 1), 0, 0));
    let worstGap = 0, worstAngle = 0;
    // Act: the tractor drives a quarter circle of 8 m to the left (toward −z), then 35 m straight on.
    for (let i = 0; i < 600; i++) {
      const a = Math.min(Math.PI / 2, i * 0.01);
      const extra = Math.max(0, i * 0.01 - Math.PI / 2) * 8;
      tractor.position.set(8 * Math.sin(a), 0, -8 * (1 - Math.cos(a)) - extra);
      tractor.rotation.y = a;
      let ahead: THREE.Object3D = tractor;
      for (const t of trailers) {
        ahead.updateMatrixWorld(true);
        const pull = ahead.getObjectByName('hitch_rear')!.getWorldPosition(new THREE.Vector3());
        tow(t, pull, reach, ahead.rotation.y);
        t.updateMatrixWorld(true);
        worstGap = Math.max(worstGap, t.getObjectByName('hitch_front')!.getWorldPosition(new THREE.Vector3()).distanceTo(pull));
        worstAngle = Math.max(worstAngle, Math.abs(Math.atan2(Math.sin(t.rotation.y - ahead.rotation.y), Math.cos(t.rotation.y - ahead.rotation.y))));
        ahead = t;
      }
    }
    // Assert: hitches together, the angle never past its limit, and in line again on the straight.
    expect(worstGap).toBeLessThan(1e-6);
    expect(worstAngle).toBeLessThanOrEqual(P.motion.tow.maxAngle + 1e-9);
    expect(worstAngle).toBeGreaterThan(0.1);
    for (const t of trailers) expect(Math.abs(t.rotation.y - Math.PI / 2)).toBeLessThan(0.05);
  });

  it('builds the tractor with its launcher and rear hitch, the trailer with both hitches', () => {
    // Arrange
    const sheets = [TRACTOR, TRAILER] as unknown as VehicleSheet[];
    // Act
    const [tractor, trailer] = sheets.map(s => describeVehicle(buildTestVehicle(s)));
    // Assert
    expect(missingParts(tractor, sheets[0].capabilities as Capability[])).toEqual([]);
    expect(missingParts(trailer, sheets[1].capabilities as Capability[])).toEqual([]);
    expect(tractor.turrets[0].turret?.name).toBe('launcher');
    expect(tractor.turrets[0].muzzle?.name).toBe('muzzle');
    expect(tractor.hitches.rear).not.toBeNull();
    expect(trailer.hitches.front && trailer.hitches.rear).toBeTruthy();
  });
});

describe('the motorcycle', () => {
  it('leans into its turns, never past lean_max', () => {
    // Arrange / Act / Assert
    expect(bikeLean(3, 1)).toBeGreaterThan(0);
    expect(bikeLean(3, -1)).toBeLessThan(0);
    expect(bikeLean(0, 2)).toBe(0);
    expect(Math.abs(bikeLean(50, 5))).toBeCloseTo(P.motion.bike.leanMax, 9);
    expect(Math.abs(bikeLean(50, -5))).toBeCloseTo(P.motion.bike.leanMax, 9);
  });

  it('is built with its fork, two middle wheels and a rider astride, and steers with the fork', () => {
    // Arrange
    const s = BIKE as unknown as VehicleSheet;
    const d = describeVehicle(buildTestVehicle(s));
    const rig = new PartsRig(d, 1);
    // Act
    for (let i = 0; i < 120; i++) rig.update(DT, 0.02, 0, 0.3, 0);
    // Assert
    expect(missingParts(d, s.capabilities as Capability[])).toEqual([]);
    expect(d.wheels.map(w => `${w.axle}${w.side}`)).toEqual(['0C', '1C']);
    expect(d.seats[0].pose).toBe('ride');
    expect(d.fork!.rotation.y).toBeGreaterThan(0.1);
    // The front wheel is on the fork: it turns with it.
    let n: THREE.Object3D | null = d.wheels[0].roll;
    while (n && n !== d.fork) n = n.parent;
    expect(n).toBe(d.fork);
  });
});

describe('moves the vehicle does not drive (asked by the user, 2026-11-19)', () => {
  const SPACE = 1, FROM = new THREE.Vector3(0, 0, 0), TO = new THREE.Vector3(1, 0, -0.5);
  /** Every pose of `mv` over its plan, at 120 frames per second. */
  const poses = (mv: Move): { pos: THREE.Vector3; yaw: number }[] => {
    const o = new THREE.Object3D(), out: { pos: THREE.Vector3; yaw: number }[] = [];
    for (let done = false; !done;) { done = stepMove(o, mv, 1 / 120).done; out.push({ pos: o.position.clone(), yaw: o.rotation.y }); }
    return out;
  };
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

  it('spins a car on an oil slick a whole turn on its way, and leaves it on its space along the road', () => {
    const p = poses(spinMove(FROM, TO, 0.3, 1, SPACE));
    // Assert: it turned at least the data's turns, ended on the space, nose along the road.
    const turned = p[p.length - 1].yaw - 0.3;
    expect(Math.abs(turned)).toBeGreaterThan(P.motion.moves.spinTurns * Math.PI * 2 - 0.5);
    expect(p[p.length - 1].pos.distanceTo(TO)).toBeLessThan(1e-6);
    expect(Math.abs(wrap(p[p.length - 1].yaw))).toBeLessThan(1e-6);
  });

  it('slews a skidding car out of line on its way and straightens it on its space', () => {
    const p = poses(slewMove(FROM, TO, 0, -1));
    const most = Math.max(...p.map(x => Math.abs(wrap(x.yaw))));
    expect(most).toBeGreaterThan(P.motion.moves.slewAngle * 0.9);
    expect(p[p.length - 1].pos.distanceTo(TO)).toBeLessThan(1e-6);
    expect(Math.abs(wrap(p[p.length - 1].yaw))).toBeLessThan(1e-6);
  });

  it('shakes a car in a quake with hops off the table, and sets it down still on its space', () => {
    const p = poses(quakeMove(FROM, TO, 0, SPACE, 1));
    expect(Math.max(...p.map(x => x.pos.y))).toBeGreaterThan(P.motion.moves.quakeHop * SPACE * 0.3);
    const end = p[p.length - 1];
    expect(end.pos.distanceTo(TO)).toBeLessThan(1e-6);
    expect(Math.abs(wrap(end.yaw))).toBeLessThan(1e-6);
  });

  it('flings a car on Blastoff high over the road and lands it on its space', () => {
    const p = poses(hopMove(FROM, TO, 0, SPACE));
    expect(Math.max(...p.map(x => x.pos.y))).toBeGreaterThan(P.motion.moves.hopHigh * SPACE * 0.9);
    expect(p[p.length - 1].pos.distanceTo(TO)).toBeLessThan(1e-6);
  });
});
