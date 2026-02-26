# HiPilot — VLSI Physical Design Copilot

HiPilot is a command (`bin/hipilot`) that creates a two-pane tmux workspace on an EDA server. The left pane runs Claude Code (Anthropic's AI CLI). The right pane runs EDA tools (Innovus, ICC2, PrimeTime). Claude Code controls the EDA tool through MCP servers — the engineer only types in the left pane.

**Core value:** 36 skills encode senior engineer expertise. Claude Code reads these skills and follows them to generate Tcl, execute it, check for errors, and report results. The engineer gets senior-level workflows without memorizing EDA tool commands.

## Quick Start

```bash
# Install dependencies (root + 3 MCP servers)
npm run install:all

# Launch HiPilot (creates the tmux workspace)
bin/hipilot
```

This opens a terminal with two panes. Claude Code starts in the left pane. Type `/rtl2gds` to run the full RTL-to-GDS flow, or `/timing` to check timing.

## How It Works

```
┌─── Left Pane ────────────────┬─── Right Pane ───────────────┐
│  Claude Code                  │  Innovus / ICC2 / PrimeTime  │
│  (the engineer types here)    │  (Claude controls this pane)  │
│                               │                               │
│  1. Engineer types /rtl2gds   │                               │
│  2. Claude loads skill        │                               │
│  3. Claude generates Tcl   ──────▶ 4. EDA tool executes Tcl  │
│  6. Claude reads result    ◀────── 5. EDA tool produces output│
│  7. Claude reports to user    │                               │
└───────────────────────────────┴───────────────────────────────┘
```

Claude Code communicates with the right pane through 3 MCP servers (Node.js processes that Claude Code spawns automatically):

| MCP Server | Tools | Purpose |
|---|---|---|
| `hipilot-eda` | 52 | Tcl generation, execution, error checking, timing metrics |
| `hipilot-tmux` | 8 | Pane control, status bar |
| `hipilot-knowledge` | 7 | Skill lookup, documentation search |

## Project Structure

```
hipilot/
├── bin/hipilot              # The product: launches the tmux workspace
├── servers/                 # 3 MCP servers (eda, tmux, knowledge)
├── skills/                  # 36 expert workflow guides (.md files)
├── templates/               # 22 Tcl templates (Synopsys + Cadence)
├── src/                     # CLI entry point, TUI dashboard, utilities
│   └── hitestbot/           # HiTestBot: tests HiPilot by using it like a human
├── deploy/eda-server/       # HiPilot identity files for the EDA server
├── test/                    # Unit tests (vitest, 118 tests)
└── docs/                    # Reference documentation
```

## Development

```bash
npm run install:all          # Install dependencies (root + 3 servers)
npm test                     # Unit tests (118 tests)
bin/hipilot                  # Launch workspace (the product)
node src/cli.js status       # TUI status dashboard
node src/cli.js skills       # List 36 skills
node src/cli.js templates    # List 22 templates
```

Test MCP servers locally:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/tmux/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/knowledge/index.js
```

## Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Developer constitution — how everything works, all rules |
| [docs/architecture.md](docs/architecture.md) | System design |
| [docs/mcp-servers.md](docs/mcp-servers.md) | MCP tool reference (52 + 8 + 7 tools) |
| [docs/skills-guide.md](docs/skills-guide.md) | All 36 skills |
| [docs/deploy-guide.md](docs/deploy-guide.md) | Deployment to EDA server |
| [docs/testing/TESTING_RULES.md](docs/testing/TESTING_RULES.md) | Testing philosophy |

## Technology

Node.js v20+ (ES Modules), plain JavaScript, MCP SDK, Nunjucks templates, React/Ink TUI, Vitest.

## License

MIT — See [LICENSE](LICENSE).
