/**
 * Admin sign-in for the asset inspector: Google account (popup) on the same Firebase project as
 * the online rooms, and the admin check. An admin is a user whose `admins/<uid>` is `true` in the
 * Realtime Database; the rules let each signed-in user read only their own entry and nobody write
 * it, so admins are added by hand in the Firebase console (docs/deploy.md).
 *
 * Imported on demand, so pages that do not sign in never load the Firebase SDK.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider, deleteUser, getAuth, linkWithPopup, onAuthStateChanged, reauthenticateWithPopup, signInWithCredential, signInWithPopup, signOut,
  type User,
} from 'firebase/auth';
import type { FirebaseError } from 'firebase/app';
import { get, getDatabase, ref } from 'firebase/database';
import type { FirebaseConfig } from './firebase-config';

/** The signed-in user as the pages need it. `anonymous`: the identity the online rooms make by themselves. */
export interface AdminUser {
  uid: string;
  email: string | null;
  name: string | null;
  anonymous: boolean;
  /** When the account was created, ms since 1970 (unknown: absent). */
  since?: number;
}

/** Sign-in, sign-out and the admin check, bound to one Firebase app. */
export interface AdminAuth {
  /** Calls `cb` with the current user (null when signed out) now and at every change; returns the unsubscribe. */
  onUser(cb: (user: AdminUser | null) => void): () => void;
  /** Opens Google's sign-in popup; resolves with the user, rejects if the popup is closed or blocked. */
  signInWithGoogle(): Promise<AdminUser>;
  /** Signs the current user out. */
  signOut(): Promise<void>;
  /** True when `admins/<uid>` is `true`; false when it is missing, not true, or not readable. */
  isAdmin(uid: string): Promise<boolean>;
  /**
   * Deletes the signed-in Google account for good (the profile window, 2026-11-22): Google's popup
   * asks to sign in again first (it wants a recent sign-in), then `wipe` deletes the account's data
   * while it can still write it, then the account goes. Rejects (and deletes nothing) if the popup
   * is closed or another account is chosen.
   */
  deleteAccount(wipe: () => Promise<void>): Promise<void>;
}

/**
 * The default Firebase app for `config`, created only once per page: the online room store
 * (firebase-store.ts) and this module share it.
 */
export function firebaseApp(config: FirebaseConfig): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

const toUser = (u: User): AdminUser => {
  const since = Date.parse(u.metadata.creationTime ?? '');
  return { uid: u.uid, email: u.email, name: u.displayName, anonymous: u.isAnonymous, ...(Number.isFinite(since) ? { since } : {}) };
};

/**
 * Admin sign-in on the project in `config`.
 * Example: `const a = createAdminAuth(FIREBASE_CONFIG); a.onUser(async u => u && show(await a.isAdmin(u.uid)));`
 */
export function createAdminAuth(config: FirebaseConfig): AdminAuth {
  const app = firebaseApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  return {
    onUser: cb => onAuthStateChanged(auth, u => cb(u ? toUser(u) : null)),
    signInWithGoogle: async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await auth.authStateReady();
      // A browser that already played online has an anonymous identity: the Google account is
      // linked to it, so the seats it holds in rooms stay its own. If that Google account
      // already exists, it simply signs in with it.
      const anon = auth.currentUser?.isAnonymous ? auth.currentUser : null;
      if (anon) {
        try {
          return toUser((await linkWithPopup(anon, provider)).user);
        } catch (e) {
          const cred = (e as FirebaseError).code === 'auth/credential-already-in-use' ? GoogleAuthProvider.credentialFromError(e as FirebaseError) : null;
          if (!cred) throw e;
          return toUser((await signInWithCredential(auth, cred)).user);
        }
      }
      return toUser((await signInWithPopup(auth, provider)).user);
    },
    signOut: () => signOut(auth),
    deleteAccount: async wipe => {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user || user.isAnonymous) throw new Error('Nessun account Google collegato.');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await reauthenticateWithPopup(user, provider); // a different account rejects with auth/user-mismatch
      await wipe();
      await deleteUser(user);
    },
    isAdmin: async uid => {
      try {
        return (await get(ref(db, `admins/${uid}`))).val() === true;
      } catch {
        return false; // permission denied or offline: not an admin
      }
    },
  };
}
