# Modelli strutturati: veicoli con parti mobili ed equipaggio

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-19
> **Richiesta dell'utente (2026-11-19)**:
> - modelli più strutturati, con parti mobili (ruote indipendenti, sospensioni, torrette, armi), per
>   animazioni più complete e realistiche;
> - continuare a generarli con Gemini e Meshy, con una struttura di lavoro e software più precisa;
> - prevedere **piloti ed equipaggio animati a bordo**, con modelli generati proceduralmente, che si
>   muovono, guidano e usano le armi;
> - tenere in programma "paint your models".
>
> **Si collega a**: `design/art/art-bible.md` (§3.4-3.6 sagome, §5 personaggi), `design/art/big-rig-prompts.md`,
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
| `hitch_front`, `hitch_rear` | snodo tra le sezioni | Y (e poco Z) | limiti `yaw`, `pitch` | Big Rig |
| `door_*`, `hatch_*` | apertura | asse del cardine | `open: rad` | facoltativi |
| `launcher` | come `turret` + `gun` | — | `tubes: n` | lanciamissili del Big Rig |

**I nomi vanno scritti esattamente così**: inglese, minuscole, `_`. Un nome sconosciuto viene ignorato
(parte decorativa); un nome obbligatorio che manca ferma il controllo (§10.2).

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

## 10. Il flusso di lavoro

| Passo | Chi | Strumento | Risultato |
|---|---|---|---|
| 1. Scheda | la scrive Claude, la approva l'utente | — | `schede/<id>.json`: pezzi, posti, prese |
| 2. Concept | utente | **Gemini** | una tavola per pezzo, su fondo neutro: vista tre quarti, di lato e dall'alto |
| 3. 3D | utente | **Meshy** (Image to 3D) | un GLB per pezzo (carrozzeria senza ruote, ruota, torretta, arma…) in `assets/sorgenti/` |
| 4. Montaggio | script; l'utente ritocca | **Blender 5.0** con `tools/models/assemble.py`, senza aprire Blender | GLB con gerarchia, perni, zone ed `extras` |
| 5. Ritocco | utente, se serve | Blender, a mano | perni e posti spostati a occhio; lo script li rilegge dai nodi vuoti |
| 6. Alleggerimento | script | `tools/art/compress_models.py` (esiste già) | texture JPEG ≤ 1024 |
| 7. Controllo | automatico | test unitario `tests/unit/view/models.test.ts` | nomi, assi, perni, `clear` dei posti, budget, scala |
| 8. Gioco | Claude | `src/view/` | caricatore per nomi, animazioni nuove |

### 10.1 Regole per i prompt (passi 2 e 3)

- **Un pezzo per tavola**, mai il veicolo intero con le ruote.
- **Carrozzeria**:
  - passaruota vuoti e niente ruote;
  - niente armi sul tetto, al loro posto una base piatta;
  - abitacolo vuoto con i sedili, **nessuna persona**.
- **Ruota**: dritta, vista di lato e di tre quarti, mozzo centrato.
- **Arma**: canna orizzontale verso destra, base di montaggio in basso, impugnature visibili se l'arma è
  manuale.
- **Stile e colori**: quelli di `big-rig-prompts.md`. Pannelli grigio chiaro neutro dove andrà il colore
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

Tutte le domande aperte sono risolte: la specifica è pronta per la revisione dell'utente e per il pilota.
