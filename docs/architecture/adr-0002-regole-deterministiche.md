# ADR-0002: Le regole come generatore deterministico: una partita è un seed più l'elenco delle scelte

## Status

Accepted. È una decisione che è nel codice dal 2026-11-15 (GDD `rules-core.md` e `dice-seeded-rng.md`),
messa per iscritto il 2026-11-19.

## Date

2026-11-19

## Last Verified

2026-11-19: `npx tsc --noEmit -p .` e `npm run test:unit`. Tra i test ci sono quelli che rigiocano la
stessa partita con lo stesso seed e le stesse scelte, anche con le espansioni.

## Decision Makers

L'utente (progetto del nucleo, 2026-11-15), Claude (stesura).

## Summary

Il motore (`src/game/trv/engine.ts`) è una funzione generatrice. `play(g)` avanza finché le regole hanno
bisogno di una scelta, la restituisce come `Decision` e riprende quando riceve l'indice dell'opzione
scelta. Tutto il caso passa da `src/core/rng` (ChaCha20 con seed). Seed più elenco delle scelte danno
quindi la partita, identica su ogni dispositivo.

## Engine Compatibility

TypeScript puro, senza dipendenze dal browser né da three.js: gira in Vitest, nel browser e, in futuro,
su un server.

## ADR Dependencies

Nessuna. È la base di ADR-0003 (rete) e ADR-0005 (presentazione).

## Context

### Problem Statement

- Il gioco deve funzionare in hot seat e online con lo stesso nucleo.
- Ogni dado deve potersi spiegare (Pilastro 2).
- Le partite devono potersi rigiocare: per annullare una mossa, per il replay e per i test.

### Constraints

- Le regole vengono solo dal regolamento: devono essere leggibili accanto al testo e nello stesso ordine.
- Molte regole chiedono una scelta a metà di un'altra regola, per esempio un ritiro durante uno slam o
  una carta durante il draft. Una macchina a stati scritta a mano renderebbe queste catene illeggibili.

## Decision

- **Generatore**: `type Gen<T> = Generator<Decision, T, number>`. Ogni regola che chiede qualcosa fa
  `yield* ask(g, decision)`, e il chiamante risponde con `next(indice)`.
- **Caso dal seed**: `roll`, `shuffle` e gli altri tiri passano da `src/core/rng`, con lo stato in
  `g.rng`. Nelle regole non c'è nessun `Math.random`.
- **Rigioco**: uno stato si ricostruisce rifacendo `newGame(setup)` e riapplicando le scelte in ordine
  (`startGame` in `src/app/game.ts`). Annulla, replay e rete passano tutti da qui.
- **Bot**: ai TRV9000 non si chiede nulla. `ask` risponde da sé con `botChoice`, in modo deterministico.
- **Uscite per l'interfaccia**: righe di registro (`g.log`) e fotogrammi (`g.frames`, ADR-0005). Le
  regole non li leggono mai.

### Key Interfaces

- `newGame(s: Setup): Game`
- `play(g): Gen<void>`
- `Decision { kind, player, prompt, options }`
- `Setup { seed, players, startSide, leaders?, upgrades?, carnage? }`

## Alternatives Considered

### Alternativa 1: macchina a stati esplicita con azioni serializzate

È la scelta più comune nei giochi online. Avrebbe però spezzato ogni regola in stati e transizioni
lontani dal testo del regolamento, proprio dove le catene sono più lunghe (slam, Big Rig).

### Alternativa 2: stato completo inviato a ogni passo

È più semplice da sincronizzare, ma la partita non si può rigiocare e il caso non si può verificare.

## Consequences

### Positive

- Una partita si rigioca identica: test riproducibili, annulla, replay, rete leggera.
- Le regole si leggono nell'ordine del regolamento, anche quando chiedono qualcosa a metà.

### Negative

- Annullare costa un rigioco dall'inizio. È accettabile: una partita è breve.
- Il seed è condiviso, quindi un client modificato può prevedere i dadi (vedi ADR-0003).
- Un cambio alle regole cambia le partite salvate: le scelte vecchie possono non adattarsi più.

### Neutral

`engine.ts` è un file grande. Si può dividere senza cambiare questo contratto.

## Risks

- **Non determinismo nascosto**: per esempio un'iterazione su `Map` o `Set` con chiavi che dipendono
  dall'ordine, oppure gli orari. Mitigazione: test di rigioco su partite casuali.

## GDD Requirements Addressed

- `rules-core.md`: coda con decisioni pendenti, registro con causa.
- `dice-seeded-rng.md`: stesso seed più stesso registro danno la stessa partita.

## Performance Implications

Un rigioco completo è abbastanza veloce da far girare centinaia di partite casuali nei test unitari.

## Validation Criteria

I test "replays the same game…" in `tests/unit/trv/` passano per il gioco base e per ogni espansione.

## Related

ADR-0003, ADR-0004, ADR-0005; `src/core/rng/rng.ts`.
