// The first screen's online side (design/ux/menu-lobby/mockup.html, approved 2026-11-18): the
// player's card, the home lists, the lobby, one's games, friends and invitations. The rooms
// themselves (create, join, the room's card) are online.ts; the data is src/net/social.ts.

import { NAME_MAX, cleanCode, closeRoom, readRoom, roomPath, type RoomStore } from '../net/room';
import {
  HEARTBEAT_MS, acceptFriend, addFriend, claimUsername, cleanFriendCode, cleanUsername, declineFriend, earlierName, dropInvite, ensureProfile, forgetGame, gameRow, heartbeat, inviteFriend, isOnline,
  lobbyPath, mutualFriends, publishLobby, readLobby, readPresence, readProfile, readProfiles, readSocial, removeFriend, showFriendCode, userPath,
  type GameRow, type LobbyEntry, type Presence, type Profile,
} from '../net/social';
import { NAME_KEY, crewColor, hasAccount, joinByCode, netError, openStore, randomBytes } from './online';
import { showPane, type Pane } from './screens';
import { S } from './state';
import { avatarHtml, paintAvatar } from './avatars';
import { $, esc, sure } from './util';

/** What the first screen knows of the player's online side. */
export const H = {
  store: null as RoomStore | null,
  uid: '',
  social: readSocial(null),
  /** Friends who count this player as a friend too. */
  mutual: new Set<string>(),
  presence: {} as Record<string, Presence | null>,
  /** The current profiles of friends and of who asks to be one: their shown names and user names now. */
  profiles: {} as Record<string, Profile | null>,
  /** One's games, by room code (null: the room is gone). */
  rows: {} as Record<string, GameRow | null>,
  lobbyRaw: null as unknown,
  lobbyFilter: 'all',
  mineTab: 'playing' as 'playing' | 'waiting' | 'ended',
  /** Friends invited from this page, as `room/uid`. */
  invited: new Set<string>(),
  /** The social side could not be written (database rules not published yet): the rooms still work. */
  broken: false,
  /** Online play is off on this page (no Firebase project). */
  off: false,
  /** Signed in with an account (Google): only then friends (asked by the user, 2026-11-20). */
  account: false,
  /** An account still without a user name: it chooses one before it has friends. */
  needUser: false,
};

/** What an online list says while it has nothing to show because the store is not there (yet). */
const noStore = (): string => H.off ? 'Il gioco online non è attivo qui.' : 'Collegamento in corso…';

const roomWatch = new Map<string, () => void>();

/**
 * The name the player goes by online: the header's field (its shown name, remembered on this
 * browser), or with an account and the field blank, its user name. '' only for a guest who wrote none.
 */
export function myName(): string {
  return ($('myname') as HTMLInputElement).value.trim().slice(0, NAME_MAX) || H.social.profile?.user || '';
}

/** "4 min fa", "2 ore fa", "ieri"... for a time in ms since the epoch. */
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return 'adesso';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${Math.floor(s / 3600) === 1 ? 'ora' : 'ore'} fa`;
  return s < 172800 ? 'ieri' : `${Math.floor(s / 86400)} giorni fa`;
}

/** A player's round picture in the lists: its chosen avatar (profile window), else its initial. */
const avatar = (name: string, uid?: string): string => avatarHtml(name, uid ? H.profiles[uid]?.avatar : null);
const dots = (crews: string[], seats: number): string => `<span class="dots">${crews.map(c => `<i style="--c:${crewColor(c)}"></i>`).join('')}${'<i class="e"></i>'.repeat(Math.max(0, seats - crews.length))}</span>`;
const expTags = (e: { leaders: boolean; upgrades: boolean; carnage: boolean; teams: boolean }): string => {
  const t = [e.leaders || e.upgrades ? 'CHOPPE' : '', e.carnage ? 'CARNAGE' : '', e.teams ? 'BIG RIG' : ''].filter(Boolean);
  return t.length ? `<span class="exp">${t.map(x => `<span>${x}</span>`).join('')}</span>` : '<small>solo base</small>';
};

/** Shows the player's card in the header: initial, name, user name and friend code. */
function drawMe(): void {
  const p = H.social.profile, name = myName();
  paintAvatar($('meav'), name, p?.avatar);
  $('mecode').textContent = p ? `@${p.user} · ${showFriendCode(p.code)}` : H.needUser ? 'scegli il nome utente' : H.store && !H.account ? 'ospite' : H.store ? '' : 'solo in locale';
  $('fcode').textContent = p ? showFriendCode(p.code) : '—';
  const field = $('myname') as HTMLInputElement;
  field.placeholder = p ? p.user : 'Il tuo nome';
  field.title = p ? 'Il nome visualizzato dagli altri giocatori: lo cambi quando vuoi' : 'Il nome con cui ti vedono gli altri giocatori';
}

/** How `uid` is called now: its profile's shown name, else the name kept when it was written down. */
const nameOf = (uid: string, kept: string): string => H.profiles[uid]?.name || kept;
/** `@user · ` before a row's note, when the player has a user name. */
const at = (uid: string): string => H.profiles[uid] ? `@${esc(H.profiles[uid]!.user)} · ` : '';

/** The friends who count this player back, online first. */
function friends(): { uid: string; name: string; online: boolean; room?: string }[] {
  const now = Date.now();
  return Object.entries(H.social.friends).filter(([uid]) => H.mutual.has(uid))
    .map(([uid, f]) => ({ uid, name: nameOf(uid, f.name), online: isOnline(H.presence[uid], now), ...(H.presence[uid]?.room ? { room: H.presence[uid]!.room } : {}) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
}

/** Whether `uid` is a friend, has been asked, or neither: for the "+ amico" button in a room. */
export function friendState(uid: string): 'friend' | 'asked' | 'none' {
  if (H.mutual.has(uid)) return 'friend';
  return H.social.friends[uid] ? 'asked' : 'none';
}

/** Whether the social side (lobby, one's games) is usable on this page. */
export const socialOn = (): boolean => !!H.store && !H.broken;
/** Whether this player can have friends: an account with its user name chosen. */
export const friendsOn = (): boolean => socialOn() && H.account && !!H.social.profile;
/** What a friends' list says when friends are not for this player (yet). */
const noFriends = (): string => !H.account ? 'Per avere amici accedi con Google.' : 'Scegli il tuo nome utente per avere amici.';

/** Asks the player seated as `uid` to be friends (from a room, where only the uid is known). */
export async function befriend(uid: string): Promise<void> {
  if (!H.store) return;
  const p = readProfile(await H.store.read(userPath(uid, 'profile')));
  if (!p) return;
  await addFriend(H.store, p.code, myName(), Date.now());
  await refresh();
}

/** Invites friend `uid` into room `code`. */
export async function invite(uid: string, code: string): Promise<void> {
  if (!H.store) return;
  await inviteFriend(H.store, uid, code, myName(), Date.now());
  H.invited.add(`${code}/${uid}`);
}

/** The friends' rows of a room's card, with an invite button for those not seated. */
export function roomFriendsHtml(code: string, seated: string[]): string {
  return friends().filter(f => !seated.includes(f.uid)).map(f => {
    const sent = H.invited.has(`${code}/${f.uid}`);
    return `<div class="prow">${avatar(f.name, f.uid)}<span class="t"><b>${esc(f.name)}</b><small>${at(f.uid)}${f.online ? 'online' : 'non in linea'}</small></span>${sent ? '<small>invitato</small>' : `<button class="tool linv" data-uid="${esc(f.uid)}">Invita</button>`}</div>`;
  }).join('');
}

/** The rows of the home's "your games": where it is your turn first, then waiting rooms, then the rest. */
function homeGames(): string {
  if (!H.store) return `<p class="empty-note">${noStore()}</p>`;
  const order = { turn: 0, waiting: 1, playing: 2, ended: 3 };
  const rows = Object.values(H.rows).filter((r): r is GameRow => !!r && r.state !== 'ended').sort((a, b) => order[a.state] - order[b.state] || b.moveAt - a.moveAt);
  if (!rows.length) return '<p class="empty-note">Nessuna partita aperta. Entra nella lobby o crea una partita.</p>';
  return rows.slice(0, 4).map(r => {
    const what = r.state === 'turn' ? `Tocca a te · ${ago(r.moveAt)}` : r.state === 'waiting' ? `In attesa · ${r.players.length} di ${r.seats} giocatori`
      : `Tocca a ${esc(r.turnName ?? '…')} · ${ago(r.moveAt)}`;
    const act = r.state === 'turn' ? `<button class="tool gplay" data-code="${r.code}">Gioca</button>` : `<button class="tool gplay" data-code="${r.code}">Apri</button>`;
    return `<div class="prow">${dots(r.players.map(p => p.crew), r.state === 'waiting' ? r.seats : r.players.length)}<span class="t"><b>Stanza ${r.code}</b><small>${what}</small></span>${act}</div>`;
  }).join('');
}

/** Draws the home's lists and badges. */
function drawHome(): void {
  $('homeGames').innerHTML = homeGames();
  const fr = friends(), on = fr.filter(f => f.online), asks = Object.keys(H.social.requests).length;
  $('homeFriends').innerHTML = !H.store ? `<p class="empty-note">${noStore()}</p>` : !friendsOn() ? `<p class="empty-note">${noFriends()}</p>` : !fr.length ? '<p class="empty-note">Ancora nessun amico: aggiungili dalla voce Amici.</p>'
    : fr.slice(0, 5).map(f => `<div class="prow">${avatar(f.name, f.uid)}<span class="t"><b>${esc(f.name)}</b><small>${at(f.uid)}${f.online ? f.room ? `in stanza ${esc(f.room)}` : 'nel menu' : 'non in linea'}</small></span>${f.online && !f.room ? `<button class="tool fplay" data-uid="${esc(f.uid)}">Invita</button>` : ''}</div>`).join('');
  const turns = Object.values(H.rows).filter(r => r?.state === 'turn').length;
  $('mineBadge').textContent = turns ? `${turns} tocca a te` : '';
  $('friendsBadge').textContent = asks ? `${asks} ${asks === 1 ? 'richiesta' : 'richieste'}` : on.length ? `${on.length} online` : '';
}

/** Draws the lobby's table of open rooms, filtered. */
function drawLobbyList(): void {
  const all = readLobby(H.lobbyRaw, H.mutual).filter(e => !H.social.games[e.code]);
  const f = H.lobbyFilter;
  const exp = (e: LobbyEntry): boolean => e.leaders || e.upgrades || e.carnage || e.teams;
  const list = all.filter(e => f === 'all' || (f === 'friends' ? H.mutual.has(e.hostUid) : f === 'base' ? !exp(e) : exp(e)));
  $('lobbyCount').textContent = H.store ? `${all.length} ${all.length === 1 ? 'partita aperta' : 'partite aperte'} · si aggiorna da sola` : '';
  const head = '<tr><th>Host</th><th>Giocatori</th><th>Espansioni</th><th>Partenza</th><th>Aperta da</th><th></th></tr>';
  $('lobbyList').innerHTML = head + (list.length ? list.map(e => {
    const friend = H.mutual.has(e.hostUid);
    return `<tr class="${friend ? 'friend' : ''}"><td><b>${esc(e.host)}</b> ${friend ? '<em class="pill on">amico</em>' : ''}${e.bots ? ` <em class="pill">TRV9000 ×${e.bots}</em>` : ''}</td>
      <td>${dots(e.crews, e.seats)}</td><td>${expTags(e)}</td><td>${e.startSide === 'b' ? '1b · Runway to Ruin' : '1a · The Parking Lot'}</td><td>${ago(e.at)}</td>
      <td><button class="${friend ? 'go small' : 'tool'} ljoin" data-code="${e.code}">Entra</button></td></tr>`;
  }).join('') : `<tr><td colspan="6" class="empty-note">${H.store ? 'Nessuna partita aperta adesso: creane una tu.' : noStore()}</td></tr>`);
}

/** Draws the list of one's games on the chosen tab, and the invitations received. */
function drawMine(): void {
  const rows = Object.values(H.rows).filter((r): r is GameRow => !!r);
  const tab = H.mineTab;
  const inTab = (r: GameRow, t: typeof tab): boolean => t === 'ended' ? r.state === 'ended' : t === 'waiting' ? r.state === 'waiting' : r.state === 'turn' || r.state === 'playing';
  const shown = rows.filter(r => inTab(r, tab)).sort((a, b) => Number(b.state === 'turn') - Number(a.state === 'turn') || b.moveAt - a.moveAt);
  for (const b of $('mineTab').querySelectorAll<HTMLButtonElement>('button')) {
    const t = b.dataset.t as typeof tab;
    b.textContent = `${{ playing: 'In corso', waiting: 'In attesa', ended: 'Concluse' }[t]} (${rows.filter(r => inTab(r, t)).length})`;
    b.classList.toggle('on', t === tab);
  }
  const head = '<tr><th>Stanza</th><th>Giocatori</th><th>Stato</th><th>Ultima mossa</th><th>Turno</th><th></th></tr>';
  $('mineList').innerHTML = head + (shown.length ? shown.map(r => {
    const turn = r.state === 'turn' ? '<em class="pill turn">tocca a te</em>' : r.state === 'waiting' ? `<em class="pill wait">${r.players.length} di ${r.seats}</em>`
      : r.state === 'ended' ? `<em class="pill">vince ${esc(r.winner ?? '')}</em>` : `<em class="pill">${esc(r.turnName ?? '…')}</em>`;
    const act = r.state === 'turn' ? `<button class="go small gplay" data-code="${r.code}">Gioca</button>` : `<button class="tool gplay" data-code="${r.code}">${r.state === 'ended' ? 'Rivedi' : 'Apri'}</button>`;
    // The host closes the room for everybody; a guest leaves it (design/ux/chiudi-partite, 2026-11-19).
    const out = r.state === 'ended' ? ` <button class="tool ${r.host ? 'gclose' : 'gforget'}" data-code="${r.code}" title="Toglila dall’elenco">✕</button>`
      : r.host ? ` <button class="tool danger gclose" data-code="${r.code}" title="Chiude la stanza per tutti">Chiudi per tutti</button>`
      : r.state === 'waiting' ? ` <button class="tool gforget" data-code="${r.code}" title="Lascia il posto">Esci</button>`
      : ` <button class="tool danger gquit" data-code="${r.code}" title="Lascia la partita">Abbandona</button>`;
    return `<tr><td><b>${r.code}</b>${r.host ? ' <small>host</small>' : ''}</td><td>${dots(r.players.map(p => p.crew), r.state === 'waiting' ? r.seats : r.players.length)}</td>
      <td>${r.state === 'waiting' ? 'In attesa' : r.state === 'ended' ? 'Conclusa' : 'In corso'}</td><td>${ago(r.moveAt)}</td><td>${turn}</td><td>${act}${out}</td></tr>`;
  }).join('') : `<tr><td colspan="6" class="empty-note">${H.store ? 'Nessuna partita qui.' : noStore()}</td></tr>`);
  const inv = Object.entries(H.social.invites).sort((a, b) => b[1].at - a[1].at);
  $('invites').innerHTML = inv.length ? inv.map(([code, i]) => `<div class="prow">${avatar(i.name, i.from)}<span class="t"><b>${esc(i.name)} ti invita nella stanza ${esc(code)}</b><small>${ago(i.at)}</small></span>
    <button class="go small ijoin" data-code="${esc(code)}">Entra</button><button class="tool idrop" data-code="${esc(code)}">No grazie</button></div>`).join('') : '<p class="empty-note">Nessun invito.</p>';
}

/** Draws the friends' pane: requests and the list with who is online. */
function drawFriends(): void {
  // A guest is asked to sign in; an account sees its code, its requests and its friends.
  $('fguest').style.display = H.account ? 'none' : '';
  $('fmain').style.display = H.account ? '' : 'none';
  const req = Object.entries(H.social.requests);
  $('frequests').innerHTML = req.length ? req.map(([uid, r]) => `<div class="prow">${avatar(nameOf(uid, r.name), uid)}<span class="t"><b>${esc(nameOf(uid, r.name))}</b><small>${at(uid)}${ago(r.at)}</small></span>
    <button class="tool facc" data-uid="${esc(uid)}">Accetta</button><button class="tool danger fdec" data-uid="${esc(uid)}" title="Rifiuta">✕</button></div>`).join('') : '<p class="empty-note">Nessuna richiesta.</p>';
  const fr = friends();
  const waiting = Object.entries(H.social.friends).filter(([uid]) => !H.mutual.has(uid));
  $('fcount').textContent = `I tuoi amici (${fr.length})`;
  const seen = (uid: string): string => H.presence[uid] ? `visto ${ago(H.presence[uid]!.at)}` : 'non in linea';
  $('flist').innerHTML = (fr.length ? fr.map(f => `<div class="prow">${avatar(f.name, f.uid)}<span class="t"><b>${esc(f.name)} ${f.online ? '<em class="pill on">online</em>' : ''}</b><small>${at(f.uid)}${f.online ? f.room ? `in stanza ${esc(f.room)}` : 'nel menu' : seen(f.uid)}</small></span>
    <button class="tool fplay" data-uid="${esc(f.uid)}">Invita</button><button class="tool danger fdel" data-uid="${esc(f.uid)}" title="Togli dagli amici">✕</button></div>`).join('') : '<p class="empty-note">Ancora nessun amico.</p>')
    + waiting.map(([uid, f]) => `<div class="prow">${avatar(nameOf(uid, f.name), uid)}<span class="t"><b>${esc(nameOf(uid, f.name))}</b><small>${at(uid)}richiesta mandata, in attesa</small></span><button class="tool danger fdel" data-uid="${esc(uid)}" title="Annulla la richiesta">✕</button></div>`).join('');
}

/** Draws the create pane's friends to invite. */
function drawCreateFriends(): void {
  const fr = friends();
  $('ofriends').innerHTML = !friendsOn() ? `<p class="empty-note">${noFriends()} Puoi invitare chiunque con il link o il codice della stanza.</p>` : fr.length ? fr.map(f => `<label class="check prow"><input type="checkbox" value="${esc(f.uid)}">${avatar(f.name, f.uid)}<span class="t"><b>${esc(f.name)}</b><small>${at(f.uid)}${f.online ? 'online' : 'non in linea'}</small></span></label>`).join('')
    : '<p class="empty-note">Nessun amico ancora: potrai invitare chiunque con il link o il codice della stanza.</p>';
}

/** Redraws everything the first screen and the room's card show of the online side. */
export function drawOnline(): void {
  drawMe();
  drawHome();
  drawLobbyList();
  drawMine();
  drawFriends();
  if (S.net) $('lfriends').innerHTML = roomFriendsHtml(S.net.code, Object.keys(S.net.room?.seats ?? {}));
}

/** Friends checked in the create pane. */
export function checkedFriends(): string[] {
  return [...$('ofriends').querySelectorAll<HTMLInputElement>('input:checked')].map(i => i.value);
}

/** Follows the rooms of one's games: a watch per room in the list, dropped when it leaves it. */
function followGames(): void {
  if (!H.store) return;
  const store = H.store, codes = new Set(Object.keys(H.social.games));
  for (const [code, stop] of roomWatch) if (!codes.has(code)) { stop(); roomWatch.delete(code); delete H.rows[code]; }
  for (const code of codes) {
    if (roomWatch.has(code)) continue;
    roomWatch.set(code, store.watch(roomPath(code), raw => {
      const room = readRoom(raw);
      // A room that is gone, or where this player no longer sits, leaves the list.
      if (!room || !room.seats[H.uid]) { H.rows[code] = null; void forgetGame(store, code).catch(() => {}); }
      else H.rows[code] = gameRow(code, room, H.uid);
      drawOnline();
    }));
  }
}

/** Reads again who of one's friends counts back and who is online. */
export async function refresh(): Promise<void> {
  if (!H.store) return;
  const uids = Object.keys(H.social.friends);
  H.mutual = await mutualFriends(H.store, uids);
  H.presence = await readPresence(H.store, uids);
  H.profiles = await readProfiles(H.store, [...new Set([...uids, ...Object.keys(H.social.requests)])]);
  drawOnline();
}

/** Writes the player's shown name to the profile, with an account (and keeps it on this browser). */
async function saveName(): Promise<void> {
  const typed = ($('myname') as HTMLInputElement).value.trim().slice(0, NAME_MAX);
  try { localStorage.setItem(NAME_KEY, typed); } catch { /* storage off */ }
  drawMe();
  const p = H.social.profile;
  if (H.store && !H.broken && p) await ensureProfile(H.store, { user: p.user, name: typed }, randomBytes, Date.now()).catch(e => { H.broken = true; console.warn('Profilo non salvato', e); });
}

/** The player with an account and no user name yet: the pane where it chooses one. */
function askUser(): void {
  ($('uname') as HTMLInputElement).value = '';
  $('umsg').textContent = 'Gli altri giocatori vedono il tuo nome visualizzato, che all’inizio è il nome utente: lo cambi quando vuoi in alto.';
  showPane('pUser');
  ($('uname') as HTMLInputElement).focus();
}

/** Starts the online side of the first screen: profile, lists, presence. Online only. */
export async function bootHome(): Promise<void> {
  const store = await openStore();
  H.store = store;
  H.uid = await store.uid();
  H.account = await hasAccount();
  try {
    // An account keeps its profile, under the user name chosen at registration; one without a user
    // name (new, or from before user names) chooses it now. A guest has no profile.
    const had = readProfile(await store.read(userPath(H.uid, 'profile')));
    if (H.account && had) {
      const field = $('myname') as HTMLInputElement;
      // The profile's shown name holds on every device; blank in the field when it is the user name.
      field.value = had.name === had.user ? '' : had.name;
      await ensureProfile(store, { user: had.user, name: field.value }, randomBytes, Date.now());
    } else if (H.account) {
      H.needUser = true;
      if (!S.net && !new URLSearchParams(location.search).get('room')) askUser();
    }
  } catch (e) {
    // The rules for profiles and friends are not published yet: rooms still work, the rest waits.
    H.broken = true;
    console.warn('Amici e lobby non disponibili: regole del database da aggiornare', e);
  }
  store.watch(userPath(H.uid), raw => {
    // Who is in the lists: a change reads again who counts back, who is online and the names now.
    const lists = (): string => `${Object.keys(H.social.friends).join()}|${Object.keys(H.social.requests).join()}`;
    const before = lists();
    H.social = readSocial(raw);
    // Without an account there is no profile, even one this identity once had.
    if (!H.account) H.social.profile = null;
    followGames();
    if (lists() !== before) void refresh().catch(() => {});
    drawOnline();
  });
  store.watch(lobbyPath(), raw => { H.lobbyRaw = raw; drawLobbyList(); });
  const beat = (): void => { void heartbeat(store, Date.now(), S.net?.code).catch(() => {}); void refresh().catch(() => {}); };
  beat();
  setInterval(beat, HEARTBEAT_MS);
  // The friend link (?friend=CODE) opens the friends' pane with the code ready.
  const fc = cleanFriendCode(new URLSearchParams(location.search).get('friend') ?? '');
  if (fc && !S.net) { ($('faddcode') as HTMLInputElement).value = showFriendCode(fc); if (!H.needUser) showPane('pFriends'); }
}

/** Sets the online buttons for a page where online is off. */
export function offline(): void {
  H.off = true;
  for (const id of ['mPlay', 'mMine', 'mFriends']) ($(id) as HTMLButtonElement).disabled = true;
  $('onlinehint').textContent = 'Il gioco online non è ancora attivo su questo sito.';
  drawOnline();
}

/** The value of a segmented choice (the button marked on). */
export const segValue = (id: string): string => $(id).querySelector<HTMLButtonElement>('button.on')?.dataset.v ?? '';

/** The code typed in the lobby's field, tidied ('' when it cannot be one). */
export const typedCode = (): string => cleanCode(($('ocode') as HTMLInputElement).value);

// ---- Buttons ----

const go = (p: Pane) => (): void => {
  // Friends first need a user name.
  if (p === 'pFriends' && H.needUser) { askUser(); return; }
  showPane(p);
  void refresh().catch(() => {});
};
$('mPlay').onclick = go('pLobby');
$('mMine').onclick = go('pMine');
$('mFriends').onclick = go('pFriends');
$('mCreate').onclick = () => { drawCreateFriends(); showPane('pCreate'); };
($('myname') as HTMLInputElement).addEventListener('change', () => { void saveName(); });
($('myname') as HTMLInputElement).addEventListener('input', drawMe);

for (const seg of ['ovis', 'omax', 'lobbyFilter', 'mineTab']) {
  $(seg).addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    for (const x of $(seg).querySelectorAll('button')) x.classList.toggle('on', x === b);
    if (seg === 'lobbyFilter') { H.lobbyFilter = b.dataset.f ?? 'all'; drawLobbyList(); }
    if (seg === 'mineTab') { H.mineTab = (b.dataset.t ?? 'playing') as typeof H.mineTab; drawMine(); }
  });
}

// Clicks inside the lists (rows are redrawn, so the buttons are found by class).
$('setup').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || !H.store) return;
  const store = H.store, code = b.dataset.code ?? '', uid = b.dataset.uid ?? '';
  const fail = (err: unknown): void => { netError(err); };
  if (b.classList.contains('ljoin') || b.classList.contains('gplay')) void joinByCode(code);
  else if (b.classList.contains('ijoin')) { void dropInvite(store, code).catch(() => {}); void joinByCode(code); }
  else if (b.classList.contains('idrop')) void dropInvite(store, code).catch(fail);
  else if (b.classList.contains('gforget')) {
    void (async () => {
      const room = readRoom(await store.read(roomPath(code)));
      if (room?.status === 'lobby' && room.host !== H.uid) await store.write(roomPath(code, 'seats', H.uid), null);
      await forgetGame(store, code);
    })().catch(fail);
  } else if (b.classList.contains('gquit')) {
    void sure(`Abbandonare la partita ${code}?`, 'La partita esce dal tuo elenco. Il tuo posto resta a tavola: quando tocca a te gli altri ti aspettano, finché l’host non chiude la stanza.', 'Abbandona')
      .then(ok => ok ? forgetGame(store, code) : undefined).catch(fail);
  } else if (b.classList.contains('gclose')) {
    const row = H.rows[code];
    void (row?.state === 'ended' ? Promise.resolve(true) : sure(`Chiudere la stanza ${code} per tutti?`, row?.state === 'waiting'
      ? 'La stanza esce dalla lobby e dagli elenchi di chi ci si era seduto.'
      : 'La partita in corso va persa per tutti i giocatori e la stanza viene cancellata.', 'Chiudi per tutti'))
      .then(async ok => {
        if (!ok) return;
        await publishLobby(store, code, null).catch(() => {});
        await forgetGame(store, code);
        await closeRoom(store, code);
      }).catch(fail);
  } else if (b.classList.contains('facc')) void acceptFriend(store, uid, nameOf(uid, H.social.requests[uid]?.name ?? ''), Date.now()).then(refresh).catch(fail);
  else if (b.classList.contains('fdec')) void declineFriend(store, uid).catch(fail);
  else if (b.classList.contains('fdel')) { if (confirm('Togliere questa persona dagli amici?')) void removeFriend(store, uid).then(refresh).catch(fail); }
  else if (b.classList.contains('fplay')) {
    // Invite a friend: into my room waiting for players if there is one, else into a new one.
    const mine = Object.values(H.rows).find(r => r?.state === 'waiting' && r.host);
    if (mine && confirm(`Invitare nella tua stanza ${mine.code}, che aspetta giocatori?`)) { void invite(uid, mine.code).then(() => joinByCode(mine.code)).catch(fail); return; }
    drawCreateFriends();
    for (const i of $('ofriends').querySelectorAll<HTMLInputElement>('input')) i.checked = i.value === uid;
    showPane('pCreate');
  }
});

$('fadd').onclick = async () => {
  const code = cleanFriendCode(($('faddcode') as HTMLInputElement).value);
  const msg = $('faddmsg');
  if (!code) { msg.textContent = 'Il codice amico è TRV- seguito da sei caratteri.'; return; }
  if (!H.store || !friendsOn()) return;
  try {
    const res = await addFriend(H.store, code, myName(), Date.now());
    msg.textContent = { sent: 'Richiesta mandata: diventate amici quando la accetta.', friends: 'Ora siete amici.', self: 'È il tuo codice.', 'not-found': 'Nessun giocatore con questo codice.' }[res];
    if (res === 'sent' || res === 'friends') ($('faddcode') as HTMLInputElement).value = '';
    await refresh();
  } catch (e) { msg.textContent = 'Non riuscito: riprova.'; console.error(e); }
};
($('faddcode') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') $('fadd').click(); });
$('fcopy').onclick = () => {
  const p = H.social.profile;
  if (!p) return;
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('friend', p.code);
  void navigator.clipboard?.writeText(u.toString()).then(() => { $('fcopy').textContent = 'Copiato!'; setTimeout(() => { $('fcopy').textContent = 'Copia il link'; }, 1500); }).catch(() => {});
};

// Registration: the user name, once and for good, then the profile with its friend code.
$('usave').onclick = async () => {
  const store = H.store, msg = $('umsg'), typed = ($('uname') as HTMLInputElement).value;
  if (!store) return;
  ($('usave') as HTMLButtonElement).disabled = true;
  try {
    const res = await claimUsername(store, typed);
    if (res !== 'ok') {
      msg.textContent = res === 'taken' ? 'Questo nome utente è già preso: scegline un altro.' : 'Da 3 a 20 caratteri: lettere minuscole, cifre, “_” e “.” (non all’inizio né alla fine).';
      return;
    }
    // A new player's shown name starts as the user name (changed afterwards, in the header); one
    // registered before user names (2026-11-20) keeps the name the others already knew it by.
    const old = earlierName(await store.read(userPath(H.uid, 'profile')));
    await ensureProfile(store, { user: cleanUsername(typed), name: old }, randomBytes, Date.now());
    const shown = old === cleanUsername(typed) ? '' : old;
    ($('myname') as HTMLInputElement).value = shown;
    try { localStorage.setItem(NAME_KEY, shown); } catch { /* storage off */ }
    H.needUser = false;
    H.broken = false;
    const fc = cleanFriendCode(new URLSearchParams(location.search).get('friend') ?? '');
    showPane(fc ? 'pFriends' : 'pMain');
    await refresh();
  } catch (e) { msg.textContent = 'Non riuscito: riprova.'; console.error(e); }
  finally { ($('usave') as HTMLButtonElement).disabled = false; }
};
($('uname') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') $('usave').click(); });
$('fguestlogin').onclick = () => $('acclogin').click();

// The room's card: invite a friend, or ask a player of the room to be friends.
$('lobby').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || !S.net) return;
  if (b.classList.contains('linv')) void invite(b.dataset.uid!, S.net.code).then(drawOnline).catch(netError);
  if (b.classList.contains('lfriend')) { b.disabled = true; b.textContent = 'chiesto'; void befriend(b.dataset.uid!).catch(netError); }
});
