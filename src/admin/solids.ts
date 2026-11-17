// Turnable 3D pieces for the admin inspector, built from the same drawings the game uses: a flat
// piece with a front and a back (tiles, tokens, cards, boards) and a die with six faces. Each
// drawing (SVG markup or an image address) becomes a texture on the piece.

import * as THREE from 'three';
import { standaloneSvg, svgSize } from '../view/vector/templates';
import { inlineImages } from '../view/inline-images';

export { inlineImages };

/** A face of a piece: SVG markup, or the address of an image (the official JPG/PNG). */
export type Face = { svg: string } | { url: string };

/** Longest side of a texture made from an SVG, in pixels. */
const TEX_SIZE = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`Immagine non caricata: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

/** A texture from SVG markup, drawn at TEX_SIZE on its longest side; also its width / height. */
export async function svgTexture(svgIn: string): Promise<{ tex: THREE.Texture; aspect: number }> {
  const svg = await inlineImages(svgIn);
  const [w, h] = svgSize(svg) ?? [1, 1];
  const url = URL.createObjectURL(new Blob([standaloneSvg(svg)], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const k = TEX_SIZE / Math.max(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { tex, aspect: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A texture from an image address (JPG, PNG); also its width / height. */
export async function imageTexture(url: string): Promise<{ tex: THREE.Texture; aspect: number }> {
  const img = await loadImage(url);
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return { tex, aspect: img.naturalWidth / img.naturalHeight };
}

const faceTexture = (f: Face): Promise<{ tex: THREE.Texture; aspect: number }> => ('svg' in f ? svgTexture(f.svg) : imageTexture(f.url));
const faceMaterial = (tex: THREE.Texture): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.75, side: THREE.FrontSide });

/**
 * A flat piece lying on the table: `front` on top, `back` (if any) underneath, `thick` its
 * thickness as a share of its width. The width is 1 unit, the depth follows the front's shape.
 * Shapes that are not rectangles (chevrons, the damage token) show through the transparent parts.
 */
export async function flatSolid(front: Face, back: Face | null, thick: number): Promise<THREE.Object3D> {
  const f = await faceTexture(front);
  const depth = 1 / f.aspect;
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1, depth), faceMaterial(f.tex));
  top.rotation.x = -Math.PI / 2;
  top.position.y = thick / 2;
  g.add(top);
  const b = back ? await faceTexture(back) : null;
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(1, depth),
    b ? faceMaterial(b.tex) : new THREE.MeshStandardMaterial({ color: 0x2b2119, roughness: 0.9 }));
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -thick / 2;
  g.add(bottom);
  // The edge: the front drawn again a hair lower, darkened, so the piece reads as card stock.
  for (let i = 1; i < 4; i++) {
    const m = faceMaterial(f.tex);
    m.color.setScalar(0.35);
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(1, depth), m);
    layer.rotation.x = -Math.PI / 2;
    layer.position.y = thick / 2 - (thick * i) / 4;
    g.add(layer);
  }
  return g;
}

/** A die with its six faces, in the order three.js's box takes them (+x, −x, +y, −y, +z, −z). */
export async function dieSolid(faces: Face[]): Promise<THREE.Object3D> {
  const mats = await Promise.all(faces.slice(0, 6).map(async f => {
    const { tex } = await faceTexture(f);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  }));
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
  mesh.rotation.set(0.5, 0.7, 0);
  return mesh;
}
