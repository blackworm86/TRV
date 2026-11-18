// The player's account (Google sign-in) and the admin link; booting the online part.
// Optional Google sign-in on the first screen. A signed-in player keeps the same identity on
// every device (the anonymous one of the online rooms is linked to it); an admin
// (admins/<uid> in the database) also gets the asset inspector, from here and from the Menu.

import { cleanCode, readRoom, roomPath, NAME_MAX } from '../net/room';
import { FIREBASE_CONFIG } from '../net/firebase-config';
import { bootHome, drawOnline, offline } from './home';
import { closePops } from './menus';
import { NAME_KEY, enterRoom, netError, netMode, openStore, showInvite } from './online';
import { showPane } from './screens';
import { S } from './state';
import { $ } from './util';

export let isAdminUser = false;
/** Shows who is signed in and the buttons that apply. */
export function drawAccount(user: { name: string | null; email: string | null; anonymous: boolean } | null): void {
  const google = !!user && !user.anonymous;
  $('accwho').textContent = google ? `Accesso: ${user!.name ?? user!.email ?? 'account Google'}${isAdminUser ? ' · admin' : ''}` : 'Con Google ritrovi amici e partite su ogni dispositivo.';
  $('acclogin').style.display = google ? 'none' : '';
  $('acclogout').style.display = google ? '' : 'none';
  $('accadmin').style.display = isAdminUser ? '' : 'none';
  $('adminopen').style.display = isAdminUser ? '' : 'none';
}
/** Loads the sign-in (only where the Firebase project is set) and keeps the account box up to date. */
export async function bootAccount(): Promise<void> {
  $('adminopen').style.display = 'none';
  if (netMode() !== 'firebase' || !FIREBASE_CONFIG) return;
  const { createAdminAuth } = await import('../net/admin-auth');
  const auth = createAdminAuth(FIREBASE_CONFIG);
  $('account').classList.add('on');
  drawAccount(null);
  auth.onUser(async user => {
    isAdminUser = !!user && !user.anonymous && await auth.isAdmin(user.uid);
    drawAccount(user);
    const name = $('myname') as HTMLInputElement;
    if (user && !user.anonymous && user.name && !name.value) { name.value = user.name.slice(0, NAME_MAX); name.dispatchEvent(new Event('change')); }
  });
  $('acclogin').onclick = async () => {
    $('oerr').textContent = '';
    try {
      await auth.signInWithGoogle();
      location.reload(); // the room store keeps the identity it read at start: reload with the new one
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      $('oerr').textContent = code === 'auth/popup-closed-by-user' ? 'Finestra di accesso chiusa.'
        : code === 'auth/popup-blocked' ? 'Il browser ha bloccato la finestra di accesso: consenti i popup per questo sito.'
          : 'Accesso non riuscito, riprova.';
    }
  };
  $('acclogout').onclick = async () => {
    if (S.net && !confirm('Sei in una stanza online: uscendo dall’account perdi il posto. Continuare?')) return;
    await auth.signOut();
    location.reload();
  };
}
$('adminopen').onclick = () => { closePops(); window.open('./admin.html', '_blank'); };

/** First screen: says whether online is available; with an invite link, goes to the room. Returns true when a room is being entered. */
export function bootOnline(): boolean {
  try { ($('myname') as HTMLInputElement).value = localStorage.getItem(NAME_KEY) ?? ''; } catch { /* storage off */ }
  showPane('pMain');
  if (!netMode()) { offline(); return false; }
  drawOnline();
  void bootHome().catch(netError);
  const code = cleanCode(new URLSearchParams(location.search).get('room') ?? '');
  if (!code) return false;
  ($('ocode') as HTMLInputElement).value = code;
  showInvite(code);
  // A device that already sits in the room (a reload, a return) goes straight back in.
  void (async () => {
    const store = await openStore(), uid = await store.uid();
    const room = readRoom(await store.read(roomPath(code)));
    if (room?.seats[uid]) enterRoom(store, code, uid);
    else if (!room) $('oerr').textContent = 'Questa stanza non esiste più.';
  })().catch(netError);
  return true;
}
