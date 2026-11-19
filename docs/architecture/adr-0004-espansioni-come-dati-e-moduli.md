# ADR-0004: Le espansioni come dati JSON e moduli di regole accesi dalla preparazione

## Status

Accepted. In uso dal 2026-11-16 (Carnage at Devil's Run), messa per iscritto il 2026-11-19.

## Date

2026-11-19

## Last Verified

2026-11-19: `npm run test:unit`. Passano i test "leaves a game without the expansion as it was" e le
partite casuali con tutte le espansioni insieme.

## Decision Makers

L'utente (le espansioni vanno progettate come contenuto estendibile fin dall'inizio, CLAUDE.md),
Claude (stesura).

## Summary

Ogni espansione ha un file di dati in `data/trv/`, trascritto dal suo regolamento:
- `choppe_shoppe.json`;
- `carnage.json`;
- `big_rig_final_five.json`.

Il gioco base usa `game_base.json` e `catalog_base.json`.

Le regole dell'espansione sono un modulo del motore che si accende solo con il suo interruttore in
`Setup`. Senza l'interruttore la partita è identica al gioco base.

| Interruttore | Espansione | Come si accende |
|---|---|---|
| `leaders`, `upgrades` | Choppe Shoppe | per tutta la partita |
| `carnage` | Carnage at Devil's Run | per tutta la partita |
| `team` | Big Rig, Final Five | posto per posto |

## Engine Compatibility

Dati JSON importati da Vite (`import x from '../../data/trv/x.json'`) e letti dal motore TypeScript.

## ADR Dependencies

ADR-0002.

## Context

### Problem Statement

Prima il gioco base, poi le espansioni. Le regole del base non dovevano essere riscritte a ogni
espansione, e un errore di trascrizione doveva potersi correggere senza toccare il codice.

### Constraints

- Il regolamento è l'unica fonte. I numeri che non dà (conteggi, facce dei dadi) vengono dall'utente e
  devono stare nei dati insieme alla loro fonte.
- Le espansioni si combinano liberamente tra loro.

## Decision

- **Dati con le fonti**:
  - Le chiavi che iniziano con `_` sono note (`_note`, `_source`, `_rulings`, `_missing`) e il motore le salta.
  - Le decisioni dell'utente e della FAQ stanno in `_rulings`, con la data.
- **Il motore rifiuta ciò che non sa**:
  - Un valore mancante blocca l'espansione con un errore che lo nomina (`carnageNumbers`), invece di
    inventarlo.
  - Un caposquadra che dipende da una parte non attiva (`needs`) non viene distribuito.
- **Moduli nel motore**: le regole di un'espansione stanno nel motore, dietro un controllo sullo stato
  della partita, per esempio:
  - `g.carnage` per Carnage;
  - `hasPower` per un potere dei capisquadra;
  - `up(v, id)` per un potenziamento;
  - `v.rig` e `v.bike` per le squadre.
- **Testi in italiano** separati, in `cards_it.json` e `src/app/info.ts`. Le regole usano gli id, mai i testi.
- **Un GDD per espansione**: `choppe-shoppe.md`, `carnage-at-devils-run.md`, `big-rig-final-five.md`.

## Alternatives Considered

### Alternativa 1: sistema di plugin con handler registrati (punto di estensione puro, TD-SYSTEM-BOUNDARY)

È il disegno dell'indice dei sistemi: il nucleo non conosce nessuna regola. È stato rinviato. Con
quattro espansioni note e chiuse, un controllo diretto nel motore si legge più facilmente accanto al
regolamento. Può tornare utile se arrivano contenuti dei fan.

### Alternativa 2: espansioni scritte nel codice, senza file di dati

Ogni numero sbagliato richiederebbe una modifica al codice, e la fonte di ogni valore andrebbe persa.

## Consequences

### Positive

- I numeri si correggono nei dati, con la loro fonte accanto.
- Le espansioni si combinano liberamente, e le partite casuali dei test lo verificano.

### Negative

- `engine.ts` contiene le regole di tutte le espansioni e continua a crescere.
- Il criterio dell'indice ("un'espansione nuova si aggiunge senza toccare il nucleo") **non** è
  rispettato: un'espansione nuova tocca il motore.

### Neutral

Gli asset seguono la stessa divisione per gioco: `assets/base/`, `assets/choppe_shoppe/`,
`assets/carnage/`, `assets/big_rig/`.

## Risks

- **Interazioni tra espansioni che i regolamenti non coprono.** Mitigazione:
  - chiederle all'utente;
  - scriverle in `_rulings` e in `design/gdd/interpretations-log.md`;
  - aggiungere un test.

## GDD Requirements Addressed

- `game-concept.md`: prima il gioco base, poi le espansioni come contenuto estendibile.
- #4 Content Pack & Rule Modules, nella forma semplificata descritta sopra.

## Performance Implications

Nessuna: i dati sono piccoli e vengono caricati una volta sola.

## Validation Criteria

- Una partita senza espansioni è uguale al gioco base.
- Le partite casuali con ogni combinazione di espansioni finiscono sempre con un vincitore.

## Related

ADR-0002; `data/trv/`; `design/gdd/choppe-shoppe.md`, `carnage-at-devils-run.md`, `big-rig-final-five.md`.
