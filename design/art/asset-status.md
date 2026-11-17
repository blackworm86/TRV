# Stato degli asset

Controllo del 2026-11-17: cosa c'è nel gioco, per gioco e per tipo, e quanto è grafica ufficiale.
I dati vivi sono in `data/trv/assets_catalog.json` e nel pannello admin
(`admin.html`, scheda **Riepilogo**). Questo file ne è la fotografia e spiega le scelte.

## Gli stati

| Stato | Significato |
|---|---|
| **Ufficiale estratto** | Immagine ufficiale ritagliata dai file originali. |
| **Ufficiale ricalcato** | Vettoriale ricalcato dai file originali: forme e colori della grafica ufficiale. |
| **Disegnato dai dati** | Disegnato dal codice a partire dalle regole: giusto nei contenuti, ma non è la grafica ufficiale. |
| **Bozza** | Provvisorio, da sostituire o da confermare: modelli generati, disegni aperti. |

## Riepilogo

| Gioco | Estratto | Ricalcato | Dai dati | Bozza | Totale |
|---|---:|---:|---:|---:|---:|
| Gioco base | 10 | 23 | 13 | 15 | 61 |
| Choppe Shoppe | 11 | 39 | – | – | 50 |
| Carnage at Devil's Run | 9 | 12 | 12 | 1 | 34 |
| Big Rig and the Final Five | – | – | – | – | – |
| Extra Ammo | – | – | – | – | – |

## Dettaglio

### Gioco base

- **Ricalcati** (verificati da `tests/unit/admin/assets.test.ts`: c'è un tracciato per ogni faccia
  e ogni tipo):
  - dadi strada, acrobazia, slam, sparo, direzione;
  - segnalini pericolo (5 tipi e retro);
  - i tre cruscotti e la plancia comandi per ogni crew.
- **Estratti**: i segnalini danno. La sagoma del proprietario (`template.svg`) disegna la cornice
  rossa col bordo strappato e tutto il retro; dentro la cornice va la grafica stampata del fronte
  (`tools/art/save_damage_tokens.py`, ritagliata sui bordi della cornice rossa, in
  `assets/base/segnalini/danno/`), così non si vedono né la carta bianca né il bordo tagliato della
  scansione. Le sei Sbandate: la scansione ha solo quella in avanti; le altre cinque sono
  ricavate da questa spostando il chevron pieno nella casella della direzione, come sulle facce
  del dado direzione (avanti, avanti-sinistra, avanti-destra, indietro e le due diagonali
  indietro). È una ricostruzione: va confrontata con i segnalini fisici.
- **Dado movimento**: pallini semplici, colorati per crew.
- **Dai dati**: le 10 facce delle tessere strada e le mappe composte. La scansione ufficiale è
  già estratta in `assets/estratti/base/road_tiles/` e si confronta nel pannello (scheda
  "Confronta con la fonte"), ma il gioco non la usa ancora.
- **Bozze**:
  - i 9 modelli 3D (3 auto, elicottero, 5 relitti, generati con Meshy): le miniature
    ufficiali non hanno scansioni;
  - le 6 icone dell'interfaccia: non hanno un originale.

### Choppe Shoppe

- **Estratti**: gli 11 avatar dei personaggi (`assets/choppe_shoppe/avatar_personaggi/`, 512 px
  quadrati, `tools/art/save_leader_avatars.py`), per ridisegnare l'interfaccia.
- **Ricalcati**:
  - le 27 carte potenziamento, ridisegnate per il gioco (`src/view/cards.ts`): illustrazione
    ufficiale ritagliata senza la cornice della carta (`illustrazioni/`), pannello nero con il bordo
    strappato, nome e testo italiano impaginati per stare nel pannello (`data/trv/cards_it.json`),
    e i pittogrammi stampati, che non hanno parole (`pittogrammi/`: gittata di Rail Gun, Punt Gun e
    Rear Guns, i tre segnalini di Oil e Mine Dispenser). La carta ufficiale intera resta l'asset
    scaricabile;
  - le 11 plance dei capisquadra, ciascuna con il ritratto ufficiale estratto (11 su 11), più la
    plancia disegnata dal proprietario.

### Carnage at Devil's Run

- **Estratti**: i 6 pericoli nuovi col retro dell'espansione (arancione, col suo marchio) e i 2
  danni nuovi (ON FIRE, ONGOING EFFECT), come stampati (`tools/art/save_carnage_tokens.py`):
  ritagliati con le stesse sagome dei segnalini del gioco base; l'anello del segnalino ON FIRE.
- **Ricalcate**: le 11 carte effetto continuo, ridisegnate come le carte potenziamento, con il
  pannello rosso.
- **Ricalcato**: il dado fuoco, 6 facce. Il tracciato si rifà dal docx originale con
  `tools/art/trace_fire_die.py`, che dà un risultato identico byte per byte a quello in uso.
- **Dai dati**: le 10 facce delle tessere 6a–10b e le due mappe.
- **Bozza**: la rampa 3D.

## Ancora da fare

| Gioco | Cosa | Nota |
|---|---|---|
| Gioco base | Linea del traguardo | Nessuna grafica nelle scansioni. |
| Carnage | Tessere 6a–10b con la grafica ufficiale | Scansioni estratte (`estratti/expansions/road_v2`), da associare alle facce. |
| Choppe Shoppe | Segnalino comando | Non trovato nelle scansioni. |
| Big Rig and the Final Five | Plance, segnalini | Scansioni estratte (`big_rig`, `fast_five`); espansione non ancora nel gioco. |
| Extra Ammo | Carte | Nei fogli di `TRV v2.pdf`; espansione non ancora nel gioco. |

## Carte e segnalini del 2026-11-17

- **Font**: i titoli usano League Gothic (inclinato come sulle carte), il testo Barlow Condensed,
  entrambi da Google Fonts. I font ufficiali estratti (Compacta, Trade Gothic) non hanno le
  lettere accentate né alcune maiuscole, quindi non bastano per l'italiano.
- **Scansioni dei pericoli**: il foglio Danger Tiles contiene anche mina, olio e retro rosso del
  gioco base e cinque tessere di sabbia senza simboli; non sono segnalini dell'espansione e non
  sono stati salvati.

## Pulizia fatta il 2026-11-17

- **Doppioni eliminati**: 10 copie identiche byte per byte in 9 gruppi, tutte nelle immagini estratte
  delle espansioni.
  - Big Rig e Fast Five condividevano 6 immagini.
  - C'erano ripetizioni dentro Big Rig, dentro Fast Five, dentro Fire Tile (2 copie) e dentro
    Danger Tiles.
  - Prima di cancellare, l'hash di ogni copia è stato controllato contro quello dell'originale.
- **Archiviati, non cancellati** (in `assets/_archivio/`, fuori da git):
  - tentativi di estrazione precedenti delle tessere base (`road_pdf`, `tiles`);
  - la copia delle immagini del docx base (`components`): ora il dado fuoco si legge direttamente
    dal docx;
  - le viste di lavoro delle espansioni (`expansions_view`);
  - le texture del terreno (`terrain`, 244 MB), non usate dal codice.

## Dove stanno i file

```
assets/
  base/           modelli/, plance/, dadi/, segnalini/, vettoriale/ (ricalchi e font)
  choppe_shoppe/  carte/potenziamenti/ (con illustrazioni/, pittogrammi/), capisquadra/,
                  avatar_personaggi/, plance/
  carnage/        modelli/, carte/effetto_continuo/ (con illustrazioni/),
                  segnalini/ (pericolo/, danno/), vettoriale/
  sorgenti/       file ufficiali originali (PDF, docx) — fuori da git
  estratti/       immagini estratte dagli originali, regolamento compreso — fuori da git
  _archivio/      tentativi vecchi — fuori da git, da eliminare quando vuoi
  provenance.yaml
```

## Come si verifica

- `npm run test:unit` controlla che ogni carta, ritratto e modello previsto dai dati abbia il suo
  file, e che i ricalchi coprano tutte le facce e tutti i tipi (`tests/unit/admin/assets.test.ts`).
- Nel pannello admin aperto dal server di sviluppo (`npm run dev`, poi
  `/admin.html?admin=local`), la scheda **Confronta con la fonte** mette accanto il disegno del
  gioco e le scansioni estratte. Il sito pubblicato non le mostra, perché non le contiene.
- `npm run test:e2e` prova il pannello: riepilogo, filtri, avatar, carte digitali, vista 3D,
  confronto, commenti (`tests/integration/admin.spec.ts`). Le schermate delle carte nel gioco sono
  in `production/qa/evidence/trv-asset-carte-segnalini-2026-11-17/`.
