// The first screen and the hot seat setup (players, crews, expansions), and starting a game.

import { leaders, upgrades, type Team } from '../game/trv/engine';
import { BASE_CATALOG as CAT } from '../game/trv/catalog';
import { newSeed } from '../platform/entropy';
import { skipBeats } from './beats';
import { carObjs, chopperObjs } from './board';
import { smokeOff, smokes } from './effects';
import { g, startGame, undo } from './game';
import { typing } from './keys';
import { closePops } from './menus';
import { drawLobby, exitRoom } from './online';
import { render } from './pieces';
import { scene } from './stage';
import { S } from './state';
import { $, esc, menuOpen } from './util';

export const crewSelects: HTMLSelectElement[] = [];
/** Per row: a person, or a TRV9000 team played by the cards (design/gdd/trv9000-bots.md). */
export const kindSelects: HTMLSelectElement[] = [];
for (let i = 0; i < 4; i++) {
  const sel = document.createElement('select');
  sel.innerHTML = CAT.crews.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  sel.value = CAT.crews[i].id;
  crewSelects.push(sel);
  const name = $(`n${i}`) as HTMLInputElement;
  name.value = CAT.crews[i].name;
  name.after(sel);
  const kind = document.createElement('select');
  // The Big Rig and the Final Five (BRaFF p3): a person plays them instead of three cars, one row each.
  kind.innerHTML = '<option value="person">Persona</option><option value="final_five">Persona: Final Five (moto)</option><option value="big_rig">Persona: Big Rig</option><option value="bot">TRV9000</option>';
  kind.title = 'Chi gioca questa squadra';
  kind.onchange = syncNames;
  kindSelects.push(kind);
  sel.after(kind);
}
/**
 * Shows the rows for the number of players and keeps every colour to one player: a colour taken
 * by another row cannot be picked; a row that appears with a taken colour gets the first free one.
 */
export function syncNames(): void {
  const n = Number(($('np') as HTMLSelectElement).value);
  for (let i = 0; i < 4; i++) {
    ($(`n${i}`) as HTMLInputElement).style.display = i < n ? '' : 'none';
    crewSelects[i].style.display = i < n ? '' : 'none';
    kindSelects[i].style.display = i < n ? '' : 'none';
  }
  $('botrow').style.display = kindSelects.slice(0, n).some(k => k.value === 'bot') ? '' : 'none';
  for (let i = 0; i < n; i++) {
    const before = crewSelects.slice(0, i).map(x => x.value);
    if (before.includes(crewSelects[i].value)) setCrew(i, CAT.crews.find(c => !before.includes(c.id) && !crewSelects.slice(i + 1, n).some(x => x.value === c.id))!.id);
  }
  for (let i = 0; i < 4; i++) {
    const taken = new Set(crewSelects.slice(0, n).filter((_, j) => j !== i).map(x => x.value));
    for (const o of crewSelects[i].options) o.disabled = taken.has(o.value);
    // One Final Five and one Big Rig per game (confirmed by the user, 2026-11-18).
    const teams = new Set(kindSelects.slice(0, n).filter((_, j) => j !== i).map(k => k.value));
    for (const o of kindSelects[i].options) if (o.value !== 'person' && o.value !== 'bot') o.disabled = teams.has(o.value);
  }
}
/** Gives row `i` crew `id`; a name still equal to the old colour's name follows the new colour. */
export function setCrew(i: number, id: string): void {
  const sel = crewSelects[i], name = $(`n${i}`) as HTMLInputElement;
  const old = CAT.crews.find(c => c.id === sel.value);
  sel.value = id;
  if (!name.value.trim() || name.value === old?.name) name.value = CAT.crews.find(c => c.id === id)!.name;
}
crewSelects.forEach((sel, i) => {
  let prev = sel.value;
  sel.addEventListener('change', () => { const now = sel.value; sel.value = prev; setCrew(i, now); prev = now; syncNames(); });
  sel.addEventListener('focus', () => { prev = sel.value; });
});
$('np').onchange = syncNames;
syncNames();

// The first screen: the home and its panes (design/ux/menu-lobby/mockup.html); the online
// panes are filled by home.ts.

export type Pane = 'pMain' | 'pHot' | 'pLobby' | 'pCreate' | 'pMine' | 'pFriends' | 'pJoin';
export function showPane(id: Pane): void {
  for (const el of document.querySelectorAll<HTMLElement>('#setup .pane')) el.classList.toggle('on', el.id === id);
  $('oerr').textContent = '';
  // A local game only: after leaving an online room the table still holds its game, not one to resume here.
  const resumable = !!g && g.winner === null && !S.net && !!S.saved;
  $('mResume').style.display = id === 'pMain' && resumable ? '' : 'none';
  const name = $('myname') as HTMLInputElement;
  if ((id === 'pCreate' || id === 'pJoin') && !name.value.trim()) name.focus();
  if (id === 'pLobby') ($('ocode') as HTMLInputElement).focus();
}
/** Opens the first screen on `pane` (the menu by default). */
/** While a menu covers the game, the game's controls take no focus or clicks (Tab stays in the menu). */
export function syncInert(): void {
  const covered = menuOpen();
  for (const el of document.body.children) {
    if (el.id === 'setup' || el.id === 'lobby' || el.tagName === 'SCRIPT') continue;
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
  const n = Number(($('np') as HTMLSelectElement).value);
  const crews = crewSelects.slice(0, n).map(s => s.value);
  if (new Set(crews).size !== crews.length) { alert('Ogni giocatore deve avere un colore diverso.'); return; }
  const bots = kindSelects.slice(0, n).map(k => k.value === 'bot');
  if (bots.every(b => b)) { alert('Serve almeno una persona: una partita di soli TRV9000 non si può creare.'); return; }
  const protocol = Number(($('botlevel') as HTMLSelectElement).value);
  const seed = newSeed();
  if (!seed.ok) { alert('Il browser non fornisce numeri casuali sicuri: impossibile iniziare.'); return; }
  const players = crews.map((crew, i) => {
    const c = CAT.crews.find(x => x.id === crew)!;
    const k = kindSelects[i].value;
    const team = k === 'final_five' || k === 'big_rig' ? { team: k as Team } : {};
    return { name: ($(`n${i}`) as HTMLInputElement).value.trim() || c.name, color: c.color, crew, ...(bots[i] ? { bot: { protocol } } : {}), ...team };
  });
  clearTable();
  $('setup').style.display = 'none';
  const leaders = ($('leaders') as HTMLInputElement).checked, cards = ($('upgrades') as HTMLInputElement).checked;
  const carnage = ($('carnage') as HTMLInputElement).checked;
  startGame({ setup: { seed: seed.value, players, startSide: ($('side') as HTMLSelectElement).value as 'a' | 'b', ...(leaders ? { leaders } : {}), ...(cards ? { upgrades: cards } : {}), ...(carnage ? { carnage } : {}) }, choices: [] }, true);
};
