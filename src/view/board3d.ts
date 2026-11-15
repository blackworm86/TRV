// The road as vector geometry: every space of a tile is a chevron polygon built from the
// terrain grid in data/trv/game_base.json, coloured by its effect (rulebook p. 7). Spaces of
// neighbouring rows are offset, so each tile's front and rear edges zig-zag and the next tile
// slots into it like a toy brick. No licensed image is used.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, hazardTokenSvg } from './vector/art';
import { svgTexture } from './texture';

/** Space grid measured on the tiles, in pixels of a 2000 x 1522 frame (row 0 = left edge). */
export const GRID = {
  frameW: 2000, frameH: 1522,
  /** Centre x of column 0 on even and odd rows, column pitch, row 0 centre y, row pitch. */
  x0Even: 130, x0Odd: 220, pitch: 233, y0: 330, rowPitch: 216,
  /** Depth of the chevron point. */
  tip: 34,
  rows: 6, cols: 8,
};

/** Distance between consecutive tiles, in frame pixels: 8 columns, so rows continue seamlessly. */
export const TILE_PITCH_PX = GRID.cols * GRID.pitch;

export interface TileData {
  name: string;
  terrain: string[];
  /** [row, col, player counts?] */
  hazards: unknown[][];
}

export interface TileMeshOptions {
  /** World size of the tile frame: length along the road, depth across it, thickness. */
  width: number;
  depth: number;
  thickness: number;
  /** On the starting tile, hazard spaces not used at this player count are drawn faint. */
  players?: number;
}

/** Centre of a space in frame pixels. Columns may run past 0..7 (neighbouring tiles). */
export function spaceCenterPx(r: number, c: number): [number, number] {
  const odd = Math.abs(r % 2) === 1;
  return [(odd ? GRID.x0Odd : GRID.x0Even) + GRID.pitch * c, GRID.y0 + GRID.rowPitch * r];
}

/** Chevron outline of one space (pointing forward, +x), in frame pixels, scaled about its centre. */
export function spaceOutlinePx(r: number, c: number, scale = 1): [number, number][] {
  const [cx, cy] = spaceCenterPx(r, c);
  const hw = GRID.pitch / 2, hh = GRID.rowPitch / 2, t = GRID.tip;
  const pts: [number, number][] = [[-hw, -hh], [hw, -hh], [hw + t, 0], [hw, hh], [-hw, hh], [-hw + t, 0]];
  return pts.map(([x, y]) => [cx + x * scale, cy + y * scale]);
}

/**
 * Flat outline of one space in a tile's own frame (centred, world units, lying in x / -z once
 * the mesh is turned flat with rotation.x = -PI/2). For highlights drawn over a space.
 */
export function spaceGeometry(r: number, c: number, width: number, depth: number, scale = 0.96): THREE.ShapeGeometry {
  const kx = width / GRID.frameW, kz = depth / GRID.frameH;
  const pts = spaceOutlinePx(r, c, scale).map(([x, y]) => new THREE.Vector2((x - GRID.frameW / 2) * kx, -(y - GRID.frameH / 2) * kz));
  return new THREE.ShapeGeometry(new THREE.Shape(pts));
}

const TERRAIN_COLOR: Record<string, string> = { R: PALETTE.road, o: PALETTE.offroad, M: PALETTE.mud, X: PALETTE.impassable };

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
  for (const [t, geos] of tops) flat(geos, TERRAIN_COLOR[t] ?? '#888', o.thickness + 0.002);
  flat(borders, PALETTE.impassableBorder, o.thickness + 0.004);
  flat(hazardMarks, PALETTE.hazardRed, o.thickness + 0.004);
  flat(faintMarks, PALETTE.hazardRed, o.thickness + 0.004, 0.25);

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
export function hazardToken(type: string, size: { length: number; depth: number; thickness: number }): {
  group: THREE.Group; setFaceUp: (up: boolean) => void; update: (dt: number) => void;
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
  chip.add(card, face(hazardTokenSvg(type, true), true), face(hazardTokenSvg(null, false), false));
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
