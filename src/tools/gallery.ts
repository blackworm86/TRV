// Galleria di tutti gli asset del gioco base usati nel prototipo: grafica vettoriale
// (src/view/vector/art.ts) e pezzi 3D (src/view/board3d.ts, dice3d.ts, pieces3d.ts), con le
// quantità del regolamento (data/trv/game_base.json) e le misure del catalogo fisico
// (data/trv/catalog_base.json). Nessuna immagine licenziata: la pagina si può pubblicare.

import { FINISH_LINES } from '../view/terrain/finish3d';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RULES from '../../data/trv/game_base.json';
import CATALOG from '../../data/trv/catalog_base.json';
import CARNAGE from '../../data/trv/carnage.json';
import {
  dieSvg, hazardTokenSvg, damageTokenSvg, dashboardSvg, commandBoardSvg, chopperSvg, carSvg, avatarSvg, PALETTE, OFFICIAL_ART,
} from '../view/vector/art';
import { buildTile, hazardToken, type TileData } from '../view/board3d';
import { tickFlames, useRampModel } from '../view/terrain/carnage3d';
import { ModelBank, dressed, fitToLength, type Tint } from '../view/models3d';
import { MODEL, MODEL_YAW, SHOW_LENGTH_MM, WRECK_TINT, crewTint, wreckLength, wreckModel } from '../view/models-config';
/** The game's own 3D models (the modelli folders of assets), loaded once for every item of the page. */
const bank = new ModelBank();
void useRampModel(MODEL.ramp, u => bank.load(u));
import { makeDie, type DiceFaces } from '../view/dice3d';
import { Pieces, TextureBank } from '../view/pieces3d';
import { texturesReady } from '../view/texture';
import { esc } from '../core/markup';

/** The finish lines cut from the official sheet (tools/asset-pipeline/finish_lines.py). */
const FINISH_ART = import.meta.glob<string>('/assets/base/traguardi/*.webp', { eager: true, query: '?url', import: 'default' });

const FACES = RULES.dice as unknown as DiceFaces;
const CREWS = CATALOG.crews;
interface Comp { id: string; size_mm: number[]; measured: boolean; count?: number; count_per_crew?: number }
const comp = (id: string): Comp => (CATALOG.components as unknown as Comp[]).find(c => c.id === id)!;
const MM = 0.05; // world units per mm, for every 3D piece on this page
const $ = (id: string): HTMLElement => document.getElementById(id)!;

// ---------------------------------------------------------------- 3D items

type Build = () => THREE.Object3D;
/** `paint`: a model the viewer can repaint in any crew colour (the build reads {@link paint}). */
const builders = new Map<string, { title: string; build: Build; top?: boolean; paint?: boolean }>();
/** The colour the paintable models are shown in (the viewer's colour bar sets it; orange to start). */
let paint = (CATALOG.crews.find(c => c.id === 'orange') ?? CATALOG.crews[0]).color;
const pieces = new Pieces(MM, new TextureBank(4));
/**
 * Puts the game's model in place of a stand-in piece once it has loaded, tinted and at its table
 * length as in the game (src/app/pieces.ts); the stand-in stays if the model cannot load.
 */
function real(stand: THREE.Group, url: string, lengthMm: number, tint: Tint): THREE.Group {
  loading.push(bank.load(url).then(m => {
    if (!m) return;
    const d = dressed(m, tint);
    fitToLength(d, lengthMm * MM, MODEL_YAW);
    for (const c of stand.children) c.visible = false;
    stand.add(d);
  }));
  return stand;
}
/** The model loads under way, for a thumbnail to wait for before it is drawn. */
const loading: Promise<void>[] = [];

function dieGroup(kind: string, color?: string): THREE.Object3D {
  const g = new THREE.Group();
  const d = makeDie(FACES, kind, 16 * MM, color);
  d.mesh.quaternion.setFromEuler(new THREE.Euler(-0.6, 0.75, 0.3)); // corner view: three faces
  g.add(d.mesh);
  return g;
}

const DIE_NAMES: Record<string, string> = {
  movement: 'Movimento', road: 'Strada', stunt: 'Acrobazia', slam: 'Slam', shooting: 'Sparo', direction: 'Direzione',
};
const HAZ_NAMES: Record<string, string> = { mud: 'Fango', road: 'Strada', oil: 'Olio', mine: 'Mina', wreck: 'Relitto' };
const DMG_NAMES: Record<string, string> = { shrapnel: 'Schegge', dazed: 'Stordito', dent: 'Ammaccatura', skid: 'Sbandata', blastoff: 'Decollo' };
const SIZE_NAMES: Record<string, string> = { S: 'Piccola', M: 'Media', L: 'Grande' };

// ---------------------------------------------------------------- thumbnails

const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbRenderer.setPixelRatio(1);
thumbRenderer.setSize(480, 320);

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x4a3a2c, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
}

/** Puts a camera so `obj` fills the frame, from above-front or nearly straight down. */
function frame(obj: THREE.Object3D, cam: THREE.PerspectiveCamera, top = false): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = top ? new THREE.Vector3(0, 1, 0.18).normalize() : new THREE.Vector3(0.55, 0.75, 1).normalize();
  const dist = r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * (top ? 0.78 : 0.9);
  cam.position.copy(c).addScaledVector(dir, dist);
  cam.near = dist / 50;
  cam.far = dist * 10;
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  return c;
}

async function thumb(key: string): Promise<string> {
  const item = builders.get(key)!;
  const scene = new THREE.Scene();
  lights(scene);
  const obj = item.build();
  scene.add(obj);
  await Promise.all(loading.splice(0));
  await texturesReady();
  const cam = new THREE.PerspectiveCamera(30, 1.5, 0.01, 100);
  frame(obj, cam, item.top);
  thumbRenderer.render(scene, cam);
  return thumbRenderer.domElement.toDataURL('image/png');
}

// ---------------------------------------------------------------- viewer

const view = $('viewer');
const viewRenderer = new THREE.WebGLRenderer({ antialias: true });
viewRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(viewRenderer.domElement);
const viewScene = new THREE.Scene();
viewScene.background = new THREE.Color(0x1d1712);
lights(viewScene);
const viewCam = new THREE.PerspectiveCamera(30, 1.6, 0.01, 100);
const orbit = new OrbitControls(viewCam, viewRenderer.domElement);
orbit.enableDamping = true;
let shown: THREE.Object3D | null = null;

let shownKey = '';
function showIn3D(key: string): void {
  const item = builders.get(key);
  if (!item) return;
  shownKey = key;
  $('paint').hidden = !item.paint;
  if (shown) viewScene.remove(shown);
  shown = item.build();
  viewScene.add(shown);
  orbit.target.copy(frame(shown, viewCam, item.top));
  $('viewer-title').textContent = item.title;
  for (const b of document.querySelectorAll<HTMLElement>('[data-show]')) b.classList.toggle('on', b.dataset.show === key);
}

// The colour bar: the nine crew colours and a free one (a first taste of "paint your models").
$('paint').innerHTML = CREWS.map(cr => `<button data-paint="${cr.color}" title="${esc(cr.name)}" style="background:${cr.color}"></button>`).join('')
  + `<label title="Colore libero"><input type="color" id="paint-free" value="${paint}"></label>`;
function repaint(color: string): void {
  paint = color;
  for (const b of document.querySelectorAll<HTMLElement>('[data-paint]')) b.classList.toggle('on', b.dataset.paint === color);
  if (builders.get(shownKey)?.paint) showIn3D(shownKey);
}
$('paint').addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-paint]'); if (b) repaint(b.dataset.paint!); });
$('paint-free').addEventListener('input', e => repaint((e.target as HTMLInputElement).value));
repaint(paint);

function fitViewer(): void {
  const w = view.clientWidth, h = view.clientHeight;
  viewRenderer.setSize(w, h);
  viewCam.aspect = w / h;
  viewCam.updateProjectionMatrix();
}
addEventListener('resize', fitViewer);
viewRenderer.setAnimationLoop(() => {
  tickFlames(performance.now() / 1000, viewCam, viewRenderer.domElement.height);
  orbit.update();
  viewRenderer.render(viewScene, viewCam);
});

// ---------------------------------------------------------------- page

interface Card { key?: string; title: string; meta: string; flat: string[] }

function section(id: string, title: string, note: string, cards: Card[]): void {
  const el = document.createElement('section');
  el.id = id;
  el.innerHTML = `<header><h2>${esc(title)}</h2><p>${note}</p></header><div class="grid">${cards.map(c => `
    <article class="card">
      ${c.key ? `<button class="thumb" data-show="${c.key}" title="Guarda in 3D"><img data-thumb="${c.key}" alt="${esc(c.title)} in 3D"><span>Ruota in 3D</span></button>` : ''}
      ${c.flat.length ? `<div class="flat">${c.flat.join('')}</div>` : ''}
      <h3>${esc(c.title)}</h3>
      <p class="meta">${c.meta}</p>
    </article>`).join('')}</div>`;
  $('sections').appendChild(el);
}

const mm = (id: string): string => {
  const c = comp(id);
  return `${c.size_mm.join(' × ')} mm${c.measured ? '' : ' (stima)'}`;
};

// Dice
section('dadi', 'Dadi', 'Sei tipi di dado. Nel gioco sono tutti 3D: rotolano sul tavolo quando si tirano e restano 3D anche nell’interfaccia.',
  Object.keys(FACES).map(kind => {
    const key = `die-${kind}`;
    const color = kind === 'movement' ? CREWS[2].color : undefined;
    builders.set(key, { title: `Dado ${DIE_NAMES[kind]}`, build: () => dieGroup(kind, color) });
    const c = comp(`die_${kind}`);
    const count = c.count_per_crew ? `${c.count_per_crew} per crew` : `${c.count}`;
    return {
      key, title: `Dado ${DIE_NAMES[kind]}`,
      meta: `Quantità: ${count} · Facce: ${FACES[kind].join(', ')} · ${mm(`die_${kind}`)}`,
      flat: FACES[kind].map(v => `<i class="face">${dieSvg({ kind, value: v, color, forward: 'up' })}</i>`),
    };
  }));
section('dadi-crew', 'Dadi movimento per crew', 'Quattro dadi per giocatore, nel colore della sua crew.', CREWS.map(cr => {
  const key = `die-movement-${cr.id}`;
  builders.set(key, { title: `Dado movimento ${cr.name}`, build: () => dieGroup('movement', cr.color) });
  return { key, title: cr.name, meta: `Colore ${cr.color}`, flat: [1, 2, 3, 4, 5, 6].map(v => `<i class="face">${dieSvg({ kind: 'movement', value: v, color: cr.color })}</i>`) };
}));

// Hazard tokens
const HZ = comp('hazard_mud');
const hazTotal = Object.values(RULES.hazard_tokens as Record<string, number>).reduce((a, b) => a + b, 0);
section('pericoli', 'Segnalini pericolo', `Fronte e retro. Totale nei dati: ${hazTotal}. Sul tavolo stanno coperti e si girano quando un’auto ci entra.`,
  Object.entries(RULES.hazard_tokens as Record<string, number>).map(([type, n]) => {
    const key = `haz-${type}`;
    builders.set(key, {
      title: `Pericolo ${HAZ_NAMES[type]}: fronte e retro`, build: () => {
        const g = new THREE.Group();
        const size = { length: HZ.size_mm[1] * MM, depth: HZ.size_mm[0] * MM, thickness: HZ.size_mm[2] * MM };
        const up = hazardToken(type, size); up.setFaceUp(true);
        const down = hazardToken(type, size); down.setFaceUp(false);
        down.group.position.x = size.length * 1.25;
        g.add(up.group, down.group);
        return g;
      },
    });
    return { key, title: HAZ_NAMES[type], meta: `Quantità: ${n} · ${mm(`hazard_${type}`)}`, flat: [hazardTokenSvg(type, true), hazardTokenSvg(null, false)].map(s => `<i class="tok">${s}</i>`) };
  }));

// Damage tokens
const DMG = RULES.damage_tokens as { type: string; count: number; dir?: string }[];
section('danni', 'Segnalini danno', `Fronte e retro. Totale nei dati: ${DMG.reduce((a, d) => a + d.count, 0)}. Il gioco ne ha 20: le quantità per tipo e le direzioni della Sbandata vanno ancora contate sui pezzi.`,
  DMG.map(d => ({
    title: DMG_NAMES[d.type] + (d.dir ? ` (${d.dir})` : ''),
    meta: `Quantità nei dati: ${d.count} · ${mm(`damage_${d.type}`)}`,
    flat: [damageTokenSvg(d.type, true, d.dir as never), damageTokenSvg(null, false)].map(s => `<i class="tok">${s}</i>`),
  })));

// Road tiles
const TILE = comp('road_tile_1');
section('tessere', 'Tessere strada', 'Cinque tessere a due facce. Ogni casella è un chevron colorato per effetto; le tessere si incastrano a passo di 8 colonne.',
  (RULES.tiles as unknown as (TileData & { tile: number; side: string })[]).map(t => {
    const key = `tile-${t.tile}${t.side}`;
    builders.set(key, {
      title: `Tessera ${t.tile}${t.side} · ${t.name}`, top: true,
      build: () => buildTile(t, { width: TILE.size_mm[0] * MM, depth: TILE.size_mm[1] * MM, thickness: TILE.size_mm[2] * MM }),
    });
    return { key, title: `${t.tile}${t.side} · ${t.name}`, meta: `${mm(`road_tile_${t.tile}`)}${t.tile === RULES.start_tile ? ' · tessera di partenza' : ''}`, flat: [] };
  }));
// Road tiles of Carnage at Devil's Run (data/trv/carnage.json): the same size as the base ones.
section('tessere-carnage', 'Tessere strada · Carnage at Devil’s Run', 'Cinque tessere a due facce dell’espansione: melma tossica, vetro del deserto, rampe, fuoco e saline.',
  (CARNAGE.tiles as unknown as (TileData & { tile: number; side: string })[]).map(t => {
    const key = `tile-${t.tile}${t.side}`;
    builders.set(key, {
      title: `Tessera ${t.tile}${t.side} · ${t.name}`, top: true,
      build: () => buildTile(t, { width: TILE.size_mm[0] * MM, depth: TILE.size_mm[1] * MM, thickness: TILE.size_mm[2] * MM }),
    });
    return { key, title: `${t.tile}${t.side} · ${t.name}`, meta: 'Carnage at Devil’s Run', flat: [] };
  }));
$('tessere').querySelector('header')!.insertAdjacentHTML('beforeend', `<ul class="legend">${[
  ['Strada', PALETTE.road], ['Fuoristrada', PALETTE.offroad], ['Fango', PALETTE.mud], ['Invalicabile (doppio bordo giallo)', PALETTE.impassable], ['Spazio pericolo', PALETTE.hazardRed],
].map(([n, c]) => `<li><b style="background:${c}"></b>${n}</li>`).join('')}</ul>`);

// Boards
const sampleDash = (size: 'S' | 'M' | 'L', color: string, status: 'ok' | 'inop', placed: { value: number; coast: boolean }[], damage: number): string =>
  dashboardSvg({ carId: `x${size}`, size, color, status, placed, damage });
section('plance', 'Cruscotti e plancia comandi', 'Tre cruscotti e una plancia per crew. Nel gioco i dadi si trascinano sugli spazi.', [
  { title: 'Cruscotti', meta: `Piccola, media, grande · ${mm('dashboard_S')}`, flat: (['S', 'M', 'L'] as const).map(s => `<i class="board">${sampleDash(s, CREWS[2].color, 'ok', [], 0)}</i>`) },
  { title: 'Cruscotto in gioco', meta: 'Dado assegnato, un’inerzia usata, un danno sotto', flat: [`<i class="board">${sampleDash('M', CREWS[1].color, 'ok', [{ value: 4, coast: false }, { value: 2, coast: true }], 1)}</i>`] },
  { title: 'Cruscotto inoperativo', meta: 'Due danni: il cruscotto si gira', flat: [`<i class="board">${sampleDash('L', CREWS[3].color, 'inop', [], 2)}</i>`] },
  ...CREWS.map(cr => ({ title: `Plancia comandi ${cr.name}`, meta: mm('command_board'), flat: [`<i class="board">${commandBoardSvg({ color: cr.color, used: cr.id === 'orange' ? { cmd: 'nitro', value: 2 } : null })}</i>`] })),
]);

// Vehicles
section('veicoli', 'Veicoli e altri pezzi', 'Un modello 3D per pezzo, come nel gioco: il colore della crew si dà al modello mentre il gioco gira. Nel visore si sceglie il colore.', [
  ...(['S', 'M', 'L'] as const).map(size => {
    const key = `car-${size}`;
    builders.set(key, {
      title: `Auto ${SIZE_NAMES[size]}`, paint: true,
      build: () => real(pieces.car(comp(`car_${size}`).size_mm as [number, number, number], paint, false), MODEL.car[size], SHOW_LENGTH_MM[size], crewTint(paint)),
    });
    return { key, title: `Auto ${SIZE_NAMES[size]}`, meta: `1 per crew · ${mm(`car_${size}`)}`, flat: CREWS.map(cr => `<i class="car">${carSvg(size, cr.color)}</i>`) };
  }),
  (() => {
    builders.set('wreck', { title: 'Relitto', build: () => real(pieces.car(comp('wreck').size_mm as [number, number, number], '#333', true), wreckModel('wreck'), wreckLength('wreck'), WRECK_TINT) });
    return { key: 'wreck', title: 'Relitto', meta: `Quantità: ${comp('wreck').count} · ${mm('wreck')}`, flat: [`<i class="car">${carSvg('S', '#3b342e')}</i>`] };
  })(),
  (() => {
    builders.set('chopper', {
      title: 'Elicottero', paint: true,
      build: () => real(pieces.chopper(comp('chopper').size_mm as [number, number, number], paint), MODEL.chopper, SHOW_LENGTH_MM.chopper, crewTint(paint, true)),
    });
    return { key: 'chopper', title: 'Elicottero', meta: `1 per crew · ${mm('chopper')}`, flat: CREWS.map(cr => `<i class="icon">${chopperSvg(cr.color)}</i>`) };
  })(),
  (() => {
    builders.set('bike', { title: 'Moto delle Final Five', paint: true, build: () => real(new THREE.Group(), MODEL.motorcycle, SHOW_LENGTH_MM.bike, crewTint(paint)) });
    return { key: 'bike', title: 'Moto delle Final Five', meta: '5 per la squadra · una casella', flat: [] };
  })(),
  (() => {
    // The whole road train, three spaces long (a space: an eighth of a road tile's length).
    builders.set('big-rig', { title: 'Big Rig', paint: true, build: () => real(new THREE.Group(), MODEL.bigRig, 3 * comp('road_tile_1').size_mm[0] / 8, crewTint(paint)) });
    return { key: 'big-rig', title: 'Big Rig', meta: 'Motrice e due rimorchi · tre caselle', flat: [] };
  })(),
  { title: 'Avatar dei giocatori', meta: 'Colore della crew e iniziale', flat: CREWS.map(cr => `<i class="icon">${avatarSvg(cr.color, cr.name)}</i>`) },
  { title: 'Traguardi', meta: `${mm('finish_line')} · quattro, dal foglio ufficiale, ritagliati sulla sua sagoma: The Cliff, The Wall, The Grid, The Dome`,
    flat: FINISH_LINES.map(l => `<img class="finish" alt="${l.name}" title="${l.name}" src="${Object.entries(FINISH_ART).find(([path]) => path.endsWith(`/${l.id}.webp`))?.[1] ?? ''}">`) },
]);

// Navigation, viewer and thumbnails
$('nav').innerHTML = [...document.querySelectorAll('#sections section')].map(s =>
  `<a href="#${s.id}">${esc(s.querySelector('h2')!.textContent!)}</a>`).join('');
document.addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-show]');
  if (b) { showIn3D(b.dataset.show!); view.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
});
$('count').textContent = String(builders.size);
fitViewer();
showIn3D('tile-1a');
void (async () => {
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-thumb]')) img.src = await thumb(img.dataset.thumb!);
})();

// With the licensed files present, dice, tokens and boards are the official art redrawn as vectors.
if (OFFICIAL_ART) document.getElementById('art-note')!.firstChild!.textContent = 'Dadi, segnalini e plance: grafica ufficiale ridisegnata in vettoriale (file con licenza, fuori da git; ?art=open mostra i disegni liberi). ';
