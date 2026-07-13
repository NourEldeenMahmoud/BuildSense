---
name: implement-one-task
description: Standard implementation workflow for a single BuildSense task. Enforces planning, scoping, testing, validation, and reporting before stopping.
---

# Implement One Task Skill

Load this skill when beginning any implementation task. It enforces a disciplined workflow that prevents scope creep and ensures quality.

## Workflow

### 1. Restate the Task

Write 1–2 sentences summarizing what you will do, in your own words.

### 2. Identify Relevant Documentation

- Which ADR sections apply?
- Which TDD sections apply?
- Is the PRD needed for this task?

Record which sections you read.

### 3. Inspect Relevant Files Only

- Read only the files directly related to the task.
- Do not read the entire codebase for context.
- Use grep and targeted reads.

### 4. Produce a Short Plan

List 3–7 concrete steps. Each step should be a single file change or a small logical unit.

### 5. Implement Only the Requested Scope

- Make the smallest coherent change.
- Do not add unrelated refactoring.
- Do not "improve" nearby code.
- Follow existing code conventions (naming, structure, patterns).

### 6. Add or Update Tests

- Unit tests for new logic.
- Integration tests if persistence or API contracts change.
- Do not write tests for pure scaffolding unless the task requires it.

### 7. Run Validation

Run the relevant commands when available:

```bash
npx nx run <project>:lint
npx nx run <project>:test
npx nx run <project>:typecheck
npx nx run <project>:build
```

If a command fails, fix the issue before proceeding.

### 8. Review the Diff

- Check for boundary violations (see `architecture-guard` skill).
- Check for unintended changes.
- Verify tests pass and coverage is reasonable.

### 9. Report

Provide a concise summary:

```
Modified files:
- apps/api/src/modules/health/health.controller.ts

Validation:
- lint: passed
- test: 3 passed, 0 failed
- typecheck: passed

Limitations:
- None

Follow-up:
- Consider adding integration test for database health check
```

### 10. Stop

Do not start another task. Wait for the next assignment.

## Prohibitions

- No opportunistic refactoring.
- No "while I'm here, let me also fix..." changes.
- No creating files or directories not explicitly part of the task.
- No committing unless the user explicitly asks.
- No running destructive git commands.
- No adding dependencies not approved by the task.
