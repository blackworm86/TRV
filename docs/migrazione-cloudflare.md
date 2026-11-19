# Migrazione a Cloudflare: server autorevole, accesso nuovo, sito su Pages

**Stato:** in pausa (2026-11-19). Da riprendere quando l'utente avrà scelto il dominio.
**Sostituirà:** [ADR-0003](architecture/adr-0003-partite-online-host-arbitro.md) (host arbitro su Firebase). Alla ripresa si scrive una nuova ADR.

## Decisioni già prese

- **Server autorevole** su Cloudflare: Workers per l'API, un Durable Object per ogni stanza, D1 come database.
  Il server tiene il seme segreto e fa girare lo stesso motore delle regole (`src/game/trv/engine.ts`).
- **Accesso nuovo**, non Firebase Auth (scelta dell'utente, 2026-11-19). I giocatori di oggi vanno
  ritrovati con un passaggio una tantum (passo 5).
- **Sito su Cloudflare Pages** al posto di GitHub Pages: sito e server sullo stesso dominio.

## Da decidere

1. **Il dominio**:
   - un dominio dell'utente (a pagamento): l'indirizzo non cambierà più;
   - l'indirizzo gratuito `*.pages.dev`.
   È la scelta che blocca la ripresa.
2. **Partite online in corso al momento del passaggio**:
   - importarle così come sono: seme e registro hanno lo stesso formato, ma il loro seme è già noto ai client;
   - oppure chiedere di finirle prima.
3. **Il sistema di accesso nuovo**: con Google (OAuth) o con un link via email. Va scelto alla ripresa.

## Com'è oggi (da cui si parte)

- **Identità**: un codice utente di Firebase Auth per ogni giocatore. È anonimo e salvato nel browser,
  oppure collegato a Google con "Accedi con Google".
- **Dati**: tutto è nel Realtime Database di Firebase (`database.rules.json`):
  - `users/<uid>/profile` (nome, codice amico), `friends`, `requests`, `invites`, `games`;
  - `rooms/<codice>`: posti, preparazione con il seme, registro, intenzioni;
  - `lobby`, `admins`, i commenti sugli asset.
- **Nel browser** (`localStorage`, per indirizzo): la partita in locale (`trv-hotseat-v3`), le impostazioni,
  il nome. L'identità anonima di Firebase sta nell'archivio del browser.
- **Sito**: GitHub Pages, pubblicato da `.github/workflows/pages.yml` con `npm run build:pages`. Il sito usa
  percorsi relativi (`base: './'`), quindi funziona a qualunque indirizzo.

## Procedura

### 1. Server
- Worker con l'API: accesso, profilo, amici, inviti, lobby, elenco delle partite.
- Un Durable Object per stanza. Tiene il seme, accetta le scelte del giocatore che deve decidere e manda ai
  client la scelta, i dadi e le pescate man mano che avvengono.
  - **Il cambiamento più grosso**: oggi ogni client rigioca la partita dal seme (ADR-0002). Con il seme
    segreto non può più farlo, quindi il registro mandato ai client deve contenere anche gli esiti casuali,
    e il client deve rigiocare da quelli invece che dal seme.
- D1 per i dati che oggi sono sotto `users/`, `lobby`, `admins` e i commenti.

### 2. Client
- Una nuova implementazione di `RoomStore` (`src/net/`) che parla con il server al posto di
  `firebase-store.ts`. Il resto del gioco non cambia.
- `social.ts` e `account.ts` passano all'API del server e all'accesso nuovo.

### 3. Sito su Cloudflare Pages
- Collegare il repository a Pages: build `npm run build:pages`, cartella `dist-pages`, pubblicazione a ogni
  push su `main`, anteprima per ogni branch.
- Collegare il dominio scelto.
- **Limiti del piano gratuito** da ricontrollare alla ripresa:
  - 500 pubblicazioni al mese, 20.000 file, 25 MB per file;
  - c'è almeno un file oltre i 20 MB in `assets/_archivio/`: verificare con una build vera che non finisca
    nel sito.

### 4. Copia dei dati
- Mettere Firebase in sola lettura (`database.rules.json`).
- Esportare il database in JSON.
- Importarlo in D1 con uno script. Ogni giocatore resta legato al suo vecchio codice Firebase, che servirà
  al passo 5.
- Provare tutto prima su una copia.

### 5. Ritrovare i giocatori (accesso nuovo)
- **Chi ha usato Google**: al primo accesso col sistema nuovo il server lo riconosce dall'account Google e gli
  riassegna i suoi dati.
- **Chi è anonimo**: al primo avvio il client presenta al server il suo vecchio biglietto Firebase (un ID
  token), finché il browser lo ha. Il server lo verifica e gli riassegna i dati.
  - Senza questo passaggio un giocatore anonimo perde profilo, amici e partite.
  - Va lasciato attivo per qualche mese.

### 6. Cambio di indirizzo (da GitHub Pages a Cloudflare)
- I dati nel browser sono separati per indirizzo: sul sito nuovo non si troverebbero la partita in locale,
  le impostazioni, il nome e l'identità anonima.
  - Il vecchio sito diventa una pagina di passaggio: legge questi dati e li porta, una volta sola, al sito
    nuovo nella parte dell'indirizzo dopo `#`, che non arriva a nessun server.
  - Il sito nuovo li importa e pulisce l'indirizzo.
- I link d'invito, i QR e i link amico già condivisi puntano a GitHub: il vecchio sito resta acceso come
  reindirizzamento, conservando `?room=` e `?friend=`.
- Nel periodo in cui convivono, il nuovo indirizzo va aggiunto ai domini autorizzati di Firebase Auth.

### 7. Passaggio
1. Annunciare il giorno del passaggio.
2. Firebase in sola lettura, ultima esportazione e importazione.
3. Pubblicare il client nuovo su Cloudflare e attivare la pagina di passaggio su GitHub Pages.
4. Controllare dal vivo: accesso, ritrovo di un giocatore Google e di uno anonimo, amici, una partita online
   completa.
5. Firebase resta in sola lettura qualche settimana come riserva, poi si spegne.

### 8. Documenti
- Nuova ADR al posto di ADR-0003.
- Indice dei sistemi: #27 Authoritative Server passa a "Implemented".
- Aggiornare le regole del database e i test di `src/net/`.
