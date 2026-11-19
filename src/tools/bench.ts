// Test bench of the Vehicle Motion system (#36; docs/piano-integrazione-veicoli.md): a test vehicle
// on a test tile, its parts moved through the parts descriptor (view/vehicle-rig.ts), with slowed
// playback, frame steps and overlays. The parts move on their own (demo), by hand, or in the plan's
// scenarios, driven by the same motion code as the game (app/motion/): each command's plan is shown
// against what it really took, with its salient moments and the true stop.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Frame, Terrain } from '../game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf } from '../game/trv/catalog';
import { P } from '../app/presentation';
import { makeRoute, type Route } from '../app/route';
import { bikeLean, planDrive, stepDrive } from '../app/motion/drive';
import { flipMove, hitMove, pushMove, skidMove, stepMove, type Move } from '../app/motion/moves';
import { char, makeCrash, stepCrash, type Crash } from '../app/motion/crash';
import { hitchReach, tow } from '../app/motion/hitch';
import { makeJump, planJump, stepJump, type Jump } from '../app/motion/jump';
import { makeAim, planAim, pointingAt, stepAim, type Aim } from '../app/motion/aim';
import { MotionTrack, type Moment, type MotionPlan } from '../app/motion/plan';
import { PartsRig, rideHeight, type Ground } from '../app/motion/rig';
import { springStill } from '../app/motion/plan';
import { SceneQueue, type Scene, type SceneTimes } from '../app/scenes';
import { CameraOwner } from '../app/camera-owner';
import { chooseShot, frame as framePose, freeRect, shotDir, toFrame, type Pose as CamPose, type ShotSpec, type Subject } from '../view/camera/framing';
import type { JumpStunt } from '../app/stunts';
import { buildTile, spaceCenterPx, GRID, type TileData } from '../view/board3d';
import { rampSurfaceAt } from '../view/terrain/carnage3d';
import { buildTestVehicle, toTable, type VehicleSheet } from '../view/test-vehicles';
import { describeVehicle, missingParts, type Capability, type PartsDescriptor } from '../view/vehicle-rig';
import CAR_SHEET from '../../assets/base/modelli/schede/collaudo_auto.json';
import BIKE_SHEET from '../../assets/base/modelli/schede/collaudo_moto.json';
import TRACTOR_SHEET from '../../assets/base/modelli/schede/collaudo_rig_motrice.json';
import TRAILER_SHEET from '../../assets/base/modelli/schede/collaudo_rig_rimorchio.json';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// One scale for the table, as the game has it (app/stage.ts): world units per mm.
const TILE_MM = sizeOf(CAT, 'road_tile');
const MM = 13.14 / TILE_MM[0];
const TILE_W = TILE_MM[0] * MM, TILE_H = TILE_MM[1] * MM, TILE_T = TILE_MM[2] * MM;
const KX = TILE_W / GRID.frameW, KZ = TILE_H / GRID.frameH;
const SPACE = TILE_W / 8;

/** The test tile: road, off-road, mud, an impassable block and a launch ramp (row 5, column 1). */
const BENCH_TILE: TileData = {
  name: 'Banco prova',
  terrain: ['RRRRRRRR', 'RRMMRRoo', 'RRRRRRRR', 'RRRRRRRR', 'ooRRXRRR', 'RPRRRRRR'],
  hazards: [],
};

/** The vehicles of the bench: the car, the motorcycle (it leans), the Big Rig (a tractor towing two trailers). */
const CAR = CAR_SHEET as unknown as VehicleSheet, TRAILER = TRAILER_SHEET as unknown as VehicleSheet;
const VEHICLES: { label: string; sheet: VehicleSheet; trailers?: VehicleSheet[]; bike?: boolean }[] = [
  { label: 'Auto di collaudo', sheet: CAR },
  { label: 'Moto di collaudo', sheet: BIKE_SHEET as unknown as VehicleSheet, bike: true },
  { label: 'Rig di collaudo', sheet: TRACTOR_SHEET as unknown as VehicleSheet, trailers: [TRAILER, TRAILER] },
];

type Space = [number, number];
/**
 * A command of a scenario: drive through spaces (row, column of the test tile; `free`: arriving at
 * an angle, as the Big Rig does), jump off the ramp, aim and fire at a space, slam another vehicle of
 * the scenario (`target`: its index) pushing it to a space, skid or tip over to a side (+1 left, -1
 * right for a skid; +1 onto the right side, -1 onto the left for a tip), or be destroyed.
 */
type Cmd = { kind: 'drive'; to: Space[]; free?: boolean } | { kind: 'jump'; ramp: Space } | { kind: 'aim'; at: Space; rounds: number }
  | { kind: 'slam'; target: number; push: Space } | { kind: 'skid'; side: number } | { kind: 'flip'; side: number } | { kind: 'crash' };
/**
 * A scenario: its vehicle (index in VEHICLES, the car by default), where it starts, the other vehicles
 * standing on the table, its commands; or, with `director`, the frames of the rules it plays as scenes
 * (the director's queue and camera), skipped to the end after `skipAt` seconds when given.
 */
interface Scenario { id: string; name: string; phase: number; vehicle?: number; start?: Space; others?: Space[]; cmds?: Cmd[]; director?: boolean; skipAt?: number }
/** The scenarios of the plan; those with a start can be played now. */
const SCENARIOS: Scenario[] = [
  { id: 'S1', name: 'Rettilineo di 3 caselle', phase: 2, start: [2, 1], cmds: [{ kind: 'drive', to: [[2, 2], [2, 3], [2, 4]] }] },
  { id: 'S2', name: 'Cambio di corsia e zigzag', phase: 2, start: [3, 0], cmds: [{ kind: 'drive', to: [[2, 1], [3, 1], [2, 2], [3, 2], [3, 3], [3, 4]] }] },
  { id: 'S3', name: 'Curva stretta veloce', phase: 2, start: [3, 0], cmds: [{ kind: 'drive', to: [[3, 1], [3, 2], [3, 3], [2, 4], [1, 4]] }] },
  { id: 'S4', name: 'Terreno misto', phase: 3, start: [1, 0], cmds: [{ kind: 'drive', to: [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7]] }] },
  { id: 'S5', name: 'Salto da rampa', phase: 2, start: [5, 0], cmds: [{ kind: 'drive', to: [[5, 1]] }, { kind: 'jump', ramp: [5, 1] }] },
  { id: 'S6', name: 'Slam: urto e spinta', phase: 4, start: [3, 1], others: [[2, 3]],
    cmds: [{ kind: 'drive', to: [[3, 2], [3, 3]] }, { kind: 'slam', target: 0, push: [1, 3] }] },
  { id: 'S7', name: 'Sbandata e Stordito', phase: 4, start: [3, 0],
    cmds: [{ kind: 'drive', to: [[3, 1], [3, 2]] }, { kind: 'skid', side: 1 }, { kind: 'drive', to: [[3, 3], [3, 4]] }] },
  { id: 'S8', name: 'Fuori uso', phase: 4, start: [2, 1], cmds: [{ kind: 'drive', to: [[2, 2], [2, 3]] }, { kind: 'flip', side: 1 }] },
  { id: 'S9', name: 'Schianto', phase: 4, start: [2, 1], cmds: [{ kind: 'drive', to: [[2, 2], [2, 3]] }, { kind: 'crash' }] },
  { id: 'S10', name: 'Sparo', phase: 3, start: [2, 3], cmds: [{ kind: 'aim', at: [4, 1], rounds: 3 }, { kind: 'aim', at: [0, 6], rounds: 2 }] },
  { id: 'S11', name: 'Moto: slalom', phase: 4, vehicle: 1, start: [3, 0],
    cmds: [{ kind: 'drive', to: [[2, 1], [3, 2], [2, 3], [3, 4], [2, 5], [3, 6]] }] },
  { id: 'S12', name: 'Big Rig: curva e arrivo obliquo', phase: 4, vehicle: 2, start: [2, 3],
    cmds: [{ kind: 'drive', to: [[2, 4], [3, 4], [3, 5], [4, 6]], free: true }] },
  { id: 'S13', name: 'Slam con il director', phase: 5, start: [3, 1], others: [[2, 3]], cmds: [], director: true },
  { id: 'S14', name: 'Salta scena', phase: 5, start: [3, 1], others: [[2, 3]], cmds: [], director: true, skipAt: 3.2 },
  { id: 'S15', name: 'Modello vecchio (ripiego)', phase: 6 },
];
const STUNTS: [JumpStunt, string][] = [['flat', 'piano'], ['oneWheel', 'su una ruota'], ['barrel', 'avvitamento'], ['backflip', 'capriola']];

// ---- scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2019);
scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a2a20, 1.5));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.2);
sun.position.set(-6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 });
scene.add(sun);
const tableTop = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.85 }));
tableTop.rotation.x = -Math.PI / 2;
tableTop.receiveShadow = true;
scene.add(tableTop);
const tile = buildTile(BENCH_TILE, { width: TILE_W, depth: TILE_H, thickness: TILE_T });
scene.add(tile);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.02, 200);
const controls = new OrbitControls(camera, renderer.domElement);

/** World point of a tile space (as app/stage.ts `world`, for a tile centred on the origin). */
function spaceWorld([r, c]: Space): THREE.Vector3 {
  const [px, py] = spaceCenterPx(r, c);
  const ground = (tile.userData.heightAt as ((x: number, y: number) => number) | undefined)?.(px, py) ?? 0;
  return new THREE.Vector3((px - GRID.frameW / 2) * KX, TILE_T + ground, (py - GRID.frameH / 2) * KZ);
}
/** The ground letter of a space of the test tile. */
const groundOf = ([r, c]: Space): Terrain => (BENCH_TILE.terrain[r]?.[c] ?? 'R') as Terrain;
/** World height of the ground at (x, z): the tile's relief, or a ramp's surface where it is higher; null off the tile. */
function groundAt(x: number, z: number): number | null {
  const px = x / KX + GRID.frameW / 2, py = z / KZ + GRID.frameH / 2;
  if (px < 0 || py < 0 || px > GRID.frameW || py > GRID.frameH) return null;
  const relief = (tile.userData.heightAt as ((x: number, y: number) => number) | undefined)?.(px, py) ?? 0;
  // The ramp's surface is a ray cast on its model: only where a ramp stands (as app/cars.ts nearRamp).
  const ramp = rampBoxes().some(b => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) ? rampSurfaceAt(rampList(), x, z) : null;
  return Math.max(TILE_T + relief, ramp ?? -Infinity);
}
/** The ramps' boxes on the table, measured once their models have loaded. */
let boxes: THREE.Box3[] = [];
function rampBoxes(): THREE.Box3[] {
  if (!boxes.length || boxes.some(b => b.isEmpty())) boxes = rampList().map(o => new THREE.Box3().setFromObject(o));
  return boxes;
}
/** The ground under the vehicle as it stands now, for its suspensions. */
const groundNow = (): Ground => ({ heightAt: groundAt, base: vehicle.position.y });
/** The ramp pieces of the test tile, for their surface. */
function rampList(): THREE.Object3D[] {
  const list: THREE.Object3D[] = [];
  tile.traverse(o => { if (o.userData.ramp) list.push(o); });
  return list;
}

// ---- the other vehicles: the Big Rig's trailers, the cars a scenario slams ----
/** A vehicle of the bench other than the one in the panel: its model, parts, rig and root motion. */
interface Actor { sheet: VehicleSheet; root: THREE.Group; desc: PartsDescriptor; rig: PartsRig; move: Move | null; lastV: number; lastYaw: number; reach: number }
/** The Big Rig's trailers, front to back; the vehicles a scenario puts on the table. */
let train: Actor[] = [];
let cast: Actor[] = [];
function makeActor(s: VehicleSheet, at: THREE.Vector3): Actor {
  const root = buildTestVehicle(s);
  toTable(root, s, MM);
  root.position.copy(at);
  root.rotation.order = 'YXZ';
  root.updateMatrixWorld(true);
  scene.add(root);
  const d = describeVehicle(root);
  return { sheet: s, root, desc: d, rig: new PartsRig(d, s.show_mm * MM / s.length_m), move: null, lastV: 0, lastYaw: 0,
    reach: d.hitches.front ? hitchReach(root, d.hitches.front) : 0 };
}
function dropActors(list: Actor[]): void { for (const a of list) scene.remove(a.root); list.length = 0; }
/** The trailers behind the vehicle, each one space further back, in line. */
function lineUpTrain(): void {
  let ahead: THREE.Object3D = vehicle, hitch = desc.hitches.rear;
  for (const a of train) {
    ahead.updateMatrixWorld(true);
    const pull = hitch ? hitch.getWorldPosition(new THREE.Vector3()) : ahead.position.clone();
    // Standing on its own hitch it keeps its heading: in line with the piece ahead.
    a.root.rotation.set(0, ahead.rotation.y, 0);
    a.root.position.copy(pull);
    tow(a.root, pull, a.reach, ahead.rotation.y);
    a.root.position.y = groundAt(a.root.position.x, a.root.position.z) ?? TILE_T;
    a.rig.settle();
    ahead = a.root; hitch = a.desc.hitches.rear;
  }
}
/** One frame of the trailers: each pulled by the hitch ahead, its suspensions on the ground. */
function towTrain(dt: number): void {
  let ahead: THREE.Object3D = vehicle, hitch = desc.hitches.rear;
  for (const a of train) {
    ahead.updateMatrixWorld(true);
    const before = a.root.position.clone();
    const pull = hitch ? hitch.getWorldPosition(new THREE.Vector3()) : ahead.position.clone();
    tow(a.root, pull, a.reach, ahead.rotation.y);
    a.root.position.y = rideHeight(before.y, groundAt(a.root.position.x, a.root.position.z), dt);
    stepActorRig(a, dt, before);
    ahead = a.root; hitch = a.desc.hitches.rear;
  }
}
/** The springs and wheels of an actor after its root moved from `before` this frame. */
function stepActorRig(a: Actor, dt: number, before: THREE.Vector3, steer = 0): void {
  const nose = new THREE.Vector3(Math.cos(a.root.rotation.y), 0, -Math.sin(a.root.rotation.y));
  const fwd = a.root.position.clone().sub(before).setY(0).dot(nose);
  const v = dt > 0 ? Math.abs(fwd) / dt : a.lastV;
  const yaw = a.root.rotation.y;
  a.root.updateMatrixWorld(true);
  a.rig.update(dt, fwd, dt > 0 ? (v - a.lastV) / dt : 0, steer, dt > 0 ? wrapAngle(yaw - a.lastYaw) / dt : 0,
    { heightAt: groundAt, base: a.root.position.y });
  a.lastV = v; a.lastYaw = yaw;
}

// ---- the vehicle and its parts ----
interface Rest { susp: Map<THREE.Object3D, number>; barrel: number; body: THREE.Euler }
let sheet: VehicleSheet = VEHICLES[0].sheet;
/** Which of VEHICLES is on the bench. */
let current = 0;
let vehicle: THREE.Group;
let desc: PartsDescriptor;
let rest: Rest;
let rig: PartsRig;
const overlays: { axes: THREE.Object3D[]; sockets: THREE.Object3D[] } = { axes: [], sockets: [] };
const ghostMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
const HOME: Space = [2, 3];

/** The parts a crash threw on the table, cleared with the vehicle. */
const litter: THREE.Object3D[] = [];
function mount(i: number): void {
  if (vehicle) scene.remove(vehicle);
  for (const o of litter.splice(0)) o.removeFromParent();
  dropActors(train);
  dropActors(cast);
  current = i;
  const s = sheet = VEHICLES[i].sheet;
  vehicle = buildTestVehicle(s);
  toTable(vehicle, s, MM);
  vehicle.rotation.order = 'YXZ';
  vehicle.position.copy(spaceWorld(HOME));
  vehicle.updateMatrixWorld(true);
  // Its box on the table, without the dummies, as the jump wants it (motion/body.ts).
  const bare = buildTestVehicle(s, { crew: false });
  toTable(bare, s, MM);
  vehicle.userData.modelSize = new THREE.Box3().setFromObject(bare).getSize(new THREE.Vector3());
  scene.add(vehicle);
  desc = describeVehicle(vehicle);
  rest = {
    susp: new Map(desc.wheels.filter(w => w.susp).map(w => [w.susp!, w.susp!.position.y])),
    barrel: desc.turrets[0]?.barrel?.position.x ?? 0,
    body: desc.body?.rotation.clone() ?? new THREE.Euler(),
  };
  rig = new PartsRig(desc, s.show_mm * MM / s.length_m);
  train = (VEHICLES[i].trailers ?? []).map(t => makeActor(t, vehicle.position));
  lineUpTrain();
  ghostMats.clear();
  buildOverlays();
  applyShow();
  showDescriptor();
  frame();
}

function buildOverlays(): void {
  overlays.axes = [];
  overlays.sockets = [];
  const pivots = new Set<THREE.Object3D>();
  if (desc.body) pivots.add(desc.body);
  for (const w of desc.wheels) for (const n of [w.susp, w.steer, w.roll]) if (n) pivots.add(n);
  for (const t of desc.turrets) for (const n of [t.turret, t.gun, t.barrel]) if (n) pivots.add(n);
  const wheel = vehicle.getObjectByName('steering_wheel');
  if (wheel) pivots.add(wheel);
  for (const p of pivots) {
    const a = new THREE.AxesHelper(0.45);
    a.name = 'overlay';
    (a.material as THREE.Material).depthTest = false;
    a.renderOrder = 10;
    p.add(a);
    overlays.axes.push(a);
  }
  const dot = (parent: THREE.Object3D, color: number, r = 0.07): void => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    m.name = 'overlay';
    m.renderOrder = 11;
    parent.add(m);
    overlays.sockets.push(m);
  };
  for (const n of Object.values(desc.fx)) dot(n, 0xff3fd2);
  for (const t of desc.turrets) if (t.muzzle) dot(t.muzzle, 0xff3fd2, 0.09);
  for (const g of desc.grips) dot(g, 0x8fd18b, 0.045);
  vehicle.traverse(o => { if (o.name.startsWith('exit_')) dot(o, 0x39d0e8, 0.1); });
  for (const s of desc.seats) {
    const c = s.node.userData.clear as [number, number, number] | undefined;
    if (!c) continue;
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...c)), new THREE.LineBasicMaterial({ color: 0x8fd18b }));
    box.name = 'overlay';
    box.position.y = c[1] / 2;
    s.node.add(box);
    overlays.sockets.push(box);
  }
}

function applyShow(): void {
  const on = (id: string): boolean => ($<HTMLInputElement>(id)).checked;
  for (const a of overlays.axes) a.visible = on('oAxes');
  for (const s of overlays.sockets) s.visible = on('oSockets');
  vehicle.traverse(o => { if (o.name.startsWith('dummy_')) o.visible = on('oCrew'); });
  trail.visible = on('oPath');
  const ghost = on('oGhost');
  for (const part of ['body_mesh', 'cockpit_mesh']) {
    vehicle.getObjectByName(part)?.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (!ghostMats.has(m)) {
        ghostMats.set(m, m.material);
        const see = (m.material as THREE.MeshStandardMaterial).clone();
        see.transparent = true;
        see.opacity = 0.25;
        see.depthWrite = false;
        m.userData.ghost = see;
      }
      m.material = ghost ? (m.userData.ghost as THREE.Material) : ghostMats.get(m)!;
    });
  }
}

function showDescriptor(): void {
  const d = desc;
  const lines = [
    `origine: ${d.source === 'named' ? 'nomi del contratto' : 'tagli di oggi (ripiego)'}`,
    `capacità: ${[...d.capabilities].join(', ') || 'nessuna'}`,
    `ruote: ${d.wheels.map(w => `${w.axle}${w.side}${w.steer ? '·sterza' : ''}${w.susp ? '·sosp' : ''}`).join(' ')}`,
    `armi: ${d.turrets.map(t => [t.turret?.name, t.gun?.name, t.barrel?.name, t.muzzle?.name].filter(Boolean).join('→')).join(' | ') || 'nessuna'}`,
    `posti: ${d.seats.map(s => `${s.role} (${s.pose})`).join(', ') || 'nessuno'}`,
    `prese: ${[...Object.keys(d.fx), ...d.grips.map(g => `${g.parent?.name}/${g.name}`)].join(', ')}`,
  ];
  const problems = missingParts(d, sheet.capabilities as Capability[]);
  const el = $('desc');
  el.textContent = lines.join('\n') + '\n';
  const verdict = document.createElement('span');
  verdict.className = problems.length ? 'bad' : 'ok';
  verdict.textContent = problems.length ? `problemi:\n- ${problems.join('\n- ')}` : `la scheda dichiara: ${sheet.capabilities.join(', ')} — nessun pezzo mancante`;
  el.appendChild(verdict);
}

// ---- moving the parts by hand or in the demo ----
/** One pose of the parts, each value in [-1, 1] except `spin` (wheel angle, radians). */
interface Pose { steer: number; suspF: number; suspR: number; spin: number; turret: number; elev: number; kick: number; pitch: number; roll: number }
const SLIDERS: [keyof Pose, string][] = [
  ['steer', 'Sterzo'], ['suspF', 'Sosp. anteriore'], ['suspR', 'Sosp. posteriore'], ['spin', 'Ruote (giri/s)'],
  ['turret', 'Torretta'], ['elev', 'Alzo'], ['kick', 'Rinculo'], ['pitch', 'Beccheggio'], ['roll', 'Rollio'],
];
const hand: Pose = { steer: 0, suspF: 0, suspR: 0, spin: 0, turret: 0, elev: 0, kick: -1, pitch: 0, roll: 0 };
let mode: 'demo' | 'hand' | 'scenario' = 'demo';
let spinAngle = 0;

/** The demo: every part through its range, at its own pace, so a still picture shows them apart. */
function demoPose(t: number): Pose {
  const shot = (t % 1.6) / 0.3;
  return {
    steer: Math.sin(t * 0.9), suspF: Math.sin(t * 2.1), suspR: Math.sin(t * 2.1 + Math.PI / 2), spin: -t * Math.PI,
    turret: Math.sin(t * 0.45) * 0.6, elev: Math.sin(t * 0.8), kick: shot < 1 ? 1 - 2 * shot : -1,
    pitch: Math.sin(t * 1.3) * 0.4, roll: Math.sin(t * 1.7) * 0.4,
  };
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
/** Sets the parts to a pose through the descriptor: the motion system drives the same nodes. */
function pose(p: Pose): void {
  for (const w of desc.wheels) {
    w.roll.rotation.z = p.spin;
    if (w.steer) w.steer.rotation.y = p.steer * ((w.steer.userData.max as number | undefined) ?? 0.5);
    if (w.susp && w.travel) {
      const v = w.axle === 0 ? p.suspF : p.suspR;
      w.susp.position.y = rest.susp.get(w.susp)! + (v >= 0 ? v * w.travel[1] : -v * w.travel[0]);
    }
  }
  const wheel = vehicle.getObjectByName('steering_wheel');
  if (wheel) wheel.rotation.x = -p.steer * 2.5;
  for (const t of desc.turrets) {
    if (t.turret) t.turret.rotation.y = p.turret * (t.arc ? Math.min(Math.PI, Math.max(Math.abs(t.arc[0]), Math.abs(t.arc[1]))) : Math.PI);
    if (t.gun && t.elev) t.gun.rotation.z = lerp(t.elev[0], t.elev[1], (p.elev + 1) / 2);
    if (t.barrel) t.barrel.position.x = rest.barrel - (t.kick ?? 0) * (p.kick + 1) / 2;
  }
  if (desc.body) desc.body.rotation.set(rest.body.x + p.roll * 0.12, rest.body.y, rest.body.z + p.pitch * 0.12);
}

/** Puts the vehicle back on a space, flat and along the road, its parts at rest. */
function park(at: Space): void {
  vehicle.position.copy(spaceWorld(at));
  vehicle.rotation.set(0, 0, 0);
  pose({ ...hand, steer: 0, suspF: 0, suspR: 0, spin: 0, turret: 0, elev: 0, kick: -1, pitch: 0, roll: 0 });
  rig.settle();
  lineUpTrain();
}

// ---- scenarios ----
interface Step { kind: MotionPlan['kind']; plan: MotionPlan; from: number; took: number | null; moments: { m: Moment; t: number }[] }
interface Run {
  sc: Scenario; k: number; t: number;
  route: Route | null; jump: Jump | null; aim: Aim | null; target: THREE.Vector3 | null; track: MotionTrack;
  /** A root motion of the vehicle (hit, skid, tip over), a crash, the push of the one it slams. */
  move: Move | null; crash: Crash | null; push: { who: Actor; to: THREE.Vector3; at: number; started: boolean } | null;
  steps: Step[]; endAt: number | null; stillAt: number | null;
  lastPos: THREE.Vector3; lastV: number; lastYaw: number;
  /** The motorcycle's lean now (radians); the free spin of the wheels of a vehicle on its side (radians per second). */
  lean: number; wild: number;
  /** The director, in a scenario of scenes (S13, S14). */
  dir: Director | null;
}
let run: Run | null = null;
const trail = new THREE.Group();
scene.add(trail);

function startScenario(sc: Scenario): void {
  if (!sc.start || !sc.cmds) return;
  setMode('scenario');
  // A fresh vehicle every time: a crash takes its parts away, a tip leaves it on its side.
  mount(sc.vehicle ?? 0);
  selectVehicleButton(sc.vehicle ?? 0);
  park(sc.start);
  frame();
  cast = (sc.others ?? []).map(at => makeActor(CAR, spaceWorld(at)));
  trail.clear();
  emitters.length = 0;
  run = { sc, k: 0, t: 0, route: null, jump: null, aim: null, target: null, track: new MotionTrack(), steps: [], endAt: null, stillAt: null,
    move: null, crash: null, push: null, lastPos: vehicle.position.clone(), lastV: 0, lastYaw: 0, lean: 0, wild: 0, dir: null };
  if (sc.director) run.dir = makeDirector(run);
  document.querySelectorAll('#scenari button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.id === sc.id));
  drawTimeline();
}

/** Starts the next command of the scenario running now. */
function nextCommand(r: Run): void {
  const cmd = r.sc.cmds![r.k];
  let plan: MotionPlan;
  if (cmd.kind === 'drive') {
    const frames = cmd.to.map(() => ({ kind: 'move' }) as unknown as Frame);
    r.route = makeRoute(vehicle.position, cmd.to.map(spaceWorld), frames, cmd.to.map(groundOf), P.route, !cmd.free);
    plan = planDrive(r.route);
    drawPath(r.route);
  } else if (cmd.kind === 'jump') {
    const n = Number(($<HTMLSelectElement>('jumpN')).value);
    const stunt = ($<HTMLSelectElement>('jumpStunt')).value as JumpStunt;
    const list = rampList();
    r.jump = makeJump({ from: vehicle.position, rampAt: spaceWorld(cmd.ramp), to: spaceWorld([cmd.ramp[0], cmd.ramp[1] + n]), spaces: n, seed: 'banco', stunt },
      { space: SPACE, surfaceAt: (x, z) => rampSurfaceAt(list, x, z) });
    plan = planJump(r.jump);
  } else if (cmd.kind === 'slam') {
    const who = cast[cmd.target];
    r.move = hitMove(vehicle.position.clone(), who.root.position, vehicle.rotation.y, SPACE);
    const to = spaceWorld(cmd.push);
    const impact = r.move.jolt!.at;
    const pushing = pushMove(who.root.position.clone(), to, who.root.rotation.y, SPACE).plan.seconds;
    r.push = { who, to, at: impact, started: false };
    const seconds = Math.max(r.move.plan.seconds, impact + pushing);
    plan = { kind: 'hit', seconds, moments: [{ name: 'impact', at: impact }, { name: 'end', at: seconds }] };
    drawTarget(to);
  } else if (cmd.kind === 'skid') {
    r.move = skidMove(vehicle.position.clone(), vehicle.rotation.y, cmd.side, SPACE);
    plan = r.move.plan;
  } else if (cmd.kind === 'flip') {
    const size = vehicle.userData.modelSize as THREE.Vector3;
    r.move = flipMove(vehicle.position.clone(), vehicle.rotation.y, cmd.side, size.z / 2, size.y);
    plan = r.move.plan;
  } else if (cmd.kind === 'crash') {
    r.crash = makeCrash(vehicle, desc, scene, SPACE, 7);
    litter.push(...r.crash.debris.map(b => b.node));
    if (desc.body) char(desc.body);
    plan = r.crash.plan;
    vehicle.updateMatrixWorld(true);
    emit(desc.body ?? vehicle, 'fire', plan.seconds + 2.5);
  } else {
    vehicle.updateMatrixWorld(true);
    r.target = spaceWorld(cmd.at);
    r.aim = makeAim(desc.turrets[0], pointingAt(desc.turrets[0], r.target), cmd.rounds);
    plan = planAim(r.aim);
    drawTarget(r.target);
  }
  r.track.begin(plan);
  r.steps.push({ kind: plan.kind, plan, from: r.t, took: null, moments: [] });
}

/** One frame of the scenario running now (`dt` bench seconds, after the playback speed). */
function stepScenario(r: Run, dt: number): void {
  r.t += dt;
  const cmds = r.sc.cmds!;
  const busy = (): boolean => !!(r.route || r.jump || r.aim || r.move || r.crash);
  if (r.k < cmds.length && !busy()) nextCommand(r);
  if (r.dir) tickDirector(r);
  const before = vehicle.position.clone();
  let done = false, steer = 0;
  if (r.route) {
    const at = stepDrive(r.route, dt, SPACE);
    // The whole car rides with the ground under its middle: down into the mud, up onto the off-road.
    vehicle.position.set(at.pos.x, rideHeight(before.y, groundAt(at.pos.x, at.pos.z), dt), at.pos.z);
    // A motorcycle leans into its turns.
    if (VEHICLES[current].bike && dt > 0) {
      const v = Math.hypot(at.pos.x - before.x, at.pos.z - before.z) / dt;
      const want = bikeLean(v, wrapAngle(at.yaw - r.lastYaw) / dt);
      r.lean += (want - r.lean) * Math.min(1, dt * P.motion.bike.leanRate);
    }
    vehicle.rotation.set(-r.lean, at.yaw, 0);
    steer = at.steer;
    done = at.done;
  } else if (r.move) {
    const res = stepMove(vehicle, r.move, dt);
    if (res.jolt) rig.jolt(res.jolt.pitch, res.jolt.roll);
    let pushDone = true;
    if (r.push) {
      const p = r.push;
      if (!p.started && r.move.t >= p.at) {
        p.started = true;
        p.who.move = pushMove(p.who.root.position.clone(), p.to, p.who.root.rotation.y, SPACE);
      }
      pushDone = p.started && !p.who.move;
    }
    done = res.done && pushDone;
    if (res.done && r.move.kind === 'flip' && r.wild === 0) {
      r.wild = 30;
      if (desc.fx.fx_smoke) emit(desc.fx.fx_smoke, 'smoke', 5);
    }
  } else if (r.crash) {
    ({ done } = stepCrash(r.crash, dt, SPACE, (x, z) => groundAt(x, z) ?? TILE_T));
  } else if (r.jump) {
    const list = rampList();
    ({ done } = stepJump(vehicle, r.jump, dt, { space: SPACE, surfaceAt: (x, z) => rampSurfaceAt(list, x, z), onTouch: () => undefined }));
  } else if (r.aim) {
    const res = stepAim(r.aim, dt);
    done = res.done;
    for (const _ of res.fired) { muzzleFlash(r.aim, r.target!); rig.kick(r.aim.turret.turret?.rotation.y ?? 0); }
  }
  // Rolling only along its nose: a skid or a push sideways does not turn the wheels.
  const nose = new THREE.Vector3(Math.cos(vehicle.rotation.y), 0, -Math.sin(vehicle.rotation.y));
  const fwd = r.move || r.crash ? vehicle.position.clone().sub(before).setY(0).dot(nose) : Math.hypot(vehicle.position.x - before.x, vehicle.position.z - before.z);
  const v = dt > 0 ? Math.abs(fwd) / dt : r.lastV;
  const yaw = vehicle.rotation.y;
  vehicle.updateMatrixWorld(true);
  rig.update(dt, fwd, dt > 0 ? (v - r.lastV) / dt : 0, steer, dt > 0 ? wrapAngle(yaw - r.lastYaw) / dt : 0, groundNow());
  r.lastV = v; r.lastYaw = yaw;
  // On its side its wheels spin on, slowing.
  if (r.wild > 0.01) {
    for (const w of desc.wheels) w.roll.rotation.z -= r.wild * dt;
    r.wild *= Math.exp(-dt * 0.5);
  }
  towTrain(dt);
  for (const a of cast) {
    const b = a.root.position.clone();
    if (a.move) {
      const res = stepMove(a.root, a.move, dt);
      if (res.jolt) a.rig.jolt(res.jolt.pitch, res.jolt.roll);
      if (res.done) a.move = null;
    }
    stepActorRig(a, dt, b);
  }
  // In a scenario of scenes the director's queue starts the motions; each one ends on its own.
  if (r.dir && done) { r.route = null; r.move = null; r.crash = null; r.jump = null; r.aim = null; }
  const step = r.steps[r.steps.length - 1];
  if (step && busy()) {
    for (const m of r.track.advance(dt, done)) step.moments.push({ m, t: r.t - step.from });
    if (done) {
      step.took = r.t - step.from;
      r.route = null; r.jump = null; r.aim = null; r.move = null; r.crash = null; r.push = null; r.k++;
      if (r.k >= cmds.length) r.endAt = r.t;
    }
  }
  const springs = [rig.springs(), ...train.map(a => a.rig.springs()), ...cast.map(a => a.rig.springs())].flat();
  if (r.dir) { if (r.endAt !== null && r.stillAt === null && benchStill()) r.stillAt = r.t; return; }
  if (r.endAt !== null && r.stillAt === null && r.track.still(springs)) r.stillAt = r.t;
}

// ---- the director: the rules' frames played as scenes, one shot each (phase 5) ----
/** An FX die thrown beside the action: from above the action to where it lands, tumbling. */
interface BenchDie { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; landed: boolean }
/** The shot the director takes for a scene: its candidate, side and subjects (live). */
interface Take { spec: ShotSpec; yaw: number; subjects: () => Subject[]; t0: number; from: CamPose; scene: number }
interface Director {
  q: SceneQueue; frames: Frame[]; scenes: Scene[];
  /** The car each id stands for; the drive of a scene, worked out when it is laid out. */
  who: Map<string, THREE.Object3D>; routes: Map<Scene, Route>;
  dice: BenchDie[]; take: Take | null;
  /** The scene each shot was taken for, in order: two for one scene would be a cut inside it. */
  cuts: number[];
  /** Effects due at a salient moment (the impact). */
  due: { at: number; fn: () => void }[];
  log: string[]; skipped: boolean;
  /** Each scene as it began: when, and its layout. */
  laid: { scene: Scene; times: SceneTimes; from: number }[];
}
const camOwner = new CameraOwner();
const DEG = Math.PI / 180;
const ROAD = new THREE.Vector3(1, 0, 0);
const fr = (kind: Frame['kind'], extra: Partial<Frame> = {}): Frame => ({ kind, snap: {} as Frame['snap'], ...extra });

/**
 * The frames of a slam as the rules give them (p. 9): the orange car (A) drives into the space of
 * the other (B); the slam die says the car below moves, the direction die front left; B is pushed
 * there and takes damage.
 */
function slamFrames(): Frame[] {
  return [
    fr('move', { vehicleId: 'A', at: { r: 3, c: 2 } }), fr('move', { vehicleId: 'A', at: { r: 2, c: 3 } }),
    fr('slam', { vehicleId: 'A', at: { r: 2, c: 3 } }), fr('log', { text: 'SLAM! Auto di collaudo contro auto ferma.', logKind: 'bad' }),
    fr('roll', { die: { die: 'slam', face: 1, value: 'bottom' }, at: { r: 2, c: 3 } }),
    fr('roll', { die: { die: 'direction', face: 1, value: 'FL' }, at: { r: 2, c: 3 } }),
    fr('log', { text: 'Dado slam: si muove il veicolo sotto; direzione avanti-sinistra.', logKind: 'dice' }),
    fr('move', { vehicleId: 'B', at: { r: 1, c: 3 } }),
    fr('damage', { vehicleId: 'B', at: { r: 1, c: 3 } }),
  ];
}

function makeDirector(r: Run): Director {
  const frames = slamFrames();
  const d: Director = {
    q: null as unknown as SceneQueue, frames, scenes: [], who: new Map([['A', vehicle], ['B', cast[0].root]]), routes: new Map(),
    dice: [], take: null, cuts: [], due: [], log: [], skipped: false, laid: [],
  };
  const spaceOf = (f: Frame): Space => [f.at!.r, f.at!.c];
  const occupied = (sp: Space): boolean => cast.some(a => a.root.position.distanceTo(spaceWorld(sp)) < SPACE * 0.3);
  /** The drive of a scene: through its spaces, stopping short of one another car stands on (the slam comes next). */
  const routeOf = (sc: Scene): Route => {
    let rt = d.routes.get(sc);
    if (rt) return rt;
    const spaces = sc.frames.filter(f => f.kind === 'move').map(spaceOf);
    while (spaces.length > 1 && occupied(spaces[spaces.length - 1])) spaces.pop();
    rt = makeRoute(vehicle.position, spaces.map(spaceWorld), spaces.map(() => fr('move')), spaces.map(groundOf), P.route, true);
    d.routes.set(sc, rt);
    return rt;
  };
  d.q = new SceneQueue({
    still: benchStill,
    length: (f, sc, i) => {
      if (f.kind === 'move' && sc.kind === 'drive') {
        // Time between arrivals, from the drive's plan (motion/drive.ts); a space not driven to takes none.
        const arrive = planDrive(routeOf(sc)).moments.filter(m => m.name === 'space').map(m => m.at);
        const k = sc.frames.slice(0, i + 1).filter(x => x.kind === 'move').length - 1;
        if (k >= arrive.length) return 0;
        return k === 0 ? arrive[0] : arrive[k] - arrive[k - 1];
      }
      if (f.kind === 'slam') return P.motion.moves.hitSeconds;
      if (f.kind === 'roll') return P.diceThrow.seconds;
      if (f.kind === 'move') {
        const o = d.who.get(f.vehicleId!)!;
        return pushMove(o.position.clone(), spaceWorld(spaceOf(f)), o.rotation.y, SPACE).plan.seconds;
      }
      return (P.beats.seconds as Partial<Record<Frame['kind'], number>>)[f.kind] ?? 0.3;
    },
    apply: (f, sc) => applyFrame(r, d, f, sc, routeOf),
    begin: (sc, times) => { d.laid.push({ scene: sc, times, from: r.t }); takeShot(d, sc); },
    jumpToEnd: fs => { for (const f of fs) if (f.kind === 'log') d.log.push(f.text ?? ''); jumpToEnd(r, d); },
  });
  d.scenes = d.q.push(frames);
  return d;
}

/** Shows one frame of the scene playing: starts the motion it stands for, throws a die, an effect. */
function applyFrame(r: Run, d: Director, f: Frame, sc: Scene, routeOf: (sc: Scene) => Route): void {
  if (f.kind === 'log') { d.log.push(f.text ?? ''); return; }
  if (f.kind === 'move' && sc.kind === 'drive') {
    // The scene's drive starts with its first space; the others are its arrivals.
    if (sc.frames.find(x => x.kind === 'move') === f) { r.route = routeOf(sc); drawPath(r.route); }
    return;
  }
  const B = cast[0];
  if (f.kind === 'slam') {
    r.move = hitMove(vehicle.position.clone(), B.root.position, vehicle.rotation.y, SPACE);
    const at = spaceWorld([f.at!.r, f.at!.c]);
    // The effects on the salient moment: sparks at the impact.
    d.due.push({ at: r.t + r.move.jolt!.at, fn: () => { spark(at, 0xff6a2a); spark(at.clone().setY(at.y + SPACE * 0.1), 0xffffff); } });
    return;
  }
  if (f.kind === 'roll') { throwDie(d, f); return; }
  if (f.kind === 'move') {
    // The push: the car pushed slides to its new space; the one that slammed takes the space it entered.
    const to = spaceWorld([f.at!.r, f.at!.c]);
    B.move = pushMove(B.root.position.clone(), to, B.root.rotation.y, SPACE);
    const into = d.frames.filter(x => x.kind === 'move' && x.vehicleId === 'A').pop()!;
    r.move = pushMove(vehicle.position.clone(), spaceWorld([into.at!.r, into.at!.c]), vehicle.rotation.y, SPACE);
    drawTarget(to);
    return;
  }
  if (f.kind === 'damage') {
    const o = d.who.get(f.vehicleId!)!;
    spark(o.position.clone().setY(o.position.y + SPACE * 0.2), 0xff2a2a);
    B.rig.jolt(0.5, 0.8);
  }
}

/** A short burst at a point (an impact, damage). */
function spark(at: THREE.Vector3, color: number): void {
  const m = new THREE.Mesh(new THREE.SphereGeometry(SPACE * 0.12, 14, 10), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  m.position.copy(at);
  scene.add(m);
  puffs.push({ obj: m, life: 0.45, t: 0, up: 0 });
}

const DIE_FACE: Record<string, number> = { slam: 0xd83c3c, direction: 0x3d7fd1, shooting: 0x3fae5c, stunt: 0xe8c53a };
/** The FX dice at their size on the table (the catalogue's die, as app/board.ts DIE_W). */
const DIE_SIZE = sizeOf(CAT, 'die')[0] * MM;
/**
 * Throws an FX die beside the action (§A.5): along the road, ahead of the action's space, so the
 * camera sees it beside the cars, never in front of or behind them; never on their spaces.
 */
function throwDie(d: Director, f: Frame): void {
  const at = f.at ? spaceWorld([f.at.r, f.at.c]) : vehicle.position.clone();
  const k = d.dice.length;
  const to = at.clone().add(new THREE.Vector3(SPACE * (1.1 + k * 0.4), 0, SPACE * (k % 2 ? 0.15 : -0.15)));
  to.y = (groundAt(to.x, to.z) ?? TILE_T) + DIE_SIZE / 2;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE),
    new THREE.MeshStandardMaterial({ color: DIE_FACE[String(f.die?.die)] ?? 0xdddddd, roughness: 0.4 }));
  mesh.castShadow = true;
  const from = at.clone().setY(at.y + SPACE * 0.9);
  mesh.position.copy(from);
  trail.add(mesh);
  d.dice.push({ mesh, from, to, t: 0, landed: false });
}
function stepDice(d: Director, dt: number): void {
  const T = P.diceThrow.seconds;
  for (const x of d.dice) {
    if (x.landed) continue;
    x.t = Math.min(T, x.t + dt);
    const u = x.t / T;
    x.mesh.position.lerpVectors(x.from, x.to, 1 - (1 - u) * (1 - u));
    x.mesh.position.y += Math.sin(Math.min(1, u * 1.3) * Math.PI) * SPACE * 0.5 * (1 - u);
    x.mesh.rotation.set(u * 9 * (1 - u * 0.6), u * 5, u * 7 * (1 - u * 0.6));
    if (x.t >= T) { x.landed = true; x.mesh.position.copy(x.to); x.mesh.rotation.set(0, 0.3, 0); }
  }
}

/** True when the bench is truly still: no motion running, every spring at rest, every die down. */
function benchStill(): boolean {
  if (!run) return true;
  if (run.route || run.move || run.crash || cast.some(a => a.move)) return false;
  if (run.dir && run.dir.dice.some(x => !x.landed)) return false;
  const springs = [rig.springs(), ...train.map(a => a.rig.springs()), ...cast.map(a => a.rig.springs())].flat();
  return springs.every(x => springStill(x));
}

/** "Salta scena": every car to where the frames leave it, still on its springs; the dice down. */
function jumpToEnd(r: Run, d: Director): void {
  r.route = null; r.move = null; r.push = null;
  for (const a of cast) a.move = null;
  for (const [id, o] of d.who) {
    const last = d.frames.filter(f => f.kind === 'move' && f.vehicleId === id).pop();
    if (!last?.at) continue;
    const at = spaceWorld([last.at.r, last.at.c]);
    o.position.set(at.x, groundAt(at.x, at.z) ?? at.y, at.z);
    o.rotation.set(0, 0, 0);
    o.updateMatrixWorld(true);
  }
  // The springs at rest on the ground where each car now stands: nothing moves after the skip.
  rig.settle(groundNow());
  for (const a of cast) a.rig.settle({ heightAt: groundAt, base: a.root.position.y });
  // Standing: no speed carried over, or the next frame would read the jump as a sudden stop.
  r.lastV = 0; r.lastYaw = vehicle.rotation.y; r.lean = 0;
  for (const a of cast) { a.lastV = 0; a.lastYaw = a.root.rotation.y; }
  for (const x of d.dice) { x.t = P.diceThrow.seconds; x.landed = true; x.mesh.position.copy(x.to); x.mesh.rotation.set(0, 0.3, 0); }
  d.due.length = 0;
  d.skipped = true;
}

/** The director's one shot for a scene: the best of the event's candidates on its subjects (§B). */
function takeShot(d: Director, sc: Scene): void {
  if (sc.kind === 'log') return;
  const SP = SPACE, Dd = P.director;
  const subjects = (): Subject[] => {
    if (sc.kind === 'drive') {
      const rt = d.routes.get(sc);
      const end = rt ? rt.pts[rt.pts.length - 1] : vehicle.position;
      return [{ at: vehicle.position.clone(), r: Dd.subject.car * SP, weight: 2 }, { at: end.clone(), r: Dd.subject.car * SP }];
    }
    // The action's space with the six around it, and where its dice land.
    const at = sc.at ? spaceWorld([sc.at.r, sc.at.c]) : vehicle.position.clone();
    return [{ at, r: Dd.subject.slam * SP, weight: 2 }, ...d.dice.map(x => ({ at: x.to.clone(), r: Dd.subject.die * SP }))];
  };
  const specs = (Dd.shots[sc.kind] ?? Dd.shots.default).map(x => ({ id: x.id, yaw: x.yaw * DEG, elev: x.elev * DEG, fill: x.fill, near: (x.near ?? 2) * SP }));
  const best = chooseShot(specs, ROAD, subjects(), safeNow(), { fov: camera.fov, aspect: camera.aspect }, { blockers: [], floor: TILE_T + Dd.floor * SP });
  if (!best) return;
  camOwner.take('director');
  d.take = { spec: best.spec, yaw: best.yaw, subjects, t0: run!.t, from: { pos: camera.position.clone(), look: controls.target.clone() }, scene: d.laid.length - 1 };
  d.cuts.push(d.laid.length - 1);
}
/** The free part of the screen: beside the panel. */
function safeNow(): ReturnType<typeof toFrame> {
  const p = $('panel').getBoundingClientRect();
  return toFrame(freeRect(innerWidth, innerHeight, [{ left: p.left, top: p.top, right: p.right, bottom: p.bottom }]), innerWidth, innerHeight);
}
/** One frame of the director's camera: the shot's pose on its subjects where they are now, eased in from where the camera was. */
function directorCamera(d: Director, dt: number): void {
  const tk = d.take;
  if (!tk || !camOwner.holds('director')) return;
  const Dd = P.director;
  const pose = framePose(shotDir(ROAD, tk.yaw, tk.spec.elev), tk.subjects(), safeNow(), { fov: camera.fov, aspect: camera.aspect }, tk.spec.fill, tk.spec.near, TILE_T + Dd.floor * SPACE);
  const u = Math.min(1, (run!.t - tk.t0) / Dd.shot.blendIn), e = u * u * (3 - 2 * u);
  if (e >= 1) {
    // Arrived: it follows its subjects smoothly.
    const k = 1 - Math.exp(-dt * Dd.shot.follow);
    tk.from.pos.lerp(pose.pos, k);
    tk.from.look.lerp(pose.look, k);
    camera.position.copy(tk.from.pos);
    controls.target.copy(tk.from.look);
  } else {
    camera.position.lerpVectors(tk.from.pos, pose.pos, e);
    controls.target.lerpVectors(tk.from.look, pose.look, e);
  }
  camera.lookAt(controls.target);
}
/** One step of the director: its queue on the bench's clock, the effects due, "Salta scena". */
function tickDirector(r: Run): void {
  const d = r.dir!;
  if (r.sc.skipAt !== undefined && !d.skipped && r.t >= r.sc.skipAt) d.q.skip(r.t);
  d.q.tick(r.t);
  for (let i = d.due.length - 1; i >= 0; i--) if (r.t >= d.due[i].at) { d.due[i].fn(); d.due.splice(i, 1); }
  if (d.q.phase === 'idle' && !d.q.current() && r.endAt === null && d.q.played.length >= d.scenes.length) {
    r.endAt = r.t;
    camOwner.release('director');
  }
}

/** A target marker on the table: a red ring with a post. */
function drawTarget(at: THREE.Vector3): void {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xff4040, side: THREE.DoubleSide, depthTest: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(at).setY(at.y + 0.02);
  trail.add(ring);
}

/** Short-lived effects of the bench: a muzzle flash and a tracer to the target, fading. */
const flashes: { obj: THREE.Object3D; life: number; t: number }[] = [];
function muzzleFlash(a: Aim, target: THREE.Vector3): void {
  const m = a.turret.muzzle;
  if (!m) return;
  const at = m.getWorldPosition(new THREE.Vector3());
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true }));
  flash.position.copy(at);
  const tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([at, target.clone().setY(target.y + 0.05)]),
    new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true }));
  scene.add(flash, tracer);
  flashes.push({ obj: flash, life: P.motion.aim.flash * 2, t: 0 }, { obj: tracer, life: P.motion.aim.flash * 3, t: 0 });
}
/** Smoke from a vehicle on its side, flames from a wreck: puffs given off by a node for a while. */
const emitters: { node: THREE.Object3D; kind: 'smoke' | 'fire'; left: number; acc: number }[] = [];
const puffs: { obj: THREE.Mesh; life: number; t: number; up: number }[] = [];
function emit(node: THREE.Object3D, kind: 'smoke' | 'fire', seconds: number): void {
  if (!emitters.some(e => e.node === node && e.kind === kind)) emitters.push({ node, kind, left: seconds, acc: 0 });
}
function tickFlashes(dt: number): void {
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.t += dt;
    const k = 1 - f.t / f.life;
    ((f.obj as THREE.Mesh).material as THREE.Material).opacity = Math.max(0, k);
    if (k <= 0) { scene.remove(f.obj); flashes.splice(i, 1); }
  }
  for (let i = emitters.length - 1; i >= 0; i--) {
    const e = emitters[i];
    e.left -= dt;
    e.acc += dt;
    const fire = e.kind === 'fire';
    const every = fire ? 0.04 : 0.09;
    while (e.acc > every) {
      e.acc -= every;
      const at = e.node.getWorldPosition(new THREE.Vector3());
      const m = new THREE.Mesh(new THREE.SphereGeometry(SPACE * (fire ? 0.06 : 0.07), 10, 8),
        new THREE.MeshBasicMaterial({ color: fire ? (Math.random() < 0.5 ? 0xff7a1a : 0xffc23a) : 0x6b6560, transparent: true, depthWrite: false }));
      m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * SPACE * 0.3, 0, (Math.random() - 0.5) * SPACE * 0.2));
      scene.add(m);
      puffs.push({ obj: m, life: fire ? 0.7 : 1.6, t: 0, up: SPACE * (fire ? 0.5 : 0.3) });
    }
    if (e.left <= 0) emitters.splice(i, 1);
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    p.t += dt;
    const k = p.t / p.life;
    p.obj.position.y += p.up * dt;
    p.obj.scale.setScalar(1 + k * 1.8);
    (p.obj.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - k));
    if (k >= 1) { scene.remove(p.obj); puffs.splice(i, 1); }
  }
}
/** Heading difference wrapped to (-pi, pi]. */
function wrapAngle(a: number): number { return Math.atan2(Math.sin(a), Math.cos(a)); }

/** The route as a line on the table, with a dot on each space it gets to. */
function drawPath(route: Route): void {
  const pts = route.pts.map(p => p.clone().setY(p.y + 0.02));
  trail.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x39d0e8, depthTest: false })));
  for (const d of route.marks.slice(1).concat(route.len)) {
    const i = route.cum.findIndex(c => c >= d - 1e-9);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x39d0e8, depthTest: false }));
    m.position.copy(pts[Math.max(0, i)]);
    trail.add(m);
  }
}

const fmt = (s: number): string => s.toFixed(2).replace('.', ',');
const MOMENT: Record<Moment['name'], string> = { space: 'casella', lip: 'stacco', touch: 'atterraggio', aimed: 'mirato', shot: 'colpo', impact: 'urto', end: 'fine' };
const KIND: Record<MotionPlan['kind'], string> = {
  drive: 'guida', jump: 'salto', aim: 'mira e sparo', idle: 'fermo',
  push: 'spinta', hit: 'urto e spinta', skid: 'sbandata', flip: 'ribaltamento', crash: 'schianto', fall: 'caduta',
  spin: 'testacoda', slew: 'scivolata', quake: 'terremoto', hop: 'decollo',
};
function drawTimeline(): void {
  const el = $('timeline');
  if (!run) { el.textContent = 'Scegli uno scenario.'; return; }
  const lines = [`${run.sc.id} ${run.sc.name} · t = ${fmt(run.t)} s`];
  if (run.dir) {
    const d = run.dir, cur = d.q.current();
    const PH: Record<string, string> = { idle: 'ferma', wait: 'attende il tavolo fermo', prep: 'preparazione', action: 'azione', hold: 'lettura' };
    d.scenes.forEach((sc, k) => {
      const laid = d.laid.find(x => x.scene === sc), played = d.q.played.find(x => x.scene === sc);
      const real = played ? ` · reale ${fmt(played.to - played.from)} s${played.skipped ? ' (saltata)' : ''}` : cur?.scene === sc ? ` · ${PH[d.q.phase]}` : '';
      const plan = laid ? ` · piano ${fmt(laid.times.seconds)} s (prep ${fmt(laid.times.prep)} + azione ${fmt(laid.times.action)} + lettura ${fmt(laid.times.hold)})` : '';
      lines.push(`scena ${k + 1} ${sc.kind}: ${sc.frames.filter(f => f.kind !== 'log').map(f => (f.kind === 'roll' ? `dado ${f.die?.die}` : f.kind)).join(', ')}${plan}${real}`);
    });
    const p = d.q.played;
    const overlap = p.some((x, k) => k > 0 && x.from < p[k - 1].to - 1e-9);
    const cutsIn = d.cuts.length - new Set(d.cuts).size;
    lines.push(`sovrapposizioni: ${overlap ? 'SÌ' : 'nessuna'} · stacchi dentro una scena: ${cutsIn} · camera: ${camOwner.owner ?? 'libera'}`);
    if (d.log.length) lines.push(`registro: ${d.log[d.log.length - 1]}`);
    lines.push(run.endAt !== null ? `scene finite a ${fmt(run.endAt)} s` : `fase: ${PH[d.q.phase]}`);
    lines.push(run.stillAt !== null ? `fermo vero a ${fmt(run.stillAt)} s` : 'fermo vero: non ancora');
    el.textContent = lines.join('\n');
    return;
  }
  for (const s of run.steps) {
    const off = s.took === null ? '' : ` · reale ${fmt(s.took)} s (${s.took >= s.plan.seconds ? '+' : ''}${((s.took / s.plan.seconds - 1) * 100).toFixed(1).replace('.', ',')}%)`;
    lines.push(`${KIND[s.kind]}: piano ${fmt(s.plan.seconds)} s${off}`);
    lines.push('  ' + s.plan.moments.map(m => {
      const seen = s.moments.find(x => x.m === m);
      return `${MOMENT[m.name]}${m.index !== undefined ? ` ${m.index + 1}` : ''} ${fmt(m.at)}${seen ? ` → ${fmt(seen.t)}` : ''}`;
    }).join(' · '));
  }
  const status = run.track.status === 'done' ? 'finito' : run.track.status === 'running' ? 'in corso' : 'pianificato';
  lines.push(`stato: ${status}${run.endAt !== null ? ` · traiettoria finita a ${fmt(run.endAt)} s` : ''}`);
  lines.push(run.stillAt !== null ? `fermo vero a ${fmt(run.stillAt)} s (+${fmt(run.stillAt - (run.endAt ?? 0))} s di assestamento)` : 'fermo vero: non ancora');
  el.textContent = lines.join('\n');
}

// ---- clock ----
let t = 0, speed = 1, paused = false, stepOnce = false;
function setPaused(v: boolean): void {
  paused = v;
  $('pause').textContent = paused ? 'Riprendi' : 'Pausa';
  $('pause').classList.toggle('on', paused);
}
function setMode(m: typeof mode): void {
  if (m !== 'scenario' && mode === 'scenario') { run = null; trail.clear(); park(HOME); drawTimeline(); document.querySelectorAll('#scenari button').forEach(b => b.classList.remove('on')); }
  mode = m;
  $('mDemo').classList.toggle('on', m === 'demo');
  $('mHand').classList.toggle('on', m === 'hand');
}

function frame(): void {
  const target = vehicle.position.clone().add(new THREE.Vector3(0, sheet.show_mm * MM * 0.18, 0));
  const L = sheet.show_mm * MM;
  camera.position.copy(target).add(new THREE.Vector3(-L * 1.7, L * 1.15, L * 2.1));
  controls.target.copy(target);
  controls.update();
}
/** Keeps the camera on the vehicle as it drives, the same way round. */
function follow(dt: number): void {
  const target = vehicle.position.clone().add(new THREE.Vector3(0, sheet.show_mm * MM * 0.18, 0));
  const move = target.clone().sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 4));
  controls.target.add(move);
  camera.position.add(move);
}

// ---- export ----
async function exportGlb(): Promise<void> {
  const note = $('exportNote');
  note.textContent = 'esporto…';
  const clean = buildTestVehicle(sheet, { crew: false });
  const glb = await new GLTFExporter().parseAsync(clean, { binary: true }) as ArrayBuffer;
  // Read it back as the game will, and check the descriptor survived the trip (names and extras).
  const back = await new GLTFLoader().parseAsync(glb, '');
  const d = describeVehicle(back.scene);
  const problems = missingParts(d, sheet.capabilities as Capability[]);
  note.textContent = `${(glb.byteLength / 1024).toFixed(0)} KB · riletto: ${d.wheels.length} ruote, ${[...d.capabilities].join(', ')}` +
    (problems.length ? ` · problemi: ${problems.join('; ')}` : ' · nessun pezzo mancante');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
  a.download = `${sheet.id}.glb`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---- panel ----
function buildPanel(): void {
  const vs = $('vehicles');
  VEHICLES.forEach((v, i) => {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.classList.toggle('on', i === 0);
    b.onclick = () => { setMode('demo'); selectVehicleButton(i); mount(i); };
    vs.appendChild(b);
  });
  const box = $('sliders');
  for (const [key, label] of SLIDERS) {
    const l = document.createElement('label');
    l.className = 'slider';
    l.innerHTML = `<span>${label}</span><input type="range" min="-1" max="1" step="0.01" value="${hand[key]}"><output>${hand[key].toFixed(2)}</output>`;
    const input = l.querySelector('input')!, out = l.querySelector('output')!;
    input.oninput = () => { hand[key] = Number(input.value); out.textContent = hand[key].toFixed(2); setMode('hand'); };
    box.appendChild(l);
  }
  $('mDemo').onclick = () => setMode('demo');
  $('mHand').onclick = () => setMode('hand');
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => {
    b.onclick = () => {
      speed = Number(b.dataset.speed);
      document.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
    };
  });
  $('pause').onclick = () => setPaused(!paused);
  $('step').onclick = () => { setPaused(true); stepOnce = true; };
  $('restart').onclick = () => { t = 0; spinAngle = 0; if (run) startScenario(run.sc); };
  for (const id of ['oAxes', 'oSockets', 'oCrew', 'oGhost', 'oPath']) $(id).onchange = applyShow;
  $('export').onclick = () => { void exportGlb(); };
  $('frame').onclick = frame;
  const list = $('scenari');
  for (const sc of SCENARIOS) {
    const li = document.createElement('li');
    const ready = !!sc.cmds;
    li.innerHTML = `<span><b>${sc.id}</b> ${sc.name}</span>` +
      (ready ? `<button data-id="${sc.id}">Avvia</button>` : `<span class="phase">fase ${sc.phase}</span>`);
    li.querySelector('button')?.addEventListener('click', () => startScenario(sc));
    list.appendChild(li);
  }
  const n = $<HTMLSelectElement>('jumpN'), st = $<HTMLSelectElement>('jumpStunt');
  for (const k of [1, 2, 3, 4]) n.add(new Option(`${k} ${k === 1 ? 'casella' : 'caselle'}`, String(k)));
  n.value = '3';
  for (const [v, label] of STUNTS) st.add(new Option(label, v));
}

/** Shows which vehicle is on the bench in the panel. */
function selectVehicleButton(i: number): void {
  $('vehicles').querySelectorAll('button').forEach((x, k) => x.classList.toggle('on', k === i));
}

buildPanel();
// The player's hand on the table takes the view back from the director at once (§B.9).
renderer.domElement.addEventListener('pointerdown', () => { if (camOwner.take('player')) controls.enabled = true; });
renderer.domElement.addEventListener('wheel', () => { if (camOwner.take('player')) controls.enabled = true; });
mount(0);
drawTimeline();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const clock = new THREE.Clock();
let drawn = 0;
renderer.setAnimationLoop(() => {
  const real = Math.min(clock.getDelta(), 0.1);
  const dt = stepOnce ? 1 / 60 : paused ? 0 : real * speed;
  stepOnce = false;
  t += dt;
  tickFlashes(dt);
  if (mode === 'scenario' && run) {
    stepScenario(run, dt);
    if (run.dir) { stepDice(run.dir, dt); directorCamera(run.dir, dt); controls.enabled = !camOwner.holds('director'); }
    if ($<HTMLInputElement>('oFollow').checked && !(run.dir && camOwner.holds('director'))) follow(real);
    if ((drawn += real) > 0.1 || dt === 1 / 60) { drawn = 0; drawTimeline(); }
  } else {
    spinAngle -= hand.spin * Math.PI * 2 * dt;
    pose(mode === 'demo' ? demoPose(t) : { ...hand, spin: spinAngle });
  }
  $('clock').textContent = `t = ${fmt(t)} s · ${String(speed).replace('.', ',')}×${paused ? ' · in pausa' : ''}`;
  controls.update();
  renderer.render(scene, camera);
});

/** For the bench's browser checks (tests/integration). */
(window as unknown as { __bench: unknown }).__bench = {
  get t() { return t; }, get desc() { return desc; }, get vehicle() { return vehicle; }, get run() { return run; },
  get train() { return train; }, get cast() { return cast; }, get camOwner() { return camOwner; },
  setPaused, setTime: (v: number) => { t = v; }, exportGlb, groundAt,
  play: (id: string) => { const sc = SCENARIOS.find(s => s.id === id); if (sc) startScenario(sc); },
};
