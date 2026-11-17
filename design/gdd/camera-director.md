# Camera Director

> **Status**: Bozza — prima versione in prova nel gioco (opzione "Regia nuova"), in attesa del giudizio dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-17
> **Implements Pillar**: P2 Ogni dado si spiega (ciò che succede in partita si deve vedere e capire)

## Overview

Il director decide dove sta la camera durante gli eventi della partita (sparo, slam, salto,
danno, incendio, eliminazione, attacco aereo, domande sui dadi). La sua priorità è la
**leggibilità**: quello che conta deve stare nella parte libera dello schermo, senza che
ostacoli, pezzi o interfaccia lo coprano. Lo stile (angoli bassi, tre quarti, giri lenti) viene
dopo e non può mai costare leggibilità.

È solo presentazione: non legge e non cambia le regole, non usa i dadi della partita.

## Player Fantasy

Guardare la partita come una ripresa fatta apposta: ogni evento si capisce al primo sguardo
(chi ha sparato a chi, chi ha urtato chi, quale auto ha preso il danno) e ha un'inquadratura
con carattere. Il giocatore non deve mai spostare la vista per capire cosa è successo, e
riprende il controllo appena tocca il tavolo.

## Detailed Rules

1. **Parte libera dello schermo.** Il director misura i rettangoli dell'interfaccia: barra e
   bolle dei giocatori in alto, striscia del giocatore in basso, cassetto dei dadi, carte in
   mano, pannello dei danni e dei dadi quando è aperto. La parte libera è il rettangolo più
   grande che nessuno di questi copre. Viene misurata di nuovo ogni `refresh` secondi: se si
   apre un pannello, l'inquadratura si sposta accanto.
2. **Soggetti.** Ogni evento dichiara cosa si deve vedere, come sfere con un peso:
   - sparo: chi spara (1) e il bersaglio (2);
   - slam: la casella dell'urto con le sei attorno (dove un veicolo verrà spinto);
   - salto: rampa, casella d'arrivo e l'auto in volo (2);
   - danno, incendio: l'auto, da vicino;
   - eliminazione: l'auto (2) e la casella dove stava entrando;
   - attacco aereo: le caselle bersaglio (2) e l'elicottero sopra;
   - domanda sui dadi: i dadi appena tirati.
3. **Inquadrature candidate.** Ogni evento ha una lista di modi di riprenderlo, nei dati
   (`director.shots`): angolo attorno all'azione (`yaw`, 0 = alle spalle, 90 = di lato),
   altezza (`elev`), quanto i soggetti riempiono la parte libera (`fill`), distanza minima
   (`near`), eventuale giro lento (`orbit`). La prima della lista è quella "d'autore"; ogni
   candidata è provata da entrambi i lati.
4. **Calcolo della posa.** Per ogni candidata la camera si mette alla distanza minima a cui
   tutti i soggetti stanno dentro `fill` della parte libera, centrati in essa.
5. **Voto.** Una posa pulita vale 100. Perde punti se:
   - un soggetto è nascosto da un ostacolo, un veicolo o un elicottero (−60, in proporzione al peso);
   - un soggetto esce dalla parte libera (−50);
   - la camera finisce sotto il tavolo (−100);
   - riprende dal lato lontano del tavolo (−25) o contro il senso di marcia (−15): la strada
     corre sempre da sinistra a destra;
   - dopo un'altra inquadratura rovescia la scena (−10);
   - un dado in primo piano invade l'immagine (fino a −20 l'uno).
   Guadagna fino a 30 punti se il soggetto principale è grande, e 2 punti per ogni posto
   guadagnato nell'ordine della lista. Vince il voto più alto.
6. **Ciò che resta in mezzo.** Un elicottero che copre l'azione nell'inquadratura scelta viene
   nascosto finché dura. I dadi di movimento del giocatore escono dal tavolo durante la ripresa.
7. **Ritmo.** Un evento che arriva entro `hold` secondi dall'inizio di una ripresa non provoca
   uno stacco: i suoi soggetti si aggiungono e la ripresa si allarga per tenerli.
8. **Soggetti che si muovono.** La posa si ricalcola a ogni fotogramma sui soggetti dove sono
   in quel momento (un'auto che vola, rotola o viene spinta), con la stessa candidata.
9. **Mano del giocatore.** Toccare o zoomare il tavolo durante una ripresa restituisce subito
   la vista. A fine evento la vista torna com'era.
10. **Quando non lavora.** Camera d'azione spenta, animazioni saltate, replay istantaneo.

## Formulas

- Proiezione di un punto `p` per una camera in `pos` che guarda `look`, con assi `f` (avanti),
  `r` (destra), `u` (su), campo verticale `fov`, rapporto `aspect`:
  `depth = (p − pos)·f`, `x = (p − pos)·r / (depth · tan(fov/2) · aspect)`,
  `y = (p − pos)·u / (depth · tan(fov/2))`. Lo schermo va da −1 a 1 su entrambi gli assi.
- Una sfera di raggio `R` occupa `±R / (depth · tan(fov/2))` in verticale e lo stesso diviso
  `aspect` in orizzontale.
- Distanza: la minima (cercata per bisezione fra `near` e 400) a cui il riquadro dei soggetti è
  largo al più `fill × larghezza libera` e alto al più `fill × altezza libera`. Poi il punto
  guardato si sposta di `(centro riquadro − centro libero) × depth × tan(fov/2)` lungo `r` e
  `u`; sei passate.
- Linea di vista: 32 punti fra camera e soggetto; un ostacolo (cilindro di raggio `r` fra le
  altezze `y0` e `h`) la interrompe se un punto vi cade dentro. Non conta un ostacolo più
  vicino al soggetto di `r + R`.

Esempio: sparo fra due auto a quattro caselle, finestra 1600 × 1000, parte libera alta 380 px:
la candidata "alle spalle" (yaw 28°, elev 22°, fill 0,8) porta le due auto a occupare l'80%
della larghezza o dell'altezza libera, quale delle due viene raggiunta prima.

## Edge Cases

- **Parte libera troppo piccola** (meno di un quarto della larghezza o del 15% dell'altezza
  della finestra): si usa la sola fascia fra barra e striscia, con i pannelli sopra l'immagine.
- **Nessuna candidata pulita**: vince comunque il voto più alto (la meno peggio).
- **Auto distrutta durante la ripresa**: il soggetto resta sull'oggetto che vola via.
- **Trappola rivelata**: è invalicabile ma è un buco, non conta come ostacolo.
- **Vista in soggettiva (chase)**: il director non cambia l'obiettivo di quella vista.

## Dependencies

- `src/view/camera/framing.ts`: il calcolo, puro (nessun DOM, nessuna scena).
- `src/app/shots.ts`: soggetti dagli eventi, rettangoli dell'interfaccia, ostacoli dal tavolo.
- `src/app/director.ts`: muove la camera lungo la ripresa e restituisce la vista.
- `data/trv/presentation_base.json`, blocco `director`.
- Regole (`engine.ts`): solo lettura dei `Frame` e del terreno.

## Tuning Knobs

Tutti in `data/trv/presentation_base.json` → `director`: `hold`, `refresh`, `floor`,
`subject.*` (raggi dei soggetti, in caselle), `blocker.*` (raggio e altezza degli ostacoli),
`shots.<evento>[]`. I pesi del voto sono in `framing.ts` (`SCORE`, `LOOM`).

## Acceptance Criteria

- [x] I soggetti di ogni ripresa stanno nella parte libera dello schermo e la riempiono per la
      quota chiesta (test: *keeps every subject inside the free band…*, *centres the subjects…*).
- [x] Con un pannello al centro la parte libera è accanto al pannello (test: *goes beside a panel…*).
- [x] Una candidata coperta da un muro perde contro una che vede sopra (test: *leaves a shot that a wall hides…*).
- [x] Dadi in primo piano fanno preferire un'inquadratura che li tiene piccoli (test: *leaves a low shot with dice looming…*).
- [x] A parità, vince la prima candidata della lista, dal lato del giocatore.
- [ ] Giudizio dell'utente in partita: ogni evento si capisce senza toccare la vista.

## Non ancora fatto

- Un solo "padrone" della camera: vista mappa, zoom sull'auto, replay e director hanno ancora
  ciascuno il proprio codice di movimento.
- Dissolvenza di rocce e veicoli che coprono: oggi il director li evita scegliendo un'altra
  candidata, e nasconde solo gli elicotteri.
- Carrellate e avvicinamenti durante la ripresa (c'è solo il giro lento sull'incendio).
- Il replay istantaneo usa ancora le sue inquadrature.
