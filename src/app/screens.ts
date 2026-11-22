// The first screen and the hot seat setup (players, crews, expansions), and starting a game.

import type { Team } from '../game/trv/engine';
import { BASE_CATALOG as CAT } from '../game/trv/catalog';
import { newSeed } from '../platform/entropy';
import { skipBeats } from './beats';
import { carObjs, chopperObjs } from './board';
import { smokeOff, smokes } from './effects';
import { dropLocal, g, startGame, undo } from './game';
import { typing } from './keys';
import { closePops } from './menus';
import { drawLobby, exitRoom } from './online';
import { render } from './pieces';
import { scene } from './stage';
import { S } from './state';
import { $, esc, menuOpen, sure } from './util';

// The hot seat setup (redrawn as asked by the user, 2026-11-22): one row per team with its colour
// as a swatch (a click opens the palette), its name, what it plays (three cars, the Final Five or
// the Big Rig) and a switch that hands it to a TRV9000 bot; the table and the expansions beside it.

/** What a row plays: three cars, or one of the BRaFF teams (BRaFF p3), one each per game. */
type RowTeam = 'cars' | Team;
const TEAM_TEXT: Record<RowTeam, string> = { cars: '3 auto', final_five: 'Final Five', big_rig: 'Big Rig' };
/** Per row: its crew (colour), what it plays and whether a TRV9000 bot plays it (design/gdd/trv9000-bots.md). */
const rows = CAT.crews.slice(0, 4).map(c => ({ crew: c.id, team: 'cars' as RowTeam, bot: false }));
const playerCount = (): number => Number(($('np') as HTMLSelectElement).value);
const rowEl = (i: number): HTMLElement => document.querySelector<HTMLElement>(`#hotrows .crew[data-i="${i}"]`)!;
const crewOf = (id: string) => CAT.crews.find(c => c.id === id)!;

for (let i = 0; i < 4; i++) {
  ($(`n${i}`) as HTMLInputElement).value = CAT.crews[i].name;
  const row = rowEl(i);
  row.insertAdjacentHTML('beforeend', `<div class="seg teamseg" title="Che cosa gioca questa squadra">${(Object.keys(TEAM_TEXT) as RowTeam[])
    .map(t => `<button type="button" data-team="${t}">${TEAM_TEXT[t]}</button>`).join('')}</div>`
    + '<label class="switch bot" title="La squadra la gioca un TRV9000, con le sue carte"><input type="checkbox"><span><b>TRV9000</b></span></label>');
  row.querySelector('.teamseg')!.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-team]');
    if (b && !b.disabled) { rows[i].team = b.dataset.team as RowTeam; syncNames(); }
  });
  const bot = row.querySelector<HTMLInputElement>('.bot input')!;
  // A bot plays three cars: the Final Five and the Big Rig are for people.
  bot.onchange = () => { rows[i].bot = bot.checked; if (bot.checked) rows[i].team = 'cars'; syncNames(); };
  row.querySelector<HTMLButtonElement>('.sw')!.onclick = e => { e.stopPropagation(); openPalette(i); };
}

/** The palette under row `i`'s swatch: every colour, the ones other rows hold greyed out. */
let palRow: number | null = null;
function openPalette(i: number): void {
  const pal = $('crewpal');
  if (palRow === i) { closePalette(); return; }
  palRow = i;
  const n = playerCount();
  const taken = new Set(rows.slice(0, n).filter((_, j) => j !== i).map(r => r.crew));
  pal.innerHTML = CAT.crews.map(c => `<button type="button" role="option" data-crew="${c.id}" style="--c:${c.color}" title="${esc(c.name)}${taken.has(c.id) ? ' (già preso)' : ''}"`
    + `${taken.has(c.id) ? ' disabled' : ''}${c.id === rows[i].crew ? ' aria-selected="true" class="on"' : ''}></button>`).join('');
  const sw = rowEl(i).querySelector<HTMLElement>('.sw')!, box = $('hotrows').parentElement!.getBoundingClientRect(), at = sw.getBoundingClientRect();
  pal.style.left = `${at.left - box.left}px`;
  pal.style.top = `${at.bottom - box.top + 6}px`;
  pal.classList.add('show');
}
function closePalette(): void { palRow = null; $('crewpal').classList.remove('show'); }
$('crewpal').addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-crew]');
  if (!b || b.disabled || palRow === null) return;
  setCrew(palRow, b.dataset.crew!);
  closePalette();
  syncNames();
});
addEventListener('pointerdown', e => { if (palRow !== null && !(e.target as Element).closest('#crewpal, .crew .sw')) closePalette(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && palRow !== null) closePalette(); });

/**
 * Draws the rows for the number of players and keeps every colour to one player (a row that
 * appears with a taken colour gets the first free one) and each BRaFF team to one row.
 */
export function syncNames(): void {
  const n = playerCount();
  for (const b of document.querySelectorAll<HTMLElement>('#npseg [data-v]')) b.classList.toggle('on', Number(b.dataset.v) === n);
  for (let i = 0; i < n; i++) {
    const before = rows.slice(0, i).map(r => r.crew);
    if (before.includes(rows[i].crew)) setCrew(i, CAT.crews.find(c => !before.includes(c.id) && !rows.slice(i + 1, n).some(r => r.crew === c.id))!.id);
    // One Final Five and one Big Rig per game (confirmed by the user, 2026-11-18).
    if (rows[i].team !== 'cars' && rows.slice(0, i).some(r => r.team === rows[i].team)) rows[i].team = 'cars';
  }
  for (let i = 0; i < 4; i++) {
    const row = rowEl(i), r = rows[i];
    row.style.display = i < n ? '' : 'none';
    row.style.setProperty('--c', crewOf(r.crew).color);
    row.classList.toggle('isbot', r.bot);
    row.querySelector<HTMLElement>('.sw')!.setAttribute('aria-label', `Colore: ${crewOf(r.crew).name}`);
    row.querySelector<HTMLInputElement>('.bot input')!.checked = r.bot;
    const others = new Set(rows.slice(0, n).filter((_, j) => j !== i).map(x => x.team));
    for (const b of row.querySelectorAll<HTMLButtonElement>('[data-team]')) {
      const t = b.dataset.team as RowTeam;
      b.classList.toggle('on', t === r.team);
      b.disabled = r.bot || (t !== 'cars' && others.has(t));
    }
  }
  $('botrow').style.display = rows.slice(0, n).some(r => r.bot) ? '' : 'none';
}
/** Gives row `i` crew `id`; a name still equal to the old colour's name follows the new colour. */
export function setCrew(i: number, id: string): void {
  const name = $(`n${i}`) as HTMLInputElement;
  const old = crewOf(rows[i].crew);
  rows[i].crew = id;
  if (!name.value.trim() || name.value === old.name) name.value = crewOf(id).name;
}
$('npseg').addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-v]');
  if (b) { ($('np') as HTMLSelectElement).value = b.dataset.v!; closePalette(); syncNames(); }
});
$('np').onchange = syncNames;
syncNames();

// The bot level and the starting tile: buttons over the selects the game reads.
const botLevel = $('botlevel') as HTMLSelectElement, side = $('side') as HTMLSelectElement;
function syncChoices(): void {
  $('botseg').innerHTML = [...botLevel.options].map(o => `<button type="button" data-v="${o.value}" class="${o.value === botLevel.value ? 'on' : ''}">${o.value}</button>`).join('');
  $('botwhat').textContent = botLevel.selectedOptions[0]?.textContent?.replace(/^\d+\s*—\s*/, 'Livello ' + botLevel.value + ': ') ?? '';
  for (const b of document.querySelectorAll<HTMLElement>('#sideseg [data-v]')) b.classList.toggle('on', b.dataset.v === side.value);
}
$('botseg').addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-v]'); if (b) { botLevel.value = b.dataset.v!; syncChoices(); } });
$('sideseg').addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-v]'); if (b) { side.value = b.dataset.v!; syncChoices(); } });
syncChoices();

// The first screen: the home and its panes (design/ux/menu-lobby/mockup.html); the online
// panes are filled by home.ts.

export type Pane = 'pMain' | 'pHot' | 'pLobby' | 'pCreate' | 'pMine' | 'pFriends' | 'pJoin' | 'pUser';
export function showPane(id: Pane): void {
  for (const el of document.querySelectorAll<HTMLElement>('#setup .pane')) el.classList.toggle('on', el.id === id);
  $('oerr').textContent = '';
  // A local game only: after leaving an online room the table still holds its game, not one to resume here.
  const resumable = !!g && g.winner === null && !S.net && !!S.saved;
  $('mResumeRow').style.display = id === 'pMain' && resumable ? '' : 'none';
  if (resumable) $('mResumeWhat').textContent = localWhat();
  const name = $('myname') as HTMLInputElement;
  if ((id === 'pCreate' || id === 'pJoin') && !name.value.trim()) name.focus();
  if (id === 'pLobby') ($('ocode') as HTMLInputElement).focus();
}
/** Opens the first screen on `pane` (the menu by default). */
/** While a menu covers the game, the game's controls take no focus or clicks (Tab stays in the menu). */
export function syncInert(): void {
  const covered = menuOpen();
  for (const el of document.body.children) {
    // What lies over the menus stays usable: the Beta gate (its Google button), and the windows that
    // open from the first screen too (Segnala, the profile).
    if (el.id === 'setup' || el.id === 'lobby' || el.tagName === 'SCRIPT' || el.id === 'beta'
      || el.getAttribute('role') === 'dialog' || el.id === 'rep-thanks') continue;
    (el as HTMLElement).inert = covered;
  }
}
new MutationObserver(syncInert).observe($('setup'), { attributes: true, attributeFilter: ['style'] });
new MutationObserver(syncInert).observe($('lobby'), { attributes: true, attributeFilter: ['style'] });
export function openSetup(pane: Pane = 'pMain'): void {
  closePops();
  $('setup').style.display = 'grid';
  showPane(pane);
}
$('mHot').onclick = () => showPane('pHot');
$('mResume').onclick = () => { $('setup').style.display = 'none'; render(); };
/** The local game in a few words: who plays, and the round. */
function localWhat(): string {
  if (!g) return '';
  const names = g.players.map(p => p.name);
  return `${names.length > 2 ? names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1] : names.join(' contro ')} · round ${g.round}`;
}
$('mDrop').onclick = () => {
  if (!g) return;
  void sure('Eliminare la partita in locale?', `${localWhat()}. La partita salvata in questo browser viene cancellata e non si può riprendere.`, 'Elimina').then(ok => {
    if (!ok) return;
    dropLocal();
    clearTable();
    showPane('pMain');
  });
};
for (const b of document.querySelectorAll<HTMLElement>('#setup [data-back]')) b.onclick = () => showPane('pMain');
for (const b of document.querySelectorAll<HTMLElement>('#setup [data-to]')) b.onclick = () => showPane(b.dataset.to as Pane);
/** Takes the pieces of the last match off the table, before a new one is set up. */
export function clearTable(): void {
  for (const o of carObjs.values()) scene.remove(o);
  carObjs.clear();
  for (const id of [...smokes.keys()]) smokeOff(id);
  for (const o of chopperObjs.values()) scene.remove(o);
  chopperObjs.clear();
  S.winShown = false;
  $('win').style.display = 'none';
}
$('undo2').onclick = () => undo();
// Ctrl+Z (Cmd+Z on a Mac): take the last choice back, in hot seat, outside text fields and menus.
addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey || typing(e) || menuOpen()) return;
  e.preventDefault();
  if (S.playing) skipBeats();
  undo();
});
/** Online, "new game" is the host's call, from the room's card. */
export function newGameScreen(): void { if (S.net) { S.net.lobbyOpen = true; drawLobby(); } else openSetup(); }
$('newgame').onclick = () => { closePops(); newGameScreen(); };
$('roomopen').onclick = () => { closePops(); if (S.net) { S.net.lobbyOpen = true; drawLobby(); } };
$('quit').onclick = () => {
  closePops();
  if (S.net) { exitRoom(); return; } // the seat is kept: the invite link brings this player back
  openSetup(); // the game stays: "Torna alla partita" resumes it
};
$('again').onclick = () => { $('win').style.display = 'none'; if (S.net) { S.net.lobbyOpen = true; drawLobby(); } else openSetup(); };
$('close').onclick = () => { $('win').style.display = 'none'; };
$('start').onclick = () => {
  const n = playerCount();
  const crews = rows.slice(0, n).map(r => r.crew);
  if (new Set(crews).size !== crews.length) { alert('Ogni giocatore deve avere un colore diverso.'); return; }
  const bots = rows.slice(0, n).map(r => r.bot);
  if (bots.every(b => b)) { alert('Serve almeno una persona: una partita di soli TRV9000 non si può creare.'); return; }
  const protocol = Number(($('botlevel') as HTMLSelectElement).value);
  const seed = newSeed();
  if (!seed.ok) { alert('Il browser non fornisce numeri casuali sicuri: impossibile iniziare.'); return; }
  const players = crews.map((crew, i) => {
    const c = CAT.crews.find(x => x.id === crew)!;
    const k = rows[i].team;
    const team = k !== 'cars' && !bots[i] ? { team: k } : {};
    return { name: ($(`n${i}`) as HTMLInputElement).value.trim() || c.name, color: c.color, crew, ...(bots[i] ? { bot: { protocol } } : {}), ...team };
  });
  clearTable();
  $('setup').style.display = 'none';
  const leaders = ($('leaders') as HTMLInputElement).checked, cards = ($('upgrades') as HTMLInputElement).checked;
  const carnage = ($('carnage') as HTMLInputElement).checked;
  startGame({ setup: { seed: seed.value, players, startSide: ($('side') as HTMLSelectElement).value as 'a' | 'b', ...(leaders ? { leaders } : {}), ...(cards ? { upgrades: cards } : {}), ...(carnage ? { carnage } : {}) }, choices: [] }, true);
};
