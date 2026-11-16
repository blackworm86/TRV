import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import rules from '../../../data/trv/game_base.json';
import { ownerDieFaces, OWNER_DIE_ORDER } from '../../../src/view/vector/dice';
import { ownerDamage } from '../../../src/view/vector/damage';
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
  it('cuts the six faces out of the owner’s dice drawings, without captions or classes', () => {
    for (const kind of ['direction', 'slam']) {
      const raw = readFileSync(`assets/ui/dice/${kind}.svg`, 'utf8');
      const faces = ownerDieFaces(raw, OWNER_DIE_ORDER[kind]);
      expect([...faces.keys()].sort()).toEqual([...new Set(OWNER_DIE_ORDER[kind])].sort());
      for (const body of faces.values()) {
        expect(body).not.toContain('class=');
        expect(body.match(/<rect /g)).toHaveLength(1);
      }
    }
  });
  it('draws the direction and slam dice from the owner’s drawings', () => {
    expect(dieSvg({ kind: 'direction', value: 'FL', forward: 'up' })).toContain('#84509b');
    expect(dieSvg({ kind: 'direction', value: 'FL' })).toContain('rotate(90 50 50)');
    expect(dieSvg({ kind: 'slam', value: 'top' })).toContain('#dc2f37');
    expect(dieSvg({ kind: 'slam', value: 'top' })).not.toBe(dieSvg({ kind: 'slam', value: 'bottom' }));
  });
  it('cuts front and back out of the owner’s damage token template', () => {
    const own = ownerDamage(readFileSync('assets/ui/damage/template.svg', 'utf8'));
    expect(own).not.toBeNull();
    for (const side of [own!.front, own!.back]) {
      expect(side).not.toContain('class=');
      expect(side).toContain('#15171c');
    }
    expect(own!.front).toContain('#d42a2f'); // the red frame
    expect(own!.back).toContain('stroke="#d42a2f"'); // the warning sign
  });
  it('draws every damage token on the owner’s outline, with its title', () => {
    for (const type of ['shrapnel', 'dazed', 'dent', 'skid', 'blastoff', 'on_fire', 'ongoing_effect']) {
      const s = damageTokenSvg(type, true, 'FL');
      expect(s).toContain('translate(-33.09 -44)');
      expect(s).toMatch(/<text[^>]*>[A-Z ]+<\/text>/);
    }
    expect(damageTokenSvg(null, false)).toContain('translate(-293.09 -44)');
  });
});
