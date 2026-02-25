# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

HiPilot is a VLSI Physical Design Copilot (v0.5.0) — a Node.js application with 3 MCP servers (EDA, Tmux, Knowledge), a React/Ink TUI dashboard, 35 skills, and 20 Tcl templates. See `CLAUDE.md` for full architecture context.

### Running services

All MCP servers communicate over stdio (JSON-RPC), not HTTP. No databases, Docker, or network services are required.

- **TUI Dashboard**: `node src/cli.js` (or subcommands: `skills`, `templates`, `help`, `version`)
- **MCP Servers**: test individually via piped JSON-RPC, e.g. `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js`
- **Setup Wizard**: `npm run setup` or `bash bin/setup.sh`

### Testing

- Unit tests: `npm test` (runs `vitest run` — 9 test files, 118 tests)
- E2E tests: `npm run test:e2e` (requires tmux session; see `vitest.e2e.config.js`)
- Coverage: `npm run test:coverage`
- Testing philosophy: see `docs/testing/TESTING_RULES.md`

### Key gotchas

- No lockfile exists in the repo. `npm install` resolves versions from `package.json` ranges each time.
- Dependencies must be installed in all 4 locations: root + `servers/eda` + `servers/tmux` + `servers/knowledge`. Use `npm run install:all` or install each separately.
- The project uses ES modules (`"type": "module"` in `package.json`). All source is plain JavaScript (no TypeScript build step).
- The TUI (Ink/React) renders to terminal; in CI-like environments, set `CI=true` to prevent interactive TTY issues.
- EDA tools (ICC2, Innovus, PrimeTime) are commercial software not available in cloud VMs. HiPilot works without them for Tcl generation, skill browsing, and template management.
- tmux is required for workspace layout features but not for unit tests or MCP server testing.

### Documentation structure

- `docs/` — Active documentation (guides, specs, testing)
- `archive/` — Superseded docs, old plans, evidence (reference only)
- See `README.md` for the documentation index.
