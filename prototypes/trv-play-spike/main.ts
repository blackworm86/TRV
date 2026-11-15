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
  type Game, type Decision, type Pos, type Vehicle, type Setup, type LogEntry, type Player,
} from '../../src/game/trv/engine';
import { BASE_CATALOG as CAT, sizeOf, ofKind } from '../../src/game/trv/catalog';
import { Pieces, TextureBank } from '../../src/view/pieces3d';
import { buildTile, hazardToken, spaceCenterPx, GRID, TILE_PITCH_PX } from '../../src/view/board3d';
import { dieSvg, dashboardSvg, commandBoardSvg, chopperSvg, avatarSvg, dataUrl } from '../../src/view/vector/art';
import { newSeed } from '../../src/platform/entropy';
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
function showTiles(): void {
  if (!g) return;
  g.board.forEach((t, i) => {
    const startFace = t.tile === 1 && g!.tilesPlaced === 3;
    const key = `${t.tile}${t.side}${startFace ? g!.players.length : ''}`;
    let grp = tileCache.get(key);
    if (!grp) {
      grp = buildTile(tileDef(t), { width: TILE_W, depth: TILE_H, thickness: TILE_T, ...(startFace ? { players: g!.players.length } : {}) });
      tileCache.set(key, grp);
    }
    if (tileSlots[i] !== grp) { if (tileSlots[i]) scene.remove(tileSlots[i]!); tileSlots[i] = grp; scene.add(grp); }
    grp.position.set(BOARD_X0 + i * PITCH_W + (GRID.frameW / 2) * KX, 0, 0);
  });
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
const HAZ_SIZE = { length: HAZ[1] * MM, depth: HAZ[0] * MM, thickness: HAZ[2] * MM };
const markerGroup = new THREE.Group();
scene.add(markerGroup);
// Dice tray: this turn's FX dice roll onto the table just below the road.
const DIE_W = sizeOf(CAT, 'die')[0] * MM;
// Rolled dice are shown at twice their size, so their faces read from the camera.
const TRAY_SCALE = 2;
const TRAY_Z = TILE_H / 2 + 0.9;
interface TableDie { d: Die3D; from: THREE.Vector3; to: THREE.Vector3; q0: THREE.Quaternion; q1: THREE.Quaternion; t: number }
let trayDice: TableDie[] = [];
let trayKey = '';
let resetTray = false;
const FORWARD = new THREE.Vector3(1, 0, 0), AWAY = new THREE.Vector3(0, 0, -1);
const ringGeo = new THREE.RingGeometry(0.42, 0.56, 32);
interface Marker { mesh: THREE.Mesh; option: number; at: THREE.Vector3 }
let markers: Marker[] = [];

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
  render();
}

function undo(): void {
  if (!saved || !saved.choices.length) return;
  logSeen = -1;
  resetTray = true;
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

function startSpot(v: Vehicle): THREE.Vector3 {
  const sizeIdx = { S: 0, M: 1, L: 2 }[v.size];
  const n = g!.players.length;
  const z = (v.owner! - (n - 1) / 2) * 2.3 + (sizeIdx - 1) * 0.74;
  return new THREE.Vector3(BOARD_X0 - 1.0, TILE_T, z);
}

function render(): void {
  if (!g) return;
  showTiles();
  finish.visible = g.finalTile;

  const live = new Set<string>();
  for (const [k, h] of g.hazards) {
    live.add(k);
    let rec = hazardObjs.get(k);
    if (rec && (rec.type !== h.type || rec.gone !== undefined)) { scene.remove(rec.obj.group); rec = undefined; }
    if (!rec) { rec = { type: h.type, obj: hazardToken(h.type, HAZ_SIZE) }; hazardObjs.set(k, rec); scene.add(rec.obj.group); }
    const [r, c] = k.split(',').map(Number);
    rec.obj.group.position.copy(world({ r, c })).setY(TILE_T + 0.003);
    rec.obj.setFaceUp(h.faceUp);
  }
  // A hazard discarded after resolving (mine, wreck) stays face up for a moment, then goes.
  for (const [k, rec] of hazardObjs) if (!live.has(k) && rec.gone === undefined) {
    rec.obj.setFaceUp(true);
    rec.gone = performance.now() / 1000 + 1.8;
  }

  const seen = new Set<string>();
  const stackCount = new Map<string, number>();
  for (const v of [...g.vehicles].filter(x => x.status !== 'elim').sort((a, b) => a.z - b.z)) {
    seen.add(v.id);
    let o = carObjs.get(v.id);
    if (!o) {
      const comp = v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0];
      o = pieces.car(comp.size_mm, v.owner === null ? '#222' : g.players[v.owner].color, v.isWreck);
      carObjs.set(v.id, o);
      scene.add(o);
      o.position.copy(v.pos ? world(v.pos) : startSpot(v));
    }
    let target: THREE.Vector3;
    if (v.pos) {
      const k = `${v.pos.r},${v.pos.c}`;
      const n = stackCount.get(k) ?? 0;
      stackCount.set(k, n + 1);
      target = world(v.pos).add(new THREE.Vector3(n * 0.12, (g.hazards.has(k) ? HAZ_SIZE.thickness : 0) + n * 0.55, n * 0.08));
    } else target = startSpot(v);
    o.userData.target = target;
    o.userData.yaw = v.status === 'inop' && !v.isWreck ? Math.PI : 0;
    o.userData.active = v.id === g.activeCar;
  }
  for (const [id, o] of carObjs) if (!seen.has(id)) { scene.remove(o); carObjs.delete(id); }

  for (const p of g.players) {
    let o = chopperObjs.get(p.id);
    if (!p.chopper) { if (o) { scene.remove(o); chopperObjs.delete(p.id); } continue; }
    if (!o) { o = pieces.chopper(sizeOf(CAT, 'chopper'), p.color); chopperObjs.set(p.id, o); scene.add(o); o.position.copy(world(p.chopper)).setY(4); }
    o.userData.target = world(p.chopper).setY(1.1);
  }

  drawTray();
  drawMarkers();
  drawHud();
}

/** Rolls new FX dice onto the table near the car that caused them; old rolls stay still. */
function drawTray(): void {
  if (!g) return;
  const key = g.lastRoll.map(r => `${r.die}${r.face}`).join(',');
  // A new turn clears lastRoll: the previous dice stay on the table until the next roll.
  if (key === trayKey || (!key && !resetTray)) return;
  resetTray = false;
  const prev = trayKey ? trayKey.split(',') : [];
  const keep = key.startsWith(trayKey) ? prev.length : 0;
  trayKey = key;
  for (const t of trayDice.slice(keep)) scene.remove(t.d.mesh);
  trayDice = trayDice.slice(0, keep);
  const car = g.vehicles.find(v => v.id === g!.activeCar);
  const cx = THREE.MathUtils.clamp(car?.pos ? world(car.pos).x : BOARD_X0 + 2, BOARD_X0 + 1, BOARD_X0 + 2 * PITCH_W + TILE_W - 6);
  g.lastRoll.forEach((r, i) => {
    if (i < keep) return;
    const d = makeDie(FACES, r.die, DIE_W);
    d.mesh.scale.setScalar(TRAY_SCALE);
    const to = new THREE.Vector3(cx + (i % 8) * DIE_W * TRAY_SCALE * 1.4, DIE_W * TRAY_SCALE / 2, TRAY_Z + Math.floor(i / 8) * DIE_W * TRAY_SCALE * 1.4);
    const from = to.clone().add(new THREE.Vector3(-1.5 - Math.random(), 2.5, 1.2));
    const q1 = d.orientation(r.face, r.die === 'direction' ? FORWARD : AWAY)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.die === 'direction' ? 0 : (Math.random() - 0.5) * 0.4));
    const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    d.mesh.position.copy(from);
    d.mesh.quaternion.copy(q0);
    scene.add(d.mesh);
    trayDice.push({ d, from, to, q0, q1, t: -i * 0.12 });
  });
}

function drawMarkers(): void {
  markerGroup.clear();
  markers = [];
  if (!g || !decision || !['step', 'airstrike', 'shoot'].includes(decision.kind)) return;
  const d = decision;
  d.options.forEach((o, i) => {
    if (!o.pos) return;
    const at = world(o.pos);
    if (markers.some(m => m.at.distanceTo(at) < 0.05)) return;
    const color = o.danger ? 0xff3b30 : d.kind === 'shoot' ? 0xffd23a : 0x4cff7a;
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at).setY(TILE_T + 0.1);
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
let logSeen = -1;
let toastTimer = 0;
/** Shows the new shots, damage, hazards and eliminations for a few seconds over the map. */
function toast(): void {
  if (!g) return;
  if (logSeen < 0 || logSeen > g.log.length) { logSeen = g.log.length; return; }
  const fresh = g.log.slice(logSeen).filter(e => e.kind === 'dice' || e.kind === 'bad' || e.kind === 'good'
    || /Pericolo|danno|sparo|bersaglio|armi|COLPITO/i.test(e.text));
  logSeen = g.log.length;
  if (!fresh.length) return;
  const el = $('toast');
  el.innerHTML = fresh.slice(-4).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
}
function drawHud(): void {
  if (!g) return;
  const me = viewer()!;
  const d = decision;

  // Top: me, opponents with colour and dice, road die.
  $('meav').innerHTML = avatarSvg(me.color, me.name);
  $('mename').textContent = me.name;
  $('opps').innerHTML = g.players.filter(p => p !== me).map(p =>
    `<div class="opp ${p.out ? 'out' : ''}" style="border-color:${p.color}"><div class="av">${avatarSvg(p.color, p.name)}</div>
     <div><div class="nm gothic">${esc(p.name)}${p.out ? ' — fuori' : ''}</div>
     <div class="dice-row">${p.dice.map((n, i) => dieHtml('movement', n, p.color, p.used[i] ? 'used' : '')).join('')}</div></div></div>`).join('');
  $('roaddie').innerHTML = g.roadDie ? dieHtml('road', g.roadDie, undefined) : '';

  // Bar: prompt, contextual actions, last log line.
  const name = d ? g.players[d.player].name : '';
  const text = d ? d.prompt.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `), '') : g.winner !== null ? 'Partita finita.' : '';
  $('prompt').innerHTML = d ? `<b style="color:${g.players[d.player].color}">${esc(name)}</b>${esc(text)}` : esc(text);
  if (d?.kind === 'assign') $('prompt').innerHTML += ' <i>— trascina un dado su un cruscotto</i>';
  if (d?.kind === 'command') $('prompt').innerHTML += ' <i>— trascina un dado su un comando</i>';
  const actions = $('actions');
  actions.innerHTML = '';
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
    else if (d.kind === 'roadDie' || d.kind === 'slamReroll') { btn(0, 'quiet'); btn(1); }
    else if (!['assign', 'step', 'airstrike', 'repair'].includes(d.kind)) d.options.forEach((_, i) => btn(i));
  }
  const last = g.log[g.log.length - 1];
  $('ticker').innerHTML = last ? logLine(last).replace(/^<div[^>]*>|<\/div>$/g, '') : '';
  if ($('drawer').style.display === 'block') drawDrawer();

  toast();

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
  const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>('[data-drop]');
  const i = zone ? zoneOption(zone.dataset.drop!, d.die) : -1;
  if (i >= 0) choose(i); else { selDie = null; drawHud(); }
});

// ---------------------------------------------------------------- input: map

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || !decision) return;
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
  for (const mk of markers) mk.mesh.scale.setScalar(mk.option === i ? 1.5 : 1);
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
  for (const o of chopperObjs.values()) scene.remove(o);
  chopperObjs.clear();
  winShown = false;
  $('win').style.display = 'none';
  $('setup').style.display = 'none';
  logSeen = -1;
  resetTray = true;
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
    if (r.width < 2 || el.closest('[style*="display: none"]')) continue;
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

const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop(t => {
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 0.1);
  const k = 1 - Math.exp(-dt * 10);
  const now = performance.now() / 1000;
  for (const o of carObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (tg) { o.position.x += (tg.x - o.position.x) * k; o.position.z += (tg.z - o.position.z) * k; }
    o.rotation.y += ((o.userData.yaw ?? 0) - o.rotation.y) * k;
    o.position.y = (tg?.y ?? TILE_T) + (o.userData.active ? 0.12 + Math.sin(now * 4) * 0.06 : 0);
  }
  for (const o of chopperObjs.values()) {
    const tg = o.userData.target as THREE.Vector3 | undefined;
    if (tg) o.position.lerp(tg, k);
    const r = o.getObjectByName('rotor'); if (r) r.rotation.y += dt * 18;
  }
  for (const m of markers) (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(now * 5) * 0.25;
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
  renderer.render(scene, camera);
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
  get rows() { return ROWS; }, get cols() { return COLS; },
};
