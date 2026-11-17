# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Progetto: Thunder Road Vendetta (porting digitale)

Lingua di lavoro con l'utente: **italiano**.

- **Cosa**: versione digitale fedele del gioco da tavolo *Thunder Road: Vendetta*
  di Restoration Games. Prima il **gioco base**; le espansioni dopo, quindi le
  regole vanno progettate come contenuto estendibile fin dall'inizio.
- **Licenza d'uso**: l'utente ha il permesso di Restoration Games. Progetto no
  profit e open source, distribuito solo a chi possiede la copia fisica.
- **Fonte delle regole**: il regolamento ufficiale fornito dall'utente
  (`reference/rulebook/`) è l'unica autorità. Non inventare né "ricordare"
  regole: se manca un dettaglio, chiedi.
- **Asset**: in `assets/`, per gioco e per tipo (`base/`, `choppe_shoppe/`, `carnage/`, con
  `modelli/`, `carte/`, `segnalini/`…). I file ufficiali originali sono in `assets/sorgenti/`, ciò
  che se ne estrae in `assets/estratti/` (entrambi fuori da git). L'utente
  sviluppa la versione digitale insieme a Restoration Games e ha il loro permesso
  di pubblicarla: gli asset possono andare nel repository e sul sito (decisione
  dell'utente, 2026-11-16). Il regolamento in `reference/rulebook/` resta fuori
  da git.
- **Modalità di gioco**: hot seat in locale (stesso dispositivo) **e** online
  remoto su internet, con server autorevole.
- **Pull request**: dopo ogni push sul branch di lavoro, apri sempre (o aggiorna)
  la pull request verso `main`, senza chiedere (richiesta dell'utente, 2026-11-16).
  Il merge resta all'utente.
- **Piattaforme**: computer desktop, al massimo tablet. **Niente smartphone**:
  viewport minimo circa 1024×768, input mouse e touch.

## Technology Stack

- **Engine**: Web (Vite 8.3.4, TypeScript 7.0.2, three.js 0.186.1)
- **Language**: TypeScript
- **Version Control**: Git with trunk-based development
- **Build System**: Vite — `npm run build` for `dist/`, `npm run build:single` for one self-contained HTML file
- **Asset Pipeline**: plain files in `assets/`, imported in the code

> **Note**: Engine-specialist agents exist for Godot, Unity, and Unreal with
> dedicated sub-specialists. Use the set matching your engine.

## Project Structure

@.claude/docs/directory-structure.md

## Engine Version Reference

<!-- ENGINE-REFERENCE-IMPORT: the line under this comment is engine-specific,
     and there is none until an engine is set. /setup-engine, the grow's record
     step and /project-settings (engine.name) write
     @docs/engine-reference/<engine>/VERSION.md here for the chosen engine. Skills
     that need the pinned version read that file on demand either way. -->
@docs/engine-reference/web/VERSION.md


## Technical Preferences

`project.yaml` at the repo root is the primary config store — engine, specialists,
naming, platform, performance, modes. Skills resolve it via `resolve_config`
(see `.claude/docs/config-resolution.md`).

`.claude/docs/technical-preferences.md` is the **legacy fallback**, read on demand
when a key is absent from `project.yaml`. It is not imported here: before
`/setup-engine` runs it is almost entirely `[TO BE CONFIGURED]` placeholders, and
after it runs `project.yaml` holds the real values.

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
  (exempt: `active.md` appends, agent memory, a subagent's new file at the path
  its orchestrating skill named; see `.claude/rules/agent-memory.md`)
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction
- A skipped or dismissed question is not an answer: act on nothing, re-ask in
  plain text and wait
- Started outside this file's folder? Warn first: hooks, deny rules and the
  ask-first mode load only when Claude Code starts here

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** Say "make me a game" (`/prototype`), or run `/start` to begin
> the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

Read `.claude/docs/context-management.md` on demand — it is a reference, not
session context. Two of its conventions are load-bearing and cited by name
elsewhere in the repo, so they are restated here rather than lost:

- **`production/session-state/active.md` is the session checkpoint.** The file is
  the memory, not the conversation. Read it first after any compaction, crash, or
  `/clear`.
- **Helpers in `.claude/scripts/` emit observations, never verdicts.** A script
  that scores or judges will eventually contradict a mode or override it cannot
  see. (Cited by `artifact-check.sh` and `adr-dep-graph.sh`.)
