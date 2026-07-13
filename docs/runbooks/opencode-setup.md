# OpenCode Setup Runbook

## Current OpenCode Files

```text
AGENTS.md                           — Project instructions for AI agents
opencode.jsonc                      — Project-local OpenCode configuration
.opencode/skills/docs-navigation/   — How to read project documentation
.opencode/skills/m0-foundation/     — M0 phase guidance and constraints
.opencode/skills/architecture-guard/ — Boundary and dependency validation
.opencode/skills/implement-one-task/ — Single-task implementation workflow
.opencode/skills/code-review/       — Read-only code review checklist
```

## How to Use Skills

OpenCode discovers skills automatically and loads them when their description matches the current task. Skills are defined in `.opencode/skills/` with a `SKILL.md` file containing YAML frontmatter.

Each skill declares:
- `name` — unique identifier
- `description` — when and why to load it

Skills are loaded on demand. No manual registration is needed.

### Skill Loading Triggers

| Skill | Load When |
|-------|-----------|
| `docs-navigation` | Starting any task that needs project context |
| `m0-foundation` | Working on M0 repository foundation tasks |
| `architecture-guard` | Reviewing imports, adding packages, checking boundaries |
| `implement-one-task` | Beginning any implementation task |
| `code-review` | Reviewing a PR or diff |

## Phase-Based MCP Plan

### M0 (Current)
- Nx integration only after Nx workspace is initialized.
- No other MCP servers needed.

### After GitHub Setup
- Optional GitHub MCP with minimal read-only permissions.
- Never commit tokens to the repository.

### M1 — Sigma Data Discovery
- Playwright MCP for browser exploration, category navigation, pagination inspection, and dynamic page investigation.
- Playwright must not automatically become the production scraper.

### M2/M3
- MongoDB MCP in read-only mode for development data.
- Use environment variables for connection strings.
- Never connect to production data.

## Adding New Skills

1. Create a directory under `.opencode/skills/<skill-name>/`.
2. Add a `SKILL.md` file with YAML frontmatter containing `name` and `description`.
3. Write focused instructions in the body.
4. OpenCode will discover it automatically on next session.

## Security

- Never commit secrets, tokens, or credentials to the repository.
- Never store API keys in `opencode.jsonc` or any tracked file.
- Use environment variables or official authentication mechanisms.
- Keep destructive permissions denied by default.
- Review agent-generated commands before approving execution.
- `.env.example` documents required variables — actual values go in `.env` which is gitignored.

## Troubleshooting

Check OpenCode configuration:

```bash
# List configured MCP servers
opencode mcp list

# Enable debug logging
opencode --log-level DEBUG

# Verify skills are discovered
# Skills appear in the available_skills list in system prompt
```

If a skill is not loading:
- Verify the YAML frontmatter is valid.
- Ensure `name` is lowercase and hyphenated.
- Ensure `description` clearly states when to use it.
- Check that the file is at `.opencode/skills/<name>/SKILL.md`.
