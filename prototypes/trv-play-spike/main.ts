// PROTOTYPE - NOT FOR PRODUCTION
// Partita hot seat di Thunder Road: Vendetta. Regole: src/game/trv/engine.ts. Grafica tutta
// vettoriale (src/view/vector/art.ts) e mappa a tessere incastrate (src/view/board3d.ts);
// misure dal catalogo fisico (src/game/trv/catalog.ts). Interfaccia dallo schizzo dell'utente:
// in alto io, gli avversari e il dado strada; al centro la mappa; in basso i miei dadi, la
// plancia comandi, i cruscotti con i danni e l'elicottero. I dadi si trascinano (o si
// selezionano e si posano) sugli spazi liberi.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  newGame, play, tileDef, ROWS, COLS, TILE_COLS, leaderOf, commandsOf, leaders, commandName, upgrades, type CommandSlot,
  snapshot, type Game, type Decision, type Pos, type Setup, type TileRef, type LogEntry, type Player, type Frame, type Snapshot, type Vehicle, type Blocked,
} from '../../src/game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf, ofKind } from '../../src/game/trv/catalog';
import { Pieces, TextureBank } from '../../src/view/pieces3d';
import { tickFlames, flameCluster, useRampModel } from '../../src/view/terrain/carnage3d';
import { buildTile, hazardToken, spaceCenterPx, spaceGeometry, spaceRimGeometry, GRID, TILE_PITCH_PX } from '../../src/view/board3d';
import { dieSvg, damageTokenSvg, dashboardSvg, commandBoardSvg, playerStripSvg, STRIP_ASPECT, STRIP_ASPECT_LEADER, STRIP_LEADER_PLATE, avatarSvg, dataUrl } from '../../src/view/vector/art';
import { newSeed } from '../../src/platform/entropy';
import {
  acceptable, backToLobby, cleanCode, closeRoom, createRoom, freeCrew, joinRoom, leaveRoom, readRoom, roomPath, seatOf, startMatch, startProblem,
  MAX_PLAYERS, NAME_MAX, type Room, type RoomStore,
} from '../../src/net/room';
import { FIREBASE_CONFIG } from '../../src/net/firebase-config';
import qrcode from 'qrcode-generator';
import { ModelBank, dressed, fitToLength, splitParts, splitWheels, type Tint } from '../../src/view/models3d';
import { MODEL, SHOW_LENGTH_MM, MODEL_YAW, CHOPPER_PARTS, ROTOR_SPEED, WHEELS, GUNS, type GunSpec, crewTint, WRECK_TINT, wreckModel, phaseOf, hover, CarRig } from './models-config';
import { makeDie, withOwnMaterials, type Die3D, type DiceFaces } from '../../src/view/dice3d';
import RULES from '../../data/trv/game_base.json';
import CARNAGE from '../../data/trv/carnage.json';

// The fire die of Carnage at Devil's Run joins the dice the table can draw.
const FACES = { ...RULES.dice, fire: CARNAGE.dice.fire } as unknown as DiceFaces;

const SAVE_KEY = 'trv-hotseat-v3';
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/**
 * True while the first screen (or the room's card) covers the game: then the game is not drawn and
 * takes no keys (Tab, arrows and shortcuts belong to the menu).
 */
const menuOpen = (): boolean => getComputedStyle(document.getElementById('setup')!).display !== 'none'
  || document.getElementById('lobby')?.style.display === 'grid';
const cssPx = (name: string): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));

// ---------------------------------------------------------------- settings
// The player's display options (Options menu in the bar), kept in this browser.

/** Graphics quality: `auto` picks a level from the frame rate and steps down when it drops. */
type Quality = 'auto' | 'high' | 'medium' | 'low';
type Level = Exclude<Quality, 'auto'>;
/** Animation speed: complete (slow, every beat), fast, or skip to the result. */
type Speed = 'full' | 'fast' | 'skip';
interface Settings { quality: Quality; speed: Speed; grid: boolean; actionCam: boolean; effects: boolean; words: boolean }
const SETTINGS_KEY = 'trv-settings';
const settings: Settings = { quality: 'auto', speed: 'full', grid: true, actionCam: true, effects: true, words: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>); } catch { /* defaults */ }
function saveSettings(): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage off */ }
}
/** How fast the beats play for each speed setting (1 = the old pace, judged too fast by the user). */
const SPEED_SCALE: Record<Speed, number> = { full: 0.6, fast: 1.15, skip: 1 };
/** What each quality level changes: render resolution, the lamp's shadow, model texture size, effects. */
const LEVELS: Record<Level, { pixelRatio: number; shadow: number; texture: number; particles: number }> = {
  high: { pixelRatio: 2, shadow: 4096, texture: 4096, particles: 1 },
  medium: { pixelRatio: 1.25, shadow: 2048, texture: 1024, particles: 0.6 },
  low: { pixelRatio: 0.85, shadow: 0, texture: 512, particles: 0.3 },
};
/** The level in use now (under `auto`, the one the frame rate allows). */
let level: Level = settings.quality === 'auto' ? 'high' : settings.quality;

// ---------------------------------------------------------------- scene

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a120c);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
// The table only pans and zooms (asked by the user): no orbiting. Closer to the ground the view
// tilts a little toward the horizon (see tiltView).
controls.enableRotate = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
controls.screenSpacePanning = false; // pan along the table, not the screen
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 4;
controls.maxDistance = 90;

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2414, 1.1));
const lamp = new THREE.DirectionalLight(0xffe2b8, 2.0);
lamp.position.set(-10, 30, 14);
lamp.castShadow = true;
lamp.shadow.mapSize.set(4096, 2048);
Object.assign(lamp.shadow.camera, { left: -30, right: 30, top: 16, bottom: -16 });
lamp.shadow.bias = -0.0004;
scene.add(lamp);
const table = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.85 }));
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

// One scale for the whole table (world units per mm), from the road tile's catalog length.
const TILE_MM = sizeOf(CAT, 'road_tile');
const MM = 13.14 / TILE_MM[0];
const TILE_W = TILE_MM[0] * MM, TILE_H = TILE_MM[1] * MM, TILE_T = TILE_MM[2] * MM;
const KX = TILE_W / GRID.frameW, KZ = TILE_H / GRID.frameH;
const PITCH_W = TILE_PITCH_PX * KX; // tiles interlock: one tile every 8 columns
const BOARD_X0 = -1.5 * PITCH_W;
const bank = new TextureBank(renderer.capabilities.getMaxAnisotropy());
const pieces = new Pieces(MM, bank);

/** World position of a space centre (columns run across the three tiles), on the tile's ground. */
function world(p: Pos): THREE.Vector3 {
  const slot = Math.floor(p.c / TILE_COLS);
  const [px, py] = spaceCenterPx(p.r, p.c - slot * TILE_COLS);
  // A relief tile (official terrain maps) has sand above and mud below its asphalt.
  const ground = (tileSlots[slot]?.userData.heightAt as ((x: number, y: number) => number) | undefined)?.(px, py) ?? 0;
  return new THREE.Vector3(BOARD_X0 + slot * PITCH_W + px * KX, TILE_T + ground, (py - GRID.frameH / 2) * KZ);
}

// Road tiles built from the terrain data, cached per face.
const tileCache = new Map<string, THREE.Group>();
const tileSlots: (THREE.Group | null)[] = [null, null, null];
/**
 * Revealed hazards that stay on the board as terrain, and the terrain code each one draws in 3D on
 * its space (asked by the user, 2026-11-16): the token goes, the ground changes. O is an oil slick
 * on asphalt (look only: for the rules oil is road, src/game/trv/engine.ts).
 */
const HAZARD_GROUND: Partial<Record<string, string>> = {
  road: 'R', mud: 'M', oil: 'O', desert_glass: 'D', ramp: 'P', fire: 'F', pit_trap: 'X',
};
/** Seconds a revealed terrain hazard's token stays face up before the ground takes its place. */
const HAZARD_TO_GROUND_S = 1.2;
/** Hazards revealed for long enough to be drawn as ground (board key -> since when it is face up). */
const groundSince = new Map<string, number>();
/** The table last drawn, so the ground can be redrawn once a revealed token has had its moment. */
let lastSnap: Snapshot | null = null;
/** Revealed hazards already drawn as ground on their tile. */
const grounded = new Set<string>();
/** The faces on the table last time (to notice the road moving on a tile). */
let lastBoard = '';
/** Each frame: when a revealed terrain hazard's moment is over, the table is drawn again (tile and token). */
function groundTick(now: number): void {
  if (!lastSnap) return;
  for (const [k, since] of groundSince) {
    if (now - since >= HAZARD_TO_GROUND_S && !grounded.has(k)) { drawTable(lastSnap); return; }
  }
}

/** A tile face with the revealed terrain hazards of board slot `slot` drawn into its terrain. */
function tileWithGround(t: TileRef, slot: number, s: Snapshot): { def: ReturnType<typeof tileDef>; tag: string } {
  const def = tileDef(t);
  const rows = def.terrain.map(r => [...r]);
  const marks: string[] = [];
  const now = performance.now() / 1000;
  for (const [k, h] of s.hazards) {
    const code = HAZARD_GROUND[h.type];
    const [r, c] = k.split(',').map(Number);
    if (!code || !h.faceUp || Math.floor(c / TILE_COLS) !== slot) continue;
    const since = groundSince.get(k);
    if (since === undefined) { groundSince.set(k, now); continue; }
    if (now - since < HAZARD_TO_GROUND_S) continue;
    rows[r][c % TILE_COLS] = code;
    marks.push(`${r}${c % TILE_COLS}${code}`);
    grounded.add(k);
  }
  return marks.length ? { def: { ...def, terrain: rows.map(r => r.join('')) }, tag: `|${marks.sort().join(',')}` } : { def, tag: '' };
}

function showTiles(s: Snapshot): void {
  if (!g) return;
  // The road moved on a tile: the hazards' columns moved back by one tile's width; so do these.
  const lead = s.board.map(t => `${t.tile}${t.side}`).join();
  if (lastBoard && lastBoard.split(',').slice(1).join() === s.board.slice(0, 2).map(t => `${t.tile}${t.side}`).join()) {
    const move = (m: Map<string, number> | Set<string>): void => {
      const entries = m instanceof Map ? [...m] : [...m].map(k => [k, 0] as [string, number]);
      m.clear();
      for (const [k, v] of entries) {
        const [r, c] = k.split(',').map(Number);
        if (c < TILE_COLS) continue;
        const nk = `${r},${c - TILE_COLS}`;
        if (m instanceof Map) m.set(nk, v); else m.add(nk);
      }
    };
    move(groundSince);
    move(grounded);
  }
  lastBoard = lead;
  for (const k of [...groundSince.keys()]) if (!s.hazards.some(([hk]) => hk === k)) { groundSince.delete(k); grounded.delete(k); }
  s.board.forEach((t, i) => {
    const startFace = t.tile === 1 && g!.tilesPlaced === 3;
    const { def, tag } = tileWithGround(t, i, s);
    const key = `${t.tile}${t.side}${startFace ? g!.players.length : ''}${tag}`;
    let grp = tileCache.get(key);
    if (!grp) {
      grp = buildTile(def, { width: TILE_W, depth: TILE_H, thickness: TILE_T, ...(startFace ? { players: g!.players.length } : {}) });
      tileCache.set(key, grp);
      // The same face drawn before (without this ground) keeps its place on the table: no slide-in.
      const old = tileSlots[i];
      if (old && old.userData.face === `${t.tile}${t.side}`) { grp.position.copy(old.position); grp.userData.x = old.userData.x; }
    }
    grp.userData.face = `${t.tile}${t.side}`;
    const x = BOARD_X0 + i * PITCH_W + (GRID.frameW / 2) * KX;
    if (tileSlots[i] !== grp) {
      const fresh = !tileSlots.includes(grp);
      tileSlots[i] = grp;
      if (!grp.parent) scene.add(grp);
      // A new lead tile slides in from beyond the road; the others slide back into place.
      if (fresh && grp.userData.x === undefined) grp.position.set(playing ? x + PITCH_W : x, 0, 0);
    }
    grp.userData.x = x;
  });
  // Tiles no longer on the board leave the table.
  for (const grp of tileCache.values()) if (grp.parent && !tileSlots.includes(grp)) { scene.remove(grp); grp.userData.x = undefined; }
}

const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshBasicMaterial({ visible: false }));
pickPlane.rotation.x = -Math.PI / 2;
pickPlane.position.y = TILE_T;
scene.add(pickPlane);

// Finish line (no art in the licensed files): chequered strip past the lead tile.
const finishTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 448;
  const x2 = c.getContext('2d')!;
  for (let y = 0; y < 28; y++) for (let x = 0; x < 4; x++) { x2.fillStyle = (x + y) % 2 ? '#111' : '#eee'; x2.fillRect(x * 16, y * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const FIN = sizeOf(CAT, 'finish_line');
const finish = new THREE.Mesh(new THREE.PlaneGeometry(FIN[0] * MM, GRID.rows * GRID.rowPitch * KZ), new THREE.MeshStandardMaterial({ map: finishTex }));
finish.rotation.x = -Math.PI / 2;
finish.position.set(BOARD_X0 + 3 * PITCH_W + 0.6 * KX * GRID.pitch + FIN[0] * MM / 2, TILE_T, (GRID.y0 + 2.5 * GRID.rowPitch - GRID.frameH / 2) * KZ);
scene.add(finish);

const carObjs = new Map<string, THREE.Group>();
const chopperObjs = new Map<number, THREE.Group>();
const hazardObjs = new Map<string, { type: string; obj: ReturnType<typeof hazardToken>; gone?: number }>();
const HAZ = sizeOf(CAT, 'hazard_token');
// A hazard token has the shape and size of a road space (asked by the user), so it covers it.
const HAZ_FILL = 0.96;
const HAZ_SIZE = { length: (GRID.pitch + GRID.tip) * KX * HAZ_FILL, depth: GRID.rowPitch * KZ * HAZ_FILL, thickness: HAZ[2] * MM };
const markerGroup = new THREE.Group();
scene.add(markerGroup);
// Dice tray: this turn's FX dice roll onto the table just below the road.
const DIE_W = sizeOf(CAT, 'die')[0] * MM;
// Rolled dice are shown at twice their size, so their faces read from the camera.
const TRAY_SCALE = 2;
const TRAY_Z = TILE_H / 2 + 0.9;
interface TableDie { kind: string; d: Die3D; from: THREE.Vector3; to: THREE.Vector3; q0: THREE.Quaternion; q1: THREE.Quaternion; t: number }
let trayDice: TableDie[] = [];
const FORWARD = new THREE.Vector3(1, 0, 0), AWAY = new THREE.Vector3(0, 0, -1);
const ringGeo = new THREE.RingGeometry(0.42, 0.56, 32);
const carRingGeo = new THREE.RingGeometry(0.55, 0.78, 40);
interface Marker { mesh: THREE.Mesh; option: number; at: THREE.Vector3 }
let markers: Marker[] = [];

// Smoke: soft grey puffs rising from inoperable cars (always) and burning wrecks (for a while).
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x2 = c.getContext('2d')!;
  const gr = x2.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
interface Puff { sprite: THREE.Sprite; age: number; life: number; vel: THREE.Vector3 }
interface Smoke { puffs: Puff[]; follow: THREE.Object3D; until: number; dark: boolean }
const smokes = new Map<string, Smoke>();
function smokeOn(id: string, follow: THREE.Object3D, until: number, dark: boolean): void {
  if (!settings.effects) return;
  const old = smokes.get(id);
  if (old) { old.until = until; old.follow = follow; old.dark = dark; return; }
  const puffs: Puff[] = [];
  for (let i = 0; i < 16; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: dark ? 0x2a2622 : 0x8d8a86, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(sprite);
    puffs.push({ sprite, age: -i * 0.15, life: 2.4, vel: new THREE.Vector3() });
  }
  smokes.set(id, { puffs, follow, until, dark });
}
function smokeOff(id: string): void {
  const sm = smokes.get(id);
  if (!sm) return;
  for (const p of sm.puffs) { scene.remove(p.sprite); p.sprite.material.dispose(); }
  smokes.delete(id);
}
function updateSmoke(dt: number, now: number): void {
  for (const [id, sm] of smokes) {
    const ending = now > sm.until;
    let alive = false;
    for (const p of sm.puffs) {
      p.age += dt;
      if (p.age >= p.life && !ending) {
        p.age = 0;
        p.sprite.position.copy(sm.follow.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.25, (Math.random() - 0.5) * 0.3));
        p.vel.set(0.15 + Math.random() * 0.2, 0.55 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15);
      }
      const u = p.age / p.life;
      if (p.age < 0 || u >= 1) { p.sprite.material.opacity = 0; continue; }
      alive = true;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(0.3 + u * 1.3);
      p.sprite.material.opacity = Math.sin(u * Math.PI) * (sm.dark ? 0.75 : 0.5);
    }
    if (ending && !alive) smokeOff(id);
  }
}

// ---------------------------------------------------------------- game state

interface Saved { setup: Setup; choices: number[] }
let saved: Saved | null = null;
let g: Game | null = null;
let gen: Generator<Decision, void, number> | null = null;
/** The decision this device may answer: the pending one in hot seat; online, only when it is this player's. */
let decision: Decision | null = null;
/** The decision the rules are waiting on, whoever must take it. */
let pending: Decision | null = null;
let selDie: number | null = null;

/** The online room this device is in (null: hot seat). See the "online" section below. */
interface Net { store: RoomStore; code: string; uid: string; host: boolean; room: Room | null; stop: () => void; lobbyOpen: boolean; qrFor: string }
let net: Net | null = null;

/** Online: the player number of this device in the running match (-1: hot seat, or a spectator). */
function mySeat(): number {
  return net?.room ? seatOf(net.room, net.uid) : -1;
}
function setPending(d: Decision | null): void {
  pending = d;
  decision = d && (!net || d.player === mySeat()) ? d : null;
}

function startGame(s: Saved): void {
  replayFrames = null; // a replay belongs to the game it was seen in
  saved = s;
  g = newGame(s.setup);
  gen = play(g);
  let r = gen.next(0);
  for (const c of s.choices) { if (r.done) break; r = gen.next(c); }
  setPending(r.done ? null : r.value);
  selDie = null;
  lastDecider = -1;
  frameSeen = g.frames.length;
  queue.length = 0;
  playing = false;
  persist();
  render();
}

/** The player at this device picks option `i`. Online, a guest asks the host; the host applies and publishes. */
function choose(i: number): void {
  if (!gen || !decision || !saved || i < 0) return;
  if (net && !net.host) {
    void net.store.write(roomPath(net.code, 'intents', net.uid), { n: saved.choices.length, c: i }).catch(netError);
    decision = null; // asked: wait for the host's log
    selDie = null;
    render();
    return;
  }
  const n = saved.choices.length;
  applyChoice(i);
  if (net) void net.store.write(roomPath(net.code, 'log', String(n)), i).catch(netError);
}

/** Feeds an accepted choice to the rules and plays what it produced. */
function applyChoice(i: number): void {
  if (!gen || !pending || !saved) return;
  saved.choices.push(i);
  const r = gen.next(i);
  setPending(r.done ? null : r.value);
  selDie = null;
  persist();
  const fresh = g!.frames.slice(frameSeen);
  frameSeen = g!.frames.length;
  keepReplay(fresh);
  playBeats(fresh);
}

function undo(): void {
  if (net || !saved || !saved.choices.length) return; // online the log is shared: no taking back
  winShown = false;
  $('win').style.display = 'none';
  startGame({ setup: saved.setup, choices: saved.choices.slice(0, -1) });
}

function persist(): void {
  if (net) return; // an online match lives in the room, not in this browser
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch { /* storage off: no resume */ }
}

/** The player the interface is showing: whoever must decide now. */
function viewer(): Player | null {
  if (!g) return null;
  const seat = mySeat();
  if (seat >= 0) return g.players[seat]; // online: always my own boards
  return g.players[pending ? pending.player : g.winner ?? g.current];
}

// ---------------------------------------------------------------- dice placement

/** Option index for dropping die `dieIdx` of the deciding player on `zone`, or -1. */
function zoneOption(zone: string, dieIdx: number): number {
  if (!g || !decision) return -1;
  const v = g.players[decision.player].dice[dieIdx];
  const [kind, id] = zone.split(':');
  return decision.options.findIndex(o => {
    if (o.dieValue !== v) return false;
    if (decision!.kind === 'assign') return o.carId === id && !!o.coast === (kind === 'coast');
    if (decision!.kind === 'command') return kind === 'cmd' && o.command === id;
    return false;
  });
}

function placing(): boolean {
  return !!decision && (decision.kind === 'assign' || decision.kind === 'command');
}

/** Zones that accept the selected die (or any free die when none is selected). */
function hotZones(): Set<string> {
  const out = new Set<string>();
  if (!g || !decision || !placing()) return out;
  const p = g.players[decision.player];
  const dice = selDie !== null ? [selDie] : p.dice.map((_, i) => i).filter(i => !p.used[i]);
  for (const o of decision.options) {
    if (!dice.some(i => p.dice[i] === o.dieValue)) continue;
    if (decision.kind === 'assign' && o.carId) out.add(`${o.coast ? 'coast' : 'move'}:${o.carId}`);
    if (decision.kind === 'command' && o.command) out.add(`cmd:${o.command}`);
  }
  return out;
}

function dieUsable(i: number): boolean {
  if (!g || !decision || !placing()) return false;
  const p = g.players[decision.player];
  return !p.used[i] && decision.options.some(o => o.dieValue === p.dice[i]);
}

// ---------------------------------------------------------------- drawing: 3D

// Generated models (assets/models, made by the project owner): one per piece type, tinted with the crew colour.
const models = new ModelBank();
void useRampModel(MODEL.ramp, u => models.load(u)); // the ramps on the tiles take the model once it has loaded
function collectMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  root.traverse(x => {
    const m = (x as THREE.Mesh).material;
    for (const mm of Array.isArray(m) ? m : m ? [m] : []) if (mm instanceof THREE.MeshStandardMaterial) out.push(mm);
  });
  return out;
}
/**
 * The player-colour light on a car (`o.userData.glow`): cars that can still take a die, and the
 * car that is moving. It lights the model itself, no rings on the table.
 */
function applyGlow(o: THREE.Object3D, now: number): void {
  const glow = (o.userData.active && o.userData.ownerColor ? { color: o.userData.ownerColor, strength: 0.55 } : o.userData.glow) as { color: string; strength: number } | null | undefined;
  const mats = (o.userData.mats ?? []) as THREE.MeshStandardMaterial[];
  const s = glow ? glow.strength * (0.75 + 0.25 * Math.sin(now * 4)) : 0;
  for (const m of mats) {
    if (glow) m.emissive.set(glow.color);
    m.emissiveIntensity = s;
  }
}
/**
 * The car's own gun, cut out of the model (GUNS in models-config.ts) so it can turn on its mount.
 * It swivels toward `o.userData.aim` (a world yaw) and kicks back at every round; at rest it points
 * forward. It rides on the body, so it leans and shakes with it.
 */
function mountGun(o: THREE.Group, model: THREE.Object3D, spec: GunSpec): void {
  const gun = model.getObjectByName(spec.name);
  if (!gun) return;
  let body: THREE.Object3D | null = null;
  model.traverse(x => { if (x.userData.body && !body) body = x; });
  const frame = gun.parent;
  if (body && frame) {
    (body as THREE.Object3D).add(frame); // the frame carried the body's transform: now the body does
    frame.position.set(0, 0, 0); frame.rotation.set(0, 0, 0); frame.scale.set(1, 1, 1);
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(spec.muzzle[0] - spec.pivot[0], spec.muzzle[1] - spec.pivot[1], spec.muzzle[2] - spec.pivot[2]);
  gun.add(muzzle);
  gun.userData.muzzle = muzzle;
  gun.userData.piece = gun.children[0];
  gun.userData.restX = gun.children[0].position.x;
  o.userData.turret = gun;
}
/** How far a gun kicks back along its barrel at each round, in model units. */
const GUN_KICK = 0.02;
/** One frame of a gun: it turns toward its aim (or back forward) and recovers from the recoil. */
function driveGun(o: THREE.Object3D, carYaw: number, dt: number): void {
  const gun = o.userData.turret as THREE.Object3D | undefined;
  if (!gun) return;
  const aim = o.userData.aim as number | null | undefined;
  let want = aim === null || aim === undefined ? 0 : aim - carYaw;
  want = Math.atan2(Math.sin(want - gun.rotation.y), Math.cos(want - gun.rotation.y));
  gun.rotation.y += want * Math.min(1, dt * 12);
  const kick = ((gun.userData.kick ?? 0) as number) * Math.exp(-dt * 22);
  gun.userData.kick = kick;
  (gun.userData.piece as THREE.Object3D).position.x = (gun.userData.restX as number) + kick * GUN_KICK; // the barrel points to -x
}

/** Swaps a stand-in piece for its model once loaded, at its table length. */
function useModel(o: THREE.Group, url: string, lengthMm: number, tint: Tint, id: string): void {
  void models.load(url).then(m => {
    if (!m) return;
    if (!m.userData.split) {
      if (url === MODEL.chopper) splitParts(m, CHOPPER_PARTS);
      else if (WHEELS[url]) { splitWheels(m, WHEELS[url]); if (GUNS[url]) splitParts(m, [GUNS[url]]); }
      m.userData.split = true;
    }
    registerTextures(m);
    const d = dressed(m, tint);
    const size = fitToLength(d, lengthMm * MM, MODEL_YAW);
    if (WHEELS[url]) o.userData.rig = new CarRig(d, d.scale.x, size.y, phaseOf(id));
    o.userData.mats = collectMaterials(d);
    for (const c of o.children) c.visible = false;
    o.add(d);
    if (GUNS[url]) mountGun(o, d, GUNS[url]);
    o.userData.modelHeight = size.y;
    o.userData.modelSize = size;
    o.userData.spin = (['rotorMain', 'rotorTail'] as const).map(n => d.getObjectByName(n)).filter(Boolean);
    o.userData.model = d;
    o.userData.phase = phaseOf(id);
  });
}

function startSpot(v:{ owner: number | null; size: 'S' | 'M' | 'L' }): THREE.Vector3 {
  const sizeIdx = { S: 0, M: 1, L: 2 }[v.size];
  const n = g!.players.length;
  const z = ((v.owner ?? 0) - (n - 1) / 2) * 2.3 + (sizeIdx - 1) * 0.74;
  return new THREE.Vector3(BOARD_X0 - 1.0, TILE_T, z);
}

/** Everything: the table as the rules have it now, the highlights and the interface. */
function render(): void {
  if (!g) return;
  drawTable(snapshot(g));
  drawMarkers();
  drawHud();
}

/** Draws the table from a snapshot (the rules' state now, or a beat being replayed). */
function drawTable(s: Snapshot): void {
  if (!g) return;
  lastSnap = s;
  showTiles(s);
  finish.visible = s.finalTile;
  const hz = new Map(s.hazards);

  for (const [k, h] of hz) {
    let rec = hazardObjs.get(k);
    if (rec && (rec.type !== h.type || rec.gone !== undefined)) { scene.remove(rec.obj.group); rec = undefined; }
    if (!rec) { rec = { type: h.type, obj: hazardToken(h.type, HAZ_SIZE) }; hazardObjs.set(k, rec); scene.add(rec.obj.group); }
    const [r, c] = k.split(',').map(Number);
    // world() is the middle of the space's body; the token's box also holds the point, half a point further on.
    rec.obj.group.position.copy(world({ r, c }));
    rec.obj.group.position.y += 0.003;
    rec.obj.group.position.x += GRID.tip / 2 * KX;
    rec.obj.setFaceUp(h.faceUp);
    // A revealed terrain hazard: once the tile draws it as ground (showTiles), the token goes.
    const since = groundSince.get(k);
    rec.obj.group.visible = !(HAZARD_GROUND[h.type] && h.faceUp && since !== undefined && performance.now() / 1000 - since >= HAZARD_TO_GROUND_S);
  }
  // A hazard discarded after resolving (mine, wreck) stays face up for a moment, then goes.
  for (const [k, rec] of hazardObjs) if (!hz.has(k) && rec.gone === undefined) {
    rec.obj.setFaceUp(true);
    rec.gone = performance.now() / 1000 + 1.6;
  }

  const seen = new Set<string>();
  const stackCount = new Map<string, number>();
  const now = performance.now() / 1000;
  for (const v of [...s.vehicles].filter(x => x.status !== 'elim').sort((a, b) => a.z - b.z)) {
    seen.add(v.id);
    let o = carObjs.get(v.id);
    if (!o) {
      const comp = v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0];
      o = pieces.car(comp.size_mm, v.owner === null ? '#222' : g.players[v.owner].color, v.isWreck);
      if (v.isWreck) useModel(o, wreckModel(v.id), SHOW_LENGTH_MM.wreck, WRECK_TINT, v.id);
      else useModel(o, MODEL.car[v.size], SHOW_LENGTH_MM[v.size], crewTint(g.players[v.owner!].color), v.id);
      carObjs.set(v.id, o);
      scene.add(o);
      o.position.copy(v.pos ? world(v.pos) : startSpot(v));
    }
    o.userData.id = v.id;
    o.userData.wreck = v.isWreck;
    // ON FIRE! (Carnage at Devil's Run): flames ride on the car while it burns.
    const flames = o.userData.flames as THREE.Object3D | undefined;
    if (v.onFire && !flames) {
      const f = flameCluster(TILE_W / 8 * 0.7, v.id.length * 13 + v.id.charCodeAt(1));
      f.position.y = 0.25;
      o.add(f);
      o.userData.flames = f;
    } else if (!v.onFire && flames) { o.remove(flames); delete o.userData.flames; }
    let target: THREE.Vector3;
    if (v.pos) {
      const k = `${v.pos.r},${v.pos.c}`;
      const n = stackCount.get(k) ?? 0;
      stackCount.set(k, n + 1);
      target = world(v.pos).add(new THREE.Vector3(n * 0.12, (hz.has(k) ? HAZ_SIZE.thickness : 0) + n * 0.55, n * 0.08));
    } else target = startSpot(v);
    o.userData.target = target;
    // Inoperable: on one side (the game picks which, each time), smoking. A repair puts it back on its wheels.
    const inop = v.status === 'inop' && !v.isWreck;
    if (inop && !o.userData.flip) o.userData.flipSide = Math.random() < 0.5 ? -1 : 1;
    o.userData.flip = inop ? 1 : 0;
    o.userData.height = o.userData.modelHeight ?? (v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0]).size_mm[2] * MM;
    if (inop) smokeOn(v.id, o, Infinity, false); else if (smokes.get(v.id)?.until === Infinity) smokeOff(v.id);
    o.userData.active = v.id === s.activeCar;
    o.userData.ownerColor = v.owner === null ? null : g.players[v.owner].color;
  }
  // Eliminated pieces (cars and wrecks alike) leave the game: a puff of dark smoke, then they shrink away.
  for (const [id, o] of carObjs) if (!seen.has(id)) {
    carObjs.delete(id);
    smokeOff(id);
    if (playing) {
      const puff = new THREE.Object3D();
      puff.position.copy(o.position);
      smokeOn(`${id}-gone`, puff, now + 1.4, true);
    }
    effects.push({ life: 0.7, t: 0, step: u => { o.scale.setScalar(Math.max(0.01, 1 - u)); o.rotation.z = u * 1.2; if (u >= 1) scene.remove(o); } });
  }

  // A chopper not in play waits on the ground behind its crew's cars; an airstrike flies it in.
  s.choppers.forEach((at, pid) => {
    let o = chopperObjs.get(pid);
    const spot = at ? world(at).setY(1.1) : new THREE.Vector3(BOARD_X0 - 2.5, TILE_T, (pid - (g!.players.length - 1) / 2) * 2.3);
    if (!o) {
      o = pieces.chopper(sizeOf(CAT, 'chopper'), g!.players[pid].color);
      useModel(o, MODEL.chopper, SHOW_LENGTH_MM.chopper, crewTint(g!.players[pid].color, true), `chopper${pid}`);
      chopperObjs.set(pid, o); scene.add(o); o.position.copy(spot);
    }
    o.userData.target = spot;
    o.userData.parked = !at;
  });
}

// ---------------------------------------------------------------- playback of the rules' beats

/** Short-lived 3D effects (impacts, tracers, flashes): `step(u)` with u from 0 to 1. */
interface Effect { life: number; t: number; step: (u: number) => void }
const effects: Effect[] = [];
let frameSeen = 0;
const queue: Frame[] = [];
let playing = false;
let nextBeatAt = 0;
let shakeUntil = 0;
let trayFresh = true;

const BEAT: Partial<Record<Frame['kind'], number>> = {
  move: 0.32, roll: 1.15, slam: 1.0, shot: 1.7, damage: 1.9, elim: 1.5, reveal: 0.8, tile: 1.1, round: 2.6, chopper: 0.8,
};

/** What each rolled die decides, said in a few words under the big die in the middle of the screen. */
const ROLL_NAME: Record<string, string> = { slam: 'Dado slam', direction: 'Direzione', shooting: 'Dado sparo', stunt: 'Dado acrobazia', road: 'Dado strada', fire: 'Dado fuoco' };
const ROLL_MEANS: Record<string, Record<string, string>> = {
  fire: { '+1': '+1 movimento, da fare tutti', '+2': '+2 movimenti, da fare tutti', out: 'il fuoco si spegne', eliminated: 'l’auto brucia: eliminata' },
  slam: { top: 'si muove il veicolo che ha urtato (sopra)', bottom: 'si muove il veicolo urtato (sotto)' },
  direction: { F: 'avanti', FL: 'avanti a sinistra', FR: 'avanti a destra', B: 'indietro', BL: 'indietro a sinistra', BR: 'indietro a destra' },
  shooting: { L: 'colpisce solo le auto grandi', M: 'colpisce medie e grandi', SM: 'colpisce piccole e medie', ANY: 'colpisce qualsiasi auto' },
};
let rollsTimer = 0;
/** Shows a rolled die big in the middle of the screen, with what it means; the dice of one event stay together. */
function showRoll(f: Frame): void {
  if (!f.die) return;
  const el = $('rolls');
  if (!el.classList.contains('show')) el.innerHTML = '';
  if (el.children.length >= 4) el.firstElementChild!.remove();
  const means = ROLL_MEANS[f.die.die]?.[String(f.die.value)] ?? (typeof f.die.value === 'number' ? `${f.die.value}` : '');
  el.insertAdjacentHTML('beforeend', `<div class="roll">${dieHtml(f.die.die, f.die.value, undefined, '', `data-roll="${performance.now()}"`)}`
    + `<b>${ROLL_NAME[f.die.die] ?? f.die.die}</b><span>${esc(means)}</span></div>`);
  el.classList.add('show');
  clearTimeout(rollsTimer);
  rollsTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
}

/** The damage tokens: name and what each does, in a few words (rulebook, back cover). */
const DAMAGE_INFO: Record<string, [string, string]> = {
  dent: ['Ammaccatura', 'Nessun effetto, oltre al danno.'],
  shrapnel: ['Schegge', 'Dado direzione: il primo veicolo su quella linea subisce un danno.'],
  skid: ['Sbandata', 'L’auto si sposta di 1 casella nella direzione indicata.'],
  dazed: ['Stordito', 'Dado acrobazia: tante caselle, ognuna nella direzione tirata.'],
  blastoff: ['Decollo', 'Dadi direzione e acrobazia: l’auto vola di tante caselle in quella direzione.'],
  // Carnage at Devil's Run (CDR p4).
  on_fire: ['In fiamme', 'L’auto prende un segnalino ON FIRE!; il segnalino danno resta coperto.'],
  ongoing_effect: ['Effetto continuo', 'Si pesca una carta effetto continuo: resta finché il danno non viene riparato.'],
};
/**
 * A car takes damage: the token drawn is turned over big in the middle of the screen, with whose
 * car it is and what the token does. The dice it calls for appear beside it as they are rolled.
 */
/**
 * Crew leader portraits, by leader id: licensed art, so local only (assets/licensed/leaders/<id>.png,
 * .jpg or .webp). A leader without a file shows the crew colour and an initial.
 */
const PORTRAITS: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/licensed/leaders/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, '').toLowerCase(), url]));

/** Choppe Shoppe: what each upgrade card does, in the interface's words. */
const UPGRADE_INFO: Record<string, string> = {
  grappling_hook: 'Dopo aver colpito un’auto e risolto il danno, può scambiarsi di posto con lei.',
  snowplow: 'Entrando su un relitto o un veicolo fuori uso, lo sposta in una casella vuota adiacente e prosegue.',
  big_red_button: 'Quando va fuori uso puoi eliminarla: elimini anche auto ed elicotteri adiacenti.',
  armor_plating: 'Il risultato “qualsiasi” del dado sparo contro di lei è un colpo mancato.',
  onboard_computer: 'Ignora gli effetti dei suoi danni: restano coperti.',
  ghost_mode: 'Quando fa Drift guadagna 2 movimenti.',
  smoke_screen: 'Non le si può sparare dalla casella direttamente dietro.',
  skull_shift_knob: 'Non deve usare tutti i suoi movimenti.',
  heavy_machine_gun: 'Quando spara e manca, può ritirare il dado sparo.',
  rail_gun: 'Spara fino a tre caselle dritto davanti a sé.',
  oil_dispenser: 'Dopo il movimento può posare una chiazza d’olio in una casella vuota adiacente. Tre volte a partita.',
  roll_cage: 'Se uno slam la spingerebbe contro un’altra auto, può mettersi in una casella vuota adiacente.',
  crumple_zones: 'Quando subisce un danno ne peschi due e ne scegli uno.',
  sandbags: 'Negli slam che la coinvolgono gli avversari non possono ritirare i dadi.',
  deep_treads: 'Per lei il fango vale come strada.',
  heavy_frame: 'Regge un danno in più prima di andare fuori uso.',
  spoiler: 'Per lei il dado strada vale sempre 2.',
  anti_aircraft_radar: 'Se finisce il turno sotto un elicottero può spostarsi in una casella vuota adiacente.',
  stability_control: 'Se uno slam la muoverebbe, puoi ritirare il dado direzione.',
  punt_gun: 'Spara fino a due caselle di distanza.',
  tank_treads: 'Con un dado da 3 o meno non rivela i pericoli coperti che attraversa: solo quello su cui si ferma.',
  off_road_suspension: 'Se parte su strada può usare il dado strada, ovunque si muova.',
  rear_guns: 'Spara in qualunque casella adiacente.',
  boost_switch: 'Ha un movimento in più.',
  assault_bumper: 'L’auto che sposta in uno slam va una casella più in là.',
  stealth_technology: 'Non le si può sparare se c’è un altro veicolo a cui sparare.',
  mine_dispenser: 'Dopo il movimento può posare una mina in una casella vuota adiacente. Tre volte a partita.',
};
const upgradeName = (id: string): string => upgrades().find(u => u.id === id)?.name ?? id;

/** Choppe Shoppe: each leader's special power, name and what it does (the crew leader boards). */
const POWER_INFO: Record<string, [string, string]> = {
  junk_in_the_trunk: ['Junk in the Trunk', 'Se la tua auto verrebbe mossa in uno slam, puoi ritirare il dado direzione.'],
  spotter: ['Spotter', 'Quando spari, se un’altra tua auto operativa è adiacente al bersaglio, colpisci automaticamente.'],
  jury_rigging: ['Jury-Rigging', 'Ignori gli effetti dei segnalini danno: restano coperti.'],
  soul_siphon: ['Soul Siphon', 'Quando colpisci un veicolo sparando, togli un danno da una tua auto.'],
  trash_into_treasure: ['Trash into Treasure', 'Quando entri su un pericolo coperto prendi un segnalino comando, poi lo giri.'],
  redline: ['Redline', 'Un dado movimento da 6 assegnato a un’auto vale 7.'],
  objection: ['Objection!', 'Quando spari e manchi puoi ritirare il dado sparo.'],
  third_eye: ['Third Eye', 'A inizio round guardi un pericolo coperto.'],
  long_arm_of_the_law: ['Long Arm of the Law', 'Puoi sparare a un bersaglio a due caselle.'],
};
/** What each command does, in three short lines for the command board. */
const CMD_LINES: Record<string, string[]> = {
  airstrike: ['Piazza l’elicottero', 'su una casella vuota.', 'Dal 2° round spara.'],
  nitro: ['Aggiungi il dado', 'al movimento', 'dell’auto.'],
  drift: ['Attraversa il primo', 'veicolo che incontri,', 'senza slam.'],
  repair: ['Togli un danno', 'da una tua auto.'],
  bump: ['Al primo slam del turno', 'solo dado direzione:', 'si muove l’altra auto.'],
  pain_transfer: ['Sposta un danno', 'da una tua auto', 'a un’altra.'],
  need_for_speed: ['I dadi non assegnati', 'prendono il valore', 'di questo dado.'],
  called_shot: ['In questo turno', 'colpisci', 'automaticamente.'],
};
/** The text of a command's die space: "1-3", "6", or a star for a command token only. */
function slotText(s: CommandSlot): string {
  if (s.token || !s.values.length) return '★';
  const lo = Math.min(...s.values), hi = Math.max(...s.values);
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}
/** A crew leader's commands as the command board draws them. */
function boardCommands(p: Player): { cmd: string; name: string; slot: string; lines: string[] }[] | undefined {
  if (!leaderOf(p)) return undefined;
  return commandsOf(p).map(s => ({ cmd: s.id, name: commandName(s.id).toUpperCase(), slot: slotText(s), lines: CMD_LINES[s.id] ?? [] }));
}

function showDamage(f: Frame): void {
  if (!g || f.token === undefined) return;
  if (f.faceDown) {
    const car = g.vehicles.find(x => x.id === f.vehicleId);
    const pl = car && car.owner !== null ? g.players[car.owner] : null;
    const el = $('rolls');
    el.innerHTML = `<div class="roll dmg" style="--c:${pl?.color ?? '#d42f30'}"><small>${esc(pl ? `Auto di ${pl.name}` : '')} · danno</small>`
      + `<i class="tok">${damageTokenSvg(null, false)}</i><b>Jury-Rigging</b><span>Il segnalino resta coperto: nessun effetto, ma conta come danno.</span></div>`;
    el.classList.add('show');
    clearTimeout(rollsTimer);
    rollsTimer = window.setTimeout(() => el.classList.remove('show'), 4500);
    return;
  }
  const v = g.vehicles.find(x => x.id === f.vehicleId);
  const owner = v && v.owner !== null ? g.players[v.owner] : null;
  const who = v ? `Auto ${{ S: 'piccola', M: 'media', L: 'grande' }[v.size]}${owner ? ` di ${owner.name}` : ''}` : '';
  const [name, does] = f.token ? DAMAGE_INFO[f.token.type] ?? [f.token.type, ''] : ['Danno', 'Nessun segnalino rimasto nella pila.'];
  const el = $('rolls');
  el.innerHTML = `<div class="roll dmg" style="--c:${owner?.color ?? '#d42f30'}"><small>${esc(who)} · danno</small>`
    + `<i class="tok">${f.token ? damageTokenSvg(f.token.type, true, f.token.dir as never) : damageTokenSvg(null, false)}</i>`
    + `<b>${esc(name)}</b><span>${esc(does)}</span></div>`;
  el.classList.add('show');
  clearTimeout(rollsTimer);
  rollsTimer = window.setTimeout(() => el.classList.remove('show'), 4500);
}

/** A comic word over a point of the table ("SLAM!", "BOOM!"): it pops, rises and fades. */
interface Word { el: HTMLElement; at: THREE.Vector3; t: number; life: number }
const words: Word[] = [];
function word(text: string, at: THREE.Vector3, color: string, big = false): void {
  if (!settings.words) return;
  const el = document.createElement('div');
  el.className = `word${big ? ' big' : ''}`;
  el.textContent = text;
  el.style.setProperty('--wc', color);
  $('fx').appendChild(el);
  words.push({ el, at: at.clone(), t: 0, life: big ? 1.6 : 1.2 });
}
function updateWords(dt: number): void {
  const rect = renderer.domElement.getBoundingClientRect();
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    w.t += dt / w.life;
    if (w.t >= 1) { w.el.remove(); words.splice(i, 1); continue; }
    const p = w.at.clone().setY(w.at.y + 0.9 + w.t * 1.2).project(camera);
    const pop = w.t < 0.15 ? 0.4 + w.t / 0.15 * 0.8 : 1.2 - Math.min(0.2, (w.t - 0.15) * 1.5);
    w.el.style.left = `${rect.left + (p.x * 0.5 + 0.5) * rect.width}px`;
    w.el.style.top = `${rect.top + (-p.y * 0.5 + 0.5) * rect.height}px`;
    w.el.style.transform = `translate(-50%, -50%) scale(${pop}) rotate(${-6 + w.t * 4}deg)`;
    w.el.style.opacity = `${w.t < 0.7 ? 1 : (1 - w.t) / 0.3}`;
  }
}

/**
 * An explosion at a point of the table: a flash of light, fireballs that swell and darken, flying
 * debris, a shock ring, dark smoke and a scorch mark that fades. `size` 1 = a car blowing up.
 */
function explode(at: THREE.Vector3, size = 1, now = performance.now() / 1000): void {
  const p0 = at.clone().setY(Math.max(at.y, TILE_T) + 0.25);
  shakeUntil = now + 0.5 * size;
  if (!settings.effects) return;
  const light = new THREE.PointLight(0xffb040, 60 * size, 14 * size);
  light.position.copy(p0).setY(p0.y + 0.8);
  scene.add(light);
  effects.push({ life: 0.5, t: 0, step: u => { light.intensity = 60 * size * (1 - u) ** 2; if (u >= 1) scene.remove(light); } });
  // Fireballs: bright and additive at first, then dark smoke.
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xfff0a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize();
    const speed = (0.8 + Math.random() * 1.6) * size, grow = (1.1 + Math.random() * 1.3) * size, delay = Math.random() * 0.12;
    s.position.copy(p0);
    scene.add(s);
    const hot = new THREE.Color(0xfff0a0), mid = new THREE.Color(0xff6a1a), cold = new THREE.Color(0x2a1a12);
    effects.push({ life: 0.9 + Math.random() * 0.4, t: 0, step: u => {
      const v = Math.max(0, u - delay);
      s.position.copy(p0).addScaledVector(dir, speed * (1 - (1 - v) ** 2)).setY(p0.y + dir.y * speed * v + v * 0.6);
      s.scale.setScalar(0.3 + grow * Math.sqrt(v));
      s.material.color.copy(v < 0.3 ? hot.clone().lerp(mid, v / 0.3) : mid.clone().lerp(cold, (v - 0.3) / 0.7));
      if (v > 0.45 && s.material.blending !== THREE.NormalBlending) { s.material.blending = THREE.NormalBlending; s.material.needsUpdate = true; }
      s.material.opacity = v < 0.1 ? v * 10 : 1 - v;
      if (u >= 1) { scene.remove(s); s.material.dispose(); }
    } });
  }
  // Debris: small dark chunks thrown up, falling back under gravity.
  const chunk = new THREE.BoxGeometry(0.09, 0.06, 0.12);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(chunk, new THREE.MeshStandardMaterial({ color: i % 3 ? 0x2a2622 : 0x8a4a2a, roughness: 0.8 }));
    const v0 = new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5).multiplyScalar(size);
    const spin = new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    m.castShadow = true;
    scene.add(m);
    effects.push({ life: 1.3, t: 0, step: u => {
      const t = u * 1.3;
      m.position.copy(p0).addScaledVector(v0, t).setY(Math.max(TILE_T + 0.03, p0.y + v0.y * t - 9 * t * t));
      m.rotation.set(spin.x * t, spin.y * t, spin.z * t);
      if (u >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); }
    } });
  }
  impact(p0, 0xffd23a, 2.4 * size);
  // Scorch mark on the ground, fading slowly.
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.7 * size, 24), new THREE.MeshBasicMaterial({ map: smokeTex, color: 0x000000, transparent: true, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.copy(at).setY(Math.max(at.y, TILE_T) + 0.012);
  scorch.renderOrder = 2;
  scene.add(scorch);
  effects.push({ life: 9, t: 0, step: u => { (scorch.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - u * u); if (u >= 1) scene.remove(scorch); } });
  const puff = new THREE.Object3D();
  puff.position.copy(p0);
  smokeOn(`boom-${now}-${Math.random()}`, puff, now + 2.6, true);
}

/**
 * A vehicle is destroyed. With `into` (the space it was entering: an obstacle, or off the road) it
 * first lunges that way and blows up against it; then the wreck is thrown up, spinning, and is gone.
 */
function crash(id: string, into: THREE.Vector3 | null, why: string): void {
  const o = carObjs.get(id);
  if (!o) return;
  carObjs.delete(id); // from here on this effect owns the piece: the table no longer drives it
  smokeOff(id);
  const from = o.position.clone();
  const hit = into ? from.clone().lerp(into, 0.6) : from.clone();
  const yaw0 = o.rotation.y;
  let blown = false;
  effects.push({ life: into ? 1.5 : 1.2, t: 0, step: u => {
    const lunge = into ? 0.2 : 0.02;
    if (u < lunge) {
      o.position.lerpVectors(from, hit, (u / lunge) ** 2);
      return;
    }
    if (!blown) {
      blown = true;
      explode(hit, 1);
      word('BOOM!', hit, '#ff6a2a', true);
      for (const m of collectMaterials(o)) { m.color.multiplyScalar(0.25); m.emissive.setRGB(1, 0.35, 0.05); m.emissiveIntensity = 0.8; }
    }
    const v = (u - lunge) / (1 - lunge), t = v * 1.3;
    // Thrown back from the obstacle and up, tumbling; it shrinks away as it lands.
    const back = into ? from.clone().sub(hit).setY(0).normalize() : new THREE.Vector3(0, 0, 0);
    o.position.copy(hit).addScaledVector(back, t * 1.6).setY(Math.max(TILE_T, hit.y + 5.5 * t - 6.5 * t * t));
    o.rotation.set(t * 7, yaw0 + t * 3, t * 4);
    o.scale.setScalar(v < 0.75 ? 1 : Math.max(0.01, 1 - (v - 0.75) / 0.25));
    if (u >= 1) scene.remove(o);
  } });
  void why;
}

function beatLength(f: Frame): number {
  if (f.kind !== 'log') return BEAT[f.kind] ?? 0.3;
  if (f.logKind === 'turn') return 0.6;
  return f.logKind === 'dice' || f.logKind === 'bad' || f.logKind === 'good' ? 0.45 : 0.1;
}

/** Starts replaying the beats the last choice produced. */
function playBeats(frames: Frame[]): void {
  if (!frames.length) { render(); return; }
  queue.push(...frames);
  playing = true;
  nextBeatAt = 0;
  markerGroup.clear();
  markers = [];
  drawHud();
  if (settings.speed === 'skip' && !replaying) skipBeats();
}

/** Jumps to the end of the replay. */
function skipBeats(): void {
  if (!playing) return;
  for (const f of queue) if (f.kind === 'log') toastLine(f);
  queue.length = 0;
  $('roundbox').classList.remove('show');
  finishBeats();
}

function finishBeats(): void {
  playing = false;
  if (replaying) endReplay();
  actionDone();
  render();
}

// ---------------------------------------------------------------- action camera
// On a slam, a shot, damage or a car destroyed the view flies to the action and comes close
// ("action camera", asked by the user); when the beats are over it returns to where it was.
// Off in the Options menu; not during the instant replay (it frames its own shots) or the chase view.

const ACTION_BEATS = new Set<Frame['kind']>(['slam', 'shot', 'damage', 'elim']);
/** How close the action camera comes, as a share of the distance of the whole-map view. */
const ACTION_DIST = 0.4;
/** Longest wait, in seconds, of the beats for the camera to reach the action. */
const ACTION_WAIT = 1.5;
let actionBack: { target: THREE.Vector3; dist: number } | null = null;
let actionSince = 0;
function actionShot(at: THREE.Vector3): void {
  if (!settings.actionCam || replaying || chase || settings.speed === 'skip') return;
  actionSince = performance.now() / 1000;
  actionBack ??= { target: controls.target.clone(), dist: camera.position.distanceTo(controls.target) };
  focusGoal = at.clone().setY(0);
  focusDist = Math.min(actionBack.dist, fitDist * ACTION_DIST);
}
function actionDone(): void {
  if (!actionBack) return;
  focusGoal = actionBack.target;
  focusDist = actionBack.dist;
  actionBack = null;
}

// ---------------------------------------------------------------- chase view
// The view from behind a car, picked from its dashboard; a second click on the dashboard, the
// Vista button or V bring the usual view back.

/** Where the chase camera sits, in road spaces: behind the car, above it, and where it looks ahead. */
const SPACE_W = TILE_W / 8;
// Low behind the car, looking down the road; the picture is shifted up (`lift`, a share of the
// window's height) so the car sits in the band left free between the bubbles and the boards.
const CHASE = { back: 3.2 * SPACE_W, up: 1.5 * SPACE_W, ahead: 1.1 * SPACE_W, follow: 4, lift: 0.24 };
let chase: string | null = null;
const chaseLook = new THREE.Vector3();
/** Turns the chase view on for car `id`, or off when it is already on (or `id` is null). */
function setChase(id: string | null): void {
  chase = id && chase !== id ? id : null;
  controls.enabled = !chase;
  if (chase) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * CHASE.lift, innerWidth, innerHeight);
  else camera.clearViewOffset();
  focusGoal = null;
  focusDist = null;
  if (chase) { const o = carObjs.get(chase); if (o) chaseLook.copy(o.position); }
  else fit();
  drawHud();
}
/**
 * A button on each of the player's dashboards (top right corner) for the view from behind that
 * car; on the car being followed it brings the map back. Only the button does it (asked by the
 * user, 2026-11-16): the rest of the dashboard keeps its own clicks (dice, repairs, cards).
 */
function chaseButtons(): void {
  const strip = $('strip');
  strip.querySelectorAll('.chasebtn').forEach(b => b.remove());
  const box = strip.getBoundingClientRect();
  for (const el of strip.querySelectorAll<SVGElement>('[data-car]')) {
    const id = el.dataset.car!;
    const v = g?.vehicles.find(x => x.id === id);
    if (!v || v.status === 'elim' || !carObjs.has(id)) continue;
    const r = el.getBoundingClientRect();
    const b = document.createElement('button');
    b.className = `chasebtn${chase === id ? ' on' : ''}`;
    b.title = chase === id ? 'Torna alla vista della mappa (V)' : 'Vista alle spalle di questa auto';
    b.innerHTML = chase === id ? '✕ Mappa' : '🎥 Vista auto';
    b.style.left = `${r.right - box.left - 8}px`;
    b.style.top = `${r.top - box.top + 8}px`;
    b.addEventListener('click', e => { e.stopPropagation(); setChase(id); });
    strip.append(b);
  }
}
addEventListener('resize', () => requestAnimationFrame(chaseButtons));

/** One frame of the chase view; false when there is none (or its car is gone). */
function chaseCamera(dt: number): boolean {
  if (!chase) return false;
  const o = carObjs.get(chase);
  if (!o || !o.visible) { setChase(null); return false; }
  // Parked in the starting area a car stands sideways: there "behind" means facing down the road.
  const v = g?.vehicles.find(x => x.id === chase);
  const yaw = v?.inStart ? 0 : (o.userData.yaw ?? 0) as number, fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const want = o.position.clone().addScaledVector(fwd, -CHASE.back).setY(o.position.y + CHASE.up);
  const k = 1 - Math.exp(-dt * CHASE.follow);
  camera.position.lerp(want, k);
  chaseLook.lerp(o.position.clone().addScaledVector(fwd, CHASE.ahead), k);
  camera.lookAt(chaseLook);
  controls.target.copy(chaseLook);
  return true;
}

// ---------------------------------------------------------------- instant replay
// When a car is damaged or destroyed, the beats around it are kept: the Replay button (or R) plays
// them again, slowly and from close by, then puts the table and the camera back as they were.

/** Replay speed, and where the camera stands from the spot it looks at. */
const REPLAY = { speed: 0.45, before: 8, after: 2, camera: new THREE.Vector3(-2.4, 4.4, 5.4) };
let replayFrames: Frame[] | null = null;
let replayAt: THREE.Vector3 | null = null;
let replaying = false;
let timeScale = 1;
let camBefore: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

/** Keeps the beats around a damage or a destruction in the frames a choice produced, if any. */
function keepReplay(frames: Frame[]): void {
  const hit = (f: Frame): boolean => f.kind === 'damage' || f.kind === 'elim';
  const first = frames.findIndex(hit);
  if (first < 0) return;
  let last = first;
  frames.forEach((f, i) => { if (hit(f)) last = i; });
  replayFrames = frames.slice(Math.max(0, first - REPLAY.before), last + 1 + REPLAY.after).filter(f => f.kind !== 'log' && f.kind !== 'round' && f.kind !== 'tile');
  const where = frames[first].into ?? frames[first].at;
  replayAt = where ? world(where) : null;
  const b = $('replay');
  b.classList.add('fresh');
  window.setTimeout(() => b.classList.remove('fresh'), 9000);
}

function startReplay(): void {
  if (!g || !replayFrames?.length || playing) return;
  replaying = true;
  timeScale = REPLAY.speed;
  camBefore = { pos: camera.position.clone(), target: controls.target.clone() };
  focusGoal = null;
  if (replayAt) { controls.target.copy(replayAt).setY(0); camera.position.copy(controls.target).add(REPLAY.camera); }
  $('replaybadge').classList.add('show');
  $('replay').classList.remove('fresh');
  // Back to how the table stood before: the pieces are put there at once, not driven there.
  drawTable(replayFrames[0].snap);
  for (const o of carObjs.values()) { const tg = o.userData.target as THREE.Vector3 | undefined; if (tg) o.position.copy(tg); }
  playBeats(replayFrames.slice());
}

function endReplay(): void {
  replaying = false;
  timeScale = 1;
  $('replaybadge').classList.remove('show');
  if (camBefore) { camera.position.copy(camBefore.pos); controls.target.copy(camBefore.target); camBefore = null; }
}
$('replay').addEventListener('click', startReplay);

function applyBeat(f: Frame, now: number): void {
  if (f.kind === 'log') { toastLine(f); if (f.logKind === 'turn') { trayFresh = true; $('rolls').classList.remove('show'); } return; }
  drawTable(f.snap);
  const at = f.at ? world(f.at) : null;
  if (at && ACTION_BEATS.has(f.kind)) actionShot(f.from && f.kind === 'shot' ? world(f.from).add(at).multiplyScalar(0.5) : at);
  switch (f.kind) {
    case 'roll': rollOnTable(f); showRoll(f); break;
    case 'slam':
      shakeUntil = now + 0.35;
      if (at) { impact(at, 0xff6a2a, 1.6); impact(at, 0xffffff, 0.8); word('SLAM!', at, '#ffb02a'); }
      break;
    case 'shot':
      if (f.from && at) burst(world(f.from), at, f.vehicleId);
      break;
    case 'damage':
      showDamage(f);
      if (f.vehicleId) flash(f.vehicleId);
      if (at) { impact(at, 0xff2a2a, 1.1); word('DANNO!', at, '#ff4a3a'); }
      break;
    case 'elim':
      if (f.vehicleId) crash(f.vehicleId, f.into ? world(f.into) : null, f.why ?? '');
      else if (at) explode(at);
      break;
    case 'reveal':
      if (at) impact(at, 0xffffff, 0.9);
      break;
    case 'chopper':
      if (at) impact(at, 0x9fd3ff, 1.2);
      break;
    case 'round':
      showRound(f);
      break;
    default:
      break;
  }
}

/** A coloured ring that spreads and fades over a space. */
function impact(at: THREE.Vector3, color: number, size: number): void {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthTest: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at).setY(TILE_T + 0.3);
  m.renderOrder = 12;
  scene.add(m);
  effects.push({ life: 0.6, t: 0, step: u => {
    m.scale.setScalar(1 + u * size * 2);
    (m.material as THREE.MeshBasicMaterial).opacity = 1 - u;
    if (u >= 1) { scene.remove(m); m.geometry.dispose(); }
  } });
}

/** How a burst is fired: time to aim, rounds, seconds between them, bullet speed (units/s), spread at the target. */
const BURST = { aim: 0.32, rounds: 8, gap: 0.085, speed: 26, spread: 0.22 };
const bulletGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6);
/**
 * A shot: the shooter (the car on that spot, or a chopper over it) turns its gun on the target
 * and fires a burst. Every round has a muzzle flash, a recoil, a tracer that flies to the target
 * and sparks where it lands. The die that follows says whether it did any damage.
 */
function burst(from: THREE.Vector3, to: THREE.Vector3, targetId?: string): void {
  // Who is firing: a chopper standing over that spot, else the nearest car to it.
  let shooter: THREE.Object3D | undefined, flying = false;
  for (const o of chopperObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (!o.userData.parked && tg && Math.hypot(tg.x - from.x, tg.z - from.z) < 0.3) { shooter = o; flying = true; }
  }
  if (!shooter) {
    let best = 0.9;
    for (const [id, o] of carObjs) {
      if (id === targetId) continue;
      const d = Math.hypot(o.position.x - from.x, o.position.z - from.z);
      if (d < best) { best = d; shooter = o; }
    }
  }
  const origin = (shooter?.position ?? from).clone();
  const yaw = Math.atan2(-(to.z - origin.z), to.x - origin.x);
  if (shooter) shooter.userData.aim = yaw;
  const target = to.clone().setY(Math.max(to.y, TILE_T) + 0.3);
  const turret = shooter?.userData.turret as THREE.Object3D | undefined;
  const muzzleAt = (): THREE.Vector3 => {
    if (turret) return (turret.userData.muzzle as THREE.Object3D).getWorldPosition(new THREE.Vector3());
    const p = (shooter?.position ?? from).clone();
    return p.add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(0.6)).setY(p.y + (flying ? -0.1 : 0.45));
  };
  const total = BURST.aim + BURST.rounds * BURST.gap + 0.5;
  let fired = 0;
  effects.push({ life: total, t: 0, step: u => {
    const t = u * total;
    while (fired < BURST.rounds && t >= BURST.aim + fired * BURST.gap) round(fired++);
    if (u >= 1 && shooter) shooter.userData.aim = null;
  } });
  word('RATATATA!', origin, '#ffe066');

  function round(n: number): void {
    const a = muzzleAt();
    const b = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * BURST.spread, (Math.random() - 0.3) * BURST.spread, (Math.random() - 0.5) * 2 * BURST.spread));
    if (turret) turret.userData.kick = 1; // the gun kicks back
    // Muzzle flash: a hot star at the barrel and a blink of light.
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xffe9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fl.position.copy(a);
    const light = new THREE.PointLight(0xffc860, 9, 5);
    light.position.copy(a);
    scene.add(fl, light);
    effects.push({ life: 0.09, t: 0, step: v => {
      fl.scale.setScalar(0.25 + v * 0.55); fl.material.opacity = 1 - v; light.intensity = 9 * (1 - v);
      if (v >= 1) { scene.remove(fl, light); fl.material.dispose(); }
    } });
    // A wisp of gun smoke left behind.
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xb0aaa0, transparent: true, opacity: 0, depthWrite: false }));
    puff.position.copy(a);
    scene.add(puff);
    effects.push({ life: 0.7, t: 0, step: v => {
      puff.position.y = a.y + v * 0.5; puff.scale.setScalar(0.15 + v * 0.5); puff.material.opacity = 0.35 * Math.sin(v * Math.PI);
      if (v >= 1) { scene.remove(puff); puff.material.dispose(); }
    } });
    // The tracer: a short bright streak that flies to the target.
    const dir = b.clone().sub(a), dist = dir.length();
    dir.normalize();
    const streak = Math.min(0.9, dist * 0.45);
    const m = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: n % 3 === 0 ? 0xfff6c8 : 0xffc23a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.scale.set(1, streak, 1);
    scene.add(m);
    effects.push({ life: Math.max(0.05, dist / BURST.speed), t: 0, step: v => {
      m.position.copy(a).addScaledVector(dir, Math.max(streak / 2, v * dist - streak / 2));
      if (v >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); sparks(b, dir); }
    } });
  }
}

/** Sparks where a round lands: a flash and a few bright bits thrown back. */
function sparks(at: THREE.Vector3, dir: THREE.Vector3): void {
  if (!settings.effects) return;
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xfff0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fl.position.copy(at);
  scene.add(fl);
  effects.push({ life: 0.14, t: 0, step: v => { fl.scale.setScalar(0.2 + v * 0.5); fl.material.opacity = 1 - v; if (v >= 1) { scene.remove(fl); fl.material.dispose(); } } });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const v0 = dir.clone().multiplyScalar(-1.5).add(new THREE.Vector3((Math.random() - 0.5) * 4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 4));
    m.scale.set(0.6, 0.12, 0.6);
    scene.add(m);
    effects.push({ life: 0.35, t: 0, step: v => {
      const t = v * 0.35;
      m.position.copy(at).addScaledVector(v0, t).setY(Math.max(TILE_T + 0.02, at.y + v0.y * t - 9 * t * t));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v0.clone().setY(v0.y - 18 * t).normalize());
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - v;
      if (v >= 1) { scene.remove(m); (m.material as THREE.Material).dispose(); }
    } });
  }
}

/** The car glows red for a moment. */
function flash(id: string): void {
  const o = carObjs.get(id);
  if (!o) return;
  const mats: THREE.MeshStandardMaterial[] = [];
  o.traverse(x => { const m = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.emissive && !mats.includes(m)) mats.push(m); });
  effects.push({ life: 0.65, t: 0, step: u => {
    for (const m of mats) { m.emissive.setRGB(1, 0.1, 0.05); m.emissiveIntensity = Math.sin(u * Math.PI * 3) ** 2 * (1 - u) * 1.5; }
  } });
}

/** A rolled FX die tumbles onto the table just below the road, near the car that rolled it. */
function rollOnTable(f: Frame): void {
  if (!f.die) return;
  if (trayFresh) { for (const t of trayDice) scene.remove(t.d.mesh); trayDice = []; trayFresh = false; }
  // One die per kind on the table: a new roll of the same die replaces the old one, in its place.
  const old = trayDice.findIndex(t => t.kind === f.die!.die);
  if (old >= 0) scene.remove(trayDice[old].d.mesh); // its materials are shared by every die: keep them
  const i = old >= 0 ? old : trayDice.length;
  const car = f.snap.vehicles.find(v => v.id === f.snap.activeCar);
  const cx = THREE.MathUtils.clamp(car?.pos ? world(car.pos).x : BOARD_X0 + 2, BOARD_X0 + 1, BOARD_X0 + 2 * PITCH_W + TILE_W - 8);
  const d = makeDie(FACES, f.die.die, DIE_W);
  d.mesh.scale.setScalar(TRAY_SCALE);
  // Dice are solid: each one lands on a spot of its own. Slots are a die's diagonal plus a gap
  // apart (a die may land a little turned); the first free one nearest the car is taken.
  const step = DIE_W * TRAY_SCALE * 1.6;
  const others = trayDice.filter((t, k) => k !== i && t);
  const free = (x: number, z: number): boolean => others.every(t => Math.abs(t.to.x - x) >= step - 1e-6 || Math.abs(t.to.z - z) >= step - 1e-6)
    && tableDice.every(t => Math.abs(t.base.x - x) >= step - 1e-6 || Math.abs(t.base.z - z) >= step - 1e-6); // the player's own dice lie there too
  let to = old >= 0 ? trayDice[old].to.clone() : null;
  for (let row = 0; !to && row < 3; row++) {
    for (let n = 0; n < 40; n++) {
      const j = n % 2 ? (n + 1) / 2 : -n / 2; // 0, 1, -1, 2, -2…
      const x = cx + j * step, z = TRAY_Z + row * step;
      if (x < BOARD_X0 + 0.5 || !free(x, z)) continue;
      to = new THREE.Vector3(x, DIE_W * TRAY_SCALE / 2, z);
      break;
    }
  }
  to ??= new THREE.Vector3(cx, DIE_W * TRAY_SCALE / 2, TRAY_Z + 5 * step);
  // Dropped from above with a little drift, less than the gap between slots: it never crosses a neighbour.
  const from = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 3.2, (Math.random() - 0.5) * 0.3));
  const q1 = d.orientation(f.die.face, f.die.die === 'direction' ? FORWARD : AWAY)
    .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.die.die === 'direction' ? 0 : (Math.random() - 0.5) * 0.4));
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
  d.mesh.position.copy(from);
  d.mesh.quaternion.copy(q0);
  scene.add(d.mesh);
  trayDice[i] = { kind: f.die.die, d, from, to, q0, q1, t: 0 };
}

/** Start of a round: every crew rolls its movement dice, the first player rolls the road die. */
function showRound(f: Frame): void {
  if (!g || !f.round) return;
  const r = f.round;
  const t0 = performance.now();
  const box = $('roundbox');
  box.innerHTML = `<h2 class="gothic">Round ${r.n}</h2>` + r.dice.map((d, k) => {
    const p = g!.players[d.player];
    return `<div class="row"><div class="av">${avatarSvg(p.color, p.name)}</div><span class="gothic">${esc(p.name)}</span>`
      + d.values.map((v, j) => dieHtml('movement', v, p.color, '', `data-roll="${t0 + k * 120 + j * 40}"`)).join('')
      + (d.player === r.roller ? `<em>dado strada</em>${dieHtml('road', r.roadDie, undefined, 'road', `data-roll="${t0 + 500}"`)}` : '') + '</div>';
  }).join('');
  box.classList.add('show');
  window.setTimeout(() => box.classList.remove('show'), 2500);
}

/** Why an ability keeps a car from being shot, said over the car during the shoot step. */
const BLOCK_WHY: Record<string, string> = {
  stealth_technology: 'non puoi sparare a questa auto finché c’è un altro bersaglio!',
  smoke_screen: 'non puoi sparare a questa auto dalla casella dietro di lei!',
};
/** What a target's card does to a shot at it, recalled while aiming. */
const TARGET_WARN: Record<string, string> = {
  armor_plating: 'il risultato “qualsiasi” del dado sparo contro di lei manca.',
};
let blockTips: { el: HTMLElement; at: THREE.Vector3 }[] = [];
/** Keeps the "you cannot shoot" bubbles over their cars as the view moves. */
function placeBlockTips(): void {
  for (const t of blockTips) {
    const p = t.at.clone().setY(TILE_T + 0.6).project(camera);
    t.el.style.left = `${(p.x + 1) / 2 * innerWidth}px`;
    t.el.style.top = `${(1 - p.y) / 2 * innerHeight}px`;
  }
}

/** Marks a car an ability keeps from being shot: red glow, red rim on its space, a bubble saying why. */
function markBlocked(b: Blocked): void {
  const obj = carObjs.get(b.carId);
  if (obj) obj.userData.glow = { color: '#ff3b30', strength: 0.85 };
  const slot = Math.floor(b.pos.c / TILE_COLS), rc = b.pos.c - slot * TILE_COLS;
  const rim = new THREE.Mesh(spaceRimGeometry(b.pos.r, rc, TILE_W, TILE_H, 0.97, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 1, depthWrite: false, toneMapped: false }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(BOARD_X0 + slot * PITCH_W + (GRID.frameW / 2) * KX, TILE_T + HAZ_SIZE.thickness + 0.02, 0);
  rim.renderOrder = 10;
  markerGroup.add(rim);
  const el = document.createElement('div');
  el.className = 'blocktip';
  el.innerHTML = `<b>${esc(upgradeName(b.because))}</b>${esc(BLOCK_WHY[b.because] ?? 'non puoi sparare a questa auto')}`;
  $('fx').append(el);
  blockTips.push({ el, at: world(b.pos) });
}

function drawMarkers(): void {
  markerGroup.clear();
  markers = [];
  for (const t of blockTips) t.el.remove();
  blockTips = [];
  // (The car that is moving glows anyway: see applyGlow.)
  for (const o of carObjs.values()) o.userData.glow = null;
  if (!g || !decision || playing) return;
  const d = decision;
  // Assigning: the cars that can still take a die glow in the player's colour; with a die in
  // hand, only those that accept it, and they can be dropped on.
  if (d.kind === 'assign') {
    const p = g.players[d.player];
    const free = new Set(p.dice.filter((_, i) => !p.used[i]));
    const v = selDie === null ? null : p.dice[selDie];
    const done = new Set<string>();
    d.options.forEach((o, i) => {
      if (!o.carId || done.has(o.carId)) return;
      if (v === null ? !free.has(o.dieValue!) : o.dieValue !== v) return;
      done.add(o.carId);
      const obj = carObjs.get(o.carId);
      if (!obj) return;
      obj.userData.glow = { color: p.color, strength: v === null ? 0.35 : 0.75 };
      if (v === null) return;
      // An invisible marker: it only makes the car a drop target.
      const at = (obj.userData.target as THREE.Vector3).clone();
      const mesh = new THREE.Mesh(carRingGeo, new THREE.MeshBasicMaterial({ visible: false }));
      markerGroup.add(mesh);
      markers.push({ mesh, option: i, at });
    });
    return;
  }
  // Shooting: a car an ability keeps from being a target glows red and says why (Stealth
  // Technology, Smoke Screen), so the player sees the other car's power at work.
  for (const b of d.blocked ?? []) markBlocked(b);
  // A target that can be shot but defends itself: a reminder, in amber, of what its card does.
  if (d.kind === 'shoot') {
    for (const o of d.options) {
      const v = o.carId ? g.vehicles.find(x => x.id === o.carId) : undefined;
      if (!v?.upgrade || v.status !== 'ok' || !TARGET_WARN[v.upgrade] || !v.pos) continue;
      const el = document.createElement('div');
      el.className = 'blocktip warn';
      el.innerHTML = `<b>${esc(upgradeName(v.upgrade))}</b>${esc(TARGET_WARN[v.upgrade])}`;
      $('fx').append(el);
      blockTips.push({ el, at: world(v.pos) });
    }
  }
  if (!['step', 'airstrike', 'shoot', 'peek', 'peekResult', 'plow', 'rollCage', 'dispense', 'radar'].includes(d.kind)) return;
  d.options.forEach((o, i) => {
    if (!o.pos) return;
    const at = world(o.pos);
    if (markers.some(m => m.at.distanceTo(at) < 0.05)) return;
    const color = o.danger ? 0xff3b30 : d.kind === 'shoot' ? 0xffd23a : d.kind === 'airstrike' ? 0x7fd4ff : 0x4cff7a;
    const onTable = o.pos.r >= 0 && o.pos.r < ROWS && o.pos.c >= 0 && o.pos.c < COLS;
    let mesh: THREE.Mesh;
    if (onTable) {
      // A coloured border around the space, the terrain left visible inside (asked by the user,
      // 2026-11-16). The space itself is an invisible pick target. Not tone mapped, so the
      // colour stays vivid under the table's lighting.
      const slot = Math.floor(o.pos.c / TILE_COLS);
      const rc = o.pos.c - slot * TILE_COLS;
      const glow = (opacity: number, additive: boolean): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, toneMapped: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}),
      });
      mesh = new THREE.Mesh(spaceGeometry(o.pos.r, rc, TILE_W, TILE_H, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
      const rim = new THREE.Mesh(spaceRimGeometry(o.pos.r, rc, TILE_W, TILE_H, 0.97, 0.8), glow(1, false));
      rim.position.z = 0.002;
      const halo = new THREE.Mesh(spaceRimGeometry(o.pos.r, rc, TILE_W, TILE_H, 1.08, 0.97), glow(0.35, true));
      mesh.add(rim, halo);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(BOARD_X0 + slot * PITCH_W + (GRID.frameW / 2) * KX, TILE_T + HAZ_SIZE.thickness + 0.02, 0);
    } else {
      mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(at).setY(TILE_T + 0.1);
    }
    mesh.renderOrder = 10;
    markerGroup.add(mesh);
    markers.push({ mesh, option: i, at });
  });
}

// ---------------------------------------------------------------- drawing: 2D

function dieHtml(kind: string, value: number | string, color: string | undefined, cls = '', attrs = ''): string {
  // The SVG keeps the layout and takes the clicks; the HUD overlay draws a 3D die on top of it.
  return dieSvg({ kind, value, color, forward: 'right' }, `class="${cls}" data-die3d="${kind}|${value}|${color ?? ''}" ${attrs}`);
}

function logLine(e: LogEntry): string {
  const dice = (e.dice ?? []).map(d => `<img src="${dataUrl(dieSvg({ kind: d.die, value: d.value, forward: 'right' }))}" alt="">`).join('');
  return `<div class="${e.kind}">${dice}${esc(e.text)}</div>`;
}

let winShown = false;
let toastTimer = 0;
/** The running log over the table: removed at the user's request (2026-11-16); the Log button keeps the chronicle. */
const SHOW_TOAST = false;
const toastLines: string[] = [];
/** Shows a rules line that matters (shots, damage, hazards, eliminations, turns) over the map. */
function toastLine(f: Frame): void {
  if (!f.text || !SHOW_TOAST) return;
  const important = f.logKind !== 'info' || /Pericolo|danno|sparo|bersaglio|armi|dado strada|COLPITO|nuova tessera|traguardo/i.test(f.text);
  if (!important) return;
  toastLines.push(`<div class="${f.logKind}">${esc(f.text)}</div>`);
  while (toastLines.length > 4) toastLines.shift();
  const el = $('toast');
  el.innerHTML = toastLines.join('');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.classList.remove('show'); toastLines.length = 0; }, 3200);
}
let lastDecider = -1;
/**
 * Whenever a different player must decide (a new turn, or a slam reroll owed to the larger car's
 * owner), the prompt in the bar flashes in their colour; in hot seat it also says to pass the
 * device. No box over the table (asked by the user, 2026-11-16).
 */
let passUntil = 0;
function handoff(d: Decision): void {
  if (!g || d.player === lastDecider) return;
  lastDecider = d.player;
  const el = $('prompt');
  el.classList.remove('pass');
  void el.offsetWidth; // restart the animation
  el.classList.add('pass');
  passUntil = performance.now() + (d.kind === 'slamReroll' ? 2600 : 1800);
}

function drawHud(): void {
  if (!g) return;
  const me = viewer()!;
  // While the last choice plays out, nothing can be chosen.
  const d = playing ? null : decision;
  if (d) handoff(d);
  // A new kind of choice forgets a strip opened or closed by hand.

  // Top: the round, then a bubble per player in seating order (the one on turn glows), the road die.
  document.documentElement.style.setProperty('--who', me.color);
  $('roundinfo').innerHTML = `<small>ROUND</small><b class="gothic">${g.round}</b><span>${g.finalTile ? 'ultima tessera' : `tessera ${g.tilesPlaced}`}</span>`;
  // A bubble per player in seating order (the one on turn glows): avatar and name; under them the
  // dice (available and used); under those the cars with their state. Pointing at a car shows it.
  $('players').innerHTML = g.players.map(p => {
    const turn = p.id === g!.current && g!.winner === null, decides = !!d && d.player === p.id;
    const cars = g!.vehicles.filter(v => v.owner === p.id).sort((a, b) => 'SML'.indexOf(a.size) - 'SML'.indexOf(b.size)).map(v => {
      const state = v.status === 'elim' ? 'eliminata' : v.status === 'inop' ? 'fuori uso' : v.inStart ? 'in partenza' : 'in strada';
      return `<span class="car ${v.status === 'ok' ? '' : v.status}" data-vid="${v.id}"><b>${v.size}</b><small>${state}</small>${v.damage.length ? `<em>${'<i></i>'.repeat(v.damage.length)}</em>` : ''}${v.upgrade ? '<u>★</u>' : ''}</span>`;
    }).join('');
    const pl = leaderOf(p);
    return `<div class="bubble pl ${turn ? 'turn' : ''} ${decides ? 'decides' : ''} ${p.out ? 'out' : ''}" style="--c:${p.color}">
      <div class="av">${pl && PORTRAITS[pl.id] ? `<img src="${PORTRAITS[pl.id]}" alt="${esc(pl.name)}">` : avatarSvg(p.color, p.name)}</div>
      <div class="nm gothic">${esc(p.name)}${pl ? `<small>${esc(pl.name)}${p.tokens ? ` ${'★'.repeat(p.tokens)}` : ''}</small>` : ''}</div>
      <div class="dice-row">${p.dice.length ? p.dice.map((n, i) => dieHtml('movement', n, p.color, p.used[i] ? 'used' : '')).join('') : '<span class="none">nessun dado</span>'}</div>
      <div class="cars">${cars}</div></div>`;
  }).join('');
  $('roaddie').innerHTML = g.roadDie ? dieHtml('road', g.roadDie, undefined) : '';
  $('roaddie').parentElement!.classList.toggle('glow', d?.kind === 'roadDie');

  // Bar: prompt, contextual actions, last log line.
  const name = d ? g.players[d.player].name : '';
  const text = d ? d.prompt.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `), '') : g.winner !== null ? 'Partita finita.' : '';
  $('prompt').innerHTML = d ? `<b style="color:${g.players[d.player].color}">${esc(name)}</b>${esc(text)}` : playing ? '<i>…</i>' : esc(text);
  // A few words per kind of choice: the table and the boards show the rest.
  const SHORT: Partial<Record<Decision['kind'], string>> = {
    assign: 'assegna un dado', command: 'comando?', airstrike: 'piazza l’elicottero', repair: 'quale auto ripari?',
    roadDie: `dado strada: +${g.roadDie}?`, slamReroll: 'slam: ritiri i dadi?', shoot: 'scegli il bersaglio',
    leader: 'scegli il caposquadra', token: 'segnalino comando?', shootReroll: 'ritiri il dado sparo?', dirReroll: 'ritiri il dado direzione?',
    peek: 'guarda un pericolo coperto',
  };
  if (d && SHORT[d.kind]) $('prompt').innerHTML = `<b style="color:${g.players[d.player].color}">${esc(name)}</b>${esc(SHORT[d.kind]!)}`;
  if (d && !net && performance.now() < passUntil) $('prompt').insertAdjacentHTML('afterbegin', '<span class="passing">Passa il dispositivo ·</span>');
  // Online, while somebody else decides: say who the table is waiting for.
  if (net && pending && pending.player !== mySeat()) lastDecider = -1; // my next decision is announced again
  if (net && !d && !playing && pending) {
    const w = g.players[pending.player];
    $('prompt').innerHTML = `<b style="color:${w.color}">${esc(w.name)}</b>${pending.player === mySeat() ? 'invio…' : 'sta decidendo…'}`;
  }
  ($('skip') as HTMLButtonElement).style.display = playing ? '' : 'none';
  // The choices float by the car they are about (see placeActions), not in the bar.
  const actions = $('actions');
  actions.innerHTML = '';
  if (d) {
    const btn = (i: number, label: string, cls = ''): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = d.options[i].label;
      b.className = cls || (d.options[i].danger ? 'danger' : '');
      b.onclick = () => choose(i);
      actions.appendChild(b);
    };
    if (d.kind === 'command' || d.kind === 'token') { /* on the command board's tab: see drawDock */ }
    else if (d.kind === 'shoot') btn(0, 'Non sparare', 'quiet'); // the targets are lit on the table
    else if (d.kind === 'roadDie') { btn(1, `+${g.roadDie} movimenti`, 'road'); btn(0, 'Fermati', 'quiet'); }
    else if (d.kind === 'slamReroll') { btn(0, 'Tieni', 'quiet'); btn(1, 'Ritira i dadi'); }
    else if (d.kind === 'shootReroll' || d.kind === 'dirReroll') { btn(0, 'Tieni', 'quiet'); btn(1, 'Ritira il dado'); }
    // Choices on the table with a way out: the spaces are lit, the button says no.
    else if (['plow', 'rollCage', 'dispense', 'radar'].includes(d.kind)) btn(0, d.options[0].label, d.options[0].danger ? 'danger' : 'quiet');
    // Skull Shift Knob: the one step choice that is not a space.
    else if (d.kind === 'step') d.options.forEach((o, i) => { if (!o.pos) btn(i, o.label, 'quiet'); });
    else if (!['assign', 'airstrike', 'repair', 'leader', 'peek', 'draft', 'upgradeAssign'].includes(d.kind)) d.options.forEach((o, i) => btn(i, o.label));
  }
  // Choppe Shoppe setup: the upgrade cards to draft, then one for each car.
  if (d && d.kind === 'draft') {
    const who = g.players[d.player];
    const el = $('leaderpick');
    el.innerHTML = `<h2 class="gothic" style="color:${who.color}">${esc(d.prompt)}</h2><div class="hand">`
      + d.options.map((o, i) => `<button class="pickcard" data-i="${i}">${cardHtml(o.upgrade!, who.color)}</button>`).join('') + '</div>';
    el.querySelectorAll<HTMLElement>('.pickcard').forEach(b => { b.onclick = () => choose(Number(b.dataset.i)); });
  }
  // Choppe Shoppe setup: the two crew leaders dealt to the player, as cards to pick from.
  const pick = $('leaderpick');
  pick.style.display = d && ['leader', 'draft'].includes(d.kind) ? 'grid' : 'none';
  if (d?.kind === 'leader') {
    const who = g.players[d.player];
    pick.innerHTML = `<h2 class="gothic" style="color:${who.color}">${esc(who.name)}: scegli il caposquadra</h2><div class="pair">`
      + d.options.map((o, i) => {
        const l = leaders().find(x => x.id === o.leader)!;
        const [pn, pd] = POWER_INFO[l.power] ?? [l.power, ''];
        return `<button class="leader" data-i="${i}" style="--c:${who.color}"><b class="gothic">${esc(l.name)}</b><small>${esc(l.title)}</small>`
          + `<p><i>${esc(pn)}</i> ${esc(pd)}</p><ul>`
          + l.commands.map(s => `<li><em>${esc(slotText(s))}</em><span><b>${esc(commandName(s.id))}</b> ${esc((CMD_LINES[s.id] ?? []).join(' '))}</span></li>`).join('')
          + `</ul><span class="stars">${l.tokens ? `${'★'.repeat(l.tokens)} ${l.tokens === 1 ? 'segnalino comando' : 'segnalini comando'}` : 'nessun segnalino comando'}</span></button>`;
      }).join('') + '</div>';
    pick.querySelectorAll<HTMLElement>('.leader').forEach(b => { b.onclick = () => choose(Number(b.dataset.i)); });
  }
  // The question sits with its answer: over the buttons, or alone by the car or the dice.
  const left = d?.kind === 'step' ? /(\d+) moviment/.exec(d.prompt)?.[1] : undefined;
  const ASK: Partial<Record<Decision['kind'], string>> = {
    command: 'Un dado su un comando?', roadDie: `Dado strada: +${g.roadDie}?`, slamReroll: 'Slam: ritiri i dadi?', shoot: 'Scegli il bersaglio',
    step: left ? `${left} moviment${left === '1' ? 'o' : 'i'}` : 'Muovi', airstrike: 'Scegli una casella vuota', repair: 'Scegli l’auto da riparare',
    token: `Segnalino comando? (${d ? g.players[d.player].tokens : 0})`, shootReroll: 'Mancato: ritiri il dado sparo?', dirReroll: 'Slam: ritiri la direzione?',
    peek: 'Third Eye: scegli un pericolo coperto', peekResult: d?.prompt.replace(/^Solo per [^:]+: /, 'Third Eye: ') ?? '', transfer: d?.prompt.replace(/^[^:]+: /, '') ?? '',
  };
  // The upgrades' own questions are asked in full: they name the card.
  const asked = d && (d.kind === 'command' || d.kind === 'token') ? '' : d ? ASK[d.kind] ?? (['plow', 'rollCage', 'dispense', 'radar', 'swap', 'pickDamage', 'redButton'].includes(d.kind) ? d.prompt.replace(/^[^:]+: /, '') : '') : '';
  if (asked) actions.insertAdjacentHTML('afterbegin', `<span class="q">${esc(asked)}</span>`);
  actions.classList.toggle('only', !actions.querySelector('button'));
  actions.dataset.car = g.activeCar ?? '';
  actions.dataset.anchor = d?.kind === 'command' || d?.kind === 'token' ? 'dice' : g.activeCar ? 'car' : 'bar';
  if ($('drawer').style.display === 'block') drawDrawer();

  // The four steps of a turn (rulebook p. 8), the current one lit.
  const stepOf: Record<string, number> = { assign: 1, command: 2, airstrike: 2, repair: 2, step: 3, roadDie: 3, slamReroll: 3, shoot: 4 };
  const cur = d ? stepOf[d.kind] ?? 0 : 0;
  $('steps').innerHTML = ['Assegna', 'Comando', 'Movimento', 'Spara'].map((n, i) => {
    const locked = i === 3 && g!.round <= 1;
    return `<div class="st ${i + 1 === cur ? 'on' : i + 1 < cur ? 'done' : ''} ${locked ? 'off' : ''}"><b>${i + 1 < cur ? '✓' : i + 1}</b><span>${n}</span>${locked ? '<small>dal 2° round</small>' : ''}</div>`;
  }).join('');

  // Bottom: my dice, command board, dashboards, chopper.
  const hot = hotZones();
  const mine = d && d.player === me.id;
  syncTableDice(me, !!mine);
  const lead = leaderOf(me);
  const cmds = boardCommands(me);
  const cmdArt = {
    color: me.color, used: me.command,
    drop: d?.kind === 'token' && mine ? d.options.filter(o => o.command).map(o => o.command!) : [...hot].filter(z => z.startsWith('cmd:')).map(z => z.slice(4)),
    tokenOn: Object.entries(me.slots).filter(([, v]) => v === 'token').map(([k]) => k), keepOpen: me.tokens > 0,
    ...(cmds ? { commands: cmds } : {}),
    ...(lead ? { leader: {
      name: lead.name, title: lead.title, power: POWER_INFO[lead.power]?.[0] ?? lead.power, powerText: POWER_INFO[lead.power]?.[1] ?? '',
      tokens: me.tokens, ...(PORTRAITS[lead.id] ? { portrait: PORTRAITS[lead.id] } : {}),
    } } : {}),
  };
  const pickIds = new Set(d?.kind === 'repair' || (d?.kind === 'upgradeAssign' && mine) ? d.options.map(o => o.carId) : []);
  const dashArt = g.vehicles.filter(v => v.owner === me.id).map(v => ({
    carId: v.id, size: v.size, color: me.color, status: v.status, placed: v.placed, damage: v.damage.length,
    dropMove: hot.has(`move:${v.id}`), dropCoast: hot.has(`coast:${v.id}`), pick: pickIds.has(v.id),
    label: v.status === 'elim' ? '' : v.inStart ? 'IN PARTENZA' : '',
    // Ms. Betty's large car may carry two upgrades: one card naming both.
    ...(v.upgrade && v.status !== 'elim' ? { upgrade: {
      name: v.upgrade2 ? `${upgradeName(v.upgrade)} + ${upgradeName(v.upgrade2)}` : upgradeName(v.upgrade),
      text: [v.upgrade, v.upgrade2].filter((x): x is string => !!x).map(x => UPGRADE_INFO[x] ?? '').join(' · '),
    } } : {}),
  }));
  // With crew leaders the strip is wider (the leader's panel on its left): it keeps that size all game.
  const tall = g.players.some(p => leaderOf(p)); // class "tall": the strip has the leader's panel
  if (tall !== document.body.classList.contains('tall')) { document.body.classList.toggle('tall', tall); fit(); }
  drawHand(d);
  // One drawing, laid out as in the rulebook; without the owner's drawing, the boards side by side.
  $('strip').innerHTML = playerStripSvg(cmdArt, dashArt) ?? `<div class="loose">${commandBoardSvg(cmdArt)}${dashArt.map(a => dashboardSvg(a)).join('')}</div>`;

  // Clicks on boards: drop the selected die, or pick a car to repair.
  for (const el of document.querySelectorAll<SVGElement>('#bottom [data-drop]')) {
    if (hot.has(el.dataset.drop!)) el.classList.add('hotzone');
    // A command token goes on the slot clicked.
    const tokenAt = d?.kind === 'token' && mine ? d.options.findIndex(o => o.command && `cmd:${o.command}` === el.dataset.drop) : -1;
    if (tokenAt > 0) { el.classList.add('hotzone'); el.addEventListener('click', () => choose(tokenAt)); continue; }
    el.addEventListener('click', () => {
      // No die selected: use the first free die that fits this slot.
      const pick = selDie ?? me.dice.findIndex((_, i) => !me.used[i] && zoneOption(el.dataset.drop!, i) >= 0);
      if (pick !== null && pick >= 0) choose(zoneOption(el.dataset.drop!, pick));
    });
  }
  if (d?.kind === 'repair') {
    for (const el of document.querySelectorAll<SVGElement>('#strip [data-car]')) {
      const i = d.options.findIndex(o => o.carId === el.dataset.car);
      if (i >= 0) { el.classList.add('hotzone'); el.addEventListener('click', () => choose(i)); }
    }
  }
  chaseButtons();
  // Upgrade cards: a car takes the selected card (the cards can also be dragged onto it).
  if (d?.kind === 'upgradeAssign') {
    for (const el of document.querySelectorAll<SVGElement>('#strip [data-car]')) {
      if (!d.options.some(o => o.carId === el.dataset.car)) continue;
      el.classList.add('hotzone');
      el.addEventListener('click', () => { if (selCard) assignCard(selCard, el.dataset.car!); });
    }
  }
  ($('undo2') as HTMLButtonElement).disabled = !!net || !saved?.choices.length || playing;
  drawDock(d, !!mine);
  ($('roomopen') as HTMLButtonElement).style.display = net ? '' : 'none';
  $('home').classList.toggle('on', !!chase);
  $('home').querySelector('small')!.textContent = chase ? 'Reimposta' : 'Vista';
  ($('replay') as HTMLButtonElement).disabled = !replayFrames?.length || playing;
  if (d?.kind === 'assign') drawMarkers();

  if (g.winner !== null && !winShown) {
    winShown = true;
    $('wintext').textContent = `${g.players[g.winner].name} vince!`;
    $('win').style.display = 'grid';
  }
}

function drawDrawer(): void {
  if (!g) return;
  const el = $('drawer');
  el.innerHTML = g.log.slice(-200).map(logLine).join('');
  el.scrollTop = el.scrollHeight;
}
$('ticker').onclick = () => {
  const el = $('drawer');
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
  if (el.style.display === 'block') drawDrawer();
};

// ---------------------------------------------------------------- the player's dice on the table
// The dice of the player the interface shows lie on the table, in a row just under the road:
// they are picked up and dragged onto a board or onto a car.

interface TableMyDie { d: Die3D; base: THREE.Vector3; q: THREE.Quaternion; glow: THREE.Mesh }
/** A soft round light, drawn under a die that can be played. */
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 18, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
let tableDice: TableMyDie[] = [];
let tableDiceKey = '';
let tableDiceState: { used: boolean[]; idle: boolean[] } = { used: [], idle: [] };

/** Where die `i` of `n` rests: centred under the road, one die and a half apart. */
function tableDieSpot(i: number, n: number): THREE.Vector3 {
  const step = DIE_W * TRAY_SCALE * 1.55;
  const cx = BOARD_X0 + PITCH_W + TILE_W / 2 - 1.6;
  return new THREE.Vector3(cx + (i - (n - 1) / 2) * step, DIE_W * TRAY_SCALE / 2, TRAY_Z);
}

/** Puts the player's dice on the table (rebuilt when the player or the values change). */
function syncTableDice(me: Player, mine: boolean): void {
  const key = me.dice.length ? `${me.id}|${me.color}|${me.dice.join(',')}` : '';
  if (key !== tableDiceKey) {
    tableDiceKey = key;
    for (const t of tableDice) { scene.remove(t.d.mesh, t.glow); (t.glow.material as THREE.Material).dispose(); for (const m of t.d.mesh.material as THREE.Material[]) m.dispose(); }
    tableDice = me.dice.map((v, i) => {
      const d = withOwnMaterials(makeDie(FACES, 'movement', DIE_W, me.color));
      d.mesh.scale.setScalar(TRAY_SCALE);
      const base = tableDieSpot(i, me.dice.length);
      // A little turned each, as dice lie when rolled; the same turn every time it is drawn.
      const q = d.orientation(Math.max(0, d.faceOf(v)), AWAY)
        .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((i * 7) % 5 - 2) * 0.09));
      d.mesh.position.copy(base);
      d.mesh.quaternion.copy(q);
      d.mesh.castShadow = true;
      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
        map: glowTex, color: 0x4cff7a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      glow.scale.setScalar(DIE_W * TRAY_SCALE * 2.6);
      glow.position.set(base.x, 0.02, base.z);
      glow.visible = false;
      scene.add(d.mesh, glow);
      return { d, base, q, glow };
    });
  }
  tableDiceState = { used: [...me.used], idle: me.dice.map((_, i) => !mine || !dieUsable(i)) };
}

/**
 * In the chase view the dice leave the table and follow the view (asked by the user): they float
 * in a row just above the boards, `dist` world units in front of the camera, drawn over everything,
 * the same size and faces as on the table in the map view, so they can still be dragged.
 */
const CHASE_DICE = { dist: 2.2, above: 56 };
/** The camera's turn in the map view, against which the dice's resting faces are set. */
const mapViewTurn = (() => {
  const c = new THREE.PerspectiveCamera();
  c.position.set(0, 1, 0.55);
  c.lookAt(0, 0, 0);
  return c.quaternion.clone().invert();
})();
/** Moves die `t` (index `i` of `n`) into the chase view's row. */
function chaseDie(t: TableMyDie, i: number, n: number): void {
  const k = CHASE_DICE.dist / fitDist; // same size on screen as on the table seen from the map view
  const step = DIE_W * TRAY_SCALE * 1.55 / (fitDist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const y = innerHeight - cssPx('--bottom') - CHASE_DICE.above;
  const ndc = new THREE.Vector3((i - (n - 1) / 2) * step, 1 - 2 * y / innerHeight, 0.5).unproject(camera);
  t.d.mesh.position.copy(camera.position).addScaledVector(ndc.sub(camera.position).normalize(), CHASE_DICE.dist);
  t.d.mesh.quaternion.copy(camera.quaternion).multiply(mapViewTurn).multiply(t.q);
  t.d.mesh.scale.setScalar(TRAY_SCALE * k);
}

/** Each frame: used dice fade, the selected die lifts and sways, the one being dragged dims. */
function animTableDice(now: number): void {
  const floating = !!chase;
  tableDice.forEach((t, i) => {
    const sel = selDie === i && !tableDiceState.used[i];
    if (floating) chaseDie(t, i, tableDice.length);
    else { t.d.mesh.position.copy(t.base); t.d.mesh.quaternion.copy(t.q); t.d.mesh.scale.setScalar(TRAY_SCALE); }
    t.d.mesh.renderOrder = floating ? 20 : 0;
    t.d.mesh.castShadow = !floating;
    if (sel) {
      const lift = DIE_W * TRAY_SCALE * (0.45 + 0.08 * Math.sin(now * 5)) * (floating ? CHASE_DICE.dist / fitDist : 1);
      t.d.mesh.position.addScaledVector(floating ? new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion) : new THREE.Vector3(0, 1, 0), lift);
      t.d.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(now * 3) * 0.3));
    }
    // The dice still to play glow, pulsing, so the player sees they must be played (on the table only).
    const live = !tableDiceState.used[i] && !tableDiceState.idle[i];
    t.glow.visible = live && !floating;
    if (live) (t.glow.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(now * 4 + i * 0.6);
    const fade = tableDiceState.used[i] ? 0.2 : drag?.moved && drag.die === i ? 0.35 : 1;
    for (const m of t.d.mesh.material as THREE.MeshStandardMaterial[]) { m.transparent = fade < 1; m.opacity = fade; m.depthTest = !floating; }
  });
}

/** The index of the player's die under the pointer, or -1. */
function tableDieAt(e: PointerEvent): number {
  if (!tableDice.length) return -1;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(tableDice.map(t => t.d.mesh), false)[0];
  return hit ? tableDice.findIndex(t => t.d.mesh === hit.object) : -1;
}

/** The dice row on screen (for placing the choices beside it), or null with no dice. */
function tableDiceRect(): { left: number; right: number; top: number; bottom: number } | null {
  if (!tableDice.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const half = DIE_W * TRAY_SCALE * 0.6;
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (const d of tableDice) for (const dx of [-half, half]) for (const dz of [-half, half]) {
    const q = d.base.clone().add(new THREE.Vector3(dx, 0, dz)).project(camera);
    const x = rect.left + (q.x * 0.5 + 0.5) * rect.width, y = rect.top + (-q.y * 0.5 + 0.5) * rect.height;
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  return { left: l, right: r, top: t, bottom: b };
}

// ---------------------------------------------------------------- upgrade cards in hand
// Drafted, the cards are shown as cards; to put one on a car, drag it onto the car's dashboard
// (or onto the car on the table), or click it and then the car.

/** An upgrade card: name, a space for the art (to come), what it does. */
function cardHtml(id: string, color: string, attrs = ''): string {
  return `<div class="ucard" style="--c:${color}" ${attrs}><b class="gothic">${esc(upgradeName(id))}</b>`
    + `<div class="art"></div><p>${esc(UPGRADE_INFO[id] ?? '')}</p></div>`;
}

let selCard: string | null = null;
/** The cards still to place, over the table just above the strip. */
function drawHand(d: Decision | null): void {
  const el = $('hand');
  if (!g || !d || d.kind !== 'upgradeAssign') { el.innerHTML = ''; selCard = null; return; }
  const who = g.players[d.player];
  const ids = [...new Set(d.options.map(o => o.upgrade!))];
  if (selCard && !ids.includes(selCard)) selCard = null;
  el.innerHTML = ids.map(id => cardHtml(id, who.color, `data-up="${id}"${selCard === id ? ' data-sel="1"' : ''}`)).join('');
}

/** Puts card `id` on car `carId`, when the rules allow it. */
function assignCard(id: string, carId: string): boolean {
  if (!decision || decision.kind !== 'upgradeAssign') return false;
  const i = decision.options.findIndex(o => o.upgrade === id && o.carId === carId);
  if (i < 0) return false;
  selCard = null;
  choose(i);
  return true;
}

/** The car under a point of the screen: its dashboard in the strip, or the car on the table. */
function carUnder(x: number, y: number): string | null {
  const under = document.elementFromPoint(x, y);
  const dash = under?.closest<SVGElement>('[data-car]');
  if (dash) return dash.dataset.car ?? null;
  if (under !== renderer.domElement) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObject(pickPlane)[0];
  if (!hit) return null;
  let best: string | null = null, bd = 0.8;
  for (const [id, o] of carObjs) {
    const dd = Math.hypot(o.position.x - hit.point.x, o.position.z - hit.point.z);
    if (dd < bd) { bd = dd; best = id; }
  }
  return best;
}

let cardDrag: { id: string; x: number; y: number; dx: number; dy: number; moved: boolean; el: HTMLElement | null } | null = null;
$('hand').addEventListener('pointerdown', e => {
  const card = (e.target as Element).closest<HTMLElement>('[data-up]');
  if (!card) return;
  e.preventDefault();
  const r = card.getBoundingClientRect();
  cardDrag = { id: card.dataset.up!, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, el: null };
});
addEventListener('pointermove', e => {
  if (!cardDrag) return;
  if (!cardDrag.moved && Math.hypot(e.clientX - cardDrag.x, e.clientY - cardDrag.y) < 6) return;
  if (!cardDrag.moved) {
    cardDrag.moved = true;
    const src = document.querySelector<HTMLElement>(`#hand [data-up="${cardDrag.id}"]`);
    if (src) {
      cardDrag.el = src.cloneNode(true) as HTMLElement;
      cardDrag.el.classList.add('flying');
      document.body.appendChild(cardDrag.el);
      src.style.visibility = 'hidden';
    }
    selCard = cardDrag.id;
  }
  if (cardDrag.el) { cardDrag.el.style.left = `${e.clientX - cardDrag.dx}px`; cardDrag.el.style.top = `${e.clientY - cardDrag.dy}px`; }
});
addEventListener('pointerup', e => {
  if (!cardDrag) return;
  const c = cardDrag;
  cardDrag = null;
  c.el?.remove();
  if (!c.moved) { selCard = selCard === c.id ? null : c.id; drawHud(); return; } // a click: pick the card, then the car
  const car = carUnder(e.clientX, e.clientY);
  if (!car || !assignCard(c.id, car)) drawHud(); // not a car that can take it: the card goes back to the hand
});

// ---------------------------------------------------------------- input: dice drag & drop

const ghost = $('ghost');
let drag: { die: number; x: number; y: number; moved: boolean } | null = null;
// A die on the table is picked up before the camera can take the press for a pan.
document.addEventListener('pointerdown', e => {
  if (e.target !== renderer.domElement || e.button !== 0) return;
  const i = tableDieAt(e);
  if (i < 0 || !dieUsable(i)) return;
  e.stopPropagation();
  e.preventDefault();
  drag = { die: i, x: e.clientX, y: e.clientY, moved: false };
  selDie = i;
  drawHud();
}, true);
addEventListener('pointermove', e => {
  if (!drag || !g || !decision) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    const p = g.players[decision.player];
    ghost.innerHTML = dieHtml('movement', p.dice[drag.die], p.color);
    ghost.style.display = 'block';
  }
  ghost.style.left = `${e.clientX - 32}px`;
  ghost.style.top = `${e.clientY - 32}px`;
});
addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  ghost.style.display = 'none';
  if (!d.moved) return; // a click: the die stays selected, click a slot to place it
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const zone = under?.closest<SVGElement>('[data-drop]');
  let i = zone ? zoneOption(zone.dataset.drop!, d.die) : -1;
  // Dropped on a car on the table: the glowing ring under it.
  if (i < 0 && under === renderer.domElement) i = markerAt(e)?.option ?? -1;
  if (i >= 0) choose(i); else { selDie = null; drawHud(); drawMarkers(); }
});

addEventListener('keydown', e => { if (!menuOpen() && playing && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skipBeats(); } });

// ---------------------------------------------------------------- camera keys
// WASD (or arrows) slide the view over the table; Tab / Shift+Tab jump between the cars of the
// player on turn, 1 2 3 go to their small, medium and large car, F to the car that is acting.
const held = new Set<string>();
const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
};
let focusGoal: THREE.Vector3 | null = null;
let focusDist: number | null = null;
let focusIdx = -1;
function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
/** The cars (still in play) of the player the interface is showing, small to large. */
function myCars(): THREE.Object3D[] {
  const me = viewer();
  if (!g || !me) return [];
  const idx = g.players.indexOf(me);
  return g.vehicles.filter(v => v.owner === idx && v.status !== 'elim')
    .sort((a, b) => 'SML'.indexOf(a.size) - 'SML'.indexOf(b.size))
    .map(v => carObjs.get(v.id)).filter((o): o is THREE.Group => !!o);
}
/** Slides the view to `o`; with `close`, it also comes nearer, as for a look at that car. */
function focusOn(o: THREE.Object3D | undefined, close = false): void {
  if (o && close) focusDist = fitDist * 0.5;
  if (o) focusGoal = (o.userData.target as THREE.Vector3 | undefined)?.clone().setY(0) ?? o.position.clone().setY(0);
}
addEventListener('keydown', e => {
  if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || menuOpen()) return;
  const key = e.key.toLowerCase();
  if (PAN_KEYS[key]) { held.add(key); focusGoal = null; focusDist = null; e.preventDefault(); return; }
  const cars = myCars();
  if (key === 'tab') {
    e.preventDefault();
    if (!cars.length) return;
    focusIdx = (focusIdx + (e.shiftKey ? -1 : 1) + cars.length) % cars.length;
    focusOn(cars[focusIdx]);
  } else if (key === '1' || key === '2' || key === '3') {
    const me = viewer();
    const v = g && me ? g.vehicles.find(x => x.owner === g!.players.indexOf(me) && x.size === 'SML'[Number(key) - 1] && x.status !== 'elim') : undefined;
    if (v) focusOn(carObjs.get(v.id));
  } else if (key === 'v' || key === 'home') {
    homeView();
  } else if (key === 'g') {
    toggleGrid();
  } else if (key === 'r') {
    startReplay();
  } else if (key === 'f') {
    focusOn([...carObjs.values()].find(o => o.userData.active) ?? cars[0]);
  }
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());
/** Camera speed with the keys: a share of the distance to the table per second. */
const KEY_PAN = 0.9;
function moveCamera(dt: number): void {
  const move = new THREE.Vector3();
  if (held.size) {
    const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    for (const k of held) { const [x, y] = PAN_KEYS[k] ?? [0, 0]; move.addScaledVector(right, x).addScaledVector(fwd, y); }
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(camera.position.distanceTo(controls.target) * KEY_PAN * dt);
  } else if (focusGoal) {
    move.subVectors(focusGoal, controls.target).setY(0).multiplyScalar(Math.min(1, dt * 6));
    if (move.length() < 0.002) focusGoal = null;
  }
  if (move.lengthSq() > 0) { controls.target.add(move); camera.position.add(move); }
  if (focusDist !== null) {
    // Zooming toward the car: tiltView then turns the view for the new distance.
    const off = camera.position.clone().sub(controls.target), d = off.length();
    const nd = d + (focusDist - d) * Math.min(1, dt * 6);
    camera.position.copy(controls.target).addScaledVector(off.normalize(), nd);
    if (Math.abs(nd - focusDist) < 0.05) focusDist = null;
  }
}

// ---------------------------------------------------------------- input: map

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (e.button !== 0 || drag || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || !decision) return;
  const m = markerAt(e);
  if (m) choose(m.option);
});
let hovered = -1;
renderer.domElement.addEventListener('pointermove', e => {
  const m = markerAt(e);
  renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
  const i = m ? m.option : -1;
  if (i === hovered) return;
  hovered = i;
  for (const mk of markers) mk.mesh.userData.hover = mk.option === i;
  if (decision && g) {
    const nm = g.players[decision.player].name;
    $('prompt').innerHTML = `<b style="color:${g.players[decision.player].color}">${esc(nm)}</b>` +
      esc(m ? decision.options[m.option].label : decision.prompt.replace(`${nm}: `, ''));
  }
});
// ---------------------------------------------------------------- car inspection
// Pointing at a car, on the table or in a player's bubble, shows its card: owner, state, damage
// and its special ability (the upgrade card, Choppe Shoppe).

const SIZE_NAME: Record<string, string> = { S: 'piccola', M: 'media', L: 'grande' };
/** The card of a car, as HTML. */
function carTipHtml(v: Vehicle): string {
  const owner = v.owner !== null && g ? g.players[v.owner] : null;
  const title = v.isWreck ? 'Relitto' : `Auto ${SIZE_NAME[v.size]}${owner ? ` di ${esc(owner.name)}` : ''}`;
  const state = v.status === 'elim' ? 'Eliminata' : v.status === 'inop' ? 'Fuori uso' : v.inStart ? 'In partenza' : 'In strada';
  const hidden = v.upgrade === 'onboard_computer' || v.upgrade2 === 'onboard_computer';
  const dmg = v.damage.length
    ? `<ul>${v.damage.map(t => {
      if (hidden) return '<li>Segnalino coperto</li>';
      // An ongoing effect card (Carnage at Devil's Run) under the token: its name and text.
      const card = t.card ? (CARNAGE.ongoing_effects as { id: string; name: string; text: string }[]).find(c => c.id === t.card) : undefined;
      if (card) return `<li><b>${esc(card.name)}</b> — ${esc(card.text)}</li>`;
      const [n, does] = DAMAGE_INFO[t.type] ?? [t.type, ''];
      return `<li><b>${esc(n)}</b>${does ? ` — ${esc(does)}` : ''}</li>`;
    }).join('')}</ul>`
    : '<p>Nessun danno.</p>';
  const ups = [v.upgrade, v.upgrade2].filter((x): x is string => !!x);
  const ability = ups.length ? ups.map(u => `<p><b>${esc(upgradeName(u))}</b>: ${esc(UPGRADE_INFO[u] ?? '')}${v.status !== 'ok' ? ' <i>(non attiva: auto fuori uso)</i>' : ''}</p>`).join('') : '<p>Nessuna abilità speciale.</p>';
  return `<h4>${title}</h4><span class="state">${state} · ${v.damage.length} ${v.damage.length === 1 ? 'danno' : 'danni'}</span>`
    + `<h5>Danni</h5>${dmg}<h5>Abilità speciale</h5>${ability}`;
}
let tipFor: string | null = null;
/** Shows the card of car `id` by the pointer at (x, y), or hides it (null). */
function showCarTip(id: string | null, x = 0, y = 0): void {
  const el = $('cartip');
  const v = id && g ? g.vehicles.find(z => z.id === id) : undefined;
  if (!v) { el.classList.remove('show'); tipFor = null; return; }
  if (tipFor !== id) {
    tipFor = id;
    el.style.setProperty('--c', v.owner !== null && g ? g.players[v.owner].color : '#9a8f84');
    el.innerHTML = carTipHtml(v);
  }
  el.classList.add('show');
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = `${Math.min(innerWidth - w - 8, x + 16)}px`;
  el.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, y + 16))}px`;
}
$('players').addEventListener('pointermove', e => {
  const car = (e.target as HTMLElement).closest<HTMLElement>('.car[data-vid]');
  showCarTip(car?.dataset.vid ?? null, e.clientX, e.clientY);
});
$('players').addEventListener('pointerleave', () => showCarTip(null));
/** The car under the pointer on the table, or null. */
function carAt(e: PointerEvent): string | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  let best: string | null = null, bd = Infinity;
  for (const [id, o] of carObjs) {
    if (!o.visible) continue;
    const hit = ray.intersectObject(o, true)[0];
    if (hit && hit.distance < bd) { bd = hit.distance; best = id; }
  }
  return best;
}
let tipAt = 0;
renderer.domElement.addEventListener('pointermove', e => {
  if (e.buttons || drag) { showCarTip(null); return; }
  const t = performance.now();
  if (t - tipAt < 60) return; // a ray against every car is not free: a few times a second is enough
  tipAt = t;
  showCarTip(carAt(e), e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerleave', () => showCarTip(null));

function markerAt(e: PointerEvent): Marker | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObject(pickPlane)[0];
  if (!hit) return null;
  let best: Marker | null = null, bd = 0.75;
  for (const m of markers) {
    const dd = Math.hypot(m.at.x - hit.point.x, m.at.z - hit.point.z);
    if (dd < bd) { bd = dd; best = m; }
  }
  return best;
}

// ---------------------------------------------------------------- setup

const crewSelects: HTMLSelectElement[] = [];
for (let i = 0; i < 4; i++) {
  const sel = document.createElement('select');
  sel.innerHTML = CAT.crews.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  sel.value = CAT.crews[i].id;
  crewSelects.push(sel);
  const name = $(`n${i}`) as HTMLInputElement;
  name.value = CAT.crews[i].name;
  name.after(sel);
}
/**
 * Shows the rows for the number of players and keeps every colour to one player: a colour taken
 * by another row cannot be picked; a row that appears with a taken colour gets the first free one.
 */
function syncNames(): void {
  const n = Number(($('np') as HTMLSelectElement).value);
  for (let i = 0; i < 4; i++) {
    ($(`n${i}`) as HTMLInputElement).style.display = i < n ? '' : 'none';
    crewSelects[i].style.display = i < n ? '' : 'none';
  }
  for (let i = 0; i < n; i++) {
    const before = crewSelects.slice(0, i).map(x => x.value);
    if (before.includes(crewSelects[i].value)) setCrew(i, CAT.crews.find(c => !before.includes(c.id) && !crewSelects.slice(i + 1, n).some(x => x.value === c.id))!.id);
  }
  for (let i = 0; i < 4; i++) {
    const taken = new Set(crewSelects.slice(0, n).filter((_, j) => j !== i).map(x => x.value));
    for (const o of crewSelects[i].options) o.disabled = taken.has(o.value);
  }
}
/** Gives row `i` crew `id`; a name still equal to the old colour's name follows the new colour. */
function setCrew(i: number, id: string): void {
  const sel = crewSelects[i], name = $(`n${i}`) as HTMLInputElement;
  const old = CAT.crews.find(c => c.id === sel.value);
  sel.value = id;
  if (!name.value.trim() || name.value === old?.name) name.value = CAT.crews.find(c => c.id === id)!.name;
}
crewSelects.forEach((sel, i) => {
  let prev = sel.value;
  sel.addEventListener('change', () => { const now = sel.value; sel.value = prev; setCrew(i, now); prev = now; syncNames(); });
  sel.addEventListener('focus', () => { prev = sel.value; });
});
$('np').onchange = syncNames;
syncNames();

// ---------------------------------------------------------------- first screen
// A menu of three choices (hot seat, create online, join online), each opening its pane.

type Pane = 'pMain' | 'pHot' | 'pCreate' | 'pJoin';
function showPane(id: Pane): void {
  for (const el of document.querySelectorAll<HTMLElement>('#setup .pane')) el.classList.toggle('on', el.id === id);
  $('oerr').textContent = '';
  const resumable = !!g && g.winner === null && !net;
  $('mResume').style.display = id === 'pMain' && resumable ? '' : 'none';
  if (id === 'pCreate') ($('oname') as HTMLInputElement).focus();
  if (id === 'pJoin') (($('jname') as HTMLInputElement).value ? $('ocode') : $('jname')).focus();
}
/** Opens the first screen on `pane` (the menu by default). */
/** While a menu covers the game, the game's controls take no focus or clicks (Tab stays in the menu). */
function syncInert(): void {
  const covered = menuOpen();
  for (const el of document.body.children) {
    if (el.id === 'setup' || el.id === 'lobby' || el.tagName === 'SCRIPT') continue;
    (el as HTMLElement).inert = covered;
  }
}
new MutationObserver(syncInert).observe($('setup'), { attributes: true, attributeFilter: ['style'] });
new MutationObserver(syncInert).observe($('lobby'), { attributes: true, attributeFilter: ['style'] });
function openSetup(pane: Pane = 'pMain'): void {
  closePops();
  $('setup').style.display = 'grid';
  showPane(pane);
}
$('mHot').onclick = () => showPane('pHot');
$('mCreate').onclick = () => showPane('pCreate');
$('mJoin').onclick = () => showPane('pJoin');
$('mResume').onclick = () => { $('setup').style.display = 'none'; render(); };
for (const b of document.querySelectorAll<HTMLElement>('#setup [data-back]')) b.onclick = () => showPane('pMain');
/** Takes the pieces of the last match off the table, before a new one is set up. */
function clearTable(): void {
  for (const o of carObjs.values()) scene.remove(o);
  carObjs.clear();
  for (const id of [...smokes.keys()]) smokeOff(id);
  for (const o of chopperObjs.values()) scene.remove(o);
  chopperObjs.clear();
  winShown = false;
  $('win').style.display = 'none';
}
$('undo2').onclick = () => undo();
// Ctrl+Z (Cmd+Z on a Mac): take the last choice back, in hot seat, outside text fields and menus.
addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey || typing(e) || menuOpen()) return;
  e.preventDefault();
  if (playing) skipBeats();
  undo();
});
/** Online, "new game" is the host's call, from the room's card. */
function newGameScreen(): void { if (net) { net.lobbyOpen = true; drawLobby(); } else openSetup(); }
$('newgame').onclick = () => { closePops(); newGameScreen(); };
$('roomopen').onclick = () => { closePops(); if (net) { net.lobbyOpen = true; drawLobby(); } };
$('quit').onclick = () => {
  closePops();
  if (net) { exitRoom(); return; } // the seat is kept: the invite link brings this player back
  openSetup(); // the game stays: "Torna alla partita" resumes it
};
$('again').onclick = () => { $('win').style.display = 'none'; if (net) { net.lobbyOpen = true; drawLobby(); } else openSetup(); };
$('close').onclick = () => { $('win').style.display = 'none'; };
$('start').onclick = () => {
  const n = Number(($('np') as HTMLSelectElement).value);
  const crews = crewSelects.slice(0, n).map(s => s.value);
  if (new Set(crews).size !== crews.length) { alert('Ogni giocatore deve avere un colore diverso.'); return; }
  const seed = newSeed();
  if (!seed.ok) { alert('Il browser non fornisce numeri casuali sicuri: impossibile iniziare.'); return; }
  const players = crews.map((crew, i) => {
    const c = CAT.crews.find(x => x.id === crew)!;
    return { name: ($(`n${i}`) as HTMLInputElement).value.trim() || c.name, color: c.color, crew };
  });
  clearTable();
  $('setup').style.display = 'none';
  const leaders = ($('leaders') as HTMLInputElement).checked, cards = ($('upgrades') as HTMLInputElement).checked;
  const carnage = ($('carnage') as HTMLInputElement).checked;
  startGame({ setup: { seed: seed.value, players, startSide: ($('side') as HTMLSelectElement).value as 'a' | 'b', ...(leaders ? { leaders } : {}), ...(cards ? { upgrades: cards } : {}), ...(carnage ? { carnage } : {}) }, choices: [] });
};

// ---------------------------------------------------------------- online
// A room on a shared store (src/net/room.ts): the host's browser is the referee. Every device
// replays the room's log of choices on its own copy of the rules; a guest's click becomes an
// intent that the host checks and appends. The room stays open until the host closes it.

const NAME_KEY = 'trv-name';
const CREW_IDS = CAT.crews.map(c => c.id);
const crewColor = (crew: string): string => CAT.crews.find(c => c.id === crew)?.color ?? '#888';
const randomBytes = (bytes: Uint8Array): Uint8Array => { crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>); return bytes; };

/** Where rooms live: the Firebase project, or (for checks) `?net=local` / `?net=emulator`. Null: online is off. */
function netMode(): 'firebase' | 'local' | 'emulator' | null {
  const q = new URLSearchParams(location.search).get('net');
  if (q === 'local' || q === 'emulator') return q;
  return FIREBASE_CONFIG ? 'firebase' : null;
}
let storePromise: Promise<RoomStore> | null = null;
function openStore(): Promise<RoomStore> {
  storePromise ??= (async (): Promise<RoomStore> => {
    const mode = netMode();
    if (mode === 'local') return (await import('../../src/net/tree-store')).createLocalStore();
    const { createFirebaseStore } = await import('../../src/net/firebase-store');
    if (mode === 'emulator') {
      return createFirebaseStore({ apiKey: 'demo-key', authDomain: 'demo-trv.firebaseapp.com', projectId: 'demo-trv', appId: 'demo-app',
        databaseURL: 'https://demo-trv-default-rtdb.firebaseio.com' }, { auth: 9099, database: 9000 });
    }
    return createFirebaseStore(FIREBASE_CONFIG!);
  })();
  return storePromise;
}
/** The link that brings a guest straight to the room. */
function inviteUrl(code: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('room', code);
  const q = new URLSearchParams(location.search).get('net');
  if (q) u.searchParams.set('net', q);
  return u.toString();
}
function netError(e: unknown): void {
  console.error(e);
  const b = $('roombadge');
  b.textContent = '⚠ Errore di rete: controlla la connessione';
  b.style.display = 'block';
  $('oerr').textContent = 'Errore di rete: controlla la connessione e riprova.';
}

function enterRoom(store: RoomStore, code: string, uid: string): void {
  net = { store, code, uid, host: false, room: null, stop: () => {}, lobbyOpen: false, qrFor: '' };
  history.replaceState(null, '', inviteUrl(code));
  $('setup').style.display = 'none';
  $('oerr').textContent = '';
  net.stop = store.watch(roomPath(code), raw => onRoom(readRoom(raw)));
}

/** Leaves the room on this device only and goes back to the first screen. */
function exitRoom(why = ''): void {
  if (!net) return;
  net.stop();
  net = null;
  gen = null;
  saved = null;
  setPending(null);
  const u = new URL(location.href);
  u.searchParams.delete('room');
  history.replaceState(null, '', u.toString());
  drawLobby();
  openSetup();
  $('oerr').textContent = why;
  render();
}

/** The room changed (or was read for the first time). */
function onRoom(room: Room | null): void {
  if (!net) return;
  if (!room) { exitRoom('La stanza è stata chiusa.'); return; }
  if (!room.seats[net.uid]) { exitRoom('Non sei più in questa stanza.'); return; }
  net.room = room;
  net.host = room.host === net.uid;
  if (room.status === 'playing' && room.setup) {
    if (!saved || saved.setup.seed !== room.setup.seed) {
      // A match starts (or this device comes back to one): replay the whole log, without the show.
      clearTable();
      net.lobbyOpen = false;
      startGame({ setup: room.setup, choices: room.log.slice() });
    } else {
      for (let i = saved.choices.length; i < room.log.length; i++) applyChoice(room.log[i]);
    }
    if (net.host) referee();
  }
  drawLobby();
}

/** Host: accepts the intents that answer the pending decision, one after the other. */
function referee(): void {
  while (net?.room && saved) {
    const ok = acceptable(net.room, saved.choices.length, pending && { player: pending.player, options: pending.options.length });
    if (!ok) return;
    const n = saved.choices.length;
    applyChoice(ok.choice);
    void net.store.write(roomPath(net.code, 'log', String(n)), ok.choice).catch(netError);
  }
}

function drawLobby(): void {
  const lobby = $('lobby'), badge = $('roombadge');
  if (!net?.room) { lobby.style.display = 'none'; badge.style.display = 'none'; return; }
  const n = net, r = net.room, inGame = r.status === 'playing', open = !inGame || n.lobbyOpen;
  const ids = inGame ? r.order : Object.keys(r.seats).sort((a, b) => r.seats[a].joinedAt - r.seats[b].joinedAt || (a < b ? -1 : 1));
  badge.style.display = 'block';
  badge.textContent = `Stanza ${n.code} · ${ids.length} giocatori${n.host ? ' · sei l’host' : ''}`;
  lobby.style.display = open ? 'grid' : 'none';
  if (!open) return;
  $('lcode').textContent = n.code;
  if (n.qrFor !== n.code) {
    n.qrFor = n.code;
    const link = inviteUrl(n.code);
    ($('llink') as HTMLInputElement).value = link;
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    $('lqr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  // Seats: mine has the crew to pick (before the start); the others are read only.
  const taken = new Set(ids.filter(id => id !== n.uid).map(id => r.seats[id].crew));
  $('lseats').innerHTML = ids.map(id => {
    const s = r.seats[id], mine = id === n.uid;
    const crew = mine && !inGame
      ? `<select id="lcrew">${CAT.crews.map(c => `<option value="${c.id}" ${c.id === s.crew ? 'selected' : ''} ${taken.has(c.id) ? 'disabled' : ''}>${esc(c.name)}</option>`).join('')}</select>`
      : `<small>${esc(CAT.crews.find(c => c.id === s.crew)?.name ?? s.crew)}</small>`;
    return `<div class="seat" style="--c:${crewColor(s.crew)}"><i></i><b>${esc(s.name)}</b>${id === r.host ? '<small>host</small>' : ''}${mine ? '<small>tu</small>' : ''}${crew}</div>`;
  }).join('') + (inGame ? '' : '<div class="seat empty"><i></i><b>posto libero</b></div>'.repeat(Math.max(0, MAX_PLAYERS - ids.length)));
  const crewSel = document.getElementById('lcrew') as HTMLSelectElement | null;
  if (crewSel) crewSel.onchange = () => { void n.store.write(roomPath(n.code, 'seats', n.uid, 'crew'), crewSel.value).catch(netError); };
  // Options: the host's to set before the start.
  const o = r.options;
  if (n.host && !inGame) {
    $('lopts').innerHTML = `<label>Tessera di partenza</label>
      <select id="lside"><option value="a" ${o.startSide === 'a' ? 'selected' : ''}>1a — The Parking Lot</option><option value="b" ${o.startSide === 'b' ? 'selected' : ''}>1b — Runway to Ruin</option></select>
      <label>Espansioni</label>
      <label class="check"><input type="checkbox" id="lleaders" ${o.leaders ? 'checked' : ''}> Choppe Shoppe: capisquadra e segnalini comando</label>
      <label class="check"><input type="checkbox" id="lupgrades" ${o.upgrades ? 'checked' : ''}> Choppe Shoppe: carte potenziamento</label>
      <label class="check"><input type="checkbox" id="lcarnage" ${o.carnage ? 'checked' : ''}> Carnage at Devil’s Run: tessere, pericoli e fuoco</label>`;
    const push = (): void => {
      void n.store.write(roomPath(n.code, 'options'), { startSide: ($('lside') as HTMLSelectElement).value, leaders: ($('lleaders') as HTMLInputElement).checked,
        upgrades: ($('lupgrades') as HTMLInputElement).checked, carnage: ($('lcarnage') as HTMLInputElement).checked }).catch(netError);
    };
    for (const id of ['lside', 'lleaders', 'lupgrades', 'lcarnage']) $(id).onchange = push;
  } else {
    const exp = [o.leaders ? 'capisquadra' : '', o.upgrades ? 'carte potenziamento' : '', o.carnage ? 'Carnage at Devil’s Run' : ''].filter(Boolean).join(', ');
    $('lopts').innerHTML = `<p class="hint">Partenza: tessera 1${o.startSide}. Espansioni: ${exp || 'nessuna'}.</p>`;
  }
  const problem = startProblem(r);
  $('lstate').textContent = inGame ? 'Partita in corso.'
    : !n.host ? 'In attesa che l’host inizi la partita…'
    : problem === 'few' ? 'Servono almeno due giocatori.' : problem === 'crews' ? 'Due giocatori hanno lo stesso colore.' : problem === 'many' ? 'Troppi giocatori: massimo quattro.' : 'Tutto pronto.';
  const show = (id: string, on: boolean): void => { $(id).style.display = on ? '' : 'none'; };
  show('lstart', n.host && !inGame);
  ($('lstart') as HTMLButtonElement).disabled = !!problem;
  show('lresume', inGame);
  show('lrematch', n.host && inGame);
  show('lleave', !n.host);
  show('lclose', n.host);
}

$('lcopy').onclick = () => {
  const link = $('llink') as HTMLInputElement;
  link.select();
  void navigator.clipboard?.writeText(link.value).then(() => { $('lcopy').textContent = 'Copiato!'; setTimeout(() => { $('lcopy').textContent = 'Copia il link'; }, 1500); }).catch(() => {});
};
$('roombadge').onclick = () => { if (net) { net.lobbyOpen = true; drawLobby(); } };
$('lresume').onclick = () => { if (net) { net.lobbyOpen = false; drawLobby(); render(); } };
$('lstart').onclick = () => {
  if (!net?.room || !net.host) return;
  const seed = newSeed();
  if (!seed.ok) { alert('Il browser non fornisce numeri casuali sicuri: impossibile iniziare.'); return; }
  void startMatch(net.store, net.code, net.room, seed.value, crewColor).catch(netError);
};
$('lrematch').onclick = () => {
  if (net?.host && confirm('Chiudere questa partita e tornare alla sala d’attesa?')) void backToLobby(net.store, net.code).catch(netError);
};
$('lclose').onclick = () => {
  if (net?.host && confirm('Chiudere la stanza per tutti? La partita in corso va persa.')) void closeRoom(net.store, net.code).catch(netError);
};
$('lleave').onclick = () => {
  if (!net?.room) return;
  // Before the start the seat is freed; during a match it is kept, so the player can come back.
  if (net.room.status === 'lobby') void leaveRoom(net.store, net.code).catch(netError);
  exitRoom();
};

/** The name typed in the create (`oname`) or join (`jname`) pane, remembered for next time. */
const onlineName = (field: 'oname' | 'jname'): string => {
  const name = ($(field) as HTMLInputElement).value.trim().slice(0, NAME_MAX);
  try { if (name) localStorage.setItem(NAME_KEY, name); } catch { /* storage off */ }
  return name;
};
$('ocreate').onclick = async () => {
  const name = onlineName('oname');
  if (!name) { $('oerr').textContent = 'Scrivi il tuo nome.'; return; }
  $('oerr').textContent = 'Creo la stanza…';
  try {
    const store = await openStore();
    const options = { startSide: ($('oside') as HTMLSelectElement).value as 'a' | 'b', leaders: ($('oleaders') as HTMLInputElement).checked, upgrades: ($('oupgrades') as HTMLInputElement).checked,
      ...(($('ocarnage') as HTMLInputElement).checked ? { carnage: true } : {}) };
    const code = await createRoom(store, { name, crew: CREW_IDS[0] }, options, randomBytes, Date.now());
    enterRoom(store, code, await store.uid());
  } catch (e) { netError(e); }
};
$('ojoin').onclick = async () => {
  const name = onlineName('jname'), code = cleanCode(($('ocode') as HTMLInputElement).value);
  if (!name) { $('oerr').textContent = 'Scrivi il tuo nome.'; return; }
  if (!code) { $('oerr').textContent = 'Il codice ha cinque caratteri.'; return; }
  $('oerr').textContent = 'Entro nella stanza…';
  try {
    const store = await openStore();
    const res = await joinRoom(store, code, { name, crew: freeCrew(null, CREW_IDS) }, CREW_IDS, Date.now());
    if (!res.ok) {
      $('oerr').textContent = { 'not-found': 'Stanza non trovata: controlla il codice.', full: 'La stanza è piena (quattro giocatori).', started: 'La partita è già iniziata.' }[res.error];
      return;
    }
    enterRoom(store, code, await store.uid());
  } catch (e) { netError(e); }
};
($('ocode') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') $('ojoin').click(); });

// ---------------------------------------------------------------- account
// Optional Google sign-in on the first screen. A signed-in player keeps the same identity on
// every device (the anonymous one of the online rooms is linked to it); an admin
// (admins/<uid> in the database) also gets the asset inspector, from here and from the Menu.

let isAdminUser = false;
/** Shows who is signed in and the buttons that apply. */
function drawAccount(user: { name: string | null; email: string | null; anonymous: boolean } | null): void {
  const google = !!user && !user.anonymous;
  $('accwho').textContent = google ? `Accesso: ${user!.name ?? user!.email ?? 'account Google'}${isAdminUser ? ' · admin' : ''}` : 'Facoltativo: con Google ritrovi nome e posti online su ogni dispositivo.';
  $('acclogin').style.display = google ? 'none' : '';
  $('acclogout').style.display = google ? '' : 'none';
  $('accadmin').style.display = isAdminUser ? '' : 'none';
  $('adminopen').style.display = isAdminUser ? '' : 'none';
}
/** Loads the sign-in (only where the Firebase project is set) and keeps the account box up to date. */
async function bootAccount(): Promise<void> {
  $('adminopen').style.display = 'none';
  if (netMode() !== 'firebase' || !FIREBASE_CONFIG) return;
  const { createAdminAuth } = await import('../../src/net/admin-auth');
  const auth = createAdminAuth(FIREBASE_CONFIG);
  $('account').classList.add('on');
  drawAccount(null);
  auth.onUser(async user => {
    isAdminUser = !!user && !user.anonymous && await auth.isAdmin(user.uid);
    drawAccount(user);
    for (const id of ['oname', 'jname']) {
      const name = $(id) as HTMLInputElement;
      if (user && !user.anonymous && user.name && !name.value) name.value = user.name.slice(0, NAME_MAX);
    }
  });
  $('acclogin').onclick = async () => {
    $('oerr').textContent = '';
    try {
      await auth.signInWithGoogle();
      location.reload(); // the room store keeps the identity it read at start: reload with the new one
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      $('oerr').textContent = code === 'auth/popup-closed-by-user' ? 'Finestra di accesso chiusa.'
        : code === 'auth/popup-blocked' ? 'Il browser ha bloccato la finestra di accesso: consenti i popup per questo sito.'
          : 'Accesso non riuscito, riprova.';
    }
  };
  $('acclogout').onclick = async () => {
    if (net && !confirm('Sei in una stanza online: uscendo dall’account perdi il posto. Continuare?')) return;
    await auth.signOut();
    location.reload();
  };
}
$('adminopen').onclick = () => { closePops(); window.open('./admin.html', '_blank'); };

/** First screen: says whether online is available; with an invite link, goes to the room. Returns true when a room is being entered. */
function bootOnline(): boolean {
  try { for (const id of ['oname', 'jname']) ($(id) as HTMLInputElement).value = localStorage.getItem(NAME_KEY) ?? ''; } catch { /* storage off */ }
  showPane('pMain');
  if (!netMode()) {
    ($('mCreate') as HTMLButtonElement).disabled = true;
    ($('mJoin') as HTMLButtonElement).disabled = true;
    $('onlinehint').textContent = 'Il gioco online non è ancora attivo su questo sito.';
    return false;
  }
  const code = cleanCode(new URLSearchParams(location.search).get('room') ?? '');
  if (!code) return false;
  ($('ocode') as HTMLInputElement).value = code;
  showPane('pJoin');
  $('joinhint').textContent = `Sei stato invitato nella stanza ${code}: scrivi il tuo nome ed entra.`;
  // A device that already sits in the room (a reload, a return) goes straight back in.
  void (async () => {
    const store = await openStore(), uid = await store.uid();
    const room = readRoom(await store.read(roomPath(code)));
    if (room?.seats[uid]) enterRoom(store, code, uid);
    else if (!room) $('oerr').textContent = 'Questa stanza non esiste più.';
  })().catch(netError);
  return true;
}

// ---------------------------------------------------------------- loop

/** Distance of the framed view: zooming in from it tilts the view toward the horizon. */
let fitDist = 40;
/**
 * Lays out the screen: the bar and the players at the top, the player's strip at the bottom with
 * nothing around it (no background), the table framed in the free space between them. The strip is
 * as large as the window allows and keeps its size for the whole game.
 */
function fit(): void {
  const W = innerWidth, H = innerHeight;
  const tall = document.body.classList.contains('tall');
  const aspect = tall ? STRIP_ASPECT_LEADER : STRIP_ASPECT;
  // As wide as the window, as long as it leaves the table more than half of the height.
  // The leader's name plate stands above the command board only: it does not count against the table.
  const plate = tall ? STRIP_LEADER_PLATE : 0;
  const stripW = Math.min(W - 24, H * 0.38 * aspect / (1 - plate));
  const stripH = stripW / aspect + 8;
  const root = document.documentElement.style;
  root.setProperty('--stripw', `${Math.round(stripW)}px`);
  root.setProperty('--bottom', `${Math.round(stripH)}px`);
  const top = cssPx('--top'), h = H;
  const botLim = -1 + 2 * (stripH * (1 - plate) + 6) / h;
  // The player bubbles float over the top of the map: keep the road below them.
  const topLim = 1 - 2 * top / h;
  renderer.setSize(W, h);
  camera.aspect = W / h;
  camera.updateProjectionMatrix();
  // Frame the whole road (start area included): fit the corners on screen, then centre them.
  const x0 = BOARD_X0 - 3.2, x1 = BOARD_X0 + 2 * PITCH_W + TILE_W; // start area: cars and parked choppers
  const zTop = -TILE_H / 2, zBot = TRAY_Z + DIE_W * TRAY_SCALE * 0.9; // the road and the row of dice under it
  const corners = [[x0, zTop], [x1, zTop], [x0, zBot], [x1, zBot]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const dir = new THREE.Vector3(0, 1, 0.55).normalize();
  const target = new THREE.Vector3((x0 + x1) / 2, 0, (zTop + zBot) / 2);
  const place = (dist: number): THREE.Box2 => {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const box = new THREE.Box2();
    for (const c of corners) { const p = c.clone().project(camera); box.expandByPoint(new THREE.Vector2(p.x, p.y)); }
    return box;
  };
  for (let pass = 0; pass < 4; pass++) {
    let lo = 2, hi = 200;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2, b = place(mid);
      if (b.min.x < -0.97 || b.max.x > 0.97 || b.max.y - b.min.y > topLim - botLim) lo = mid; else hi = mid; // fits the free band; centred below
    }
    const b = place(hi);
    // Shift the target so the projected board sits in the middle of the free part of the view.
    const cy = (b.min.y + b.max.y) / 2 - (topLim + botLim) / 2;
    target.z -= cy * (zBot - zTop) * 0.5;
  }
  controls.target.copy(target);
  fitDist = camera.position.distanceTo(target);
  controls.maxDistance = fitDist * 1.8;
  controls.update();
}

/** Far from the table the view looks down as framed; near the ground it tilts toward the horizon. */
const ELEV_FAR = Math.atan2(1, 0.55), ELEV_NEAR = 0.6;
function tiltView(): void {
  if (camBefore) return; // the instant replay frames its own shots
  const t = controls.target, d = camera.position.distanceTo(t);
  const k = THREE.MathUtils.clamp((fitDist - d) / Math.max(1, fitDist - controls.minDistance), 0, 1);
  const e = THREE.MathUtils.lerp(ELEV_FAR, ELEV_NEAR, k * k * (3 - 2 * k));
  camera.position.set(t.x, t.y + d * Math.sin(e), t.z + d * Math.cos(e));
  camera.lookAt(t);
}
addEventListener('resize', fit);
fit();

// ---------------------------------------------------------------- HUD dice in 3D
// A transparent WebGL layer over the interface: every element marked data-die3d="kind|value|color"
// (my dice, opponents', the road die, dice placed on boards, the dragged die) gets a 3D die drawn
// exactly over it. The element stays in the page, invisible, for layout and clicks.

const hudRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
hudRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));

// ---------------------------------------------------------------- graphics quality
// Fixed levels or `auto`: the frame rate is measured all the time and, under `auto`, a level is
// dropped when the game runs below FPS_LOW for a while (slow computers: 10-15 fps reported by
// the user). It never climbs back by itself, to avoid flicker; the menu can set it again.

const FPS_LOW = 32, FPS_WINDOW = 2;
const ORDER: Level[] = ['high', 'medium', 'low'];
/** Model textures, with their full-size image, so a level can shrink them and a higher one restore them. */
const modelTextures = new Map<THREE.Texture, CanvasImageSource & { width: number; height: number }>();
function registerTextures(m: THREE.Object3D): void {
  m.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const v of Object.values(mat)) {
        const t = v as THREE.Texture;
        if (t?.isTexture && t.image && !modelTextures.has(t)) { modelTextures.set(t, t.image as CanvasImageSource & { width: number; height: number }); fitTexture(t, LEVELS[level].texture); }
      }
    }
  });
}
function fitTexture(t: THREE.Texture, max: number): void {
  const full = modelTextures.get(t);
  if (!full) return;
  const k = Math.min(1, max / Math.max(full.width, full.height));
  if (k >= 1) { if (t.image !== full) { t.image = full; t.needsUpdate = true; } return; }
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(full.width * k));
  c.height = Math.max(1, Math.round(full.height * k));
  c.getContext('2d')!.drawImage(full, 0, 0, c.width, c.height);
  t.image = c;
  t.needsUpdate = true;
}
/** Puts a quality level into effect: resolution of both renderers, the shadow, model textures. */
function applyLevel(l: Level): void {
  level = l;
  const L = LEVELS[l];
  renderer.setPixelRatio(Math.min(devicePixelRatio, L.pixelRatio));
  hudRenderer.setPixelRatio(Math.min(devicePixelRatio, l === 'high' ? 2 : 1));
  lamp.castShadow = L.shadow > 0;
  if (L.shadow > 0 && lamp.shadow.mapSize.x !== L.shadow) {
    lamp.shadow.mapSize.set(L.shadow, L.shadow / 2);
    lamp.shadow.map?.dispose();
    lamp.shadow.map = null;
  }
  for (const t of modelTextures.keys()) fitTexture(t, L.texture);
  fit();
  syncOptions();
}
let fpsAcc = 0, fpsFrames = 0, fpsSlow = 0, fpsNow = 0;
/** Called every frame with its length: keeps the frame rate and, under `auto`, steps the level down. */
function frameTimes(dt: number): void {
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc < FPS_WINDOW) return;
  fpsNow = fpsFrames / fpsAcc;
  fpsAcc = 0;
  fpsFrames = 0;
  if (document.hidden) return;
  fpsSlow = fpsNow < FPS_LOW ? fpsSlow + 1 : 0;
  if (settings.quality === 'auto' && fpsSlow >= 2 && level !== 'low') {
    fpsSlow = 0;
    applyLevel(ORDER[ORDER.indexOf(level) + 1]);
  }
  if ($('optspop').classList.contains('show')) syncOptions();
}

// ---------------------------------------------------------------- options and menu popovers

const LEVEL_NAME: Record<Level, string> = { high: 'alta', medium: 'media', low: 'bassa' };
/** Shows the settings in the Options popover. */
function syncOptions(): void {
  const pop = $('optspop');
  for (const seg of pop.querySelectorAll<HTMLElement>('.seg')) {
    const key = seg.dataset.set as 'quality' | 'speed';
    for (const b of seg.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.v === settings[key]);
  }
  for (const box of pop.querySelectorAll<HTMLInputElement>('input[data-set]')) box.checked = !!settings[box.dataset.set as 'grid' | 'actionCam' | 'effects' | 'words'];
  $('fps').textContent = `${fpsNow ? `${Math.round(fpsNow)} fotogrammi al secondo · ` : ''}qualità in uso: ${LEVEL_NAME[level]}`;
}
for (const seg of $('optspop').querySelectorAll<HTMLElement>('.seg')) {
  seg.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (seg.dataset.set === 'quality') {
      settings.quality = b.dataset.v as Quality;
      fpsSlow = 0;
      applyLevel(settings.quality === 'auto' ? 'high' : settings.quality);
    } else settings.speed = b.dataset.v as Speed;
    saveSettings();
    syncOptions();
  });
}
for (const box of $('optspop').querySelectorAll<HTMLInputElement>('input[data-set]')) {
  box.addEventListener('change', () => { settings[box.dataset.set as 'grid' | 'actionCam' | 'effects' | 'words'] = box.checked; saveSettings(); syncOptions(); });
}
function closePops(): void {
  for (const id of ['optspop', 'menupop']) $(id).classList.remove('show');
  for (const id of ['opts', 'menu']) $(id).classList.remove('on');
}
function togglePop(pop: string, btn: string): void {
  const open = !$(pop).classList.contains('show');
  closePops();
  if (!open) return;
  $(pop).classList.add('show');
  $(btn).classList.add('on');
  if (pop === 'optspop') syncOptions();
}
$('opts').addEventListener('click', e => { e.stopPropagation(); togglePop('optspop', 'opts'); });
$('menu').addEventListener('click', e => { e.stopPropagation(); togglePop('menupop', 'menu'); });
for (const id of ['optspop', 'menupop']) $(id).addEventListener('pointerdown', e => e.stopPropagation());
addEventListener('pointerdown', closePops);
addEventListener('keydown', e => { if (e.key === 'Escape') closePops(); });
hudRenderer.toneMapping = THREE.NoToneMapping;
Object.assign(hudRenderer.domElement.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '7' });
document.body.appendChild(hudRenderer.domElement);
const hudScene = new THREE.Scene();
hudScene.add(new THREE.AmbientLight(0xffffff, 1.5));
const hudLamp = new THREE.DirectionalLight(0xffffff, 1.9);
hudLamp.position.set(-0.4, 0.8, 1);
hudScene.add(hudLamp);
const hudCam = new THREE.OrthographicCamera(0, 1, 0, -1, -500, 500);
interface HudDie { d: Die3D; key: string; seen: boolean }
const hudDice = new Map<Element, HudDie>();
const TO_SCREEN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, -0.4, 0));

function fitHud(): void {
  hudRenderer.setSize(innerWidth, innerHeight);
  Object.assign(hudCam, { left: 0, right: innerWidth, top: 0, bottom: -innerHeight });
  hudCam.updateProjectionMatrix();
}
addEventListener('resize', fitHud);
fitHud();

function syncHudDice(now: number): void {
  for (const h of hudDice.values()) h.seen = false;
  for (const el of document.querySelectorAll('[data-die3d]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || el.closest('[style*="display: none"]') || el.closest('#roundbox:not(.show)') || el.closest('#rolls:not(.show)')) continue;
    const key = el.getAttribute('data-die3d')!;
    let h = hudDice.get(el);
    if (h && h.key !== key) { hudScene.remove(h.d.mesh); h = undefined; }
    if (!h) {
      const [kind, , color] = key.split('|');
      h = { d: withOwnMaterials(makeDie(FACES, kind, 1, color || undefined)), key, seen: true };
      hudScene.add(h.d.mesh);
      hudDice.set(el, h);
    }
    h.seen = true;
    const [kind, value] = key.split('|');
    const size = Math.min(r.width, r.height) * 0.8;
    h.d.mesh.scale.setScalar(size);
    h.d.mesh.position.set(r.left + r.width / 2, -(r.top + r.height / 2), 0);
    const face = Math.max(0, h.d.faceOf(kind === 'movement' ? Number(value) : value));
    const fwd = kind === 'direction' ? FORWARD : AWAY;
    const q = h.d.orientation(face, fwd).premultiply(TO_SCREEN).premultiply(TILT);
    if (el.classList.contains('sel')) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(now * 3) * 0.35));
    // A die being rolled tumbles, then settles on its face.
    const rollAt = Number(el.getAttribute('data-roll') ?? 0);
    if (rollAt) {
      const u = THREE.MathUtils.clamp((now * 1000 - rollAt) / 900, 0, 1);
      if (u < 1) {
        const spin = (1 - u) ** 2 * 14;
        q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(spin * 1.3, spin, spin * 0.7)));
        h.d.mesh.position.y += Math.abs(Math.sin(u * Math.PI * 2.5)) * (1 - u) * size * 0.9;
      }
    }
    h.d.mesh.quaternion.copy(q);
    const faded = el.classList.contains('used');
    for (const m of h.d.mesh.material as THREE.MeshStandardMaterial[]) { m.transparent = faded; m.opacity = faded ? 0.22 : 1; }
  }
  for (const [el, h] of hudDice) if (!h.seen) {
    hudScene.remove(h.d.mesh);
    for (const m of h.d.mesh.material as THREE.Material[]) m.dispose();
    hudDice.delete(el);
  }
}

/**
 * Keeps the floating choices where the player is looking (`data-anchor`): under the car they are
 * about (above it only when there is no room below), on the command board for "no command",
 * otherwise just above the bar. Never under the strip, never off the screen.
 */
/**
 * The command board's tab: the command and token choices (asked by the user to sit on the board,
 * not float over the table) and Undo. Shown in hot seat always (for Undo), online only to ask.
 */
function drawDock(d: Decision | null, mine: boolean): void {
  const dock = $('cmddock'), q = $('cmdq'), row = $('cmdbtns');
  row.innerHTML = '';
  q.textContent = '';
  const asking = !!d && mine && (d.kind === 'command' || d.kind === 'token');
  if (asking) {
    const add = (i: number, label: string, cls = ''): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = d!.options[i].label;
      if (cls) b.className = cls;
      b.onclick = () => choose(i);
      row.append(b);
    };
    if (d!.kind === 'command') {
      q.textContent = 'Metti un dado su un comando';
      add(0, 'Nessun comando', 'quiet');
    } else {
      const p = g!.players[d!.player];
      q.textContent = `Segnalino comando? (${p.tokens} ${p.tokens === 1 ? 'rimasto' : 'rimasti'})`;
      d!.options.slice(1).forEach((o, i) => add(i + 1, `★ ${commandName(o.command!)}`));
      add(0, 'Nessun segnalino', 'quiet');
    }
  }
  dock.classList.toggle('ask', asking);
  ($('undo2') as HTMLElement).style.display = net ? 'none' : '';
  $('cmdwrap').classList.toggle('on', !!g && !menuOpen() && (asking || !net));
}
/** How far the drawer reaches behind the command board's top edge (hidden by the board), in px. */
const DOCK_TUCK = 22;
/**
 * Keeps the drawer on the command board: as wide as the board's top edge (between its two upper
 * corner slots) and coming out of that edge: the crew leader's name plate, or the top of the base board.
 */
function placeDock(): void {
  const wrap = $('cmdwrap'), dock = $('cmddock');
  if (!wrap.classList.contains('on')) return;
  const slots = [...document.querySelectorAll<SVGElement>('#strip [data-drop^="cmd:"]')].map(el => el.getBoundingClientRect()).filter(r => r.width);
  const svg = $('strip').querySelector('svg, .loose')?.getBoundingClientRect();
  if (!slots.length || !svg) return;
  const top = Math.min(...slots.map(r => r.top));
  const upper = slots.filter(r => r.top < top + 30); // the two corner slots at the top (and the quarters next to them)
  const left = Math.min(...upper.map(r => r.left + r.width / 2)), right = Math.max(...upper.map(r => r.left + r.width / 2));
  const edge = document.body.classList.contains('tall') ? svg.top + 4 : top - 4; // base board: its top edge runs just above the corner slots
  const width = `${Math.round(right - left)}px`;
  if (dock.style.width !== width) dock.style.width = width;
  wrap.style.left = `${(left + right) / 2}px`;
  wrap.style.bottom = `${innerHeight - edge - DOCK_TUCK}px`;
}

function placeActions(): void {
  const el = $('actions');
  if (!el.childElementCount) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const rect = renderer.domElement.getBoundingClientRect();
  const floor = $('strip').getBoundingClientRect().top - 8; // nothing floats lower than this over the table
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = innerWidth / 2, top = floor - h;
  const dice = tableDiceRect();
  if (dice) {
    // Beside the dice on the table: "no command" and the questions about the dice.
    x = dice.right + 18 + w / 2;
    top = Math.min(floor - h, dice.top - 4); // level with the dice, hanging toward the strip rather than over the road
  }
  const o = el.dataset.anchor === 'car' && el.dataset.car ? carObjs.get(el.dataset.car) : undefined;
  if (o) {
    // Around the car, wherever it hides the least: the spaces that can be picked (targets, moves)
    // and the vehicles must stay in view. Under the car first, then behind it, above, ahead.
    const screen = (p: THREE.Vector3): [number, number] => {
      const q = p.clone().project(camera);
      return [rect.left + (q.x * 0.5 + 0.5) * rect.width, rect.top + (-q.y * 0.5 + 0.5) * rect.height];
    };
    const [gx, gy] = screen(o.position);
    const space = Math.abs(screen(o.position.clone().add(new THREE.Vector3(1, 0, 0)))[0] - gx); // a world unit, in pixels
    const keep: [number, number, number, number][] = []; // left, top, right, bottom of what must stay visible
    for (const m of markers) { const [mx, my] = screen(m.at); keep.push([mx - space * 0.75, my - space * 0.5, mx + space * 0.75, my + space * 0.5]); }
    for (const c of carObjs.values()) { const [cx, cy] = screen(c.position); keep.push([cx - space * 0.6, cy - space * 0.55, cx + space * 0.6, cy + space * 0.3]); }
    const gap = space * 0.75 + 10;
    const spots: [number, number][] = [
      [gx, gy + space * 0.35 + 8], [gx - w / 2 - gap, gy - h / 2], [gx, gy - space * 0.7 - h - 8], [gx + w / 2 + gap, gy - h / 2],
      [gx - w / 2 - gap, gy + space * 0.5], [gx - w / 2 - gap, gy - space * 0.6 - h], [gx, gy + space * 1.1], [gx, gy - space * 1.5 - h],
    ];
    let best = Infinity;
    for (const [sx, sy] of spots) {
      const cx = Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, sx)), ty = Math.max(cssPx('--top'), Math.min(floor - h, sy));
      let hidden = Math.hypot(cx - sx, ty - sy) * 20; // pushed away from its spot by the screen's edge
      for (const [l, t, r, bt] of keep) hidden += Math.max(0, Math.min(cx + w / 2, r) - Math.max(cx - w / 2, l)) * Math.max(0, Math.min(ty + h, bt) - Math.max(ty, t));
      if (hidden < best - 1) { best = hidden; x = cx; top = ty; }
    }
  }
  el.style.left = `${Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, x))}px`;
  el.style.top = `${top}px`;
}
$('skip').addEventListener('click', () => skipBeats());
/** Back to the view of the whole map, as at the start. */
function homeView(): void { actionBack = null; if (chase) { setChase(null); return; } focusGoal = null; focusDist = null; fit(); }
$('home').addEventListener('click', homeView);

/** The lines of the spaces over the terrain, on or off (button and key G). */
function toggleGrid(): void {
  settings.grid = !settings.grid;
  saveSettings();
  syncOptions();
}

/** Car speed on the table (world units per second) and how fast it turns to face its way. */
const DRIVE = { speed: 7, turnRate: 9, parkTurnRate: 2.5, maxYaw: 0.87 };
/**
 * One frame of a car: it drives to its target at a steady speed, facing the way it goes
 * (backwards when pushed back), turns back along the road once parked; wheels and body follow.
 */
function drive(o: THREE.Object3D, dt: number, k: number, now: number): void {
  const tg = o.userData.target as THREE.Vector3 | undefined;
  const before = o.position.clone();
  if (tg) {
    const dx = tg.x - o.position.x, dz = tg.z - o.position.z;
    const dist = Math.hypot(dx, dz);
    const step = Math.min(dist, DRIVE.speed * dt * Math.min(1, 0.35 + dist * 1.5));
    if (dist > 1e-4) { o.position.x += dx / dist * step; o.position.z += dz / dist * step; }
  }
  const vx = (o.position.x - before.x) / Math.max(dt, 1e-4), vz = (o.position.z - before.z) / Math.max(dt, 1e-4);
  const speed = Math.hypot(vx, vz);
  const yaw = (o.userData.yaw ?? 0) as number;
  // Heading: +x is along the road; yaw turns toward -z (three.js convention).
  let want = 0, reverse = false;
  if (speed > 0.4) {
    want = Math.atan2(-vz, vx);
    if (Math.abs(want) > Math.PI * 0.6) { want = want > 0 ? want - Math.PI : want + Math.PI; reverse = true; }
    // A lane change is a diagonal step: the car steers into it, it does not turn sideways.
    want = Math.max(-DRIVE.maxYaw, Math.min(DRIVE.maxYaw, want));
  }
  const rate = speed > 0.4 ? DRIVE.turnRate : DRIVE.parkTurnRate;
  const turn = want - yaw;
  const newYaw = yaw + turn * Math.min(1, dt * rate);
  o.userData.yaw = newYaw;
  driveGun(o, newYaw, dt);
  // Tip over the long axis onto one side; while tipping it hops.
  const f = (o.userData.flipNow ?? 0) + (((o.userData.flip ?? 0) - (o.userData.flipNow ?? 0)) * k * 0.7);
  o.userData.flipNow = f;
  o.rotation.order = 'YXZ';
  o.rotation.set(f * (o.userData.flipSide ?? 1) * Math.PI / 2, newYaw, 0);
  const h = o.userData.height ?? 0.5;
  // On its side it rests on half its width; while tipping it hops.
  const halfW = ((o.userData.modelSize as THREE.Vector3 | undefined)?.z ?? h) / 2;
  o.position.y = (tg?.y ?? TILE_T) + f * halfW + Math.sin(f * Math.PI) * h * 0.8;
  const rig = o.userData.rig as CarRig | undefined;
  if (rig) {
    const fwd = speed * dt * (reverse ? -1 : 1);
    const v = fwd / Math.max(dt, 1e-4);
    const accel = (v - (o.userData.lastV ?? 0)) / Math.max(dt, 1e-4);
    o.userData.lastV = v;
    rig.update(dt, now, fwd, accel, turn, (newYaw - yaw) / Math.max(dt, 1e-4), !o.userData.wreck && f < 0.3);
  }
  applyGlow(o, now);
}

const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop(t => {
  timer.update(t);
  // Behind the first screen nothing is drawn: it is a screen of its own, and the computer rests.
  if (menuOpen()) { $('cmdwrap').classList.remove('on'); return; }
  const rawDt = Math.min(timer.getDelta(), 0.1);
  frameTimes(rawDt);
  const dt = rawDt * timeScale * (playing ? SPEED_SCALE[settings.speed] : 1);
  const k = 1 - Math.exp(-dt * 10);
  const now = performance.now() / 1000;
  for (const o of carObjs.values()) drive(o, dt, k, now);
  moveCamera(rawDt);
  for (const o of chopperObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (tg) o.position.lerp(tg, k);
    const aim = o.userData.aim as number | null | undefined;
    const wantYaw = aim ?? 0, dy = Math.atan2(Math.sin(wantYaw - o.rotation.y), Math.cos(wantYaw - o.rotation.y));
    o.rotation.y += dy * Math.min(1, dt * 8);
    o.rotation.z += ((aim === null || aim === undefined ? 0 : -0.3) - o.rotation.z) * Math.min(1, dt * 8); // nose down to strafe
    // On the ground it stands still, rotors idling; in the air it hovers.
    const idle = o.userData.parked && tg && o.position.distanceTo(tg) < 0.1 ? 0.08 : 1;
    const r = o.getObjectByName('rotor'); if (r) r.rotation.y += dt * 18 * idle;
    const model = o.userData.model as THREE.Object3D | undefined;
    if (model) hover(model, idle < 1 ? 0 : now, idle < 1 ? 0 : o.userData.phase ?? 0, idle < 1 ? 0 : o.userData.modelHeight ?? 0.5);
    for (const p of (o.userData.spin ?? []) as THREE.Object3D[]) {
      if (p.name === 'rotorMain') p.rotation.y += dt * ROTOR_SPEED.rotorMain * idle; else p.rotation.z += dt * ROTOR_SPEED.rotorTail * idle;
    }
  }
  for (const m of markers) (m.mesh.material as THREE.MeshBasicMaterial).opacity = (m.mesh.userData.hover ? 0.85 : 0.45) + Math.sin(now * 5) * 0.15;
  // Replay of the rules' beats, one at a time.
  // Beats follow the clock, not the frame rate: a slow frame plays every beat that is due.
  // While the action camera flies to the action, the beats wait for it (at most ACTION_WAIT s).
  if (playing && actionBack && (focusGoal || focusDist !== null) && now < actionSince + ACTION_WAIT) nextBeatAt = Math.max(nextBeatAt, now);
  while (playing && now >= nextBeatAt) {
    const f = queue.shift();
    if (!f) { finishBeats(); break; }
    applyBeat(f, now);
    nextBeatAt = Math.max(nextBeatAt, now - 0.5) + beatLength(f) / (timeScale * SPEED_SCALE[settings.speed]);
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t = Math.min(1, e.t + dt / e.life);
    e.step(e.t);
    if (e.t >= 1) effects.splice(i, 1);
  }
  tickFlames(now, camera, renderer.domElement.height);
  groundTick(now);
  for (const grp of tileSlots) {
    if (!grp) continue;
    if (grp.userData.x !== undefined) grp.position.x += (grp.userData.x - grp.position.x) * k * 0.6;
    if (grp.userData.info) (grp.userData.info as THREE.Object3D).visible = settings.grid;
  }
  updateWords(dt);
  updateSmoke(dt, now);
  for (const [k, h] of hazardObjs) {
    h.obj.update(dt);
    if (h.gone !== undefined && now > h.gone) { scene.remove(h.obj.group); hazardObjs.delete(k); }
  }
  for (const td of trayDice) {
    if (td.t >= 1) continue;
    td.t = Math.min(1, td.t + dt / 0.75);
    const u = Math.max(0, td.t), e = 1 - Math.pow(1 - u, 3);
    td.d.mesh.position.lerpVectors(td.from, td.to, e);
    td.d.mesh.position.y = td.to.y + Math.abs(Math.cos(u * Math.PI * 1.5)) * (1 - u) * 2.2;
    td.d.mesh.quaternion.slerpQuaternions(td.q0, td.q1, e);
  }
  if (!chaseCamera(rawDt)) {
    controls.update();
    tiltView();
  }
  animTableDice(now);
  const shake = now < shakeUntil ? new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25) : null;
  if (shake) camera.position.add(shake);
  renderer.render(scene, camera);
  if (shake) camera.position.sub(shake);
  syncHudDice(now);
  placeActions();
  placeDock();
  placeBlockTips();
  hudRenderer.render(hudScene, hudCam);
});

applyLevel(level);
syncInert();
void bootAccount().catch(e => console.error(e));
const invited = bootOnline();
try {
  const raw = invited ? null : localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = JSON.parse(raw) as Saved;
    if (s?.setup?.seed && Array.isArray(s.choices)) { $('setup').style.display = 'none'; startGame(s); }
  }
} catch { /* broken save: start fresh */ }

// For automated checks.
(window as unknown as { trv: object }).trv = {
  get game() { return g; }, get decision() { return decision; }, choose, undo, zoneOption, scene, hazardObjs, camera, controls,
  get queue() { return queue; }, get playing() { return playing; }, skipBeats, playBeats, // playBeats: replays frames (presentation only), for checks
  get rows() { return ROWS; }, get cols() { return COLS; },
  get cam() { return { chase, action: !!actionBack, focusGoal: focusGoal?.toArray(), focusDist, settings }; },
};

// Debug handle (prototype only): try the effects from the console without playing, e.g.
// `__fx.crash(__fx.cars()[0], 2, 0)` or `__fx.explode(0, 0)`.
Object.assign(window, { __fx: {
  cars: () => [...carObjs.keys()],
  decision: () => decision && { kind: decision.kind, player: decision.player, prompt: decision.prompt, options: decision.options.map(o => o.label) },
  choose: (i: number) => choose(i),
  damage: (id: string, type: string) => showDamage({ kind: 'damage', vehicleId: id, token: { type } } as unknown as Frame),
  replay: (n = 14) => { if (!g) return 0; replayFrames = g.frames.slice(-n).filter(f => f.kind !== 'log' && f.kind !== 'round' && f.kind !== 'tile'); const f = replayFrames.find(x => x.at); replayAt = f?.at ? world(f.at) : null; startReplay(); return replayFrames.length; },
  aim: (id: string, yaw: number | null) => { const o = carObjs.get(id); if (o) o.userData.aim = yaw; },
  zoom: (id: string, d = 3) => { const o = carObjs.get(id); if (o) { controls.target.copy(o.position); camera.position.copy(o.position).add(new THREE.Vector3(-d * 0.3, d * 0.6, d)); } },
  explode: (x: number, z: number) => explode(new THREE.Vector3(x, TILE_T, z)),
  crash: (id: string, dx = 1.5, dz = 0) => { const o = carObjs.get(id); if (o) crash(id, o.position.clone().add(new THREE.Vector3(dx, 0, dz)), ''); },
  burst: (fromId: string, toId: string) => {
    const a = carObjs.get(fromId), b = carObjs.get(toId);
    if (a && b) burst(a.position.clone(), b.position.clone(), toId);
  },
  word: (t: string, x: number, z: number) => word(t, new THREE.Vector3(x, TILE_T, z), '#ffb02a'),
  blocked: (carId: string, because = 'stealth_technology') => { const v = g?.vehicles.find(x => x.id === carId); if (v?.pos) markBlocked({ carId, pos: v.pos, because }); },
  chase: (carId: string | null) => setChase(carId),
  roll: (die: string, value: number | string) => showRoll({ kind: 'roll', die: { die, value } } as unknown as Frame),
} });
