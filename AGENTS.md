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

- Lockfiles (`package-lock.json`) exist in all 4 locations (root + 3 servers). `npm ci` or `npm install` will use them.
- Dependencies must be installed in all 4 locations: root + `servers/eda` + `servers/tmux` + `servers/knowledge`. Use `npm run install:all` or install each separately.
- The project uses ES modules (`"type": "module"` in `package.json`). All source is plain JavaScript (no TypeScript build step).
- The TUI (Ink/React) renders to terminal; in CI-like environments, set `CI=true` to prevent interactive TTY issues.
- EDA tools (ICC2, Innovus, PrimeTime) are commercial software not available in cloud VMs. HiPilot works without them for Tcl generation, skill browsing, and template management.
- tmux is required for workspace layout features but not for unit tests or MCP server testing.
- **tmux send-keys**: Always use `-l` flag for literal text and `C-m` (unquoted) for Enter. Never put `Enter` inside quotes — tmux treats quoted `'Enter'` as literal text, not a keypress. See `servers/tmux/index.js` `send_keys` handler.
- **settings.json on EDA server**: The `env` section stores API keys. Deployment (`deploy_hipilot.js`) deep-merges env to preserve existing keys — only `command`/`args` are updated. Never overwrite the entire env section.
- **HiTestBot single mode**: HiTestBot only uses prompt-driven mode (human-like). It types in the Claude Code pane and observes. It never calls MCP directly or sends commands to the EDA pane.
- **Deployment as tools**: HiPilot and HiTestBot are deployed to EDA server as self-contained packages (node_modules included in tarball). No `npm install` runs on the EDA server.

### Identity Separation (IMPORTANT)

Three AI roles exist in this project. They must NEVER be confused:

1. **Developer AI** (you) — reads root `CLAUDE.md`, writes code. No MCP servers connected.
2. **HiPilot AI** (Claude Code on EDA server) — reads `deploy/eda-server/CLAUDE.md`, drives EDA tools via MCP. Does NOT know about tests or deployment.
3. **HiTestBot** (test framework) — observes HiPilot from outside. Sends prompts via tmux, captures evidence, scores results. HiPilot should NOT know it's being tested.

The `deploy/eda-server/` directory contains the HiPilot identity config:
- `CLAUDE.md` — "You are HiPilot" (clean of all test/observer info)
- `.claude/settings.json` — MCP servers (absolute EDA server paths)
- `.claude/commands/` — 8 slash commands

**Rule:** Never put test infrastructure, SSH passwords, HiTestBot references, or deployment details into `deploy/eda-server/CLAUDE.md`.

### Documentation structure

- `docs/` — All documentation (guides, specs, testing)
- `deploy/eda-server/` — EDA server deployment config
- See `README.md` for the documentation index.
