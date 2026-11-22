// The cards of the expansions, as the game shows them: Choppe Shoppe upgrade cards and Carnage at
// Devil's Run ongoing effect cards.
//
// The official cards are scanned in English. The game draws its own card instead (upgradeCardSvg,
// ongoingCardSvg): the official illustration, cut from the scan without the card's frame
// (tools/art/save_card_art.py → <cards>/illustrazioni/<id>.jpg), framed like the printed card
// (the black panel with its torn cream edge, or the red one), with the Italian name and text set to
// fit the panel, and the wordless pictograms of the printed panel (the guns' range, the dispensers'
// three tokens) where the card has them (<upgrades>/pittogrammi/<id>.png).
//
// The whole scanned cards stay in assets/ (upgradeArt, ongoingArt): the admin offers them as the
// official asset, and they are what the illustrations were cut from.

import CARD_TEXT from '../../data/trv/cards_it.json';
import { esc } from '../core/markup';

const byId = (files: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(files).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ''), url]));

const UPGRADE_ART = byId(import.meta.glob<string>('/assets/choppe_shoppe/carte/potenziamenti/*.jpg', { eager: true, query: '?url', import: 'default' }));
const UPGRADE_ILLUSTRATION = byId(import.meta.glob<string>('/assets/choppe_shoppe/carte/potenziamenti/illustrazioni/*.jpg', { eager: true, query: '?url', import: 'default' }));
const UPGRADE_PICTOGRAM = byId(import.meta.glob<string>('/assets/choppe_shoppe/carte/potenziamenti/pittogrammi/*.png', { eager: true, query: '?url', import: 'default' }));
const ONGOING_ART = byId(import.meta.glob<string>('/assets/carnage/carte/effetto_continuo/*.jpg', { eager: true, query: '?url', import: 'default' }));
const ONGOING_ILLUSTRATION = byId(import.meta.glob<string>('/assets/carnage/carte/effetto_continuo/illustrazioni/*.jpg', { eager: true, query: '?url', import: 'default' }));

/** The upgrade panel's black, sampled from the scans. */
export const CARD_BLACK = '#141313';
/** Where the scanned ongoing effect card's red panel begins, as a share of its height. */
export const ONGOING_PANEL_TOP = 0.57;
/** The ongoing effect card's red, sampled from the scans. */
export const CARD_RED = '#e01a30';
/** The cream of the printed text and of the torn edge. */
const CARD_CREAM = '#efe6d2';

/**
 * The URL of an upgrade card's whole official scan, or undefined when the file is not there.
 * @param id the upgrade's data id (data/trv/choppe_shoppe.json).
 * Example: `upgradeArt('rail_gun')` → `/assets/choppe_shoppe/carte/potenziamenti/rail_gun.jpg`.
 */
export function upgradeArt(id: string): string | undefined {
  return UPGRADE_ART[id];
}

/**
 * The URL of an upgrade card's illustration (no frame, no panel), or undefined.
 * Example: `upgradeIllustration('rail_gun')` → `…/potenziamenti/illustrazioni/rail_gun.jpg`.
 */
export function upgradeIllustration(id: string): string | undefined {
  return UPGRADE_ILLUSTRATION[id];
}

/**
 * The URL of an ongoing effect card's whole official scan, or undefined when the file is not there.
 * @param id the card's data id (data/trv/carnage.json, ongoing_effects).
 * Example: `ongoingArt('nitro_leak')` → `/assets/carnage/carte/effetto_continuo/nitro_leak.jpg`.
 */
export function ongoingArt(id: string): string | undefined {
  return ONGOING_ART[id];
}

/** The URL of an ongoing effect card's illustration (no frame, no panel), or undefined. */
export function ongoingIllustration(id: string): string | undefined {
  return ONGOING_ILLUSTRATION[id];
}

// ---------------------------------------------------------------- the digital card

/** The fonts: the titles' condensed capitals and the rules text's condensed sans. */
const TITLE_FONT = `font-family="'League Gothic', Impact, 'Arial Narrow', sans-serif"`;
export const TEXT_FONT = `font-family="'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif"`;
/** Titles lean like the printed ones (skewX, degrees). */
const TITLE_LEAN = -9;


/**
 * About how wide a text is, in ems, in a condensed font: narrow letters, wide letters, capitals and
 * the rest. Close enough to wrap lines and fit titles without measuring in a browser.
 * @param caps true for the titles' capitals font (League Gothic).
 */
export function textWidth(s: string, caps = false): number {
  let w = 0;
  for (const ch of s.replace(/\*\*/g, '')) {
    if (caps) w += /[IJ1.,:;!'’ ]/.test(ch) ? 0.2 : /[MW]/.test(ch) ? 0.5 : 0.37;
    else if (/[iljtfrI.,:;!'’()|]/.test(ch)) w += 0.22;
    else if (ch === ' ') w += 0.2;
    else if (/[mwMW]/.test(ch)) w += 0.66;
    else if (/[A-Z]/.test(ch)) w += 0.48;
    else w += 0.43;
  }
  return w;
}

/**
 * Text set in a panel: words wrapped to each line's width, paragraphs kept apart, the font size the
 * largest (from `max` down to `min`) that fits the panel's height.
 * @param text paragraphs split by "\n"; a paragraph in brackets is set in italics, like the printed reminders.
 * @param width the width available to the line whose baseline is at `y` (pictograms take part of some lines).
 * @returns the lines with their baseline (from the panel's top) and style, and the size used.
 */
export function fitText(text: string, width: (y: number) => number, height: number, max: number, min: number, lineGap = 1.13):
  { size: number; lines: { y: number; text: string; italic: boolean }[] } {
  const paras = text.split('\n').map(p => p.trim()).filter(Boolean);
  for (let size = max; ; size -= 1) {
    const lines: { y: number; text: string; italic: boolean }[] = [];
    let y = size * 0.82;
    for (const [pi, para] of paras.entries()) {
      if (pi) y += size * 0.35;
      const italic = /^\(.*\)$/.test(para);
      let line = '';
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && textWidth(next) * size > width(y)) { lines.push({ y, text: line, italic }); y += size * lineGap; line = word; } else line = next;
      }
      lines.push({ y, text: line, italic });
      y += size * lineGap;
    }
    if (y - size * lineGap + size * 0.25 <= height || size <= min) return { size, lines };
  }
}

/** One line of text as SVG markup: escaped, **bold** words as bold spans. */
const lineMarkup = (t: string): string => esc(t).replace(/\*\*(.+?)\*\*/g, '<tspan font-weight="700">$1</tspan>');

/** A short hash of a string, so each card's ragged edge is its own and always the same. */
function seed(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A ragged line through the points, each step jittered by up to `amp` (deterministic from `key`). */
function ragged(points: [number, number][], step: number, amp: number, key: string): string {
  let s = seed(key);
  const rnd = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 - 0.5; };
  const out: string[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push(`${(x0 + (x1 - x0) * t).toFixed(1)} ${(y0 + (y1 - y0) * t + (k ? rnd() * amp : 0)).toFixed(1)}`);
    }
  }
  const [lx, ly] = points[points.length - 1];
  out.push(`${lx} ${ly}`);
  return out.join(' L');
}

/** Specks of print wear, as an SVG filter: sparse grains of `color` over the panel. */
function wear(id: string, color: string, density: number): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${seed(id) % 97}"/>`
    + `<feColorMatrix values="0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} 0 0 0 ${density} ${(-density * 0.7).toFixed(2)}"/></filter>`;
}

/** A pictogram on the upgrade panel: where it sits on the 630 x 880 card, and which lines it narrows. */
interface Pictogram {
  /** Box on the card. */
  x: number; y: number; w: number; h: number;
  /** Beside the text (the guns' range) or under its last lines (the dispensers' tokens). */
  side: 'right' | 'below';
}
/** The upgrade cards whose printed panel has a pictogram, placed as on the printed card. */
const PICTOGRAMS: Record<string, Pictogram> = {
  rail_gun: { x: 380, y: 590, w: 220, h: 100, side: 'right' },
  punt_gun: { x: 440, y: 560, w: 180, h: 236, side: 'right' },
  rear_guns: { x: 430, y: 580, w: 180, h: 156, side: 'right' },
  oil_dispenser: { x: 392, y: 728, w: 222, h: 136, side: 'below' },
  mine_dispenser: { x: 392, y: 728, w: 222, h: 144, side: 'below' },
};

/** What an upgrade card shows. */
export interface UpgradeCard {
  /** Data id: picks the illustration and the pictogram. */
  id: string;
  /** Name, in capitals on the panel (the card's own name: proper names are not translated). */
  name: string;
  /** Rules text in Italian; "\n" between paragraphs, a paragraph in brackets in italics. */
  text: string;
  /** Unique prefix for the ids inside the SVG, when several cards share a page (default: the id). */
  key?: string;
}

/** The upgrade card's size: 63 x 88 mm at 10 units per mm. */
export const UPGRADE_CARD = { w: 630, h: 880 } as const;
/** The ongoing effect card's size: 44 x 68 mm at 10 units per mm. */
export const ONGOING_CARD = { w: 440, h: 680 } as const;

/**
 * A Choppe Shoppe upgrade card, drawn: the official illustration above, the black panel with its
 * torn cream edge below, the name, the text and the printed pictogram, if any. 630 x 880 units,
 * scaled by the page (width/height 100%).
 * Example: `upgradeCardSvg({ id: 'rail_gun', name: 'Rail Gun', text: 'Spara fino a tre caselle…' })`.
 */
export function upgradeCardSvg(c: UpgradeCard): string {
  const { w, h } = UPGRADE_CARD, k = esc(`up-${c.key ?? c.id}`);
  const art = UPGRADE_ILLUSTRATION[c.id], picto = PICTOGRAMS[c.id], pictoUrl = UPGRADE_PICTOGRAM[c.id];
  // The panel's top: level, with the printed card's shoulder at each end.
  const top: [number, number][] = [[0, 468], [24, 482], [548, 482], [590, 452], [w, 452]];
  const edge = ragged(top, 7, 6, c.id);
  let b = `<defs><clipPath id="${k}-card"><rect width="${w}" height="${h}" rx="30"/></clipPath>${wear(`${k}-wear`, CARD_CREAM, 9)}</defs>`;
  b += `<g clip-path="url(#${k}-card)"><rect width="${w}" height="${h}" fill="${CARD_BLACK}"/>`;
  b += art ? `<image href="${art}" width="${w}" height="490" preserveAspectRatio="xMidYMin slice"/>`
    : `<rect width="${w}" height="490" fill="#4a3f36"/>`;
  // The cream torn edge, then the panel over it.
  b += `<path d="M${ragged(top.map(([x, y]) => [x, y - 13] as [number, number]), 6, 8, `${c.id}-cream`)} V${h} H0Z" fill="${CARD_CREAM}"/>`;
  b += `<path d="M${edge} V${h} H0Z" fill="${CARD_BLACK}"/>`;
  b += `<rect y="440" width="${w}" height="${h - 440}" filter="url(#${k}-wear)" opacity=".28"/>`;
  b += `<rect width="${w}" height="${h}" rx="30" fill="none" stroke="${CARD_BLACK}" stroke-width="4"/></g>`;
  // The name: as large as fits, up to the printed size.
  const name = c.name.toUpperCase();
  const nameSize = Math.min(70, 548 / textWidth(name, true));
  b += `<g transform="translate(40 560) skewX(${TITLE_LEAN})"><text ${TITLE_FONT} font-size="${nameSize.toFixed(1)}" fill="${CARD_CREAM}" letter-spacing="1">${esc(name)}</text></g>`;
  // The text, around the pictogram.
  const textTop = 586, textLeft = 42, full = 548;
  const width = (y: number): number => !picto ? full
    : picto.side === 'right' ? picto.x - textLeft - 14
    : textTop + y > picto.y + 14 ? picto.x - textLeft - 10 : full;
  const fit = fitText(c.text, width, 850 - textTop, 42, 24);
  b += `<g ${TEXT_FONT} font-weight="500" font-size="${fit.size}" fill="${CARD_CREAM}">`
    + fit.lines.map(l => `<text x="${textLeft}" y="${(textTop + l.y).toFixed(1)}"${l.italic ? ' font-style="italic"' : ''}>${lineMarkup(l.text)}</text>`).join('') + '</g>';
  if (picto && pictoUrl) b += `<image href="${pictoUrl}" x="${picto.x}" y="${picto.y}" width="${picto.w}" height="${picto.h}" preserveAspectRatio="xMidYMid meet"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" data-id="${esc(c.id)}">${b}</svg>`;
}

/** What an ongoing effect card shows. */
export interface OngoingCard {
  /** Data id: picks the illustration. */
  id: string;
  /** Italian name, in capitals on the red panel. */
  name: string;
  /** Rules text in Italian; "\n" between paragraphs. */
  text: string;
  /** Unique prefix for the ids inside the SVG (default: the id). */
  key?: string;
}

/**
 * A Carnage at Devil's Run ongoing effect card, drawn: the official illustration above, the red panel
 * with its black torn edge below, the name and the text in black. 440 x 680 units.
 * Example: `ongoingCardSvg({ id: 'nitro_leak', name: 'Perdita di nitro', text: '…' })`.
 */
export function ongoingCardSvg(c: OngoingCard): string {
  const { w, h } = ONGOING_CARD, k = esc(`og-${c.key ?? c.id}`);
  const art = ONGOING_ILLUSTRATION[c.id];
  // The panel's top: a step up near the right end, as printed.
  const top: [number, number][] = [[0, 336], [16, 326], [300, 326], [314, 314], [w, 314]];
  const edge = ragged(top, 8, 4, c.id);
  let b = `<defs><clipPath id="${k}-card"><rect width="${w}" height="${h}" rx="22"/></clipPath>${wear(`${k}-wear`, '#5a0a12', 7)}</defs>`;
  b += `<g clip-path="url(#${k}-card)"><rect width="${w}" height="${h}" fill="${CARD_BLACK}"/>`;
  b += art ? `<image href="${art}" width="${w}" height="335" preserveAspectRatio="xMidYMin slice"/>` : `<rect width="${w}" height="335" fill="#4a3f36"/>`;
  b += `<path d="M${ragged(top.map(([x, y]) => [x, y - 11] as [number, number]), 6, 7, `${c.id}-black`)} V${h} H0Z" fill="${CARD_BLACK}"/>`;
  b += `<path d="M${edge} V${h} H0Z" fill="${CARD_RED}"/>`;
  b += `<rect y="300" width="${w}" height="${h - 300}" filter="url(#${k}-wear)" opacity=".35"/>`;
  b += `<rect width="${w}" height="${h}" rx="22" fill="none" stroke="${CARD_BLACK}" stroke-width="3"/></g>`;
  const name = c.name.toUpperCase();
  const nameSize = Math.min(50, 384 / textWidth(name, true));
  b += `<g transform="translate(28 386) skewX(${TITLE_LEAN})"><text ${TITLE_FONT} font-size="${nameSize.toFixed(1)}" fill="${CARD_BLACK}" letter-spacing=".6">${esc(name)}</text></g>`;
  const textTop = 404;
  const fit = fitText(c.text, () => 386, 652 - textTop, 38, 22);
  b += `<g ${TEXT_FONT} font-weight="500" font-size="${fit.size}" fill="${CARD_BLACK}">`
    + fit.lines.map(l => `<text x="28" y="${(textTop + l.y).toFixed(1)}"${l.italic ? ' font-style="italic"' : ''}>${lineMarkup(l.text)}</text>`).join('') + '</g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" data-id="${esc(c.id)}">${b}</svg>`;
}

/** The Italian text of an upgrade card (data/trv/cards_it.json), or '' when it has none. */
export function upgradeCardText(id: string): string {
  return (CARD_TEXT.upgrades as Record<string, string>)[id] ?? '';
}

/** The Italian name and text of an ongoing effect card (data/trv/cards_it.json); the id when it has none. */
export function ongoingCardText(id: string): [string, string] {
  const card = (CARD_TEXT.ongoing as Record<string, string[]>)[id];
  return card ? [card[0] ?? id, card[1] ?? ''] : [id, ''];
}
