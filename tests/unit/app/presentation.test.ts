// The presentation data (data/trv/presentation_base.json) as the client reads it (src/app/presentation.ts).
import { describe, expect, it } from 'vitest';
import { P, camelKeys } from '../../../src/app/presentation';

describe('presentation data', () => {
  it('turns snake_case keys into camelCase at every depth and drops the notes', () => {
    // Arrange
    const raw = { _comment: 'note', map_view: { fit_side: 1, _module: 'x', list: [{ one_wheel: 2 }] } };
    // Act
    const out = camelKeys(raw);
    // Assert
    expect(out).toEqual({ mapView: { fitSide: 1, list: [{ oneWheel: 2 }] } });
  });

  it('gives the client every value it reads, as numbers', () => {
    const numbers = [
      P.jump.climb, P.jump.land, P.jump.gravity, P.jump.lean, P.jump.slowMotion.speed,
      P.director.shot.blendIn, P.director.lift, P.chase.fov, P.chaseDice.size, P.mapView.fit.side,
      P.mapView.swap, P.replay.speed, P.burst.rounds, P.drive.speed, P.beats.seconds.move, P.beats.speedScale.full,
    ];
    for (const n of numbers) expect(typeof n).toBe('number');
    expect(P.replay.camera).toHaveLength(3);
  });

  it('names only looks that exist for every ground, and gives mud and slime their wet drops', () => {
    for (const looks of Object.values(P.trail.ground)) for (const name of looks) expect(P.trail.looks[name]).toBeDefined();
    for (const g of ['M', 'G']) expect(P.trail.liquids[g].gravity).toBeGreaterThan(0);
    expect(P.route.top).toBeGreaterThan(P.route.crawl);
  });

  it('has jump odds that add up to one for every length from one to four spaces', () => {
    for (const n of [1, 2, 3, 4]) {
      const sum = Object.values(P.jump.odds[n]).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it('never lets a jump of one or two spaces turn over', () => {
    for (const n of [1, 2]) {
      expect(P.jump.odds[n].barrel ?? 0).toBe(0);
      expect(P.jump.odds[n].backflip ?? 0).toBe(0);
    }
  });
});
