// The gate of the closed Beta (asked by the user, 2026-11-21): on the real site the game opens only
// for an invited Google account (src/net/testers.ts). The database rules are what really keep the
// others out of online play; this page only says so, and keeps them off the local game as well.
// With ?net=local or ?net=emulator (checks on this computer) there is no gate.

import { FIREBASE_CONFIG } from '../net/firebase-config';
import { netMode } from './online';
import { $ } from './util';

/** Where a device remembers the account it last let in, so the game also opens without a connection. */
const PASSED_KEY = 'trv-beta-ok';

const remembered = (): string | null => { try { return localStorage.getItem(PASSED_KEY); } catch { return null; } };
const remember = (uid: string | null): void => {
  try { if (uid) localStorage.setItem(PASSED_KEY, uid); else localStorage.removeItem(PASSED_KEY); } catch { /* storage off */ }
};

/** Shows one state of the gate: the sign-in, the check in progress, or the refusal. */
function state(which: 'login' | 'wait' | 'denied', msg = ''): void {
  $('beta').hidden = false;
  for (const s of ['login', 'wait', 'denied']) $(`beta-${s}`).hidden = s !== which;
  $('beta-err').textContent = msg;
}

/**
 * Resolves once this device may open the game: at once off the real site, else when an invited
 * account is signed in (or was, on this device, the last time it checked).
 */
export async function betaGate(): Promise<void> {
  if (netMode() !== 'firebase' || !FIREBASE_CONFIG) return;
  state('wait');
  const [{ createAdminAuth, firebaseApp }, db, { isTester }] = await Promise.all([
    import('../net/admin-auth'), import('firebase/database'), import('../net/testers'),
  ]);
  const auth = createAdminAuth(FIREBASE_CONFIG);
  const base = db.getDatabase(firebaseApp(FIREBASE_CONFIG));
  const read = async (path: string): Promise<unknown> => (await db.get(db.ref(base, path))).val() as unknown;
  return new Promise(resolve => {
    let open = false;
    const pass = (): void => { if (open) return; open = true; $('beta').hidden = true; resolve(); };
    $('beta-google').onclick = async () => {
      const b = $('beta-google') as HTMLButtonElement;
      b.disabled = true;
      $('beta-err').textContent = '';
      try { await auth.signInWithGoogle(); } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        $('beta-err').textContent = code === 'auth/popup-closed-by-user' ? 'Finestra di accesso chiusa.'
          : code === 'auth/popup-blocked' ? 'Il browser ha bloccato la finestra di accesso: consenti i popup per questo sito.'
            : 'Accesso non riuscito, riprova.';
      } finally { b.disabled = false; }
    };
    $('beta-other').onclick = () => { remember(null); void auth.signOut(); };
    $('beta-retry').onclick = () => location.reload();
    auth.onUser(async user => {
      if (open) return;
      if (!user || user.anonymous) { state('login'); return; }
      // The account let in last time on this device opens at once (also offline); the check runs anyway.
      if (remembered() === user.uid) pass(); else state('wait');
      const ok = await isTester(read, user);
      if (ok === null) { if (!open) state('wait', 'Serve la connessione a internet per controllare l’invito.'); return; }
      remember(ok ? user.uid : null);
      if (ok) pass();
      else if (!open) { $('beta-who').textContent = user.email ?? user.name ?? 'questo account'; state('denied'); }
    });
  });
}
