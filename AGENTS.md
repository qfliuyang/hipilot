# AGENTS.md

## Cursor Cloud specific instructions

Read `CLAUDE.md` first — it is the single source of truth for this project.

### Cloud VM notes

- No lockfile issues: `package-lock.json` exists in all 4 locations. `npm run install:all` handles everything.
- ES modules (`"type": "module"`). Plain JavaScript, no build step.
- Set `CI=true` for TUI commands in non-TTY environments.
- EDA tools (Innovus, ICC2, PrimeTime) are commercial software not available in cloud VMs. HiPilot works without them for Tcl generation, skill browsing, and template management.
- tmux is needed for workspace features but not for unit tests or MCP server testing.
