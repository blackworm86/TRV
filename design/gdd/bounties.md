# Bounties: una taglia segreta

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-22
> **Fonte**: carte *Bounties* (mini espansione, pagine 3-4 di
> `assets/sorgenti/TRV 02 All Expansions/TRV v2.pdf`, fuori da git): la carta delle regole e otto
> carte. Le ambiguità le decide l'utente (memoria `project-mini-espansioni`).
> Trascrizione: `data/trv/bounties.json`.

## Overview

A inizio partita ogni giocatore riceve una taglia coperta: un'impresa (riquadro viola) e un
premio (riquadro arancione). Quando la completa, può giocarla subito e riscuotere il premio;
giocata, esce dal gioco.

## Player Fantasy

Un incarico segreto che ti fa guidare in modo diverso dagli altri: restare indietro apposta,
cercare i pericoli, aspettare il momento per l'elicottero.

## Detailed Rules

1. Una taglia coperta a ogni persona, dopo le altre carte; i TRV9000 non ne ricevono.
2. Il gioco controlla l'impresa nel suo momento e, se è completa, chiede al proprietario se
   giocarla. Se la tiene, dovrà completarla di nuovo (decisione dell'utente, 2026-11-22).
3. La carta si gira in grande al centro del tavolo (mockup approvato); giocata, il premio si
   risolve subito.

| Taglia | Impresa (quando si controlla) | Premio |
|---|---|---|
| Down and Dirty | Inizio del proprio turno: almeno un veicolo sulla strada, nessuno su caselle di strada. | Si guardano tutti i pericoli coperti di una tessera scelta. |
| Frontrunner | Inizio del proprio turno: due propri veicoli in testa (o a pari merito). | Un danno in meno su un proprio veicolo. |
| Slow and Steady | Fine del round: nessun proprio veicolo davanti a un veicolo avversario. | Ogni proprio veicolo operativo muove fino a 3 caselle, solo in caselle vuote. |
| Pinball Wizard | Nel proprio turno avvengono due slam (tutti, decisione dell'utente). | Un dado movimento non usato va sul valore scelto. |
| Hit and Run | Uno sparo del giocatore rende fuori uso un veicolo (in qualsiasi turno). | Un dado movimento non usato va sul valore scelto. |
| Trash Collector | Nel proprio turno i propri veicoli entrano in due caselle con pericoli. | Un danno in meno su un proprio veicolo. |
| Death From Above | L'elicottero del giocatore elimina un veicolo. | Si piazza l'elicottero su una casella vuota e spara. |
| Rubbing Is Racing | Nel proprio turno viene eliminato un veicolo (qualsiasi). | Uno dei propri veicoli spara. |

## Formulas

- "Davanti": colonna del veicolo + 0,5 sulle righe dispari (le righe dispari stanno mezza casella
  avanti, `game_base.json`), come per il verme delle sabbie.
- Frontrunner: il secondo miglior valore proprio ≥ il miglior valore avversario.
- Slow and Steady: il miglior valore proprio ≤ il peggior valore avversario.
- Numeri dei dati: `slow_moves` = 3, `pinball_slams` = 2, `trash_hazards` = 2.

## Edge Cases

- I relitti non contano né come propri né come avversari; i veicoli fuori uso sì.
- Slow and Steady: ogni passo va in una delle sei caselle adiacenti vuote; si può fermare prima.
- Pinball Wizard / Hit and Run senza dadi liberi: la carta si gioca ma il premio non fa niente.
- Frontrunner / Trash Collector senza danni da togliere: il premio non fa niente.
- Death From Above dal 1° round: l'elicottero si piazza ma non spara (regola dell'attacco aereo).
- Un giocatore eliminato non riceve più domande sulla taglia.

## Dependencies

- Regole base (`rules-core.md`): slam, sparo, elicottero, pericoli, riparazione.
- One Shots (`one-shots.md`): la stessa domanda "giocare la carta?" (`offerOneShot`).
- TRV9000 (`trv9000-bots.md`): i bot non ricevono carte; possono essere bersagli.
- Interfaccia: `src/app/minis.ts` (mano in alto a sinistra) e `src/app/hud.ts` (la taglia
  completata al centro).

## Tuning Knobs

- `data/trv/bounties.json`: carte, testi, `slow_moves`, `pinball_slams`, `trash_hazards`.

## Acceptance Criteria

1. Con il modulo acceso ogni persona ha una taglia, i bot no.
2. Ogni taglia è proposta solo quando la sua impresa è completa, al proprietario.
3. Tenuta, resta in mano; giocata, esce dal gioco e il premio si risolve.
4. La partita si ricostruisce identica dalle scelte.

## Open Questions

Nessuna oltre a quelle elencate nel registro delle interpretazioni.
