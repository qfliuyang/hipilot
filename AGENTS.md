# AGENTS.md

## Cursor Cloud specific instructions

**Read `CLAUDE.md` first.** It is the single source of truth for this project. It defines what HiPilot and HiTestBot are, how they work, the three identities, the infrastructure chain, and the rules.

### What you need to know for cloud VM development

- **No EDA tools in cloud VMs.** Innovus, ICC2, PrimeTime are commercial software only available on the EDA server (192.168.112.163). You can still run unit tests, test MCP servers locally (pipe JSON-RPC), browse skills/templates, and develop code.
- **Dependencies:** Run `npm run install:all` to install in all 4 locations (root + `servers/eda` + `servers/tmux` + `servers/knowledge`). Lockfiles exist. ES modules (`"type": "module"`), plain JavaScript, no build step.
- **TUI in CI:** Set `CI=true` when running TUI commands (`node src/cli.js`) in non-TTY environments to avoid interactive rendering issues.
- **tmux:** Needed for `bin/hipilot` workspace features, but NOT needed for unit tests or MCP server testing.
