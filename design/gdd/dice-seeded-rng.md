# Dice & Seeded RNG

> **Status**: Designed (in attesa di /design-review)
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-15
> **Last Verified**: 2026-11-15
> **Implements Pillar**: P1 Il regolamento è la legge · P2 Ogni dado si spiega · T1 Stessa partita a ogni tavolo
> **Systems index**: #2 (Core · MVP · Foundation · gruppo A)
> **Creative Director Review (CD-GDD-ALIGN)**: APPROVED 2026-11-15 — RNG-14 (limite noto in hot seat) accettato dall'utente

## Summary

Generatore pseudocasuale con seed, il cui stato vive nello stato di partita, più le
primitive generiche di tiro, ritiro e mescolamento usate da tutti i moduli di regole. Per
il giocatore significa dadi onesti come al tavolo (facce equiprobabili, ritiri solo quelli
del regolamento, nessuna correzione della sfortuna) e tiri sempre spiegabili nello storico.
Esiste perché stesso seed + stesso log devono dare la stessa partita in hot seat, online,
nella ripresa e nei test (T1, R2).

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `None` (le facce dei dadi sono dati di #4 Content Pack & Rule Modules)

## Overview

Dice & Seeded RNG è il livello di **casualità riproducibile** del gioco: un generatore
pseudocasuale con seed, il cui stato vive dentro lo stato di partita, e un'astrazione
generica di **dado** (tiro, ritiro) e di **mescolamento** che tutti i moduli di regole
usano al posto di qualunque altra fonte di caso. Il sistema non sa *quali* dadi esistono
né cosa significano le loro facce: dadi movimento, dado strada, stunt, sparo, slam e
direzione sono **dati** del pacchetto di contenuto (#4), che questo sistema riceve come
liste di facce e tira senza interpretarle. Il giocatore non lo usa direttamente: lo
incontra ogni volta che un dado si ferma o un mazzo si mescola, e ne sente le garanzie
senza vederle.

Esiste per tre ragioni. **T1 (stessa partita a ogni tavolo)** e **R2**: dallo stesso seed
e dallo stesso log di azioni si ottiene sempre la stessa partita, sul browser come sul
server, ed è questo che rende possibili il server autorevole (#27), la riconnessione (#29)
e la ripresa della partita (#30). **P1 (il regolamento è la legge)**: ogni dado si comporta
come quello fisico, con le stesse facce, la stessa equiprobabilità delle facce stampate e
gli stessi ritiri previsti dal regolamento, senza correzioni "per sfortuna". **P2 (ogni dado
si spiega)**: ogni tiro e ogni ritiro diventa un evento con la sua causa, così il registro
(#22) e la presentazione (#20) mostrano un valore che il nucleo ha già deciso. Senza questo
sistema il gioco perderebbe la riproducibilità, e con essa l'online, il salvataggio e la
possibilità di dimostrare che un esito è quello del regolamento.

*Confine design / implementazione*: l'algoritmo del generatore, il formato del seed e la
rappresentazione dello stato sono decisioni tecniche → **diventano un ADR**. Questo GDD
fissa i requisiti di comportamento che l'ADR deve soddisfare.

## Player Fantasy

*Inquadratura: indiretta.* Il giocatore non usa questo sistema; ne sente gli effetti ogni
volta che un dado si ferma.

**"Il dado è onesto."** Tony finisce su un relitto e lo slam va storto: il proprietario
dell'auto più grande chiede il ritiro di entrambi i dadi, e il nuovo esito è quello e
basta, come al tavolo. Nessuna mano invisibile corregge la sfortuna, nessun dado "sa" chi
sta perdendo: le facce sono quelle stampate, i ritiri sono quelli del regolamento.
> *P1 — "il motore di gioco implementa il regolamento ufficiale; l'automazione può
> cambiare chi esegue un passo, mai l'esito."*

**Conseguenza: "ogni dado ha un perché."** Quando un giocatore perde un'auto dopo una
catena mina → Skid → slam, può aprire lo storico e trovare ogni dado tirato, con la sua
causa e, se c'è stato, il tiro che il ritiro ha sostituito. La fiducia nel dado nasce
dal poterlo verificare.
> *P2 — "ogni cambio di stato causato da un dado o da un token è attribuibile alla sua
> causa con uno sguardo o un clic."*

**Cosa chiede al resto del design**: niente correzioni della fortuna né facce pesate (P1);
ogni tiro, ritiro e mescolamento diventa un evento con causa (P2, consumato da #22); il
valore mostrato dal dado 3D è sempre quello già deciso dal nucleo (#20). La garanzia T1
("lo stesso tiro su ogni tavolo") è tecnica e resta nella Overview: il giocatore la sente
solo come assenza di sorprese.

## Detailed Design

### Core Rules

Le regole RNG-n sono citate dagli altri GDD con il loro id.

1. **RNG-1 Unica fonte di caso.** Ogni esito casuale di una partita (tiri di dado e
   mescolamenti) proviene dal generatore della partita. Il nucleo di regole non usa mai
   altre fonti (`Math.random`, orologio, entropia del sistema).
2. **RNG-2 Seed.** Ogni partita ha un seed fissato alla sua creazione. È l'**unico** punto
   in cui si usa entropia esterna (fonte crittografica), e avviene fuori dal nucleo: in
   locale alla creazione della partita (#7, #24), online sul server (#27). Una partita può
   anche essere creata con un seed dato (test, riproduzione di un bug).
3. **RNG-3 Stato nello stato di partita.** Lo stato del generatore fa parte dello stato
   completo di partita, come dato semplice e serializzabile. Stesso seed + stessa sequenza
   di azioni ⇒ stessa sequenza di esiti e stato finale identico, in ogni browser e sul
   server (T1, R2). Nessuno stato del generatore vive fuori dallo stato di partita.
4. **RNG-4 Un solo flusso.** Tutto il caso della partita esce da un'unica sequenza, nell'ordine
   in cui il nucleo lo richiede. L'ordine dipende solo dallo stato e dalle azioni, mai da
   tempi di animazione, di rete o di interfaccia.
5. **RNG-5 Dado come dato.** Un dado è definito dal pacchetto (#4) come un id e una lista
   ordinata di facce. Questo sistema conosce solo il **numero di facce** *n* e restituisce
   un **indice di faccia** da 0 a *n*−1; il significato della faccia (un numero, "x2",
   "FRONT LEFT", una taglia) è un'etichetta di #4 interpretata dai moduli di regole.
6. **RNG-6 Facce equiprobabili.** Ogni faccia stampata ha la stessa probabilità. Una
   distribuzione non uniforme del dado fisico (per esempio facce ripetute sul dado slam o
   sparo) si ottiene ripetendo l'etichetta nella lista delle facce, mai con pesi.
7. **RNG-7 Tiro multiplo.** Tirare più dadi insieme (i quattro dadi movimento, slam +
   direzione) consuma il flusso un dado per volta, nell'ordine della lista data dal
   chiamante; ogni dado ha il suo risultato.
8. **RNG-8 Ritiro.** Un ritiro di uno o più dadi già tirati produce nuovi risultati con
   nuove estrazioni dal flusso. Il risultato precedente non viene cancellato: resta nel log
   come **sostituito**, collegato al nuovo. *Quante volte* si può ritirare e *chi* lo chiede
   lo decide il modulo che applica la regola (per esempio #13: un solo ritiro di entrambi i
   dadi, chiesto dal proprietario del veicolo più grande; #7: ritiro di tutti i dadi a ogni
   parità sul totale più basso). Questo sistema non pone limiti propri.
9. **RNG-9 Mescolamento.** Mescolare una lista produce una permutazione uniforme: ogni
   ordinamento possibile ha la stessa probabilità. La pila e la pescata restano del sistema
   che possiede la pila (mazzo strada #7, segnalini pericolo #12, segnalini danno #15).
10. **RNG-10 Ogni uso è un evento.** Ogni tiro, ritiro e mescolamento emette un evento
    nell'involucro di #1, con: id dei dadi o della pila, risultati, **causa** (l'azione o
    l'effetto che l'ha richiesto) e, per un ritiro, il riferimento al tiro sostituito.
11. **RNG-11 Informazione nascosta.** L'ordine prodotto da un mescolamento, il seed e lo
    stato del generatore sono informazione nascosta: stanno nello stato completo e non
    compaiono mai nella vista per giocatore (proiezione di #1). La vista mostra solo che
    la pila è stata mescolata. I risultati dei dadi tirati sono pubblici.
12. **RNG-12 Nessun caso in simulazione.** La pianificazione prima della conferma (#23) non
    può richiedere un tiro né un mescolamento: se il percorso simulato arriva a un punto
    che richiederebbe il caso (per esempio entrare su un pericolo coperto), la simulazione
    si ferma lì e lo segnala. Così l'anteprima resta solo deterministica e pubblica
    (CD-SYSTEMS 8) e non può mai rivelare un esito futuro.
13. **RNG-13 Nessuna correzione.** Niente compensazione della sfortuna, nessuna memoria dei
    tiri precedenti, nessuna regola di "dadi più equi". L'esito è quello del flusso (P1,
    anti-pilastro "NOT un riequilibrio").
14. **RNG-14 Limite noto in hot seat.** In hot seat lo stato del generatore è nella memoria
    del dispositivo: chi ispeziona il programma potrebbe prevedere i tiri. È accettato come
    al tavolo fisico, dove il gioco è a fiducia; la protezione vera vale online, dove seed
    e stato restano sul server (#27). *Decisione dell'utente, 2026-11-15.*

*Fuori da questo sistema*: quali dadi esistono e le loro facce (#4); il tiro dei dadi
movimento a inizio round e del dado strada (#8); assegnare un dado a un'auto o a un comando
(#8, #11); allineare il dado direzione ai chevron (#3, #13); l'animazione del dado (#20).

### States and Transitions

**Generatore della partita**

| Stato | Entra quando | Esce verso |
|-------|--------------|------------|
| Assente | partita non ancora creata | Inizializzato (creazione con seed) |
| Inizializzato | seed fissato (RNG-2) | Avanzato (prima estrazione) |
| Avanzato | ogni estrazione per tiro, ritiro o mescolamento | Avanzato (estrazione successiva) |
| Serializzato | salvataggio, invio dello stato completo dal server, ripresa | Avanzato, ripristinato identico |

Non esiste una transizione "indietro": il generatore non si riavvolge. Rigiocare una
partita significa ripartire dal seed e riapplicare il log (#1).

**Risultato di un tiro**

| Stato | Significato | Transizioni |
|-------|-------------|-------------|
| Tirato | risultato valido, registrato nel log | → Sostituito (ritiro ammesso dal modulo) |
| Sostituito | resta nel log per la spiegazione (P2), non ha effetto sulle regole | nessuna (finale) |

### Interactions with Other Systems

| Sistema | Entra in #2 | Esce da #2 | Chi possiede l'interfaccia |
|---------|-------------|------------|----------------------------|
| #1 Rules Core & Event Log | stato completo di partita; contesto della causa | stato del generatore aggiornato; eventi di tiro, ritiro, mescolamento | #1 l'involucro eventi e la proiezione; #2 il contenuto degli eventi |
| #4 Content Pack | definizioni dei dadi (id, lista di facce) | — | #4 |
| #7 Match Setup & Road Deck | seed alla creazione locale; richieste di tiro (primo giocatore, parità) e mescolamento (mazzo, pile) | risultati, permutazioni | #2 le primitive; #7 la regola delle parità |
| #8 Turn & Round Flow | tiro dei 4 dadi movimento e del dado strada | risultati | #2 |
| #10, #12, #13, #14, #15 | tiri richiesti dagli effetti (direzione, stunt, slam, sparo) e ritiri (#13) | risultati con causa | #2; la regola d'uso è del modulo |
| #20 Dice Presentation | eventi di tiro | — (mostra solo il valore già deciso) | #2 gli eventi |
| #22 Cause Log | eventi con causa e tiri sostituiti | — | #1/#22 il formato a schermo |
| #23 Input & Selection | modalità simulazione | segnale "qui servirebbe un tiro" (RNG-12) | #2 |
| #27 Server, #29 Reconnection, #30 Save | stato serializzato | stato ripristinato identico | #2 la serializzabilità; il trasporto agli altri |

## Formulas

*Assunzione per l'ADR*: il generatore produce a ogni estrazione un intero senza segno a
`W` bit. Le formule sono scritte per `W = 32`, il valore che garantisce aritmetica identica
in ogni motore JavaScript (RNG-3); un ADR che scelga un'altra larghezza aggiorna `W` qui.

### F1 — Indice di faccia (estrazione esatta con rifiuto)

The face_index formula is defined as:

`limite = 2^W − (2^W mod n)` · ripeti `u = estrai()` finché `u < limite` · `face_index = u mod n`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| n | int | 1 – 2^W | data file (#4, lunghezza della lista di facce) | numero di facce del dado |
| W | int | 32 | constant (ADR del generatore) | bit di ogni estrazione |
| u | int | 0 – 2^W − 1 | calculated (flusso, RNG-4) | estrazione grezza dal generatore |
| limite | int | 2^W − n + 1 – 2^W | calculated | soglia sotto la quale l'estrazione è accettata |
| face_index | int | 0 – n − 1 | calculated | indice della faccia uscita nella lista di #4 |

**Output Range:** da 0 a n − 1, ognuno con probabilità **esattamente** 1/n (RNG-6). Ogni
tiro consuma **almeno un'estrazione**, anche con n = 1 (decisione dell'utente: l'ordine del
flusso non dipende dai dati del pacchetto). La probabilità di dover ripetere è
`(2^W mod n) / 2^W`: per n = 6 vale 4 / 2^32 ≈ 9,3 · 10⁻¹⁰, quindi in pratica un tiro
consuma un'estrazione; il numero di estrazioni resta comunque deterministico dato il seed.
**Valori limite:** n = 0 non è ammesso: un dado senza facce è rifiutato alla validazione
del pacchetto (#4), mai al momento del tiro. n = 1 → `limite = 2^W`, nessun rifiuto
possibile, `face_index = 0`, un'estrazione consumata. n = 2^W → `limite = 2^W`,
`face_index = u`.
**Example:** dado movimento con 6 facce. Estrazione `u = 3 141 592 653`; `limite =
4 294 967 296 − 4 = 4 294 967 292`; `u < limite`, accettata; `face_index = 3 141 592 653
mod 6 = 3` → la quarta faccia della lista di #4.

### F2 — Probabilità di un'etichetta (solo per i test)

The label_probability formula is defined as:

`p(etichetta) = conteggio(etichetta) / n`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| conteggio | int | 1 – n | data file (#4) | quante facce del dado portano quell'etichetta |
| n | int | 1 – 2^W | data file (#4) | numero di facce del dado |
| p | float | 1/n – 1 | calculated | probabilità attesa dell'etichetta |

**Output Range:** da 1/n (etichetta su una sola faccia) a 1 (tutte le facce uguali).
**Uso:** riferimento dei test statistici di accettazione e della verifica dei dati di #4
contro il dado fisico. **Non viene mai mostrata al giocatore**: le probabilità calcolate
sono escluse dal confine "come un giocatore attento" (P2, anti-pilastro "NOT un giocatore
al posto tuo").
**Example:** un dado a 6 facce con un'etichetta stampata su 2 facce → `p = 2/6 ≈ 0,333`.
*(I valori reali di dadi slam e sparo li fissa #4 dalla pagina del regolamento.)*

### F3 — Mescolamento uniforme

The shuffle formula is defined as:

per `k` da `m − 1` fino a `1`: `j = face_index(n = k + 1)` (F1) · scambia gli elementi in
posizione `k` e `j`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| m | int | 0 – nessun limite proprio | calculated (dimensione della pila del sistema proprietario) | elementi da mescolare |
| k | int | 1 – m − 1 | calculated | posizione corrente, dall'ultima alla seconda |
| j | int | 0 – k | calculated (F1) | posizione scelta per lo scambio |
| estrazioni_F1 | int | max(0, m − 1) | calculated | chiamate a F1 consumate |

**Output Range:** una delle `m!` permutazioni, ognuna con probabilità esattamente `1/m!`
(RNG-9), perché ogni F1 è esatta. Consuma `max(0, m − 1)` chiamate a F1.
**Valori limite:** m = 0 o m = 1 → nessuna chiamata a F1, ordine invariato; l'evento
"pila mescolata" viene comunque emesso (RNG-10), così il log non dipende dal contenuto
della pila. Nessun valore di `m` produce una divisione o un risultato inutilizzabile.
**Example:** pila di 3 segnalini [A, B, C]. k = 2: F1 con n = 3 dà j = 0 → [C, B, A].
k = 1: F1 con n = 2 dà j = 1 → nessuno scambio. Risultato [C, B, A], 2 chiamate a F1.

**Cicli di retroazione:** nessuno. Ogni estrazione è indipendente dalle precedenti per
costruzione (RNG-13): non esistono meccanismi che rendano più o meno probabile un esito in
base ai risultati passati.

## Edge Cases

- **If viene chiesto il ritiro di un risultato già Sostituito**: la richiesta è rifiutata,
  nessuna estrazione consumata, stato invariato. Si ritira solo un risultato nello stato
  Tirato; la regola d'uso del ritiro resta del modulo (RNG-8).
- **If si ritira un gruppo di dadi tirati insieme** (per esempio slam + direzione, #13): i
  dadi sono ritirati nello stesso ordine del tiro originale (RNG-7) e ogni nuovo risultato
  è collegato al proprio sostituito.
- **If più giocatori tirano "contemporaneamente"** (i dadi movimento nel setup, i dadi
  movimento a inizio round): non esiste contemporaneità nel flusso. Il nucleo consuma le
  estrazioni nell'ordine dei posti stabilito da #7, poi nell'ordine dei dadi di ciascuno.
- **If la parità sul totale più basso nel setup si ripete**: #2 non impone alcun tetto ai
  ritiri, come il regolamento ("finché non c'è più parità"). La probabilità di una nuova
  parità a ogni giro è minore di 1, quindi la sequenza termina con probabilità 1, ed è
  comunque deterministica per seed. La regola della parità è di #7.
- **If il seed fornito è un qualunque valore ammesso dal formato dell'ADR** (incluso 0):
  produce un generatore valido. Nessun seed può dare un generatore degenere, per esempio
  bloccato su un valore; l'ADR deve garantirlo o normalizzare il seed.
- **If due partite partono dallo stesso seed con le stesse azioni**: sono identiche ed è
  voluto (riproduzione dei bug, test, replay). La rivincita e ogni nuova partita usano un
  seed nuovo, creato da #7/#24 (o dal server, #27).
- **If uno stato serializzato è stato prodotto da un'altra versione del generatore**: lo
  stato serializzato porta l'id e la versione dell'algoritmo. Se non coincidono con quelli
  disponibili, la partita **non** viene ripresa con l'algoritmo sbagliato; la decisione
  (rifiuto o rigioco con la versione registrata) è di #1 tramite la versione del log.
- **If una pila contiene elementi identici** (per esempio più segnalini pericolo Road):
  il mescolamento permuta le posizioni; elementi uguali restano indistinguibili e non
  serve nessun caso speciale. Il numero di estrazioni dipende solo dalla dimensione della
  pila (F3).
- **If una partita è online**: il client non tira e non mescola mai; riceve gli eventi già
  risolti dal server (#27). Il seed e lo stato del generatore non arrivano mai al client
  (RNG-11).
- **If a runtime arriva un dado senza facce** (dati sfuggiti alla validazione di #4): è
  un errore del nucleo; lo stato resta invariato e nessuna estrazione è consumata. Non si
  inventa un risultato.
- **If un giocatore ricarica un salvataggio per "ritirare" un dado** (strategia degenere):
  non funziona, ed è voluto. Seed e stato del generatore fanno parte del salvataggio (#30),
  quindi il tiro successivo è identico a quello che avrebbe avuto. Il salvataggio non può
  essere usato per pescare un esito migliore.
- **If un giocatore online si disconnette prima di un tiro sfavorevole** (strategia
  degenere): il tiro è deciso dal server nell'ordine del flusso, indipendentemente dalla
  connessione; alla riconnessione (#29) l'esito è lo stesso.

## Dependencies

**A monte (questo sistema dipende da)**: nessun sistema. È un sistema foundation per
scelta (TD-SYSTEM-BOUNDARY): riceve il numero di facce come dato dal chiamante e non
importa le definizioni dei dadi. Così non nasce il ciclo #1 → #2 → #4 → #1.

**A valle (dipendono da questo sistema)**: tutti senza GDD al 2026-11-15. Ogni loro GDD
deve citare #2 nelle proprie Dependencies (regola di bidirezionalità).

| Sistema | Natura | Interfaccia | Hard / soft |
|---------|--------|-------------|-------------|
| #1 Rules Core & Event Log | ospita lo stato del generatore e l'involucro degli eventi | stato serializzabile (RNG-3); eventi RNG-10 | hard: senza #2 il nucleo non ha caso riproducibile |
| #4 Content Pack & Rule Modules | fornisce le facce che i moduli passano a #2 | lista di facce → `n` (RNG-5); validazione n ≥ 1 | hard per i moduli, non per #2 |
| #7 Match Setup & Road Deck | crea il seed in locale; tiri del setup; mescolamenti | RNG-2, RNG-7, RNG-8, RNG-9 | hard |
| #8 Turn & Round Flow | tiro dei dadi movimento e del dado strada | RNG-7 | hard |
| #10 Movement, #12 Hazards, #13 Slam, #14 Shooting, #15 Damage | tiri e ritiri richiesti dagli effetti | RNG-7, RNG-8 | hard |
| #20 Dice Presentation | mostra il valore deciso | eventi RNG-10 | soft: il nucleo funziona senza presentazione |
| #22 Cause Log & Slam Replay | spiega tiri e ritiri | eventi con causa e tiri sostituiti | soft |
| #23 Input & Selection | simulazione senza caso | segnale RNG-12 | hard per la correttezza dell'anteprima |
| #27 Server, #29 Reconnection, #30 Save & Resume | conservano e ripristinano lo stato | stato serializzato con id e versione dell'algoritmo | hard |

**Provvisorio**: le interfacce verso #1 e #4 (formato dell'involucro, validazione dei dadi)
sono assunte qui e vanno confermate quando i loro GDD saranno scritti (gruppo A).

## Tuning Knobs

**Nessun tuning knob proprio**, ed è voluto: un dado del regolamento non si "tara" (P1,
anti-pilastro "NOT un riequilibrio").

| Valore che sembra un knob | Dove vive davvero | Perché non è un knob di #2 |
|---------------------------|-------------------|----------------------------|
| Facce di ogni dado e loro etichette (`n`, `conteggio`) | #4 Content Pack, letti dalla pagina del regolamento | sono dati del contenuto, non bilanciamento; cambiarli è un errore di trascrizione, non una taratura |
| Larghezza dell'estrazione `W` | ADR del generatore | costante tecnica |
| Seed | creazione della partita (#7, #24, #27) | è un input di partita, non un valore di design |
| Soglie dei test statistici | suite di test | parametri di verifica, non di gioco |

## Visual/Audio Requirements

Nessun requisito proprio: #2 non disegna e non suona nulla. Un solo vincolo verso chi lo
fa: il dado 3D e il suono del tiro (#20, #26) **mostrano un risultato già deciso** dal
nucleo e non possono influenzarlo né anticiparlo (RNG-4). Animazione minima del lancio o
solo valore mostrato è una domanda aperta di #20 (concept, Open Questions).

## Game Feel

Nessun requisito proprio. La sensazione da proteggere è la fiducia nel dado (Player
Fantasy): nessun esito deve sembrare "corretto" dal programma, e la presentazione non deve
mai far intuire un risultato prima che il dado si fermi.

## UI Requirements

Nessuna interfaccia propria. Ciò che il giocatore vede di questo sistema passa da:
- **#20 Dice Presentation** — il valore del dado;
- **#22 Cause Log** — tiri, ritiri (con il tiro sostituito) e mescolamenti con la causa;
- **#23 Input & Selection** — il segnale "qui servirebbe un tiro" che ferma l'anteprima
  (RNG-12).

Nessuna di queste superfici mostra probabilità (F2, confine P2).

## Cross-References

| Questo documento cita | Cosa | Tipo |
|-----------------------|------|------|
| `design/gdd/systems-index.md` | #2 foundation senza dipendenze; facce come dati di #4; ordine di design | contesto |
| `design/gdd/game-concept.md` | P1, P2, T1, R2, anti-pilastri "riequilibrio" e "giocatore al posto tuo" | pilastri |
| #1 Rules Core & Event Log *(GDD non scritto)* | involucro eventi, proiezione della vista, versione del log | interfaccia provvisoria |
| #4 Content Pack & Rule Modules *(GDD non scritto)* | liste di facce, validazione n ≥ 1 | interfaccia provvisoria |
| #7 Match Setup & Road Deck *(GDD non scritto)* | seed locale, parità del setup, ordine dei posti | uso |
| #13 Slam Resolution *(GDD non scritto)* | un solo ritiro di entrambi i dadi | uso di RNG-8 |
| #23 Input & Selection *(GDD non scritto)* | simulazione senza caso | uso di RNG-12 |
| #27, #29, #30 *(GDD non scritti)* | stato serializzato, seed nascosto | uso di RNG-3 e RNG-11 |
| `reference/rulebook/` | componenti (5 dadi FX, 16 dadi movimento), ritiri del setup e dello slam | fonte delle regole |

## Acceptance Criteria

Tutti i criteri sono **Logic** (test automatici Vitest in `tests/unit/dice-rng/`), tranne
AC-02 (anche integrazione Playwright). I test statistici usano un **seed fisso**, quindi
sono deterministici (standard di test: niente seed casuali); la soglia è il chi-quadro con
p = 0,001.

| ID | Copre | Criterio |
|----|-------|----------|
| AC-01 | RNG-2, RNG-3 | **GIVEN** un seed S e una sequenza di azioni L, **WHEN** la partita è giocata due volte da zero, **THEN** la sequenza di eventi e lo stato finale serializzato sono identici byte per byte. |
| AC-02 | RNG-3, T1 | **GIVEN** S e L, **WHEN** la stessa partita gira in Node e in un browser (Chromium, Firefox, WebKit), **THEN** i risultati di tutti i tiri e lo stato finale coincidono. |
| AC-03 | RNG-1 | **GIVEN** il codice del nucleo di regole, **WHEN** il controllo statico della suite lo esamina, **THEN** non contiene `Math.random`, letture dell'orologio né fonti di entropia; l'unico uso di entropia esterna è nella creazione della partita, fuori dal nucleo. |
| AC-04 | RNG-4 | **GIVEN** S e L, **WHEN** la partita è giocata senza presentazione e poi con animazioni saltate o accelerate, **THEN** i risultati dei tiri coincidono. |
| AC-05 | RNG-5 | **GIVEN** un dado di #4 con facce [A, B, C, D, E, F], **WHEN** viene tirato, **THEN** il risultato è un indice 0–5 che, letto nella lista di #4, dà l'etichetta; #2 non restituisce etichette. |
| AC-06 | F1, RNG-6 | **GIVEN** un dado a 6 facce e un seed fisso, **WHEN** è tirato 600 000 volte, **THEN** il chi-quadro sulle 6 frequenze è < 20,52 (5 gradi di libertà, p = 0,001). |
| AC-07 | F1 limite n = 1 | **GIVEN** un dado a 1 faccia e un generatore con seed S, **WHEN** è tirato, **THEN** il risultato è 0 e il tiro successivo di un altro dado dà lo stesso risultato della **seconda** estrazione di un generatore nuovo con seed S. |
| AC-08 | F1 rifiuto | **GIVEN** una sorgente di estrazioni iniettata che produce prima `2^32 − 1` e poi `7`, **WHEN** si tira un dado a 6 facce, **THEN** la prima estrazione è scartata e il risultato è `7 mod 6 = 1`, con 2 estrazioni consumate. |
| AC-09 | F1 limite n = 0 | **GIVEN** un dado senza facce, **WHEN** il pacchetto è validato, **THEN** è rifiutato; **WHEN** un dado simile arriva comunque a un tiro, **THEN** il nucleo segnala un errore, lo stato è invariato e nessuna estrazione è consumata. |
| AC-10 | F2, RNG-6 | **GIVEN** un dado a 6 facce con l'etichetta X su 2 facce e un seed fisso, **WHEN** è tirato 600 000 volte, **THEN** la frequenza di X è 1/3 entro il chi-quadro < 10,83 (1 grado di libertà, p = 0,001). |
| AC-11 | RNG-7 | **GIVEN** un generatore con seed S, **WHEN** si tirano insieme i dadi [a, b], **THEN** a ha il risultato della prima estrazione F1 e b quello della seconda. |
| AC-12 | RNG-8 | **GIVEN** un tiro Tirato di slam + direzione, **WHEN** il modulo chiede il ritiro, **THEN** i due vecchi risultati passano a Sostituito e sono collegati ai nuovi, che usano le estrazioni successive nello stesso ordine; **WHEN** si chiede il ritiro di un risultato Sostituito, **THEN** è rifiutato e nessuna estrazione è consumata. |
| AC-13 | F3, RNG-9 | **GIVEN** una pila di 3 elementi e un seed fisso, **WHEN** è mescolata 60 000 volte, **THEN** il chi-quadro sulle 6 permutazioni è < 20,52 (5 gradi di libertà, p = 0,001). |
| AC-14 | F3 limiti | **GIVEN** una pila di 0 o 1 elementi, **WHEN** è mescolata, **THEN** l'ordine è invariato, nessuna estrazione è consumata e l'evento "pila mescolata" è emesso. |
| AC-15 | RNG-10 | **GIVEN** una partita con K tiri, R ritiri e M mescolamenti, **WHEN** si legge il log, **THEN** contiene esattamente K + R + M eventi di caso, ognuno con una causa non vuota; ogni ritiro riferisce il tiro sostituito. |
| AC-16 | RNG-11 | **GIVEN** uno stato completo dopo un mescolamento e alcuni tiri, **WHEN** #1 produce la vista di un giocatore, **THEN** la vista non contiene il seed, lo stato del generatore né l'ordine della pila, e contiene i risultati dei dadi tirati. |
| AC-17 | RNG-12, CD-SYSTEMS 8 | **GIVEN** uno stato del generatore X e una mossa pianificata che entra su un pericolo coperto, **WHEN** #23 la simula, **THEN** la simulazione si ferma su quella casella con il segnale "serve un tiro" e lo stato del generatore è ancora X. |
| AC-18 | RNG-13 | **GIVEN** due stati di partita con lo stesso stato del generatore raggiunti con storie diverse, **WHEN** si tira lo stesso dado, **THEN** il risultato è identico. |
| AC-19 | Edge: salvataggio (#30) | **GIVEN** una partita a metà, **WHEN** è serializzata, ripristinata e si tira il dado successivo, **THEN** il risultato è identico a quello della partita non interrotta. |
| AC-20 | Edge: versione | **GIVEN** uno stato serializzato con un id o una versione di algoritmo diversi da quelli disponibili, **WHEN** si tenta la ripresa, **THEN** non avviene in silenzio con l'algoritmo corrente: l'esito è quello deciso da #1. |
| AC-21 | Edge: seed | **GIVEN** il seed 0 e il seed massimo del formato, **WHEN** si producono 1 000 estrazioni per ciascuno, **THEN** non sono tutte uguali e AC-06 passa con quei seed. |

**Non verificabile con un test**: RNG-14 (limite noto in hot seat) è una politica
accettata, non un comportamento; resta documentata e non ha criterio.

## Open Questions

| # | Domanda | Responsabile | Entro |
|---|---------|--------------|-------|
| OQ-1 | Algoritmo del generatore, formato del seed, larghezza `W`, id e versione dell'algoritmo nello stato serializzato. Lo scaffold usa mulberry32, che non è una decisione. | technical-director + lead-programmer (ADR) | prima del gate Technical Setup |
| OQ-2 | Liste esatte delle facce di dado strada, stunt, sparo, slam, direzione e movimento, lette dalla pagina del regolamento. | GDD #4 Content Pack | gruppo A |
| OQ-3 | Formato dell'involucro degli eventi e campo "causa" (RNG-10). | GDD #1 Rules Core | gruppo A |
| OQ-4 | Ordine dei posti con cui si consumano i tiri del setup e di inizio round. | GDD #7 Match Setup | gruppo C (M1) |
