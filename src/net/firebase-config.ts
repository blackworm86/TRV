/**
 * The Firebase project the online rooms live in. These values identify the project; they are
 * not secrets (access is decided by the database rules in `database.rules.json`), so they are
 * committed. Copy them from the Firebase console: Project settings > Your apps > Web app.
 *
 * While this is null the game offers hot seat only.
 */

/** The fields of the console's `firebaseConfig` that the game needs. */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
}

export const FIREBASE_CONFIG: FirebaseConfig | null = {
  apiKey: 'AIzaSyBheLMA9Os-Mlw_A3HWSDsaSmzpAOkSt7w',
  authDomain: 'trv-online.firebaseapp.com',
  databaseURL: 'https://trv-online-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'trv-online',
  appId: '1:298796497560:web:a7a607af17b20cc0482eed',
};
