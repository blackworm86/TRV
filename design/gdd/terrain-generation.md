# Generazione dei terreni e degli ostacoli

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-18
> **Implements Pillar**: P2 Ogni dado si spiega; identità visiva "Il tavolo fisico" (principio 3: rumore visivo controllato)

## Overview

Il sistema disegna la faccia di ogni tessera strada partendo solo dalla sua griglia di caselle
(`data/trv/game_base.json`): suolo in rilievo, ostacoli sulle caselle invalicabili, dettagli che
danno vita alla mappa. Oggi esiste una prima versione (`src/view/terrain/`): il suolo è una
superficie colorata e rialzata per tipo di terreno, gli ostacoli sono un gruppo di pezzi per
casella con un raccordo fra caselle vicine. Questa versione lo porta a una mappa **modellata**:
formazioni intere invece di pezzi ripetuti, suolo con forme proprie, dettagli messi con criterio.
La regola che comanda su tutto è la riconoscibilità: il tipo di ogni casella si capisce al primo
sguardo, da qualunque inquadratura.

È solo presentazione: non legge e non cambia le regole, non usa i dadi della partita.

## Player Fantasy

Guardare un diorama del deserto fatto a mano: ogni tessera ha il suo carattere (un canyon, un
parcheggio in rovina, una pozza di fango) e nessuna sembra la copia di un'altra. E insieme non
dover mai chiedersi "qui posso passare?": strada, fuoristrada, fango e invalicabile si
distinguono come sul tabellone di cartone.

## Detailed Rules

### 1. Grammatica della leggibilità

Ogni tipo di terreno ha quattro segni fissi. La varietà lavora dentro questi segni, mai contro.

| Tipo | Quota | Colore | Superficie | Volume sopra |
|------|-------|--------|------------|--------------|
| Strada (R) | zero | grigio asfalto | liscia, crepe, segni di gomme | niente |
| Fuoristrada (o) | poco sopra la strada | sabbia chiara | onde, dune basse | solo dettagli bassi |
| Fango (M) | sotto la strada | bruno scuro, lucido | pozza, bordo molle | niente |
| Invalicabile (X) | alta | secondo la formazione | roccia, muro, cemento | **sempre** un volume alto |

- Solo l'invalicabile ha un volume alto. Nessun dettaglio su una casella percorribile supera
  `detail.max_h` (più basso del cofano di un'auto piccola).
- Ogni casella invalicabile ha volume: nessuna resta piatta, nemmeno dentro una formazione grande.
- Il colore medio di due tipi diversi resta distinguibile (vedi Formule).
- I terreni di Carnage at Devil's Run (melma, vetro, sale, fuoco, rampa) seguono la stessa
  grammatica con i loro segni, già definiti nello stile attuale.
- Lo strato delle informazioni (linee della griglia, triangoli dei pericoli, cornice
  dell'invalicabile) sta sempre sopra il suolo e non viene mai coperto da un dettaglio.

### 2. Strati

Il sistema lavora a strati, ciascuno con una sola responsabilità:

1. **Suolo**: quota, colore e ruvidità di ogni punto della tessera.
2. **Formazioni**: i volumi sulle caselle invalicabili.
3. **Dettagli**: piante, sassi, rottami, segni; non toccano la leggibilità.
4. **Informazioni**: griglia e simboli di gioco (già esistente, non cambia).

### 3. Suolo

- **Forme grandi prima, grana dopo.** Ogni tessera ha una forma d'insieme (dune che corrono in
  una direzione, la carreggiata più consumata al centro, il fango che scende verso il punto più
  basso) e sopra la grana fine.
- **Bordi fra terreni**: il confine segue il contorno delle caselle con un piccolo scarto
  (`warp`), abbastanza da non sembrare un esagono ritagliato, mai tanto da far sembrare una
  casella di un altro tipo. La sabbia invade l'asfalto con una frangia sottile; il fango ha una
  riva.
- **Direzione comune**: vento e senso di marcia sono gli stessi su tutte le tessere (le dune e i
  segni di gomme sono coerenti lungo la strada), anche se ogni tessera resta un pezzo di cartone
  separato con il suo bordo.

### 4. Formazioni di ostacoli

- Le caselle invalicabili che si toccano formano **un gruppo**. Il gruppo viene letto per forma:
  singola, coppia, fila, angolo, massa.
- Ogni gruppo diventa **una sola formazione** scelta fra gli archetipi del bioma della tessera:
  una cresta lungo una fila, una mesa su una massa, un muro spezzato su un angolo, un pinnacolo
  su una casella sola. Non più un pezzo uguale ripetuto per casella.
- La formazione sta dentro le sue caselle, con un margine (`formation.inset`): non sporge mai
  sopra una casella percorribile e non nasconde il bordo della casella accanto.
- L'altezza cresce con la grandezza del gruppo fino a un tetto (`formation.max_h`), perché una
  formazione troppo alta copre le auto dietro.
- Ogni formazione dichiara il suo ingombro vero (raggio e altezza per casella): il camera
  director lo usa al posto dei valori fissi di oggi (`director.blocker`).

### 5. Biomi

Ogni faccia ha un bioma (`data/trv/terrain_look.json`), che oggi sceglie solo il tipo di
ostacolo. Il bioma decide: archetipi delle formazioni, sfumatura della palette, quali dettagli e
quanto fitti. Biomi di partenza, dai cinque tipi già presenti: rocce, canyon (mesa), rovine,
bunker, barricata.

### 6. Dettagli

- Messi per regola, non a caso: le piante al riparo delle rocce e ai bordi della sabbia, i
  rottami ai piedi delle rovine, i segni di gomme sull'asfalto nel senso di marcia.
- Zone vietate: il centro di ogni casella (dove stanno auto e segnalini), le linee e i simboli
  dello strato informazioni, le caselle di partenza.
- Densità per tipo di terreno, nei dati.

### 7. Varietà e ripetibilità

Stessa faccia e stesso seme, stesso risultato, su ogni dispositivo. Il seme viene dal nome della
faccia: la stessa tessera ha lo stesso aspetto in ogni partita (come il cartone vero), e in una
partita online tutti vedono la stessa mappa.

## Formulas

- **Distinguibilità dei colori**: per ogni coppia di tipi `a`, `b`, con `L` la luminanza media
  (0–1) del suolo di quel tipo sulla tessera: `|L(a) − L(b)| ≥ contrast.min`. Proposta iniziale
  `contrast.min = 0,12`, da tarare. Esempio: asfalto 0,36 e sabbia 0,70 → 0,34, passa.
- **Altezza di una formazione**: `h = min(formation.max_h, formation.base_h + formation.grow × (n − 1))`,
  con `n` il numero di caselle del gruppo, in unità di casella. Proposta iniziale: `base_h 0,45`,
  `grow 0,12`, `max_h 0,9`. Esempio: gruppo di 3 caselle → `0,45 + 0,24 = 0,69`.
- **Zona vietata ai dettagli**: un dettaglio in `p` è ammesso se dista più di
  `detail.clear × lato casella` dal centro di ogni casella percorribile. Proposta iniziale
  `detail.clear = 0,3`.

I valori proposti non sono ancora stati provati a schermo.

## Edge Cases

- **Gruppo che tocca il bordo della tessera**: la formazione finisce al bordo; non continua
  sulla tessera accanto (sono due pezzi separati).
- **Casella invalicabile che diventa altro** (trappola rivelata, relitto): la trappola resta un
  buco, senza formazione; i relitti sono pezzi di gioco, fuori da questo sistema.
- **Pericolo rivelato che cambia il suolo** (chiazza d'olio): il suolo della casella viene
  ridisegnato; i dettagli su quella casella spariscono.
- **Tipo di terreno sconosciuto nei dati**: disegnato come strada (com'è oggi).
- **Qualità grafica bassa**: meno dettagli e mappe più piccole; quote, colori e formazioni
  restano identici, perché portano informazione di gioco.
- **Vista piatta** (`terrain: 'flat'`): resta com'è, senza formazioni né dettagli.

## Dependencies

- `src/view/terrain/procedural.ts` (suolo), `obstacles.ts` (formazioni), `board3d.ts` (li monta
  sulla tessera).
- `data/trv/game_base.json`: la griglia delle facce, sola lettura.
- `data/trv/terrain_look.json`: bioma e valori per faccia.
- Camera director (`camera-director.md`): riceve l'ingombro vero delle formazioni.
- Regole (`rules-core.md`): nessuna dipendenza; il sistema non le legge.

## Tuning Knobs

In `data/trv/terrain_look.json` (oggi una parte è nel codice, `TERRAIN_STYLE`, e va portata nei
dati):

- `height.*`, `rough.*`, colori per tipo: i segni della grammatica.
- `warp`: scarto dei bordi fra terreni. Troppo alto e una casella sembra di un altro tipo.
- `formation.base_h`, `grow`, `max_h`, `inset`: altezza e margine delle formazioni.
- `detail.max_h`, `detail.clear`, densità per tipo: quanto è "viva" la mappa.
- `contrast.min`: soglia di distinguibilità.
- Per bioma: archetipi ammessi, palette, dettagli.

## Acceptance Criteria

- [ ] Ogni casella invalicabile di ogni faccia ha un volume alto almeno `formation.base_h`; nessuna
      casella percorribile ha volumi sopra `detail.max_h` (test automatico su tutte le facce).
- [ ] Nessuna formazione esce dalle proprie caselle oltre il margine (test automatico).
- [ ] Per ogni faccia, ogni coppia di tipi presenti rispetta `contrast.min` (test automatico).
- [ ] Nessun dettaglio dentro le zone vietate (test automatico).
- [ ] Stessa faccia e stesso seme: mappe e geometrie identiche (test automatico).
- [ ] Un gruppo di caselle invalicabili vicine è una sola formazione, non pezzi ripetuti
      (schermata di ogni faccia in `production/qa/evidence/`).
- [ ] Giudizio dell'utente: ogni tessera ha un carattere proprio e il tipo di ogni casella si
      capisce senza pensarci, a 1024×768.

## Ordine di lavoro proposto

1. Formazioni di ostacoli (gruppi, archetipi, ingombro per il director).
2. Suolo (forme grandi, bordi, direzione comune).
3. Dettagli (regole di posa, zone vietate).
4. Biomi per faccia e valori portati nei dati.

## Domande aperte

- Le facce senza bioma assegnato oggi usano "rocce": quale bioma per ciascuna va deciso
  guardando le tessere ufficiali insieme all'utente.
