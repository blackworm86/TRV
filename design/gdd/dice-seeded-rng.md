# Dice & Seeded RNG

> **Status**: In Review — /design-review 2026-11-15 (secondo riesame): NEEDS REVISION, revisioni applicate, in attesa di riesame
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-15
> **Last Verified**: 2026-11-15
> **Implements Pillar**: P1 Il regolamento è la legge · P2 Ogni dado si spiega · T1 Stessa partita a ogni tavolo
> **Systems index**: #2 (Core · MVP · Foundation · gruppo A)
> **Creative Director Review (CD-GDD-ALIGN)**: APPROVED 2026-11-15 — RNG-14 (limite noto in hot seat) accettato dall'utente

## Summary

Generatore pseudocasuale con seed, il cui stato vive nello stato di partita, più le
primitive generiche di tiro, ritiro e mescolamento usate da tutti i moduli di regole. Per
il giocatore significa dadi onesti come al tavolo (facce equiprobabili, ritiri solo quando
un modulo li chiede citando la regola, nessuna correzione della sfortuna) e tiri sempre
spiegabili nello storico.
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
sistema il gioco perderebbe la riproducibilità, e con essa l'online, il salvataggio, la
spiegazione della causa di ogni esito e, a fine partita online, la possibilità di
ricalcolare i numeri dal seed rivelato (commit-reveal, requisito di #27).

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
dal poterne verificare la causa.
> *P2 — "ogni cambio di stato causato da un dado o da un token è attribuibile alla sua
> causa con uno sguardo o un clic."*

**Cosa chiede al resto del design**: niente correzioni della fortuna né facce pesate (P1);
ogni tiro, ritiro e mescolamento diventa un evento con causa (P2, consumato da #22); il
valore mostrato dal dado 3D è sempre quello già deciso dal nucleo (#20). La garanzia T1
("lo stesso tiro su ogni tavolo") è tecnica e resta nella Overview: il giocatore la sente
solo come assenza di sorprese.

**Cosa si verifica, e dove (modello di fiducia)**:
- *Durante la partita* lo storico verifica le **cause** di ogni dado, non i numeri: il seed
  resta nascosto (RNG-11).
- *Online* l'onestà non dipende dai client: seed e stato restano sul server (RNG-15). Chi
  gestisce il server, però, può conoscere il seed (chi lo ospiterà non è ancora deciso,
  OQ-8). Per questo il server pubblica l'hash del seed a inizio partita e rivela il seed a
  fine partita, e chiunque può ricalcolare la partita con un verificatore open source.
  Prova che il seed non è cambiato durante la partita; non impedisce all'operatore di
  conoscerlo (requisito di #27, decisione dell'utente D1, 2026-11-15).
- *In hot seat* è un modello a fiducia: gli esiti sono identici a ogni tavolo (T1), ma
  l'informazione nascosta si può ispezionare (RNG-14).

## Detailed Design

### Core Rules

Le regole RNG-n sono citate dagli altri GDD con il loro id.

1. **RNG-1 Unica fonte di caso.** Ogni esito casuale di una partita (tiri di dado e
   mescolamenti) proviene dal generatore della partita. Il nucleo di regole non usa mai
   altre fonti (`Math.random`, orologio, entropia del sistema).
2. **RNG-2 Seed.** Ogni partita ha un seed fissato alla sua creazione.
   - **Formato**: 256 bit di entropia, scritti come stringa esadecimale canonica di 64
     caratteri minuscoli (codifica esatta nell'ADR-A). Il seed **non è mai un numero**: un
     Number JavaScript porta al massimo 53 bit e si ricostruirebbe per forza bruta dai dadi
     pubblici. Vale anche nei test e nelle fixture (decisione D2, 2026-11-15): un solo
     formato, un solo percorso di codice, nessuna espansione di seed corti.
   - **Rifiuto**: qualunque altro valore (lunghezza diversa da 64, maiuscole, prefisso
     `0x`, spazi, caratteri non esadecimali, stringa vuota, number, BigInt, `null`,
     `undefined`) è **rifiutato** con un errore esplicito, mai normalizzato in silenzio
     (P2: un seed corretto di nascosto non si può spiegare).
   - **Entropia**: è l'**unico** punto in cui si usa entropia esterna, in un solo modulo
     nominato fuori dal nucleo (percorso nell'ADR-B), con le sole API
     `crypto.getRandomValues` (browser) e `randomBytes` di `node:crypto` (server). Se la
     fonte non è disponibile la creazione fallisce: mai un ripiego su `Math.random` o
     sull'orologio. Avviene in locale alla creazione della partita (#7, #24), online sul
     server (#27).
   - **Seed dato**: una partita si può creare con un seed dato (test, riproduzione di un
     bug) solo dai test e dagli strumenti offline, mai attraverso la rete.
   - **Online** il server crea il seed e rifiuta qualunque seed proposto da un client: chi
     sceglie il seed conosce tutto il flusso. Ogni nuova partita e ogni rivincita usano
     entropia nuova, mai un valore derivato dal seed precedente o da dati del client (id
     della stanza, nomi, orologio). Un salvataggio locale non si importa come partita
     online. Questi ultimi due punti sono requisiti che attuano #27 e #30.
   - **Rivelabile**: a fine partita online il seed si rivela, confrontato con l'hash
     pubblicato a inizio partita (commit-reveal, requisito di #27, decisione D1). Prima della
     fine resta informazione nascosta (RNG-11).
3. **RNG-3 Stato nello stato di partita.** Lo stato del generatore fa parte dello stato
   completo di partita, come dato semplice e serializzabile. Stesso seed + stessa sequenza
   di azioni ⇒ stessa sequenza di esiti e stato finale identico, in ogni browser e sul
   server (T1, R2). Nessuno stato del generatore vive fuori dallo stato di partita, né a
   livello di modulo: due generatori usati in modo interlacciato danno gli stessi esiti
   che usati uno dopo l'altro. Lo stato serializzato porta **id e versione
   dell'algoritmo**, le parole di stato come interi senza segno a 32 bit e il **contatore
   delle estrazioni** (conta le estrazioni grezze, comprese quelle rifiutate da F1), in una
   forma canonica (ordine delle chiavi fisso, nessuna iterazione di Map/Set o di chiavi di
   oggetto senza ordine) definita dall'ADR-A, così che due stati uguali diano la stessa
   stringa. Lo stato completo serializzato va solo su disco, sul server o nel salvataggio
   locale di una partita hot seat; verso un client va sempre la proiezione (RNG-11). Uno
   stato letto da una serializzazione è **validato** (id e versione dell'algoritmo, numero
   e intervallo delle parole, contatore intero non negativo): uno stato malformato è
   rifiutato con un errore, mai ripreso con valori di ripiego.
4. **RNG-4 Un solo flusso.** Tutto il caso della partita esce da un'unica sequenza, nell'ordine
   in cui il nucleo lo richiede. L'ordine dipende solo dallo stato e dalle azioni, mai da
   tempi di animazione, di rete o di interfaccia. Le estrazioni si consumano **al momento
   della risoluzione della regola**, mai all'emissione, all'invio o al reinvio di un
   evento; un'azione ricevuta due volte (stesso id) non consuma estrazioni la seconda
   volta (contratto di idempotenza di #1 e #27). Un'azione rifiutata non consuma
   estrazioni (RNG-16). Il flusso è uno solo anche per visibilità diverse (RNG-15).
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
   lo decide il modulo che applica la regola. Questo sistema non pone limiti propri: i
   limiti sono regole del gioco e restano nel modulo che le cita (P1), che li verifica con i
   propri criteri di accettazione. Un risultato nuovo è a sua volta Tirato.
   *Esempi non normativi* (la regola vale solo nel GDD del modulo): lo slam di #13 (p. 9,
   passo 2) e le parità del setup di #7 (p. 5, passo 6).
   Ogni ritiro porta **chi l'ha chiesto** (il posto) e **la regola applicata** (id del
   modulo e pagina del regolamento), oltre ai collegamenti ai sostituiti, così un abuso
   resta visibile. Un ritiro **senza riferimento di regola** è rifiutato da #2. Che il
   riferimento esista davvero nel pacchetto lo verifica #1 contro #4 prima di chiamare #2,
   perché #2 non importa le definizioni del pacchetto. Lo stesso vale per il rifiuto del
   ritiro di un risultato già Sostituito: lo stato Sostituito si ricava dal log, che è di
   #1, quindi il controllo è di #1.
9. **RNG-9 Mescolamento.** Mescolare una lista produce una permutazione uniforme: ogni
   ordinamento possibile ha la stessa probabilità **rispetto a una sorgente ideale** di
   estrazioni uniformi e indipendenti (F3). Con un generatore reale gli ordinamenti
   raggiungibili sono al massimo 2^256, uno per seed (RNG-2): conta l'**entropia del
   seed**, non la larghezza dello stato. Ne seguono due regimi, entrambi ammessi
   (decisione dell'utente D3b, 2026-11-15):
   - **combinatorio**, per pile fino a **46** elementi (log2(46!) ≈ 191,8 ≤ 256 − 64): ogni
     ordinamento è raggiungibile e lo scarto dall'uniforme dovuto al numero finito di seed
     è al massimo 2^−64;
   - **computazionale**, da 47 elementi in su: lo scarto combinatorio non è più
     trascurabile, e oltre 57 elementi (log2(58!) ≈ 260,3 > 256) alcuni ordinamenti non
     sono raggiungibili. L'equità è garantita dal generatore crittografico: per chi non
     conosce il seed la permutazione è indistinguibile da una uniforme (RNG-15).
   `M_MAX_PILA` è la pila più grande del gioco base e delle espansioni previste: va letta
   dal regolamento (OQ-7). È un dato dei pacchetti, non un limite di #2. Una pila con più
   di 65 536 elementi (il limite di F1) è rifiutata (RNG-16). La pila e la pescata restano
   del sistema che possiede la pila (mazzo strada #7, segnalini pericolo #12, segnalini
   danno #15).
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
    contenuto nell'involucro ed emette l'evento. Il contatore di sequenza di #1 conta
    **eventi**, mai estrazioni: il contatore delle estrazioni non compare in nessun evento.
    Lo stato Sostituito non è memorizzato a parte: si ricava dai collegamenti nel log. Nel
    contenuto restituito da #2 il collegamento fra nuovo risultato e sostituito è
    **posizionale** (l'i-esimo nuovo risultato sostituisce l'i-esimo risultato indicato
    nella richiesta, RNG-17); #1 lo traduce in riferimenti fra id.
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
    **Anche ciò che si ricava dalla permutazione è nascosto.** Nessun identificatore,
    posizione o ordine di array che dipenda dall'ordine di una pila compare in un payload
    verso un client prima che l'elemento sia rivelato. Per esempio, gli id di istanza degli
    elementi di una pila coperta non sono assegnati nell'ordine del mazzo. L'attuazione è
    di #7, #12 e #15 (pile) e di #1 (proiezione). La **dimensione** di ogni pila è
    pubblica, come al tavolo. Non arrivano mai a un client un hash o un checksum dello
    stato del generatore, che servirebbe da oracolo per una ricerca del seed. I messaggi di
    errore (`RngError`) e i log del server non contengono mai il seed né le parole di stato.
    La proiezione si costruisce per **lista bianca** di campi ammessi, mai togliendo i
    campi segreti (attuazione di #1). Il seed diventa pubblico solo a fine partita
    (RNG-2).
12. **RNG-12 Nessun caso e nessuna informazione nascosta in simulazione.** La
    pianificazione prima della conferma (#23) non può richiedere un tiro né un
    mescolamento, e non può leggere informazione nascosta (il contenuto di un segnalino
    coperto, l'ordine di una pila). Se il percorso simulato arriva a uno di questi punti
    (per esempio entrare su un pericolo coperto), la simulazione si ferma lì e lo segnala.
    Così l'anteprima resta solo deterministica e pubblica (CD-SYSTEMS 8) e non può mai
    rivelare un esito futuro né un segreto.
    È un **contratto**, non una buona intenzione:
    - la simulazione gira sullo **stato proiettato** per il giocatore (RNG-11), che non ha
      il generatore né l'ordine delle pile; lo stesso tipo di stato proiettato si usa in
      hot seat e online (ADR-B);
    - una regola che ha bisogno del caso non tira: restituisce una **richiesta di tiro**
      (un effetto, RNG-17). L'esecutore reale la soddisfa con il generatore; quello di
      simulazione si ferma e produce il segnale "qui servirebbe un tiro". Una lettura di
      informazione nascosta produce allo stesso modo il segnale "qui si rivelerebbe
      un'informazione";
    - online il client non esegue mai il nucleo con il generatore: consuma eventi e stato
      già proiettati dal server (#27, #29).
    La forma esatta (tipi, esecutori) è dell'ADR-B, condiviso con #1 e #23.
13. **RNG-13 Nessuna correzione.** Niente compensazione della sfortuna, nessuna memoria dei
    tiri precedenti, nessuna regola di "dadi più equi". L'esito è quello del flusso (P1,
    anti-pilastro "NOT un riequilibrio").
14. **RNG-14 Deviazione dall'informazione nascosta del tavolo (hot seat).** In hot seat gli
    esiti sono identici a quelli di ogni altro tavolo (T1 resta intatto), ma lo stato del
    generatore e l'ordine delle pile stanno nella memoria del dispositivo e nel
    salvataggio locale (#30). Chi ispeziona il programma con gli strumenti del browser, o
    legge il salvataggio, può prevedere i tiri e conoscere l'ordine delle pile. Al tavolo
    fisico una pila coperta è davvero nascosta: qui no, ed è una **deviazione accettata**.
    Il gioco in hot seat è a fiducia, come fra amici allo stesso tavolo. La protezione vera
    vale online, dove seed e stato restano sul server (#27). *Decisione dell'utente,
    2026-11-15.* Rientra in questa deviazione anche l'esplorazione di rami alternativi
    ricaricando un salvataggio (Edge Cases). Resta un requisito di architettura: anche in
    hot seat la proiezione per giocatore (RNG-11) è l'unica via verso l'interfaccia.
15. **RNG-15 Imprevedibilità.** Nessun osservatore dei risultati pubblici può prevedere gli
    esiti futuri né ricostruire l'ordine di una pila nascosta. Un generatore non
    crittografico non lo garantisce, anche se seed e stato restano sul server: le sue
    uscite permettono di risalire allo stato. Con un generatore a 32 bit di stato bastano,
    secondo una stima, poche decine di d6 pubblici. Una grande larghezza di stato è
    necessaria ma non sufficiente: MT19937 ha 19 937 bit di stato e si ricostruisce da 624
    uscite. Requisiti vincolanti per l'ADR-A:
    - **un solo flusso** per partita, per dadi e mescolamenti;
    - **generatore deterministico crittografico** da una **lista bianca** di algoritmi
      standard con vettori di prova pubblicati, implementato in modo **sincrono e in
      JavaScript puro** (le API asincrone di Web Crypto non stanno nel nucleo). La
      raccomandazione del creative-director è ChaCha20 (RFC 8439); nome, versione e
      parametri sono dell'ADR-A (OQ-1);
    - **chiave di 256 bit** pari al seed (RNG-2), usata direttamente come chiave: nessuna
      espansione di seed corti;
    - il generatore supera i **vettori di prova ufficiali** dell'algoritmo (test indipendente
      dal file di riferimento autoprodotto, AC-02a);
    - lo stesso algoritmo in ogni modalità (hot seat, online, test), per T1.
    *Esempi non normativi* di generatori esclusi perché fuori dalla lista bianca:
    mulberry32, la famiglia xorshift/xoshiro/xoroshiro, tutta la famiglia PCG, sfc32,
    splitmix, MT19937, ogni LCG, `Math.random`, contatori resi con hash non crittografici.
    Lo scaffold (`src/game/rules.ts`, `makeRng` su mulberry32) è un prototipo da
    sostituire, non un punto di partenza.
16. **RNG-16 Atomicità e consumo.** Una chiamata a #2 vale **tutto o niente**:
    - la richiesta è validata per intero prima di consumare estrazioni: tipo e intervallo di
      ogni `n` (intero tra 1 e 65 536: sono rifiutati NaN, Infinity, stringhe come "6",
      BigInt), dimensione `m` della pila (intero tra 0 e 65 536), riferimento di regola nei
      ritiri (RNG-8). Una richiesta non valida restituisce un `RngError` come valore, con
      stato e contatore invariati;
    - un tiro o un ritiro di gruppo produce tutti i risultati o nessuno: se il terzo dado
      del gruppo è invalido, i primi due non consumano estrazioni;
    - #2 restituisce uno stato nuovo e non modifica quello ricevuto;
    - una sorgente di estrazioni esaurita (solo nei test, con sorgente iniettata) produce un
      `RngError`, mai un valore indefinito.
    *Requisiti verso #1 e #27* (il meccanismo è loro):
    - un'azione è validata prima di ogni estrazione, e un'azione rifiutata non consuma
      estrazioni. Altrimenti un giocatore potrebbe "bruciare" un tiro sfavorevole con
      un'azione illegale;
    - lo stato aggiornato si scrive solo quando l'intera azione è accettata;
    - le azioni di una partita si risolvono una alla volta, senza attese asincrone fra
      un'estrazione e la scrittura dello stato;
    - un'azione automatica (per esempio allo scadere del tempo di turno) è un'azione con il
      suo id, che entra nella sequenza in un punto determinato dallo stato, non
      dall'orologio;
    - l'idempotenza delle azioni ripetute segue RNG-4.
17. **RNG-17 Richiesta di tiro.** Ciò che un modulo chiede a #2, e che la simulazione
    (RNG-12) intercetta, contiene:
    - per un **tiro**: l'elenco ordinato dei dadi, ciascuno con il suo id (di #4) e il
      numero di facce `n`, e la causa;
    - per un **ritiro**: in più, i risultati da sostituire (in ordine), il richiedente (il
      posto) e il riferimento di regola (id del modulo e pagina);
    - per un **mescolamento**: l'id della pila, la sua dimensione `m` e la causa.
    I GDD a valle citano questo contenuto; i tipi TypeScript e gli esecutori sono
    dell'ADR-B.

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
| Serializzato | salvataggio su disco o sul server, ripresa (mai inviato a un client, RNG-3 e RNG-11) | Avanzato, ripristinato identico; stato malformato → rifiutato |

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
Il numero di estrazioni di un tiro **non ha un tetto** con il generatore reale, ma con
n ≤ 2^16 la probabilità di rifiuto è sotto 2^−16 e il numero atteso di estrazioni è sotto
1 + 2^−15. Con una sorgente iniettata che si esaurisce il risultato è un `RngError`
(RNG-16). Il limite 2^16 tiene la probabilità di rifiuto sotto 2^−16 ed è molto oltre ogni
dado e pila reale.
**Valori limite:** n = 0 non è ammesso: un dado senza facce è rifiutato alla validazione
del pacchetto (#4), mai al momento del tiro. n = 1 → `limite = 2^W`, nessun rifiuto
possibile, `face_index = 0`, un'estrazione consumata. n = 2^16 (e ogni potenza di 2) →
`2^W mod n = 0`, `limite = 2^W`, nessun rifiuto. n < 0, non intero o > 2^16 → errore del
nucleo (Edge Cases).
**Nota di implementazione (JavaScript):** `2^W` = 4 294 967 296 non sta in un intero a 32
bit. `u` va normalizzata con `>>> 0`; `2^W mod n` e il confronto `u < limite` si calcolano
in aritmetica Number (`4294967296 % n`), mai con operatori bitwise, che lavorano su interi
con segno a 32 bit; niente BigInt in una sola delle piattaforme (T1). `limite` vale 2^32
quando n è una potenza di 2 e non passa mai per `| 0` o `>>> 0`, che lo ridurrebbero a 0.
Prima del calcolo `n` è controllato con `typeof n === "number"` e `Number.isInteger(n)`
(RNG-16): senza il controllo `"6"` verrebbe convertito in silenzio e `6n` lancerebbe
un'eccezione. Gli interni del generatore usano solo operazioni a 32 bit portabili (`+`
seguito da `>>> 0`, `^`, rotazioni, `Math.imul` se serve).
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
| m | int | 0 – 65 536 | calculated (dimensione della pila del sistema proprietario) | elementi da mescolare; il limite viene da n ≤ 2^16 di F1; non intero, negativo o oltre 65 536 → `RngError`, stato invariato (RNG-16); le pile reali sono al massimo `M_MAX_PILA` (OQ-7) |
| k | int | 1 – m − 1 | calculated | posizione corrente, dall'ultima alla seconda |
| j | int | 0 – k | calculated (F1) | posizione scelta per lo scambio |
| chiamate_F1 | int | max(0, m − 1) | calculated | chiamate a F1 consumate |
| estrazioni_grezze | int | ≥ chiamate_F1 | calculated | estrazioni `u` consumate; maggiori delle chiamate solo quando F1 rifiuta |

**Output Range:** una delle `m!` permutazioni, ognuna con probabilità `1/m!` **rispetto a
una sorgente ideale** (RNG-9), perché ogni F1 è esatta data un'estrazione uniforme. Con il
generatore reale il limite è l'entropia del seed, 256 bit (RNG-2). Fino a 46 elementi
vale il regime combinatorio: ogni ordinamento è raggiungibile, con uno scarto
dall'uniforme di al massimo 2^−64. Oltre vale il regime computazionale, e oltre 57
elementi ci sono ordinamenti irraggiungibili (RNG-9). Per confronto, con un seed di
32 bit già una pila di 13 elementi (13! > 2^32) avrebbe ordinamenti irraggiungibili.
Consuma `max(0, m − 1)` chiamate a F1. F3 chiama F1 sempre con n = k + 1 ≥ 2, quindi la
regola "almeno un'estrazione anche con n = 1" non entra mai in gioco qui: una pila di 1
elemento consuma 0 estrazioni, un dado a 1 faccia ne consuma 1, ed è voluto (la dimensione
della pila viene dallo stato, il dado dal pacchetto).
**Valori limite:** m = 0 o m = 1 → nessuna chiamata a F1, ordine invariato; l'evento
"pila mescolata" viene comunque emesso (RNG-10), così il log non dipende dal contenuto
della pila. Nessun valore di `m` produce una divisione o un risultato inutilizzabile.
m > 65 536, negativo o non intero → `RngError` prima di ogni estrazione (RNG-16).
**Example:** pila di 3 segnalini [A, B, C]. k = 2: F1 con n = 3 dà j = 0 → [C, B, A].
k = 1: F1 con n = 2 dà j = 1 → nessuno scambio. Risultato [C, B, A], 2 chiamate a F1.

**Cicli di retroazione:** nessuno. Ogni estrazione è indipendente dalle precedenti per
costruzione (RNG-13): non esistono meccanismi che rendano più o meno probabile un esito in
base ai risultati passati.

## Edge Cases

- **If viene chiesto il ritiro di un risultato già Sostituito**: la richiesta è rifiutata
  da #1, che possiede il log e ricava lo stato Sostituito, prima di chiamare #2. Nessuna
  estrazione è consumata e lo stato resta invariato. Si ritira solo un risultato nello
  stato Tirato; la regola d'uso del ritiro resta del modulo (RNG-8). Il criterio è di
  integrazione con #1 (AC-12d).
- **If un ritiro arriva senza riferimento di regola**: #2 lo rifiuta con un `RngError`,
  nessuna estrazione consumata (RNG-8, RNG-16).
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
- **If il seed fornito è un qualunque valore del formato** (incluse le stringhe di 64 zeri
  e di 64 `f`): produce un generatore valido. Nessun seed può dare un generatore degenere,
  per esempio bloccato su un valore o con un ciclo corto: il generatore crittografico usa
  il seed come chiave (RNG-15), e ogni chiave di 256 bit dà un flusso completo.
- **If il seed fornito non è del formato** (lunghezza diversa da 64, maiuscole, `0x`,
  spazi, caratteri non esadecimali, stringa vuota, number, BigInt, `null`, `undefined`): la
  creazione della partita fallisce con un errore esplicito e nessun generatore viene creato
  (RNG-2).
- **If la fonte di entropia non è disponibile** alla creazione: la creazione fallisce con
  un errore, senza ripiego su `Math.random` o sull'orologio (RNG-2).
- **If online un client propone un seed**, alla creazione o a partita in corso, anche come
  campo in più di un messaggio: il server lo rifiuta e crea il proprio (RNG-2). Il
  protocollo di #27 non ha un campo seed e rifiuta i campi sconosciuti.
- **If si tenta di caricare un salvataggio locale come partita online**: è rifiutato,
  perché porterebbe con sé lo stato del generatore (RNG-2; attuazione #27/#30).
- **If uno stato serializzato è malformato** (parole mancanti o fuori dall'intervallo a
  32 bit, contatore non intero o negativo, chiavi fuori dall'ordine canonico): è
  rifiutato con un errore e nessun generatore viene creato (RNG-3).
- **If un'azione è rifiutata dopo la validazione delle regole**: non consuma estrazioni,
  perché la validazione precede ogni estrazione (RNG-16). Un giocatore non può
  "bruciare" un tiro con un'azione illegale.
- **If una pila supera 46 elementi**: è mescolata nel regime computazionale (RNG-9); oltre
  65 536 elementi la richiesta è rifiutata con un `RngError` (RNG-16).
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
- **If una partita è online**: il client non tira, non mescola ed esegue il nucleo solo
  sullo stato proiettato. Riceve gli eventi già risolti e proiettati dal server (#27), anche
  alla riconnessione (#29). Il seed e lo stato del generatore non arrivano mai al client
  prima della fine della partita (RNG-11, RNG-2).
- **If a runtime arriva un dado non valido** (n = 0, n < 0, n non intero, n > 2^16, NaN,
  Infinity, una stringa come "6", un BigInt: dati sfuggiti alla validazione di #4): è un
  errore del nucleo, restituito come valore di errore tipizzato (`RngError`, forma
  nell'ADR-B), non come eccezione nascosta. Lo stato resta invariato e nessuna estrazione
  è consumata, nemmeno per gli altri dadi dello stesso gruppo (RNG-16). Non si inventa un
  risultato.
- **If si chiede il ritiro di un risultato nuovo** (già prodotto da un ritiro, quindi
  Tirato): #2 lo accetta; se la regola lo vieta (per esempio il ritiro unico dello slam,
  p. 9), è il modulo a non chiederlo, e i suoi criteri lo verificano (RNG-8).
- **If un giocatore ricarica un salvataggio per "ritirare" un dado** (strategia degenere):
  rifare la **stessa** azione non serve. Seed e stato del generatore fanno parte del
  salvataggio (#30), quindi lo stesso tiro dà lo stesso esito. Il caso però **non** è
  protetto contro l'esplorazione di rami alternativi: chi ricarica e sceglie un'azione
  diversa consuma le estrazioni in un altro ordine, e dopo aver visto un esito sa cosa
  riserva il flusso. In hot seat rientra nella deviazione accettata di RNG-14. Online non
  è possibile, perché lo stato sta solo sul server, che lo salva prima di emettere ogni
  evento (write-ahead, requisito di #27).
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
| #27 Server, #29 Reconnection, #30 Save & Resume | conservano e ripristinano lo stato | stato serializzato con id e versione dell'algoritmo; payload ai client senza dati del generatore (RNG-11); seed creato dal server (RNG-2); azioni idempotenti e atomiche (RNG-4, RNG-16) | hard |

**Provvisorio**: le interfacce verso #1 e #4 (formato dell'involucro, id, validazione dei
dadi) sono assunte qui e vanno confermate quando i loro GDD saranno scritti (gruppo A).

**Contratti in attesa** (requisiti fissati qui, che il GDD destinatario deve riprendere e
verificare con i propri criteri; finché quel GDD non esiste, questo elenco è il promemoria):

| Destinatario | Contratto | Regola di #2 | Criterio |
|--------------|-----------|--------------|----------|
| #1 Rules Core | id delle azioni nello stato di partita (serializzato da #30); stesso id con contenuto diverso rifiutato; un duplicato restituisce gli eventi originali, ri-proiettati; deduplicazione nella stessa transazione che avanza lo stato | RNG-4 | AC-25b |
| #1 Rules Core | validazione dell'azione prima di ogni estrazione; stato scritto solo ad azione accettata | RNG-16 | AC-28b |
| #1 Rules Core | rifiuto del ritiro di un risultato Sostituito; esistenza del riferimento di regola in #4 | RNG-8 | AC-12d |
| #1 Rules Core | contatore di sequenza degli eventi distinto dal contatore delle estrazioni; proiezione per lista bianca | RNG-10, RNG-11 | AC-15, AC-16 |
| #4 Content Pack | dadi con 1–65 536 facce; pile entro `M_MAX_PILA` | RNG-5, RNG-9 | AC-09a |
| #7, #12, #15 (pile) | id di istanza degli elementi coperti non legati all'ordine del mazzo; dimensione della pila pubblica | RNG-11 | AC-16 |
| #23 Input & Selection | simulazione sullo stato proiettato; arresto davanti al caso e a ogni informazione nascosta; indicatore "il percorso prosegue, esito non deciso" | RNG-12 | AC-17b, AC-17c |
| #27 Server | coda di azioni per partita senza attese asincrone fra estrazione e scrittura; write-ahead prima di emettere; azioni di timeout con id; protocollo senza campo seed e senza campi sconosciuti; nessun salvataggio importato; commit-reveal del seed (D1) | RNG-2, RNG-16 | AC-25a, AC-25c |
| #29 Reconnection | stato ed eventi di riconnessione solo proiettati; il client non riapplica il nucleo con il generatore | RNG-11, RNG-12 | AC-16, AC-24b |
| #30 Save & Resume | lo stato completo resta locale (hot seat) o sul server; validazione alla ripresa | RNG-3, RNG-14 | AC-19, AC-20b |

**ADR richiesti**:
- **ADR-A**: algoritmo dalla lista bianca, codifica del seed, stato serializzato e versioni
  (OQ-1). Blocca **tutte** le storie di #2.
- **ADR-B**: nucleo puro, richieste di tiro come effetti (RNG-12, RNG-17), `DrawSource`
  iniettabile, `Result` e `RngError`, modulo di entropia e strumento di controllo del
  confine (RNG-1, AC-03b). Condiviso con #1 e #23; blocca le storie con sorgente iniettata.
- **ADR-C**: involucro degli eventi e causa (OQ-3), di proprietà di #1. Blocca solo i
  criteri di integrazione.

## Tuning Knobs

**Nessun tuning knob proprio**, ed è voluto: un dado del regolamento non si "tara" (P1,
anti-pilastro "NOT un riequilibrio").

| Valore che sembra un knob | Dove vive davvero | Perché non è un knob di #2 |
|---------------------------|-------------------|----------------------------|
| Facce di ogni dado e loro etichette (`n`, `conteggio`) | #4 Content Pack, letti dalla pagina del regolamento | sono dati del contenuto, non bilanciamento; cambiarli è un errore di trascrizione, non una taratura |
| Larghezza dell'estrazione `W` | ADR del generatore | costante tecnica |
| Seed | creazione della partita (#7, #24, #27) | è un input di partita, non un valore di design |
| `M_MAX_PILA` (pila più grande) | regolamento, tramite #4, #7, #12, #15 (OQ-7) | è un conteggio di componenti, non un bilanciamento; decide solo in quale regime di uniformità cade una pila (RNG-9) |
| Soglie dei regimi (46 e 57 elementi) | derivate da 256 bit di seed (RNG-9) | conseguenze matematiche dell'entropia, non valori da tarare |
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
  Al punto di arresto un indicatore visivo, non affidato al solo colore, mostra che il
  percorso **prosegue** oltre e che lì l'esito non è deciso: l'anteprima tagliata non deve
  sembrare un percorso sicuro.

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
| #12 Hazards & Wrecks, #15 Damage & Repair *(GDD non scritti)* | pile coperte, id di istanza non legati all'ordine | uso di RNG-9 e RNG-11 |
| #27, #29, #30 *(GDD non scritti)* | stato serializzato, seed nascosto e rivelato a fine partita, atomicità, write-ahead | uso di RNG-2, RNG-3, RNG-11, RNG-16 (vedi Contratti in attesa) |
| `src/game/rules.ts` | `makeRng` dello scaffold (mulberry32, uscite float, stato in closure) | prototipo che viola RNG-3 e RNG-15: da sostituire dopo l'ADR-A |
| `reference/rulebook/` | componenti (5 dadi FX, 16 dadi movimento: elenco componenti), ritiri del setup (p. 5, passo 6) e dello slam (p. 9, passo 2) | fonte delle regole, verificata il 2026-11-15 |

## Acceptance Criteria

**Tipo di test.**
- **Logic**: test automatico Vitest in `tests/unit/dice-rng/`, eseguibile ora con il solo
  #2.
- **Integrazione**: test in `tests/integration/dice-rng/` (Playwright o la modalità
  browser di Vitest, scelta dell'ADR-B) oppure test scritto con il sistema destinatario. In
  quel caso richiede #1, #4, #7, #20, #23, #24, #27, #29 o #30: il criterio è fissato qui ma
  il test si scrive con quel sistema, e il GDD destinatario lo riporta (vedi Contratti in
  attesa nelle Dependencies).

Dove un criterio ha una parte Logic e una di Integrazione, è diviso in due. Un criterio ha
un solo WHEN; i casi parametrizzati sono elencati come a, b, c.

**Test statistici.**
- **Soglia** del progetto **p = 1e-4** (decisione dell'utente, 2026-11-15). I valori critici
  vengono da una costante a piena precisione citata nel test, mai scritta a mano: 25,7448
  con 5 gradi di libertà, 15,1367 con 1, e il valore a 23 gradi di libertà per AC-13a.
- **Seed** di 256 bit nel formato di RNG-2, **registrati in anticipo** come costanti in
  `tests/unit/dice-rng/fixtures/seeds.ts`, con accanto id e versione dell'algoritmo e il
  chi-quadro osservato. Con un seed fisso il test è deterministico (standard di test): è
  una regressione, non una prova statistica nuova a ogni esecuzione.
- **Se un seed registrato fallisce** non si sostituisce in silenzio e la CI non salta il
  test. Uno script diagnostico fuori dalla suite esegue 20 seed fissi, anch'essi in
  `seeds.ts`, con tre esiti:
  - 0 fallimenti: seed sfortunato, lo si ri-registra con un commit motivato;
  - 1 fallimento: si ripete con 100 seed fissi;
  - 2 o più fallimenti: è un difetto.
- **Cambio di algoritmo**: ogni cambio nell'ADR-A ri-registra i seed con un commit che porta
  id, versione e chi-quadro osservati.
- **Durata**: i test statistici hanno un tempo massimo di 10 s ciascuno, per intercettare
  regressioni di prestazioni.

**Sorgente iniettabile.** I criteri sull'ordine di consumo usano una **sorgente di
estrazioni scritta a mano** (per esempio `[u1, u2, …]`) al posto del generatore, così non
dipendono dall'algoritmo. L'iniezione è un requisito dell'API (ADR-B). Una sorgente
esaurita produce un `RngError` (RNG-16). "Estrazioni consumate" si misura dal contatore
delle estrazioni (RNG-3), che conta anche le estrazioni rifiutate.

| ID | Tipo | Copre | Criterio |
|----|------|-------|----------|
| AC-01 | Logic | RNG-3 | **GIVEN** un seed S e una lista fissa di chiamate (tiri, ritiri, mescolamenti), **WHEN** è eseguita due volte da zero, **THEN** i risultati coincidono e lo stato serializzato in forma canonica (ADR-A) è la stessa stringa. *La variante a livello di partita intera (azioni e log) è Integrazione con #1/#7.* |
| AC-02a | Logic | RNG-15 | **GIVEN** i vettori di prova pubblicati dell'algoritmo scelto dall'ADR-A (per ChaCha20, quelli di RFC 8439), **WHEN** il generatore produce le uscite per quelle chiavi e quei contatori, **THEN** coincidono byte per byte con i vettori. |
| AC-02b | Logic | RNG-3, T1 | **GIVEN** il file di riferimento `tests/unit/dice-rng/fixtures/golden-v1.json`, che elenca seed, id e versione dell'algoritmo e, per ogni seed, le prime 1 000 estrazioni grezze, 100 tiri con n = 6, un mescolamento di 10 elementi e lo stato serializzato finale, **WHEN** lo stesso calcolo gira in Node, **THEN** il risultato coincide con il file. |
| AC-02c | Integrazione (`tests/integration/dice-rng/`) | RNG-3, T1 | **GIVEN** lo stesso file di AC-02b, **WHEN** il calcolo gira in Chromium, Firefox e WebKit, **THEN** i tre risultati coincidono con il file. |
| AC-03a | Logic | RNG-1 | **GIVEN** `Math.random`, `Date`, `performance.now`, `crypto` (e `globalThis.crypto`), `setTimeout`, `setInterval` e `requestAnimationFrame` sostituiti da funzioni che lanciano un errore, **WHEN** si esegue una lista scritta di tiri, ritiri, mescolamenti e serializzazioni, **THEN** termina senza errori. |
| AC-03b | Logic | RNG-1, RNG-2 | **GIVEN** il controllo statico del confine del nucleo scelto dall'ADR-B, **WHEN** esamina il percorso del nucleo, **THEN** esce con errore se trova un riferimento ai globali di AC-03a, a `require("crypto")`, a `import … from "crypto"` o da `"node:crypto"`; la lista di eccezioni contiene **un solo** modulo, quello di entropia di RNG-2, e un test fallisce se ne contiene altri. |
| AC-04a | Logic | RNG-4 | **GIVEN** S e una lista di chiamate, **WHEN** è eseguita due volte con timer finti avanzati in modi diversi e con altri task asincroni interposti, **THEN** i risultati coincidono. *La variante con la presentazione reale è Integrazione con #20.* |
| AC-04b | Logic | RNG-4 | **GIVEN** la risoluzione di una regola che produce il contenuto di un evento di tiro, **WHEN** quel contenuto è emesso, riemesso o riletto tre volte, **THEN** il contatore delle estrazioni è avanzato una sola volta, alla risoluzione. |
| AC-05a | Logic (controllo di tipo) | RNG-5, RNG-6 | **GIVEN** la firma pubblica della funzione di tiro, **WHEN** il controllo di tipo della suite la verifica, **THEN** riceve il numero di facce `n` (non una lista di facce e nessun parametro di peso) e restituisce un indice intero. |
| AC-05b | Logic | RNG-5 | **GIVEN** un dado di #4 con facce [A, B, C, D, E, F] e una sorgente `[3 141 592 653]`, **WHEN** è tirato, **THEN** il risultato è l'intero 3 e l'etichetta letta nella lista di #4 è D. |
| AC-06 | Logic | F1, RNG-6 | **GIVEN** un dado a 6 facce e un seed registrato, **WHEN** è tirato 600 000 volte, **THEN** il chi-quadro sulle 6 frequenze è < 25,7448 (5 gradi di libertà, p = 1e-4). |
| AC-07 | Logic | F1 limite n = 1 | **GIVEN** una sorgente `[u1, u2]`, **WHEN** si tira un dado a 1 faccia e poi un dado a 6 facce, **THEN** il primo dà 0, il secondo dà `u2 mod 6` e le estrazioni consumate sono 2. |
| AC-08a | Logic | F1 rifiuto | **GIVEN** un dado a 6 facce (`limite` = 4 294 967 292) e la sorgente `[2^32 − 1, 7]`, **WHEN** è tirato, **THEN** il risultato è 1 e le estrazioni consumate sono 2. |
| AC-08b | Logic | F1 | **GIVEN** lo stesso dado e la sorgente `[4 294 967 291]`, **WHEN** è tirato, **THEN** il risultato è 5 e le estrazioni consumate sono 1. |
| AC-08c | Logic | F1 rifiuto | **GIVEN** lo stesso dado e la sorgente `[4 294 967 292, 0]`, **WHEN** è tirato, **THEN** il risultato è 0 e le estrazioni consumate sono 2. |
| AC-08d | Logic | F1 esempio | **GIVEN** lo stesso dado e la sorgente `[3 141 592 653]`, **WHEN** è tirato, **THEN** il risultato è 3 e le estrazioni consumate sono 1. |
| AC-08e | Logic | F1, RNG-16 | **GIVEN** lo stesso dado e la sorgente `[2^32 − 1]` (che rifiuta e poi si esaurisce), **WHEN** è tirato, **THEN** si ottiene un `RngError` di sorgente esaurita e lo stato resta invariato. |
| AC-08f | Logic | F1 esattezza | **GIVEN** F1 con una larghezza ridotta W = 8 (parametro del test), **WHEN** si enumerano tutte le 256 estrazioni per ogni n in 1–20, 255 e 256, **THEN** ogni indice è prodotto da esattamente `limite / n` estrazioni accettate. |
| AC-09a | Integrazione (#4) | F1 limite n | **GIVEN** un pacchetto con un dado di 0 facce, uno di 65 536 e uno di 65 537, **WHEN** è validato, **THEN** il dado di 65 536 facce è accettato e gli altri due sono rifiutati con il loro id. *Riportato nel GDD di #4.* |
| AC-09b | Logic | F1, RNG-16 | **GIVEN** un generatore in uno stato X e, uno per caso, n = 0, −1, 2,5, NaN, Infinity, 65 537, "6" e `6n`, **WHEN** si tira, **THEN** ogni caso restituisce come valore (non come eccezione) un `RngError` di dado non valido, e lo stato serializzato e il contatore sono quelli di X. |
| AC-09c | Logic | F1 limite n | **GIVEN** un dado con n = 65 536 e una sorgente `[2^32 − 1]`, **WHEN** è tirato, **THEN** il risultato è 65 535 e le estrazioni consumate sono 1 (nessun rifiuto con una potenza di 2). |
| AC-10 | Logic | F2, RNG-6 | **GIVEN** un dado a 6 facce con l'etichetta X su 2 facce e un seed registrato, **WHEN** è tirato 600 000 volte, **THEN** il chi-quadro a 2 categorie (X e non X, frequenze attese 200 000 e 400 000) è < 15,1367 (1 grado di libertà, p = 1e-4). |
| AC-11a | Logic | RNG-7 | **GIVEN** la sorgente `[1, 2]`, **WHEN** si tirano insieme un dado a 6 facce e uno a 8 facce, in quest'ordine, **THEN** il primo vale 1 e il secondo vale 2. |
| AC-11b | Logic | RNG-7, F1 | **GIVEN** la sorgente `[5, 2^32 − 1, 9]`, **WHEN** si tirano insieme due dadi a 6 facce, **THEN** il primo vale 5, il secondo vale 3 (`9 mod 6`) e le estrazioni consumate sono 3. |
| AC-12a | Logic | RNG-8, RNG-10 | **GIVEN** un tiro di gruppo di due dadi e la sorgente `[u3, u4]` per il ritiro, **WHEN** si chiede il ritiro del gruppo con richiedente e riferimento di regola, **THEN** si ottiene un solo contenuto di ritiro in cui il primo nuovo risultato vale `u3 mod n1` e sostituisce il primo indicato, il secondo vale `u4 mod n2` e sostituisce il secondo, e compaiono richiedente e regola. |
| AC-12b | Logic | RNG-8, RNG-16 | **GIVEN** un tiro e una richiesta di ritiro senza riferimento di regola, **WHEN** si chiede il ritiro, **THEN** si ottiene un `RngError` e nessuna estrazione è consumata. |
| AC-12c | Logic | RNG-8 | **GIVEN** un risultato prodotto da un ritiro e la sorgente `[u]`, **WHEN** se ne chiede il ritiro con una regola, **THEN** il nuovo risultato vale `u mod n`, sostituisce quello indicato e consuma 1 estrazione (il limite al numero di ritiri è del modulo: #13 per lo slam). |
| AC-12d | Integrazione (#1) | RNG-8 | **GIVEN** un risultato già Sostituito nel log, **WHEN** un modulo ne chiede il ritiro, **THEN** #1 lo rifiuta senza chiamare #2 e il contatore delle estrazioni non cambia. *Riportato nel GDD di #1.* |
| AC-13a | Logic | F3, RNG-9 | **GIVEN** un seed registrato, **WHEN** una pila di 3 elementi è mescolata 60 000 volte e una pila di 4 elementi 240 000 volte, **THEN** il chi-quadro sulle 6 permutazioni è < 25,7448 (5 gradi di libertà) e quello sulle 24 permutazioni è sotto il valore critico a 23 gradi di libertà, entrambi a p = 1e-4. |
| AC-13b | Logic | F3 esempio | **GIVEN** la pila [A, B, C] e la sorgente `[0, 1]`, **WHEN** è mescolata, **THEN** il risultato è [C, B, A] e le estrazioni consumate sono 2. |
| AC-14a | Logic | F3 limiti | **GIVEN** una pila di 0 o di 1 elementi, **WHEN** è mescolata, **THEN** l'ordine è invariato, le estrazioni consumate sono 0 ed è prodotto il contenuto dell'evento "pila mescolata". |
| AC-14b | Logic | F3 | **GIVEN** una pila di 5 elementi tutti uguali e una sorgente senza rifiuti, **WHEN** è mescolata, **THEN** le estrazioni consumate sono 4 (`max(0, m − 1)`). |
| AC-14c | Logic | F3, RNG-16 | **GIVEN** un generatore in uno stato X e, uno per caso, m = 65 537, −1 e 2,5, **WHEN** si chiede il mescolamento, **THEN** si ottiene un `RngError` di pila non valida e lo stato resta X. |
| AC-15a | Integrazione (#1) | RNG-10 | **GIVEN** una partita con K tiri di gruppo, R ritiri e M mescolamenti, fra cui un tiro con rifiuto forzato da una sorgente iniettata e pile di 0 e 1 elementi, **WHEN** si legge il log, **THEN** contiene esattamente K + R + M eventi di caso. |
| AC-15b | Integrazione (#1) | RNG-10 | **GIVEN** lo stesso log, **WHEN** se ne leggono le cause, **THEN** ogni evento di caso ha una causa che indica un'azione o un effetto presente nel log. |
| AC-15c | Integrazione (#1) | RNG-10 | **GIVEN** due partite con seed diversi e le stesse azioni, **WHEN** si confrontano gli id degli eventi, **THEN** sono identici (contatore di sequenza, mai valori casuali) e nessun evento contiene il contatore delle estrazioni. |
| AC-15d | Integrazione (#1) | RNG-8, RNG-10 | **GIVEN** lo stesso log, **WHEN** se ne leggono i ritiri, **THEN** ognuno riferisce gli id dei sostituiti, il richiedente e la regola. |
| AC-16 | Integrazione (#1, #27, #29) | RNG-11 | **GIVEN** una partita con un seed sentinella di 256 bit e valori sentinella riconoscibili nelle parole di stato, nel contatore, nell'ordine di una pila coperta e negli id dei suoi elementi, **WHEN** si producono, per un giocatore, (a) la vista, (b) il flusso di eventi, (c) lo stato di riconnessione e (d) il replay, **THEN** ciascuno contiene solo campi della lista bianca della proiezione; nessuno contiene i valori sentinella, cercati in esadecimale, decimale, base64 e come array di byte o di interi; tutti contengono i risultati dei dadi e la dimensione della pila; **AND** due stati che differiscono solo per seed, stato del generatore o ordine della pila danno proiezioni identiche. *Riportato nei GDD di #1, #27 e #29.* |
| AC-17a | Logic | RNG-12 | **GIVEN** uno stato del generatore X e una regola che ha bisogno del caso, **WHEN** è eseguita con l'esecutore di simulazione, **THEN** restituisce una richiesta di tiro con il contenuto di RNG-17, lo stato del generatore è ancora X e lo stato su cui gira la simulazione non ha alcun campo del generatore. |
| AC-17b | Integrazione (#23) | RNG-12, CD-SYSTEMS 8 | **GIVEN** una mossa pianificata che entra su un pericolo coperto, **WHEN** #23 la simula, **THEN** la simulazione si ferma su quella casella con il segnale di arresto e lo stato del generatore è invariato. *Riportato nel GDD di #23.* |
| AC-17c | Integrazione (#1, #23) | RNG-12 | **GIVEN** lo stato proiettato usato dalla simulazione, **WHEN** una regola simulata chiede il contenuto di un segnalino coperto o l'ordine di una pila, **THEN** la simulazione si ferma con il segnale "qui si rivelerebbe un'informazione" e lo stato proiettato non contiene quel dato. |
| AC-18 | Logic | RNG-13 | **GIVEN** uno stato serializzato X ripreso in tre contesti con storie di risultati precedenti diverse (per esempio sei 6 di fila, sei 1 di fila, nessun tiro), **WHEN** si tira lo stesso dado, **THEN** il risultato è identico nei tre contesti; **AND GIVEN** una sorgente con 100 estrazioni uguali seguite da `u` noto, **THEN** il 101° tiro vale `u mod n`. |
| AC-19 | Logic | RNG-3, Edge: salvataggio (#30) | **GIVEN** il generatore con un seed registrato in `fixtures/` (trovato con una ricerca offline perché forzi un rifiuto di F1 in una posizione nota), preso in quattro punti: 0 estrazioni, 1 estrazione, subito dopo il rifiuto, dopo un mescolamento, **WHEN** è serializzato, letto e serializzato di nuovo, **THEN** le due stringhe sono uguali, il contatore include l'estrazione rifiutata e il tiro successivo del generatore ripreso è identico a quello del generatore mai interrotto. |
| AC-20a | Logic | Edge: versione | **GIVEN**, uno per caso, uno stato serializzato con id dell'algoritmo diverso e uno con versione diversa da quelle disponibili, **WHEN** si tenta la deserializzazione, **THEN** si ottiene un errore `AlgorithmMismatch` e nessun generatore. *La decisione successiva (rifiuto o rigioco con la versione registrata) è Integrazione con #1/#30.* |
| AC-20b | Logic | RNG-3 | **GIVEN**, uno per caso, uno stato serializzato troncato, con chiavi fuori dall'ordine canonico, con una parola ≥ 2^32 o negativa, con il contatore non intero o negativo, **WHEN** si tenta la deserializzazione, **THEN** si ottiene un errore di stato malformato e nessun generatore. |
| AC-21 | Logic | Edge: seed | **GIVEN** i seed di 64 zeri, di 64 `f` e un seed intermedio registrato, **WHEN** si producono 1 000 estrazioni grezze per ciascuno (accesso di test dell'ADR-B), **THEN** le tre sequenze sono diverse fra loro e ognuna ha almeno 998 valori distinti. |
| AC-22 | Logic | RNG-2 | **GIVEN**, uno per caso, un seed di 63 e uno di 65 caratteri, uno con maiuscole, uno con il prefisso `0x`, uno con spazi, uno con un carattere non esadecimale, la stringa vuota, il numero `123`, il BigInt `123n`, `null` e `undefined`, **WHEN** si crea un generatore, **THEN** ogni caso dà un errore di seed non valido e nessun generatore. |
| AC-23 | Logic | RNG-3 | **GIVEN** due generatori, prima con seed diversi e poi con lo stesso seed, **WHEN** 1 000 loro chiamate (tiri, ritiri, mescolamenti) sono alternate, **THEN** ognuno dà la stessa sequenza che dà se usato da solo. |
| AC-24a | Integrazione (#27) | Edge: online, RNG-11 | **GIVEN** il bundle del client online, **WHEN** l'analisi delle dipendenze lo esamina, **THEN** il modulo del generatore non vi è incluso. |
| AC-24b | Integrazione (#27, #29) | Edge: online, RNG-12 | **GIVEN** un client online con il modulo del generatore sostituito da uno che lancia un errore, **WHEN** applica gli eventi del server e una riconnessione, **THEN** lo fa senza errori e il suo stato supera la scansione di AC-16. |
| AC-25a | Integrazione (#27) | RNG-2 | **GIVEN** un server, **WHEN** un client propone un seed alla creazione della partita, a partita in corso o come campo in più di un messaggio, **THEN** la proposta è rifiutata e il seed della partita non cambia. *Riportato nel GDD di #27.* |
| AC-25b | Integrazione (#1, #27) | RNG-4 | **GIVEN** una partita in corso, **WHEN** la stessa azione con lo stesso id arriva due volte, prima in sequenza e poi in parallelo, **THEN** il contatore delle estrazioni avanza una volta sola e il duplicato riceve gli eventi originali; **AND** con lo stesso id e un contenuto diverso l'azione è rifiutata. |
| AC-25c | Integrazione (#27, #29) | RNG-4 | **GIVEN** una partita in corso, **WHEN** il server reinvia gli eventi a un client che si riconnette, **THEN** il contatore delle estrazioni non cambia. |
| AC-26 | Integrazione (#7, #24) | Edge: rivincita, RNG-2 | **GIVEN** una fonte di entropia sostituita che restituisce due blocchi di 32 byte diversi e conta le proprie chiamate, **WHEN** si creano una partita e la sua rivincita, **THEN** i due seed sono la codifica esadecimale dei due blocchi e la fonte è stata chiamata una volta per partita, solo alla creazione. |
| AC-27 | Logic | RNG-15 | **GIVEN** il generatore, **WHEN** se ne leggono id dell'algoritmo e lunghezza della chiave, **THEN** l'id è nella lista bianca dell'ADR-A e la chiave è di 256 bit pari al seed. *Che hot seat, online e test usino lo stesso id è Integrazione con #24 e #27.* |
| AC-28a | Logic | RNG-16 | **GIVEN** un generatore in uno stato X e un tiro di gruppo di tre dadi il cui terzo ha n = 0, **WHEN** si chiede il tiro, **THEN** si ottiene un `RngError`, nessun risultato per i primi due dadi e lo stato resta X. |
| AC-28b | Integrazione (#1, #27) | RNG-16 | **GIVEN** una partita in corso con contatore C, **WHEN** un giocatore invia un'azione illegale per le regole, **THEN** l'azione è rifiutata e il contatore resta C. *Riportato nei GDD di #1 e #27.* |
| AC-29 | Logic | RNG-2 | **GIVEN** il modulo di entropia, **WHEN** `crypto.getRandomValues` è sostituito, (a) con una funzione che restituisce 32 byte fissi, (b) con una non disponibile, **THEN** (a) il seed è la codifica esadecimale di quei byte, (b) la creazione fallisce con un errore; in entrambi i casi un `Math.random` sostituito da una funzione che lancia non viene chiamato. |
| AC-30 | Logic | RNG-11 | **GIVEN** un seed sentinella e uno stato con parole sentinella, **WHEN** si provocano gli errori di seed non valido, di stato malformato e di dado non valido, **THEN** il testo e i campi di ogni errore non contengono i valori sentinella. |

**Non verificabile con un test**:
- **RNG-14** (deviazione in hot seat) è una politica accettata, non un comportamento.
  Resta documentata e non ha criterio. Ha un criterio la sua conseguenza di architettura
  (la proiezione è l'unica via verso l'interfaccia, AC-16).
- **RNG-15** (imprevedibilità) ha parti meccaniche verificate qui: i vettori ufficiali
  (AC-02a), l'algoritmo dalla lista bianca e la chiave di 256 bit (AC-27). La
  non-invertibilità delle uscite si accetta per la scelta di un algoritmo standard dalla
  lista bianca, nella revisione dell'ADR-A.

## Open Questions

| # | Domanda | Responsabile | Entro |
|---|---------|--------------|-------|
| OQ-1 | **ADR-A**: algoritmo della lista bianca (raccomandato ChaCha20, RFC 8439) con nome, versione e parametri (contatore e nonce); codifica del seed di 256 bit; forma canonica dello stato serializzato (id, versione, chiave, contatore delle estrazioni con blocco e posizione derivati); vettori di prova e file di riferimento di AC-02. **Vincolo**: RNG-2 e RNG-15. Lo scaffold usa mulberry32, che è escluso: non è un default. | technical-director + lead-programmer (ADR) | **prima delle storie di #2**; voce del gate Technical Setup |
| OQ-2 | Liste esatte delle facce di dado strada, stunt, sparo, slam, direzione e movimento, lette dalla pagina del regolamento. | GDD #4 Content Pack | gruppo A |
| OQ-3 | **ADR-C**: formato dell'involucro degli eventi, campo "causa", id da contatore, richiedente e regola dei ritiri, proiezione per giocatore a lista bianca (RNG-10, RNG-11). | GDD #1 Rules Core | gruppo A |
| OQ-4 | Ordine dei posti con cui si consumano i tiri del setup e di inizio round. Al tavolo non esiste un ordine: è una scelta di modellazione che cambia i risultati, da registrare nel registro delle interpretazioni (#17). | GDD #7 Match Setup | gruppo C (M1) |
| OQ-5 | **ADR-B**: forma dell'API pura (stato in, stato nuovo fuori), `DrawSource` iniettabile, richieste di tiro come effetti con il contenuto di RNG-17, `Result` e varianti di `RngError`, percorso del nucleo e del modulo di entropia, strumento di controllo del confine (AC-03b: TypeScript 7 non ha API JavaScript, quindi il controllo non può contare su typescript-eslint senza un secondo pacchetto), tipo unico di stato proiettato. | lead-programmer, con #1 e #23 | prima delle storie di #2 |
| OQ-6 | *Decisa (D1, 2026-11-15)*: il seed di una partita online è rivelato a fine partita, dopo che il server ha chiuso e salvato la partita, con l'hash pubblicato a inizio partita (commit-reveal). Restano a #27 l'hash, il momento della rivelazione per uscite anticipate e il verificatore; a #22 l'esportazione del replay. | GDD #22 e #27 | gruppo C |
| OQ-7 | `M_MAX_PILA`: quanti elementi ha la pila più grande del gioco base (mazzo strada, segnalini pericolo, segnalini danno) e delle espansioni previste? Va letto dal regolamento; decide quali pile cadono nel regime computazionale (RNG-9). | utente + GDD #4, #7, #12, #15 | prima dei GDD di #7, #12, #15 |
| OQ-8 | Chi ospita il server online (un giocatore, un volontario, un servizio)? Decide contro chi protegge la garanzia di onestà online (Player Fantasy). | utente + GDD #27 | gruppo C |
