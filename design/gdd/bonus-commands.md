# Bonus Commands: un comando in più a testa

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-22
> **Fonte**: carte *Bonus Commands* (mini espansione, pagina 1 di
> `assets/sorgenti/TRV 02 All Expansions/TRV v2.pdf`, fuori da git): la carta delle regole e otto
> carte. Non c'è un regolamento: le ambiguità le decide l'utente (memoria `project-mini-espansioni`).
> Trascrizione: `data/trv/bonus_commands.json`.

## Overview

A inizio partita ogni giocatore riceve una carta Bonus Command scoperta: è un comando in più,
accanto a quelli della plancia. Si attiva come gli altri, con un dado movimento del valore
stampato nel rombo della carta, oppure con un segnalino comando. È un modulo che si accende in
creazione partita (hot seat e online) e non cambia nulla quando è spento.

## Player Fantasy

Ogni squadra ha il suo trucco di officina: il razzo sul tetto, le punte sulle gomme, il pilota
automatico. Lo si vede da subito, e gli avversari sanno cosa aspettarsi.

## Detailed Rules

### 1. Preparazione

Dopo capisquadra e potenziamenti (se in gioco) il mazzo di 8 carte si mescola e se ne dà una
scoperta a ogni persona; i TRV9000 non ne ricevono.

### 2. Attivarla

1. **Con un dado** (decisione dell'utente, 2026-11-22): la carta prende il posto del comando del
   round. Nel passo Comando, tra i comandi possibili compare la carta per ogni dado libero del
   valore giusto (`range`: `ANY` qualsiasi, `6`, `5-6`, `3-6`, `3-4`). Usata così, il comando del
   round è speso.
2. **Con un segnalino comando**: come sui comandi della plancia, più comandi nello stesso turno,
   mai lo stesso due volte; la carta conta come un comando a sé. Il segnalino vale il valore più
   basso del rombo (`ANY` vale 1).
3. Una volta per round: il dado o il segnalino resta sulla carta fino al round dopo; il segnalino
   torna nella riserva come quelli della plancia.
4. **Final Five e Big Rig** la usano come le auto (decisione dell'utente, 2026-11-22). I Final
   Five la trovano tra le scelte del dado, accanto ai comandi della plancia: prende il posto del
   comando del round. Il Big Rig, che non ha un comando del round, può mettere sulla carta un dado
   libero del valore giusto una volta per round, prima del dado sulla sezione, purché gli resti un
   dado per la sezione di quel turno.

### 3. Le otto carte

| Carta | Rombo | Effetto nel gioco |
|---|---|---|
| Tire Spikes | 5-6 | In questo turno, uno slam della propria auto che sposta un'auto in una casella vuota le dà un danno (come il potenziamento omonimo). |
| Rocket Fuel | qualsiasi | In questo turno il dado strada vale il dado sulla carta; quei movimenti vanno solo dritti in avanti. |
| Rapid Reload | 6 | Il prossimo sparo del turno è seguito da un secondo, a un bersaglio diverso. |
| Positraction | qualsiasi | In questo turno il fango è strada per i propri veicoli. |
| Torque Booster | qualsiasi | Si ritirano i dadi non ancora assegnati. |
| Nav System | 3-6 | Il primo pericolo coperto in cui si entra nel turno va in una casella vuota adiacente, senza essere scoperto. |
| Hands Free | 5-6 | Si tira il dado direzione e l'auto attiva (decisione dell'utente) muove in quella direzione fino al valore del dado. |
| Targeting AI | 3-4 | In questo turno, un'auto colpita prende il segnalino danno che sceglie chi spara, dalla riserva. |

## Formulas

- Valore di un segnalino sulla carta = minimo del rombo; `ANY` = faccia più bassa del dado
  movimento (1). Esempio: Hands Free con un segnalino muove fino a 5 caselle.
- Hands Free: caselle percorse `n` ∈ [0, valore del dado], scelte dal giocatore.

## Edge Cases

- Rocket Fuel con un segnalino: il dado strada vale 1.
- Rocket Fuel vale solo per i veicoli del giocatore di turno e solo quando si usa il dado strada.
- Torque Booster con tutti i dadi assegnati: non succede niente.
- Hands Free con l'auto ancora nella zona di partenza: non succede niente (lo dice la cronaca).
  Un movimento fuori dal bordo o su una casella invalicabile elimina come sempre.
- Targeting AI vale per le auto (non per moto, Big Rig o relitti), come dice la carta.
- Rapid Reload: se non c'è un secondo bersaglio, il secondo sparo non avviene.
- I dadi del Big Rig hanno le facce 1-3: le carte con il rombo 5-6 o 6 (Tire Spikes, Rapid
  Reload, Hands Free) non si possono attivare con un dado del Big Rig. Hands Free comunque non
  sposterebbe il Big Rig, che si muove solo con le sue regole.

## Dependencies

- Regole base (`rules-core.md`): comandi, dadi, dado strada, slam, sparo.
- Choppe Shoppe (`choppe-shoppe.md`): i segnalini comando.
- TRV9000 (`trv9000-bots.md`): i bot non ricevono carte.
- Big Rig e Final Five (`big-rig-final-five.md`): ricevono la carta e la usano come le auto (§2.4).
- Interfaccia: `src/app/minis.ts` (la carta sopra la plancia dei comandi, ci si trascina il dado
  o il segnalino).

## Tuning Knobs

- `data/trv/bonus_commands.json`: carte, testi italiani e `range` di ogni rombo. Cambiare il
  `range` cambia i dadi accettati; aggiungere una carta richiede il suo effetto nel motore.

## Acceptance Criteria

1. Con il modulo acceso ogni persona ha una carta, i bot no; spento, nessuno.
2. La carta compare tra i comandi solo con un dado del valore giusto e solo se il comando del
   round non è stato usato; usata, il comando del round è speso.
3. Un segnalino può andare sulla carta una volta per round e torna nella riserva al round dopo.
4. Ogni carta produce l'effetto della tabella, solo nel turno in cui è attivata.
5. La partita si ricostruisce identica dalle scelte.

## Open Questions

Nessuna.
