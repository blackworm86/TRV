// The road as vector geometry: every space of a tile is a chevron polygon built from the
// terrain grid in data/trv/game_base.json, coloured by its effect (rulebook p. 7). Spaces of
// neighbouring rows are offset, so each tile's front and rear edges zig-zag and the next tile
// slots into it like a toy brick. No licensed image is used.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, dataUrl, hazardTokenSvg } from './vector/art';

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

/** Hazard token as a thin chevron with vector art on both faces; image right = forward (+x). */
export function hazardToken(type: string, size: { length: number; depth: number; thickness: number }): { group: THREE.Group; setFaceUp: (up: boolean) => void } {
  const loader = new THREE.TextureLoader();
  const mat = (svgText: string): THREE.MeshStandardMaterial => {
    const m = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.5, roughness: 0.7, color: 0xffffff });
    loader.load(dataUrl(svgText), t => { t.colorSpace = THREE.SRGBColorSpace; m.map = t; m.needsUpdate = true; });
    return m;
  };
  const face = (svgText: string): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size.length, size.depth), mat(svgText));
    m.rotation.x = -Math.PI / 2;
    m.position.y = size.thickness;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const front = face(hazardTokenSvg(type, true));
  const back = face(hazardTokenSvg(null, false));
  const group = new THREE.Group();
  group.add(front, back);
  return { group, setFaceUp: up => { front.visible = up; back.visible = !up; } };
}
