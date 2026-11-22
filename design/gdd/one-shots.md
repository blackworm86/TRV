# One Shots: una carta coperta da giocare una volta

> **Status**: Bozza — in attesa della revisione dell'utente
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-22
> **Fonte**: carte *One Shots* (mini espansione, pagina 2 di
> `assets/sorgenti/TRV 02 All Expansions/TRV v2.pdf`, fuori da git): la carta delle regole e sei
> carte. Non c'è un regolamento: le ambiguità le ha decise l'utente il 2026-11-22.
> Trascrizione: `data/trv/one_shots.json`.

## Overview

A inizio partita ogni giocatore riceve una carta One Shot coperta. La carta dice quando si può
giocare; giocata, esce dal gioco. Ognuna piega una regola una volta sola: un colpo che va a segno
da sé, un danno evitato, i dadi ritirati, due pericoli sbirciati, un secondo colpo, un'auto
salvata da una casella invalicabile. È un modulo di regole come le espansioni: si accende in
creazione partita (hot seat e online) e non cambia nulla quando è spento.

## Player Fantasy

L'asso nella manica: tutti sanno che hai qualcosa, nessuno sa cosa. Il momento giusto per
giocarla è metà del divertimento; sprecarla, o tenerla troppo, è l'altra metà.

## Detailed Rules

### 1. Preparazione

1. Il mazzo è di 6 carte (la settima carta del foglio, "ONE SHOT:" senza testo, è un modello
   vuoto e non entra nel gioco).
2. Dopo la scelta dei capisquadra e il draft dei potenziamenti (se in gioco), il mazzo si mescola
   e ogni giocatore **persona** riceve una carta coperta. Big Rig e Final Five la ricevono come le
   squadre di auto. Le squadre **TRV9000 non** la ricevono (decisione dell'utente, 2026-11-22).
3. Le carte non distribuite restano fuori: non si pescano mai.

### 2. Giocare una carta

1. Ogni carta ha un momento in cui si può giocare. In quel momento il gioco chiede al
   proprietario se giocarla; può dire di no e tenerla per un'altra occasione.
2. Giocata, la carta esce dal gioco. Ogni giocatore ne ha una sola, quindi una partita ne usa al
   massimo una per giocatore.
3. La carta è coperta: online la vede solo chi la possiede; in hot seat si vede nella scheda del
   giocatore di turno.

### 3. Le sei carte

| Carta | Quando | Effetto |
|---|---|---|
| **Guided Missile** | quando spari, scelto il bersaglio, prima del dado sparo | il colpo va a segno senza tirare |
| **Grapeshot** | dopo aver sparato (colpito o mancato) | un secondo sparo allo stesso bersaglio, se è ancora nel tuo arco di tiro |
| **Camouflage Coating** | quando un tuo veicolo subirebbe danno | quel veicolo non subisce danno |
| **Flux Capacitor** | dopo il tiro dei tuoi dadi all'inizio di un round | ritiri tutti i tuoi dadi movimento |
| **Radar Array** | all'inizio di un tuo turno | guardi due pericoli coperti |
| **AI Danger Avoidance** | quando un tuo veicolo entrerebbe in una casella invalicabile | lo sposti invece in una casella adiacente alla sua casella attuale |

- Guided Missile e Grapeshot valgono anche per lo sparo dell'elicottero (decisione dell'utente,
  2026-11-22) e per quello del Big Rig.
- Grapeshot: l'arco di tiro è quello dello sparo appena fatto (con le sue estensioni, per esempio
  Punt Gun o Long Arm of the Law); il secondo sparo tira il dado normalmente, con i suoi ritiri.
- Camouflage Coating vale per ogni danno: colpo, slam, pericolo, effetti. Non viene chiesto per un
  veicolo già fuori uso (il danno è ignorato comunque) né per un relitto.
- Flux Capacitor: anche nel primo round, i cui dadi sono quelli del tiro iniziale.
- Radar Array: si guardano i due pericoli uno dopo l'altro, come con Third Eye; con un solo
  pericolo coperto se ne guarda uno.

## Formulas

Nessuna formula. Numeri della trascrizione (`data/trv/one_shots.json`):

- `radar_peeks` = 2 pericoli guardati da Radar Array.
- Carte per giocatore = 1.

## Edge Cases

- **AI Danger Avoidance** (decisione dell'utente, 2026-11-22): le caselle proposte sono quelle
  adiacenti alla casella che il veicolo sta lasciando, sul tavolo e non invalicabili. Se la casella
  scelta è libera, entrarci segue le regole normali (pericolo se coperto) e poi il movimento
  continua. Se è occupata, il movimento si ferma lì e c'è lo slam (niente drift).
- Un veicolo eliminato prima del momento giusto non fa scattare niente.
- Il giocatore eliminato tiene la carta, ma non avrà più occasioni di giocarla.
- Online la domanda può arrivare nel turno di un altro (Camouflage Coating): risponde il
  proprietario, come per Crumple Zones.
- Con i TRV9000 al tavolo: i bot non hanno carte, ma le carte dei giocatori valgono anche contro
  di loro.

## Dependencies

- Regole base (`rules-core.md`): sparo, danno, dadi, pericoli, caselle invalicabili.
- Choppe Shoppe (`choppe-shoppe.md`): l'ordine della preparazione; gli archi estesi per Grapeshot.
- Big Rig e Final Five (`big-rig-final-five.md`): ricevono la carta come le auto.
- TRV9000 (`trv9000-bots.md`): i bot non ricevono carte.
- Gli altri moduli della stessa scatola (Bonus Commands, Bounties, Road Conditions, Advanced
  Airstrikes) arriveranno con documenti propri.

## Tuning Knobs

- `data/trv/one_shots.json`: l'elenco delle carte (id, nome, testo in italiano, momento) e il
  numero di pericoli di Radar Array. Aggiungere una carta all'elenco non basta: ogni momento ha il
  suo punto nel motore.

## Acceptance Criteria

1. Con One Shots accesa, ogni persona ha una carta all'inizio, i bot no; spenta, nessuno.
2. Ogni carta viene proposta solo nel suo momento, e solo a chi la possiede.
3. Giocata, la carta sparisce dalla mano del giocatore e non torna più.
4. Guided Missile: il colpo va a segno senza tiro del dado sparo.
5. Camouflage Coating: il veicolo non riceve il segnalino danno.
6. Flux Capacitor: i dadi del giocatore cambiano con un nuovo tiro.
7. Radar Array: il giocatore vede due pericoli coperti, che restano coperti per gli altri.
8. Grapeshot: un secondo sparo allo stesso bersaglio, solo se è ancora nell'arco.
9. AI Danger Avoidance: il veicolo non viene eliminato e finisce in una casella adiacente scelta;
   libera, il movimento continua; occupata, il movimento si ferma con uno slam.
10. La partita si ricostruisce identica dalle scelte (hot seat, online, segnalazioni).

## Open Questions

Nessuna.
