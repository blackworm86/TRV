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
import { dieSvg, damageTokenSvg, dashboardSvg, commandBoardSvg, playerStripSvg, STRIP_ASPECT, avatarSvg, dataUrl } from '../../src/view/vector/art';
import { newSeed } from '../../src/platform/entropy';
import { ModelBank, dressed, fitToLength, splitParts, splitWheels, type Tint } from '../../src/view/models3d';
import { MODEL, SHOW_LENGTH_MM, MODEL_YAW, CHOPPER_PARTS, ROTOR_SPEED, WHEELS, GUNS, type GunSpec, crewTint, WRECK_TINT, wreckModel, phaseOf, hover, CarRig } from './models-config';
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
  replayFrames = null; // a replay belongs to the game it was seen in
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
  keepReplay(fresh);
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
const ROLL_NAME: Record<string, string> = { slam: 'Dado slam', direction: 'Direzione', shooting: 'Dado sparo', stunt: 'Dado acrobazia', road: 'Dado strada' };
const ROLL_MEANS: Record<string, Record<string, string>> = {
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
};
/**
 * A car takes damage: the token drawn is turned over big in the middle of the screen, with whose
 * car it is and what the token does. The dice it calls for appear beside it as they are rolled.
 */
function showDamage(f: Frame): void {
  if (!g || f.token === undefined) return;
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
  render();
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
  // A new kind of choice forgets a strip opened or closed by hand.
  syncStrip();

  // Top: the round, then a bubble per player in seating order (the one on turn glows), the road die.
  document.documentElement.style.setProperty('--who', me.color);
  $('roundinfo').innerHTML = `<small>ROUND</small><b class="gothic">${g.round}</b><span>${g.finalTile ? 'ultima tessera' : `tessera ${g.tilesPlaced}`}</span>`;
  const CMD_NAME: Record<string, string> = { airstrike: 'Attacco aereo', nitro: 'Nitro', drift: 'Drift', repair: 'Ripara' };
  $('players').innerHTML = g.players.map(p => {
    const turn = p.id === g!.current && g!.winner === null, decides = !!d && d.player === p.id;
    const cars = g!.vehicles.filter(v => v.owner === p.id).sort((a, b) => 'SML'.indexOf(a.size) - 'SML'.indexOf(b.size)).map(v => {
      const title = `${{ S: 'Piccola', M: 'Media', L: 'Grande' }[v.size]}: ${v.status === 'elim' ? 'eliminata' : v.status === 'inop' ? 'fuori uso' : v.inStart ? 'in partenza' : 'in strada'}${v.damage.length ? `, ${v.damage.length} danni` : ''}`;
      return `<span class="car ${v.status === 'ok' ? '' : v.status}" title="${title}">${v.size}${'<i></i>'.repeat(v.damage.length)}</span>`;
    }).join('');
    const tag = p.out ? '<span class="tag quiet">fuori</span>' : turn ? '<span class="tag">di turno</span>' : decides ? '<span class="tag">decide</span>'
      : p.id === g!.firstPlayer ? '<span class="tag quiet">1° giocatore</span>' : '';
    const extra = [p.command ? `<b>${CMD_NAME[p.command.cmd] ?? p.command.cmd}</b> con ${p.command.value}` : '', p.chopper ? 'elicottero in campo' : ''].filter(Boolean).join(' · ');
    return `<div class="bubble pl ${turn ? 'turn' : ''} ${decides ? 'decides' : ''} ${p.out ? 'out' : ''}" style="--c:${p.color}">
      <div class="av">${avatarSvg(p.color, p.name)}</div>
      <div class="who"><span class="nm gothic">${esc(p.name)}</span>${tag}</div>
      <div class="row"><div class="dice-row">${p.dice.map((n, i) => dieHtml('movement', n, p.color, p.used[i] ? 'used' : '')).join('')}</div>
        <div class="cars">${cars}</div>${extra ? `<span class="extra">${extra}</span>` : ''}</div></div>`;
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
  };
  if (d && SHORT[d.kind]) $('prompt').innerHTML = `<b style="color:${g.players[d.player].color}">${esc(name)}</b>${esc(SHORT[d.kind]!)}`;
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
    if (d.kind === 'command') btn(0, 'Nessun comando', 'quiet');
    else if (d.kind === 'shoot') btn(0, 'Non sparare', 'quiet'); // the targets are lit on the table
    else if (d.kind === 'roadDie') { btn(1, `+${g.roadDie} movimenti`, 'road'); btn(0, 'Fermati', 'quiet'); }
    else if (d.kind === 'slamReroll') { btn(0, 'Tieni', 'quiet'); btn(1, 'Ritira i dadi'); }
    else if (!['assign', 'step', 'airstrike', 'repair'].includes(d.kind)) d.options.forEach((o, i) => btn(i, o.label));
  }
  // The question sits with its answer: over the buttons, or alone by the car or the dice.
  const left = d?.kind === 'step' ? /(\d+) moviment/.exec(d.prompt)?.[1] : undefined;
  const ASK: Partial<Record<Decision['kind'], string>> = {
    command: 'Comando?', roadDie: `Dado strada: +${g.roadDie}?`, slamReroll: 'Slam: ritiri i dadi?', shoot: 'Scegli il bersaglio',
    step: left ? `${left} moviment${left === '1' ? 'o' : 'i'}` : 'Muovi', airstrike: 'Scegli una casella vuota', repair: 'Scegli l’auto da riparare',
  };
  if (d && ASK[d.kind]) actions.insertAdjacentHTML('afterbegin', `<span class="q">${esc(ASK[d.kind]!)}</span>`);
  actions.classList.toggle('only', !actions.querySelector('button'));
  $('mydice').dataset.label = d?.kind === 'assign' ? 'Assegna un dado' : d?.kind === 'command' ? 'Un dado sul comando' : '';
  actions.dataset.car = g.activeCar ?? '';
  actions.dataset.anchor = d?.kind === 'command' ? 'dice' : g.activeCar ? 'car' : 'bar';
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
  $('mydice').innerHTML = me.dice.map((n, i) => {
    const cls = me.used[i] ? 'used' : !mine || !dieUsable(i) ? 'idle' : selDie === i ? 'sel' : '';
    return dieHtml('movement', n, me.color, cls, `data-die="${i}"`);
  }).join('');
  const cmdArt = { color: me.color, used: me.command, drop: [...hot].filter(z => z.startsWith('cmd:')).map(z => z.slice(4)) };
  const pickIds = new Set(d?.kind === 'repair' ? d.options.map(o => o.carId) : []);
  const dashArt = g.vehicles.filter(v => v.owner === me.id).map(v => ({
    carId: v.id, size: v.size, color: me.color, status: v.status, placed: v.placed, damage: v.damage.length,
    dropMove: hot.has(`move:${v.id}`), dropCoast: hot.has(`coast:${v.id}`), pick: pickIds.has(v.id),
    label: v.status === 'elim' ? '' : v.inStart ? 'IN PARTENZA' : '',
  }));
  // One drawing, laid out as in the rulebook; without the owner's drawing, the boards side by side.
  $('strip').innerHTML = playerStripSvg(cmdArt, dashArt) ?? `<div class="loose">${commandBoardSvg(cmdArt)}${dashArt.map(a => dashboardSvg(a)).join('')}</div>`;

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
    for (const el of document.querySelectorAll<SVGElement>('#strip [data-car]')) {
      const i = d.options.findIndex(o => o.carId === el.dataset.car);
      if (i >= 0) { el.classList.add('hotzone'); el.addEventListener('click', () => choose(i)); }
    }
  }
  ($('undo') as HTMLButtonElement).disabled = !saved?.choices.length;
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
  } else if (key === 'g') {
    toggleGrid();
  } else if (key === 'p') {
    toggleStrip();
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
  // The boards strip is as tall as the bottom panel allows, or as the width allows (dice and chopper beside it).
  const sh = Math.max(150, Math.min(innerHeight * 0.36, 420, (innerWidth - 24) / STRIP_ASPECT));
  // Folded, the strip is about half that; the table is framed above the folded strip.
  const small = Math.max(110, sh * 0.5) + 14;
  document.documentElement.style.setProperty('--big', `${sh + 14}px`);
  document.documentElement.style.setProperty('--small', `${small}px`);
  const top = cssPx('--top'), bottom = small + cssPx('--bar');
  const h = Math.max(200, innerHeight - bottom);
  // The player bubbles float over the top of the map: keep the road below them.
  const topLim = 1 - 2 * top / h;
  renderer.setSize(innerWidth, h);
  camera.aspect = innerWidth / h;
  camera.updateProjectionMatrix();
  // Frame the whole road (start area included): fit the corners on screen, then centre them.
  const x0 = BOARD_X0 - 3.2, x1 = BOARD_X0 + 2 * PITCH_W + TILE_W; // start area: cars and parked choppers
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
      if (b.min.x < -0.97 || b.max.x > 0.97 || b.min.y < -0.95 || b.max.y > topLim) lo = mid; else hi = mid;
    }
    const b = place(hi);
    // Shift the target so the projected board sits in the middle of the free part of the view.
    const cy = (b.min.y + b.max.y) / 2 - (topLim - 0.95) / 2;
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
 * The strip is small. It grows while the pointer is on it, and the button (or P) keeps it open
 * until it is pressed again.
 */
let stripPin = false, stripHover = false;
function syncStrip(): void {
  const open = stripPin || stripHover;
  document.body.classList.toggle('open', open);
  $('stripmode').firstElementChild!.textContent = open ? '▾' : '▴';
}
function toggleStrip(): void { stripPin = !stripPin; if (!stripPin) stripHover = false; syncStrip(); }
$('stripmode').addEventListener('click', toggleStrip);
$('bottom').addEventListener('pointerenter', () => { stripHover = true; syncStrip(); });
$('bottom').addEventListener('pointerleave', () => { stripHover = false; syncStrip(); });

/**
 * Keeps the floating choices where the player is looking (`data-anchor`): under the car they are
 * about (above it only when there is no room below), on the command board for "no command",
 * otherwise just above the bar. Never under the strip, never off the screen.
 */
function placeActions(): void {
  const el = $('actions');
  if (!el.childElementCount) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const rect = renderer.domElement.getBoundingClientRect();
  const floor = $('bar').getBoundingClientRect().top - 8; // nothing floats lower than this over the table
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = innerWidth / 2, top = floor - h;
  // With no car to stand by, it stays clear of the dice, which sit on the bar's upper edge.
  const dice = $('mydice').getBoundingClientRect();
  if (dice.height > 0) top = Math.min(top, dice.top - h - 26);
  const o = el.dataset.anchor === 'car' && el.dataset.car ? carObjs.get(el.dataset.car) : undefined;
  if (el.dataset.anchor === 'dice' && dice.height > 0) {
    // Beside the dice: the die goes on a command, or this button says "none".
    x = dice.right + 14 + w / 2;
    top = dice.top + (dice.height - h) / 2;
  } else if (o) {
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

/** The lines of the spaces over the terrain, on or off (button and key G). */
let gridOn = true;
function toggleGrid(): void {
  gridOn = !gridOn;
  $('grid').classList.toggle('offed', !gridOn);
}
$('grid').addEventListener('click', toggleGrid);

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
  const dt = Math.min(timer.getDelta(), 0.1) * timeScale;
  const k = 1 - Math.exp(-dt * 10);
  const now = performance.now() / 1000;
  for (const o of carObjs.values()) drive(o, dt, k, now);
  moveCamera(dt);
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
  while (playing && now >= nextBeatAt) {
    const f = queue.shift();
    if (!f) { finishBeats(); break; }
    applyBeat(f, now);
    nextBeatAt = Math.max(nextBeatAt, now - 0.5) + beatLength(f) / timeScale;
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t = Math.min(1, e.t + dt / e.life);
    e.step(e.t);
    if (e.t >= 1) effects.splice(i, 1);
  }
  for (const grp of tileSlots) {
    if (!grp) continue;
    if (grp.userData.x !== undefined) grp.position.x += (grp.userData.x - grp.position.x) * k * 0.6;
    if (grp.userData.info) (grp.userData.info as THREE.Object3D).visible = gridOn;
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
  controls.update();
  const shake = now < shakeUntil ? new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25) : null;
  if (shake) camera.position.add(shake);
  renderer.render(scene, camera);
  if (shake) camera.position.sub(shake);
  syncHudDice(now);
  placeActions();
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

// Debug handle (prototype only): try the effects from the console without playing, e.g.
// `__fx.crash(__fx.cars()[0], 2, 0)` or `__fx.explode(0, 0)`.
Object.assign(window, { __fx: {
  cars: () => [...carObjs.keys()],
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
  roll: (die: string, value: number | string) => showRoll({ kind: 'roll', die: { die, value } } as unknown as Frame),
} });
