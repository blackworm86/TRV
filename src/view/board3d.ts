// The road as vector geometry: every space of a tile is a chevron polygon built from the
// terrain grid in data/trv/game_base.json, coloured by its effect (rulebook p. 7). Spaces of
// neighbouring rows are offset, so each tile's front and rear edges zig-zag and the next tile
// slots into it like a toy brick. Each face is drawn in relief from terrain generated from the grid
// (src/view/terrain/procedural.ts), never from the official tile art; `terrain: 'flat'` keeps the
// plain coloured chevrons.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, hazardTokenSvg } from './vector/art';
import { svgTexture, trackTexture } from './texture';
import { GRID, spaceCenterPx, spaceOutlinePx, type TileData } from './tile-grid';
import { proceduralTerrain, normalMap, H_MIN, H_MAX } from './terrain/procedural';
import { buildObstacles, type ObstacleBlocker, type ObstacleKind } from './terrain/obstacles';
import { buildFireSpaces, buildRamps } from './terrain/carnage3d';
import LOOK from '../../data/trv/terrain_look.json';

export { GRID, TILE_PITCH_PX, spaceCenterPx, spaceOutlinePx, type TileData } from './tile-grid';

export interface TileMeshOptions {
  /** World size of the tile frame: length along the road, depth across it, thickness. */
  width: number;
  depth: number;
  thickness: number;
  /** On the starting tile, hazard spaces not used at this player count are drawn faint. */
  players?: number;
  /**
   * Relief terrain (when the face has terrain maps): world height of one height unit, so sand
   * rises `relief` above the asphalt and mud sinks `relief` below it. Default: half the thickness.
   */
  relief?: number;
  /**
   * Look of the face: 'procedural' = terrain generated from the grid (the only terrain the game
   * shows: the official tile art is never used as a texture); 'flat' = coloured chevrons.
   * Default: `?terrain=` in the page address, else 'procedural'.
   */
  terrain?: TerrainLook;
}

export type TerrainLook = 'procedural' | 'flat';
const URL_LOOK = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('terrain') : null;
const DEFAULT_LOOK: TerrainLook = URL_LOOK === 'flat' ? URL_LOOK : 'procedural';

/**
 * Flat outline of one space in a tile's own frame (centred, world units, lying in x / -z once
 * the mesh is turned flat with rotation.x = -PI/2). For highlights drawn over a space.
 */
export function spaceGeometry(r: number, c: number, width: number, depth: number, scale = 0.96): THREE.ShapeGeometry {
  const kx = width / GRID.frameW, kz = depth / GRID.frameH;
  const pts = spaceOutlinePx(r, c, scale).map(([x, y]) => new THREE.Vector2((x - GRID.frameW / 2) * kx, -(y - GRID.frameH / 2) * kz));
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}

/**
 * A band along the edge of a space: the outline between scale `inner` and scale `outer`, with the
 * middle left empty so the terrain underneath stays visible. Same frame as {@link spaceGeometry}.
 */
export function spaceRimGeometry(r: number, c: number, width: number, depth: number, outer = 1.0, inner = 0.84): THREE.ShapeGeometry {
  const kx = width / GRID.frameW, kz = depth / GRID.frameH;
  const v = (scale: number): THREE.Vector2[] => spaceOutlinePx(r, c, scale).map(([x, y]) => new THREE.Vector2((x - GRID.frameW / 2) * kx, -(y - GRID.frameH / 2) * kz));
  const shape = new THREE.Shape(v(outer));
  shape.holes.push(new THREE.Path(v(inner).reverse()));
  return new THREE.ShapeGeometry(shape);
}

const TERRAIN_COLOR: Record<string, string> = {
  R: PALETTE.road, o: PALETTE.offroad, M: PALETTE.mud, X: PALETTE.impassable,
  // Carnage at Devil's Run (CDR p3), codes of data/trv/carnage.json.
  G: PALETTE.toxicGoo, D: PALETTE.desertGlass, P: PALETTE.ramp, F: PALETTE.fire, S: PALETTE.saltFlats,
  O: '#1a1820', // a revealed oil slick on asphalt
};


// ------------------------------------------------------------------------------- relief terrain

/** Relief segments of the terrain mesh along the road and across it. */
const RELIEF_SEG: [number, number] = [500, 380];

/** Textures of a relief face; the height texture gives world height `scale * grey + bias` above `top`. */
interface ReliefTextures {
  albedo: THREE.Texture | null; normal: THREE.Texture | null; rough: THREE.Texture | null;
  mask: THREE.Texture | null; height: THREE.Texture | null; scale: number; bias: number;
  /** Embers that give off light (Carnage at Devil's Run burnt ground), when the face has fire. */
  glow?: THREE.Texture | null;
}

/** A face in relief: a plane displaced by the height map, cut to the tile by the outline map. */
function reliefMesh(t: ReliefTextures, width: number, depth: number, top: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    map: t.albedo, normalMap: t.normal, roughnessMap: t.rough, alphaMap: t.mask,
    displacementMap: t.height, displacementScale: t.scale, displacementBias: t.bias,
    alphaTest: 0.5, roughness: 1, metalness: 0,
    ...(t.glow ? { emissiveMap: t.glow, emissive: new THREE.Color('#ff5a12'), emissiveIntensity: 1.6 } : {}),
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, ...RELIEF_SEG), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = top + 0.001;
  mesh.receiveShadow = true;
  return mesh;
}

/** Bilinear lookup, at a frame pixel, of a w x h grid of values `stride` apart. */
function sampleGrid(v: ArrayLike<number>, w: number, h: number, stride: number, px: number, py: number): number {
  const gx = THREE.MathUtils.clamp(px / GRID.frameW * w - 0.5, 0, w - 1.001);
  const gy = THREE.MathUtils.clamp(py / GRID.frameH * h - 0.5, 0, h - 1.001);
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const at = (x: number, y: number): number => v[(y * w + x) * stride];
  return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
}

/** RGBA texture of `w` x `h` pixels (1 or 4 bytes each, row 0 = frame top), mipmapped. */
function dataTexture(data: Uint8ClampedArray, w: number, h: number, channels: 1 | 4, srgb = false): THREE.DataTexture {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = y * w, dst = (h - 1 - y) * w; // texture v runs up the frame
    for (let x = 0; x < w; x++) {
      const o = (dst + x) * 4;
      if (channels === 4) {
        const i = (src + x) * 4;
        out[o] = data[i]; out[o + 1] = data[i + 1]; out[o + 2] = data[i + 2]; out[o + 3] = data[i + 3];
      } else {
        const v = data[src + x];
        out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
      }
    }
  }
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** The kind of obstacle on a face's impassable spaces (data/trv/terrain_look.json). */
function obstacleKind(tile: TileData): ObstacleKind {
  const table = LOOK.obstacles as Record<string, string>;
  return (table[`${tile.tile ?? ''}${tile.side ?? ''}`] ?? table.default) as ObstacleKind;
}

const procCache = new Map<string, { textures: ReliefTextures; info: THREE.Texture; height: Float32Array; w: number; h: number }>();

/**
 * A face's terrain generated from its grid (src/view/terrain/procedural.ts), in relief, and its
 * information layer: a second surface following the same relief, unlit so its lines stay bright.
 */
function proceduralRelief(tile: TileData, players: number | undefined, width: number, depth: number, top: number, amp: number): {
  mesh: THREE.Mesh; info: THREE.Mesh; heightAt: (px: number, py: number) => number;
} {
  const key = `${tile.tile ?? ''}${tile.side ?? ''}|${tile.name}|${tile.terrain.join('')}|${players ?? ''}|${width}|${amp}`;
  let hit = procCache.get(key);
  if (!hit) {
    const m = proceduralTerrain(tile, { players });
    const range = H_MAX - H_MIN;
    const hb = new Uint8ClampedArray(m.w * m.h);
    for (let i = 0; i < hb.length; i++) hb[i] = (m.height[i] - H_MIN) / range * 255;
    const slope = amp / (width / m.w) * 1.3; // a little steeper than true, so the relief reads
    hit = {
      textures: {
        albedo: dataTexture(m.albedo, m.w, m.h, 4, true), normal: dataTexture(normalMap(m, slope), m.w, m.h, 4),
        rough: dataTexture(m.rough, m.w, m.h, 1), mask: dataTexture(m.mask, m.w, m.h, 1), height: dataTexture(hb, m.w, m.h, 1),
        // grey g (0..1) -> h = H_MIN + range g -> world amp (h + 1) above `top`
        scale: amp * range, bias: amp * (H_MIN + 1),
        ...(m.glow ? { glow: dataTexture(m.glow, m.w, m.h, 1) } : {}),
      },
      info: dataTexture(m.info.data, m.info.w, m.info.h, 4, true),
      height: m.height, w: m.w, h: m.h,
    };
    procCache.set(key, hit);
  }
  const { textures, height, w, h } = hit;
  // The information layer: same relief, a hair above the ground, lit by nothing (its own colours).
  const info = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, ...RELIEF_SEG), new THREE.MeshStandardMaterial({
    map: hit.info, emissiveMap: hit.info, emissive: 0xffffff, emissiveIntensity: 1, color: 0x000000,
    displacementMap: textures.height, displacementScale: textures.scale, displacementBias: textures.bias,
    transparent: true, depthWrite: false, toneMapped: false, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  info.rotation.x = -Math.PI / 2;
  info.position.y = top + 0.006;
  info.renderOrder = 1;
  info.name = 'info';
  return {
    mesh: reliefMesh(textures, width, depth, top), info,
    heightAt: (px, py) => amp * (sampleGrid(height, w, h, 1, px, py) + 1) + 0.001,
  };
}

/**
 * Builds one road tile centred on the origin, in world units. A frame pixel (x, y) maps to
 * world ((x - W/2) kx, y, (y - H/2) kz), the same mapping the rules' space centres use.
 */
export function buildTile(tile: TileData, o: TileMeshOptions): THREE.Group {
  const kx = o.width / GRID.frameW, kz = o.depth / GRID.frameH;
  // Shapes live in x/y; the meshes are turned flat (rotation.x = -PI/2), so shape y = -world z.
  const toShape = (pts: [number, number][]): THREE.Shape => {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => {
      const X = (x - GRID.frameW / 2) * kx, Y = -(y - GRID.frameH / 2) * kz;
      if (i === 0) s.moveTo(X, Y); else s.lineTo(X, Y);
    });
    s.closePath();
    return s;
  };
  const ring = (outerPts: [number, number][], innerPts: [number, number][]): THREE.ShapeGeometry => {
    const outer = toShape(outerPts);
    outer.holes.push(new THREE.Path(toShape(innerPts).getPoints().reverse()));
    return new THREE.ShapeGeometry(outer);
  };
  const group = new THREE.Group();
  const body: THREE.BufferGeometry[] = [];
  const tops = new Map<string, THREE.BufferGeometry[]>();
  const borders: THREE.BufferGeometry[] = [];
  const hazardMarks: THREE.BufferGeometry[] = [];
  const faintMarks: THREE.BufferGeometry[] = [];
  const hazardAt = new Map<string, number[] | undefined>();
  for (const h of tile.hazards) hazardAt.set(`${h[0]},${h[1]}`, h[2] as number[] | undefined);

  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      body.push(new THREE.ExtrudeGeometry(toShape(spaceOutlinePx(r, c)), { depth: o.thickness, bevelEnabled: false }));
      const t = tile.terrain[r][c];
      if (!tops.has(t)) tops.set(t, []);
      tops.get(t)!.push(new THREE.ShapeGeometry(toShape(spaceOutlinePx(r, c, 0.965))));
      if (t === 'X') {
        borders.push(ring(spaceOutlinePx(r, c, 0.9), spaceOutlinePx(r, c, 0.85)));
        borders.push(ring(spaceOutlinePx(r, c, 0.79), spaceOutlinePx(r, c, 0.74)));
      }
      if (hazardAt.has(`${r},${c}`)) {
        const counts = hazardAt.get(`${r},${c}`);
        const used = !counts || o.players === undefined || counts.includes(o.players);
        const [cx, cy] = spaceCenterPx(r, c);
        for (const k of [1, 0.55]) {
          const s = 46 * k;
          const tri = (sc: number): [number, number][] => [[cx - s * sc, cy - s * 1.1 * sc], [cx + s * 1.2 * sc, cy], [cx - s * sc, cy + s * 1.1 * sc]];
          (used ? hazardMarks : faintMarks).push(ring(tri(1), tri(0.7)));
        }
      }
    }
  }
  const flat = (geos: THREE.BufferGeometry[], color: string, y: number, opacity = 1): void => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color, roughness: 0.85, transparent: opacity < 1, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = true;
    group.add(m);
  };
  const base = new THREE.Mesh(mergeGeometries(body), new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.9 }));
  base.rotation.x = -Math.PI / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const look = o.terrain ?? DEFAULT_LOOK;
  const amp = o.relief ?? o.thickness * 0.5;
  // Impassable spaces carry a 3D obstacle (rocks, mesas, ruins, bunkers), whatever the terrain's look.
  const obstacles = look === 'flat' ? null : buildObstacles(tile, obstacleKind(tile), { width: o.width, depth: o.depth });
  if (obstacles) {
    obstacles.position.y = o.thickness + amp * 1.2;
    group.add(obstacles);
    // What each impassable space hides, for the camera director: in the tile's frame, `h` the top above the tile's base.
    group.userData.blockers = (obstacles.userData.blockers as ObstacleBlocker[]).map(b => ({ ...b, h: b.h + obstacles.position.y }));
  }
  if (look !== 'flat') {
    // Terrain generated from the grid, and over it, apart, the information layer (grid lines, tape
    // around impassable spaces, hazard marks): `group.userData.info`, which the game can hide.
    const relief = proceduralRelief(tile, o.players, o.width, o.depth, o.thickness, amp);
    group.add(relief.mesh, relief.info);
    group.userData.heightAt = relief.heightAt;
    group.userData.info = relief.info;
    // Carnage at Devil's Run: fire on fire spaces and launch ramps on ramp spaces, standing on the ground there.
    const ground = (px: number, py: number): number => o.thickness + relief.heightAt(px, py);
    const fire = buildFireSpaces(tile, { width: o.width, depth: o.depth, ground });
    if (fire) group.add(fire);
    const ramps = buildRamps(tile, { width: o.width, depth: o.depth, ground });
    if (ramps) group.add(ramps);

  } else {
    /** Height of the ground above the tile's cardboard top at a frame pixel (world units). */
    group.userData.heightAt = (): number => 0.002;
    for (const [t, geos] of tops) flat(geos, TERRAIN_COLOR[t] ?? '#888', o.thickness + 0.002);
    flat(borders, PALETTE.impassableBorder, o.thickness + 0.004);
    flat(hazardMarks, PALETTE.hazardRed, o.thickness + 0.004);
    flat(faintMarks, PALETTE.hazardRed, o.thickness + 0.004, 0.25);
  }

  // Name banner in the strip along the left edge (above row 0).
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 96;
  const x2 = c.getContext('2d')!;
  x2.fillStyle = '#2a1c14'; x2.fillRect(0, 0, 1024, 96);
  x2.fillStyle = '#f6c46a'; x2.font = 'bold 64px Impact, "Arial Narrow", sans-serif'; x2.fillText(tile.name.toUpperCase(), 24, 72);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const stripPx = GRID.y0 - GRID.rowPitch / 2; // strip from y = 0 to the top of row 0
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(o.width * 0.86, stripPx * 0.7 * kz), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  banner.rotation.x = -Math.PI / 2;
  banner.position.set(-o.width * 0.04, o.thickness, (stripPx * 0.55 - GRID.frameH / 2) * kz);
  banner.receiveShadow = true;
  group.add(banner);
  return group;
}

/**
 * Hazard token: a cardboard chevron with vector art on both faces; image right = forward (+x).
 * `setFaceUp` flips it; `update(dt)` plays the flip (call it every frame).
 */
// ------------------------------------------------------------------------------- revealed ground

/** Token outline (art.ts CHEVRON, 120 x 100: a road space's shape). */
const TOKEN_OUTLINE: [number, number][] = [[1.5, 1.5], [104.7, 1.5], [118.5, 50], [104.7, 98.5], [1.5, 98.5], [15.3, 50]];
const groundCache = new Map<string, THREE.CanvasTexture>();

/**
 * The top of a revealed hazard token drawn as the ground it stands for (asked by the user,
 * 2026-11-16): the procedural terrain of `code` (R road, M mud, O oil on asphalt, D desert glass,
 * P ramp sand, F burnt ground), cut to the token's shape; `pit` draws the Pit Trap's hole instead.
 */
export function tokenGroundTexture(code: string): THREE.CanvasTexture {
  const hit = groundCache.get(code);
  if (hit) return hit;
  const W = 360, H = 300;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.beginPath();
  TOKEN_OUTLINE.forEach(([px, py], i) => (i ? x.lineTo(px * W / 120, py * H / 100) : x.moveTo(px * W / 120, py * H / 100)));
  x.closePath();
  x.save();
  x.clip();
  const ground = code === 'pit' ? 'o' : code;
  // A small face made only of this terrain; one space from its middle is the token's top.
  const m = proceduralTerrain({ name: `ground-${code}`, terrain: Array(GRID.rows).fill(ground.repeat(GRID.cols)), hazards: [] }, { width: 700, infoWidth: 64 });
  const img = new ImageData(new Uint8ClampedArray(m.albedo), m.w, m.h);
  const src = document.createElement('canvas');
  src.width = m.w; src.height = m.h;
  src.getContext('2d')!.putImageData(img, 0, 0);
  const pts = spaceOutlinePx(2, 3);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const k = m.w / GRID.frameW;
  const sx = Math.min(...xs) * k, sy = Math.min(...ys) * k, sw = (Math.max(...xs) - Math.min(...xs)) * k, sh = (Math.max(...ys) - Math.min(...ys)) * k;
  x.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
  // The pit trap's hole is 3D (terrain/pit3d.ts): the token keeps only its dusty ground, framed by
  // the yellow and black tape of impassable spaces, which it is from now on (CDR p3; asked by the
  // user, 2026-11-17). The outline is still the path: the stroke's inner half shows inside the clip.
  if (code === 'pit') {
    const tape = document.createElement('canvas');
    tape.width = tape.height = 24;
    const t = tape.getContext('2d')!;
    t.fillStyle = 'rgb(246,196,62)'; t.fillRect(0, 0, 24, 24);
    t.fillStyle = 'rgb(28,24,22)';
    t.beginPath(); t.moveTo(12, 0); t.lineTo(24, 0); t.lineTo(0, 24); t.lineTo(0, 12); t.closePath(); t.fill();
    t.beginPath(); t.moveTo(24, 12); t.lineTo(24, 24); t.lineTo(12, 24); t.closePath(); t.fill();
    x.strokeStyle = x.createPattern(tape, 'repeat')!;
    x.lineWidth = 34;
    x.lineJoin = 'miter';
    x.stroke();
  }
  x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  groundCache.set(code, t);
  return t;
}

export function hazardToken(type: string, size: { length: number; depth: number; thickness: number }): {
  group: THREE.Group; setFaceUp: (up: boolean) => void; update: (dt: number) => void;
  /** Shows the token's top as ground (a revealed terrain hazard), with `piece` standing on it; null puts the printed face back. */
  setGround: (code: string | null, piece?: THREE.Object3D) => void;
} {
  const kx = size.length / 120, kz = size.depth / 100;
  // Token outline (art.ts CHEVRON, 120 x 100: a road space's shape), centred, in shape x / y = world x / -z.
  const outline: [number, number][] = [[1.5, 1.5], [104.7, 1.5], [118.5, 50], [104.7, 98.5], [1.5, 98.5], [15.3, 50]];
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2((x - 60) * kx, -(y - 50) * kz)));
  const card = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: size.thickness * 0.96, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 }));
  card.rotation.x = -Math.PI / 2;
  card.position.y = -size.thickness / 2;
  card.castShadow = true;
  const face = (svgText: string, up: boolean): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size.length, size.depth),
      new THREE.MeshStandardMaterial({ map: svgTexture(svgText, 512), alphaTest: 0.5, roughness: 0.7 }));
    // Top face reads normally from above; the bottom face is mirrored so it reads when flipped.
    m.rotation.set(up ? -Math.PI / 2 : Math.PI / 2, 0, 0);
    m.position.y = (up ? 1 : -1) * (size.thickness / 2 + 0.001);
    m.receiveShadow = true;
    return m;
  };
  const chip = new THREE.Group();
  const top = face(hazardTokenSvg(type, true), true);
  const printed = (top.material as THREE.MeshStandardMaterial).map;
  chip.add(card, top, face(hazardTokenSvg(type, false), false)); // the back of its own set (Carnage has its own)
  let ground: string | null = null, piece: THREE.Object3D | null = null;
  chip.position.y = size.thickness / 2;
  const group = new THREE.Group();
  group.add(chip);
  let target = 0, angle = 0, lift = 0, first = true;
  const pose = (): void => {
    chip.rotation.x = angle;
    chip.position.y = size.thickness / 2 + Math.sin(Math.min(Math.PI, Math.abs(angle - target) > 1e-3 ? lift : 0)) * size.length * 0.6;
  };
  return {
    group,
    setGround: (code, p) => {
      if (code === ground) return;
      ground = code;
      const mat = top.material as THREE.MeshStandardMaterial;
      mat.map = code ? tokenGroundTexture(code) : printed;
      mat.roughness = code === 'O' || code === 'D' ? 0.15 : 0.8;
      mat.needsUpdate = true;
      if (piece) { chip.remove(piece); piece = null; }
      if (code && p) { piece = p; p.position.y = size.thickness / 2 + 0.002; chip.add(p); }
    },
    setFaceUp: up => {
      const t = up ? 0 : Math.PI;
      if (first) { first = false; target = angle = t; pose(); return; }
      if (t !== target) { target = t; lift = 0; }
    },
    update: dt => {
      if (Math.abs(angle - target) < 1e-3) return;
      const step = Math.sign(target - angle) * Math.min(Math.abs(target - angle), dt * Math.PI * 1.6);
      angle += step;
      lift = Math.PI * (1 - Math.abs(target - angle) / Math.PI);
      pose();
      if (Math.abs(angle - target) < 1e-3) { angle = target; chip.position.y = size.thickness / 2; chip.rotation.x = angle; }
    },
  };
}
