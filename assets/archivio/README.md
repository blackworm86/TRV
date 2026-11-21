# Archivio dei modelli

Modelli che il gioco non carica più, tenuti da parte (richiesta dell'utente, 2026-11-21). Il gioco e
l'inspector leggono solo `assets/<gioco>/modelli/`: quello che sta qui non entra in nessuna build.

| File | Cos'è | Sostituito da |
|---|---|---|
| `base/modelli/Car_Small.glb`, `Car_Medium.glb`, `Car_Large.glb` | Le tre auto in un pezzo solo (Meshy, 2026-11-15) | Le auto montate dai pezzi: `car_s_*`, `car_m_*`, `car_l_*` |
| `big_rig/modelli/big_rig.glb` | Il Big Rig in un pezzo solo (2026-11-18) | Le tre sezioni montate dai pezzi: `big_rig_*` |
| `base/modelli/car_m_v2_*.glb` | Carrozzeria, ruota, base e arma dell'Avenger ridisegnato sulla dima (2026-11-21), progetto fermato | Niente: il gioco tiene l'Avenger di `car_m_*` |

Per rimettere in gioco un modello: riportarlo in `assets/<gioco>/modelli/` e ridargli la sua voce nel codice
(`src/view/models-config.ts` per un modello in un pezzo, una scheda in `assets/<gioco>/modelli/schede/` per
uno montato dai pezzi).
