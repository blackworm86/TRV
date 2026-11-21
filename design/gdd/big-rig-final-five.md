# The Big Rig and the Final Five: due nuove squadre

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-18
> **Fonte**: *Thunder Road: Vendetta, Part 2: The Big Rig and the Final Five*, regolamento
> ufficiale `rulebook/TRV-BRaFF_Rulebook.pdf` (8 pagine, fuori da git). Trascrizione:
> `data/trv/big_rig_final_five.json` (i numeri di pagina tra parentesi sono del regolamento).
> Dati confermati dall'utente il 2026-11-18: facce dei dadi, simboli delle moto, segnalini fuoristrada.
> **FAQ**: `rulebook/faq_thunder_road_VO.docx` (domande e risposte raccolte su BoardGameGeek, fornite
> dall'utente il 2026-11-18, fuori da git); citate qui come "FAQ".

## Overview

L'espansione aggiunge due **squadre** che un giocatore può scegliere al posto delle tre auto: il
**Big Rig**, un camion lungo tre caselle che avanza come un treno e si guida con un comando di sterzo,
e le **Final Five**, cinque moto piccole e fragili che passano in mezzo a tutti. Si giocano insieme o
separate, con le squadre del gioco base e delle altre espansioni (p2), ma non usano capisquadra né
carte potenziamento di Choppe Shoppe (p3). Entrambe usano i **danni minori**, segnalini senza effetto
che riempiono solo uno spazio danno (p3).

Come le altre espansioni è un **modulo di regole**: si accende scegliendo una delle due squadre in
creazione partita (hot seat e online) e non cambia nulla per chi non la sceglie, salvo le regole che
riguardano le auto che interagiscono con loro (tamponamenti, colpi del lanciamissili, danni minori).

## Player Fantasy

- **Big Rig**: essere il bestione della strada. Lento a cambiare corsia, ma niente lo ferma: passa
  sopra i muri, attraverso il fuoco e il fango, spinge via le auto con il rostro, lascia trappole
  dietro di sé e spara avanti e indietro. Si vince gestendo bene lo sterzo del round e scegliendo
  quale sezione sacrificare ai colpi.
- **Final Five**: essere uno sciame. Cinque moto veloci che sgusciano tra le auto senza tamponarle,
  due per turno, che cadono al primo colpo ma si rialzano. Si vince con il numero e la mobilità.
- Per gli altri giocatori: un bersaglio enorme e coriaceo da smontare pezzo per pezzo, e cinque
  moto da abbattere che non si fermano mai.

## Detailed Rules

### 1. Scelta della squadra e preparazione (p3)

1. In creazione partita, al posto di una squadra di auto, un giocatore può scegliere il **Big Rig** o
   le **Final Five**. Ogni squadra può essere scelta al massimo una volta. Il colore resta quello della
   squadra scelta nella riga del giocatore (come per le auto). Un solo giocatore per partita può avere
   il Big Rig e un solo giocatore le Final Five (confermato dall'utente il 2026-11-18).
2. Se la partita usa Choppe Shoppe, quel giocatore **non** sceglie un caposquadra, **non** riceve
   segnalini comando né carte potenziamento; gli altri giocatori sì.
3. **Big Rig**: le tre sezioni (posteriore, centrale, anteriore) partono nell'area di partenza; il
   giocatore riceve la plancia della motrice, la plancia delle sezioni, i **4 dadi del Big Rig**
   (facce 1, 1, 1, 2, 2, 3), un elicottero e **10 danni minori**.
4. **Final Five**: le cinque moto partono nell'area di partenza; il giocatore riceve la plancia
   comandi delle Final Five, i 5 cruscotti in fila, **6 dadi movimento** (facce 1-6), un elicottero e
   **5 danni minori**.
5. Le plance a schermo le disegna l'utente, nello stile di quelle del gioco base; finché non ci sono,
   il gioco usa segnaposto con le stesse informazioni.
6. **Tiro per il primo giocatore**: il regolamento non ne parla. Ogni squadra tira **i propri dadi**
   (Final Five 6 dadi 1-6, Big Rig 4 dadi 1-1-1-2-2-3) e parte chi fa il totale più basso, come nel
   gioco base; quei dadi sono anche quelli del primo round (deciso dall'utente il 2026-11-18).

### 2. Danni minori (p3)

1. Un danno minore occupa uno spazio danno e **non ha altro effetto**. Si ripara come gli altri danni.
2. Se i danni minori di quella squadra sono finiti, se ne usa uno **coperto e senza effetto** (nel
   gioco digitale: un danno minore in più, contato allo stesso modo).
3. Un'auto colpita dal **lanciamissili** del Big Rig riceve un danno minore (non un segnalino danno
   pescato) in uno dei suoi spazi danno.

### 3. Big Rig: il veicolo (p4)

1. È **un solo veicolo stradale** fatto di tre **sezioni grandi** in fila: anteriore (la motrice),
   centrale, posteriore. Ogni sezione occupa una casella; le tre sono collegate da ganci.
2. Ha l'**arco anteriore** della sezione anteriore e un **arco posteriore**: le tre caselle dietro la
   sezione posteriore (dietro a sinistra, dietro, dietro a destra).
3. Ha un elicottero, che si attiva con il comando *Airstrike* della sezione centrale.
4. **Massiccio** (p5): il Big Rig è sulla tessera della sua sezione anteriore e, muovendo, conta solo
   le caselle in cui **entra la sezione anteriore** (costi del terreno, pericoli).

### 4. Big Rig: il turno (p4)

Ogni turno, in ordine:

1. **Assegna** un dado inutilizzato a un comando di una delle tre sezioni della plancia.
   - Non si può assegnare un dado a una sezione che ne ha già ricevuto uno in questo round.
   - **Repair** vuole un dado di valore **3**.
   - Si può assegnare un dado a un comando **danneggiato**: muove il Big Rig ma non attiva il comando.
2. **Comando**: si attiva il comando scelto; alcuni agiscono prima del movimento, altri dopo (§6).
3. **Muovi**: il Big Rig guadagna tanti movimenti quanto il valore del dado, qualunque sia la
   sezione scelta. Si muove **come un treno**: la sezione anteriore avanza e le altre occupano la
   casella appena lasciata da quella davanti. Va **dritto in avanti** salvo che si usi lo sterzo.
   Non usa il dado strada, salvo con *Traction Drive*.
4. **Spara** dall'arco anteriore **oppure** da quello posteriore (p5).

**Sterzo idraulico** (p4): al **primo turno di ogni round**, prima di assegnare il dado alla sezione,
il giocatore mette un dado sul comando *Hydraulic Steering* della motrice. Il suo valore è quante volte
in questo round il Big Rig può spostarsi in avanti a sinistra o in avanti a destra: ogni spostamento
laterale lo abbassa di uno, anche più volte nello stesso turno. Lo spostamento laterale **non è un
movimento in più**: usa un movimento del dado per entrare nella corsia accanto invece che dritto (FAQ).
Quando lo sterzo è a 1 e lo si usa, il dado si toglie e per il resto del round non si sterza più (FAQ).
Con 4 dadi il round è quindi:
un dado allo sterzo e un dado per ciascuna delle tre sezioni, uno per turno.

### 5. Big Rig: interazioni (p5)

1. **Robusto (Sturdy)**: se un effetto lo spostasse o lo fermasse (macchia d'olio, melma tossica…),
   non succede. "Effetto" vuol dire un effetto di **terreno, pericolo o danno**, non una regola del gioco
   come il tamponamento (FAQ): il Big Rig prende **un danno minore** su un comando a scelta del suo giocatore, la
   casella diventa **fuoristrada** (il segnalino che c'era viene tolto) e, se ha movimenti, continua.
2. **Affidabile (Dependable)**: se entra in una casella **invalicabile** non è eliminato: un danno
   minore a scelta, la casella diventa fuoristrada, continua a muovere. Vale anche per la **buca** (Pit
   Trap, Carnage): non si tira il dado sparo, la buca conta come invalicabile, quindi danno minore,
   casella fuoristrada e il Big Rig continua (FAQ).
3. **Solido (Solid)**: se una sua sezione finisce il turno su una casella con un **elicottero**, non è
   eliminato: un danno minore a scelta, e l'elicottero torna al suo proprietario.
4. **Fuoco** (con Carnage at Devil's Run): non prende mai fuoco. Se entra in una casella di fuoco: un
   danno minore a scelta, il segnalino viene tolto e la casella diventa fuoristrada.
5. **Pericoli di Carnage** (FAQ e BoardGameGeek):
   - **Rampa**: non tira il dado acrobazia e non salta; vale Robusto (danno minore, segnalino tolto,
     casella fuoristrada, continua).
   - **Verme delle sabbie**: il Big Rig **non può esserne eliminato** e non prende danni; se è lui il
     veicolo più arretrato, il verme **non elimina nessuno** (gli altri non sono i più arretrati).
   - **Terremoto (Quake)**: Robusto impedisce che lo sposti: un danno minore a scelta, ma **nessuna**
     casella fuoristrada, perché il segnalino del terremoto si scarta dopo l'effetto.
6. **Le caselle che diventano fuoristrada** sono sempre caselle in cui entra la **sezione anteriore**
   (Massiccio): Robusto, Affidabile e il fuoco riguardano solo quelle. Solido (elicottero sotto una
   sezione qualsiasi) non crea caselle fuoristrada.
7. **Caselle fuoristrada**: nel gioco digitale non c'è un segnalino a parte; la casella prende
   l'aspetto fuoristrada che il tavolo ha già e da quel momento conta come fuoristrada per tutti.

### 6. Big Rig: i comandi (p6)

| Sezione | Comando | Valore | Quando | Bersaglio | Effetto |
|---|---|---|---|---|---|
| Motrice | Hydraulic Steering | qualsiasi | inizio round | no | spostamenti laterali del round (§4) |
| Anteriore | Missile Launcher | qualsiasi | dopo il movimento | sì | si tira il dado sparo: ogni veicolo nella casella **due caselle davanti** o adiacente a essa, se colpito dal tiro, prende un danno minore |
| Anteriore | Repair | 3 | prima del movimento | no | toglie un danno dalla sezione anteriore |
| Anteriore | Cow Catcher | qualsiasi | durante il movimento | sì | la prima volta che entra in una casella con un'auto o una moto, chi la controlla la sposta avanti a sinistra o avanti a destra; un relitto lo sposta il giocatore del Big Rig |
| Centrale | Traction Drive | qualsiasi | movimento | sì | questo turno usa il dado strada |
| Centrale | Repair | 3 | prima del movimento | no | toglie un danno dalla sezione centrale |
| Centrale | Airstrike | qualsiasi | comando | sì | come nel gioco base: elicottero su una casella vuota, e spara |
| Posteriore | Hazard Dispenser | qualsiasi | dopo il movimento | sì | si pesca a caso un pericolo e lo si mette coperto, senza guardarlo, in una casella vuota dell'arco posteriore |
| Posteriore | Repair | 3 | prima del movimento | no | toglie un danno dalla sezione posteriore |
| Posteriore | Targeting Computer | qualsiasi | tiro | sì | questo turno si può ritirare il dado sparo |

Il lanciamissili **non è un tiro** (p5): si usa dopo il movimento e il Big Rig fa comunque il suo tiro
normale al passo 4. Come tutto ciò che usa il dado sparo, **non si usa nel primo round** (FAQ).

### 7. Big Rig: colpi, danni ed eliminazione (p5)

1. Quando un avversario gli spara, **ogni sezione è un veicolo grande a sé**; si può bersagliare una
   sezione che sia nell'arco anteriore di chi spara.
2. Prima di tirare, chi spara sceglie **quale comando** della sezione colpire: uno dei due bersagliabili
   (mai Repair) e non già danneggiato. Se il colpo va a segno, quel comando riceve un danno minore.
3. Ogni altro danno (tamponamenti, invalicabili, effetti) lo piazza il **giocatore del Big Rig**, sul
   comando che vuole.
4. Il Big Rig è eliminato **solo** in due modi: con **6 danni minori** in tutto, oppure se viene
   **scaricato dalla tessera posteriore**, cosa che succede solo se **tutte e tre** le sezioni sono
   sulla tessera posteriore. Altrimenti la sezione anteriore resta dov'è e le altre "pendono" fuori dal
   retro del tavolo.
5. Se il Big Rig è eliminato, quel giocatore è **fuori** e si aggiunge **subito il traguardo**: la
   tessera di testa diventa la tessera finale.

### 8. Big Rig: tamponamenti (p5)

1. Un veicolo che entra nella casella di una sezione si mette **sopra** quella sezione (non accanto).
2. Si tira **solo il dado direzione**, niente dado slam. Si sposta **sempre l'altro veicolo**, e
   nessuno dei due giocatori può far ritirare.
3. Per il resto valgono le regole normali del tamponamento: se è il Big Rig a tamponare, **perde i
   movimenti rimasti** e **non prende danni**; non è un "effetto" per Robusto (FAQ).
4. Se il veicolo spostato finisce sulla casella di un'altra sezione del Big Rig, è un nuovo tamponamento:
   si risolvono finché non ce ne sono più (FAQ).

### 9. Final Five: le moto (p7)

1. Sono **cinque moto**, ognuna un **veicolo piccolo**; funzionano come le auto del gioco base salvo
   quanto segue. Ogni moto ha il suo cruscotto, riconosciuto da un simbolo (due linee, X, V, cerchio,
   onda): nel gioco digitale cruscotto e moto sono la stessa cosa e il simbolo compare su entrambi.
2. **Turno**: si assegnano **due** dei 6 dadi inutilizzati a **due moto**. Si sceglie quale muovere e
   far sparare per prima, poi l'altra. **Una volta per round** si può invece assegnare un dado a una
   moto e uno a un comando della plancia, e fare il passo Comando come con un'auto.
3. **Comandi**: Airstrike (qualsiasi valore), Nitro (1 o 2), Repair (6).
4. **Inerzia**: una moto può andare per inerzia fino a **quattro** volte nel round (le auto due). Si può
   andare per inerzia due volte con la stessa moto nello stesso turno, e ogni inerzia è un turno a sé:
   inerzia, tiro, inerzia, tiro (FAQ).
5. **Drift**: muovendo, una moto attraversa **tutti** gli altri veicoli senza tamponare. Se però
   finisce il movimento nella casella di un altro veicolo, il tamponamento c'è. Le auto non attraversano
   le moto, salvo con il comando Drift. Il drift vale anche quando la moto è spostata da un effetto
   (macchia d'olio, vetro del deserto), finché ha movimenti, e vale per i **relitti**, che sono auto
   piccole fuori uso (FAQ).
6. **Tamponamenti**: moto e altro veicolo stanno **affiancati** nella casella, non uno sopra l'altro,
   e tamponano lo stesso. Si tira **solo il dado direzione**; si sposta **sempre la moto**; nessuno può
   far ritirare. Tra due moto dello stesso giocatore, sceglie lui quale si sposta.
7. **Danni**: una moto danneggiata prende un **danno minore** e diventa **fuori uso**: si gira al
   contrario e il suo cruscotto si capovolge. Torna operativa con Repair. Un danno a una moto già fuori
   uso è ignorato, come per le auto.
8. **Fuoco** (con Carnage at Devil's Run): una moto non pesca mai il danno ON FIRE!, ma può prendere
   fuoco in altri modi (terreno, effetti).
9. Le moto si eliminano come le auto (fuori dalla tessera posteriore, invalicabile, ecc.). Il giocatore
   delle Final Five è fuori quando non ha più moto operative, come con le auto.

### 10. Cosa vede il giocatore

1. **Plance** (disegnate dall'utente): per il Big Rig la motrice con lo sterzo e la plancia delle tre
   sezioni con i nove comandi, le X dei comandi bersagliabili e i danni minori su di essi; per le Final
   Five la plancia comandi e i cinque cruscotti con il loro simbolo, capovolti quando la moto è fuori uso.
2. **Tavolo**: i tre pezzi del Big Rig che si seguono sulle caselle, anche in corsie diverse; le moto
   con il simbolo del loro cruscotto. I modelli 3D li prepara l'utente (`data/trv/modelli/big_rig.json`);
   prima ci sono segnaposto.
3. **Scelte nuove**: lo sterzo del round, la sezione del turno, le due moto e l'ordine in cui muoverle,
   il comando da colpire quando si spara al Big Rig, dove mettere un danno minore, dove spostare un
   veicolo con il rostro, dove lasciare il pericolo dell'Hazard Dispenser.
4. Le bubble mostrano il Big Rig come un solo veicolo con i suoi danni minori su 6, e le moto come
   cinque veicoli piccoli.

## Formulas

| Formula | Definizione | Variabili e intervalli |
|---|---|---|
| Movimenti del Big Rig | `mosse = d` (+ dado strada solo con Traction Drive) | `d` ∈ {1, 2, 3}, dado del Big Rig |
| Sterzo del round | `sterzo₀ = s`; ogni spostamento laterale: `sterzo ← sterzo − 1`, permesso solo se `sterzo ≥ 1` | `s` ∈ {1, 2, 3} |
| Dadi del Big Rig per round | `4 = 1 (sterzo) + 3 (una sezione per turno)` | 3 turni per round |
| Dadi delle Final Five per round | `6 = 2 × 3 turni`; una volta per round 1 a una moto + 1 a un comando | dadi 1-6 |
| Eliminazione del Big Rig | eliminato se `danni_minori_totali ≥ 6` | `danni_minori_totali` ∈ {0..6} |
| Inerzia | `inerzie_moto ≤ 4`, `inerzie_auto ≤ 2` per round | |
| Lanciamissili | bersagli = veicoli in `{X} ∪ adiacenti(X)`, con `X` = due caselle dritto davanti alla sezione anteriore; un solo tiro del dado sparo, letto per la taglia di ciascun bersaglio | ogni sezione del Big Rig conta come veicolo grande |

**Esempi.**
- Primo turno del round: il Big Rig tira 3, 2, 1, 1. Mette 2 sullo sterzo (`sterzo = 2`) e 3 sulla sezione
  centrale con Traction Drive; il dado strada mostra +1: `mosse = 3 + 1 = 4`. Cambia corsia una volta:
  `sterzo = 1`, che resta per i due turni dopo.
- Il Big Rig ha 4 danni minori; un colpo ne aggiunge uno (5) e attraversa un invalicabile (6):
  `6 ≥ 6`, eliminato in quel momento.
- Una moto va per inerzia al terzo turno per la quarta volta nel round: permesso (`4 ≤ 4`); una quinta no.

Ogni valore viene da `data/trv/big_rig_final_five.json`; nessun numero nel codice.

## Edge Cases

- **Sterzo senza spostamenti laterali possibili** (bordo della strada): lo sterzo resta, non si consuma.
- **Sterzo esaurito davanti a un ostacolo**: il Big Rig va dritto e lo attraversa (Affidabile: danno
  minore e fuoristrada).
- **Tutti i comandi bersagliabili di una sezione danneggiati**: quella sezione non si può più
  bersagliare; chi spara sceglie un'altra sezione nel suo arco, o un altro bersaglio.
- **Dado a un comando danneggiato**: il Big Rig muove e il comando non si attiva. Repair non si può
  bersagliare, ma può ricevere un danno scelto dal giocatore del Big Rig.
- **Sei danni minori nello stesso turno**: il Big Rig è eliminato appena arriva al sesto, anche a metà
  movimento; i movimenti rimasti si perdono.
- **Il Big Rig esce dalla tessera di testa** con la sezione anteriore: come un'auto (nuova tessera, o
  vittoria se è la tessera finale). Le sezioni dietro restano in fila.
- **Avanzamento della strada**: le sezioni sulla tessera tolta non eliminano il Big Rig se la sezione
  anteriore è più avanti; "pendono" fuori dal tavolo, non si possono bersagliare né tamponare e
  rientrano seguendo il percorso.
- **Rampa, verme, buca, terremoto** (Carnage): §5.5 e §5.2. La regola della rampa viene da una risposta
  su BoardGameGeek riportata dall'utente il 2026-11-18: "The big rig does not roll the stunt die. When
  the big rig would be moved by a road effect, instead of moving it, you take a damage, remove any
  token on the space, and place a desert token on that space".
- **Sterzo a 1 usato**: il dado si toglie; nessun altro spostamento laterale fino al round dopo.
- **Primo round**: niente lanciamissili, come niente tiri.
- **Due moto di giocatori diversi**: non possono esistere. Le Final Five le usa un solo giocatore per
  partita, e così il Big Rig (§1.1, confermato dall'utente il 2026-11-18): la creazione partita non
  permette di sceglierle due volte. Due moto nella stessa casella sono sempre dello stesso giocatore,
  che sceglie quale si sposta.
- **Moto e Big Rig nella stessa casella**: la moto si mette sopra la sezione (regola del Big Rig) e si
  sposta la moto (entrambe le regole lo dicono).
- **Danni minori finiti**: si continua a contarli (§2.2).
- **Partita a due giocatori con il Big Rig eliminato**: l'altro giocatore resta solo e vince subito.
- **TRV9000 contro il Big Rig**: un bot che gli spara colpisce il **primo comando bersagliabile non
  danneggiato**, nell'ordine della plancia (posteriore, centrale, anteriore; dentro la sezione,
  dall'alto in basso), della sezione che ha scelto come bersaglio (deciso dall'utente il 2026-11-18).

## Dependencies

| Sistema | Cosa serve da lì | Dove |
|---|---|---|
| #9 Vehicles, Crews & Status | un veicolo fatto di **più sezioni** collegate (il Big Rig) e una squadra di 5 veicoli; moto fuori uso; danni minori | `src/game/trv/engine.ts` (Vehicle, Player) |
| #10 Movement | movimento a treno, spostamenti laterali con sterzo, drift delle moto attraverso tutti, ingresso in casella guardando solo la sezione anteriore | engine `enter`, `move` |
| #11 Command Board | plancia delle sezioni (un dado per sezione per round), sterzo della motrice, plancia delle Final Five con un comando per round | engine e `src/app/dock.ts` |
| #13 Slam Resolution | tamponamenti solo con il dado direzione, senza ritiri, con il veicolo che si sposta deciso dalla regola | engine `slam` |
| #14 Shooting | arco posteriore, sezioni come bersagli grandi, scelta del comando prima del tiro, Targeting Computer | engine `shootFrom` |
| #15 Damage & Repair | danni minori, danni sul comando scelto, eliminazione a 6, moto fuori uso al primo danno | engine `damage` |
| #12 Hazards & Wrecks | caselle che diventano fuoristrada, Hazard Dispenser, invalicabili e fuoco attraversati | engine, `src/view/terrain` |
| #16 Road Advance & Endgame | Big Rig scaricato solo con tutte le sezioni dietro, traguardo subito alla sua eliminazione | engine `advanceBoard`, `checkPlayers` |
| #24 Menus | scelta della squadra Big Rig o Final Five nella riga del giocatore | `src/app/screens.ts`, `online.ts` |
| #19 Table Renderer, #21 Player Panels | modelli e plance (segnaposto finché non arrivano quelli dell'utente) | `src/app/pieces.ts`, `hud.ts`, `bubbles.ts` |
| #32 TRV9000 | i bot non giocano queste squadre, ma ci giocano contro | `trv9000-bots.md` |
| Carnage at Devil's Run | fuoco, pericoli che spostano o fermano, rampe, verme | `carnage.json` |

## Tuning Knobs

Nessuna manopola di bilanciamento: tutti i numeri sono del regolamento (`big_rig_final_five.json`).
Sono dati, non costanti, così un errore di trascrizione si corregge nel file:

| Dato | Valore | Fonte |
|---|---|---|
| Facce del dado del Big Rig | 1, 1, 1, 2, 2, 3 | confermato dall'utente |
| Facce dei dadi delle Final Five | 1-6 | confermato dall'utente |
| Danni minori del Big Rig / delle Final Five | 10 / 5 | p3 |
| Eliminazione del Big Rig | 6 danni minori | p5 |
| Inerzie massime di una moto | 4 | p7 |
| Valori dei comandi | Repair del Big Rig 3; Nitro 1-2, Repair 6 delle Final Five | p6, p7 |

Presentazione (in `presentation_base.json`, da aggiungere): distanza tra le sezioni del Big Rig sul
tavolo, velocità con cui le sezioni seguono la motrice, scala delle moto.

## Acceptance Criteria

1. In creazione partita, hot seat e online, ogni riga può scegliere Big Rig o Final Five; una sola volta
   ciascuna; senza caposquadra né potenziamenti anche con Choppe Shoppe.
2. Il Big Rig parte con le tre sezioni nell'area di partenza e 4 dadi con facce 1, 1, 1, 2, 2, 3; ogni
   round chiede prima lo sterzo e poi, in tre turni, una sezione diversa per turno.
3. Il Big Rig avanza a treno: dopo ogni movimento ogni sezione è nella casella lasciata da quella
   davanti; senza sterzo non cambia corsia; ogni cambio di corsia abbassa lo sterzo di uno.
4. Il terreno e i pericoli contano solo per le caselle in cui entra la sezione anteriore.
5. Invalicabili, fuoco ed effetti che spostano o fermano danno un danno minore e rendono fuoristrada la
   casella; il Big Rig continua con i movimenti rimasti.
6. Chi spara al Big Rig sceglie una sezione nel suo arco e un comando bersagliabile non danneggiato prima
   del tiro; il colpo mette un danno minore su quel comando, che poi muove senza attivarsi.
7. Al sesto danno minore il Big Rig è eliminato, il giocatore è fuori e la tessera di testa diventa finale.
8. Il Big Rig non è scaricato finché almeno una sezione è oltre la tessera posteriore.
9. I dieci comandi fanno ciascuno quanto dice la tabella del §6 (un test per comando).
10. Le Final Five assegnano due dadi a due moto per turno, una volta per round uno a un comando; una moto
    va per inerzia fino a quattro volte.
11. Una moto attraversa tutti i veicoli senza tamponare e tampona solo se si ferma in una casella occupata;
    nel tamponamento si tira solo il dado direzione e si sposta la moto.
12. Una moto colpita prende un danno minore, diventa fuori uso e torna operativa con Repair.
13. Un'auto colpita dal lanciamissili prende un danno minore, non un segnalino pescato.
14. Partite casuali con Big Rig, Final Five e auto (anche con Carnage e TRV9000) non vanno mai in errore
    e finiscono sempre con un vincitore.
15. Ogni cambio di stato emette una riga di registro che dice la causa (criterio comune #1).
16. Le plance e i modelli dell'utente sostituiscono i segnaposto senza cambiare il codice delle regole.

## Open Questions

Nessuna. Le domande aperte sono state risolte dall'utente e dalle FAQ il 2026-11-18 (vedi le sezioni
citate).
