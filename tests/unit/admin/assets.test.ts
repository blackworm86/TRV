// Whether the official assets the game uses are all there and complete: one file for every card,
// portrait and model the rules data names, and a traced drawing for every die face, token and board.
// Reads the files in assets/ (the repository's own), never the original files outside git.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import RULES from '../../../data/trv/game_base.json';
import SHOPPE from '../../../data/trv/choppe_shoppe.json';
import CARNAGE from '../../../data/trv/carnage.json';
import BIG_RIG from '../../../data/trv/big_rig_final_five.json';

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

  it('has the Big Rig and Final Five pieces, one dashboard per motorcycle marking, cut out with transparency', () => {
    // Arrange
    const boards = ['motrice', 'sezione_front', 'sezione_mid', 'sezione_rear', 'comandi_final_five'];
    const dashboards = BIG_RIG.final_five.markings.map(m => `cruscotto_${m}`);
    const paths = [...[...boards, ...dashboards].map(id => `assets/big_rig/plance/${id}.webp`), 'assets/big_rig/segnalini/danno_minore.webp'];
    // Act
    const absent = missing(paths);
    // Assert: a WebP with an alpha channel says VP8X with the alpha bit, or is lossless VP8L.
    expect(absent).toEqual([]);
    for (const p of paths) {
      const b = readFileSync(p);
      expect(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), p).toBe('RIFFWEBP');
      const chunk = b.toString('ascii', 12, 16);
      expect(chunk === 'VP8L' || (chunk === 'VP8X' && (b[20] & 0x10) !== 0), p).toBe(true);
    }
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

  it('traces the six faces of the Carnage fire die', () => {
    const faces = json<{ faces: Record<string, unknown> }>('assets/carnage/vettoriale/fire_die.json').faces;
    expect(Object.keys(faces)).toHaveLength(6);
    for (const v of new Set(CARNAGE.dice.fire)) expect(faces, v).toHaveProperty(v);
  });
});

describe('3D models', () => {
  it('has every model the game loads', () => {
    const models = [...['s', 'm', 'l'].map(k => `base/modelli/car_${k}_body`), 'base/modelli/car_s_wheel', 'base/modelli/car_m_wheel', 'big_rig/modelli/big_rig_wheel',
      'big_rig/modelli/motorcycle', 'base/modelli/Chopper',
      ...[1, 2, 3, 4, 5].map(n => `base/modelli/wreck_${n}`), 'carnage/modelli/Ramp'];
    expect(missing(models.map(m => `assets/${m}.glb`))).toEqual([]);
  });
});
