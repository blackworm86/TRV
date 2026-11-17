import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  blockedBy, chooseShot, fits, frame, freeRect, project, scoreShot, screenBox, shotDir, toFrame,
  type Blocker, type Lens, type SafeFrame, type ShotSpec, type Subject,
} from '../../../src/view/camera/framing';

const LENS: Lens = { fov: 30, aspect: 16 / 10 };
const WHOLE: SafeFrame = { x0: -1, x1: 1, y0: -1, y1: 1 };
/** The band left free between the players' bubbles and the boards, as on a 1600 x 1000 window. */
const BAND: SafeFrame = toFrame({ left: 0, top: 180, right: 1600, bottom: 560 }, 1600, 1000);
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;
const ROAD = V(1, 0, 0);
const car = (x: number, z: number, weight = 1): Subject => ({ at: V(x, 0.3, z), r: 0.7, weight });

describe('free part of the screen', () => {
  it('is the band between the top bar and the boards', () => {
    const r = freeRect(1600, 1000, [{ left: 0, top: 0, right: 1600, bottom: 180 }, { left: 0, top: 560, right: 1600, bottom: 1000 }]);
    expect(r).toEqual({ left: 0, top: 180, right: 1600, bottom: 560 });
  });
  it('goes beside a panel standing in the middle of the band', () => {
    // Arrange: the damage panel in the middle of the free band.
    const blocks = [{ left: 0, top: 0, right: 1600, bottom: 180 }, { left: 0, top: 560, right: 1600, bottom: 1000 }, { left: 540, top: 190, right: 1060, bottom: 510 }];
    // Act
    const r = freeRect(1600, 1000, blocks);
    // Assert: one of the two sides of the panel, the whole band high; it touches no block.
    expect(r.bottom - r.top).toBe(380);
    expect(r.right - r.left).toBe(540);
    expect(blocks.some(b => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top)).toBe(false);
  });
  it('is the whole window with nothing on it', () => {
    expect(freeRect(800, 600, [])).toEqual({ left: 0, top: 0, right: 800, bottom: 600 });
  });
  it('turns window pixels into picture coordinates, y upward', () => {
    expect(toFrame({ left: 0, top: 0, right: 800, bottom: 300 }, 800, 600)).toEqual({ x0: -1, x1: 1, y0: 0, y1: 1 });
  });
});

describe('framing', () => {
  it('stands behind the action’s start with no yaw, and on the player’s side at 90 degrees', () => {
    const behind = shotDir(ROAD, 0, 0), side = shotDir(ROAD, 90 * DEG, 0);
    expect(behind.x).toBeCloseTo(-1); expect(behind.z).toBeCloseTo(0);
    expect(side.x).toBeCloseTo(0); expect(side.z).toBeCloseTo(1);
    expect(shotDir(ROAD, 0, 30 * DEG).y).toBeCloseTo(0.5);
  });
  it('keeps every subject inside the free band and fills the share asked for', () => {
    // Arrange: a shooter and its target four spaces apart.
    const subjects = [car(0, 0), car(6, 1, 2)];
    // Act
    const p = frame(shotDir(ROAD, 80 * DEG, 28 * DEG), subjects, BAND, LENS, 0.8);
    const b = screenBox(p, LENS, subjects);
    // Assert: inside the band, and as large as the share allows on one side at least.
    expect(fits(p, LENS, subjects, BAND)).toBe(true);
    const w = (b.x1 - b.x0) / ((BAND.x1 - BAND.x0) * 0.8), h = (b.y1 - b.y0) / ((BAND.y1 - BAND.y0) * 0.8);
    expect(Math.max(w, h)).toBeGreaterThan(0.97);
    expect(Math.max(w, h)).toBeLessThanOrEqual(1.0001);
  });
  it('centres the subjects in the free band, not in the window', () => {
    const subjects = [car(0, 0), car(3, -2)];
    const b = screenBox(frame(shotDir(ROAD, 70 * DEG, 30 * DEG), subjects, BAND, LENS, 0.7), LENS, subjects);
    expect((b.x0 + b.x1) / 2).toBeCloseTo((BAND.x0 + BAND.x1) / 2, 2);
    expect((b.y0 + b.y1) / 2).toBeCloseTo((BAND.y0 + BAND.y1) / 2, 2);
  });
  it('comes no nearer than the shot allows, and never under the floor', () => {
    const one = [car(0, 0)];
    const p = frame(shotDir(ROAD, 90 * DEG, 5 * DEG), one, WHOLE, LENS, 0.9, 12, 1.5);
    expect(p.pos.distanceTo(p.look)).toBeGreaterThanOrEqual(11.9);
    expect(p.pos.y).toBeGreaterThanOrEqual(1.5);
  });
  it('says a subject behind the camera does not fit', () => {
    const p = { pos: V(0, 2, 5), look: V(0, 0, 0) };
    expect(fits(p, LENS, [{ at: V(0, 2, 9), r: 0.5 }], WHOLE)).toBe(false);
    expect(project(p, LENS, V(0, 0, 0)).x).toBeCloseTo(0);
  });
});

describe('line of sight', () => {
  const rock: Blocker = { x: 0, z: 3, r: 0.8, h: 2, id: 'rock' };
  it('finds what stands between the camera and a subject', () => {
    expect(blockedBy(V(0, 1, 8), car(0, 0), [rock])).toEqual([rock]);
  });
  it('lets a line pass beside a blocker or over it', () => {
    expect(blockedBy(V(4, 1, 8), car(4, 0), [rock])).toEqual([]);
    expect(blockedBy(V(0, 9, 8), car(0, 0), [rock])).toEqual([]);
  });
  it('does not count what the subject stands by, nor a chopper flying over the line', () => {
    expect(blockedBy(V(0, 1, 8), car(0, 0), [{ x: 0.5, z: 0.3, r: 0.6, h: 2 }])).toEqual([]);
    expect(blockedBy(V(0, 1, 8), car(0, 0), [{ x: 0, z: 3, r: 0.8, y0: 2.5, h: 3.2 }])).toEqual([]);
  });
});

describe('choice of the shot', () => {
  const specs: ShotSpec[] = [{ id: 'side', yaw: 90 * DEG, elev: 20 * DEG, fill: 0.7 }, { id: 'high', yaw: 90 * DEG, elev: 62 * DEG, fill: 0.7 }];
  const ctx = { blockers: [] as Blocker[], floor: 0.2 };
  it('takes the first shot meant for the event when nothing is wrong with it, from the player’s side', () => {
    const s = chooseShot(specs, ROAD, [car(0, 0)], BAND, LENS, ctx)!;
    expect(s.spec.id).toBe('side');
    expect(s.pose.pos.z).toBeGreaterThan(0);
    expect(s.blocked).toEqual([]);
  });
  it('leaves a shot that a wall hides for one that sees over it', () => {
    // Arrange: a wall of rock along the road between the low side camera and the car.
    const wall: Blocker[] = [-2, -1, 0, 1, 2].map(x => ({ x, z: 2.2, r: 0.7, h: 1.6 }));
    // Act
    const s = chooseShot(specs, ROAD, [car(0, 0)], BAND, LENS, { ...ctx, blockers: wall })!;
    // Assert
    expect(s.spec.id).toBe('high');
    expect(s.blocked).toEqual([]);
  });
  it('scores a hidden subject, the far side of the table and a turned-around cut below a clean shot', () => {
    const subjects = [car(0, 0)];
    const clean = frame(shotDir(ROAD, 90 * DEG, 25 * DEG), subjects, BAND, LENS, 0.7);
    const far = frame(shotDir(ROAD, -90 * DEG, 25 * DEG), subjects, BAND, LENS, 0.7);
    const base = scoreShot(clean, subjects, BAND, LENS, ctx).score;
    expect(scoreShot(far, subjects, BAND, LENS, ctx).score).toBeLessThan(base);
    expect(scoreShot(clean, subjects, BAND, LENS, { ...ctx, blockers: [{ x: 0, z: 3, r: 0.8, h: 3 }] }).score).toBeLessThan(base);
    expect(scoreShot(clean, subjects, BAND, LENS, { ...ctx, prev: V(0, 0, 1) }).score).toBeLessThan(base);
  });
  it('leaves a low shot with dice looming in the foreground for a higher one that keeps them small', () => {
    // Arrange: a row of big dice lying between the low side camera and the car, out of the line of sight.
    const dice: Subject[] = [-1, 1].map(x => ({ at: V(x, 0.4, 5), r: 0.9 }));
    const low = chooseShot(specs, ROAD, [car(0, 0)], BAND, LENS, ctx)!;
    // Act
    const s = chooseShot(specs, ROAD, [car(0, 0)], BAND, LENS, { ...ctx, clutter: dice })!;
    // Assert
    expect(low.spec.id).toBe('side');
    expect(s.spec.id).toBe('high');
  });
  it('keeps the road running left to right when it can: of two shoulders, the one looking down the road', () => {
    // A shot fired backward (toward -x): over-the-shoulder would look against the road.
    const back = [{ id: 'shoulder', yaw: 25 * DEG, elev: 22 * DEG, fill: 0.8 }, { id: 'side', yaw: 90 * DEG, elev: 28 * DEG, fill: 0.8 }];
    const s = chooseShot(back, V(-1, 0, 0), [car(4, 0), car(0, 0, 2)], BAND, LENS, ctx)!;
    expect(s.spec.id).toBe('side');
  });
});
