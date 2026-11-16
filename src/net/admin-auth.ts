/**
 * Admin sign-in for the asset inspector: Google account (popup) on the same Firebase project as
 * the online rooms, and the admin check. An admin is a user whose `admins/<uid>` is `true` in the
 * Realtime Database; the rules let each signed-in user read only their own entry and nobody write
 * it, so admins are added by hand in the Firebase console (docs/deploy.md).
 *
 * Imported on demand, so pages that do not sign in never load the Firebase SDK.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { get, getDatabase, ref } from 'firebase/database';
import type { FirebaseConfig } from './firebase-config';

/** The signed-in user as the admin page needs it. */
export interface AdminUser {
  uid: string;
  email: string | null;
  name: string | null;
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
}

/**
 * The default Firebase app for `config`, created only once per page: the online room store
 * (firebase-store.ts) and this module share it.
 */
export function firebaseApp(config: FirebaseConfig): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

const toUser = (u: User): AdminUser => ({ uid: u.uid, email: u.email, name: u.displayName });

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
      return toUser((await signInWithPopup(auth, provider)).user);
    },
    signOut: () => signOut(auth),
    isAdmin: async uid => {
      try {
        return (await get(ref(db, `admins/${uid}`))).val() === true;
      } catch {
        return false; // permission denied or offline: not an admin
      }
    },
  };
}
