// The official card art (Choppe Shoppe upgrade cards), cut from the scanned print-and-play pages by
// tools/art/extract_cards.py and tools/art/save_upgrade_cards.py: one 630 x 880 JPEG per card in
// assets/licensed/cards/upgrades/<id>.jpg. The game keeps the illustration and the torn edge above
// the black panel, and writes the Italian name and text over the panel (the scans are in English).

const UPGRADE_ART: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/licensed/cards/upgrades/*.jpg', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ''), url]));

/** Where the card's black text panel begins, as a share of the card's height (below the torn edge). */
export const UPGRADE_PANEL_TOP = 0.6;
/** The panel's black, sampled from the scans. */
export const CARD_BLACK = '#141313';

/**
 * The URL of an upgrade card's official art, or undefined when the file is not there.
 * @param id the upgrade's data id (data/trv/choppe_shoppe.json).
 * Example: `upgradeArt('rail_gun')` → `/assets/licensed/cards/upgrades/rail_gun.jpg`.
 */
export function upgradeArt(id: string): string | undefined {
  return UPGRADE_ART[id];
}
