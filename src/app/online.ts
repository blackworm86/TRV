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
  roomPath, roomSeats, startMatch, startProblem, isReady, setReady, clearReady, MINI_KEYS, type RoomOptions, type Room, type RoomStore, type Visibility,
} from '../net/room';
import { miniSwitches, miniId, readMinis } from './minisetup';
import { HEARTBEAT_MS, forgetGame, lobbyEntry, publishLobby, rememberGame, takeOverHost, userPath } from '../net/social';
import { resultOf } from '../net/stats';
import { FIREBASE_CONFIG } from '../net/firebase-config';
import qrcode from 'qrcode-generator';
import { applyChoice, deciders, g, mySeat, pending, setPending, startGame, takeBack } from './game';
import { drawOnline, friendState, friendsOn, invite, myName, roomFriendsHtml, socialOn, typedCode } from './home';
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
  const unwatch = store.watch(roomPath(code), raw => onRoom(readRoom(raw)));
  // A guest looks every heartbeat whether the host is still in the room; if not, the first player
  // there takes over, so the match goes on (asked by the user, 2026-11-22).
  const look = window.setInterval(() => {
    const n = S.net;
    if (!n || n.host || !n.room || !socialOn()) return;
    void takeOverHost(n.store, n.code, n.room, Date.now())
      .then(took => { if (took && S.net) { S.net.tookOver = true; drawLobby(); } })
      .catch(e => console.warn('Subentro all’host non riuscito', e));
  }, HEARTBEAT_MS);
  S.net.stop = () => { unwatch(); clearInterval(look); };
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

const VIS_TEXT: Record<Visibility, string> = { public: 'Tutti (in lobby)', friends: 'Solo amici', invite: 'Solo su invito' };

export function drawLobby(): void {
  const lobby = $('lobby'), badge = $('roombadge');
  if (!S.net?.room) { lobby.style.display = 'none'; badge.style.display = 'none'; return; }
  const n = S.net, r = S.net.room, inGame = r.status === 'playing', open = !inGame || n.lobbyOpen;
  const ids = inGame ? r.order : Object.keys(r.seats).sort((a, b) => r.seats[a].joinedAt - r.seats[b].joinedAt || (a < b ? -1 : 1));
  badge.style.display = 'block';
  badge.textContent = `Stanza ${n.code} · ${ids.length} giocatori${n.host ? n.tookOver ? ' · l’host è uscito: ora sei tu l’host' : ' · sei l’host' : ''}`;
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
    const s = r.seats[id], mine = id === n.uid, bot = isBotSeat(r, id), ready = isReady(r, id);
    const mayPick = !inGame && ((mine && !(s.ready && !n.host)) || (bot && n.host));
    const taken = new Set(ids.filter(x => x !== id).map(x => r.seats[x].crew));
    const crew = mayPick
      ? `<select class="lcrew" data-seat="${esc(id)}">${CAT.crews.map(c => `<option value="${c.id}" ${c.id === s.crew ? 'selected' : ''} ${taken.has(c.id) ? 'disabled' : ''}>${esc(c.name)}</option>`).join('')}</select>`
      : `<small>${esc(CAT.crews.find(c => c.id === s.crew)?.name ?? s.crew)}</small>`;
    // The crew is three cars, the Final Five or the Big Rig (BRaFF p3): one of each per match.
    const others = new Set(ids.filter(x => x !== id).map(x => r.seats[x].team));
    const team = bot || !teamsOn ? '' : mine && !inGame && !s.ready
      ? `<select class="lteam" data-seat="${esc(id)}">${[['', 'Auto'], ['final_five', 'Final Five (moto)'], ['big_rig', 'Big Rig']].map(([v, l]) => `<option value="${v}" ${(s.team ?? '') === v ? 'selected' : ''} ${v && others.has(v as Team) ? 'disabled' : ''}>${l}</option>`).join('')}</select>`
      : s.team ? `<small>${s.team === 'big_rig' ? 'Big Rig' : 'Final Five'}</small>` : '';
    const tag = bot ? `<small class="bottag">TRV9000 · livello ${r.options.botLevel ?? 1}</small>` : '';
    const drop = bot && n.host && !inGame ? `<button class="ldrop" data-seat="${esc(id)}" title="Togli questa squadra TRV9000">✕</button>` : '';
    const fs = !bot && !mine && friendsOn() ? friendState(id) : 'friend';
    const befriend = fs === 'none' ? `<button class="lfriend" data-uid="${esc(id)}" title="Chiedi di diventare amici">+ amico</button>` : fs === 'asked' ? '<small>richiesta mandata</small>' : '';
    // Every guest confirms being ready (asked by the user, 2026-11-22); the host does by starting.
    const state = inGame || bot || id === r.host ? '' : `<small class="lrdy ${ready ? 'on' : ''}">${ready ? '✓ pronto' : 'non ancora pronto'}</small>`;
    return `<div class="seat ${bot ? 'bot' : ''}" style="--c:${crewColor(s.crew)}" data-i="${i}"><i></i><b>${esc(s.name)}</b>${id === r.host ? '<small>host</small>' : ''}${mine ? '<small>tu</small>' : ''}${tag}${state}${befriend}${crew}${team}${drop}</div>`;
  }).join('') + (inGame ? '' : Array.from({ length: Math.max(0, roomSeats(r.options) - ids.length) }, () =>
    `<div class="seat empty"><i></i><b>posto libero</b>${n.host ? '<button class="laddbot" title="Una squadra giocata dalle carte TRV9000">+ TRV9000</button>' : ''}</div>`).join(''));
  for (const sel of $('lseats').querySelectorAll<HTMLSelectElement>('select.lcrew')) {
    sel.onchange = () => { void n.store.write(roomPath(n.code, 'seats', sel.dataset.seat!, 'crew'), sel.value).catch(netError); };
  }
  for (const sel of $('lseats').querySelectorAll<HTMLSelectElement>('select.lteam')) {
    sel.onchange = () => { void n.store.write(roomPath(n.code, 'seats', sel.dataset.seat!, 'team'), sel.value || null).catch(netError); };
  }
  for (const b of $('lseats').querySelectorAll<HTMLButtonElement>('button.ldrop')) b.onclick = () => { void removeBot(n.store, n.code, b.dataset.seat!).then(() => clearReady(n.store, n.code, r)).catch(netError); };
  for (const b of $('lseats').querySelectorAll<HTMLButtonElement>('button.laddbot')) b.onclick = () => { void addBot(n.store, n.code, r, CREW_IDS, Date.now()).then(() => clearReady(n.store, n.code, r)).catch(netError); };
  // Options, laid out as in the setup screens (asked by the user, 2026-11-22): the host sets them
  // before the start; the others see them, locked.
  const o = r.options, edit = n.host && !inGame, lock = edit ? '' : 'disabled';
  const seg = (id: string, items: [string, string, boolean?][], on: string): string =>
    `<div class="seg" id="${id}">${items.map(([v, l, off]) => `<button type="button" data-v="${v}" class="${v === on ? 'on' : ''}" ${!edit || off ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>`;
  $('lmaxbox').innerHTML = `<span class="lbl">Posti</span>${seg('lmaxseg', [2, 3, 4].map(k => [String(k), String(k), k < ids.length]), String(roomSeats(o)))}`;
  $('lvisrow').innerHTML = `<div class="hh orow"><span class="lbl">Chi può entrare</span><span class="sp"></span>${seg('lvisseg', (['public', 'invite', 'friends'] as Visibility[]).map(v => [v, VIS_TEXT[v]]), o.vis ?? 'invite')}</div>`;
  const sw = (id: string, on: boolean | undefined, name: string, line: string): string =>
    `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${lock}><span><b>${name}</b><small>${line}</small></span></label>`;
  const level = o.botLevel ?? 1;
  $('lopts').innerHTML = `<h3>Tessera di partenza</h3>
    <div class="sides" id="lsideseg">${([['a', 'The Parking Lot'], ['b', 'Runway to Ruin']] as const).map(([v, l]) =>
      `<button type="button" data-v="${v}" class="${o.startSide === v ? 'on' : ''}" ${lock}><b>1${v}</b><span>${l}</span></button>`).join('')}</div>
    <h3>Espansioni</h3>
    ${sw('lleaders', o.leaders, 'Capisquadra', 'Choppe Shoppe · capisquadra e segnalini comando')}
    ${sw('lupgrades', o.upgrades, 'Potenziamenti', 'Choppe Shoppe · carte potenziamento')}
    ${sw('lcarnage', o.carnage, 'Carnage at Devil’s Run', 'Tessere, pericoli e fuoco')}
    ${sw('lteams', teamsOn, 'The Big Rig and The Final Five', 'Ognuno sceglie la sua squadra')}
    ${bots.length ? `<div class="hh orow"><span class="lbl">Difficoltà TRV9000 <small>(Basic Protocol)</small></span><span class="sp"></span>${seg('lbotlvseg', BOT_LEVELS.map(l => [String(l), String(l)]), String(level))}</div>
      <p class="hint">${esc(BOT_LEVEL_TEXT[level].replace(/^\d+\s*—\s*/, `Livello ${level}: `))}</p>` : ''}`;
  $('lminis').innerHTML = `<h3>Mini espansioni${edit ? ' <small class="allnone"><a href="#" data-lminis="1">tutte</a> · <a href="#" data-lminis="0">nessuna</a></small>' : ''}</h3>
    ${miniSwitches('l', o, !edit)}<p class="hint">I TRV9000 non ricevono carte; le Road Conditions valgono per tutti.</p>`;
  if (edit) {
    // Any change asks the guests to confirm again.
    const chk = (id: string): boolean => ($(id) as HTMLInputElement).checked;
    const push = (patch: Partial<RoomOptions> = {}): void => {
      const next: RoomOptions = { startSide: o.startSide, leaders: chk('lleaders'), upgrades: chk('lupgrades'), carnage: chk('lcarnage'),
        botLevel: level, vis: o.vis ?? 'invite', maxPlayers: roomSeats(o), teams: chk('lteams'), ...readMinis('l'), ...patch };
      saveRoomOptions(next);
      void n.store.write(roomPath(n.code, 'options'), next).then(() => clearReady(n.store, n.code, r)).catch(netError);
    };
    const pick = (id: string, set: (v: string) => Partial<RoomOptions>): void => {
      $(id).onclick = e => { const b = (e.target as Element).closest<HTMLButtonElement>('[data-v]'); if (b && !b.disabled) push(set(b.dataset.v!)); };
    };
    pick('lmaxseg', v => ({ maxPlayers: Number(v) }));
    pick('lvisseg', v => ({ vis: v as Visibility }));
    pick('lsideseg', v => ({ startSide: v as 'a' | 'b' }));
    if (bots.length) pick('lbotlvseg', v => ({ botLevel: Number(v) }));
    for (const id of ['lleaders', 'lupgrades', 'lcarnage', 'lteams', ...MINI_KEYS.map(k => miniId('l', k))]) $(id).onchange = () => push();
    for (const a of $('lminis').querySelectorAll<HTMLElement>('[data-lminis]')) a.onclick = e => {
      e.preventDefault();
      for (const i of $('lminis').querySelectorAll<HTMLInputElement>('input')) i.checked = a.dataset.lminis === '1';
      push();
    };
  }
  $('lfriends').innerHTML = friendsOn() && !inGame ? roomFriendsHtml(n.code, ids) : '';
  const problem = startProblem(r);
  const meReady = !!r.seats[n.uid]?.ready, waiting = ids.filter(id => !isReady(r, id)).length;
  $('lstate').textContent = inGame ? 'Partita in corso.'
    : !n.host ? (meReady ? 'Sei pronto: in attesa che l’host inizi la partita…' : 'Scegli colore e squadra, poi premi «Sono pronto».')
    : problem === 'ready' ? (waiting === 1 ? 'In attesa che un giocatore sia pronto.' : `In attesa che ${waiting} giocatori siano pronti.`)
    : problem === 'few' ? 'Servono almeno due giocatori (anche un TRV9000).' : problem === 'crews' ? 'Due giocatori hanno lo stesso colore.' : problem === 'many' ? 'Troppi giocatori: massimo quattro.'
    : problem === 'bots' ? 'Serve almeno una persona.' : problem === 'teams' ? 'Final Five e Big Rig: uno solo per partita.' : 'Tutto pronto.';
  const show = (id: string, on: boolean): void => { $(id).style.display = on ? '' : 'none'; };
  show('lstart', n.host && !inGame);
  show('lready', !n.host && !inGame);
  $('lready').textContent = meReady ? 'Non sono più pronto' : 'Sono pronto';
  $('lready').classList.toggle('on', meReady);
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
$('lready').onclick = () => {
  if (!S.net?.room || S.net.host) return;
  void setReady(S.net.store, S.net.code, !S.net.room.seats[S.net.uid]?.ready).catch(netError);
};
$('lrematch').onclick = () => {
  if (S.net?.host && confirm('Chiudere questa partita e tornare alla sala d’attesa?')) void backToLobby(S.net.store, S.net.code, S.net.room ?? undefined).catch(netError);
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

/** Where the options of the last room made are kept: a new room starts from them (asked by the user, 2026-11-22). */
const LAST_ROOM = 'trv-room-last';
/** The options a new room starts from: the last ones set, else public, four seats, nothing added. */
function lastRoomOptions(): RoomOptions {
  const base: RoomOptions = { startSide: 'a', leaders: false, upgrades: false, vis: 'public', maxPlayers: 4, teams: false };
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_ROOM) ?? 'null') as unknown;
    // Read as a room would read it, so a stored value never makes a room the rules refuse.
    const o = raw ? readRoom({ host: '-', options: raw })?.options : null;
    return o ? { ...base, ...o } : base;
  } catch { return base; }
}
/** Keeps `o` as the options of the next room. */
function saveRoomOptions(o: RoomOptions): void {
  try { localStorage.setItem(LAST_ROOM, JSON.stringify(o)); } catch { /* storage off: nothing remembered */ }
}

/** Makes a room at once with the last options, inviting `friends`, and opens its waiting room, where everything is set. */
async function createRoomNow(friends: string[] = []): Promise<void> {
  const name = nameOrAsk();
  if (!name) return;
  $('oerr').textContent = 'Creo la stanza…';
  try {
    const store = await openStore();
    const code = await createRoom(store, { name, crew: CREW_IDS[0] }, lastRoomOptions(), randomBytes, Date.now());
    for (const uid of friends) await invite(uid, code).catch(e => console.warn(e));
    enterRoom(store, code, await store.uid());
  } catch (e) { netError(e); }
}
$('mCreate').onclick = () => { void createRoomNow(); };
document.addEventListener('trv:create', e => { void createRoomNow((e as CustomEvent<string[]>).detail ?? []); });
$('ojoin').onclick = () => { void joinByCode(typedCode()); };
// The home's code field: straight into a room, without the lobby (asked by the user, 2026-11-22).
$('hjoin').onclick = () => { void joinByCode(typedCode('hcode')); };
($('hcode') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') $('hjoin').click(); });
($('ocode') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') $('ojoin').click(); });
$('jjoin').onclick = () => { void joinByCode(cleanCode(new URLSearchParams(location.search).get('room') ?? '')); };

/** Opens the pane for an invitation link to room `code`. */
export function showInvite(code: string): void {
  showPane('pJoin');
  $('joinhint').textContent = `Sei stato invitato nella stanza ${code}.`;
}
