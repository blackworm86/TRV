# Director: scene e camera

> **Status**: Bozza in revisione. La camera è in prova nel gioco (opzione "Regia nuova"); le scene sono
> pianificate qui (2026-11-19). Il primo passo, "una scena alla volta", è già nel gioco (`loop.ts`).
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-19
> **Implements Pillar**: P2 Ogni dado si spiega (ciò che succede in partita si deve vedere e capire)
> **Sistema**: #25 dell'indice. Dialoga con il Movimento dei veicoli (#36, [vehicle-motion.md](vehicle-motion.md))
> e, tramite quello, con i Modelli strutturati (#37).

## Overview

Il director è la regia della partita. Ha due strati:

1. **Scene.** Trasforma i fotogrammi delle regole (`Frame`) in **scene**: un evento leggibile alla volta,
   per esempio "l'auto rossa guida per tre caselle", "slam: urto, dado slam, dado direzione, spinta" o
   "sparo: mira, raffica, danno". Per ogni scena decide l'ordine e i tempi di tutto ciò che si vede:
   movimenti dei veicoli, dadi, effetti, scritte, pannelli. Nessuna scena comincia finché la precedente non
   è finita.
2. **Camera.** Per ogni scena sceglie l'inquadratura che mostra i suoi soggetti nella parte libera dello
   schermo, senza che niente li copra.

La sua priorità è la **leggibilità**: lo stile (angoli bassi, tre quarti, giri lenti) viene dopo e non può
mai costare leggibilità.

È solo presentazione: non legge e non cambia le regole e non usa i dadi della partita.

## Player Fantasy

Guardare la partita come una ripresa fatta apposta: ogni evento si capisce al primo sguardo (chi ha
sparato a chi, chi ha urtato chi, quale auto ha preso il danno, cosa dicono i dadi) e ha un'inquadratura
con carattere. Una cosa alla volta, con il tempo di vederla. Il giocatore non deve mai spostare la vista
per capire cosa è successo, e riprende il controllo appena tocca il tavolo.

## Detailed Rules

### A. Scene

1. **Dalla coda dei fotogrammi alle scene.** I fotogrammi di una scelta si raggruppano in scene secondo
   regole nei dati (`scenes`):
   - più `move` dello stesso veicolo, uno dopo l'altro, formano una scena di **guida**;
   - il dado acrobazia di una rampa, il salto e l'atterraggio formano una scena di **salto**;
   - `slam` con i `roll` che lo seguono, le spinte (`move` dei veicoli spinti) e i danni formano una scena
     di **slam**;
   - `shot` con i suoi `roll` e il `damage` del bersaglio formano una scena di **sparo**;
   - le righe del registro (`log`) si attaccano alla scena in cui cadono; la riga di un nuovo turno apre una
     scena sua;
   - il dado strada è sempre una scena a sé;
   - in uno slam, la spinta è il `move` dopo il dado direzione (al più `push_moves`); un nuovo `slam`, anche
     a catena (p. 9), apre una scena nuova;
   - ogni altro fotogramma è una scena da solo.
2. **Fasi di una scena.** Ogni scena ha tre fasi:
   - **preparazione**: la camera arriva sull'inquadratura e i dadi di un'azione precedente tornano nel
     vassoio;
   - **azione**: i movimenti, i tiri e gli effetti, nell'ordine dei fotogrammi;
   - **chiusura**: un tempo di lettura breve (`hold`) con i dadi fermi e la scritta visibile.
3. **Una scena alla volta.** Una scena comincia solo quando la precedente è finita:
   - veicoli fermi, nel senso di "fermo vero" del Movimento dei veicoli (#36);
   - dadi fermi;
   - effetti, scritte e camera arrivati alla fine.
   Dentro una scena le azioni seguono il **piano**: per esempio, il dado slam si tira dopo l'urto, e la
   spinta parte dopo che i dadi si sono fermati. Tetto di sicurezza: `beats.settle_max_s` secondi per
   attesa, nel caso qualcosa non finisca mai. *Già nel gioco, nella forma semplice*: un passo aspetta che
   tutto il tavolo sia fermo.
4. **Comandi al Movimento dei veicoli.** Ogni movimento di un veicolo è un comando al sistema #36, che
   risponde con durata e momenti salienti. Il director costruisce la sequenza della scena con quelle durate
   e fa partire gli effetti sui momenti salienti, per esempio le scintille sull'impatto.
5. **I dadi d'effetto** (slam, direzione, sparo, acrobazia, fuoco) fanno parte della scena:
   - atterrano accanto all'azione, mai sulle sue caselle né su quelle dove l'auto può andare;
   - non atterrano davanti né dietro a un veicolo per come la camera vede la strada, così né il dado copre
     l'auto né l'auto copre il dado;
   - non atterrano tra le rocce;
   - i dadi di un'azione precedente tornano nel vassoio prima del primo tiro della scena nuova;
   - la camera tiene nell'inquadratura il punto di atterraggio.
   *Già nel gioco* (`rolls.ts`).
6. **Pannelli e scritte.** Il pannello del danno, il registro e le bolle dei giocatori seguono la scena:
   mostrano lo stato del fotogramma in corso, mai quello finale (`S.shownSnap`, già nel gioco).
7. **Salta scena.** Porta la scena in corso e tutte quelle in coda alla loro fine: veicoli nella posa
   finale, dadi fermi e mostrati, ultimo stato del tavolo.
8. **Velocità del giocatore.** Tutti i tempi delle scene si scalano con `beats.speed_scale`.
9. **Un solo padrone della camera.** Durante una scena muove la camera solo il director. Vista mappa,
   zoom su un'auto e replay chiedono la camera al director invece di muoverla per conto loro.

### B. Camera

1. **Parte libera dello schermo.** Il director misura i rettangoli dell'interfaccia: barra e bolle dei
   giocatori in alto, striscia del giocatore in basso, cassetto dei dadi, carte in mano, pannello dei
   danni e dei dadi quando è aperto. La parte libera è il rettangolo più grande che nessuno di questi
   copre. Viene misurata di nuovo ogni `refresh` secondi: se si apre un pannello, l'inquadratura si sposta
   accanto.
2. **Soggetti.** Ogni scena dichiara cosa si deve vedere, come sfere con un peso:
   - guida: il veicolo lungo tutto il percorso (il volume del piano di #36);
   - sparo: chi spara (1) e il bersaglio (2);
   - slam: la casella dell'urto con le sei attorno (dove un veicolo verrà spinto) e i dadi;
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
7. **Una ripresa per scena.** Lo stacco avviene tra una scena e l'altra, mai dentro una scena. Dentro la
   scena la ripresa si allarga per tenere soggetti nuovi, per esempio il punto dove atterra il dado.
8. **Soggetti che si muovono.** La posa si ricalcola a ogni fotogramma sui soggetti dove sono
   in quel momento (un'auto che vola, rotola o viene spinta), con la stessa candidata.
9. **Mano del giocatore.** Toccare o zoomare il tavolo durante una ripresa restituisce subito
   la vista. A fine evento la vista torna com'era.
10. **Quando non lavora.** Camera d'azione spenta, animazioni saltate, replay istantaneo.

## Formulas

**Durata di una scena**:
`T_scena = t_preparazione + Σ durate delle azioni in sequenza + max(durate delle azioni in parallelo) + hold`.
- `t_preparazione` è il tempo della camera per arrivare (`director.wait`), al più 1,2 s.
- Le durate dei movimenti vengono dal piano di #36; quelle dei dadi da `dice_throw.seconds`.

Esempio, uno slam: preparazione 0,6 + urto 0,5 + dado slam 1,05 + dado direzione 1,05 + spinta 0,6 + hold
0,8 = 4,6 s a velocità normale.

**Attesa di sicurezza**: ogni attesa finisce al più dopo `settle_max_s` (6 s), anche se qualcosa non si è
fermato.

**Proiezione di un punto** `p` per una camera in `pos` che guarda `look`, con assi `f` (avanti), `r` (destra),
`u` (su), campo verticale `fov` e rapporto `aspect`:
`depth = (p − pos)·f`, `x = (p − pos)·r / (depth · tan(fov/2) · aspect)`,
`y = (p − pos)·u / (depth · tan(fov/2))`. Lo schermo va da −1 a 1 su entrambi gli assi.

**Ingombro di una sfera** di raggio `R` sullo schermo: `±R / (depth · tan(fov/2))` in verticale, lo stesso
diviso `aspect` in orizzontale.

**Distanza della camera**:
- È la minima, cercata per bisezione fra `near` e 400, a cui il riquadro dei soggetti è largo al più
  `fill × larghezza libera` e alto al più `fill × altezza libera`.
- Poi il punto guardato si sposta di `(centro riquadro − centro libero) × depth × tan(fov/2)` lungo `r` e `u`.
- Il calcolo si ripete per sei passate.

**Linea di vista**:
- Si controllano 32 punti fra camera e soggetto.
- Un ostacolo è un cilindro di raggio `r` fra le altezze `y0` e `h`; interrompe la linea se uno dei punti
  cade dentro.
- Non conta un ostacolo più vicino al soggetto di `r + R`.

Esempio: sparo fra due auto a quattro caselle, finestra 1600 × 1000, parte libera alta 380 px. La
candidata "alle spalle" (yaw 28°, elev 22°, fill 0,8) porta le due auto a occupare l'80% della larghezza o
dell'altezza libera, quale delle due viene raggiunta prima.

## Edge Cases

- **Parte libera troppo piccola** (meno di un quarto della larghezza o del 15% dell'altezza
  della finestra): si usa la sola fascia fra barra e striscia, con i pannelli sopra l'immagine.
- **Nessuna candidata pulita**: vince comunque il voto più alto (la meno peggio).
- **Auto distrutta durante la ripresa**: il soggetto resta sull'oggetto che vola via.
- **Trappola rivelata**: è invalicabile ma è un buco, non conta come ostacolo.
- **Vista in soggettiva (chase)**: il director non cambia l'obiettivo di quella vista.
- **Qualcosa non si ferma mai**, per esempio un effetto senza fine: dopo `settle_max_s` la scena successiva
  parte lo stesso.
- **Una domanda al giocatore a metà scena**, per esempio un nuovo tiro o un'abilità: la scena si ferma
  sulla sua fase, con camera e dadi dove sono, e riprende dopo la risposta.
- **Tiro dei dadi a mano**: la scena si ferma prima del tiro finché il giocatore non tira.
- **Online**: ogni tavolo costruisce le stesse scene dagli stessi fotogrammi; un giocatore che rientra
  salta a fine coda.

## Dependencies

- **Rules Core (#1)**: solo lettura dei `Frame` e del terreno.
- **Movimento dei veicoli (#36)**: il director gli dà i comandi e ne legge piano, stato, momenti salienti
  e volumi.
- **Dice Presentation (#20)**: tiri e atterraggi dei dadi d'effetto dentro le scene (`rolls.ts`).
- **Player Panels (#21)**: bolle, cruscotti e pannello del danno seguono il fotogramma in corso.
- **Table Renderer 3D (#19)**: scena, ostacoli, rocce.
- **Codice**:
  - `src/view/camera/framing.ts`: il calcolo della camera, puro;
  - `src/app/shots.ts`: soggetti dagli eventi, rettangoli dell'interfaccia, ostacoli dal tavolo;
  - `src/app/director.ts`: muove la camera;
  - `src/app/beats.ts` e `loop.ts`: la coda dei fotogrammi, che diventerà la coda delle scene.
- **Dati**: `data/trv/presentation_base.json`, blocchi `director`, `beats` e, in futuro, `scenes`.

## Tuning Knobs

Tutti in `data/trv/presentation_base.json`:

| Blocco | Valori | Intervallo sicuro | Cosa cambia |
|---|---|---|---|
| `director` | `hold`, `refresh`, `floor`, `wait`, `subject.*`, `blocker.*`, `shots.<evento>[]` | `hold` 0,3–1,5 s | tempo di lettura, inquadrature |
| `beats` | `seconds.<kind>`, `speed_scale`, `settle_max_s` | `settle_max_s` 3–10 s | durata minima dei passi, velocità, attesa di sicurezza |
| `dice_throw` | `same_action`, `farthest`, `clear` | `same_action` 1–3 caselle; `clear` [0,4–1, 1–2] | quando un tiro è un'azione nuova, quanto lontano può cadere un dado, distanza dai veicoli |
| `scenes` | `takes`, `push_moves`, `alone_dice`, `alone_logs`, `prep`, `hold.<tipo>` | `hold` 0,3–1,5 s; `prep` 0,3–1,2 s | come si formano le scene e quanto restano a schermo |

I pesi del voto della camera sono in `framing.ts` (`SCORE`, `LOOM`).

## Acceptance Criteria

- [x] I soggetti di ogni ripresa stanno nella parte libera dello schermo e la riempiono per la
      quota chiesta (test: *keeps every subject inside the free band…*, *centres the subjects…*).
- [x] Con un pannello al centro la parte libera è accanto al pannello (test: *goes beside a panel…*).
- [x] Una candidata coperta da un muro perde contro una che vede sopra (test: *leaves a shot that a wall hides…*).
- [x] Dadi in primo piano fanno preferire un'inquadratura che li tiene piccoli (test: *leaves a low shot with dice looming…*).
- [x] A parità, vince la prima candidata della lista, dal lato del giocatore.
- [x] Un passo non parte finché l'animazione del precedente non è finita (verifica nel browser, 2026-11-19).
- [x] I dadi d'effetto atterrano accanto all'azione, non davanti né dietro un veicolo (verifica nel browser
      su uno slam, 2026-11-19).
- [ ] Ogni tipo di scena (guida, slam, sparo, salto, danno, eliminazione, missili, verme) si vede da inizio a
      fine senza sovrapposizioni (registrazioni nel browser, una per tipo).
- [ ] Nessuno stacco di camera dentro una scena (verifica sulle registrazioni).
- [ ] Bolle e pannelli non mostrano mai qualcosa prima del suo fotogramma (test unitario sugli `snap`, già
      presente).
- [ ] Giudizio dell'utente in partita: ogni evento si capisce senza toccare la vista.

## Piano di lavoro

L'ordine di integrazione con #25 e #37, il veicolo di collaudo e il banco prova sono nel
[piano di integrazione](../../docs/piano-integrazione-veicoli.md).

1. **Fatto** (2026-11-19): un passo alla volta, dadi accanto all'azione, pannelli che seguono il fotogramma.
2. **Coda delle scene**: raggruppare i fotogrammi in scene con le regole del §A.1 e dare a ogni scena le sue
   fasi (preparazione, azione, chiusura). *Fatto sul banco* (2026-11-19, `src/app/scenes.ts`), provato su
   sequenze vere del motore; nel gioco con la fase 6 del piano di integrazione.
3. **Comandi al Movimento dei veicoli (#36)**: piani con durate e momenti salienti, gli effetti agganciati
   ai momenti. *Fatto sul banco* (scenario S13).
4. **Un solo padrone della camera**: vista mappa, zoom e replay passano dal director. *Fatto il modulo*
   (`src/app/camera-owner.ts`) e usato sul banco; vista mappa, zoom e replay lo useranno con la fase 6.
5. **Registrazioni di prova** per ogni tipo di scena, giudicate dall'utente.

## Non ancora fatto

- Dissolvenza di rocce e veicoli che coprono: oggi il director li evita scegliendo un'altra candidata, e
  nasconde solo gli elicotteri.
- Carrellate e avvicinamenti durante la ripresa (c'è solo il giro lento sull'incendio).
- Il replay istantaneo usa ancora le sue inquadrature.
