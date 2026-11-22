import { describe, it, expect } from 'vitest';
import { newGame, play, neighbor, key, chopperSpaces, roadAt, terrainAt, bonusFits, ROWS, COLS, TILE_COLS, __test, type Decision, type Dir, type Game, type Pos, type Vehicle } from '../../../src/game/trv/engine';
import AIRSTRIKES from '../../../data/trv/advanced_airstrikes.json';
import BOUNTIES from '../../../data/trv/bounties.json';
import BONUS from '../../../data/trv/bonus_commands.json';
import ROADS from '../../../data/trv/road_conditions.json';

// The mini expansions (design/gdd/advanced-airstrikes.md, bounties.md, road-conditions.md,
// bonus-commands.md): their setup, each card, and whole games with all of them.

const SEED = '07'.repeat(32);
const PLAYERS = [{ name: 'Rosso', color: '#d33' }, { name: 'Blu', color: '#36c' }];
const ALL = { airstrikes: true, bounties: true, bonusCommands: true, roadConditions: true } as const;
const AROUND: Dir[] = ['F', 'FL', 'FR', 'B', 'BL', 'BR'];

/** A two-player game with every mini expansion, an empty board, no cards in hand, no road conditions. */
function game(): Game {
  const g = newGame({ seed: SEED, players: PLAYERS, startSide: 'a', ...ALL });
  g.hazards.clear();
  g.roads!.cards = [null, null, null];
  g.current = 0;
  return g;
}
/** Puts a vehicle on a space. */
function place(g: Game, id: string, at: Pos): Vehicle {
  const v = g.vehicles.find(x => x.id === id)!;
  v.pos = { ...at };
  v.inStart = false;
  return v;
}
/** Runs a rules generator to the end, answering with `pick` and keeping every question asked. */
function run<T>(gen: Generator<Decision, T, number>, pick: (d: Decision) => number, asked: Decision[] = []): T {
  let r = gen.next(0);
  while (!r.done) { asked.push(r.value); r = gen.next(pick(r.value)); }
  return r.value;
}
/** Plays every card offered, shoots the first target, the first option otherwise. */
const yes = (d: Decision): number => (d.kind === 'playCard' || d.kind === 'shoot' ? 1 : 0);
/** Keeps every card, shoots the first target, the first option otherwise. */
const no = (d: Decision): number => (d.kind === 'shoot' ? 1 : 0);
/** Places the chopper on `at` when asked, otherwise answers as `yes`. */
const chopperOn = (at: Pos) => (d: Decision): number =>
  (d.kind === 'airstrike' ? Math.max(0, d.options.findIndex(o => o.pos && key(o.pos) === key(at))) : yes(d));
/** The road tile of a space. */
const tile = (q: Pos): number => Math.floor(q.c / TILE_COLS);
/** A road space of the middle tile with no impassable space around, for moves that must stay on the board. */
function open(g: Game, skip = 0): Pos {
  for (let c = TILE_COLS + 2; c < 2 * TILE_COLS - 2; c++) for (let r = 1; r < ROWS - 1; r++) {
    const p = { r, c };
    if (terrainAt(g, p) === 'R' && AROUND.every(d => terrainAt(g, neighbor(p, d)) !== 'X') && skip-- <= 0) return p;
  }
  throw new Error('no open road space on the middle tile');
}

describe('mini expansions setup', () => {
  it('deals one card of each to each person, none to a TRV9000, and two road conditions', () => {
    const g = newGame({ seed: SEED, players: [...PLAYERS, { name: 'Bot', color: '#999', bot: { protocol: 1 } }], startSide: 'a', ...ALL });
    play(g).next(0);
    for (const [hand, data] of [['airstrikes', AIRSTRIKES], ['bounties', BOUNTIES], ['bonusCommands', BONUS]] as const) {
      const ids = data.cards.map(c => c.id);
      expect(ids).toContain(g[hand]![0]);
      expect(ids).toContain(g[hand]![1]);
      expect(g[hand]![0]).not.toBe(g[hand]![1]);
      expect(g[hand]![2]).toBeNull();
    }
    expect(g.roads!.cards[0]).toBeNull();
    expect(ROADS.cards.map(c => c.id)).toContain(g.roads!.cards[1]);
    expect(ROADS.cards.map(c => c.id)).toContain(g.roads!.cards[2]);
    expect(g.roads!.cards[1]).not.toBe(g.roads!.cards[2]);
  });
  it('deals nothing when the modules are off', () => {
    const g = newGame({ seed: SEED, players: PLAYERS, startSide: 'a' });
    play(g).next(0);
    expect(g.airstrikes).toBeNull();
    expect(g.bounties).toBeNull();
    expect(g.bonusCommands).toBeNull();
    expect(g.roads).toBeNull();
  });
  it('the road conditions move with the board: the rear card goes to the discards', () => {
    const g = game();
    g.roads!.cards = [null, 'icy', 'windy'];
    g.roads!.deck = ['sandstorm', 'tremors'];
    __test.advanceBoard(g);
    expect(g.roads!.cards).toEqual(['icy', 'windy', 'sandstorm']);
    __test.advanceBoard(g);
    expect(g.roads!.discard).toEqual(['icy']);
  });
});

describe('Road Conditions', () => {
  it('Windy: no chopper on that tile', () => {
    const g = game();
    g.roads!.cards = [null, 'windy', null];
    expect(chopperSpaces(g).some(q => tile(q) === 1)).toBe(false);
    expect(chopperSpaces(g).some(q => tile(q) === 2)).toBe(true);
  });
  it('Sandstorm: only the vehicle straight ahead can be shot', () => {
    const g = game();
    const at = open(g);
    g.roads!.cards = [null, 'sandstorm', null];
    expect(roadAt(g, at)).toBe('sandstorm');
    const car = place(g, 'p0M', at);
    place(g, 'p1M', neighbor(at, 'FL'));
    const asked: Decision[] = [];
    expect(run(__test.shoot(g, 0, car), yes, asked)).toBeNull();
    expect(asked.some(d => d.kind === 'shoot')).toBe(false);
  });
  it('Guardrails: a car going off the side stays on the road, on a space next to it', () => {
    const g = game();
    g.roads!.cards = [null, 'guardrails', null];
    const car = place(g, 'p0M', { r: 0, c: TILE_COLS + 3 });
    const asked: Decision[] = [];
    run(__test.enter(g, car, neighbor(car.pos!, 'FL'), null, 'FL'), () => 0, asked);
    expect(asked.some(d => d.kind === 'space')).toBe(true);
    expect(car.status).not.toBe('elim');
  });
  it('Tremors: only the vehicles of that tile move', () => {
    const g = game();
    g.roads!.cards = [null, 'tremors', null];
    const a = place(g, 'p0M', open(g)), far = place(g, 'p1M', { r: 2, c: 2 * TILE_COLS + 3 });
    const from = { ...a.pos! };
    run(__test.tremors(g), () => 0);
    expect(g.frames.some(f => f.kind === 'roll' && f.die?.die === 'direction')).toBe(true);
    expect(a.status === 'elim' || key(a.pos!) !== key(from)).toBe(true);
    expect(far.pos).toEqual({ r: 2, c: 2 * TILE_COLS + 3 });
  });
  it('Icy: the direction die moves a vehicle on that tile one space more', () => {
    const g = game();
    g.roads!.cards = ['icy', 'icy', 'icy'];
    place(g, 'p0M', open(g));
    run(__test.quake(g), () => 0);
    expect(g.log.some(l => l.text.startsWith('Icy:'))).toBe(true);
  });
  it('Marauders: the vehicle moved, leading on that tile, is shot', () => {
    const g = game();
    g.roads!.cards = [null, 'marauders', null];
    const v = place(g, 'p0M', open(g));
    g.fx.moved = [v.id];
    run(__test.marauders(g), () => 0);
    const roll = g.frames.find(f => f.kind === 'roll' && f.die?.die === 'shooting');
    expect(roll).toBeDefined();
    expect(v.damage.length).toBe(roll!.hit ? 1 : 0);
  });
  it('Marauders: not when another vehicle is ahead on that tile', () => {
    const g = game();
    g.roads!.cards = [null, 'marauders', null];
    const at = open(g);
    const v = place(g, 'p0M', at);
    place(g, 'p1M', neighbor(neighbor(at, 'F'), 'F'));
    g.fx.moved = [v.id];
    run(__test.marauders(g), () => 0);
    expect(g.frames.some(f => f.kind === 'roll' && f.die?.die === 'shooting')).toBe(false);
  });
  it('Blockaded: after a face-down hazard, a new one goes face down on an empty space of the tile', () => {
    const g = game();
    g.fx.blockade = [{ tile: 1, player: 0 }];
    const asked: Decision[] = [];
    run(__test.blockades(g), () => 0, asked);
    expect(asked[0].kind).toBe('space');
    const placed = [...g.hazards].filter(([q, h]) => !h.faceUp && tile({ r: 0, c: Number(q.split(',')[1]) }) === 1);
    expect(placed).toHaveLength(1);
  });
  it('Torrential Downpour: entering mud loses the moves left', () => {
    const g = game();
    g.roads!.cards = ['torrential_downpour', 'torrential_downpour', 'torrential_downpour'];
    let from: Pos | null = null, mud: Pos | null = null;
    for (let c = 1; c < COLS - 1 && !mud; c++) for (let r = 0; r < ROWS && !mud; r++) {
      const q = { r, c };
      if (terrainAt(g, q) !== 'R') continue;
      const m = (['FL', 'F', 'FR'] as Dir[]).map(d => neighbor(q, d)).find(x => x.r >= 0 && x.r < ROWS && terrainAt(g, x) === 'M');
      if (m) { mud = m; from = q; }
    }
    expect(mud).not.toBeNull();
    const car = place(g, 'p0M', from!);
    const asked: Decision[] = [];
    run(__test.moveCar(g, car, 5, false, false, 5), d => (d.kind === 'step' ? Math.max(0, d.options.findIndex(o => o.pos && key(o.pos) === key(mud!))) : 0), asked);
    expect(car.pos).toEqual(mud);
    expect(asked.filter(d => d.kind === 'step')).toHaveLength(1);
  });
});

describe('Bonus Commands', () => {
  it('the diamond of each card says which dice fit', () => {
    expect(bonusFits('rapid_reload', 6)).toBe(true);
    expect(bonusFits('rapid_reload', 5)).toBe(false);
    expect(bonusFits('nav_system', 3)).toBe(true);
    expect(bonusFits('nav_system', 2)).toBe(false);
    expect(bonusFits('positraction', 1)).toBe(true);
  });
  it("the card is a command of the round: a die on it, the round's command is used", () => {
    const g = game();
    const p = g.players[0];
    g.bonusCommands = ['rapid_reload', null];
    p.dice = [2, 6, 4]; p.used = [false, false, false];
    const asked: Decision[] = [];
    run(__test.turn(g, p), d => (d.kind === 'command' ? Math.max(0, d.options.findIndex(o => o.bonus)) : 0), asked);
    const cmd = asked.find(d => d.kind === 'command')!;
    expect(cmd.options.filter(o => o.bonus).map(o => o.dieValue)).toEqual([6]);
    expect(p.bonusUsed).toBe('die');
    expect(p.commandUsed).toBe(true);
  });
  it("the Final Five put a die on the card instead of the round's command, as the cars do", () => {
    const g = newGame({ seed: SEED, players: [{ name: 'Moto', color: '#db2', team: 'final_five' as const }, PLAYERS[1]], startSide: 'a', ...ALL });
    g.hazards.clear(); g.roads!.cards = [null, null, null];
    const p = g.players[0];
    g.bonusCommands = ['positraction', null];
    p.dice = [2, 6, 4, 1, 3, 5]; p.used = p.dice.map(() => false);
    const asked: Decision[] = [];
    run(__test.turn(g, p), d => (d.kind === 'assign' && d.options.some(o => o.bonus) && !p.commandUsed ? d.options.findIndex(o => o.bonus) : 0), asked);
    expect(asked.some(d => d.kind === 'assign' && d.options.some(o => o.bonus))).toBe(true);
    expect(p.bonusUsed).toBe('die');
    expect(p.commandUsed).toBe(true);
    expect(g.fx.positraction).toBe(true);
  });
  it('the Big Rig puts a die on the card once a round, keeping one for its section', () => {
    const g = newGame({ seed: SEED, players: [{ name: 'Rig', color: '#c80', team: 'big_rig' as const }, PLAYERS[1]], startSide: 'a', ...ALL });
    g.hazards.clear(); g.roads!.cards = [null, null, null];
    const p = g.players[0];
    g.bonusCommands = ['nav_system', null];
    p.dice = [3, 1, 2, 3]; p.used = p.dice.map(() => false);
    const asked: Decision[] = [];
    run(__test.turn(g, p), d => (d.kind === 'command' ? 1 : 0), asked);
    const q = asked.find(d => d.kind === 'command')!;
    expect(q.options.slice(1).every(o => o.bonus && o.dieValue === 3)).toBe(true);
    expect(p.bonusUsed).toBe('die');
    expect(g.fx.navSystem).toBe('ready');
  });
  it('a command token may go on the card, once a round', () => {
    const g = game();
    const p = g.players[0];
    g.bonusCommands = ['positraction', null];
    p.dice = [2, 3, 4]; p.used = [false, false, false]; p.commandUsed = true; p.tokens = 1;
    run(__test.turn(g, p), d => (d.kind === 'token' ? Math.max(0, d.options.findIndex(o => o.bonus)) : 0));
    expect(p.bonusUsed).toBe('token');
    expect(p.tokens).toBe(0);
    expect(g.fx.positraction).toBe(true);
  });
  it("Positraction: mud is road for the player's vehicles this turn", () => {
    const g = game();
    let mud: Pos | null = null;
    for (let c = 0; c < COLS && !mud; c++) for (let r = 0; r < ROWS && !mud; r++) if (terrainAt(g, { r, c }) === 'M') mud = { r, c };
    expect(mud).not.toBeNull();
    const car = place(g, 'p0M', { r: 0, c: 0 }), other = place(g, 'p1M', { r: 1, c: 0 });
    g.fx.positraction = true;
    expect(__test.groundFor(g, car, mud!)).toBe('R');
    expect(__test.groundFor(g, other, mud!)).toBe('M');
  });
  it('Torque Booster rerolls only the dice not yet assigned', () => {
    const g = game();
    const p = g.players[0];
    p.dice = [1, 1, 1]; p.used = [true, false, false];
    const car = g.vehicles.find(v => v.id === 'p0M')!;
    run(__test.activateBonus(g, p, 'torque_booster', 3, car), () => 0);
    expect(p.dice[0]).toBe(1);
    expect(g.log.some(l => l.text.startsWith('Torque Booster'))).toBe(true);
  });
  it("Hands Free: the direction die, then up to the die's value of spaces that way", () => {
    const g = game();
    const p = g.players[0];
    const car = place(g, 'p0M', open(g));
    const from = { ...car.pos! };
    const asked: Decision[] = [];
    run(__test.activateBonus(g, p, 'hands_free', 5, car), d => (d.kind === 'pickValue' ? 1 : 0), asked);
    expect(asked.find(d => d.kind === 'pickValue')!.options).toHaveLength(6);
    expect(car.status === 'elim' || key(car.pos!) !== key(from)).toBe(true);
  });
  it('Targeting AI: the shooter chooses the damage token from the supply', () => {
    const g = game();
    const v = place(g, 'p1M', open(g));
    g.damagePile = [{ type: 'minor' }, { type: 'dent' }, { type: 'minor' }];
    const asked: Decision[] = [];
    run(__test.damage(g, v, { player: 0, how: 'all', what: 'Targeting AI' }), d => (d.kind === 'pickDamage' ? d.options.length - 1 : 0), asked);
    const q = asked.find(d => d.kind === 'pickDamage')!;
    expect(q.options.length).toBeGreaterThan(1);
    expect(v.damage[0].type).toBe(q.options[q.options.length - 1].token!.type);
    expect(g.damagePile).toHaveLength(2);
  });
  it('Rapid Reload: a second shot, at a new target', () => {
    const g = game();
    const at = open(g);
    const car = place(g, 'p0M', at);
    place(g, 'p1M', neighbor(at, 'F'));
    place(g, 'p1L', neighbor(at, 'FL'));
    g.fx.rapidReload = true;
    const asked: Decision[] = [];
    run(__test.shoot(g, 0, car), yes, asked);
    const shots = asked.filter(d => d.kind === 'shoot');
    expect(shots).toHaveLength(2);
    expect(shots[1].options.some(o => o.carId === shots[0].options[1].carId)).toBe(false);
  });
});

describe('Advanced Airstrikes', () => {
  it('Low Flying: the chopper on a face-up hazard, which is discarded', () => {
    const g = game();
    const at = open(g);
    g.hazards.set(key(at), { type: 'oil', faceUp: true });
    g.airstrikes = ['low_flying', null];
    const asked: Decision[] = [];
    run(__test.airstrike(g, g.players[0]), yes, asked);
    expect(asked.find(d => d.kind === 'airstrike')!.options).toHaveLength(1);
    expect(g.players[0].chopper).toEqual(at);
    expect(g.hazards.has(key(at))).toBe(false);
    expect(g.airstrikes[0]).toBeNull();
  });
  it('Care Package: a face-down hazard where the chopper was', () => {
    const g = game();
    const was = open(g);
    g.players[0].chopper = { ...was };
    g.airstrikes = ['care_package', null];
    run(__test.airstrike(g, g.players[0]), chopperOn(open(g, 3)));
    expect(g.hazards.get(key(was))?.faceUp).toBe(false);
  });
  it("Discerning Pilot: the chopper moves instead of eliminating its owner's vehicle", () => {
    const g = game();
    const at = open(g);
    const v = place(g, 'p0M', at);
    g.players[0].chopper = { ...at };
    g.airstrikes = ['discerning_pilot', null];
    run(__test.chopperCheck(g), yes);
    expect(v.status).not.toBe('elim');
    expect(g.players[0].chopper).not.toEqual(at);
  });
  it('without Discerning Pilot the vehicle is eliminated', () => {
    const g = game();
    const at = open(g);
    const v = place(g, 'p0M', at);
    g.players[0].chopper = { ...at };
    run(__test.chopperCheck(g), no);
    expect(v.status).toBe('elim');
  });
  it('Air to Air Missile: a medium hit eliminates the opposing chopper', () => {
    const g = game();
    g.players[1].chopper = { r: 2, c: 2 * TILE_COLS + 3 };
    g.airstrikes = ['air_to_air_missile', null];
    run(__test.airstrike(g, g.players[0]), yes);
    const roll = g.frames.find(f => f.kind === 'roll' && f.die?.die === 'shooting');
    expect(roll).toBeDefined();
    expect(g.players[1].chopper === null).toBe(!!roll!.hit);
  });
  it('Bag of Wrenches: a damage token off a vehicle next to the chopper', () => {
    const g = game();
    const at = open(g);
    const v = place(g, 'p1M', neighbor(at, 'F'));
    v.damage = [{ type: 'minor' }];
    g.airstrikes = ['bag_of_wrenches', null];
    run(__test.airstrike(g, g.players[0]), chopperOn(at));
    expect(v.damage).toHaveLength(0);
  });
  it('Trick Shot: the chopper shoots a space behind it', () => {
    const g = game();
    g.round = 2;
    const at = open(g);
    const t = place(g, 'p1M', neighbor(at, 'B'));
    g.airstrikes = ['trick_shot', null];
    const asked: Decision[] = [];
    run(__test.airstrike(g, g.players[0]), chopperOn(at), asked);
    expect(asked.some(d => d.kind === 'shoot' && d.options.some(o => o.carId === t.id))).toBe(true);
  });
  it('Target Practice: two damage tokens, the shooter keeps one', () => {
    const g = game();
    const v = place(g, 'p1M', open(g));
    g.damagePile = [{ type: 'minor' }, { type: 'dent' }];
    const asked: Decision[] = [];
    run(__test.damage(g, v, { player: 0, how: 'two', what: 'Target Practice' }), d => (d.kind === 'pickDamage' ? 1 : 0), asked);
    expect(asked.find(d => d.kind === 'pickDamage')!.options).toHaveLength(2);
    expect(v.damage).toHaveLength(1);
    expect(g.damagePile).toHaveLength(1);
  });
  it('Strafing Run: after the chopper shoots, it moves to an empty space', () => {
    const g = game();
    g.round = 2;
    const at = open(g);
    place(g, 'p1M', neighbor(at, 'F'));
    g.airstrikes = ['strafing_run', null];
    const asked: Decision[] = [];
    run(__test.airstrike(g, g.players[0]), d => (d.kind === 'airstrike' && !d.prompt.includes('Strafing') ? chopperOn(at)(d) : yes(d)), asked);
    expect(asked.some(d => d.kind === 'airstrike' && d.prompt.includes('Strafing Run'))).toBe(true);
    expect(g.players[0].chopper).not.toEqual(at);
  });
});

describe('Bounties', () => {
  it('Frontrunner: two vehicles in the lead at the start of the turn, a damage token off', () => {
    const g = game();
    g.bounties = ['frontrunner', null];
    const a = place(g, 'p0M', { r: 2, c: 20 }), b = place(g, 'p0L', { r: 3, c: 20 });
    place(g, 'p1M', { r: 2, c: 10 });
    a.damage = [{ type: 'minor' }];
    const asked: Decision[] = [];
    run(__test.bountyCheck(g, 'start'), yes, asked);
    expect(asked[0].kind).toBe('playCard');
    expect(a.damage.length + b.damage.length).toBe(0);
    expect(g.bounties[0]).toBeNull();
  });
  it('a bounty kept stays in hand', () => {
    const g = game();
    g.bounties = ['frontrunner', null];
    place(g, 'p0M', { r: 2, c: 20 }); place(g, 'p0L', { r: 3, c: 20 });
    place(g, 'p1M', { r: 2, c: 10 });
    run(__test.bountyCheck(g, 'start'), no);
    expect(g.bounties[0]).toBe('frontrunner');
  });
  it('Frontrunner is not offered when an opponent is ahead of the second vehicle', () => {
    const g = game();
    g.bounties = ['frontrunner', null];
    place(g, 'p0M', { r: 2, c: 20 }); place(g, 'p0L', { r: 3, c: 8 });
    place(g, 'p1M', { r: 2, c: 10 });
    const asked: Decision[] = [];
    run(__test.bountyCheck(g, 'start'), yes, asked);
    expect(asked).toHaveLength(0);
  });
  it('Slow and Steady: at the end of the round, no vehicle ahead of the opponents', () => {
    const g = game();
    g.bounties = ['slow_and_steady', null];
    place(g, 'p0M', open(g));
    place(g, 'p1M', { r: 2, c: 2 * TILE_COLS + 4 });
    const asked: Decision[] = [];
    run(__test.bountyCheck(g, 'round'), d => (d.kind === 'space' ? Math.min(1, d.options.length - 1) : yes(d)), asked);
    expect(asked[0].kind).toBe('playCard');
    expect(asked.some(d => d.kind === 'space')).toBe(true);
  });
  it('Pinball Wizard: two slams on your turn, a free die set to any value', () => {
    const g = game();
    const p = g.players[0];
    g.bounties = ['pinball_wizard', null];
    g.fx.allSlams = 2;
    p.dice = [1, 2, 3]; p.used = [true, false, true];
    run(__test.bountyCheck(g, 'turn'), d => (d.kind === 'pickValue' ? d.options.length - 1 : yes(d)));
    expect(p.dice[1]).toBe(6);
  });
  it('Trash Collector and Rubbing Is Racing read what happened on the turn', () => {
    const g = game();
    g.bounties = ['trash_collector', 'rubbing_is_racing'];
    g.fx.hazardsEntered = 1;
    const asked: Decision[] = [];
    run(__test.bountyCheck(g, 'turn'), no, asked);
    expect(asked).toHaveLength(0);
    g.fx.hazardsEntered = 2;
    run(__test.bountyCheck(g, 'turn'), no, asked);
    expect(asked.filter(d => d.kind === 'playCard').map(d => d.player)).toEqual([0]);
    g.current = 1; g.fx.eliminated = 1;
    run(__test.bountyCheck(g, 'turn'), no, asked);
    expect(asked.filter(d => d.kind === 'playCard').map(d => d.player)).toEqual([0, 1]);
  });
  it("Hit and Run: counted on anyone's turn, from the shot that made a vehicle inoperable", () => {
    const g = game();
    g.bounties = [null, 'hit_and_run'];
    g.fx.feats = ['1:hit_and_run'];
    const asked: Decision[] = [];
    run(__test.bountyCheck(g, 'turn'), yes, asked);
    expect(asked[0].player).toBe(1);
  });
  it('Down and Dirty: a look at the face-down hazards of a tile', () => {
    const g = game();
    g.bounties = ['down_and_dirty', null];
    let off: Pos | null = null;
    for (let c = 0; c < COLS && !off; c++) for (let r = 0; r < ROWS && !off; r++) {
      const t = terrainAt(g, { r, c });
      if (t !== 'R' && t !== 'X') off = { r, c };
    }
    expect(off).not.toBeNull();
    place(g, 'p0M', off!);
    g.hazards.set(key({ r: 0, c: 1 }), { type: 'oil', faceUp: false });
    const asked: Decision[] = [];
    run(__test.bountyCheck(g, 'start'), yes, asked);
    expect(asked.map(d => d.kind)).toEqual(['playCard', 'pickTile', 'peekResult']);
  });
  it('Death From Above: the chopper is placed again', () => {
    const g = game();
    g.bounties = ['death_from_above', null];
    g.fx.feats = ['0:death_from_above'];
    const asked: Decision[] = [];
    run(__test.bountyCheck(g, 'turn'), yes, asked);
    expect(asked.some(d => d.kind === 'airstrike')).toBe(true);
    expect(g.players[0].chopper).not.toBeNull();
  });
});

describe('whole games with every mini expansion', () => {
  it('end with a winner, the same way for the same choices, with a TRV9000 and the Big Rig', () => {
    let played = 0;
    for (let s = 1; s <= 24; s++) {
      const players = s % 3 === 0
        ? [...PLAYERS, { name: 'Rig', color: '#0a0', team: 'big_rig' as const }]
        : [...PLAYERS, { name: 'Bot', color: '#999', bot: { protocol: 2 } }];
      const seed = s.toString(16).padStart(8, '0').padEnd(64, '7');
      const once = (): { winner: number | null; log: number; plays: number } => {
        const g = newGame({ seed, players, startSide: 'a', ...ALL, oneShots: s % 2 === 0 });
        const it = play(g);
        let r = it.next(0), x = s * 7919, plays = 0;
        for (let k = 0; !r.done; k++) {
          if (k > 30000) throw new Error('game did not end');
          x = (x * 1103515245 + 12345) & 0x7fffffff;
          const d = r.value;
          expect(g.players[d.player].bot).toBeUndefined();
          if (d.kind === 'playCard') { plays += x % 2; r = it.next(x % 2); continue; }
          const safe = d.options.map((o, i) => ({ o, i })).filter(e => !e.o.danger);
          const pool = safe.length ? safe : d.options.map((o, i) => ({ o, i }));
          r = it.next(pool[x % pool.length].i);
        }
        return { winner: g.winner, log: g.log.length, plays };
      };
      const a = once(), b = once();
      expect(a.winner).not.toBeNull();
      expect(b).toEqual(a);
      played += a.plays;
    }
    expect(played).toBeGreaterThan(0);
  }, 240_000);
});
