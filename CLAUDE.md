# CLAUDE.md — HiPilot Developer Guide

> **You are a developer tool** helping build the HiPilot project. You are NOT HiPilot itself. Do not follow EDA operational rules or try to use MCP tools to control EDA software.

## What is HiPilot?

HiPilot is an AI-powered VLSI Physical Design copilot. It makes Claude Code (running on an EDA server) into the "brain" that drives EDA tools (Innovus, ICC2, PrimeTime) through tmux, using MCP servers, skills, and Tcl templates.

```
┌─── EDA Server ────────────────────────────────────────────┐
│                                                            │
│  Claude Code ("HiPilot's brain")    EDA Tool (Innovus)     │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │  Reads CLAUDE.md     │    │  Executes Tcl        │     │
│  │  Uses MCP tools      │───▶│  Produces reports    │     │
│  │  Follows skills      │◀───│  Returns results     │     │
│  └──────────────────────┘    └──────────────────────┘     │
│         tmux pane 0              tmux pane 1              │
│                                                            │
│  3 MCP Servers (JSON-RPC over stdio):                     │
│    hipilot-eda (49 tools) — Tcl gen, execution, QoR       │
│    hipilot-tmux (8 tools) — pane control                  │
│    hipilot-knowledge (7 tools) — skills, docs, commands   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**The key insight:** Claude Code doesn't need to know EDA commands. Skills encode the workflows, templates encode the Tcl, MCP tools handle execution. Claude Code is the orchestrator.

## Project Structure

```
hipilot/
├── servers/              # 3 MCP servers (the core product)
│   ├── eda/index.js      # 49 tools: Tcl gen, execute_and_verify, workflows, QoR
│   ├── tmux/index.js     # 8 tools: pane control, status bar
│   └── knowledge/index.js # 7 tools: skills, docs, command reference
│
├── skills/               # 35 skill definitions (.md with YAML frontmatter)
├── templates/            # 20 Tcl templates (synopsys/ + cadence/)
├── data/                 # Command reference JSON
│
├── src/
│   ├── cli.js            # TUI dashboard (React/Ink)
│   ├── index.js          # CLI entry point
│   ├── lib/              # 17 utility modules (mode, risk, logger, etc.)
│   └── hitestbot/        # HiTestBot v2 test framework
│       ├── core/         # Evidence-based testing (6 components)
│       ├── infra/        # Test infrastructure (SSH, tmux, video)
│       └── tests/        # 14 test implementations
│
├── deploy/eda-server/    # EDA server deployment config (see below)
├── docs/                 # Documentation
├── test/                 # Unit tests (vitest, 118 tests)
└── bin/                  # Launcher scripts
```

## Identity Separation

This project has TWO AI roles. They must NEVER be confused:

| | Developer AI (you) | HiPilot AI (on EDA server) |
|-|-------------------|---------------------------|
| **Where** | MacOS dev machine | EDA server (CentOS 7) |
| **CLAUDE.md** | This file (root) | `deploy/eda-server/CLAUDE.md` |
| **Role** | Write code, run tests | Drive EDA tools via MCP |
| **MCP tools** | Not connected | Connected (49+8+7) |
| **Knows about** | Everything (code, tests, deploy) | Only MCP tools and skills |

The `deploy/eda-server/` directory contains everything HiTestBot deploys to the EDA server:
- `CLAUDE.md` — tells Claude Code "you are HiPilot's brain"
- `.claude/settings.json` — MCP server registration (absolute paths)
- `.claude/commands/` — 8 slash commands (/timing, /drc, /fix-setup, etc.)

**Rule:** Never put test infrastructure, deployment details, or developer context into `deploy/eda-server/CLAUDE.md`. Claude Code on the EDA server should not know it's being tested.

## Development Commands

```bash
npm run install:all          # Install all deps (root + 3 servers)
npm test                     # Unit tests (vitest, 118 tests)
npm run setup                # Setup wizard
node src/cli.js              # TUI dashboard
node src/cli.js skills       # List 35 skills
node src/cli.js templates    # List 20 templates
```

### Testing MCP servers locally

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/tmux/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/knowledge/index.js
```

### HiTestBot v2

```bash
node src/hitestbot/tests/McpInfraTest.js          # MCP infrastructure (12 checks)
node src/hitestbot/tests/FlowCertificationTest.js  # Flow certification
```

HiTestBot runs only on the EDA server ("test like real human"); use `bin/hitestbot-eda` to trigger via SSH and `bin/hitestbot-pull` to download evidence. Produces 5-layer evidence reports. See `docs/testing/TESTING_RULES.md` for philosophy; `docs/testing/hitestbot-guide.md` for execution model and sync.

### MCP call logging (for debugging)

```bash
HIPILOT_TEST_LOG=/tmp/mcp.jsonl node servers/eda/index.js
# → logs every tool call with timestamp, args, status, duration
```

## EDA Server

- **Host:** `ssh EDA@192.168.112.163` (password: `eda2020`, root: `eda2020`)
- **OS:** CentOS 7.9 (glibc 2.17)
- **Node.js:** v20.18.3 at `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/`
- **EDA Tools:** Innovus v20.10, ICC2 T-2022.03, PrimeTime T-2022.03
- **Demo Design:** Ibex RISC-V CPU at `/home/EDA/hipilot_test/ibex_work_upload/`
- **Deployed HiPilot:** `/home/EDA/hipilot/current/`

## Key Architecture Decisions

1. **Pure terminal** — No web UI. EDA engineers work via SSH on remote servers.
2. **Skills are the product** — They encode senior engineer expertise into reusable workflows.
3. **AI reads raw EDA output** — No complex parsers. LLMs are good at reading messy text.
4. **Templates, not hallucination** — Tcl comes from templates (`[✓ Template]`), not AI memory.
5. **Safety via mode system** — Manual mode requires approval. Risk analysis gates dangerous ops.
6. **MCP for everything** — Claude Code talks to EDA tools only through MCP, never direct commands.

## Technology

- **Runtime:** Node.js v20+ (ES Modules)
- **Language:** JavaScript (no TypeScript)
- **MCP:** `@modelcontextprotocol/sdk` ^1.0.4
- **Templates:** Nunjucks (Jinja2-compatible)
- **TUI:** React 19 + Ink 6
- **Testing:** Vitest (unit), HiTestBot v2 (E2E)
- **Storage:** Filesystem (skills as .md, state as JSON files)

## Documentation Index

| Document | Purpose |
|----------|---------|
| `docs/architecture.md` | System design |
| `docs/mcp-servers.md` | All 64 MCP tools with schemas |
| `docs/skills-guide.md` | 35 skills reference |
| `docs/rtl2gds-flow.md` | RTL-to-GDS flow guide |
| `docs/testing/TESTING_RULES.md` | Testing philosophy |
| `docs/testing/hitestbot-guide.md` | HiTestBot E2E guide (EDA-only, sync) |
| `docs/DEVELOPMENT_PLAN_v060.md` | v0.6.0 development plan |
| `docs/HITESTBOT_V2_PLAN.md` | HiTestBot v2 design |
| `docs/self-improving-loop.md` | ralph-loop guide (test–analyze–improve with metrics) |
