# Rampa di lancio (Carnage at Devil's Run): prompt per concept e modello 3D

Il gioco oggi disegna una rampa provvisoria generata dal codice (`src/view/terrain/carnage3d.ts`,
`makeRamp`). Questo documento serve a sostituirla con un modello vero, fatto come le auto e
l'elicottero: concept con Gemini, modello con Meshy, file `.glb` in `assets/models/Ramp.glb`.

## Cosa deve essere

- Una rampa improvvisata per auto giocattolo da corsa nel deserto, stile post-apocalittico del gioco:
  piano chiaro e consumato con una **grande freccia gialla** dipinta che punta verso l'alto della
  salita, telaio di ferro arrugginito sotto, all'estremità alta un **palo o barra a strisce giallo-nere**,
  come sulle tessere (vedi The Drifts e The Scorcher).
- Si salta **solo in avanti** (regola confermata): la freccia e la salita indicano il verso del salto.
- Occupa **una casella**: circa 46 mm di lunghezza sul tavolo. L'auto grande è lunga 44 mm.
- Proporzioni: lunghezza 1, larghezza 0,8, altezza all'estremità alta 0,45. L'estremità bassa tocca terra.
- Leggera come gli altri modelli: circa 5.000 triangoli e texture 1024 × 1024. Le texture delle auto
  sono da 3 MB l'una, troppo per i computer lenti.

## 1. Concept con Gemini (immagine)

Incolla questo prompt (in inglese, rende meglio):

```
Concept art of a single object on a plain white background: a makeshift launch ramp for
toy-scale racing cars in a Mad Max style post-apocalyptic desert board game. A wedge-shaped
ramp: the sloped deck is weathered pale plywood and dented sheet metal, with a big bold yellow
arrow painted on it pointing up the slope. Underneath, a rusty welded steel frame with a few
bolts and braces. At the high end, a short yellow-and-black hazard-striped barrier post across
the full width. A couple of sandbags at the low end. Stylized, chunky, slightly exaggerated
shapes, bold saturated colours, hand-painted texture, clean readable silhouette, like a
premium board game miniature. Show it twice: a three-quarter view from the front-left and a
pure side view. No cars, no ground, no shadows on the background, no text, no logos.
```

Se il risultato è troppo realistico aggiungi: `cartoon style, flat colours, thick shapes`.
Se la freccia non si vede: `the yellow arrow covers most of the deck and is clearly visible`.

## 2. Modello con Meshy

Usa **Image to 3D** con la vista tre quarti del concept: è il modo più fedele.

Impostazioni:
- **Topology**: Triangle; **Target polycount**: 5.000 (low poly)
- **Symmetry**: On (la rampa è simmetrica tra sinistra e destra)
- **Texture**: PBR on, risoluzione **1024**
- **Pose**: nessuna (oggetto statico)

Se Meshy chiede anche un testo (o per Text to 3D, se il concept non basta):

```
Low poly game-ready model of a makeshift wedge-shaped car launch ramp. Weathered pale plywood
and sheet metal deck with a large painted yellow arrow pointing up the slope, rusty steel frame
underneath, a yellow-and-black hazard-striped barrier post across the high end, two sandbags at
the low end. Stylized hand-painted look, bold colours, chunky shapes. Single object, flat base,
low end touching the ground.
```

## 3. Esportazione

- Formato **GLB**, un solo oggetto. La scala non conta, la sistemo io.
- Orientamento: non importa, basta che mi dici da che parte sale. Le auto, per esempio, arrivano con il
  muso verso −X e il codice le gira.
- Mandamelo e lo metto in `assets/models/Ramp.glb`. Il gioco lo userà al posto della rampa provvisoria,
  ridimensionato a una casella e con la salita verso la tessera successiva.
