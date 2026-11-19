# Carnage at Devil's Run: strade nuove, pericoli nuovi, fuoco

> **Status**: Bozza — scritta dopo l'implementazione (2026-11-19), in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-19
> **Fonte**: *Thunder Road: Vendetta, Part 3: Carnage at Devil's Run*, regolamento ufficiale
> `rulebook/TRV-CDR_Rulebook.pdf` (4 pagine, fuori da git; i numeri di pagina tra parentesi sono suoi).
> Trascrizione e decisioni: `data/trv/carnage.json` (`_rulings`, `_ongoing_interpretations`).
> Numeri che il regolamento non dà: dal foglio riassuntivo dei componenti e dalle scansioni delle carte
> forniti dall'utente il 2026-11-16. **FAQ**: `rulebook/faq_thunder_road_VO.docx`, citata come "FAQ".

## Overview

L'espansione aggiunge alla corsa:
- cinque **tessere strada** a due facce, con terreni nuovi: melma tossica, vetro del deserto, rampe,
  fuoco, piane di sale;
- sei **pericoli** nuovi: terremoto, verme delle sabbie, vetro, rampa, fuoco, trappola;
- due **danni** nuovi: in fiamme ed effetto continuo, con le 21 carte **effetto continuo**;
- il **dado fuoco** per i veicoli in fiamme (p2-p4).

È un **modulo di regole**: si accende in creazione partita, sia in hot seat sia online. Una partita
senza l'espansione resta identica al gioco base. Vale per tutte le squadre, comprese Big Rig, Final
Five e TRV9000.

## Player Fantasy

La strada stessa diventa un avversario:
- si sceglie se rischiare la rampa per saltare avanti o girarle intorno;
- si spera che il terremoto spinga fuori strada un rivale e non noi;
- si corre in fiamme sperando che il dado fuoco dia velocità invece del teschio;
- ci si trascina un'auto rovinata da un effetto continuo finché non c'è tempo di ripararla.

Ogni tessera nuova cambia la gara.

## Detailed Rules

### 1. Preparazione (p2)

1. Le 5 tessere nuove (10 facce) si mescolano con quelle del gioco base prima di piazzare la tessera di
   mezzo e quella di testa; si parte sempre da 1a *The Parking Lot* o 1b *Runway to Ruin*.
2. I 10 danni nuovi si mescolano nella pila dei danni; i 22 pericoli nuovi nella pila dei pericoli.
3. Le 21 carte effetto continuo formano un mazzo coperto a parte.
4. I segnalini IN FIAMME formano una riserva: nella scatola sono 12, in gioco sono **illimitati**
   (decisione dell'utente, 2026-11-16).

Le griglie delle 10 facce sono in `carnage.json`, alla voce `tiles`, trascritte dalle foto. Le rampe
stampate guardano tutte avanti.

### 2. Terreni nuovi (p3)

| Terreno | Codice | Effetto quando un veicolo su strada entra |
|---|---|---|
| Melma tossica | G | si ferma e perde i movimenti rimasti |
| Vetro del deserto | D | si sposta subito di una casella nella direzione in cui andava, senza spendere movimenti |
| Rampa | P | si entra solo dalla casella direttamente dietro: si tira il dado acrobazia, si salta dritto avanti di tante caselle ignorando quelle in mezzo, poi si perdono i movimenti; entrando da qualunque altra casella il veicolo è **eliminato** |
| Fuoco | F | il veicolo prende fuoco (segnalino IN FIAMME) |
| Piane di sale | S | in questo turno il veicolo può usare il dado strada anche se non ha percorso solo strada |

Decisione dell'utente (2026-11-16): una rampa si salta solo in avanti; entrarci di lato elimina il veicolo.

### 3. Pericoli nuovi (p3)

**Scartati dopo essere stati rivelati**
- **Terremoto**: si tira il dado direzione e tutti i veicoli su strada si spostano insieme di una
  casella in quella direzione.
  - Chi esce dai lati o dal retro, o finisce su una casella invalicabile, è eliminato.
  - Chi esce dal bordo davanti rivela la tessera nuova.
  - Le caselle d'arrivo rivelano i loro pericoli e applicano il terreno; i veicoli che finiscono nella
    stessa casella fanno slam.
  - FAQ: gli arrivi si risolvono "il più insieme possibile", altrimenti in ordine casuale. Qui tutti si
    spostano insieme, poi ogni arrivo si risolve in ordine casuale (dal seed).
- **Verme delle sabbie**: elimina il veicolo su strada più arretrato; a pari merito, li elimina tutti.
  Le righe dispari contano mezza casella più avanti.

**Restano sul tabellone**
- **Vetro del deserto**, **Rampa**, **Fuoco**: la casella diventa quel terreno, che colpisce subito il
  veicolo che l'ha rivelato.
- **Trappola**: si tira il dado sparo contro il veicolo che l'ha rivelata.
  - Se è un colpo, il veicolo è eliminato (cade nella buca).
  - Altrimenti resta sulla casella, che diventa invalicabile, e prosegue con i movimenti rimasti.
  - Decisione dell'utente: se non ha più movimenti resta sopra la buca ed è eliminato, anche se il tiro manca.

**Big Rig (FAQ)**: Sturdy impedisce al terremoto di spostarlo. Prende invece un danno minore su un
comando scelto dal suo giocatore, e nessuna casella diventa fuoristrada.

### 4. In fiamme e dado fuoco (p3)

Nel passo Movimento, prima di muovere un veicolo su strada in fiamme, si tira il dado fuoco.

| Faccia | Effetto |
|---|---|
| +1 / +2 | i movimenti del turno crescono di tanto, anche oltre 6, e vanno fatti tutti |
| Fumo | il fuoco si spegne, il segnalino torna nella riserva, il veicolo muove normalmente |
| Teschio | il veicolo è eliminato |

- Il segnalino IN FIAMME non è un danno.
- Se il veicolo va fuori uso, perde il segnalino.
- Un veicolo già in fiamme ignora un secondo segnalino.

### 5. Danni nuovi ed effetti continui (p4)

Quando arriva uno di questi danni si risolve l'effetto; se l'auto si stava muovendo, perde i movimenti
rimasti. Due danni rendono l'auto fuori uso, come nel gioco base.
- **In fiamme** (5 segnalini): l'auto prende un segnalino IN FIAMME, poi il danno va coperto nello slot.
- **Effetto continuo** (5 segnalini): si pesca una carta e la si mette scoperta in uno slot danno
  libero, con il danno coperto sopra.
  - Vale finché quel danno non viene riparato.
  - Alla riparazione, carta e danno vanno nei rispettivi scarti.

**Le carte.** Sono 11 tipi, 2 copie ciascuno tranne Cracked Flywheel (1): 21 carte in tutto. I testi
sono in `carnage.json` (`ongoing_effects`, dalle scansioni) e in italiano in `cards_it.json`.

**Come sono state lette** (in breve, da `_ongoing_interpretations`):
- **Bald Tires**: "il dado direzione sposta l'auto" vale per:
  - slam;
  - chiazza d'olio;
  - Dazed (a ogni passo);
  - Blast Off;
  - terremoto;
  - Loose Wiring.

  Dopo ciascuno, l'auto si sposta di una casella in più.
- **Cracked Flywheel**: finché nessuna auto del giocatore ha mosso in questo round, il primo dado va a lei.
- **Nitro Leak**: il dado movimento assegnato vale 6, ma un dado d'inerzia resta di un movimento. Uno
  slam che la coinvolge la elimina prima di risolversi.
- **Bent Frame**: quando un'altra auto la tampona, non si tira il dado slam e si sposta lei; anche un
  ritiro mantiene questo effetto.
- **Dead Alternator**: vale anche per il vincitore che taglia il traguardo.
- **Lost Tools**: "adiacente" vuol dire in una delle sei caselle intorno.
- **Transmission Failure**: il dado movimento vale 3 e non si aggiungono movimenti, nemmeno il bonus del fuoco.

### 6. Cosa vede il giocatore

| Cosa | Dove |
|---|---|
| Terreni e pericoli nuovi in 3D sul tavolo: fiamme, rampe, melma, vetro, sale | `src/view/terrain/carnage3d.ts` |
| Il verme che esce dalla sabbia | `src/app/worm.ts` |
| La trappola in cui l'auto cade prima che la buca esploda | `src/app/wreckage.ts` |
| Il dado fuoco tirato sul tavolo | — |
| La carta effetto continuo dentro lo slot danno della dashboard | — |
| Le fiamme sull'auto in fiamme | — |

## Formulas

Nessuna formula di bilanciamento: tutti i numeri sono componenti.

- **Salto dalla rampa**: `arrivo = partenza + valore del dado acrobazia`, in caselle dritto avanti.
- **Movimento in fiamme**: `movimenti = dado movimento + bonus fuoco` (bonus 1 o 2), senza il massimo di 6.
- **Verme**: `posizione = colonna + (riga dispari ? 0,5 : 0)`; sono eliminati tutti i veicoli con il
  valore più basso.

## Edge Cases

- **Melma e slam**: l'auto si ferma prima (perde i movimenti), poi avviene lo slam con il veicolo già lì.
- **Vetro in catena**: lo scivolamento entra in una casella nuova e ne applica il terreno. Può quindi
  finire su un'altra casella di vetro, su una rampa (da dietro o di lato) o su un pericolo coperto.
- **Rampa rivelata**: il veicolo che la rivela è già sulla casella; il terreno lo colpisce come se
  fosse entrato da dove veniva.
- **Terremoto oltre il bordo davanti**: la tessera nuova arriva prima che si risolvano gli arrivi.
- **Terremoto e arrivi**: tutti si spostano insieme, poi gli arrivi si risolvono uno a uno in ordine casuale.
- **Fuoco su un veicolo fuori uso**: il segnalino si toglie. Un nuovo fuoco su un veicolo già in
  fiamme si ignora.
- **Smokin' (Emberco, Choppe Shoppe)**: il teschio del dado fuoco non ha effetto sulle sue auto.
- **Mazzo degli effetti continui vuoto**: si rimescolano gli scarti; se non ce ne sono, il danno resta
  senza carta. È una scelta del motore: il regolamento non lo dice.

## Dependencies

| Sistema | Cosa serve da lì | Dove |
|---|---|---|
| #3 Board, Terrain & Front Arc | terreni nuovi nelle griglie delle tessere | `carnage.json` `tiles`, engine `terrainAt` |
| #7 Match Setup & Road Deck | tessere mescolate nella pila, pile dei pericoli e dei danni miste | engine `newGame` |
| #10 Movement | ingresso in casella che applica i terreni nuovi, salto, scivolamento | engine `enter`, `moveCar` |
| #12 Hazards & Wrecks | pericoli nuovi, trappola che diventa invalicabile | engine `enter` (pericoli rivelati), `placeHazards` |
| #13 Slam Resolution | slam dopo la melma e dopo il terremoto | engine `slam` |
| #15 Damage & Repair | danni nuovi, carta effetto continuo legata a un danno | engine `damageEffect`, `drawOngoing` |
| #2 Dice & Seeded RNG | dado fuoco e ordine casuale degli arrivi, dal seed | `src/core/rng` |
| Choppe Shoppe | Emberco (Show Time, Flamethrower, Smokin') solo con l'espansione | [choppe-shoppe.md](choppe-shoppe.md) |
| Big Rig & Final Five | Sturdy contro terremoto e fuoco | [big-rig-final-five.md](big-rig-final-five.md) |

## Tuning Knobs

Nessuna manopola di bilanciamento. I numeri sono dati, così un errore di trascrizione si corregge nel file.

| Dato | Valore | Fonte |
|---|---|---|
| Pericoli nuovi (22) | vetro 4, rampa 5, fuoco 6, trappola 4, terremoto 2, verme 1 | foglio riassuntivo, p2 |
| Danni nuovi (10) | in fiamme 5, effetto continuo 5 | foglio riassuntivo, p2 |
| Dado fuoco | +1, +2, +2, fumo, fumo, teschio | foglio riassuntivo |
| Carte effetto continuo | 21 (2 per tipo, Cracked Flywheel 1) | p2, scansioni |
| Transmission Failure | movimento 3 | confermato dall'utente |

La presentazione sta in `presentation_base.json`: fiamme, verme, caduta nella trappola e auto in pezzi
(voce `wreckage`).

## Acceptance Criteria

1. Con l'espansione le 10 facce nuove sono nella pila e la partita parte da 1a o 1b; senza, la partita
   è identica al gioco base.
2. Le pile dei pericoli e dei danni contengono i 22 e i 10 segnalini nuovi; il mazzo ha 21 carte.
3. Ogni terreno nuovo fa quanto dice la tabella del §2 (un test per terreno).
4. Una rampa presa da dietro fa saltare dritto di quanto dice il dado acrobazia; presa da altrove elimina.
5. Il terremoto sposta insieme tutti i veicoli su strada, elimina chi esce di lato o dal retro e fa
   rivelare la tessera a chi esce davanti.
6. Il verme elimina tutti i veicoli più arretrati a pari merito.
7. La trappola elimina solo con un colpo, poi resta invalicabile; senza movimenti rimasti elimina sempre.
8. Il dado fuoco si tira prima di muovere: il teschio elimina, il fumo spegne, i +1/+2 vanno usati tutti.
9. Una carta effetto continuo resta finché il suo danno non viene riparato e fa quanto dice (un test per carta).
10. Partite casuali con l'espansione, anche insieme alle altre espansioni e ai TRV9000, finiscono sempre
    con un vincitore.
11. Ogni cambio di stato emette una riga di registro che ne dice la causa (criterio comune #1).

Test: `tests/unit/trv/carnage.test.ts`.

## Open Questions

Nessuna aperta. Le letture degli effetti continui (§5) vanno confermate con l'utente se un caso si
presenta in partita (ultima voce di `_ongoing_interpretations`).
