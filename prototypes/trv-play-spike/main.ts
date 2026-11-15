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
  newGame, play, tileDef, ROWS, COLS, TILE_COLS,
  snapshot, type Game, type Decision, type Pos, type Setup, type LogEntry, type Player, type Frame, type Snapshot,
} from '../../src/game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf, ofKind } from '../../src/game/trv/catalog';
import { Pieces, TextureBank } from '../../src/view/pieces3d';
import { buildTile, hazardToken, spaceCenterPx, spaceGeometry, GRID, TILE_PITCH_PX } from '../../src/view/board3d';
import { dieSvg, dashboardSvg, commandBoardSvg, chopperSvg, avatarSvg, dataUrl } from '../../src/view/vector/art';
import { newSeed } from '../../src/platform/entropy';
import { ModelBank, dressed, fitToLength, splitParts, splitWheels, type Tint } from '../../src/view/models3d';
import { MODEL, SHOW_LENGTH_MM, MODEL_YAW, CHOPPER_PARTS, ROTOR_SPEED, WHEELS, crewTint, WRECK_TINT, wreckModel, phaseOf, hover, CarRig } from './models-config';
import { makeDie, withOwnMaterials, type Die3D, type DiceFaces } from '../../src/view/dice3d';
import RULES from '../../data/trv/game_base.json';

const FACES = RULES.dice as unknown as DiceFaces;

const SAVE_KEY = 'trv-hotseat-v3';
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cssPx = (name: string): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));

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
// Left button pans the board, right button orbits, the wheel zooms (asked by the user).
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.screenSpacePanning = false; // pan along the table, not the screen
controls.maxPolarAngle = 1.2;
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

/** World position of a space centre (columns run across the three tiles). */
function world(p: Pos): THREE.Vector3 {
  const slot = Math.floor(p.c / TILE_COLS);
  const [px, py] = spaceCenterPx(p.r, p.c - slot * TILE_COLS);
  return new THREE.Vector3(BOARD_X0 + slot * PITCH_W + px * KX, TILE_T, (py - GRID.frameH / 2) * KZ);
}

// Road tiles built from the terrain data, cached per face.
const tileCache = new Map<string, THREE.Group>();
const tileSlots: (THREE.Group | null)[] = [null, null, null];
function showTiles(s: Snapshot): void {
  if (!g) return;
  s.board.forEach((t, i) => {
    const startFace = t.tile === 1 && g!.tilesPlaced === 3;
    const key = `${t.tile}${t.side}${startFace ? g!.players.length : ''}`;
    let grp = tileCache.get(key);
    if (!grp) {
      grp = buildTile(tileDef(t), { width: TILE_W, depth: TILE_H, thickness: TILE_T, ...(startFace ? { players: g!.players.length } : {}) });
      tileCache.set(key, grp);
    }
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
let decision: Decision | null = null;
let selDie: number | null = null;

function startGame(s: Saved): void {
  saved = s;
  g = newGame(s.setup);
  gen = play(g);
  let r = gen.next(0);
  for (const c of s.choices) { if (r.done) break; r = gen.next(c); }
  decision = r.done ? null : r.value;
  selDie = null;
  lastDecider = -1;
  frameSeen = g.frames.length;
  queue.length = 0;
  playing = false;
  persist();
  render();
}

function choose(i: number): void {
  if (!gen || !decision || !saved || i < 0) return;
  saved.choices.push(i);
  const r = gen.next(i);
  decision = r.done ? null : r.value;
  selDie = null;
  persist();
  const fresh = g!.frames.slice(frameSeen);
  frameSeen = g!.frames.length;
  playBeats(fresh);
}

function undo(): void {
  if (!saved || !saved.choices.length) return;
  winShown = false;
  $('win').style.display = 'none';
  startGame({ setup: saved.setup, choices: saved.choices.slice(0, -1) });
}

function persist(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch { /* storage off: no resume */ }
}

/** The player the interface is showing: whoever must decide now. */
function viewer(): Player | null {
  if (!g) return null;
  return g.players[decision ? decision.player : g.winner ?? g.current];
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
/** Swaps a stand-in piece for its model once loaded, at its table length. */
function useModel(o: THREE.Group, url: string, lengthMm: number, tint: Tint, id: string): void {
  void models.load(url).then(m => {
    if (!m) return;
    if (!m.userData.split) {
      if (url === MODEL.chopper) splitParts(m, CHOPPER_PARTS);
      else if (WHEELS[url]) splitWheels(m, WHEELS[url]);
      m.userData.split = true;
    }
    const d = dressed(m, tint);
    const size = fitToLength(d, lengthMm * MM, MODEL_YAW);
    if (WHEELS[url]) o.userData.rig = new CarRig(d, d.scale.x, size.y, phaseOf(id));
    o.userData.mats = collectMaterials(d);
    for (const c of o.children) c.visible = false;
    o.add(d);
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
  showTiles(s);
  finish.visible = s.finalTile;
  const hz = new Map(s.hazards);

  for (const [k, h] of hz) {
    let rec = hazardObjs.get(k);
    if (rec && (rec.type !== h.type || rec.gone !== undefined)) { scene.remove(rec.obj.group); rec = undefined; }
    if (!rec) { rec = { type: h.type, obj: hazardToken(h.type, HAZ_SIZE) }; hazardObjs.set(k, rec); scene.add(rec.obj.group); }
    const [r, c] = k.split(',').map(Number);
    // world() is the middle of the space's body; the token's box also holds the point, half a point further on.
    rec.obj.group.position.copy(world({ r, c })).setY(TILE_T + 0.003);
    rec.obj.group.position.x += GRID.tip / 2 * KX;
    rec.obj.setFaceUp(h.faceUp);
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

  s.choppers.forEach((at, pid) => {
    let o = chopperObjs.get(pid);
    if (!at) { if (o) { scene.remove(o); chopperObjs.delete(pid); } return; }
    if (!o) {
      o = pieces.chopper(sizeOf(CAT, 'chopper'), g!.players[pid].color);
      useModel(o, MODEL.chopper, SHOW_LENGTH_MM.chopper, crewTint(g!.players[pid].color, true), `chopper${pid}`);
      chopperObjs.set(pid, o); scene.add(o); o.position.copy(world(at)).setY(5);
    }
    o.userData.target = world(at).setY(1.1);
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
  move: 0.32, roll: 0.8, slam: 0.75, shot: 0.6, damage: 0.65, elim: 0.75, reveal: 0.7, tile: 1.1, round: 2.6, chopper: 0.8,
};

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
  render();
}

function applyBeat(f: Frame, now: number): void {
  if (f.kind === 'log') { toastLine(f); if (f.logKind === 'turn') trayFresh = true; return; }
  drawTable(f.snap);
  const at = f.at ? world(f.at) : null;
  switch (f.kind) {
    case 'roll': rollOnTable(f); break;
    case 'slam':
      shakeUntil = now + 0.35;
      if (at) impact(at, 0xff6a2a, 1.6);
      break;
    case 'shot':
      if (f.from && at) tracer(world(f.from), at);
      break;
    case 'damage':
      if (f.vehicleId) flash(f.vehicleId);
      if (at) impact(at, 0xff2a2a, 1.1);
      break;
    case 'elim':
      if (at) impact(at, 0xffd23a, 2.0);
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

/** A bright line from the shooter to the target. */
function tracer(from: THREE.Vector3, to: THREE.Vector3): void {
  const a = from.clone().setY(TILE_T + 0.45), b = to.clone().setY(TILE_T + 0.45);
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true }));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  scene.add(m);
  impact(a, 0xffe066, 0.6);
  effects.push({ life: 0.5, t: 0, step: u => {
    (m.material as THREE.MeshBasicMaterial).opacity = 1 - u;
    m.scale.set(1 - u * 0.7, 1, 1 - u * 0.7);
    if (u >= 1) { scene.remove(m); m.geometry.dispose(); }
  } });
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
  const free = (x: number, z: number): boolean => others.every(t => Math.abs(t.to.x - x) >= step - 1e-6 || Math.abs(t.to.z - z) >= step - 1e-6);
  let to = old >= 0 ? trayDice[old].to.clone() : null;
  for (let row = 0; !to && row < 4; row++) {
    for (let n = 0; n < 40; n++) {
      const j = n % 2 ? (n + 1) / 2 : -n / 2; // 0, 1, -1, 2, -2…
      const x = cx + j * step, z = TRAY_Z + row * step;
      if (x < BOARD_X0 + 0.5 || !free(x, z)) continue;
      to = new THREE.Vector3(x, DIE_W * TRAY_SCALE / 2, z);
      break;
    }
  }
  to ??= new THREE.Vector3(cx, DIE_W * TRAY_SCALE / 2, TRAY_Z + 4 * step);
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

function drawMarkers(): void {
  markerGroup.clear();
  markers = [];
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
  if (!['step', 'airstrike', 'shoot'].includes(d.kind)) return;
  d.options.forEach((o, i) => {
    if (!o.pos) return;
    const at = world(o.pos);
    if (markers.some(m => m.at.distanceTo(at) < 0.05)) return;
    const color = o.danger ? 0xff3b30 : d.kind === 'shoot' ? 0xffd23a : d.kind === 'airstrike' ? 0x7fd4ff : 0x4cff7a;
    const onTable = o.pos.r >= 0 && o.pos.r < ROWS && o.pos.c >= 0 && o.pos.c < COLS;
    let mesh: THREE.Mesh;
    if (onTable) {
      // The whole space glows: a solid fill, a bright rim and a soft, wider halo. Not tone
      // mapped, so the colour stays vivid under the table's lighting.
      const slot = Math.floor(o.pos.c / TILE_COLS);
      const rc = o.pos.c - slot * TILE_COLS;
      const glow = (opacity: number, additive: boolean): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, toneMapped: false, ...(additive ? { blending: THREE.AdditiveBlending } : {}),
      });
      mesh = new THREE.Mesh(spaceGeometry(o.pos.r, rc, TILE_W, TILE_H, 0.95), glow(0.7, false));
      const rim = new THREE.Mesh(spaceGeometry(o.pos.r, rc, TILE_W, TILE_H, 1.0), glow(0.9, true));
      rim.position.z = -0.002;
      const halo = new THREE.Mesh(spaceGeometry(o.pos.r, rc, TILE_W, TILE_H, 1.14), glow(0.4, true));
      halo.position.z = -0.004;
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
const toastLines: string[] = [];
/** Shows a rules line that matters (shots, damage, hazards, eliminations, turns) over the map. */
function toastLine(f: Frame): void {
  if (!f.text) return;
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
let handoffTimer = 0;
const HANDOFF_WHY: Partial<Record<Decision['kind'], string>> = {
  assign: 'assegna i dadi movimento', command: 'scegli il comando', airstrike: 'attacco dall’elicottero', repair: 'ripara un’auto',
  step: 'muovi l’auto', roadDie: 'dado strada', slamReroll: 'slam: decidi se ritirare i due dadi', shoot: 'scegli il bersaglio',
};
/** Hot seat: whenever a different player must decide (a new turn, or a slam reroll owed to the larger car's owner), say who. */
function handoff(d: Decision): void {
  if (!g || d.player === lastDecider) return;
  lastDecider = d.player;
  const p = g.players[d.player];
  const el = $('handoff');
  el.style.setProperty('--who', p.color);
  el.innerHTML = `<small>Passa il dispositivo</small><b class="gothic">Tocca a ${esc(p.name)}</b><span>${esc(HANDOFF_WHY[d.kind] ?? '')}</span>`;
  el.classList.add('show');
  clearTimeout(handoffTimer);
  handoffTimer = window.setTimeout(() => el.classList.remove('show'), d.kind === 'slamReroll' ? 2600 : 1800);
}

function drawHud(): void {
  if (!g) return;
  const me = viewer()!;
  // While the last choice plays out, nothing can be chosen.
  const d = playing ? null : decision;
  if (d) handoff(d);

  // Top: me, opponents with colour and dice, road die.
  $('meav').innerHTML = avatarSvg(me.color, me.name);
  $('mename').textContent = me.name;
  $('opps').innerHTML = g.players.filter(p => p !== me).map(p =>
    `<div class="opp ${p.out ? 'out' : ''}" style="border-color:${p.color}"><div class="av">${avatarSvg(p.color, p.name)}</div>
     <div><div class="nm gothic">${esc(p.name)}${p.out ? ' — fuori' : ''}</div>
     <div class="dice-row">${p.dice.map((n, i) => dieHtml('movement', n, p.color, p.used[i] ? 'used' : '')).join('')}</div></div></div>`).join('');
  $('roaddie').innerHTML = g.roadDie ? dieHtml('road', g.roadDie, undefined) : '';
  $('roaddie').parentElement!.classList.toggle('glow', d?.kind === 'roadDie');

  // Bar: prompt, contextual actions, last log line.
  const name = d ? g.players[d.player].name : '';
  const text = d ? d.prompt.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `), '') : g.winner !== null ? 'Partita finita.' : '';
  $('prompt').innerHTML = d ? `<b style="color:${g.players[d.player].color}">${esc(name)}</b>${esc(text)}` : playing ? '<i>…</i>' : esc(text);
  if (d?.kind === 'roadDie') $('prompt').innerHTML = `<b style="color:${g.players[d.player].color}">${esc(name)}</b>Dado strada! L'auto è partita e rimasta su strada: +${g.roadDie} movimenti?`;
  if (d?.kind === 'assign') $('prompt').innerHTML += ' <i>— trascina un dado su un’auto o sul suo cruscotto</i>';
  if (d?.kind === 'command') $('prompt').innerHTML += ' <i>— trascina un dado su un comando</i>';
  const actions = $('actions');
  actions.innerHTML = '';
  if (playing) {
    const b = document.createElement('button');
    b.textContent = 'Salta ⏭';
    b.className = 'quiet';
    b.title = 'Salta l’animazione (barra spaziatrice)';
    b.onclick = skipBeats;
    actions.appendChild(b);
  }
  if (d) {
    const btn = (i: number, cls = ''): void => {
      const b = document.createElement('button');
      b.textContent = d.options[i].label;
      b.className = cls || (d.options[i].danger ? 'danger' : '');
      b.onclick = () => choose(i);
      actions.appendChild(b);
    };
    if (d.kind === 'command') btn(0, 'quiet');
    else if (d.kind === 'shoot') { d.options.forEach((_, i) => { if (i > 0) btn(i, 'shoot'); }); btn(0, 'quiet'); }
    else if (d.kind === 'roadDie') { btn(1, 'road'); btn(0, 'quiet'); }
    else if (d.kind === 'slamReroll') { btn(0, 'quiet'); btn(1); }
    else if (!['assign', 'step', 'airstrike', 'repair'].includes(d.kind)) d.options.forEach((_, i) => btn(i));
  }
  const last = g.log[g.log.length - 1];
  $('ticker').innerHTML = last ? logLine(last).replace(/^<div[^>]*>|<\/div>$/g, '') : '';
  if ($('drawer').style.display === 'block') drawDrawer();

  // The four steps of a turn (rulebook p. 8), the current one lit.
  const stepOf: Record<string, number> = { assign: 1, command: 2, airstrike: 2, repair: 2, step: 3, roadDie: 3, slamReroll: 3, shoot: 4 };
  const cur = d ? stepOf[d.kind] ?? 0 : 0;
  const shootNote = g.round <= 1 ? ' (dal 2° round)' : '';
  $('steps').innerHTML = ['Assegna', 'Comando', 'Movimento', `Spara${shootNote}`].map((n, i) =>
    `<span class="${i + 1 === cur ? 'on' : i + 1 < cur ? 'done' : ''} ${i === 3 && g!.round <= 1 ? 'off' : ''}">${i + 1} ${n}</span>`).join('');

  // Bottom: my dice, command board, dashboards, chopper.
  const hot = hotZones();
  const mine = d && d.player === me.id;
  $('mydice').innerHTML = me.dice.map((n, i) => {
    const cls = me.used[i] ? 'used' : !mine || !dieUsable(i) ? 'idle' : selDie === i ? 'sel' : '';
    return dieHtml('movement', n, me.color, cls, `data-die="${i}"`);
  }).join('');
  $('cmd').innerHTML = commandBoardSvg({ color: me.color, used: me.command, drop: [...hot].filter(z => z.startsWith('cmd:')).map(z => z.slice(4)) });
  const pickIds = new Set(d?.kind === 'repair' ? d.options.map(o => o.carId) : []);
  $('dashes').innerHTML = g.vehicles.filter(v => v.owner === me.id).map(v => dashboardSvg({
    carId: v.id, size: v.size, color: me.color, status: v.status, placed: v.placed, damage: v.damage.length,
    dropMove: hot.has(`move:${v.id}`), dropCoast: hot.has(`coast:${v.id}`), pick: pickIds.has(v.id),
    label: v.status === 'elim' ? 'ELIMINATA' : v.inStart ? 'IN PARTENZA' : '',
  })).join('');
  $('chopper').innerHTML = chopperSvg(me.color, !!me.chopper) + (me.chopper ? 'in campo' : 'pronto');

  // Clicks on boards: drop the selected die, or pick a car to repair.
  for (const el of document.querySelectorAll<SVGElement>('#bottom [data-drop]')) {
    if (hot.has(el.dataset.drop!)) el.classList.add('hotzone');
    el.addEventListener('click', () => {
      // No die selected: use the first free die that fits this slot.
      const pick = selDie ?? me.dice.findIndex((_, i) => !me.used[i] && zoneOption(el.dataset.drop!, i) >= 0);
      if (pick !== null && pick >= 0) choose(zoneOption(el.dataset.drop!, pick));
    });
  }
  if (d?.kind === 'repair') {
    for (const el of document.querySelectorAll<SVGElement>('#dashes [data-car]')) {
      const i = d.options.findIndex(o => o.carId === el.dataset.car);
      if (i >= 0) { el.classList.add('hotzone'); el.addEventListener('click', () => choose(i)); }
    }
  }
  ($('undo') as HTMLButtonElement).disabled = !saved?.choices.length;
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

// ---------------------------------------------------------------- input: dice drag & drop

const ghost = $('ghost');
let drag: { die: number; x: number; y: number; moved: boolean } | null = null;
$('mydice').addEventListener('pointerdown', e => {
  const el = (e.target as Element).closest<SVGElement>('[data-die]');
  if (!el) return;
  const i = Number(el.dataset.die);
  if (!dieUsable(i)) return;
  e.preventDefault();
  drag = { die: i, x: e.clientX, y: e.clientY, moved: false };
  selDie = i;
  drawHud();
});
addEventListener('pointermove', e => {
  if (!drag || !g || !decision) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    const p = g.players[decision.player];
    ghost.innerHTML = dieSvg({ kind: 'movement', value: p.dice[drag.die], color: p.color });
    ghost.style.display = 'block';
  }
  ghost.style.left = `${e.clientX - 22}px`;
  ghost.style.top = `${e.clientY - 22}px`;
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

addEventListener('keydown', e => { if (playing && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skipBeats(); } });

// ---------------------------------------------------------------- camera keys
// WASD (or arrows) slide the view over the table; Tab / Shift+Tab jump between the cars of the
// player on turn, 1 2 3 go to their small, medium and large car, F to the car that is acting.
const held = new Set<string>();
const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
};
let focusGoal: THREE.Vector3 | null = null;
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
function focusOn(o: THREE.Object3D | undefined): void {
  if (o) focusGoal = (o.userData.target as THREE.Vector3 | undefined)?.clone().setY(0) ?? o.position.clone().setY(0);
}
addEventListener('keydown', e => {
  if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (PAN_KEYS[key]) { held.add(key); focusGoal = null; e.preventDefault(); return; }
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
function syncNames(): void {
  const n = Number(($('np') as HTMLSelectElement).value);
  for (let i = 0; i < 4; i++) {
    ($(`n${i}`) as HTMLInputElement).style.display = i < n ? '' : 'none';
    crewSelects[i].style.display = i < n ? '' : 'none';
  }
}
$('np').onchange = syncNames;
syncNames();
$('undo').onclick = undo;
$('menu').onclick = () => { $('setup').style.display = 'grid'; };
$('again').onclick = () => { $('win').style.display = 'none'; $('setup').style.display = 'grid'; };
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
  for (const o of carObjs.values()) scene.remove(o);
  carObjs.clear();
  for (const id of [...smokes.keys()]) smokeOff(id);
  for (const o of chopperObjs.values()) scene.remove(o);
  chopperObjs.clear();
  winShown = false;
  $('win').style.display = 'none';
  $('setup').style.display = 'none';
  startGame({ setup: { seed: seed.value, players, startSide: ($('side') as HTMLSelectElement).value as 'a' | 'b' }, choices: [] });
};

// ---------------------------------------------------------------- loop

function fit(): void {
  const top = cssPx('--top'), bottom = cssPx('--bottom') + cssPx('--bar');
  const h = Math.max(200, innerHeight - top - bottom);
  renderer.setSize(innerWidth, h);
  camera.aspect = innerWidth / h;
  camera.updateProjectionMatrix();
  // Frame the whole road (start area included): fit the corners on screen, then centre them.
  const x0 = BOARD_X0 - 1.8, x1 = BOARD_X0 + 2 * PITCH_W + TILE_W;
  const zTop = -TILE_H / 2, zBot = TRAY_Z + DIE_W * 1.5; // road plus the dice tray
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
  for (let pass = 0; pass < 2; pass++) {
    let lo = 2, hi = 200;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2, b = place(mid);
      if (b.min.x < -0.97 || b.max.x > 0.97 || b.min.y < -0.95 || b.max.y > 0.95) lo = mid; else hi = mid;
    }
    const b = place(hi);
    // Shift the target so the projected board sits in the middle of the view.
    const cy = (b.min.y + b.max.y) / 2;
    target.z -= cy * (zBot - zTop) * 0.5;
  }
  controls.target.copy(target);
  controls.update();
}
addEventListener('resize', fit);
fit();

// ---------------------------------------------------------------- HUD dice in 3D
// A transparent WebGL layer over the interface: every element marked data-die3d="kind|value|color"
// (my dice, opponents', the road die, dice placed on boards, the dragged die) gets a 3D die drawn
// exactly over it. The element stays in the page, invisible, for layout and clicks.

const hudRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
hudRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
    if (r.width < 2 || el.closest('[style*="display: none"]') || el.closest('#roundbox:not(.show)')) continue;
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
  const dt = Math.min(timer.getDelta(), 0.1);
  const k = 1 - Math.exp(-dt * 10);
  const now = performance.now() / 1000;
  for (const o of carObjs.values()) drive(o, dt, k, now);
  moveCamera(dt);
  for (const o of chopperObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (tg) o.position.lerp(tg, k);
    const r = o.getObjectByName('rotor'); if (r) r.rotation.y += dt * 18;
    const model = o.userData.model as THREE.Object3D | undefined;
    if (model) hover(model, now, o.userData.phase ?? 0, o.userData.modelHeight ?? 0.5);
    for (const p of (o.userData.spin ?? []) as THREE.Object3D[]) {
      if (p.name === 'rotorMain') p.rotation.y += dt * ROTOR_SPEED.rotorMain; else p.rotation.z += dt * ROTOR_SPEED.rotorTail;
    }
  }
  for (const m of markers) (m.mesh.material as THREE.MeshBasicMaterial).opacity = (m.mesh.userData.hover ? 0.85 : 0.45) + Math.sin(now * 5) * 0.15;
  // Replay of the rules' beats, one at a time.
  // Beats follow the clock, not the frame rate: a slow frame plays every beat that is due.
  while (playing && now >= nextBeatAt) {
    const f = queue.shift();
    if (!f) { finishBeats(); break; }
    applyBeat(f, now);
    nextBeatAt = Math.max(nextBeatAt, now - 0.5) + beatLength(f);
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t = Math.min(1, e.t + dt / e.life);
    e.step(e.t);
    if (e.t >= 1) effects.splice(i, 1);
  }
  for (const grp of tileSlots) if (grp && grp.userData.x !== undefined) grp.position.x += (grp.userData.x - grp.position.x) * k * 0.6;
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
  controls.update();
  const shake = now < shakeUntil ? new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25) : null;
  if (shake) camera.position.add(shake);
  renderer.render(scene, camera);
  if (shake) camera.position.sub(shake);
  syncHudDice(now);
  hudRenderer.render(hudScene, hudCam);
});

try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = JSON.parse(raw) as Saved;
    if (s?.setup?.seed && Array.isArray(s.choices)) { $('setup').style.display = 'none'; startGame(s); }
  }
} catch { /* broken save: start fresh */ }

// For automated checks.
(window as unknown as { trv: object }).trv = {
  get game() { return g; }, get decision() { return decision; }, choose, undo, zoneOption, scene, hazardObjs,
  get queue() { return queue; }, get playing() { return playing; }, skipBeats, playBeats, // playBeats: replays frames (presentation only), for checks
  get rows() { return ROWS; }, get cols() { return COLS; },
};
