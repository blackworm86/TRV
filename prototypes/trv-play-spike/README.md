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

## Asset
Tutti i pezzi vengono dal catalogo fisico `data/trv/catalog_base.json` (quantità, misure in mm, immagini
fronte/retro) tramite `src/game/trv/catalog.ts` e `src/view/pieces3d.ts`: tessere, segnalini pericolo
ufficiali sul tavolo, dadi 3D con le facce ufficiali, cruscotti e plance comando delle crew nel pannello,
facce dei dadi nella cronaca. Le misure sono stime (`measured: false`) finché non vengono misurate.

## Interpretazioni provvisorie (da confermare con l'utente)
- Sbandata: i 4 segnalini delle scansioni mostrano tutti "avanti"; il regolamento dice "6 segnalini diversi".
- Lato delle tessere pescate: casuale (il regolamento dice solo di mescolarle).
- Dado strada: un'auto che parte dall'area di partenza non lo può usare (non è partita su strada).
- Spinte oltre il fronte della tessera di testa (slam, danni): trattate come un'uscita dal fronte.
- Relitti spinti fuori da qualunque bordo: eliminati.
- Pericolo e auto nella stessa casella: prima si risolve il pericolo, poi lo slam.

## Risultati
- Il motore gioca 150 partite casuali (2-4 giocatori) fino alla vittoria, senza blocchi
  (`tests/unit/trv/engine.test.ts`).
- Prova a 1024×768: `production/qa/evidence/trv-play-spike/` (locale, contiene grafica licenziata).
