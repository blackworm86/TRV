import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import rules from '../../../data/trv/game_base.json';
import { ownerDieFaces, OWNER_DIE_ORDER } from '../../../src/view/vector/dice';
import { ownerDamage } from '../../../src/view/vector/damage';
import { dieSvg, hazardTokenSvg, damageTokenSvg, dashboardSvg, commandBoardSvg, onFireTokenSvg } from '../../../src/view/vector/art';

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
      const raw = readFileSync(`assets/base/dadi/${kind}.svg`, 'utf8');
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
    const own = ownerDamage(readFileSync('assets/base/segnalini/danno/template.svg', 'utf8'));
    expect(own).not.toBeNull();
    for (const side of [own!.front, own!.back]) {
      expect(side).not.toContain('class=');
      expect(side).toContain('#15171c');
    }
    expect(own!.front).toContain('#d42a2f'); // the red frame
    expect(own!.back).toContain('stroke="#d42a2f"'); // the warning sign
  });
  it('shows the base game damage tokens as printed, cut with the owner’s outline', () => {
    // Arrange / Act / Assert: each front is its own printed token inside the front's outline.
    for (const type of ['shrapnel', 'dazed', 'dent', 'blastoff']) {
      const s = damageTokenSvg(type, true);
      expect(s).toMatch(new RegExp(`<image href="[^"]*/${type}[^"/]*\\.jpg"`));
      expect(s).toMatch(/<clipPath id="dmg-front"><path transform="[^"]*translate\(-33\.09 -44\)"/);
    }
    // The back, with the back's outline.
    expect(damageTokenSvg(null, false)).toMatch(/<clipPath id="dmg-back"><path transform="[^"]*translate\(-293\.09 -44\)"/);
  });
  it('shows each SKID token with its own direction', () => {
    for (const dir of ['F', 'FL', 'FR', 'B', 'BL', 'BR'] as const) {
      expect(damageTokenSvg('skid', true, dir)).toMatch(new RegExp(`<image href="[^"]*/skid_${dir}[^"/]*\\.jpg"`));
    }
  });
  it('shows the Carnage damage tokens as printed, cut with the base tokens’ outline', () => {
    for (const type of ['on_fire', 'ongoing_effect']) {
      const s = damageTokenSvg(type, true);
      expect(s).toMatch(new RegExp(`<image href="[^"]*carnage/segnalini/danno/${type}[^"/]*\.jpg"`));
      expect(s).toContain('clip-path="url(#dmg-front)"');
    }
  });
  it('shows the Carnage hazard tokens as printed, in the base chevron, with the expansion’s own back', () => {
    for (const type of ['desert_glass', 'ramp', 'fire', 'pit_trap', 'quake', 'sand_worm']) {
      const front = hazardTokenSvg(type, true);
      expect(front).toMatch(new RegExp(`<image href="[^"]*pericolo/${type}[^"/]*\.jpg"`));
      expect(front).toContain('clip-path="url(#hz-print)"');
      expect(hazardTokenSvg(type, false)).toMatch(/<image href="[^"]*pericolo\/back[^"/]*\.jpg"/);
    }
    // The base game's tokens keep the base back.
    expect(hazardTokenSvg('mud', false)).not.toContain('pericolo/back');
  });
  it('lays the ON FIRE token over the move slot of a burning car', () => {
    const dash = { carId: 'p0S', size: 'S' as const, color: '#ec9230', status: 'ok' as const, placed: [], damage: 0 };
    const token = onFireTokenSvg().replace(/^<svg[^>]*>|<\/svg>$/g, '');
    expect(dashboardSvg({ ...dash, onFire: true })).toContain(token);
    expect(dashboardSvg(dash)).not.toContain(token);
  });
});
