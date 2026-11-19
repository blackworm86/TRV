# Movimento e animazione dei veicoli

> **Status**: Bozza (2026-11-19), da rivedere con l'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-19
> **Implements Pillar**: P2 Ogni dado si spiega (ciò che succede in partita si deve vedere e capire)
> **Sistema**: #36 dell'indice. Dialoga con il Director (#25, [camera-director.md](camera-director.md)) e con i
> Modelli strutturati (#37, [modelli-strutturati.md](../art/modelli-strutturati.md)).

## Overview

È il sistema che muove i veicoli sul tavolo: auto, moto, Big Rig ed elicotteri, ma anche i relitti spinti
da uno slam. Riceve dal Director un **comando di movimento** per volta (guidare lungo un percorso,
saltare, essere spinto, schiantarsi, prendere fuoco, mirare e sparare) e lo esegue come in un gioco di
guida. Oggi questo lavoro è sparso in `cars.ts`, `route.ts`, `stunts.ts`, `wreckage.ts` e nei tagli dei
modelli; il sistema lo raccoglie in un unico posto.

- **Fisica finta e deterministica**: è cinematica, non a corpi rigidi. Ogni movimento ha un inizio, una
  fine e una durata che si conoscono prima di partire, così il Director può pianificare la scena.
- **Solo presentazione**: non legge e non cambia le regole. Dove finisce un veicolo lo decide il motore
  (`Frame.snap`); il sistema decide solo *come* ci arriva.
- **Lavora per parti**: muove carrozzeria, ruote, sospensioni, sterzo, torrette, cerniere del Big Rig e
  rotori attraverso l'interfaccia dei Modelli strutturati. Con un modello vecchio, tutto d'un pezzo,
  ripiega sui tagli di oggi.

## Player Fantasy

I veicoli sembrano miniature vive: partono con un'accelerazione, frenano prima di una curva stretta, si
piegano e affondano sulle sospensioni, le moto si inclinano, le ruote girano e sterzano, la torretta si
volta verso il bersaglio prima di sparare. Ogni urto si sente: chi viene colpito sobbalza e scivola, chi
atterra da un salto schiaccia le molle. Niente si muove "a scatti" o in modo innaturale, e niente si
muove mentre si guarda altro.

## Detailed Rules

### 1. Il comando di movimento

Il Director dà al sistema un comando alla volta per veicolo. Ogni comando dice:
- **chi**: il veicolo (`vehicleId`);
- **cosa**: uno dei tipi del §2;
- **dove**: posizioni e orientamenti di partenza e di arrivo, presi dagli `snap` dei fotogrammi;
- **quando**: un tempo di inizio, deciso dal Director.

Il sistema risponde subito con un **piano**:
- la durata prevista;
- i momenti salienti, per esempio "stacco dalla rampa", "impatto", "arrivo sulla casella N";
- un volume che contiene il veicolo per tutto il movimento, per l'inquadratura.

Il Director usa il piano per comporre la scena e per decidere quando inizia la successiva.

### 2. Tipi di movimento

| Tipo | Quando | Come si vede |
|---|---|---|
| **Guida** (`drive`) | uno o più `move` dello stesso veicolo, uno dopo l'altro | percorso a curva per i centri delle caselle con traiettoria che taglia gli angoli; profilo di velocità (accelera, frena prima delle curve per l'aderenza, rallenta all'arrivo); parte e arriva allineato alla corsia, tranne il Big Rig che può fermarsi in obliquo (oggi `route.ts`) |
| **Cambio di corsia sul posto** | uno spostamento laterale breve, senza avanzare | sterzata e controsterzata, con il corpo che rolla |
| **Salto** (`jump`) | rampa | rincorsa, stacco, volo ad arco con beccheggio, acrobazie (oggi `stunts.ts`), atterraggio con compressione delle sospensioni |
| **Spinta** (`push`) | slam: il veicolo spinto | sobbalzo all'impatto, scivolata di traverso con le ruote che non girano, rimbalzo sulle sospensioni |
| **Urto** (`hit`) | slam: chi colpisce | frenata brusca, beccheggio in avanti |
| **Sbandata** (`skid`) | danno Sbandata, Stordito | testacoda parziale, scivolata, riallineamento |
| **Fuori uso** (`flip`) | auto che diventa inoperabile | si ribalta sul tetto o sul fianco, ruote che girano a vuoto |
| **Schianto** (`crash`) | eliminazione | i pezzi si staccano dalle parti vere (ruote, portiere, torretta) e volano; resta il mucchio (oggi `wreckage.ts`) |
| **Caduta** (`fall`) | pit trap | si inclina sul bordo e cade |
| **Mira e sparo** (`aim`, `fire`) | sparo, missili | la torretta e la canna si voltano verso il bersaglio, poi rinculo; per il Big Rig il lanciamissili |
| **Al traino** (`tow`) | Big Rig | i rimorchi seguono la motrice piegandosi sulle cerniere (oggi `hitchTrains`, `rigchain.ts`) |
| **Fermo** (`idle`) | sempre, tra un comando e l'altro | motore acceso: lieve vibrazione; elicottero: rotori e oscillazione in volo |

### 3. Strati di movimento

Un veicolo si muove su tre strati, calcolati in quest'ordine a ogni fotogramma:
1. **Traiettoria**: dove sta il veicolo e dove punta il muso. Viene dal comando: percorso, arco del salto,
   scivolata.
2. **Assetto del corpo**: beccheggio, rollio, affondamento. Viene da molle smorzate (oggi `CarRig`), mosse
   dall'accelerazione e dalla curva della traiettoria e dal terreno sotto le ruote. Per le moto anche
   l'inclinazione in curva.
3. **Parti**: rotazione delle ruote secondo la strada percorsa, sterzo secondo la curva che arriva,
   sospensioni di ogni ruota che seguono il terreno (rampe, buche, rocce), torretta e canna, rotori,
   cerniere.

Gli strati 2 e 3 non cambiano mai la posizione sul tavolo: il veicolo arriva esattamente dove dice lo `snap`.

### 4. Il dialogo con i Modelli strutturati (#37)

- Il caricatore dei modelli (`src/view/vehicle-rig.ts`, previsto in [modelli-strutturati.md](../art/modelli-strutturati.md) §11)
  consegna al sistema un **descrittore di parti**:
  - il nodo della carrozzeria;
  - per ogni ruota il perno, lo sterzo e la sospensione, con raggio e corsa;
  - torrette, canne e bocche di fuoco (`muzzle`);
  - cerniere (`hitch_*`), rotori e prese degli effetti (`fx_*`);
  - posti dell'equipaggio (`seat_*`).
- Insieme al descrittore arrivano le **capacità** del modello, per esempio "ha sospensioni", "ha torretta",
  "ha sterzo".
- Il sistema anima solo ciò che il modello ha. Per esempio, un modello senza sospensioni muove il corpo
  intero e non le singole ruote.
- **Ripiego per i modelli vecchi**: se il modello non ha la gerarchia dei nomi, il descrittore si costruisce
  con i tagli di oggi (`WHEELS`, `GUNS`, `CHOPPER_PARTS` in `models-config.ts`), con le capacità ridotte.
- I pezzi che volano via in uno schianto sono le parti del descrittore. Con un modello vecchio sono i
  tagli a griglia di oggi.
- **L'equipaggio** (più avanti) legge dal sistema lo stato delle parti, cioè sterzo e mira, per muovere le
  mani sul volante e sull'arma.

### 5. Il dialogo con il Director (#25)

- **Il Director chiede e il sistema esegue**: il sistema non fa mai partire un movimento da solo. L'unica
  eccezione è il **Fermo**, che non sposta niente.
- **Il sistema dice quando ha finito**:
  - per ogni comando espone lo stato: `pianificato`, `in corso` o `finito`;
  - a ogni momento saliente del piano, per esempio l'impatto, avvisa il Director, che fa partire nello
    stesso istante l'effetto legato (scintille, scritta, dado);
  - per tutto il movimento, il Director legge da qui posizione e volume del veicolo per tenerlo
    nell'inquadratura.
- **Fermo vero**: un veicolo è "fermo" quando la traiettoria è finita e le molle sono tornate a riposo sotto
  una soglia. Il Director aspetta questo stato prima della scena successiva (una scena alla volta).

### 6. Velocità del giocatore

- La velocità scelta dal giocatore nelle opzioni (`beats.speed_scale`) scala tutte le durate allo stesso
  modo.
- "Salta scena" porta ogni comando alla sua fine, nella posa finale, e azzera le molle.

## Formulas

**Profilo di velocità lungo il percorso** (oggi `route.ts`). Variabili:
- `κ`: curvatura in un punto (1/unità di mondo);
- `grip`: aderenza laterale (unità/s²);
- `top`: velocità massima;
- `crawl`: velocità di partenza e arrivo;
- `accel`, `brake`: accelerazione e frenata (unità/s²);
- `ds`: passo lungo il percorso.

`v_curva = min(top, √(grip / κ))`, poi `v[i] = min(v[i], √(v[i−1]² + 2·accel·ds))` in avanti e
`v[i] = min(v[i], √(v[i+1]² + 2·brake·ds))` all'indietro.

Esempio con `grip` 9 e una curva di raggio 0,5 (`κ` = 2): `v` = √4,5 ≈ 2,1 unità/s, sotto `top` 6,5.

**Inclinazione della moto in curva**: `lean = clamp(atan(v²·κ / g_lean), −lean_max, +lean_max)`, con
`g_lean` la "gravità" del gioco per l'inclinazione (da tarare) e `lean_max` intorno a 0,6 rad.
Esempio: v = 3, κ = 1, `g_lean` = 9,8 dà atan(0,92) ≈ 0,74 rad, limitato a 0,6.

**Molla dell'assetto** (beccheggio, rollio, sospensioni): `a = −k·x − c·ẋ + f(t)`, con:
- `k`: rigidità;
- `c`: smorzamento;
- `f`: la spinta dall'accelerazione o dal terreno.

Si integra a passi piccoli di al più 1/120 s, come oggi in `CarRig`. Smorzamento critico: `c = 2√k`.
Si usa `c` tra 0,6 e 1,0 volte quel valore, per un rimbalzo appena visibile.

**Sospensione di una ruota**: `y_ruota = clamp(h_terreno(x, z) − y_corpo, −corsa, +corsa)`. Il corpo si
appoggia sulla media delle ruote dello stesso asse (beccheggio) e dello stesso lato (rollio).

**Rotazione della ruota**: `Δθ = ds / r_ruota` per fotogramma.

**Durata di un comando**, usata dal piano:
- guida: integrale di `ds / v` lungo il percorso;
- salto: `climb + volo + land`, come oggi `jumpSeconds`;
- spinta: `distanza / v_spinta + riassetto`.

**Fermo**: traiettoria finita e, per ogni molla, `|x| < ε_x` e `|ẋ| < ε_v`.

## Edge Cases

- **Comando nuovo mentre uno è in corso sullo stesso veicolo**: non succede, perché il Director ne dà uno
  per scena. Se succede, per esempio dopo un errore, il primo salta alla sua posa finale e il nuovo parte da lì.
- **"Salta scena"**: tutti i comandi vanno alla posa finale e le molle si azzerano.
- **Il veicolo è eliminato mentre si muove**, per esempio spinto fuori strada: la spinta arriva al bordo,
  poi parte lo schianto o la caduta, sempre come comandi del Director.
- **Modello non ancora caricato**: il comando si esegue sul segnaposto, con le stesse durate; le parti
  arrivano col modello.
- **Big Rig**: la motrice guida e i rimorchi seguono le cerniere; il "fermo" vale per tutti i pezzi. Può
  fermarsi in obliquo.
- **Moto ribaltata o fuori uso**: niente inclinazione, ruote ferme.
- **Terreno senza altezza nota**, per esempio fuori dal tavolo: le sospensioni restano a riposo.
- **Tab nascosto o fotogramma lentissimo**: il passo si spezza in fette da 1/120 s, al più 0,25 s per
  fotogramma (come oggi); oltre si salta alla posa del tempo attuale.
- **Online**: tutti i client ricevono gli stessi fotogrammi, quindi tutti fanno gli stessi comandi. Le
  piccole differenze di animazione, come il caso nei pezzi che volano, non contano, perché le regole non
  le leggono.

## Dependencies

- **Rules Core (#1)**: legge solo i `Frame` e i loro `snap`; non li modifica.
- **Director (#25)**: gli dà i comandi, ne riceve piano, stato e momenti salienti; deve citare questo
  sistema tra le sue dipendenze.
- **Modelli strutturati (#37)**: gli fornisce il descrittore delle parti e le capacità; deve citare questo
  sistema come consumatore dei nomi.
- **Table Renderer 3D (#19)**: la scena three.js e il terreno (altezze per le sospensioni).
- **Terrain (#3)**: le altezze del terreno e le rampe.
- **Effetti** (`effects.ts`, `trail.ts`): leggono velocità e terreno sotto le ruote per polvere, fango e
  fiamme.

## Tuning Knobs

Tutti in `data/trv/presentation_base.json`:

| Blocco | Valori | Intervallo sicuro | Cosa cambia |
|---|---|---|---|
| `route` | `top`, `accel`, `brake`, `grip`, `crawl`, `tangent`, `smooth` | `top` 3–10; `grip` 4–20; `smooth` 0–0,6 | velocità e naturalezza della guida; con `smooth` alto si tagliano di più gli angoli |
| `drive` | `speed`, `turn_rate`, `park_turn_rate`, `max_yaw` | ±50% dei valori attuali | movimento fuori dai percorsi |
| `jump` | arco, tempi, acrobazie | come oggi | salti |
| `motion` (nuovo) | `spring` (k, c per beccheggio, rollio, sospensioni), `lean_max`, `g_lean`, `push_speed`, `settle_eps` | `lean_max` 0,3–0,8 rad; `settle_eps` 0,002–0,02 | assetto, inclinazione delle moto, spinte, quando un veicolo conta come fermo |

Le costanti oggi scritte nel codice (`RIG`, `BIKE` in `cars.ts` e `models-config.ts`) vanno spostate in
`motion`.

## Acceptance Criteria

- [ ] Ogni comando restituisce un piano con una durata; il movimento reale finisce entro il 10% di quella
      durata (test unitario sul piano, verifica nel browser).
- [ ] Il veicolo arriva sempre esattamente sulla posizione e sull'orientamento dello `snap`, con tolleranza
      0,01 unità (test unitario).
- [ ] Auto e moto partono e arrivano allineate alla corsia; il Big Rig può arrivare in obliquo (test
      unitario, già in `route.test.ts`).
- [ ] Le ruote girano in proporzione alla strada fatta e sterzano verso la curva che arriva; con un modello
      a parti, le sospensioni seguono il terreno (verifica nel browser con schermate).
- [ ] La moto si inclina in curva entro `lean_max` e si raddrizza in rettilineo (verifica nel browser).
- [ ] In uno slam il veicolo spinto sobbalza e scivola; chi colpisce beccheggia (verifica nel browser).
- [ ] Il Director non fa partire una scena prima che i veicoli della precedente siano fermi (verifica: in
      una registrazione nessun movimento si sovrappone).
- [ ] Con un modello vecchio, tutto d'un pezzo, tutto funziona come oggi (ripiego).
- [ ] Nessun calo di fotogrammi con quattro squadre rispetto a oggi.

## Piano di lavoro

L'ordine di integrazione con #25 e #37, il veicolo di collaudo e il banco prova sono nel
[piano di integrazione](../../docs/piano-integrazione-veicoli.md).

1. **Raccogliere**: un modulo `src/app/motion/` con il comando, il piano e lo stato. `cars.ts`, `route.ts`
   e `stunts.ts` diventano i suoi tipi di movimento, senza cambiare l'aspetto. I valori del codice passano
   in `motion`.
2. **Dialogo con il Director**: il Director dà i comandi e aspetta il "fermo vero" (oggi aspetta
   `settled()` per tutto il tavolo).
3. **Nuovi movimenti**: spinta, urto e sbandata come movimenti propri (oggi sono spostamenti generici),
   inclinazione delle moto rivista.
4. **Parti**: il descrittore dal caricatore dei Modelli strutturati, con le ruote e le sospensioni del
   pilota (Auto Media).
5. **Schianto per parti**, quando ci sono i modelli a parti.
