# Rules Core & Event Log

> **Status**: In Design
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-15
> **Last Verified**: 2026-11-15
> **Implements Pillar**: P1 Il regolamento è la legge · P2 Ogni dado si spiega · T1 Stessa partita a ogni tavolo · T2 Il gioco base è un pacchetto

## Summary

[To be designed]

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `#2 Dice & Seeded RNG`

## Overview

**Rules Core & Event Log** è il **kernel deterministico** del gioco: possiede lo stato
completo di una partita ed è l'unica via con cui quello stato cambia. Riceve le **azioni**
dei giocatori, le valida e le risolve una alla volta attraverso una **coda esplicita di
effetti**. La coda lavora in profondità prima: un'interruzione fa "perdere le mosse
residue", una ripresa fa "continuare a muoversi". Le **decisioni pendenti** possono toccare
qualunque giocatore, anche quello non di turno. Ogni cambio di stato diventa un **evento**
del **log**, dentro un involucro con numero di sequenza, **causa** e versioni di regole e
pacchetto. Dallo stato completo il kernel ricava due sole cose, le uniche che interfaccia,
rete e anteprima possono leggere: la **vista per giocatore** (una proiezione che ammette
solo i campi pubblici) e l'**enumerazione delle azioni legali**.

Il kernel **non contiene nessuna regola del regolamento**. Le regole sono **moduli** di un
pacchetto di contenuto (#4, #7–#16) che si registrano sui suoi punti di estensione. Per
questo la suite di test del kernel gira con un pacchetto giocattolo. Un punto di estensione
esiste solo se lo usa un consumatore TR:V, cioè il gioco base o un'espansione ufficiale
esistente.

Il giocatore non usa questo sistema direttamente. Ne sente tre garanzie: la partita è
identica a ogni tavolo, in hot seat e online; ogni esito ha la sua causa; le catene di slam
si risolvono un passo alla volta e si possono rivedere.

Esiste per quattro ragioni:

- **T1 e R2**: lo stato è ricostruibile da seed + log, ed è la base di server (#27),
  riconnessione (#29) e ripresa (#30).
- **P1**: l'automazione può cambiare chi esegue un passo, mai l'esito.
- **P2**: la causa viaggia su ogni evento, e #22 la mostra.
- **T2**: una futura espansione si aggiunge registrando un handler e un formattatore di
  causa, senza toccare il kernel.

Senza questo sistema ogni modulo dovrebbe inventarsi un proprio ordine di risoluzione, e il
gioco perderebbe riproducibilità, online, salvataggio e spiegazione delle cause.

*Confine design / implementazione*: forma dell'involucro, della causa, del log e della coda
sono scelte tecniche → **diventano l'ADR-C**. Questo GDD fissa i comportamenti e i
requisiti che l'ADR deve soddisfare.

## Player Fantasy

*Inquadratura: indiretta.* Il giocatore non usa il kernel: ne sente gli effetti nel momento
in cui qualcosa è andato storto e vuole capire perché.

**"Ogni perdita ha un perché."** Una catena mina → Skid → slam si è risolta in un lampo, con
le animazioni saltate, e l'auto di Tony è fuori. Tony apre lo storico e legge la catena un
passo alla volta: la mina, il danno, lo Skid, lo slam, i dadi, ognuno con la sua causa. Non
deve fidarsi del gioco: può controllare.
> *P2 — «ogni cambio di stato causato da un dado o da un token è attribuibile alla sua causa
> con uno sguardo o un clic; le catene di slam si risolvono un passo alla volta e si possono
> rivedere.»*

**Conseguenza: "il gioco non sceglie al posto tuo."** Quando il regolamento dà una scelta a
qualcuno, il gioco si ferma e la chiede a lui. Il proprietario del veicolo più grande può
chiedere il ritiro dei due dadi di uno slam anche se non è il suo turno (p. 9): l'esito non
è deciso finché non ha risposto, e nessuna regola lo anticipa.
> *P1 — «l'automazione può cambiare chi esegue un passo, mai l'esito.»*

**Cosa chiede al resto del design**:
- ogni cambio di stato porta una causa formattabile (CD-SYSTEMS 1);
- le catene restano passi distinti nel log: #25 comprime, non salta (CD-SYSTEMS 2);
- le decisioni pendenti sono visibili, con chi deve decidere e perché si attende (#23, #21);
- nessuna mossa suggerita e nessun annullamento di una decisione confermata (anti-pilastro
  "NOT un giocatore al posto tuo").

La garanzia T1 ("la stessa partita a ogni tavolo") è tecnica e resta nell'Overview: il
giocatore la sente solo come assenza di sorprese.

*Tensione nota con P3*: una decisione pendente di un giocatore non di turno è l'unico punto
in cui il ritmo di un turno dipende da un altro giocatore. Si tratta in Edge Cases; online il
tempo di attesa è un'opzione della partita (T1, #27).

## Detailed Design

### Core Rules

Le regole RC-n sono citate dagli altri GDD con il loro id.

*Termini*: **azione** = input di un giocatore o del sistema; **effetto** = voce della coda,
con tipo, payload, ambito e causa; **passo** = una chiamata dell'handler di un effetto;
**evento** = fatto registrato nel log.

*Decisioni dell'utente (2026-11-15)*: la legalità si decide con un convalidatore per azione
più un'enumerazione delle scelte successive (RC-13); si conservano azioni **e** eventi
(RC-16); il formattatore di causa restituisce chiave e parametri, non testo (RC-11).

1. **RC-1 Un solo stato, un solo ingresso.** Lo stato completo di una partita è un dato
   semplice e serializzabile. Contiene una sezione per modulo, lo stato del generatore
   (RNG-3), il log, il contatore di sequenza, la coda e l'eventuale decisione pendente.
   Cambia solo risolvendo un'azione accettata (RC-4). Nessun altro sistema lo scrive.
2. **RC-2 Nessuna regola del regolamento.** Il kernel non nomina auto, dadi, slam, mosse,
   mine, tessere. Criterio verificabile: la sua suite gira per intero con un **pacchetto
   giocattolo** che non contiene nessun modulo TR:V. Il pacchetto giocattolo è una fixture
   di test, non un prodotto. **Anti-deriva** (CD-SYSTEMS 9): un punto di estensione esiste
   solo se lo usa un consumatore TR:V, cioè il gioco base o un'espansione ufficiale
   esistente. L'elenco è RC-18, con il consumatore di ogni voce.
3. **RC-3 Decidere e applicare.** Gli handler dei moduli **decidono**: leggono lo stato e
   restituiscono eventi ed effetti, senza modificare nulla. I **riduttori** dei moduli
   **applicano**: ogni tipo di evento ha un riduttore che dà il nuovo stato. Il riduttore è
   l'unico modo di cambiare lo stato. Ne seguono due proprietà per costruzione, non per
   test: ogni cambio di stato ha un evento con causa (criterio CD-SYSTEMS 1) e lo stato è
   la rigiocata degli eventi (RC-16).
4. **RC-4 Azione e pipeline.** Un'azione è `{ id, seat, type, payload }`. L'id è dato dal
   chiamante e unico nella partita. Il `seat` è un posto di gioco o `system`. Le azioni del
   sistema (avvio della partita, risposta predefinita allo scadere del tempo) sono azioni
   vere: hanno un id derivato dalla sequenza e non dall'orologio, ed entrano nel log in un
   punto determinato dallo stato (RNG-16). Ogni azione segue, in questo ordine:
   - **Idempotenza**: stesso id e stesso contenuto restituiscono gli eventi originali
     ri-proiettati, senza toccare stato né generatore (RNG-4). Stesso id con contenuto
     diverso è rifiutato (`ActionIdConflict`). L'id viene registrato nella stessa
     transazione che avanza lo stato.
   - **Convalida** (RC-13): una partita finita non accetta azioni. Con una decisione
     pendente, solo la risposta del posto indicato è legale. Nessuna estrazione si consuma
     prima o durante la convalida: un'azione rifiutata non brucia tiri (RNG-16).
   - **Risoluzione** su una copia di lavoro: l'handler dell'azione produce eventi ed
     effetti, e la coda si risolve fino a quiete o fino alla prima decisione pendente
     (RC-5, RC-7).
   - **Commit tutto o niente**: stato, eventi e id si scrivono insieme. Se un handler
     fallisce (invariante violata, limite dei passi superato), l'intera azione è rifiutata
     con `ResolutionFault` e stato e generatore restano invariati. Un `ResolutionFault` è un
     difetto di un modulo e si segnala distinto da un'azione illegale.

   Le azioni di una partita si risolvono una alla volta, senza attese asincrone fra
   estrazione e scrittura.
5. **RC-5 Coda degli effetti.** La coda è una **pila di effetti** risolta in profondità
   prima. Un passo restituisce `{ eventi, figli, resto }`: i **figli** si risolvono prima, il
   primo dichiarato per primo; il **resto** è ciò che rimane dell'effetto dopo i figli, e se
   manca l'effetto è finito. Gli effetti sono **dati**, non funzioni: la coda si serializza
   e una partita si può salvare e riprendere a metà catena. Passi ed eventi di un'azione
   sono limitati dal tetto `MAX_PASSI` (Tuning Knobs), come guardia contro un modulo che
   cicla.
6. **RC-6 Interruzione e ripresa.** Ogni effetto porta un **ambito**, un'etichetta opaca
   assegnata dal modulo (per esempio la mossa di una certa auto). Un passo può restituire
   `annulla(ambito)`: il kernel rimuove dalla coda tutti i resti con quell'ambito. Così si
   ottiene "perde le mosse residue": il resto della mossa non viene mai ripreso.
   L'annullamento emette l'evento del kernel `ambito-annullato` (ambito e numero di resti
   rimossi): è ciò che permette a #22 di spiegare perché la mossa si è interrotta (P2). **La
   ripresa non ha un meccanismo suo**: se nessuno annulla, quando i figli finiscono il resto
   torna in cima ("continua a muoversi"). Il kernel confronta solo l'uguaglianza delle
   etichette.
7. **RC-7 Decisioni pendenti.** Un passo può restituire una `decisione`: il **posto** che
   deve rispondere, qualunque sia (anche non di turno, anche lo stesso giocatore che ha
   mosso), il tipo di risposta, la causa e una **risposta predefinita** legale. Il kernel
   sospende la coda e scrive la decisione nello stato, emettendo l'evento del kernel
   `decisione-aperta` (posto, tipo di risposta, causa); alla risposta emette
   `decisione-risolta` (risposta data o predefinita). Finché è aperta, le uniche azioni
   legali sono le risposte di quel posto. Alla risposta accettata l'handler del tipo di
   risposta produce nuovi eventi ed effetti in cima alla coda e la risoluzione riprende. Ce
   n'è **una sola alla volta**. La **risposta predefinita** serve solo alle azioni di
   sistema: online lo scadere del tempo (#27, opzione della partita, T1); la decide il
   modulo, mai il kernel. Una decisione pendente si salva con la partita.
8. **RC-8 Caso e informazione nascosta sono effetti.** Un handler non tira e non legge
   informazione nascosta: restituisce un effetto `richiesta-di-tiro` (con la `RandomRequest`
   di RNG-17) o `richiesta-di-rivelazione` (zona e selettore). L'**esecutore reale**
   soddisfa la richiesta con #2 o con lo stato completo, emette l'evento (un evento per
   gruppo, RNG-10) e mette in coda l'effetto indicato dal chiamante con il risultato nel
   payload. L'**esecutore di simulazione** (RC-14) si ferma e segnala. Prima di un ritiro il
   kernel verifica che il riferimento di regola esista nel pacchetto (#4) e che nessun
   risultato indicato sia già **Sostituito**: lo stato Sostituito si ricava dai
   collegamenti del log, non si memorizza a parte (RNG-8).
9. **RC-9 Evento e involucro.** Ogni evento ha: `seq` (intero da un contatore nello stato
   che conta **eventi**, mai estrazioni: RNG-10), `type`, `payload`, `cause`, `actionId`, `v`
   (versione del contratto del kernel) e `pack` (identità del pacchetto: un valore opaco che
   il kernel confronta solo per uguaglianza). Il log è **solo in aggiunta**: un evento non
   si modifica e non si rimuove. Il **primo evento di ogni azione accettata** è
   `azione-accettata` (emesso dal kernel: posto, tipo e payload dell'azione, pubblico per
   definizione come una mossa al tavolo): la radice dell'albero delle cause. Perciò ogni
   azione emette almeno un evento (F1). I tipi di evento propri del kernel
   (`azione-accettata`, `ambito-annullato`, `decisione-aperta`, `decisione-risolta`, tiro,
   ritiro, mescolamento, rivelazione, `fine-partita`) portano formattatore e proiezione
   forniti dal kernel.
10. **RC-10 Causa.** Ogni effetto e ogni evento porta una causa `{ by, ref, rule }`: `by` è
    `azione` o `evento`, `ref` è l'id dell'azione o il `seq` dell'evento che l'ha
    provocato, `rule` è la regola applicata (id del modulo e pagina del regolamento, come
    `RuleRef` di #2). Le cause formano un **albero** che risale a un'azione: è ciò che #22
    raggruppa e fa rivedere. La catena attraversa le azioni: i passi dopo una risposta a una
    decisione risalgono all'azione iniziale: la radice (`azione-accettata`) di un'azione che
    risponde a una decisione ha come causa l'evento `decisione-aperta`, non l'azione. Il `CauseRef` di #2 è l'id del passo che
    emette la richiesta di tiro.
11. **RC-11 Formattatore di causa.** Per ogni tipo di evento un modulo registra un
    **formattatore** puro: dall'evento proiettato restituisce `{ chiave, parametri }`, dove
    la chiave è un id di messaggio e i parametri sono id di contenuto, valori e pagina. Non
    restituisce testo: la lingua la compone #22. Usa solo informazione pubblica. Il
    caricamento del pacchetto **fallisce** se un tipo di evento emesso non ha formattatore.
12. **RC-12 Proiezione per lista bianca.** Il kernel costruisce la **vista** di un giocatore
    **aggiungendo** i campi ammessi: ogni sezione di stato dichiara come si proietta, e ciò
    che non è dichiarato non esce. L'informazione ha **due livelli**: **pubblica** (tutti la
    vedono) e **nascosta** (nessuno finché un evento non la rivela). Ogni tipo di evento
    dichiara anche la sua proiezione. Un evento senza proiezione arriva ai client come solo
    `seq`, `type` e `cause`, mai con il payload: il default **chiude**, non apre (esempio:
    "pila X mescolata", RNG-11). Non escono mai seed, stato del generatore, estrazioni
    grezze, permutazioni né hash che ne derivino. La **dimensione** delle pile è pubblica.
13. **RC-13 Legalità.** Ogni tipo di azione ha un **convalidatore**
    `(vista, posto, azione) → ok | motivo` e un **enumeratore** `(vista, posto) → scelte`
    che offre le **scelte successive** (dadi assegnabili, caselle, risposte), non l'elenco
    completo delle azioni composte. Entrambi ricevono **solo la vista pubblica**: la
    legalità non dipende mai da informazione nascosta. Un test generico garantisce che ogni
    scelta enumerata, completata in azione, passi il convalidatore. La UI non decide mai la
    legalità (#23); server e client applicano le stesse funzioni.
14. **RC-14 Simulazione.** `simula(vista, azione)` esegue la risoluzione sulla **vista
    proiettata** con l'esecutore di simulazione di #2. Si ferma alla prima
    `richiesta-di-tiro` ("qui servirebbe un tiro") o `richiesta-di-rivelazione` ("qui si
    rivelerebbe un'informazione") e restituisce gli eventi deterministici fino a lì. Non
    tocca lo stato reale e non vede il generatore (RNG-12).
15. **RC-15 Handler e riduttori deterministici.** Sono funzioni pure e sincrone di stato e
    payload: niente orologio, niente `Math.random`, niente I/O, niente modifiche dei
    parametri. L'ordine di più handler sullo stesso punto è totale: ordine del manifesto del
    pacchetto, poi id del modulo.
16. **RC-16 Ricostruzione e versioni.** Una partita è
    `{ v, pack, parametri, seed, azioni, eventi }`. Lo stato si ricostruisce da
    `creaPartita(seed, parametri, pack)` più la rigiocata delle azioni, e a ogni passo
    coincide con quello in corso (stato serializzato canonico, come RNG-3). Alla ripresa gli
    eventi rigenerati devono coincidere con quelli salvati: altrimenti `ReplayDivergence` e
    la partita non riparte. Una versione o un pacchetto diversi sono rifiutati
    (`VersionMismatch`). Le istantanee sono solo una cache: istantanea più azioni successive
    deve dare lo stesso stato della rigiocata completa. Il seed non si invia mai a un
    client.
17. **RC-17 Fine partita.** Un effetto predefinito `fine-partita` porta l'esito (opaco per il
    kernel). Da quel momento nessuna azione è accettata. Chi emette l'effetto è #16.
18. **RC-18 Punti di estensione (elenco chiuso).** Ogni voce ha un consumatore TR:V:

| Punto di estensione | Cosa registra un modulo | Consumatore |
|---|---|---|
| Tipi di azione | convalidatore, enumeratore, handler | #8 (assegna), #10 (muovi), #11, #13 (ritiro) |
| Tipi di effetto | handler di passo | #10, #12, #13, #15, #16 |
| Catene di hook su punti nominati | handler nell'ordine di RC-15; il punto lo dichiara il modulo proprietario | #10 (ingresso in casella), #8 (slot di passo) |
| Formattatori di causa | RC-11 | tutti i moduli #7–#16 |
| Proiezioni (evento e sezione) | RC-12 | tutti i moduli con stato |
| Sezioni di stato | schema, versione, stato iniziale, riduttori | #7, #9, #12, #15 |

Un hook è un effetto predefinito che mette in coda i suoi handler come figli, nell'ordine
totale: ognuno vede lo stato lasciato dal precedente e può annullare un ambito.

### States and Transitions

**Partita**

| Stato | Entra quando | Esce verso |
|---|---|---|
| Non creata | — | In attesa di azione (creazione con seed, parametri, pacchetto) |
| In attesa di azione | coda vuota, nessuna decisione | In decisione (un passo apre una decisione), Finita (`fine-partita`) |
| In decisione | decisione pendente aperta | In attesa di azione (risposta, coda a quiete), In decisione (risposta che ne apre un'altra) |
| Finita | `fine-partita` risolto | nessuna (finale) |

"In risoluzione" esiste solo dentro l'esecuzione di un'azione e non è mai osservabile tra
due azioni.

**Azione**

| Stato | Significato | Transizioni |
|---|---|---|
| Ricevuta | arriva al kernel | → Duplicata, Rifiutata, Accettata |
| Duplicata | stesso id e contenuto | restituisce gli eventi originali; nessun cambio di stato |
| Rifiutata | illegale, id in conflitto, partita finita, `ResolutionFault` | nessun cambio di stato né di generatore |
| Accettata | risolta e scritta | nel log, definitiva |

**Decisione pendente**: Aperta → Risposta (azione del posto indicato) | Risposta
predefinita (azione di sistema). Non esiste "annullata".

### Interactions with Other Systems

| Sistema | Entra nel kernel | Esce dal kernel | Chi possiede l'interfaccia |
|---|---|---|---|
| #2 Dice & Seeded RNG | `RandomRequest`; stato del generatore | contenuto degli eventi di tiro, ritiro, mescolamento | #2 il contenuto; #1 id, involucro, proiezione |
| #4 Content Pack | manifesto, ordine dei moduli, registrazioni sui punti RC-18, identità del pacchetto | verifiche al caricamento (formattatori, proiezioni, riferimenti di regola) | #4 le definizioni; #1 i punti di estensione |
| #7 Match Setup | azione `system` di avvio | stato iniziale | #7 le regole di preparazione |
| #8 Turn & Round Flow | tipi di azione e hook di passo | — | #8 gli slot; #1 il meccanismo |
| #9–#16 moduli di regole | azioni, effetti, hook, formattatori, proiezioni, sezioni di stato | eventi con causa | ogni modulo le sue regole; #1 il contratto |
| #19 Renderer, #21 Pannelli, #22 Cause Log, #25 Animazione | — | vista e flusso di eventi proiettati; formattatori | #1 vista ed eventi; #22 il testo |
| #23 Input & Selection | posto; azione pianificata | scelte legali; esito della simulazione | #1 |
| #27 Server, #29 Reconnection, #30 Save | azioni, seed, parametri | vista proiettata; log; rigiocata e verifica | #1 il formato; #27/#29/#30 il trasporto |

### Fixture comune

Fissa la sequenza attesa per #10, #12 e #13, che la **rispettano**, senza ridefinirla. I nomi
degli effetti e degli eventi sono **illustrativi**: li definiscono i moduli, non il kernel.

**Fixture A — l'esempio di Tony (p. 9)**: dopo la mossa su strada, il dado strada (3) dà tre
mosse supplementari; Tony ne usa due e finisce su un pericolo coperto che rivela un relitto.

| # | Passo | Evento emesso | Causa | Coda |
|---|---|---|---|---|
| 1 | azione di Tony: mossa col dado strada | — | azione A1 | `mossa{resta 3, ambito Tony}` |
| 2 | `mossa` → figlio ingresso in casella 1 | auto entra in casella 1 | A1 | resto `mossa{resta 2}` |
| 3 | `mossa` → figlio ingresso in casella 2 (pericolo coperto) | auto entra in casella 2 | A1 | `richiesta-di-rivelazione` |
| 4 | rivelazione | pericolo rivelato: **relitto** (pubblico) | evento 3 | figlio `risolvi-pericolo` |
| 5 | `risolvi-pericolo` | relitto posto; auto sopra il relitto; `ambito-annullato` (evento del kernel, da `annulla(ambito Tony)`) | evento 4 | figlio `slam`; il resto della mossa **sparisce** |
| 6 | `slam` → `richiesta-di-tiro` (dado slam + dado direzione, un evento) | tiro: BOTTOM + FRONT LEFT | evento 5 | **decisione pendente** a Tony (proprietario del veicolo più grande), risposta predefinita: non ritirare |
| 7 | azione A2 di Tony: non ritira | `azione-accettata`, `decisione-risolta` (non ritirare) | evento 6 (via A2) | figlio `sposta-forzato(relitto, avanti-sinistra, 1)` |
| 8 | spostamento | relitto spostato | evento 6 | coda vuota |

**Fixture B — mina → Skid → slam**: un'auto entra in una mina; il segnalino danno pescato è
uno Skid verso una casella occupata; lo slam chiede una decisione a un altro giocatore, che
ritira.

| # | Passo | Evento emesso | Causa | Coda |
|---|---|---|---|---|
| 1 | ingresso con pericolo coperto | rivelata: **mina** | azione A1 | `danno` |
| 2 | `danno` | danno inflitto; `ambito-annullato` (da `annulla(ambito mossa)`) | evento 1 | `richiesta-di-rivelazione` (pila dei danni) |
| 3 | rivelazione | segnalino rivelato: **Skid** + direzione | evento 2 | figlio `sposta-forzato(auto, direzione, 1)` |
| 4 | spostamento in casella occupata | auto entra; impilata | evento 3 | figlio `slam` |
| 5 | `slam` → `richiesta-di-tiro` | tiro slam + direzione | evento 4 | **decisione pendente** al proprietario del veicolo più grande (può non essere di turno) |
| 6 | azione A2: ritira | `azione-accettata`, `decisione-risolta`; **ritiro**: nuovi risultati, collegati ai sostituiti, con richiedente e regola (p. 9) | evento 5 (via A2) | `sposta-forzato(veicolo colpito, 1)` |
| 7 | spostamento | veicolo spostato; se entra in un'altra casella occupata → un nuovo `slam` (stesso schema, in profondità) | evento 6 | si ripete finché ogni casella ha un solo veicolo |

Proprietà da verificare su entrambe: ordine degli eventi, albero delle cause fino
all'azione, resto della mossa che **non** riprende, catena che **attraversa** due azioni,
rivelazione che **esce** dalla vista solo con l'evento, nessuna estrazione consumata da
un'azione rifiutata.

*Fonte*: pp. 7-9 e pagina dei segnalini danno (ultima del regolamento). Lo Skid verso una
casella occupata e il ritiro chiesto da un altro giocatore sono casi scelti per la fixture,
non esempi stampati.

## Formulas

Il kernel non ha bilanciamento, ma definisce poche quantità e uguaglianze che gli altri
sistemi devono rispettare alla lettera. Il costo di ripresa di una partita lunga e la
cadenza delle istantanee **non** sono formule di #1: le fissa #30 (vedi Dependencies); #1
garantisce solo l'equivalenza con la rigiocata completa (F6, RC-16).

### F1 — Sequenza degli eventi (`prossimo_seq`)

La formula `prossimo_seq` è definita come:

`prossimo_seq' = prossimo_seq + k`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| prossimo_seq | int | 1 – 2^53 − 1 | state | seq che avrà il prossimo evento; vale 1 a partita creata |
| k | int | 1 – MAX_PASSI × eventi per passo | calculated | eventi emessi dall'azione, `azione-accettata` compreso |

**Output Range:** da 1 a 2^53 − 1. Se `prossimo_seq + k` supera 2^53 − 1 l'azione è
rifiutata (`ResolutionFault`): mai un ripiego su valori inesatti. Con `k ≥ 1` per
costruzione (RC-9), il contatore cresce a ogni azione accettata.
**Example:** `prossimo_seq = 41`. L'azione A1 della fixture A emette `k = 8` eventi:
`azione-accettata`, due ingressi in casella, `pericolo-rivelato`, `pericolo-risolto`,
`ambito-annullato`, `tiro`, `decisione-aperta`. Quindi `prossimo_seq' = 49` e l'ultimo
evento ha seq 48. L'azione A2 emette `k = 3` (`azione-accettata`, `decisione-risolta`,
spostamento) e porta il contatore a 52.

### F2 — Tetto dei passi (`limite_passi`)

La formula `limite_passi` è definita come:

`passi(a) ≤ MAX_PASSI, altrimenti ResolutionFault e annullamento di tutta l'azione`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| passi(a) | int | 0 – MAX_PASSI | calculated | passi risolti dall'azione `a` dalla pipeline (RC-4) |
| MAX_PASSI | int | ≥ 1 | constant (Tuning Knobs) | tetto tecnico, 10 000 provvisorio |

**Output Range:** da 0 a `MAX_PASSI` per un'azione accettata. A `MAX_PASSI + 1` la copia di
lavoro è scartata; stato e generatore restano invariati (RNG-16).
**Example:** la fixture A usa circa 8 passi, 1250 volte meno del tetto. Una catena che cicla
ferma l'azione al passo 10 001 e il giocatore vede un errore di modulo, non un'azione
illegale.
**Bordi**: `MAX_PASSI = 0` fa fallire ogni azione. Troppo basso annulla catene legittime
(uno slam a catena) e fa perdere un'azione valida senza motivo; troppo alto lascia girare un
modulo che cicla. Nel gioco reale le catene sono corte: il tetto è una guardia tecnica, non
un valore di gioco. **Obbligo di calibrazione**: quando #10 e #13 saranno scritti, il tetto
deve essere almeno 100 volte la catena legittima più lunga misurata sulle fixture.

### F3 — Profondità della causa (`profondita_causa`)

La formula `profondita_causa` è definita come:

`prof(e) = 0 se la causa di e è un'azione; altrimenti 1 + prof(evento citato dalla causa)`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| e | evento | log | state | l'evento di cui si misura la profondità |
| causa(e) | `{by, ref, rule}` | RC-10 | state | per `by = evento`, `ref` è il seq dell'evento citato |

**Output Range:** da 0 a (eventi nel log − 1). Una causa che cita un evento con `seq`
maggiore o uguale a quello di `e` è un difetto (ciclo): il test generico lo rileva.
**Example:** fixture A. `azione-accettata` di A1 ha prof 0, l'ingresso nella casella 2 ha 1,
`pericolo-rivelato` 2, `pericolo-risolto` 3, `ambito-annullato` e `tiro` 4,
`decisione-aperta` 5. La radice di A2 cita `decisione-aperta` e ha prof 6,
`decisione-risolta` 7, lo spostamento 8: un solo albero attraverso due azioni.

### F4 — Stato Sostituito (`stato_sostituito`)

La formula `stato_sostituito` è definita come:

`sostituito(r) = esiste un evento di ritiro nel log con r tra i suoi risultati sostituiti`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| r | riferimento di risultato | log | state | un risultato di dado già emesso (id dell'evento e posizione) |
| ritiro | evento | log | state | evento di ritiro con i collegamenti `replaces` (RNG-8, RNG-10) |

**Output Range:** vero o falso, ricavato dal log e mai memorizzato a parte (una cache
derivata si ricostruisce alla ripresa). Un riferimento inesistente non è né Tirato né
Sostituito: il ritiro è rifiutato (`UnknownResult`). Ritirare un risultato già Sostituito è
rifiutato (`AlreadyReplaced`). Il ritiro di un ritiro è ammesso dal kernel: il limite è del
modulo (RNG-8).
**Example:** fixture B, passo 6. I due risultati dell'evento 5 diventano Sostituiti
all'evento 6; i nuovi risultati sono Tirati. Un secondo ritiro che cita uno dei due vecchi
risultati è rifiutato.

### F5 — Uguaglianza di azione (`uguaglianza_azione`)

La formula `uguaglianza_azione` è definita come:

`uguale(a, b) ⇔ canon(a) = canon(b)`, con `canon` = serializzazione con chiavi in ordine
lessicografico, ricorsiva, array in ordine

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| a, b | azione | valori ammessi sotto | input | due azioni con lo stesso `id` |
| valori ammessi | stringa, intero sicuro, booleano, `null`, array, oggetto con chiavi stringa | — | constant | ogni altro valore è rifiutato |

**Output Range:** vero o falso. Valori fuori dall'insieme (`-0`, `NaN`, `Infinity`,
`undefined`, numeri non interi, `BigInt`) fanno rifiutare l'azione con `ActionMalformed`,
mai normalizzati (stessa filosofia di RNG-2).
**Example:** `{id:"a-17", seat:"p2", type:"ritira", payload:{x:1,y:2}}` e la stessa azione
con `payload:{y:2,x:1}` sono uguali: il duplicato restituisce gli eventi originali. Con
`payload:{x:1,y:3}` e lo stesso `id`: `ActionIdConflict`.

### F6 — Ricostruzione (`ricostruzione`)

La formula `ricostruzione` è definita come:

`S_0 = creaPartita(seed, parametri, pack)`; `S_n = applica(S_{n−1}, decidi(S_{n−1}, a_n))`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| S_n | stato completo | RC-1 | calculated | stato dopo `n` azioni accettate |
| a_n | azione | log | state | n-esima azione accettata |
| decidi / applica | funzioni pure | RC-3, RC-15 | modules | handler e riduttori registrati dal pacchetto |

**Output Range:** `canon(S_n)` della rigiocata uguale a `canon(S_n)` della partita in corso,
per ogni `n` da 0 al numero di azioni; gli eventi rigenerati uguali ai salvati. Con `n = 0`
si ottiene lo stato iniziale; ogni prefisso del log dà lo stato di quel punto.
**Example:** fixture A salvata dopo A1: la ripresa rigioca A1 da `S_0`, ottiene `S_1` con la
decisione ancora aperta e il contatore a 49. Con A2 arriva a `S_2`, uguale allo stato della
partita in corso.

**Cicli di retroazione**: nessuno positivo. L'unico ciclo è la catena di slam, che F2
limita.

## Edge Cases

[To be designed]

## Dependencies

[To be designed]

## Tuning Knobs

[To be designed]

## Visual/Audio Requirements

[To be designed]

## Game Feel

[To be designed]

## UI Requirements

[To be designed]

## Cross-References

[To be designed]

## Acceptance Criteria

[To be designed]

## Open Questions

[To be designed]
