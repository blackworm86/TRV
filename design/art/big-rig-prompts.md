# Big Rig e Final Five: prompt per concept e modelli 3D

Servono i modelli del tavolo per l'espansione *The Big Rig and the Final Five*: il **Big Rig** in tre
pezzi e **una moto** (le cinque moto delle Final Five usano lo stesso modello). Si fanno come le auto
e l'elicottero: concept con **Gemini**, modello con **Meshy** (Image to 3D), file `.glb`.

Le plance non c'entrano: quelle le disegni tu a mano.

## Regole comuni

- **Stile del gioco**: post-apocalittico desertico alla Mad Max, forme robuste e un po' esagerate,
  colori saturi dipinti a mano, ruggine, sabbia, saldature. Una miniatura da gioco da tavolo, non realismo.
- **Colore della squadra**: il Big Rig e le moto sono una squadra come le auto, e il gioco dipinge il
  colore della squadra sulle **parti chiare e poco sature** del modello. Quindi:
  - carrozzeria (pannelli, cabina, serbatoio della moto) **grigio chiaro neutro**, quasi bianco sporco;
  - telaio, ruote, armi e meccanica in **metallo scuro**, ferro arrugginito, nero;
  - **niente** grandi superfici colorate (niente rosso, arancio, giallo sulla carrozzeria): sarebbero
    coperte male dal colore della squadra. Piccoli dettagli colorati (strisce di pericolo, luci) vanno bene.
- **Meshy**: Image to 3D dalla vista tre quarti del concept; Topology **Triangle**; circa **5.000
  triangoli** per pezzo (moto: **4.000**); texture PBR **1024**; Symmetry **On**; nessuna posa.
- **Esportazione**: GLB, un oggetto per file. La scala non conta, la sistemo io. Dimmi solo da che parte
  guarda il muso (le auto, per esempio, arrivano con il muso verso −X).

## 1. Big Rig

Sul tavolo è un camion lungo **tre caselle**: la **motrice** (sezione anteriore) e **due sezioni di
rimorchio** (centrale e posteriore), che si seguono lungo il percorso e possono stare in corsie
diverse. Ogni pezzo è quindi un modello a sé, lungo **una casella** (circa 46 mm, come un'auto grande),
con il gancio di traino alle estremità.

Ogni sezione mostra le sue armi e i suoi comandi (regolamento, pagina 6), così si riconoscono sul tavolo:

| Pezzo | File | Cosa deve vedersi |
|---|---|---|
| Motrice | `big_rig_front.glb` | **lanciamissili** sul tetto della cabina, **rostro spazzaneve** (cow catcher) davanti |
| Rimorchio centrale | `big_rig_mid.glb` | **piazzola dell'elicottero** sul tetto (Airstrike), **assale motore** in più con ruote grosse (Traction Drive) |
| Rimorchio posteriore | `big_rig_rear.glb` | **scivolo o tramoggia** dietro che lascia cadere barili e trappole (Hazard Dispenser), **antenna o radar di puntamento** (Targeting Computer) |

Tutti e tre: stessa **larghezza** e stessa **altezza del piano di carico**, così messi in fila sembrano
un camion solo. I due rimorchi sono **bassi e larghi**, non più alti della cabina.

### 1.1 Concept dell'intero camion (Gemini)

Prima un concept di tutto il camion, per fissare l'aspetto. Poi si chiedono i tre pezzi uno alla volta
**nella stessa conversazione**, così Gemini mantiene lo stesso disegno.

```
Concept art on a plain white background: a heavily armoured post-apocalyptic semi truck for a Mad
Max style desert racing board game, shown as three separate pieces in a row with small gaps
between them: the tractor cab at the front, then two short flatbed trailer sections, each piece
about as long as the cab. Body panels in pale neutral off-white grey, frame, wheels and weapons in
dark rusty iron. Tractor cab: a rocket launcher pod on the roof and a huge spiked cow catcher plow
on the front. Middle trailer: a small flat helipad with a painted circle on its deck and an extra
heavy drive axle with oversized wheels. Rear trailer: a dumping chute at the back with oil drums
and spiked caltrops, and a radar dish with antennas. Simple tow hitches joining the pieces. Same
width and same deck height for all three. Stylized, chunky, slightly exaggerated shapes, bold
hand-painted texture, clean readable silhouette, like a premium board game miniature. Side view.
No people, no ground, no text, no logos.
```

Se esce troppo colorato aggiungi: `all body panels pale off-white grey, no red or yellow paint on the body`.

### 1.2 I tre pezzi, uno per immagine (Gemini, stessa conversazione)

Motrice:
```
Now draw only the tractor cab from that truck, alone, as a single object on a plain white
background, three-quarter view from the front-left. Keep exactly the same design, colours and
proportions: pale off-white grey armoured body, rocket launcher pod on the roof, huge spiked cow
catcher plow on the front, tow hitch at the back. Stylized hand-painted board game miniature.
No ground, no text.
```

Rimorchio centrale:
```
Now draw only the middle trailer section from that truck, alone, as a single object on a plain
white background, three-quarter view from the front-left. Keep exactly the same design, colours
and proportions: short low flatbed trailer, pale off-white grey armour panels, a small flat
helipad with a painted circle on the deck, an extra heavy drive axle with oversized wheels, tow
hitches at both ends. Stylized hand-painted board game miniature. No ground, no text.
```

Rimorchio posteriore:
```
Now draw only the rear trailer section from that truck, alone, as a single object on a plain
white background, three-quarter view from the front-left. Keep exactly the same design, colours
and proportions: short low flatbed trailer, pale off-white grey armour panels, a dumping chute at
the back with oil drums and spiked caltrops, a radar dish with antennas, a tow hitch at the front.
Stylized hand-painted board game miniature. No ground, no text.
```

### 1.3 Meshy (testo, se serve)

```
Low poly game-ready armoured post-apocalyptic semi truck tractor cab, pale off-white grey body
panels, dark rusty iron frame and wheels, rocket launcher pod on the roof, big spiked cow catcher
plow at the front, tow hitch at the back. Stylized hand-painted look, chunky shapes, single
object, flat base.
```
Per i rimorchi sostituisci la parte centrale con la descrizione del pezzo (piazzola e assale motore,
oppure scivolo con barili e radar).

### 1.4 Modello unico da tagliare ai giunti (richiesto il 2026-11-18)

I tre pezzi fatti separatamente escono con proporzioni diverse: il rimorchio centrale è più largo,
e i ganci non cadono tutti alla stessa distanza dal centro. La soluzione è **un solo modello** del
camion intero, con i tre moduli già proporzionati, che poi taglio io in tre file nei punti di giunzione.

Come lo uso nel gioco (`src/view/rigchain.ts`):
- la **motrice** sta sempre al **centro della casella di destinazione**, dritta o obliqua;
- ogni **rimorchio** è agganciato al pezzo davanti e ruota attorno al **perno del gancio**.

Per questo il modello deve avere:
- **tre moduli della stessa lunghezza**, ognuno lungo **una casella** da perno a perno (circa 46 mm);
  il camion intero è quindi lungo circa **tre caselle**;
- **stessa larghezza** per i tre moduli, circa **metà della lunghezza** di un modulo, e stessa altezza
  del piano di carico;
- tra un modulo e l'altro un **giunto stretto e ben visibile**: una sola barra di traino corta con un
  **perno verticale al centro**, senza parti che si sovrappongono tra un modulo e l'altro (altrimenti il
  taglio si vede quando il camion curva);
- il camion **dritto**, ruote sullo stesso piano, nessuna parte che sporge di lato oltre la larghezza.

Concept (Gemini), da allegare poi a Meshy Image to 3D:
```
Concept art on a plain white background: a heavily armoured post-apocalyptic road train for a Mad
Max style desert racing board game, one single straight vehicle made of three modules of exactly
the same length and the same width: the tractor cab at the front, then a middle trailer, then a
rear trailer. Each module is about twice as long as it is wide. Between the modules there is a
short, narrow, clearly visible tow bar with a vertical pivot pin in its middle, and a small gap,
so the modules do not overlap. All three modules share the same deck height and the same width,
nothing sticks out sideways. Body panels in pale neutral off-white grey, frame, wheels and weapons
in dark rusty iron. Tractor cab: a rocket launcher pod on the roof and a huge spiked cow catcher
plow on the front. Middle trailer: a small flat helipad with a painted circle on its deck and an
extra heavy drive axle with oversized wheels. Rear trailer: a dumping chute at the back with oil
drums and spiked caltrops, and a radar dish with antennas. Stylized, chunky, slightly exaggerated
shapes, bold hand-painted texture, like a premium board game miniature. Three-quarter view from
the front-left. No people, no ground, no text, no logos.
```

Meshy (Text to 3D, oppure come testo insieme all'immagine):
```
Low poly game-ready armoured post-apocalyptic road train, one straight vehicle made of three
modules of identical length and identical width, each module about twice as long as wide: tractor
cab, middle trailer, rear trailer. Short narrow tow bars with a vertical pivot pin between the
modules and a small gap, modules not overlapping. Same deck height for all modules, nothing
sticking out sideways. Pale off-white grey body panels, dark rusty iron frame and wheels. Cab:
rocket launcher pod on the roof, big spiked cow catcher plow at the front. Middle trailer: flat
helipad on the deck, extra heavy drive axle with oversized wheels. Rear trailer: dumping chute
with oil drums at the back, radar dish with antennas. Stylized hand-painted look, chunky shapes,
single object, flat base under the wheels.
```

Impostazioni Meshy: Topology **Triangle**, circa **12.000 triangoli** in tutto (circa 4.000 per
modulo), texture PBR **2048** (una sola texture per tre moduli), Symmetry **On**.

Mandami il `.glb` intero e dimmi da che parte guarda il muso. Lo taglio io in `big_rig_front.glb`,
`big_rig_mid.glb` e `big_rig_rear.glb`, con l'origine di ogni pezzo nel suo centro e i perni a mezza
casella davanti e dietro.

## 2. Moto delle Final Five

Una moto da combattimento con il **pilota in sella** (senza pilota sembrerebbe parcheggiata). Sul
tavolo è un **veicolo piccolo**: lunga quanto l'auto piccola (circa 22 mm) ma molto più stretta.
Ha un'**arma** davanti al manubrio, perché spara come le auto.

Le cinque moto si distinguono per il **simbolo** del loro cruscotto (due linee, X, V, cerchio, onda):
quello lo aggiungo io dal codice. Per questo i **fianchi del serbatoio** devono restare **lisci e
chiari**, senza decorazioni.

### 2.1 Concept (Gemini)

```
Concept art of a single object on a plain white background: an armoured post-apocalyptic combat
motorcycle with its rider, for a Mad Max style desert racing board game. Chunky dirt-bike frame
with knobby tyres, a small twin machine gun mounted in front of the handlebars, exhaust pipes,
a few spikes and welded armour plates. Fuel tank and fairing panels in pale neutral off-white
grey with smooth, plain sides; frame, engine and weapon in dark rusty iron. The rider wears a
dark leather jacket, goggles and a helmet, leaning forward. Stylized, chunky, slightly
exaggerated shapes, bold hand-painted texture, clean readable silhouette, like a premium board
game miniature. Three-quarter view from the front-left. No ground, no text, no logos.
```

Se la moto esce troppo sottile per leggersi sul tavolo: `chunkier, wider tyres and bigger armour plates`.

### 2.2 Meshy (testo, se serve)

```
Low poly game-ready post-apocalyptic armoured combat motorcycle with a rider leaning forward,
small twin machine gun in front of the handlebars, knobby tyres, welded armour plates. Pale
off-white grey fuel tank and fairing with plain smooth sides, dark rusty iron frame and engine.
Stylized hand-painted look, chunky shapes, single object, flat base under the wheels.
```

## 3. Consegna

Mandami i file. Io li metto in `assets/big_rig/modelli/` (`big_rig_front.glb`, `big_rig_mid.glb`,
`big_rig_rear.glb`, `motorcycle.glb`), li misuro, li porto alla scala del tavolo e li coloro con il
colore della squadra. Fino ad allora il gioco usa segnaposto semplici.
