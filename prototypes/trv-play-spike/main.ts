// PROTOTYPE - NOT FOR PRODUCTION
// Partita hot seat di Thunder Road: Vendetta sul tavolo 3D. Le regole stanno tutte in
// src/game/trv/engine.ts; questo file disegna lo stato e trasforma clic in scelte.
// La grafica ufficiale si carica a runtime da assets/licensed/_derived/ (esclusa da git).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  newGame, play, tileDef, ROWS, COLS, TILE_COLS,
  type Game, type Decision, type Pos, type Vehicle, type Setup,
} from '../../src/game/trv/engine';
import { newSeed } from '../../src/platform/entropy';

const COLORS = ['#d8402f', '#2f6fd8', '#3aa64a', '#e2b523'];
const SAVE_KEY = 'trv-hotseat-v1';

// ---------------------------------------------------------------- scene

const panelH = (): number => Math.max(250, Math.min(320, innerHeight * 0.36));
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
controls.minDistance = 6;
controls.maxDistance = 90;

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2414, 1.0));
const lamp = new THREE.DirectionalLight(0xffe2b8, 2.2);
lamp.position.set(-10, 30, 14);
lamp.castShadow = true;
lamp.shadow.mapSize.set(4096, 2048);
Object.assign(lamp.shadow.camera, { left: -30, right: 30, top: 14, bottom: -14 });
lamp.shadow.bias = -0.0004;
scene.add(lamp);

const table = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshStandardMaterial({ color: 0x5e3b22, roughness: 0.8 }));
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

// Tile geometry, measured on the tile images (2000 px wide copy).
const TILE_W = 13.14, TILE_H = 10, TILE_T = 0.12;
const IMG_W = 2000, IMG_H = 1522;
const BOARD_X0 = -1.5 * TILE_W;

function world(p: Pos): THREE.Vector3 {
  const slot = Math.floor(p.c / TILE_COLS);
  const lc = p.c - slot * TILE_COLS;
  const odd = Math.abs(p.r % 2) === 1;
  const u = ((odd ? 220 : 130) + 233 * lc) / IMG_W;
  const v = (330 + 216 * p.r) / IMG_H;
  return new THREE.Vector3(BOARD_X0 + slot * TILE_W + u * TILE_W, TILE_T, (v - 0.5) * TILE_H);
}

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
let artMissing = false;
function tileTexture(image: string, onLoad: (t: THREE.Texture) => void): void {
  const hit = texCache.get(image);
  if (hit) { onLoad(hit); return; }
  loader.load(`/assets/licensed/_derived/tiles/${image}.png`, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texCache.set(image, t);
    onLoad(t);
  }, undefined, () => { artMissing = true; drawPanel(); });
}

const tileMeshes = [0, 1, 2].map(i => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(TILE_W, TILE_H),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.85, transparent: true, alphaTest: 0.5 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(BOARD_X0 + (i + 0.5) * TILE_W, TILE_T, 0);
  m.receiveShadow = true;
  scene.add(m);
  return m;
});
const tileShown = ['', '', ''];

const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshBasicMaterial({ visible: false }));
pickPlane.rotation.x = -Math.PI / 2;
pickPlane.position.y = TILE_T;
scene.add(pickPlane);

// Finish line, shown beyond the lead tile when it is the final tile.
function checker(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 448;
  const x2 = c.getContext('2d')!;
  for (let y = 0; y < 28; y++) for (let x = 0; x < 4; x++) { x2.fillStyle = (x + y) % 2 ? '#111' : '#eee'; x2.fillRect(x * 16, y * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const finish = new THREE.Mesh(new THREE.PlaneGeometry(1.4, TILE_H * 0.86), new THREE.MeshStandardMaterial({ map: checker() }));
finish.rotation.x = -Math.PI / 2;
finish.position.set(BOARD_X0 + 3 * TILE_W + 0.8, TILE_T, 0.6);
scene.add(finish);

// ---------------------------------------------------------------- pieces

function carMesh(color: string, scale: number, wreck: boolean): THREE.Group {
  const s = new THREE.Shape();
  const L = 1.05, W = 0.6, r = 0.14;
  s.moveTo(-L / 2 + r, -W / 2); s.lineTo(L / 2 - 0.28, -W / 2); s.lineTo(L / 2, 0); s.lineTo(L / 2 - 0.28, W / 2);
  s.lineTo(-L / 2 + r, W / 2); s.quadraticCurveTo(-L / 2, W / 2, -L / 2, W / 2 - r);
  s.lineTo(-L / 2, -W / 2 + r); s.quadraticCurveTo(-L / 2, -W / 2, -L / 2 + r, -W / 2);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }),
    new THREE.MeshStandardMaterial({ color: wreck ? 0x3a3530 : color, roughness: wreck ? 0.95 : 0.45, metalness: 0.15 }),
  );
  body.rotation.x = -Math.PI / 2;
  body.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: wreck ? 0x1d1a17 : 0x222831 }));
  cab.position.set(-0.05, 0.33, 0);
  cab.castShadow = true;
  const grp = new THREE.Group();
  grp.add(body, cab);
  grp.scale.setScalar(scale);
  return grp;
}

function chopperMesh(color: string): THREE.Group {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat);
  body.scale.set(1.4, 0.8, 0.9);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), mat);
  tail.position.set(-0.6, 0.05, 0);
  const rotor = new THREE.Group();
  for (const a of [0, Math.PI / 2]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    b.rotation.y = a; rotor.add(b);
  }
  rotor.position.y = 0.32;
  rotor.name = 'rotor';
  grp.add(body, tail, rotor);
  grp.traverse(o => { o.castShadow = true; });
  return grp;
}

const HAZ_STYLE: Record<string, [string, string]> = {
  mud: ['#4a2e1c', 'FANGO'], road: ['#666', 'STRADA'], oil: ['#2a2a3a', 'OLIO'], mine: ['#151515', 'MINA'], wreck: ['#151515', 'RELITTO'],
};
const hazTex = new Map<string, THREE.CanvasTexture>();
function hazardTexture(kind: string): THREE.CanvasTexture {
  const hit = hazTex.get(kind); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x2 = c.getContext('2d')!;
  if (kind === 'down') {
    x2.fillStyle = '#b8262b'; x2.fillRect(0, 0, 128, 128);
    x2.strokeStyle = '#fff'; x2.lineWidth = 8;
    x2.beginPath(); x2.moveTo(64, 22); x2.lineTo(108, 100); x2.lineTo(20, 100); x2.closePath(); x2.stroke();
  } else {
    const [bg, label] = HAZ_STYLE[kind];
    x2.fillStyle = bg; x2.fillRect(0, 0, 128, 128);
    x2.strokeStyle = '#e33'; x2.lineWidth = 6; x2.strokeRect(3, 3, 122, 122);
    x2.fillStyle = '#fff'; x2.font = 'bold 26px Impact, sans-serif'; x2.textAlign = 'center'; x2.fillText(label, 64, 74);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; hazTex.set(kind, t); return t;
}

const carObjs = new Map<string, THREE.Group>();
const chopperObjs = new Map<number, THREE.Group>();
const hazardGroup = new THREE.Group();
scene.add(hazardGroup);

// Option markers.
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
  g.board.forEach((t, i) => {
    const img = tileDef(t).image;
    if (tileShown[i] === img) return;
    tileShown[i] = img;
    const mat = tileMeshes[i].material as THREE.MeshStandardMaterial;
    tileTexture(img, tex => { if (tileShown[i] === img) { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; } });
  });
  finish.visible = g.finalTile;

  const seen = new Set<string>();
  const stackCount = new Map<string, number>();
  const ordered = [...g.vehicles].filter(v => v.status !== 'elim').sort((a, b) => a.z - b.z);
  for (const v of ordered) {
    seen.add(v.id);
    let o = carObjs.get(v.id);
    if (!o) {
      const scale = { S: 0.82, M: 1.0, L: 1.2 }[v.size];
      o = carMesh(v.owner === null ? '#333' : g.players[v.owner].color, scale, v.isWreck);
      carObjs.set(v.id, o);
      scene.add(o);
      o.position.copy(v.pos ? world(v.pos) : startSpot(v));
    }
    let target: THREE.Vector3;
    if (v.pos) {
      const k = `${v.pos.r},${v.pos.c}`;
      const n = stackCount.get(k) ?? 0;
      stackCount.set(k, n + 1);
      target = world(v.pos).add(new THREE.Vector3(n * 0.12, n * 0.34, n * 0.08));
    } else target = startSpot(v);
    o.userData.target = target;
    o.userData.yaw = v.status === 'inop' && !v.isWreck ? Math.PI : 0;
    o.userData.active = v.id === g.activeCar;
  }
  for (const [id, o] of carObjs) if (!seen.has(id)) { scene.remove(o); carObjs.delete(id); }

  for (const p of g.players) {
    let o = chopperObjs.get(p.id);
    if (!p.chopper) { if (o) { scene.remove(o); chopperObjs.delete(p.id); } continue; }
    if (!o) { o = chopperMesh(p.color); chopperObjs.set(p.id, o); scene.add(o); o.position.copy(world(p.chopper)).setY(4); }
    o.userData.target = world(p.chopper).setY(1.25);
  }

  hazardGroup.clear();
  for (const [k, h] of g.hazards) {
    const [r, c] = k.split(',').map(Number);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: hazardTexture(h.faceUp ? h.type : 'down') }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(world({ r, c })).add(new THREE.Vector3(-0.32, 0.02, 0.26));
    m.receiveShadow = true;
    hazardGroup.add(m);
  }

  drawMarkers();
  drawPanel();
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
    // Several options on one spot (assign: 4 dice on one car) share the first marker.
    if (markers.some(m => m.at.distanceTo(at!) < 0.05)) return;
    const color = o.danger ? 0xff3b30 : d.kind === 'shoot' ? 0xffd23a : 0x4cff7a;
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at).setY(TILE_T + 0.05);
    mesh.renderOrder = 10;
    markerGroup.add(mesh);
    markers.push({ mesh, option: i, at });
  });
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
    if (d.kind === 'airstrike') {
      opts.innerHTML = '<i>Clicca un anello verde sul tavolo.</i>';
    } else {
      d.options.forEach((o, i) => {
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
  }
  ($('undo') as HTMLButtonElement).disabled = !saved?.choices.length;

  $('players').innerHTML = g.players.map(p => {
    const cars = g!.vehicles.filter(v => v.owner === p.id).map(v => {
      const name = { S: 'Piccola', M: 'Media', L: 'Grande' }[v.size];
      const st = v.status === 'elim' ? 'eliminata' : v.status === 'inop' ? 'fuori uso' : v.inStart ? 'partenza' : v.moved ? 'mossa' : 'pronta';
      return `<span class="car ${v.status}">${name}: ${'●'.repeat(v.damage.length)}${'○'.repeat(Math.max(0, 2 - v.damage.length))} ${st}</span>`;
    }).join('');
    const dice = p.dice.map((n, i) => `<span class="die ${p.used[i] ? 'used' : ''}">${n}</span>`).join('');
    const cur = d && d.player === p.id ? 'cur' : '';
    return `<div class="pl ${cur} ${p.out ? 'out' : ''}" style="border-color:${p.color}">
      <b>${esc(p.name)}</b>${p.out ? ' — fuori' : ''}<span class="dice">${dice}</span>
      ${p.commandUsed ? ' <small>comando usato</small>' : ''}${p.chopper ? ' <small>elicottero in campo</small>' : ''}
      <div class="cars">${cars}</div></div>`;
  }).join('');

  const log = $('log');
  log.innerHTML = g.log.slice(-160).map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('');
  log.scrollTop = log.scrollHeight;

  const names = g.board.map(t => `${t.tile}${t.side}`).join(' · ');
  $('status').innerHTML = `<span class="big">Round ${g.round}</span> &nbsp;Dado strada: <b>${g.roadDie}</b>
    &nbsp;·&nbsp; Tessere: ${names}${g.finalTile ? ' · <b>tessera finale!</b>' : ` · ${g.tilesPlaced}ª posata`}
    ${artMissing ? '<br><small>Grafica ufficiale non trovata in assets/licensed/_derived/tiles/</small>' : ''}`;

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

$('undo').onclick = undo;
$('newgame').onclick = () => { $('setup').style.display = 'grid'; };
$('view').onclick = () => fit();
$('again').onclick = () => { $('win').style.display = 'none'; $('setup').style.display = 'grid'; };
$('close').onclick = () => { $('win').style.display = 'none'; };
$('np').onchange = () => syncNames();
function syncNames(): void {
  const n = Number(($('np') as HTMLSelectElement).value);
  for (let i = 0; i < 4; i++) ($(`n${i}`) as HTMLInputElement).style.visibility = i < n ? 'visible' : 'hidden';
}
syncNames();
$('start').onclick = () => {
  const seed = newSeed();
  if (!seed.ok) { alert('Il browser non fornisce numeri casuali sicuri: impossibile iniziare.'); return; }
  const n = Number(($('np') as HTMLSelectElement).value);
  const players = Array.from({ length: n }, (_, i) => ({ name: ($(`n${i}`) as HTMLInputElement).value.trim() || `Giocatore ${i + 1}`, color: COLORS[i] }));
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
  const target = new THREE.Vector3(-1.2, 0, 0.4);
  const dir = new THREE.Vector3(0, 1, 0.42).normalize();
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const needW = 3 * TILE_W + 3.6, needH = TILE_H + 1.2;
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
  get rows() { return ROWS; }, get cols() { return COLS; },
};
