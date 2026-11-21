# Modelli strutturati: veicoli con parti mobili ed equipaggio

> **Status**: Approvata dall'utente il 2026-11-21 (fase A chiusa)
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-21
> **Revisione del 2026-11-21** (richiesta dell'utente dopo la pausa della moto): aggiunti il §4.2
> (parti mobili veicolo per veicolo), il §7.1 (vernice neutra e usura), il §8.2 (livelli di dettaglio per prestazioni e leggibilità) e i capitoli 15-22 su misure, dima, collaudo dimensionale, rigging, animazioni dell'equipaggio, scheda di produzione
> con i prompt e ruoli. Dove i capitoli 1-14 dicono altro, **valgono i capitoli 15-22**; i punti
> cambiati sono segnati con "(rivisto il 2026-11-21)".
> **Richiesta dell'utente (2026-11-19)**:
> - modelli più strutturati, con parti mobili (ruote indipendenti, sospensioni, torrette, armi), per
>   animazioni più complete e realistiche;
> - continuare a generarli con Gemini e Meshy, con una struttura di lavoro e software più precisa;
> - prevedere **piloti ed equipaggio animati a bordo**, con modelli generati proceduralmente, che si
>   muovono, guidano e usano le armi;
> - tenere in programma "paint your models".
>
> **Si collega a**: `design/art/art-bible.md` (§3.4-3.6 sagome, §5 personaggi), `data/trv/modelli/` (regole e schede di produzione),
> `src/view/models-config.ts`, `src/view/models3d.ts`, `src/view/rigmodel.ts`, ADR-0005 (fotogrammi e regia).

---

## 1. Da dove partiamo

**Come sono fatti oggi.** I 13 modelli del gioco arrivano da Meshy tutti nello stesso modo. Sono tre
auto, elicottero, cinque relitti, moto, Big Rig, rampa e verme, e hanno:
- **un solo nodo e una sola mesh** (`geometry_0`);
- **una sola texture**;
- circa **5.000 triangoli** (Big Rig e verme circa 15.000).

**Come si muovono le parti.** Il gioco ricava le parti mobili **tagliando i triangoli** dentro volumi
scritti a mano in `models-config.ts`:

| Costante | Cosa taglia |
|---|---|
| `WHEELS` | un cilindro per ogni ruota |
| `GUNS` | un riquadro per l'arma |
| `CHOPPER_PARTS` | i rotori |
| `BIG_RIG.pins` | i piani di taglio tra le sezioni |

**I limiti di questo metodo.**

| Problema | Effetto |
|---|---|
| Una parte tagliata non ha retro | dietro una ruota o sotto la torretta resta un buco, che si vede appena la parte si muove molto |
| I perni sono stimati a occhio | ogni modello nuovo va rimisurato a mano, e un errore fa "ballare" la ruota |
| Ciò che è fuso nel blocco non si separa | sospensioni, canne, sportelli, piloti e meccanica restano attaccati alla carrozzeria |
| Il colore della squadra va solo sulle parti chiare | c'è una sola zona colore, legata alla texture: "paint your models" avrebbe poco margine |
| Il pilota della moto è fuso nel modello | non si può né animare né togliere |

### 1.1 Cosa è successo dal 19 al 21 novembre

- **Auto Media, piccola e grande, Big Rig**: montate nel gioco dai pezzi di Meshy, con le schede del §9.
  Funzionano ruote, sterzo, sospensioni e mira. Mancano ancora lo script di Blender, i posti con il
  manichino e l'ADR del formato.
- **Moto con il pilota**: messa in pausa dall'utente il 2026-11-20. Il pilota sedeva male, compenetrava
  la moto e piegava le articolazioni in versi innaturali. Il lavoro è sul ramo locale `moto-in-pausa`.
- **Perché è andata così**:

  | Causa | Dove si vede | Rimedio |
  |---|---|---|
  | Le misure si prendono **dopo** Meshy, non prima | le note delle schede: "misure prese sui modelli" | la dima, prima di generare (§17) |
  | Nessuna misura standard della persona | il pilota aveva misure sue, decise nel codice (`rider` in `presentation_base.json`) | la figura standard (§15) |
  | Nessun limite alle articolazioni | la cinematica inversa piegava gomiti e ginocchia dove serviva | limiti e versi delle articolazioni (§15.3) |
  | Nessun controllo dei posti | il criterio "manichino seduto" del §12 non è mai stato provato | collaudo dimensionale, obbligatorio (§18) |
  | Ogni veicolo ha la sua scala sul tavolo | una persona è alta 11 mm sull'auto piccola e 19 mm sulla moto | una scala sola per tutti (§16.2) |
  | I prompt stanno in cinque file con strutture diverse | `design/art/*-prompts.md` | scheda di produzione (§20) |

## 2. Obiettivi

1. **Parti vere**, ciascuna con il suo perno e il suo asse, nominate secondo un contratto fisso. Il gioco
   le trova per nome e non taglia più nulla.
2. **Posti per l'equipaggio** su ogni veicolo: sedili, punti per mani e piedi (volante, manubrio,
   impugnature delle armi), abitacolo vuoto. Un equipaggio procedurale può così salire, guidare e sparare
   senza che il veicolo vada modificato.
3. **Zone colore separate**: per il colore della squadra oggi, per "paint your models" domani.
4. **Gli stessi strumenti per tutti i modelli**:
   - Gemini per i concept;
   - Meshy per il 3D;
   - Blender per il montaggio (già installato: Blender 5.0);
   - un controllo automatico prima che un modello entri nel gioco.
5. **Si procede per gradi.** I modelli vecchi continuano a funzionare con i tagli finché non vengono
   sostituiti, uno alla volta.

## 3. Convenzioni comuni

| Cosa | Regola | Perché |
|---|---|---|
| Unità | **metri, a scala reale** (un'auto media circa 4,5 m, una persona circa 1,75 m) | l'equipaggio procedurale ha proporzioni umane: solo a scala reale lo stesso pilota va bene sui sedili di ogni veicolo. Poi il gioco scala tutto alla lunghezza sul tavolo (`SHOW_LENGTH_MM`), come oggi |
| Assi | **Y in alto, muso verso +X**, lato sinistro del veicolo verso −Z | +X è la direzione di marcia del gioco: `MODEL_YAW` non serve più |
| Origine | al centro dell'impronta, a terra (Y = 0 dove le gomme toccano il suolo) | il pezzo si appoggia sulla casella senza correzioni |
| Formato | GLB (glTF 2.0), un veicolo per file, con **gerarchia di nodi** | three.js lo legge così com'è |
| Dati extra | proprietà personalizzate di Blender, esportate come `extras` glTF | assi, limiti e ruoli si leggono direttamente dal file |
| Lati | `L` sinistra, `R` destra, `C` centro | — |
| Assi delle ruote | numerati dal davanti: `0`, `1`, `2`… | l'auto grande ha tre assi, il Big Rig otto |

## 4. Il contratto dei nomi (gerarchia)

Ci sono due tipi di nodo:
- il **perno**: un nodo vuoto con l'**origine sul punto di rotazione** e gli assi orientati come dice la
  tabella §4.1;
- la **mesh** (`*_mesh`), appesa sotto il suo perno.

Il gioco muove solo i perni.

```
vehicle                      radice: impronta a terra, muso verso +X
├─ body                      carrozzeria e telaio (zone colore, §7)
│  ├─ body_mesh
│  ├─ cockpit                abitacolo (cockpit_mesh: sedili, cruscotto)
│  │  ├─ seat_driver         posto del pilota (§5)
│  │  └─ steering_wheel      volante, ruota su X locale
│  │     ├─ grip_L           punto per la mano sinistra
│  │     └─ grip_R
│  ├─ turret                 ruota su Y (mira orizzontale)
│  │  ├─ turret_mesh
│  │  ├─ seat_gunner         posto dell'artigliere, se l'arma è manuale
│  │  └─ gun                 ruota su Z (alzo)
│  │     ├─ gun_mesh
│  │     ├─ grip_L, grip_R   impugnature
│  │     └─ barrel           rinculo: trasla su −X
│  │        └─ muzzle        presa per fiammata e proiettili
│  ├─ fx_exhaust_0           prese degli effetti (§6)
│  └─ fx_smoke
└─ axle_0                    asse anteriore, fisso rispetto al telaio
   ├─ susp_0L                sospensione: trasla su Y tra due limiti
   │  └─ steer_0L            sterzo: ruota su Y (solo assi sterzanti)
   │     └─ wheel_0L         rotolamento: ruota su Z
   │        └─ wheel_0L_mesh
   └─ susp_0R → steer_0R → wheel_0R
```

Gli `axle_*` sono figli della radice, non di `body`. Così la carrozzeria può beccheggiare e rollare sulle
molle mentre le ruote restano a terra (oggi lo fa `CarRig` a mano).

### 4.1 Ruoli dei nodi

| Nome | Movimento | Asse locale | Dati (`extras`) | Obbligatorio per |
|---|---|---|---|---|
| `body` | beccheggio e rollio sulle molle | — | `mass` (relativa) | tutti i veicoli |
| `axle_N` | nessuno (riferimento) | — | `steer: bool`, `drive: bool` | veicoli a ruote |
| `susp_N{L,R}` | traslazione verticale | Y | `travel: [min, max]` in m | veicoli a ruote |
| `steer_N{L,R}` | rotazione | Y | `max: rad` | assi sterzanti |
| `wheel_N{L,R}` | rotolamento | Z | `radius` in m | veicoli a ruote |
| `turret` | rotazione | Y | `arc: [min, max]` rad, `speed` | armi su torretta |
| `gun` | alzo | Z | `elev: [min, max]` rad | armi |
| `barrel` | rinculo | −X | `kick` in m | armi |
| `muzzle` | presa | +X = direzione del colpo | `weapon` (id) | armi |
| `rotor_main`, `rotor_tail` | rotazione continua | Y / Z | `speed` | elicottero |
| `fork` | sterzo della moto | asse del cannotto | `max` | moto |
| `lean` | piega della moto | X, sulla linea di contatto a terra | `max: rad` | moto |
| `swingarm` | sospensione posteriore della moto | Z | `travel: [min, max]` rad | moto |
| `hitch_front`, `hitch_rear` | snodo tra le sezioni | Y (e poco Z) | limiti `yaw`, `pitch` | Big Rig |
| `door_*`, `hatch_*` | apertura | asse del cardine | `open: rad` | facoltativi |
| `launcher` | come `turret` + `gun` | — | `tubes: n` | lanciamissili del Big Rig |

**I nomi vanno scritti esattamente così**: inglese, minuscole, `_`. Un nome sconosciuto viene ignorato
(parte decorativa); un nome obbligatorio che manca ferma il controllo (§10.2).

### 4.2 Le parti mobili, veicolo per veicolo (aggiunto il 2026-11-21)

Richiesta dell'utente (2026-11-21): la specifica deve garantire telaio, ruote indipendenti ammortizzate e
sterzanti, armi brandeggiabili in orizzontale e in verticale, e moto con lo sterzo anteriore vero, capaci
di derapare e di piegare nelle curve strette. Questa è la lista di ciò che **ogni modello deve avere per
essere accettato**; il controllo automatico (§10.2) e il collaudo (§18) la verificano.

**Pezzi da generare separati.** Una parte si muove bene solo se nasce come pezzo a sé: ciò che Meshy
consegna fuso non si separa senza buchi (§1).

| Veicolo | Pezzi separati obbligatori |
|---|---|
| Auto | telaio con carrozzeria (senza ruote, senza arma) · ruota · base dell'arma · arma |
| Moto | telaio con sella, serbatoio e motore · **avantreno** (forcella, manubrio, parafango anteriore, faro) · ruota · arma, se c'è |
| Big Rig | ogni sezione come un'auto, più il lanciamissili |
| Elicottero | fusoliera · rotore principale · rotore di coda · arma |

**Telaio (`body`)**
- È il pezzo a cui tutto il resto si aggancia: carrozzeria, abitacolo, sedili, base delle armi.
- Beccheggia e rolla sulle sospensioni mentre le ruote restano a terra.
- I passaruota sono vuoti e larghi abbastanza per la ruota a tutto sterzo e a fine corsa.

**Ruote delle auto: indipendenti, ammortizzate, sterzanti**

| Movimento | Nodo | Misura di partenza |
|---|---|---|
| Ogni ruota sale e scende per conto suo | `susp_N{L,R}` | corsa da −0,08 a +0,12 m (Eliminator e Big Rig: da −0,10 a +0,18) |
| Le ruote anteriori sterzano | `steer_N{L,R}` | fino a 32° per lato; la ruota interna sterza più dell'esterna |
| Ogni ruota rotola alla velocità del suolo sotto di lei | `wheel_N{L,R}` | dal raggio vero della ruota |

- Ogni ruota è un pezzo intero, con il lato interno modellato: a tutto sterzo si vede.
- Bracci e molle delle sospensioni, se si vedono, sono parti decorative del telaio: non si animano.

**Armi: mitragliatrici e cannoni brandeggiabili**

| Movimento | Nodo | Mitragliatrice | Cannone |
|---|---|---|---|
| Brandeggio orizzontale | `turret` (ruota su Y) | arco dalla scheda, fino a 360° | arco dalla scheda |
| Alzo verticale | `gun` (ruota su Z) | da −10° a +35° | da −5° a +25° |
| Rinculo | `barrel` (trasla su −X) | nessuno: espelle i bossoli (decisione dell'utente, 2026-11-20) | sì, `kick` dalla scheda |
| Bocca di fuoco | `muzzle` | da qui partono i colpi | da qui partono i colpi |

- **Due pezzi per ogni arma**: la base, che gira, e l'arma, che si alza sul suo perno in cima alla base.
  Niente più armi tagliate in due dopo (`tools/art/split_gun.py` serve solo ai modelli di oggi).
- L'arco e l'alzo si scelgono in modo che l'arma non attraversi mai il telaio né l'equipaggio.
- L'artigliere segue l'arma: il suo posto è figlio di `turret`, le sue mani dei `grip_*` di `gun`.

**Moto**

```
vehicle                    radice: la linea di contatto delle due gomme, muso verso +X
└─ lean                    piega: ruota su X, intorno alla linea di contatto a terra
   ├─ body                 telaio, sella, serbatoio, motore
   │  ├─ seat_rider, foot_L, foot_R
   │  ├─ fork              AVANTRENO: ruota intorno all'asse del cannotto
   │  │  ├─ fork_mesh      forcella, manubrio, parafango, faro
   │  │  ├─ grip_L, grip_R le manopole: girano con lo sterzo, e le mani con loro
   │  │  └─ susp_0         la forcella si accorcia: trasla lungo il cannotto
   │  │     └─ wheel_0     ruota anteriore
   │  └─ swingarm          forcellone: ruota su Z intorno al suo perno sul telaio
   │     └─ wheel_1        ruota posteriore
   └─ turret → gun         arma sul telaio, se c'è
```

| Movimento | Nodo | Misura di partenza |
|---|---|---|
| **Sterzo**: gira tutto l'avantreno, manubrio compreso, non la sola ruota | `fork` | fino a 35° per lato; cannotto inclinato all'indietro di 25° – 30° |
| Sospensione anteriore | `susp_0` | corsa 0,12 m |
| Sospensione posteriore | `swingarm` | ±8° intorno al perno |
| **Piega** in curva | `lean` | fino a 45°; nelle curve più strette fino a 50° |
| **Derapata** | la radice: il muso punta all'interno rispetto alla strada percorsa | fino a 30°, con controsterzo dell'avantreno |
| Impennata e salto | la radice: beccheggio intorno alla ruota posteriore | dal Movimento dei veicoli (#36) |

- **Niente tocca terra in piega**: a 50° di piega toccano il suolo solo le gomme. Pedane, scarico e
  motore stanno dentro questo limite; lo verifica il collaudo.
- **Il manubrio non urta nulla** a tutto sterzo: né il serbatoio né le ginocchia del pilota.
- **Il pilota piega con la moto e più di lei** (§19.3), e in derapata gira busto e testa verso la strada.
- Quanto piega e quanto derapa in ogni curva lo decide il Movimento dei veicoli (#36), dalla velocità
  e dal raggio della curva; qui si fissa solo ciò che il modello deve permettere.

## 5. Equipaggio a bordo

L'equipaggio vero arriverà dopo. Qui si fissa **cosa il veicolo deve offrire** perché un equipaggio
generato proceduralmente possa abitarlo senza rifare i veicoli.

### 5.1 Posti (`seat_*`)

Ogni posto è un nodo vuoto:
- l'**origine** è il punto del bacino della persona, seduta o in piedi;
- **+X** è la direzione in cui guarda;
- **+Y** è l'alto.

| Dato (`extras`) | Valori | A cosa serve |
|---|---|---|
| `role` | `driver`, `codriver`, `gunner`, `rider`, `pilot` | chi ci sta e cosa fa (il copilota siede accanto al pilota e non comanda nulla: guarda, indica, si tiene) |
| `pose` | `sit`, `stand`, `ride` (a cavalcioni), `lean` | la posa di base |
| `clear` | `[x, y, z]` m: spazio libero intorno al busto | l'equipaggio non compenetra il veicolo; il controllo lo verifica |
| `operates` | nome di un nodo (`steering_wheel`, `gun`, `fork`, `launcher`) | ciò che quel posto comanda: le mani vanno ai suoi `grip_*` |
| `visible` | `open`, `cage`, `closed` | abitacolo aperto, con gabbia o chiuso: decide se disegnare l'equipaggio |
| `exit` | nome di un `exit_*` | da dove scende o salta via (eliminazione, eiezione) |

### 5.2 Punti di contatto

Sono nodi vuoti, **figli della parte che si muove**: così seguono il volante che gira o l'arma che mira.

| Nome | Dove | Seguito da |
|---|---|---|
| `grip_L`, `grip_R` | volante, manubrio, impugnature dell'arma | le mani, con la cinematica inversa |
| `foot_L`, `foot_R` | pedali, pedane della moto | i piedi |
| `look` | dove guarda di solito chi siede lì (davanti, il mirino) | la testa |
| `exit_*` | un punto fuori dal veicolo, di lato o dietro | salto fuori, caduta, fuga |

### 5.3 Abitacolo

- Il veicolo si genera **senza persone a bordo**, con i sedili modellati e l'abitacolo vuoto.
- La moto si rigenera **senza pilota**. La decalcomania sulla schiena (`BIKE_BACK`) passerà sulla
  giacca del pilota procedurale.
- Lo spazio `clear` di ogni posto deve essere libero da geometria, gabbia compresa.
- L'abitacolo ha una mesh sua (`cockpit_mesh`), così si può disegnare a parte, per esempio nasconderlo
  quando la telecamera è lontana e l'equipaggio non si vede.

### 5.4 Cosa dovrà rispettare l'equipaggio procedurale (anticipo)

Il GDD dell'equipaggio verrà dopo, ma il veicolo dà già per scontati questi punti.

- **Scheletro umanoide con nomi fissi**: `hips`, `spine`, `chest`, `neck`, `head`, `upper_arm_L`,
  `lower_arm_L`, `hand_L`, `thigh_L`, `shin_L`, `foot_L`, e i simmetrici. Altezza intorno a 1,75 m.
  `hips` si aggancia al `seat_*`.
- **Mani e piedi seguono i punti di contatto** del posto, con una cinematica inversa a due ossa
  (braccio e avambraccio).
- **Scala sul tavolo**: un'auto media è lunga 33 mm, quindi una persona è alta circa 13 mm. È sempre
  visibile, ma nel dettaglio si vede solo nelle inquadrature ravvicinate del director: i livelli di
  dettaglio del §8.1 la alleggeriscono quando è piccola sullo schermo.
- **Stile: miniature dipinte** (decisione dell'utente, 2026-11-19). Lo stesso aspetto dei veicoli:
  post-apocalittico alla Mad Max, dipinto a mano, con usura, sabbia e ruggine. Generato
  proceduralmente vuol dire che **il corpo e le combinazioni** sono procedurali, non l'aspetto:
  - **corpo**: generato dal codice (altezza, corporatura, posa), con lo scheletro del punto sopra;
  - **pelle degli abiti**: un atlante di texture dipinte condiviso da tutti (pelle, tessuto, cuoio,
    metallo, carnagioni), preparato una volta con Gemini e ritoccato a mano;
  - **accessori**: un kit di pezzi piccoli generati con Gemini e Meshy, come i veicoli (caschi, maschere,
    occhialoni, spallacci, bandane, capelli). Si agganciano alle ossa (`head`, `chest`, `upper_arm_*`) e
    il codice li combina, così ogni persona è diversa;
  - **colore della squadra**: su una zona degli abiti (giacca, bandana o casco), con le stesse zone del §7
    (`crew_primary`, `crew_secondary`);
  - **livelli lontani** (E2-E3 del §8.1): niente texture, colori piatti presi dall'atlante, così da
    lontano restano leggibili.
- **Animazioni previste**, guidate dai fotogrammi delle regole (ADR-0005):
  - guida: sterzo, mani sul volante, corpo che si inclina in curva e negli urti;
  - sparo: mira con la torretta e rinculo;
  - colpo subito: scossone;
  - slam: urto in avanti o di lato;
  - salto della rampa;
  - fuori uso: equipaggio accasciato;
  - eliminazione: fuga o salto fuori dall'`exit_*`;
  - in fiamme: equipaggio che si agita;
  - vittoria.

## 6. Prese per gli effetti (`fx_*`)

Sono nodi vuoti da cui nascono gli effetti. Oggi le loro posizioni le stima il codice.

| Nome | Effetto |
|---|---|
| `muzzle` | fiammata, traccianti, missili |
| `fx_exhaust_N` | fumo di scarico, fiammata del Nitro |
| `fx_smoke` | fumo da danno |
| `fx_fire_N` | fiamme di "in fiamme" (Carnage) |
| `fx_dust_N` | polvere delle ruote (di solito sotto `wheel_*`) |
| `fx_light_*` | fari, luci di pericolo |

## 7. Zone colore

Ogni mesh ha uno o più **materiali con un nome di zona**, e il gioco li tinge zona per zona. È la base
di "paint your models".

| Materiale | Cosa copre | Oggi |
|---|---|---|
| `paint_primary` | carrozzeria, grandi pannelli | colore della squadra |
| `paint_secondary` | cofano, strisce, parafanghi | un tono del colore della squadra (in futuro scelto dal giocatore) |
| `paint_trim` | dettagli, bordi, numeri | neutro (in futuro scelto dal giocatore) |
| `metal` | telaio, armi, meccanica | mai tinto |
| `tyre` | gomme | mai tinto |
| `glass` | vetri, cupola dell'elicottero | mai tinto (sostituisce `CHOPPER_GLASS`) |
| `crew_primary`, `crew_secondary` | abiti dell'equipaggio (giacca, bandana, casco) | colore della squadra |
| `crew_skin`, `crew_gear` | pelle, cuoio, metallo dell'equipaggio | mai tinti |

Se il modello ha una sola texture, le zone si separano con una **maschera** (`*_mask`): i canali R, G e
B segnano rispettivamente primario, secondario e finiture. La maschera si dipinge una volta in Blender
sopra la texture di Meshy. Senza maschera vale la regola di oggi: il colore va sulle parti chiare e poco
sature.

### 7.1 Vernice neutra e usura (aggiunto il 2026-11-21)

Richiesta dell'utente (2026-11-21): il modello ha un **colore neutro che il gioco sostituisce con il
colore del giocatore**; ruggine, piastre di riparazione, danni superficiali e sporco fanno parte della
stessa texture e **non prendono mai il colore del giocatore**, altrimenti il modello sembra un
giocattolo.

**Due strati nella stessa texture**

| Strato | Cosa comprende | Nel gioco |
|---|---|---|
| **Vernice** | i pannelli verniciati della carrozzeria (zone `paint_*`), e sull'equipaggio le zone `crew_*` | prende il colore del giocatore |
| **Usura** | ruggine, vernice scrostata fino al metallo, piastre di riparazione saldate o imbullonate, bruciature, graffi profondi, fango, sabbia, colature d'olio | resta com'è, sopra la vernice |
| **Tutto il resto** | telaio, meccanica, armi, gomme, vetri, sedili | resta com'è |

**Come deve nascere il modello (regole per concept e prompt)**
- **Vernice in un solo grigio chiaro neutro**, opaco, senza dominante di colore: è il colore chiave.
  Niente altri pannelli verniciati di altri colori, niente scritte o strisce colorate sulla vernice.
- **L'usura ha colori suoi, lontani dal grigio chiave**: ruggine bruno-arancio, metallo nudo scuro,
  fango e sabbia ocra, fuliggine nera. Mai un'usura grigio chiaro.
- **Le piastre di riparazione sono metallo nudo o arrugginito**, non verniciate: restano del loro colore
  su ogni squadra.
- **L'usura sta soprattutto dove si consuma davvero**: bordi dei pannelli, passaruota, parte bassa,
  intorno a bulloni e saldature, cofano vicino agli scarichi.
- **Quanta vernice**: tra il 30% e il 50% della superficie che si vede. Sotto, la squadra non si
  riconosce dal tavolo; sopra, il modello torna giocattolo.
- **Quanta usura sulla vernice**: tra il 15% e il 35% dei pannelli verniciati è coperto da usura.

**La maschera della vernice**
- Per ogni modello uno script ricava dalla texture una **maschera**: dove c'è il grigio chiave è
  vernice, il resto no. Sostituisce la regola di oggi, che tinge tutto ciò che è chiaro e poco saturo e
  quindi colora anche l'usura chiara.
- La maschera è **sfumata** ai bordi dell'usura: la vernice si scrosta gradualmente, senza un contorno
  netto.
- La maschera si salva con il modello (`*_mask`, §7) e **si può ritoccare a mano**: la decide lo script,
  la corregge l'utente dove serve.
- Con più zone, i canali della maschera sono quelli del §7: R primario, G secondario, B finiture.

**Come il gioco colora**
- Il colore del giocatore **sostituisce il grigio chiave e ne conserva le luci e le ombre**: pieghe
  della lamiera, graffi leggeri e ombre dipinte restano visibili sotto il colore.
- Il colore si applica come una vernice opaca e un po' spenta, non come un colore puro: nelle ombre
  scurisce, nelle luci non diventa mai bianco.
- **Fuori dalla maschera il gioco non tocca nulla.**
- I modelli di oggi, senza maschera, continuano con la regola di oggi finché non vengono ridisegnati.

**Cosa controlla il collaudo** (si aggiunge ai controlli del §18)
- la vernice copre tra il 30% e il 50% della superficie visibile;
- l'usura copre tra il 15% e il 35% dei pannelli verniciati;
- con ognuno dei nove colori delle squadre il modello resta leggibile: l'inspector mostra il modello nei
  nove colori uno accanto all'altro, e **l'aspetto lo giudica l'utente**.

## 8. Budget

| Pezzo | Triangoli | Texture | Materiali |
|---|---|---|---|
| Auto (carrozzeria + ruote + arma) | ≤ 8.000 | una tavola 1024, JPEG | ≤ 6 |
| Elicottero | ≤ 7.000 | 1024 | ≤ 5 |
| Moto (senza pilota) | ≤ 4.000 | 1024 | ≤ 5 |
| Big Rig (tre sezioni) | ≤ 18.000 | 1024 per sezione | ≤ 6 per sezione |
| Relitto | ≤ 5.000 | 1024 | 1-2 |
| Persona dell'equipaggio | ≤ 1.500 | 256-512, o colori piatti | ≤ 3 |

- **Ruote**: un modello per misura, riusato su tutti i veicoli (stesso file, più istanze).

### 8.1 Livelli di dettaglio (LOD)

L'equipaggio è **sempre visibile** (decisione dell'utente, 2026-11-19). Per non appesantire il gioco, ogni
persona e ogni veicolo ha più livelli di dettaglio, scelti in base a **quanto è grande sullo schermo**.

**Il criterio.** Si guarda l'altezza in pixel del pezzo proiettato, non la distanza. Così la scelta resta
giusta qualunque sia lo zoom: vista dall'alto, vista mappa o primo piano del director. Ogni soglia ha
un'isteresi del 15% per non far sfarfallare il passaggio. three.js 0.186 ha già `THREE.LOD` (a distanza,
con isteresi): si usa quello con una distanza calcolata dalla dimensione sullo schermo, oppure un piccolo
selettore nostro con la stessa logica.

**Equipaggio**

| Livello | Quando (altezza a schermo di una persona) | Geometria | Animazione |
|---|---|---|---|
| E0 | oltre 60 px (primi piani del director) | ≤ 1.500 triangoli, scheletro completo, mani e piedi | cinematica inversa su `grip_*` e `foot_*`, tutte le animazioni del §5.4 |
| E1 | 15-60 px (tavolo da vicino) | ≤ 400 triangoli, scheletro ridotto (bacino, busto, testa, braccia) | busto e braccia: sterzo, mira, scossoni; gambe ferme |
| E2 | 4-15 px (tavolo intero) | ≤ 60 triangoli, pezzi rigidi (busto, testa) senza scheletro | solo inclinazione del busto e rotazione della testa |
| E3 | sotto 4 px | nessuna persona: un punto di colore sul sedile, o niente | — |

**Veicoli**

| Livello | Quando (lunghezza a schermo) | Cosa resta |
|---|---|---|
| V0 | oltre 200 px | tutte le parti, sospensioni, abitacolo, prese degli effetti |
| V1 | 50-200 px | carrozzeria, ruote che girano e sterzano, torretta; sospensioni e abitacolo semplificati |
| V2 | sotto 50 px | carrozzeria e ruote in un'unica mesh, solo la torretta separata (serve a mirare) |

**Come si ottengono i livelli**
- **Equipaggio**: è procedurale, quindi E0-E2 si **generano insieme** dallo stesso corpo con meno
  suddivisioni, e non costano lavoro in più.
- **Veicoli**: V1 e V2 li prepara lo script di montaggio (§10, passo 4). Semplifica le mesh (decimazione
  di Blender) e fonde le parti che a quel livello non si muovono. La texture di V2 scende a 512.
- **Livello di qualità**: le soglie dipendono anche dal livello scelto in `quality.ts`. In "bassa" ogni
  soglia sale (si passa prima al livello più leggero); in "alta" scende.

**Altri risparmi**
- **Animazioni fuori dall'inquadratura o ferme**: non si aggiornano.
- **E1 e E2**: si aggiornano a metà frequenza.
- **Persone uguali allo stesso livello**: si disegnano in una sola chiamata (`InstancedMesh` o
  `BatchedMesh`) quando non serve lo scheletro.

**Budget del tavolo intero** (quattro squadre, vista del tavolo): equipaggi ≤ 3.000 triangoli in tutto,
veicoli ≤ 60.000. Il pilota misura i numeri veri.
- **Tavolo intero**: con quattro squadre, equipaggi compresi, deve restare entro il limite di
  `quality.ts`. Il pilota lo misura.

### 8.2 Livelli di dettaglio: prestazioni e leggibilità (rivisto il 2026-11-21)

Richiesta dell'utente (2026-11-21): i livelli di dettaglio hanno **due scopi**:
1. **alleggerire il lavoro della scheda grafica** e migliorare le prestazioni;
2. **rendere i veicoli visibili e riconoscibili a qualsiasi distanza** dal punto di vista del giocatore,
   come nel primo Homeworld.

Il secondo scopo cambia cosa è un livello lontano: non è lo stesso modello con meno triangoli, è un
modello **ridisegnato per farsi leggere da lontano**. Da vicino conta il dettaglio; da lontano contano
tre cose sole: **di chi è, che classe è, dove punta**.

**I livelli dei veicoli** (sostituiscono la tabella V0-V2 del §8.1)

| Livello | Lunghezza a schermo | Geometria | Texture e colore | Cosa si muove |
|---|---|---|---|---|
| V0 Primo piano | oltre 200 px | modello completo, fino al budget del §8 | texture piena, tutta l'usura del §7.1 | tutto: sospensioni, sterzo, armi, equipaggio E0 |
| V1 Tavolo da vicino | 80-200 px | circa il 40% dei triangoli; abitacolo semplificato | texture a 512, usura intera | ruote, sterzo, armi; equipaggio E1 |
| V2 Tavolo intero | 30-80 px | circa il 10%: carrozzeria e ruote fuse, **sagoma rinforzata** | **colori piatti**: colore del giocatore pieno, usura quasi sparita | solo la mira dell'arma; equipaggio E2 |
| V3 Lontano e vista mappa | sotto 30 px | sagoma minima, al massimo 150 triangoli | due colori: quello del giocatore e uno scuro | niente; equipaggio E3 |

**Come un livello lontano si fa leggere** (dal livello V2 in su)

| Leva | Cosa fa | Limite |
|---|---|---|
| **Colore del giocatore più forte** | la vernice diventa più satura e più chiara, e copre più superficie: dal 30-50% di V0 fino al 60-70% di V3 | resta sempre una parte scura (ruote, fondo), se no si perde la forma |
| **Usura che si spegne** | ruggine e sporco perdono contrasto man mano che il veicolo rimpicciolisce: da lontano sarebbero solo rumore | spariscono del tutto solo a V3 |
| **Sagoma rinforzata** | ciò che distingue la classe si esagera: la gabbia e le ruote scoperte del Doom Buggy, il cofano lungo e basso dell'Avenger, il cassone alto dell'Eliminator, l'arma | entro il 15% delle misure vere, e mai fuori dalla casella |
| **Dettagli piccoli tolti** | antenne, tubi, bulloni, specchi spariscono invece di sfarfallare | — |
| **Bordo di contrasto** | un filo scuro intorno alla sagoma la stacca dalla strada, chiara o scura che sia | solo V2 e V3 |

- **Resta sempre il modello** (decisione dell'utente, 2026-11-21): a nessuna distanza il veicolo è
  sostituito o accompagnato da un segno, un'icona o un simbolo. Anche a V3 si vede il modello, per
  quanto semplificato: classe e direzione si leggono dalla sua sagoma, il proprietario dal suo colore.
- **Stati di gioco sempre leggibili**: fuori uso, in fiamme, selezionabile e veicolo attivo si devono
  capire a ogni livello. Da V2 in su non bastano fumo e fiamme del modello: lo stato si mostra anche sul
  bordo di contrasto.
- **Relitti e ostacoli** seguono gli stessi livelli, senza colore del giocatore.

**Come si passa da un livello all'altro**
- Si guarda la **lunghezza in pixel** del veicolo, non la distanza: vale per ogni vista e ogni zoom.
- **Isteresi del 15%** su ogni soglia, come nel §8.1.
- **Passaggio sfumato**: colore, usura e bordo cambiano con continuità tra una soglia e l'altra; la
  geometria si scambia a metà della sfumatura, così il cambio non si nota.
- **Durante un'azione il livello non scende**: il veicolo che muove, spara o viene colpito resta almeno
  a V1 finché la scena del director non finisce.
- **Qualità**: in "bassa" tutte le soglie salgono del 30% (si passa prima al livello leggero); in "alta"
  scendono del 30%. I numeri stanno in `presentation_base.json`, sotto `lod`.

**Prestazioni**

Tutti i numeri di questo paragrafo (soglie in pixel, percentuali di triangoli, budget) sono **valori
di partenza non misurati** (richiesta dell'utente, 2026-11-21). Vanno **verificati al tavolo**, col
gioco vero e i modelli nuovi, usando il **selettore della qualità grafica**: per ogni qualità si
guarda una partita a quattro squadre nelle viste di gioco, si misurano fotogrammi al secondo e
triangoli disegnati, e si giudica a occhio se i veicoli si riconoscono. I numeri si correggono in
`presentation_base.json` e qui, e solo allora diventano regole del collaudo. Fino ad allora il
collaudo li riporta come avviso, non come bocciatura.

| Misura | Obiettivo di partenza (da verificare) |
|---|---|
| Triangoli dei veicoli, tavolo intero con quattro squadre | al massimo 25.000 (oggi il limite è 60.000) |
| Triangoli dei veicoli, vista mappa | al massimo 5.000 |
| Chiamate di disegno a V2 e V3 | una per classe di veicolo: i veicoli uguali si disegnano insieme |
| Texture a V2 e V3 | nessuna: colori piatti |
| Animazioni a V2 | a metà frequenza; a V3 nessuna |

**Chi prepara i livelli**
- **V1**: lo script di montaggio, semplificando V0.
- **V2 e V3**: non escono bene da una semplificazione automatica, perché vanno ridisegnati. Lo script
  li costruisce **a partire dalla dima** (§17), che è già la sagoma pulita del veicolo, e ci aggiunge i
  tratti della classe. L'utente li approva nell'inspector, che mostra i quattro livelli affiancati alla
  loro misura vera a schermo, sopra una tessera della strada.
- **Collaudo**: per ogni modello si riporta se i triangoli di ogni livello stanno nel budget (avviso,
  finché i numeri non sono verificati al tavolo) e si verifica che a V2 e V3 il colore del giocatore
  copra la quota prevista.

## 9. La scheda di montaggio

Ogni modello ha una scheda in `assets/<gioco>/modelli/schede/<id>.json`, che dice quali pezzi generare,
dove vanno e come si muovono. Chi la usa:
- **lo script di Blender** la legge per montare il modello;
- **il controllo automatico** la confronta con il GLB;
- **il gioco** la ignora, perché gli bastano i nomi e gli `extras` del file.

```json
{
  "id": "car_m",
  "out": "assets/base/modelli/car_m.glb",
  "length_m": 4.5,
  "parts": [
    { "node": "body",   "source": "car_m_body.glb",   "zones": ["paint_primary", "paint_secondary", "metal", "glass"] },
    { "node": "turret", "source": "car_m_turret.glb", "parent": "body",   "pivot": [-0.9, 1.1, 0], "arc": [-3.14, 3.14] },
    { "node": "gun",    "source": "mg_light.glb",     "parent": "turret", "pivot": [0, 0.15, 0],   "elev": [-0.1, 0.5] },
    { "node": "wheel",  "source": "wheel_m.glb", "axles": [
        { "x": 1.35, "track": 0.85, "steer": true,  "radius": 0.42, "travel": [-0.08, 0.12] },
        { "x": -1.3, "track": 0.85, "steer": false, "radius": 0.42, "travel": [-0.08, 0.12] } ] }
  ],
  "seats": [
    { "node": "seat_driver", "role": "driver", "pose": "sit",   "at": [0.1, 0.55, -0.35], "operates": "steering_wheel", "visible": "cage", "exit": "exit_L" },
    { "node": "seat_gunner", "role": "gunner", "pose": "stand", "parent": "turret", "at": [0.3, 0.2, 0], "operates": "gun", "visible": "open", "exit": "exit_R" }
  ],
  "fx": { "fx_exhaust_0": [-2.1, 0.5, 0.3], "fx_smoke": [0.8, 1.0, 0] }
}
```

I numeri dell'esempio sono illustrativi: quelli veri usciranno dal pilota.

## 10. Il flusso di lavoro (rivisto il 2026-11-21)

Ogni passo ha un responsabile, un risultato scritto nella scheda di produzione (§20) e un cancello: **non
si passa al passo dopo se il cancello non è superato**.

| Passo | Chi | Strumento | Risultato | Cancello |
|---|---|---|---|---|
| 1. Scheda | Claude scrive, l'utente approva | — | scheda di produzione e scheda di montaggio: misure, pezzi, posti, prese | approvazione dell'utente |
| 2. Dima | script | `tools/models/dima` (§17) | sagoma grigia del veicolo con la figura standard a bordo, tre viste per pezzo | i posti della dima passano il collaudo del §18 |
| 3. Prompt | script, dai blocchi condivisi | scheda di produzione (§20) | prompt per Gemini e per Meshy, pronti da copiare dall'inspector | — |
| 4. Concept | utente | **Gemini**, con la dima e il riferimento di stile allegati | una tavola per pezzo | l'utente la approva a occhio contro la dima |
| 5. 3D | utente | **Meshy** (Image to 3D) | un GLB per pezzo in `assets/sorgenti/` | — |
| 6. Collaudo dimensionale | script | `tools/models/collaudo` (§18) | rapporto: scarti dalla dima, posa della figura, compenetrazioni | tutte le tolleranze rispettate; se no, si torna al passo 4 o 5 |
| 7. Montaggio | script; l'utente ritocca se serve | scheda di montaggio (§9), poi Blender 5.0 | modello con gerarchia, perni, zone | controllo automatico del §10.2 |
| 8. Alleggerimento | script | `tools/art/compress_models.py` | texture JPEG ≤ 1024 | budget del §8 |
| 9. Gioco | Claude | `src/view/`, `src/app/motion/` | animazioni dei pezzi e dell'equipaggio (§19) | prove sul banco, immagini in `production/qa/evidence/` |
| 10. Approvazione | utente | inspector (§21) | stato "approvato" nella scheda di produzione | — |

**Regola nuova: niente codice su un modello che non ha passato il passo 6.** Se un pezzo non rispetta la
dima si rigenera; non si adatta il codice al pezzo.

### 10.1 Regole per i prompt (passi 2 e 3)

- **Un pezzo per tavola**, mai il veicolo intero con le ruote.
- **Carrozzeria**:
  - passaruota vuoti e niente ruote;
  - niente armi sul tetto, al loro posto una base piatta;
  - abitacolo vuoto con i sedili, **nessuna persona**.
- **Ruota**: dritta, vista di lato e di tre quarti, mozzo centrato.
- **Arma**: canna orizzontale verso destra, base di montaggio in basso, impugnature visibili se l'arma è
  manuale.
- **Stile e colori**: i blocchi `stile` e `colore` di `data/trv/modelli/regole.json`. Pannelli grigio chiaro neutro dove andrà il colore
  della squadra, metallo scuro per il resto.
- **Meshy**: Topology Triangle, Symmetry On, texture 1024, triangoli in proporzione al budget del §8.
- **Da verificare nel pilota**: cosa offre Meshy oggi per dividere un modello in parti o generarlo da più
  viste. Se lo fa bene, il passo 3 può partire dal veicolo intero e dividerlo invece di generare ogni
  pezzo a parte.

### 10.2 Il controllo automatico (passo 7)

Fallisce, e dice perché, se trova uno di questi problemi.
- **Nodi e perni**:
  - manca un nodo obbligatorio per quel tipo di veicolo (§4.1);
  - un perno ha la sua mesh fuori dal raggio, cioè la ruota non gira sul proprio centro.
- **Ruote**: le ruote di uno stesso asse hanno raggi diversi, o non toccano Y = 0.
- **Posti**:
  - un `seat_*` ha geometria dentro il suo spazio `clear`;
  - un `grip_*` non è figlio della parte che dichiara.
- **Budget**: triangoli, texture o materiali oltre il budget, oppure manca una zona colore richiesta.
- **Forma**: la lunghezza non è quella della scheda (±5%), oppure il muso non è verso +X.

## 11. Nel gioco

- **Caricatore per nomi** (`src/view/vehicle-rig.ts`, nuovo): trova perni, posti e prese e li passa a
  `CarRig` e agli effetti. Se un modello non ha la gerarchia (i modelli vecchi), restano i tagli di oggi.
- **Animazioni che diventano possibili**:
  - ruote indipendenti con sospensioni che seguono il terreno (rampe, buche, rocce) e si comprimono negli
    slam e negli atterraggi;
  - sterzo vero;
  - torretta e alzo verso il bersaglio, rinculo della canna;
  - Big Rig che si piega sulle cerniere;
  - rotori;
  - sportelli che si staccano con i danni;
  - pezzi che volano via partendo dalle parti vere, invece dei tagli a griglia di `wreckage.ts`.
- **Equipaggio** (in seguito): un modulo a parte legge `seat_*` e `grip_*` e anima le persone sui
  fotogrammi delle regole, senza toccare le regole (ADR-0005).

### 11.1 Il contratto con il Movimento dei veicoli (#36)

Questi modelli sono il sistema #37 dell'indice. Chi li anima è il **Movimento dei veicoli** (#36,
[vehicle-motion.md](../gdd/vehicle-motion.md)), non il codice dei pezzi.

Il caricatore consegna a #36, per ogni veicolo:
- **un descrittore delle parti**, con queste voci:

  | Voce | Contenuto |
  |---|---|
  | `body` | il nodo della carrozzeria e il suo baricentro |
  | `wheels[]` | per ogni ruota: perno (`wheel_N{L,R}`), sterzo (`steer_N{L,R}`) se c'è, sospensione (`susp_N{L,R}`) con corsa, raggio, asse (anteriore o posteriore) |
  | `turrets[]` | torretta (`turret`), canna (`gun`, `barrel`), bocca di fuoco (`muzzle`), limiti di rotazione e di alzo |
  | `hitches` | `hitch_front`, `hitch_rear` del Big Rig |
  | `rotors` | `rotor_main`, `rotor_tail` dell'elicottero |
  | `fork` | la forcella anteriore della moto |
  | `seats`, `grips` | posti e punti di contatto dell'equipaggio (§5) |
  | `fx` | le prese degli effetti (§6) |

- **le capacità**, cioè cosa il modello sa fare: `suspension`, `steering`, `turret`, `articulated`
  (Big Rig), `rotors`, `crew`, `detachable` (parti che si staccano in uno schianto).

Regole del contratto:
- #36 anima solo le capacità presenti.
- **Ripiego**: per un modello vecchio, tutto d'un pezzo, il caricatore costruisce il descrittore dai tagli
  di oggi (`WHEELS`, `GUNS`, `CHOPPER_PARTS`), con le capacità ridotte (niente sospensioni, niente sterzo
  dove i tagli non lo permettono).
- **Le misure** (raggi, corse, limiti di rotazione) stanno nella scheda di montaggio (§9). Il caricatore le
  legge da lì e le passa a #36.
- **Il controllo automatico** (§10.2) verifica anche che il descrittore sia completo per le capacità
  dichiarate.

## 12. Il pilota

Si fa sull'**Auto Media**, dall'inizio alla fine:
1. Scheda `car_m.json`, approvata dall'utente.
2. Prompt per Gemini e Meshy dei pezzi: carrozzeria, ruota media, torretta, arma.
3. Primo `assemble.py`, controllo automatico, caricatore per nomi.
4. Nel gioco: ruote con sospensioni, sterzo, torretta che mira, rinculo. I posti si provano con un
   manichino provvisorio (una sagoma), per verificare spazi e mani.
5. Misure: triangoli, peso del file, tempo per fotogramma con quattro squadre.

**Criteri di riuscita:**
- nessun buco visibile con ruote e torretta al massimo del movimento;
- il manichino sta seduto nel `seat_driver` con le mani sul volante mentre sterza;
- il controllo automatico passa;
- il gioco non rallenta rispetto a oggi;
- l'utente approva l'aspetto.

**Dopo il pilota.** Si scrive l'ADR del formato, e questa specifica diventa vincolante. Poi si passa
agli altri modelli, in quest'ordine:
1. auto piccola e grande (stessa ruota per misura);
2. moto senza pilota;
3. elicottero;
4. Big Rig;
5. relitti (statici, solo prese per fumo e fuoco).

**Aggiornamento (2026-11-21).** I veicoli dei punti 1 e 4 sono già nel gioco senza equipaggio. L'ordine
delle prossime fasi è nel §22.

## 13. Inventario dei modelli

| Modello | Parti mobili | Equipaggio (deciso dall'utente, 2026-11-19) | Note |
|---|---|---|---|
| Auto piccola | 2 assi, sterzo davanti, arma sulla gabbia | **solo pilota**: `seat_driver`; l'arma la comanda il pilota dal posto di guida (le sue mani restano sul volante) | oggi l'arma sta sopra la gabbia |
| Auto media | 2 assi, torretta sul cofano | **pilota e artigliere**: `seat_driver`, `seat_gunner` alla torretta | |
| Auto grande | 3 assi, arma sul cassone | **pilota, copilota e artigliere**: `seat_driver`, `seat_codriver` accanto, `seat_gunner` nel cassone | |
| Elicottero | `rotor_main`, `rotor_tail`, arma sotto il muso | **solo pilota**: `seat_pilot`; l'arma la comanda il pilota | `glass` sostituisce `CHOPPER_GLASS` |
| Moto | `fork` con ruota anteriore, ruota posteriore, sospensioni | **solo pilota**: `seat_rider` (posa `ride`), `grip_*` sul manubrio, `foot_*` sulle pedane | da rigenerare senza pilota |
| Big Rig, motrice | 2 assi (uno sterzante), `launcher`, rostro, `hitch_rear` | **pilota e copilota** in cabina (`seat_driver`, `seat_codriver`), **artigliere anteriore** al lanciamissili (`seat_gunner_front`) | |
| Big Rig, rimorchio centrale | 2 assi, `hitch_front`, `hitch_rear`, piazzola | nessuno | |
| Big Rig, rimorchio posteriore | 3 assi, `hitch_front`, `hatch_dispenser`, radar che gira | **artigliere posteriore** (`seat_gunner_rear`) a un'arma che spara indietro | il Big Rig spara anche nell'arco posteriore (BRaFF): l'arma va modellata qui |
| Relitti | nessuna | nessuno | solo `fx_smoke`, `fx_fire_*` |
| Rampa, verme | per ora invariati | — | il verme ha già le sue mascelle (`WORM`) |

L'equipaggio è una scelta artistica, non una regola del gioco: il regolamento non dice chi c'è a bordo.

## 14. Domande aperte

1. ~~Quante persone a bordo per ogni tipo di veicolo?~~ Risolta dall'utente il 2026-11-19: tabella del §13.
2. ~~L'equipaggio si vede sempre o solo nei primi piani?~~ Risolta dall'utente il 2026-11-19: sempre,
   con i livelli di dettaglio del §8.1.
3. ~~Che stile per le persone?~~ Risolta dall'utente il 2026-11-19: miniature dipinte come i veicoli (§5.4).
4. ~~Con "paint your models" il giocatore sceglierà anche i colori dell'equipaggio?~~ Risolta dall'utente il
   2026-11-19: all'inizio **solo i veicoli**. Per l'equipaggio si valuteranno più avanti vestiti
   particolari (capi e accessori da scegliere), non la verniciatura. Le zone `crew_*` restano col colore
   della squadra.

Domande aperte dalla revisione del 2026-11-21:

5. ~~Corpo dell'equipaggio: figura di Meshy o corpo generato dal codice?~~ Risolta dall'utente il
   2026-11-21: **figure generate con Meshy o sistemi simili**, tenendo aperta la strada a una
   generazione procedurale dei piloti in futuro (§19.2).
6. ~~Scala della persona sul tavolo: diversa per veicolo o unica?~~ Risolta dall'utente il 2026-11-21:
   **una scala sola** per veicoli e persone, veicoli dentro la casella, classi distinte dalla sagoma
   (§16.2, §16.3). Scala 1 : 125 e misure della tabella confermate lo stesso giorno.
7. ~~Veicoli già nel gioco: rigenerarli o provarli prima?~~ Risolta dall'utente il 2026-11-21: **vanno
   ridisegnati** sulle misure del §16.3.
8. ~~Copie dei prompt vecchi: cancellarle o archiviarle?~~ Risolta dall'utente il 2026-11-21: **si
   cancellano** dopo il travaso nelle schede di produzione; la storia resta in git.

Tutte le domande aperte sono risolte.

---

# Parte seconda: misure, collaudi e produzione (2026-11-21)

## 15. La figura standard

Tutte le persone del gioco (piloti, copiloti, artiglieri) hanno **le stesse misure e lo stesso
scheletro**. Cambiano solo l'aspetto, gli abiti e gli accessori. Così un posto che va bene per una
persona va bene per tutte, e un'animazione scritta una volta vale per tutti.

I numeri stanno in `data/trv/modelli/regole.json` (§20), non nel codice. Sostituiscono le misure del
pilota della moto (`motion.rider` in `presentation_base.json`).

### 15.1 Misure (metri, a scala reale)

| Misura | Valore | Note |
|---|---|---|
| Altezza | 1,75 | con il casco fino a 1,82 |
| Altezza delle anche da terra | 0,94 | coscia + stinco + caviglia |
| Busto: dalle anche alle spalle | 0,50 | |
| Collo e testa: dalle spalle alla sommità | 0,31 | |
| Larghezza delle spalle (tra le articolazioni) | 0,40 | ingombro con le braccia: 0,50 |
| Larghezza delle anche (tra le articolazioni) | 0,20 | ingombro del bacino: 0,36 |
| Braccio (spalla-gomito) | 0,31 | |
| Avambraccio (gomito-polso) | 0,27 | |
| Mano: dal polso al centro della presa | 0,07 | |
| Coscia (anca-ginocchio) | 0,44 | |
| Stinco (ginocchio-caviglia) | 0,42 | |
| Caviglia: altezza sulla suola | 0,08 | |
| Piede: lunghezza | 0,26 | |
| Spessori per le compenetrazioni | busto 0,13 · testa 0,12 · braccio 0,05 · coscia 0,08 · stinco 0,06 | raggio delle capsule usate dal collaudo (§18) |

Ne discendono due lunghezze usate ovunque:
- **portata del braccio** = 0,31 + 0,27 + 0,07 = **0,65 m** (dalla spalla al centro della presa);
- **portata della gamba** = 0,44 + 0,42 = **0,86 m** (dall'anca alla caviglia).

### 15.2 Scheletro e posa di riposo

- **Ossa obbligatorie**, con i nomi del contratto: `hips`, `spine`, `chest`, `neck`, `head`,
  `upper_arm_L/R`, `lower_arm_L/R`, `hand_L/R`, `thigh_L/R`, `shin_L/R`, `foot_L/R`.
- **Nomi di Meshy**: lo scheletro che esce da Meshy usa altri nomi (`Hips`, `Spine01`, `LeftArm`,
  `LeftForeArm`, `LeftUpLeg`…). La corrispondenza sta in `regole.json`; il gioco usa solo i nomi del
  contratto.
- **Posa di riposo**: in piedi, **braccia ad A** (45° dal busto), gambe appena divaricate, palmi verso
  le cosce, dita chiuse.
- **Orientamento**: guarda verso +X, Y in alto, origine a terra tra i piedi. Come i veicoli (§3).
- **Dita**: non si animano. La mano è un pezzo solo, chiusa a pugno morbido.

### 15.3 Limiti e versi delle articolazioni

È ciò che mancava al pilota della moto. La cinematica inversa **non può mai uscire da questi limiti**: se
per raggiungere una presa dovrebbe uscirne, il posto è sbagliato e lo dice il collaudo (§18), non si
forza la posa.

| Articolazione | Movimento | Limiti (gradi) |
|---|---|---|
| Gomito | flessione | 5 – 145 (mai dritto del tutto, mai all'indietro) |
| Ginocchio | flessione | 5 – 140 (mai all'indietro) |
| Spalla | in avanti / indietro | −40 – 160 |
| Spalla | apertura di lato | −15 – 120 (il braccio può incrociare appena davanti al busto: le mani in alto e in basso sul volante) |
| Anca | flessione (coscia verso il busto) | −10 – 115 |
| Anca | apertura di lato | 0 – 40 |
| Schiena (`spine` + `chest`) | in avanti / indietro | −15 – 45 |
| Schiena | di lato | ±20 |
| Schiena | torsione | ±35 |
| Collo e testa | su e giù | ±35 |
| Collo e testa | di lato | ±25 |
| Collo e testa | rotazione | ±70 |
| Polso | ogni verso | ±45 |
| Caviglia | punta su / giù | −20 – 40 |

**Versi** (dove puntano gomiti e ginocchia):
- **gomiti**: in basso e in fuori, mai verso l'interno del busto né verso l'alto;
- **ginocchia**: in avanti e appena in fuori; a cavalcioni (`ride`) stringono il serbatoio;
- **portata usata**: mai oltre il **92%** della portata di braccio e gamba (l'arto non si stende del
  tutto), mai sotto il **55%** (non si accartoccia).

### 15.4 Il collaudo della figura

Una figura generata entra nel gioco solo se passa questo controllo automatico:
1. ha tutte le ossa obbligatorie, con la corrispondenza dei nomi;
2. portata ad altezza 1,75 m, ogni osso ha la lunghezza della tabella del §15.1 con uno scarto massimo
   del **10%**;
3. è nella posa di riposo e guarda verso +X;
4. piegando gomiti, ginocchia e anche fino ai limiti, la superficie non si strappa e non si rivolta
   (lo script produce le immagini delle pose limite; **le guarda l'utente**);
5. rispetta il budget del §8.

Le misure del gioco restano quelle standard: se una figura ha le braccia più lunghe del 6%, le sue ossa
si scalano una a una fino alle misure standard.

## 16. Misure dei posti e dei veicoli

### 16.1 I posti, per posa

Le misure sono **rispetto all'origine del posto** (il punto delle anche, §5.1): avanti è +X del posto,
in alto +Y. Sono i valori di partenza; li verifica e li corregge la prima prova (§22, fase C).

| Misura | `sit` (seduto in auto) | `ride` (a cavalcioni) | `stand` (in piedi all'arma) |
|---|---|---|---|
| Prese delle mani: avanti | 0,35 – 0,55 | 0,35 – 0,55 | 0,30 – 0,50 |
| Prese delle mani: in alto | 0,20 – 0,40 | 0,15 – 0,40 | 0,25 – 0,45 |
| Prese delle mani: distanza tra loro | 0,30 – 0,40 | 0,55 – 0,75 | 0,15 – 0,35 |
| Appoggi dei piedi: avanti | 0,50 – 0,75 | −0,15 – 0,20 | 0 |
| Appoggi dei piedi: in basso | 0,15 – 0,40 | 0,40 – 0,60 | 0,82 – 0,87 (il pavimento: in piedi con le ginocchia appena piegate, come chiede la portata del 92%) |
| Appoggi dei piedi: distanza tra loro | 0,20 – 0,40 | 0,40 – 0,55 | 0,25 – 0,45 |
| Larghezza del sedile tra le cosce | — | **al massimo 0,32** | — |
| Spazio libero sopra le anche | 0,90 | 0,95 | 0,90 |
| Spazio libero di lato (larghezza) | 0,55 | 0,60 | 0,70 |
| Schienale: inclinazione all'indietro | 5° – 25° | — | — |
| Altezza della sella da terra | — | 0,70 – 0,85 | — |

**Regola che vale sempre**, qualunque numero dica la tabella: con la figura standard al suo posto,
- ogni mano arriva alla sua presa con il **55-92% della portata del braccio**;
- ogni piede arriva al suo appoggio con il **55-92% della portata della gamba**;
- nessuna articolazione esce dai limiti del §15.3;
- vale **in tutte le posizioni estreme** del posto: volante o manubrio tutto a destra e tutto a sinistra,
  torretta ai due estremi dell'arco, arma al massimo e al minimo dell'alzo.

### 16.2 Una scala sola (decisione dell'utente, 2026-11-21)

**Tutti i veicoli e tutte le persone hanno la stessa scala.** Un pilota è grande uguale su ogni veicolo.
Sostituisce le lunghezze di oggi (`SHOW_LENGTH_MM`, decise il 2026-11-15: auto grande doppia della
piccola), che davano a ogni veicolo una scala sua: una persona sarebbe stata alta 10,7 mm sull'auto
piccola e 19 mm sulla moto.

- **Scala: 1 : 125** (8 mm sul tavolo per ogni metro vero), confermata dall'utente il 2026-11-21.
- **La casella** della strada è lunga circa 46 mm (la tessera è 368 mm per 8 caselle): ogni veicolo ci
  sta dentro, con almeno 2 mm di margine davanti e dietro. La larghezza della casella va misurata sulla
  griglia prima di fissare le larghezze.
- **Una persona** (1,75 m) è alta **14 mm** sul tavolo, su tutti i veicoli.
- **I veicoli vanno ridisegnati** su queste misure: è la risposta alla domanda aperta 7.

### 16.3 I veicoli, per classe

Le classi si distinguono **a colpo d'occhio per sagoma**, non solo per lunghezza: si gioca sull'altezza e
sulle proporzioni (indicazione dell'utente, 2026-11-21).

| Veicolo | Sagoma | Lunghezza vera | Sul tavolo | Altezza vera | Larghezza vera | Raggio della ruota | Posti (§13) |
|---|---|---|---|---|---|---|---|
| Auto piccola (Doom Buggy) | **piccola e corta** | 3,0 m | 24 mm | 1,5 m | 1,6 m | 0,36 | pilota |
| Auto media (Avenger) | **bassa e lunga** | 4,8 m | 38 mm | 1,2 m | 1,9 m | 0,36 | pilota, artigliere |
| Auto grande (Eliminator) | **lunga, alta e tozza** | 5,2 m | 42 mm | 2,3 m | 2,3 m | 0,50 | pilota, copilota, artigliere |
| Moto | stretta | 2,1 m | 17 mm | 1,1 m (senza pilota) | manubrio 0,75 | 0,32 | pilota |
| Big Rig, ogni sezione | la più alta del tavolo | 5,6 m | 45 mm, una casella da gancio a gancio | 3,2 m | 2,5 m | 0,55 | §13 |
| Elicottero | — | da fissare con la sua dima | oggi 50 mm: vola sopra le caselle | — | — | — | pilota |

- Misure confermate dall'utente il 2026-11-21 come **punto di partenza**: le verifica la dima di ogni veicolo (§17), dove si vede se le persone ci
  stanno. Le altezze sono a veicolo scarico, senza arma.
- **L'Avenger è lunga quasi quanto l'Eliminator**: le distingue l'altezza (1,2 m contro 2,3 m), non la
  lunghezza.
- **Proporzioni da miniatura**: ruote e armi possono essere più grosse del vero, **i posti no**. Sedile,
  volante, manubrio, pedane e impugnature rispettano il §16.1.
- **Armi manuali**: le impugnature stanno a 1,20 – 1,40 m dal pavimento su cui sta in piedi
  l'artigliere, e il pavimento è piano per almeno 0,5 × 0,5 m.
- **Relitti**: ogni relitto prende le misure del veicolo da cui viene.
- **La moto diventa più piccola di oggi** (17 mm invece di 24): è il prezzo della scala unica. Se sul
  tavolo si legge male, si interviene sulla sagoma (pilota ben visibile, ruote grosse), non sulla scala.

## 17. La dima

La dima è una **sagoma grigia del veicolo, costruita dal codice a partire dalla scheda**, con la figura
standard già a bordo. Si fa **prima** di generare qualsiasi cosa.

**A cosa serve**
1. **Trova gli errori di misura prima di spendere generazioni**: se nella dima il pilota non arriva al
   manubrio, la scheda è sbagliata e si corregge lì.
2. **Guida il concept**: le viste della dima si allegano a Gemini, che disegna il veicolo sopra quelle
   proporzioni.
3. **È il riferimento del collaudo**: il modello di Meshy si confronta con la dima (§18).

**Cosa contiene**
- ingombro del veicolo (lunghezza, larghezza, altezza), ruote con il loro raggio e il loro passo;
- per ogni posto: sedile o sella, prese, appoggi dei piedi, spazio libero;
- la figura standard seduta in ogni posto, nella posa neutra;
- armi con perno, impugnature e bocca di fuoco;
- una griglia a terra con un quadretto ogni 0,5 m e la sagoma di una persona in piedi accanto, come
  metro di paragone.

**Cosa produce lo script** (`tools/models/dima`, da scrivere; gira in `npm run`, senza Blender):
- **un GLB** della dima, che l'inspector mostra sovrapposto al modello (§21);
- **tre viste ortogonali** (di lato, dall'alto, di fronte) e una di tre quarti, in PNG, per ogni pezzo
  da generare: il veicolo senza ruote e senza arma, con la figura a bordo in trasparenza;
- **il rapporto del collaudo dei posti** sulla sola dima (§18, punti 2-4).

**Come si usa con Gemini**
- Si allegano la vista della dima e il riferimento di stile.
- Il prompt dice: stesse proporzioni e stessa posizione di sella, manubrio, pedane e ruote
  dell'immagine allegata; **la persona in trasparenza serve solo da misura e non va disegnata**.
- **Rischio da verificare alla prima prova**: non sappiamo quanto fedelmente Gemini segua la dima. Se la
  segue male, la dima resta comunque utile ai punti 1 e 3, e il concept si scarta al passo 4 del §10.

**Meshy** non rispetta misure scritte nel testo e restituisce il modello in una scala sua. Per questo le
misure non si chiedono a Meshy: si controllano dopo.

## 18. Il collaudo dimensionale

Gira dopo Meshy, su ogni pezzo, **prima di scrivere codice** (`tools/models/collaudo`, da scrivere). Il
risultato è un rapporto salvato nella scheda di produzione e mostrato nell'inspector.

| # | Controllo | Come | Tolleranza |
|---|---|---|---|
| 1 | Il pezzo combacia con la dima | si scala il pezzo sulla lunghezza della scheda, poi si misurano larghezza, altezza, centro delle ruote, sella, prese, appoggi | proporzioni ±8%; punti dei posti entro **5 cm** |
| 2 | La figura arriva alle prese e agli appoggi | si risolve la posa della figura standard nella posa neutra e in tutte le posizioni estreme (§16.1) | portata 55-92% |
| 3 | Le articolazioni restano nei limiti | sulle stesse pose | limiti del §15.3, nessuna eccezione |
| 4 | Nessuna compenetrazione | le capsule della figura (§15.1) contro la superficie del veicolo, sulle stesse pose | al massimo **2 cm**, esclusi sedile, prese e appoggi |
| 5 | Le parti mobili non urtano | ruote a fine corsa e a tutto sterzo, torretta e arma ai loro limiti, avantreno della moto a tutto sterzo, moto a 50° di piega (§4.2) | nessun contatto con la carrozzeria né con la figura; in piega toccano terra solo le gomme |
| 6 | Budget | triangoli, texture, materiali | §8 |
| 7 | Vernice e usura | dalla maschera della vernice (§7.1) | vernice 30-50% della superficie visibile; usura 15-35% dei pannelli verniciati |
| 8 | Il modello è chiuso (manifold) | si saldano i vertici nello stesso punto (le cuciture della texture non sono buchi), poi ogni spigolo deve avere esattamente due facce (`src/models/manifold.ts`; l'inspector lo dice su ogni modello mostrato in 3D) | **nessuno** spigolo aperto, **nessuno** spigolo con più di due facce. Un modello aperto si rigenera, non si rattoppa: la prova del 2026-11-21 sull'Avenger ha mostrato che chiudere a script cornici e gusci aperti li rovina |

**Esiti**
- **Passa**: si va al montaggio.
- **Passa con ritocco**: gli scarti del punto 1 stanno entro la tolleranza. I punti dei posti nella
  scheda di montaggio si spostano sui punti veri del modello, e i controlli 2-5 si rifanno lì.
- **Non passa**: il rapporto dice quale misura è fuori e di quanto, in parole ("la sella è 9 cm troppo
  larga tra le cosce"). Si rigenera il pezzo, o si corregge la scheda se era sbagliata lei.

**La dima segue il modello** (decisione del 2026-11-21, dopo quattro generazioni dell'Avenger). Un modello
generato non rispetta mai la dima al centimetro, e rigenerare costa. Per questo **non si rigenera per uno
scarto di misura**: posti, ruote e base dell'arma si spostano sui punti veri del modello e i controlli
2-5 si rifanno lì. Si rigenera solo quando:
- la forma è sbagliata (manca il pianale del mitragliere, non c'è l'abitacolo, l'auto è un'altra);
- i passaruota non contengono la ruota da ferma, o le anteriori non sterzano fino al limite del gioco;
- dopo la pulizia restano buchi che non si possono tappare (cornici, gusci aperti grandi).

**La pulizia prima del collaudo.** `tools/models/pulisci_carrozzeria.py` toglie i pezzi sciolti che Meshy
lascia dentro i passaruota (molle, bracci: li coprono le ruote, che hanno bisogno di quello spazio), tappa
i buchi piccoli e piatti e toglie le lastre aperte sotto la scocca. Non deforma niente: spostare i vertici
per allargare un passaruota rovina la carrozzeria (prova del 2026-11-21).

**Ruote: cosa si controlla davvero.** Il gioco non anima la sospensione e sterza solo le ruote anteriori,
con un limite per modello. Il punto 5 si fa quindi sulla ruota ferma e a tutto sterzo; la corsa della
sospensione si controllerà quando il gioco la animerà.

**Le immagini.** Il collaudo salva una vista per ogni posa provata, con le parti fuori tolleranza in
rosso. I numeri li giudica lo script; l'aspetto lo giudica l'utente.

**Il collaudo è anche un test.** Le stesse verifiche girano in `npm test` sulle schede dei modelli
approvati: un modello che ha passato il collaudo non può smettere di passarlo senza che un test fallisca.

## 19. Rigging e animazioni

### 19.1 Veicoli

- **Niente scheletro**: le parti dei veicoli sono rigide, ognuna con il suo perno (§4). Il rigging di un
  veicolo è la sua scheda di montaggio.
- **Perni**: li mette la scheda, non l'occhio. Dopo il collaudo (§18, punto 1) il centro di ogni ruota e
  il perno di ogni arma si ricavano dal modello: asse del cilindro della ruota, centro della base
  dell'arma.
- **Chi le anima**: il Movimento dei veicoli (#36, `vehicle-motion.md`). Qui non cambia nulla.

### 19.2 Persone

- **Da dove vengono le figure** (decisione dell'utente, 2026-11-21): si generano con **Meshy o sistemi
  simili**, scheletro compreso. Il §5.4, dove dice che il corpo è generato dal codice, è superato.
- **La strada resta aperta alla generazione procedurale**: il gioco non sa da dove viene una figura.
  Conosce solo lo scheletro del §15.2, le misure del §15.1 e le zone colore del §7. Qualunque
  generatore, Meshy oggi o il codice domani, deve consegnare una figura che passa il collaudo del
  §15.4; nient'altro nel gioco cambia. Per questo:
  - nessun codice del gioco usa i nomi delle ossa di uno strumento, solo quelli del contratto;
  - accessori e abiti si agganciano alle ossa del contratto, così valgono per ogni figura;
  - ogni figura ha la sua scheda di produzione (§20) come i veicoli, con lo strumento che l'ha generata.
- **Una pelle per figura**, legata alle ossa. Accessori rigidi (casco, occhialoni, spallacci) si
  agganciano a un osso solo.
- **Niente animazioni registrate**: nessun file di animazione, né di Meshy né d'altri. Le persone si
  muovono **con pose calcolate dal codice**, come oggi i veicoli. Motivi: le pose dipendono dal veicolo
  (dove sono le prese), devono seguire il movimento vero del veicolo fotogramma per fotogramma, e una
  funzione pura si prova con un test.
- **Come è fatta ogni animazione**:
  1. una funzione pura calcola la posa del busto e della testa dallo stato del veicolo (inclinazione,
     urti, mira), in `src/app/motion/`;
  2. mani e piedi vanno alle prese con la cinematica inversa a due ossa, **dentro i limiti del §15.3**;
  3. se una presa esce dalla portata, la mano resta al limite e il busto si sposta verso la presa
     quanto gli permettono i suoi limiti; la presa non si insegue mai oltre;
  4. i numeri stanno in `presentation_base.json`, sotto `motion.crew`.
- **Prova obbligatoria**: ogni animazione ha un test che la porta ai suoi estremi su ogni veicolo
  approvato e verifica limiti e compenetrazioni con le funzioni del collaudo (§18).

### 19.3 Le animazioni, per ruolo

Le guidano i fotogrammi delle regole (ADR-0005) e il movimento del veicolo, mai le regole stesse.

| Momento | Pilota (auto, Big Rig, elicottero) | Motociclista | Artigliere | Copilota |
|---|---|---|---|---|
| Fermo, motore acceso | mani sul volante, vibra con il veicolo | piede a terra se è fermo da più di 2 s | mani sull'arma, guarda intorno | si guarda intorno |
| Guida | segue il volante, busto verso l'interno della curva | piega più della moto, ginocchio interno aperto | si tiene, il busto compensa il rollio | si tiene alla maniglia |
| Frenata, accelerazione | busto avanti o indietro | sposta il peso sulla sella | si regge all'arma | busto avanti o indietro |
| Derapata, sbandata | controsterzo, testa verso la strada | busto e testa verso la strada | si aggrappa | si aggrappa |
| Salto della rampa | braccia tese, testa indietro | in piedi sulle pedane, poi assorbe l'atterraggio | si abbassa | si copre la testa |
| Sparo | resta alla guida (auto piccola ed elicottero: l'arma la comanda lui, senza staccare le mani) | chino dietro l'arma, oppure uzi nella sinistra | mira con torretta e alzo, scosso a ogni colpo | indica il bersaglio |
| Colpo subito | scossone verso il lato opposto al colpo | scossone, la moto sbanda | scossone, perde la mira un attimo | si ripara |
| Slam | urto in avanti o di lato, testa che segue in ritardo | quasi disarcionato, si riprende | si aggrappa all'arma | urto di lato |
| Fuori uso | accasciato sul volante | accasciato sul serbatoio | accasciato sull'arma | accasciato |
| Eliminazione | salta fuori dall'`exit_*`, o resta nel relitto | sbalzato via | sbalzato via o salta | salta fuori |
| In fiamme (Carnage) | si agita, batte sulle fiamme | si agita | si agita | si agita |
| Vittoria | pugno alzato | impennata e braccio alzato | arma verso il cielo | braccia alzate |

- **Ordine di realizzazione**: prima "Fermo" e "Guida" per ogni ruolo, verificati col collaudo; poi il
  resto, una riga alla volta.
- **Livelli di dettaglio**: restano quelli del §8.1 (E0-E3).

## 20. La scheda di produzione e i prompt

Oggi le informazioni su un modello sono sparse tra scheda di montaggio, cinque file di prompt,
`asset-status.md`, `provenance.yaml` e le note del piano di integrazione. Da qui in avanti **ogni modello
ha una sola scheda di produzione**, e tutto il resto si ricava da lei.

### 20.1 Dove stanno i dati

| File | Contenuto | Chi lo legge |
|---|---|---|
| `data/trv/modelli/regole.json` | figura standard (§15), misure dei posti (§16.1), scala e classi (§16.2, §16.3), tolleranze (§18), budget (§8), **blocchi dei prompt** | script, test, inspector |
| `data/trv/modelli/<id>.json` | scheda di produzione di un modello (§20.2) | script, inspector |
| `assets/<gioco>/modelli/schede/<id>.json` | scheda di montaggio (§9): resta com'è, la legge il gioco | gioco, script |
| `design/art/modelli-strutturati.md` | questo documento: le regole spiegate | persone, inspector |

I file `design/art/*-prompts.md` sono stati travasati nelle schede (`tools/models/travaso_prompt.py`) e cancellati (decisione dell'utente,
2026-11-21).

### 20.2 Cosa contiene una scheda di produzione

- **Identità**: id, nome, gioco (base, Big Rig…), classe, a cosa serve.
- **Misure**: lunghezza reale e sul tavolo, larghezza, ruote, posti con le loro misure.
- **Pezzi**, uno per file da generare. Per ogni pezzo:
  - nome del file, tipo (carrozzeria, ruota, arma, figura, accessorio), budget;
  - **prompt per Gemini** e **prompt e impostazioni per Meshy**, già composti;
  - le immagini da allegare (dima, riferimento di stile);
  - **i tentativi**: data, strumento, quale prompt, esito, motivo dello scarto.
- **Stato**: a che passo del §10 è il modello, e da quando.
- **Collaudi**: l'ultimo rapporto del collaudo dimensionale e del controllo automatico.
- **Decisioni dell'utente** su quel modello, con la data.
- **Provenienza**: i dati che oggi stanno in `provenance.yaml`.

### 20.3 Come sono fatti i prompt

Un prompt non si scrive più a mano per intero: si **compone** da blocchi tenuti in `regole.json`.

| Blocco | Contenuto | Vale per |
|---|---|---|
| Stile | il blocco di stile unico (nato per il Big Rig il 2026-11-19): modellino vero, metallo opaco scrostato, fondo grigio chiaro | tutti i pezzi |
| Colore e usura | le regole del §7.1: vernice in un solo grigio chiaro neutro, usura con colori suoi (ruggine, metallo nudo, fango), piastre di riparazione non verniciate | tutti i pezzi tinti |
| Tipo di pezzo | le regole del §10.1 per carrozzeria, ruota, arma; quelle del §15.2 per la figura | per tipo |
| Dima | "stesse proporzioni dell'immagine allegata, la persona in trasparenza non va disegnata" | pezzi con posti |
| Specifico | ciò che rende unico quel pezzo | un pezzo |
| Modello chiuso | ogni parte è un solido chiuso con spessore, niente pannelli a faccia singola, niente buchi; per Meshy "watertight manifold mesh" (aggiunto il 2026-11-21) | **tutti i pezzi, sempre**, in Gemini e in Meshy |
| Meshy | Topology Triangle, Symmetry On, texture, triangoli dal budget | per tipo |

- Cambiare un blocco aggiorna tutti i prompt dei pezzi **non ancora generati**. I prompt già usati
  restano scritti nei tentativi, così si sa sempre con quale testo è nato un file.
- **Chi scrive**: i blocchi e la parte specifica li scrive Claude, li approva l'utente. Le impostazioni
  di Meshy vanno verificate dall'utente sull'interfaccia di Meshy di oggi.

## 21. Nell'inspector

L'inspector dell'admin prende una sezione nuova, **Produzione modelli**, che legge i file del §20.1. Non
scrive nulla: i dati si cambiano nel repository.

- **Regole**: questo documento, impaginato, con le tabelle delle misure lette da `regole.json` (così
  testo e numeri non possono divergere).
- **Elenco dei modelli**: per ognuno la classe, il passo del §10 a cui è arrivato, l'esito dell'ultimo
  collaudo.
- **Scheda di un modello**:
  - misure e posti;
  - pezzi, ciascuno con i suoi prompt e un tasto **Copia**, le immagini da allegare da scaricare, la
    storia dei tentativi;
  - rapporto del collaudo, con le immagini delle pose;
  - **visore 3D** con tre interruttori: dima sovrapposta, figura standard ai posti, punti di contatto e
    perni. Un cursore porta le parti mobili ai loro estremi.
- **Commenti**: quelli che l'inspector ha già, uno per modello.

## 22. Chi fa cosa e prossime fasi

| Cosa | Chi |
|---|---|
| Regole, schede, dima, blocchi dei prompt | Claude scrive, l'utente approva |
| Concept (Gemini) e modelli (Meshy) | l'utente |
| Collaudi, montaggio, alleggerimento | script |
| Aspetto del modello e delle pose | l'utente, sulle immagini e nell'inspector |
| Codice del gioco e animazioni | Claude, solo su modelli collaudati |

**Fasi**

| Fase | Cosa | Finita quando |
|---|---|---|
| A | Questa revisione della specifica | l'utente l'approva |
| B | `regole.json`, schede di produzione, travaso dei prompt, sezione dell'inspector | ogni modello di oggi ha la sua scheda e si legge nell'inspector |
| C | Script della dima e del collaudo; figura standard come manichino | le dime dei veicoli del §16.3 passano il collaudo dei posti e l'utente approva le sagome |
| D | Prova completa su un veicolo: **Auto Media ridisegnata, con il pilota** | concept e modello nuovi sulla dima, pilota seduto con le mani sul volante mentre sterza, collaudo passato, approvato dall'utente |
| E | Artigliere dell'Auto Media | come sopra, con la torretta ai suoi estremi |
| F | Auto piccola e auto grande ridisegnate | come la fase D |
| G | Moto (dal ramo `moto-in-pausa`, ridisegnata sulla dima), Big Rig, relitti, elicottero; poi ADR del formato | — |

Finché un veicolo non è ridisegnato, nel gioco resta quello di oggi con le misure di oggi.

**Stato al 2026-11-21**: fasi A, B e C chiuse. Le dime di auto piccola, media e grande, moto e delle tre
sezioni del Big Rig passano il collaudo dei posti e sono approvate dall'utente (`data/trv/modelli/*_v2.json`,
`moto_2.json`). Rimandati alla fase D, perché servono i modelli nuovi: il confronto del modello con la dima
(§18, punti 1 e 5-7), la dima sovrapposta al modello nell'inspector e lo script da riga di comando
(le viste oggi si scaricano dall'inspector).
