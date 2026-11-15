<!-- PROTOTYPE - NOT FOR PRODUCTION -->
# trv-play-spike — partita hot seat giocabile

**Ipotesi**: il gioco base di Thunder Road: Vendetta si gioca bene in hot seat sul tavolo 3D,
con le regole del regolamento applicate dal motore (`src/game/trv/engine.ts`) e il giocatore
che sceglie solo tra mosse legali (anelli sul tavolo o pulsanti).

**Come si avvia**: `npm run dev`, poi apri `http://localhost:5173/prototypes/trv-play-spike/`.
Serve la grafica estratta in `assets/licensed/_derived/base/` (locale, esclusa da git): chi possiede i
file ufficiali la rigenera con `python tools/assets/extract_base.py`. Senza, i pezzi restano grigi ma la
partita funziona.

**Stato**: in corso.

## Cosa c'è
- 2-4 giocatori, tessera di partenza 1a o 1b, tutte le 10 facce delle tessere con terreno e pericoli.
- Round e turni, dadi movimento, dado strada, inerzia, comandi (attacco aereo, nitro, drift, riparazione).
- Terreno (fango, invalicabile, bordi), pericoli (relitto, mina, strada, fango, olio), slam a catena con
  ritiro per il veicolo più grande, sparo, segnalini danno, elicotteri, avanzamento delle tessere,
  tessera finale, traguardo, vittoria per ultimo superstite.
- "Annulla ultima scelta" e ripresa automatica della partita (seed + scelte in localStorage).

## Interfaccia e grafica
- Layout dallo schizzo dell'utente: in alto io, gli avversari con i loro dadi e il dado strada; al centro
  la mappa; in basso i miei dadi, la plancia comandi, i tre cruscotti (danni appesi sotto, auto
  inoperativa capovolta) e l'elicottero. La cronaca è una riga sola: cliccandola si apre il registro.
- I dadi si trascinano su uno spazio libero (cruscotto: "ANY" o +1 inerzia; plancia: quadrante del
  comando), oppure si seleziona un dado e si clicca lo spazio. Clic su uno spazio senza dado
  selezionato: usa il primo dado libero che ci sta. Gli spazi validi si illuminano di verde.
- Grafica tutta vettoriale e provvisoria (`src/view/vector/art.ts`): tutti i dadi (movimento, strada,
  acrobazia, slam, sparo, direzione), segnalini pericolo e danno, cruscotti, plancia, elicottero.
- Mappa vettoriale (`src/view/board3d.ts`): ogni casella è un chevron estruso colorato per effetto
  (strada, fuoristrada, fango, invalicabile con doppio bordo giallo, pericolo in rosso); le tessere
  si incastrano a passo di 8 colonne. Nessuna immagine licenziata nel tavolo.
- Dadi tutti in 3D (`src/view/dice3d.ts`, facce vettoriali): i dadi tirati rotolano sul tavolo sotto la
  strada e restano lì fino al tiro successivo (mostrati al doppio della misura reale per leggerli); i dadi
  dell'interfaccia (miei, avversari, dado strada, dadi posati sulle plance) sono disegnati in 3D da un
  livello WebGL sopra la pagina.
- Segnalini pericolo 3D sulla strada (cartoncino con fronte e retro); si girano quando un'auto ci entra.
  Mina e relitto, scartati dopo l'effetto, restano scoperti per un attimo prima di sparire.
- Fasi del turno (p. 8) nella barra: Assegna, Comando, Movimento, Spara. Nel primo round lo sparo è
  barrato ("Your guns are not online until the second round", p. 10). Avviso a schermo per sparo,
  danni, pericoli ed eliminazioni.
- Animazioni: il motore registra una sequenza di fotogrammi (`Frame` in `engine.ts`: passo, tiro, slam,
  sparo, danno, eliminazione, pericolo scoperto, nuova tessera, inizio round, elicottero) e l'interfaccia
  li riproduce uno alla volta: auto che avanzano casella per casella, dadi che rotolano sul tavolo,
  scossone e onda d'urto negli slam, traccia dello sparo, lampo rosso sul danno, auto eliminate che
  spariscono, tessera nuova che scorre, riquadro di inizio round con i dadi di tutte le crew e il dado
  strada. "Salta" o la barra spaziatrice vanno subito alla fine.
- Spazi di movimento (e bersagli, caselle per l'elicottero) illuminati per intero: verde per muoversi,
  rosso se eliminano l'auto, giallo per sparare, azzurro per l'elicottero.
- Dado strada: quando è utilizzabile il dado in alto si illumina e compare il pulsante; quando non lo è,
  la cronaca dice perché (partita fuori strada o uscita dalla strada).
- Galleria degli asset: `gallery.html` (stessa grafica e stessi pezzi 3D, nessuna immagine licenziata).
- Misure dal catalogo fisico `data/trv/catalog_base.json` (stime, `measured: false`).

## Decisioni sulle regole (confermate dall'utente)
- Dado strada: un'auto che entra dall'area di partenza conta come partita su strada; può usarlo se
  si muove solo su caselle di strada (2026-11-15).

## Interpretazioni provvisorie (da confermare con l'utente)
- Sbandata: i 4 segnalini delle scansioni mostrano tutti "avanti"; il regolamento dice "6 segnalini diversi".
- Lato delle tessere pescate: casuale (il regolamento dice solo di mescolarle).

- Spinte oltre il fronte della tessera di testa (slam, danni): trattate come un'uscita dal fronte.
- Relitti spinti fuori da qualunque bordo: eliminati.
- Pericolo e auto nella stessa casella: prima si risolve il pericolo, poi lo slam.

## Risultati
- Il motore gioca 150 partite casuali (2-4 giocatori) fino alla vittoria, senza blocchi
  (`tests/unit/trv/engine.test.ts`).
- Prova a 1024×768: `production/qa/evidence/trv-play-spike/` (locale, contiene grafica licenziata).

## Comandi della telecamera

- Tasto sinistro: sposta il tabellone (pan). Tasto destro: ruota (orbita). Rotella: zoom.
- WASD o frecce: scorre la vista sul tavolo.
- Tab / Maiusc+Tab: passa da un'auto all'altra del giocatore di turno. 1, 2, 3: auto piccola, media, grande. F: l'auto che sta agendo.

## Modelli 3D

- File in `assets/models/` (creati dall'utente con Meshy, nel repository); tutto ciò che li riguarda (misure sul tavolo, ruote, rotori, vetro, molle) è in `models-config.ts`.
- Pagina di controllo: `models.html` (aggiungi `?drive` per vedere le auto guidare avanti e indietro).

## Grafica ufficiale in vettoriale e terreno in rilievo

Solo in locale: tutto ciò che deriva dalla grafica ufficiale sta in `assets/licensed/` (fuori da
git). Senza quei file il gioco usa i disegni liberi e le tessere a chevron colorati.

- `tools/asset-pipeline/trace.py` vettorizza le scansioni (colori campionati, contorni, curve);
  `pdf_fonts.py` estrae i caratteri incorporati nel regolamento. Il risultato è
  `assets/licensed/vector/official.ts`, che `src/view/vector/art.ts` usa per dadi, segnalini,
  cruscotti e plancia comandi. `?art=open` nell'indirizzo mostra i disegni liberi.
- `tools/asset-pipeline/terrain.py` trasforma una tessera del PDF print-and-play (circa 8400 px)
  in mappe di colore, altezza, normali, ruvidità e contorno (`assets/licensed/terrain/<faccia>/`).
  `buildTile` disegna la faccia in rilievo: sabbia sopra l'asfalto, fango sotto, roccia degli
  spazi invalicabili più alta, crepe incise; `world()` appoggia i pezzi sul terreno. Tutte le 10
  facce, una per volta:
  `python -I tools/asset-pipeline/terrain.py "assets/licensed/TRV 01 Base Game/Road Tiles Base.pdf" <oggetto> assets/licensed/terrain/<faccia> <faccia>`
  con oggetto 4, 7, 10, 13, 16, 19, 22, 25, 28, 31 per le facce 1a, 1b, 2a, 2b, 3a, 3b, 4a, 4b, 5a, 5b.
  La roccia sta solo sugli spazi X di `data/trv/game_base.json`.
- Terreno procedurale (`src/view/terrain/procedural.ts`, codice aperto, nessuna grafica licenziata): dalla
  sola griglia della faccia genera asfalto con crepe e segni di gomme, sabbia con dune e piante, pozze di
  fango, roccia rossa sugli spazi invalicabili (spazi X vicini fanno un unico blocco, nastro giallo-nero
  solo sul bordo esterno), linee della griglia e triangoli dei pericoli. Si usa quando mancano le mappe
  ufficiali, oppure con `?terrain=procedural`; `?terrain=flat` mostra i chevron colorati. Circa 0,6 s per
  faccia sul thread principale (da spostare in un worker).
- Pagine di controllo locali: `assets/licensed/vector/_review.html` (scansione accanto al
  vettoriale) e `_terrain.html?face=2a&view=low` (una faccia in rilievo con auto).

## Interfaccia ridisegnata (2026-11-15)

- **Command board e dashboard** dal disegno vettoriale dell'utente
  (`assets/ui/command_dashboard.svg`, nel repository): `src/view/vector/boards.ts` ne ricava
  le quattro plance e ci scrive sopra testi, dadi e danni. Senza il file si torna ai disegni
  precedenti. La command board è più alta delle dashboard, perché è quella da leggere.
  Manca ancora il retro delle dashboard.
- **Giocatori** in bolle fluttuanti sopra la mappa, con bagliore su chi è di turno; mostrano
  dadi, auto con i danni, comando usato ed elicottero in campo.
- **Fasi del turno** come nastro a frecce sopra le plance.
- **Elicottero non in campo** in 3D accanto alle dashboard.
- **Terreno e informazioni separati**: il terreno procedurale non ha più segni stampati; linee
  delle caselle, nastro giallo-nero e triangoli dei pericoli stanno su un livello a parte
  (pulsante ▦ o tasto G per nasconderlo).
- **Ostacoli 3D** sulle caselle invalicabili: rocce, mesa, rovine, bunker, barricate; il tipo
  per faccia è in `data/trv/terrain_look.json`.
- **Effetti**: ogni dado tirato appare grande al centro con il suo significato; SLAM!, DANNO!,
  BOOM! sul tavolo; un'auto eliminata si lancia contro l'ostacolo, esplode e vola via.
  Dalla console: `__fx.explode(x, z)`, `__fx.crash(__fx.cars()[0])`.
- Prove: `production/qa/evidence/trv-play-spike/ui-redesign-*.jpg`.

## Interfaccia del giocatore, seconda stesura (2026-11-15)

- **Mappa procedurale predefinita**, con ostacoli in rilievo e livello informativo separato
  (linee, nastro, pericoli; tasto G). La grafica ufficiale resta con `?terrain=official`.
- **Striscia del giocatore in un solo disegno**, disposta come nel manuale: command board a
  sinistra, le tre dashboard accostate e allineate, due slot danno sotto ogni dashboard.
  La striscia è ancorata in basso: con le espansioni (carta sopra ogni auto, command board alta
  il doppio) cresce verso l'alto (`STRIP_BOX` in `src/view/vector/boards.ts`).
- **Dadi del giocatore** sopra l'interfaccia, sul bordo del tavolo: si trascinano sulle plance
  o sulle auto 3D.
- **Elicottero** non in campo a terra dietro le auto della sua squadra, nel 3D.
- **Barra asciutta**: fasi, poche parole di richiesta, strumenti. Le scelte (dado strada, slam,
  non sparare) compaiono vicino all'auto che agisce.
- Prove: `production/qa/evidence/trv-play-spike/ui-strip-*.jpg`.

## Attacco e plance a scomparsa (2026-11-15)

- **Arma del modello**: ogni auto usa la propria arma, ritagliata dal modello (`GUNS` in
  `models-config.ts`: vertici, perno e bocca, misurati sulle viste laterale e dall'alto in
  `production/qa/evidence/trv-play-spike/gun-survey-*.jpg`). Ruota verso il bersaglio e rincula.
  Se un modello cambia, le misure vanno rifatte.
- **Raffica**: otto colpi con vampata, fumo, tracciante e scintille; l'elicottero si gira e
  abbassa il muso. Dalla console: `__fx.burst('p0M','p1S')`, `__fx.aim(id, angolo)`,
  `__fx.zoom(id)`.
- **Plance a scomparsa**: piccole durante movimento e sparo, grandi quando si mettono dadi
  (assegnazione, comando, riparazione) o col puntatore sopra; pulsante ▴/▾ o tasto P per
  aprirle o chiuderle a mano. Il tavolo è inquadrato sopra la striscia piccola; quella grande
  si apre sopra il suo bordo inferiore.
