// Thunder Road: Vendetta, base game rules (reference/rulebook, pp. 4-12).
// Pure TypeScript with no browser in it. The game runs as a generator: it yields a
// Decision whenever a player must choose and receives the index of the chosen option.
// All randomness goes through src/core/rng, so seed + list of choices replays a game.
// Part 4, Choppe Shoppe (TRV-CS_Rulebook): crew leaders and command tokens, from
// data/trv/choppe_shoppe.json, and upgrade cards (one per car, inactive while the car is inoperable).

import base from '../../../data/trv/game_base.json';
import shoppe from '../../../data/trv/choppe_shoppe.json';
import carnageData from '../../../data/trv/carnage.json';
import {
  createRng, roll, shuffle, applyPermutation, type RngState,
} from '../../core/rng/rng';

// ---------------------------------------------------------------- types

/** Board-absolute directions: F is towards the lead tile, L towards row 0. */
export type Dir = 'F' | 'FL' | 'FR' | 'B' | 'BL' | 'BR';
export type Size = 'S' | 'M' | 'L';
/** R road, o off-road, M mud, X impassable; Carnage at Devil's Run (CDR p3): G toxic goo, D desert glass, P ramp, F fire!, S salt flats. */
export type Terrain = 'R' | 'o' | 'M' | 'X' | 'G' | 'D' | 'P' | 'F' | 'S';
/** Base hazards, then those of Carnage at Devil's Run (CDR p3). */
export type HazardType = 'mud' | 'road' | 'oil' | 'mine' | 'wreck'
  | 'quake' | 'sand_worm' | 'desert_glass' | 'ramp' | 'fire' | 'pit_trap';
/** Base damage, then the two of Carnage at Devil's Run (CDR p4). */
export type DamageType = 'shrapnel' | 'dazed' | 'dent' | 'skid' | 'blastoff' | 'on_fire' | 'ongoing_effect';
/** The faces of the fire die (CDR p3). */
export type FireFace = '+1' | '+2' | 'out' | 'eliminated';
/** The hazards that Carnage at Devil's Run adds to the pile. */
export type CarnageHazard = 'quake' | 'sand_worm' | 'desert_glass' | 'ramp' | 'fire' | 'pit_trap';

/**
 * The numbers of Carnage at Devil's Run that the rulebook does not give (data/trv/carnage.json
 * `_missing`): how many tokens of each kind, the fire die's faces, the ongoing effect deck. Read from
 * the data file; a test can pass its own (Setup.carnage).
 */
export interface CarnageNumbers {
  hazards: Record<CarnageHazard, number>;
  damage: { on_fire: number; ongoing_effect: number };
  fireDie: FireFace[];
  /** The ongoing effect deck: one card id per card. */
  ongoing: string[];
}
export type CommandId = 'airstrike' | 'nitro' | 'drift' | 'repair'
  | 'bump' | 'pain_transfer' | 'need_for_speed' | 'called_shot' | 'tinker' | 'show_time' | 'flamethrower';

/** One command of a command board: the die values that activate it, or a command token only. */
export interface CommandSlot { id: CommandId; values: number[]; token?: boolean }

/** A crew leader command board (Choppe Shoppe). */
export interface Leader {
  id: string;
  name: string;
  title: string;
  /** Command tokens taken at setup (the stars at the bottom of the board). */
  tokens: number;
  power: string;
  commands: CommandSlot[];
  /** What the leader depends on that is not implemented yet; such leaders are not dealt. */
  needs?: string[];
}

/** A board space. `c` counts from the rear edge of the rear tile (0..23). */
export interface Pos { r: number; c: number }

/** A damage token; `card`: the ongoing effect card under it (Carnage at Devil's Run, CDR p4). */
export interface DamageToken { type: DamageType; dir?: Dir; card?: string }

/** A road vehicle: a car or a wreck (a wreck is an inoperable small car with no owner). */
export interface Vehicle {
  id: string;
  owner: number | null;
  size: Size;
  isWreck: boolean;
  /** null while in the starting area or after elimination. */
  pos: Pos | null;
  inStart: boolean;
  status: 'ok' | 'inop' | 'elim';
  damage: DamageToken[];
  moved: boolean;
  coasts: number;
  /** Movement dice placed on this car's dashboard this round: the move die, then coast dice. */
  placed: { value: number; coast: boolean }[];
  /** Stacking order: higher is on top. */
  z: number;
  /** Upgrade card id (Choppe Shoppe), or null. */
  upgrade: string | null;
  /** A second upgrade card: only Ms. Betty's large car can have one (Bring the Bling). */
  upgrade2?: string | null;
  /** How many times the upgrade's limited ability was used this game (dispensers). */
  uses: number;
  /** Carries an ON FIRE! token (Carnage at Devil's Run, CDR p3); not damage. */
  onFire?: boolean;
}

/** An upgrade card (Choppe Shoppe). `n` is the card's own number (see choppe_shoppe.json). */
export interface Upgrade { id: string; name: string; n?: number }

export interface Player {
  id: number;
  name: string;
  color: string;
  dice: number[];
  used: boolean[];
  commandUsed: boolean;
  /** The command activated this round and the die placed on it. */
  command: { cmd: CommandId; value: number } | null;
  out: boolean;
  chopper: Pos | null;
  /** Catalog crew id (colour set of boards and pieces), if the interface chose one. */
  crew?: string;
  /** Crew leader id (Choppe Shoppe), or null with the standard command board. */
  leader: string | null;
  /** Command tokens in hand. */
  tokens: number;
  /** Commands holding a die or a command token this round. */
  slots: Partial<Record<CommandId, 'die' | 'token'>>;
}

export interface TileRef { tile: number; side: 'a' | 'b' }

export interface HazardOnBoard { type: HazardType; faceUp: boolean }

/** One option of a decision. The UI shows `label` and highlights `pos` / `carId`. */
export interface Option {
  label: string;
  pos?: Pos;
  carId?: string;
  die?: number;
  danger?: boolean;
  /** Assign: the die goes to the car's coast space. */
  coast?: boolean;
  /** Command: which command the die activates. */
  command?: CommandId;
  /** Assign / command: the value of the die being placed. */
  dieValue?: number;
  /** Leader choice: the crew leader id. */
  leader?: string;
  /** Upgrade draft and assignment: the upgrade card id. */
  upgrade?: string;
  /** Damage choice (Crumple Zones): the token offered. */
  token?: DamageToken;
}

/** A vehicle in range that cannot be chosen because of an ability (an upgrade id), for the UI to explain. */
export interface Blocked { carId: string; pos: Pos; because: string }

export interface Decision {
  /** Shoot: vehicles in range that an ability keeps from being targets (Smoke Screen, Stealth Technology). */
  blocked?: Blocked[];
  kind: 'assign' | 'command' | 'airstrike' | 'repair' | 'step' | 'roadDie' | 'slamReroll' | 'shoot'
    | 'leader' | 'token' | 'shootReroll' | 'dirReroll' | 'peek' | 'peekResult' | 'transfer'
    | 'draft' | 'upgradeAssign' | 'swap' | 'plow' | 'rollCage' | 'pickDamage' | 'redButton' | 'dispense' | 'radar'
    | 'tinker' | 'showTime';
  player: number;
  prompt: string;
  options: Option[];
}

/** A die as rolled: which die and the face index (into the face lists of game_base.json). */
export interface RolledDie { die: string; face: number; value: string | number }

export interface LogEntry { text: string; kind: 'info' | 'dice' | 'bad' | 'good' | 'turn'; dice?: RolledDie[] }

/** What the table looks like at one moment: enough for the UI to draw it. */
export interface Snapshot {
  board: TileRef[];
  finalTile: boolean;
  vehicles: Pick<Vehicle, 'id' | 'owner' | 'size' | 'isWreck' | 'pos' | 'inStart' | 'status' | 'z' | 'onFire'>[];
  hazards: [string, HazardOnBoard][];
  choppers: (Pos | null)[];
  activeCar: string | null;
}

/**
 * One beat of the game for the UI to animate, in order: a car entering a space, a die rolled,
 * a slam, a shot, damage, an elimination, a hazard turned up, a new tile, the start of a round,
 * a chopper placed, or a log line. Each carries the table as it is right after that beat.
 * Frames are presentation data: the rules never read them.
 */
export interface Frame {
  /** jump: a ramp jump from `from` to `at`; fire: `vehicleId` catches fire (`why` 'on') or the fire goes out ('out') (CDR p3). */
  kind: 'log' | 'move' | 'roll' | 'slam' | 'shot' | 'damage' | 'elim' | 'reveal' | 'tile' | 'round' | 'chopper' | 'jump' | 'fire';
  text?: string;
  logKind?: LogEntry['kind'];
  vehicleId?: string;
  at?: Pos;
  from?: Pos;
  /** Elimination: the space the vehicle was entering (off the road, or impassable), and why. */
  into?: Pos;
  why?: string;
  /** Damage: the token drawn and turned over (null when the pile is empty). */
  token?: DamageToken | null;
  /** Damage: the token stays face down and its effect is ignored (Jury-Rigging). */
  faceDown?: boolean;
  die?: RolledDie;
  /** Round start: each player's movement dice, the road die and who rolled it. */
  round?: { n: number; dice: { player: number; values: number[] }[]; roadDie: number; roller: number };
  snap: Snapshot;
}

export interface Game {
  rng: RngState;
  players: Player[];
  vehicles: Vehicle[];
  /** The three tiles on the table: rear, middle, lead. */
  board: TileRef[];
  pile: TileRef[];
  tilesPlaced: number;
  finalTile: boolean;
  hazards: Map<string, HazardOnBoard>;
  hazardPile: HazardType[];
  hazardDiscard: HazardType[];
  damagePile: DamageToken[];
  round: number;
  firstPlayer: number;
  current: number;
  roadDie: number;
  winner: number | null;
  log: LogEntry[];
  zTop: number;
  /** The car moving this turn, for the UI. */
  activeCar: string | null;
  /** The last dice rolled, for the UI. */
  lastRoll: RolledDie[];
  /** FX dice rolled since the last log line, attached to the next 'dice' line. */
  pendingDice: RolledDie[];
  /** Beats for the UI to animate (see Frame). */
  frames: Frame[];
  /** Command tokens left in the supply (Choppe Shoppe). */
  tokenSupply: number;
  /** Crew leaders are dealt and chosen at the start of `play`. */
  dealLeaders: boolean;
  /** Upgrade cards are drafted and assigned at the start of `play`. */
  dealUpgrades: boolean;
  /** Effects that last for the current turn. */
  fx: { bump: boolean; calledShot: boolean; slams: number; /** Flamethrower (Emberco): this turn a hit also sets the target on fire. */ flamethrower: boolean };
  /** Upgrade cards not dealt, and those discarded (Tinker draws from the first). */
  upgradeDeck: string[];
  upgradeDiscard: string[];
  /** Carnage at Devil's Run, when in play: its numbers and the ongoing effect deck (ON FIRE! tokens are unlimited). */
  carnage: { n: CarnageNumbers; deck: string[]; discard: string[] } | null;
}

export interface Setup {
  seed: string;
  /** `leader` fixes a player's crew leader without dealing. */
  /** `upgrades` fixes the upgrade of the small, medium and large car without drafting. */
  players: { name: string; color: string; crew?: string; leader?: string; upgrades?: (string | null)[] }[];
  startSide: 'a' | 'b';
  /** Choppe Shoppe: deal two crew leaders to each player, who keeps one. */
  leaders?: boolean;
  /** Choppe Shoppe: draft three upgrade cards each and assign one to each car. */
  upgrades?: boolean;
  /**
   * Carnage at Devil's Run: true takes its numbers from data/trv/carnage.json (an error names what is
   * still missing there); an object gives them directly (tests).
   */
  carnage?: boolean | CarnageNumbers;
}

type Gen<T> = Generator<Decision, T, number>;

// ---------------------------------------------------------------- data

export const ROWS = 6;
export const TILE_COLS = 8;
export const COLS = TILE_COLS * 3;
const DICE = base.dice as unknown as {
  movement: number[]; road: number[]; stunt: number[];
  slam: ('top' | 'bottom')[]; shooting: string[]; direction: Dir[];
};
const BASE_BOARD: CommandSlot[] = Object.entries(base.commands).map(([id, values]) => ({ id: id as CommandId, values }));
const LEADERS = shoppe.leaders as Leader[];

/** Every crew leader in the data, including those that cannot be dealt yet. */
export const leaders = (): Leader[] => LEADERS;

/** A player's crew leader, or null with the standard command board. */
export function leaderOf(p: Player): Leader | null {
  return p.leader ? LEADERS.find(l => l.id === p.leader) ?? null : null;
}

/** The commands on a player's command board. */
export function commandsOf(p: Player): CommandSlot[] {
  return leaderOf(p)?.commands ?? BASE_BOARD;
}

const hasPower = (g: Game, player: number | null, power: string): boolean =>
  player !== null && leaderOf(g.players[player])?.power === power;

const UPGRADES = shoppe.upgrades as Upgrade[];
/** Every upgrade card. */
export const upgrades = (): Upgrade[] => UPGRADES;
/** Whether a car has an upgrade and it is active: an inoperable car's upgrade is not. */
const up = (v: Vehicle | null | undefined, id: string): boolean => !!v && !v.isWreck && v.status === 'ok' && (v.upgrade === id || v.upgrade2 === id);
/** The number printed on an upgrade card. */
const upN = (id: string): number => UPGRADES.find(u => u.id === id)?.n ?? 0;
const upName = (id: string): string => UPGRADES.find(u => u.id === id)?.name ?? id;
/** Damage tokens that make a car inoperable (Heavy Frame: one more). */
const limit = (v: Vehicle): number => base.damage_to_inoperable + (v.upgrade === 'heavy_frame' || v.upgrade2 === 'heavy_frame' ? upN('heavy_frame') : 0);
const SIZE_RANK: Record<Size, number> = { S: 0, M: 1, L: 2 };
export const DIR_NAME: Record<Dir, string> = {
  F: 'avanti', FL: 'avanti-sinistra', FR: 'avanti-destra',
  B: 'indietro', BL: 'indietro-sinistra', BR: 'indietro-destra',
};
const SIZE_NAME: Record<Size, string> = { S: 'piccola', M: 'media', L: 'grande' };
const HAZARD_NAME: Record<HazardType, string> = {
  mud: 'Fango', road: 'Strada', oil: 'Chiazza d\'olio', mine: 'Mina', wreck: 'Relitto',
  quake: 'Terremoto', sand_worm: 'Verme delle sabbie', desert_glass: 'Vetro del deserto', ramp: 'Rampa', fire: 'Fuoco!', pit_trap: 'Trappola',
};
const DAMAGE_NAME: Record<DamageType, string> = {
  shrapnel: 'Schegge', dazed: 'Stordito', dent: 'Ammaccatura', skid: 'Sbandata', blastoff: 'Decollo',
  on_fire: 'In fiamme', ongoing_effect: 'Effetto continuo',
};
const TERRAIN_NAME: Partial<Record<Terrain, string>> = {
  G: 'melma tossica', D: 'vetro del deserto', P: 'rampa', F: 'fuoco', S: 'saline',
};
const COMMAND_NAME: Record<CommandId, string> = {
  airstrike: 'Attacco aereo', nitro: 'Nitro', drift: 'Drift', repair: 'Riparazione',
  bump: 'Bump!', pain_transfer: 'Pain Transfer', need_for_speed: 'Need for Speed', called_shot: 'Called Shot',
  tinker: 'Tinker', show_time: 'Show Time', flamethrower: 'Flamethrower',
};
/** The name of a command, as shown to the players. */
export const commandName = (c: CommandId): string => COMMAND_NAME[c];

interface TileDef { tile: number; side: string; name: string; terrain: string[]; hazards: unknown[][] }
const TILES = base.tiles as unknown as TileDef[];
/** Road tiles of Carnage at Devil's Run (CDR p2 setup step 1: shuffled in with the standard ones). */
const CARNAGE_TILES = ((carnageData as unknown as { tiles?: TileDef[] }).tiles ?? []);

/** The definition of a tile face. */
export function tileDef(t: TileRef): TileDef {
  const d = TILES.find(x => x.tile === t.tile && x.side === t.side) ?? CARNAGE_TILES.find(x => x.tile === t.tile && x.side === t.side);
  if (!d) throw new Error(`unknown tile ${t.tile}${t.side}`);
  return d;
}

// ---------------------------------------------------------------- geometry

export const key = (p: Pos): string => `${p.r},${p.c}`;
export const samePos = (a: Pos | null, b: Pos | null): boolean => !!a && !!b && a.r === b.r && a.c === b.c;

/**
 * The neighbour in a direction. Odd rows sit half a space forward of even rows
 * (measured on the tiles), so diagonal neighbours depend on row parity.
 */
export function neighbor(p: Pos, d: Dir): Pos {
  const odd = p.r % 2 !== 0;
  switch (d) {
    case 'F': return { r: p.r, c: p.c + 1 };
    case 'B': return { r: p.r, c: p.c - 1 };
    case 'FL': return { r: p.r - 1, c: odd ? p.c + 1 : p.c };
    case 'BL': return { r: p.r - 1, c: odd ? p.c : p.c - 1 };
    case 'FR': return { r: p.r + 1, c: odd ? p.c + 1 : p.c };
    case 'BR': return { r: p.r + 1, c: odd ? p.c : p.c - 1 };
  }
}

export const onBoard = (p: Pos): boolean => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS;

/** Printed terrain, changed by face-up Road, Mud and Oil Slick tokens. */
export function terrainAt(g: Game, p: Pos): Terrain {
  const h = g.hazards.get(key(p));
  if (h && h.faceUp) {
    if (h.type === 'road' || h.type === 'oil') return 'R';
    if (h.type === 'mud') return 'M';
    // Carnage at Devil's Run (CDR p3): these stay on the board and change the space.
    if (h.type === 'desert_glass') return 'D';
    if (h.type === 'ramp') return 'P';
    if (h.type === 'fire') return 'F';
    if (h.type === 'pit_trap') return 'X';
  }
  const t = g.board[Math.floor(p.c / TILE_COLS)];
  return tileDef(t).terrain[p.r][p.c % TILE_COLS] as Terrain;
}

export function vehiclesAt(g: Game, p: Pos): Vehicle[] {
  return g.vehicles.filter(v => v.status !== 'elim' && samePos(v.pos, p)).sort((a, b) => a.z - b.z);
}

/** Empty space: no road vehicle, chopper, hazard token or impassable terrain (p. 7). */
/**
 * Revealed hazards that stay on the board only as terrain (road, mud, oil slick; Carnage: desert
 * glass, ramp, fire; a pit trap is impassable terrain). For the chopper they are no obstacle (rules
 * owner, 2026-11-16); a face-down hazard token still is.
 */
const TERRAIN_HAZARDS = new Set<HazardType>(['road', 'mud', 'oil', 'desert_glass', 'ramp', 'fire']);

/** The spaces where a chopper may be placed (Airstrike, p. 8): empty, but a revealed terrain hazard does not count. */
export function chopperSpaces(g: Game): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = { r, c }, h = g.hazards.get(key(p));
      const clearHazard = !h || (h.faceUp && TERRAIN_HAZARDS.has(h.type));
      if (terrainAt(g, p) !== 'X' && clearHazard && !vehiclesAt(g, p).length && !g.players.some(pl => samePos(pl.chopper, p))) out.push(p);
    }
  }
  return out;
}

export function isEmpty(g: Game, p: Pos): boolean {
  if (terrainAt(g, p) === 'X') return false;
  if (g.hazards.has(key(p))) return false;
  if (vehiclesAt(g, p).length) return false;
  return !g.players.some(pl => samePos(pl.chopper, p));
}

export function carName(g: Game, v: Vehicle): string {
  if (v.isWreck) return 'il relitto';
  return `l'auto ${SIZE_NAME[v.size]} di ${g.players[v.owner!].name}`;
}

// ---------------------------------------------------------------- randomness

function rollDice(g: Game, specs: { id: string; n: number }[], cause: string): number[] {
  const r = roll(g.rng, { kind: 'roll', dice: specs.map(s => ({ dieId: s.id, n: s.n })), cause });
  if (!r.ok) throw new Error(r.error.message);
  g.rng = r.value.state;
  return r.value.content.results.map(x => x.face);
}

/**
 * Rolls one FX die. `at` is where on the road the roll belongs (the shooter, the slam, the damaged
 * vehicle...): the interface throws the die there. Presentation only: it changes no rule.
 */
function rollFx<K extends 'road' | 'stunt' | 'slam' | 'shooting' | 'direction'>(g: Game, die: K, cause: string, at?: Pos | null): (typeof DICE)[K][number] {
  const faces = DICE[die];
  const [f] = rollDice(g, [{ id: die, n: faces.length }], cause);
  const v = faces[f] as (typeof DICE)[K][number];
  const rolled = { die, face: f, value: v as string | number };
  g.lastRoll.push(rolled);
  g.pendingDice.push(rolled);
  beat(g, 'roll', { die: rolled, ...(at ? { at: { ...at } } : {}) });
  return v;
}

function shuffled<T>(g: Game, items: T[], pileId: string): T[] {
  if (items.length < 2) return [...items];
  const r = shuffle(g.rng, { kind: 'shuffle', pileId, size: items.length, cause: `shuffle:${pileId}` });
  if (!r.ok) throw new Error(r.error.message);
  g.rng = r.value.state;
  return applyPermutation(items, r.value.content.permutation);
}

function say(g: Game, text: string, kind: LogEntry['kind'] = 'info'): void {
  if (kind === 'dice' && g.pendingDice.length) {
    g.log.push({ text, kind, dice: g.pendingDice });
    g.pendingDice = [];
  } else g.log.push({ text, kind });
  beat(g, 'log', { text, logKind: kind });
}

/** The table as it is now. */
export function snapshot(g: Game): Snapshot {
  return {
    board: g.board.map(t => ({ ...t })),
    finalTile: g.finalTile,
    vehicles: g.vehicles.map(v => ({ id: v.id, owner: v.owner, size: v.size, isWreck: v.isWreck, pos: v.pos ? { ...v.pos } : null, inStart: v.inStart, status: v.status, z: v.z, ...(v.onFire ? { onFire: true } : {}) })),
    hazards: [...g.hazards].map(([k, h]) => [k, { ...h }]),
    choppers: g.players.map(p => (p.chopper ? { ...p.chopper } : null)),
    activeCar: g.activeCar,
  };
}

function beat(g: Game, kind: Frame['kind'], extra: Omit<Frame, 'kind' | 'snap'> = {}): void {
  g.frames.push({ kind, ...extra, snap: snapshot(g) });
}

function* ask(d: Decision): Gen<number> {
  if (d.options.length === 0) throw new Error(`decision ${d.kind} without options`);
  const i = yield d;
  if (!Number.isInteger(i) || i < 0 || i >= d.options.length) throw new Error(`bad choice ${i} for ${d.kind}`);
  return i;
}

// ---------------------------------------------------------------- setup

/** Builds the table (p. 4, steps 1-5). The first-player roll happens in `play`. */
export function newGame(s: Setup): Game {
  const r = createRng(s.seed);
  if (!r.ok) throw new Error(r.error.message);
  if (s.players.length < 2 || s.players.length > 4) throw new Error('2-4 players');
  const g: Game = {
    rng: r.value, players: [], vehicles: [], board: [], pile: [], tilesPlaced: 3, finalTile: false,
    hazards: new Map(), hazardPile: [], hazardDiscard: [], damagePile: [], round: 0, firstPlayer: 0,
    current: 0, roadDie: 0, winner: null, log: [], zTop: 0, activeCar: null, lastRoll: [], pendingDice: [], frames: [],
    tokenSupply: shoppe.command_tokens, dealLeaders: !!s.leaders, dealUpgrades: !!s.upgrades, fx: { bump: false, calledShot: false, slams: 0, flamethrower: false },
    carnage: null, upgradeDeck: [], upgradeDiscard: [],
  };
  if (s.carnage) {
    if (s.carnage === true && !carnageTilesReady()) throw new Error("Carnage at Devil's Run: missing data in carnage.json: tiles");
    const n = s.carnage === true ? carnageNumbers() : s.carnage;
    g.carnage = { n, deck: shuffled(g, n.ongoing, 'ongoing-effects'), discard: [] };
  }
  s.players.forEach((p, i) => {
    g.players.push({ id: i, name: p.name, color: p.color, dice: [], used: [], commandUsed: false, command: null, out: false, chopper: null,
      leader: null, tokens: 0, slots: {}, ...(p.crew ? { crew: p.crew } : {}) });
    if (p.leader) takeLeader(g, g.players[i], p.leader);
    for (const size of ['S', 'M', 'L'] as Size[]) {
      g.vehicles.push({ id: `p${i}${size}`, owner: i, size, isWreck: false, pos: null, inStart: true,
        status: 'ok', damage: [], moved: false, coasts: 0, placed: [], z: 0,
        upgrade: p.upgrades?.[SIZE_RANK[size]] ?? null, uses: 0 });
    }
  });
  // Road tiles: the starting tile, then the others shuffled into a pile.
  // With Carnage at Devil's Run its tiles join the pile (CDR p2, setup step 1); a test's own numbers keep the base tiles.
  const withCarnage = s.carnage === true;
  const others = [...new Set([...TILES, ...(withCarnage ? CARNAGE_TILES : [])].map(t => t.tile))].filter(t => t !== base.start_tile);
  const pile = shuffled(g, others, 'road-tiles').map(tile => {
    const [f] = rollDice(g, [{ id: 'tile-side', n: 2 }], 'setup:tile-side');
    return { tile, side: f === 0 ? 'a' : 'b' } as TileRef;
  });
  g.board = [{ tile: base.start_tile, side: s.startSide }, pile.shift()!, pile.shift()!];
  g.pile = pile;
  // Hazard and damage tokens.
  const hz: HazardType[] = [];
  for (const [t, n] of Object.entries(base.hazard_tokens)) for (let i = 0; i < n; i++) hz.push(t as HazardType);
  // Carnage at Devil's Run setup (CDR p2, steps 2-3): its hazard and damage tokens join the piles.
  if (g.carnage) for (const [t, n] of Object.entries(g.carnage.n.hazards)) for (let i = 0; i < n; i++) hz.push(t as HazardType);
  g.hazardPile = shuffled(g, hz, 'hazards');
  for (const d of base.damage_tokens as { type: DamageType; dir?: Dir; count: number }[]) {
    for (let i = 0; i < d.count; i++) g.damagePile.push(d.dir ? { type: d.type, dir: d.dir } : { type: d.type });
  }
  if (g.carnage) for (const [t, n] of Object.entries(g.carnage.n.damage)) for (let i = 0; i < n; i++) g.damagePile.push({ type: t as DamageType });
  for (let t = 0; t < 3; t++) placeHazards(g, t, t === 0 ? s.players.length : null);
  return g;
}

/** Setup steps 4-5 of the crew leaders: the board, and command tokens equal to its stars. */
function takeLeader(g: Game, p: Player, id: string): void {
  const l = LEADERS.find(x => x.id === id);
  if (!l) throw new Error(`unknown crew leader ${id}`);
  p.leader = l.id;
  p.tokens = Math.min(l.tokens, g.tokenSupply);
  g.tokenSupply -= p.tokens;
}

function drawHazard(g: Game): HazardType | null {
  if (!g.hazardPile.length && g.hazardDiscard.length) {
    g.hazardPile = shuffled(g, g.hazardDiscard, 'hazards');
    g.hazardDiscard = [];
  }
  return g.hazardPile.shift() ?? null;
}

/** Face-down hazards on a tile's hazard spaces; on the starting tile only those for the player count. */
function placeHazards(g: Game, slot: number, playerCount: number | null): void {
  for (const h of tileDef(g.board[slot]).hazards) {
    const [r, c, players] = h as [number, number, number[] | undefined];
    if (playerCount !== null && players && !players.includes(playerCount)) continue;
    const t = drawHazard(g);
    if (t) g.hazards.set(key({ r, c: c + slot * TILE_COLS }), { type: t, faceUp: false });
  }
}

// ---------------------------------------------------------------- status

function activePlayers(g: Game): Player[] {
  return g.players.filter(p => !p.out);
}

function eliminate(g: Game, v: Vehicle, why: string, into?: Pos): void {
  if (v.status === 'elim') return;
  beat(g, 'elim', { vehicleId: v.id, why, ...(v.pos ? { at: { ...v.pos } } : {}), ...(into ? { into: { ...into } } : {}) });
  say(g, `${capital(carName(g, v))} è eliminata: ${why}.`, 'bad');
  if (v.isWreck) {
    g.vehicles = g.vehicles.filter(x => x !== v);
    return;
  }
  v.status = 'elim';
  v.pos = null;
  v.inStart = false;
  if (v.onFire) putOut(g, v);
  for (const t of v.damage) discardCard(g, t);
  g.damagePile.push(...v.damage);
  v.damage = [];
  checkPlayers(g);
}

/** Out of the game (p. 11) and the last-player-standing win. */
function checkPlayers(g: Game): void {
  for (const p of g.players) {
    if (p.out) continue;
    const alive = g.vehicles.some(v => v.owner === p.id && v.status === 'ok');
    if (!alive) {
      p.out = true;
      p.chopper = null;
      say(g, `${p.name} è fuori dal gioco.`, 'bad');
      if (g.players.length >= 3 && !g.finalTile) {
        g.finalTile = true;
        say(g, 'La tessera di testa diventa la tessera finale: arriva il traguardo!', 'info');
      }
    }
  }
  const left = activePlayers(g);
  if (left.length === 1 && g.winner === null) {
    g.winner = left[0].id;
    say(g, `${left[0].name} è l'unico con auto operative: VINCE!`, 'good');
  }
}

// ---------------------------------------------------------------- moving off the front

/** Moving off the front of a lead tile that is not the final one (p. 11, steps 1-8). */
function advanceBoard(g: Game): void {
  say(g, 'Una nuova tessera strada entra in gioco.', 'info');
  for (const v of [...g.vehicles]) {
    if (v.status === 'elim') continue;
    if (v.inStart || (v.pos && v.pos.c < TILE_COLS)) eliminate(g, v, 'era sulla tessera posteriore rimossa');
  }
  for (const [k, h] of [...g.hazards]) {
    if (Number(k.split(',')[1]) < TILE_COLS) { g.hazards.delete(k); g.hazardDiscard.push(h.type); }
  }
  for (const p of g.players) if (p.chopper && p.chopper.c < TILE_COLS) p.chopper = null;
  const rear = g.board.shift()!;
  g.pile.push({ tile: rear.tile, side: rear.side === 'a' ? 'b' : 'a' });
  const shift = (p: Pos): Pos => ({ r: p.r, c: p.c - TILE_COLS });
  for (const v of g.vehicles) if (v.pos) v.pos = shift(v.pos);
  for (const p of g.players) if (p.chopper) p.chopper = shift(p.chopper);
  g.hazards = new Map([...g.hazards].map(([k, h]) => {
    const [r, c] = k.split(',').map(Number);
    return [key({ r, c: c - TILE_COLS }), h];
  }));
  g.board.push(g.pile.shift()!);
  g.tilesPlaced++;
  placeHazards(g, 2, null);
  if (g.players.length === 2 && g.tilesPlaced >= base.two_player_final_tile) g.finalTile = true;
  beat(g, 'tile');
  if (g.finalTile) say(g, `${tileDef(g.board[2]).name} è la tessera finale: c'è il traguardo!`, 'info');
}

// ---------------------------------------------------------------- entering a space

interface MoveCtx {
  left: number; drift: boolean; driftUsed: boolean;
  /** Tank Treads: face-down hazards are not revealed. */ quiet?: boolean;
  /** Salt flats entered: the road die is allowed this turn whatever the ground (CDR p3). */ salt?: boolean;
}

/** The terrain as a car feels it: mud counts as road with Deep Treads. */
function groundFor(g: Game, v: Vehicle, p: Pos): Terrain {
  const t = terrainAt(g, p);
  return t === 'M' && up(v, 'deep_treads') ? 'R' : t;
}

/** The empty spaces next to a space. */
const freeAround = (g: Game, p: Pos): Pos[] => ALL_DIRS.map(d => neighbor(p, d)).filter(q => onBoard(q) && isEmpty(g, q));
const spaceOption = (q: Pos): Option => ({ label: `Casella ${q.r + 1}-${q.c + 1}`, pos: q });

/**
 * A road vehicle enters a space, by moving, slam or damage (pp. 7, 9, 11).
 * Returns true when the vehicle loses its remaining moves.
 */
function* enter(g: Game, v: Vehicle, to: Pos, ctx: MoveCtx | null, dir?: Dir): Gen<boolean> {
  if (g.winner !== null) return true;
  if (to.c >= COLS && to.r >= 0 && to.r < ROWS) {
    if (v.isWreck) { eliminate(g, v, 'è uscito dal fronte'); return true; }
    // Dead Alternator (ongoing effect): when another car drives off the lead tile, the damaged car is eliminated.
    for (const o of g.vehicles) if (o !== v && o.status !== 'elim' && hasOngoing(o, 'dead_alternator')) eliminate(g, o, 'Dead Alternator: un\'altra auto è uscita dalla tessera di testa');
    if (g.winner !== null) return true;
    if (g.finalTile) {
      g.winner = v.owner!;
      say(g, `${capital(carName(g, v))} taglia il traguardo! ${g.players[v.owner!].name} VINCE!`, 'good');
      return true;
    }
    advanceBoard(g);
    to = { r: to.r, c: to.c - TILE_COLS };
  }
  if (!onBoard(to)) { eliminate(g, v, 'è uscita dalla strada', to); return true; }
  if (terrainAt(g, to) === 'X') { eliminate(g, v, 'è entrata in una casella invalicabile', to); return true; }
  v.pos = { ...to };
  v.inStart = false;
  v.z = ++g.zTop;
  beat(g, 'move', { vehicleId: v.id, at: { ...to } });
  const k = key(to);
  const h = g.hazards.get(k);
  // Tank Treads: a face-down hazard is passed over; moveCar reveals the one the car stops on.
  if (h && !(ctx?.quiet && !h.faceUp)) {
    // Faulty Airbag (ongoing effect): onto a face-down hazard, the car is eliminated; the token stays face down.
    if (!h.faceUp && hasOngoing(v, 'faulty_airbag')) { eliminate(g, v, 'Faulty Airbag: è entrata su un pericolo coperto', to); return true; }
    if (!h.faceUp) {
      // Trash into Treasure (Cruft): gain a command token, then flip the hazard.
      if (hasPower(g, v.owner, 'trash_into_treasure') && g.tokenSupply > 0) {
        g.tokenSupply--;
        g.players[v.owner!].tokens++;
        say(g, `Trash into Treasure: ${g.players[v.owner!].name} prende un segnalino comando.`, 'good');
      }
      h.faceUp = true; beat(g, 'reveal', { at: { ...to } }); say(g, `Pericolo scoperto: ${HAZARD_NAME[h.type]}!`, 'info');
    }
    else say(g, `${capital(carName(g, v))} finisce su ${HAZARD_NAME[h.type]}.`, 'info');
    if (h.type === 'wreck') {
      g.hazards.delete(k); g.hazardDiscard.push('wreck');
      const w: Vehicle = { id: `w${g.zTop}`, owner: null, size: 'S', isWreck: true, pos: { ...to }, inStart: false,
        status: 'inop', damage: [], moved: false, coasts: 0, placed: [], z: v.z, upgrade: null, uses: 0 };
      v.z = ++g.zTop;
      g.vehicles.push(w);
    } else if (h.type === 'mine') {
      g.hazards.delete(k); g.hazardDiscard.push('mine');
      yield* damage(g, v);
      if (v.status !== 'elim' && v.pos && vehiclesAt(g, v.pos).length > 1) yield* slam(g, v.pos);
      return true;
    } else if (h.type === 'oil') {
      const d = rollFx(g, 'direction', 'oil-slick', to);
      say(g, `Olio! Dado direzione: ${DIR_NAME[d]}.`, 'dice');
      const stop = yield* enter(g, v, neighbor(to, d), ctx, d);
      yield* baldTires(g, v, d);
      return stop;
    } else if (h.type === 'quake') {
      g.hazards.delete(k); g.hazardDiscard.push('quake');
      yield* quake(g);
      if ((v.status as Vehicle['status']) !== 'ok' || !samePos(v.pos, to)) return true;
    } else if (h.type === 'sand_worm') {
      g.hazards.delete(k); g.hazardDiscard.push('sand_worm');
      sandWorm(g);
      if ((v.status as Vehicle['status']) === 'elim') return true;
    } else if (h.type === 'pit_trap') {
      // CDR p3: the shooting die against the vehicle that revealed it; a hit eliminates it.
      // The token stays and the space is impassable from now on.
      const f = rollFx(g, 'shooting', 'pit-trap', to);
      const hit = f === 'ANY' || f === v.size || (f === 'SM' && (v.size === 'S' || v.size === 'M'));
      say(g, `Trappola: dado sparo ${f} — ${hit ? 'presa!' : 'scampata.'}`, 'dice');
      if (hit) { eliminate(g, v, 'è caduta nella trappola', to); return true; }
      return false;
    }
  }
  // Carnage at Devil's Run terrain (CDR p3), as the space is now (a revealed hazard may have changed it).
  const ground = terrainAt(g, to);
  if (ground === 'G') {
    // First the car stops, then any slam (ruling of the rules owner, 2026-11-16): the moves are
    // lost even if the slam pushes it off the goo.
    say(g, `${capital(carName(g, v))} finisce nella melma tossica: si ferma.`, 'info');
    if (ctx) ctx.left = 0;
    if (vehiclesAt(g, to).length > 1) yield* slam(g, to);
    return true;
  }
  if (ground === 'D' && dir) {
    say(g, `Vetro del deserto: ${carName(g, v)} scivola di una casella ${DIR_NAME[dir]}.`, 'info');
    return yield* enter(g, v, neighbor(to, dir), ctx, dir);
  }
  if (ground === 'P') {
    // Only from the space directly behind (taken as moving forward onto it: ramps face the
    // lead tile, provisional until the tiles are known), else the vehicle is eliminated.
    if (dir !== 'F') { eliminate(g, v, 'è entrata nella rampa di traverso', to); return true; }
    const n = rollFx(g, 'stunt', 'ramp', to);
    say(g, `Rampa! Dado acrobazia ${n}: salta ${n} caselle in avanti.`, 'dice');
    let land = to;
    for (let i = 0; i < n; i++) land = neighbor(land, 'F');
    beat(g, 'jump', { vehicleId: v.id, from: { ...to }, at: { ...land } });
    if (ctx) ctx.left = 0;
    yield* enter(g, v, land, null, 'F');
    return true;
  }
  if (ground === 'F') catchFire(g, v);
  if (ground === 'S' && ctx) { ctx.salt = true; say(g, 'Saline: il dado strada si può usare in questo turno.', 'info'); }
  // Snowplow: a wreck or an inoperable vehicle in the way is pushed aside, and the car goes on.
  const others = vehiclesAt(g, to).filter(x => x !== v);
  if (ctx && up(v, 'snowplow') && others.length === 1 && (others[0].isWreck || others[0].status === 'inop')) {
    const free = freeAround(g, to);
    if (free.length) {
      const i = yield* ask({
        kind: 'plow', player: v.owner!, prompt: `${g.players[v.owner!].name}: Snowplow, dove spostare ${carName(g, others[0])}?`,
        options: [{ label: 'Non spostare (slam)' }, ...free.map(spaceOption)],
      });
      if (i > 0) {
        others[0].pos = { ...free[i - 1] };
        beat(g, 'move', { vehicleId: others[0].id, at: { ...free[i - 1] } });
        say(g, `Snowplow: ${carName(g, others[0])} è spostata di lato.`, 'info');
        return false;
      }
    }
  }
  if (vehiclesAt(g, to).length > 1) {
    if (ctx && ctx.drift && !ctx.driftUsed) {
      ctx.driftUsed = true;
      say(g, 'Drift: passa attraverso il veicolo senza slam.', 'info');
      if (up(v, 'ghost_mode')) {
        ctx.left += upN('ghost_mode');
        say(g, `Ghost Mode: +${upN('ghost_mode')} movimenti.`, 'good');
      }
      return false;
    }
    yield* slam(g, to);
    return true;
  }
  return false;
}

/** Slamming (p. 9): roll slam + direction, the larger vehicle's owner may reroll both once. */
function* slam(g: Game, at: Pos): Gen<void> {
  for (let guard = 0; guard < 50; guard++) {
    if (g.winner !== null) return;
    const stack = vehiclesAt(g, at);
    if (stack.length < 2) return;
    const top = stack[stack.length - 1], bottom = stack[stack.length - 2];
    // Nitro Leak (ongoing effect): a car involved in a slam is eliminated.
    const leaking = [top, bottom].filter(x => hasOngoing(x, 'nitro_leak'));
    if (leaking.length) { for (const x of leaking) eliminate(g, x, 'Nitro Leak: coinvolta in uno slam'); continue; }
    beat(g, 'slam', { at: { ...at }, vehicleId: top.id });
    say(g, `SLAM! ${capital(carName(g, top))} contro ${carName(g, bottom)}.`, 'bad');
    // Bump! (Bumpo): the first time the player slams this turn, only the direction die, and the other car moves.
    const mine = top.owner === g.current && !top.isWreck;
    const bump = mine && g.fx.bump && g.fx.slams === 0;
    if (mine) g.fx.slams++;
    // Bent Frame (ongoing effect): the slammed car moves, without rolling the slam die.
    const bent = !bump && top !== bottom && hasOngoing(bottom, 'bent_frame');
    if (bent) say(g, 'Bent Frame: si muove l\'auto urtata, senza dado slam.', 'info');
    let which: 'top' | 'bottom' = bump || bent ? 'bottom' : rollFx(g, 'slam', 'slam', at);
    let d = rollFx(g, 'direction', 'slam', at);
    if (bump) say(g, `Bump! Si muove ${carName(g, bottom)}; direzione ${DIR_NAME[d]}.`, 'dice');
    else say(g, `Dado slam: si muove il veicolo ${which === 'top' ? 'sopra' : 'sotto'}; direzione ${DIR_NAME[d]}.`, 'dice');
    const big = SIZE_RANK[top.size] > SIZE_RANK[bottom.size] ? top : SIZE_RANK[bottom.size] > SIZE_RANK[top.size] ? bottom : null;
    // Sandbags: the opponents of a car with sandbags may not reroll the slam die or the direction die.
    const barred = (owner: number | null): boolean => [top, bottom].some(x => up(x, 'sandbags') && x.owner !== owner);
    if (!bump && big && big.owner !== null && !barred(big.owner)) {
      const moving = which === 'top' ? top : bottom;
      const i = yield* ask({
        kind: 'slamReroll', player: big.owner,
        prompt: `${g.players[big.owner].name}: si muove ${carName(g, moving)} verso ${DIR_NAME[d]}. Ritirare entrambi i dadi?`,
        options: [{ label: 'Tieni il risultato' }, { label: 'Ritira i due dadi' }],
      });
      if (i === 1) {
        which = bent ? 'bottom' : rollFx(g, 'slam', 'slam-reroll', at);
        d = rollFx(g, 'direction', 'slam-reroll', at);
        say(g, `Ritiro: si muove il veicolo ${which === 'top' ? 'sopra' : 'sotto'}; direzione ${DIR_NAME[d]}.`, 'dice');
      }
    }
    const affected = which === 'top' ? top : bottom;
    // Junk in the Trunk (Bumpo): if your car would move in a slam, you may reroll the direction die.
    // Stability Control: the same, for the car that has the upgrade.
    if ((hasPower(g, affected.owner, 'junk_in_the_trunk') || up(affected, 'stability_control')) && !affected.isWreck && !barred(affected.owner)) {
      const i = yield* ask({
        kind: 'dirReroll', player: affected.owner!,
        prompt: `${g.players[affected.owner!].name}: ${carName(g, affected)} si muoverebbe verso ${DIR_NAME[d]}. Ritirare il dado direzione?`,
        options: [{ label: 'Tieni il risultato' }, { label: 'Ritira il dado direzione' }],
      });
      if (i === 1) {
        d = rollFx(g, 'direction', 'junk-in-the-trunk', at);
        say(g, `${up(affected, 'stability_control') ? 'Stability Control' : 'Junk in the Trunk'}: nuova direzione ${DIR_NAME[d]}.`, 'dice');
      }
    }
    const dest = neighbor(at, d);
    // Roll Cage: instead of being slammed into another car, the car goes to an adjacent empty space.
    if (up(affected, 'roll_cage') && onBoard(dest) && vehiclesAt(g, dest).length) {
      const free = freeAround(g, at);
      if (free.length) {
        const i = yield* ask({
          kind: 'rollCage', player: affected.owner!, prompt: `${g.players[affected.owner!].name}: Roll Cage, evitare lo slam contro un'altra auto?`,
          options: [{ label: 'No, subisci lo slam' }, ...free.map(spaceOption)],
        });
        if (i > 0) {
          affected.pos = { ...free[i - 1] };
          affected.z = ++g.zTop;
          beat(g, 'move', { vehicleId: affected.id, at: { ...free[i - 1] } });
          say(g, `Roll Cage: ${carName(g, affected)} si mette in una casella vuota.`, 'info');
          continue;
        }
      }
    }
    const other = affected === top ? bottom : top;
    yield* enter(g, affected, dest, null, d);
    if (samePos(affected.pos, dest)) yield* baldTires(g, affected, d);
    // Assault Bumper: the car it moved in a slam goes one extra space in the same direction.
    if (up(other, 'assault_bumper') && !affected.isWreck && affected.status !== 'elim' && samePos(affected.pos, dest) && g.winner === null) {
      say(g, 'Assault Bumper: una casella in più nella stessa direzione.', 'info');
      yield* enter(g, affected, neighbor(dest, d), null, d);
    }
  }
}

/** Taking damage (pp. 6, 12). */
function* damage(g: Game, v: Vehicle): Gen<void> {
  if (g.winner !== null || v.status === 'elim') return;
  if (v.isWreck) { eliminate(g, v, 'ha subito danno'); return; }
  if (v.status === 'inop') { say(g, `${capital(carName(g, v))} è già fuori uso: il danno è ignorato.`); return; }
  const draw = (): DamageToken | null => {
    if (!g.damagePile.length) return null;
    const [i] = rollDice(g, [{ id: 'damage-draw', n: g.damagePile.length }], 'damage-draw');
    return g.damagePile.splice(i, 1)[0];
  };
  let token = draw();
  // Jury-Rigging (Asha) and Onboard Computer: the token is placed face down and its effect is ignored.
  const hidden = !!token && (hasPower(g, v.owner, 'jury_rigging') || up(v, 'onboard_computer'));
  // Crumple Zones: draw two damage tokens, pick one and discard the other.
  if (token && !hidden && up(v, 'crumple_zones') && g.damagePile.length) {
    const pair = [token, draw()!];
    const i = yield* ask({
      kind: 'pickDamage', player: v.owner!, prompt: `${g.players[v.owner!].name}: Crumple Zones, quale danno prende ${carName(g, v)}?`,
      options: pair.map(t => ({ label: DAMAGE_NAME[t.type], token: { ...t }, carId: v.id })),
    });
    token = pair[i];
    g.damagePile.push(pair[1 - i]);
    say(g, `Crumple Zones: scelto ${DAMAGE_NAME[token.type]}.`, 'info');
  }
  beat(g, 'damage', { vehicleId: v.id, token: token && !hidden ? { ...token } : null, ...(hidden ? { faceDown: true } : {}), ...(v.pos ? { at: { ...v.pos } } : {}) });
  if (hidden) say(g, `${capital(carName(g, v))} subisce danno: il segnalino resta coperto e senza effetto.`, 'bad');
  else say(g, `${capital(carName(g, v))} subisce danno: ${token ? DAMAGE_NAME[token.type] : 'nessun segnalino rimasto'}.`, 'bad');
  if (token && !hidden) yield* damageEffect(g, v, token);
  // The effect may have moved the car off the board (TS narrows status too eagerly here).
  if ((v.status as Vehicle['status']) === 'elim') { if (token) g.damagePile.push(token); return; }
  if (token) v.damage.push(token);
  if (v.damage.length >= limit(v)) yield* breakDown(g, v);
}

/** A car becomes inoperable. Big Red Button: its owner may eliminate it, with every adjacent car and chopper. */
function* breakDown(g: Game, v: Vehicle): Gen<void> {
  // Shattered Windshield (ongoing effect): a car that becomes inoperable is eliminated.
  if (hasOngoing(v, 'shattered_windshield')) { eliminate(g, v, 'Shattered Windshield: è andata fuori uso'); return; }
  const button = up(v, 'big_red_button');
  v.status = 'inop';
  if (v.onFire) putOut(g, v); // CDR p3: an inoperable vehicle loses its ON FIRE! token
  say(g, `${capital(carName(g, v))} è fuori uso (girata all'indietro).`, 'bad');
  if (button && v.pos && g.winner === null) {
    const i = yield* ask({
      kind: 'redButton', player: v.owner!, prompt: `${g.players[v.owner!].name}: Big Red Button, eliminare ${carName(g, v)} con tutto ciò che ha accanto?`,
      options: [{ label: 'No, resta fuori uso' }, { label: 'Premi il bottone', danger: true, pos: v.pos, carId: v.id }],
    });
    if (i === 1) {
      const around = ALL_DIRS.map(d => neighbor(v.pos!, d));
      say(g, 'Big Red Button: BOOM!', 'bad');
      eliminate(g, v, 'ha premuto il Big Red Button');
      for (const q of around) {
        for (const x of vehiclesAt(g, q)) if (!x.isWreck) eliminate(g, x, 'era accanto al Big Red Button');
        for (const pl of g.players) {
          if (samePos(pl.chopper, q)) { pl.chopper = null; say(g, `L'elicottero di ${pl.name} è eliminato dal Big Red Button.`, 'bad'); }
        }
      }
    }
  }
  checkPlayers(g);
}

function* damageEffect(g: Game, v: Vehicle, t: DamageToken): Gen<void> {
  if (!v.pos) return;
  switch (t.type) {
    case 'dent': return;
    case 'shrapnel': {
      const d = rollFx(g, 'direction', 'shrapnel', v.pos);
      say(g, `Schegge verso ${DIR_NAME[d]}.`, 'dice');
      let p = neighbor(v.pos, d);
      while (onBoard(p)) {
        const hit = vehiclesAt(g, p).filter(x => x !== v);
        if (hit.length) { yield* damage(g, hit[hit.length - 1]); return; }
        p = neighbor(p, d);
      }
      say(g, 'Le schegge non colpiscono nessuno.');
      return;
    }
    case 'skid': {
      const d = t.dir ?? 'F';
      say(g, `Sbandata: 1 casella ${DIR_NAME[d]}.`);
      yield* enter(g, v, neighbor(v.pos, d), null, d);
      return;
    }
    case 'dazed': {
      const n = rollFx(g, 'stunt', 'dazed', v.pos);
      say(g, `Stordito: dado acrobazia ${n}.`, 'dice');
      const ctx: MoveCtx = { left: n, drift: false, driftUsed: false };
      while (ctx.left > 0 && v.pos && v.status !== 'elim' && g.winner === null) {
        const d = rollFx(g, 'direction', 'dazed', v.pos);
        const to = neighbor(v.pos, d);
        say(g, `Stordito: verso ${DIR_NAME[d]}.`, 'dice');
        ctx.left = Math.max(0, ctx.left - (onBoard(to) && terrainAt(g, to) === 'M' ? 2 : 1));
        if (yield* enter(g, v, to, ctx, d)) break;
        yield* baldTires(g, v, d);
      }
      return;
    }
    case 'on_fire':
      // CDR p4: an ON FIRE! token from the supply; the damage token stays, face down.
      catchFire(g, v);
      return;
    case 'ongoing_effect': {
      // CDR p4: a card from the ongoing effect deck under the token, in effect until it is repaired.
      const c = g.carnage;
      if (!c) return;
      if (!c.deck.length && c.discard.length) { c.deck = shuffled(g, c.discard, 'ongoing-effects'); c.discard = []; }
      const card = c.deck.shift();
      if (card) { t.card = card; say(g, `Effetto continuo: ${ongoingName(card)}.`, 'bad'); }
      return;
    }
    case 'blastoff': {
      const d = rollFx(g, 'direction', 'blastoff', v.pos);
      const n = rollFx(g, 'stunt', 'blastoff', v.pos);
      say(g, `Decollo: ${n} caselle verso ${DIR_NAME[d]}.`, 'dice');
      let p = v.pos;
      for (let i = 0; i < n; i++) p = neighbor(p, d);
      yield* enter(g, v, p, null, d);
      yield* baldTires(g, v, d);
      return;
    }
  }
}

// ---------------------------------------------------------------- Carnage at Devil's Run

/**
 * The expansion's numbers from data/trv/carnage.json. Throws, naming them, while some are still
 * missing there (the rulebook does not give them: see the file's `_missing`).
 */
export function carnageNumbers(): CarnageNumbers {
  const d = carnageData as unknown as {
    hazard_tokens: Record<CarnageHazard, number | null>;
    damage_tokens: { on_fire: { count: number | null }; ongoing_effect: { count: number | null } };
    dice: { fire: FireFace[] | null };
    components: { ongoing_effect_cards: number };
    ongoing_effects: { id: string; text: string | null; count?: number }[];
  };
  const missing: string[] = [];
  // Keys starting with '_' are notes (sources), not token kinds.
  const hazards = Object.fromEntries(Object.entries(d.hazard_tokens).filter(([k]) => !k.startsWith('_'))) as Record<CarnageHazard, number | null>;
  for (const [k, n] of Object.entries(hazards)) if (typeof n !== 'number') missing.push(`hazard_tokens.${k}`);
  if (typeof d.damage_tokens.on_fire.count !== 'number') missing.push('damage_tokens.on_fire.count');
  if (typeof d.damage_tokens.ongoing_effect.count !== 'number') missing.push('damage_tokens.ongoing_effect.count');
  if (!d.dice.fire || d.dice.fire.length !== 6) missing.push('dice.fire');
  const deck = d.ongoing_effects.flatMap(c => Array.from({ length: c.count ?? 1 }, () => c.id));
  if (deck.length !== d.components.ongoing_effect_cards || d.ongoing_effects.some(c => !c.text)) missing.push('ongoing_effects');
  if (missing.length) throw new Error(`Carnage at Devil's Run: missing data in carnage.json: ${missing.join(', ')}`);
  return {
    hazards: hazards as Record<CarnageHazard, number>,
    damage: { on_fire: d.damage_tokens.on_fire.count!, ongoing_effect: d.damage_tokens.ongoing_effect.count! },
    fireDie: d.dice.fire!, ongoing: deck,
  };
}

/** Transmission Failure: the value the movement die is set to (carnage.json, confirmed 3 by the rules owner). */
const TRANSMISSION_FAILURE_MOVE = (carnageData.ongoing_effects as { id: string; move?: number }[]).find(c => c.id === 'transmission_failure')?.move ?? 3;

/** Whether the expansion's 5 double-sided road tiles are in carnage.json (setup step 1, CDR p2). */
export function carnageTilesReady(): boolean {
  const t = (carnageData as unknown as { tiles?: unknown[] }).tiles;
  return Array.isArray(t) && t.length === carnageData.components.road_tiles.count * 2;
}

/** The name of an ongoing effect card (its id when the data does not name it). */
export function ongoingName(id: string): string {
  return (carnageData.ongoing_effects as { id: string; name: string }[]).find(c => c.id === id)?.name ?? id;
}

/** Nitro Leak: the value an assigned die is set to (carnage.json). */
const NITRO_LEAK_DIE = (carnageData.ongoing_effects as { id: string; die?: number }[]).find(c => c.id === 'nitro_leak')?.die ?? 6;

/** Bald Tires (ongoing effect): after the direction die moved the car, one more space the same way. */
function* baldTires(g: Game, v: Vehicle, d: Dir): Gen<void> {
  if (!hasOngoing(v, 'bald_tires') || v.status === 'elim' || !v.pos || g.winner !== null) return;
  say(g, `Bald Tires: ${carName(g, v)} scivola di un'altra casella ${DIR_NAME[d]}.`, 'info');
  yield* enter(g, v, neighbor(v.pos, d), null, d);
}

/** Whether ongoing effect card `id` lies under one of the car's damage tokens (CDR p4). */
function hasOngoing(v: Vehicle, id: string): boolean {
  return v.damage.some(t => t.card === id);
}

/** A damage token leaves the car: its ongoing effect card goes to the discard pile (CDR p4). */
function discardCard(g: Game, t: DamageToken): void {
  if (!t.card) return;
  g.carnage?.discard.push(t.card);
  delete t.card;
}

/** Rolls the fire die (CDR p3), from the faces in the expansion's numbers. */
function rollFire(g: Game): FireFace {
  const faces = g.carnage!.n.fireDie;
  const [f] = rollDice(g, [{ id: 'fire', n: faces.length }], 'fire');
  const rolled = { die: 'fire', face: f, value: faces[f] };
  g.lastRoll.push(rolled);
  g.pendingDice.push(rolled);
  beat(g, 'roll', { die: rolled });
  return faces[f];
}

/**
 * A vehicle catches fire (CDR p3): it takes an ON FIRE! token. The tokens are unlimited (ruling of
 * the rules owner, 2026-11-16). A car already on fire, an inoperable one (it would lose the token at
 * once) or a wreck takes none.
 */
function catchFire(g: Game, v: Vehicle): void {
  if (!g.carnage || v.onFire || v.status !== 'ok' || v.isWreck) return;
  v.onFire = true;
  beat(g, 'fire', { vehicleId: v.id, why: 'on', ...(v.pos ? { at: { ...v.pos } } : {}) });
  say(g, `${capital(carName(g, v))} prende fuoco!`, 'bad');
}

/** The fire goes out: the vehicle's ON FIRE! token is removed. */
function putOut(g: Game, v: Vehicle): void {
  if (!v.onFire) return;
  v.onFire = false;
  beat(g, 'fire', { vehicleId: v.id, why: 'out', ...(v.pos ? { at: { ...v.pos } } : {}) });
}

/**
 * Carnage at Devil's Run, just before a car moves: Transmission Failure (CDR p4) sets the move to 1
 * and bars more moves; a car ON FIRE! rolls the fire die (CDR p3): +1/+2 moves that must all be
 * made, the fire goes out, or the car is eliminated.
 */
function beforeMove(g: Game, car: Vehicle, mv: { moves: number }): { fixed: boolean; mustMoveAll: boolean } {
  const fixed = hasOngoing(car, 'transmission_failure');
  if (fixed) { mv.moves = TRANSMISSION_FAILURE_MOVE; say(g, `Transmission Failure: il dado movimento vale ${TRANSMISSION_FAILURE_MOVE}.`, 'bad'); }
  let mustMoveAll = false;
  if (car.onFire && g.carnage && g.winner === null && car.status === 'ok') {
    const f = rollFire(g);
    if (f === '+1' || f === '+2') {
      if (fixed) say(g, `Dado fuoco ${f}: Transmission Failure, nessun movimento in più.`, 'dice');
      else { mv.moves += Number(f); mustMoveAll = true; say(g, `Dado fuoco ${f}: ${mv.moves} movimenti, da fare tutti.`, 'dice'); }
    } else if (f === 'out') { putOut(g, car); say(g, 'Dado fuoco: il fuoco si spegne.', 'dice'); }
    else if (hasPower(g, car.owner, 'smokin')) say(g, 'Dado fuoco: teschio, ma Smokin\': nessun effetto.', 'dice');
    else { say(g, 'Dado fuoco: teschio!', 'dice'); eliminate(g, car, 'è bruciata'); }
  }
  return { fixed, mustMoveAll };
}

/** The road vehicles on the board (not in the starting area). */
const onRoad = (g: Game): Vehicle[] => g.vehicles.filter(v => v.status !== 'elim' && v.pos && !v.inStart);

/**
 * Quake (CDR p3): the direction die, then every road vehicle one space that way, at the same time.
 * Rulings of the rules owner (2026-11-16) and the official FAQ: a vehicle pushed off the sides or
 * the back, or onto an impassable space, is eliminated; one pushed past the front edge reveals the
 * new tile (as when driving off it); the landing spaces reveal their hazards and apply their terrain,
 * resolved "as simultaneously as possible, failing that randomly": all vehicles move first, then
 * each landing is resolved in an order rolled at random; vehicles ending on one space slam.
 */
function* quake(g: Game): Gen<void> {
  const d = rollFx(g, 'direction', 'quake');
  say(g, `Terremoto! Tutti i veicoli si spostano di una casella ${DIR_NAME[d]}.`, 'dice');
  const landed: Vehicle[] = [], ahead: Vehicle[] = [];
  for (const v of onRoad(g)) {
    const to = neighbor(v.pos!, d);
    if (to.c >= COLS && to.r >= 0 && to.r < ROWS) { ahead.push(v); continue; }
    if (!onBoard(to)) { eliminate(g, v, 'è uscita dalla strada nel terremoto', to); continue; }
    if (terrainAt(g, to) === 'X') { eliminate(g, v, 'è finita su una casella invalicabile nel terremoto', to); continue; }
    v.pos = { ...to };
    beat(g, 'move', { vehicleId: v.id, at: { ...to } });
    landed.push(v);
  }
  // Past the front edge: the new tile comes in (positions shift with it, so each is recomputed).
  for (const v of ahead) if (v.status !== 'elim' && v.pos && g.winner === null) yield* enter(g, v, neighbor(v.pos, d), null, d);
  for (const v of shuffled(g, landed, 'quake-order')) {
    if (v.status === 'elim' || !v.pos || g.winner !== null) continue;
    yield* enter(g, v, v.pos, null, d);
    yield* baldTires(g, v, d);
  }
}

/**
 * Sand Worm (CDR p3): the road vehicle farthest back on the board is eliminated, all of them when
 * tied. Odd rows sit half a space forward (game_base.json), so they count half a column more.
 */
function sandWorm(g: Game): void {
  const back = (v: Vehicle): number => v.pos!.c + (v.pos!.r % 2 ? 0.5 : 0);
  const road = onRoad(g);
  if (!road.length) return;
  const last = Math.min(...road.map(back));
  say(g, 'Verme delle sabbie!', 'bad');
  for (const v of road.filter(x => back(x) === last)) eliminate(g, v, 'è stata inghiottita dal verme delle sabbie');
}

/** Internals for unit tests only: moving into a space and taking damage, outside a whole game. */
export const __test = {
  /** Enters `to` going `dir`; `ctx` carries the moves left (and says whether salt flats were crossed). */
  enter: (g: Game, v: Vehicle, to: Pos, ctx: { left: number; salt?: boolean }, dir?: Dir): Gen<boolean> =>
    enter(g, v, to, Object.assign(ctx, { drift: false, driftUsed: false }) as MoveCtx, dir),
  /** Damages `v` with exactly token `t`. */
  damageWith: (g: Game, v: Vehicle, t: DamageToken): Gen<void> => { g.damagePile = [t]; return damage(g, v); },
  beforeMove,
  repair,
  slam,
};

// ---------------------------------------------------------------- shooting

function frontArc(p: Pos): Pos[] {
  return [neighbor(p, 'FL'), neighbor(p, 'F'), neighbor(p, 'FR')];
}

/** Shoot step (p. 10): any road vehicle in the front arc, chosen or skipped. */
function* shootFrom(g: Game, player: number, from: Pos, who: string, shooter: Vehicle | null = null): Gen<void> {
  if (g.winner !== null) return;
  let targets: Vehicle[] = [];
  const blocked: Blocked[] = [];
  // Long Arm of the Law (Wong): also the spaces two away, straight on from the front arc.
  const spaces = hasPower(g, player, 'long_arm_of_the_law') ? longArc(from, shoppe.long_arm_range) : frontArc(from);
  // Punt Gun: two spaces away. Rail Gun: three spaces straight ahead. Rear Guns: any adjacent space.
  if (up(shooter, 'punt_gun')) spaces.push(...longArc(from, upN('punt_gun')));
  if (up(shooter, 'rail_gun')) { let q = from; for (let n = 0; n < upN('rail_gun'); n++) { q = neighbor(q, 'F'); spaces.push(q); } }
  if (up(shooter, 'rear_guns')) spaces.push(...ALL_DIRS.map(d => neighbor(from, d)));
  for (const p of spaces.filter((q, i, a) => a.findIndex(x => samePos(x, q)) === i)) {
    if (!onBoard(p)) continue;
    const st = vehiclesAt(g, p);
    const t = st[st.length - 1];
    // Smoke Screen: not from the space directly behind the car.
    if (t && up(t, 'smoke_screen') && samePos(from, neighbor(p, 'B'))) blocked.push({ carId: t.id, pos: { ...p }, because: 'smoke_screen' });
    else if (t) targets.push(t);
  }
  // Stealth Technology: not a target while there is another vehicle to shoot.
  const seen = targets.filter(t => !up(t, 'stealth_technology'));
  if (seen.length) {
    for (const t of targets) if (!seen.includes(t)) blocked.push({ carId: t.id, pos: { ...t.pos! }, because: 'stealth_technology' });
    targets = seen;
  }
  if (!targets.length) { say(g, `${who}: nessun bersaglio nell'arco frontale, niente sparo.`, 'info'); return; }
  const i = yield* ask({
    kind: 'shoot', player, prompt: `${g.players[player].name}: sparare con ${who}?`, ...(blocked.length ? { blocked } : {}),
    options: [{ label: 'Non sparare' }, ...targets.map(t => ({ label: `Spara ${carName(g, t).replace(/^l'/, "all'").replace(/^il /, 'al ')}`, carId: t.id, pos: t.pos! }))],
  });
  if (i === 0) return;
  const t = targets[i - 1];
  beat(g, 'shot', { from: { ...from }, at: { ...t.pos! }, vehicleId: t.id });
  // Spotter (Abigail): another of your operable cars next to the target. Called Shot (Boudreaux).
  const spotter = hasPower(g, player, 'spotter') && g.vehicles.some(v => v.owner === player && v.status === 'ok'
    && v.pos && !samePos(v.pos, from) && ALL_DIRS.some(d => samePos(neighbor(t.pos!, d), v.pos)));
  const called = g.fx.calledShot && player === g.current;
  let hit = spotter || called;
  if (hit) say(g, `${spotter ? 'Spotter' : 'Called Shot'}: colpo automatico!`, 'good');
  else {
    const shot = (cause: string): boolean => {
      const f = rollFx(g, 'shooting', cause, from);
      // Armor Plating: a result of ANY against the car is a miss.
      const armor = f === 'ANY' && up(t, 'armor_plating');
      const ok = !armor && (f === 'ANY' || f === t.size || (f === 'SM' && (t.size === 'S' || t.size === 'M')));
      const face = f === 'ANY' ? 'qualsiasi' : f === 'SM' ? 'piccola/media' : SIZE_NAME[f as Size];
      say(g, `Dado sparo: ${face} — ${ok ? 'COLPITO!' : armor ? 'mancato (Armor Plating).' : 'mancato.'}`, 'dice');
      return ok;
    };
    hit = shot('shoot');
    // Objection! (Machine Gun Joe): you may reroll the shooting die.
    // Heavy Machine Gun: the same, when shooting with the car that has it.
    // Exposed Hardware (ongoing effect on the target): another player shooting it may reroll too.
    if (!hit && (hasPower(g, player, 'objection') || up(shooter, 'heavy_machine_gun') || (hasOngoing(t, 'exposed_hardware') && t.owner !== player))) {
      const r = yield* ask({
        kind: 'shootReroll', player, prompt: `${g.players[player].name}: mancato. Ritirare il dado sparo?`,
        options: [{ label: 'Tieni il risultato' }, { label: 'Ritira il dado sparo' }],
      });
      if (r === 1) hit = shot('objection');
    }
  }
  if (!hit) return;
  yield* damage(g, t);
  // Flamethrower (Emberco): the target hit this turn also catches fire.
  if (g.fx.flamethrower && player === g.current && t.status === 'ok') catchFire(g, t);
  // Grappling Hook: after resolving the damage, the car may swap spaces with the car it hit.
  if (g.winner === null && up(shooter, 'grappling_hook') && shooter!.pos && !t.isWreck && t.status !== 'elim' && t.pos && !samePos(t.pos, shooter!.pos)) {
    const s = yield* ask({
      kind: 'swap', player, prompt: `${g.players[player].name}: Grappling Hook, scambiare di posto con ${carName(g, t)}?`,
      options: [{ label: 'No' }, { label: 'Scambia di posto', carId: t.id, pos: t.pos }],
    });
    if (s === 1) {
      [shooter!.pos, t.pos] = [t.pos, shooter!.pos];
      beat(g, 'move', { vehicleId: shooter!.id, at: { ...shooter!.pos } });
      beat(g, 'move', { vehicleId: t.id, at: { ...t.pos } });
      say(g, `Grappling Hook: ${carName(g, shooter!)} e ${carName(g, t)} si scambiano di posto.`, 'info');
    }
  }
  // Soul Siphon (Vince Vamp): after a hit, remove a damage token from one of your cars.
  const p = g.players[player];
  if (g.winner === null && hasPower(g, player, 'soul_siphon') && canRepair(g, p)) {
    say(g, 'Soul Siphon: un danno in meno su una propria auto.', 'good');
    yield* repair(g, p);
  }
}

const ALL_DIRS: Dir[] = ['F', 'FL', 'FR', 'B', 'BL', 'BR'];

/** The front arc and the spaces further on, up to `range` spaces away. */
function longArc(p: Pos, range: number): Pos[] {
  let ring = frontArc(p);
  const all = [...ring];
  for (let n = 1; n < range; n++) {
    ring = ring.flatMap(frontArc).filter((q, i, a) => a.findIndex(x => samePos(x, q)) === i);
    for (const q of ring) if (!all.some(x => samePos(x, q))) all.push(q);
  }
  return all;
}

const canRepair = (g: Game, p: Player): boolean => repairable(g, p).length > 0;
/** The cars of `p` that can be repaired. Lost Tools (ongoing effect, CDR): only next to another of the player's cars. */
function repairable(g: Game, p: Player): Vehicle[] {
  return g.vehicles.filter(v => v.owner === p.id && v.status !== 'elim' && v.damage.length > 0
    && (!hasOngoing(v, 'lost_tools') || g.vehicles.some(o => o !== v && o.owner === p.id && o.status !== 'elim' && o.pos && v.pos
      && ALL_DIRS.some(d => samePos(neighbor(v.pos!, d), o.pos)))));
}

// ---------------------------------------------------------------- the turn

/**
 * A car's movement. `fixed`: the car cannot gain more moves (Transmission Failure: no road die)
 * and must move them all (fire die bonus, CDR p3: "You must move the full amount").
 */
function* moveCar(g: Game, car: Vehicle, moves: number, drift: boolean, coast: boolean, die: number, fixed = false, mustMoveAll = false): Gen<void> {
  // Tank Treads: with an assigned die of 3 or less, face-down hazards on the way are not revealed.
  const ctx: MoveCtx = { left: moves, drift, driftUsed: false, quiet: up(car, 'tank_treads') && die <= upN('tank_treads') };
  // Road die (p. 9): the car must start and move only on road. Leaving the starting area counts
  // as starting on road (decided with the rules owner, 2026-11-15).
  let onlyRoad = car.inStart || (!!car.pos && groundFor(g, car, car.pos) === 'R');
  const startedOff = !onlyRoad;
  // Off-Road Suspension: starting on road is enough. Spoiler: the road die is always 2.
  const anywhere = up(car, 'off_road_suspension') && !startedOff;
  const roadDie = up(car, 'spoiler') ? upN('spoiler') : g.roadDie;
  let stopped = false;
  let bonusUsed = coast;
  for (;;) {
    while (ctx.left > 0 && car.status === 'ok' && g.winner === null) {
      const opts: Option[] = [];
      const targets: Pos[] = car.inStart || !car.pos
        ? Array.from({ length: ROWS }, (_, r) => ({ r, c: 0 }))
        : frontArc(car.pos);
      const start = car.inStart || !car.pos;
      // The way each step goes: out of the starting area straight on, then the front arc.
      const dirs: Dir[] = start ? targets.map(() => 'F') : ['FL', 'F', 'FR'];
      targets.forEach((to, k) => opts.push(stepOption(g, car, to, ctx.left,
        start ? `Corsia ${to.r + 1}` : ['Avanti-sinistra', 'Avanti', 'Avanti-destra'][k], dirs[k])));
      // Skull Shift Knob: the car does not have to use all of its moves (unless the fire die says so).
      if (!start && up(car, 'skull_shift_knob') && !mustMoveAll) opts.push({ label: 'Fermati qui' });
      const i = yield* ask({
        kind: 'step', player: car.owner!,
        prompt: `${g.players[car.owner!].name}: muovi ${carName(g, car)} — ${ctx.left} ${ctx.left === 1 ? 'movimento' : 'movimenti'} rimasti.`,
        options: opts,
      });
      if (i >= targets.length) {
        say(g, 'Skull Shift Knob: l’auto si ferma qui.', 'info');
        ctx.left = 0;
        bonusUsed = true;
        break;
      }
      const to = targets[i];
      const t = onBoard(to) ? groundFor(g, car, to) : to.c >= COLS ? 'R' : 'o';
      if (t !== 'R') onlyRoad = false;
      ctx.left = Math.max(0, ctx.left - (t === 'M' ? 2 : 1));
      if (yield* enter(g, car, to, ctx, dirs[i])) { stopped = true; ctx.left = 0; }
    }
    if (anywhere || ctx.salt) onlyRoad = true;
    if (!stopped && !bonusUsed && car.status === 'ok' && !onlyRoad && g.winner === null) {
      say(g, startedOff
        ? 'Niente dado strada: l’auto non è partita da una casella di strada.'
        : 'Niente dado strada: l’auto non si è mossa solo su strada.', 'info');
    }
    if (stopped || bonusUsed || car.status !== 'ok' || !onlyRoad || g.winner !== null) break;
    bonusUsed = true;
    if (fixed) { say(g, 'Transmission Failure: niente dado strada, l’auto non può guadagnare movimenti.', 'info'); break; }
    const i = yield* ask({
      kind: 'roadDie', player: car.owner!,
      prompt: `${anywhere ? 'Off-Road Suspension' : 'Sempre su strada'}! Usare il dado strada (+${roadDie})? Se lo usi devi muovere tutto.`,
      options: [{ label: 'No, fermati qui' }, { label: `Sì, altri ${roadDie} movimenti`, dieValue: roadDie }],
    });
    if (i === 0) break;
    ctx.left = roadDie;
  }
  // Tank Treads: the face-down hazard the car ends its move on is revealed.
  const under = car.pos ? g.hazards.get(key(car.pos)) : undefined;
  if (ctx.quiet && car.pos && car.status === 'ok' && under && !under.faceUp && g.winner === null) {
    ctx.quiet = false;
    if (yield* enter(g, car, car.pos, ctx)) stopped = true;
  }
  if (!stopped && car.pos && vehiclesAt(g, car.pos).length > 1) yield* slam(g, car.pos);
}

function stepOption(g: Game, car: Vehicle, to: Pos, left: number, name: string, dir: Dir = 'F'): Option {
  if (to.c >= COLS && to.r >= 0 && to.r < ROWS) {
    return { label: `${name}: ${g.finalTile ? 'TRAGUARDO!' : 'nuova tessera'}`, pos: to };
  }
  if (!onBoard(to)) return { label: `${name}: fuori dal bordo (eliminata)`, pos: to, danger: true };
  const t = groundFor(g, car, to);
  if (t === 'X') return { label: `${name}: invalicabile (eliminata)`, pos: to, danger: true };
  if (t === 'P' && dir !== 'F') return { label: `${name}: rampa di traverso (eliminata)`, pos: to, danger: true };
  const parts = [t === 'R' ? 'strada' : t === 'M' ? (left === 1 ? 'fango (ultimo movimento)' : 'fango, costa 2') : TERRAIN_NAME[t] ?? 'fuoristrada'];
  const h = g.hazards.get(key(to));
  if (h) parts.push(h.faceUp ? HAZARD_NAME[h.type] : 'pericolo coperto');
  if (vehiclesAt(g, to).length) parts.push('SLAM');
  return { label: `${name}: ${parts.join(', ')}`, pos: to };
}

function* turn(g: Game, p: Player): Gen<void> {
  g.current = p.id;
  g.lastRoll = [];
  g.fx = { bump: false, calledShot: false, slams: 0, flamethrower: false };
  const allFree = p.dice.map((_, i) => i).filter(i => !p.used[i]);
  // Two dice with the same value are the same choice: offer each value once.
  const free = allFree.filter(i => allFree.find(j => p.dice[j] === p.dice[i]) === i);
  const mine = g.vehicles.filter(v => v.owner === p.id && v.status === 'ok');
  const fresh = mine.filter(v => !v.moved);
  const assign: { die: number; car: Vehicle; coast: boolean }[] = [];
  // Cracked Flywheel (ongoing effect): that car must be the first one the player moves each round, if able.
  const flywheel = fresh.length === mine.length ? fresh.find(v => hasOngoing(v, 'cracked_flywheel')) : undefined;
  if (fresh.length) for (const d of free) for (const car of flywheel ? [flywheel] : fresh) assign.push({ die: d, car, coast: false });
  else for (const d of free) for (const car of mine) if (car.coasts < base.max_coasts_per_round) assign.push({ die: d, car, coast: true });
  if (!assign.length) { say(g, `${p.name} non ha mosse disponibili e salta il turno.`, 'turn'); return; }
  say(g, `— Turno di ${p.name} (round ${g.round}) —`, 'turn');
  const ai = yield* ask({
    kind: 'assign', player: p.id, prompt: `${p.name}: assegna un dado movimento a un'auto.`,
    options: assign.map(a => ({
      label: `${a.coast ? 'Inerzia' : `Dado ${p.dice[a.die]}`} → auto ${SIZE_NAME[a.car.size]}`,
      die: a.die, carId: a.car.id, coast: a.coast, dieValue: p.dice[a.die], ...(a.car.pos ? { pos: a.car.pos } : {}),
    })),
  });
  const a = assign[ai];
  p.used[a.die] = true;
  a.car.placed.push({ value: p.dice[a.die], coast: a.coast });
  const car = a.car;
  g.activeCar = car.id;
  // Redline (Cris Crass): a movement die of 6 assigned to a car counts as 7.
  const redline = !a.coast && hasPower(g, p.id, 'redline') && p.dice[a.die] === shoppe.redline.from;
  // Nitro Leak (ongoing effect): a die assigned to the car is set to 6.
  const leak = !a.coast && hasOngoing(car, 'nitro_leak');
  if (leak) say(g, `Nitro Leak: il dado vale ${NITRO_LEAK_DIE}.`, 'info');
  const mv = { moves: a.coast ? 1 : leak ? NITRO_LEAK_DIE : redline ? shoppe.redline.to : p.dice[a.die], drift: false };
  if (redline) say(g, `Redline: il ${shoppe.redline.from} vale ${shoppe.redline.to}.`, 'good');
  const board = commandsOf(p);

  if (!a.coast && !p.commandUsed) {
    const cmds: { die: number; cmd: CommandId }[] = [];
    const rest = allFree.filter(d => d !== a.die && !p.used[d]);
    for (const d of rest) {
      if (rest.find(j => p.dice[j] === p.dice[d]) !== d) continue;
      for (const slot of board) {
        if (slot.token || p.slots[slot.id] || !slot.values.includes(p.dice[d])) continue;
        if (!canActivate(g, p, slot.id)) continue;
        cmds.push({ die: d, cmd: slot.id });
      }
    }
    if (cmds.length) {
      const ci = yield* ask({
        kind: 'command', player: p.id, prompt: `${p.name}: attivare un comando (una volta per round)?`,
        options: [{ label: 'Nessun comando' }, ...cmds.map(c => ({ label: `${COMMAND_NAME[c.cmd]} con il dado ${p.dice[c.die]}`, die: c.die, command: c.cmd, dieValue: p.dice[c.die] }))],
      });
      if (ci > 0) {
        const c = cmds[ci - 1];
        p.used[c.die] = true;
        p.command = { cmd: c.cmd, value: p.dice[c.die] };
        p.commandUsed = true;
        p.slots[c.cmd] = 'die';
        say(g, `${p.name} attiva ${COMMAND_NAME[c.cmd]}.`, 'info');
        yield* activate(g, p, c.cmd, p.dice[c.die], mv);
      }
    }
  }
  // Command token (Choppe Shoppe): one per turn, on a command without a die or a token, not when coasting.
  if (!a.coast && p.tokens > 0 && g.winner === null) {
    const free = board.filter(s => !p.slots[s.id] && canActivate(g, p, s.id));
    if (free.length) {
      const ti = yield* ask({
        kind: 'token', player: p.id, prompt: `${p.name}: usare un segnalino comando (${p.tokens} rimasti)?`,
        options: [{ label: 'Nessun segnalino' }, ...free.map(s => ({ label: `${COMMAND_NAME[s.id]} con un segnalino`, command: s.id }))],
      });
      if (ti > 0) {
        const s = free[ti - 1];
        p.tokens--;
        p.slots[s.id] = 'token';
        say(g, `${p.name} attiva ${COMMAND_NAME[s.id]} con un segnalino comando.`, 'info');
        // A token on a range of values counts as the lowest.
        yield* activate(g, p, s.id, s.values.length ? Math.min(...s.values) : 0, mv);
      }
    }
  }
  // Boost Switch: the car gains +1 move.
  if (up(car, 'boost_switch')) { mv.moves += upN('boost_switch'); say(g, `Boost Switch: +${upN('boost_switch')} movimento.`, 'good'); }
  // Loose Wiring (ongoing effect): before the car moves, the direction die moves it one space.
  if (hasOngoing(car, 'loose_wiring') && car.pos && car.status === 'ok' && g.winner === null) {
    const d = rollFx(g, 'direction', 'loose-wiring', car.pos);
    say(g, `Loose Wiring: una casella ${DIR_NAME[d]}.`, 'dice');
    yield* enter(g, car, neighbor(car.pos, d), null, d);
    yield* baldTires(g, car, d);
  }
  const { fixed, mustMoveAll } = beforeMove(g, car, mv);
  const { moves, drift } = mv;

  if (g.winner === null && car.status === 'ok') {
    say(g, `${p.name} muove ${carName(g, car)} di ${moves}${a.coast ? ' (inerzia)' : ''}.`, 'info');
    yield* moveCar(g, car, moves, drift, a.coast, p.dice[a.die], fixed, mustMoveAll);
  }
  if (a.coast) car.coasts++; else car.moved = true;
  // Oil Dispenser, Mine Dispenser: after the move, a hazard in an adjacent empty space (three times per game).
  for (const [id, type] of [['oil_dispenser', 'oil'], ['mine_dispenser', 'mine']] as [string, HazardType][]) {
    if (g.winner !== null || !up(car, id) || !car.pos || car.uses >= upN(id)) continue;
    const free = freeAround(g, car.pos);
    if (!free.length) continue;
    const i = yield* ask({
      kind: 'dispense', player: p.id, prompt: `${p.name}: ${upName(id)}, posare ${type === 'oil' ? 'una chiazza d’olio' : 'una mina'}? (${upN(id) - car.uses} rimaste)`,
      options: [{ label: 'Non posare' }, ...free.map(spaceOption)],
    });
    if (i === 0) continue;
    car.uses++;
    g.hazards.set(key(free[i - 1]), { type, faceUp: true });
    beat(g, 'reveal', { at: { ...free[i - 1] } });
    say(g, `${upName(id)}: ${HAZARD_NAME[type]} in ${free[i - 1].r + 1}-${free[i - 1].c + 1}.`, 'info');
  }
  // Step 4, shoot (p. 10): skipped in the first round, "your guns are not online".
  if (g.winner === null && g.round === 1) say(g, 'Primo round: le armi non sono ancora attive, niente sparo.', 'info');
  else if (g.winner === null && car.status === 'ok' && car.pos) yield* shootFrom(g, p.id, car.pos, carName(g, car), car);
  // End of turn: road vehicles in a chopper's space are eliminated (p. 11).
  for (const pl of g.players) {
    if (!pl.chopper) continue;
    for (const v of vehiclesAt(g, pl.chopper)) {
      // Anti-Aircraft Radar: the car may move to an adjacent empty space instead.
      const free = up(v, 'anti_aircraft_radar') && g.winner === null ? freeAround(g, pl.chopper) : [];
      if (free.length) {
        const i = yield* ask({
          kind: 'radar', player: v.owner!, prompt: `${g.players[v.owner!].name}: Anti-Aircraft Radar, dove spostare ${carName(g, v)}?`,
          options: [{ label: 'Resta (eliminata)', danger: true }, ...free.map(spaceOption)],
        });
        if (i > 0) {
          v.pos = { ...free[i - 1] };
          beat(g, 'move', { vehicleId: v.id, at: { ...free[i - 1] } });
          say(g, `Anti-Aircraft Radar: ${carName(g, v)} si sposta da sotto l'elicottero.`, 'good');
          continue;
        }
      }
      eliminate(g, v, `è nella casella dell'elicottero di ${pl.name}`);
    }
  }
  g.activeCar = null;
}

/** Whether a command would do anything now; commands of unimplemented content never do. */
function canActivate(g: Game, p: Player, cmd: CommandId): boolean {
  const cars = g.vehicles.filter(v => v.owner === p.id && v.status !== 'elim');
  switch (cmd) {
    case 'repair': return canRepair(g, p);
    case 'pain_transfer': return cars.some(a => a.damage.length > 0 && cars.some(b => b !== a && b.damage.length < limit(b)));
    case 'need_for_speed': return p.used.some(u => !u);
    // Tinker (Ms. Betty): one of her cars has an upgrade to swap, and the deck has a card.
    case 'tinker': return g.upgradeDeck.length + g.upgradeDiscard.length > 0 && cars.some(v => v.upgrade || v.upgrade2);
    // Show Time and Flamethrower (Emberco) need Carnage at Devil's Run's fire.
    case 'show_time': return !!g.carnage && cars.some(v => v.status === 'ok' && !v.onFire);
    case 'flamethrower': return !!g.carnage;
    default: return true;
  }
}

/** Step 2, Command: the effect of a command activated with a die or a command token of `value`. */
function* activate(g: Game, p: Player, cmd: CommandId, value: number, mv: { moves: number; drift: boolean }): Gen<void> {
  switch (cmd) {
    case 'nitro': mv.moves += value; return;
    case 'drift': mv.drift = true; return;
    case 'repair': yield* repair(g, p); return;
    case 'airstrike': yield* airstrike(g, p); return;
    case 'bump': g.fx.bump = true; return;
    case 'called_shot': g.fx.calledShot = true; return;
    case 'need_for_speed':
      p.dice = p.dice.map((d, i) => (p.used[i] ? d : value));
      say(g, `Need for Speed: i dadi non assegnati di ${p.name} diventano ${value}.`, 'good');
      return;
    case 'pain_transfer': yield* painTransfer(g, p); return;
    case 'tinker': yield* tinker(g, p); return;
    case 'show_time': yield* showTime(g, p); return;
    case 'flamethrower': g.fx.flamethrower = true; say(g, 'Flamethrower: se colpisce in questo turno, il bersaglio prende fuoco.', 'info'); return;
    default: return;
  }
}

/** Pain Transfer (Vince Vamp): move a face-down damage token from one of your cars to another. */
function* painTransfer(g: Game, p: Player): Gen<void> {
  const cars = g.vehicles.filter(v => v.owner === p.id && v.status !== 'elim');
  const opt = (c: Vehicle): Option => ({ label: `Auto ${SIZE_NAME[c.size]} (${c.damage.length} danni)`, carId: c.id, ...(c.pos ? { pos: c.pos } : {}) });
  const from = cars.filter(a => a.damage.length > 0 && cars.some(b => b !== a && b.damage.length < limit(b)));
  const fi = yield* ask({ kind: 'transfer', player: p.id, prompt: `${p.name}: da quale auto togliere un danno?`, options: from.map(opt) });
  const src = from[fi];
  const to = cars.filter(b => b !== src && b.damage.length < limit(b));
  const ti = yield* ask({ kind: 'transfer', player: p.id, prompt: `${p.name}: a quale auto dare il danno?`, options: to.map(opt) });
  const dst = to[ti];
  dst.damage.push(src.damage.pop()!);
  say(g, `Pain Transfer: un danno passa da ${carName(g, src)} a ${carName(g, dst)}.`, 'info');
  if (src.status === 'inop' && src.damage.length < limit(src)) { src.status = 'ok'; say(g, `${capital(carName(g, src))} torna operativa!`, 'good'); }
  if (dst.status === 'ok' && dst.damage.length >= limit(dst)) {
    dst.status = 'inop';
    say(g, `${capital(carName(g, dst))} è fuori uso (girata all'indietro).`, 'bad');
    checkPlayers(g);
  }
}

function* repair(g: Game, p: Player): Gen<void> {
  const cars = repairable(g, p);
  if (!cars.length) return;
  const i = yield* ask({
    kind: 'repair', player: p.id, prompt: `${p.name}: quale auto riparare?`,
    options: cars.map(c => ({ label: `Auto ${SIZE_NAME[c.size]} (${c.damage.length} danni)`, carId: c.id, ...(c.pos ? { pos: c.pos } : {}) })),
  });
  const c = cars[i];
  const fixedToken = c.damage.pop()!;
  discardCard(g, fixedToken); // CDR p4: its ongoing effect card goes to the discard pile too
  g.damagePile.push(fixedToken);
  if (c.status === 'inop' && c.damage.length < limit(c)) { c.status = 'ok'; say(g, `${capital(carName(g, c))} torna operativa!`, 'good'); }
  else say(g, `${capital(carName(g, c))} è riparata.`, 'good');
}

function* airstrike(g: Game, p: Player): Gen<void> {
  const spaces = chopperSpaces(g);
  if (!spaces.length) { say(g, 'Nessuna casella vuota per l\'elicottero.'); return; }
  const i = yield* ask({
    kind: 'airstrike', player: p.id, prompt: `${p.name}: clicca la casella vuota dove piazzare l'elicottero.`,
    options: spaces.map(s => ({ label: `Casella ${s.r + 1}-${s.c + 1}`, pos: s })),
  });
  p.chopper = spaces[i];
  beat(g, 'chopper', { at: { ...p.chopper } });
  if (g.round > 1) yield* shootFrom(g, p.id, p.chopper, 'l\'elicottero');
}

// ---------------------------------------------------------------- rounds

function rollMovement(g: Game, p: Player, cause: string): void {
  const n = base.movement_dice_per_player;
  p.dice = rollDice(g, Array.from({ length: n }, () => ({ id: `move-${p.id}`, n: DICE.movement.length })), cause)
    .map(f => DICE.movement[f]);
  p.used = p.dice.map(() => false);
}

function nextActive(g: Game, from: number): number {
  for (let k = 1; k <= g.players.length; k++) {
    const i = (from + k) % g.players.length;
    if (!g.players[i].out) return i;
  }
  return from;
}

/** The whole game: first player, then rounds until someone wins. */
export function* play(g: Game): Gen<void> {
  if (g.dealLeaders) yield* chooseLeaders(g);
  if (g.dealUpgrades) yield* draftUpgrades(g);
  // Setup step 6: lowest total goes first; a tie for lowest rerolls everyone.
  for (;;) {
    for (const p of g.players) rollMovement(g, p, 'setup:first-player');
    const totals = g.players.map(p => p.dice.reduce((a, b) => a + b, 0));
    const low = Math.min(...totals);
    say(g, `Tiro iniziale: ${g.players.map((p, i) => `${p.name} ${totals[i]}`).join(', ')}.`, 'dice');
    if (totals.filter(t => t === low).length === 1) { g.firstPlayer = totals.indexOf(low); break; }
    say(g, 'Pareggio per il totale più basso: tutti ritirano.');
  }
  say(g, `Inizia ${g.players[g.firstPlayer].name}.`, 'turn');
  for (g.round = 1; g.winner === null; g.round++) {
    for (const p of g.players) {
      p.commandUsed = false;
      p.command = null;
      // End of round: assigned command tokens go back to the supply.
      g.tokenSupply += Object.values(p.slots).filter(x => x === 'token').length;
      p.slots = {};
      if (g.round > 1 && !p.out) rollMovement(g, p, `round-${g.round}`);
    }
    for (const v of g.vehicles) { v.moved = false; v.coasts = 0; v.placed = []; }
    g.roadDie = rollFx(g, 'road', 'road-die');
    beat(g, 'round', { round: {
      n: g.round, roadDie: g.roadDie, roller: g.firstPlayer,
      dice: g.players.filter(p => !p.out).map(p => ({ player: p.id, values: [...p.dice] })),
    } });
    say(g, `Round ${g.round}: ${g.players[g.firstPlayer].name} tira il dado strada: ${g.roadDie}.`, 'dice');
    for (const p of g.players) if (!p.out && hasPower(g, p.id, 'third_eye')) yield* thirdEye(g, p);
    for (let t = 0; t < base.turns_per_round && g.winner === null; t++) {
      let i = g.firstPlayer;
      for (let k = 0; k < g.players.length && g.winner === null; k++) {
        const p = g.players[i];
        if (!p.out) yield* turn(g, p);
        i = (i + 1) % g.players.length;
      }
    }
    if (g.winner === null) g.firstPlayer = nextActive(g, g.firstPlayer);
  }
  g.round--;
}

/** Crew leaders, setup steps 2-5: two boards at random to each player, who keeps one. */
function* chooseLeaders(g: Game): Gen<void> {
  // A leader that depends on an expansion part is dealt only when it is in play (Ms. Betty: the
  // upgrade cards; Emberco: Carnage at Devil's Run's fire).
  const ready = (need: string): boolean => (need === 'upgrades' ? g.dealUpgrades : need === 'carnage' ? !!g.carnage : false);
  const deck = shuffled(g, LEADERS.filter(l => (l.needs ?? []).every(ready)), 'crew-leaders');
  for (const p of g.players) {
    if (p.leader) continue;
    const hand = deck.splice(0, shoppe.leaders_dealt);
    if (!hand.length) break;
    const i = yield* ask({
      kind: 'leader', player: p.id, prompt: `${p.name}: scegli il tuo caposquadra.`,
      options: hand.map(l => ({ label: `${l.name}, ${l.title}`, leader: l.id })),
    });
    takeLeader(g, p, hand[i].id);
    say(g, `${p.name} sceglie ${hand[i].name}.`, 'info');
  }
}

/** Tinker (Ms. Betty): she discards an upgrade of one of her cars and draws a new one for that car. */
function* tinker(g: Game, p: Player): Gen<void> {
  const slots = g.vehicles.filter(v => v.owner === p.id && v.status !== 'elim')
    .flatMap(v => [v.upgrade ? { v, second: false, id: v.upgrade } : null, v.upgrade2 ? { v, second: true, id: v.upgrade2 } : null])
    .filter((x): x is { v: Vehicle; second: boolean; id: string } => !!x);
  if (!slots.length) return;
  const i = yield* ask({
    kind: 'tinker', player: p.id, prompt: `${p.name}: Tinker, quale potenziamento scartare?`,
    options: slots.map(x => ({ label: `${upName(x.id)} (auto ${SIZE_NAME[x.v.size]})`, carId: x.v.id, upgrade: x.id, ...(x.v.pos ? { pos: x.v.pos } : {}) })),
  });
  const s = slots[i];
  if (!g.upgradeDeck.length) { g.upgradeDeck = shuffled(g, g.upgradeDiscard, 'upgrades'); g.upgradeDiscard = []; }
  const fresh = g.upgradeDeck.shift();
  if (!fresh) return;
  g.upgradeDiscard.push(s.id);
  if (s.second) s.v.upgrade2 = fresh; else s.v.upgrade = fresh;
  say(g, `Tinker: ${upName(s.id)} scartato, l'auto ${SIZE_NAME[s.v.size]} prende ${upName(fresh)}.`, 'good');
}

/** Show Time (Emberco): one of his operable cars, chosen, catches fire (Carnage at Devil's Run). */
function* showTime(g: Game, p: Player): Gen<void> {
  const cars = g.vehicles.filter(v => v.owner === p.id && v.status === 'ok' && !v.onFire);
  if (!cars.length) return;
  const i = yield* ask({
    kind: 'showTime', player: p.id, prompt: `${p.name}: Show Time, quale tua auto prende fuoco?`,
    options: cars.map(v => ({ label: `Auto ${SIZE_NAME[v.size]}`, carId: v.id, ...(v.pos ? { pos: v.pos } : {}) })),
  });
  catchFire(g, cars[i]);
}

/**
 * Upgrade cards, setup steps 1-6: four cards each, keep one and pass the rest to the left until
 * everyone has three, then one upgrade on each car. (On one device the picks come one after the
 * other, not all at once.)
 */
function* draftUpgrades(g: Game): Gen<void> {
  const deck = shuffled(g, UPGRADES.map(u => u.id), 'upgrades');
  const hands = g.players.map(() => deck.splice(0, shoppe.upgrades_dealt));
  const kept: string[][] = g.players.map(() => []);
  // Bring the Bling (Ms. Betty): she keeps one card more than the others (the last one of her hand).
  const keeps = (p: Player): number => shoppe.upgrades_kept + (hasPower(g, p.id, 'bring_the_bling') ? 1 : 0);
  const rounds = Math.max(...g.players.map(keeps));
  for (let r = 0; r < rounds; r++) {
    for (const p of g.players) {
      if (r >= keeps(p)) continue;
      const hand = hands[p.id];
      if (!hand.length) continue;
      const i = yield* ask({
        kind: 'draft', player: p.id, prompt: `${p.name}: scegli un potenziamento (${r + 1} di ${keeps(p)}).`,
        options: hand.map(id => ({ label: upName(id), upgrade: id })),
      });
      kept[p.id].push(hand.splice(i, 1)[0]);
    }
    hands.unshift(hands.pop()!);
  }
  // Each kept card goes on a car, in the order the player likes: every choice is a card and a car
  // (the interface lets the card be dragged onto the car). The last card goes on the last car.
  for (const p of g.players) {
    const left = [...kept[p.id]];
    // Bring the Bling: the large car takes a second card (it appears twice among the places).
    const own = g.vehicles.filter(v => v.owner === p.id);
    const cars = hasPower(g, p.id, 'bring_the_bling') ? [...own, ...own.filter(v => v.size === 'L')] : own;
    while (cars.length && left.length) {
      let card = 0, car = 0;
      if (left.length > 1 || cars.length > 1) {
        const pairs = left.flatMap((id, ci) => cars.map((v, vi) => ({ ci, vi, id, v })));
        const i = yield* ask({
          kind: 'upgradeAssign', player: p.id, prompt: `${p.name}: trascina un potenziamento su un'auto.`,
          options: pairs.map(x => ({ label: `${upName(x.id)} → ${SIZE_NAME[x.v.size]}`, upgrade: x.id, carId: x.v.id })),
        });
        card = pairs[i].ci; car = pairs[i].vi;
      }
      const v = cars.splice(car, 1)[0], id = left.splice(card, 1)[0];
      if (v.upgrade) v.upgrade2 = id; else v.upgrade = id;
    }
  }
  g.upgradeDeck = [...deck, ...hands.flat()];
  for (const p of g.players) {
    say(g, `${p.name}: ${g.vehicles.filter(v => v.owner === p.id).map(v => `${SIZE_NAME[v.size]} ${upName(v.upgrade ?? '')}${v.upgrade2 ? ` + ${upName(v.upgrade2)}` : ''}`).join(', ')}.`, 'info');
  }
}

/** Third Eye (Madame Boudreaux): at the beginning of the round, peek at one hazard token. */
function* thirdEye(g: Game, p: Player): Gen<void> {
  const down = [...g.hazards].filter(([, h]) => !h.faceUp);
  if (!down.length) return;
  const pos = down.map(([k]) => { const [r, c] = k.split(',').map(Number); return { r, c }; });
  const i = yield* ask({
    kind: 'peek', player: p.id, prompt: `${p.name}: Third Eye, quale pericolo coperto guardare?`,
    options: pos.map(q => ({ label: `Casella ${q.r + 1}-${q.c + 1}`, pos: q })),
  });
  say(g, `Third Eye: ${p.name} guarda un pericolo coperto.`, 'info');
  // Shown only in the prompt: the log is public.
  yield* ask({
    kind: 'peekResult', player: p.id, prompt: `Solo per ${p.name}: è ${HAZARD_NAME[down[i][1].type]}.`,
    options: [{ label: 'Visto', pos: pos[i] }],
  });
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
