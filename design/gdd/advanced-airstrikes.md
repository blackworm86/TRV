# Advanced Airstrikes: una carta per l'elicottero

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-22
> **Fonte**: carte *Advanced Airstrikes* (mini espansione, pagine 5-6 di
> `assets/sorgenti/TRV 02 All Expansions/TRV v2.pdf`, fuori da git): la carta delle regole e dieci
> carte. Le ambiguità le decide l'utente (memoria `project-mini-espansioni`).
> Trascrizione: `data/trv/advanced_airstrikes.json`.

## Overview

A inizio partita ogni giocatore riceve una carta Advanced Airstrike coperta. La carta dice quando
si può giocare; giocata, esce dal gioco. Funziona come One Shots, ma ogni carta riguarda
l'elicottero.

## Player Fantasy

Il pilota ha un asso da giocare: un missile contro l'altro elicottero, un volo radente, un
pacchetto lasciato sulla strada.

## Detailed Rules

1. Una carta coperta a ogni persona; i TRV9000 non ne ricevono.
2. Nel momento scritto sulla carta il gioco chiede al proprietario se giocarla (la carta vera nel
   riquadro della domanda).

| Carta | Momento | Effetto |
|---|---|---|
| Dual Guns | L'elicottero spara e manca | Si ritira il dado sparo. |
| Care Package | L'elicottero lascia una casella | Un pericolo coperto della riserva nella casella lasciata (se vuota). |
| Strafing Run | Dopo che l'elicottero ha sparato | L'elicottero va in una casella vuota qualsiasi. |
| Discerning Pilot | Un proprio veicolo finisce nella casella del proprio elicottero | L'elicottero va in una casella vuota invece di eliminare il veicolo. |
| Air to Air Missile | Si piazza l'elicottero | Si spara a un elicottero avversario: un colpo a un bersaglio medio lo elimina. |
| Low Flying | Si piazza l'elicottero | Lo si mette su una casella con un pericolo scoperto, che si scarta. |
| Scouting Mission | Si piazza l'elicottero | Si guardano i pericoli coperti adiacenti all'elicottero. |
| Trick Shot | Si piazza l'elicottero (dal 2° round) | L'elicottero spara a qualsiasi casella adiacente invece che al suo arco frontale. |
| Target Practice | L'elicottero colpisce un'auto | Si pescano due segnalini danno e si sceglie quale subisce il bersaglio; l'altro si scarta. |
| Bag of Wrenches | Si piazza l'elicottero | Un danno in meno a un veicolo adiacente all'elicottero. |

## Formulas

- Air to Air Missile: colpisce con le facce del dado sparo che colpiscono un bersaglio medio
  (`M`, `SM`, `ANY`).

## Edge Cases

- Bag of Wrenches vale per qualsiasi veicolo adiacente (anche avversario), non per il Big Rig.
- Low Flying vale per qualsiasi pericolo scoperto, non su caselle con veicoli o elicotteri, non
  su una tessera Windy.
- Care Package solo se la casella lasciata è vuota.
- Target Practice vale per le auto, non per moto, Big Rig o relitti.
- Strafing Run è proposta solo se l'elicottero ha davvero sparato.

## Dependencies

- Regole base (`rules-core.md`): attacco aereo, elicottero, sparo, danno.
- One Shots (`one-shots.md`): la stessa domanda (`offerOneShot`).
- Road Conditions (`road-conditions.md`): Windy e Sandstorm cambiano dove l'elicottero va e spara.
- Bounties (`bounties.md`): Death From Above guarda le eliminazioni dell'elicottero.
- Interfaccia: `src/app/minis.ts`, `src/app/hud.ts`.

## Tuning Knobs

- `data/trv/advanced_airstrikes.json`: carte e testi. Ogni momento ha il suo punto nel motore.

## Acceptance Criteria

1. Con il modulo acceso ogni persona ha una carta, i bot no.
2. Ogni carta è proposta solo nel suo momento e solo al proprietario; giocata, esce dal gioco.
3. Ogni carta produce l'effetto della tabella.
4. La partita si ricostruisce identica dalle scelte.

## Open Questions

Nessuna oltre a quelle elencate nel registro delle interpretazioni.
