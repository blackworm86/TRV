// PROTOTYPE - NOT FOR PRODUCTION
// Partita hot seat di Thunder Road: Vendetta sul tavolo 3D. Le regole stanno tutte in
// src/game/trv/engine.ts; i pezzi e le immagini vengono dal catalogo fisico
// (src/game/trv/catalog.ts, src/view/pieces3d.ts). Questo file disegna e trasforma clic in scelte.
// La grafica ufficiale si carica a runtime da assets/licensed/_derived/ (esclusa da git).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  newGame, play, ROWS, COLS, TILE_COLS,
  type Game, type Decision, type Pos, type Vehicle, type Setup, type LogEntry,
} from '../../src/game/trv/engine';
import {
  BASE_CATALOG as CAT, sizeOf, roadTileImage, tokenImage, dieFaceImage, dashboardImage, commandBoardImage, ofKind,
} from '../../src/game/trv/catalog';
import { Pieces, TextureBank } from '../../src/view/pieces3d';
import { newSeed } from '../../src/platform/entropy';

const SAVE_KEY = 'trv-hotseat-v2';

// ---------------------------------------------------------------- scene

const panelH = (): number => Math.max(270, Math.min(340, innerHeight * 0.4));
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a120c);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = 1.2;
controls.minDistance = 4;
controls.maxDistance = 90;

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2414, 1.0));
const lamp = new THREE.DirectionalLight(0xffe2b8, 2.2);
lamp.position.set(-10, 30, 14);
lamp.castShadow = true;
lamp.shadow.mapSize.set(4096, 2048);
Object.assign(lamp.shadow.camera, { left: -30, right: 30, top: 16, bottom: -16 });
lamp.shadow.bias = -0.0004;
scene.add(lamp);

const table = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshStandardMaterial({ color: 0x5e3b22, roughness: 0.8 }));
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

// One scale for the whole table: world units per millimetre, from the road tile's length.
const TILE_MM = sizeOf(CAT, 'road_tile');
const MM = 13.14 / TILE_MM[0];
const TILE_W = TILE_MM[0] * MM, TILE_H = TILE_MM[1] * MM, TILE_T = TILE_MM[2] * MM;
const IMG_W = 2000, IMG_H = 1522; // space grid measured on a 2000 px copy of the tile image
const BOARD_X0 = -1.5 * TILE_W;
const bank = new TextureBank(renderer.capabilities.getMaxAnisotropy());
const pieces = new Pieces(MM, bank);

function world(p: Pos): THREE.Vector3 {
  const slot = Math.floor(p.c / TILE_COLS);
  const lc = p.c - slot * TILE_COLS;
  const odd = Math.abs(p.r % 2) === 1;
  const u = ((odd ? 220 : 130) + 233 * lc) / IMG_W;
  const v = (330 + 216 * p.r) / IMG_H;
  return new THREE.Vector3(BOARD_X0 + slot * TILE_W + u * TILE_W, TILE_T, (v - 0.5) * TILE_H);
}

const tiles = [0, 1, 2].map(i => {
  const t = pieces.roadTile(TILE_MM);
  t.group.position.set(BOARD_X0 + (i + 0.5) * TILE_W, 0, 0);
  scene.add(t.group);
  return t;
});

const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshBasicMaterial({ visible: false }));
pickPlane.rotation.x = -Math.PI / 2;
pickPlane.position.y = TILE_T;
scene.add(pickPlane);

// Finish line: the catalog has no art for it yet, so a chequered stand-in at catalog size.
function checker(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 448;
  const x2 = c.getContext('2d')!;
  for (let y = 0; y < 28; y++) for (let x = 0; x < 4; x++) { x2.fillStyle = (x + y) % 2 ? '#111' : '#eee'; x2.fillRect(x * 16, y * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FIN = sizeOf(CAT, 'finish_line');
const finish = new THREE.Mesh(new THREE.PlaneGeometry(FIN[0] * MM, FIN[1] * MM * 0.86), new THREE.MeshStandardMaterial({ map: checker() }));
finish.rotation.x = -Math.PI / 2;
finish.position.set(BOARD_X0 + 3 * TILE_W + FIN[0] * MM / 2, TILE_T, 0.6);
scene.add(finish);

// ---------------------------------------------------------------- pieces on the table

const carObjs = new Map<string, THREE.Group>();
const chopperObjs = new Map<number, THREE.Group>();
const hazardObjs = new Map<string, { key: string; type: string; obj: ReturnType<Pieces['token']> }>();
const HAZ_SIZE = sizeOf(CAT, 'hazard_token');
const TOKEN_T = HAZ_SIZE[2] * MM;
const tray = new THREE.Group();
scene.add(tray);

const markerGroup = new THREE.Group();
scene.add(markerGroup);
const ringGeo = new THREE.RingGeometry(0.42, 0.56, 32);
interface Marker { mesh: THREE.Mesh; option: number; at: THREE.Vector3 }
let markers: Marker[] = [];

// ---------------------------------------------------------------- game state

interface Saved { setup: Setup; choices: number[] }
let saved: Saved | null = null;
let g: Game | null = null;
let gen: Generator<Decision, void, number> | null = null;
let decision: Decision | null = null;

function crewOf(player: number): string { return g?.players[player]?.crew ?? CAT.crews[player].id; }

function startGame(s: Saved): void {
  saved = s;
  g = newGame(s.setup);
  gen = play(g);
  let r = gen.next(0);
  for (const c of s.choices) {
    if (r.done) break;
    r = gen.next(c);
  }
  decision = r.done ? null : r.value;
  persist();
  render();
}

function choose(i: number): void {
  if (!gen || !decision || !saved) return;
  saved.choices.push(i);
  const r = gen.next(i);
  decision = r.done ? null : r.value;
  persist();
  render();
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

// ---------------------------------------------------------------- drawing

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function startSpot(v: Vehicle): THREE.Vector3 {
  const sizeIdx = { S: 0, M: 1, L: 2 }[v.size];
  const n = g!.players.length;
  const z = (v.owner! - (n - 1) / 2) * 2.3 + (sizeIdx - 1) * 0.74;
  return new THREE.Vector3(BOARD_X0 - 1.3, TILE_T, z);
}

function render(): void {
  if (!g) return;
  g.board.forEach((t, i) => tiles[i].setFace(roadTileImage(CAT, t.tile, t.side)));
  finish.visible = g.finalTile;

  // Hazard tokens: official front when face up, shared back when face down.
  const live = new Set<string>();
  for (const [k, h] of g.hazards) {
    live.add(k);
    let rec = hazardObjs.get(k);
    if (rec && rec.type !== h.type) { scene.remove(rec.obj.group); rec = undefined; }
    if (!rec) {
      const obj = pieces.token(HAZ_SIZE, tokenImage(CAT, 'hazard_token', h.type, true), tokenImage(CAT, 'hazard_token', null, false));
      rec = { key: k, type: h.type, obj };
      hazardObjs.set(k, rec);
      scene.add(obj.group);
    }
    const [r, c] = k.split(',').map(Number);
    rec.obj.group.position.copy(world({ r, c })).setY(TILE_T + 0.002);
    rec.obj.setFaceUp(h.faceUp);
  }
  for (const [k, rec] of hazardObjs) if (!live.has(k)) { scene.remove(rec.obj.group); hazardObjs.delete(k); }

  // Cars and wrecks, stacked by slam order.
  const seen = new Set<string>();
  const stackCount = new Map<string, number>();
  const ordered = [...g.vehicles].filter(v => v.status !== 'elim').sort((a, b) => a.z - b.z);
  for (const v of ordered) {
    seen.add(v.id);
    let o = carObjs.get(v.id);
    if (!o) {
      const comp = v.isWreck ? ofKind(CAT, 'wreck')[0] : ofKind(CAT, 'car', { car_size: v.size })[0];
      o = pieces.car(comp.size_mm, v.owner === null ? '#333' : g.players[v.owner].color, v.isWreck);
      carObjs.set(v.id, o);
      scene.add(o);
      o.position.copy(v.pos ? world(v.pos) : startSpot(v));
    }
    let target: THREE.Vector3;
    if (v.pos) {
      const k = `${v.pos.r},${v.pos.c}`;
      const n = stackCount.get(k) ?? 0;
      stackCount.set(k, n + 1);
      const onToken = g.hazards.has(k) ? TOKEN_T : 0;
      target = world(v.pos).add(new THREE.Vector3(n * 0.12, onToken + n * 0.55, n * 0.08));
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
    o.userData.target = world(p.chopper).setY(1.25);
  }

  drawTray();
  drawMarkers();
  drawPanel();
}

/** Dice tray under the board: the current player's movement dice and this turn's FX dice. */
function drawTray(): void {
  tray.clear();
  if (!g) return;
  const z = TILE_H / 2 + 1.0;
  const pl = g.players[decision ? decision.player : g.current];
  const mv = ofKind(CAT, 'die', { die: 'movement' })[0];
  pl.dice.forEach((n, i) => {
    const d = pieces.die(mv.size_mm[0], [1, 2, 3, 4, 5, 6], pl.color, false);
    d.show(n - 1, (i - 1.5) * 0.15);
    d.mesh.position.set(BOARD_X0 + 1 + i * 0.95, mv.size_mm[0] * MM / 2, z);
    if (pl.used[i]) { d.mesh.position.z += 0.9; (d.mesh.material as THREE.MeshStandardMaterial[]).forEach(m => { m.transparent = true; m.opacity = 0.35; }); }
    tray.add(d.mesh);
  });
  const fx = g.lastRoll.slice(-8);
  fx.forEach((r, i) => {
    const comp = ofKind(CAT, 'die', { die: r.die })[0];
    if (!comp?.face_images) return;
    const urls = comp.face_images.map(f => `/${CAT.roots[comp.module]}/${f}.png`);
    const d = pieces.die(comp.size_mm[0], urls, '#888', r.die === 'direction');
    d.show(r.face);
    d.mesh.position.set(BOARD_X0 + 6 + i * 0.95, comp.size_mm[0] * MM / 2, z);
    tray.add(d.mesh);
  });
}

function drawMarkers(): void {
  markerGroup.clear();
  markers = [];
  if (!g || !decision) return;
  const d = decision;
  d.options.forEach((o, i) => {
    let at: THREE.Vector3 | null = null;
    if (o.pos) at = world(o.pos);
    else if (o.carId) { const obj = carObjs.get(o.carId); if (obj) at = (obj.userData.target as THREE.Vector3).clone(); }
    if (!at) return;
    if (markers.some(m => m.at.distanceTo(at!) < 0.05)) return;
    const color = o.danger ? 0xff3b30 : d.kind === 'shoot' ? 0xffd23a : 0x4cff7a;
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at).setY(TILE_T + 0.08);
    mesh.renderOrder = 10;
    markerGroup.add(mesh);
    markers.push({ mesh, option: i, at });
  });
}

function diceHtml(e: LogEntry): string {
  if (!e.dice) return '';
  return e.dice.map(d => {
    const url = dieFaceImage(CAT, d.die, d.face);
    return url ? `<img class="face" src="${url}" alt="${esc(String(d.value))}">` : '';
  }).join('');
}

let winShown = false;
function drawPanel(): void {
  if (!g) return;
  const d = decision;
  const who = d ? g.players[d.player] : null;
  $('who').innerHTML = g.winner !== null ? `<span style="color:${g.players[g.winner].color}">${esc(g.players[g.winner].name)} vince!</span>`
    : who ? `<span style="color:${who.color}">Tocca a ${esc(who.name)}</span>` : '';
  $('prompt').textContent = d ? d.prompt : '';
  const opts = $('opts');
  opts.innerHTML = '';
  if (d) {
    if (d.kind === 'airstrike') opts.innerHTML = '<i>Clicca un anello verde sul tavolo.</i>';
    else d.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.textContent = o.label;
      if (o.danger) b.className = 'danger';
      if (/^(Non sparare|Nessun comando|No, fermati|Tieni)/.test(o.label)) b.className = 'quiet';
      b.onclick = () => choose(i);
      b.onmouseenter = () => hover(i);
      b.onmouseleave = () => hover(-1);
      opts.appendChild(b);
    });
  }
  ($('undo') as HTMLButtonElement).disabled = !saved?.choices.length;

  // Players: command board, dashboards (back when inoperable) with face-down damage tokens.
  const dmgBack = tokenImage(CAT, 'damage_token', null, false);
  $('players').innerHTML = g.players.map(p => {
    const crew = crewOf(p.id);
    const cars = g!.vehicles.filter(v => v.owner === p.id).map(v => {
      const img = dashboardImage(CAT, crew, v.size, v.status !== 'inop');
      const tokens = v.damage.map(() => `<img class="dmg" src="${dmgBack}" alt="danno">`).join('');
      const st = v.status === 'elim' ? 'eliminata' : v.status === 'inop' ? 'fuori uso' : v.inStart ? 'in partenza' : v.moved ? 'mossa' : v.coasts ? `inerzia ×${v.coasts}` : 'pronta';
      return `<div class="dash ${v.status}" title="${st}"><img src="${img}" alt="cruscotto ${v.size}"><div class="dmgs">${tokens}</div><span>${st}</span></div>`;
    }).join('');
    const dice = p.dice.map((n, i) => `<span class="die ${p.used[i] ? 'used' : ''}" style="background:${p.color}">${n}</span>`).join('');
    const cur = d && d.player === p.id ? 'cur' : '';
    return `<div class="pl ${cur} ${p.out ? 'out' : ''}" style="border-color:${p.color}">
      <div class="plhead"><b>${esc(p.name)}</b>${p.out ? ' — fuori' : ''}<span class="dice">${dice}</span>
      <img class="cmd ${p.commandUsed ? 'used' : ''}" src="${commandBoardImage(CAT, crew)}" alt="plancia comandi" title="${p.commandUsed ? 'comando già usato in questo round' : 'comando disponibile'}">
      ${p.chopper ? '<small>elicottero in campo</small>' : ''}</div>
      <div class="cars">${cars}</div></div>`;
  }).join('');

  const log = $('log');
  log.innerHTML = g.log.slice(-160).map(e => `<div class="${e.kind}">${diceHtml(e)}${esc(e.text)}</div>`).join('');
  log.scrollTop = log.scrollHeight;

  const names = g.board.map(t => `${t.tile}${t.side}`).join(' · ');
  $('status').innerHTML = `<span class="big">Round ${g.round}</span> &nbsp;Dado strada: <b>${g.roadDie}</b>
    &nbsp;·&nbsp; Tessere: ${names}${g.finalTile ? ' · <b>tessera finale!</b>' : ` · ${g.tilesPlaced}ª posata`}
    ${bank.missing.size ? '<br><small>Grafica ufficiale mancante: lancia python tools/assets/extract_base.py</small>' : ''}`;

  if (g.winner !== null && !winShown) {
    winShown = true;
    $('wintext').textContent = `${g.players[g.winner].name} vince!`;
    $('win').style.display = 'grid';
  }
}

let hovered = -1;
function hover(i: number): void {
  hovered = i;
  for (const m of markers) m.mesh.scale.setScalar(m.option === i ? 1.5 : 1);
}

// ---------------------------------------------------------------- input

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || !decision) return;
  const m = markerAt(e);
  if (m) choose(m.option);
});
renderer.domElement.addEventListener('pointermove', e => {
  const m = markerAt(e);
  renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
  const i = m ? m.option : -1;
  if (i !== hovered) {
    hover(i);
    $('prompt').textContent = decision ? (m ? `${decision.prompt}  →  ${decision.options[m.option].label}` : decision.prompt) : '';
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

// Setup screen: one crew per player, from the catalog (expansions add crews).
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

$('undo').onclick = undo;
$('newgame').onclick = () => { $('setup').style.display = 'grid'; };
$('view').onclick = () => fit();
$('again').onclick = () => { $('win').style.display = 'none'; $('setup').style.display = 'grid'; };
$('close').onclick = () => { $('win').style.display = 'none'; };
$('np').onchange = () => syncNames();
function syncNames(): void {
  const n = Number(($('np') as HTMLSelectElement).value);
  for (let i = 0; i < 4; i++) {
    ($(`n${i}`) as HTMLInputElement).style.visibility = i < n ? 'visible' : 'hidden';
    crewSelects[i].style.visibility = i < n ? 'visible' : 'hidden';
  }
}
syncNames();
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
  startGame({ setup: { seed: seed.value, players, startSide: ($('side') as HTMLSelectElement).value as 'a' | 'b' }, choices: [] });
};

// ---------------------------------------------------------------- loop

function fit(): void {
  const ph = panelH();
  const h = innerHeight - ph;
  document.documentElement.style.setProperty('--panel', `${ph}px`);
  renderer.setSize(innerWidth, h);
  camera.aspect = innerWidth / h;
  camera.updateProjectionMatrix();
  const target = new THREE.Vector3(-1.2, 0, 1.0);
  const dir = new THREE.Vector3(0, 1, 0.42).normalize();
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const needW = 3 * TILE_W + 3.6, needH = TILE_H + 3.2;
  const dist = Math.max(needW / 2 / Math.tan(hfov / 2), needH / 2 / Math.tan(vfov / 2) / dir.y) * 1.02;
  camera.position.copy(target).addScaledVector(dir, dist);
  controls.target.copy(target);
  controls.update();
}
addEventListener('resize', fit);
fit();

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
  controls.update();
  renderer.render(scene, camera);
});

// Resume the last game, if any.
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = JSON.parse(raw) as Saved;
    if (s?.setup?.seed && Array.isArray(s.choices)) { $('setup').style.display = 'none'; startGame(s); }
  }
} catch { /* broken save: start fresh */ }

// For automated checks.
(window as unknown as { trv: object }).trv = {
  get game() { return g; }, get decision() { return decision; }, choose, undo,
  get rows() { return ROWS; }, get cols() { return COLS; }, get missingArt() { return [...bank.missing]; },
};
