# Interpretations Log

> **Status**: Designed (in attesa di /design-review)
> **Author**: Riccardo + Claude
> **Last Updated**: 2026-11-15
> **Last Verified**: 2026-11-15
> **Implements Pillar**: P1 Il regolamento è la legge (principale) · P2 Ogni dado si spiega (via #31)
> **Systems index**: #17 (Meta · MVP · Foundation · gruppo A)
> **Creative Director Review (CD-GDD-ALIGN)**: CONCERNS (accepted) 2026-11-15 — (1) frase sulla "terza possibilità" corretta in Player Fantasy; (2) P2 consegnato solo da #31 (Full Vision), limite dichiarato e accettato dall'utente

## Summary

Registro delle decisioni prese dove il regolamento ufficiale tace, è ambiguo o si
contraddice: ogni voce ha un id stabile, la pagina del libro, la domanda, la decisione
dell'utente e i moduli che la applicano. Per il giocatore significa che nessuna regola è
decisa di nascosto: o è quella del libro, o è una scelta scritta e verificabile sul libro
fisico. Esiste per il pilastro P1 e, nel Tier 1, è un documento citato dai GDD #7-#16; la
consultazione in partita è #31 (Full Vision).

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `None` (nessun sistema a monte; il regolamento in `reference/rulebook/` è l'autorità, non un sistema) · Feasibility: nessuna reference del motore per il dominio Core (`docs/engine-reference/web/modules/` assente), fattibilità non verificata rispetto al motore pinnato

## Overview

L'Interpretations Log è il **registro delle decisioni prese dove il regolamento ufficiale
tace o è ambiguo**. Il gioco è un porting fedele: le regole non si progettano, si
traducono. Ma tradurre un regolamento in moduli implementabili (#7-#16) porta a galla casi
che il testo non risolve. Quando succede, nessuno decide in silenzio: la domanda va
all'utente, e la risposta si scrive nel registro con un **id stabile**, la **pagina** del
regolamento da cui nasce il dubbio, la domanda, la decisione e i moduli che la applicano. I
GDD dei moduli di regole citano gli id invece di ripetere la decisione, così la stessa
risposta vale in ogni punto del gioco che incontra lo stesso silenzio.

Non è un sistema che gira: nel Tier 1 è un **documento di progetto** mantenuto a mano e
versionato nel repository, e nessun codice lo legge. Il giocatore non lo incontra durante la
partita. La consultazione in gioco, con le voci mostrate accanto alla regola a cui si
riferiscono, è un altro sistema (#31 In-game Rules Reference, Full Vision) che consumerà
questo formato: per questo il formato si fissa ora, mentre la UI resta fuori dall'MVP. Questo
GDD definisce il **formato di una voce e le regole di gestione del registro** (che cosa è una
interpretazione, chi la decide, come si cita e come cambia nel tempo), non le interpretazioni
stesse, che nascono man mano che i GDD dei moduli le incontrano.

Esiste per due ragioni. **P1 (il regolamento è la legge)**: il design test del pilastro dice
che se il regolamento tace "chiediamo all'utente e registriamo la decisione, con la pagina".
Senza un posto dove registrarla, quella decisione finisce sparsa tra commenti, GDD e codice,
dove non si ritrova e non si può contestare. Il registro rende **visibile il confine tra ciò
che dice il regolamento e ciò che abbiamo deciso noi**, ed è la garanzia che l'anti-pilastro
"NOT un riequilibrio" non venga aggirato di nascosto: una voce può colmare un silenzio, non
migliorare una regola. **Distribuzione solo a chi possiede la copia fisica**: chi gioca ha il
regolamento sul tavolo, quindi ogni voce con la sua pagina si verifica contro il libro.

*Confine design / implementazione*: dove vive il file, il suo formato di serializzazione e il
modo in cui #31 lo leggerà sono scelte tecniche. Se il formato richiede una decisione che il
codice dovrà rispettare, diventa un ADR; non esiste alcun ADR su questo sistema al
2026-11-15.

## Player Fantasy

*Inquadratura: indiretta.* Il giocatore non usa il registro durante la partita; ne sente
l'effetto come **fiducia**: nessuna regola del gioco è stata decisa di nascosto.

**"Nessuno decide di nascosto."** Un giocatore esperto, con il regolamento fisico sul tavolo,
contesta un esito. Il gioco non gli chiede di fidarsi: o la regola è quella del libro, a una
pagina che può aprire, oppure è un punto su cui il libro tace e che è stato deciso **una
volta, per iscritto, con un id**. **Non deve esistere una terza possibilità**: è un obbligo
del processo, non una garanzia automatica, perché un'ambiguità che nessuno nota non finisce nel
registro. Per questo la review controlla ogni citazione di pagina senza id (AC-01) e il primo
uso reale verifica il processo (AC-18). Dove il regolamento è chiaro, il gioco lo segue; dove
non lo è, lo dice.
> *P1 — "il motore di gioco implementa il regolamento ufficiale; l'automazione può cambiare
> chi esegue un passo, mai l'esito."*

**Conseguenza: "il libro e lo schermo dicono la stessa cosa."** Una voce del registro è
scritta in modo che la discussione si chiuda guardando il libro: cita la pagina, dice che
cosa il testo afferma e che cosa no, e quale scelta è stata fatta per colmare il vuoto. Il
giocatore attento sa quello che sa il registro, né più né meno.
> *P2 — "si mostra tutto ciò che un giocatore attento saprebbe al tavolo, niente che non
> potrebbe sapere."*

**Cosa chiede al resto del design**: ogni GDD di regole cita le proprie interpretazioni per
id (P1); le voci sono scritte per essere lette da un giocatore, in linguaggio semplice e con
la pagina verificabile (P2); l'anti-pilastro "NOT un riequilibrio" vale come criterio di
ammissione di una voce: colma un silenzio, non migliora una regola. **Limite dichiarato
del Tier 1**: la fantasy è consegnata come documento. La consultazione in partita, dove il
giocatore la vivrebbe direttamente, è #31 (Full Vision).

## Detailed Design

### Core Rules

Le regole sono numerate REG-1…REG-13 (REG = regola del registro) per poterle citare dai test
di accettazione. Gli id delle **voci** del registro sono un'altra cosa: `INT-NNN` (REG-5).

**Che cosa è una interpretazione**

- **REG-1 — Quando serve una voce.** Una voce nasce solo in uno di tre casi: il regolamento
  **tace** sul punto, è **ambiguo** (due letture ragionevoli danno esiti diversi) o **si
  contraddice** tra due passi. Test unico: *"un giocatore attento, leggendo solo il libro,
  saprebbe come procedere?"*. Se sì, **non c'è voce**: il GDD cita la pagina. Vale anche
  quando il libro risolve il punto con un esempio: si cita la pagina dell'esempio.
- **REG-2 — Decide solo l'utente.** Chi scrive un GDD o il codice e incontra un caso da
  REG-1 si ferma e pone la domanda all'utente, con le letture possibili e le pagine. Non
  sceglie, nemmeno "provvisoriamente" dentro un GDD senza una voce che lo dichiari. Un agente
  non può portare una voce allo stato Decisa.
- **REG-3 — Una voce colma, non migliora.** Una voce sceglie tra letture del libro o riempie
  un silenzio; non cambia un esito che una lettura chiara del regolamento già produce. Se la
  decisione richiesta contraddice il libro, **non è una interpretazione ma una deviazione**: è
  fuori dal perimetro del progetto (anti-pilastro "NOT un riequilibrio", P1) e non si
  registra come voce: si segnala all'utente e si segue il regolamento.

**Dove vive e come si identifica**

- **REG-4 — Un solo file.** Tutte le voci stanno in
  `design/interpretations/interpretations-log.md`, una sezione `### INT-NNN — Titolo` per
  voce, in ordine di id crescente. Il file **non** sta in `reference/`, che contiene solo
  l'autorità (il regolamento) e non è tracciato da git: il registro è nostro, pubblico, e non
  deve poter essere scambiato per regolamento.
- **REG-5 — Id stabili.** `INT-001`, `INT-002`, … a tre cifre, in sequenza, assegnati nel
  momento in cui la voce nasce, **anche se è ancora Aperta**. Un id non si riusa, non si
  rinumera e non si cancella, neppure per una voce Ritirata. Oltre `INT-999` si passa a quattro
  cifre, senza altre modifiche. La sequenza è **unica per tutto il progetto**: le espansioni
  non ne aprono una propria (REG-11).

**Contenuto di una voce**

- **REG-6 — Campi.** Ogni voce ha questi campi, con questi nomi (sono un contratto per #31,
  REG-13). Nello stato Aperta sono obbligatori i primi otto; nello stato Decisa lo sono tutti
  tranne `Sostituisce` e `Sostituita da`, che compaiono solo in una sostituzione
  (REG-10). `Si applica in` vale «nessuno» finché nessun GDD cita la voce.

  | Campo | Contenuto |
  |-------|-----------|
  | `Id` | `INT-NNN` (REG-5) |
  | `Titolo` | nome breve del caso, con i termini ufficiali del gioco |
  | `Fonte` | il regolamento di riferimento (gioco base o nome dell'espansione) e la sua edizione |
  | `Pagina` | numero **stampato sul libro**: `p. 9`, `pp. 9-10`, o più pagine separate da virgola |
  | `Stato` | uno tra Aperta, Decisa, Sostituita, Ritirata (States and Transitions) |
  | `Domanda` | la domanda posta all'utente, in una o due frasi |
  | `Il libro dice` | **parafrasi** di ciò che il testo afferma sul punto (REG-7) |
  | `Letture` | le letture o le opzioni considerate, almeno due, ognuna con ciò che implica |
  | `Decisione` | la lettura scelta dall'utente |
  | `Motivo` | perché: che cosa nel libro la sostiene o perché le altre sono escluse |
  | `Per il giocatore` | una o due frasi in linguaggio semplice, mostrabili da #31 |
  | `Decisa il` | data ISO `AAAA-MM-GG` della decisione dell'utente |
  | `Si applica in` | elenco dei GDD (e, in seguito, dei moduli) che citano la voce |
  | `Sostituisce` / `Sostituita da` | id collegati, solo se la voce è parte di una sostituzione (REG-10) |

- **REG-7 — Parafrasi, mai testo.** Il regolamento è protetto e il repository è pubblico (il
  PDF è escluso da git: `.gitignore`, `reference/rulebook/`). Le voci riassumono il testo con
  parole nostre e citano la pagina; **nessun passo del regolamento è riportato alla lettera**.
  I nomi ufficiali di dadi, tessere, azioni e stati sono terminologia, non citazione, e si
  usano così come sono. Il giocatore verifica sul libro fisico.

**Come si cita**

- **REG-8 — Citare per id, una volta sola.** Un GDD di regole cita la voce con `[INT-NNN]`
  accanto alla regola che ne dipende, e non copia la decisione: la fonte è unica. Ogni GDD
  #7-#16 elenca le voci che usa nella tabella "Interpretazioni applicate" delle sue
  Cross-References (id, titolo, effetto sul modulo). **Bidirezionalità**: la tabella del GDD
  e il campo `Si applica in` della voce devono coincidere; chi aggiunge una citazione aggiorna
  entrambi.
- **REG-9 — Niente voci Aperte alla review.** Un GDD di regole non supera la design-review
  mentre cita una voce Aperta: la dipendenza dalla risposta è esplicita e chiude prima della
  review, non dopo. Una voce Aperta può essere citata in una bozza solo con l'id, per
  segnalare che il punto è sospeso (REG-2).
- **REG-12 — Anche il codice e i test citano.** Un comportamento che dipende da una
  interpretazione cita `INT-NNN` nel test che lo verifica (e nel commento, se serve): una
  interpretazione senza un test che la nomini non è protetta da regressioni. Nel Tier 1 non c'è
  uno strumento che lo imponga; lo si controlla in review (Acceptance Criteria).

**Come cambia**

- **REG-10 — Si sostituisce, non si riscrive.** Una voce Decisa non cambia più nella
  `Decisione`; si correggono solo refusi. Se l'utente cambia idea, o un dubbio nuovo la
  rende insufficiente, nasce una **nuova voce** con `Sostituisce: INT-NNN`; la vecchia passa a
  Sostituita e riceve `Sostituita da`. Restano entrambe. Ogni GDD elencato in `Si applica in`
  della voce vecchia va rivisto: è il caso d'uso di `/propagate-design-change`.
- **REG-11 — Espansioni.** Le voci delle espansioni stanno nello stesso file e nella stessa
  sequenza di id, con `Fonte` che nomina il loro regolamento. Non modificano le voci del gioco
  base: una interpretazione che vale solo con un'espansione lo dice nel titolo e in `Fonte`
  (principio T2: aggiungere senza toccare).
- **REG-13 — Contratto verso #31.** Id, nomi dei campi e valori di `Stato` sono un formato
  stabile che #31 leggerà. Aggiungere un campo è ammesso; rinominarlo o toglierlo richiede di
  aggiornare #31 e i GDD che lo citano. `Per il giocatore` è l'unico testo pensato per essere
  mostrato in partita.

**Modello di voce** (con segnaposto, non con una regola reale):

```markdown
### INT-NNN — <titolo con i termini ufficiali>

- **Fonte**: <regolamento, edizione> · **Pagina**: p. <N> · **Stato**: Aperta | Decisa
- **Domanda**: <la domanda posta all'utente>
- **Il libro dice**: <parafrasi, mai testo>
- **Letture**: (1) <lettura> — implica <esito>. (2) <lettura> — implica <esito>.
- **Decisione**: <lettura scelta> · **Decisa il**: AAAA-MM-GG
- **Motivo**: <perché>
- **Per il giocatore**: <una o due frasi semplici>
- **Si applica in**: <GDD, …>
- **Sostituisce / Sostituita da**: <id, solo se presente>
```

### States and Transitions

| Stato | Significato | Chi lo imposta |
|-------|-------------|----------------|
| **Aperta** | la domanda è posta, la risposta non c'è ancora | chi incontra il caso (REG-2) |
| **Decisa** | l'utente ha scelto una lettura | solo l'utente (REG-2) |
| **Sostituita** | una voce successiva la rimpiazza | la nuova voce con `Sostituisce` (REG-10) |
| **Ritirata** | non serve più: il punto è risolto da una fonte ufficiale più recente, il caso è sparito o la domanda era mal posta | l'utente, con una nota che dice perché |

| Da → A | Valida | Condizione |
|--------|--------|------------|
| (nuova) → Aperta | sì | REG-1 soddisfatta; id assegnato (REG-5) |
| Aperta → Decisa | sì | l'utente risponde; i campi della decisione sono compilati |
| Aperta → Ritirata | sì | la domanda cade prima della risposta |
| Decisa → Sostituita | sì | nasce una voce con `Sostituisce` verso questa |
| Decisa → Ritirata | sì | una fonte ufficiale (regolamento aggiornato o errata fornito dall'utente) risolve il punto |
| Decisa → Aperta | **no** | un dubbio riaperto è una **nuova voce** che sostituisce (REG-10) |
| Sostituita / Ritirata → qualunque altro | **no** | stati finali |
| qualunque → cancellata | **no** | le voci non si eliminano (REG-5) |

### Interactions with Other Systems

Nessun sistema a monte. A valle, nel Tier 1 le interazioni sono **procedurali**: nessun
codice legge il registro.

| Sistema | Che cosa passa | Chi possiede l'interfaccia |
|---------|----------------|----------------------------|
| #7-#16 (moduli di regole) | citano gli id; elencano le voci in "Interpretazioni applicate" (REG-8); criterio di accettazione "nessuna voce Aperta citata" (REG-9) | #17 definisce il formato; ogni GDD lo applica |
| #4 Content Pack & Rule Modules | i dati del contenuto (es. facce dei dadi) possono dipendere da una interpretazione: citano l'id | come sopra |
| #31 In-game Rules Reference (Full Vision) | legge voci, `Per il giocatore` e `Stato`; mostra solo le Decise | #17 (REG-13) |
| `/design-review`, `/propagate-design-change`, `/consistency-check` | controllano le citazioni e propagano un cambio (REG-9, REG-10) | strumenti del progetto |

**Non interagisce** con #2 (nessuna dipendenza in entrambi i sensi), né con la
presentazione #19-#25. Se #1 deciderà che l'involucro di causa porta l'id di una
interpretazione, quel legame è di #1 e non di #17 (Open Questions).

## Formulas

**Nessuna formula di bilanciamento**: un registro di interpretazioni non ha tassi, soglie o
costi, e il regolamento non si "tara" (P1). L'unica regola numerica è l'assegnazione dell'id
(REG-5), scritta qui perché sia verificabile.

### F1 — Prossimo id

The `prossimo_id` formula is defined as:

`prossimo_id = formatta( max(N_i) + 1 )`, con `max(∅) = 0`

dove `formatta(k)` scrive `INT-` seguito da `k` con almeno tre cifre, riempita di zeri a
sinistra (`formatta(7) = INT-007`, `formatta(1000) = INT-1000`).

**Variables:**
| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| `N_i` | int | 1–∞ | calculated (dal file del registro) | numero di ogni voce esistente, **di qualunque stato**, anche Sostituita o Ritirata |
| `k` | int | 1–∞ | calculated | il numero da formattare |

**Output Range:** da `INT-001` (registro vuoto) in su, senza limite superiore; a partire da
1000 le cifre diventano quattro. Il risultato è sempre maggiore di ogni id esistente.
**Example:** voci esistenti `INT-001`, `INT-002`, `INT-004` (la `003` è stata assegnata su un
ramo e poi rinumerata prima del merge, vedi Edge Cases) → `max = 4` → `prossimo_id = INT-005`.
Registro vuoto → `INT-001`. Ultima voce `INT-999` → `INT-1000`.

**Boundary check** (lens systems-designer): `max(∅)` è definito a 0 e dà `INT-001`; con un
solo elemento dà `INT-002`; nessuna divisione, nessun valore negativo, nessun risultato
illimitato che renda inerte un'altra variabile. Si usa `max + 1` e **non** `conteggio + 1`
perché con un buco nella sequenza (id riservato e poi non usato) il conteggio produrrebbe un
id **già esistente**; il massimo no. Le voci Ritirate contano, altrimenti un id ritirato
potrebbe essere riassegnato (REG-5).

## Edge Cases

- **If lo stesso silenzio viene incontrato una seconda volta (da un altro modulo o in un altro
  momento)**: prima di aprire una voce si cerca nel registro per pagina e titolo; se esiste,
  si cita quella e **non si duplica**, anche se è stata decisa per un altro modulo. Se la voce
  trovata è Sostituita, si cita la sua erede.
- **If due rami aprono la stessa voce con lo stesso id** (es. entrambi `INT-005`): un id è
  "pubblicato" solo quando è su `main`. Chi fa il merge per secondo assegna alla **propria**
  voce il prossimo id libero con F1, aggiorna le proprie citazioni e poi fa il merge. REG-5
  ("mai rinumerato") vale solo per gli id già su `main`.
- **If l'utente risponde "non so, decido dopo"**: la voce resta **Aperta**. Il GDD che la cita
  non passa la design-review (REG-9) e le story che ne dipendono non entrano in uno sprint
  (regola just-in-time dell'indice dei sistemi).
- **If una decisione si scopre contraria al libro dopo essere stata registrata**: non è una
  interpretazione ma una deviazione (REG-3). Nasce una voce che sostituisce quella sbagliata
  ed è allineata al libro; la vecchia diventa Sostituita; si rivedono i GDD elencati in
  `Si applica in`.
- **If un GDD cita un id che non esiste (refuso)**: la design-review fallisce su quella
  citazione. Nessuno crea la voce a posteriori per far tornare il conto: si corregge l'id o si
  segue REG-2 per il caso reale.
- **If un GDD cita una voce Sostituita o Ritirata**: la review lo segnala. Per una Sostituita
  il GDD passa all'erede; per una Ritirata la citazione si toglie, perché il punto è ora
  risolto dalla fonte ufficiale.
- **If il silenzio non ha una pagina precisa** (il libro non tratta affatto il caso): `Pagina`
  indica la pagina della regola più vicina e `Il libro dice` dichiara il silenzio. `Pagina` non
  resta mai vuoto.
- **If il dubbio nasce da un componente** (testo su una tessera o carta) e non da una pagina:
  `Pagina` riporta il nome del componente al posto del numero; l'autorità resta il
  regolamento e decide l'utente come per ogni voce. È un caso al margine di REG-1 (Open
  Questions).
- **If l'utente fornisce un errata o una nuova edizione** che risolve un punto: le voci
  interessate passano a **Ritirata** con una nota che dice perché; la fonte ufficiale vince
  (P1). I numeri di pagina si riferiscono all'edizione indicata in `Fonte`; correggerne uno
  dopo una nuova edizione è un refuso, non una nuova voce.
- **If due voci Decise si contraddicono**: è un difetto del registro. L'utente decide quale
  prevale con una nuova voce che le sostituisce entrambe (REG-10).
- **If autore e utente non concordano sul fatto che serva una voce**: decide l'utente (REG-2).
  Nel dubbio si chiede: una domanda costa meno di una regola decisa in silenzio.

## Dependencies

**A monte (questo sistema dipende da)**: nessun sistema. L'unico input è il regolamento in
`reference/rulebook/`, che non è un sistema ma l'autorità (P1) e non è tracciato da git.

**A valle (dipendono da questo sistema)**: nessun GDD esiste ancora al 2026-11-15, tranne #2
che non lo cita. Ogni GDD di regole deve citare #17 nelle proprie Dependencies (regola di
bidirezionalità).

| Sistema | Natura | Interfaccia | Hard / soft |
|---------|--------|-------------|-------------|
| #7-#16 Moduli di regole | citano gli id e li elencano in "Interpretazioni applicate" | formato di voce (REG-6), citazione `[INT-NNN]` (REG-8), criterio REG-9 | soft per il codice (funzionano senza); **hard come regola di processo**: senza il registro una interpretazione non ha dove stare |
| #4 Content Pack & Rule Modules | dati che dipendono da una interpretazione (es. facce dei dadi) citano l'id | come sopra | soft |
| #31 In-game Rules Reference (Full Vision) | mostra le voci Decise con `Per il giocatore` | id, nomi dei campi e stati stabili (REG-13) | hard: senza il registro non ha contenuto |
| `/design-review`, `/propagate-design-change`, `/consistency-check` | verificano le citazioni e propagano un cambio | REG-9, REG-10 | strumenti, non sistemi di gioco |

**Provvisorio**: il formato letto da #31 è definito qui prima che #31 abbia un GDD; va
confermato quando #31 sarà progettato (Open Questions). L'indice dei sistemi elenca la
dipendenza dei moduli come "leggera, non elencata per riga": questa sezione ne è la
formulazione completa.

## Tuning Knobs

**Nessun tuning knob proprio**, ed è voluto: un registro di regole non si "tara" e una
interpretazione non si bilancia (P1, anti-pilastro "NOT un riequilibrio").

| Valore che sembra un knob | Dove vive davvero | Perché non è un knob di #17 |
|---------------------------|-------------------|-----------------------------|
| Cifre minime dell'id (3) | REG-5 | convenzione di formato, cambiarla rinomina tutti gli id |
| Numero minimo di letture (2) | REG-6 | regola di ammissione: una domanda senza alternative non è una interpretazione |
| Insieme degli stati (4) | States and Transitions | contratto con #31 (REG-13), non una taratura |
| Soglia "voci Aperte" per la review (0) | REG-9 | regola di processo, non quantità regolabile |
| Contenuto delle singole decisioni | ogni voce del registro | sono dati del progetto decisi dall'utente, non parametri |

## Visual/Audio Requirements

Nessun requisito proprio: nel Tier 1 il registro è un documento e non disegna né suona
nulla. Nessun asset spec da produrre.

## Game Feel

Nessun requisito proprio. La sensazione da proteggere è la fiducia (Player Fantasy): nessuna
regola deve sembrare "decisa dal programma". Per questo una voce non contiene mai un esito
presentato come regola del libro quando è una scelta nostra (REG-3, REG-7).

## UI Requirements

Nessuna interfaccia propria nel Tier 1, quindi **nessun UX Flag**. Un solo vincolo verso
#31 (Full Vision), che dovrà rispettarlo quando sarà progettato:
- mostra **solo le voci Decise**, con `Per il giocatore` e la pagina stampata del libro, in modo
  che il giocatore possa verificare sul regolamento fisico (P2, "come un giocatore attento");
- non mostra mai `Il libro dice` come se fosse testo del regolamento: è una parafrasi.

## Cross-References

| Questo documento cita | Cosa | Tipo |
|-----------------------|------|------|
| `design/gdd/systems-index.md` | #17 Foundation senza dipendenze; i moduli #7-#16 citano gli id; #31 consuma il registro | contesto |
| `design/gdd/game-concept.md` | P1 (design test sul registro), P2, anti-pilastri "NOT un riequilibrio" e "NOT un giocatore al posto tuo", MVP n. 5 | pilastri |
| #7-#16 Moduli di regole *(GDD non scritti)* | citazione `[INT-NNN]`, tabella "Interpretazioni applicate", criterio REG-9 | interfaccia da applicare |
| #4 Content Pack & Rule Modules *(GDD non scritto)* | dati che dipendono da una interpretazione citano l'id | uso |
| #31 In-game Rules Reference *(GDD non scritto)* | formato stabile (REG-13), vincolo UI | interfaccia provvisoria |
| #1 Rules Core & Event Log *(GDD non scritto)* | eventuale id di interpretazione nell'involucro di causa (OQ-4) | domanda aperta |
| `reference/rulebook/` | autorità delle regole; **non tracciato da git** (`.gitignore`) | fonte delle regole |

**Interpretazioni applicate da questo GDD**: nessuna, perché non è un GDD di regole.

## Acceptance Criteria

**Tipo di story**: Config/Data (documento di progetto). Evidenza richiesta: smoke check in
`production/qa/smoke-[data].md` (livello di gate predefinito: consultivo). Nel Tier 1 **non
esiste un controllo automatico**: ogni criterio sotto è eseguibile a mano o con il comando
indicato. *Un criterio non eseguito non vale come superato*: nello smoke check va scritto
"NON ESEGUITO" con il motivo. L'eventuale automazione è in Open Questions (OQ-3).

Comandi di verifica usati sotto (da radice del repository):
- voci: `grep -n -E '^### INT-[0-9]{3,}' design/interpretations/interpretations-log.md`
- citazioni: `grep -rn -o -E 'INT-[0-9]{3,}' design/gdd`

| ID | Criterio |
|----|----------|
| AC-01 | **GIVEN** un GDD di regole #7-#16 in review, **WHEN** il revisore prende ogni citazione di pagina del regolamento **senza** id di voce, **THEN** per ciascuna il passo del libro risponde da solo alla domanda del GDD (test REG-1); se non lo fa, la review segnala "manca una voce". *(REG-1)* |
| AC-02 | **GIVEN** una voce in stato Decisa, **WHEN** la si controlla, **THEN** hanno valore `Decisione` e `Decisa il` (data ISO `AAAA-MM-GG`), e il commit che la porta a Decisa è stato fatto su istruzione esplicita dell'utente che l'ha scelta. *(REG-2)* |
| AC-03 | **GIVEN** una voce la cui `Decisione` produce un esito diverso da una lettura che `Il libro dice` descrive come chiara, **WHEN** è in review, **THEN** viene respinta come deviazione e non registrata. *(REG-3)* |
| AC-04 | **GIVEN** il repository, **WHEN** si esegue il comando "voci" su tutto `design/`, **THEN** le righe `### INT-NNN` compaiono **solo** in `design/interpretations/interpretations-log.md`, ordinate per id crescente, e nessuna compare sotto `reference/`. *(REG-4)* |
| AC-05 | **GIVEN** un registro con `INT-001`, `INT-002`, `INT-004`, **WHEN** nasce una voce, **THEN** il suo id è `INT-005`; con registro vuoto è `INT-001`; con ultima voce `INT-999` è `INT-1000`; con `INT-004` Ritirata come massimo è `INT-005` (le Ritirate contano). *(REG-5, F1, boundary)* |
| AC-06 | **GIVEN** il comando "voci" sul file, **WHEN** si ordinano gli id e si cercano i duplicati (`… \| sort \| uniq -d`), **THEN** l'output è **vuoto** e nessun id è stato riusato rispetto alla storia git di `main`. *(REG-5)* |
| AC-07 | **GIVEN** ogni voce, **WHEN** si confrontano i campi con REG-6, **THEN** una voce Aperta ha i primi otto campi (`Id`, `Titolo`, `Fonte`, `Pagina`, `Stato`, `Domanda`, `Il libro dice`, `Letture`), con almeno due letture; una Decisa li ha tutti tranne `Sostituisce` e `Sostituita da` (che compaiono solo in una sostituzione), con `Si applica in` = «nessuno» se nessun GDD la cita; `Pagina` non è mai vuoto. *(REG-6, Edge Cases)* |
| AC-08 | **GIVEN** il campo `Il libro dice` di ogni voce, **WHEN** lo si confronta con il PDF, **THEN** nessuna sequenza di **8 o più parole consecutive** coincide con il testo del libro, a parte i nomi ufficiali. *(REG-7; la soglia di 8 parole è un proxy di verifica scelto qui, non una norma di legge)* |
| AC-09 | **GIVEN** ogni `[INT-NNN]` trovato nei GDD con il comando "citazioni", **WHEN** si cerca l'id nel registro, **THEN** esiste una voce con quell'id; e la tabella "Interpretazioni applicate" del GDD coincide con il campo `Si applica in` della voce, in entrambi i sensi. *(REG-8, Edge Cases)* |
| AC-10 | **GIVEN** un GDD di regole che cita una voce Aperta, **WHEN** si fa la design-review, **THEN** la citazione è riportata come **bloccante**. **Oggi `/design-review` non lo controlla da solo** (OQ-3): finché non lo fa, il revisore esegue questo criterio a mano e lo scrive nel report. *(REG-9)* |
| AC-11 | **GIVEN** una voce Decisa `INT-007` e una nuova `INT-012` con `Sostituisce: INT-007`, **WHEN** si guarda `INT-007`, **THEN** ha `Stato: Sostituita` e `Sostituita da: INT-012`, il campo `Decisione` è invariato (`git diff` mostra solo `Stato` e il nuovo campo), e ogni GDD in `Si applica in` di `INT-007` è stato rivisto (cita `INT-012` o ha una nota). *(REG-10, Edge Cases)* |
| AC-12 | **GIVEN** il commit che aggiunge una voce con `Fonte` di un'espansione, **WHEN** si guarda il `git diff`, **THEN** il commit non modifica nessuna riga di voci con `Fonte` del gioco base. *(REG-11, T2)* |
| AC-13 | **GIVEN** un test o un comportamento di codice che dipende da una interpretazione (**dal milestone M1**: nel Tier 1 attuale non c'è ancora codice), **WHEN** si cerca l'id con `grep` in `tests/`, **THEN** il test che lo verifica contiene `INT-NNN`. *(REG-12)* |
| AC-14 | **GIVEN** il registro, **WHEN** si estraggono i nomi dei campi e i valori di `Stato`, **THEN** i campi sono solo quelli di REG-6 e gli stati solo i quattro definiti (nessuna variante di grafia). *(REG-13)* |
| AC-15 | **GIVEN** la storia git del registro, **WHEN** la si ripercorre, **THEN** nessuna voce è passata da Decisa ad Aperta, nessuna da Sostituita o Ritirata ad altro stato e nessuna è stata cancellata. *(States and Transitions, REG-5)* |
| AC-16 | **GIVEN** due rami che aggiungono entrambi `INT-005`, **WHEN** il secondo viene unito a `main`, **THEN** dopo il merge il comando "voci" non mostra duplicati, la sua voce ha il prossimo id libero e le sue citazioni nei GDD sono aggiornate. *(Edge Case: collisione tra rami, F1)* |
| AC-17 | **GIVEN** un GDD che cita `INT-NNN` di una voce Sostituita o Ritirata, **WHEN** si fa la review, **THEN** viene segnalato, e la citazione è corretta all'erede o tolta. *(Edge Cases)* |
| AC-18 | **GIVEN** il primo GDD di regole che incontra un silenzio del regolamento (candidato: #10 o #13), **WHEN** arriva alla review, **THEN** il silenzio ha una voce Decisa dell'utente e **nessuna regola è stata scelta nel testo del GDD senza voce**. È la prova che il processo regge l'uso reale. *(REG-2, REG-8, cross-system)* |

**Limiti noti dei criteri** (emersi dal controllo QA, da decidere):
- AC-08 usa una soglia di 8 parole come proxy della regola "nessuna citazione letterale": è
  una scelta dell'autore del GDD, non dell'utente, e va confermata.
- AC-10 è oggi solo manuale: l'automazione richiede una modifica a `/design-review` (OQ-3).
- AC-13 non è eseguibile finché non c'è codice (M1).
- Nessun criterio verifica che la fantasy "nessuno decide di nascosto" sia **percepita**: nel
  Tier 1 non c'è UI da osservare; la verifica è AC-18 sul primo uso reale.

## Open Questions

| # | Domanda | Responsabile | Entro |
|---|---------|--------------|-------|
| OQ-1 | Come si identifica l'edizione del regolamento in `Fonte` (titolo, anno, numero di versione)? Serve una stringa fissa prima della prima voce | utente | prima della prima voce |
| OQ-2 | Esistono errata o FAQ ufficiali di Restoration Games? Se sì, sono **autorità** (come il libro) o fonte secondaria? Il progetto dichiara oggi il regolamento come unica autorità | utente | prima della prima voce Decisa |
| OQ-3 | Come si fa rispettare REG-8 e REG-9? Oggi sono controlli manuali (AC-09, AC-10): estendere `/design-review` e `/consistency-check` con la verifica degli id, oppure uno script in `tools/` | utente + producer | prima della review dei GDD di gruppo A |
| OQ-4 | L'involucro di causa di #1 porta l'id della interpretazione che ha prodotto un esito, così che #22 e #31 possano dire "regola interpretata INT-NNN"? Se no, il legame resta solo nel documento | GDD #1 | alla progettazione di #1 |
| OQ-5 | Un dubbio nato da un **componente** (testo su tessera o carta) è una voce con `Pagina` = nome del componente? Il caso è al margine di REG-1 | utente | alla prima occorrenza |
| OQ-6 | In che lingua si scrivono `Per il giocatore` e le voci, se il gioco sarà localizzato? Oggi il registro è in italiano, lingua di lavoro | utente + #31 | alla progettazione di #31 |
