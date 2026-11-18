# Systems Index: Thunder Road Vendetta (porting digitale)

> **Status**: Draft
> **Created**: 2026-11-15
> **Last Updated**: 2026-11-15
> **Source Concept**: design/gdd/game-concept.md
> **Rules authority**: reference/rulebook/ (gioco base)

---

## Overview

*Thunder Road: Vendetta* è un porting fedele: le regole non si progettano, si **traducono**
dal regolamento ufficiale in sistemi implementabili (Pilastro 1, "Il regolamento è la
legge"). La scomposizione segue quindi due assi. Il primo è il **nucleo di regole**: un
kernel deterministico (Rules Core) che non contiene nessuna regola del regolamento ma
offre i punti di estensione, la coda degli effetti con decisioni pendenti, il log degli
eventi con causa e la proiezione stato completo → vista per giocatore; sopra di lui le
regole del gioco base sono **moduli** (7-16) caricati da un **pacchetto di contenuto**
alla pari di qualunque espansione futura (principio T2). Il secondo asse è la
**mediazione digitale**: tavolo 3D, pannelli a schermo, input, registro delle cause e
ritmo delle animazioni, che servono il Pilastro 2 ("Ogni dado si spiega") e il Pilastro 3
("Turni veloci, partita pronta"). Hot seat e online usano lo stesso nucleo (principio T1):
la rete (Alpha) è un consumatore della vista per giocatore, non un secondo motore.

La scomposizione è stata rivista dal technical-director (TD-SYSTEM-BOUNDARY, vedi sotto)
e dal producer (PR-SCOPE, vedi sotto); le correzioni sono già applicate.

### Sistemi, uno per uno

**Fondamenta e nucleo**
- **#2 Dice & Seeded RNG** — generatore pseudocasuale con seed e astrazione generica di
  dado (numero di facce, tiro, ritiro). Le **facce** dei dadi (movimento, strada, stunt,
  sparo, slam, direzione) sono dati del pacchetto (#4), non di questo sistema: così il
  sistema resta foundation e non crea il ciclo 1 → 2 → 4 → 1. È la base del determinismo
  (R2): stesso seed + stesso log = stessa partita.
- **#17 Interpretations Log** — il registro delle interpretazioni del regolamento: ogni
  ambiguità o silenzio del regolamento è chiesto all'utente e registrato con la pagina e un
  id; i GDD 7-16 citano gli id. Nel Tier 1 è un documento; la consultazione in gioco è #31.
- **#1 Rules Core & Event Log** — il kernel: stato, dispatch delle azioni, **coda esplicita
  degli effetti** (profondità prima, interruzione "perde le mosse residue", ripresa
  "continua a muoversi"), **decisioni pendenti** di qualunque giocatore (anche non di turno:
  es. ritiro dello slam chiesto dal proprietario del veicolo più grande), log degli eventi
  con involucro (causa, sequenza, versione regole e pacchetto), enumerazione delle azioni
  legali, proiezione stato completo → vista per giocatore. **Nessuna regola del regolamento
  vive qui**: criterio di accettazione, la sua suite di test gira con un pacchetto
  giocattolo senza moduli TR:V. Garanzia richiesta dal producer: lo stato è **ricostruibile
  da seed + log** (base per #30 e #29). Il GDD di #1 definisce anche, nel gruppo A,
  l'**involucro della causa** e l'**interfaccia del formattatore di causa** che i moduli
  #7-#16 registrano e #22 consuma (CD-SYSTEMS 1). Regola anti-deriva (CD-SYSTEMS 9):
  **nessun punto di estensione senza un consumatore TR:V** (gioco base o espansione
  ufficiale esistente); il pacchetto giocattolo è una fixture di test, non un prodotto.
- **#4 Content Pack & Rule Modules** — il pacchetto: manifest, id e versioni, caricamento,
  dati (tessere e loro due facce, segnalini, facce dei dadi, plance, veicoli) e matrice delle
  combinazioni di espansioni ammesse (solo quelle previste dai regolamenti ufficiali,
  Pilastri 1 e 3). Registra i moduli di regole sui punti di estensione di #1. Il gioco base
  è il primo pacchetto.
- **#3 Board, Terrain & Front Arc** — il modello geometrico: caselle a chevron, tre tessere
  (rear, middle, lead), terreni (strada, off-road, fango, invalicabile, spazio pericolo),
  arco frontale, bordi sinistro/destro/posteriore/anteriore, allineamento del dado
  direzione ai chevron.
- **#5 Asset Manifest & Pipeline** — manifest degli asset indicizzato per id di contenuto,
  caricamento a runtime (mai import statici da `assets/estratti/`), set segnaposto aperto,
  importazione dell'arte licenziata dal proprietario (R1, opzione A+C del technical-director).
- **#9 Vehicles, Crews & Status** — l'astrazione "veicolo stradale" (auto per taglia e
  wreck, trattati come auto piccole inoperabili) distinta dall'elicottero; bande, cruscotti,
  stati operabile / inoperabile / eliminato; l'**eliminazione è un effetto in coda** le cui
  conseguenze (danni che tornano nella pila, giocatore fuori, tessera finale) sono gestite
  da altri handler.

**Moduli di regole del gioco base**
- **#7 Match Setup & Road Deck** — preparazione (tessera di partenza, mazzo, segnalini
  pericolo per numero di giocatori, pila dei danni), primo giocatore, e i **parametri di
  partita** (numero di giocatori, bande, espansioni): è il dato che menu (#24) e server
  (#27) consumano.
- **#8 Turn & Round Flow** — gli **slot di passo** del turno, inizio round (tiro dei dadi
  movimento, p. 8), fine turno, passaggio del dado strada, salto dei giocatori fuori. Non
  dipende da #11: sono i moduli ad agganciarsi agli slot.
- **#10 Movement** — **proprietario della primitiva di spostamento**, volontario e forzato
  (slam, Skid, Blast Off, Dazed, pericoli), e della **catena di ingresso in casella** con
  hook (costo del terreno, rivelazione del pericolo, slam, invalicabile, uscita da un bordo,
  uscita dal fronte con scorrimento) e della mossa riprendibile. Il regolamento stesso
  raggruppa queste regole (p. 9). È il nuovo collo di bottiglia e la base di R3.
- **#13 Slam Resolution** — handler dell'ingresso in casella occupata: dado slam e dado
  direzione, ritiro per il veicolo più grande (decisione pendente), slam a catena.
- **#15 Damage & Repair** — pescata e risoluzione dei segnalini danno, inoperabilità,
  riparazione; gli spostamenti passano dalla primitiva di #10.
- **#12 Hazards & Wrecks** — segnalini pericolo (Road, Mud, Oil Slick, Wreck, Mine),
  rivelazione e risoluzione, creazione dei wreck; genera effetti di #10, #13 e #15.
- **#14 Shooting** — sparo nell'arco frontale; chi spara (auto mossa o elicottero) è
  scritto nel contesto del turno.
- **#11 Command Board** — le azioni della plancia comandi; Airstrike scrive nel contesto del
  turno lo sparo dell'elicottero, che #14 legge (niente nuovo ciclo).
- **#16 Road Advance & Endgame** — uscita dal fronte, scorrimento delle tessere, nuova
  tessera e pericoli, tessera finale, traguardo, vittoria per ultima banda operabile. Il GDD
  tiene separati scorrimento (test scritti prima del codice) e condizioni di vittoria.

*I dettagli delle regole qui sopra sono un riassunto per orientarsi: l'autorità resta il
regolamento, e ogni GDD li riprende con la pagina citata.*

**Presentazione** (GDD a rigore `standard`, vedi Note di processo)
- **#19 Table Renderer 3D** — il tavolo fisico dell'art bible: lastre, segnalini, pezzi,
  luce, camera; legge solo la vista.
- **#25 Animation & Pacing** — il **controllore di riproduzione** del flusso di eventi
  (sequenza, salta, accelera): base del livello presentazione, da cui dipendono #20, #21,
  #22, #26. MVP = tempi, coda visiva, salto/accelerazione. **Saltare comprime, non salta
  mai** un passo della catena né una decisione pendente (CD-SYSTEMS 2). Possiede il tuning
  knob "tempo massimo di animazione obbligatoria" del budget del turno (CD-SYSTEMS 4).
- **#20 Dice Presentation** — il dado fisico che si ferma sul valore del nucleo; emette
  "dado fermo"; interroga il servizio di layout per il tragitto verso il pannello.
- **#21 Player Panels** — cruscotti e plancia comandi a schermo (decisione C1), passaggi
  tavolo → pannello (art bible 7.4); pubblica i propri punti di ancoraggio. Mostra
  l'informazione pubblica ispezionata tramite #23 (cruscotti avversari, facce dei dadi,
  danni rivelati): criterio condiviso con #23, "tutto ciò che un giocatore attento vede al
  tavolo è consultabile prima di impegnare un dado" (CD-SYSTEMS 3).
- **#22 Cause Log & Slam Replay** — "esito ← causa" dall'involucro eventi di #1 e da
  **formattatori di causa registrati dai moduli** (così anche le espansioni si spiegano).
  MVP = attribuzione testuale **e storico sfogliabile** in cui ogni catena (es. slam a
  catena) compare raggruppata e rivedibile passo per passo dopo la risoluzione
  (CD-SYSTEMS 2); il replay animato è Tier 3.
- **#23 Input & Selection** — mouse e touch, selezione, evidenziazione delle mosse legali
  dall'enumerazione di #1 (la UI non decide mai la legalità), pianificazione prima della
  conferma come simulazione senza commit dell'RNG; conflitto C2 (bersagli touch) da
  risolvere qui con `/ux-design`. Possiede l'**ispezione** su hover e tocco
  dell'informazione pubblica (dati dalla vista di #1; visualizzazione in #21, CD-SYSTEMS 3)
  e il tuning knob "tetto di azioni per turno" (CD-SYSTEMS 4). Criterio anti-pilastro
  (CD-SYSTEMS 8): l'anteprima mostra **solo conseguenze deterministiche e pubbliche**
  (percorso, costo del terreno, arco), mai probabilità, esiti di dadi non tirati o mosse
  suggerite.
- **#24 Menus, Match Flow & Screens** — menu, scelta di giocatori/bande/espansioni, flusso
  della partita, rivincita, schermate di vittoria; assorbe l'ex #6 Match Session Flow
  (decisione dell'utente). Contiene una **superficie minima di impostazioni** solo per i
  requisiti di accessibilità marcati Tier 1 (CD-SYSTEMS 7). La scelta delle espansioni
  compare solo quando ne esiste almeno una: niente menu vuoto (CD-SYSTEMS 9).

**Alpha (Tier 2) e Full Vision (Tier 3-4)**
- **#30 Save & Resume Match** — salvataggio e ripresa da seed + log versionato. **Nel Tier 1
  (MVP) la parte minima**: autosalvataggio locale e "riprendi l'ultima partita", perché un
  refresh accidentale non deve far perdere una partita di 30-120 minuti (CD-SYSTEMS 5,
  accettato dall'utente; sostituisce la precedente "stretch"). Salvataggio completo a più
  slot nell'Alpha.
- **#27 Authoritative Server & Protocol** — server che esegue lo stesso nucleo; consuma solo
  la vista per giocatore (seed e pile non arrivano mai al client); scambia id di contenuto,
  mai immagini.
- **#28 Lobby & Rooms** — stanze, inviti, avvio partita online.
- **#29 Reconnection & Resilience** — riconnessione per rinvio del log.
- **#26 Audio Cues** — segnali sonori distinti come rinforzo non visivo (art bible 4.6).
- **#18 Settings & Accessibility** — schermata delle impostazioni. I **requisiti** di
  accessibilità sono invece un documento a sé in pre-produzione
  (`design/accessibility-requirements.md`), citato dai GDD 19, 21, 23, 25.
- **#31 In-game Rules Reference** — promemoria delle regole consultabile in gioco, con le
  voci del registro delle interpretazioni (decisione dell'utente).

**Non enumerati, per scelta**: bot (decisione rinviata), tutorial guidato, account e
classifiche, hosting operativo. Le espansioni non sono sistemi nuovi: sono pacchetti e
moduli di #4 (Tier 4).

### Note di processo (decisioni dell'utente)

- **Rigore differenziato**: i GDD di presentazione **#19-#25** si scrivono a rigore
  `standard` (Overview, Detailed Rules, Edge Cases, Dependencies, Acceptance Criteria, più
  Formulas se servono); il nucleo e i moduli di regole restano a rigore `full` (8 sezioni).
  Il progetto è configurato `full`: questa eccezione va richiamata a mano in `/design-system`
  per ciascuno di quei GDD.
- **Criterio di causa comune** (CD-SYSTEMS 1): ogni GDD #7-#16 ha tra i criteri di
  accettazione "ogni cambio di stato emette una causa formattabile" secondo l'interfaccia
  definita in #1.
- **Just-in-time**: nessuna story entra in uno sprint se il suo GDD non ha superato la
  design-review.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Rules Core & Event Log (inferred) | Core | MVP | Not Started | — | #2 |
| 2 | Dice & Seeded RNG | Core | MVP | In Review | [dice-seeded-rng.md](dice-seeded-rng.md) | — |
| 3 | Board, Terrain & Front Arc | Core | MVP | Not Started | — | #4 |
| 4 | Content Pack & Rule Modules (inferred) | Core | MVP | Not Started | — | #1 |
| 5 | Asset Manifest & Pipeline (inferred) | Core | MVP | Not Started | — | #4 |
| 7 | Match Setup & Road Deck | Gameplay | MVP | Not Started | — | #1, #2, #3, #4, #9 |
| 8 | Turn & Round Flow | Gameplay | MVP | Not Started | — | #1, #2, #7, #9 |
| 9 | Vehicles, Crews & Status | Gameplay | MVP | Not Started | — | #1, #3, #4 |
| 10 | Movement (move / enter-space primitive) | Gameplay | MVP | Not Started | — | #2, #3, #8, #9 |
| 11 | Command Board | Gameplay | MVP | Not Started | — | #8, #9, #10, #13, #14, #15 |
| 12 | Hazards & Wrecks | Gameplay | MVP | Not Started | — | #3, #4, #9, #10, #13, #15 |
| 13 | Slam Resolution | Gameplay | MVP | Not Started | — | #1, #2, #3, #9, #10 |
| 14 | Shooting | Gameplay | MVP | Not Started | — | #2, #3, #8, #9, #15 |
| 15 | Damage & Repair | Gameplay | MVP | Not Started | — | #1, #2, #3, #9, #10 |
| 16 | Road Advance & Endgame | Gameplay | MVP | Not Started | — | #3, #7, #8, #9, #10, #12 |
| 17 | Interpretations Log | Meta | MVP | Designed | [interpretations-log.md](interpretations-log.md) | — |
| 18 | Settings & Accessibility (inferred) | Persistence | Full Vision | Not Started | — | #23, #24, #25, #26 |
| 19 | Table Renderer 3D (inferred) | UI | MVP | Not Started | — | #1, #3, #5, #9, #12 |
| 20 | Dice Presentation (inferred) | UI | MVP | Not Started | — | #2, #19, #25 |
| 21 | Player Panels (inferred) | UI | MVP | Not Started | — | #9, #10, #11, #15, #25 |
| 22 | Cause Log & Slam Replay | UI | MVP | Not Started | — | #1, #19, #25 |
| 23 | Input & Selection (inferred) | UI | MVP | Not Started | — | #1, #3, #19, #21 |
| 24 | Menus, Match Flow & Screens (inferred; absorbs #6) | UI | MVP | Not Started | — | #4, #5, #7, #9, #16 |
| 25 | Animation & Pacing (inferred) | UI | MVP | Not Started | — | #1, #19 |
| 26 | Audio Cues (inferred) | Audio | Full Vision | Not Started | — | #1, #25 |
| 27 | Authoritative Server & Protocol | Network | Alpha | Not Started | — | #1, #4, #7 |
| 28 | Lobby & Rooms (inferred) | Network | Alpha | Not Started | — | #24, #27 |
| 29 | Reconnection & Resilience (inferred) | Network | Alpha | Not Started | — | #1, #27 |
| 30 | Save & Resume Match (inferred) | Persistence | MVP (autosave + resume last match); full save Alpha | Not Started | — | #1, #4, #24 |
| 31 | In-game Rules Reference (inferred) | Meta | Full Vision | Not Started | — | #17, #24 |
| 32 | TRV9000 Bots (fan-made, card-driven) | Gameplay | Alpha | In Review | [trv9000-bots.md](trv9000-bots.md) | #1, #2, #8, #10, #13, #14, #15 |

*#6 Match Session Flow non esiste più: assorbito da #24 (decisione dell'utente); i
parametri di partita sono dati di #7. Numerazione lasciata stabile.*
*Dipendenza leggera, non elencata per riga: i moduli #7-#16 citano gli id di #17.*

---

## Categories

| Category | Description | Typical Systems |
|----------|-------------|-----------------|
| **Core** | Kernel, contenuto e geometria su cui tutto si appoggia | #1, #2, #3, #4, #5 |
| **Gameplay** | I moduli di regole del regolamento | #7-#16 |
| **Persistence** | Salvataggio e impostazioni | #18, #30 |
| **UI** | Tavolo, pannelli, input, registro, menu, ritmo | #19-#25 |
| **Audio** | Segnali sonori | #26 |
| **Network** | Gioco online con server autorevole (categoria aggiunta) | #27, #28, #29 |
| **Meta** | Interpretazioni e promemoria delle regole | #17, #31 |

Categorie del template non usate: Progression, Economy, Narrative (il gioco non ha
progressione, economia né trama).

---

## Priority Tiers

| Tier | Definition | Target Milestone | Design Urgency |
|------|------------|------------------|----------------|
| **MVP** | = Tier 1 del concept: gioco base completo in hot seat. Senza questi non si gioca né si capisce perché si vince o si perde | Rilascio Tier 1 (M0-M3), entro 2 anni | Design FIRST (gruppi A e B, poi just-in-time) |
| **Vertical Slice** | Nessun sistema proprio: un taglio dei sistemi MVP che deve provare P2 e P3, non solo il rendering — include la catena di slam di p. 9 mostrata con #22 e #25 con il salto attivo, più una misura del budget del turno | `/vertical-slice` a fine pre-produzione | — |
| **Alpha** | = Tier 2 del concept: online (2a base, 2b robusto) e salvataggio | Tier 2, entro 3 anni | Design THIRD |
| **Full Vision** | = Tier 3-4 del concept: rifinitura, audio, impostazioni, promemoria regole; espansioni come pacchetti di #4 | Tier 3-4 | Design as needed |

> **Producer Note — PR-SCOPE: OPTIMISTIC** (2026-11-15), correzioni applicate. In
> pre-produzione (time-box ~120 h) entrano **7 GDD + requisiti di accessibilità** (gruppo
> A), gli altri just-in-time. I GDD #19-#25 a rigore `standard`. #30 nel Tier 1 solo come
> ripresa minima dell'ultima partita. Il GDD di #1 deve garantire "stato ricostruibile da
> seed + log". **Trigger di ritaratura**: cronometrare i GDD #2, #17 e #1; se #1 supera
> ~18 h, riscalare le stime M/L per il fattore osservato e rieseguire PR-SCOPE.
> *Aggiornamento dopo CD-SYSTEMS*: #30 minimo è ora MVP (non più stretch); il suo costo è
> basso perché #1 garantisce già la ricostruzione da seed + log.

> **Creative Director Note — CD-SYSTEMS: CONCERNS** (2026-11-15), tutti e 9 applicati
> (decisione dell'utente):
> (MVP) 1. involucro della causa e interfaccia del formattatore definiti in #1, criterio di
> causa in ogni GDD #7-#16; 2. #25 "saltare comprime, non salta", #22 storico sfogliabile
> nel Tier 1; 3. ispezione dell'informazione pubblica: #23 input, #21 visualizzazione;
> 4. budget del turno: tetto di azioni in #23, tempo massimo di animazione in #25;
> 5. #30 minimo promosso a MVP; 7. superficie minima di impostazioni in #24 per i requisiti
> di accessibilità Tier 1; 8. anteprima di #23 solo deterministica e pubblica; 9. regola
> "nessun punto di estensione senza consumatore TR:V" in #1, menu espansioni solo se esiste
> un'espansione.
> (Vertical Slice) 6. la VS include la fixture di p. 9 con #22/#25 e la misura del budget.
> (Full Vision) #31, #26 e #18 completo confermati.
> **Criterio di verifica**: alla vertical slice, un tester che perde un'auto in una catena
> mina → Skid → slam sa dire perché leggendo solo lo storico, dopo aver saltato le
> animazioni.

---

## Dependency Map

### Foundation Layer (no dependencies)

1. **#2 Dice & Seeded RNG** — il determinismo (R2) parte da qui; le facce sono dati di #4.
2. **#17 Interpretations Log** — formato di cui ogni GDD di regole ha bisogno per citare le
   proprie interpretazioni.

### Core Layer (depends on foundation)

1. **#1 Rules Core & Event Log** — depends on: #2. **Collo di bottiglia**: quasi tutto ne
   dipende; possiede i punti di estensione.
2. **#4 Content Pack & Rule Modules** — depends on: #1 (registra moduli sui punti di
   estensione del kernel; il kernel conosce l'identità del pacchetto solo come valore opaco
   per il log versionato).
3. **#3 Board, Terrain & Front Arc** — depends on: #4 (definizioni delle tessere).
4. **#5 Asset Manifest & Pipeline** — depends on: #4 (manifest indicizzato per id di
   contenuto).
5. **#9 Vehicles, Crews & Status** — depends on: #1, #3, #4. **Collo di bottiglia** per tutti
   i moduli di regole.

### Feature Layer (depends on core)

1. **#7 Match Setup & Road Deck** — depends on: #1, #2, #3, #4, #9
2. **#8 Turn & Round Flow** — depends on: #1, #2, #7, #9 (slot di passo; non dipende da #11)
3. **#10 Movement** — depends on: #2, #3, #8, #9. **Collo di bottiglia** dei moduli: tutti
   gli spostamenti e gli ingressi in casella passano da qui.
4. **#13 Slam Resolution** — depends on: #1, #2, #3, #9, #10
5. **#15 Damage & Repair** — depends on: #1, #2, #3, #9, #10
6. **#12 Hazards & Wrecks** — depends on: #3, #4, #9, #10, #13, #15
7. **#14 Shooting** — depends on: #2, #3, #8, #9, #15
8. **#11 Command Board** — depends on: #8, #9, #10, #13, #14, #15
9. **#16 Road Advance & Endgame** — depends on: #3, #7, #8, #9, #10, #12
10. **#30 Save & Resume Match** — depends on: #1, #4, #24 (parte minima MVP; completo Alpha)
11. **#27 Authoritative Server & Protocol** — depends on: #1, #4, #7 (Alpha; consuma solo la
    vista per giocatore, non tocca mai i file degli asset)
12. **#29 Reconnection & Resilience** — depends on: #1, #27 (Alpha)

### Presentation Layer (depends on features)

1. **#19 Table Renderer 3D** — depends on: #1, #3, #5, #9, #12
2. **#25 Animation & Pacing** — depends on: #1, #19 (controllore di riproduzione, base del
   livello)
3. **#20 Dice Presentation** — depends on: #2, #19, #25
4. **#21 Player Panels** — depends on: #9, #10, #11, #15, #25
5. **#22 Cause Log & Slam Replay** — depends on: #1, #19, #25 (+ formattatori di causa
   registrati dai moduli)
6. **#23 Input & Selection** — depends on: #1, #3, #19, #21 (azioni legali da #1)
7. **#24 Menus, Match Flow & Screens** — depends on: #4, #5, #7, #9, #16
8. **#28 Lobby & Rooms** — depends on: #24, #27 (Alpha)

### Polish Layer (depends on everything)

1. **#26 Audio Cues** — depends on: #1, #25
2. **#18 Settings & Accessibility** — depends on: #23, #24, #25, #26 (i *requisiti* di
   accessibilità sono anticipati in `design/accessibility-requirements.md`)
3. **#31 In-game Rules Reference** — depends on: #17, #24

**Foglie** (progettabili tardi): #26, #31, #28, #29, #22.

---

## Recommended Design Order

Gruppo **A** = completi e revisionati prima del gate Technical Setup (input degli ADR e del
prototipo M0). Gruppo **B** = subito dopo il gate, prima delle prime story di M1. Gruppo
**C** = just-in-time prima delle relative story.

| Order | System | Priority | Layer | Agent(s) | Est. Effort |
|-------|--------|----------|-------|----------|-------------|
| 1 | #2 Dice & Seeded RNG (A) | MVP | Foundation | systems-designer, lead-programmer | S |
| 2 | #17 Interpretations Log (A) | MVP | Foundation | game-designer | S |
| 3 | #1 Rules Core & Event Log (A, **insieme a #10**) | MVP | Core | lead-programmer, technical-director, game-designer | L |
| 4 | #10 Movement (A, **insieme a #1**) | MVP | Feature | game-designer, systems-designer | L |
| 5 | #4 Content Pack & Rule Modules (A) | MVP | Core | technical-director, game-designer | M |
| 6 | #3 Board, Terrain & Front Arc (A) | MVP | Core | game-designer, systems-designer | M |
| 7 | #5 Asset Manifest & Pipeline (A) | MVP | Core | technical-artist, lead-programmer | S |
| — | `design/accessibility-requirements.md` (A, non è un GDD: `/ux-design accessibility`) | MVP | — | ux-designer, accessibility-specialist | S |
| 8 | #9 Vehicles, Crews & Status (B) | MVP | Core | game-designer | M |
| 9 | #13 Slam Resolution (B) | MVP | Feature | game-designer, systems-designer | M |
| 10 | #15 Damage & Repair (B) | MVP | Feature | game-designer, systems-designer | M |
| 11 | #12 Hazards & Wrecks (B) | MVP | Feature | game-designer | M |
| 12 | #8 Turn & Round Flow (B) | MVP | Feature | game-designer | M |
| 13 | #7 Match Setup & Road Deck (C, M1) | MVP | Feature | game-designer | M |
| 14 | #14 Shooting (C, M1) | MVP | Feature | game-designer | S |
| 15 | #11 Command Board (C, M1) | MVP | Feature | game-designer | M |
| 16 | #16 Road Advance & Endgame (C, M1) | MVP | Feature | game-designer, systems-designer | L |
| 17 | #19 Table Renderer 3D (C, M2; rigore standard) | MVP | Presentation | technical-artist, art-director | M |
| 18 | #25 Animation & Pacing (C, M2; rigore standard) | MVP | Presentation | ux-designer, technical-artist | S |
| 19 | #20 Dice Presentation (C, M2; rigore standard) | MVP | Presentation | technical-artist | S |
| 20 | #21 Player Panels (C, M2; rigore standard) | MVP | Presentation | ux-designer, ui-programmer | M |
| 21 | #22 Cause Log & Slam Replay (C, M2; rigore standard) | MVP | Presentation | ux-designer | S |
| 22 | #23 Input & Selection (C, M2; rigore standard) | MVP | Presentation | ux-designer, ui-programmer | M |
| 23 | #24 Menus, Match Flow & Screens (C, M3; rigore standard) | MVP | Presentation | ux-designer, ui-programmer | M |
| 24 | #30 Save & Resume Match (C, M3: parte minima MVP; completo Alpha) | MVP | Feature | lead-programmer, game-designer | M |
| 25 | #27 Authoritative Server & Protocol | Alpha | Feature | network-programmer, technical-director | L |
| 26 | #28 Lobby & Rooms | Alpha | Presentation | network-programmer, ux-designer | M |
| 27 | #29 Reconnection & Resilience | Alpha | Feature | network-programmer | M |
| 28 | #26 Audio Cues | Full Vision | Polish | audio-director, sound-designer | S |
| 29 | #18 Settings & Accessibility | Full Vision | Polish | ux-designer, accessibility-specialist | S |
| 30 | #31 In-game Rules Reference | Full Vision | Polish | ux-designer, writer | S |

**#1 e #10 si scrivono insieme**: il contratto della coda si valida su un caso reale. Test di
accettazione comune, scritto come fixture nel GDD di #1 e rispettato (non ridefinito) dai GDD
di #12 e #13: l'esempio di Tony a p. 9 del regolamento (dado strada → relitto → slam) e una
catena mina → Skid → slam.

---

## Circular Dependencies

- **Risolto — cluster di risoluzione #13 → #12 → #15 → #10 → #13.** Uno slam può spingere
  un'auto su una mina, la mina infligge un danno, un danno può muovere l'auto e quel
  movimento può causare un altro slam. Risoluzione (TD-SYSTEM-BOUNDARY): (a) #10 possiede la
  primitiva di spostamento e la catena di ingresso in casella; #12, #13, #15 e #16
  registrano handler sui suoi hook e non sono chiamati da #10; (b) la coda degli effetti di
  #1 fissa ordine di risoluzione, interruzioni, riprese e decisioni pendenti. Il grafo
  dichiarato risulta aciclico.
- **Risolto — #20 Dice Presentation ↔ #21 Player Panels.** Il dado rotola sul tavolo e poi
  viaggia verso il pannello. Risoluzione: #25 è il controllore di riproduzione da cui
  dipendono entrambi; #21 pubblica i propri punti di ancoraggio su un servizio di layout che
  #20 interroga; #20 emette "dado fermo" (art bible 7.4).
- **Evitato — #1 → #2 → #4 → #1.** Le facce dei dadi sono dati di #4; #2 resta generico e
  non dipende da #4.
- **Evitato — #11 ↔ #14.** Airstrike scrive nel contesto del turno chi spara; #14 lo legge.

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| #1 Rules Core & Event Log | Technical | Determinismo, coda con decisioni pendenti, involucro versionato: se il contratto è sbagliato, tutto si rifà (R2); rischio god object | ADR prima del codice; GDD scritto con #10; suite con pacchetto giocattolo; fixture p. 9 |
| #10 Movement | Technical / Design | Primitiva usata da 5 sistemi; scorrimento delle tessere a metà mossa (R3) | Test scritti prima del codice sui casi limite di R3; registro interpretazioni |
| #16 Road Advance & Endgame | Technical | Scorrimento a metà mossa, eliminazioni, tessera finale | Scorrimento e vittoria separati nel GDD; test-first |
| #13 Slam Resolution | Design | Catene ricorsive, decisione di ritiro di un giocatore non di turno | Coda profondità-prima di #1; fixture condivise |
| #19 Table Renderer 3D | Technical | Prestazioni e leggibilità su tablet, memoria texture senza budget | Prototipo M0 su tablet reale; art bible 8 |
| #23 Input & Selection | Design | Caselle sotto il bersaglio touch minimo (art bible C2) | `/ux-design` con il prototipo |
| #5 Asset Manifest & Pipeline | Scope / Licence | Consegna dell'arte licenziata online (R1), da decidere prima del rilascio Tier 1 | Opzione A+C; ADR sul caricamento asset |
| #27 Authoritative Server & Protocol | Technical | Informazione nascosta (pile, seed) che non deve mai arrivare al client; costo di hosting no profit | Solo vista per giocatore |

> **Technical Director Note — TD-SYSTEM-BOUNDARY: CONCERNS** (2026-11-15), applicati in questo
> indice: confine #1/#4 invertito (il kernel non conosce il pacchetto); #10 proprietario della
> primitiva di spostamento; veicolo stradale ed eliminazione in coda in #9; decisioni pendenti
> nella coda di #1; facce dei dadi come dati di #4; #25 controllore di riproduzione; requisiti
> di accessibilità anticipati; #27 consuma solo la vista per giocatore. Da garantire nei GDD:
> #1 non contiene regole del regolamento; #16 separa scorrimento e vittoria.
> **Criterio di verifica**: un'espansione futura con un nuovo pericolo o un nuovo segnalino
> danno si aggiunge registrando un handler e un formattatore di causa, senza toccare #1, #10,
> #13 o #22.

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 30 |
| Design docs started | 2 |
| Design docs reviewed | 0 |
| Design docs approved | 0 |
| MVP systems designed | 2/24 |
| Vertical Slice systems designed | 0/0 (nessun sistema proprio) |

---

## Next Steps

- [ ] Review and approve this systems enumeration
- [ ] Gruppo A: `/design-system` per #2, #17, #1 + #10, #4, #3, #5; `/ux-design accessibility`
- [ ] Run `/design-review` on each completed GDD
- [ ] Cronometrare #2, #17, #1 (trigger di ritaratura PR-SCOPE)
- [ ] Run `/gate-check technical-setup` when the group A GDDs are designed
- [ ] Validate the highest-risk systems with `/vertical-slice` before committing to Production
