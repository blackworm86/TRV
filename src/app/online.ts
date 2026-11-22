// Online games: rooms on a shared store (Firebase, or local for checks), the room's card, the
// host as referee of every move.
// A room on a shared store (src/net/room.ts): the host's browser is the referee. Every device
// replays the room's log of choices on its own copy of the rules; a guest's click becomes an
// intent that the host checks and appends. The room stays open until the host closes it.
// The first screen around the rooms (lobby, one's games, friends) is home.ts.

import type { Team } from '../game/trv/engine';
import { BASE_CATALOG as CAT } from '../game/trv/catalog';
import { newSeed } from '../platform/entropy';
import {
  acceptable, addBot, isBotSeat, removeBot, BOT_LEVELS, undoable, backToLobby, cleanCode, closeRoom, createRoom, freeCrew, joinRoom, leaveRoom, readRoom,
  roomPath, roomSeats, startMatch, startProblem, MINI_KEYS, type RoomOptions, type Room, type RoomStore, type Visibility,
} from '../net/room';
import { miniChecks, miniId, miniNames, readMinis } from './minisetup';
import { forgetGame, lobbyEntry, publishLobby, rememberGame, userPath } from '../net/social';
import { resultOf } from '../net/stats';
import { FIREBASE_CONFIG } from '../net/firebase-config';
import qrcode from 'qrcode-generator';
import { applyChoice, deciders, g, mySeat, pending, setPending, startGame, takeBack } from './game';
import { checkedFriends, drawOnline, friendState, friendsOn, invite, myName, roomFriendsHtml, segValue, socialOn, typedCode } from './home';
import { render } from './pieces';
import { clearTable, openSetup, showPane } from './screens';
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
/**
 * Whether the player has an account (signed in with Google), which friends need. On the local store of
 * the checks (`?net=local`) a player is a guest unless the page says `&account`; on the emulator it has one.
 */
export async function hasAccount(): Promise<boolean> {
  const mode = netMode();
  if (mode === 'local') return new URLSearchParams(location.search).has('account');
  if (mode === 'emulator') return true;
  if (!FIREBASE_CONFIG) return false;
  const { createAdminAuth } = await import('../net/admin-auth');
  const auth = createAdminAuth(FIREBASE_CONFIG);
  return new Promise(resolve => {
    let stop: (() => void) | null = null;
    stop = auth.onUser(u => { if (!u) return; resolve(!u.anonymous); stop?.(); });
  });
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
  if (S.net) S.net.stop();
  S.net = { store, code, uid, host: false, room: null, stop: () => {}, lobbyOpen: false, qrFor: '' };
  history.replaceState(null, '', inviteUrl(code));
  $('setup').style.display = 'none';
  $('oerr').textContent = '';
  // The room goes in the player's list of games, on every device (home.ts).
  if (socialOn()) void rememberGame(store, code, Date.now()).catch(() => {});
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
  drawOnline();
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
      startGame({ setup: room.setup, choices: room.log.slice() }, room.log.length === 0);
    } else if (!S.net.host && room.log.length < S.saved.choices.length) {
      // The host took a choice back (Undo): the match is played again up to the shorter log. Not on
      // the host, who shortens the log itself and may read it before its own last write lands.
      startGame({ setup: room.setup, choices: room.log.slice() });
    } else {
      for (let i = S.saved.choices.length; i < room.log.length; i++) applyChoice(room.log[i]);
    }
    if (S.net.host) referee();
  }
  if (S.net.host) hostDuties();
  recordResult();
  drawLobby();
}

/** The matches this page has already recorded (or tried to), by key. */
const recorded = new Set<string>();
/**
 * At the end of an online match, an account records how it went for its seat in its statistics
 * (src/net/stats.ts, the profile window): once, under the room code and the match's seed (a room
 * can host several matches). A guest has no statistics.
 */
function recordResult(): void {
  const n = S.net, saved = S.saved, seat = mySeat();
  if (!n || !saved || !g || g.winner === null || seat < 0) return;
  const key = `${n.code}-${saved.setup.seed.slice(0, 12)}`;
  if (recorded.has(key)) return;
  recorded.add(key);
  const setup = saved.setup, choices = saved.choices.slice(), store = n.store, uid = n.uid;
  void (async () => {
    if (!await hasAccount()) return;
    const path = userPath(uid, 'results', key);
    if (await store.read(path) !== null) return;
    const result = resultOf(setup, choices, seat, Date.now());
    if (result) await store.write(path, result);
  })().catch(e => console.warn('Statistiche non salvate', e));
}

/** Host: accepts the intents that answer the pending decision, one after the other. */
export function referee(): void {
  while (S.net?.room && S.saved) {
    // A guest asks to take back the choice it just made.
    const back = undoable(S.net.room, S.saved.choices.length, S.saved.lock ?? 0, deciders);
    if (back) { takeBack(back); return; }
    const draft = pending?.kind === 'draft' && g?.draft ? { r: g.draft.round, cards: pending.options.map(o => o.upgrade!) } : undefined;
    const leader = pending?.kind === 'leader' ? pending.options.map(o => o.leader!) : undefined;
    const assign = pending?.kind === 'upgradeAssign' ? pending.options.map(o => ({ card: o.upgrade!, car: o.carId! })) : undefined;
    const ok = acceptable(S.net.room, S.saved.choices.length, pending && { player: pending.player, options: pending.options.length, ...(draft ? { draft } : {}), ...(assign ? { assign } : {}), ...(leader ? { leader } : {}) });
    if (!ok) return;
    const n = S.saved.choices.length;
    applyChoice(ok.choice);
    void S.net.store.write(roomPath(S.net.code, 'log', String(n)), ok.choice).catch(netError);
  }
}

/**
 * Host: keeps what others read of the room up to date without replaying it: its card in the lobby,
 * whose turn it is, when the last move was made and who won (for everybody's list of games).
 */
function hostDuties(): void {
  const n = S.net;
  if (!n?.host || !n.room) return;
  const r = n.room, path = (k: string): string => roomPath(n.code, k);
  if (socialOn()) {
    const card = JSON.stringify(lobbyEntry(n.code, r));
    if (card !== n.posted) { n.posted = card; void publishLobby(n.store, n.code, r).catch(e => console.warn(e)); }
  }
  if (r.status !== 'playing' || !S.saved) return;
  const who = pending ? r.order[pending.player] : undefined;
  const turn = who && !isBotSeat(r, who) && g?.winner === null ? who : null;
  const winner = g && g.winner !== null ? r.setup?.players[g.winner]?.name ?? null : null;
  if (turn !== r.turn) void n.store.write(path('turn'), turn).catch(netError);
  if (winner !== r.ended) void n.store.write(path('ended'), winner).catch(netError);
  if (n.logLen !== undefined && r.log.length !== n.logLen && r.log.length) void n.store.write(path('moveAt'), Date.now()).catch(netError);
  n.logLen = r.log.length;
}

/** The levels of the Basic Protocol, as the hot seat setup names them (index.html, #botlevel). */
const BOT_LEVEL_TEXT: Record<number, string> = Object.fromEntries([...document.querySelectorAll<HTMLOptionElement>('#botlevel option')].map(o => [Number(o.value), o.textContent ?? o.value]));
$('obotlevel').innerHTML = BOT_LEVELS.map(l => `<option value="${l}">${esc(BOT_LEVEL_TEXT[l])}</option>`).join('');

const VIS_TEXT: Record<Visibility, string> = { public: 'Tutti (in lobby)', friends: 'Solo amici', invite: 'Solo su invito' };

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
  $('lvis').textContent = { public: 'pubblica in lobby', friends: 'in lobby per gli amici', invite: 'solo su invito' }[r.options.vis ?? 'invite'];
  if (n.qrFor !== n.code) {
    n.qrFor = n.code;
    const link = inviteUrl(n.code);
    ($('llink') as HTMLInputElement).value = link;
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    $('lqr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  // Seats: mine has the crew to pick (before the start), and the host picks the TRV9000 teams'
  // ones too and can take them off; the others are read only. A free seat lets the host add a
  // TRV9000 team (asked by the user, 2026-11-18: bots in online games too). Next to another
  // person, "+ amico" asks them to be friends.
  const bots = ids.filter(id => isBotSeat(r, id));
  const teamsOn = r.options.teams !== false;
  $('lseats').innerHTML = ids.map((id, i) => {
    const s = r.seats[id], mine = id === n.uid, bot = isBotSeat(r, id), mayPick = !inGame && (mine || (bot && n.host));
    const taken = new Set(ids.filter(x => x !== id).map(x => r.seats[x].crew));
    const crew = mayPick
      ? `<select class="lcrew" data-seat="${esc(id)}">${CAT.crews.map(c => `<option value="${c.id}" ${c.id === s.crew ? 'selected' : ''} ${taken.has(c.id) ? 'disabled' : ''}>${esc(c.name)}</option>`).join('')}</select>`
      : `<small>${esc(CAT.crews.find(c => c.id === s.crew)?.name ?? s.crew)}</small>`;
    // The crew is three cars, the Final Five or the Big Rig (BRaFF p3): one of each per match.
    const others = new Set(ids.filter(x => x !== id).map(x => r.seats[x].team));
    const team = bot || !teamsOn ? '' : mine && !inGame
      ? `<select class="lteam" data-seat="${esc(id)}">${[['', 'Auto'], ['final_five', 'Final Five (moto)'], ['big_rig', 'Big Rig']].map(([v, l]) => `<option value="${v}" ${(s.team ?? '') === v ? 'selected' : ''} ${v && others.has(v as Team) ? 'disabled' : ''}>${l}</option>`).join('')}</select>`
      : s.team ? `<small>${s.team === 'big_rig' ? 'Big Rig' : 'Final Five'}</small>` : '';
    const tag = bot ? `<small class="bottag">TRV9000 · livello ${r.options.botLevel ?? 1}</small>` : '';
    const drop = bot && n.host && !inGame ? `<button class="ldrop" data-seat="${esc(id)}" title="Togli questa squadra TRV9000">✕</button>` : '';
    const fs = !bot && !mine && friendsOn() ? friendState(id) : 'friend';
    const befriend = fs === 'none' ? `<button class="lfriend" data-uid="${esc(id)}" title="Chiedi di diventare amici">+ amico</button>` : fs === 'asked' ? '<small>richiesta mandata</small>' : '';
    return `<div class="seat ${bot ? 'bot' : ''}" style="--c:${crewColor(s.crew)}" data-i="${i}"><i></i><b>${esc(s.name)}</b>${id === r.host ? '<small>host</small>' : ''}${mine ? '<small>tu</small>' : ''}${tag}${befriend}${crew}${team}${drop}</div>`;
  }).join('') + (inGame ? '' : Array.from({ length: Math.max(0, roomSeats(r.options) - ids.length) }, () =>
    `<div class="seat empty"><i></i><b>posto libero</b>${n.host ? '<button class="laddbot" title="Una squadra giocata dalle carte TRV9000">+ TRV9000</button>' : ''}</div>`).join(''));
  for (const sel of $('lseats').querySelectorAll<HTMLSelectElement>('select.lcrew')) {
    sel.onchange = () => { void n.store.write(roomPath(n.code, 'seats', sel.dataset.seat!, 'crew'), sel.value).catch(netError); };
  }
  for (const sel of $('lseats').querySelectorAll<HTMLSelectElement>('select.lteam')) {
    sel.onchange = () => { void n.store.write(roomPath(n.code, 'seats', sel.dataset.seat!, 'team'), sel.value || null).catch(netError); };
  }
  for (const b of $('lseats').querySelectorAll<HTMLButtonElement>('button.ldrop')) b.onclick = () => { void removeBot(n.store, n.code, b.dataset.seat!).catch(netError); };
  for (const b of $('lseats').querySelectorAll<HTMLButtonElement>('button.laddbot')) b.onclick = () => { void addBot(n.store, n.code, r, CREW_IDS, Date.now()).catch(netError); };
  // Options: the host's to set before the start.
  const o = r.options;
  if (n.host && !inGame) {
    $('lopts').innerHTML = `<label>Chi può entrare</label>
      <select id="lvissel">${(['public', 'friends', 'invite'] as Visibility[]).map(v => `<option value="${v}" ${(o.vis ?? 'invite') === v ? 'selected' : ''}>${VIS_TEXT[v]}</option>`).join('')}</select>
      <select id="lmax" title="Posti nella stanza">${[2, 3, 4].map(k => `<option value="${k}" ${roomSeats(o) === k ? 'selected' : ''} ${k < ids.length ? 'disabled' : ''}>${k} posti</option>`).join('')}</select>
      <label>Tessera di partenza</label>
      <select id="lside"><option value="a" ${o.startSide === 'a' ? 'selected' : ''}>1a — The Parking Lot</option><option value="b" ${o.startSide === 'b' ? 'selected' : ''}>1b — Runway to Ruin</option></select>
      <label>Espansioni</label>
      <label class="check"><input type="checkbox" id="lleaders" ${o.leaders ? 'checked' : ''}> Choppe Shoppe: capisquadra e segnalini comando</label>
      <label class="check"><input type="checkbox" id="lupgrades" ${o.upgrades ? 'checked' : ''}> Choppe Shoppe: carte potenziamento</label>
      <label class="check"><input type="checkbox" id="lcarnage" ${o.carnage ? 'checked' : ''}> Carnage at Devil’s Run: tessere, pericoli e fuoco</label>
      <label class="check"><input type="checkbox" id="lteams" ${teamsOn ? 'checked' : ''}> The Big Rig and The Final Five</label>
      <label>Mini espansioni</label>
      ${miniChecks('l', o)}
      <label ${bots.length ? '' : 'style="display:none"'}>Livello dei TRV9000</label>
      <select id="lbotlevel" ${bots.length ? '' : 'style="display:none"'}>${BOT_LEVELS.map(l => `<option value="${l}" ${(o.botLevel ?? 1) === l ? 'selected' : ''}>${BOT_LEVEL_TEXT[l]}</option>`).join('')}</select>`;
    const push = (): void => {
      const next: RoomOptions = { startSide: ($('lside') as HTMLSelectElement).value as 'a' | 'b', leaders: ($('lleaders') as HTMLInputElement).checked,
        upgrades: ($('lupgrades') as HTMLInputElement).checked, carnage: ($('lcarnage') as HTMLInputElement).checked,
        botLevel: Number(($('lbotlevel') as HTMLSelectElement).value), vis: ($('lvissel') as HTMLSelectElement).value as Visibility,
        maxPlayers: Number(($('lmax') as HTMLSelectElement).value), teams: ($('lteams') as HTMLInputElement).checked,
        ...readMinis('l') };
      void n.store.write(roomPath(n.code, 'options'), next).catch(netError);
    };
    for (const id of ['lside', 'lleaders', 'lupgrades', 'lcarnage', 'lbotlevel', 'lvissel', 'lmax', 'lteams', ...MINI_KEYS.map(k => miniId('l', k))]) $(id).onchange = push;
  } else {
    const exp = [o.leaders ? 'capisquadra' : '', o.upgrades ? 'carte potenziamento' : '', o.carnage ? 'Carnage at Devil’s Run' : '', teamsOn ? 'Big Rig e Final Five' : '', ...miniNames(o)].filter(Boolean).join(', ');
    $('lopts').innerHTML = `<p class="hint">Partenza: tessera 1${o.startSide}. Espansioni: ${exp || 'nessuna'}.${bots.length ? ` TRV9000: livello ${o.botLevel ?? 1}.` : ''}</p>`;
  }
  $('lfriends').innerHTML = friendsOn() && !inGame ? roomFriendsHtml(n.code, ids) : '';
  const problem = startProblem(r);
  $('lstate').textContent = inGame ? 'Partita in corso.'
    : !n.host ? 'In attesa che l’host inizi la partita…'
    : problem === 'few' ? 'Servono almeno due giocatori (anche un TRV9000).' : problem === 'crews' ? 'Due giocatori hanno lo stesso colore.' : problem === 'many' ? 'Troppi giocatori: massimo quattro.'
    : problem === 'bots' ? 'Serve almeno una persona.' : problem === 'teams' ? 'Final Five e Big Rig: uno solo per partita.' : 'Tutto pronto.';
  const show = (id: string, on: boolean): void => { $(id).style.display = on ? '' : 'none'; };
  show('lstart', n.host && !inGame);
  ($('lstart') as HTMLButtonElement).disabled = !!problem;
  show('lresume', inGame);
  show('lrematch', n.host && inGame);
  show('lleave', !n.host || inGame);
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
  const n = S.net;
  if (!n?.host || !confirm('Chiudere la stanza per tutti? La partita in corso va persa.')) return;
  void (async () => {
    if (socialOn()) { await publishLobby(n.store, n.code, null).catch(() => {}); await forgetGame(n.store, n.code).catch(() => {}); }
    await closeRoom(n.store, n.code);
  })().catch(netError);
};
$('lleave').onclick = () => {
  const n = S.net;
  if (!n?.room) return;
  // Before the start the seat is freed (and the room leaves the list of one's games); during a
  // match it is kept, so the player can come back from "Le mie partite".
  if (n.room.status === 'lobby') {
    void leaveRoom(n.store, n.code).catch(netError);
    if (socialOn()) void forgetGame(n.store, n.code).catch(() => {});
  }
  exitRoom();
};

/** The player's name for a room, or null after asking for it (the header's field). */
function nameOrAsk(): string | null {
  const name = myName();
  if (name) {
    // What was typed is kept; an account's user name, used when the field is blank, is not.
    try { localStorage.setItem(NAME_KEY, ($('myname') as HTMLInputElement).value.trim()); } catch { /* storage off */ }
    return name;
  }
  $('oerr').textContent = 'Scrivi il tuo nome in alto: è quello che vedono gli altri.';
  ($('myname') as HTMLInputElement).focus();
  return null;
}

/** Sits this player in room `code` (or back in it) and opens it. */
export async function joinByCode(code: string): Promise<void> {
  const name = nameOrAsk();
  if (!name) return;
  if (!code) { $('oerr').textContent = 'Il codice ha cinque caratteri.'; return; }
  $('oerr').textContent = 'Entro nella stanza…';
  try {
    const store = await openStore();
    const res = await joinRoom(store, code, { name, crew: freeCrew(null, CREW_IDS) }, CREW_IDS, Date.now());
    if (!res.ok) {
      $('oerr').textContent = { 'not-found': 'Stanza non trovata: controlla il codice.', full: 'La stanza è piena.', started: 'La partita è già iniziata.' }[res.error];
      return;
    }
    enterRoom(store, code, await store.uid());
  } catch (e) { netError(e); }
}

$('ocreate').onclick = async () => {
  const name = nameOrAsk();
  if (!name) return;
  $('oerr').textContent = 'Creo la stanza…';
  try {
    const store = await openStore();
    const bots = Number(($('obots') as HTMLSelectElement).value), max = Number(segValue('omax')) || 4;
    const options: RoomOptions = { startSide: ($('oside') as HTMLSelectElement).value as 'a' | 'b', leaders: ($('oleaders') as HTMLInputElement).checked, upgrades: ($('oupgrades') as HTMLInputElement).checked,
      ...(($('ocarnage') as HTMLInputElement).checked ? { carnage: true } : {}), vis: (segValue('ovis') || 'public') as Visibility, maxPlayers: max,
      teams: ($('oteams') as HTMLInputElement).checked, ...readMinis('o'), ...(bots ? { botLevel: Number(($('obotlevel') as HTMLSelectElement).value) } : {}) };
    const code = await createRoom(store, { name, crew: CREW_IDS[0] }, options, randomBytes, Date.now());
    for (let i = 0; i < Math.min(bots, max - 1); i++) {
      const room = readRoom(await store.read(roomPath(code)));
      if (room) await addBot(store, code, room, CREW_IDS, Date.now() + i + 1);
    }
    for (const uid of checkedFriends()) await invite(uid, code).catch(e => console.warn(e));
    enterRoom(store, code, await store.uid());
  } catch (e) { netError(e); }
};
$('ojoin').onclick = () => { void joinByCode(typedCode()); };
($('ocode') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') $('ojoin').click(); });
$('jjoin').onclick = () => { void joinByCode(cleanCode(new URLSearchParams(location.search).get('room') ?? '')); };

/** Opens the pane for an invitation link to room `code`. */
export function showInvite(code: string): void {
  showPane('pJoin');
  $('joinhint').textContent = `Sei stato invitato nella stanza ${code}.`;
}
