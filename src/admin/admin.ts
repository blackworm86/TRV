// Admin area: Google sign-in (src/net/admin-auth.ts), then the asset inspector. Every piece of the
// game, by game and type, with its status (official extracted or traced, drawn from the rules data,
// draft: data/trv/assets_catalog.json), a large preview, a turnable 3D view, the side-by-side check
// with the extracted scans (dev server only), downloads (SVG template, official file, .glb model)
// and comments (Firebase, or this browser with ?admin=local).
// `?admin=local` skips the sign-in, for checks on this computer. Builds on gallery.ts.
// Needs no licensed file: with assets/estratti/ present the art is the official one (a note says so).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshTopology } from '../models/manifold';
import CARNAGE_DATA from '../../data/trv/carnage.json';
import RULES from '../../data/trv/game_base.json';
import CATALOG from '../../data/trv/catalog_base.json';
import SHOPPE from '../../data/trv/choppe_shoppe.json';
import {
  dieSvg, hazardTokenSvg, damageTokenSvg, dashboardSvg, commandBoardSvg, playerStripSvg, chopperSvg, carSvg, avatarSvg,
  OFFICIAL_ART, type ArtDir, type ArtSize, type CommandBoardArt,
  fireDieSvg, onFireTokenSvg, commandTokenSvg, commandIconAt, type FireFace,
} from '../view/vector/art';
import { tileSvg, mapSvg, tileTitle } from '../view/vector/tiles';
import { TAB_PULL } from '../view/vector/boards';
import { sheetSvg, standaloneSvg, templateFileName } from '../view/vector/templates';
import { commandName, leaders, upgrades, type CommandId, type CommandSlot } from '../game/trv/engine';
import type { TileData } from '../view/tile-grid';
import { FIREBASE_CONFIG } from '../net/firebase-config';
import { assetKey, firebaseCommentStore, localCommentStore, type CommentStore } from '../net/asset-comments';
import { BASE_CATALOG, commandBoardImage, dashboardImage, dieFaceImage, roadTileImage, tokenImage } from '../game/trv/catalog';
import { ASSET_CATALOG, entryFor, officialPath, type ItemEntry } from './catalog';
import { dieSolid, flatSolid, inlineImages, type Face } from './solids';
import { PRODUCTION_PAGES, productionHtml, sheetById } from './produzione-view';
import { RULES as MODEL_RULES } from './produzione';
import { buildDima, dimaGlb, dimaViews, type DimaLook } from '../view/dima3d';
import { ongoingArt, ongoingCardSvg, ongoingCardText, upgradeArt, upgradeCardSvg, upgradeCardText } from '../view/cards';
import { esc } from '../core/markup';

const $ = (id: string): HTMLElement => document.getElementById(id)!;
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
  /** Filled from the asset catalogue (src/admin/catalog.ts) once the categories are built. */
  cat?: string;
  entry?: ItemEntry;
  /** The official file's address, when the game ships one (cards, portraits). */
  officialUrl?: string;
  /** Builds the piece in 3D (tiles, tokens, cards, boards, dice). */
  solid?: () => Promise<THREE.Object3D>;
  /** The extracted scans to compare with (assets/estratti, dev server only). */
  compare?: { label: string; url: string }[];
}
interface Category { id: string; group: string; name: string; note: string; items: Item[] }

const svgBlob = (text: string): Blob => new Blob([standaloneSvg(text)], { type: 'image/svg+xml' });
/** An item whose template is its SVG preview itself. */
function svgItem(cat: string, id: string, name: string, make: () => string, more: Partial<Item> = {}): Item {
  return {
    id, name, svg: make, ...more,
    downloads: [{ label: 'Scarica template (SVG)', file: templateFileName(cat, id, 'svg'), get: async () => svgBlob(await inlineImages(make())) }, ...(more.downloads ?? [])],
  };
}

// Texts the play page shows (src/app/main.ts), copied: that file runs the game on import.
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
  bring_the_bling: ['Bring the Bling', 'Nel draft tieni una carta potenziamento in più: la tua auto grande ne monta due.'],
  smokin: ['Smokin’', 'Il teschio del dado fuoco non ha effetto sulle tue auto.'],
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
  tinker: ['Scarta un potenziamento', 'di una tua auto', 'e pescane un altro.'],
  show_time: ['Una tua auto', 'operativa', 'prende fuoco.'],
  flamethrower: ['In questo turno', 'chi colpisci', 'prende fuoco.'],
};
const slotText = (s: CommandSlot): string => {
  if (s.token || !s.values.length) return '★';
  const lo = Math.min(...s.values), hi = Math.max(...s.values);
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
};

const DIE_NAMES: Record<string, string> = { movement: 'Movimento', road: 'Strada', stunt: 'Acrobazia', slam: 'Slam', shooting: 'Sparo', direction: 'Direzione' };
const HAZ_NAMES: Record<string, string> = { mud: 'Fango', road: 'Strada', oil: 'Olio', mine: 'Mina', wreck: 'Relitto' };
const DMG_NAMES: Record<string, string> = { shrapnel: 'Schegge', dazed: 'Stordito', dent: 'Ammaccatura', skid: 'Sbandata', blastoff: 'Decollo' };
const CDR = CARNAGE_DATA as unknown as {
  hazard_tokens: Record<string, number | string>; damage_tokens: Record<string, unknown>;
  ongoing_effects: { id: string; name: string; text: string; count: number }[];
};
const CDR_HAZ: Record<string, string> = { desert_glass: 'Vetro del deserto', ramp: 'Rampa', fire: 'Fuoco', pit_trap: 'Trappola', quake: 'Terremoto', sand_worm: 'Verme delle sabbie' };
const DAMAGE_IT: Record<string, string> = { on_fire: 'In fiamme', ongoing_effect: 'Effetto continuo' };
const SIZE_NAMES: Record<ArtSize, string> = { S: 'Piccola', M: 'Media', L: 'Grande' };
const SIZES: ArtSize[] = ['S', 'M', 'L'];
const FACES = RULES.dice as unknown as Record<string, (number | string)[]>;
const TILES = RULES.tiles as unknown as (TileData & { tile: number; side: string })[];
const CARNAGE_TILES = (CARNAGE_DATA as unknown as { tiles: (TileData & { tile: number; side: string })[] }).tiles;

// Command board SVG sources, in the repository (the owner's drawings): downloaded as they are.
const UI_RAW = import.meta.glob<string>('/assets/*/plance/*.svg', { eager: true, query: '?raw', import: 'default' });
// The generated 3D models, through the bundler so a build ships them.
const MODELS = import.meta.glob<string>('/assets/*/modelli/*.glb', { eager: true, query: '?url', import: 'default' });
// The commands with an icon (tools/art/make_command_icons.py), by their Italian names.
const CMD_TEXT: Record<string, string> = {
  airstrike: 'Attacco aereo', nitro: 'Nitro', drift: 'Drift', repair: 'Riparazione', bump: 'Bump!', pain_transfer: 'Pain Transfer',
  need_for_speed: 'Need for Speed', called_shot: 'Called Shot', tinker: 'Tinker', show_time: 'Show Time', flamethrower: 'Flamethrower',
};
/** The four commands of every command board (the rest are the crew leaders'). */
const BASE_CMDS = ['airstrike', 'nitro', 'drift', 'repair'];
/** A command's icon alone, on a square of colour `bg`, drawn in `ink`. */
function commandIconSheet(id: string, ink: string, bg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240"><rect width="120" height="120" rx="14" fill="${bg}"/>${commandIconAt(id, 60, 60, 96, ink)}</svg>`;
}
// The leaders' faces (assets/choppe_shoppe/avatar_personaggi), drawn inside an SVG for the download.
const AVATARS = import.meta.glob<string>('/assets/choppe_shoppe/avatar_personaggi/*.png', { eager: true, query: '?url', import: 'default' });
// The pieces of The Big Rig and the Final Five, cut from the scans (tools/art/save_big_rig_assets.py).
const BIG_RIG_ART = import.meta.glob<string>('/assets/big_rig/**/*.webp', { eager: true, query: '?url', import: 'default' });
const MARK_NAMES: Record<string, string> = { two_lines: 'due righe', x: 'X', v: 'V', circle: 'cerchio', wave: 'onda' };
/** id, folder, name, pixel size, note, and the back (another id) for the 3D view. */
const BIG_RIG_PIECES: { id: string; dir: string; name: string; w: number; h: number; note?: string; back?: string; thick: number }[] = [
  { id: 'motrice', dir: 'plance', name: 'Motrice (Hydraulic Steering)', w: 900, h: 919, thick: 2 / 60 },
  { id: 'sezione_front', dir: 'plance', name: 'Sezione anteriore', w: 1200, h: 901, note: 'Il bordo sinistro è tagliato di poco dalla scansione.', thick: 2 / 100 },
  { id: 'sezione_mid', dir: 'plance', name: 'Sezione centrale', w: 1200, h: 921, thick: 2 / 100 },
  { id: 'sezione_rear', dir: 'plance', name: 'Sezione posteriore', w: 451, h: 360, note: 'Dall’immagine del regolamento (p. 6): intera ma a bassa risoluzione, in attesa della versione vettoriale.', thick: 2 / 100 },
  { id: 'comandi_final_five', dir: 'plance', name: 'Plancia comandi Final Five', w: 900, h: 855, thick: 2 / 60 },
  ...(['two_lines', 'x', 'v', 'circle', 'wave'] as const).map(m => ({
    id: `cruscotto_${m}`, dir: 'plance', name: `Cruscotto moto: ${MARK_NAMES[m]}`, w: 600, h: ({ two_lines: 779, x: 683, v: 786, circle: 681, wave: 779 })[m],
    back: m === 'circle' || m === 'v' ? `cruscotto_retro_${m}` : undefined, thick: 2 / 45,
  })),
  ...(['circle', 'v'] as const).map(m => ({ id: `cruscotto_retro_${m}`, dir: 'plance', name: `Retro del cruscotto: ${MARK_NAMES[m]}`, w: 600, h: m === 'v' ? 776 : 676, note: 'Moto inoperabile. Scansionati solo questi due retro.', thick: 2 / 45 })),
  { id: 'danno_minore', dir: 'segnalini', name: 'Segnalino danno minore', w: 400, h: 379, note: 'Quantità: 15 (10 Big Rig, 5 moto)', thick: 2 / 25 },
  { id: 'big_rig_alto', dir: 'icone', name: 'Big Rig visto dall’alto', w: 376, h: 78, note: 'Render della miniatura, piccolo: riferimento per il modello 3D.', thick: 0 },
];
const bigRigUrl = (id: string): string => {
  const p = BIG_RIG_PIECES.find(x => x.id === id)!;
  return BIG_RIG_ART[`/assets/big_rig/${p.dir}/${id}.webp`] ?? '';
};
const MODEL_INFO: Record<string, { name: string; comp: string }> = {
  Car_Small: { name: 'Auto piccola', comp: 'car_S' }, Car_Medium: { name: 'Auto media', comp: 'car_M' },
  Car_Large: { name: 'Auto grande', comp: 'car_L' }, Chopper: { name: 'Elicottero', comp: 'chopper' }, wreck_1: { name: 'Relitto 1', comp: 'wreck' },
  wreck_2: { name: 'Relitto 2 (carro armato)', comp: 'wreck' }, wreck_3: { name: 'Relitto 3 (muscle car)', comp: 'wreck' },
  wreck_4: { name: 'Relitto 4 (scuolabus)', comp: 'wreck' }, wreck_5: { name: 'Relitto 5 (pick-up)', comp: 'wreck' },
  Ramp: { name: 'Rampa (Carnage)', comp: '' },
};

/** The leaders' portraits by id, as the game finds them (src/app/info.ts: PORTRAITS). */
const PORTRAITS: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/choppe_shoppe/capisquadra/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, '').toLowerCase(), url]));

const leaderArt = (i: number, l: ReturnType<typeof leaders>[number]): CommandBoardArt => ({
  color: CREWS[i % CREWS.length].color, used: null,
  commands: l.commands.map(s => ({ cmd: s.id, name: commandName(s.id as CommandId).toUpperCase(), slot: slotText(s), lines: CMD_LINES[s.id] ?? [] })),
  leader: { name: l.name, title: l.title, power: POWER_INFO[l.power]?.[0] ?? l.power, powerText: POWER_INFO[l.power]?.[1] ?? '', tokens: l.tokens,
    ...(PORTRAITS[l.id] ? { portrait: PORTRAITS[l.id] } : {}) },
});

/** A crew leader's strip as in the game (assets/base/plance/plancia_striscia.svg), its power tab pulled out. */
const leaderStripSvg = (i: number, l: ReturnType<typeof leaders>[number]): string => {
  const color = CREWS[i % CREWS.length].color;
  const dashes = SIZES.map(s => ({ carId: `x${s}`, size: s, color, status: 'ok' as const, placed: [], damage: 0 }));
  return (playerStripSvg(leaderArt(i, l), dashes) ?? commandBoardSvg(leaderArt(i, l)) ?? '')
    .replace('class="ptab"', `class="ptab" transform="translate(${-TAB_PULL} 0)"`);
};

const CATEGORIES: Category[] = [
  {
    id: 'capisquadra', group: 'Carte', name: 'Capisquadra',
    note: 'Striscia di ogni capo squadra come nel gioco (Choppe Shoppe): linguetta del potere aperta, comandi, segnalini comando. Senza ritratto: colore della crew e iniziale.',
    items: leaders().map((l, i) => svgItem('capisquadra', l.id, l.name, () => leaderStripSvg(i, l), {
      note: `${l.title} · potere ${POWER_INFO[l.power]?.[0] ?? l.power} · ${l.tokens} segnalini comando${l.needs?.length ? ` · non ancora in gioco (${l.needs.join(', ')})` : ''}`,
    })),
  },
  {
    id: 'avatar_personaggi', group: 'Personaggi', name: 'Avatar personaggi',
    note: 'Il volto di ogni capisquadra, quadrato, per la nuova interfaccia (Choppe Shoppe).',
    items: leaders().map(l => svgItem('avatar_personaggi', l.id, l.name,
      () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><image href="${AVATARS[`/assets/choppe_shoppe/avatar_personaggi/${l.id}.png`] ?? ''}" width="512" height="512"/></svg>`,
      { size: '512 × 512 px', note: l.title })),
  },
  {
    id: 'potenziamenti', group: 'Carte', name: 'Potenziamenti',
    note: `Carte potenziamento (Choppe Shoppe): ${SHOPPE.upgrades.length} carte, ridisegnate per il gioco digitale: illustrazione ufficiale ritagliata, testo italiano impaginato sul pannello nero, pittogrammi stampati. La carta ufficiale intera si scarica come asset.`,
    items: upgrades().map(u => svgItem('potenziamenti', u.id, u.name, () => upgradeCardSvg({ id: u.id, name: u.name, text: upgradeCardText(u.id) }),
      { size: '63 × 88 mm (formato carta standard, stima)' })),
  },
  {
    id: 'modelli', group: 'Modelli 3D', name: 'Modelli 3D',
    note: 'Modelli generati (assets/base/modelli). Il template è il file .glb originale, da aprire in Blender.',
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
    note: 'Plancia comandi per crew, la striscia completa del giocatore e i disegni SVG originali (assets/base/plance, assets/choppe_shoppe/plance), scaricabili così come sono.',
    items: [
      ...CREWS.map(cr => svgItem('plancia', cr.id, `Plancia ${cr.name}`, () => commandBoardSvg({ color: cr.color, used: null }), { size: mm('command_board') })),
      ...(playerStripSvg({ color: CREWS[2].color, used: null }, []) ? [svgItem('plancia', 'striscia', 'Striscia del giocatore',
        () => playerStripSvg({ color: CREWS[2].color, used: null }, SIZES.map(s => ({ carId: `x${s}`, size: s, color: CREWS[2].color, status: 'ok' as const, placed: [], damage: 0 })))!)] : []),
      ...Object.entries(UI_RAW).map(([path, raw]) => {
        const base = path.replace(/^.*\/|\.svg$/g, '');
        return svgItem('plancia', base, ({ command_dashboard: 'Disegno originale: plance', plancia_striscia: 'Disegno originale: striscia del giocatore' } as Record<string, string>)[base] ?? 'Disegno originale: capisquadra',
          // The strip drawing links its portrait as a file beside it (Ms. Betty's, AFA30F17.jpg): the game's copy stands in.
          () => raw.replace('xlink:href="AFA30F17.jpg"', `xlink:href="${OFFICIAL['/assets/choppe_shoppe/capisquadra/betty.jpg'] ?? ''}"`), { note: `${path.slice(1)} (file originale)` });
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
    id: 'comando', group: 'Segnalini', name: 'Segnalini comando',
    note: 'Il segnalino comando dei capisquadra (Choppe Shoppe), come stampato: il disegno del proprietario corretto sulla foto del regolamento.',
    items: [svgItem('comando', 'token', 'Segnalino comando', () => commandTokenSvg('width="400" height="400"'), { note: `Quantità: ${SHOPPE.command_tokens}` })],
  },
  {
    id: 'carnage', group: 'Espansioni', name: 'Carnage at Devil’s Run',
    note: 'I pezzi di Carnage at Devil’s Run: dado fuoco, segnalino ON FIRE!, i sei pericoli (col retro dell’espansione) e i due danni nuovi, stampati come i segnalini del gioco base, con le quantità della scatola.',
    items: [
      svgItem('carnage', 'fire_die', 'Dado fuoco',
        () => sheetSvg(((CARNAGE_DATA as unknown as { dice: { fire: FireFace[] } }).dice.fire).map(f => ({ svg: fireDieSvg(f), caption: { '+1': '+1', '+2': '+2', out: 'si spegne', eliminated: 'eliminata' }[f] })), { cols: 6, cell: 100, gap: 16 })),
      svgItem('carnage', 'on_fire_token', 'Segnalino ON FIRE!', () => onFireTokenSvg(), { note: 'Quantità: illimitata (regola confermata)' }),
      ...Object.entries(CDR.hazard_tokens).filter(([k]) => !k.startsWith('_')).map(([type, n]) => svgItem('carnage', `pericolo_${type}`, `Pericolo ${CDR_HAZ[type] ?? type}`,
        () => sheetSvg([{ svg: hazardTokenSvg(type, true), caption: 'Fronte' }, { svg: hazardTokenSvg(type, false), caption: 'Retro' }], { cell: 240 }),
        { note: `Quantità: ${n}` })),
      ...Object.entries(CDR.damage_tokens).filter(([k]) => !k.startsWith('_')).map(([type, d]) => svgItem('carnage', `danno_${type}`, `Danno ${DAMAGE_IT[type] ?? type}`,
        () => sheetSvg([{ svg: damageTokenSvg(type, true), caption: 'Fronte' }, { svg: damageTokenSvg(null, false), caption: 'Retro' }], { cell: 240 }),
        { note: `Quantità: ${(d as { count: number }).count}` })),
    ],
  },
  {
    id: 'big_rig', group: 'Espansioni', name: 'The Big Rig and the Final Five',
    note: 'Plance, cruscotti e segnalini dell’espansione, ritagliati dalle scansioni ufficiali (Big Rig.docx). L’espansione non è ancora nel gioco: mancano dadi e segnalini fuoristrada; la sezione posteriore viene dal regolamento, a bassa risoluzione.',
    items: BIG_RIG_PIECES.map(p => svgItem('big_rig', p.id, p.name,
      () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w}" height="${p.h}"><image href="${bigRigUrl(p.id)}" width="${p.w}" height="${p.h}"/></svg>`,
      { size: `${p.w} × ${p.h} px`, note: p.note })),
  },
  {
    id: 'continui', group: 'Espansioni', name: 'Carte effetto continuo',
    note: `Le carte effetto continuo di Carnage at Devil’s Run: ${CDR.ongoing_effects.length} tipi, ridisegnate come le Potenziamento: illustrazione ufficiale, nome e testo italiani sul pannello rosso.`,
    items: CDR.ongoing_effects.map(c => svgItem('continui', c.id, ongoingCardText(c.id)[0], () => ongoingCardSvg({ id: c.id, name: ongoingCardText(c.id)[0], text: ongoingCardText(c.id)[1] }),
      { size: '44 × 68 mm (formato mini euro, stima)', note: `Copie: ${c.count}` })),
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
  ...([['icone_comandi', 'Icone dei comandi', BASE_CMDS], ['icone_comandi_cs', 'Icone dei comandi dei capisquadra', Object.keys(CMD_TEXT).filter(id => !BASE_CMDS.includes(id))]] as const)
    .map(([cat, name, ids]) => ({
      id: cat, group: 'Icone', name,
      note: 'Le icone dei comandi sulla plancia comandi (un solo colore, il secondo tono trasparente). Il nome e l’effetto sono nella finestrella al passaggio del mouse.',
      items: ids.map(id => svgItem(cat, id, CMD_TEXT[id],
        () => sheetSvg([{ svg: commandIconSheet(id, '#26232b', '#ec9230'), caption: 'Sulla plancia' }, { svg: commandIconSheet(id, '#f3e6d0', '#26232b'), caption: 'Su fondo scuro' }], { cell: 200 }))),
    })),
];

// ---------------------------------------------------------------- catalogue: status, official files, 3D, sources

// The official files the game ships (cards, portraits, the fire ring), by site address.
const OFFICIAL = import.meta.glob<string>(['/assets/choppe_shoppe/**/*.{jpg,png}', '/assets/carnage/**/*.{jpg,png}', '/assets/big_rig/**/*.webp'], { eager: true, query: '?url', import: 'default' });
/**
 * The scans extracted from the original files (assets/estratti) stay on this computer, outside git
 * and outside the site: the dev server shows them for the side-by-side check, a build never does.
 */
const LOCAL_SOURCES = import.meta.env.DEV;
const svgFace = (svg: string): Face => ({ svg });
const DAMAGE_LIST = RULES.damage_tokens as { type: string; count: number; dir?: string }[];
const CARNAGE_FIRE = (CARNAGE_DATA as unknown as { dice: { fire: FireFace[] } }).dice.fire;

/** What the piece looks like turned in 3D, and the extracted scans to set beside it. */
function extras(c: Category, it: Item): { solid?: () => Promise<THREE.Object3D>; compare?: { label: string; url: string | null }[] } {
  const id = it.id;
  const own = it.officialUrl && it.entry!.status === 'estratto' ? { url: it.officialUrl } : it.svg ? svgFace(it.svg()) : null;
  switch (c.id) {
    case 'tessere': case 'tessere_carnage': {
      const list = c.id === 'tessere' ? TILES : CARNAGE_TILES;
      const t = list.find(x => `${x.tile}${x.side}` === id)!;
      const other = list.find(x => x.tile === t.tile && x.side !== t.side);
      return {
        solid: () => flatSolid(svgFace(tileSvg(t)), other ? svgFace(tileSvg(other)) : null, 2 / 368),
        compare: c.id === 'tessere' ? [{ label: `Scansione ${id}`, url: roadTileImage(BASE_CATALOG, t.tile, t.side) }] : [],
      };
    }
    case 'pericolo':
      return {
        solid: () => flatSolid(svgFace(hazardTokenSvg(id, true)), svgFace(hazardTokenSvg(null, false)), 2 / 38),
        compare: [{ label: 'Fronte', url: tokenImage(BASE_CATALOG, 'hazard_token', id, true) }, { label: 'Retro', url: tokenImage(BASE_CATALOG, 'hazard_token', id, false) }],
      };
    case 'danno': {
      const d = DAMAGE_LIST.find(x => (x.dir ? `${x.type}_${x.dir}` : x.type) === id)!;
      return {
        solid: () => flatSolid(svgFace(damageTokenSvg(d.type, true, d.dir as ArtDir | undefined)), svgFace(damageTokenSvg(null, false)), 2 / 44.8),
        compare: [{ label: 'Fronte', url: tokenImage(BASE_CATALOG, 'damage_token', d.type, true) }, { label: 'Retro', url: tokenImage(BASE_CATALOG, 'damage_token', d.type, false) }],
      };
    }
    case 'dadi': {
      const crew = id.startsWith('movement_') ? CREWS.find(cr => `movement_${cr.id}` === id) : undefined;
      const kind = crew ? 'movement' : id;
      const faces = (FACES[kind] ?? [1, 2, 3, 4, 5, 6]).map(v => svgFace(dieSvg({ kind, value: v, ...(crew ? { color: crew.color } : { forward: 'up' as const }) })));
      return {
        solid: () => dieSolid(faces),
        compare: crew ? [] : faces.map((_, i) => ({ label: `Faccia ${i + 1}`, url: dieFaceImage(BASE_CATALOG, kind, i) })),
      };
    }
    case 'cruscotti':
      return {
        solid: () => flatSolid(own!, null, 2 / 120),
        compare: [{ label: 'Fronte', url: dashboardImage(BASE_CATALOG, CREWS[2].id, id as ArtSize, true) }, { label: 'Retro', url: dashboardImage(BASE_CATALOG, CREWS[2].id, id as ArtSize, false) }],
      };
    case 'plancia':
      return {
        solid: () => flatSolid(own!, null, 2 / 109),
        compare: CREWS.some(cr => cr.id === id) ? [{ label: 'Scansione', url: commandBoardImage(BASE_CATALOG, id) }] : [],
      };
    case 'potenziamenti': case 'continui': {
      const scan = c.id === 'potenziamenti' ? upgradeArt(id) : ongoingArt(id);
      return { solid: () => flatSolid(own!, null, 0.3 / 63), compare: [{ label: 'Carta ufficiale (scansione)', url: scan ?? null }] };
    }
    case 'carnage':
      if (id === 'fire_die') return { solid: () => dieSolid(CARNAGE_FIRE.map(f => svgFace(fireDieSvg(f)))) };
      if (id.startsWith('pericolo_')) return { solid: () => flatSolid(svgFace(hazardTokenSvg(id.slice(9), true)), svgFace(hazardTokenSvg(id.slice(9), false)), 2 / 38) };
      if (id.startsWith('danno_')) return { solid: () => flatSolid(svgFace(damageTokenSvg(id.slice(6), true)), svgFace(damageTokenSvg(null, false)), 2 / 44.8) };
      return own ? { solid: () => flatSolid(own, null, 2 / 60) } : {};
    case 'capisquadra':
      return { solid: () => flatSolid(own!, null, 2 / 109) };
    case 'comando':
      return { solid: () => flatSolid(svgFace(commandTokenSvg()), svgFace(commandTokenSvg()), 2 / 25) };
    case 'big_rig': {
      const p = BIG_RIG_PIECES.find(x => x.id === id)!;
      if (!p.thick) return {};
      return { solid: () => flatSolid({ url: bigRigUrl(id) }, p.back ? { url: bigRigUrl(p.back) } : null, p.thick) };
    }
    case 'avatar_personaggi':
      return { compare: [{ label: 'Ritratto della plancia', url: OFFICIAL[`/assets/choppe_shoppe/capisquadra/${id}.jpg`] ?? null }] };
    default:
      return {};
  }
}

for (const c of CATEGORIES) {
  for (const it of c.items) {
    it.cat = c.id;
    it.entry = entryFor(c.id, it.id);
    const off = officialPath(it.entry, it.id);
    if (off && OFFICIAL[off]) {
      it.officialUrl = OFFICIAL[off];
      const name = off.replace(/^.*\//, '');
      it.downloads.push({ label: `Scarica asset ufficiale (${name.split('.').pop()!.toUpperCase()})`, file: templateFileName(c.id, it.id, name.split('.').pop()!), get: async () => (await fetch(it.officialUrl!)).blob() });
    }
    const x = extras(c, it);
    it.solid = x.solid;
    it.compare = (x.compare ?? []).filter((s): s is { label: string; url: string } => !!s.url);
  }
}

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
/** Says on the 3D view whether the model is closed (§18 point 8), counting every mesh in it together. */
function noteTopology(obj: THREE.Object3D, host: HTMLElement): void {
  const pos: number[] = [], idx: number[] = [], v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry, p = g.getAttribute('position'), base = pos.length / 3;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
  });
  const t = meshTopology(pos, idx, MODEL_RULES.collaudo.manifold.saldatura), rule = MODEL_RULES.collaudo.manifold;
  const ok = t.openEdges <= rule.spigoli_aperti && t.nonManifoldEdges <= rule.spigoli_non_manifold;
  const note = document.createElement('span');
  note.className = `topo ${ok ? 'good' : 'bad'}`;
  note.dataset.manifold = String(ok);
  note.textContent = ok ? `Chiuso (manifold) · ${t.triangles} triangoli · ${t.pieces} pezzi`
    : `Non chiuso: ${t.openEdges} spigoli aperti, ${t.nonManifoldEdges} spigoli con più di due facce, in ${t.openPieces} pezzi su ${t.pieces}`;
  host.querySelector('.topo')?.remove();
  host.append(note);
}

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
/** Shows the piece `make` builds, turnable with the mouse, in `host`. */
async function showObject(make: () => Promise<THREE.Object3D>, host: HTMLElement): Promise<void> {
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
  const w = host.clientWidth || 400, h = host.clientHeight || 300;
  v.renderer.setSize(w, h, false);
  v.cam.aspect = w / h;
  v.cam.updateProjectionMatrix();
  if (v.shown) v.scene.remove(v.shown);
  v.shown = null;
  const obj = await make();
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

const ALL: Item[] = CATEGORIES.flatMap(c => c.items);
const catOf = new Map<Item, Category>();
for (const c of CATEGORIES) for (const it of c.items) catOf.set(it, c);
const STATUSES = Object.keys(ASSET_CATALOG.statuses);
/** What the main area shows: the summary (null) or the pieces of one game and type. */
interface View { game: string; type: string }
let view: View | null = null;
/** The page of the "Produzione modelli" section on show (src/admin/produzione-view.ts), or null outside it. */
let prod: string | null = null;
let statusFilter: string | null = null;
let shown: Item[] = [];
let openItem: Item | null = null;
let comments: CommentStore | null = null;
let author = '';

const itemsOf = (v: View): Item[] => ALL.filter(it => it.entry!.game === v.game && it.entry!.type === v.type);
const statusName = (s: string): string => ASSET_CATALOG.statuses[s]?.name ?? s;
const badge = (s: string): string => `<span class="st st-${esc(s)}">${esc(statusName(s))}</span>`;

function drawNav(): void {
  let html = `<button data-view="" class="${view || prod !== null ? '' : 'on'}">Riepilogo<span>${ALL.length}</span></button>`;
  for (const [g, name] of Object.entries(ASSET_CATALOG.games)) {
    const types = Object.keys(ASSET_CATALOG.types).filter(t => itemsOf({ game: g, type: t }).length);
    if (!types.length) continue;
    html += `<h2>${esc(name)}</h2>`;
    for (const t of types) {
      const on = view?.game === g && view.type === t;
      html += `<button data-view="${g}/${t}" class="${on ? 'on' : ''}">${esc(ASSET_CATALOG.types[t])}<span>${itemsOf({ game: g, type: t }).length}</span></button>`;
    }
  }
  html += '<h2>Produzione modelli</h2>';
  for (const [page, name, n] of PRODUCTION_PAGES) {
    const on = prod !== null && (prod === page || (!page && !!sheetById(prod)));
    html += `<button data-view="produzione${page ? `/${page}` : ''}" class="${on ? 'on' : ''}">${esc(name)}<span>${n ?? ''}</span></button>`;
  }
  $('nav').innerHTML = html;
}

function drawSummary(): void {
  const head = STATUSES.map(s => `<th>${badge(s)}</th>`).join('');
  const rows = Object.entries(ASSET_CATALOG.games).map(([g, name]) => {
    const its = ALL.filter(it => it.entry!.game === g);
    const miss = ASSET_CATALOG.missing.filter(m => m.game === g).length;
    return `<tr><th>${esc(name)}</th>${STATUSES.map(s => `<td>${its.filter(it => it.entry!.status === s).length || '–'}</td>`).join('')}<td>${its.length || '–'}</td><td>${miss || '–'}</td></tr>`;
  }).join('');
  const legend = STATUSES.map(s => `<li>${badge(s)} ${esc(ASSET_CATALOG.statuses[s].text)}</li>`).join('');
  const missing = ASSET_CATALOG.missing.map(m => `<li><strong>${esc(ASSET_CATALOG.games[m.game] ?? m.game)}</strong> · ${esc(m.what)}: ${esc(m.note)}</li>`).join('');
  $('main').innerHTML = `<div class="cat-head"><h2>Riepilogo</h2></div>
    <p class="cat-note">Ogni asset del gioco, per gioco e per stato: quanto è grafica ufficiale (estratta o ricalcata), quanto è disegnato dai dati delle regole e quanto è ancora una bozza. La fonte di ogni voce è nel dettaglio.</p>
    <table class="sum"><thead><tr><th></th>${head}<th>Totale</th><th>Mancanti</th></tr></thead><tbody>${rows}</tbody></table>
    <h3 class="sub">Stati</h3><ul class="legend">${legend}</ul>
    <h3 class="sub">Ancora da fare</h3><ul class="legend">${missing}</ul>`;
  $('main').scrollTop = 0;
}

/** The picture of an item: the official image when the item is that image, else its drawing. */
function preview(it: Item): string {
  if (it.officialUrl && it.entry!.status === 'estratto') return `<img src="${esc(it.officialUrl)}" alt="${esc(it.name)}">`;
  return it.svg ? safeSvg(it) : '';
}

/** Draws the page of the production section on show, with the comments of a model's sheet. */
function drawProduction(): void {
  stopViewer();
  $('d-comments').innerHTML = '';
  $('main').innerHTML = `<div class="prod">${productionHtml(prod!)}</div>`;
  $('main').scrollTop = 0;
  const box = document.getElementById('p-comments');
  if (box) void drawCommentsIn(box, assetKey('produzione', box.dataset.key!), () => box.isConnected);
}

/** The template of the sheet on show in the 3D box, as the switches beside it ask. */
function showDima(bar: HTMLElement): void {
  const dima = sheetById(bar.dataset.dima!)?.dima;
  if (!dima) return;
  const opt = (k: string): HTMLInputElement => bar.querySelector<HTMLInputElement>(`[data-opt="${k}"]`)!;
  const look: DimaLook = {
    wheels: opt('wheels').checked, weapons: opt('weapons').checked, marks: opt('marks').checked, ground: opt('ground').checked,
    figure: opt('figure').value as DimaLook['figure'], position: Number(opt('position').value),
  };
  const host = $('p-3d');
  host.hidden = false;
  host.dataset.dima = bar.dataset.dima!;
  host.innerHTML = '<span class="hint">Dima · trascina per ruotare · rotella per lo zoom · un quadretto della griglia = 0,5 m</span>';
  void showObject(() => Promise.resolve(buildDima(dima, MODEL_RULES, look)), host).catch(err => { host.innerHTML = `<span class="wait">3D non disponibile: ${esc((err as Error).message)}</span>`; });
}

function drawView(): void {
  if (prod !== null) { drawProduction(); return; }
  if (!view) { drawSummary(); return; }
  const v = view;
  const all = itemsOf(v);
  shown = statusFilter ? all.filter(it => it.entry!.status === statusFilter) : all;
  const notes = [...new Set(all.map(it => catOf.get(it)!.note))].map(n => `<p class="cat-note">${esc(n)}</p>`).join('');
  const chips = [null, ...STATUSES].map(s => {
    const n = s ? all.filter(it => it.entry!.status === s).length : all.length;
    if (s && !n) return '';
    return `<button class="chip${statusFilter === s ? ' on' : ''}" data-status="${s ?? ''}">${s ? esc(statusName(s)) : 'Tutti'} <span>${n}</span></button>`;
  }).join('');
  $('main').innerHTML = `<div class="cat-head"><h2>${esc(ASSET_CATALOG.types[v.type])}</h2><span class="game">${esc(ASSET_CATALOG.games[v.game])}</span>`
    + `<button class="btn ghost" id="all">Scarica tutto (${shown.length})</button></div>${notes}<div class="chips">${chips}</div>`
    + `<div class="grid">${shown.map((it, i) => `
    <button class="item${openItem === it ? ' on' : ''}" data-item="${i}">
      <div class="pv">${it.model ? `<span class="wait" data-thumb="${i}">Anteprima 3D…</span>` : preview(it)}</div>
      ${badge(it.entry!.status)}
      <h3>${esc(it.name)}</h3><small>${esc(it.id)}${it.size ? ` · ${esc(it.size)}` : ''}</small>
    </button>`).join('')}</div>`;
  $('main').scrollTop = 0;
  // 3D thumbnails, one after the other (a single offscreen renderer).
  void (async () => {
    for (const el of $('main').querySelectorAll<HTMLElement>('[data-thumb]')) {
      const it = shown[Number(el.dataset.thumb)];
      try {
        const src = await thumb(it.model!);
        if (view === v && el.isConnected) el.outerHTML = `<img src="${src}" alt="${esc(it.name)}">`;
      } catch { el.textContent = 'Anteprima non disponibile'; }
    }
  })();
}

function safeSvg(it: Item): string {
  try { return it.svg!(); } catch (e) { return `<span class="wait">Errore: ${esc((e as Error).message)}</span>`; }
}

type Tab = 'look' | '3d' | 'source';
function showTab(it: Item, tab: Tab): void {
  for (const b of $('d-tabs').querySelectorAll<HTMLElement>('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
  const big = $('d-big');
  stopViewer();
  big.className = tab === '3d' ? 'big model' : tab === 'source' ? 'big source' : 'big';
  if (tab === '3d') {
    big.innerHTML = '<span class="hint">Trascina per ruotare · rotella per lo zoom</span>';
    const make = it.model ? () => loadModel(it.model!) : it.solid!;
    void showObject(make, big).catch(e => { big.innerHTML = `<span class="wait">3D non disponibile: ${esc((e as Error).message)}</span>`; });
  } else if (tab === 'source') {
    big.innerHTML = `<div class="pair"><figure><figcaption>Nel gioco</figcaption>${preview(it)}</figure>`
      + `<figure><figcaption>Dai file originali (assets/estratti, solo su questo computer)</figcaption><div class="scans">${it.compare!.map(s =>
        `<img src="${esc(s.url)}" alt="${esc(s.label)}" title="${esc(s.label)}">`).join('')}</div></figure></div>`;
    for (const img of big.querySelectorAll<HTMLImageElement>('.scans img')) {
      img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'wait', textContent: `Manca ${img.getAttribute('src')}` })); };
    }
  } else {
    big.innerHTML = preview(it);
  }
}

function openDetail(it: Item): void {
  openItem = it;
  for (const b of $('main').querySelectorAll<HTMLElement>('.item')) b.classList.toggle('on', shown[Number(b.dataset.item)] === it);
  $('detail').hidden = false;
  $('d-title').textContent = it.name;
  const e = it.entry!;
  const tabs: [Tab, string][] = [];
  if (!it.model) tabs.push(['look', 'Disegno']);
  if (it.model || it.solid) tabs.push(['3d', 'Vista 3D']);
  if (LOCAL_SOURCES && it.compare?.length) tabs.push(['source', 'Confronta con la fonte']);
  $('d-tabs').innerHTML = tabs.map(([t, name]) => `<button data-tab="${t}">${name}</button>`).join('');
  showTab(it, tabs[0][0]);
  const rows: [string, string | undefined][] = [
    ['Gioco', ASSET_CATALOG.games[e.game]], ['Tipo', ASSET_CATALOG.types[e.type]],
    ['Stato', `${statusName(e.status)}: ${ASSET_CATALOG.statuses[e.status]?.text ?? ''}`], ['Fonte', e.source],
    ['Misure', it.size], ['Note', it.note], ['Id', `${it.cat} / ${it.id}`],
  ];
  $('d-info').innerHTML = rows.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v!)}</dd>`).join('');
  $('d-actions').innerHTML = it.downloads.map((d, i) => `<button class="btn${i ? ' ghost' : ''}" data-dl="${i}">${esc(d.label)}</button>`).join('');
  void drawComments(it);
}

const drawComments = (it: Item): Promise<void> => drawCommentsIn($('d-comments'), assetKey(it.cat!, it.id), () => openItem === it);

/** Lists the comments kept under `key` in `box`, with the form to add one; `live` says whether the box still shows that key. */
async function drawCommentsIn(box: HTMLElement, key: string, live: () => boolean): Promise<void> {
  if (!comments) { box.innerHTML = ''; return; }
  box.innerHTML = `<h3>Commenti</h3><p class="where">Salvati ${esc(comments.where)}.</p><ol class="list"><li class="wait">Carico…</li></ol>
    <form id="c-form"><textarea id="c-text" rows="3" maxlength="2000" placeholder="Cosa va corretto in questo asset?"></textarea><button class="btn" type="submit">Aggiungi commento</button></form>`;
  try {
    const list = await comments.list(key);
    if (!live()) return;
    box.querySelector('.list')!.innerHTML = list.length
      ? list.map(c => `<li><div class="meta">${esc(c.author)} · ${new Date(c.at).toLocaleString('it-IT')}</div>${esc(c.text)}</li>`).join('')
      : '<li class="wait">Nessun commento.</li>';
  } catch (e) {
    box.querySelector('.list')!.innerHTML = `<li class="wait">Commenti non leggibili: ${esc((e as Error).message)}</li>`;
  }
}

function closeDetail(): void {
  openItem = null;
  stopViewer();
  $('detail').hidden = true;
  for (const b of $('main').querySelectorAll('.item.on')) b.classList.remove('on');
}

async function downloadAll(items: Item[]): Promise<void> {
  const btn = document.getElementById('all') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  for (const it of items) {
    await run(it.downloads[0]);
    await new Promise(r => setTimeout(r, 300)); // browsers drop downloads fired too close together
  }
  if (btn) btn.disabled = false;
}

function goTo(hash: string): void {
  prod = hash === 'produzione' ? '' : hash.startsWith('produzione/') ? hash.slice('produzione/'.length) : null;
  const [g, t] = prod === null ? hash.split('/') : [];
  view = g && t && itemsOf({ game: g, type: t }).length ? { game: g, type: t } : null;
  statusFilter = null;
}

function startInspector(who: string, onSignOut: (() => void) | null, store: CommentStore): void {
  comments = store;
  author = onSignOut ? who : 'Admin (locale)';
  $('app').hidden = false;
  $('who').textContent = who;
  $('sign-out').hidden = !onSignOut;
  if (onSignOut) $('sign-out').onclick = onSignOut;
  if (OFFICIAL_ART) $('art-note').textContent = 'Grafica ufficiale presente: usala solo per il gioco digitale autorizzato.';
  goTo(location.hash.slice(1));
  drawNav();
  drawView();
  $('nav').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-view]');
    if (!b) return;
    goTo(b.dataset.view!);
    history.replaceState(null, '', b.dataset.view ? `#${b.dataset.view}` : location.pathname + location.search);
    closeDetail();
    drawNav();
    drawView();
  });
  $('main').addEventListener('click', e => {
    const t = e.target as Element;
    if (t.closest('#all')) { void downloadAll(shown); return; }
    const page = t.closest<HTMLElement>('[data-prod]');
    if (page) {
      prod = page.dataset.prod!;
      history.replaceState(null, '', `#produzione${prod ? `/${prod}` : ''}`);
      drawNav();
      drawView();
      return;
    }
    if (t.closest('[data-copy]')) {
      const text = t.closest<HTMLElement>('[data-copy]')!.dataset.copy || (t.closest('.prompt')?.querySelector('pre')?.textContent ?? '');
      void navigator.clipboard.writeText(text).then(() => toast('Prompt copiato'), () => toast('Copia non riuscita: seleziona il testo a mano'));
      return;
    }
    const bar = t.closest<HTMLElement>('.dimabar, .todo');
    if (bar && t.closest('[data-dima-show]')) { showDima(bar); $('p-3d').scrollIntoView({ block: 'nearest' }); return; }
    if (bar && t.closest('[data-dima-png], [data-dima-glb]')) {
      const id = bar.dataset.dima!, dima = sheetById(id)!.dima!, btn = t.closest<HTMLButtonElement>('button')!;
      btn.disabled = true;
      void (async () => {
        if (btn.matches('[data-dima-glb]')) save(await dimaGlb(dima, MODEL_RULES), `${id}_dima.glb`);
        else for (const view of await dimaViews(dima, MODEL_RULES)) { save(view.blob, `${id}_dima_${view.name}.png`); await new Promise(r => setTimeout(r, 300)); }
      })().catch(err => toast(`Non riuscito: ${(err as Error).message}`)).finally(() => { btn.disabled = false; });
      return;
    }
    const glb = t.closest<HTMLElement>('[data-glb]');
    if (glb) {
      const host = $('p-3d'), url = MODELS[`/${glb.dataset.glb}`];
      delete host.dataset.dima;
      host.hidden = false;
      host.innerHTML = `<span class="hint">${esc(glb.dataset.glb!)} · trascina per ruotare · rotella per lo zoom</span>`;
      if (url) void showObject(() => loadModel(url).then(obj => { noteTopology(obj, host); return obj; }), host).catch(err => { host.innerHTML = `<span class="wait">3D non disponibile: ${esc((err as Error).message)}</span>`; });
      else host.innerHTML = '<span class="wait">Modello non trovato tra i file del gioco.</span>';
      host.scrollIntoView({ block: 'nearest' });
      return;
    }
    const chip = t.closest<HTMLElement>('[data-status]');
    if (chip) { statusFilter = chip.dataset.status || null; closeDetail(); drawView(); return; }
    const b = t.closest<HTMLElement>('[data-item]');
    if (b) openDetail(shown[Number(b.dataset.item)]);
  });
  $('d-tabs').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-tab]');
    if (b && openItem) showTab(openItem, b.dataset.tab as Tab);
  });
  $('d-close').onclick = closeDetail;
  addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
  $('d-actions').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-dl]');
    if (b && openItem) void run(openItem.downloads[Number(b.dataset.dl)]);
  });
  $('d-comments').addEventListener('submit', e => {
    e.preventDefault();
    const it = openItem;
    const text = (e.target as HTMLFormElement).querySelector('textarea')!.value;
    if (!it || !comments) return;
    void comments.add(assetKey(it.cat!, it.id), text, author)
      .then(() => { toast('Commento salvato'); return drawComments(it); })
      .catch(err => toast(`Commento non salvato: ${(err as Error).message}`));
  });
  // A switch of the template's view redraws it, once it is on show.
  $('main').addEventListener('change', e => {
    const bar = (e.target as Element).closest<HTMLElement>('.dimabar');
    if (bar && $('p-3d').dataset.dima === bar.dataset.dima) showDima(bar);
  });
  $('main').addEventListener('submit', e => {
    e.preventDefault();
    const box = (e.target as Element).closest<HTMLElement>('#p-comments');
    if (!box || !comments) return;
    const key = assetKey('produzione', box.dataset.key!);
    void comments.add(key, (e.target as HTMLFormElement).querySelector('textarea')!.value, author)
      .then(() => { toast('Commento salvato'); return drawCommentsIn(box, key, () => box.isConnected); })
      .catch(err => toast(`Commento non salvato: ${(err as Error).message}`));
  });
}

// ---------------------------------------------------------------- sign-in

function show(id: 'login' | 'denied' | 'nocfg' | null): void {
  for (const s of ['login', 'denied', 'nocfg']) $(s).hidden = s !== id;
}

async function boot(): Promise<void> {
  if (new URLSearchParams(location.search).get('admin') === 'local') {
    show(null);
    startInspector('Modalità locale (?admin=local): accesso non verificato', null, localCommentStore(localStorage));
    return;
  }
  if (!FIREBASE_CONFIG) { show('nocfg'); return; }
  const { createAdminAuth } = await import('../net/admin-auth');
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
      if (!started) { started = true; startInspector(user.email ?? user.name ?? user.uid, out, await firebaseCommentStore(FIREBASE_CONFIG!)); }
    } else {
      $('denied-who').textContent = user.email ?? user.name ?? 'utente senza email';
      $('uid').textContent = user.uid;
      show('denied');
    }
  });
}

void boot();
