// PROTOTYPE - NOT FOR PRODUCTION
// Admin area: Google sign-in (src/net/admin-auth.ts), then the asset inspector. Every piece of the
// game drawn by the prototype, by category, with a large preview and an editable template to
// download: SVG for the vector art, tiles and cards, the original .glb for the 3D models.
// `?admin=local` skips the sign-in, for checks on this computer. Builds on gallery.ts.
// Needs no licensed file: with assets/licensed/ present the art is the official one (a note says so).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import CARNAGE_DATA from '../../data/trv/carnage.json';
import RULES from '../../data/trv/game_base.json';
import CATALOG from '../../data/trv/catalog_base.json';
import SHOPPE from '../../data/trv/choppe_shoppe.json';
import {
  dieSvg, hazardTokenSvg, damageTokenSvg, dashboardSvg, commandBoardSvg, playerStripSvg, chopperSvg, carSvg, avatarSvg,
  OFFICIAL_ART, type ArtDir, type ArtSize, type CommandBoardArt,
  fireDieSvg, onFireTokenSvg, type FireFace,
} from '../../src/view/vector/art';
import { tileSvg, mapSvg, tileTitle } from '../../src/view/vector/tiles';
import { cardSvg, sheetSvg, standaloneSvg, templateFileName } from '../../src/view/vector/templates';
import { commandName, leaders, upgrades, type CommandId, type CommandSlot } from '../../src/game/trv/engine';
import type { TileData } from '../../src/view/tile-grid';
import { FIREBASE_CONFIG } from '../../src/net/firebase-config';

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const CREWS = CATALOG.crews;
interface Comp { id: string; size_mm: number[]; measured: boolean }
const comp = (id: string): Comp | undefined => (CATALOG.components as unknown as Comp[]).find(c => c.id === id);
const mm = (id: string): string | undefined => {
  const c = comp(id);
  return c ? `${c.size_mm.join(' × ')} mm${c.measured ? '' : ' (stima)'}` : undefined;
};

// ---------------------------------------------------------------- catalogue of items

/** One downloadable file of an item. */
interface Download { label: string; file: string; get: () => Promise<Blob> }
interface Item {
  id: string;
  name: string;
  /** Catalog size, when the physical catalog has the piece. */
  size?: string;
  note?: string;
  /** Preview markup (inline SVG), or null for a 3D model (rendered). */
  svg: (() => string) | null;
  /** A .glb model address, for 3D items. */
  model?: string;
  downloads: Download[];
}
interface Category { id: string; group: string; name: string; note: string; items: Item[] }

const svgBlob = (text: string): Blob => new Blob([standaloneSvg(text)], { type: 'image/svg+xml' });
/** An item whose template is its SVG preview itself. */
function svgItem(cat: string, id: string, name: string, make: () => string, more: Partial<Item> = {}): Item {
  return {
    id, name, svg: make, ...more,
    downloads: [{ label: 'Scarica template (SVG)', file: templateFileName(cat, id, 'svg'), get: async () => svgBlob(make()) }, ...(more.downloads ?? [])],
  };
}

// Texts the play page shows (prototypes/trv-play-spike/main.ts), copied: that file runs the game on import.
const UPGRADE_INFO: Record<string, string> = {
  grappling_hook: 'Dopo aver colpito un’auto e risolto il danno, può scambiarsi di posto con lei.',
  snowplow: 'Entrando su un relitto o un veicolo fuori uso, lo sposta in una casella vuota adiacente e prosegue.',
  big_red_button: 'Quando va fuori uso puoi eliminarla: elimini anche auto ed elicotteri adiacenti.',
  armor_plating: 'Il risultato “qualsiasi” del dado sparo contro di lei è un colpo mancato.',
  onboard_computer: 'Ignora gli effetti dei suoi danni: restano coperti.',
  ghost_mode: 'Quando fa Drift guadagna 2 movimenti.',
  smoke_screen: 'Non le si può sparare dalla casella direttamente dietro.',
  skull_shift_knob: 'Non deve usare tutti i suoi movimenti.',
  heavy_machine_gun: 'Quando spara e manca, può ritirare il dado sparo.',
  rail_gun: 'Spara fino a tre caselle dritto davanti a sé.',
  oil_dispenser: 'Dopo il movimento può posare una chiazza d’olio in una casella vuota adiacente. Tre volte a partita.',
  roll_cage: 'Se uno slam la spingerebbe contro un’altra auto, può mettersi in una casella vuota adiacente.',
  crumple_zones: 'Quando subisce un danno ne peschi due e ne scegli uno.',
  sandbags: 'Negli slam che la coinvolgono gli avversari non possono ritirare i dadi.',
  deep_treads: 'Per lei il fango vale come strada.',
  heavy_frame: 'Regge un danno in più prima di andare fuori uso.',
  spoiler: 'Per lei il dado strada vale sempre 2.',
  anti_aircraft_radar: 'Se finisce il turno sotto un elicottero può spostarsi in una casella vuota adiacente.',
  stability_control: 'Se uno slam la muoverebbe, puoi ritirare il dado direzione.',
  punt_gun: 'Spara fino a due caselle di distanza.',
  tank_treads: 'Con un dado da 3 o meno non rivela i pericoli coperti che attraversa: solo quello su cui si ferma.',
  off_road_suspension: 'Se parte su strada può usare il dado strada, ovunque si muova.',
  rear_guns: 'Spara in qualunque casella adiacente.',
  boost_switch: 'Ha un movimento in più.',
  assault_bumper: 'L’auto che sposta in uno slam va una casella più in là.',
  stealth_technology: 'Non le si può sparare se c’è un altro veicolo a cui sparare.',
  mine_dispenser: 'Dopo il movimento può posare una mina in una casella vuota adiacente. Tre volte a partita.',
};
const POWER_INFO: Record<string, [string, string]> = {
  junk_in_the_trunk: ['Junk in the Trunk', 'Se la tua auto verrebbe mossa in uno slam, puoi ritirare il dado direzione.'],
  spotter: ['Spotter', 'Quando spari, se un’altra tua auto operativa è adiacente al bersaglio, colpisci automaticamente.'],
  jury_rigging: ['Jury-Rigging', 'Ignori gli effetti dei segnalini danno: restano coperti.'],
  soul_siphon: ['Soul Siphon', 'Quando colpisci un veicolo sparando, togli un danno da una tua auto.'],
  trash_into_treasure: ['Trash into Treasure', 'Quando entri su un pericolo coperto prendi un segnalino comando, poi lo giri.'],
  redline: ['Redline', 'Un dado movimento da 6 assegnato a un’auto vale 7.'],
  objection: ['Objection!', 'Quando spari e manchi puoi ritirare il dado sparo.'],
  third_eye: ['Third Eye', 'A inizio round guardi un pericolo coperto.'],
  long_arm_of_the_law: ['Long Arm of the Law', 'Puoi sparare a un bersaglio a due caselle.'],
};
const CMD_LINES: Record<string, string[]> = {
  airstrike: ['Piazza l’elicottero', 'su una casella vuota.', 'Dal 2° round spara.'],
  nitro: ['Aggiungi il dado', 'al movimento', 'dell’auto.'],
  drift: ['Attraversa il primo', 'veicolo che incontri,', 'senza slam.'],
  repair: ['Togli un danno', 'da una tua auto.'],
  bump: ['Al primo slam del turno', 'solo dado direzione:', 'si muove l’altra auto.'],
  pain_transfer: ['Sposta un danno', 'da una tua auto', 'a un’altra.'],
  need_for_speed: ['I dadi non assegnati', 'prendono il valore', 'di questo dado.'],
  called_shot: ['In questo turno', 'colpisci', 'automaticamente.'],
};
const slotText = (s: CommandSlot): string => {
  if (s.token || !s.values.length) return '★';
  const lo = Math.min(...s.values), hi = Math.max(...s.values);
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
};

const DIE_NAMES: Record<string, string> = { movement: 'Movimento', road: 'Strada', stunt: 'Acrobazia', slam: 'Slam', shooting: 'Sparo', direction: 'Direzione' };
const HAZ_NAMES: Record<string, string> = { mud: 'Fango', road: 'Strada', oil: 'Olio', mine: 'Mina', wreck: 'Relitto' };
const DMG_NAMES: Record<string, string> = { shrapnel: 'Schegge', dazed: 'Stordito', dent: 'Ammaccatura', skid: 'Sbandata', blastoff: 'Decollo' };
const SIZE_NAMES: Record<ArtSize, string> = { S: 'Piccola', M: 'Media', L: 'Grande' };
const SIZES: ArtSize[] = ['S', 'M', 'L'];
const FACES = RULES.dice as unknown as Record<string, (number | string)[]>;
const TILES = RULES.tiles as unknown as (TileData & { tile: number; side: string })[];
const CARNAGE_TILES = (CARNAGE_DATA as unknown as { tiles: (TileData & { tile: number; side: string })[] }).tiles;

// Command board SVG sources, in the repository (the owner's drawings): downloaded as they are.
const UI_RAW = import.meta.glob<string>('/assets/ui/*.svg', { eager: true, query: '?raw', import: 'default' });
// The generated 3D models, through the bundler so a build ships them.
const MODELS = import.meta.glob<string>('/assets/models/*.glb', { eager: true, query: '?url', import: 'default' });
const MODEL_INFO: Record<string, { name: string; comp: string }> = {
  Car_Small: { name: 'Auto piccola', comp: 'car_S' }, Car_Medium: { name: 'Auto media', comp: 'car_M' },
  Car_Large: { name: 'Auto grande', comp: 'car_L' }, Chopper: { name: 'Elicottero', comp: 'chopper' }, wreck_1: { name: 'Relitto 1', comp: 'wreck' },
};

const leaderArt = (i: number, l: ReturnType<typeof leaders>[number]): CommandBoardArt => ({
  color: CREWS[i % CREWS.length].color, used: null,
  commands: l.commands.map(s => ({ cmd: s.id, name: commandName(s.id as CommandId).toUpperCase(), slot: slotText(s), lines: CMD_LINES[s.id] ?? [] })),
  leader: { name: l.name, title: l.title, power: POWER_INFO[l.power]?.[0] ?? l.power, powerText: POWER_INFO[l.power]?.[1] ?? '', tokens: l.tokens },
});

const CATEGORIES: Category[] = [
  {
    id: 'capisquadra', group: 'Carte', name: 'Capisquadra',
    note: 'Plance dei capisquadra (Choppe Shoppe): potere, nome, comandi. Senza ritratto: colore della crew e iniziale.',
    items: leaders().map((l, i) => svgItem('capisquadra', l.id, l.name, () => commandBoardSvg(leaderArt(i, l)), {
      note: `${l.title} · potere ${POWER_INFO[l.power]?.[0] ?? l.power} · ${l.tokens} segnalini comando${l.needs?.length ? ` · non ancora in gioco (${l.needs.join(', ')})` : ''}`,
    })),
  },
  {
    id: 'potenziamenti', group: 'Carte', name: 'Potenziamenti',
    note: `Carte potenziamento (Choppe Shoppe): ${SHOPPE.upgrades.length} carte. Cornice 63 × 88 mm con spazio vuoto per l’illustrazione.`,
    items: upgrades().map(u => svgItem('potenziamenti', u.id, u.name, () => cardSvg({
      id: u.id, name: u.name, text: UPGRADE_INFO[u.id] ?? '', kicker: 'Potenziamento', ...(u.n !== undefined ? { n: u.n } : {}),
    }), { size: '63 × 88 mm (formato carta standard, stima)' })),
  },
  {
    id: 'modelli', group: 'Modelli 3D', name: 'Modelli 3D',
    note: 'Modelli generati (assets/models). Il template è il file .glb originale, da aprire in Blender.',
    items: Object.entries(MODELS).map(([path, url]) => {
      const base = path.replace(/^.*\/|\.glb$/g, '');
      const info = MODEL_INFO[base] ?? { name: base, comp: '' };
      return {
        id: base, name: info.name, svg: null, model: url, size: mm(info.comp), note: path.slice(1),
        downloads: [{ label: 'Scarica modello (GLB)', file: templateFileName('modelli', base, 'glb'), get: async () => (await fetch(url)).blob() }],
      };
    }),
  },
  {
    id: 'tessere', group: 'Tessere e mappe', name: 'Tessere',
    note: 'Le dieci facce delle cinque tessere strada, viste dall’alto: ogni casella è un poligono con il colore del terreno e “riga,colonna”.',
    items: TILES.map(t => svgItem('tessere', `${t.tile}${t.side}`, tileTitle(t), () => tileSvg(t), {
      size: mm(`road_tile_${t.tile}`), note: t.tile === RULES.start_tile ? 'Tessera di partenza' : undefined,
    })),
  },
  {
    id: 'tessere_carnage', group: 'Tessere e mappe', name: 'Tessere Carnage',
    note: 'Le dieci facce delle tessere di Carnage at Devil’s Run, con melma tossica (verde), vetro del deserto (azzurro), rampe (freccia), fuoco (arancio) e saline (bianco).',
    items: CARNAGE_TILES.map(t => svgItem('tessere_carnage', `${t.tile}${t.side}`, tileTitle(t), () => tileSvg(t), { note: 'Carnage at Devil’s Run' })),
  },
  {
    id: 'mappe', group: 'Tessere e mappe', name: 'Mappe',
    note: 'Tessere incastrate in fila come sul tavolo (la tessera più indietro a sinistra), per comporre una strada.',
    items: [
      ...(['a', 'b'] as const).map(side => {
        const row = TILES.filter(t => t.side === side).sort((x, y) => x.tile - y.tile);
        return svgItem('mappe', `tutte_${side}`, `Tutte le facce ${side.toUpperCase()}`, () => mapSvg(row), { note: row.map(t => `${t.tile}${t.side}`).join(' → ') });
      }),
      ...(['a', 'b'] as const).map(side => {
        const row = CARNAGE_TILES.filter(t => t.side === side).sort((x, y) => x.tile - y.tile);
        return svgItem('mappe', `carnage_${side}`, `Carnage: facce ${side.toUpperCase()}`, () => mapSvg(row), { note: row.map(t => `${t.tile}${t.side}`).join(' → ') });
      }),
      (() => {
        const start = TILES.find(t => t.tile === RULES.start_tile && t.side === 'a')!;
        const row = [start, ...TILES.filter(t => t.tile !== RULES.start_tile && t.side === 'a').slice(0, 2)];
        return svgItem('mappe', 'tre_tessere', 'Tre tessere in gioco', () => mapSvg(row), { note: `Esempio con tre tessere: ${row.map(t => `${t.tile}${t.side}`).join(' → ')}` });
      })(),
    ],
  },
  {
    id: 'cruscotti', group: 'Plance', name: 'Cruscotti',
    note: 'I tre cruscotti, nel colore di una crew. Il disegno originale del proprietario è in “Plancia comandi”.',
    items: SIZES.map(s => svgItem('cruscotti', s, `Cruscotto ${SIZE_NAMES[s].toLowerCase()}`,
      () => dashboardSvg({ carId: `x${s}`, size: s, color: CREWS[2].color, status: 'ok', placed: [], damage: 0 }), { size: mm(`dashboard_${s}`) })),
  },
  {
    id: 'plancia', group: 'Plance', name: 'Plancia comandi',
    note: 'Plancia comandi per crew, la striscia completa del giocatore e i disegni SVG originali (assets/ui), scaricabili così come sono.',
    items: [
      ...CREWS.map(cr => svgItem('plancia', cr.id, `Plancia ${cr.name}`, () => commandBoardSvg({ color: cr.color, used: null }), { size: mm('command_board') })),
      ...(playerStripSvg({ color: CREWS[2].color, used: null }, []) ? [svgItem('plancia', 'striscia', 'Striscia del giocatore',
        () => playerStripSvg({ color: CREWS[2].color, used: null }, SIZES.map(s => ({ carId: `x${s}`, size: s, color: CREWS[2].color, status: 'ok' as const, placed: [], damage: 0 })))!)] : []),
      ...Object.entries(UI_RAW).map(([path, raw]) => {
        const base = path.replace(/^.*\/|\.svg$/g, '');
        return svgItem('plancia', base, base === 'command_dashboard' ? 'Disegno originale: plance' : 'Disegno originale: capisquadra', () => raw, { note: `${path.slice(1)} (file originale)` });
      }),
    ],
  },
  {
    id: 'dadi', group: 'Dadi', name: 'Dadi',
    note: 'Le sei facce di ogni dado in un foglio, con il valore sotto. Il dado movimento in un template per crew.',
    items: [
      ...Object.keys(FACES).filter(k => k !== 'movement').map(kind => svgItem('dadi', kind, `Dado ${DIE_NAMES[kind] ?? kind}`,
        () => sheetSvg(FACES[kind].map(v => ({ svg: dieSvg({ kind, value: v, forward: 'up' }), caption: String(v) })), { cols: 6, cell: 100, gap: 16 }),
        { size: mm(`die_${kind}`) })),
      ...CREWS.map(cr => svgItem('dadi', `movement_${cr.id}`, `Dado Movimento ${cr.name}`,
        () => sheetSvg((FACES.movement ?? [1, 2, 3, 4, 5, 6]).map(v => ({ svg: dieSvg({ kind: 'movement', value: v, color: cr.color }), caption: String(v) })), { cols: 6, cell: 100, gap: 16 }),
        { size: mm('die_movement') })),
    ],
  },
  {
    id: 'pericolo', group: 'Segnalini', name: 'Segnalini pericolo',
    note: 'Fronte e retro di ogni segnalino pericolo (forma a chevron di una casella).',
    items: Object.entries(RULES.hazard_tokens as Record<string, number>).map(([type, n]) => svgItem('pericolo', type, `Pericolo ${HAZ_NAMES[type] ?? type}`,
      () => sheetSvg([{ svg: hazardTokenSvg(type, true), caption: 'Fronte' }, { svg: hazardTokenSvg(null, false), caption: 'Retro' }], { cell: 240 }),
      { size: mm(`hazard_${type}`), note: `Quantità: ${n}` })),
  },
  {
    id: 'danno', group: 'Segnalini', name: 'Segnalini danno',
    note: 'Fronte e retro di ogni segnalino danno. La Sbandata ha una direzione per segnalino.',
    items: (RULES.damage_tokens as { type: string; count: number; dir?: string }[]).map(d => {
      const id = d.dir ? `${d.type}_${d.dir}` : d.type;
      return svgItem('danno', id, `${DMG_NAMES[d.type] ?? d.type}${d.dir ? ` (${d.dir})` : ''}`,
        () => sheetSvg([{ svg: damageTokenSvg(d.type, true, d.dir as ArtDir | undefined), caption: 'Fronte' }, { svg: damageTokenSvg(null, false), caption: 'Retro' }], { cell: 240 }),
        { size: mm(`damage_${d.type}`), note: `Quantità nei dati: ${d.count}` });
    }),
  },
  {
    id: 'carnage', group: 'Espansioni', name: 'Carnage at Devil’s Run',
    note: 'Grafica provvisoria (disegni aperti, non l’arte ufficiale) per l’espansione in preparazione: dado fuoco e segnalino ON FIRE!. Le facce del dado sono i quattro tipi del regolamento (p. 3); quante per tipo non è ancora noto.',
    items: [
      svgItem('carnage', 'fire_die', 'Dado fuoco',
        () => sheetSvg((['+1', '+2', 'out', 'eliminated'] as FireFace[]).map(f => ({ svg: fireDieSvg(f), caption: { '+1': '+1', '+2': '+2', out: 'si spegne', eliminated: 'eliminata' }[f] })), { cols: 4, cell: 100, gap: 16 })),
      svgItem('carnage', 'on_fire_token', 'Segnalino ON FIRE!', () => onFireTokenSvg(), { note: 'Quantità: 12 (CDR p. 2)' }),
    ],
  },
  {
    id: 'icone', group: 'Icone', name: 'Elicottero e auto',
    note: 'Icone vettoriali dell’interfaccia: elicotteri, auto viste dall’alto, relitto e avatar, nei colori delle crew.',
    items: [
      svgItem('icone', 'elicottero', 'Elicottero', () => sheetSvg(CREWS.map(cr => ({ svg: chopperSvg(cr.color), caption: cr.name })), { cell: 120 }), { size: mm('chopper') }),
      ...SIZES.map(s => svgItem('icone', `auto_${s}`, `Auto ${SIZE_NAMES[s].toLowerCase()}`,
        () => sheetSvg(CREWS.map(cr => ({ svg: carSvg(s, cr.color), caption: cr.name })), { cell: 140 }), { size: mm(`car_${s}`) })),
      svgItem('icone', 'relitto', 'Relitto', () => carSvg('S', '#3b342e'), { size: mm('wreck') }),
      svgItem('icone', 'avatar', 'Avatar', () => sheetSvg(CREWS.map(cr => ({ svg: avatarSvg(cr.color, cr.name), caption: cr.name })), { cell: 120 })),
    ],
  },
];

// ---------------------------------------------------------------- downloads

function save(blob: Blob, file: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

let toastTimer = 0;
function toast(msg: string): void {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { t.hidden = true; }, 2600);
}

async function run(d: Download): Promise<void> {
  try {
    save(await d.get(), d.file);
    toast(`Scaricato ${d.file}`);
  } catch (e) {
    toast(`Errore: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------- 3D: thumbnails and viewer

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x4a3a2c, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
}
function frame(obj: THREE.Object3D, cam: THREE.PerspectiveCamera): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-3);
  const dist = r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 0.95;
  cam.position.copy(c).addScaledVector(new THREE.Vector3(0.55, 0.6, 1).normalize(), dist);
  cam.near = dist / 100;
  cam.far = dist * 10;
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  return c;
}
const loader = new GLTFLoader();
const modelCache = new Map<string, Promise<THREE.Object3D>>();
const loadModel = (url: string): Promise<THREE.Object3D> => {
  if (!modelCache.has(url)) modelCache.set(url, loader.loadAsync(url).then(g => g.scene));
  return modelCache.get(url)!.then(s => s.clone(true));
};

let thumbRenderer: THREE.WebGLRenderer | null = null;
const thumbs = new Map<string, Promise<string>>();
function thumb(url: string): Promise<string> {
  if (!thumbs.has(url)) {
    thumbs.set(url, loadModel(url).then(obj => {
      thumbRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbRenderer.setPixelRatio(1);
      thumbRenderer.setSize(360, 240);
      const scene = new THREE.Scene();
      lights(scene);
      scene.add(obj);
      const cam = new THREE.PerspectiveCamera(30, 1.5, 0.01, 100);
      frame(obj, cam);
      thumbRenderer.render(scene, cam);
      return thumbRenderer.domElement.toDataURL('image/png');
    }));
  }
  return thumbs.get(url)!;
}

let viewer: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; orbit: OrbitControls; shown: THREE.Object3D | null } | null = null;
async function showModel(url: string, host: HTMLElement): Promise<void> {
  if (!viewer) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1712);
    lights(scene);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const orbit = new OrbitControls(cam, renderer.domElement);
    orbit.enableDamping = true;
    viewer = { renderer, scene, cam, orbit, shown: null };
  }
  const v = viewer;
  host.prepend(v.renderer.domElement);
  const fit = (): void => {
    const w = host.clientWidth || 400, h = host.clientHeight || 300;
    v.renderer.setSize(w, h, false);
    v.cam.aspect = w / h;
    v.cam.updateProjectionMatrix();
  };
  fit();
  if (v.shown) v.scene.remove(v.shown);
  v.shown = null;
  const obj = await loadModel(url);
  if (!host.isConnected || !host.contains(v.renderer.domElement)) return;
  v.shown = obj;
  v.scene.add(obj);
  v.orbit.target.copy(frame(obj, v.cam));
  v.renderer.setAnimationLoop(() => { v.orbit.update(); v.renderer.render(v.scene, v.cam); });
}
function stopViewer(): void {
  viewer?.renderer.setAnimationLoop(null);
  viewer?.renderer.domElement.remove();
}
addEventListener('resize', () => {
  if (viewer?.renderer.domElement.isConnected) {
    const host = viewer.renderer.domElement.parentElement!;
    viewer.renderer.setSize(host.clientWidth, host.clientHeight, false);
    viewer.cam.aspect = host.clientWidth / host.clientHeight;
    viewer.cam.updateProjectionMatrix();
  }
});

// ---------------------------------------------------------------- inspector

let current: Category = CATEGORIES[0];
let openItem: Item | null = null;

function drawNav(): void {
  let html = '', group = '';
  for (const c of CATEGORIES) {
    if (c.group !== group) { group = c.group; html += `<h2>${esc(group)}</h2>`; }
    html += `<button data-cat="${c.id}" class="${c === current ? 'on' : ''}">${esc(c.name)}<span>${c.items.length}</span></button>`;
  }
  $('nav').innerHTML = html;
}

function drawCategory(): void {
  const c = current;
  $('main').innerHTML = `<div class="cat-head"><h2>${esc(c.name)}</h2><button class="btn ghost" id="all">Scarica tutto (${esc(c.name.toLowerCase())})</button></div>`
    + `<p class="cat-note">${esc(c.note)}</p><div class="grid">${c.items.map((it, i) => `
    <button class="item${openItem === it ? ' on' : ''}" data-item="${i}">
      <div class="pv">${it.svg ? safeSvg(it) : `<span class="wait" data-thumb="${i}">Anteprima 3D…</span>`}</div>
      <h3>${esc(it.name)}</h3><small>${esc(it.id)}${it.size ? ` · ${esc(it.size)}` : ''}</small>
    </button>`).join('')}</div>`;
  $('main').scrollTop = 0;
  // 3D thumbnails, one after the other (a single offscreen renderer).
  void (async () => {
    for (const el of $('main').querySelectorAll<HTMLElement>('[data-thumb]')) {
      const it = c.items[Number(el.dataset.thumb)];
      try {
        const src = await thumb(it.model!);
        if (current === c && el.isConnected) el.outerHTML = `<img src="${src}" alt="${esc(it.name)}">`;
      } catch { el.textContent = 'Anteprima non disponibile'; }
    }
  })();
}

function safeSvg(it: Item): string {
  try { return it.svg!(); } catch (e) { return `<span class="wait">Errore: ${esc((e as Error).message)}</span>`; }
}

function openDetail(it: Item): void {
  openItem = it;
  for (const b of $('main').querySelectorAll<HTMLElement>('.item')) b.classList.toggle('on', current.items[Number(b.dataset.item)] === it);
  $('detail').hidden = false;
  $('d-title').textContent = it.name;
  const big = $('d-big');
  stopViewer();
  big.className = it.model ? 'big model' : 'big';
  big.innerHTML = it.model ? '<span class="hint">Trascina per ruotare · rotella per lo zoom</span>' : safeSvg(it);
  if (it.model) void showModel(it.model, big);
  const rows: [string, string | undefined][] = [
    ['Nome', it.name], ['Id', it.id], ['Categoria', current.name], ['Misure', it.size], ['Note', it.note],
    ['File', it.downloads.map(d => d.file).join(', ')],
  ];
  $('d-info').innerHTML = rows.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v!)}</dd>`).join('');
  $('d-actions').innerHTML = it.downloads.map((d, i) => `<button class="btn${i ? ' ghost' : ''}" data-dl="${i}">${i ? esc(d.label) : 'Scarica template'}</button>`).join('');
}

function closeDetail(): void {
  openItem = null;
  stopViewer();
  $('detail').hidden = true;
  for (const b of $('main').querySelectorAll('.item.on')) b.classList.remove('on');
}

async function downloadAll(c: Category): Promise<void> {
  const btn = document.getElementById('all') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  for (const it of c.items) {
    await run(it.downloads[0]);
    await new Promise(r => setTimeout(r, 300)); // browsers drop downloads fired too close together
  }
  if (btn) btn.disabled = false;
}

function startInspector(who: string, onSignOut: (() => void) | null): void {
  $('app').hidden = false;
  $('who').textContent = who;
  $('sign-out').hidden = !onSignOut;
  if (onSignOut) $('sign-out').onclick = onSignOut;
  if (OFFICIAL_ART) $('art-note').textContent = 'Grafica ufficiale con licenza presente: i template derivati non vanno distribuiti.';
  const fromHash = CATEGORIES.find(c => c.id === location.hash.slice(1));
  if (fromHash) current = fromHash;
  drawNav();
  drawCategory();
  $('nav').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-cat]');
    if (!b) return;
    current = CATEGORIES.find(c => c.id === b.dataset.cat)!;
    history.replaceState(null, '', `#${current.id}`);
    closeDetail();
    drawNav();
    drawCategory();
  });
  $('main').addEventListener('click', e => {
    const t = e.target as Element;
    if (t.closest('#all')) { void downloadAll(current); return; }
    const b = t.closest<HTMLElement>('[data-item]');
    if (b) openDetail(current.items[Number(b.dataset.item)]);
  });
  $('d-close').onclick = closeDetail;
  addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
  $('d-actions').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-dl]');
    if (b && openItem) void run(openItem.downloads[Number(b.dataset.dl)]);
  });
}

// ---------------------------------------------------------------- sign-in

function show(id: 'login' | 'denied' | 'nocfg' | null): void {
  for (const s of ['login', 'denied', 'nocfg']) $(s).hidden = s !== id;
}

async function boot(): Promise<void> {
  if (new URLSearchParams(location.search).get('admin') === 'local') {
    show(null);
    startInspector('Modalità locale (?admin=local): accesso non verificato', null);
    return;
  }
  if (!FIREBASE_CONFIG) { show('nocfg'); return; }
  const { createAdminAuth } = await import('../../src/net/admin-auth');
  const auth = createAdminAuth(FIREBASE_CONFIG);
  let started = false;
  $('google').onclick = async () => {
    const b = $('google') as HTMLButtonElement;
    b.disabled = true;
    $('login-err').textContent = '';
    try { await auth.signInWithGoogle(); } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      $('login-err').textContent = code === 'auth/popup-closed-by-user' ? 'Finestra di accesso chiusa.'
        : code === 'auth/popup-blocked' ? 'Il browser ha bloccato la finestra di accesso: consenti i popup per questo sito.'
          : code === 'auth/operation-not-allowed' ? 'L’accesso con Google non è abilitato nel progetto Firebase.'
            : `Accesso non riuscito (${code || (e as Error).message}).`;
    } finally { b.disabled = false; }
  };
  const out = (): void => { void auth.signOut().then(() => location.reload()); };
  $('denied-out').onclick = out;
  $('denied-retry').onclick = () => location.reload();
  $('copy-uid').onclick = async () => {
    try { await navigator.clipboard.writeText($('uid').textContent ?? ''); toast('UID copiato'); } catch { toast('Copia non riuscita: seleziona il testo'); }
  };
  auth.onUser(async user => {
    // The anonymous identity of the online rooms is not an account: ask for Google.
    if (!user || user.anonymous) { if (!started) show('login'); return; }
    if (await auth.isAdmin(user.uid)) {
      show(null);
      if (!started) { started = true; startInspector(user.email ?? user.name ?? user.uid, out); }
    } else {
      $('denied-who').textContent = user.email ?? user.name ?? 'utente senza email';
      $('uid').textContent = user.uid;
      show('denied');
    }
  });
}

void boot();
