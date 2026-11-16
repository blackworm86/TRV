# Relitti: prompt per altri modelli 3D (varietà sul tavolo)

Oggi il gioco ha un solo modello di relitto (`assets/models/wreck_1.glb`). Ogni relitto sul tavolo
ne sceglie uno in base al suo id (`MODEL.wrecks` in `prototypes/trv-play-spike/models-config.ts`):
basta aggiungere i file e il gioco li alterna.

## Regole comuni a tutti i relitti

- Occupano **una casella** e contano come un'**auto piccola** (regolamento): circa 22 mm di
  lunghezza sul tavolo, mai più lunghi di una casella. Si leggono meglio se sono bassi e larghi.
- Stile del gioco: post-apocalittico desertico, forme robuste e un po' esagerate, colori saturi
  dipinti a mano, ruggine, sabbia, bruciature. Come una miniatura da gioco da tavolo, non realistico.
- Niente colori delle crew (grigio, verde, arancio, azzurro): il relitto non è di nessuno.
- Meshy: **Image to 3D** dal concept, Triangle, circa **5.000 triangoli**, texture **1024**,
  oggetto unico, base piatta a terra, muso verso un lato dichiarato (mi dici quale).
- Formato **GLB**, un oggetto per file: `wreck_2.glb`, `wreck_3.glb`, … in `assets/models/`.

## 1. Carro armato sventrato

Gemini:
```
Concept art of a single object on a plain white background: the burnt-out wreck of a small
battle tank in a Mad Max style post-apocalyptic desert board game. Turret knocked askew with a
bent, drooping cannon barrel, one track snapped and lying flat, scorched and rusted armour plates,
a few sandbags and a torn camouflage net draped over it, desert sand piled against the hull.
Stylized, chunky, slightly exaggerated shapes, bold saturated colours, hand-painted texture,
clean readable silhouette, like a premium board game miniature. Low and wide. Three-quarter view
from the front-left. No people, no ground, no text, no logos.
```

Meshy (testo, se serve):
```
Low poly game-ready burnt-out small battle tank wreck, turret askew, bent drooping cannon, one
snapped track lying flat, scorched rusty armour, sandbags and torn camo net, sand piled against
the hull. Stylized hand-painted look, chunky shapes, single object, flat base.
```

## 2. Pick-up ribaltato

Gemini:
```
Concept art of a single object on a plain white background: a rusty pickup truck flipped onto
its roof in a Mad Max style post-apocalyptic desert board game. Wheels in the air, one wheel
missing, crushed cab, shattered windows, the open bed spilling oil drums and scrap, faded paint
under heavy rust and bullet holes. Stylized, chunky, slightly exaggerated shapes, bold saturated
colours, hand-painted texture, clean readable silhouette, like a premium board game miniature.
Low and wide. Three-quarter view from the front-left. No people, no ground, no text, no logos.
```

## 3. Autobus scolastico tagliato a metà

Gemini:
```
Concept art of a single object on a plain white background: the front half of a yellow school
bus, torn in half, lying on its side in a Mad Max style post-apocalyptic desert board game.
Ragged torn metal at the cut, rusted and sand-blasted yellow paint, broken windows, flat tyres,
welded-on spikes and armour plates from a past raider life. Stylized, chunky, slightly
exaggerated shapes, bold saturated colours, hand-painted texture, clean readable silhouette, like
a premium board game miniature. Short, low and wide. Three-quarter view from the front-left. No
people, no ground, no text, no logos.
```

## 4. Muscle car carbonizzata

Gemini:
```
Concept art of a single object on a plain white background: a charred 1970s muscle car wreck in
a Mad Max style post-apocalyptic desert board game. Burnt black and rust-orange body, hood blown
open with the engine block exposed, a supercharger torn loose, bare wheel rims, still faintly
smoking. Stylized, chunky, slightly exaggerated shapes, bold saturated colours, hand-painted
texture, clean readable silhouette, like a premium board game miniature. Low and wide.
Three-quarter view from the front-left. No people, no ground, no text, no logos.
```

## 5. Rimorchio-cisterna squarciato

Gemini:
```
Concept art of a single object on a plain white background: a short burst fuel tanker trailer
wreck in a Mad Max style post-apocalyptic desert board game. Ruptured cylindrical tank with
peeled-back metal, black soot streaks, dripping dark fuel, broken hitch and two flat tyres,
hazard warning stripes half burnt away. Stylized, chunky, slightly exaggerated shapes, bold
saturated colours, hand-painted texture, clean readable silhouette, like a premium board game
miniature. Low and wide. Three-quarter view from the front-left. No people, no ground, no text,
no logos.
```

Per la variante Meshy di 2-5 si usa lo stesso schema della 1: «Low poly game-ready …» con la
descrizione accorciata, «stylized hand-painted look, chunky shapes, single object, flat base».
