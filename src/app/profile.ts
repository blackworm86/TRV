// The player's profile window (asked by the user, 2026-11-22), from the avatar in the first
// screen's header and from the Menu: the account's data, the avatar to choose, the statistics of
// its online matches (src/net/stats.ts), the achievements (coming soon) and deleting the profile.
// A guest is asked to sign in: without an account there is no profile.

import { BASE_CATALOG as CAT } from '../game/trv/catalog';
import { FIREBASE_CONFIG } from '../net/firebase-config';
import { setAvatar, showFriendCode, userPath, wipeAccount } from '../net/social';
import { leaderName, readResults, summarize, upgradeName, type PlayerStats } from '../net/stats';
import { avatarChoices, avatarHtml, paintAvatar } from './avatars';
import { H, myName } from './home';
import { closePops } from './menus';
import { NAME_KEY, netMode } from './online';
import { $, esc } from './util';

type Tab = 'dati' | 'stats' | 'ach';
let tab: Tab = 'dati';
/** The Google account as Firebase knows it (null off the real site or before it is read). */
let google: { email: string | null; since?: number } | null = null;

/** Reads the e-mail and the creation date of the signed-in Google account, once. */
async function readGoogle(): Promise<void> {
  if (google || netMode() !== 'firebase' || !FIREBASE_CONFIG) return;
  const { createAdminAuth } = await import('../net/admin-auth');
  await new Promise<void>(resolve => {
    let stop: (() => void) | null = null;
    stop = createAdminAuth(FIREBASE_CONFIG!).onUser(u => {
      if (!u) return;
      if (!u.anonymous) google = { email: u.email, ...(u.since ? { since: u.since } : {}) };
      resolve();
      stop?.();
    });
  });
}

const day = (at: number): string => new Date(at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/** Opens the window on its first tab. */
export function openProfile(): void {
  closePops();
  tab = 'dati';
  $('pf-confirm').classList.remove('show');
  ($('pf-confirmname') as HTMLInputElement).value = '';
  ($('pf-deleteok') as HTMLButtonElement).disabled = true;
  $('pf-err').textContent = '';
  draw();
  $('profile').classList.add('show');
  void readGoogle().then(draw, e => console.warn(e));
}
function closeProfile(): void { $('profile').classList.remove('show'); }

/** Draws what the window shows now (the statistics are read when their tab opens). */
function draw(): void {
  const p = H.social.profile, ready = H.account && !!p && !!H.store;
  const name = myName() || 'Ospite';
  paintAvatar($('pf-av'), name, p?.avatar);
  $('pf-title').textContent = ready ? name : 'Il tuo profilo';
  $('pf-user').textContent = ready ? `@${p!.user} · ${showFriendCode(p!.code)}` : H.account ? 'Scegli prima il tuo nome utente.' : 'Ospite';
  $('pf-guest').style.display = ready ? 'none' : '';
  $('pf-main').style.display = ready ? '' : 'none';
  if (!ready) {
    // An account without a user name chooses it first (the first screen asks); a guest signs in.
    $('pf-login').style.display = H.account ? 'none' : '';
    return;
  }
  for (const b of $('pf-tabs').querySelectorAll<HTMLElement>('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const s of document.querySelectorAll<HTMLElement>('#profile .pf-pane')) s.classList.toggle('on', s.dataset.pane === tab);
  $('pf-avatars').innerHTML = [{ id: '', name: 'Iniziale del nome', url: '' }, ...avatarChoices()].map(a =>
    `<button type="button" role="option" data-avatar="${a.id}" title="${esc(a.name)}" aria-selected="${(p!.avatar ?? '') === a.id}" class="${(p!.avatar ?? '') === a.id ? 'on' : ''}">`
    + `${avatarHtml(name, a.id || null)}<small>${esc(a.id ? a.name : 'Iniziale')}</small></button>`).join('');
  const facts: [string, string][] = [
    ['Nome visualizzato', name], ['Nome utente', `@${p!.user}`], ['Codice amico', showFriendCode(p!.code)],
    ...(google?.email ? [['Account Google', google.email] as [string, string]] : []),
    ...(google?.since ? [['Iscritto dal', day(google.since)] as [string, string]] : []),
  ];
  $('pf-facts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  $('pf-confirmuser').textContent = p!.user;
  if (tab === 'stats') void drawStats();
}

/** A tile of the statistics: a big number or word and what it is. */
const tile = (value: string, what: string, extra = ''): string => `<div class="pf-tile">${extra}<b>${value}</b><span>${what}</span></div>`;

/** Reads the account's records and draws the statistics tab. */
async function drawStats(): Promise<void> {
  const box = $('pf-stats');
  box.innerHTML = '<p class="hint">Carico le statistiche…</p>';
  try {
    const s = summarize(readResults(await H.store!.read(userPath(H.uid, 'results'))));
    if (tab === 'stats') box.innerHTML = statsHtml(s);
  } catch (e) {
    box.innerHTML = `<p class="err">Statistiche non disponibili: ${esc((e as Error).message)}</p>`;
  }
}

/** The statistics tab for `s`. */
export function statsHtml(s: PlayerStats): string {
  const note = '<p class="hint">Contano le partite online concluse con il tuo account, da quando c’è il profilo (22 novembre 2026). Le partite in locale non contano: sullo stesso computer giocano più persone.</p>';
  if (!s.played) return `${note}<div class="pf-empty">Nessuna partita online conclusa, per ora. Gioca una partita online fino alla fine e qui compariranno i tuoi numeri.</div>`;
  const face = (id: string): string => avatarHtml(leaderName(id), id, '#6b5440', 'mid');
  const crews = CAT.crews.filter(c => s.byCrew[c.id]).sort((a, b) => s.byCrew[b.id].played - s.byCrew[a.id].played);
  const most = Math.max(...crews.map(c => s.byCrew[c.id].played));
  return `${note}<div class="pf-tiles">
      ${tile(String(s.played), 'partite giocate')}${tile(String(s.won), 'vittorie')}${tile(`${s.winRate}%`, 'vittorie sul totale')}${tile(String(s.bestStreak), 'vittorie di fila (record)')}
    </div>
    <div class="pf-tiles two">
      ${tile(s.favoriteLeader ? esc(leaderName(s.favoriteLeader.id)) : '—', s.favoriteLeader ? `personaggio preferito · ${s.favoriteLeader.played} ${s.favoriteLeader.played === 1 ? 'partita' : 'partite'}` : 'personaggio preferito', s.favoriteLeader ? face(s.favoriteLeader.id) : '')}
      ${tile(s.bestLeader ? esc(leaderName(s.bestLeader.id)) : '—', s.bestLeader ? `personaggio più efficace · ${s.bestLeader.won} ${s.bestLeader.won === 1 ? 'vittoria' : 'vittorie'}` : 'personaggio più efficace', s.bestLeader ? face(s.bestLeader.id) : '')}
      ${tile(s.favoriteUpgrade ? esc(upgradeName(s.favoriteUpgrade.id)) : '—', s.favoriteUpgrade ? `upgrade preferito · montato ${s.favoriteUpgrade.times} ${s.favoriteUpgrade.times === 1 ? 'volta' : 'volte'}` : 'upgrade preferito')}
      ${tile(String(s.jumps), 'salti con le rampe')}
    </div>
    <h3>Colori</h3>
    <div class="pf-bars">${crews.map(c => { const x = s.byCrew[c.id]; return `<div class="pf-bar" style="--c:${c.color}"><i></i><span>${esc(c.name)}</span>`
      + `<em style="--w:${Math.round(x.played / most * 100)}%"><u style="--v:${x.played ? Math.round(x.won / x.played * 100) : 0}%"></u></em><small>vinte ${x.won} su ${x.played}</small></div>`; }).join('')}</div>
    <h3>Altro</h3>
    <dl class="pf-facts">
      <dt>Contro i TRV9000</dt><dd>${s.vsBots.played} ${s.vsBots.played === 1 ? 'partita' : 'partite'}, vinte ${s.vsBots.won}</dd>
      <dt>Con il Big Rig</dt><dd>${s.bigRig}</dd><dt>Con i Final Five</dt><dd>${s.finalFive}</dd>
      <dt>Con Carnage at Devil’s Run</dt><dd>${s.carnage}</dd>
    </dl>`;
}

$('pf-tabs').addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-tab]');
  if (b) { tab = b.dataset.tab as Tab; draw(); }
});
$('pf-avatars').addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('[data-avatar]');
  const p = H.social.profile;
  if (!b || !p || !H.store) return;
  const id = b.dataset.avatar || null;
  const before = p.avatar;
  // Shown at once; the store's echo (home.ts watches the account) confirms it.
  if (id) p.avatar = id; else delete p.avatar;
  draw();
  paintAvatar($('meav'), myName(), p.avatar);
  void setAvatar(H.store, id).catch(err => {
    if (before) p.avatar = before; else delete p.avatar;
    draw();
    $('pf-err').textContent = `Avatar non salvato: ${(err as Error).message}`;
  });
});
$('pf-delete').onclick = () => {
  $('pf-confirm').classList.add('show');
  ($('pf-confirmname') as HTMLInputElement).focus();
};
$('pf-confirmname').addEventListener('input', () => {
  const typed = ($('pf-confirmname') as HTMLInputElement).value.trim().toLowerCase();
  ($('pf-deleteok') as HTMLButtonElement).disabled = typed !== H.social.profile?.user;
});
$('pf-deleteok').onclick = async () => {
  const store = H.store, social = H.social;
  if (!store || !social.profile) return;
  const btn = $('pf-deleteok') as HTMLButtonElement;
  btn.disabled = true;
  $('pf-err').textContent = '';
  try {
    if (netMode() === 'firebase' && FIREBASE_CONFIG) {
      const { createAdminAuth } = await import('../net/admin-auth');
      await createAdminAuth(FIREBASE_CONFIG).deleteAccount(() => wipeAccount(store, social));
    } else await wipeAccount(store, social); // the checks on one computer: no Google account to delete
    try { localStorage.removeItem(NAME_KEY); } catch { /* storage off */ }
    alert('Il tuo profilo è stato eliminato.');
    location.reload();
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    $('pf-err').textContent = code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? 'Eliminazione annullata: non è stato cancellato niente.'
      : code === 'auth/user-mismatch' ? 'Hai scelto un altro account Google: non è stato cancellato niente.'
        : code === 'auth/popup-blocked' ? 'Il browser ha bloccato la finestra di Google: consenti i popup per questo sito e riprova.'
          : `Eliminazione non riuscita: ${(e as Error).message}`;
    btn.disabled = false;
  }
};
$('pf-login').onclick = () => { closeProfile(); $('acclogin').click(); };
$('pf-close').onclick = closeProfile;
$('profile').addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === $('profile')) closeProfile(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && $('profile').classList.contains('show')) closeProfile(); });
$('meav').addEventListener('click', openProfile);
$('profileopen').addEventListener('click', openProfile);
