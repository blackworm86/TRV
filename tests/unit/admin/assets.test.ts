// Whether the official assets the game uses are all there and complete: one file for every card,
// portrait and model the rules data names, and a traced drawing for every die face, token and board.
// Reads the files in assets/ (the repository's own), never the original files outside git.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import RULES from '../../../data/trv/game_base.json';
import SHOPPE from '../../../data/trv/choppe_shoppe.json';
import CARNAGE from '../../../data/trv/carnage.json';

const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const missing = (paths: string[]): string[] => paths.filter(p => !existsSync(p));

describe('extracted official images', () => {
  it('has the card of every Choppe Shoppe upgrade', () => {
    expect(missing(SHOPPE.upgrades.map(u => `assets/choppe_shoppe/carte/potenziamenti/${u.id}.jpg`))).toEqual([]);
  });

  it('has the portrait of every crew leader', () => {
    expect(missing(SHOPPE.leaders.map(l => `assets/choppe_shoppe/capisquadra/${l.id}.jpg`))).toEqual([]);
  });

  it('has the avatar of every crew leader', () => {
    expect(missing(SHOPPE.leaders.map(l => `assets/choppe_shoppe/avatar_personaggi/${l.id}.png`))).toEqual([]);
  });

  it('has the printed art of every damage token front, the six SKID directions included', () => {
    const names = [...new Set((RULES.damage_tokens as { type: string; dir?: string }[]).map(d => (d.dir ? `${d.type}_${d.dir}` : d.type)))];
    expect(missing(names.map(n => `assets/base/segnalini/danno/${n}.jpg`))).toEqual([]);
  });

  it('has the printed Carnage hazard tokens, their back and the two new damage tokens', () => {
    const hazards = Object.keys(CARNAGE.hazard_tokens).filter(k => !k.startsWith('_'));
    expect(missing([...hazards, 'back'].map(h => `assets/carnage/segnalini/pericolo/${h}.jpg`))).toEqual([]);
    const damage = Object.keys(CARNAGE.damage_tokens).filter(k => !k.startsWith('_'));
    expect(missing(damage.map(d => `assets/carnage/segnalini/danno/${d}.jpg`))).toEqual([]);
  });

  it('has the illustration of every upgrade and ongoing effect card, cut without the card frame', () => {
    expect(missing(SHOPPE.upgrades.map(u => `assets/choppe_shoppe/carte/potenziamenti/illustrazioni/${u.id}.jpg`))).toEqual([]);
    expect(missing(CARNAGE.ongoing_effects.map(o => `assets/carnage/carte/effetto_continuo/illustrazioni/${o.id}.jpg`))).toEqual([]);
  });

  it('has the card of every Carnage ongoing effect', () => {
    expect(missing(CARNAGE.ongoing_effects.map(o => `assets/carnage/carte/effetto_continuo/${o.id}.jpg`))).toEqual([]);
  });

  it('has the flame ring of the ON FIRE token, with its measures', () => {
    const ring = json<{ w: number; h: number; r: number }>('assets/carnage/segnalini/on_fire.json');
    expect(existsSync('assets/carnage/segnalini/on_fire.png')).toBe(true);
    expect(ring.r).toBeGreaterThan(0);
    expect(ring.r * 2).toBeLessThanOrEqual(Math.min(ring.w, ring.h));
  });
});

describe('traced official drawings', () => {
  it('traces every face of every base die but the movement die (plain pips)', () => {
    // Arrange
    const traced = json<{ faces: Record<string, unknown> }>('assets/base/vettoriale/traced/dice.json').faces;
    const dice = RULES.dice as Record<string, (number | string)[]>;
    // Act
    const absent = Object.entries(dice).filter(([kind]) => kind !== 'movement')
      .flatMap(([kind, faces]) => [...new Set(faces)].map(v => `${kind}|${v}`)).filter(k => !(k in traced));
    // Assert
    expect(absent).toEqual([]);
  });

  it('traces every hazard token and the back', () => {
    const traced = json<Record<string, unknown>>('assets/base/vettoriale/traced/hazards.json');
    expect([...Object.keys(RULES.hazard_tokens), 'back'].filter(k => !(k in traced))).toEqual([]);
  });

  it('traces every damage token and the back', () => {
    const traced = json<Record<string, unknown>>('assets/base/vettoriale/traced/damage.json');
    const types = [...new Set((RULES.damage_tokens as { type: string }[]).map(d => d.type)), 'back'];
    expect(types.filter(k => !(k in traced))).toEqual([]);
  });

  it('traces the three dashboards and the command board', () => {
    const traced = json<Record<string, unknown>>('assets/base/vettoriale/traced/boards.json');
    expect(['dash_S', 'dash_M', 'dash_L', 'command'].filter(k => !(k in traced))).toEqual([]);
  });

  it('traces the six faces of the Carnage fire die', () => {
    const faces = json<{ faces: Record<string, unknown> }>('assets/carnage/vettoriale/fire_die.json').faces;
    expect(Object.keys(faces)).toHaveLength(6);
    for (const v of new Set(CARNAGE.dice.fire)) expect(faces, v).toHaveProperty(v);
  });
});

describe('3D models', () => {
  it('has every model the game loads', () => {
    const models = ['base/modelli/Car_Small', 'base/modelli/Car_Medium', 'base/modelli/Car_Large', 'base/modelli/Chopper',
      ...[1, 2, 3, 4, 5].map(n => `base/modelli/wreck_${n}`), 'carnage/modelli/Ramp'];
    expect(missing(models.map(m => `assets/${m}.glb`))).toEqual([]);
  });
});
