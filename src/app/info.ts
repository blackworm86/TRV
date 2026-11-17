// Popups that explain: rolled dice, damage tokens and their cards, leader portraits, upgrade
// and ongoing card texts, the command board lines.

import { leaderOf, commandsOf, leaders, commandName, upgrades, type CommandSlot, type Player, type Frame } from '../game/trv/engine';
import { ongoingCardSvg, ongoingCardText } from '../view/cards';
import CARD_TEXT from '../../data/trv/cards_it.json';
import { damageTokenSvg } from '../view/vector/art';
import { g } from './game';
import { dieHtml } from './hud';
import { $, esc } from './util';

/** What each rolled die decides, said in a few words under the big die in the middle of the screen. */
export const ROLL_NAME: Record<string, string> = { slam: 'Dado slam', direction: 'Direzione', shooting: 'Dado sparo', stunt: 'Dado acrobazia', road: 'Dado strada', fire: 'Dado fuoco' };
export const ROLL_MEANS: Record<string, Record<string, string>> = {
  fire: { '+1': '+1 movimento, da fare tutti', '+2': '+2 movimenti, da fare tutti', out: 'il fuoco si spegne', eliminated: 'l’auto brucia: eliminata' },
  slam: { top: 'si muove il veicolo che ha urtato (sopra)', bottom: 'si muove il veicolo urtato (sotto)' },
  direction: { F: 'avanti', FL: 'avanti a sinistra', FR: 'avanti a destra', B: 'indietro', BL: 'indietro a sinistra', BR: 'indietro a destra' },
  shooting: { L: 'colpisce solo le auto grandi', M: 'colpisce medie e grandi', SM: 'colpisce piccole e medie', ANY: 'colpisce qualsiasi auto' },
};
export let rollsTimer = 0;
/** Shows a rolled die big in the middle of the screen, with what it means; the dice of one event stay together. */
/** Until when (performance.now()) a damage token is on show: a new turn does not clear it. */
export let damageUntil = 0;
export function showRoll(f: Frame): void {
  if (!f.die) return;
  const el = $('rolls');
  if (!el.classList.contains('show')) el.innerHTML = '';
  if (el.children.length >= 4) el.firstElementChild!.remove();
  const means = ROLL_MEANS[f.die.die]?.[String(f.die.value)] ?? (typeof f.die.value === 'number' ? `${f.die.value}` : '');
  el.insertAdjacentHTML('beforeend', `<div class="roll">${dieHtml(f.die.die, f.die.value, undefined, '', `data-roll="${performance.now()}"`)}`
    + `<b>${ROLL_NAME[f.die.die] ?? f.die.die}</b><span>${esc(means)}</span></div>`);
  el.classList.add('show');
  clearTimeout(rollsTimer);
  rollsTimer = window.setTimeout(() => el.classList.remove('show'), Math.max(3200, damageUntil - performance.now()));
}

/** The damage tokens: name and what each does, in a few words (rulebook, back cover). */
export const DAMAGE_INFO: Record<string, [string, string]> = {
  dent: ['Ammaccatura', 'Nessun effetto, oltre al danno.'],
  shrapnel: ['Schegge', 'Dado direzione: il primo veicolo su quella linea subisce un danno.'],
  skid: ['Sbandata', 'L’auto si sposta di 1 casella nella direzione indicata.'],
  dazed: ['Stordito', 'Dado acrobazia: tante caselle, ognuna nella direzione tirata.'],
  blastoff: ['Decollo', 'Dadi direzione e acrobazia: l’auto vola di tante caselle in quella direzione.'],
  // Carnage at Devil's Run (CDR p4).
  on_fire: ['In fiamme', 'L’auto prende un segnalino ON FIRE!; il segnalino danno resta coperto.'],
  ongoing_effect: ['Effetto continuo', 'Si pesca una carta effetto continuo: resta finché il danno non viene riparato.'],
};
/**
 * A car takes damage: the token drawn is turned over big in the middle of the screen, with whose
 * car it is and what the token does. The dice it calls for appear beside it as they are rolled.
 */
/**
 * Crew leader portraits, by leader id: licensed art, so local only (assets/choppe_shoppe/capisquadra/<id>.png,
 * .jpg or .webp). A leader without a file shows the crew colour and an initial.
 */
export const PORTRAITS: Record<string, string> = Object.fromEntries(Object.entries(
  import.meta.glob<string>('/assets/choppe_shoppe/capisquadra/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }),
).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, '').toLowerCase(), url]));

/** Choppe Shoppe: what each upgrade card does, in the interface's words. */
export const UPGRADE_INFO: Record<string, string> = {
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
export const upgradeName = (id: string): string => upgrades().find(u => u.id === id)?.name ?? id;

/** Choppe Shoppe: each leader's special power, name and what it does (the crew leader boards). */
export const POWER_INFO: Record<string, [string, string]> = {
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
/** What each command does, in three short lines for the command board. */
export const CMD_LINES: Record<string, string[]> = {
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
/** The text of a command's die space: "1-3", "6", or a star for a command token only. */
export function slotText(s: CommandSlot): string {
  if (s.token || !s.values.length) return '★';
  const lo = Math.min(...s.values), hi = Math.max(...s.values);
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}
/** A crew leader's commands as the command board draws them. */
export function boardCommands(p: Player): { cmd: string; name: string; slot: string; lines: string[] }[] | undefined {
  if (!leaderOf(p)) return undefined;
  return commandsOf(p).map(s => ({ cmd: s.id, name: commandName(s.id).toUpperCase(), slot: slotText(s), lines: CMD_LINES[s.id] ?? [] }));
}

/** The ongoing effect cards (Carnage at Devil's Run) in Italian: name and text (data/trv/cards_it.json). */
export const ONGOING_INFO: Record<string, [string, string]> = Object.fromEntries(
  Object.keys(CARD_TEXT.ongoing).map(id => [id, ongoingCardText(id)]));
/** Tells the cards on a page apart (their SVG ids). */
let ongoingSerial = 0;
/** An ongoing effect card as HTML: the digital card (src/view/cards.ts), Italian name and text on its red panel. */
export function ongoingCardHtml(id: string): string {
  const [name, text] = ongoingCardText(id);
  return `<div class="ocard drawn" title="${esc(`${name}: ${text.replace(/\n/g, ' ')}`)}">${ongoingCardSvg({ id, name, text, key: `${id}-${ongoingSerial++}` })}</div>`;
}

/** Hovering an ongoing effect card under a damage token shows the whole card, big enough to read. */
export function ongoingZoom(): void {
  const pop = document.createElement('div');
  pop.id = 'ozoom';
  document.body.append(pop);
  let shown: string | null = null;
  addEventListener('pointermove', e => {
    const el = (e.target as Element | null)?.closest?.('[data-ongoing]');
    const id = el?.getAttribute('data-ongoing') ?? null;
    if (id !== shown) { shown = id; pop.innerHTML = id ? ongoingCardHtml(id) : ''; pop.classList.toggle('show', !!id); }
    if (!id) return;
    // Above the pointer (the cards sit at the bottom of the screen), kept on screen.
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, e.clientX - w / 2))}px`;
    pop.style.top = `${Math.max(8, e.clientY - h - 16)}px`;
  });
}
ongoingZoom();

export function showDamage(f: Frame): void {
  if (!g || f.token === undefined) return;
  if (f.faceDown) {
    const car = g.vehicles.find(x => x.id === f.vehicleId);
    const pl = car && car.owner !== null ? g.players[car.owner] : null;
    const el = $('rolls');
    el.innerHTML = `<div class="roll dmg" style="--c:${pl?.color ?? '#d42f30'}"><small>${esc(pl ? `Auto di ${pl.name}` : '')} · danno</small>`
      + `<i class="tok">${damageTokenSvg(null, false)}</i><b>Jury-Rigging</b><span>Il segnalino resta coperto: nessun effetto, ma conta come danno.</span></div>`;
    el.classList.add('show');
    clearTimeout(rollsTimer);
    rollsTimer = window.setTimeout(() => el.classList.remove('show'), 4500);
    damageUntil = performance.now() + 4500;
    return;
  }
  const v = g.vehicles.find(x => x.id === f.vehicleId);
  const owner = v && v.owner !== null ? g.players[v.owner] : null;
  const who = v ? `Auto ${{ S: 'piccola', M: 'media', L: 'grande' }[v.size]}${owner ? ` di ${owner.name}` : ''}` : '';
  const [name, does] = f.token ? DAMAGE_INFO[f.token.type] ?? [f.token.type, ''] : ['Danno', 'Nessun segnalino rimasto nella pila.'];
  const el = $('rolls');
  // CDR p4: an ongoing effect token comes with its card; the card is what the player must read.
  const card = f.token?.card as string | undefined;
  el.innerHTML = `<div class="roll dmg${card ? ' withcard' : ''}" style="--c:${owner?.color ?? '#d42f30'}"><small>${esc(who)} · danno</small>`
    + `<i class="tok">${f.token ? damageTokenSvg(f.token.type, true, f.token.dir as never) : damageTokenSvg(null, false)}</i>`
    + `<b>${esc(name)}</b><span>${esc(does)}</span>${card ? ongoingCardHtml(card) : ''}</div>`;
  el.classList.add('show');
  clearTimeout(rollsTimer);
  rollsTimer = window.setTimeout(() => el.classList.remove('show'), card ? 8000 : 4500);
  damageUntil = performance.now() + (card ? 8000 : 4500);
}
