/**
 * The {@link RoomStore} that plays over the internet: Firebase Realtime Database, with an
 * anonymous sign-in to give each browser a stable identity (it survives reloads, so a player
 * who refreshes the page gets the same seat back).
 *
 * Imported on demand, so hot seat never loads the Firebase SDK.
 */

import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, onValue, ref, set } from 'firebase/database';
import type { FirebaseConfig } from './firebase-config';
import { firebaseApp } from './admin-auth';
import type { RoomStore } from './room';

/** Ports of the local Firebase emulators, for checks without a real project. */
export interface EmulatorPorts { auth: number; database: number }

/**
 * Connects to the project in `config`.
 * @param emulator when given, talks to the local emulators instead of the real services.
 */
export function createFirebaseStore(config: FirebaseConfig, emulator?: EmulatorPorts): RoomStore {
  const app = firebaseApp(config); // shared with the Google sign-in (admin-auth.ts)
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (emulator) {
    connectAuthEmulator(auth, `http://127.0.0.1:${emulator.auth}`, { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', emulator.database);
  }
  let signedIn: Promise<string> | null = null;
  const uid = (): Promise<string> => {
    signedIn ??= auth.authStateReady().then(async () => auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid);
    return signedIn;
  };
  return {
    uid,
    read: async path => { await uid(); return (await get(ref(db, path))).val() as unknown; },
    write: async (path, value) => { await uid(); await set(ref(db, path), value ?? null); },
    watch: (path, cb) => {
      let stop: (() => void) | null = null, stopped = false;
      void uid().then(() => { if (!stopped) stop = onValue(ref(db, path), snap => cb(snap.val())); });
      return () => { stopped = true; stop?.(); };
    },
  };
}
