# ADR-0005: Le regole emettono fotogrammi, il client li riproduce come beat con la regia nei dati

## Status

Accepted. In uso dal 2026-11-16, messa per iscritto il 2026-11-19.

## Date

2026-11-19

## Last Verified

2026-11-19: `npx tsc --noEmit -p .`, `npm run test:unit`, `npm run test:e2e`.

## Decision Makers

L'utente (ritmo delle animazioni: la mossa successiva e la vittoria aspettano il tavolo fermo,
2026-11-18), Claude (stesura).

## Summary

Il motore non sa nulla di animazioni. A ogni momento visibile aggiunge un `Frame` a `g.frames`, con lo
stato del tavolo subito dopo (`snap`). Sono momenti visibili, per esempio, un'auto che entra in una
casella, un dado, uno slam, uno sparo, un danno, un'eliminazione o una tessera nuova.

Il client (`src/app/beats.ts`, `loop.ts`) mette i fotogrammi in coda e li riproduce uno per volta come
**beat**, con:
- le durate;
- le telecamere (`shots.ts`, `director.ts`);
- gli effetti (`effects.ts`, `wreckage.ts`).

I numeri di regia stanno in `data/trv/presentation_base.json`.

## Engine Compatibility

three.js 0.186.1 per il tavolo. I fotogrammi sono dati puri (JSON).

## ADR Dependencies

ADR-0001 (moduli del client), ADR-0002 (le regole non leggono i fotogrammi).

## Context

### Problem Statement

Le regole risolvono uno slam a catena in un istante, ma il giocatore deve vederlo passo per passo e
capire ogni dado (Pilastro 2). Online, e quando si rivede la partita, ogni tavolo deve mostrare la
stessa sequenza.

### Constraints

- Le regole non devono aspettare le animazioni né dipendere da esse.
- I valori di presentazione stanno nei dati, non nel codice (standard del progetto).

## Decision

- **`Frame`**: ogni fotogramma ha un `kind`:

  | Gruppo | `kind` |
  |---|---|
  | Movimento | `move`, `jump` |
  | Dadi e scontri | `roll`, `slam`, `shot` |
  | Danni ed eliminazioni | `damage`, `elim`, `fire` |
  | Tavolo | `reveal`, `tile`, `round`, `chopper`, `order` |
  | Registro | `log` |

  Porta inoltre i campi che servono allo spettacolo (`at`, `from`, `into`, `die`, `by`…) e `snap`.
  Sono dati di presentazione: le regole non li leggono mai.
- **Coda**: `playBeats` accoda i fotogrammi; `applyBeat` disegna il tavolo dello `snap` e avvia gli effetti.
- **Attesa**: la fase successiva aspetta che il tavolo sia fermo (`settled()`), tranne per gli effetti
  che restano (`lingers`).
- **Pause del giocatore**: possono stare dentro la coda senza toccare le regole. Il tiro dei dadi a mano
  (`handroll.ts`) ferma la riproduzione prima di un tiro, perché il seed ha già deciso il risultato.
- **Regia**: inquadrature (`director.shots`), tempi e dimensioni degli effetti (`wreckage`, dadi,
  verme…) stanno in `presentation_base.json` e vengono letti da `presentation.ts` (`P`).
- **Saltare**: "salta" svuota la coda. Scrive le righe del registro, lascia i dadi fermi sul tavolo e
  disegna l'ultimo `snap`.

## Alternatives Considered

### Alternativa 1: animazioni chiamate dalle regole (callback o await nel motore)

Avrebbe legato le regole al browser e al tempo: niente test veloci e niente rigioco istantaneo.

### Alternativa 2: differenza tra lo stato prima e dopo, animata dal client

Il client non saprebbe perché un'auto si è mossa (slam, terremoto, olio) né in che ordine: la causa si perde.

## Consequences

### Positive

- Le regole restano pure e veloci. Le animazioni si rifanno senza toccarle (lavoro aperto: regia nuova
  e animazioni contestuali).
- Rigioco, replay e rete mostrano la stessa sequenza.

### Negative

- Ogni fotogramma copia lo stato del tavolo, quindi una partita lunga occupa più memoria. Finora è accettabile.
- Un'animazione nuova a volte richiede un campo nuovo nel `Frame`, per esempio `by: 'pit'` o `at`
  nell'eliminazione.

### Neutral

La telecamera "inseguimento" è spenta (`chase.enabled: false`) in attesa di essere rifatta.

## Risks

- **Un effetto che non finisce blocca `settled()`.** Mitigazione: ogni effetto ha una `life` finita.

## GDD Requirements Addressed

#25 Animation & Pacing; #22 Cause Log; `camera-director.md`.

## Performance Implications

Il costo sta nel disegno 3D, non nella coda. La qualità grafica si regola in `quality.ts`.

## Validation Criteria

- I test di Playwright (`tests/integration/game.spec.ts`) giocano turni veri e confrontano il tavolo.
- Le schermate in `production/qa/evidence/` mostrano gli effetti.

## Related

ADR-0001, ADR-0002; `src/app/beats.ts`, `loop.ts`, `shots.ts`, `presentation.ts`,
`data/trv/presentation_base.json`.
