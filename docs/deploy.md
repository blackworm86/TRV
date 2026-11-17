# Deployment: GitHub Pages + Firebase Realtime Database

Il gioco è un sito statico su **GitHub Pages**. Le partite online passano da
**Firebase Realtime Database**: il browser di chi crea la stanza fa da arbitro,
gli altri entrano con link, QR o codice di 5 caratteri. La stanza resta aperta
finché l'host non la chiude.

## 1. GitHub Pages (una volta)

1. Repository → **Settings → Pages → Source: "GitHub Actions"**.
   Con repository privato serve GitHub Pro; altrimenti rendi pubblico il repository.
2. Unisci il lavoro in `main`: il workflow `.github/workflows/pages.yml` parte a ogni
   push su `main` (oppure a mano da **Actions → Pages → Run workflow**).
   Esegue i test, `npm run build:pages` e pubblica `dist-pages/`.
3. Indirizzo: `https://<utente>.github.io/<repository>/` (porta direttamente al gioco).
   I vecchi indirizzi sotto `prototypes/trv-play-spike/` (inviti già mandati compresi)
   rimandano alla radice tenendo `?room=…`: li scrive `tools/pages/finish.mjs`.

Finché Firebase non è configurato, il sito funziona in hot seat e la sezione online
dice "non ancora attivo".

## 2. Firebase (una volta)

1. <https://console.firebase.google.com> → **Aggiungi progetto** (Analytics non serve).
2. **Build → Realtime Database → Crea database**, regione `europe-west1`,
   avvio in **modalità bloccata**.
3. Scheda **Regole**: incolla il contenuto di `database.rules.json` e **Pubblica**.
4. **Build → Authentication → Inizia → Metodo di accesso → Anonimo → Abilita.**
5. **Authentication → Impostazioni → Domini autorizzati → Aggiungi**
   `<utente>.github.io`.
6. **Impostazioni progetto → Le tue app → Web (`</>`)**: registra l'app (niente
   Hosting) e copia il blocco `firebaseConfig`.
7. Incolla i valori in `src/net/firebase-config.ts` (non sono segreti: l'accesso
   lo decidono le regole) e fai push su `main`.

Piano gratuito (Spark): 100 connessioni simultanee, 1 GB di dati. Una stanza pesa
pochi KB.

## Account admin (ispettore degli asset)

La pagina `admin.html` mostra tutti gli asset del gioco per gioco e per tipo, con lo
stato di ognuno (ufficiale estratto o ricalcato, disegnato dai dati, bozza), una vista
3D girevole, i download (template SVG, file ufficiale, `.glb` per i modelli 3D) e i
commenti degli admin. Si entra con un account Google; gli admin si aggiungono a mano.

1. **Authentication → Metodo di accesso → Aggiungi nuovo provider → Google →
   Abilita**, scegli l'email di assistenza e **Salva**. (Il dominio
   `<utente>.github.io` deve essere già tra i domini autorizzati, punto 5 sopra.)
2. Apri `https://<utente>.github.io/<repo>/admin.html`
   → **Accedi con Google**. Un account non admin vede il proprio **UID**:
   premi **Copia UID**.
3. **Realtime Database → scheda Dati**: aggiungi alla radice il nodo `admins` e,
   dentro, la chiave `<UID>` con valore `true` (booleano, non la stringa
   `"true"`). Risultato: `admins/<UID>: true`.
4. **Scheda Regole**: incolla di nuovo `database.rules.json` (ora ha la sezione
   `admins`: ognuno legge solo il proprio nodo, nessuno lo scrive dal browser) e
   **Pubblica**.
5. Ricarica `admin.html`: compare l'ispettore. Per toglierne uno, cancella il suo
   nodo in `admins`.
6. **Commenti sugli asset** (dal 2026-11-17): `database.rules.json` ha la sezione
   `assetComments`, che solo gli admin leggono e scrivono, con testi di al massimo
   2000 caratteri e senza poterli sovrascrivere. Finché le regole nuove non sono
   pubblicate (scheda **Regole**, punto 4), il modulo dei commenti risponde
   "Commenti non leggibili".

Nota: tutta la grafica dell'ispettore è già nel codice pubblico del sito; l'accesso
admin tiene la pagina in ordine, non protegge segreti. Per una prova in locale
senza accesso: `npm run dev` e `/admin.html?admin=local`. In locale i commenti
restano nel browser, e la scheda **Confronta con la fonte** mostra le scansioni di
`assets/estratti/`, che il sito pubblicato non contiene.

## Come si gioca online

- L'host scrive il nome → **Crea stanza** → mostra QR, link o codice.
- Gli altri aprono il link (o scrivono il codice) → nome → **Entra**.
- Ognuno sceglie il colore; l'host sceglie tessera ed espansioni → **Inizia la partita**.
- Chi ricarica la pagina riprende il suo posto. L'host deve restare connesso:
  è lui che convalida le mosse.
- Riquadro in basso a destra → **Nuova partita (stessi giocatori)** o **Chiudi la stanza**.

## Limiti noti

- Tra persone fidate: un client modificato potrebbe leggere le informazioni nascoste
  (il seed è condiviso).
- Nessun "annulla" online.
- Le stanze chiuse male (host che non torna più) restano nel database: si cancellano
  a mano dalla console.

## Provare senza Firebase

`npm run dev`, poi apri `/?net=local` in due schede dello
stesso browser: le stanze passano per `localStorage`.
