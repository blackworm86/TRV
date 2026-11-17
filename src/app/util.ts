// Small helpers shared by the whole client: the dice faces the table draws, DOM lookups, escaping.
// The fire die of Carnage at Devil's Run joins the dice the table can draw.

import RULES from '../../data/trv/game_base.json';
import { type DiceFaces } from '../view/dice3d';
import CARNAGE from '../../data/trv/carnage.json';

export const FACES = { ...RULES.dice, fire: CARNAGE.dice.fire } as unknown as DiceFaces;

export const SAVE_KEY = 'trv-hotseat-v3';
export const $ = (id: string): HTMLElement => document.getElementById(id)!;
export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/**
 * True while the first screen (or the room's card) covers the game: then the game is not drawn and
 * takes no keys (Tab, arrows and shortcuts belong to the menu).
 */
export const menuOpen = (): boolean => getComputedStyle(document.getElementById('setup')!).display !== 'none'
  || document.getElementById('lobby')?.style.display === 'grid';
export const cssPx = (name: string): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
