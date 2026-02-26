# HiPilot - VLSI Physical Design Copilot

**Version:** 0.5.0 | **Status:** Production Ready | **Last Updated:** 2026-02-25

---

## What is HiPilot?

HiPilot is an **AI-powered VLSI Physical Design Copilot** that extends Claude Code with specialized MCP servers and skills for semiconductor design automation. It provides EDA engineers with natural language control over tools like Innovus, ICC2, and PrimeTime through a tmux-based workspace.

**Core value:** Skills encode team expertise, making senior-level workflows executable by anyone.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Tcl Generation** | Generate vendor-specific Tcl from natural language (22 templates) |
| **EDA Tool Control** | Control Innovus, ICC2, PrimeTime via MCP servers |
| **36 Built-in Skills** | Complete RTL-to-GDS flow coverage |
| **Real Design Tested** | Validated on Ibex RISC-V CPU (Sky130, 7,000+ cells) |
| **Multi-Vendor** | Synopsys (ICC2, DC, PT) and Cadence (Innovus) |
| **Safety System** | Manual/Auto execution modes with risk analysis |

### The AI + EDA Feedback Loop

```
Claude Code (Pane 0)          Innovus/ICC2 (Pane 1)
────────────────────────────────────────────────────
1. Generate Tcl from skill  →  2. Execute Tcl
4. Analyze results (capture) ← 3. Produce output
5. Fix issues if needed     →  6. Re-execute
```

---

## Quick Start

```bash
# Install dependencies
npm run install:all

# Launch HiPilot (tmux workspace)
bin/hipilot

# Or use TUI dashboard for status/skills/templates
node src/cli.js status
```

See [docs/quick-start.md](docs/quick-start.md) for the complete first-time setup guide.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Claude Code ─── MCP Layer ─── EDA Tools               │
│       │          (3 Servers)     (Innovus/ICC2/PT)      │
│       │              │                │                  │
│   35 Skills     tmux Workspace    Log Files / Reports   │
└────────────────────────────────────────────────────────┘
```

| Component | Tools | Purpose |
|-----------|-------|---------|
| **EDA MCP Server** | 52 tools | Tcl generation, tool control, QoR, workflows |
| **Tmux MCP Server** | 8 tools | Workspace management, pane control |
| **Knowledge MCP Server** | 7 tools | Skill loading, doc search, command ref |

---

## Project Structure

```
hipilot/
├── bin/                    # Launcher scripts
├── servers/                # 3 MCP servers (eda, tmux, knowledge)
├── skills/                 # 35 skill definitions (.md)
├── templates/              # 20 Tcl templates (synopsys/, cadence/)
├── src/                    # Core source (CLI, TUI, libraries)
│   ├── cli.js              # TUI dashboard (React/Ink)
│   ├── hitestbot/          # E2E test framework
│   └── lib/                # Utilities (mode, risk, paths)
├── data/                   # Command reference (JSON)
├── test/                   # Unit tests (vitest)
├── deploy/eda-server/      # EDA server deployment config
└── docs/                   # Documentation (see below)
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/quick-start.md](docs/quick-start.md) | First-time user guide |
| [docs/architecture.md](docs/architecture.md) | System design and components |
| [docs/skills-guide.md](docs/skills-guide.md) | All 35 skills documented |
| [docs/mcp-servers.md](docs/mcp-servers.md) | MCP integration reference |
| [docs/rtl2gds-flow.md](docs/rtl2gds-flow.md) | Complete RTL-to-GDS flow guide |
| [docs/deploy-guide.md](docs/deploy-guide.md) | Installation and deployment |
| [docs/eda-server-setup.md](docs/eda-server-setup.md) | EDA server configuration |
| [docs/testing/TESTING_RULES.md](docs/testing/TESTING_RULES.md) | Testing philosophy and rules |
| [docs/testing/hitestbot-guide.md](docs/testing/hitestbot-guide.md) | HiTestBot E2E guide (EDA-only, sync scripts) |
| [docs/HITESTBOT_V2_PLAN.md](docs/HITESTBOT_V2_PLAN.md) | HiTestBot v2 architecture and components |
| [docs/DEVELOPMENT_PLAN_v060.md](docs/DEVELOPMENT_PLAN_v060.md) | v0.6.0 development roadmap and gaps |
| [docs/self-improving-loop.md](docs/self-improving-loop.md) | Self-improving loop for ralph-loop (metrics + progress) |

**For developers:** Also read [CLAUDE.md](CLAUDE.md) (architecture context) and [AGENTS.md](AGENTS.md) (cloud dev instructions).

---

## Development

### Prerequisites

- Node.js v20+ (ES modules)
- npm 10+
- tmux 3.4+ (for workspace features)

### Install & Test

```bash
npm run install:all     # Install all dependencies (root + 3 servers)
npm test                # Run unit tests (vitest, 118 tests)
bin/hipilot             # Launch HiPilot (the product)
```

### Run MCP Servers (standalone)

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/tmux/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/knowledge/index.js
```

### TUI Commands

```bash
node src/cli.js status       # Status dashboard
node src/cli.js skills       # List 36 skills
node src/cli.js templates    # List 22 Tcl templates
node src/cli.js help         # All CLI commands
```

---

## Tested Design: Ibex RISC-V CPU

| Attribute | Value |
|-----------|-------|
| **Design** | Ibex Core (RV32IMC) |
| **Technology** | Skywater 130nm HD |
| **Cells** | ~7,000 instances |
| **Target** | 100 MHz |
| **Flow** | Complete RTL-to-GDS verified |

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Repository:** https://github.com/qfliuyang/hipilot
