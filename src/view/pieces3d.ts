// 3D pieces built from the physical catalog (src/game/trv/catalog.ts): every piece is made at
// its catalog size in millimetres, times one scale factor for the whole table, and dressed with
// the licensed images the catalog names. Images load at runtime; a missing image leaves a plain
// coloured piece, so the table still works without the licensed files.

import * as THREE from 'three';

/** Loads and caches textures; calls back for every mesh that waits on the same image. */
export class TextureBank {
  private readonly cache = new Map<string, THREE.Texture>();
  private readonly waiting = new Map<string, ((t: THREE.Texture) => void)[]>();
  /** Images that failed to load. */
  readonly missing = new Set<string>();
  private readonly loader = new THREE.TextureLoader();

  constructor(private readonly anisotropy: number) {}

  /** Example: `bank.use(url, tex => { mat.map = tex; mat.needsUpdate = true; })`. */
  use(url: string | null, apply: (t: THREE.Texture) => void): void {
    if (!url) return;
    const hit = this.cache.get(url);
    if (hit) { apply(hit); return; }
    const list = this.waiting.get(url);
    if (list) { list.push(apply); return; }
    this.waiting.set(url, [apply]);
    this.loader.load(url, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.anisotropy;
      this.cache.set(url, t);
      for (const f of this.waiting.get(url) ?? []) f(t);
      this.waiting.delete(url);
    }, undefined, () => { this.missing.add(url); this.waiting.delete(url); });
  }
}

/** Piece factory at one table scale (world units per millimetre). */
export class Pieces {
  constructor(readonly mm: number, private readonly bank: TextureBank) {}

  /**
   * A road tile: printed face on top. Its image keeps the print frame, so the space grid
   * measured on the image is valid on the mesh. Size: [length, depth, thickness] in mm.
   */
  roadTile(size: [number, number, number]): { group: THREE.Group; setFace: (url: string | null) => void } {
    const [w, d, t] = size.map(v => v * this.mm);
    const top = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.85, transparent: true, alphaTest: 0.5 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, d), top);
    face.rotation.x = -Math.PI / 2;
    face.position.y = t;
    face.receiveShadow = true;
    const group = new THREE.Group();
    group.add(face);
    let shown: string | null = null;
    return {
      group,
      setFace: url => {
        if (url === shown) return;
        shown = url;
        this.bank.use(url, tex => { if (shown === url) { top.map = tex; top.color.set(0xffffff); top.needsUpdate = true; } });
      },
    };
  }

  /**
   * A cardboard token: front image on top, back image underneath, cut to the image's outline.
   * The image's top edge points forward (+x), like the chevrons on the road.
   * Size: [image width, image height, thickness] in mm.
   */
  token(size: [number, number, number], front: string | null, back: string | null): { group: THREE.Group; setFaceUp: (up: boolean) => void } {
    const [w, d, t] = size.map(v => v * this.mm);
    const mk = (url: string | null, y: number, down: boolean): THREE.Mesh => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.7, transparent: true, alphaTest: 0.5 });
      this.bank.use(url, tex => { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.set(down ? Math.PI / 2 : -Math.PI / 2, 0, 0);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const holder = new THREE.Group();
    holder.add(mk(front, t, false), mk(back, 0, true));
    holder.rotation.y = -Math.PI / 2; // image top -> +x (forward)
    const group = new THREE.Group();
    group.add(holder);
    return {
      group,
      setFaceUp: up => {
        holder.rotation.x = up ? 0 : Math.PI;
        holder.position.y = up ? 0 : t;
      },
    };
  }

  /**
   * A die. `faces` are image urls, or pip counts drawn on `color`. `forwardUp` turns the top
   * face's image so its top points forward (+x): the direction die must line up with the
   * road's chevrons (rulebook p. 10); other dice read towards the players (-z is away).
   */
  die(sizeMm: number, faces: (string | number)[], color: string, forwardUp: boolean): { mesh: THREE.Mesh; show: (face: number, yaw?: number) => void } {
    const s = sizeMm * this.mm;
    const mats = faces.map(f => {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
      if (typeof f === 'number') mat.map = pipTexture(f, color);
      else { mat.color.set(color); this.bank.use(f, tex => { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; }); }
      return mat;
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mats);
    mesh.castShadow = true;
    const target = forwardUp ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, -1);
    return {
      mesh,
      show: (face, yaw = 0) => {
        mesh.quaternion.copy(faceUpQuaternion(face, target));
        if (yaw) mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
      },
    };
  }

  /** A car miniature stand-in at catalog size: [length, width, height] in mm. Nose at +x. */
  car(size: [number, number, number], color: string, wreck: boolean): THREE.Group {
    const [L, W, H] = size.map(v => v * this.mm);
    const body = new THREE.MeshStandardMaterial({ color: wreck ? 0x3b342e : color, roughness: wreck ? 0.95 : 0.45, metalness: wreck ? 0 : 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: wreck ? 0x1a1714 : 0x1e232b, roughness: 0.4 });
    const g = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(L * 0.82, H * 0.42, W), body);
    chassis.position.set(-L * 0.09, H * 0.38, 0);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, H * 0.42, 3), body);
    nose.rotation.y = Math.PI;
    nose.scale.set(0.42, 1, 1);
    nose.position.set(L * 0.32, H * 0.38, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.36, H * 0.32, W * 0.78), dark);
    cab.position.set(-L * 0.12, H * 0.74, 0);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.07, W * 0.07, L * 0.36, 6), dark);
    gun.rotation.z = Math.PI / 2;
    gun.position.set(L * 0.16, H * 0.96, 0);
    g.add(chassis, nose, cab, gun);
    const wheel = new THREE.CylinderGeometry(H * 0.22, H * 0.22, W * 0.16, 12);
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const w = new THREE.Mesh(wheel, dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(x * L * 0.3, H * 0.22, z * W * 0.5);
      g.add(w);
    }
    g.traverse(o => { o.castShadow = true; });
    return g;
  }

  /** A chopper stand-in at catalog size; its rotor is the child named "rotor". */
  chopper(size: [number, number, number], color: string): THREE.Group {
    const [L, , H] = size.map(v => v * this.mm);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(L * 0.2, 16, 12), mat);
    body.scale.set(1.5, 0.85, 0.9);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.45, L * 0.05, L * 0.05), mat);
    tail.position.set(-L * 0.38, L * 0.03, 0);
    const rotor = new THREE.Group();
    for (const a of [0, Math.PI / 2]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(L, L * 0.02, L * 0.05), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      b.rotation.y = a;
      rotor.add(b);
    }
    rotor.position.y = H * 0.45;
    rotor.name = 'rotor';
    g.add(body, tail, rotor);
    g.traverse(o => { o.castShadow = true; });
    return g;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
/** BoxGeometry face slots: +x, -x, +y, -y, +z, -z, with the direction of each image's top. */
const SLOT_NORMAL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => new THREE.Vector3(v[0], v[1], v[2]));
const SLOT_TEXUP = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]].map(v => new THREE.Vector3(v[0], v[1], v[2]));

/** Rotation that puts slot `face` on top, with its image's top pointing at `forward`. */
export function faceUpQuaternion(face: number, forward: THREE.Vector3): THREE.Quaternion {
  const n = SLOT_NORMAL[face], u = SLOT_TEXUP[face];
  const local = new THREE.Matrix4().makeBasis(n, u, new THREE.Vector3().crossVectors(n, u));
  const world = new THREE.Matrix4().makeBasis(UP, forward, new THREE.Vector3().crossVectors(UP, forward));
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(local.transpose()));
}

const pipCache = new Map<string, THREE.CanvasTexture>();
function pipTexture(n: number, color: string): THREE.CanvasTexture {
  const k = `${n}${color}`;
  const hit = pipCache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = luminance(color) > 0.55 ? '#1b1b1b' : '#f4efe6';
  const at: Record<number, [number, number][]> = {
    1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[34, 34], [64, 64], [94, 94]],
    4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
    6: [[34, 30], [94, 30], [34, 64], [94, 64], [34, 98], [94, 98]],
  };
  for (const [px, py] of at[n] ?? []) { x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  pipCache.set(k, t);
  return t;
}

function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}
