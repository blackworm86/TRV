import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import rules from '../../../data/trv/game_base.json';
import { ownerDieFaces, OWNER_DIE_ORDER } from '../../../src/view/vector/dice';
import { ownerDamage } from '../../../src/view/vector/damage';
import { dieSvg, hazardTokenSvg, damageTokenSvg, dashboardSvg, commandBoardSvg, onFireTokenSvg, commandTokenSvg, commandIconAt, hasCommandIcon, playerStripSvg } from '../../../src/view/vector/art';
import { parseStrip, pathPoints } from '../../../src/view/vector/boards';

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
  it('draws the base damage tokens on the owner’s outline, with the printed art inside the red frame', () => {
    // Arrange
    const own = ownerDamage(readFileSync('assets/base/segnalini/danno/template.svg', 'utf8'))!;
    for (const type of ['shrapnel', 'dazed', 'dent', 'blastoff']) {
      // Act
      const s = damageTokenSvg(type, true);
      // Assert: the owner's frame, then the picture laid on the frame's outer edges, shown only inside it.
      expect(s).toContain('fill="#d42a2f"');
      expect(s).toMatch(new RegExp(`<image href="[^"]*/${type}[^"/]*\\.jpg" x="33.09" y="44" width="213.82"`));
      expect(s).toContain(`<clipPath id="dmg-inner"><path d="${own.frontInner}"/>`);
    }
    // The inside of the frame starts inside the outer edge, below the top.
    expect(own.frontInner).toMatch(/^M233\.82,57\.09/);
  });
  it('draws the damage token back from the owner’s drawing, with no printed picture', () => {
    const back = damageTokenSvg(null, false);
    expect(back).not.toContain('<image');
    expect(back).toContain('translate(-293.09 -44)');
    expect(back).toContain('stroke="#d42a2f"');
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
      expect(s).toContain('clip-path="url(#dmg-inner)"');
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
  it('draws the command token from the owner’s drawing, and lays it on a command that has one', () => {
    // Arrange
    const token = commandTokenSvg();
    // Act
    const board = commandBoardSvg({ color: '#ec9230', used: null, tokenOn: ['nitro'] });
    // Assert: the off-white tile with the navy star (as printed, Choppe Shoppe rulebook p. 3), nested in the board on the command.
    expect(token).toContain('#efede7');
    expect(token).toContain('#141528');
    expect(board).toContain('#efede7');
    expect(commandBoardSvg({ color: '#ec9230', used: null })).not.toContain('#efede7');
  });
  it('shows each command as its icon, with its name, dice and effect kept for the pop-up', () => {
    // Arrange
    const ids = ['airstrike', 'nitro', 'drift', 'repair'];
    // Act
    const board = commandBoardSvg({ color: '#ec9230', used: null });
    // Assert: an icon per command (each with masks of its own), the words on the quarter, no written effect.
    for (const id of ids) expect(hasCommandIcon(id)).toBe(true);
    expect(board.match(/<mask id="k\d+-/g)?.length).toBeGreaterThanOrEqual(2); // drift and repair cut gaps
    expect(new Set(board.match(/<mask id="k\d+-[a-z]+"/g)).size).toBe(board.match(/<mask id="k\d+-[a-z]+"/g)!.length);
    expect(board).toContain('data-cmd-name="NITRO"');
    expect(board).toContain('data-cmd-text="Aggiungi il dado al movimento dell’auto."');
    expect(board).not.toContain('>Aggiungi il dado<');
  });
  it('has an icon for every crew leader command', () => {
    for (const id of ['bump', 'pain_transfer', 'need_for_speed', 'called_shot', 'tinker', 'show_time', 'flamethrower']) expect(hasCommandIcon(id)).toBe(true);
    expect(commandIconAt('nope', 0, 0, 10, '#000')).toBe('');
  });
  it('reads the command board out of the owner’s strip drawing: cross, sectors and die slots', () => {
    // Arrange
    const raw = readFileSync('assets/base/plance/plancia_striscia.svg', 'utf8');
    // Act
    const s = parseStrip(raw)!;
    // Assert: the cross of four equal arms in the middle of the coloured panel, a slot in each corner.
    expect(s.mid).toEqual([179.1, 155.1]);
    expect(s.arm).toBeCloseTo(67.75, 2);
    expect(s.slots.map(p => p.map(v => Math.round(v)))).toEqual([[94, 70], [264, 70], [94, 240], [264, 240]]);
    expect(s.panel).toEqual([91.3, 67.5, 266.8, 242.7]);
  });
  it('walks a path’s relative and absolute segments to its end points', () => {
    expect(pathPoints('M10,10 l5,0 v5 H0 c1,1,2,2,3,3 z')).toEqual([[10, 10], [15, 10], [15, 15], [0, 15], [3, 18], [10, 10]]);
  });
  it('draws the strip with the leader’s tab, the Undo plate, the heaped tokens and the icons in their sectors', () => {
    // Arrange
    const leader = { name: 'Ms. Betty', title: 'The Tinkerer', power: 'Bring the Bling', powerText: 'Tieni una carta in più.', tokens: 2 };
    const dash = { carId: 'p0S', size: 'S' as const, color: '#ec9230', status: 'ok' as const, placed: [], damage: 0 };
    // Act
    const strip = playerStripSvg({ color: '#ec9230', used: null, leader, undo: 'off' }, [dash])!;
    const plain = playerStripSvg({ color: '#ec9230', used: null }, [dash])!;
    // Assert
    expect(strip).toContain('data-strip="2"');
    expect(strip).toContain('class="ptab"');
    expect(strip).toContain('BRING THE');
    expect(strip).toContain('class="undoplate off"');
    expect(strip.match(/filter="url\(#tokshadow\)"/g)?.length).toBe(2);
    expect(plain).not.toContain('class="ptab"');
    expect(plain).not.toContain('undoplate');
    // The airstrike icon centred in the top-left sector: half an arm left of and above the cross's
    // centre, moved like the whole board to meet the dashboards (-18.45, -24.97).
    const cx = 179.1 - 67.75 / 2 - 18.45, cy = 155.1 - 67.75 / 2 - 24.97, size = 67.75 * 0.915;
    const icon = commandIconAt('airstrike', cx, cy, size, '#000');
    const at = /<svg x="([-\d.]+)" y="([-\d.]+)"/.exec(icon)!;
    expect(strip).toContain(`<svg x="${at[1]}" y="${at[2]}"`);
  });
  it('lays the ON FIRE token over the move slot of a burning car', () => {
    const dash = { carId: 'p0S', size: 'S' as const, color: '#ec9230', status: 'ok' as const, placed: [], damage: 0 };
    const token = onFireTokenSvg().replace(/^<svg[^>]*>|<\/svg>$/g, '');
    expect(dashboardSvg({ ...dash, onFire: true })).toContain(token);
    expect(dashboardSvg(dash)).not.toContain(token);
  });
});
