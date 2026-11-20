// A helicopter holding its place in the air (src/app/motion/hover.ts).
import { describe, expect, it } from 'vitest';
import { hoverPose, type HoverTuning } from '../../../src/app/motion/hover';
import { P } from '../../../src/app/presentation';

/** Round numbers, so the bounds are plain to read. */
const H: HoverTuning = { lift: 0.1, roll: 0.08, pitch: 0.04, yaw: 0.05, sway: 0.1, surge: 0.06, speed: 1.5, ease: 2 };
/** One pose every 50 ms for a minute. */
const minute = (phase = 0, amount = 1): ReturnType<typeof hoverPose>[] => Array.from({ length: 1200 }, (_, i) => hoverPose(i * 0.05, phase, amount, H));
const span = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);

describe('a hovering helicopter', () => {
  it('rises and sinks, rolls and pitches, never beyond its tuning', () => {
    // Act
    const poses = minute();
    // Assert: it moves on every axis, within the given reach.
    for (const k of ['lift', 'roll', 'pitch', 'yaw', 'sway', 'surge'] as const) {
      const xs = poses.map(p => p[k]);
      expect(span(xs)).toBeGreaterThan(H[k]);
      expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(H[k] + 1e-9);
    }
  });

  it('slides toward the side it leans to: its sideways speed follows its roll', () => {
    // Act: where the roll is clearly to one side, the slide goes that way.
    const dt = 0.01;
    for (let t = 0; t < 30; t += 0.37) {
      const p = hoverPose(t, 0, 1, H), next = hoverPose(t + dt, 0, 1, H);
      if (Math.abs(p.roll) < H.roll * 0.3) continue;
      // Assert
      expect(Math.sign(next.sway - p.sway)).toBe(Math.sign(p.roll));
    }
  });

  it('is exactly at rest on the ground, and fades in between', () => {
    // Act
    const ground = minute(0, 0), half = hoverPose(3, 0, 0.5, H), full = hoverPose(3, 0, 1, H);
    // Assert
    expect(ground.every(p => Object.values(p).every(v => v === 0))).toBe(true);
    expect(half.lift).toBeCloseTo(full.lift / 2, 12);
    expect(half.roll).toBeCloseTo(full.roll / 2, 12);
  });

  it('is out of step with another one by its phase', () => {
    // Act
    const a = hoverPose(2, 0, 1, H), b = hoverPose(2, 1.9, 1, H);
    // Assert
    expect(a.lift).not.toBeCloseTo(b.lift, 4);
  });

  it('is tuned without overdoing it: small tips and a rise well under its own height', () => {
    // Assert: the values of data/trv/presentation_base.json.
    const T = P.motion.hover;
    expect(T.lift).toBeGreaterThan(0);
    expect(T.lift).toBeLessThan(0.2);
    expect(T.roll).toBeLessThan(0.12);
    expect(T.pitch).toBeLessThan(0.12);
  });
});
