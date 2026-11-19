# ADR-0003: Partite online con il browser dell'host come arbitro, su Firebase Realtime Database

## Status

Accepted. È la soluzione in uso dal 2026-11-16, messa per iscritto il 2026-11-19.

È **provvisoria**: il concept chiede un server autorevole (GDD #27). La migrazione a Cloudflare che lo
porterebbe è pronta in quattro fasi, ma è **in pausa** per decisione dell'utente. Quando riprenderà,
questa ADR sarà sostituita da una nuova.

## Date

2026-11-19

## Last Verified

2026-11-19:
- test unitari di `src/net/room.ts` su un albero in memoria (`tests/unit/net/`);
- regole di Firebase (`database.rules.json`) pubblicate dall'utente;
- amici e inviti verificati dal vivo il 2026-11-18.

## Decision Makers

L'utente (scelta di Firebase e pausa su Cloudflare), Claude (stesura).

## Summary

Una stanza è un piccolo record condiviso: i posti, la preparazione (seed compreso) e il registro delle
scelte accettate.

- **Scrittura**: solo l'host scrive il registro. Gli altri scrivono un'**intenzione**: "con il registro
  lungo `n`, scelgo l'opzione `c`". L'host la controlla con la sua copia delle regole e, se la decisione
  spetta a quel giocatore, la aggiunge.
- **Lettura**: ogni client rigioca il registro (ADR-0002), così tutti i tavoli mostrano la stessa partita.

## Engine Compatibility

Web: Firebase JS SDK (Realtime Database, Auth anonima), usato dal sito statico su GitHub Pages. Nessun
codice gira su un server.

## ADR Dependencies

ADR-0002: una partita è un seed più le scelte.

## Context

### Problem Statement

Il gioco online a distanza serviva subito, per un progetto no profit senza budget di hosting e
distribuito come sito statico.

### Constraints

- Nessun server da mantenere né da pagare.
- Si gioca tra persone che si fidano: chi ha la copia fisica e i suoi conoscenti.
- Lo stesso motore dell'hot seat, senza un secondo motore per la rete.

## Decision

- **Interfaccia di archiviazione**: `RoomStore` (`read`, `write`, `watch`, `uid`) nasconde dove sta il
  record: `firebase-store.ts` in gioco, `tree-store.ts` nei test. `room.ts` non tocca né la rete né
  la pagina.
- **Percorsi**: `rooms/<codice>/…` (posti, preparazione, registro, intenzioni). Il codice della stanza è
  di 5 caratteri, senza lettere o cifre che si confondono.
- **Arbitro**: l'host accetta un'intenzione solo se è stata fatta sul registro della lunghezza attuale
  ed è del giocatore che deve decidere.
- **Bot**: i TRV9000 hanno un posto con una chiave inventata (`trv9000-…`) e non mandano mai intenzioni:
  le regole li giocano allo stesso modo su ogni tavolo.
- **Social**: amici, inviti e "Le mie partite" (`social.ts`) usano lo stesso database, protetto da
  `database.rules.json`.

## Alternatives Considered

### Alternativa 1: server autorevole subito (Cloudflare Workers + Durable Objects + D1)

È la soluzione giusta a lungo termine: le informazioni nascoste restano sul server e le partite non si
fermano se l'host chiude la pagina. È pianificata in quattro fasi:
1. Workers, Durable Objects e D1.
2. Pages.
3. Server autorevole.
4. Velocità.

È in pausa per decisione dell'utente.

### Alternativa 2: peer-to-peer con WebRTC

Non ha un database, ma serve comunque un server di segnalazione e la riconnessione è più fragile.

## Consequences

### Positive

- Online subito, a costo zero, con lo stesso motore.
- Il registro della stanza fa anche da salvataggio: una partita si riprende rientrando nella stanza.

### Negative

- **Seed condiviso**: un client modificato può prevedere dadi e pile. Va bene solo tra persone che si fidano.
- **Dipendenza dall'host**: se l'host non c'è, la partita aspetta.
- **Tiro dei dadi a mano**: gli altri vedono un tiro automatico, perché il gesto non viaggia in rete.

### Neutral

Passare al server autorevole cambia chi scrive il registro, non il formato: seed e scelte restano gli
stessi.

## Risks

- **Regole di Firebase non pubblicate o sbagliate**: amici e inviti smettono di funzionare. È già
  successo il 2026-11-18.
  - Mitigazione: verificare dal vivo dopo ogni modifica a `database.rules.json`.

## GDD Requirements Addressed

- **#28 Lobby & Rooms**: stanze, codice, posti e inviti.
- **#29 Reconnection**: si rientra rigiocando il registro.
- **#27 Authoritative Server**: non coperto, rinviato.

## Performance Implications

Ogni scelta costa un'intenzione e una riga di registro, cioè pochi byte. La latenza è quella di Firebase
più il passaggio dall'host.

## Validation Criteria

- Test unitari di `room.ts`: creazione, ingresso, stanza piena, intenzioni accettate e rifiutate.
- Due browser nella stessa stanza vedono la stessa partita.

## Related

ADR-0002; `src/net/room.ts`, `src/net/firebase-store.ts`, `src/net/social.ts`, `database.rules.json`.
