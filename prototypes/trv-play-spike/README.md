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
