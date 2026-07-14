## Permanent Agent and Model Routing Policy

For every development task, use the custom agent patterns located in:

- `.agents/agents/manager.md`
- `.agents/agents/project-explorer.md`
- `.agents/agents/code-writer.md`

### Model Assignment

- **Manager:** GPT-5.6 Sol
- **Project Explorer:** GPT-5.6 Sol
- **Code Writer:** GPT-5.3-Codex

### Required Workflow

For non-trivial tasks, follow this workflow:

1. Use the **project-explorer** pattern with GPT-5.6 Sol to inspect the repository, identify relevant files, understand architecture and constraints, and produce an implementation plan.
2. Use the **code-writer** pattern with GPT-5.3-Codex to implement the approved plan, add or update tests, and run the required validation commands.
3. Use the **manager** pattern with GPT-5.6 Sol to review the implementation, detect scope violations or incomplete work, and provide the final report.

For small and isolated changes, the manager may delegate directly to the code-writer after a minimal repository inspection.

### Enforcement Rules

- Always prefer GPT-5.6 Sol for planning, architecture, investigation, auditing, and final synthesis.
- Always prefer GPT-5.3-Codex for writing, modifying, debugging, and testing code.
- Do not silently substitute another model.
- Before starting, verify that the requested model is available in the current runtime.
- If a requested model is unavailable, report that clearly and ask for approval before using a fallback.
- Never claim that a model was used unless the runtime actually confirms it.
- Each delegated agent must report the model it actually used.
- Do not modify unrelated files or expand the task scope.
- Do not mark work complete until the relevant lint, typecheck, tests, build, and format checks pass.
- Preserve all project architecture rules, ADR decisions, phase boundaries, and existing repository conventions.

### Final Report

Every completed task must report:

- Agents used
- Actual model used by each agent
- Files changed
- Tests and validation commands executed
- Exact pass/fail results
- Remaining blockers or risks
