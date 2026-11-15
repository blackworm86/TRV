// PROTOTYPE - NOT FOR PRODUCTION
// Prototipo M0 del tavolo 3D: verifica l'aspetto "tavolo fisico" (art bible) con la grafica
// ufficiale caricata a runtime da assets/licensed/_derived/ (esclusa da git, mai importata
// staticamente: rischio R4). Nessuna regola del gioco: l'auto va dove clicchi e il dado e'
// un d6 generico (le facce reali dei dadi TR:V sono OQ-2 del GDD #2). Da buttare.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Caso con seed (riassunto del GDD #2: il risultato si decide prima, l'animazione lo mostra)
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? Math.floor(Math.random() * 1e9)); // entropia solo qui, fuori dal "nucleo"
const rng = mulberry32(seed);
const rollD6 = (): number => 1 + Math.floor(rng() * 6);

// --- Renderer, scena, camera
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // r182+: PCFShadowMap e' gia' morbida
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a120c);
scene.fog = new THREE.Fog(0x1a120c, 26, 48);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
const VIEW_DIR = new THREE.Vector3(0, 15.5, 11.5).normalize();
const VIEW_TARGET = new THREE.Vector3(0, 0, 1.2);
// Inquadra tessera + dado a qualunque proporzione della finestra (desktop e tablet).
function fitCamera(): void {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const needW = 15.2, needH = 11.5;
  const d = Math.max(needW / 2 / Math.tan(hfov / 2), needH / 2 / Math.tan(vfov / 2) / VIEW_DIR.y);
  camera.position.copy(VIEW_TARGET).addScaledVector(VIEW_DIR, d);
}
fitCamera();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(VIEW_TARGET);
controls.enableDamping = true;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = 1.05;
controls.minDistance = 8;
controls.maxDistance = 40;
controls.enablePan = false;

// --- Luce calda da tavolo (art bible: luce calda, ombre morbide)
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2414, 0.9));
const lamp = new THREE.DirectionalLight(0xffe2b8, 2.4);
lamp.position.set(-6, 14, 6);
lamp.castShadow = true;
lamp.shadow.mapSize.set(2048, 2048);
lamp.shadow.camera.left = -12; lamp.shadow.camera.right = 12;
lamp.shadow.camera.top = 12; lamp.shadow.camera.bottom = -12;
lamp.shadow.bias = -0.0004;
lamp.shadow.radius = 4;
scene.add(lamp);

// --- Tavolo di legno procedurale
function woodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b4226';
  g.fillRect(0, 0, 1024, 1024);
  const r = mulberry32(42);
  for (let i = 0; i < 260; i++) {
    const y = r() * 1024;
    g.strokeStyle = `rgba(${40 + r() * 40},${22 + r() * 20},${10 + r() * 10},${0.15 + r() * 0.25})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x / 140 + i) * 6 + (r() - 0.5) * 3);
    g.stroke();
  }
  for (let p = 0; p < 6; p++) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, (p * 1024) / 6, 1024, 3); // giunture fra le assi
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const table = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.78 }),
);
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
scene.add(table);

// --- Tessera strada: lastra di cartone con la grafica sopra
const TILE_W = 13.14;
const TILE_H = 10; // proporzioni dell'immagine (2048 x 1559)
const TILE_T = 0.12;
const tileTop = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.85, transparent: true, alphaTest: 0.5 });
const tile = new THREE.Mesh(new THREE.PlaneGeometry(TILE_W, TILE_H), tileTop);
tile.rotation.x = -Math.PI / 2;
tile.position.y = TILE_T;
tile.receiveShadow = true;
tile.castShadow = true;
scene.add(tile);

const note = document.getElementById('note')!;
const loader = new THREE.TextureLoader();
const faces: (THREE.Texture | null)[] = [null, null];
let faceIndex = 0;
function loadFace(i: number): void {
  // Caricamento a runtime, mai import statico da assets/licensed (R4).
  loader.load(
    `/assets/licensed/_derived/road-tile-${i}.png`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      faces[i] = tex;
      if (i === faceIndex) applyFace();
    },
    undefined,
    () => {
      note.textContent = 'Grafica ufficiale non trovata in assets/licensed/_derived/: uso un segnaposto grigio.';
    },
  );
}
function applyFace(): void {
  tileTop.map = faces[faceIndex];
  tileTop.color.set(faces[faceIndex] ? 0xffffff : 0x777777);
  tileTop.needsUpdate = true;
}
loadFace(0);
loadFace(1);
note.textContent = `Seed della partita: ${seed}`;

// --- Caselle: centri approssimati misurati sull'immagine della tessera 1a (solo per il prototipo)
const IMG_W = 2000, IMG_H = 1522; // coordinate misurate su una copia a 2000 px
function spaceCenter(row: number, col: number): THREE.Vector3 {
  const startX = row % 2 === 0 ? 130 : 220;
  const u = (startX + 233 * col) / IMG_W;
  const v = (330 + 216 * row) / IMG_H;
  return new THREE.Vector3((u - 0.5) * TILE_W, TILE_T, (v - 0.5) * TILE_H);
}
function nearestSpace(p: THREE.Vector3): { row: number; col: number } {
  let best = { row: 0, col: 0 }, d = Infinity;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const c = spaceCenter(row, col);
      const dd = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
      if (dd < d) { d = dd; best = { row, col }; }
    }
  }
  return best;
}

// --- Auto: segnalino estruso nel colore della banda Arancione (le miniature non ci sono: R5)
function carToken(color: number): THREE.Group {
  const s = new THREE.Shape();
  const L = 1.05, W = 0.6, r = 0.14;
  s.moveTo(-L / 2 + r, -W / 2);
  s.lineTo(L / 2 - 0.28, -W / 2);
  s.lineTo(L / 2, 0); // muso a punta: il fronte si legge come sulle caselle a chevron
  s.lineTo(L / 2 - 0.28, W / 2);
  s.lineTo(-L / 2 + r, W / 2);
  s.quadraticCurveTo(-L / 2, W / 2, -L / 2, W / 2 - r);
  s.lineTo(-L / 2, -W / 2 + r);
  s.quadraticCurveTo(-L / 2, -W / 2, -L / 2 + r, -W / 2);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 }),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 }),
  );
  body.rotation.x = -Math.PI / 2;
  body.castShadow = true;
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.14, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.3 }),
  );
  cab.position.set(-0.05, 0.33, 0);
  cab.castShadow = true;
  const g = new THREE.Group();
  g.add(body, cab);
  return g;
}
const car = carToken(0xe8742a);
let carAt = { row: 3, col: 0 };
car.position.copy(spaceCenter(carAt.row, carAt.col));
scene.add(car);

// --- Dado d6 procedurale (facce generiche: quelle reali di TR:V arrivano dal GDD #4)
function pipFace(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#1b1b1b';
  const at: Record<number, [number, number][]> = {
    1: [[128, 128]],
    2: [[70, 70], [186, 186]],
    3: [[70, 70], [128, 128], [186, 186]],
    4: [[70, 70], [186, 70], [70, 186], [186, 186]],
    5: [[70, 70], [186, 70], [128, 128], [70, 186], [186, 186]],
    6: [[70, 64], [186, 64], [70, 128], [186, 128], [70, 192], [186, 192]],
  };
  for (const [x, y] of at[n]) { g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// ordine dei materiali di BoxGeometry: +x, -x, +y, -y, +z, -z (facce opposte sommano 7)
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];
const DIE = 0.62;
const die = new THREE.Mesh(
  new THREE.BoxGeometry(DIE, DIE, DIE),
  FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: pipFace(v), roughness: 0.35 })),
);
die.castShadow = true;
const DIE_REST = new THREE.Vector3(4.6, DIE / 2, 6.4); // sotto la tessera, dal lato del giocatore
die.position.copy(DIE_REST);
scene.add(die);

const up = new THREE.Vector3(0, 1, 0);
function orientationFor(value: number, yaw: number): THREE.Quaternion {
  const n = FACE_NORMALS[FACE_VALUES.indexOf(value)];
  const toUp = new THREE.Quaternion().setFromUnitVectors(n, up);
  return new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(toUp);
}

type Roll = {
  value: number; t: number; dur: number; target: THREE.Quaternion;
  axis: THREE.Vector3; spin: number; from: THREE.Vector3;
};
let rolling: Roll | null = null;
const resultEl = document.getElementById('result')!;
const rollBtn = document.getElementById('roll') as HTMLButtonElement;

function roll(): void {
  if (rolling) return;
  const value = rollD6(); // il risultato e' deciso PRIMA dell'animazione (GDD #2, RNG-4)
  const visual = mulberry32((seed ^ Math.imul(value, 2654435761)) >>> 0); // solo estetica, non tocca il flusso
  rolling = {
    value,
    t: 0,
    dur: 1.35,
    target: orientationFor(value, visual() * Math.PI * 2),
    axis: new THREE.Vector3(visual() - 0.5, visual() * 0.4, visual() - 0.5).normalize(),
    spin: Math.PI * (6 + visual() * 4),
    from: new THREE.Vector3(DIE_REST.x + 2.2, 2.4, DIE_REST.z + 1.6),
  };
  rollBtn.disabled = true;
  resultEl.textContent = '…';
}
rollBtn.addEventListener('click', roll);
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); roll(); } });

document.getElementById('flip')!.addEventListener('click', () => {
  faceIndex = 1 - faceIndex;
  applyFace();
});

const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);
function stepRoll(dt: number): void {
  if (!rolling) return;
  rolling.t += dt;
  const k = Math.min(rolling.t / rolling.dur, 1);
  const e = easeOut(k);
  // traiettoria: arco verso il punto di riposo con rimbalzi che si smorzano
  die.position.lerpVectors(rolling.from, DIE_REST, e);
  die.position.y = DIE / 2 + Math.abs(Math.cos(k * Math.PI * 2.5)) * 2.2 * Math.pow(1 - k, 1.6);
  const tumble = new THREE.Quaternion().setFromAxisAngle(rolling.axis, rolling.spin * (1 - e));
  die.quaternion.copy(rolling.target).multiply(tumble);
  if (k >= 1) {
    die.quaternion.copy(rolling.target);
    die.position.copy(DIE_REST);
    resultEl.textContent = `Esce ${rolling.value}`;
    rolling = null;
    rollBtn.disabled = false;
  }
}

// --- Clic/tocco su una casella: l'auto si sposta (nessuna regola: solo manipolazione)
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = { x: 0, y: 0 };
let carMove: { t: number; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return; // era un trascinamento
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObject(tile)[0];
  if (!hit) return;
  carAt = nearestSpace(hit.point);
  carMove = { t: 0, from: car.position.clone(), to: spaceCenter(carAt.row, carAt.col) };
});
function stepCar(dt: number): void {
  if (!carMove) return;
  carMove.t = Math.min(carMove.t + dt / 0.45, 1);
  const e = easeOut(carMove.t);
  car.position.lerpVectors(carMove.from, carMove.to, e);
  car.position.y = TILE_T + Math.sin(carMove.t * Math.PI) * 0.35; // la mano solleva il pezzo
  if (carMove.t >= 1) carMove = null;
}

// --- Ciclo (Timer al posto di Clock, deprecato in r183)
const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop((t) => {
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 0.1);
  stepRoll(dt);
  stepCar(dt);
  controls.update();
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

// Per le verifiche automatiche: stato leggibile dalla console.
(window as unknown as { trv: object }).trv = {
  seed, roll,
  get carAt() { return carAt; },
  get rolling() { return rolling !== null; },
  get tileLoaded() { return faces[0] !== null; },
};
