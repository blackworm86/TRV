// The template of a vehicle in 3D (design/art/modelli-strutturati.md §17): its grey boxes and wheels,
// the standard figure in every seat, the grips and foot rests, a grid on the ground with a square
// every half metre and a person standing beside it as a yardstick. Built from the data of the
// production sheet (src/models/dima.ts). Also the pictures to attach to Gemini (three flat views and a
// three-quarter one) and the .glb the inspector lays over a model. Metres; +x ahead, +y up.

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type { P3 } from '../app/motion/rider';
import type { Rules } from '../admin/produzione';
import { dimaSize, poseFigure, positions, seatFigure, type Dima, type DimaSeat, type Figure } from '../models/dima';

/** What of the template is drawn. */
export interface DimaLook {
  wheels: boolean;
  /** The pieces that are not the body: the weapon and its base. */
  weapons: boolean;
  /** The figures: solid, see-through (a measure of scale only), or left out. */
  figure: 'solid' | 'ghost' | 'none';
  /** Grips, foot rests and hips as coloured marks. */
  marks: boolean;
  /** The ground grid and the person standing beside the vehicle. */
  ground: boolean;
  /** Which position every seat is shown in: 0 the neutral one, then its extremes in order. */
  position: number;
  /** Only the boxes of the pieces whose name starts so (`arma`, `avantreno`), with who stands or rides at them. */
  only?: string;
}
/** Everything on, the figures solid, the neutral position. */
export const DIMA_WHOLE: DimaLook = { wheels: true, weapons: true, figure: 'solid', marks: true, ground: true, position: 0 };

const GREY = { body: 0x9a9a9a, control: 0x5e5e5e, seat: 0x7b6f63, weapon: 0x6f7780, wheel: 0x3a3a3a, figure: 0xd9a066, ground: 0xcfcfcf };
const v = (p: P3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);

/** A capsule from `a` to `b`, `radius` thick. */
function limb(a: P3, b: P3, radius: number, mat: THREE.Material): THREE.Mesh {
  const from = v(a), to = v(b), length = from.distanceTo(to);
  const mesh = new THREE.Mesh(length > 1e-4 ? new THREE.CapsuleGeometry(radius, length, 4, 12) : new THREE.SphereGeometry(radius, 14, 10), mat);
  mesh.position.copy(from).lerp(to, 0.5);
  if (length > 1e-4) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return mesh;
}

/** The standard figure on the joints `f`. */
function figureMesh(f: Figure, r: Rules, ghost: boolean): THREE.Group {
  const c = r.figura.capsule, m = r.figura.misure, g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: GREY.figure, roughness: 0.8, transparent: ghost, opacity: ghost ? 0.35 : 1, depthWrite: !ghost });
  g.name = 'figura';
  g.add(limb(f.hips, f.chest, c.busto, mat), limb(f.head, f.head, c.testa, mat), limb(f.shoulderL, f.shoulderR, c.braccio, mat), limb(f.hipL, f.hipR, c.coscia, mat));
  for (const s of ['L', 'R'] as const) {
    g.add(limb(f[`shoulder${s}`], f[`elbow${s}`], c.braccio, mat), limb(f[`elbow${s}`], f[`hand${s}`], c.braccio * 0.9, mat), limb(f[`hand${s}`], f[`hand${s}`], c.braccio * 1.1, mat));
    g.add(limb(f[`hip${s}`], f[`knee${s}`], c.coscia, mat), limb(f[`knee${s}`], f[`ankle${s}`], c.stinco, mat));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(m.piede, m.caviglia, 0.1), mat);
    foot.position.set(f[`ankle${s}`].x + m.piede * 0.25, f[`ankle${s}`].y - m.caviglia / 2, f[`ankle${s}`].z);
    g.add(foot);
  }
  return g;
}

/** A person standing at `x`, `z`, arms down: the yardstick beside the vehicle. */
function standing(x: number, z: number, r: Rules): Figure {
  const m = r.figura.misure, y = m.anche_da_terra;
  const seat: DimaSeat = {
    id: 'metro', posa: 'stand', ruolo: '', anche: [x, y, z],
    prese: { L: [x + 0.05, y - 0.1, z - 0.27], R: [x + 0.05, y - 0.1, z + 0.27] }, piedi: { L: [x, 0, z - 0.1], R: [x, 0, z + 0.1] },
  };
  return seatFigure(seat, seat.prese, 0, r); // upright, its legs straight
}

/** The figure of `seat` in the position number `position` (the last one, past its end). */
export function seatPose(seat: DimaSeat, position: number, r: Rules): Figure {
  const all = positions(seat);
  return poseFigure(seat, all[Math.min(position, all.length - 1)].prese, r);
}

/** The template `dima` as a group of meshes, as `look` asks. */
export function buildDima(dima: Dima, r: Rules, look: DimaLook = DIMA_WHOLE): THREE.Group {
  const g = new THREE.Group();
  g.name = 'dima';
  const flat = (color: number, more: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...more });
  const mats = { pieno: flat(GREY.body), sedile: flat(GREY.seat), comando: flat(GREY.control), vetro: flat(0xbfd6de, { transparent: true, opacity: 0.35, depthWrite: false }), weapon: flat(GREY.weapon) };
  for (const b of dima.volumi) {
    if (look.only ? !b.pezzo?.startsWith(look.only) : b.pezzo && !look.weapons) continue;
    const size = [0, 1, 2].map(i => Math.abs(b.a[i] - b.da[i]));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), b.pezzo ? mats.weapon : mats[b.uso ?? 'pieno']);
    mesh.position.set((b.da[0] + b.a[0]) / 2, (b.da[1] + b.a[1]) / 2, (b.da[2] + b.a[2]) / 2);
    mesh.name = b.id;
    g.add(mesh);
  }
  if (look.wheels) {
    const tyre = flat(GREY.wheel);
    for (const w of dima.ruote) {
      for (const k of [-1, 1]) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(w.r, w.r, w.w, 28), tyre);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(w.x, w.r, k * w.z);
        mesh.name = `ruota_${w.x > 0 ? 'ant' : 'post'}_${k < 0 ? 'L' : 'R'}`;
        g.add(mesh);
      }
    }
  }
  const dot = (p: number[], color: number): void => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color })); s.position.set(p[0], p[1], p[2]); g.add(s); };
  for (const seat of dima.posti) {
    if (look.only && seat.posa === 'sit') continue; // a piece alone: only who holds it
    const all = positions(seat), pos = all[Math.min(look.position, all.length - 1)];
    if (look.figure !== 'none') g.add(figureMesh(poseFigure(seat, pos.prese, r), r, look.figure === 'ghost'));
    if (!look.marks) continue;
    dot(seat.anche, 0xffffff);
    for (const s of ['L', 'R'] as const) { dot(pos.prese[s], 0xff5a36); dot(seat.piedi[s], 0x2f9bff); }
  }
  if (look.ground) {
    const size = dimaSize(dima), cells = Math.ceil((size.length + 2) / 0.5) + (Math.ceil((size.length + 2) / 0.5) % 2);
    const grid = new THREE.GridHelper(cells * 0.5, cells, 0x777777, 0xa9a9a9);
    grid.name = 'griglia';
    // Behind the vehicle, so it hides nothing from the side.
    g.add(grid, figureMesh(standing(-size.length / 2 - 0.7, 0, r), r, look.figure === 'ghost'));
  }
  return g;
}

/** A named picture of a template. */
export interface DimaView { name: string; blob: Blob }

/**
 * The pictures of a template to attach to Gemini (§17): the body alone, with no wheels and no weapon
 * and the figures see-through, from the side, from above, from the front and in three quarters; then
 * the whole vehicle with its crew, in three quarters and from the side; then every other piece alone
 * from the side (the weapon, the motorcycle's front end), with who holds it. PNG, light grey ground,
 * 1600 × 1000.
 */
export async function dimaViews(dima: Dima, r: Rules): Promise<DimaView[]> {
  const W = 1600, H = 1000;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  // Room for the person standing behind the vehicle and for a gunner standing on it.
  const size = dimaSize(dima), tall = Math.max(size.height + 0.9, 2.1), reach = Math.max((size.length / 2 + 1.3) / (W / H), size.width / 2 + 0.5, tall / 2 + 0.4), centre = new THREE.Vector3(-0.45, tall / 2, 0);
  const shot = async (name: string, look: DimaLook, from: THREE.Vector3, up: THREE.Vector3, flat: boolean): Promise<DimaView> => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe4e4e4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-3, 6, -4);
    scene.add(sun, buildDima(dima, r, look));
    const cam = flat ? new THREE.OrthographicCamera(-reach * W / H, reach * W / H, reach, -reach, 0.1, 100) : new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
    cam.up.copy(up);
    cam.position.copy(centre).addScaledVector(from.clone().normalize(), flat ? 30 : reach * 5.4);
    cam.lookAt(centre);
    renderer.render(scene, cam);
    const blob = await new Promise<Blob>((ok, no) => renderer.domElement.toBlob(b => b ? ok(b) : no(new Error('immagine non creata')), 'image/png'));
    return { name, blob };
  };
  const body: DimaLook = { wheels: false, weapons: false, figure: 'ghost', marks: false, ground: true, position: 0 };
  const Y = new THREE.Vector3(0, 1, 0), quarter = new THREE.Vector3(1, 0.75, -1);
  const alone = [...new Set(dima.volumi.map(b => b.pezzo?.replace('arma_base', 'arma')).filter((x): x is string => !!x))]
    .filter(piece => piece !== 'arma' || dima.posti.some(s => s.posa === 'stand'));
  try {
    return [
      await shot('carrozzeria_lato', body, new THREE.Vector3(0, 0, 1), Y, true),
      await shot('carrozzeria_alto', body, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), true),
      await shot('carrozzeria_fronte', body, new THREE.Vector3(1, 0, 0), Y, true),
      await shot('carrozzeria_trequarti', body, quarter, Y, false),
      await shot('intera_trequarti', { ...DIMA_WHOLE, marks: false }, quarter, Y, false),
      await shot('intera_lato', { ...DIMA_WHOLE, marks: false }, new THREE.Vector3(0, 0, 1), Y, true),
      ...await Promise.all(alone.map(piece => shot(`${piece}_lato`, { ...body, only: piece }, new THREE.Vector3(0, 0, 1), Y, true))),
    ];
  } finally {
    renderer.dispose();
  }
}

/** The template as a .glb file: the whole vehicle with its crew, no ground. */
export async function dimaGlb(dima: Dima, r: Rules): Promise<Blob> {
  const data = await new GLTFExporter().parseAsync(buildDima(dima, r, { ...DIMA_WHOLE, marks: false, ground: false }), { binary: true });
  return new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' });
}
