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

7. **Lobby, amici e "Le mie partite"** (dal 2026-11-18): `database.rules.json` ha
   le sezioni `lobby`, `friendCodes`, `presence` e `users`. Incolla di nuovo il file
   nella scheda **Regole** e **Pubblica**. Finché non lo fai le stanze funzionano
   lo stesso (codice, link, QR), ma lobby, amici, inviti e l'elenco delle proprie
   partite restano vuoti e la console del browser dice "regole del database da
   aggiornare".

8. **Account e nome utente** (dal 2026-11-20): `database.rules.json` ha la sezione
   `usernames` e richiede un account (non anonimo) per profilo, codici amico,
   richieste e inviti. Incolla di nuovo il file nella scheda **Regole** e
   **Pubblica**. I profili di prima non hanno un nome utente: chi ha già un
   account Google lo sceglie alla prossima visita, e i vecchi profili anonimi
   restano nel database senza più comparire.

9. **Beta su invito** (dal 2026-11-21): il gioco intero si apre solo per gli
   account invitati. `database.rules.json` ha le sezioni `testers` (email
   invitate), `testerUids` (account ammessi) e `beta`, e chiede di essere tester
   per stanze, lobby, amici e profili.
   1. Incolla di nuovo il file nella scheda **Regole** e **Pubblica**.
   2. Apri il pannello admin → **Tester della Beta**. La prima volta aggiunge da
      solo tutti gli account registrati finora (chi ha scelto un nome utente) e
      lo scrive in cima alla pagina.
   3. Per invitare scrivi o incolla una o più email Google e premi **Invita**:
      va bene un elenco qualsiasi (una per riga, con virgole, `Nome <email>`)
      e anche l'intero file di `npx firebase-tools auth:export utenti.json
      --format=json --project trv-online`, che contiene le email di chi ha fatto
      accesso (tienilo fuori dal repository e cancellalo dopo). Con **Togli** lo
      escludi di nuovo. Gli admin entrano sempre.
   Gli ospiti senza account e gli account non invitati vedono "Beta su invito"
   e non possono né giocare né entrare nelle stanze. La partita in locale è
   chiusa solo dalla pagina: il codice è pubblico, quindi chi lo scarica può
   comunque avviarla da sé.

## Come si gioca online

- Gli amici richiedono un **account** (accesso con Google). Al primo accesso si
  sceglie il **nome utente**: unico e per sempre (3–20 caratteri: lettere
  minuscole, cifre, `_` e `.`). Il **nome visualizzato** dagli altri parte uguale
  al nome utente e si cambia quando si vuole, in alto. Sotto compaiono
  `@nomeutente` e il **codice amico** (`TRV-XXXXXX`).
- Durante la Beta serve un account invitato (punto 9): senza, il gioco non si apre.
- **Gioca online** apre la lobby: le partite pubbliche non ancora iniziate (quelle
  degli amici in cima), un campo per entrare con un codice e **+ Crea partita**.
- **Crea partita**: chi può entrare (tutti in lobby, solo amici, solo su invito),
  quanti posti, tessera, espansioni, squadre TRV9000 e gli amici da invitare.
- Nella stanza: QR, link o codice per chiunque, e **Invita** accanto agli amici.
  Ognuno sceglie il colore; l'host sceglie le opzioni → **Inizia la partita**.
- **Le mie partite**: le stanze in cui sei seduto (in corso, in attesa, concluse),
  con "tocca a te", e gli inviti ricevuti. Con l'accesso Google valgono su ogni
  dispositivo.
- **Amici**: si aggiungono con il codice amico o il suo link, oppure con "+ amico"
  accanto a chi gioca con te; la richiesta va accettata.
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
