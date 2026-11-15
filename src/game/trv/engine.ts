// Thunder Road: Vendetta, base game rules (reference/rulebook, pp. 4-12).
// Pure TypeScript with no browser in it. The game runs as a generator: it yields a
// Decision whenever a player must choose and receives the index of the chosen option.
// All randomness goes through src/core/rng, so seed + list of choices replays a game.

import base from '../../../data/trv/game_base.json';
import {
  createRng, roll, shuffle, applyPermutation, type RngState,
} from '../../core/rng/rng';

// ---------------------------------------------------------------- types

/** Board-absolute directions: F is towards the lead tile, L towards row 0. */
export type Dir = 'F' | 'FL' | 'FR' | 'B' | 'BL' | 'BR';
export type Size = 'S' | 'M' | 'L';
export type Terrain = 'R' | 'o' | 'M' | 'X';
export type HazardType = 'mud' | 'road' | 'oil' | 'mine' | 'wreck';
export type DamageType = 'shrapnel' | 'dazed' | 'dent' | 'skid' | 'blastoff';
export type CommandId = 'airstrike' | 'nitro' | 'drift' | 'repair';

/** A board space. `c` counts from the rear edge of the rear tile (0..23). */
export interface Pos { r: number; c: number }

export interface DamageToken { type: DamageType; dir?: Dir }

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
}

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
}

export interface Decision {
  kind: 'assign' | 'command' | 'airstrike' | 'repair' | 'step' | 'roadDie' | 'slamReroll' | 'shoot';
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
  vehicles: Pick<Vehicle, 'id' | 'owner' | 'size' | 'isWreck' | 'pos' | 'inStart' | 'status' | 'z'>[];
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
  kind: 'log' | 'move' | 'roll' | 'slam' | 'shot' | 'damage' | 'elim' | 'reveal' | 'tile' | 'round' | 'chopper';
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
}

export interface Setup {
  seed: string;
  players: { name: string; color: string; crew?: string }[];
  startSide: 'a' | 'b';
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
const COMMANDS = base.commands as Record<CommandId, number[]>;
const SIZE_RANK: Record<Size, number> = { S: 0, M: 1, L: 2 };
export const DIR_NAME: Record<Dir, string> = {
  F: 'avanti', FL: 'avanti-sinistra', FR: 'avanti-destra',
  B: 'indietro', BL: 'indietro-sinistra', BR: 'indietro-destra',
};
const SIZE_NAME: Record<Size, string> = { S: 'piccola', M: 'media', L: 'grande' };
const HAZARD_NAME: Record<HazardType, string> = {
  mud: 'Fango', road: 'Strada', oil: 'Chiazza d\'olio', mine: 'Mina', wreck: 'Relitto',
};
const DAMAGE_NAME: Record<DamageType, string> = {
  shrapnel: 'Schegge', dazed: 'Stordito', dent: 'Ammaccatura', skid: 'Sbandata', blastoff: 'Decollo',
};
const COMMAND_NAME: Record<CommandId, string> = {
  airstrike: 'Attacco aereo', nitro: 'Nitro', drift: 'Drift', repair: 'Riparazione',
};

interface TileDef { tile: number; side: string; name: string; terrain: string[]; hazards: unknown[][] }
const TILES = base.tiles as unknown as TileDef[];

/** The definition of a tile face. */
export function tileDef(t: TileRef): TileDef {
  const d = TILES.find(x => x.tile === t.tile && x.side === t.side);
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
  }
  const t = g.board[Math.floor(p.c / TILE_COLS)];
  return tileDef(t).terrain[p.r][p.c % TILE_COLS] as Terrain;
}

export function vehiclesAt(g: Game, p: Pos): Vehicle[] {
  return g.vehicles.filter(v => v.status !== 'elim' && samePos(v.pos, p)).sort((a, b) => a.z - b.z);
}

/** Empty space: no road vehicle, chopper, hazard token or impassable terrain (p. 7). */
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

function rollFx<K extends 'road' | 'stunt' | 'slam' | 'shooting' | 'direction'>(g: Game, die: K, cause: string): (typeof DICE)[K][number] {
  const faces = DICE[die];
  const [f] = rollDice(g, [{ id: die, n: faces.length }], cause);
  const v = faces[f] as (typeof DICE)[K][number];
  const rolled = { die, face: f, value: v as string | number };
  g.lastRoll.push(rolled);
  g.pendingDice.push(rolled);
  beat(g, 'roll', { die: rolled });
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
    vehicles: g.vehicles.map(v => ({ id: v.id, owner: v.owner, size: v.size, isWreck: v.isWreck, pos: v.pos ? { ...v.pos } : null, inStart: v.inStart, status: v.status, z: v.z })),
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
  };
  s.players.forEach((p, i) => {
    g.players.push({ id: i, name: p.name, color: p.color, dice: [], used: [], commandUsed: false, command: null, out: false, chopper: null,
      ...(p.crew ? { crew: p.crew } : {}) });
    for (const size of ['S', 'M', 'L'] as Size[]) {
      g.vehicles.push({ id: `p${i}${size}`, owner: i, size, isWreck: false, pos: null, inStart: true,
        status: 'ok', damage: [], moved: false, coasts: 0, placed: [], z: 0 });
    }
  });
  // Road tiles: the starting tile, then the others shuffled into a pile.
  const others = [...new Set(TILES.map(t => t.tile))].filter(t => t !== base.start_tile);
  const pile = shuffled(g, others, 'road-tiles').map(tile => {
    const [f] = rollDice(g, [{ id: 'tile-side', n: 2 }], 'setup:tile-side');
    return { tile, side: f === 0 ? 'a' : 'b' } as TileRef;
  });
  g.board = [{ tile: base.start_tile, side: s.startSide }, pile.shift()!, pile.shift()!];
  g.pile = pile;
  // Hazard and damage tokens.
  const hz: HazardType[] = [];
  for (const [t, n] of Object.entries(base.hazard_tokens)) for (let i = 0; i < n; i++) hz.push(t as HazardType);
  g.hazardPile = shuffled(g, hz, 'hazards');
  for (const d of base.damage_tokens as { type: DamageType; dir?: Dir; count: number }[]) {
    for (let i = 0; i < d.count; i++) g.damagePile.push(d.dir ? { type: d.type, dir: d.dir } : { type: d.type });
  }
  for (let t = 0; t < 3; t++) placeHazards(g, t, t === 0 ? s.players.length : null);
  return g;
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

interface MoveCtx { left: number; drift: boolean; driftUsed: boolean }

/**
 * A road vehicle enters a space, by moving, slam or damage (pp. 7, 9, 11).
 * Returns true when the vehicle loses its remaining moves.
 */
function* enter(g: Game, v: Vehicle, to: Pos, ctx: MoveCtx | null): Gen<boolean> {
  if (g.winner !== null) return true;
  if (to.c >= COLS && to.r >= 0 && to.r < ROWS) {
    if (v.isWreck) { eliminate(g, v, 'è uscito dal fronte'); return true; }
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
  if (h) {
    if (!h.faceUp) { h.faceUp = true; beat(g, 'reveal', { at: { ...to } }); say(g, `Pericolo scoperto: ${HAZARD_NAME[h.type]}!`, 'info'); }
    else say(g, `${capital(carName(g, v))} finisce su ${HAZARD_NAME[h.type]}.`, 'info');
    if (h.type === 'wreck') {
      g.hazards.delete(k); g.hazardDiscard.push('wreck');
      const w: Vehicle = { id: `w${g.zTop}`, owner: null, size: 'S', isWreck: true, pos: { ...to }, inStart: false,
        status: 'inop', damage: [], moved: false, coasts: 0, placed: [], z: v.z };
      v.z = ++g.zTop;
      g.vehicles.push(w);
    } else if (h.type === 'mine') {
      g.hazards.delete(k); g.hazardDiscard.push('mine');
      yield* damage(g, v);
      if (v.status !== 'elim' && v.pos && vehiclesAt(g, v.pos).length > 1) yield* slam(g, v.pos);
      return true;
    } else if (h.type === 'oil') {
      const d = rollFx(g, 'direction', 'oil-slick');
      say(g, `Olio! Dado direzione: ${DIR_NAME[d]}.`, 'dice');
      return yield* enter(g, v, neighbor(to, d), ctx);
    }
  }
  if (vehiclesAt(g, to).length > 1) {
    if (ctx && ctx.drift && !ctx.driftUsed) {
      ctx.driftUsed = true;
      say(g, 'Drift: passa attraverso il veicolo senza slam.', 'info');
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
    beat(g, 'slam', { at: { ...at }, vehicleId: top.id });
    say(g, `SLAM! ${capital(carName(g, top))} contro ${carName(g, bottom)}.`, 'bad');
    let which = rollFx(g, 'slam', 'slam');
    let d = rollFx(g, 'direction', 'slam');
    say(g, `Dado slam: si muove il veicolo ${which === 'top' ? 'sopra' : 'sotto'}; direzione ${DIR_NAME[d]}.`, 'dice');
    const big = SIZE_RANK[top.size] > SIZE_RANK[bottom.size] ? top : SIZE_RANK[bottom.size] > SIZE_RANK[top.size] ? bottom : null;
    if (big && big.owner !== null) {
      const moving = which === 'top' ? top : bottom;
      const i = yield* ask({
        kind: 'slamReroll', player: big.owner,
        prompt: `${g.players[big.owner].name}: si muove ${carName(g, moving)} verso ${DIR_NAME[d]}. Ritirare entrambi i dadi?`,
        options: [{ label: 'Tieni il risultato' }, { label: 'Ritira i due dadi' }],
      });
      if (i === 1) {
        which = rollFx(g, 'slam', 'slam-reroll');
        d = rollFx(g, 'direction', 'slam-reroll');
        say(g, `Ritiro: si muove il veicolo ${which === 'top' ? 'sopra' : 'sotto'}; direzione ${DIR_NAME[d]}.`, 'dice');
      }
    }
    const affected = which === 'top' ? top : bottom;
    yield* enter(g, affected, neighbor(at, d), null);
  }
}

/** Taking damage (pp. 6, 12). */
function* damage(g: Game, v: Vehicle): Gen<void> {
  if (g.winner !== null || v.status === 'elim') return;
  if (v.isWreck) { eliminate(g, v, 'ha subito danno'); return; }
  if (v.status === 'inop') { say(g, `${capital(carName(g, v))} è già fuori uso: il danno è ignorato.`); return; }
  let token: DamageToken | null = null;
  if (g.damagePile.length) {
    const [i] = rollDice(g, [{ id: 'damage-draw', n: g.damagePile.length }], 'damage-draw');
    token = g.damagePile.splice(i, 1)[0];
  }
  beat(g, 'damage', { vehicleId: v.id, token: token ? { ...token } : null, ...(v.pos ? { at: { ...v.pos } } : {}) });
  say(g, `${capital(carName(g, v))} subisce danno: ${token ? DAMAGE_NAME[token.type] : 'nessun segnalino rimasto'}.`, 'bad');
  if (token) yield* damageEffect(g, v, token);
  // The effect may have moved the car off the board (TS narrows status too eagerly here).
  if ((v.status as Vehicle['status']) === 'elim') { if (token) g.damagePile.push(token); return; }
  if (token) v.damage.push(token);
  if (v.damage.length >= 2) {
    v.status = 'inop';
    say(g, `${capital(carName(g, v))} è fuori uso (girata all'indietro).`, 'bad');
    checkPlayers(g);
  }
}

function* damageEffect(g: Game, v: Vehicle, t: DamageToken): Gen<void> {
  if (!v.pos) return;
  switch (t.type) {
    case 'dent': return;
    case 'shrapnel': {
      const d = rollFx(g, 'direction', 'shrapnel');
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
      yield* enter(g, v, neighbor(v.pos, d), null);
      return;
    }
    case 'dazed': {
      const n = rollFx(g, 'stunt', 'dazed');
      say(g, `Stordito: dado acrobazia ${n}.`, 'dice');
      const ctx: MoveCtx = { left: n, drift: false, driftUsed: false };
      while (ctx.left > 0 && v.pos && v.status !== 'elim' && g.winner === null) {
        const d = rollFx(g, 'direction', 'dazed');
        const to = neighbor(v.pos, d);
        say(g, `Stordito: verso ${DIR_NAME[d]}.`, 'dice');
        ctx.left = Math.max(0, ctx.left - (onBoard(to) && terrainAt(g, to) === 'M' ? 2 : 1));
        if (yield* enter(g, v, to, ctx)) break;
      }
      return;
    }
    case 'blastoff': {
      const d = rollFx(g, 'direction', 'blastoff');
      const n = rollFx(g, 'stunt', 'blastoff');
      say(g, `Decollo: ${n} caselle verso ${DIR_NAME[d]}.`, 'dice');
      let p = v.pos;
      for (let i = 0; i < n; i++) p = neighbor(p, d);
      yield* enter(g, v, p, null);
      return;
    }
  }
}

// ---------------------------------------------------------------- shooting

function frontArc(p: Pos): Pos[] {
  return [neighbor(p, 'FL'), neighbor(p, 'F'), neighbor(p, 'FR')];
}

/** Shoot step (p. 10): any road vehicle in the front arc, chosen or skipped. */
function* shootFrom(g: Game, player: number, from: Pos, who: string): Gen<void> {
  if (g.winner !== null) return;
  const targets: Vehicle[] = [];
  for (const p of frontArc(from)) {
    if (p.c >= COLS) continue;
    const st = vehiclesAt(g, p);
    if (st.length) targets.push(st[st.length - 1]);
  }
  if (!targets.length) { say(g, `${who}: nessun bersaglio nell'arco frontale, niente sparo.`, 'info'); return; }
  const i = yield* ask({
    kind: 'shoot', player, prompt: `${g.players[player].name}: sparare con ${who}?`,
    options: [{ label: 'Non sparare' }, ...targets.map(t => ({ label: `Spara ${carName(g, t).replace(/^l'/, "all'").replace(/^il /, 'al ')}`, carId: t.id, pos: t.pos! }))],
  });
  if (i === 0) return;
  const t = targets[i - 1];
  beat(g, 'shot', { from: { ...from }, at: { ...t.pos! }, vehicleId: t.id });
  const f = rollFx(g, 'shooting', 'shoot');
  const hit = f === 'ANY' || f === t.size || (f === 'SM' && (t.size === 'S' || t.size === 'M'));
  const face = f === 'ANY' ? 'qualsiasi' : f === 'SM' ? 'piccola/media' : SIZE_NAME[f as Size];
  say(g, `Dado sparo: ${face} — ${hit ? 'COLPITO!' : 'mancato.'}`, 'dice');
  if (hit) yield* damage(g, t);
}

// ---------------------------------------------------------------- the turn

function* moveCar(g: Game, car: Vehicle, moves: number, drift: boolean, coast: boolean): Gen<void> {
  const ctx: MoveCtx = { left: moves, drift, driftUsed: false };
  // Road die (p. 9): the car must start and move only on road. Leaving the starting area counts
  // as starting on road (decided with the rules owner, 2026-11-15).
  let onlyRoad = car.inStart || (!!car.pos && terrainAt(g, car.pos) === 'R');
  const startedOff = !onlyRoad;
  let stopped = false;
  let bonusUsed = coast;
  for (;;) {
    while (ctx.left > 0 && car.status === 'ok' && g.winner === null) {
      const opts: Option[] = [];
      const targets: Pos[] = car.inStart || !car.pos
        ? Array.from({ length: ROWS }, (_, r) => ({ r, c: 0 }))
        : frontArc(car.pos);
      const start = car.inStart || !car.pos;
      targets.forEach((to, k) => opts.push(stepOption(g, to, ctx.left,
        start ? `Corsia ${to.r + 1}` : ['Avanti-sinistra', 'Avanti', 'Avanti-destra'][k])));
      const i = yield* ask({
        kind: 'step', player: car.owner!,
        prompt: `${g.players[car.owner!].name}: muovi ${carName(g, car)} — ${ctx.left} ${ctx.left === 1 ? 'movimento' : 'movimenti'} rimasti.`,
        options: opts,
      });
      const to = targets[i];
      const t = onBoard(to) ? terrainAt(g, to) : to.c >= COLS ? 'R' : 'o';
      if (t !== 'R') onlyRoad = false;
      ctx.left = Math.max(0, ctx.left - (t === 'M' ? 2 : 1));
      if (yield* enter(g, car, to, ctx)) { stopped = true; ctx.left = 0; }
    }
    if (!stopped && !bonusUsed && car.status === 'ok' && !onlyRoad && g.winner === null) {
      say(g, startedOff
        ? 'Niente dado strada: l’auto non è partita da una casella di strada.'
        : 'Niente dado strada: l’auto non si è mossa solo su strada.', 'info');
    }
    if (stopped || bonusUsed || car.status !== 'ok' || !onlyRoad || g.winner !== null) break;
    bonusUsed = true;
    const i = yield* ask({
      kind: 'roadDie', player: car.owner!,
      prompt: `Sempre su strada! Usare il dado strada (+${g.roadDie})? Se lo usi devi muovere tutto.`,
      options: [{ label: 'No, fermati qui' }, { label: `Sì, altri ${g.roadDie} movimenti` }],
    });
    if (i === 0) break;
    ctx.left = g.roadDie;
  }
  if (!stopped && car.pos && vehiclesAt(g, car.pos).length > 1) yield* slam(g, car.pos);
}

function stepOption(g: Game, to: Pos, left: number, name: string): Option {
  if (to.c >= COLS && to.r >= 0 && to.r < ROWS) {
    return { label: `${name}: ${g.finalTile ? 'TRAGUARDO!' : 'nuova tessera'}`, pos: to };
  }
  if (!onBoard(to)) return { label: `${name}: fuori dal bordo (eliminata)`, pos: to, danger: true };
  const t = terrainAt(g, to);
  if (t === 'X') return { label: `${name}: invalicabile (eliminata)`, pos: to, danger: true };
  const parts = [t === 'R' ? 'strada' : t === 'M' ? (left === 1 ? 'fango (ultimo movimento)' : 'fango, costa 2') : 'fuoristrada'];
  const h = g.hazards.get(key(to));
  if (h) parts.push(h.faceUp ? HAZARD_NAME[h.type] : 'pericolo coperto');
  if (vehiclesAt(g, to).length) parts.push('SLAM');
  return { label: `${name}: ${parts.join(', ')}`, pos: to };
}

function* turn(g: Game, p: Player): Gen<void> {
  g.current = p.id;
  g.lastRoll = [];
  const allFree = p.dice.map((_, i) => i).filter(i => !p.used[i]);
  // Two dice with the same value are the same choice: offer each value once.
  const free = allFree.filter(i => allFree.find(j => p.dice[j] === p.dice[i]) === i);
  const mine = g.vehicles.filter(v => v.owner === p.id && v.status === 'ok');
  const fresh = mine.filter(v => !v.moved);
  const assign: { die: number; car: Vehicle; coast: boolean }[] = [];
  if (fresh.length) for (const d of free) for (const car of fresh) assign.push({ die: d, car, coast: false });
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
  let moves = a.coast ? 1 : p.dice[a.die];
  let drift = false;

  if (!a.coast && !p.commandUsed) {
    const cmds: { die: number; cmd: CommandId }[] = [];
    const rest = allFree.filter(d => d !== a.die && !p.used[d]);
    for (const d of rest) {
      if (rest.find(j => p.dice[j] === p.dice[d]) !== d) continue;
      for (const cmd of Object.keys(COMMANDS) as CommandId[]) {
        if (!COMMANDS[cmd].includes(p.dice[d])) continue;
        if (cmd === 'repair' && !g.vehicles.some(v => v.owner === p.id && v.status !== 'elim' && v.damage.length)) continue;
        cmds.push({ die: d, cmd });
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
        say(g, `${p.name} attiva ${COMMAND_NAME[c.cmd]}.`, 'info');
        if (c.cmd === 'nitro') moves += p.dice[c.die];
        if (c.cmd === 'drift') drift = true;
        if (c.cmd === 'repair') yield* repair(g, p);
        if (c.cmd === 'airstrike') yield* airstrike(g, p);
      }
    }
  }

  if (g.winner === null && car.status === 'ok') {
    say(g, `${p.name} muove ${carName(g, car)} di ${moves}${a.coast ? ' (inerzia)' : ''}.`, 'info');
    yield* moveCar(g, car, moves, drift, a.coast);
  }
  if (a.coast) car.coasts++; else car.moved = true;
  // Step 4, shoot (p. 10): skipped in the first round, "your guns are not online".
  if (g.winner === null && g.round === 1) say(g, 'Primo round: le armi non sono ancora attive, niente sparo.', 'info');
  else if (g.winner === null && car.status === 'ok' && car.pos) yield* shootFrom(g, p.id, car.pos, carName(g, car));
  // End of turn: road vehicles in a chopper's space are eliminated (p. 11).
  for (const pl of g.players) {
    if (!pl.chopper) continue;
    for (const v of vehiclesAt(g, pl.chopper)) eliminate(g, v, `è nella casella dell'elicottero di ${pl.name}`);
  }
  g.activeCar = null;
}

function* repair(g: Game, p: Player): Gen<void> {
  const cars = g.vehicles.filter(v => v.owner === p.id && v.status !== 'elim' && v.damage.length);
  const i = yield* ask({
    kind: 'repair', player: p.id, prompt: `${p.name}: quale auto riparare?`,
    options: cars.map(c => ({ label: `Auto ${SIZE_NAME[c.size]} (${c.damage.length} danni)`, carId: c.id, ...(c.pos ? { pos: c.pos } : {}) })),
  });
  const c = cars[i];
  g.damagePile.push(c.damage.pop()!);
  if (c.status === 'inop') { c.status = 'ok'; say(g, `${capital(carName(g, c))} torna operativa!`, 'good'); }
  else say(g, `${capital(carName(g, c))} è riparata.`, 'good');
}

function* airstrike(g: Game, p: Player): Gen<void> {
  const spaces: Pos[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isEmpty(g, { r, c })) spaces.push({ r, c });
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
      if (g.round > 1 && !p.out) rollMovement(g, p, `round-${g.round}`);
    }
    for (const v of g.vehicles) { v.moved = false; v.coasts = 0; v.placed = []; }
    g.roadDie = rollFx(g, 'road', 'road-die');
    beat(g, 'round', { round: {
      n: g.round, roadDie: g.roadDie, roller: g.firstPlayer,
      dice: g.players.filter(p => !p.out).map(p => ({ player: p.id, values: [...p.dice] })),
    } });
    say(g, `Round ${g.round}: ${g.players[g.firstPlayer].name} tira il dado strada: ${g.roadDie}.`, 'dice');
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

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
