# Game Concept: Thunder Road Vendetta (porting digitale)

*Created: 2026-11-15*
*Status: Draft*

> **Natura del documento.** Questo è il concept di un **porting fedele** del gioco da
> tavolo *Thunder Road: Vendetta* (Restoration Games, 2022), non di un gioco originale.
> Le regole non si progettano: le stabilisce il regolamento ufficiale
> (`reference/rulebook/TRV-Base-Game-Rulebook.pdf`), unica autorità. Le decisioni
> creative di questo documento riguardano la **mediazione digitale**: cosa si
> automatizza, cosa si mostra, come si presenta il tavolo, come si gioca a distanza.
> Uso autorizzato da Restoration Games; progetto no profit, codice open source, grafica
> ufficiale mai in un repository pubblico, distribuzione solo a chi possiede la copia fisica.

---

## Elevator Pitch

> Thunder Road: Vendetta digitale: comandi una banda di tre auto e un elicottero in una
> corsa a colpi di dadi su una strada che si sbriciola alle tue spalle: speronate,
> spari, pericoli nascosti, e vince chi taglia per primo il traguardo o resta l'ultimo
> in strada. Lo stesso gioco del tavolo, in hot seat o online, senza scatole da aprire.

*Test dei 10 secondi*: "corsa e combattimento tra auto, a turni, con i dadi" — superato.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Gioco da tavolo digitale — corsa e combattimento tra veicoli a turni, con dadi (porting fedele) |
| **Platform** | Web: browser desktop e tablet (viewport minimo ~1024×768, mouse e touch). Niente smartphone |
| **Target Audience** | Giocatori competitivi da tavolo che possiedono la copia fisica (vedi Target Player Profile) |
| **Player Count** | 2-4 giocatori umani; hot seat sullo stesso dispositivo e online remoto con server autorevole. Bot: decisione rinviata |
| **Session Length** | Non indicata dal regolamento: da misurare nei playtest (non stimata) |
| **Monetization** | Nessuna: no profit, distribuito solo a chi possiede la copia fisica |
| **Estimated Scope** | Large (Tier 1 entro 2 anni, Tier 2 entro 3; solo, 5-15 h/settimana; visione completa 4-5+ anni) |
| **Comparable Titles** | La copia fisica di Thunder Road: Vendetta; adattamenti manuali su tavoli virtuali generici. Dati di mercato: non ricercati |

---

## Core Fantasy

Sei il capo di una banda su una strada senza legge: tre auto di stazza diversa e un
elicottero ai tuoi ordini. Ogni round decidi quale dado dare a quale auto, quando
rischiare la strada o il fango, chi speronare e chi colpire, mentre la strada alle
spalle crolla e si porta via chi resta indietro. È la padronanza del rischio: leggere i
dadi, prevedere uno slam, sapere quando chiamare l'elicottero.

---

## Unique Hook

**Come Thunder Road: Vendetta al tavolo, E IN PIÙ tutto TR:V in un posto: base ed
espansioni sempre pronte e combinabili, senza scatole da aprire — in hot seat o online,
senza preparazione.**

Il digitale toglie la contabilità del tavolo (setup, mazzo di tessere, pescate, catene
di slam) senza toccare le regole, e spiega ogni esito. Il gancio è servito da due parti:
il principio tecnico T2 (il gioco base è un pacchetto di contenuto come ogni espansione)
lo **rende possibile**, il pilastro 3 ("Turni veloci, partita pronta") lo fa
**percepire** al giocatore. Rischio di calendario: al lancio c'è solo il gioco base,
quindi per anni l'hook si riduce a "senza preparazione".

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Challenge** (obstacle course, mastery) | 1 | Decisioni tattiche sull'assegnazione dei dadi, rischio calcolato, informazione pubblica sempre consultabile prima di impegnarsi |
| **Fellowship** (social connection) | 2 | Serata tra amici in hot seat; online con il gruppo che possiede la scatola; rivincita a pochi clic |
| **Sensation** (sensory pleasure) | 3 | "Il tavolo fisico": tessere, segnalini e dadi con spessore, ombra e luce calda; dado che rotola davvero |
| **Discovery** (exploration, secrets) | 4 | Pericoli e danni coperti che si rivelano; strada che cambia a ogni partita (mazzo di tessere) |
| **Fantasy** (make-believe, role-playing) | 5 | Banda di auto ed elicottero su una strada senza legge, dalla grafica ufficiale |
| **Narrative** (drama, story arc) | N/A | Nessuna trama; solo storie emergenti di partita (lo slam a catena, la fuga sull'ultima tessera) |
| **Expression** (self-expression, creativity) | N/A | Nessuna personalizzazione oltre il colore della banda |
| **Submission** (relaxation, comfort zone) | N/A | Non è un gioco rilassante: ogni turno è una scommessa |

### Key Dynamics (Emergent player behaviors)

- I giocatori pianificano l'ordine dei turni nel round: quale auto muovere prima, quale
  tenere per il coast, quando spendere il comando.
- Usano lo slam come arma (spingere un avversario fuori dal bordo o su un ostacolo) e
  accettano il rischio del dado di direzione.
- Corrono in avanti per far cadere la tessera di coda con le auto avversarie sopra.
- Contano i danni già rivelati per stimare il rischio (confine "giocatore attento").
- Chiedono la rivincita subito dopo una sconfitta dovuta ai dadi.

### Core Mechanics (Systems we build)

Tutti dal regolamento ufficiale; nessuno inventato.

1. **Turno e round con assegnazione dei dadi**: 4 dadi movimento per round, 3 turni per
   giocatore, assegnazione a un'auto o al coast, un comando per round (Airstrike, Nitro,
   Drift, Repair).
2. **Movimento sul tracciato**: arco frontale, costi del terreno, bonus del dado strada,
   ostacoli, pericoli coperti, tre tessere scorrevoli con eliminazione della tessera di
   coda, tessera finale e traguardo.
3. **Slam e dadi FX**: risoluzione ricorsiva degli scontri (dado slam, dado direzione,
   ritiro per il veicolo più grande), wreck, effetti dei token danno (Dent, Shrapnel,
   Skid, Dazed, Blast Off).
4. **Sparo e danni**: dado sparo contro la taglia del bersaglio, danni, stato
   operabile / inoperabile / eliminato, fuori dalla partita.
5. **Elicottero**: Airstrike, sparo dall'elicottero, eliminazione di chi termina il turno
   sulla sua casella.

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | Ogni round scegli quale dado a quale auto, il comando, la traiettoria nell'arco frontale, il bersaglio | Core |
| **Competence** (mastery, skill growth) | Capire perché si è vinto o perso: ogni dado si spiega, l'informazione pubblica è sempre consultabile, la padronanza sta nel gestire il rischio | Core |
| **Relatedness** (connection, belonging) | Partite tra amici in hot seat e online con chi ha la scatola | Supporting |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Killers/Competitors** — How: speronare, sparare, eliminare le auto avversarie, vincere la corsa (primario)
- [x] **Achievers** — How: tagliare il traguardo per primi, padroneggiare il rischio dei dadi (primario)
- [x] **Socializers** — How: serata hot seat, partite online con il proprio gruppo (secondario)
- [ ] **Explorers** — How: solo la scoperta dei token coperti e delle combinazioni di tessere (marginale)

**Non è per**: chi cerca simulazione di guida in tempo reale, progressione o sblocchi tra
partite, gioco in solitario (bot non decisi).

### Flow State Design

- **Onboarding curve**: il gioco presume chi conosce o possiede il gioco fisico; il
  digitale mostra le azioni legali (arco frontale, bersagli, costi del terreno) senza
  suggerire mosse. Un tutorial dedicato non è nello scope attuale.
- **Difficulty scaling**: viene dagli avversari umani; nessuna difficoltà regolabile
  (bot non decisi).
- **Feedback clarity**: ogni cambio di stato causato da dado o token è attribuito alla
  sua causa (pilastro 2); catene di slam risolte un passo alla volta.
- **Recovery from failure**: rivincita a pochi clic (pilastro 3); la partita stessa ha
  il Repair per rimettere in strada un'auto inoperabile.

---

## Core Loop

### Moment-to-Moment (30 seconds)
Il turno: assegni un dado movimento a un'auto operabile (o al coast), attivi
eventualmente il comando del round, muovi l'auto nel suo arco frontale pagando il
terreno, prendi il bonus strada se sei rimasto sull'asfalto, spari a un bersaglio
nell'arco. È soddisfacente perché il valore del dado diventa una scelta, e il rischio si
vede e si paga subito: un pericolo che si gira, uno slam con il dado di direzione.

### Short-Term (5-15 minutes)
Il round: tre turni a testa con quattro dadi appena tirati. Il dilemma ricorrente è
"quale dado dove?": tenere il 6 per il Repair o per correre, quando spendere il coast,
quale auto esporre. Il primo giocatore e il dado strada passano a sinistra a ogni round.

### Session-Level (30-120 minutes)
La partita: la strada scorre di tessera in tessera, la tessera di coda sparisce con le
auto rimaste indietro. Il traguardo arriva quando un giocatore è fuori (3+ giocatori) o
alla quinta tessera (2 giocatori). Si chiude con un vincitore netto: il primo al
traguardo o l'ultimo con auto operabili. La durata reale va misurata nei playtest.

### Long-Term Progression
Nessuna progressione tra partite, come al tavolo: il gioco cresce in profondità con la
padronanza dei giocatori e, più avanti, con le espansioni (Tier 4) che si combinano al
gioco base.

### Retention Hooks
- **Curiosity**: tessere e token diversi a ogni partita; espansioni da combinare (Tier 4).
- **Investment**: nessuna (scelta: niente progressione persistente).
- **Social**: il proprio gruppo di gioco, in hot seat o online.
- **Mastery**: leggere meglio i dadi e gli slam; rivincita immediata.

---

## Game Pillars

Struttura **3 + 2**: tre pilastri d'esperienza (vincolano design, UI, arte, audio,
animazione) e due principi tecnici (vincolano l'architettura; vanno formalizzati come ADR).
Approvati dal creative-director (gate CD-PILLARS: APPROVE, dopo un primo giro NOT ASSESSED
per mancanza dell'hook).

### Pillar 1: Il regolamento è la legge
Il motore di gioco implementa il regolamento ufficiale; l'automazione può cambiare chi
esegue un passo, mai l'esito.

*Design test*: se il regolamento tace o è ambiguo, non decidiamo in silenzio: chiediamo
all'utente e registriamo la decisione, con la pagina, nel **registro delle
interpretazioni**. Tra una regola "migliore" e quella ufficiale, vince quella ufficiale.

### Pillar 2: Ogni dado si spiega (prima e dopo)
L'informazione pubblica (statistiche del cruscotto, archi frontali, facce dei dadi, token
danno già rivelati) è sempre consultabile prima di impegnare un dado; ogni cambio di
stato causato da un dado o da un token è attribuibile alla sua causa con uno sguardo o
un clic; le catene di slam si risolvono un passo alla volta e si possono rivedere.

*Design test*: confine **"come un giocatore attento"** — si mostra tutto ciò che un
giocatore attento saprebbe al tavolo, niente che non potrebbe sapere. Sì ai token danno
già rivelati; no alle probabilità calcolate e alle mosse suggerite. Se un giocatore non
capisce perché ha perso un'auto, la UI mostra la causa.

### Pillar 3: Turni veloci, partita pronta
"Un gioco di turni rapidi e decisioni a dadi": un turno standard (assegna, comando,
muovi, spara) ha un budget fisso di azioni, le animazioni sono sempre saltabili o
accelerabili, e si arriva alla prima mossa e alla rivincita in pochi clic.

*Design test*: dall'avvio alla prima mossa, e da fine partita alla rivincita, in pochi
clic; scegliere e combinare espansioni non richiede di conoscere le regole di
preparazione (e offre solo le combinazioni previste dai regolamenti ufficiali). Un'
interazione che sfora il budget del turno si taglia o si accorpa. *Valori del budget
(tetto di azioni, tempo massimo di animazione obbligatoria) da fissare con il
game-designer prima del primo prototipo giocabile.*

### Principi tecnici (da formalizzare come ADR)

**T1. Stessa partita a ogni tavolo** — un solo nucleo di regole autorevole per hot seat
e online: nessuna regola o informazione differisce tra le due modalità; i tempi di
attesa (es. timer di turno online) sono un'opzione della partita.

**T2. Il gioco base è un pacchetto** — il gioco base si carica come pacchetto di
contenuto alla pari di qualunque espansione; le nuove meccaniche si aggiungono come
moduli di regole senza modificare quelli esistenti.

### Anti-Pillars (What This Game Is NOT)

- **NOT un riequilibrio**: non riequilibriamo né reinventiamo le regole (protegge il
  pilastro 1).
- **NOT un giocatore al posto tuo**: niente mossa suggerita o "mossa migliore", niente
  annullamento di decisioni confermate. Una decisione è **confermata** quando tira un
  dado, rivela un token (pericolo, danno, slam) o passa il turno; prima, riposizionare è
  pianificazione, come al tavolo con la mano ancora sull'auto (protegge il pilastro 1 e
  la padronanza, senza violare il 3).
- **NOT per smartphone**: tre tessere, cruscotti e catene di slam non sono leggibili
  sotto ~1024×768 (protegge il pilastro 2).
- **NOT una distribuzione della grafica**: gli asset ufficiali non vanno mai in un
  repository pubblico (licenza).
- **NOT un motore generico per giochi da tavolo**: costruiamo TR:V e le sue espansioni,
  non una piattaforma (protegge T2).

---

## Visual Identity Anchor: "Il tavolo fisico"

Scelta dell'utente tra le tre direzioni dell'art-director (gate AD-CONCEPT-VISUAL:
STRONG sulla direzione "Il tavolo leggibile", raccomandata; l'utente ha scelto "Il tavolo
fisico"). La grafica è quella **ufficiale Restoration Games** fornita dall'utente: la
direzione riguarda la presentazione digitale, non un nuovo stile.

**Regola visiva**: tutto sembra un oggetto che si può toccare sopra un tavolo.

**Principi**
1. **Spessore, ombra e peso**: tessere, segnalini e dadi hanno volume e proiettano
   ombra. *Test*: un segnalino spostato proietta un'ombra coerente con la luce della scena.
2. **Dado fisico, esito vero**: il dado rotola, ma la faccia che si ferma è sempre il
   risultato già deciso dal nucleo di regole. *Test*: la faccia mostrata è uguale al
   valore nello stato, sempre (verificato da test automatico sullo stato e screenshot).
3. **Rumore visivo controllato**: l'atmosfera non vince mai sulla leggibilità
   (pilastro 2). *Test*: il tavolo pieno non nasconde mai una casella, a 1024×768 e col
   touch.

**Filosofia del colore**: luce calda e materiali (feltro, legno, carta) attorno alla
grafica ufficiale, che conserva la sua palette. Il colore funzionale ha significato fisso
(uno per banda, uno per pericolo, uno per danno) ed è mediato dalla luce senza perdere
contrasto; pericolo e danno si distinguono anche per forma o icona, non solo per colore.

**Implicazioni**: 3D con three.js, camera fissa o pochi preset. Rischi noti (da
art-director e technical-director): leggibilità di segnalini coperti e auto piccole,
modelli di auto e dadi assenti nei file forniti, prestazioni su tablet.

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| Thunder Road: Vendetta (gioco da tavolo, Restoration Games 2022) | Tutte le regole, la grafica ufficiale, il ritmo "turni rapidi, decisioni a dadi" | Automatizza setup, contabilità e catene di slam; spiega ogni esito; gioco a distanza | È la fonte: il porting vale quanto la sua fedeltà |
| Thunder Road (1986), design originale di Jim Keifer (credito nel regolamento) | Il design originale che TR:V restaura | Nulla da prendere direttamente: le regole sono quelle di TR:V | Contesto della serie |
| Adattamenti manuali su tavoli virtuali generici | L'idea di giocare TR:V a distanza | Regole applicate e spiegate, zero setup, rivincita immediata | Mostra cosa manca a un tavolo virtuale manuale (non ricercato) |

**Non-game inspirations**: il tono "strada senza legge" della grafica ufficiale (da
fissare in `/art-bible` dopo aver visto le tavole).

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | Da regolamento: non per under 10; per il resto non definito (non ricercato) |
| **Gaming experience** | Mid-core: giocatori da tavolo abituati a dadi e interazione diretta |
| **Time availability** | Serate tra amici; durata della partita da misurare |
| **Platform preference** | Computer desktop o tablet, in casa o a distanza |
| **Current games they play** | Thunder Road: Vendetta in versione fisica (requisito per ricevere il gioco) |
| **What they're looking for** | Giocare TR:V senza setup, anche a distanza, con le regole gestite correttamente |
| **What would turn them away** | Regole sbagliate o "interpretate"; turni lenti; un tavolo illeggibile; un gioco che decide al posto loro |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | Già configurato con `/setup-engine`: Web (Vite 8.3.4, TypeScript 7.0.2, three.js 0.186.1, Vitest + Playwright). Stesso linguaggio per client e server |
| **Key Technical Challenges** | Nucleo di regole puro e deterministico (coda esplicita di effetti, RNG con seed, log di eventi con causa e versione); scorrimento delle tessere a metà mossa; stato completo vs vista per giocatore; consegna degli asset licenziati |
| **Art Style** | 3D "tavolo fisico" sulla grafica ufficiale 2D (tessere e plance come texture) |
| **Art Pipeline Complexity** | Medium: pipeline ripetibile da PDF/DOCX a texture via manifest; dadi procedurali; segnalini estrusi al posto delle miniature (assenti nei file) |
| **Audio Needs** | Moderate: firme sonore distinte per ogni esito (dadi, slam, sparo, danno) a supporto del pilastro 2 |
| **Networking** | Client-server con server autorevole (Node + TypeScript, nucleo di regole condiviso) dal Tier 2 |
| **Content Volume** | Gioco base: 5 tessere strada (fronte-retro) + traguardo, 26 token pericolo, 20 token danno, 4 bande (3 auto, elicottero, plancia comandi), 5 dadi FX. Espansioni dal Tier 4 |
| **Procedural Systems** | Nessuna generazione procedurale: solo mescolamento di tessere e token come al tavolo |

---

## Risks and Open Questions

### Design Risks
- La durata della partita e il ritmo dei turni in digitale non sono misurati: il budget
  del pilastro 3 va fissato e verificato nei playtest.
- Tensione tra "tavolo fisico" e leggibilità (pilastro 2): atmosfera e ombre possono
  coprire caselle o segnalini.
- Ambiguità del regolamento scoperte durante l'implementazione (gestite dal registro
  delle interpretazioni).

### Technical Risks
Gate TD-FEASIBILITY: **CONCERNS** — fattibile, nessun rischio invalida il concept; da
decidere prima del codice di gioco:
- **R2 (bloccante MVP)**: nucleo di regole puro `(stato, azione, rng) → (stato, eventi)`,
  coda esplicita di effetti per gli slam ricorsivi, RNG con seed, eventi con causa, log
  versionato (regole + content pack), stato completo vs vista per giocatore. Il dado 3D
  anima solo l'esito del nucleo.
- **R3 (bloccante MVP)**: scorrimento delle tessere a metà mossa ed eliminazioni, con
  test scritti prima del codice sui casi limite.
- **R4 (bloccante leggero)**: pipeline asset con manifest, caricamento a runtime (mai
  import statici da `assets/licensed/`), set di grafica segnaposto open per CI e test.
- **R5**: modelli 3D di auto e dadi assenti; dadi procedurali e segnalini estrusi nell'MVP.
- **R6**: prestazioni e leggibilità three.js su tablet; da verificare presto su un tablet reale.
- **R7**: server Node + TypeScript fattibile; redazione dell'informazione nascosta,
  costo di hosting no profit.

### Market Risks
- Progetto no profit, nessun obiettivo commerciale; pubblico limitato ai possessori della
  copia fisica (dimensione: non ricercata).

### Scope Risks
Gate PR-SCOPE: **OPTIMISTIC**, correzioni applicate (vedi MVP Definition). Rischi principali:
- Tempo prima del primo rilascio (Tier 1 tra 1 e 2+ anni) e perdita di motivazione:
  mitigato dalle milestone interne M0-M3 con demo giocabili.
- La presentazione 3D si allarga: Definition of Done del tavolo MVP scritta prima di M2.
- Licenza degli asset non decisa: blocca la distribuzione del Tier 1 (decisione prima di M3).
- Stime non tarate su velocity reale: confidenza Bassa-Media, ritaratura dopo 3 sprint.

### Open Questions
- **R1 — Consegna degli asset licenziati (decisione dell'utente, di licenza)**:
  raccomandazione del technical-director A + C (ogni proprietario importa il proprio
  pack locale verificato da hash, il server trasmette solo id; set segnaposto come
  fallback). Hosting privato (B) solo previo accordo con Restoration Games. Da decidere
  **prima del rilascio del Tier 1**.
- **Bot**: decisione rinviata; l'architettura (nucleo puro, azioni come dati) li lascia possibili.
- **Animazione del dado nell'MVP**: animazione minima del lancio o solo valore mostrato?
  (game-designer, prima di M2).
- **Screenshot di evidenza con arte licenziata**: `production/` non è escluso da git; se
  il repository diventa pubblico va deciso come trattarli (ADR sul caricamento asset).
- **Rigore di processo**: valutare `full` sul nucleo di regole e `standard` su UI e
  presentazione (decisione dell'utente con il technical-director).
- **Tono visivo** ("chrome" o grezzo): da fissare in `/art-bible` dopo aver visto le tavole.

---

## MVP Definition

**Core hypothesis**: il gioco base, con regole complete gestite e spiegate dal digitale,
si gioca in hot seat su un tavolo 3D leggibile mantenendo il ritmo "turni rapidi,
decisioni a dadi" del gioco fisico.

**Required for MVP** (Tier 1):
1. Nucleo di regole del gioco base completo e testato (assegnazione dadi, comandi,
   movimento e terreno, pericoli, slam ricorsivi, sparo e danni, elicottero, tessere
   scorrevoli, tessera finale e vittoria).
2. Hot seat da 2 a 4 giocatori, setup zero e rivincita rapida.
3. Tavolo 3D essenziale (camera fissa) con le tessere ufficiali, input mouse e touch di base.
4. Attribuzione testuale "esito ← causa" (dal log di eventi).
5. Registro delle interpretazioni del regolamento (come documento).
6. Pipeline asset con manifest e set segnaposto open; tessere importate dal proprietario.

**Explicitly NOT in MVP** (defer to later):
- Online (Tier 2).
- UI consultabile del registro delle interpretazioni, replay animato delle catene di
  slam, animazione fisica dei dadi, modelli finali delle auto, audio rifinito, tuning
  tablet (Tier 3).
- Espansioni (Tier 4). Bot (non decisi).

**Milestone interne del Tier 1**: M0 prototipo tecnico (3 tessere, camera fissa a
1024×768, dado procedurale con faccia imposta dal nucleo, prova su tablet reale; ~20-40 h)
→ M1 nucleo di regole headless che gioca una partita completa con test e debug minimo →
M2 tavolo 3D minimo collegato al nucleo → M3 hot seat completo (rilascio Tier 1).
Pre-produzione con time-box di ~120 h / 3-4 mesi, con 7 GDD (gruppo A di
`design/gdd/systems-index.md`) + requisiti di accessibilità; gli altri GDD
just-in-time prima delle relative story. Se anche il Tier 1 è a rischio, il minimo
rilasciabile è M1 + M2: mai una presentazione con regole incomplete (pilastro 1).

### Scope Tiers (if budget/time shrinks)

Stime del producer (PR-SCOPE), solo, overhead del rigore full incluso, confidenza
Bassa-Media; pianificazione su ~8 h/settimana.

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **Pre-produzione** | Concept, art bible, 7 GDD + requisiti di accessibilità, ~8-10 ADR, prototipo tecnico M0 | Gate fino a Pre-Production | 80-160 h (time-box ~120 h, 3-4 mesi) |
| **Tier 1 — MVP (hot seat)** | Gioco base completo, tessere ufficiali, segnalini e dadi segnaposto | Milestone M1-M3 (vedi sopra) | 370-790 h; **obiettivo: rilascio entro 2 anni** (con la pre-produzione: 450-950 h) |
| **Tier 2a — Online base** | Stesso contenuto del Tier 1 | Server autorevole, stanze, viste filtrate per giocatore, solo id degli asset | Parte di 200-400 h del Tier 2 |
| **Tier 2b — Online robusto** | — | Riconnessione robusta, operatività, hosting (auto-hosting documentato come opzione) | **Obiettivo Tier 2 completo: entro 3 anni** |
| **Tier 3 — Rifinitura** (budget continuo) | Modelli finali delle auto, audio | Animazioni, dado fisico animato, replay degli slam, UI del registro interpretazioni, tuning tablet | 150-350 h |
| **Tier 4 — Espansioni** | Una espansione alla volta: prima quella che tocca più regole, per validare i moduli | Combinazione con il gioco base | Prima 80-200 h, poi 40-150 h ciascuna |

Se il tempo finisce: si rilascia un **Tier 1 completo e fedele in hot seat**. Il ripiego
più probabile è a metà del Tier 2, pulito solo se l'online resta dietro un flag fino a
quando non è completo.

---

## Next Steps

- [x] Configurare l'engine (`/setup-engine`) — fatto: Web
- [x] Pilastri approvati dal creative-director (CD-PILLARS: APPROVE)
- [ ] `/art-bible` — identità visiva sulla grafica ufficiale (richiesto prima del gate Technical Setup a rigor full)
- [ ] `/design-review design/gdd/game-concept.md`
- [ ] Decidere R1 (consegna degli asset) prima del rilascio del Tier 1
- [ ] `/map-systems` → `/design-system` per ogni sistema del regolamento
- [ ] `/create-architecture` → ADR del nucleo di regole e del caricamento asset
- [ ] Prototipo tecnico M0
- [ ] `/architecture-review` → `/gate-check`
