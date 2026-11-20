// The Big Rig as a train (src/app/motion/train.ts): the trailers ride the trail of the tractor's
// middle. Tried as the user asked (2026-11-20): the tractor alone, then with the middle section,
// then with the rear one too; on a straight, through a lane change, and with no trail yet.
import { describe, expect, it } from 'vitest';
import { backOn, extendTrail, headingOn, trainOn, type Flat, type Placed } from '../../../src/app/motion/train';

/** One space along the road and half of it (a section is one space from hitch to hitch). */
const SPACE = 2, HALF = SPACE / 2;
/** A lane is this far from the next, and a lane change goes this far along the road. */
const LANE = 1.5;
/** The trail's grain and the frames the tractor takes over one space. */
const STEP = 0.02, FRAMES = 60;
/** How far back along its trail the tractor looks for its heading, in half sections (cars.ts). */
const TRACTOR_BACK = 1.5;
/** The most a hitch folds, radians. */
const FOLD = 1;

const dir = (yaw: number): Flat => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });
const front = (s: Placed): Flat => ({ x: s.x + HALF * dir(s.yaw).x, z: s.z + HALF * dir(s.yaw).z });
const rear = (s: Placed): Flat => ({ x: s.x - HALF * dir(s.yaw).x, z: s.z - HALF * dir(s.yaw).z });
const gap = (a: Flat, b: Flat): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Drives a tractor through `spaces` (their middles), straight from each to the next, heading as its
 * trail gives it, and returns the train at every frame: the tractor first, then `n` trailers.
 */
function driveThrough(spaces: Flat[], n: number): Placed[][] {
  const trail: Flat[] = [];
  const out: Placed[][] = [];
  for (let i = 1; i < spaces.length; i++) {
    const a = spaces[i - 1], b = spaces[i];
    for (let f = i === 1 ? 0 : 1; f <= FRAMES; f++) {
      const at: Placed = { x: a.x + (b.x - a.x) * f / FRAMES, z: a.z + (b.z - a.z) * f / FRAMES, yaw: 0 };
      extendTrail(trail, at, STEP, (2 * n + 2) * SPACE);
      at.yaw = headingOn(trail, at, TRACTOR_BACK * HALF);
      out.push([at, ...trainOn(trail, at, HALF, n, FOLD)]);
    }
  }
  return out;
}

/** Spaces in a row along the road, from x = 0. */
const straight = (count: number, z = 0): Flat[] => Array.from({ length: count }, (_, i) => ({ x: i * SPACE, z }));

describe('Big Rig train', () => {
  it('the tractor alone leaves a trail no longer than asked', () => {
    // Arrange
    const trail: Flat[] = [];
    const KEEP = 3 * SPACE;
    // Act: ten spaces along the road.
    for (let x = 0; x <= 10 * SPACE; x += 0.05) extendTrail(trail, { x, z: 0 }, STEP, KEEP);
    // Assert
    const newest = trail[trail.length - 1];
    expect(newest.x).toBeCloseTo(10 * SPACE, 1);
    expect(gap(trail[1], newest)).toBeLessThanOrEqual(KEEP);
    expect(gap(trail[0], newest)).toBeGreaterThan(KEEP - 0.1);
  });

  it('a point of the trail is found the asked way back along it, and past its end straight back along the road', () => {
    // Arrange: a trail from x = 0 to x = 4, then one lane over at a right angle.
    const trail = [...straight(3), { x: 4, z: -1 }];
    // Act: measured along the way driven, not straight across the corner.
    const on = backOn(trail, { x: 4, z: -1 }, 3), past = backOn(trail, { x: 4, z: -1 }, 7), none = backOn([], { x: 4, z: 1 }, 2);
    // Assert
    expect([on.x, on.z]).toEqual([2, 0]);
    expect([past.x, past.z]).toEqual([-2, 0]);
    expect([none.x, none.z]).toEqual([2, 1]);
  });

  it('back and forth across two lanes at a sharp angle, no section ever turns at a jump', () => {
    // Arrange: the board's zigzag: a lane over and half a space on, then back.
    const spaces = [{ x: 0, z: 0 }, { x: SPACE, z: 0 }, { x: 1.4 * SPACE, z: -LANE }, { x: 1.8 * SPACE, z: 0 }, { x: 2.8 * SPACE, z: 0 }, { x: 3.8 * SPACE, z: 0 }, { x: 4.8 * SPACE, z: 0 }, { x: 5.8 * SPACE, z: 0 }, { x: 6.8 * SPACE, z: 0 }];
    // Act
    const run = driveThrough(spaces, 2);
    // Assert: from one frame to the next a trailer turns by little, and stays hitched.
    for (let i = 1; i < run.length; i++) for (const k of [1, 2]) {
      expect(Math.abs(run[i][k].yaw - run[i - 1][k].yaw)).toBeLessThan(0.15);
      expect(gap(front(run[i][k]), rear(run[i][k - 1]))).toBeLessThan(1e-6);
      expect(Math.abs(run[i][k].yaw - run[i][k - 1].yaw)).toBeLessThanOrEqual(FOLD + 1e-9);
    }
    // In line again on the straight after it.
    expect(run.at(-1)![2].yaw).toBeCloseTo(0, 1);
  });

  it('the tractor alone turns as it goes: into a lane change its tail stays on the way it came', () => {
    // Arrange: along the road, then one lane over; the trail's grain as in play.
    const trail: Flat[] = [];
    let swing = 0, end = 0;
    // Act: the tractor's rear hitch, half behind its middle, at every frame of the lane change.
    for (let f = 0; f <= FRAMES; f++) extendTrail(trail, { x: f / FRAMES * SPACE, z: 0 }, STEP, 4 * SPACE);
    for (let f = 1; f <= FRAMES; f++) {
      const at = { x: SPACE + f / FRAMES * LANE, z: -f / FRAMES * LANE };
      extendTrail(trail, at, STEP, 4 * SPACE);
      end = headingOn(trail, at, SPACE);
      swing = Math.max(swing, at.z + HALF * Math.sin(end));
    }
    // Assert: the tail never crosses to the other side of the lane it came along; the nose ends the way it went.
    expect(swing).toBeLessThan(0.01);
    expect(end).toBeCloseTo(Math.PI / 4, 1);
  });

  it('with the middle section: on a straight it follows one space behind, in line', () => {
    // Arrange, Act
    const end = driveThrough(straight(5), 1).at(-1)!;
    // Assert
    expect(end[1].x).toBeCloseTo(end[0].x - SPACE, 6);
    expect(end[1].z).toBeCloseTo(0, 6);
    expect(end[1].yaw).toBeCloseTo(0, 6);
  });

  it('with the middle section: through a lane change its hitch never leaves the tractor, and it ends over the space the tractor left', () => {
    // Arrange: two spaces ahead, a lane change, two more spaces ahead.
    const spaces = [{ x: 0, z: 0 }, { x: SPACE, z: 0 }, { x: SPACE + LANE, z: -LANE }, { x: 2 * SPACE + LANE, z: -LANE }, { x: 3 * SPACE + LANE, z: -LANE }];
    // Act
    const run = driveThrough(spaces, 1);
    // Assert: hitched at every frame, never folded far from the tractor.
    for (const [tractor, mid] of run) {
      expect(gap(front(mid), rear(tractor))).toBeLessThan(1e-6);
      expect(Math.abs(mid.yaw - tractor.yaw)).toBeLessThan(1.2);
    }
    // In the new lane and in line again, over the space behind the tractor's.
    const [tractor, mid] = run.at(-1)!;
    expect(gap(mid, spaces[3])).toBeLessThan(0.1);
    expect(mid.yaw).toBeCloseTo(0, 1);
    expect(tractor.x).toBeCloseTo(spaces[4].x, 6);
  });

  it('with the middle section: it passes where the tractor passed, not across the corner', () => {
    // Arrange: a lane change; the old lane is z = 0, the new one z = -LANE.
    const spaces = [{ x: 0, z: 0 }, { x: SPACE, z: 0 }, { x: SPACE + LANE, z: -LANE }, { x: 2 * SPACE + LANE, z: -LANE }, { x: 3 * SPACE + LANE, z: -LANE }];
    // Act: the middle section's rear hitch at every frame.
    const tails = driveThrough(spaces, 1).map(([, mid]) => rear(mid));
    // Assert: before the bend it is still in the old lane, after it in the new one.
    for (const t of tails) {
      if (t.x < SPACE - 0.05) expect(Math.abs(t.z)).toBeLessThan(0.15);
      if (t.x > SPACE + LANE + 0.05) expect(Math.abs(t.z + LANE)).toBeLessThan(0.15);
    }
  });

  it('with the rear section too: both hitches hold through a lane change and each section ends over its own space', () => {
    // Arrange
    const spaces = [{ x: 0, z: 0 }, { x: SPACE, z: 0 }, { x: SPACE + LANE, z: -LANE }, { x: 2 * SPACE + LANE, z: -LANE }, { x: 3 * SPACE + LANE, z: -LANE }, { x: 4 * SPACE + LANE, z: -LANE }];
    // Act
    const run = driveThrough(spaces, 2);
    // Assert
    for (const [tractor, mid, tail] of run) {
      expect(gap(front(mid), rear(tractor))).toBeLessThan(1e-6);
      expect(gap(front(tail), rear(mid))).toBeLessThan(1e-6);
    }
    const [, mid, tail] = run.at(-1)!;
    expect(gap(mid, spaces[4])).toBeLessThan(0.1);
    expect(gap(tail, spaces[3])).toBeLessThan(0.1);
  });

  it('with the rear section too: stopped right after a lane change, the trailers bridge the two lanes over their spaces', () => {
    // Arrange: the tractor has just changed lane; the middle section is on the space it left, the rear one behind.
    const spaces = [{ x: 0, z: 0 }, { x: SPACE, z: 0 }, { x: 2 * SPACE, z: 0 }, { x: 2 * SPACE + LANE, z: -LANE }];
    // Act
    const [tractor, mid, tail] = driveThrough(spaces, 2).at(-1)!;
    // Assert: no section farther than a third of a space from the middle of its own.
    expect(gap(tractor, spaces[3])).toBeLessThan(1e-6);
    expect(gap(mid, spaces[2])).toBeLessThan(SPACE / 3);
    expect(gap(tail, spaces[1])).toBeLessThan(SPACE / 3);
  });

  it('a trailer told where it headed a moment ago turns no more than allowed since', () => {
    // Arrange: a trail along the road; a trailer that stood across it.
    const trail = straight(4), tractor: Placed = { x: 3 * SPACE, z: 0, yaw: 0 };
    const TURN = 0.05;
    // Act
    const [free] = trainOn(trail, tractor, HALF, 1), [held] = trainOn(trail, tractor, HALF, 1, Math.PI, { yaws: [0.6], turn: TURN });
    // Assert
    expect(free.yaw).toBeCloseTo(0, 9);
    expect(held.yaw).toBeCloseTo(0.6 - TURN, 9);
    expect(gap(front(held), rear(tractor))).toBeLessThan(1e-9);
  });

  it('with no trail yet the trailers stand straight behind the tractor along the road', () => {
    // Arrange: a tractor just placed on its first space.
    const tractor: Placed = { x: 5, z: 2, yaw: 0 };
    // Act
    const [mid, tail] = trainOn([{ x: 5, z: 2 }], tractor, HALF, 2);
    // Assert
    expect(mid.x).toBeCloseTo(5 - SPACE, 9);
    expect(mid.z).toBeCloseTo(2, 9);
    expect(mid.yaw).toBeCloseTo(0, 9);
    expect(tail.x).toBeCloseTo(5 - 2 * SPACE, 9);
    expect(tail.yaw).toBeCloseTo(0, 9);
  });
});
