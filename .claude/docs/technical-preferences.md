# Technical Preferences

<!-- project.yaml at the repo root is the machine-readable source of truth for
     engine, specialists, naming, performance, platform, and testing.framework.
     This file is the human-readable LEGACY FALLBACK: agents and skills resolve
     each key from project.yaml first and fall back here only when the
     project.yaml key is absent. /setup-engine dual-writes both.
     Forbidden patterns and allowed libraries are NOT migrated — they live only
     in this file. Populated by /setup-engine; updated as decisions are made. -->

## Engine & Language

- **Engine**: Web (Vite 8.3.4, TypeScript 7.0.2, three.js 0.186.1)
- **Language**: TypeScript
- **Rendering**: three.js (WebGL)
- **Physics**: none

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web (desktop browser, tablet)
- **Input Methods**: Mouse, Touch
- **Primary Input**: Mouse
- **Gamepad Support**: None
- **Touch Support**: Full
- **Platform Notes**: Minimum viewport about 1024x768; no smartphone support. No hover-only interactions (touch has no hover).

## Naming Conventions

- **Classes**: PascalCase (types and interfaces too, e.g. `GameHook`)
- **Variables**: camelCase (functions too, e.g. `newState()`)
- **Signals/Events**: on<Event> handlers
- **Files**: kebab-case (e.g. `rules.ts`)
- **Scenes/Prefabs**: not applicable on Web (no scene files)
- **Constants**: SCREAMING_SNAKE (module level, e.g. `STEP`)

## Performance Budgets

<!-- Defaults set by /setup-engine; validate against real hardware once there is a build. -->

- **Target Framerate**: 60 fps
- **Frame Budget**: 16.6 ms
- **Draw Calls**: 500 per frame (default for three.js/WebGL; to be measured)
- **Memory Ceiling**: [TO BE CONFIGURED — set once target hardware is known]

## Testing

- **Framework**: Vitest (unit, `tests/unit/`) + Playwright (integration, `tests/integration/`)
- **Minimum Coverage**: [TO BE CONFIGURED]
- **Required Tests**: Balance formulas, gameplay systems, networking (if applicable)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- [None configured yet — add as architectural decisions are made]

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- [None configured yet — add as dependencies are approved]

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: lead-programmer (Web has no engine specialist agent)
- **Language/Code Specialist**: lead-programmer
- **Shader Specialist**: lead-programmer
- **UI Specialist**: lead-programmer
- **Additional Specialists**: none
- **Routing Notes**: Engine work and API checks go to `lead-programmer`, verified against `docs/engine-reference/web/`.

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (primary language) | lead-programmer |
| Shader / material files | lead-programmer |
| UI / screen files | lead-programmer |
| Scene / prefab / level files | lead-programmer |
| Native extension / plugin files | lead-programmer |
| General architecture review | Primary |
