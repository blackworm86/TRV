// Small helpers shared by the whole client: the dice faces the table draws, DOM lookups, escaping.
// The fire die of Carnage at Devil's Run joins the dice the table can draw.

import RULES from '../../data/trv/game_base.json';
import { type DiceFaces } from '../view/dice3d';
import CARNAGE from '../../data/trv/carnage.json';

export const FACES = { ...RULES.dice, fire: CARNAGE.dice.fire } as unknown as DiceFaces;

export const SAVE_KEY = 'trv-hotseat-v3';
export const $ = (id: string): HTMLElement => document.getElementById(id)!;
export { esc } from '../core/markup';
/**
 * True while the first screen (or the room's card) covers the game: then the game is not drawn and
 * takes no keys (Tab, arrows and shortcuts belong to the menu).
 */
export const menuOpen = (): boolean => getComputedStyle(document.getElementById('setup')!).display !== 'none'
  || document.getElementById('lobby')?.style.display === 'grid';
/**
 * Asks to confirm something that cannot be undone, on the first screen's own card (design/ux/chiudi-partite):
 * `title` and `text` say what goes, `ok` names the action. Resolves true on the action, false on
 * Annulla, Esc or a click outside the card.
 */
export function sure(title: string, text: string, ok: string): Promise<boolean> {
  const card = document.getElementById('sure')!, yes = document.getElementById('sureOk')!, no = document.getElementById('sureNo')!;
  document.getElementById('sureT')!.textContent = title;
  document.getElementById('sureP')!.textContent = text;
  yes.textContent = ok;
  card.classList.add('on');
  no.focus();
  return new Promise(done => {
    const end = (v: boolean): void => {
      card.classList.remove('on');
      yes.onclick = no.onclick = null;
      removeEventListener('keydown', key, true);
      removeEventListener('pointerdown', away, true);
      done(v);
    };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false); } };
    const away = (e: PointerEvent): void => { if (!card.contains(e.target as Node)) end(false); };
    yes.onclick = () => end(true);
    no.onclick = () => end(false);
    addEventListener('keydown', key, true);
    addEventListener('pointerdown', away, true);
  });
}
export const cssPx = (name: string): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
