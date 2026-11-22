# Road Conditions: ogni tessera ha la sua condizione

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-22
> **Fonte**: carte *Road Conditions* (mini espansione, pagine 4-5 di
> `assets/sorgenti/TRV 02 All Expansions/TRV v2.pdf`, fuori da git): la carta delle regole e otto
> carte. Le ambiguità le decide l'utente (memoria `project-mini-espansioni`).
> Trascrizione: `data/trv/road_conditions.json`.

## Overview

Ogni tessera strada piazzata riceve una carta Road Condition scoperta: la regola della carta vale
su quella tessera, per tutti (TRV9000 compresi). A inizio partita la ricevono la tessera centrale
e quella di testa, non quella di partenza.

## Player Fantasy

La strada cambia sotto le ruote: ghiaccio, predoni, tempeste di sabbia. Ogni tessera nuova è una
sorpresa da leggere prima di lanciarsi.

## Detailed Rules

1. Il mazzo di 8 carte si mescola a inizio partita (`road-conditions`); si scoprono due carte per
   la tessera centrale e quella di testa.
2. Quando la tavola avanza, la carta della tessera che esce va negli scarti (decisione
   dell'utente) e la nuova tessera di testa riceve la carta successiva; finito il mazzo, si
   rimescolano gli scarti.

| Carta | Effetto |
|---|---|
| Icy | Quando il dado direzione muove un veicolo che era su questa tessera (olio, slam, scosse, cavi allentati), il veicolo va di una casella in più nella stessa direzione. |
| Marauders | A fine turno, il veicolo mosso dal giocatore, se è in testa (o pari) su questa tessera, subisce uno sparo con il dado sparo normale (decisione dell'utente). |
| Blockaded | Dopo un pericolo coperto risolto su questa tessera, il giocatore mette un pericolo coperto della riserva su una casella vuota della tessera. |
| Guardrails | Un veicolo che uscirebbe dal lato della tessera va invece in una casella adiacente scelta dal proprietario (se occupata, slam). |
| Windy | Non si piazzano elicotteri su questa tessera. |
| Tremors | A inizio round si tira il dado direzione e tutti i veicoli della tessera si spostano insieme (regole normali di movimento, decisione dell'utente). |
| Torrential Downpour | Un veicolo che entra nel fango su questa tessera perde i movimenti rimasti. |
| Sandstorm | Da questa tessera si spara solo alla casella dritta davanti. |

## Formulas

- Tessera di una casella = `floor(colonna / 8)`; "in testa" come in `bounties.md` (colonna + 0,5
  sulle righe dispari).

## Edge Cases

- Tremors non muove il Big Rig (non è il segnalino Terremoto: niente danno).
- Marauders contro il Big Rig: il colpo va su un comando come uno sparo normale.
- Marauders non spara agli elicotteri.
- Guardrails vale per i lati (righe fuori dal tavolo), non per il davanti o il dietro.
- Windy: un elicottero già sulla tessera resta dov'è.
- Sandstorm vale anche per l'elicottero e prevale sugli archi estesi dei potenziamenti.

## Dependencies

- Regole base (`rules-core.md`): avanzamento della tavola, dado direzione, pericoli, sparo.
- Carnage at Devil's Run (`carnage-at-devils-run.md`): il terremoto, di cui Tremors riusa il movimento.
- Big Rig (`big-rig-final-five.md`), TRV9000 (`trv9000-bots.md`): la condizione vale anche per loro.
- Interfaccia: `src/app/minis.ts` (bandierina gialla per tessera, la carta si apre puntandola).

## Tuning Knobs

- `data/trv/road_conditions.json`: carte e testi. Ogni effetto ha il suo punto nel motore.

## Acceptance Criteria

1. Con il modulo acceso, la tessera di partenza non ha carta, le altre due sì.
2. Avanzando, la carta della tessera uscita va negli scarti e la nuova tessera ne riceve una.
3. Ogni condizione vale solo sulla sua tessera, come nella tabella.
4. La partita si ricostruisce identica dalle scelte.

## Open Questions

Nessuna oltre a quelle elencate nel registro delle interpretazioni.
