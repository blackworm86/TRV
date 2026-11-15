# Dice & Seeded RNG

> **Status**: In Review — /design-review 2026-11-15: NEEDS REVISION, revisioni applicate, in attesa di riesame
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

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: nessuna per l'algoritmo; contratto di stato ed eventi con #1 (bidirezionale). Le facce dei dadi sono dati di #4 Content Pack & Rule Modules

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
basta, come al tavolo. *(Variante illustrativa dell'esempio di p. 9, dove Tony è contento
del tiro e non chiede il ritiro; la regola è a p. 9, passo 2: "a single reroll of BOTH
dice".)* Nessuna mano invisibile corregge la sfortuna, nessun dado "sa" chi
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

**Cosa si verifica, e dove**: lo storico permette di verificare le **cause** di ogni dado,
non di ricalcolare i numeri (il seed resta nascosto per tutta la partita, RNG-11). Online
la garanzia di onestà è piena, perché seed e stato restano sul server (RNG-15); in hot seat
è un modello a fiducia, come al tavolo fisico (RNG-14).

## Detailed Design

### Core Rules

Le regole RNG-n sono citate dagli altri GDD con il loro id.

1. **RNG-1 Unica fonte di caso.** Ogni esito casuale di una partita (tiri di dado e
   mescolamenti) proviene dal generatore della partita. Il nucleo di regole non usa mai
   altre fonti (`Math.random`, orologio, entropia del sistema).
2. **RNG-2 Seed.** Ogni partita ha un seed fissato alla sua creazione. È l'**unico** punto
   in cui si usa entropia esterna (fonte crittografica), e avviene fuori dal nucleo: in
   locale alla creazione della partita (#7, #24), online sul server (#27). Una partita può
   anche essere creata con un seed dato (test, riproduzione di un bug). Un seed fuori dal
   formato dell'ADR-A (NaN, negativo, non intero, oltre `SEED_MAX`, stringa malformata) è
   **rifiutato** con un errore esplicito, mai normalizzato in silenzio (P2: un seed
   corretto di nascosto non si può spiegare). Online il server crea il seed e rifiuta
   qualunque seed proposto da un client: chi sceglie il seed conosce tutto il flusso.
3. **RNG-3 Stato nello stato di partita.** Lo stato del generatore fa parte dello stato
   completo di partita, come dato semplice e serializzabile. Stesso seed + stessa sequenza
   di azioni ⇒ stessa sequenza di esiti e stato finale identico, in ogni browser e sul
   server (T1, R2). Nessuno stato del generatore vive fuori dallo stato di partita, né a
   livello di modulo: due generatori usati in modo interlacciato danno gli stessi esiti
   che usati uno dopo l'altro. Lo stato serializzato porta **id e versione
   dell'algoritmo**, le parole di stato come interi senza segno a 32 bit e il **contatore
   delle estrazioni**, in una forma canonica (ordine delle chiavi fisso) definita
   dall'ADR-A, così che due stati uguali diano la stessa stringa.
4. **RNG-4 Un solo flusso.** Tutto il caso della partita esce da un'unica sequenza, nell'ordine
   in cui il nucleo lo richiede. L'ordine dipende solo dallo stato e dalle azioni, mai da
   tempi di animazione, di rete o di interfaccia. Le estrazioni si consumano **al momento
   della risoluzione della regola**, mai all'emissione, all'invio o al reinvio di un
   evento; un'azione ricevuta due volte (stesso id) non consuma estrazioni la seconda
   volta (contratto di idempotenza di #1 e #27). Se l'ADR-A sceglie flussi separati per
   classe di visibilità (vedi RNG-15), questa regola vale per ciascun flusso.
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
   parità sul totale più basso). Questo sistema non pone limiti propri: i limiti sono regole
   del gioco e restano nel modulo che le cita (P1), che li verifica con i propri criteri di
   accettazione (#13, #7). Un risultato nuovo è a sua volta Tirato. Perché un abuso resti
   visibile, ogni ritiro registra **chi l'ha chiesto** (il posto) e **la regola applicata**
   (id del modulo e pagina del regolamento), oltre ai collegamenti ai sostituiti.
   *Regole citate*: slam, p. 9 passo 2; parità del setup, p. 5 passo 6.
9. **RNG-9 Mescolamento.** Mescolare una lista produce una permutazione uniforme: ogni
   ordinamento possibile ha la stessa probabilità **rispetto a una sorgente ideale** di
   estrazioni uniformi e indipendenti. Con un generatore reale questo richiede che ogni
   ordinamento sia raggiungibile: lo stato deve avere almeno log2(m_max!) bit, dove m_max è
   la pila più grande del gioco (requisito di RNG-15). La pila e la pescata restano del sistema
   che possiede la pila (mazzo strada #7, segnalini pericolo #12, segnalini danno #15).
10. **RNG-10 Ogni uso è un evento.** Ogni tiro, ritiro e mescolamento diventa un evento
    nell'involucro di #1, con: id dei dadi o della pila, risultati, **causa** (l'azione o
    l'effetto che l'ha richiesto) e, per un ritiro, il riferimento ai risultati sostituiti
    e il richiedente (RNG-8). **Un evento per gruppo**: un tiro di più dadi insieme (i
    quattro dadi movimento, slam + direzione) è un solo evento con i risultati nell'ordine
    di RNG-7, anche quando F1 ha dovuto ripetere estrazioni; un ritiro di gruppo è un solo
    evento che collega ogni nuovo risultato al proprio sostituito.
    *Ripartizione con #1*: #2 è un **nucleo puro** che riceve lo stato del generatore e
    restituisce `(stato', risultati)` senza id e senza emettere nulla; #1 assegna gli id
    (contatore di sequenza nello stato di partita, mai valori casuali), avvolge il
    contenuto nell'involucro ed emette l'evento. Lo stato Sostituito non è memorizzato a
    parte: si ricava dai collegamenti nel log.
11. **RNG-11 Informazione nascosta.** L'ordine prodotto da un mescolamento, il seed e lo
    stato del generatore sono informazione nascosta: stanno nello stato completo e non
    compaiono mai nella vista per giocatore (proiezione di #1). La vista mostra solo che
    la pila è stata mescolata. I risultati dei dadi tirati sono pubblici.
    **Ogni payload verso un client** (vista, flusso di eventi, replay, stato di
    riconnessione di #29) è una proiezione per giocatore: non contiene mai il seed, le
    parole di stato, il contatore delle estrazioni, le estrazioni grezze `u` né la
    permutazione di un mescolamento; l'evento di mescolamento arriva al client solo come
    "pila X mescolata". Online un client non può ricostruire la partita dal seed, perché
    non lo riceve.
12. **RNG-12 Nessun caso in simulazione.** La pianificazione prima della conferma (#23) non
    può richiedere un tiro né un mescolamento: se il percorso simulato arriva a un punto
    che richiederebbe il caso (per esempio entrare su un pericolo coperto), la simulazione
    si ferma lì e lo segnala. Così l'anteprima resta solo deterministica e pubblica
    (CD-SYSTEMS 8) e non può mai rivelare un esito futuro.
    È un **contratto**, non una buona intenzione: la simulazione gira su uno stato che non
    dà accesso al generatore. Una regola che ha bisogno del caso non tira: restituisce una
    **richiesta di tiro** (un effetto). L'esecutore reale la soddisfa con il generatore;
    quello di simulazione si ferma e produce il segnale "qui servirebbe un tiro". La forma
    esatta (tipi, esecutori) è dell'ADR-B, condiviso con #1 e #23.
13. **RNG-13 Nessuna correzione.** Niente compensazione della sfortuna, nessuna memoria dei
    tiri precedenti, nessuna regola di "dadi più equi". L'esito è quello del flusso (P1,
    anti-pilastro "NOT un riequilibrio").
14. **RNG-14 Limite noto in hot seat.** In hot seat lo stato del generatore è nella memoria
    del dispositivo: chi ispeziona il programma potrebbe prevedere i tiri. È accettato come
    al tavolo fisico, dove il gioco è a fiducia; la protezione vera vale online, dove seed
    e stato restano sul server (#27). *Decisione dell'utente, 2026-11-15.* Il limite
    riguarda anche l'ordine delle pile, non solo la previsione dei tiri: in hot seat la
    proiezione per giocatore (RNG-11) resta l'unica via verso l'interfaccia, ma lo stato
    completo è ispezionabile con gli strumenti del browser.
15. **RNG-15 Imprevedibilità.** Nessun osservatore dei risultati pubblici può prevedere gli
    esiti futuri né ricostruire l'ordine di una pila nascosta. Un generatore a stato
    piccolo non lo garantisce: con mulberry32 (32 bit di stato) bastano 15–20 risultati di
    d6 pubblici per individuare lo stato e prevedere tutto il resto, anche se seed e stato
    restano sul server. Requisiti per l'ADR-A:
    - stato di almeno **128 bit** e comunque almeno log2(m_max!) bit (RNG-9), con seed di
      pari entropia;
    - uscite da cui lo stato non si ricava: generatore deterministico di livello
      crittografico (per esempio ChaCha20 con chiave e contatore), oppure flussi separati
      per classe di visibilità con i mescolamenti su un flusso che non condivide stato con i
      dadi pubblici;
    - **vietati** mulberry32, xorshift, PCG32, sfc32 e ogni generatore invertibile dalle
      uscite;
    - lo stesso algoritmo in ogni modalità (hot seat, online, test), per T1.
    La scelta fra le due opzioni è dell'ADR-A (OQ-1); il creative-director raccomanda il
    flusso unico crittografico.

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
| n | int | 1 – 65 536 (2^16) | data file (#4, lunghezza della lista di facce) o F3 | numero di facce del dado; oltre 2^16 è rifiutato (validazione di #4, errore a runtime) |
| W | int | 32 | constant (ADR del generatore) | bit di ogni estrazione (larghezza dell'uscita, non dello stato: lo stato è di RNG-15) |
| u | int | 0 – 2^W − 1 | calculated (flusso, RNG-4) | estrazione grezza dal generatore |
| limite | int | 2^W − n + 1 – 2^W | calculated | soglia sotto la quale l'estrazione è accettata; con n ≤ 2^16 vale sempre almeno 2^W − 2^16 + 1 |
| face_index | int | 0 – n − 1 | calculated | indice della faccia uscita nella lista di #4 |

**Output Range:** da 0 a n − 1, ognuno con probabilità **esattamente** 1/n **data
un'estrazione `u` uniforme** su [0, 2^W) (RNG-6; l'uniformità è un requisito dell'ADR-A,
RNG-15): `limite` è un multiplo di n, quindi ogni indice ha `limite / n` estrazioni che lo
producono. Ogni
tiro consuma **almeno un'estrazione**, anche con n = 1 (decisione dell'utente: l'ordine del
flusso non dipende dai dati del pacchetto). La probabilità di dover ripetere è
`(2^W mod n) / 2^W`: per n = 6 vale 4 / 2^32 ≈ 9,3 · 10⁻¹⁰, quindi in pratica un tiro
consuma un'estrazione; il numero di estrazioni resta comunque deterministico dato il seed.
Il numero di estrazioni di un tiro **non ha un tetto**, ma con n ≤ 2^16 la probabilità di
rifiuto è sotto 2^−16 e il numero atteso di estrazioni è sotto 1 + 2^−15.
**Valori limite:** n = 0 non è ammesso: un dado senza facce è rifiutato alla validazione
del pacchetto (#4), mai al momento del tiro. n = 1 → `limite = 2^W`, nessun rifiuto
possibile, `face_index = 0`, un'estrazione consumata. n = 2^16 (e ogni potenza di 2) →
`2^W mod n = 0`, `limite = 2^W`, nessun rifiuto. n < 0, non intero o > 2^16 → errore del
nucleo (Edge Cases).
**Nota di implementazione (JavaScript):** `2^W` = 4 294 967 296 non sta in un intero a 32
bit. `u` va normalizzata con `>>> 0`; `2^W mod n` e il confronto `u < limite` si calcolano
in aritmetica Number (`4294967296 % n`), mai con operatori bitwise, che lavorano su interi
con segno a 32 bit; niente BigInt in una sola delle piattaforme (T1). Gli interni del
generatore usano solo operazioni a 32 bit portabili (`Math.imul`, `>>> 0`).
**Example:** dado movimento con 6 facce. Estrazione `u = 3 141 592 653`; `limite =
4 294 967 296 − 4 = 4 294 967 292`; `u < limite`, accettata; `face_index = 3 141 592 653
mod 6 = 3` → la quarta faccia della lista di #4.

### F2 — Probabilità di un'etichetta (solo per i test)

The label_probability formula is defined as:

`p(etichetta) = conteggio(etichetta) / n`

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| conteggio | int | 0 – n | data file (#4) | quante facce del dado portano quell'etichetta |
| n | int | 1 – 65 536 | data file (#4) | numero di facce del dado |
| p | razionale | 0 – 1 | calculated | probabilità attesa dell'etichetta, tenuta come frazione `conteggio / n` (non come float) |

**Output Range:** da 0 (etichetta assente dal dado) a 1 (tutte le facce uguali); 1/n per
un'etichetta su una sola faccia.
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
| m | int | 0 – 65 536 | calculated (dimensione della pila del sistema proprietario) | elementi da mescolare; il limite viene da n ≤ 2^16 di F1 |
| k | int | 1 – m − 1 | calculated | posizione corrente, dall'ultima alla seconda |
| j | int | 0 – k | calculated (F1) | posizione scelta per lo scambio |
| chiamate_F1 | int | max(0, m − 1) | calculated | chiamate a F1 consumate |
| estrazioni_grezze | int | ≥ chiamate_F1 | calculated | estrazioni `u` consumate; maggiori delle chiamate solo quando F1 rifiuta |

**Output Range:** una delle `m!` permutazioni, ognuna con probabilità `1/m!` **rispetto a
una sorgente ideale** (RNG-9), perché ogni F1 è esatta data un'estrazione uniforme. Con un
generatore reale vale solo se lo stato ha almeno log2(m!) bit (RNG-15): con 32 bit di
stato già una pila di 13 elementi (13! > 2^32) avrebbe ordinamenti irraggiungibili.
Consuma `max(0, m − 1)` chiamate a F1. F3 chiama F1 sempre con n = k + 1 ≥ 2, quindi la
regola "almeno un'estrazione anche con n = 1" non entra mai in gioco qui: una pila di 1
elemento consuma 0 estrazioni, un dado a 1 faccia ne consuma 1, ed è voluto (la dimensione
della pila viene dallo stato, il dado dal pacchetto).
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
  ritiri, come il regolamento (p. 5, passo 6: "until there is no tie for lowest total").
  La sequenza termina con probabilità 1 **a condizione** che una non-parità sia possibile:
  almeno 2 giocatori e dadi movimento con almeno 2 facce. #7 e la validazione di #4 lo
  garantiscono (i dadi movimento del regolamento sono a 6 facce); con questa precondizione
  la probabilità di una nuova parità a ogni giro è minore di 1. La sequenza è comunque
  deterministica per seed. La regola della parità è di #7.
- **If il seed fornito è un qualunque valore ammesso dal formato dell'ADR** (incluso 0 e
  `SEED_MAX`): produce un generatore valido. Nessun seed può dare un generatore degenere,
  per esempio bloccato su un valore o con un ciclo corto; l'ADR-A lo garantisce con
  un'espansione del seed nello stato completo (per esempio una funzione di hash), non
  normalizzando il seed.
- **If il seed fornito non è ammesso dal formato** (NaN, negativo, non intero, oltre
  `SEED_MAX`, stringa malformata): la creazione della partita fallisce con un errore
  esplicito e nessun generatore viene creato (RNG-2).
- **If online un client propone un seed**: il server lo rifiuta e crea il proprio (RNG-2).
- **If un'azione arriva due volte** (reinvio dopo una riconnessione): la seconda non
  consuma estrazioni (RNG-4); il controllo dell'id dell'azione è di #1 e #27.
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
- **If a runtime arriva un dado non valido** (n = 0, n < 0, n non intero o n > 2^16: dati
  sfuggiti alla validazione di #4): è un errore del nucleo, restituito come valore di
  errore tipizzato (`RngError`, forma nell'ADR-B), non come eccezione nascosta; lo stato
  resta invariato e nessuna estrazione è consumata. Non si inventa un risultato.
- **If si chiede il ritiro di un risultato nuovo** (già prodotto da un ritiro, quindi
  Tirato): #2 lo accetta; se la regola lo vieta (per esempio il ritiro unico dello slam,
  p. 9), è il modulo a non chiederlo, e i suoi criteri lo verificano (RNG-8).
- **If un giocatore ricarica un salvataggio per "ritirare" un dado** (strategia degenere):
  non funziona, ed è voluto. Seed e stato del generatore fanno parte del salvataggio (#30),
  quindi il tiro successivo è identico a quello che avrebbe avuto. Il salvataggio non può
  essere usato per pescare un esito migliore.
- **If un giocatore online si disconnette prima di un tiro sfavorevole** (strategia
  degenere): il tiro è deciso dal server nell'ordine del flusso, indipendentemente dalla
  connessione; alla riconnessione (#29) l'esito è lo stesso.

## Dependencies

**A monte (questo sistema dipende da)**: nessun sistema **per l'algoritmo**. È un sistema
foundation per scelta (TD-SYSTEM-BOUNDARY): riceve il numero di facce come dato dal
chiamante e non importa le definizioni dei dadi, così non nasce il ciclo #1 → #2 → #4 → #1.
Il **contratto di stato ed eventi con #1 è invece bidirezionale**: #1 ospita lo stato del
generatore (RNG-3), assegna gli id ed emette gli eventi (RNG-10), e fornisce la causa; #2
definisce il contenuto e resta un nucleo puro `(stato', risultati)`. Il ciclo di
interfaccia si chiude con il GDD di #1 e con l'ADR-C (involucro degli eventi).

**A valle (dipendono da questo sistema)**: tutti senza GDD al 2026-11-15. Ogni loro GDD
deve citare #2 nelle proprie Dependencies (regola di bidirezionalità).

| Sistema | Natura | Interfaccia | Hard / soft |
|---------|--------|-------------|-------------|
| #1 Rules Core & Event Log | ospita lo stato del generatore e l'involucro degli eventi; assegna gli id; proiezione per giocatore | stato serializzabile (RNG-3); contenuto degli eventi RNG-10; redazione RNG-11; idempotenza RNG-4 | hard in entrambi i sensi: senza #2 il nucleo non ha caso riproducibile, senza #1 #2 non emette eventi |
| #4 Content Pack & Rule Modules | fornisce le facce che i moduli passano a #2 | lista di facce → `n` (RNG-5); validazione n ≥ 1 | hard per i moduli, non per #2 |
| #7 Match Setup & Road Deck | crea il seed in locale; tiri del setup; mescolamenti | RNG-2, RNG-7, RNG-8, RNG-9 | hard |
| #8 Turn & Round Flow | tiro dei dadi movimento e del dado strada | RNG-7 | hard |
| #10 Movement, #12 Hazards, #13 Slam, #14 Shooting, #15 Damage | tiri e ritiri richiesti dagli effetti | RNG-7, RNG-8 | hard |
| #20 Dice Presentation | mostra il valore deciso | eventi RNG-10 | soft: il nucleo funziona senza presentazione |
| #22 Cause Log & Slam Replay | spiega tiri e ritiri | eventi con causa e tiri sostituiti | soft |
| #23 Input & Selection | simulazione senza caso | segnale RNG-12 | hard per la correttezza dell'anteprima |
| #27 Server, #29 Reconnection, #30 Save & Resume | conservano e ripristinano lo stato | stato serializzato con id e versione dell'algoritmo; payload ai client senza dati del generatore (RNG-11); seed creato dal server (RNG-2); azioni idempotenti (RNG-4) | hard |

**Provvisorio**: le interfacce verso #1 e #4 (formato dell'involucro, id, validazione dei
dadi) sono assunte qui e vanno confermate quando i loro GDD saranno scritti (gruppo A).

**ADR richiesti**: ADR-A generatore, seed, stato serializzato e versioni (OQ-1); ADR-B
nucleo puro, richieste di tiro come effetti e confine del lint (RNG-1, RNG-12), condiviso
con #1 e #23; ADR-C involucro degli eventi e causa (OQ-3), di proprietà di #1.

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
- **#22 Cause Log** — tiri, ritiri (con il tiro sostituito, chi l'ha chiesto e la regola)
  e mescolamenti con la causa;
- **#23 Input & Selection** — il segnale "qui servirebbe un tiro" che ferma l'anteprima
  (RNG-12). Il messaggio dice che l'anteprima si ferma **per regola** e che nessun esito è
  ancora deciso, mai qualcosa che faccia credere che il gioco "sappia" già il risultato.

Vincolo per #20 e #22: un ritiro mostra **insieme** il risultato sostituito e quello nuovo;
il vecchio risultato non sparisce senza traccia.

Nessuna di queste superfici mostra probabilità (F2, confine P2).

## Cross-References

| Questo documento cita | Cosa | Tipo |
|-----------------------|------|------|
| `design/gdd/systems-index.md` | #2 foundation senza dipendenze; facce come dati di #4; ordine di design | contesto |
| `design/gdd/game-concept.md` | P1, P2, T1, R2, anti-pilastri "riequilibrio" e "giocatore al posto tuo" | pilastri |
| #1 Rules Core & Event Log *(GDD non scritto)* | involucro eventi, proiezione della vista, versione del log | interfaccia provvisoria |
| #4 Content Pack & Rule Modules *(GDD non scritto)* | liste di facce, validazione n ≥ 1 | interfaccia provvisoria |
| #7 Match Setup & Road Deck *(GDD non scritto)* | seed locale, parità del setup, ordine dei posti | uso |
| #13 Slam Resolution *(GDD non scritto)* | un solo ritiro di entrambi i dadi (p. 9); il limite e i suoi test sono di #13 | uso di RNG-8 |
| #23 Input & Selection *(GDD non scritto)* | simulazione senza caso | uso di RNG-12 |
| #27, #29, #30 *(GDD non scritti)* | stato serializzato, seed nascosto | uso di RNG-3 e RNG-11 |
| `reference/rulebook/` | componenti (5 dadi FX, 16 dadi movimento: elenco componenti), ritiri del setup (p. 5, passo 6) e dello slam (p. 9, passo 2) | fonte delle regole, verificata il 2026-11-15 |

## Acceptance Criteria

**Tipo di test.** **Logic**: test automatico Vitest in `tests/unit/dice-rng/`, eseguibile
ora con il solo #2. **Integrazione**: richiede #1, #4, #7, #20, #23, #24, #27 o #30; il
criterio è fissato qui ma il test si scrive con quel sistema (storia di integrazione).
Dove un criterio ha una parte Logic e una di Integrazione, è diviso in due.

**Test statistici.** Soglia del progetto **p = 1e-4** (decisione dell'utente,
2026-11-15): chi-quadro < 25,74 con 5 gradi di libertà, < 15,14 con 1 grado; i valori si
prendono da una costante citata nel test, non scritti a mano. I seed sono **registrati in
anticipo** come costanti in `tests/unit/dice-rng/fixtures/seeds.ts`, con accanto id e
versione dell'algoritmo e il chi-quadro osservato; con un seed fisso il test è
deterministico (standard di test). Se un seed registrato fallisce non si sostituisce in
silenzio: si provano 20 seed diversi (uno che fallisce ogni 10 000 circa è sfortuna, molti
sono un difetto). Ogni cambio di algoritmo nell'ADR-A rivalida i seed.

**Sorgente iniettabile.** I criteri sull'ordine di consumo usano una **sorgente di
estrazioni scritta a mano** (per esempio `[u1, u2, …]`) al posto del generatore, così non
dipendono dall'algoritmo; l'iniezione è un requisito dell'API (ADR-B).

| ID | Tipo | Copre | Criterio |
|----|------|-------|----------|
| AC-01 | Logic | RNG-3 | **GIVEN** un seed S e una lista fissa di chiamate (tiri, ritiri, mescolamenti), **WHEN** è eseguita due volte da zero, **THEN** i risultati coincidono e lo stato serializzato in forma canonica (ADR-A) è la stessa stringa. *La variante a livello di partita intera (azioni e log) è Integrazione con #1/#7.* |
| AC-02 | Integrazione (Playwright) | RNG-3, T1 | **GIVEN** il file di riferimento `tests/unit/dice-rng/fixtures/golden-v1.json` (per i seed registrati: prime 1 000 estrazioni, 100 tiri con n = 6, un mescolamento di 10 elementi, stato serializzato finale), **WHEN** lo stesso calcolo gira in Node e in Chromium, Firefox e WebKit, **THEN** tutti e quattro i risultati coincidono con il file. |
| AC-03 | Logic | RNG-1 | **GIVEN** il percorso del nucleo fissato dall'ADR-B, **WHEN** il lint della suite lo esamina, **THEN** non contiene `Math.random`, `Date`, `performance.now`, `crypto.*`, `process.hrtime` né import di `node:crypto`; l'entropia compare solo nel modulo di creazione del seed in lista di eccezione. **AND GIVEN** quei globali sostituiti da funzioni che lanciano un errore, **WHEN** si esegue una lista di chiamate scritta, **THEN** termina senza errori. |
| AC-04 | Logic | RNG-4 | **GIVEN** S e una lista di chiamate, **WHEN** è eseguita con due ordini diversi di notifiche esterne iniettate (fine animazione, arrivo di rete), **THEN** i risultati coincidono; l'API non riceve alcun valore di tempo. *La variante con la presentazione reale è Integrazione con #20.* |
| AC-05 | Logic | RNG-5, RNG-6 | **GIVEN** la funzione di tiro, **WHEN** se ne controlla il tipo, **THEN** riceve il numero di facce `n` (non una lista di facce e nessun parametro di peso) e restituisce un indice intero; **AND GIVEN** un dado di #4 con facce [A, B, C, D, E, F], **WHEN** è tirato, **THEN** il risultato è un indice 0–5 e l'etichetta si legge nella lista di #4. |
| AC-06 | Logic | F1, RNG-6 | **GIVEN** un dado a 6 facce e un seed registrato, **WHEN** è tirato 600 000 volte, **THEN** il chi-quadro sulle 6 frequenze è < 25,74 (5 gradi di libertà, p = 1e-4). |
| AC-07 | Logic | F1 limite n = 1 | **GIVEN** un dado a 1 faccia e un generatore con seed S, **WHEN** è tirato, **THEN** il risultato è 0 e il tiro successivo di un altro dado dà lo stesso risultato della **seconda** estrazione di un generatore nuovo con seed S. |
| AC-08 | Logic | F1 rifiuto | Con una sorgente iniettata e un dado a 6 facce (`limite` = 4 294 967 292): **GIVEN** `[2^32 − 1, 7]`, **THEN** la prima estrazione è scartata, il risultato è 1 e le estrazioni consumate sono 2; **GIVEN** `[4 294 967 291]`, **THEN** è accettata e il risultato è 5; **GIVEN** `[4 294 967 292, 0]`, **THEN** la prima è scartata e il risultato è 0; **GIVEN** `[3 141 592 653]`, **THEN** il risultato è 3 (esempio di F1). |
| AC-09a | Integrazione (#4) | F1 limite n | **GIVEN** un pacchetto con un dado senza facce o con più di 65 536 facce, **WHEN** è validato, **THEN** è rifiutato con l'id del dado. |
| AC-09b | Logic | F1 limite n | **GIVEN** un generatore in uno stato X, **WHEN** si tira con n = 0, n = −1, n = 2,5 o n = 65 537, **THEN** si ottiene un `RngError` di dado non valido, lo stato serializzato è ancora quello di X e il contatore delle estrazioni non cambia. |
| AC-10 | Logic | F2, RNG-6 | **GIVEN** un dado a 6 facce con l'etichetta X su 2 facce e un seed registrato, **WHEN** è tirato 600 000 volte, **THEN** il chi-quadro della frequenza di X contro 1/3 è < 15,14 (1 grado di libertà, p = 1e-4). |
| AC-11 | Logic | RNG-7 | **GIVEN** una sorgente iniettata `[u1, u2]`, **WHEN** si tirano insieme i dadi [a, b] a 6 facce, **THEN** a vale `u1 mod 6` e b vale `u2 mod 6`. |
| AC-12a | Logic | RNG-8, RNG-10 | **GIVEN** un tiro di gruppo slam + direzione, **WHEN** si chiede il ritiro del gruppo con richiedente e regola, **THEN** si ottiene un solo risultato di ritiro: i due nuovi risultati usano le estrazioni successive nell'ordine del tiro originale, ognuno è collegato al proprio sostituito, e il contenuto porta richiedente e regola. |
| AC-12b | Logic | RNG-8 | **GIVEN** un risultato Sostituito, **WHEN** se ne chiede il ritiro, **THEN** è rifiutato con un `RngError` e nessuna estrazione è consumata. |
| AC-12c | Logic | RNG-8 | **GIVEN** un risultato nuovo prodotto da un ritiro, **WHEN** se ne chiede il ritiro, **THEN** #2 lo accetta (il limite è del modulo, che lo verifica nei propri criteri: #13 per lo slam). |
| AC-13 | Logic | F3, RNG-9 | **GIVEN** una pila di 3 elementi e un seed registrato, **WHEN** è mescolata 60 000 volte, **THEN** il chi-quadro sulle 6 permutazioni è < 25,74 (5 gradi di libertà, p = 1e-4). **AND GIVEN** la pila [A, B, C] e una sorgente iniettata che fa dare a F1 j = 0 e poi j = 1, **THEN** il risultato è [C, B, A] (esempio di F3). |
| AC-14 | Logic | F3 limiti | **GIVEN** una pila di 0 o 1 elementi, **WHEN** è mescolata, **THEN** l'ordine è invariato, le estrazioni consumate sono 0 ed è prodotto il contenuto dell'evento "pila mescolata"; **GIVEN** una pila di m elementi tutti uguali, **THEN** le chiamate a F1 sono m − 1. |
| AC-15 | Integrazione (#1) | RNG-10 | **GIVEN** una partita con K tiri di gruppo, R ritiri e M mescolamenti, **WHEN** si legge il log, **THEN** contiene esattamente K + R + M eventi di caso (uno per gruppo anche quando F1 ha ripetuto estrazioni, e anche per pile di 0 o 1 elementi), ognuno con una causa non vuota e un id da contatore; ogni ritiro riferisce i sostituiti, il richiedente e la regola. |
| AC-16 | Integrazione (#1, #27, #29) | RNG-11 | **GIVEN** una partita con il seed `0x9E3779B9`, un mescolamento e alcuni tiri, **WHEN** si producono la vista di un giocatore, il flusso di eventi verso il suo client e lo stato di riconnessione, **THEN** nessuno contiene il seed (in decimale o esadecimale), le parole di stato, il contatore, le estrazioni grezze o l'ordine della pila, e tutti contengono i risultati dei dadi; **AND** due stati che differiscono solo per l'ordine della pila danno viste identiche. |
| AC-17a | Logic | RNG-12 | **GIVEN** uno stato del generatore X e una regola che ha bisogno del caso, **WHEN** è eseguita con l'esecutore di simulazione, **THEN** restituisce una richiesta di tiro e lo stato del generatore è ancora X. |
| AC-17b | Integrazione (#23) | RNG-12, CD-SYSTEMS 8 | **GIVEN** una mossa pianificata che entra su un pericolo coperto, **WHEN** #23 la simula, **THEN** la simulazione si ferma su quella casella con il segnale "serve un tiro" e lo stato del generatore è invariato. |
| AC-18 | Logic | RNG-13 | **GIVEN** un insieme di stati di fixture con lo stesso stato del generatore raggiunto con storie diverse, **WHEN** si tira lo stesso dado, **THEN** il risultato è identico in tutti; **AND GIVEN** una sorgente iniettata con 100 estrazioni uguali seguite da `u` noto, **THEN** il 101° tiro vale `u mod n`. |
| AC-19 | Logic | RNG-3, Edge: salvataggio (#30) | **GIVEN** un generatore in vari punti di una sequenza, compreso subito dopo un'estrazione rifiutata da F1, **WHEN** è serializzato, letto e serializzato di nuovo, **THEN** le due stringhe sono uguali e il tiro successivo del generatore ripristinato è identico a quello del generatore mai interrotto. |
| AC-20 | Logic | Edge: versione | **GIVEN** uno stato serializzato con id o versione dell'algoritmo diversi da quelli disponibili, **WHEN** si tenta la deserializzazione, **THEN** si ottiene un errore `AlgorithmMismatch` e nessun generatore. *La decisione successiva (rifiuto o rigioco con la versione registrata) è Integrazione con #1/#30.* |
| AC-21 | Logic (*rinviato all'ADR-A per `SEED_MAX`*) | Edge: seed | **GIVEN** i seed 0, 1 e `SEED_MAX` (costante dell'ADR-A), **WHEN** si producono 1 000 estrazioni per ciascuno, **THEN** ogni sequenza ha almeno 990 valori distinti e le tre sequenze sono diverse fra loro. |
| AC-22 | Logic | RNG-2 | **GIVEN** un seed NaN, negativo, non intero, oltre `SEED_MAX` o una stringa malformata, **WHEN** si crea un generatore, **THEN** si ottiene un errore di seed non valido e nessun generatore. |
| AC-23 | Logic | RNG-3 | **GIVEN** due generatori con seed diversi, **WHEN** le loro estrazioni sono alternate, **THEN** ognuno dà la stessa sequenza che dà se usato da solo. |
| AC-24 | Integrazione (#27) | Edge: online, RNG-11 | **GIVEN** un client online, **WHEN** applica gli eventi del server, **THEN** lo fa senza generatore e il suo stato non ha alcun campo del generatore. |
| AC-25 | Integrazione (#27) | RNG-2, RNG-4 | **GIVEN** un server con una partita in corso, **WHEN** un client propone un seed, **THEN** è rifiutato; **WHEN** la stessa azione arriva due volte con lo stesso id, **THEN** il contatore delle estrazioni avanza una volta sola. |
| AC-26 | Integrazione (#7, #24) | Edge: rivincita | **GIVEN** una sorgente di entropia iniettata che fornisce `[s1, s2]`, **WHEN** si creano una partita e la sua rivincita, **THEN** usano seed diversi. |

**Non verificabile con un test**: RNG-14 (limite noto in hot seat) è una politica
accettata, non un comportamento; resta documentata e non ha criterio. RNG-15
(imprevedibilità) si verifica con la revisione dell'ADR-A, che deve dimostrare i requisiti
(dimensione dello stato, generatore non invertibile dalle uscite); i criteri qui
verificano solo il comportamento deterministico.

## Open Questions

| # | Domanda | Responsabile | Entro |
|---|---------|--------------|-------|
| OQ-1 | **ADR-A**: algoritmo del generatore, formato del seed e `SEED_MAX`, larghezza `W`, espansione del seed nello stato, forma canonica dello stato serializzato (id, versione, parole, contatore), file di riferimento per AC-02. **Vincolo**: deve soddisfare RNG-15. Lo scaffold usa mulberry32, che **non** lo soddisfa ed è vietato: non è un default. Il creative-director raccomanda un flusso unico crittografico (per esempio ChaCha20). | technical-director + lead-programmer (ADR) | voce del gate Technical Setup; prima del GDD di #27 |
| OQ-5 | **ADR-B**: forma dell'API pura (stato in, stato fuori), sorgente di estrazioni iniettabile, richieste di tiro come effetti (RNG-12), tipo `RngError`, percorso del nucleo e regola di lint (AC-03). | lead-programmer, con #1 e #23 | prima delle storie di #2 |
| OQ-6 | Rivelare il seed a fine partita, perché i giocatori possano verificare anche i numeri (dopo la fine non svela più nulla, compatibile con RNG-11)? | GDD #22 e #27 | gruppo C |
| OQ-2 | Liste esatte delle facce di dado strada, stunt, sparo, slam, direzione e movimento, lette dalla pagina del regolamento. | GDD #4 Content Pack | gruppo A |
| OQ-3 | **ADR-C**: formato dell'involucro degli eventi, campo "causa", id da contatore, richiedente e regola dei ritiri, redazione per giocatore (RNG-10, RNG-11). | GDD #1 Rules Core | gruppo A |
| OQ-4 | Ordine dei posti con cui si consumano i tiri del setup e di inizio round. | GDD #7 Match Setup | gruppo C (M1) |
