# ADR-0001: Il client del gioco in src/app, diviso per argomento

## Status

Accepted. L'utente ha approvato il piano di spostamento ("Sì, parti", 2026-11-17).

## Date

2026-11-17

## Last Verified

2026-11-17: verificato con `npx tsc --noEmit -p .`, `npm run test:unit` (222 test),
`npm run test:e2e` (6 test sul gioco vero) e `npm run build:pages`.

## Decision Makers

L'utente (approvazione del piano), Claude (stesura ed esecuzione).

## Summary

Il gioco è nato come prototipo in `prototypes/trv-play-spike/`, con un solo `main.ts` di oltre
diecimila righe. Era però già il gioco pubblicato sul sito. Ora il client vive in `src/app/`,
diviso in moduli per argomento. Le pagine sono alla radice e i valori di regia stanno in un file
di dati. Le regole restano nel motore (`src/game/trv/`), che il client non modifica.

## Engine Compatibility

Web: Vite 8.3.4, TypeScript 7.0.2, three.js 0.186.1 (vedi `docs/engine-reference/web/VERSION.md`).
Nessuna API nuova: cambia solo dove sta il codice. La costruzione multipagina usa
`build.rolldownOptions.input` di Vite 8, come prima.

## ADR Dependencies

Nessuna: è la prima ADR del progetto.

## Context

### Problem Statement

Il codice del gioco stava sotto una cartella `prototypes/`, che per le regole del progetto è
usa e getta. Il sito e gli inviti online puntavano a `prototypes/trv-play-spike/`. Il file unico
era difficile da leggere e da far leggere agli agenti, e nessuna sua parte aveva test.

### Current State (prima)

- `prototypes/trv-play-spike/main.ts` (~10 000 righe), con lo stile nell'`index.html`.
- Accanto c'erano `admin.ts`, `gallery.ts`, `models.ts` e `models-config.ts`.
- La radice aveva ancora la pagina e il codice del modello vuoto (`src/main.ts`,
  `src/game/rules.ts`).
- Molte costanti di presentazione (tempi, salti, telecamere) erano scritte nel codice.

### Constraints

- I modelli e le regole non cambiano: il comportamento del gioco deve restare identico.
- I vecchi indirizzi (inviti a stanze online già mandati) devono continuare a funzionare.
- Il regolamento non va in git.

### Requirements

- Una rete di test sul gioco vero prima di spostare qualunque cosa, per accorgersi dei cambiamenti.
- Valori di presentazione in dati esterni (standard di codice del progetto).
- Test unitari sulle parti pure.

## Decision

- **Pagine alla radice**: `index.html` (il gioco), `admin.html`, `gallery.html`, `models.html`.
- **Codice del client in `src/app/`**: un modulo per argomento, tra cui `stage`, `board`, `cars`,
  `chase`, `director`, `mapView`, `tableDice`, `hud`, `hand`, `online`, `replay`, `menus` e
  altri, con lo stile in `styles.css`. `main.ts` importa i moduli in ordine e avvia il gioco.
- **Stato condiviso** in `src/app/state.ts`: un solo oggetto `S`, perché un `let` importato non si
  può riassegnare da un altro modulo.
- **Moduli di base senza dipendenze verso l'alto**: `util`, `settings`, `stage`, `board` e `state`
  non importano moduli più alti. Le importazioni circolari di ESM darebbero errori di
  inizializzazione (TDZ).
- **Altri strumenti**: `src/admin/admin.ts`, `src/tools/gallery.ts`, `src/tools/models.ts`,
  `src/view/models-config.ts`.
- **Valori di regia** in `data/trv/presentation_base.json` (chiavi snake_case), letti da
  `src/app/presentation.ts`, che li converte in camelCase (`P`).
- **Parti pure con test**:
  - `src/app/stunts.ts` (scelta dell'acrobazia di un salto);
  - `src/app/spots.ts` (posto libero per i dadi sul tavolo);
  - i test sono in `tests/unit/app/`.
- **Vecchi indirizzi**: `tools/pages/finish.mjs` scrive in `prototypes/trv-play-spike/` pagine che
  rimandano alla radice tenendo query e hash.

### Key Interfaces

- `window.trv`: aggancio per i test Playwright (stato della partita, telecamera, viste), definito
  in `src/app/main.ts`.
- `P` (`src/app/presentation.ts`): tutti i valori di regia letti dal client.

## Alternatives Considered

### Alternativa 1: lasciare il gioco in prototypes/

Costo zero subito. Però avrebbe lasciato il codice del prodotto in una cartella che le regole
dichiarano usa e getta, con un file ingestibile. Scartata.

### Alternativa 2: riscrivere il client con un'architettura nuova (componenti, framework UI)

Più pulito sulla carta, ma con un alto rischio di cambiare il comportamento. Il valore del
prototipo sta proprio nel comportamento, verificato dal vivo con l'utente. Scartata a favore di
uno spostamento meccanico protetto dai test.

## Consequences

### Positive

- Il codice si legge per argomento.
- I test Playwright proteggono il gioco intero.
- I valori di regia si cambiano senza toccare il codice.

### Negative

- Lo stato condiviso `S` e l'ordine delle importazioni sono vincoli da rispettare.
- Molti moduli dipendono ancora l'uno dall'altro.

### Neutral

- Il README del prototipo resta come registro delle decisioni prese durante la prova.

## Risks

- Un nuovo modulo di base che importa verso l'alto rompe l'avvio. Il test `@boot`
  (`npm run smoke`) lo scopre.

## GDD Requirements Addressed

Nessun requisito di GDD: è una decisione sulla struttura del codice.

## Performance Implications

Nessuna: lo stesso codice, raggruppato da Vite in un unico bundle.

## Migration Plan

Fatto in sei tappe, una per commit:

0. Rete di test Playwright.
1. Pagine alla radice.
2. Rimandi dai vecchi indirizzi.
3. Divisione in moduli.
4. Dati di regia.
5. Test unitari.
6. Documenti.

## Validation Criteria

- Type check pulito.
- Test unitari e test sul gioco verdi.
- Immagini delle viste uguali entro la tolleranza.
- Un vecchio invito `prototypes/trv-play-spike/?room=…` apre la stanza alla radice.

## Related

- `prototypes/trv-play-spike/README.md`: registro del prototipo.
- `docs/handoff.md`: dove sta il codice.
- `docs/deploy.md`: sito e indirizzi.
