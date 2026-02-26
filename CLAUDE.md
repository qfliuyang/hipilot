# CLAUDE.md — HiPilot Constitution

> You are a **developer** building HiPilot and HiTestBot. You are NOT HiPilot itself. Never try to use MCP tools or control EDA software.

## 1. What This Project Is

HiPilot is a shell command (`bin/hipilot`) that launches a tmux workspace on an EDA server. The workspace has two panes:

```
┌─── Left Pane ────────────────┬─── Right Pane ───────────────┐
│                               │                               │
│  Claude Code                  │  Terminal                     │
│  (claude --dangerously-       │  (Innovus / ICC2 / PrimeTime) │
│   skip-permissions)           │                               │
│                               │                               │
│  This is "HiPilot's brain"   │  Claude controls this pane    │
│  The engineer types here      │  via MCP tools, not bash      │
│                               │                               │
├───────────────────────────────┴───────────────────────────────┤
│ ⚙ HiPilot │ 🔒 Manual │          HiPilot           │ ▶ idle │
└───────────────────────────────────────────────────────────────┘
```

Claude Code in the left pane has three MCP servers that give it superpowers:

| MCP Server | Tools | What it does |
|---|---|---|
| `hipilot-eda` | 52 | Generate Tcl, send to EDA tool, wait for result, extract QoR |
| `hipilot-tmux` | 8 | Control tmux panes, update status bar |
| `hipilot-knowledge` | 7 | Look up skills, search docs, find EDA commands |

Claude Code reads skills (expert workflows in markdown), generates Tcl from templates, sends it to the EDA tool in the right pane, reads the output, handles errors, and reports results to the engineer. The engineer never touches the right pane directly.

HiTestBot is a separate program that **uses HiPilot like a human**. It launches `bin/hipilot`, types commands into Claude Code, watches both panes, approves when asked, and scores the result. It never calls MCP tools or sends commands to the EDA pane. If a human would hit a bug, HiTestBot hits the same bug.

## 2. Three Identities (Never Confuse Them)

| Identity | Where | Reads | Does | Knows about |
|---|---|---|---|---|
| **Developer AI** (you) | Dev machine or cloud VM | This file (`CLAUDE.md`) | Write code, run tests | Everything |
| **HiPilot AI** | EDA server, left pane | `deploy/eda-server/CLAUDE.md` | Drive EDA tools via MCP | Only MCP tools and skills |
| **HiTestBot** | EDA server, separate process | `src/hitestbot/` | Use HiPilot like a human | Only what's on screen |

**Rules:**
- `deploy/eda-server/CLAUDE.md` is HiPilot's identity. Never put test/deploy/developer info in it.
- HiTestBot must never call MCP directly or send commands to the EDA pane.
- HiPilot must never know it's being tested.

## 3. How HiPilot Works (The Real Flow)

```
Engineer runs: bin/hipilot
  │
  ├─ Creates tmux session (tmux -L hipilot) with 50/50 split
  ├─ Left pane: starts "claude --dangerously-skip-permissions"
  ├─ Right pane: empty terminal (engineer starts EDA tool, or Claude does it)
  ├─ Status bar, keyboard shortcuts (prefix+m = toggle mode, prefix+y = approve)
  │
  ▼
Claude Code initializes:
  ├─ Reads deploy/eda-server/CLAUDE.md → becomes "HiPilot"
  ├─ Connects to 3 MCP servers (stdio, registered in ~/.claude/settings.json)
  ├─ Loads slash commands from .claude/commands/ (/rtl2gds, /timing, /drc, etc.)
  │
  ▼
Engineer types "/rtl2gds":
  │
  ├─ Claude reads the /rtl2gds slash command definition
  ├─ Claude calls eda.detect_tool → no tool running
  ├─ Claude calls eda.start_tool → sends "innovus -no_gui" to right pane via tmux
  ├─ Claude calls knowledge.get_skill("ibex-rtl2gds-flow") → reads the workflow
  │
  ├─ For EACH stage (design_init, floorplan, placement, CTS, routing, ...):
  │     ├─ Claude calls eda.generate_tcl → gets Tcl from template
  │     ├─ Claude calls eda.execute_and_verify → sends Tcl to right pane, waits
  │     │     └─ MCP server writes temp file, tmux send-keys "source /tmp/file.tcl" + C-m
  │     │     └─ MCP server polls tmux capture-pane until EDA prompt returns
  │     │     └─ MCP server checks for errors, extracts QoR metrics
  │     ├─ Claude reads the result, handles errors, snapshots QoR
  │     └─ Claude reports progress to engineer
  │
  └─ Claude summarizes: WNS, TNS, violations, saved files
```

**Key insight:** Claude Code orchestrates each stage individually. It stays in the loop. There is no monolithic "run everything" command. Claude reads skills, handles errors with `diagnose_error`, adapts based on results.

## 4. How HiTestBot Works

```
On EDA server:
  node src/hitestbot/tests/FlowCertificationTest.js /rtl2gds
    │
    ├─ Phase 1: Launch HiPilot (bin/hipilot + gnome-terminal on display :0)
    ├─ Phase 2: Start video recording (ffmpeg on display :0)
    ├─ Phase 3: Wait for Claude Code to be ready (polls left pane)
    ├─ Phase 4: Type "/rtl2gds" into Claude Code's input
    ├─ Phase 5: Watch and interact:
    │     ├─ Polls both panes every 5 seconds
    │     ├─ Detects state: working / waiting_for_eda / asking_question / done / error
    │     ├─ Auto-approves pending Tcl (presses prefix+y)
    │     ├─ Auto-answers questions ("yes")
    │     ├─ Takes screenshots at key moments
    │     ├─ Aborts early on fatal errors (MCP not found, etc.)
    │     └─ Detects completion (Claude's prompt reappears)
    ├─ Phase 6: Stop recording, collect all logs
    │     ├─ Full pane dumps (both panes, 10000 lines)
    │     ├─ MCP call log (HIPILOT_TEST_LOG)
    │     ├─ EDA tool logs (innovus.log*, icc2_shell.log*)
    │     └─ HiPilot execution history
    ├─ Phase 7: Build correlated timeline (timeline.jsonl)
    └─ Phase 8: Score (L1-L5) based on what's visible on screen
```

## 5. Project Structure

```
hipilot/
├── bin/hipilot                  # THE product: tmux launcher (left=Claude, right=terminal)
├── servers/                     # 3 MCP servers (Node.js, JSON-RPC over stdio)
│   ├── eda/index.js             #   52 tools: Tcl gen, execute, QoR, mode, workflows
│   ├── tmux/index.js            #   8 tools: pane control, status bar
│   └── knowledge/index.js       #   7 tools: skills, docs, command reference
├── skills/                      # 36 expert workflow definitions (.md with YAML frontmatter)
├── templates/                   # 22 Tcl templates (synopsys/ + cadence/, Nunjucks)
├── data/                        # Command reference JSON
├── src/
│   ├── index.js                 # CLI entry: "hipilot" → launches tmux, subcommands → TUI
│   ├── cli.js                   # TUI dashboard (React/Ink): status, skills, templates
│   ├── lib/                     # Utility modules (paths, mode, risk, shell-escape, logger)
│   └── hitestbot/               # HiTestBot: uses HiPilot like a human
│       ├── core/FlowCertifier.js#   The virtual human (launch → type → watch → score)
│       ├── core/ObservationPoint.js# Capture pane state + screenshot at a moment
│       ├── core/FlowReporter.js #   Generate FLOW_REPORT.md
│       ├── infra/deploy_hipilot.js# Deploy to EDA server (self-contained tarball)
│       └── tests/FlowCertificationTest.js # Main test entry point
├── deploy/eda-server/           # HiPilot identity for the EDA server
│   ├── CLAUDE.md                #   "You are HiPilot" (clean of developer/test info)
│   ├── .claude/settings.json    #   MCP server registration (absolute EDA paths)
│   └── .claude/commands/        #   10 slash commands (/rtl2gds, /timing, /drc, /start-eda, etc.)
├── test/                        # Unit tests (vitest, 118 tests)
└── docs/                        # Reference docs (architecture, skills guide, etc.)
```

## 6. Infrastructure Chain (What Must Collaborate)

```
bin/hipilot → tmux -L hipilot → Claude Code → MCP (stdio) → servers → tmux -L hipilot → EDA pane
```

Every link uses the **same tmux socket** (`-L hipilot`). If any component uses a different socket or omits `-L`, the chain breaks.

| Component | Socket | Session | Pane 0.0 | Pane 0.1 |
|---|---|---|---|---|
| `bin/hipilot` | `-L hipilot` | `hipilot` | Chat (Claude) | EDA terminal |
| `servers/eda/index.js` | `-L ${HIPILOT_SESSION}` | from env | sends Tcl | captures output |
| `servers/tmux/index.js` | `-L ${TMUX_SOCKET}` (defaults to `HIPILOT_SESSION`) | from env | send-keys | capture-pane |
| `FlowCertifier` | `-L ${this.socket}` | `hipilot` | types commands | reads output |

## 7. Critical Rules for Developers

1. **tmux send-keys**: Always use `-l` for literal text and `C-m` (unquoted) for Enter. Never put `Enter` inside quotes.
2. **tmux socket**: Always use `-L ${HIPILOT_SESSION}`. The session is created with a named socket.
3. **settings.json env**: The `env` section stores API keys. Deployment deep-merges — never overwrite env entirely.
4. **deploy/eda-server/CLAUDE.md**: HiPilot's identity. No test info, no SSH passwords, no HiTestBot references.
5. **HiTestBot is a human**: It uses `bin/hipilot`, types in the left pane, reads the screen. Never give it MCP access.
6. **Claude orchestrates**: For `/rtl2gds`, Claude drives each stage with `execute_and_verify`. No `workflow.run`.
7. **Paths resolve from `__dirname`**: MCP servers find templates/skills relative to their file location. Never use `process.cwd()`.
8. **Self-contained deployment**: Tarball includes `node_modules`. No `npm install` on EDA server.

## 8. Development Commands

```bash
npm run install:all                    # Install deps (root + 3 servers)
npm test                               # Unit tests (vitest, 118 tests)
bin/hipilot                            # Launch tmux workspace (the product)
node src/cli.js status                 # TUI status dashboard
node src/cli.js skills                 # List 36 skills
node src/cli.js templates              # List 22 Tcl templates
```

Test MCP servers locally:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/tmux/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/knowledge/index.js
```

Deploy to EDA server:
```bash
node src/hitestbot/infra/deploy_hipilot.js     # Upload self-contained package
bin/hitestbot-eda /rtl2gds                     # Run test via SSH
bin/hitestbot-pull                             # Download evidence
```

## 9. Technology

Node.js v20+ (ES Modules), plain JavaScript (no TypeScript), `@modelcontextprotocol/sdk`, Nunjucks templates, React 19 + Ink 6 (TUI), Vitest (unit tests), filesystem storage.

## 10. EDA Server

- **Host:** `ssh EDA@192.168.112.163` (password: `eda2020`)
- **OS:** CentOS 7.9 | **Node.js:** v20.18.3
- **EDA Tools:** Innovus v20.10, ICC2 T-2022.03, PrimeTime T-2022.03
- **Demo Design:** Ibex RISC-V CPU (Sky130, 7000+ cells) at `/home/EDA/hipilot_test/ibex_work_upload/`
- **Deployed HiPilot:** `/home/EDA/hipilot/current/`
