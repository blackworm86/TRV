# TRV9000: squadre guidate dalle carte (bot)

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-18
> **Fonte**: *The TRV9000*, espansione fan-made (regolamento V20250511, carte V1.0), in
> `assets/sorgenti/TRV 04 TRV9000/` (fuori da git). Trascrizione delle carte:
> `data/trv/trv9000.json`.

## Overview

Da una a tre squadre "fittizie" si aggiungono alla partita e giocano da sole, guidate da un mazzo
di 18 carte attivazione: ognuna ha un comando (attacco aereo, drift, riparazione), l'ordine in cui
attivare le tre auto e, per ciascuna, una riga di movimenti fissi da eseguire da sinistra a
destra. Una carta *Basic Protocol* fissa la difficoltà con quattro livelli cumulativi; con Choppe
Shoppe una carta squadra dà alle auto del bot un potere per taglia. Servono per giocare da soli o
per riempire il tavolo, in hot seat e online.

È un modulo di regole come le espansioni: si accende in creazione partita e non cambia nulla
quando è spento.

## Player Fantasy

Un avversario che si muove come un pilota testardo: va sempre a tutta nella direzione che ha
scelto, scarta all'ultimo un muro o un fosso, e spara a chi gli capita davanti. Prevedibile quanto
basta per poterlo battere guardando la sua carta, imprevedibile quanto basta per sorprendere.

## Detailed Rules

### 1. Preparazione

1. Ogni squadra TRV9000 ha un colore, tre plance, tre auto (S, M, L) e un elicottero. **Niente**
   plancia comandi né dadi movimento.
2. Le auto partono nella zona di partenza, come quelle di un giocatore.
3. La carta *Basic Protocol* sta accanto alle plance del bot, al livello scelto (1-4). Il mazzo è
   unico per tutti i bot: 18 carte coperte.
4. Con Choppe Shoppe ogni squadra pesca a caso una carta squadra; i suoi poteri valgono tutta la
   partita, uno per taglia.
5. Prima del primo round un giocatore tira tutti i suoi dadi movimento una volta per il bot e
   tiene il totale: serve solo a decidere chi inizia. Poi tira di nuovo per sé. Il bot può essere
   il primo giocatore.
6. Il bot gioca i suoi turni nell'ordine normale.

### 2. Attivazione

Al **primo** turno del bot in un round:

1. Pesca una carta attivazione (mazzo vuoto: rimescola gli scarti).
2. Esegue subito il comando in cima, una volta per round:
   - **Attacco aereo**: il bersaglio è il veicolo avversario più avanti. L'elicottero va sulla
     casella dietro di lui indicata dalla freccia piccola; se non è libera prova la successiva
     nell'ordine della freccia; se nessuna delle tre lo è, va dietro al veicolo avversario secondo
     più avanti. Poi spara al bersaglio.
   - **Drift**: per tutto il round, nel movimento, le auto del bot attraversano la prima auto
     (anche propria) in cui entrano senza slam.
   - **Riparazione**: toglie subito un segnalino danno da ogni auto del bot e li rimescola coperti
     nella pila.
3. Scopre la prima riga della carta: l'auto di quella taglia è l'attiva.

A ogni turno del bot (anche il primo): **movimento**, poi **tiro**, poi la riga successiva resta
pronta per il turno dopo. A fine round la carta va negli scarti.

**Auto non attivabile**: se l'auto della riga è fuori uso o eliminata, si passa alla riga
successiva. Se tutte le auto operative sono già state attivate nel round, l'auto più in alto
sulla carta fa **un'inerzia** (vedi 5).

### 3. Primo round

Prima del primo movimento di un'auto del bot si tira il dado direzione e l'auto si mette sulla
casella che lo schema del regolamento assegna a quella faccia, poi fa il suo movimento. Ogni
faccia corrisponde alla prima casella di una riga della tessera di partenza (lettura dello schema
confermata dall'utente, 2026-11-18):

| Faccia | Riga |
|---|---|
| Indietro-sinistra | 0 |
| Avanti-sinistra | 1 |
| Indietro | 2 |
| Avanti | 3 |
| Indietro-destra | 4 |
| Avanti-destra | 5 |

Se quella casella è occupata (da un veicolo o da un pericolo scoperto) o invalicabile, si ritira
il dado direzione (decisione dell'utente, 2026-11-18). Se nessuna delle sei caselle è libera, il
dado non si tira e l'auto resta in partenza per quel turno (approvato dall'utente con il
documento, 2026-11-18: altrimenti si tirerebbe all'infinito).

### 4. Movimento

La riga dell'auto si legge da sinistra a destra; ogni simbolo è un micro-movimento:

- **Numero e direzione**: muove l'auto *fino a* quel numero di caselle, sempre nella stessa
  direzione: avanti, avanti-sinistra (triangolo in alto) o avanti-destra (triangolo in basso). Il
  triangolo in alto è la diagonale verso la riga superiore della plancia (confermato
  dall'utente, 2026-11-18).
- **Simbolo fuoco**: vale **solo** se l'auto è in fiamme, e applica il risultato mostrato senza
  tirare il dado fuoco (teschio = eliminata, fiamma spenta = il fuoco si spegne, +1/+2 =
  movimenti bonus). Per le auto del bot +1 e +2 **non sono obbligatori**: sono micro-movimenti
  bonus dritti in avanti, con le regole qui sotto.
- **Terreni**: fango, melma tossica e saline contano come strada, senza effetti. Chiazza d'olio,
  rampa, fuoco e pericoli coperti (vetro del deserto compreso, finché è coperto): regole normali,
  come per un giocatore.
- **Cambio di direzione**: se la prossima casella è il bordo della tavola, invalicabile,
  un'auto della stessa squadra, una rampa che elimina, una mina scoperta o il vetro del deserto
  scoperto, il micro-movimento si ferma sulla casella precedente e si passa al simbolo
  successivo (vetro: decisione dell'utente, 2026-11-18).
- **Mai** entrare in una casella che, già si sa, danneggia o elimina l'auto.
- **Slam**: il bot non fa mai slam contro le proprie auto (il micro-movimento si ferma e si passa
  al simbolo successivo). Se uno slam sposta un'auto del bot e il dado si può ritirare, il bot
  ritira **sempre**.
- Il movimento finisce dopo l'ultimo simbolo, oppure dopo uno slam, un salto o un danno; poi si
  spara.

### 5. Inerzia

Se il bot deve muovere ma tutte le sue auto operative sono già state attivate, l'auto più in alto
sulla carta fa una inerzia: una casella avanti, oppure nella direzione indicata dal simbolo di
priorità (in alto a destra sulla carta), senza mai entrare in una casella che danneggia o elimina
l'auto.

### 6. Tiro

Se nell'arco frontale dell'auto attiva c'è un veicolo avversario, spara. Con più bersagli, la
priorità della carta: la freccia piccola indica in che ordine provare le tre caselle dell'arco
(dall'alto in basso o dal basso in alto, partendo dalla casella del bersaglio rosso). Se la casella
è vuota si passa alla successiva.

### 7. Basic Protocol (difficoltà)

I livelli si sommano: il livello 3 applica anche 1 e 2.

1. Fuoristrada, fango, melma tossica e saline contano come strada.
2. Il primo pericolo coperto attraversato nel movimento di un'auto del bot viene ignorato.
3. Un'auto del bot può finire il turno sulla casella del proprio elicottero: si toglie
   l'elicottero invece di eliminare l'auto.
4. Le auto del bot attraversano le caselle con un'altra auto del bot senza slam.

### 8. Carte squadra (Choppe Shoppe)

Sette carte, una per squadra, con un livello (1-3: quanto è forte la squadra, nessun effetto di
regola) e un potere per taglia (testo in
`data/trv/trv9000.json`): Trigger Happy, Mechanized Rams, The Untouchables, The Immortals,
Gunners, Bomb Squad, All For Speed. L'ottava carta del foglio è vuota.

### 9. Cosa vede il giocatore

- La carta attivazione del round accanto alle plance del bot, con la riga attiva in evidenza.
- Ogni micro-movimento come un movimento normale, uno dopo l'altro, e nel registro la ragione di
  ogni cambio di direzione ("davanti c'è un invalicabile: passa al simbolo dopo").
- In hot seat il bot gioca da solo senza passare il dispositivo; online lo muove il server.

## Formulas

Il modulo non ha formule numeriche proprie: tutti i numeri sono sulle carte. Le sole regole
"di calcolo" sono di ordine:

- **Veicolo più avanti** (attacco aereo): colonna più alta, con le righe dispari mezza casella
  avanti (come il verme delle sabbie: `c + 0,5` sulle righe dispari). A pari merito, il più
  danneggiato (più segnalini danno); se sono ancora pari, uno a caso col generatore della
  partita (decisione dell'utente, 2026-11-18). Esempio: due auto in colonna 9, una con 2 danni e
  una con 1 → bersaglio quella con 2.
- **Quanto muovere**: per ogni simbolo `n`, il bot avanza di `k` caselle con
  `k = max { j ≤ n : le caselle 1..j sono ammesse }`; ammessa = non provoca cambio di direzione e
  non è un danno o un'eliminazione certa. Esempio: simbolo `4 avanti`, invalicabile alla terza
  casella → `k = 2`.

## Edge Cases

- **Mazzo vuoto**: si rimescolano gli scarti. Con più bot il mazzo è unico, condiviso da tutti
  (decisione dell'utente, 2026-11-18): ogni bot pesca la sua carta al proprio primo turno del
  round, e le carte del round vanno negli scarti alla fine del round.
- **Tutte e tre le auto fuori uso o eliminate**: il bot non ha turno, come un giocatore.
- **Bot senza auto in strada**: il giocatore TRV9000 esce dalla partita come un giocatore.
- **Attacco aereo senza avversari in strada**: il comando non fa nulla, l'elicottero resta dov'è
  e non spara (decisione dell'utente, 2026-11-18).
- **Attacco aereo con il proprio elicottero già in gioco**: lo si sposta dietro il nuovo
  bersaglio e spara, come per un giocatore (decisione dell'utente, 2026-11-18).
- **Simbolo fuoco su un'auto non in fiamme**: si salta.
- **Micro-movimento di 0 caselle** (la prima casella è già vietata): si passa al simbolo dopo.
- **Pericolo coperto davanti**: regole normali (si entra e si scopre), salvo il livello 2 del
  protocollo.
- **Bot che vince**: vale la vittoria normale; una partita solo tra bot non si può creare.

## Dependencies

- Regole (`rules-core.md`, `src/game/trv/engine.ts`): turno, movimento (`enter`), slam, tiro,
  danni, elicottero, fuoco. Il bot usa le stesse primitive, senza decisioni da chiedere.
- Dadi (`dice-seeded-rng.md`): la pesca delle carte usa il generatore della partita, così stesso
  seme e stesse scelte rifanno la stessa partita.
- Choppe Shoppe: i poteri delle carte squadra riusano gli stessi effetti dei potenziamenti con lo
  stesso nome dove esistono.
- Carnage at Devil's Run: terreni e fuoco.
- Creazione partita (#24) e server online (#27): scegliere i bot e la difficoltà, e muoverli dal
  server.
- Questo documento dipende da `rules-core.md`; quel documento dovrà citare questo modulo.

## Tuning Knobs

- **Livello del protocollo** (1-4), per partita: è la difficoltà.
- **Numero di bot** (1-3), con il limite di giocatori della scatola.
- **Carte squadra**: sempre pescate a caso, una per bot e senza ripetizioni (decisione
  dell'utente, 2026-11-18); non è una manopola.
- **Ritmo**: pausa fra un micro-movimento e l'altro, nei dati di presentazione.

## Acceptance Criteria

- [ ] Le 18 carte, il protocollo e le carte squadra in `data/trv/trv9000.json` sono quelle
      stampate (controllo dell'utente sulla trascrizione).
- [x] Una partita con un bot si gioca fino alla fine senza mai chiedere una scelta per il bot
      (test automatico su molte partite a caso: `tests/unit/trv/trv9000.test.ts`).
- [x] Stesso seme e stesse scelte dei giocatori: stessa partita, bot compresi (test automatico).
- [ ] Un'auto del bot non entra mai in una casella che la danneggia o la elimina con certezza, né
      fa slam contro un'auto della propria squadra (test automatico).
- [x] Per ogni simbolo, l'auto si ferma dove la formula di "quanto muovere" dice (test su casi
      costruiti: invalicabile, bordo, auto amica, mina scoperta).
- [x] Il livello 1 del protocollo tratta fuoristrada e fango come strada; i livelli 2-4 fanno ciò
      che dicono (un test per livello).
- [x] Schermata di una partita con due bot: carta attiva visibile, ogni micro-movimento leggibile
      (`production/qa/evidence/trv-trv9000-2026-11-18/`).

## Open Questions

- ~~**D1**: con più bot, un solo mazzo per tutti o uno a testa?~~ Un solo mazzo condiviso
  (decisione dell'utente, 2026-11-18).
- ~~**D2**: cosa vuol dire il livello (Lv1-Lv3) sulle carte squadra?~~ Indica solo quanto è
  forte la squadra, senza effetti di regola (risposta dell'utente, 2026-11-18).
- ~~**D3**: le carte squadra si pescano a caso o si possono anche scegliere?~~ Solo a caso, come
  nel regolamento (decisione dell'utente, 2026-11-18).
- ~~**D4**: attacco aereo con due avversari ugualmente avanti: quale è il bersaglio?~~ Il più
  danneggiato; se ancora pari, a caso (decisione dell'utente, 2026-11-18).
- ~~**D5**: attacco aereo senza avversari in strada, o con l'elicottero già in gioco.~~ Senza
  avversari non fa nulla; con l'elicottero già in gioco lo si sposta (decisioni dell'utente,
  2026-11-18).
- ~~**D6**: lo schema del primo round mette l'auto sulla prima casella della riga?~~ Sì, con la
  tabella del punto 3 (confermato dall'utente, 2026-11-18).
- ~~**D9**: primo round, la casella indicata dal dado è già occupata: dove si mette l'auto?~~ Si
  ritira il dado (decisione dell'utente, 2026-11-18).
- ~~**D7**: vetro del deserto, regole normali o cambio di direzione?~~ Scoperto fa cambiare
  direzione, coperto segue le regole normali (decisione dell'utente, 2026-11-18).
- ~~**D8**: il permesso di distribuire la grafica delle carte.~~ L'utente ha il permesso
  dell'autore, ma le carte vanno **ridisegnate** con la grafica del gioco digitale, per coerenza
  di look and feel: non si usano le immagini originali (decisione dell'utente, 2026-11-18).

### Carte ridisegnate

Le carte attivazione, la Basic Protocol e le carte squadra si disegnano dai dati
(`data/trv/trv9000.json`) con lo stesso linguaggio delle altre carte del gioco digitale
(`src/view/vector/`: cornici, font, pittogrammi, palette): stesse informazioni e stesso ordine
della carta stampata, simboli di movimento e di priorità ridisegnati come quelli dei dadi e dei
comandi. Si vedono nella galleria e nell'inspector come le altre carte.
