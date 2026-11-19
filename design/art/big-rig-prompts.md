# Big Rig e Final Five: prompt per concept e modelli 3D

Servono i modelli del tavolo per l'espansione *The Big Rig and the Final Five*: il **Big Rig** in tre
pezzi e **una moto** (le cinque moto delle Final Five usano lo stesso modello). Si fanno come le auto
e l'elicottero: concept con **Gemini**, modello con **Meshy** (Image to 3D), file `.glb`.

Le plance non c'entrano: quelle le disegni tu a mano.

## Regole comuni

- **Stile del gioco**: post-apocalittico desertico alla Mad Max, forme robuste e un po' esagerate,
  ruggine, sabbia, saldature. I concept sono il **render 3D di un modellino vero**: metallo verniciato
  opaco e scrostato, gomme vere, fondale grigio chiaro da studio, vista di tre quarti dall’alto. Non un
  disegno: le regole e il blocco di stile sono nel §1.2 e valgono anche per la moto.
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

## 1. Big Rig (ridisegnato il 2026-11-19)

Il primo modello non convince: i rimorchi sono pianali vuoti, le sezioni hanno misure diverse e in
curva si incastrano o sconfinano nelle caselle vicine. Il riferimento è il modellino del gioco
originale: **tre sezioni piene, di misura simile**, unite da un timone con un occhiello.

### 1.1 Cosa deve avere

**Forma (vale per tutte e tre le sezioni)**
- Ogni sezione è un **corpo chiuso e pieno**, un cassone blindato: niente pianali vuoti.
- Le tre sezioni hanno **la stessa lunghezza, la stessa larghezza e la stessa altezza del tetto**; solo
  la cabina della motrice può essere un po' più alta.
- Misure sul tavolo, con la casella lunga circa 46 mm:

  | Misura | Valore | Perché |
  |---|---|---|
  | Da perno a perno | 46 mm, una casella | ogni sezione sta al centro della sua casella |
  | Lunghezza del corpo | circa 34 mm, tre quarti di casella | lo spazio che resta è il giunto: in curva gli spigoli non si toccano |
  | Larghezza | circa 18 mm, poco più di metà della lunghezza | piegata, la sezione resta dentro la sua casella |
  | Altezza | circa 16 mm al tetto | sagoma bassa e compatta |

- **Estremità smussate**: gli spigoli davanti e dietro di ogni corpo sono tagliati a 45 gradi, visti
  dall'alto. Così le sezioni ruotano sul perno senza urtarsi.
- **Giunto**: ogni rimorchio ha davanti un **timone stretto** che finisce in un **occhiello**; la sezione
  davanti ha dietro un **gancio a perno verticale**. Il perno cade a metà dello spazio tra i due corpi.
  Nessuna parte di una sezione entra nell'altra.
- **Ruote**: tre assi nella motrice (uno davanti che sterza, due dietro), due assi in ogni rimorchio.
  Le ruote restano **dentro la larghezza** del corpo, sotto parafanghi blindati.

**Sistemi di ogni sezione** (dai comandi di ogni sezione nella plancia, `data/trv/big_rig_final_five.json`,
e dallo sparo dagli archi anteriore e posteriore)

| Sezione | Comandi della plancia | Cosa si vede sul modello |
|---|---|---|
| Motrice (anteriore) | Missile Launcher, Cow Catcher, Repair | **lanciamissili** a più tubi sul tetto, dietro la cabina; **rostro** a cuneo davanti; **mitragliatrice anteriore** in una piccola torretta sopra il cofano (arco frontale); cassetta degli attrezzi e ruota di scorta sul fianco |
| Centrale | Traction Drive, Airstrike, Repair | **vano motore** con griglie, due grossi scarichi verticali e ruote motrici più larghe; **piazzola** piatta con cerchio dipinto sul tetto, per l'elicottero; **braccio gru** ripiegato da officina |
| Posteriore | Hazard Dispenser, Targeting Computer, Repair | **portellone e scivolo** dietro, con barili e chiodi a tre punte; **parabola radar** e antenne sul tetto; **mitragliatrice posteriore** in una torretta rivolta all'indietro (arco posteriore); bombola e saldatrice sul fianco |

**Colori**: come nelle regole comuni. Pannelli del cassone grigio chiaro neutro, perché lì va il colore
della squadra; telaio, ruote, armi, rostro, scarichi e radar in metallo scuro.

### 1.2 Lo stile: lo stesso degli altri concept

La prima versione di questi prompt ha dato un disegno piatto a contorni neri, perché chiedeva
«drawings» e più viste sullo stesso foglio. Gli altri concept sono un'altra cosa: il **render 3D di un
modellino vero**, verniciato opaco, fotografato in studio di tre quarti dall'alto. Tre regole:

1. **Allega sempre un concept già approvato** (per esempio il buggy con la mitragliatrice) come
   riferimento di stile, oltre alla foto del modellino originale come riferimento delle proporzioni.
2. **Una sola vista per immagine**, di tre quarti dall'alto. Le viste di lato e dall'alto si chiedono
   dopo, una per volta, con le frasi in fondo al §1.3.
3. Mai le parole `drawing`, `sheet`, `concept art`, `illustration`, `hand-painted`: portano al disegno.

Ogni prompt qui sotto contiene già questo blocco di stile, uguale per tutti:

```
Photorealistic 3D render of a physical scale model miniature, like a studio product photo. Matte
painted metal with chipped paint, light rust, visible weld seams, rivets and bolts, real rubber
tyres. Seamless light grey studio backdrop, soft overhead lighting, soft contact shadow under
the model. Camera three-quarter view from the front-left, looking down from above. Exactly the
same rendering style, materials, lighting and camera as the attached style reference image. Not
a drawing, not an illustration, no outlines, no cartoon shading, no labels, no text.
```

### 1.3 Il camion intero (Gemini)

Allega: il concept di riferimento per lo stile e la foto del modellino originale per le proporzioni.

```
Photorealistic 3D render of a physical scale model miniature, like a studio product photo. Matte
painted metal with chipped paint, light rust, visible weld seams, rivets and bolts, real rubber
tyres. Seamless light grey studio backdrop, soft overhead lighting, soft contact shadow under
the model. Camera three-quarter view from the front-left, looking down from above. Exactly the
same rendering style, materials, lighting and camera as the first attached image (style
reference). Not a drawing, not an illustration, no outlines, no cartoon shading, no labels, no
text. Use the second attached image only as a reference for the proportions of the sections.
The model: a heavily armoured post-apocalyptic road train for a desert racing board game, made
of three separate sections in a straight row: a tractor at the front, a middle section and a
rear section. All three sections are solid, closed, boxy armoured bodies of the same length,
the same width and the same roof height, like three armoured wagons, not flatbeds. Each body is
short and compact, about twice as long as it is wide, with its four corners cut at 45 degrees
when seen from above. Between two sections there is a clear empty gap one third as long as a
body, crossed only by a thin tow bar ending in a ring, hooked on a vertical pin at the back of
the section in front; the bodies never overlap. Wheels stay inside the width of the body, under
armoured fenders: three axles on the tractor, two on each trailer.
Tractor: a low cab, a multi-tube missile launcher on the roof behind the cab, a small machine
gun on a pintle mount on the hood pointing forward, a heavy wedge-shaped cow catcher plow at the
front, a toolbox and a spare wheel on the side.
Middle section: an engine bay with grilles and two tall exhaust stacks, wider drive wheels, a
flat helipad with a painted circle on the roof, a small folded workshop crane arm.
Rear section: a rear hatch with a dumping chute holding oil drums and spiked caltrops, a radar
dish with antennas on the roof, a machine gun on a pintle mount pointing backward, a gas
cylinder and a welder on the side.
Body panels in pale neutral off-white grey paint; frame, roll bars, wheels, weapons, plow,
exhausts and radar in dark rusty iron. No people.
```

Correzioni pronte:
- esce ancora un disegno: `this must look like a photo of a real painted metal miniature, the same as the style reference image`;
- sezioni di misura diversa: `make the three bodies exactly the same length, width and roof height`;
- corpi troppo lunghi o attaccati: `shorter bodies, wider gaps, only the thin tow bar crosses the gap`;
- pianali vuoti: `closed armoured box bodies with a roof, no open flatbed`;
- troppo colore: `all body panels pale off-white grey, no red or yellow paint on the body`.

### 1.4 I pezzi, uno per immagine (Gemini, stessa conversazione)

Un pezzo per immagine, come chiede la specifica dei modelli strutturati
([modelli-strutturati.md](modelli-strutturati.md), §10.1): carrozzeria **senza ruote e senza armi**,
poi la ruota e le armi a parte. Così nel gioco le ruote girano, le armi ruotano e le sezioni si
piegano sui perni.

Carrozzeria della motrice, in **due passi**: prima si isola la motrice senza cambiarla, poi si tolgono
ruote e armi. Chiesto tutto insieme, Gemini ridisegna il pezzo e lo allunga.

Passo 1, isolare:
```
Edit the road train image you made. Do not redesign anything: erase the middle section, the
rear section and the tow bar, and leave the tractor, the front section, exactly as it is, pixel
for pixel: same shape, same length, same height, same panels, same camera, same backdrop. It
stays short and tall: a short sloped hood, then a tall boxy armoured cab whose rear wall is the
end of the vehicle. Closed doors, small dark armoured windows.
```

Passo 2, togliere ruote e armi:
```
Edit this last image. Change only three things and keep everything else identical, the same
shape, length, height, panels, camera and backdrop.
1. Remove all six wheels: empty wheel arches under the armoured fenders, the body resting on
its flat underside.
2. Remove the missile launcher: in its place a flat round mounting plate on the roof.
3. Remove the machine gun: in its place a smaller flat round mounting plate on the hood.
Do not make the body longer or lower. The rear wall of the cab is the end of the body: nothing
behind it, no flat deck, no platform, no chassis rails sticking out, only a short hook with a
vertical pin fixed to the rear wall. Doors stay closed, windows stay small and dark, the
interior is not visible. Keep the wedge-shaped cow catcher plow, the toolbox and the spare
wheel on the side. Not a drawing, no text.
```

Correzioni pronte per la motrice:
- più lunga o più bassa del concept: `too long and too low: make it as short and as tall as the tractor in the road train image`;
- pianale dietro la cabina: `remove the flat deck behind the cab, the cab rear wall is the end of the body`;
- porta aperta o interni in vista: `close the door, small dark windows, interior not visible`.

Carrozzeria della sezione centrale:
```
Edit the road train image you made: keep only the middle section, the wagon with the helipad,
exactly as it appears there, and remove the tractor and the rear section. Same photorealistic
3D render style, same materials, same light grey studio backdrop, same three-quarter camera
from the front-left looking down. This is a trailer, not a truck: a plain closed armoured box
with corners cut at 45 degrees, the same at the front and at the back. It has no cab, no hood,
no nose, no windscreen, no side windows, no doors, no seats, no headlights, no radiator grille
at the front. Remove the wheels: empty wheel arches, the box resting on its flat underside.
Keep the side grilles of the engine bay and the two tall exhaust stacks, the flat helipad with
a painted circle on the roof, the folded workshop crane arm, the thin tow bar ending in a ring
at the front and the hook with a vertical pin at the back. Not a drawing, no text.
```

Carrozzeria della sezione posteriore:
```
Edit the road train image you made: keep only the rear section, the wagon with the radar dish,
exactly as it appears there, and remove the tractor and the middle section. Same photorealistic
3D render style, same materials, same light grey studio backdrop, same three-quarter camera
from the front-left looking down. This is a trailer, not a truck: a plain closed armoured box
with corners cut at 45 degrees. It has no cab, no hood, no nose, no windscreen, no side
windows, no doors, no seats, no headlights, no radiator grille at the front. Remove the wheels:
empty wheel arches, the box resting on its flat underside. Remove the machine gun: a flat round
mounting plate on the roof near the back where it was. Keep the rear hatch with the dumping
chute, the oil drums and the spiked caltrops, the radar dish with antennas on the roof, the gas
cylinder and the welder on the side, and the thin tow bar ending in a ring at the front. Not a
drawing, no text.
```

Se un rimorchio esce ancora con il muso della motrice, apri una **conversazione nuova**, allega solo
l'immagine del camion intero e incolla di nuovo il prompt del rimorchio: nella stessa conversazione
Gemini tende a copiare l'ultima immagine fatta, cioè la motrice. In alternativa, genera i due rimorchi
**prima** della motrice.

Ruota (una sola, vale per tutti gli assi):
```
Same photorealistic 3D render style, same materials, same light grey studio backdrop. Show only
one wheel of that road train, alone, standing upright, three-quarter view: a chunky off-road
truck tyre with deep tread on a dark rusty iron rim with a centred hub and bolts. Not a
drawing, no text.
```

Lanciamissili:
```
Same photorealistic 3D render style, same materials, same light grey studio backdrop,
three-quarter view. Show only the missile launcher of that road train, alone: a box of six
short missile tubes in dark rusty iron on a round rotating base, tubes horizontal and pointing
to the right, mounting ring underneath. Not a drawing, no text.
```

Mitragliatrice (una sola, usata davanti e dietro):
```
Same photorealistic 3D render style, same materials, same light grey studio backdrop,
three-quarter view. Show only the machine gun of that road train, alone: a heavy machine gun
with an ammunition belt and box on a pintle mount with a small armoured gun shield, in dark
rusty iron, barrel horizontal and pointing to the right, round mounting base underneath. Not a
drawing, no text.
```

Altre viste dello stesso pezzo, se servono a Meshy (una richiesta per vista, subito dopo il pezzo):
```
Same object, same photorealistic 3D render style and backdrop. Move only the camera: straight
side view, nose to the right.
```
```
Same object, same photorealistic 3D render style and backdrop. Move only the camera: straight
from above, nose to the right.
```

### 1.5 Meshy

Image to 3D, un'immagine per volta (o più viste dello stesso pezzo, se le hai generate). Il testo qui
sotto si aggiunge all'immagine, oppure serve da solo in Text to 3D se l'immagine non basta.

Carrozzeria della motrice:
```
Low poly game-ready body of an armoured post-apocalyptic truck tractor, short and tall, solid
closed boxy shape about twice as long as wide: a short sloped hood, then a tall boxy cab whose
rear wall is the end of the body, no deck or platform behind the cab. Closed doors, small dark
windows. Wedge-shaped cow catcher plow at the front, toolbox and spare wheel on the side, short
hook with a vertical pin on the rear wall. No wheels, empty wheel arches under armoured fenders. No
weapons, a flat round mounting plate on the roof behind the cab and a smaller one on the hood.
Pale off-white grey painted armour panels, dark rusty iron frame and plow. Realistic painted
metal scale model look, chipped paint, weld seams and rivets, single object, flat underside.
```

Carrozzeria della sezione centrale:
```
Low poly game-ready body of an armoured post-apocalyptic trailer wagon, a plain closed armoured
box about twice as long as wide, corners cut at 45 degrees seen from above, the same at the
front and at the back: no cab, no hood, no windscreen, no windows, no doors. Engine bay with grilles
and two tall exhaust stacks, flat helipad with a painted circle on the roof, small folded crane
arm, thin tow bar ending in a ring at the front, hook with a vertical pin at the back. No
wheels, empty wheel arches under armoured fenders. Pale off-white grey painted armour panels,
dark rusty iron frame and exhausts. Realistic painted metal scale model look, chipped paint,
weld seams and rivets, single object, flat underside.
```

Carrozzeria della sezione posteriore:
```
Low poly game-ready body of an armoured post-apocalyptic trailer wagon, a plain closed armoured
box about twice as long as wide, corners cut at 45 degrees seen from above: no cab, no hood,
no windscreen, no windows, no doors. Rear hatch with a
dumping chute holding oil drums and spiked caltrops, radar dish with antennas on the roof, gas
cylinder and welder on the side, thin tow bar ending in a ring at the front. No wheels, empty
wheel arches under armoured fenders. No weapons, a flat round mounting plate on the roof near
the back. Pale off-white grey painted armour panels, dark rusty iron frame and radar. Realistic
painted metal scale model look, chipped paint, weld seams and rivets, single object, flat
underside.
```

Ruota:
```
Low poly game-ready off-road truck wheel, chunky rubber tyre with deep tread, dark rusty iron
rim with centred hub and bolts. Realistic scale model look, single object.
```

Lanciamissili:
```
Low poly game-ready missile launcher, box of six short tubes on a round rotating base with a
mounting ring underneath, dark rusty iron. Realistic painted metal scale model look, single object.
```

Mitragliatrice:
```
Low poly game-ready heavy machine gun with ammunition belt and box on a pintle mount with a
small armoured gun shield, round mounting base underneath, dark rusty iron. Realistic painted
metal scale model look, single object.
```

Impostazioni Meshy:

| Pezzo | Triangoli | Texture | Symmetry |
|---|---|---|---|
| Ogni carrozzeria | circa 4.500 | 1024 | On |
| Ruota | circa 400 | 512 | On |
| Lanciamissili | circa 800 | 512 | On |
| Mitragliatrice | circa 600 | 512 | On |

Topology **Triangle** per tutti. Con sette assi di ruote e le armi, il camion resta sotto i 18.000
triangoli previsti dalla specifica.

**Se preferisci la via corta**: genera le tre sezioni intere, con ruote e armi attaccate, usando i
prompt del §1.4 senza le frasi `No wheels` e `No weapons`. Il camion si piega lo stesso sui perni, ma
le ruote non girano e le armi non ruotano.

### 1.6 Come lo uso nel gioco

- Ogni sezione sta al **centro della sua casella**; i perni sono a mezza casella davanti e dietro.
- I rimorchi seguono la sezione davanti ruotando sul perno.
- La mitragliatrice anteriore mira nell'arco frontale, quella posteriore nell'arco posteriore; il
  lanciamissili ruota verso il bersaglio.
- Mandami i `.glb` in `assets/sorgenti/` e dimmi da che parte guarda il muso. Monto io i pezzi, metto i
  perni e porto tutto alla scala del tavolo. Fino ad allora il gioco usa il modello di oggi.

## 2. Moto delle Final Five

Una moto da combattimento con il **pilota in sella** (senza pilota sembrerebbe parcheggiata). Sul
tavolo è un **veicolo piccolo**: lunga quanto l'auto piccola (circa 22 mm) ma molto più stretta.
Ha un'**arma** davanti al manubrio, perché spara come le auto.

Le cinque moto si distinguono per il **simbolo** del loro cruscotto (due linee, X, V, cerchio, onda):
quello lo aggiungo io dal codice. Per questo i **fianchi del serbatoio** devono restare **lisci e
chiari**, senza decorazioni.

### 2.1 Concept (Gemini)

Allega un concept già approvato (per esempio il buggy con la mitragliatrice) come riferimento di stile.

```
Photorealistic 3D render of a physical scale model miniature, like a studio product photo. Matte
painted metal with chipped paint, light rust, visible weld seams, rivets and bolts, real rubber
tyres. Seamless light grey studio backdrop, soft overhead lighting, soft contact shadow under
the model. Camera three-quarter view from the front-left, looking down from above. Exactly the
same rendering style, materials, lighting and camera as the attached style reference image. Not
a drawing, not an illustration, no outlines, no cartoon shading, no labels, no text.
The model: an armoured post-apocalyptic combat motorcycle with its rider, for a desert racing
board game, the same scale and build as the reference vehicle. Chunky dirt-bike frame
with knobby tyres, a small twin machine gun mounted in front of the handlebars, exhaust pipes,
a few spikes and welded armour plates. Fuel tank and fairing panels in pale neutral off-white
grey with smooth, plain sides; frame, engine and weapon in dark rusty iron. The rider wears a
dark leather jacket, goggles and a helmet, leaning forward, sculpted and painted like a
miniature figure. Robust, slightly oversized shapes, clean readable silhouette. No logos.
```

Se la moto esce troppo sottile per leggersi sul tavolo: `chunkier, wider tyres and bigger armour plates`.

### 2.2 Meshy (testo, se serve)

```
Low poly game-ready post-apocalyptic armoured combat motorcycle with a rider leaning forward,
small twin machine gun in front of the handlebars, knobby tyres, welded armour plates. Pale
off-white grey fuel tank and fairing with plain smooth sides, dark rusty iron frame and engine.
Realistic painted metal scale model look, chipped paint, weld seams and rivets, single object,
flat base under the wheels.
```

## 3. Consegna

Mandami i file. Io li metto in `assets/big_rig/modelli/` (`big_rig_front.glb`, `big_rig_mid.glb`,
`big_rig_rear.glb`, `motorcycle.glb`), li misuro, li porto alla scala del tavolo e li coloro con il
colore della squadra. Fino ad allora il gioco usa segnaposto semplici.
