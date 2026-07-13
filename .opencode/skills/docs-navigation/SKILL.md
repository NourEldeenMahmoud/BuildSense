---
name: docs-navigation
description: Teaches agents how to read BuildSense project documentation efficiently — search by headings and keywords, never load full files, record which sections were used.
---

# Documentation Navigation Skill

Load this skill when starting any task that requires understanding project decisions, architecture, or requirements.

## Core Rules

1. **Start with the assigned task.** Identify what information you actually need before reading anything.
2. **Search by headings and keywords.** Use grep or targeted reads to find relevant sections. Never load an entire large document into context.
3. **Read the foundation ADR first** (`docs/ADR/ADR-000-project-foundation-decisions.md`) for any architectural or structural work.
4. **Read only the relevant TDD section** for your current task. The TDD is ~3600 lines — load only the sections you need by offset and limit.
5. **Avoid the complete PRD** unless a specific fact is missing from both the ADR and TDD.

## Documentation Hierarchy

| Priority | Document | Location |
|----------|----------|----------|
| 1 | Current task / issue | Explicit assignment |
| 2 | ADR files | `docs/ADR/` |
| 3 | TDD | `docs/TDD/` |
| 4 | PRD | `docs/PRD/` |
| 5 | Existing code and tests | `apps/`, `packages/` |

## TDD Section Map

Use these section numbers to target reads:

- `# 1` — Design summary
- `# 3` — Technology baseline
- `# 4` — Repository structure
- `# 5` — Runtime architecture
- `# 6` — Configuration and environments
- `# 19` — REST API design
- `# 20` — API module design
- `# 21` — Angular application design
- `# 24` — Database design
- `# 28` — Testing strategy
- `# 29` — CI/CD
- `# 33` — Implementation phases (M0–M11)
- `# 35` — Coding standards
- `# 37` — Definition of Done

## What to Record

After reading documentation, note which sections you used:

```
Documentation used:
- ADR-000 §3 (ADR-000.1 Repository Strategy)
- TDD §4 (Repository Structure)
- TDD §33 Phase M0
```

## What Not to Do

- Never load the full PRD or TDD into context in a single read.
- Never invent requirements that are absent from the documentation.
- Never assume a decision was made without finding the ADR or TDD entry.
- If a decision is missing, report it as a gap rather than guessing.
