# Piano di integrazione: Director, Movimento dei veicoli, Modelli strutturati

**Stato:** approvato dall'utente (2026-11-19). Fatte le fasi 0–3 (2026-11-19): descrittore delle
parti (`src/view/vehicle-rig.ts`), auto di collaudo e banco prova (`bench.html`), nucleo del movimento
(`src/app/motion/`: piano, stato, guida, salto, fermo vero), assetto e parti (sospensioni sul terreno,
altezza di marcia, mira, sparo e rinculo), con gli scenari S1–S5 e S10 sul banco. Fatta la fase 4 (2026-11-19): spinta, urto, sbandata,
ribaltamento, caduta (`moves.ts`), schianto per parti (`crash.ts`), traino dei rimorchi (`hitch.ts`),
inclinazione della moto; moto e Big Rig di collaudo con le loro schede; scenari S6–S9, S11 e S12 sul banco.
Fatta la fase 5 (2026-11-19): la coda delle scene (`src/app/scenes.ts`: raggruppamento, fasi, attesa del
fermo vero, "Salta scena") e il padrone unico della camera (`src/app/camera-owner.ts`), provati su sequenze
vere del motore; sul banco S13 (slam con il director, una ripresa per scena) e S14 (salta scena).
Fatta la fase 6 (2026-11-19), in attesa del giudizio dell'utente: opzioni "Movimento nuovo" e "Auto di
collaudo" (`src/app/scenePlayer.ts` gioca i fotogrammi come scene; spente, il gioco usa la coda di oggi);
test Playwright su una partita Carnage registrata; tempo per fotogramma misurato; video di ogni tipo di scena.

**Sistemi:**
- #25 Director ([camera-director.md](../design/gdd/camera-director.md));
- #36 Movimento dei veicoli ([vehicle-motion.md](../design/gdd/vehicle-motion.md));
- #37 Modelli strutturati ([modelli-strutturati.md](../design/art/modelli-strutturati.md), §11.1).

## Idea

I tre sistemi si costruiscono e si provano **prima** di avere i modelli veri da Meshy. Per farlo serve un
veicolo di collaudo **completo**: modello in parti, fisica e animazioni, che rispetta lo stesso contratto
dei nomi dei modelli veri. Lo si prova su un **banco prova**, una pagina dedicata dove ogni movimento si
lancia, si rallenta e si misura. Quando tutto funziona sul collaudo:
- il gioco passa al sistema nuovo, dietro un'opzione;
- il pilota vero (l'Auto Media da Meshy) prende il posto del collaudo senza cambiare codice.

## I veicoli di collaudo

Sono costruiti **nel codice** con forme semplici (scatole, cilindri, toroidi), con colori diversi per ogni
parte, così nelle schermate si vede subito cosa si muove. Hanno la **stessa gerarchia di nomi** dei modelli
veri (§4 della specifica), quindi il caricatore li legge come leggerà un GLB. Uno script li può anche
esportare in GLB, per provare su di loro il controllo automatico e il montaggio in Blender.

| Veicolo | Parti | A cosa serve | Quando |
|---|---|---|---|
| **Auto di collaudo** | `body`; 2 assi; `susp_N{L,R}`, `steer_0{L,R}`, `wheel_N{L,R}`; `turret`, `gun`, `barrel`, `muzzle`; `seat_driver` e `seat_gunner` con un **manichino** a sagoma; `fx_exhaust_0`, `fx_smoke` | tutto: guida, assetto, sospensioni, sterzo, mira, rinculo, posti | fase 1 |
| **Moto di collaudo** | `body`, `fork` con ruota anteriore, ruota posteriore, sospensioni; `seat_rider`, `grip_L`, `grip_R`, `foot_L`, `foot_R` | inclinazione in curva, forcella, pilota | fase 4 |
| **Rig di collaudo** | motrice (2 assi, uno sterzante, `launcher`), rimorchio centrale e posteriore con `hitch_front` e `hitch_rear` | traino e cerniere, arrivo in obliquo, lanciamissili | fase 4 |

Ogni veicolo di collaudo ha la sua **scheda di montaggio** (§9 della specifica), con le misure vere:
raggi, corse delle sospensioni, archi della torretta. Così si prova anche il percorso dei dati.

## Il banco prova

Una pagina `bench.html`, solo nella versione di sviluppo e nel pannello admin, con:
- **un tavolo di prova**: una tessera con strada, una rampa, una buca, rocce, fango, sabbia, melma; gli
  stessi terreni del gioco;
- **l'elenco degli scenari** (tabella sotto), ognuno con un pulsante;
- **comandi di riproduzione**: velocità 1×, 0,25× e 0,1×, pausa, avanti di un fotogramma, ricomincia;
- **sovrapposizioni di controllo**, attivabili una per una:
  - la traiettoria con i momenti salienti;
  - le molle (barre di beccheggio, rollio, ogni sospensione);
  - i punti di contatto delle ruote;
  - il volume per la camera;
  - lo stato del comando (`pianificato`, `in corso`, `finito`) e il "fermo vero";
- **una linea del tempo** della scena: durata prevista dal piano contro durata reale, momenti salienti,
  effetti agganciati;
- **la camera**: libera, oppure con il director che inquadra la scena.

### Scenari

| # | Scenario | Cosa si controlla |
|---|---|---|
| S1 | Rettilineo di 3 caselle | partenza e arrivo allineati, accelerazione e frenata, ruote che girano in proporzione |
| S2 | Cambio di corsia e zigzag | sterzo che anticipa la curva, rollio, traiettoria che taglia gli angoli |
| S3 | Curva stretta a velocità alta | frenata per l'aderenza, nessuno scatto |
| S4 | Terreno misto (fango, sabbia, buca, roccia vicina) | sospensioni sul terreno, particelle per terreno |
| S5 | Salto da rampa (1–4 caselle, con acrobazie) | stacco, arco, atterraggio con compressione |
| S6 | Slam: urto e spinta | chi colpisce beccheggia, lo spinto sobbalza e scivola; dadi accanto all'azione |
| S7 | Sbandata e Stordito | testacoda parziale, riallineamento |
| S8 | Fuori uso | ribaltamento, ruote a vuoto, fumo |
| S9 | Schianto | i pezzi partono dalle parti vere; mucchio con fiamme |
| S10 | Sparo | torretta e alzo verso il bersaglio, rinculo, effetto dalla `muzzle` |
| S11 | Moto: slalom | inclinazione entro `lean_max`, pilota con mani e piedi a posto |
| S12 | Big Rig: curva e arrivo in obliquo | rimorchi sulle cerniere, nessuna compenetrazione |
| S13 | Scena completa di slam con il director | una scena alla volta, nessuno stacco dentro la scena |
| S14 | "Salta scena" a metà di ogni scenario | posa finale esatta, molle a zero |
| S15 | Modello vecchio, tutto d'un pezzo | ripiego: tutto come oggi |

## Fasi

Ogni fase finisce con codice provato e una cosa visibile, secondo l'accordo del processo leggero: si
alternano documenti e risultati che si vedono.

### Fase 0: fondamenta
- Tipi del **descrittore delle parti** e delle **capacità** (`src/view/vehicle-rig.ts`), con:
  - il costruttore dai nomi;
  - il costruttore dai tagli di oggi, come ripiego.
- Blocco `motion` in `presentation_base.json`; le costanti `RIG` e `BIKE` passano lì.
- **Test unitari**:
  - il descrittore di un albero di nodi finto ha tutte le parti dichiarate;
  - un modello vecchio dà le capacità ridotte;
  - una capacità dichiarata senza le sue parti è segnalata.

### Fase 1: auto di collaudo e banco prova
- L'auto di collaudo costruita nel codice, la sua scheda e l'esportazione in GLB.
- Il banco prova con il tavolo, la riproduzione rallentata e le sovrapposizioni.
- **Visibile**: l'auto di collaudo ferma sul banco, con le parti colorate e il manichino.

### Fase 2: il nucleo del movimento
- Il modulo `src/app/motion/` con comando, piano e stato. La guida (`route.ts`) e il salto passano lì
  senza cambiare aspetto.
- **Test unitari**:
  - la durata reale di un comando sta entro il 10% del piano;
  - l'arrivo coincide con lo `snap` entro 0,01;
  - partenza e arrivo sono allineati alla corsia, tranne il Big Rig;
  - il "fermo vero" arriva dopo la fine della traiettoria e mai prima.
- **Visibile**: gli scenari S1–S3 e S5 sul banco.

### Fase 3: l'assetto e le parti
- Molle per beccheggio e rollio, sospensioni per ruota sul terreno, sterzo, rotazione delle ruote, torretta
  e rinculo.
- **Test unitari**: la ruota gira di `ds / r`; lo sterzo ha il segno della curva che arriva; la sospensione
  resta nella corsa.
- **Visibile**: S4 e S10.

### Fase 4: gli altri movimenti e gli altri veicoli
- Spinta, urto, sbandata, ribaltamento, schianto per parti, caduta.
- Moto e Rig di collaudo.
- **Visibile**: S6–S9, S11, S12.

### Fase 5: il Director a scene
- La coda delle scene (raggruppamento, fasi, chiusura), i comandi a #36, gli effetti sui momenti salienti,
  un solo padrone della camera.
- **Test unitari**: il raggruppamento dei fotogrammi in scene su sequenze vere del motore, cioè lo slam a
  catena di p. 9 e uno sparo con danno.
- **Visibile**: S13 e S14.

### Fase 6: nel gioco
- Opzione "Movimento nuovo" nelle opzioni. Si gioca con i modelli di oggi tramite il ripiego, e con l'auto
  di collaudo al posto dell'Auto Media per chi la vuole provare.
- **Test di integrazione (Playwright)**:
  - una partita registrata con slam, sparo, salto ed eliminazione, giocata con il sistema nuovo;
  - in tutta la registrazione nessuna scena si sovrappone, cioè la linea del tempo ha intervalli separati;
  - le bolle non anticipano niente;
  - nessun errore in console.
- **Misure**: tempo per fotogramma con quattro squadre, contro il sistema di oggi.
- **Visibile**: registrazioni video di ogni tipo di scena, per il giudizio dell'utente.
- Quando l'utente approva, l'opzione diventa il comportamento normale e il codice vecchio si toglie.
- **Esito (2026-11-19)**:
  - opzioni in `index.html` (Opzioni), `settings.newMotion` e `settings.testCar`; il ripiego dei modelli
    di oggi resta `CarRig`; l'auto di collaudo usa `PartsRig`, con la torretta che segue la mira;
  - test in `tests/integration/game.spec.ts` ("Movimento nuovo: a recorded game…"): partita Carnage a tre
    squadre (seme `06…`); le scelte senza eventi si saltano, quelle con slam, sparo con danno, salto ed
    eliminazione si giocano come scene. Passa: intervalli separati, stato mostrato mai oltre l'ultimo
    fotogramma, nessun errore. Dura circa 11 minuti, perché Playwright disegna in software;
  - misura, 4 squadre, 20 scelte, Edge: vecchio 16,9 ms di media (p99 33,3 ms), nuovo 16,7 ms (p99 16,8 ms),
    entrambi a 60 fps. Le stesse scelte durano circa 2,8 volte di più col sistema nuovo (attesa del fermo
    vero e pause di lettura);
  - nella pagina, una mossa su un pericolo coperto chiede conferma: per questo la stessa sequenza di indici
    dà una partita diversa da quella del solo motore;
  - video e fotografie in `production/qa/evidence/trv-movimento-fase6-2026-11-19/`.

### Correzioni chieste dopo la fase 6 (2026-11-19)
Valgono per il sistema di oggi e per "Movimento nuovo".
- **Percorso perso nella partita dopo**: il segno "percorso inviato all'host" (`waypoints.ts`) ora vale
  solo per la partita in cui è stato messo. Test Playwright "Percorso mode still plans…".
- **Percorso col movimento nuovo**: le guide dello stesso veicolo accodate di seguito sono una scena
  sola (`SceneQueue.push`), così l'auto non si ferma a ogni casella.
- **Attacco dopo il dado**: lo sparo prende la mira (`effects.ts aimAt`), poi si tira il dado sparo,
  poi parte la raffica: a segno (scintille e pezzi del bersaglio, `debris`) o a vuoto (di lato, polvere).
  Il motore annota l'esito sul fotogramma del dado (`Frame.hit`) e il colpo automatico sullo sparo
  (`Frame.auto`); le regole non li leggono. Valori in `burst` (`presentation_base.json`).
- **Spostamenti non guidati**: ogni mossa non guidata dice la causa (`Frame.why`) e ha il suo movimento
  (`motion/moves.ts`): spinta di slam o bump (`push`), testacoda sull'olio (`spin`), scivolata di
  sbandata, gomme lisce, stordito (`slew`), scossa del terremoto (`quake`), decollo (`hop`).
- **Caposquadra online**: le mani si distribuiscono tutte prima (`Game.leaderHands`), ognuno vede le sue
  due plance e sceglie subito; la scelta aspetta dall'host il proprio turno (`Intent.leader`). In hot
  seat resta una scelta alla volta, perché lo schermo è uno.
- **Striscia dei giocatori**: le bolle sono una riga sottile (42 px invece di circa 160); il riquadro
  completo si apre sotto la riga al passaggio del mouse o al tocco (`bubbles.ts`).
- **Dritto alla meta e poi retromarcia**: una scelta senza fotogrammi (il dado strada rifiutato subito
  prima che venga chiesto uno sparo) ridisegnava il tavolo come lo hanno le regole mentre le mosse del
  percorso erano ancora in coda. Ora `playBeats` aggiorna solo l'HUD se qualcosa sta ancora andando
  (`beats.ts`). Test di regressione in `game.spec.ts`, visto fallire senza la correzione (0,52 indietro).

### Dopo la fase 6 (2026-11-20)
- **Movimento nuovo per tutti** (chiesto dall'utente: i video non bastavano a giudicare): l'opzione
  "Movimento nuovo" non c'è più, i fotogrammi si giocano sempre a scene (`scenePlayer.ts`). Solo il
  replay istantaneo usa ancora la coda di prima.
- **Big Rig vero**: i pezzi di Meshy (tre carrozzerie, ruota, lanciamissili) si montano nel gioco dalle
  schede `assets/big_rig/modelli/schede/big_rig_{front,mid,rear}.json`. Lo stesso costruttore delle
  auto di collaudo (`buildTestVehicle`) prende il modello di una parte quando la scheda ne dà il file
  (`source`) e dove metterlo (`mesh`: scala, mezzo giro, posizione). Le ruote sono copie di un solo
  modello, grandi quanto il raggio dell'asse. Il vecchio modello unico tagliato ai giunti non si usa più.
  - Le due mitragliatrici (stesso modello): una sul cofano della motrice, una sul tetto del rimorchio
    posteriore montata all'indietro (`facing` nella scheda: il suo zero e il suo arco sono verso dietro).
  - Mancano: il radar che gira, il portellone.
  - Il banco prova usa ancora il Big Rig di collaudo.

### Fase 7: il pilota vero
- L'Auto Media da Meshy, montata con la sua scheda (specifica §12), prende il posto dell'auto di collaudo.
- Gli stessi scenari e gli stessi test devono passare senza cambiare il codice del movimento.

**Esito (2026-11-20).** L'Avenger (carrozzeria, ruota, mitragliatrice da Meshy) è l'Auto Media del gioco,
montato dalla scheda `assets/base/modelli/schede/car_m.json` con `useSheetModel` (`pieces.ts`), lo stesso
montaggio del Big Rig. Il codice del movimento non è cambiato: ruote, sterzo, sospensioni e mira le muove
`PartsRig` come sull'auto di collaudo. L'opzione "Auto di collaudo" è tolta; l'auto di collaudo resta sul
banco prova.
- Solo le parti con zone colore (la carrozzeria) prendono il colore della squadra.
- I colpi partono dal `muzzle` del modello (`effects.ts`).
- Da fare rispetto al §12: lo script di Blender e l'esportazione in un solo GLB (oggi il montaggio avviene
  nel gioco, dai pezzi), i posti con il manichino, l'ADR del formato, e le altre auto (piccola e grande).

## Test: riepilogo

| Livello | Dove | Cosa |
|---|---|---|
| Unità | `tests/unit/motion/`, `tests/unit/view/vehicle-rig.test.ts`, `tests/unit/app/scenes.test.ts` | descrittore e ripiego; piani, durate, arrivi, fermo; molle, ruote, sterzo, sospensioni; raggruppamento in scene |
| Banco prova | `tests/integration/bench.spec.ts` | ogni scenario S1–S15 si avvia, arriva alla fine entro la durata del piano, senza errori; schermate salvate in `production/qa/evidence/` |
| Partita | `tests/integration/game.spec.ts` | partita con il movimento nuovo: scene senza sovrapposizioni, bolle che non anticipano |
| Prestazioni | banco prova, misura a mano | tempo per fotogramma con quattro squadre non peggiore di oggi |
| Giudizio | registrazioni video | l'utente guarda ogni tipo di scena e approva |

## Rischi

- **Prestazioni**: molle per ogni ruota e quattro squadre. *Mitigazione*: passi fissi, solo i veicoli che si
  muovono aggiornano le sospensioni, misura a ogni fase.
- **Due sistemi insieme durante il passaggio**. *Mitigazione*: l'opzione "Movimento nuovo" fino
  all'approvazione, poi il codice vecchio si toglie in una volta.
- **Il collaudo non somiglia ai modelli veri**. *Mitigazione*: misure prese da una scheda verosimile e
  pilota vero subito dopo la fase 6.
- **Test che dipendono dal tempo** (Playwright lento sotto carico). *Mitigazione*: i test misurano l'ordine
  e la separazione delle scene, non i secondi; i tempi si controllano nei test unitari, con un orologio finto.
