// The retro graphics styles (asked by the user, 2026-11-22): besides the modern look, a 32-bit
// console of the nineties and a nineties arcade cabinet in pixel art. Same models, same camera,
// same game: only how the table is drawn changes.
//  - The canvas is drawn with pixels `pixel` CSS pixels wide and the browser enlarges it with hard
//    edges (CSS `image-rendering: pixelated`): see `retroRatio`, used by mapView.fit.
//  - One last pass (`drawScene`) takes the drawn table and reduces it to `levels` shades per
//    colour with an ordered dither, sharpens it first (`sharpen`: the small pixels keep the
//    edges of cars and lettering), can push the saturation and draws a dark outline where a
//    nearer thing stands against a farther one (`outline`).
//  - The console's vertices snap to a coarse grid (`snapPx`) and its textures slide across the
//    faces without perspective (`affine`): the materials are patched once, the first time a style
//    with them is chosen (`patchForStyle`); afterwards turning them off costs nothing.
// Every value is in data/trv/presentation_base.json, `retro`.

import * as THREE from 'three';
import { P } from './presentation';
import { renderRatio, snapGrid } from './retroMath';
import { settings, type Style } from './settings';
import { camera, renderer, scene, tileSlots } from './stage';

/**
 * The cabinet's tube (asked by the user, 2026-11-23): scanlines (`scanlines`: how dark), the
 * phosphors' red-green-blue grille (`mask`), darker corners (`vignette`), each phosphor bleeding
 * into the next one to the right (`bleed`) and a brighter picture to make up for the dark lines
 * (`glow`). No curved glass: it would move what is under the pointer away from where it is drawn.
 */
export interface CrtLook { scanlines: number; mask: number; vignette: number; bleed: number; glow: number }
/** One style's look, as the presentation data gives it. */
export interface RetroLook {
  pixel: number; levels: number; dither: number; outline: number; saturation: number; sharpen: number;
  snapPx: number; affine: number; texture: number; nearest: boolean; shadow: boolean; crt: CrtLook | null;
}

/** The look of the style in use, or null for the modern one. */
export function look(style: Style = settings.style): RetroLook | null {
  return style === 'modern' ? null : P.retro[style];
}

/** The pixel ratio of the table's canvas under the retro style, or null for the modern one. */
export function retroRatio(): number | null {
  const l = look();
  return l ? renderRatio(l.pixel, devicePixelRatio) : null;
}

/** What the style allows of the quality level: texture size, the lamp's shadow, hard texels. */
export function styleCaps(): { texture: number; shadow: boolean; nearest: boolean } {
  const l = look();
  return l ? { texture: l.texture, shadow: l.shadow, nearest: l.nearest } : { texture: Infinity, shadow: true, nearest: false };
}

// ---- The last pass: fewer colours, dither, outline ----

const depth = new THREE.DepthTexture(1, 1);
depth.format = THREE.DepthStencilFormat;
depth.type = THREE.UnsignedInt248Type;
depth.magFilter = depth.minFilter = THREE.NearestFilter;
// The pit trap opens its hole with the stencil (terrain/pit3d.ts): the target keeps one too.
const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: true, depthTexture: depth, type: THREE.HalfFloatType, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
const pass = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: target.texture }, tDepth: { value: depth }, res: { value: new THREE.Vector2(1, 1) },
    levels: { value: 32 }, dither: { value: 1 }, outline: { value: 0 }, saturation: { value: 1 }, sharpen: { value: 0 }, bleed: { value: 0 },
    near: { value: 0.1 }, far: { value: 200 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res;
    uniform float levels; uniform float dither; uniform float outline; uniform float saturation; uniform float sharpen; uniform float bleed;
    uniform float near; uniform float far;
    varying vec2 vUv;
    float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
    // The 4x4 ordered dither of the old consoles and arcade boards, 0..1.
    float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    void main() {
      vec2 px = 1.0 / res;
      vec3 c = texture2D(tColor, vUv).rgb;
      // Unsharp mask on the four neighbours: what the small pixels average away comes back.
      if (sharpen > 0.0) {
        vec3 around = texture2D(tColor, vUv + vec2(px.x, 0.0)).rgb + texture2D(tColor, vUv - vec2(px.x, 0.0)).rgb
                    + texture2D(tColor, vUv + vec2(0.0, px.y)).rgb + texture2D(tColor, vUv - vec2(0.0, px.y)).rgb;
        c = max(c + sharpen * (c - around * 0.25), 0.0);
      }
      // A tube's phosphor glows on into the next one along the line.
      if (bleed > 0.0) c = mix(c, max(c, texture2D(tColor, vUv - vec2(px.x, 0.0)).rgb), bleed);
      if (outline > 0.0) {
        float d = lin(texture2D(tDepth, vUv).x);
        float far1 = max(max(lin(texture2D(tDepth, vUv + vec2(px.x, 0.0)).x), lin(texture2D(tDepth, vUv - vec2(px.x, 0.0)).x)),
                         max(lin(texture2D(tDepth, vUv + vec2(0.0, px.y)).x), lin(texture2D(tDepth, vUv - vec2(0.0, px.y)).x)));
        if (far1 - d > outline * d) c *= 0.12;
      }
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      vec3 s = gl_FragColor.rgb;
      // Brightness and colour apart: the brightness takes the dither, the colour is rounded
      // without it, so a grey stays grey (rounding each channel split it into purple and green)
      // and a dark area gets no specks of colour. The saturation pushes only what has colour.
      float y = dot(s, vec3(0.299, 0.587, 0.114));
      vec3 ch = s - y;
      ch *= mix(1.0, saturation, smoothstep(0.03, 0.15, length(ch)));
      float n = levels - 1.0;
      float yq = floor(y * n + 0.5 + (bayer4(gl_FragCoord.xy) - 0.5) * dither) / n;
      vec3 chq = floor(ch * 2.0 * n + 0.5) / (2.0 * n);
      gl_FragColor = vec4(clamp(yq + chq, 0.0, 1.0), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pass);
quad.frustumCulled = false;
const passScene = new THREE.Scene();
passScene.add(quad);
const passCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const size = new THREE.Vector2();

/** The materials' share of the console's look: the snap grid and how affine the textures are. */
const U = { retroSnap: { value: new THREE.Vector2(0, 0) }, retroAffine: { value: 0 } };
/**
 * The road tiles never snap: they are layers lying one on another (asphalt, lines, marks), and each
 * layer snapped its own way let the one below show through in stripes. The pieces on them do.
 */
const UBOARD = { retroSnap: { value: new THREE.Vector2(0, 0) }, retroAffine: U.retroAffine };

/** Draws the table: as it is in the modern style, through the last pass in a retro one. */
export function drawScene(): void {
  const l = look();
  if (!l) { renderer.render(scene, camera); return; }
  renderer.getDrawingBufferSize(size);
  if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
  const [sx, sy] = snapGrid(size.x, size.y, l.snapPx);
  U.retroSnap.value.set(sx, sy);
  U.retroAffine.value = l.affine;
  const u = pass.uniforms;
  u.res.value.copy(size);
  u.levels.value = l.levels;
  u.dither.value = l.dither;
  u.outline.value = l.outline;
  u.saturation.value = l.saturation;
  u.sharpen.value = l.sharpen;
  u.bleed.value = l.crt?.bleed ?? 0;
  u.near.value = camera.near;
  u.far.value = camera.far;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(passScene, passCam);
}

// ---- The console's vertices and textures, patched into the materials ----

const patched = new WeakSet<THREE.Material>();
const PATCHABLE = (m: THREE.Material): boolean => {
  const k = m as THREE.Material & Record<string, boolean | undefined>;
  return !!(k.isMeshStandardMaterial || k.isMeshBasicMaterial || k.isMeshLambertMaterial || k.isMeshPhongMaterial || k.isMeshToonMaterial);
};
/** Adds the snap and the affine textures to one material (once; the uniforms are shared); `board`: a road tile's, never snapped. */
function patch(m: THREE.Material, board: boolean): void {
  if (patched.has(m) || !PATCHABLE(m)) return;
  patched.add(m);
  const before = m.onBeforeCompile.bind(m);
  const key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    before(sh, r);
    const u = board ? UBOARD : U;
    sh.uniforms.retroSnap = u.retroSnap;
    sh.uniforms.retroAffine = u.retroAffine;
    sh.vertexShader = 'uniform vec2 retroSnap;\nuniform float retroAffine;\nvarying float vRetroW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      if (retroSnap.x > 0.0) gl_Position.xy = floor(gl_Position.xy / gl_Position.w * retroSnap + 0.5) / retroSnap * gl_Position.w;
      vRetroW = mix(1.0, gl_Position.w, retroAffine);
      #ifdef USE_MAP
        vMapUv *= vRetroW;
      #endif`);
    sh.fragmentShader = 'varying float vRetroW;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv / vRetroW);
        #ifdef DECODE_VIDEO_TEXTURE
          sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
        #endif
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  m.customProgramCacheKey = () => key() + '|retro';
  m.needsUpdate = true;
}

/**
 * The textures' own filters, kept to give them back when the style is modern again. The texels are
 * hard only when a texture is enlarged (the camera close): shrunk, a hard sampling turns the
 * asphalt's fine lines into stripes, so it keeps its own filter there.
 */
const filters = new WeakMap<THREE.Texture, [THREE.MagnificationTextureFilter, THREE.MinificationTextureFilter]>();
function setNearest(t: THREE.Texture, on: boolean): void {
  if (!filters.has(t)) filters.set(t, [t.magFilter, t.minFilter]);
  const [mag, min] = filters.get(t)!;
  const want: [THREE.MagnificationTextureFilter, THREE.MinificationTextureFilter] = on ? [THREE.NearestFilter, min] : [mag, min];
  if (t.magFilter === want[0] && t.minFilter === want[1]) return;
  [t.magFilter, t.minFilter] = want;
  t.needsUpdate = true;
}

/** The tube over the table (styles.css #crt): above the table's canvas, under everything else. */
const crt = document.createElement('div');
crt.id = 'crt';
renderer.domElement.after(crt);
/** Lays the tube over the table's canvas, or takes it away. */
function placeCrt(l: RetroLook | null): void {
  const t = l?.crt;
  crt.classList.toggle('on', !!t);
  renderer.domElement.classList.toggle('crt', !!t);
  if (!t || !l) return;
  const c = renderer.domElement.style, s = crt.style;
  s.width = c.width;
  s.height = c.height;
  s.setProperty('--crt-px', `${l.pixel}px`);
  s.setProperty('--crt-scan', String(t.scanlines));
  s.setProperty('--crt-mask', String(t.mask));
  s.setProperty('--crt-vignette', String(t.vignette));
  renderer.domElement.style.setProperty('--crt-glow', String(t.glow));
}

let frame = 0;
/**
 * Brings what is on the table to the style in use: the console's materials patched, the texels
 * hard or soft. Called every frame, it looks at the table only now and then (new pieces arrive).
 */
export function patchForStyle(force = false): void {
  if (!force && ++frame % 30) return;
  const l = look();
  const snaps = !!l && (l.snapPx > 0 || l.affine > 0);
  const hard = !!l?.nearest;
  if (snaps) for (const t of tileSlots) t?.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) patch(m, true); });
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (snaps) patch(m, false);
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map && (hard || filters.has(map))) setNearest(map, hard);
    }
  });
  renderer.domElement.classList.toggle('retro', !!l);
  placeCrt(l);
}
