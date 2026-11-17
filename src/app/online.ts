// Online games: rooms on a shared store (Firebase, or local for checks), the lobby, the
// host as referee of every move.
// A room on a shared store (src/net/room.ts): the host's browser is the referee. Every device
// replays the room's log of choices on its own copy of the rules; a guest's click becomes an
// intent that the host checks and appends. The room stays open until the host closes it.

import { leaders, upgrades } from '../game/trv/engine';
import { BASE_CATALOG as CAT } from '../game/trv/catalog';
import { newSeed } from '../platform/entropy';
import { acceptable, undoable, backToLobby, cleanCode, closeRoom, createRoom, freeCrew, joinRoom, leaveRoom, readRoom, roomPath, startMatch, startProblem, MAX_PLAYERS, NAME_MAX, type Room, type RoomStore } from '../net/room';
import { FIREBASE_CONFIG } from '../net/firebase-config';
import qrcode from 'qrcode-generator';
import { applyChoice, deciders, g, pending, setPending, startGame, takeBack } from './game';
import { render } from './pieces';
import { clearTable, openSetup } from './screens';
import { S } from './state';
import { $, esc } from './util';

export const NAME_KEY = 'trv-name';
export const CREW_IDS = CAT.crews.map(c => c.id);
export const crewColor = (crew: string): string => CAT.crews.find(c => c.id === crew)?.color ?? '#888';
export const randomBytes = (bytes: Uint8Array): Uint8Array => { crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>); return bytes; };

/** Where rooms live: the Firebase project, or (for checks) `?net=local` / `?net=emulator`. Null: online is off. */
export function netMode(): 'firebase' | 'local' | 'emulator' | null {
  const q = new URLSearchParams(location.search).get('net');
  if (q === 'local' || q === 'emulator') return q;
  return FIREBASE_CONFIG ? 'firebase' : null;
}
export let storePromise: Promise<RoomStore> | null = null;
export function openStore(): Promise<RoomStore> {
  storePromise ??= (async (): Promise<RoomStore> => {
    const mode = netMode();
    if (mode === 'local') return (await import('../net/tree-store')).createLocalStore();
    const { createFirebaseStore } = await import('../net/firebase-store');
    if (mode === 'emulator') {
      return createFirebaseStore({ apiKey: 'demo-key', authDomain: 'demo-trv.firebaseapp.com', projectId: 'demo-trv', appId: 'demo-app',
        databaseURL: 'https://demo-trv-default-rtdb.firebaseio.com' }, { auth: 9099, database: 9000 });
    }
    return createFirebaseStore(FIREBASE_CONFIG!);
  })();
  return storePromise;
}
/** The link that brings a guest straight to the room. */
export function inviteUrl(code: string): string {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('room', code);
  const q = new URLSearchParams(location.search).get('net');
  if (q) u.searchParams.set('net', q);
  return u.toString();
}
export function netError(e: unknown): void {
  console.error(e);
  const b = $('roombadge');
  b.textContent = '⚠ Errore di rete: controlla la connessione';
  b.style.display = 'block';
  $('oerr').textContent = 'Errore di rete: controlla la connessione e riprova.';
}

export function enterRoom(store: RoomStore, code: string, uid: string): void {
  S.net = { store, code, uid, host: false, room: null, stop: () => {}, lobbyOpen: false, qrFor: '' };
  history.replaceState(null, '', inviteUrl(code));
  $('setup').style.display = 'none';
  $('oerr').textContent = '';
  S.net.stop = store.watch(roomPath(code), raw => onRoom(readRoom(raw)));
}

/** Leaves the room on this device only and goes back to the first screen. */
export function exitRoom(why = ''): void {
  if (!S.net) return;
  S.net.stop();
  S.net = null;
  S.gen = null;
  S.saved = null;
  setPending(null);
  const u = new URL(location.href);
  u.searchParams.delete('room');
  history.replaceState(null, '', u.toString());
  drawLobby();
  openSetup();
  $('oerr').textContent = why;
  render();
}

/** The room changed (or was read for the first time). */
export function onRoom(room: Room | null): void {
  if (!S.net) return;
  if (!room) { exitRoom('La stanza è stata chiusa.'); return; }
  if (!room.seats[S.net.uid]) { exitRoom('Non sei più in questa stanza.'); return; }
  S.net.room = room;
  S.net.host = room.host === S.net.uid;
  if (room.status === 'playing' && room.setup) {
    if (!S.saved || S.saved.setup.seed !== room.setup.seed) {
      // A match starts (or this device comes back to one): replay the whole log, without the show.
      clearTable();
      S.net.lobbyOpen = false;
      startGame({ setup: room.setup, choices: room.log.slice() });
    } else if (!S.net.host && room.log.length < S.saved.choices.length) {
      // The host took a choice back (Undo): the match is played again up to the shorter log. Not on
      // the host, who shortens the log itself and may read it before its own last write lands.
      startGame({ setup: room.setup, choices: room.log.slice() });
    } else {
      for (let i = S.saved.choices.length; i < room.log.length; i++) applyChoice(room.log[i]);
    }
    if (S.net.host) referee();
  }
  drawLobby();
}

/** Host: accepts the intents that answer the pending decision, one after the other. */
export function referee(): void {
  while (S.net?.room && S.saved) {
    // A guest asks to take back the choice it just made.
    const back = undoable(S.net.room, S.saved.choices.length, S.saved.lock ?? 0, deciders);
    if (back) { takeBack(back); return; }
    const draft = pending?.kind === 'draft' && g?.draft ? { r: g.draft.round, cards: pending.options.map(o => o.upgrade!) } : undefined;
    const ok = acceptable(S.net.room, S.saved.choices.length, pending && { player: pending.player, options: pending.options.length, ...(draft ? { draft } : {}) });
    if (!ok) return;
    const n = S.saved.choices.length;
    applyChoice(ok.choice);
    void S.net.store.write(roomPath(S.net.code, 'log', String(n)), ok.choice).catch(netError);
  }
}

export function drawLobby(): void {
  const lobby = $('lobby'), badge = $('roombadge');
  if (!S.net?.room) { lobby.style.display = 'none'; badge.style.display = 'none'; return; }
  const n = S.net, r = S.net.room, inGame = r.status === 'playing', open = !inGame || n.lobbyOpen;
  const ids = inGame ? r.order : Object.keys(r.seats).sort((a, b) => r.seats[a].joinedAt - r.seats[b].joinedAt || (a < b ? -1 : 1));
  badge.style.display = 'block';
  badge.textContent = `Stanza ${n.code} · ${ids.length} giocatori${n.host ? ' · sei l’host' : ''}`;
  lobby.style.display = open ? 'grid' : 'none';
  if (!open) return;
  $('lcode').textContent = n.code;
  if (n.qrFor !== n.code) {
    n.qrFor = n.code;
    const link = inviteUrl(n.code);
    ($('llink') as HTMLInputElement).value = link;
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    $('lqr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  // Seats: mine has the crew to pick (before the start); the others are read only.
  const taken = new Set(ids.filter(id => id !== n.uid).map(id => r.seats[id].crew));
  $('lseats').innerHTML = ids.map(id => {
    const s = r.seats[id], mine = id === n.uid;
    const crew = mine && !inGame
      ? `<select id="lcrew">${CAT.crews.map(c => `<option value="${c.id}" ${c.id === s.crew ? 'selected' : ''} ${taken.has(c.id) ? 'disabled' : ''}>${esc(c.name)}</option>`).join('')}</select>`
      : `<small>${esc(CAT.crews.find(c => c.id === s.crew)?.name ?? s.crew)}</small>`;
    return `<div class="seat" style="--c:${crewColor(s.crew)}"><i></i><b>${esc(s.name)}</b>${id === r.host ? '<small>host</small>' : ''}${mine ? '<small>tu</small>' : ''}${crew}</div>`;
  }).join('') + (inGame ? '' : '<div class="seat empty"><i></i><b>posto libero</b></div>'.repeat(Math.max(0, MAX_PLAYERS - ids.length)));
  const crewSel = document.getElementById('lcrew') as HTMLSelectElement | null;
  if (crewSel) crewSel.onchange = () => { void n.store.write(roomPath(n.code, 'seats', n.uid, 'crew'), crewSel.value).catch(netError); };
  // Options: the host's to set before the start.
  const o = r.options;
  if (n.host && !inGame) {
    $('lopts').innerHTML = `<label>Tessera di partenza</label>
      <select id="lside"><option value="a" ${o.startSide === 'a' ? 'selected' : ''}>1a — The Parking Lot</option><option value="b" ${o.startSide === 'b' ? 'selected' : ''}>1b — Runway to Ruin</option></select>
      <label>Espansioni</label>
      <label class="check"><input type="checkbox" id="lleaders" ${o.leaders ? 'checked' : ''}> Choppe Shoppe: capisquadra e segnalini comando</label>
      <label class="check"><input type="checkbox" id="lupgrades" ${o.upgrades ? 'checked' : ''}> Choppe Shoppe: carte potenziamento</label>
      <label class="check"><input type="checkbox" id="lcarnage" ${o.carnage ? 'checked' : ''}> Carnage at Devil’s Run: tessere, pericoli e fuoco</label>`;
    const push = (): void => {
      void n.store.write(roomPath(n.code, 'options'), { startSide: ($('lside') as HTMLSelectElement).value, leaders: ($('lleaders') as HTMLInputElement).checked,
        upgrades: ($('lupgrades') as HTMLInputElement).checked, carnage: ($('lcarnage') as HTMLInputElement).checked }).catch(netError);
    };
    for (const id of ['lside', 'lleaders', 'lupgrades', 'lcarnage']) $(id).onchange = push;
  } else {
    const exp = [o.leaders ? 'capisquadra' : '', o.upgrades ? 'carte potenziamento' : '', o.carnage ? 'Carnage at Devil’s Run' : ''].filter(Boolean).join(', ');
    $('lopts').innerHTML = `<p class="hint">Partenza: tessera 1${o.startSide}. Espansioni: ${exp || 'nessuna'}.</p>`;
  }
  const problem = startProblem(r);
  $('lstate').textContent = inGame ? 'Partita in corso.'
    : !n.host ? 'In attesa che l’host inizi la partita…'
    : problem === 'few' ? 'Servono almeno due giocatori.' : problem === 'crews' ? 'Due giocatori hanno lo stesso colore.' : problem === 'many' ? 'Troppi giocatori: massimo quattro.' : 'Tutto pronto.';
  const show = (id: string, on: boolean): void => { $(id).style.display = on ? '' : 'none'; };
  show('lstart', n.host && !inGame);
  ($('lstart') as HTMLButtonElement).disabled = !!problem;
  show('lresume', inGame);
  show('lrematch', n.host && inGame);
  show('lleave', !n.host);
  show('lclose', n.host);
}

$('lcopy').onclick = () => {
  const link = $('llink') as HTMLInputElement;
  link.select();
  void navigator.clipboard?.writeText(link.value).then(() => { $('lcopy').textContent = 'Copiato!'; setTimeout(() => { $('lcopy').textContent = 'Copia il link'; }, 1500); }).catch(() => {});
};
$('roombadge').onclick = () => { if (S.net) { S.net.lobbyOpen = true; drawLobby(); } };
$('lresume').onclick = () => { if (S.net) { S.net.lobbyOpen = false; drawLobby(); render(); } };
$('lstart').onclick = () => {
  if (!S.net?.room || !S.net.host) return;
  const seed = newSeed();
  if (!seed.ok) { alert('Il browser non fornisce numeri casuali sicuri: impossibile iniziare.'); return; }
  void startMatch(S.net.store, S.net.code, S.net.room, seed.value, crewColor).catch(netError);
};
$('lrematch').onclick = () => {
  if (S.net?.host && confirm('Chiudere questa partita e tornare alla sala d’attesa?')) void backToLobby(S.net.store, S.net.code).catch(netError);
};
$('lclose').onclick = () => {
  if (S.net?.host && confirm('Chiudere la stanza per tutti? La partita in corso va persa.')) void closeRoom(S.net.store, S.net.code).catch(netError);
};
$('lleave').onclick = () => {
  if (!S.net?.room) return;
  // Before the start the seat is freed; during a match it is kept, so the player can come back.
  if (S.net.room.status === 'lobby') void leaveRoom(S.net.store, S.net.code).catch(netError);
  exitRoom();
};

/** The name typed in the create (`oname`) or join (`jname`) pane, remembered for next time. */
export const onlineName = (field: 'oname' | 'jname'): string => {
  const name = ($(field) as HTMLInputElement).value.trim().slice(0, NAME_MAX);
  try { if (name) localStorage.setItem(NAME_KEY, name); } catch { /* storage off */ }
  return name;
};
$('ocreate').onclick = async () => {
  const name = onlineName('oname');
  if (!name) { $('oerr').textContent = 'Scrivi il tuo nome.'; return; }
  $('oerr').textContent = 'Creo la stanza…';
  try {
    const store = await openStore();
    const options = { startSide: ($('oside') as HTMLSelectElement).value as 'a' | 'b', leaders: ($('oleaders') as HTMLInputElement).checked, upgrades: ($('oupgrades') as HTMLInputElement).checked,
      ...(($('ocarnage') as HTMLInputElement).checked ? { carnage: true } : {}) };
    const code = await createRoom(store, { name, crew: CREW_IDS[0] }, options, randomBytes, Date.now());
    enterRoom(store, code, await store.uid());
  } catch (e) { netError(e); }
};
$('ojoin').onclick = async () => {
  const name = onlineName('jname'), code = cleanCode(($('ocode') as HTMLInputElement).value);
  if (!name) { $('oerr').textContent = 'Scrivi il tuo nome.'; return; }
  if (!code) { $('oerr').textContent = 'Il codice ha cinque caratteri.'; return; }
  $('oerr').textContent = 'Entro nella stanza…';
  try {
    const store = await openStore();
    const res = await joinRoom(store, code, { name, crew: freeCrew(null, CREW_IDS) }, CREW_IDS, Date.now());
    if (!res.ok) {
      $('oerr').textContent = { 'not-found': 'Stanza non trovata: controlla il codice.', full: 'La stanza è piena (quattro giocatori).', started: 'La partita è già iniziata.' }[res.error];
      return;
    }
    enterRoom(store, code, await store.uid());
  } catch (e) { netError(e); }
};
($('ocode') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') $('ojoin').click(); });
