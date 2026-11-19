# Choppe Shoppe: capisquadra e potenziamenti

> **Status**: Bozza — scritta dopo l'implementazione (2026-11-19), in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-19
> **Fonte**: *Thunder Road: Vendetta, Part 4: Choppe Shoppe*, regolamento ufficiale
> `rulebook/TRV-CS_Rulebook.pdf` (fuori da git).
> Testi delle plance e delle carte: dalle scansioni dei componenti (`design/notes/espansioni-componenti.md`).
> Dati: `data/trv/choppe_shoppe.json`. Testi in italiano: `data/trv/cards_it.json` e `src/app/info.ts`.
> Full-Froth Injector e Spotter's Tower sono due carte aggiunte dall'utente il 2026-11-18: i
> potenziamenti sono 29 in tutto.

## Overview

L'espansione aggiunge due moduli, usabili insieme o separati.
- **Capisquadra**: una plancia comando che sostituisce quella normale. Ha un **potere speciale** sempre
  attivo, comandi propri e **segnalini comando** con cui usare un secondo comando nel turno.
- **Potenziamenti**: carte scelte a rotazione all'inizio della partita, una per auto, ognuna con
  un'abilità che vale solo per quell'auto.

Valgono solo per le squadre di auto. Big Rig e Final Five non partecipano alla scelta, ma possono
giocare nella stessa partita; i bot TRV9000 hanno le loro carte. Entrambi i moduli si accendono in
creazione partita, sia in hot seat sia online.

## Player Fantasy

- **Capisquadra**: avere un'identità. Il pilota più veloce, il cecchino, la meccanica, il clown che
  tampona: ogni plancia spinge verso uno stile di gioco.
- **Potenziamenti**: costruire la propria squadra. Il draft è un piccolo gioco di scelte: tenere la
  carta forte o togliere a chi sta a sinistra quella che gli serve. Poi si decide quale auto merita
  quale pezzo.

## Detailed Rules

### 1. Capisquadra: preparazione (p2)

1. I 15 segnalini comando formano una riserva.
2. Si mescolano le plance e se ne danno 2 a caso a ogni giocatore, che ne tiene **una** e scarta l'altra.
3. La plancia va accanto alle dashboard, **al posto** della plancia comando normale.
4. Il giocatore prende tanti segnalini comando quante sono le stelle in fondo alla plancia.

Nel gioco ci sono 11 plance. Una plancia che dipende da un'altra parte del gioco si distribuisce solo
quando quella parte è attiva (campo `needs` dei dati):
- **Ms. Betty**: solo con i potenziamenti.
- **Emberco**: solo con Carnage at Devil's Run.

### 2. Capisquadra: potere e comandi (p2)

- Il **potere speciale** in cima alla plancia vale sempre, senza assegnare un dado.
- Un comando con l'icona segnalino al posto del numero si attiva **solo** con un segnalino comando.
- I comandi stampati e i loro valori sono in `choppe_shoppe.json`. Cosa fa ogni comando nuovo è in
  `src/app/info.ts`, alla voce `CMD_LINES`.

| Caposquadra | Segnalini | Potere |
|---|---|---|
| Ms. Betty | 2 | Bring the Bling: nel draft tiene una carta in più, e la sua auto grande ne monta due |
| Bumpo the Clown | 0 | Junk in the Trunk: se una sua auto verrebbe mossa in uno slam, può ritirare il dado direzione |
| Abigail | 1 | Spotter: sparando, se un'altra sua auto operativa è adiacente al bersaglio, colpisce automaticamente |
| Asha | 3 | Jury-Rigging: ignora gli effetti dei danni, che restano coperti |
| Emberco | 2 | Smokin': il teschio del dado fuoco non ha effetto sulle sue auto |
| Vince Vamp | 1 | Soul Siphon: quando colpisce sparando, toglie un danno da una sua auto |
| Cruft | 0 | Trash into Treasure: entrando su un pericolo coperto prende un segnalino comando, poi lo gira |
| Cris Crass | 2 | Redline: un dado movimento da 6 assegnato a una sua auto vale 7 |
| Machine Gun Joe, Esq. | 2 | Objection!: sparando e mancando può ritirare il dado sparo |
| Madame Boudreaux | 2 | Third Eye: a inizio round guarda un pericolo coperto |
| Wong Lei Hong | 3 | Long Arm of the Law: può sparare a un bersaglio a due caselle |

Comandi nuovi delle plance:

| Comando | Caposquadra |
|---|---|
| Bump! | Bumpo |
| Pain Transfer | Vince |
| Need for Speed | Cris |
| Called Shot | Boudreaux |
| Tinker | Betty |
| Show Time, Flamethrower | Emberco |

### 3. Segnalini comando (p2)

- **Quando si usa**: una volta per turno si può mettere un segnalino su un comando che non ha già un
  dado o un altro segnalino. Si attiva nel passo Comando come se avesse un dado, anche in aggiunta al
  comando attivato con un dado: in quel turno si usano due comandi.
- **Limiti**: un solo segnalino per turno, e nessuno nel turno in cui si usa l'inerzia.
- **Valore**: su un comando che accetta un intervallo di valori, il segnalino vale il numero più basso.
  Esempio: Nitro 1-4 con un segnalino vale 1.
- **Fine round**: i segnalini usati tornano alla riserva.

### 4. Potenziamenti: draft e assegnazione (p2)

1. Si mescola il mazzo e si danno 4 carte a ogni giocatore.
2. Ognuno sceglie una carta e la mette coperta davanti a sé, poi passa le restanti al giocatore a sinistra.
3. Si ripete finché ognuno ha 3 carte; quelle non scelte tornano nella scatola.
4. Ognuno assegna una carta a ciascuna delle sue auto, coperta. Quando tutti hanno finito, le carte si
   girano insieme.

Nella versione digitale:
- **Online**: ogni giocatore vede subito la propria mano e sceglie senza aspettare gli altri (richiesta
  dell'utente, 2026-11-17). Le regole prendono comunque le scelte in ordine di posto.
- **Hot seat**: le scelte vengono una dopo l'altra.
- **Assegnazione**: la carta si trascina sull'auto.
- **Squadra TRV9000**: non tiene carte, perché le dà la sua carta squadra, ma la sua mano gira comunque al tavolo.

### 5. Potenziamenti: come valgono (p2)

- Un potenziamento vale **solo per la sua auto** e non si sposta più.
- Mentre l'auto è fuori uso il potenziamento è inattivo; torna attivo quando l'auto viene riparata.
  Nel motore `up(v, id)` è vero solo per un'auto operativa che non è un relitto.

I 29 potenziamenti per gruppo (testo completo in `cards_it.json`, riassunto in `info.ts`, `UPGRADE_INFO`):

| Gruppo | Carte |
|---|---|
| Sparo | Heavy Machine Gun, Rail Gun, Punt Gun, Rear Guns, Grappling Hook |
| Difesa dagli spari | Armor Plating, Smoke Screen, Stealth Technology |
| Slam | Roll Cage, Sandbags, Stability Control, Assault Bumper, Crumple Zones |
| Movimento | Ghost Mode, Skull Shift Knob, Boost Switch, Spoiler, Off-Road Suspension, Deep Treads, Full-Froth Injector |
| Pericoli e terreno | Tank Treads, Spotter's Tower, Snowplow, Oil Dispenser, Mine Dispenser, Anti-Aircraft Radar |
| Danni | Onboard Computer, Heavy Frame, Big Red Button |

## Formulas

Nessuna formula di bilanciamento. Le regole che contengono un numero:

- **Segnalino su un intervallo**: `valore = min(valori stampati del comando)`.
- **Redline**: se il dado assegnato è 6 il `movimento` vale 7, altrimenti vale il dado (`redline.from`,
  `redline.to`).
- **Carte tenute nel draft**: 4 per Ms. Betty (3 + 1), 0 per un TRV9000, 3 per tutti gli altri.
- **Giri del draft**: tanti quanto il massimo delle carte tenute. A ogni giro le mani ruotano di un posto.
- **Heavy Frame**: l'auto va fuori uso con `2 + n` danni; con `n = 1` sono 3.

## Edge Cases

- **Plance che finiscono**: con 4 giocatori si distribuiscono 8 plance. Se le plance disponibili
  finiscono (quelle dipendenti sono escluse), i giocatori rimasti tengono la plancia normale.
- **Segnalino e inerzia**: nel turno in cui si usa l'inerzia il segnalino non viene offerto.
- **Comando solo a segnalino senza segnalini**: non viene offerto, e nessun dado ci va mai.
- **Trash into Treasure con la riserva vuota**: non si guadagna nessun segnalino. Il motore non crea e
  non perde segnalini, e i test lo verificano.
- **Tinker con il mazzo vuoto**: si rimescolano gli scarti; se non ce ne sono, non succede nulla.
- **Bring the Bling**: la sua auto grande compare due volte tra i posti dell'assegnazione.
- **Auto fuori uso**: il suo potenziamento tace finché non viene riparata (per esempio, niente Heavy
  Frame o Armor Plating).
- **Big Red Button**: quando l'auto va fuori uso il proprietario può eliminarla. In quel caso elimina
  anche le auto e gli elicotteri adiacenti.
- **Third Eye**: il giocatore vede il tipo del pericolo guardato; il registro dice solo che ha guardato,
  non che cosa.
- **Stealth Technology e Smoke Screen**: un'auto protetta compare tra i bersagli "bloccati", con il
  motivo, perché l'interfaccia lo spieghi.

## Dependencies

| Sistema | Cosa serve da lì | Dove |
|---|---|---|
| #7 Match Setup | scelta dei capisquadra e draft dei potenziamenti a inizio partita | engine `chooseLeaders`, `draftUpgrades` |
| #11 Command Board | plancia del caposquadra al posto di quella normale, segnalini comando | engine `commandsOf`, `src/app/dock.ts` |
| #13 Slam, #14 Shooting, #15 Damage | i poteri e le carte che cambiano slam, spari e danni | engine `slam`, `shootFrom`, `damage` |
| #10 Movement, #12 Hazards | carte di movimento e di terreno, dispenser di mine e olio | engine `moveCar`, decisione `dispense` |
| #24 Menus | interruttori "capisquadra" e "potenziamenti" in creazione partita | `src/app/screens.ts`, `online.ts` |
| #32 TRV9000 | i bot non scelgono capisquadra; i loro potenziamenti vengono dalla carta squadra | [trv9000-bots.md](trv9000-bots.md) |
| Big Rig & Final Five | escluse da capisquadra e potenziamenti (CS p2, BRaFF p3) | [big-rig-final-five.md](big-rig-final-five.md) |
| Carnage at Devil's Run | Emberco e il fuoco | [carnage-at-devils-run.md](carnage-at-devils-run.md) |

## Tuning Knobs

Nessuna manopola di bilanciamento: i numeri sono dati dei componenti, in `choppe_shoppe.json`.

| Dato | Valore | Fonte |
|---|---|---|
| Segnalini comando in riserva | 15 | p2 |
| Plance date a testa | 2 | p2 |
| Carte date / tenute nel draft | 4 / 3 | p2 |
| Gittata di Long Arm of the Law | 2 | plancia |
| Redline | 6 → 7 | plancia |

Numeri stampati sulle carte (`n`):

| Carta | `n` |
|---|---|
| Ghost Mode | 2 |
| Rail Gun | 3 |
| Oil Dispenser, Mine Dispenser | 3 usi |
| Heavy Frame | 1 |
| Spoiler | 2 |
| Punt Gun | 2 |
| Tank Treads | 3 |
| Boost Switch | 1 |

## Acceptance Criteria

1. Con i capisquadra ogni giocatore di auto riceve due plance diverse tra quelle disponibili, ne tiene
   una e prende i segnalini stampati; senza capisquadra, tiene la plancia normale.
2. Ms. Betty compare solo con i potenziamenti, Emberco solo con Carnage.
3. Un dado va solo su un comando i cui valori lo comprendono, mai su un comando solo a segnalino.
4. Un segnalino si offre solo con segnalini in mano, su un comando libero, mai nel turno d'inerzia.
   Vale il numero più basso del comando e torna in riserva a fine round.
5. Ogni potere fa quanto dice la tabella del §2 (un test per potere).
6. Il draft dà 4 carte, ne fa tenere 3 a rotazione e mette una carta diversa su ogni auto. Online ognuno
   vede subito la propria mano.
7. Ogni potenziamento fa quanto dice la sua carta, solo per la sua auto e solo finché l'auto è operativa
   (un test per carta).
8. Con lo stesso seed e le stesse scelte, la stessa partita si rigioca identica, con capisquadra e potenziamenti.
9. Le partite casuali con capisquadra e potenziamenti finiscono sempre con un vincitore e non creano né
   perdono segnalini comando.
10. Ogni cambio di stato emette una riga di registro che ne dice la causa (criterio comune #1).

Test: `tests/unit/trv/choppe_shoppe.test.ts`, `tests/unit/trv/leaders_extra.test.ts`.

## Open Questions

Nessuna aperta.
