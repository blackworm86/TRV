<!-- PROTOTYPE - NOT FOR PRODUCTION -->
# M0 — prototipo del tavolo (spike)

**Ipotesi**: la grafica ufficiale delle tessere, messa su un tavolo 3D con luce calda e
ombre, dà la sensazione del "tavolo fisico" dell'art bible e resta leggibile; un dado 3D
può mostrare un risultato già deciso da un generatore con seed (GDD #2, RNG-4).

**Non contiene regole del gioco**: l'auto va dove clicchi e il dado è un d6 generico.

## Come avviarlo
1. Una volta sola, estrai le tessere in locale (la grafica resta fuori da git):
   le PNG vanno in `assets/licensed/_derived/road-tile-0.png` e `road-tile-1.png`.
2. `npm run dev`, poi apri `http://localhost:5173/prototypes/m0-table-spike/`.
   Facoltativo: `?seed=123` per ripetere la stessa sequenza di tiri.

Senza le PNG la tessera compare grigia e la nota in basso lo dice.

## Stato
In corso (2026-11-15).

## Risultati
Da scrivere dopo averlo provato (leggibilità delle caselle a questa distanza, resa delle
ombre, tempi del dado, sensazione al tocco su tablet).
