// The Big Rig's questions answered on its boards (src/app/rigchoice.ts). Regression for the bug seen
// by the user on 2026-11-20: the Big Rig's Repair asked "Scegli l'auto da riparare" and no system
// could be picked, because its question (kind 'repair', options naming systems) was taken for the
// cars' repair, answered by clicking a car.
import { describe, expect, it } from 'vitest';
import { picksRigSystem } from '../../../src/app/rigchoice';
import type { Decision } from '../../../src/game/trv/engine';

/** A question of player 0 with options naming the given systems or cars. */
const ask = (kind: Decision['kind'], options: { rig?: string; carId?: string }[]): Decision =>
  ({ kind, player: 0, prompt: 'Grigio: ?', options: options.map(o => ({ label: o.rig ?? o.carId ?? '', ...o })) }) as Decision;

describe('Big Rig choices on its boards', () => {
  it('a minor damage is placed by clicking a system', () => {
    // Arrange
    const d = ask('rigDamage', [{ rig: 'front:0' }, { rig: 'mid:2' }]);
    // Act, Assert
    expect(picksRigSystem(d)).toBe(true);
  });

  it('the Big Rig repair is answered by clicking the damaged system to clear', () => {
    // Arrange: two damaged systems on the middle section.
    const d = ask('repair', [{ rig: 'mid:0' }, { rig: 'mid:2' }]);
    // Act, Assert
    expect(picksRigSystem(d)).toBe(true);
  });

  it('a car repair is still answered by clicking a car, and no question means nothing to pick', () => {
    // Arrange
    const d = ask('repair', [{ carId: 'p1S' }, { carId: 'p1M' }]);
    // Act, Assert
    expect(picksRigSystem(d)).toBe(false);
    expect(picksRigSystem(null)).toBe(false);
  });
});
