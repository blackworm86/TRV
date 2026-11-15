import { describe, it, expect } from 'vitest';
import rules from '../../../data/trv/game_base.json';
import { dieSvg, hazardTokenSvg, damageTokenSvg, dashboardSvg, commandBoardSvg } from '../../../src/view/vector/art';

describe('vector art', () => {
  it('draws every face of every die in the rules', () => {
    for (const [kind, faces] of Object.entries(rules.dice)) {
      for (const value of faces as (string | number)[]) {
        const s = dieSvg({ kind, value, color: '#ec9230' });
        expect(s.startsWith('<svg')).toBe(true);
        expect(s.endsWith('</svg>')).toBe(true);
      }
    }
  });
  it('draws every hazard and damage token, front and back', () => {
    for (const t of Object.keys(rules.hazard_tokens)) expect(hazardTokenSvg(t, true)).not.toBe(hazardTokenSvg(null, false));
    for (const d of rules.damage_tokens) expect(damageTokenSvg(d.type, true)).toContain('</svg>');
  });
  it('marks the dashboard and command board slots where a die can be dropped', () => {
    const dash = dashboardSvg({ carId: 'p0S', size: 'S', color: '#ec9230', status: 'ok', placed: [], damage: 1 });
    expect(dash).toContain('data-drop="move:p0S"');
    expect(dash).toContain('data-drop="coast:p0S"');
    const cmd = commandBoardSvg({ color: '#ec9230', used: null });
    for (const c of Object.keys(rules.commands)) expect(cmd).toContain(`data-drop="cmd:${c}"`);
  });
});
