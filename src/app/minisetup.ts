// The mini expansions in the game's setup (the approved mockup): a switch each, with a fan of three
// of its real cards, "tutte · nessuna": in hot seat, making a room and in the room. The keys are
// the room options' and the game setup's (src/net/room.ts MINI_KEYS).

import { MINI_KEYS, type MiniKey } from '../net/room';
import { miniCardSvg, type MiniFamily } from '../view/minicards';
import { $, esc } from './util';

/** Each mini expansion: its cards' family, its name, what it does in a line, the cards of its fan. */
export const MINI_INFO: Record<MiniKey, { family: MiniFamily; name: string; line: string; fan: string[] }> = {
  bonusCommands: { family: 'bonus_commands', name: 'Bonus Commands', line: 'Un comando in più a testa, da usare con un dado', fan: ['hands_free', 'rocket_fuel', 'tire_spikes'] },
  oneShots: { family: 'one_shots', name: 'One Shots', line: 'Una carta coperta a testa, da giocare una volta', fan: ['flux_capacitor', 'guided_missile', 'radar_array'] },
  bounties: { family: 'bounties', name: 'Bounties', line: 'Una taglia segreta: completala e riscuoti il premio', fan: ['pinball_wizard', 'hit_and_run', 'death_from_above'] },
  roadConditions: { family: 'road_conditions', name: 'Road Conditions', line: 'Ogni tessera ha la sua condizione: ghiaccio, predoni, tempesta…', fan: ['icy', 'marauders', 'windy'] },
  airstrikes: { family: 'advanced_airstrikes', name: 'Advanced Airstrikes', line: "Una carta coperta per l'elicottero, da giocare una volta", fan: ['dual_guns', 'trick_shot', 'care_package'] },
};
/** The page id of a mini expansion's switch: `prefix` '' in hot seat, 'o' making a room, 'l' in the room. */
export const miniId = (prefix: string, k: MiniKey): string => `${prefix}${k.toLowerCase()}`;

/**
 * The switches, each with its fan of cards: hot seat (`prefix` ''), a new room ('o') and the room
 * ('l'), ticked as in `on`; `locked` only shows them (a guest, or a match under way).
 */
export function miniSwitches(prefix = '', on: Partial<Record<MiniKey, boolean>> = {}, locked = false): string {
  return MINI_KEYS.map(k => {
    const m = MINI_INFO[k];
    const fan = m.fan.map((id, i) => `<i style="left:${i * 20}px;transform:rotate(${(i - 1) * 9}deg)">${miniCardSvg(m.family, id)}</i>`).join('');
    return `<label class="switch mini"><input type="checkbox" id="${miniId(prefix, k)}" ${on[k] ? 'checked' : ''} ${locked ? 'disabled' : ''}><span><b>${esc(m.name)}</b><small>${esc(m.line)}</small></span><span class="fan">${fan}</span></label>`;
  }).join('');
}
/** The mini expansions ticked on the page, each as `key: true`. */
export function readMinis(prefix: string): Partial<Record<MiniKey, true>> {
  return Object.fromEntries(MINI_KEYS.filter(k => ($(miniId(prefix, k)) as HTMLInputElement | null)?.checked).map(k => [k, true]));
}
