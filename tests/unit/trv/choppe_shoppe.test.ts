// Choppe Shoppe, crew leaders and command tokens (reference/rulebook/TRV-CS_Rulebook.pdf).
import { describe, it, expect } from 'vitest';
import shoppe from '../../../data/trv/choppe_shoppe.json';
import {
  newGame, play, neighbor, leaders, leaderOf, commandsOf, samePos,
  upgrades, vehiclesAt, type Game, type Decision, type Pos, type Dir,
} from '../../../src/game/trv/engine';
import rules from '../../../data/trv/game_base.json';

const SEED = (n: number): string => n.toString(16).padStart(8, '0').padEnd(64, 'c');
const NAMES = [
  { name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' },
  { name: 'Verde', color: '#3a3' }, { name: 'Giallo', color: '#db2' },
];
const GAMES = 60;
const DEALABLE = leaders().filter(l => !l.needs?.length);

interface Seen { d: Decision; choice: number; g: Game }

/** Plays a whole game with a pseudo-random chooser that avoids deadly steps; `see` gets every decision. */
function run(seed: number, setup: { leaders?: boolean; fixed?: (string | undefined)[]; players?: number; upgrades?: boolean; ups?: (string[] | undefined)[] },
  see: (s: Seen) => void = () => {}): Game {
  const n = setup.players ?? setup.fixed?.length ?? setup.ups?.length ?? 3;
  const g = newGame({
    seed: SEED(seed), startSide: 'a', ...(setup.leaders ? { leaders: true } : {}), ...(setup.upgrades ? { upgrades: true } : {}),
    players: NAMES.slice(0, n).map((p, i) => ({
      ...p, ...(setup.fixed?.[i] ? { leader: setup.fixed[i] } : {}), ...(setup.ups?.[i] ? { upgrades: setup.ups[i] } : {}),
    })),
  });
  const it = play(g);
  let r = it.next(0);
  let x = seed * 7919 + 1;
  for (let k = 0; !r.done; k++) {
    if (k > 20000) throw new Error('game did not end');
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const safe = r.value.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
    const pool = safe.length ? safe : r.value.options.map((o, i) => ({ o, i }));
    // The two rare yes/no upgrades are always taken, so that they are seen.
    const choice = r.value.kind === 'swap' || r.value.kind === 'redButton' ? 1 : pool[x % pool.length].i;
    see({ d: r.value, choice, g });
    r = it.next(choice);
  }
  return g;
}

const tokensInPlay = (g: Game): number =>
  g.tokenSupply + g.players.reduce((n, p) => n + p.tokens + Object.values(p.slots).filter(s => s === 'token').length, 0);

describe('crew leader setup', () => {
  it('deals two different dealable leaders to each player, who keeps one and takes its command tokens', () => {
    for (let s = 1; s <= GAMES; s++) {
      const offered: string[] = [];
      const g = run(s, { leaders: true, players: 2 + (s % 3) }, ({ d }) => {
        if (d.kind !== 'leader') return;
        expect(d.options.length).toBe(shoppe.leaders_dealt);
        for (const o of d.options) offered.push(o.leader!);
      });
      expect(new Set(offered).size).toBe(offered.length);
      for (const id of offered) expect(DEALABLE.some(l => l.id === id)).toBe(true);
      for (const p of g.players) expect(offered).toContain(p.leader);
    }
  });
  it('gives each leader the command tokens printed on its board', () => {
    const ids = ['asha', 'bumpo', 'vince'];
    const g = newGame({ seed: SEED(1), startSide: 'a', players: NAMES.slice(0, 3).map((p, i) => ({ ...p, leader: ids[i] })) });
    expect(g.players.map(p => p.tokens)).toEqual(ids.map(id => leaders().find(l => l.id === id)!.tokens));
    expect(tokensInPlay(g)).toBe(shoppe.command_tokens);
  });
  it('keeps the standard command board for a player without a leader', () => {
    const g = newGame({ seed: SEED(1), startSide: 'a', players: NAMES.slice(0, 2) });
    expect(leaderOf(g.players[0])).toBeNull();
    expect(commandsOf(g.players[0]).map(c => c.id)).toEqual(['airstrike', 'nitro', 'drift', 'repair']);
  });
});

describe('commands and command tokens', () => {
  it('ends every game with leaders with a winner, and never creates or loses a command token', () => {
    for (let s = 1; s <= GAMES; s++) {
      const g = run(s, { leaders: true, players: 2 + (s % 3) }, ({ g: now }) => expect(tokensInPlay(now)).toBe(shoppe.command_tokens));
      expect(g.winner).not.toBeNull();
    }
  });
  it('offers a die only on a command whose printed values include it, never on a token-only command', () => {
    let seen = 0;
    for (let s = 1; s <= GAMES; s++) {
      run(s, { leaders: true }, ({ d, g }) => {
        if (d.kind !== 'command') return;
        const board = commandsOf(g.players[d.player]);
        for (const o of d.options.slice(1)) {
          const slot = board.find(c => c.id === o.command)!;
          expect(slot.token).not.toBe(true);
          expect(slot.values).toContain(o.dieValue);
          seen++;
        }
      });
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('offers a command token only with tokens in hand, on a free command, and never on a coasting turn', () => {
    let seen = 0;
    for (let s = 1; s <= GAMES; s++) {
      let coasting = false;
      run(s, { leaders: true }, ({ d, choice, g }) => {
        if (d.kind === 'assign') coasting = !!d.options[choice].coast;
        if (d.kind !== 'token') return;
        seen++;
        const p = g.players[d.player];
        expect(coasting).toBe(false);
        expect(p.tokens).toBeGreaterThan(0);
        for (const o of d.options.slice(1)) expect(p.slots[o.command!]).toBeUndefined();
      });
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('spends the token: it leaves the hand and returns to the supply at the end of the round', () => {
    let spent = 0;
    for (let s = 1; s <= GAMES && !spent; s++) {
      const g = run(s, { fixed: ['asha', undefined] });
      spent = leaders().find(l => l.id === 'asha')!.tokens - g.players[0].tokens;
    }
    expect(spent).toBeGreaterThan(0);
  });
});

describe('leader powers', () => {
  const logs = (fixed: (string | undefined)[], match: RegExp): string[] => {
    const out: string[] = [];
    for (let s = 1; s <= GAMES; s++) out.push(...run(s, { fixed }).log.map(l => l.text).filter(t => match.test(t)));
    return out;
  };
  it('Redline: a 6 assigned to a car of Cris Crass moves it 7', () => {
    let checked = 0;
    for (let s = 1; s <= GAMES; s++) {
      const g = run(s, { fixed: ['cris', undefined] });
      g.log.forEach((l, i) => {
        if (!l.text.startsWith('Redline')) return;
        const move = g.log.slice(i).find(x => /^Rosso muove/.test(x.text));
        if (!move) return;
        expect(Number(/ di (\d+)/.exec(move.text)![1])).toBeGreaterThanOrEqual(shoppe.redline.to);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('Jury-Rigging: every damage token on a car of Asha stays face down, without effect', () => {
    let seen = 0;
    for (let s = 1; s <= GAMES; s++) {
      const g = run(s, { fixed: ['asha', undefined] });
      for (const f of g.frames) {
        if (f.kind !== 'damage' || !f.vehicleId?.startsWith('p0')) continue;
        expect(f.token ?? null).toBeNull();
        if (f.faceDown) seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('Long Arm of the Law: Wong shoots up to two spaces away, the others only into the front arc', () => {
    const arc = (p: Pos): Pos[] => (['FL', 'F', 'FR'] as Dir[]).map(d => neighbor(p, d));
    const within = (from: Pos, to: Pos, range: number): boolean => {
      let ring = [from];
      for (let n = 0; n < range; n++) { ring = ring.flatMap(arc); if (ring.some(q => samePos(q, to))) return true; }
      return false;
    };
    let far = 0;
    for (let s = 1; s <= GAMES; s++) {
      run(s, { fixed: ['wong', undefined] }, ({ d, g }) => {
        if (d.kind !== 'shoot') return;
        const car = g.vehicles.find(v => v.id === g.activeCar)?.pos ?? null;
        const origins = [car, g.players[d.player].chopper].filter((p): p is Pos => !!p);
        for (const o of d.options.slice(1)) {
          const range = d.player === 0 ? shoppe.long_arm_range : 1;
          expect(origins.some(from => within(from, o.pos!, range))).toBe(true);
          if (d.player === 0 && !origins.some(from => within(from, o.pos!, 1))) far++;
        }
      });
    }
    expect(far).toBeGreaterThan(0);
  });
  it('Objection!: Machine Gun Joe is asked to reroll only after a miss', () => {
    let asked = 0;
    for (let s = 1; s <= GAMES; s++) {
      run(s, { fixed: ['joe', undefined] }, ({ d, g }) => {
        if (d.kind !== 'shootReroll') return;
        asked++;
        expect(d.player).toBe(0);
        expect(g.log[g.log.length - 1].text).toMatch(/mancato/);
      });
    }
    expect(asked).toBeGreaterThan(0);
  });
  it('Called Shot and Spotter hit without rolling the shooting die', () => {
    for (const fixed of [['boudreaux', undefined], ['abigail', undefined]]) {
      let auto = 0;
      for (let s = 1; s <= GAMES; s++) {
        const g = run(s, { fixed });
        g.log.forEach((l, i) => {
          if (!/colpo automatico/.test(l.text)) return;
          auto++;
          expect(g.log[i + 1].text).toMatch(/subisce danno|è eliminat|già fuori uso/);
        });
      }
      expect(auto).toBeGreaterThan(0);
    }
  });
  it('Third Eye: Madame Boudreaux peeks at a face-down hazard each round, and the log does not tell which', () => {
    let peeks = 0;
    for (let s = 1; s <= GAMES; s++) {
      const g = run(s, { fixed: ['boudreaux', undefined] }, ({ d, g: now }) => {
        if (d.kind !== 'peek') return;
        peeks++;
        for (const o of d.options) expect(now.hazards.get(`${o.pos!.r},${o.pos!.c}`)!.faceUp).toBe(false);
      });
      expect(g.log.some(l => /Solo per/.test(l.text))).toBe(false);
    }
    expect(peeks).toBeGreaterThan(0);
  });
  it('Trash into Treasure: Cruft gains a command token on a face-down hazard', () => {
    expect(logs(['cruft', undefined], /^Trash into Treasure/).length).toBeGreaterThan(0);
  });
  it('Soul Siphon, Pain Transfer, Bump!, Junk in the Trunk and Need for Speed all happen in play', () => {
    expect(logs(['vince', undefined], /^Soul Siphon/).length).toBeGreaterThan(0);
    expect(logs(['vince', undefined], /^Pain Transfer/).length).toBeGreaterThan(0);
    expect(logs(['bumpo', undefined], /^Bump!/).length).toBeGreaterThan(0);
    expect(logs(['bumpo', undefined], /^Junk in the Trunk/).length).toBeGreaterThan(0);
    expect(logs(['cris', undefined], /^Need for Speed/).length).toBeGreaterThan(0);
  });
  it('replays the same game with leaders from the same seed and choices', () => {
    expect(run(9, { leaders: true }).log).toEqual(run(9, { leaders: true }).log);
  });
});

describe('upgrade cards', () => {
  const N = (id: string): number => upgrades().find(u => u.id === id)!.n!;
  /** Games where every car of the first player (Rosso) has the same upgrade. */
  const each = (id: string, see: (s: Seen) => void = () => {}, games = GAMES): Game[] => {
    const out: Game[] = [];
    for (let s = 1; s <= games; s++) out.push(run(s, { ups: [[id, id, id], undefined, undefined] }, see));
    return out;
  };
  const said = (games: Game[], match: RegExp): number => games.reduce((n, g) => n + g.log.filter(l => match.test(l.text)).length, 0);
  const arc = (p: Pos): Pos[] => (['FL', 'F', 'FR'] as Dir[]).map(d => neighbor(p, d));
  /** Where a shoot decision is taken from: the chopper, or the car that just moved. */
  const origin = (d: Decision, g: Game): Pos | null =>
    (/elicottero/.test(d.prompt) ? g.players[d.player].chopper : g.vehicles.find(v => v.id === g.activeCar)?.pos) ?? null;

  it('drafts four cards down to three for each player, and puts a different upgrade on every car', () => {
    for (let s = 1; s <= 20; s++) {
      const hands: number[] = [];
      const g = run(s, { upgrades: true, players: 2 + (s % 3) }, ({ d }) => { if (d.kind === 'draft') hands.push(d.options.length); });
      const perRound = g.players.length;
      expect(hands).toEqual(Array.from({ length: shoppe.upgrades_kept * perRound }, (_, i) => shoppe.upgrades_dealt - Math.floor(i / perRound)));
      const cars = g.vehicles.filter(v => !v.isWreck);
      expect(cars.every(v => upgrades().some(u => u.id === v.upgrade))).toBe(true);
      expect(new Set(cars.map(v => v.upgrade)).size).toBe(cars.length);
      expect(g.winner).not.toBeNull();
    }
  });
  it('leaves the cars without upgrades when the game does not use them', () => {
    expect(run(1, {}).vehicles.every(v => v.upgrade === null)).toBe(true);
  });
  it('lets every upgrade that speaks in the log do its thing in play', () => {
    const lines: [string, RegExp][] = [
      ['grappling_hook', /^Grappling Hook/], ['snowplow', /^Snowplow/], ['big_red_button', /^Big Red Button/],
      ['armor_plating', /Armor Plating/], ['onboard_computer', /resta coperto e senza effetto/], ['ghost_mode', /^Ghost Mode/],
      ['skull_shift_knob', /^Skull Shift Knob/], ['oil_dispenser', /^Oil Dispenser/], ['mine_dispenser', /^Mine Dispenser/],
      ['roll_cage', /^Roll Cage/], ['crumple_zones', /^Crumple Zones/], ['stability_control', /^Stability Control/],
      ['boost_switch', /^Boost Switch/], ['assault_bumper', /^Assault Bumper/], ['anti_aircraft_radar', /^Anti-Aircraft Radar/],
    ];
    for (const [id, match] of lines) expect([id, said(each(id), match) > 0]).toEqual([id, true]);
  });
  it('Armor Plating: a shooting result of ANY never hits the armoured car', () => {
    for (const g of each('armor_plating')) {
      g.log.forEach((l, i) => {
        if (!/Armor Plating/.test(l.text)) return;
        expect(l.text).toMatch(/mancato/);
        expect(g.log[i + 1]?.text ?? '').not.toMatch(/subisce danno/);
      });
    }
  });
  it('Heavy Frame: the car is still operable with two damage tokens, and inoperable with three', () => {
    let two = 0;
    each('heavy_frame', ({ g }) => {
      for (const v of g.vehicles.filter(x => x.owner === 0)) {
        if (v.status === 'ok' && v.damage.length === rules.damage_to_inoperable) two++;
        if (v.status === 'ok') expect(v.damage.length).toBeLessThan(rules.damage_to_inoperable + N('heavy_frame'));
      }
    });
    expect(two).toBeGreaterThan(0);
  });
  it('Spoiler: the road die is always 2 for the car; Off-Road Suspension offers it off the road', () => {
    let spoiler = 0, offroad = 0;
    each('spoiler', ({ d }) => {
      if (d.kind !== 'roadDie' || d.player !== 0) return;
      spoiler++;
      expect(d.options[1].dieValue).toBe(N('spoiler'));
    });
    each('off_road_suspension', ({ d }) => { if (d.kind === 'roadDie' && /Off-Road Suspension/.test(d.prompt)) offroad++; });
    expect(spoiler).toBeGreaterThan(0);
    expect(offroad).toBeGreaterThan(0);
  });
  it('Deep Treads: mud is road for the car, so no step costs it two moves', () => {
    let steps = 0;
    each('deep_treads', ({ d }) => {
      if (d.kind !== 'step' || d.player !== 0) return;
      steps++;
      for (const o of d.options) expect(o.label).not.toMatch(/fango/);
    });
    expect(steps).toBeGreaterThan(0);
  });
  it('Tank Treads: only that car can sit on a face-down hazard while it moves', () => {
    let quiet = 0;
    each('tank_treads', ({ g }) => {
      for (const v of g.vehicles) {
        if (!v.pos || v.isWreck) continue;
        const h = g.hazards.get(`${v.pos.r},${v.pos.c}`);
        if (!h || h.faceUp) continue;
        expect(v.owner).toBe(0);
        quiet++;
      }
    });
    expect(quiet).toBeGreaterThan(0);
  });
  it('Oil and Mine Dispenser: at most three times per game, in an empty adjacent space', () => {
    for (const id of ['oil_dispenser', 'mine_dispenser']) {
      const games = each(id, ({ d, g }) => {
        if (d.kind !== 'dispense') return;
        expect(g.vehicles.find(v => v.id === g.activeCar)!.uses).toBeLessThan(N(id));
        for (const o of d.options.slice(1)) {
          expect(vehiclesAt(g, o.pos!).length).toBe(0);
          expect(g.hazards.has(`${o.pos!.r},${o.pos!.c}`)).toBe(false);
        }
      });
      for (const g of games) for (const v of g.vehicles) expect(v.uses).toBeLessThanOrEqual(N(id));
    }
  });
  it('Rear Guns, Rail Gun and Punt Gun reach targets outside the front arc; the chopper and the others do not', () => {
    for (const id of ['rear_guns', 'rail_gun', 'punt_gun']) {
      let far = 0;
      each(id, ({ d, g }) => {
        if (d.kind !== 'shoot') return;
        const from = origin(d, g);
        if (!from) return;
        const gun = d.player === 0 && !/elicottero/.test(d.prompt);
        for (const o of d.options.slice(1)) {
          const near = arc(from).some(q => samePos(q, o.pos!));
          if (gun && !near) far++;
          if (!gun) expect(near).toBe(true);
        }
      });
      expect([id, far > 0]).toEqual([id, true]);
    }
  });
  it('Heavy Machine Gun: the reroll is offered when the car shoots and misses, not to the other players', () => {
    let asked = 0;
    each('heavy_machine_gun', ({ d }) => {
      if (d.kind !== 'shootReroll') return;
      asked++;
      expect(d.player).toBe(0);
    });
    expect(asked).toBeGreaterThan(0);
  });
  it('Smoke Screen: nobody shoots the car from the space directly behind it', () => {
    let shots = 0;
    each('smoke_screen', ({ d, g }) => {
      if (d.kind !== 'shoot') return;
      const from = origin(d, g);
      for (const o of d.options.slice(1)) {
        const t = g.vehicles.find(v => v.id === o.carId)!;
        if (t.owner !== 0 || t.status !== 'ok' || !from) continue;
        shots++;
        expect(samePos(from, neighbor(t.pos!, 'B'))).toBe(false);
      }
    });
    expect(shots).toBeGreaterThan(0);
  });
  it('Stealth Technology: the car is a target only when there is no other vehicle to shoot', () => {
    let alone = 0;
    each('stealth_technology', ({ d, g }) => {
      if (d.kind !== 'shoot') return;
      const targets = d.options.slice(1).map(o => g.vehicles.find(v => v.id === o.carId)!);
      const stealthy = targets.filter(t => t.owner === 0 && t.status === 'ok');
      if (!stealthy.length) return;
      alone++;
      expect(stealthy.length).toBe(targets.length);
    });
    expect(alone).toBeGreaterThan(0);
  });
  it('Sandbags: an opponent is never asked to reroll a slam the car is part of', () => {
    let slams = 0;
    each('sandbags', ({ d, g }) => {
      if (d.kind !== 'slamReroll' && d.kind !== 'dirReroll') return;
      const at = [...g.frames].reverse().find(f => f.kind === 'slam')!.at!;
      if (!vehiclesAt(g, at).some(v => v.owner === 0 && v.status === 'ok')) return;
      slams++;
      expect(d.player).toBe(0);
    });
    expect(slams).toBeGreaterThan(0);
  });
  it('replays the same game with drafted upgrades from the same seed and choices', () => {
    expect(run(5, { upgrades: true }).log).toEqual(run(5, { upgrades: true }).log);
  });
});

describe('upgrade assignment', () => {
  it('offers every kept card on every car still free, and ends with one different card on each car', () => {
    for (let s = 1; s <= 20; s++) {
      // Arrange: record the card-and-car choices of each player.
      const asked: { player: number; cards: number; cars: number }[] = [];
      // Act
      const g = run(s, { upgrades: true, players: 2 + (s % 3) }, ({ d }) => {
        if (d.kind !== 'upgradeAssign') return;
        const cards = new Set(d.options.map(o => o.upgrade)).size, cars = new Set(d.options.map(o => o.carId)).size;
        asked.push({ player: d.player, cards, cars });
        expect(d.options.length).toBe(cards * cars);
      });
      // Assert: three cars, two questions each (the last card goes on the last car by itself).
      for (const p of g.players) {
        const mine = asked.filter(a => a.player === p.id);
        expect(mine.map(a => [a.cards, a.cars])).toEqual([[3, 3], [2, 2]]);
        const ups = g.vehicles.filter(v => v.owner === p.id).map(v => v.upgrade);
        expect(ups.every(Boolean)).toBe(true);
        expect(new Set(ups).size).toBe(3);
      }
    }
  });
});
