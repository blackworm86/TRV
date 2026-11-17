// The official card art (Choppe Shoppe upgrade cards), cut from the scanned print-and-play pages by
// tools/art/extract_cards.py and tools/art/save_upgrade_cards.py: one 630 x 880 JPEG per card in
// assets/choppe_shoppe/carte/potenziamenti/<id>.jpg. The game keeps the illustration and the torn edge above
// the black panel, and writes the Italian name and text over the panel (the scans are in English).

const UPGRADE_ART: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/choppe_shoppe/carte/potenziamenti/*.jpg', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ''), url]));

/** Where the card's black text panel begins, as a share of the card's height (below the torn edge). */
export const UPGRADE_PANEL_TOP = 0.6;
/** The panel's black, sampled from the scans. */
export const CARD_BLACK = '#141313';

/**
 * The URL of an upgrade card's official art, or undefined when the file is not there.
 * @param id the upgrade's data id (data/trv/choppe_shoppe.json).
 * Example: `upgradeArt('rail_gun')` → `/assets/choppe_shoppe/carte/potenziamenti/rail_gun.jpg`.
 */
export function upgradeArt(id: string): string | undefined {
  return UPGRADE_ART[id];
}

// The ongoing effect cards (Carnage at Devil's Run), cut the same way (tools/art/ongoing_cards.json):
// one 440 x 680 JPEG per card in assets/carnage/carte/effetto_continuo/<id>.jpg, with a red text panel.
const ONGOING_ART: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/carnage/carte/effetto_continuo/*.jpg', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ''), url]));

/** Where the ongoing effect card's red panel begins (below the torn edge), as a share of its height. */
export const ONGOING_PANEL_TOP = 0.57;
/** The ongoing effect card's red, sampled from the scans. */
export const CARD_RED = '#e01a30';

/**
 * The URL of an ongoing effect card's official art, or undefined when the file is not there.
 * @param id the card's data id (data/trv/carnage.json, ongoing_effects).
 * Example: `ongoingArt('nitro_leak')` → `/assets/carnage/carte/effetto_continuo/nitro_leak.jpg`.
 */
export function ongoingArt(id: string): string | undefined {
  return ONGOING_ART[id];
}
