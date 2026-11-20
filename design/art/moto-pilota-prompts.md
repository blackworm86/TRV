# Moto e pilota a pezzi: prompt per concept e modelli 3D

Richiesta dell'utente (2026-11-20): la moto delle Final Five diventa il **banco prova dei piloti**.
Il modello di oggi (`assets/big_rig/modelli/motorcycle.glb`) è un pezzo unico, moto e pilota fusi. Il
nuovo modello si divide in:

- la **moto**, con le **ruote** a parte;
- il **pilota**, un pupazzetto che si muove con le animazioni: piega, derapata, impennata, salto;
- le **armi**: una piccola mitragliatrice montata sulla moto, **oppure** un'uzi nella mano **sinistra**.

L'obiettivo è avere più moto e più piloti. Si comincia dalla **prima moto** e dal **primo pilota**.
Sostituisce il §2 di [big-rig-prompts.md](big-rig-prompts.md). Le regole di stile e colore sono le
stesse (§ Regole comuni e §1.2 di quel file):

- render di un modellino vero, metallo verniciato opaco e scrostato;
- pannelli **grigio chiaro neutro** dove andrà il colore della squadra;
- metallo scuro per il resto.

## Cosa serve (cinque file)

| File | Cosa | Triangoli | Texture |
|---|---|---|---|
| `moto_1_body.glb` | la moto **senza ruote, senza pilota, senza arma** | 4.000 | 1024 |
| `moto_1_wheel.glb` | **una** ruota tassellata (la uso davanti e dietro, ridimensionata) | 800 | 512 |
| `moto_1_gun.glb` | la piccola mitragliatrice con il suo supporto | 1.200 | 512 |
| `uzi.glb` | l'uzi, da sola | 600 | 512 |
| `pilota_1.glb` | il pilota **in piedi, a braccia aperte** (posa a T o ad A) | 5.000 | 1024 |

## Regole per ogni pezzo

- **Moto.**
  - Forcella e manubrio fanno parte della moto.
  - **Niente ruote**: i due attacchi delle ruote, in fondo alla forcella e al forcellone, restano vuoti,
    con il mozzo visibile.
  - **Nessuna persona.** Sella vuota, pedane visibili.
  - Davanti al manubrio una **piastra piatta** dove si monta l'arma.
  - I **fianchi del serbatoio** restano lisci e chiari: lì metto il simbolo della moto.
- **Ruota.** Dritta, gomma tassellata con cerchio scuro, mozzo al centro. Vista di lato e di tre quarti.
- **Mitragliatrice.** Piccola, a una o due canne, canna orizzontale verso destra, supporto in basso.
- **Uzi.** Canna verso destra, impugnatura in basso, caricatore nell'impugnatura. Un po' più grossa del
  vero, per leggersi sul tavolo.
- **Pilota.**
  - Una figura intera, **in piedi**, braccia aperte a T o ad A, gambe un po' divaricate, dita chiuse.
  - Casco con occhialoni, giacca di cuoio, stivali, guanti.
  - La **schiena della giacca** ha un pannello **liscio e chiaro**: lì va la decalcomania della moto.
  - Le **spalle o il casco** chiari e poco saturi: lì va il colore della squadra.
  - **Nessuna arma in mano** e niente che sporga molto (mantelli lunghi, lance): l'arma è un file a sé.

## 1. Concept (Gemini)

Allega come riferimento di stile un concept già approvato, per esempio quello del Doom Buggy. Una
tavola per pezzo, nella stessa conversazione, così lo stile resta uguale.

**Blocco di stile** (in testa a ogni prompt, come per il Big Rig):

```
Photorealistic 3D render of a physical scale model miniature, like a studio product photo. Matte
painted metal with chipped paint, light rust, visible weld seams, rivets and bolts. Seamless light
grey studio backdrop, soft overhead lighting, soft contact shadow. Exactly the same rendering style,
materials, lighting and camera as the attached style reference image. Not a drawing, not an
illustration, no outlines, no cartoon shading, no labels, no text. One single object, nothing else
in the picture.
```

**1.1 La moto**

```
The model: an armoured post-apocalyptic combat motorcycle for a desert racing board game, WITHOUT
WHEELS and WITHOUT RIDER. Chunky dirt-bike frame, front fork and swingarm ending in empty wheel
hubs, handlebars with grips, empty seat, foot pegs, exhaust pipes, a few spikes and welded armour
plates. In front of the handlebars a small flat steel mounting plate, empty. Fuel tank and fairing
in pale neutral off-white grey with smooth, plain sides; frame and engine in dark rusty iron.
Robust, slightly oversized shapes. Camera three-quarter view from the front-left, slightly above.
```

**1.2 La ruota**

```
The model: one single knobby off-road motorcycle wheel, standing upright: chunky rubber tyre with
big knobs, dark rusty steel rim with spokes, centred hub. Camera three-quarter side view, slightly
above.
```

**1.3 La mitragliatrice montata**

```
The model: a small post-apocalyptic machine gun for a motorcycle, on a short mounting bracket
underneath: one or two short barrels pointing right, ammunition box on the side, dark rusty iron,
welds and bolts. Side view from the left, barrels pointing to the right.
```

**1.4 L'uzi**

```
The model: a compact submachine gun like an Uzi, slightly chunky and oversized, worn dark steel
with scratches, magazine inside the pistol grip, short barrel pointing right. Side view from the
left, barrel pointing to the right.
```

**1.5 Il pilota**

```
The model: a post-apocalyptic motorcycle rider, sculpted and painted like a tabletop miniature
figure, standing in a T-pose with arms straight out to the sides, legs slightly apart, hands closed
in fists, empty hands, looking forward. Helmet with goggles, dark leather jacket with a smooth plain
pale off-white panel on the back, pale off-white shoulder pads, gloves, heavy boots, a scarf.
Heroic but compact proportions, slightly big head and hands so it reads at small scale. Front view,
full body, feet on the ground.
```

Per il pilota serve anche la **vista di schiena** (stessa conversazione): `The same rider, seen from
behind.` Serve a Meshy per la schiena della giacca.

## 2. Meshy

- **Moto, ruota, armi**: Image to 3D dalla tavola del concept. Topology **Triangle**, Symmetry **On**
  (per le armi **Off**), triangoli e texture come nella tabella.
- **Pilota**: Image to 3D con le due viste (davanti e dietro) se Meshy accetta più immagini.
  Symmetry **On**.
  - Poi, se Meshy offre il **rigging automatico** per figure umane (Rig / Auto-rigging), usalo e
    scarica il GLB **con lo scheletro e senza animazioni**: lo muovo io dal codice.
  - Se il rigging non c'è o viene male, mandami il modello statico in posa a T: lo divido io in pezzi
    rigidi (testa, busto, braccia, avambracci, mani, cosce, gambe), come un pupazzetto snodato.
- **Esportazione**: GLB, un oggetto per file. La scala non conta, la sistemo io. Dimmi da che parte
  guarda il muso della moto (le auto arrivano con il muso verso −X).

## 3. Come lo uso nel gioco

- **La scheda di montaggio** della moto (`assets/big_rig/modelli/schede/moto_1.json`), come le auto:
  - `body`;
  - `fork`, la forcella che sterza;
  - le due ruote;
  - `turret` e `gun`, la mitragliatrice;
  - le prese `grip_L`, `grip_R`, `foot_L`, `foot_R`;
  - il posto `seat_rider`.
- **Il pilota** ha la sua scheda (`pilota_1.json`):
  - lo scheletro con i nomi fissi del §5.4 di [modelli-strutturati.md](modelli-strutturati.md);
  - la presa `hand_L` per l'uzi.
- **Nel gioco** il pilota si siede sul `seat_rider`:
  - le mani vanno alle manopole;
  - i piedi vanno alle pedane;
  - il corpo segue piega, derapata, impennata e salto.
- **Quando spara**:
  - con la mitragliatrice montata, resta chino e la torretta gira;
  - con l'uzi, la mano sinistra lascia la manopola e punta l'arma al bersaglio.
  - In entrambi i casi, a ogni colpo esce un bossolo.
- **Più moto e più piloti**: ogni nuova moto o pilota è un'altra coppia di file con la sua scheda.
  Le combinazioni si scelgono nei dati.

Fino all'arrivo dei modelli, il gioco usa un **pilota di prova** fatto di forme semplici, con lo stesso
scheletro: così le animazioni si provano subito e il modello vero lo sostituisce senza cambiare il
codice.
