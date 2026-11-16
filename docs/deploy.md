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

`npm run dev`, poi apri `/prototypes/trv-play-spike/?net=local` in due schede dello
stesso browser: le stanze passano per `localStorage`.
