# CLAUDE.md — HiPilot Constitution

> You are a **developer** building HiPilot and HiTestBot. You are NOT HiPilot itself. Never try to use MCP tools or control EDA software.

---

## 1. What This Project Is

**HiPilot** is a shell command (`bin/hipilot`) that creates a 5-agent tmux workspace. The left pane runs Anthropic's `claude` CLI (called "Claude Code"). The right pane is an empty terminal where EDA tools (Innovus, ICC2, PrimeTime — commercial chip design software) run. Claude Code in the left pane controls the EDA tool in the right pane. The engineer only types in the left pane.

**How Claude Code controls the right pane:** Claude Code does NOT type shell commands. Instead, it calls MCP tools. MCP (Model Context Protocol) is a mechanism where Claude Code sends JSON-RPC requests over stdio to external programs called "MCP servers". These MCP servers are Node.js processes that Claude Code spawns automatically. The MCP servers execute tmux commands (`send-keys`, `capture-pane`) to interact with the right pane. Claude Code never runs `tmux` directly.

**What the workspace looks like:**

```
┌─── Left Pane ────────────────┬─── Right Pane ───────────────┐
│                               │                               │
│  Claude Code                  │  Terminal                     │
│  (claude --dangerously-       │  (Innovus / ICC2 / PrimeTime) │
│   skip-permissions)           │                               │
│                               │                               │
│  The engineer types here.     │  Claude Code controls this    │
│  Claude Code runs here.       │  pane through MCP servers.    │
│                               │                               │
├───────────────────────────────┴───────────────────────────────┤
│  Status bar: mode, tool, design, job status                   │
└───────────────────────────────────────────────────────────────┘
```

**The three MCP servers** (registered in `~/.claude/settings.json` on the EDA server):

| Server name | File | Tools | Purpose |
|---|---|---|---|
| `hipilot-eda` | `servers/eda/index.js` | 54 | Generate Tcl scripts, send them to the right pane, wait for the EDA tool to finish, check for errors, extract timing/area metrics |
| `hipilot-tmux` | `servers/tmux/index.js` | 8 | Send keystrokes to panes, capture pane text, update the status bar |
| `hipilot-knowledge` | `servers/knowledge/index.js` | 7 | Look up skills (expert workflow guides), search documentation, find EDA command syntax |

**How MCP servers are connected to Claude Code:** Claude Code reads `~/.claude/settings.json` on startup. This file lists each MCP server with a `command` (path to Node.js) and `args` (path to the server script). Claude Code spawns each server as a child process and communicates over stdin/stdout using JSON-RPC. The servers are NOT network services — they are short-lived child processes.

**What are skills?** Skills are markdown files in `skills/` (e.g., `skills/fix-setup-timing.md`). Each file describes an expert workflow: when to use it, what Tcl commands to run, what to look for in the output, how to fix common errors. Claude Code reads these files through the knowledge MCP server and follows the instructions. Skills are documentation that the AI reads — they are not executable code.

**What are templates?** Templates are Tcl files in `templates/` (e.g., `templates/cadence/innovus_report_timing.tcl`). They use Nunjucks syntax (similar to Jinja2) for variable substitution. When Claude Code calls `eda.generate_tcl`, the EDA MCP server finds the matching template, renders it with parameters, and returns the Tcl. Templates produce trusted Tcl (`[✓ Template]` badge). When no template exists, the server generates Tcl from hardcoded patterns (`[⚠ Unverified]` badge).

**What is HiTestBot?** HiTestBot is a Node.js program (`src/hitestbot/`) that tests HiPilot by using it exactly like a human would. It runs `bin/hipilot` to launch the workspace, opens gnome-terminal on the EDA server's desktop so the workspace is visible, types commands into Claude Code's input, watches both panes, presses keyboard shortcuts when needed (e.g., prefix+y to approve), and scores the result by reading what appeared on screen. HiTestBot never calls MCP tools directly and never sends commands to the right pane. If a human would encounter a bug, HiTestBot encounters the same bug.

---

## 1.5. 5-Agent Team Architecture (v0.8.0+)

**HiPilot is now a 5-Agent Team.** The `bin/hipilot` command creates a tmux workspace with 6 panes: 5 agent panes + 1 EDA pane.

### Agent Layout

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 🎯 Supervisor│ 📚 Knowledge │ 📋 Planner   │ ⚡ Executor  │
├──────────────┴──────────────┴──────────────┴──────────────┤
│ 💾 Archivist Agent (records QoR, learns from history)     │
├────────────────────────────────────────────────────────────┤
│ 🔧 EDA Tool (Innovus / ICC2 / PrimeTime)                  │
└────────────────────────────────────────────────────────────┘
```

### Agent Responsibilities

| Agent | Role | Key Duties |
|-------|------|------------|
| **Supervisor** | Coordinator | Validates prerequisites, coordinates flow phases, communicates with user |
| **Knowledge** | Brain Hub | **Owns all 3 brains** (ASIC-Brain, EDA-Brain, Project-Brain). Central interface |
| **Planner** | Strategist | Queries Knowledge for flow definitions, creates execution plans |
| **Executor** | Operator | Gets Tcl from Knowledge, executes via EDA MCP, monitors output |
| **Archivist** | Recorder | Records QoR metrics, stores error patterns, analyzes trends |

### Hub-and-Spoke Communication

**All agents communicate through Knowledge Agent:**

```
Supervisor → Knowledge ← Planner
      ↓         ↓           ↓
   (status)  (brains)   (strategy)
      ↑         ↑           ↑
Archivist → Knowledge ← Executor
```

- **NEVER** talk directly to other agents
- **ALWAYS** query Knowledge Agent for information
- Knowledge Agent is the **only** interface to the 3-brain system

### 3-Brain System (Owned by Knowledge Agent)

| Brain | Type | Content | Scope |
|-------|------|---------|-------|
| **ASIC-Brain** | **Static** | Tcl generation patterns, flow orchestration, output parsing rules | Universal ASIC design knowledge |
| **EDA-Brain** | **Static** | Tool commands, error patterns, best practices, command syntax | Universal EDA tool knowledge |
| **Project-Brain** | **Dynamic** | Design-specific data, QoR history, checkpoint locations, learned patterns | Per-project, built from actual design |

**Key Distinction:**
- **ASIC-Brain and EDA-Brain** are static — they contain universal knowledge shared across all projects (Tcl patterns, tool commands, error patterns)
- **Project-Brain** is dynamic — it is built from the actual design being worked on (QoR data, error history, design-specific learnings). Different projects have different Project-Brains.

### Comparison: Legacy vs Team Mode

| Aspect | Legacy (v0.7.x) | Team Mode (v0.8.0+) |
|--------|-----------------|---------------------|
| Panes | 2 (Chat + EDA) | 6 (5 agents + EDA) |
| Entry | `bin/hipilot` | `bin/hipilot` (default) |
| Legacy | N/A | `bin/hipilot --simple` |
| Architecture | Single Claude | 5 specialized agents |
| Communication | Direct | Hub-and-spoke via Knowledge |

---

## 2. Three Identities

This project contains instructions for three different AI contexts. They must never be mixed.

| Identity | Who reads it | File | What it does |
|---|---|---|---|
| **Developer AI** (you right now) | AI coding CLI on dev machine or cloud VM | This file (`CLAUDE.md` at repo root) | Write code, run unit tests, fix bugs |
| **HiPilot AI** | Claude Code running on the EDA server | `deploy/eda-server/CLAUDE.md` | Drive EDA tools using MCP — it does NOT know about tests, deployment, or this repo |
| **HiTestBot** | Not an AI — it's a Node.js program | `src/hitestbot/core/FlowCertifier.js` | Simulates a human using HiPilot |

**Why the separation matters:**
- `deploy/eda-server/CLAUDE.md` tells Claude Code "you are HiPilot". If you put test infrastructure or developer context in that file, Claude Code on the EDA server will be confused about its role.
- HiTestBot must use HiPilot as a black box. If HiTestBot calls MCP directly, it bypasses HiPilot and cannot catch bugs that a real human would encounter.
- You (the developer) know everything. HiPilot AI only knows its MCP tools and skills. HiTestBot only knows what it can see on screen.

---

## 3. How HiPilot Works

### Step 1: Launch

The engineer runs `bin/hipilot` (a bash script). This script:
1. Creates a tmux server with a **named socket**: `tmux -L hipilot new-session ...` (the `-L hipilot` is critical — it creates a separate tmux instance that all components must use)
2. Splits the window into 6 panes (5 agents + 1 EDA): 5 agent panes + 1 EDA pane
3. Sets up status bar and keyboard shortcuts (prefix+m toggles manual/auto mode, prefix+y approves pending Tcl)
4. In the left pane, runs: `claude --dangerously-skip-permissions` (this starts Claude Code, Anthropic's AI CLI, with all tool permissions pre-approved)
5. In the right pane, shows a welcome message

### Step 2: Claude Code initializes

When Claude Code starts, it automatically:
1. Reads `CLAUDE.md` from the current directory — this is `deploy/eda-server/CLAUDE.md` (deployed to the project root on EDA server), which says "You are HiPilot"
2. Reads `~/.claude/settings.json` and spawns 3 MCP server processes (one for each server: eda, tmux, knowledge). Each server receives `HIPILOT_SESSION=hipilot` as an environment variable — this tells the servers which tmux socket to use.
3. Loads slash commands from `.claude/commands/` (e.g., `/synthesis`, `/floorplan`, `/placement`, `/timing`)

### Step 3: The engineer types a command

Example: the engineer types `/synthesis` or `/floorplan`. Claude Code reads the corresponding slash command file (e.g., `deploy/eda-server/.claude/commands/synthesis.md`), which instructs Claude to execute that specific flow stage.

### Step 4: Claude orchestrates the flow

Each stage is a **standalone tool invocation**. The EDA tool starts fresh, loads the previous stage's checkpoint, runs the stage commands, saves a new checkpoint, and exits. This gives a clean database environment for each stage and enables recovery/branching.

For each stage:
1. Claude loads the skill (`knowledge.get_skill`) and copies the Tcl block for that stage. Each block includes `source checkpoint.enc` at the top and `saveDesign + exit` at the bottom.
2. Claude calls `eda.execute_and_verify({tcl, description, timeout})` — the MCP server writes the Tcl to a file and sends `innovus -no_gui -files /tmp/stage.tcl` to the right pane. It waits for Innovus to exit (not just the prompt — the whole process), checks errors, extracts QoR.
3. If errors → `eda.diagnose_error`. If success → `qor.snapshot`, report to engineer.
4. The next stage starts a fresh Innovus with the new checkpoint.

**Tool switching is natural.** Synthesis uses `dc_shell`, P&R uses `innovus`, signoff uses `pt_shell`. Claude reads the skill to know which tool each stage needs.

---

## 4. How HiTestBot Works

HiTestBot runs on the EDA server (where HiPilot runs). It is a virtual human.

### What it does (in order):

1. **Kills old tmux session** — clean slate
2. **Runs `bin/hipilot --no-terminal`** — creates the tmux workspace (headless)
3. **Opens gnome-terminal on display :0** — attaches to the tmux session, so the workspace is visible on the EDA server's desktop (a human would see the same thing on their screen)
4. **Starts ffmpeg** — records the desktop (display :0) to a video file
5. **Polls the left pane** every 3 seconds until Claude Code's input prompt appears (a human would watch for the same thing)
6. **Types a command** (e.g., `/synthesis`) into the left pane using `tmux send-keys` (exactly like a human pressing keys)
7. **Watches both panes** every 5 seconds, detecting what state Claude is in:
   - `working` — left pane text is changing (Claude is producing output)
   - `waiting_for_eda` — left pane idle but right pane changing (EDA tool is running, Claude is waiting)
   - `asking_question` — Claude asked something (e.g., "Should I proceed?") → HiTestBot types "yes"
   - `needs_approval` — manual mode, pending Tcl → HiTestBot presses prefix+y (Ctrl+B then y)
   - `done` — Claude's input prompt reappeared
   - `error` — fatal problem detected (e.g., "MCP not available")
8. **Takes screenshots** at key moments (launch, after typing, every 60s, on approval, on completion)
9. **Stops ffmpeg** — saves the video
10. **Collects logs after the test** (this is post-test evidence, not cheating):
    - Full scrollback from both panes (10000 lines each)
    - MCP call log (a JSONL file that the EDA MCP server writes when `HIPILOT_TEST_LOG` env var is set)
    - EDA tool log files (e.g., `innovus.log`)
    - Tcl execution history from HiPilot
11. **Builds `timeline.jsonl`** — merges all evidence into one chronological timeline where each entry has a video timestamp, so you can seek to any moment
12. **Scores L1-L5** by reading what's on screen (not MCP logs):
    - L1: Did Claude respond? (left pane changed)
    - L2: Did Claude understand the task? (mentions relevant keywords)
    - L3: Did Claude use MCP tools? (tool call names visible in left pane, right pane has activity)
    - L4: Did the EDA tool run successfully? (right pane has output, no errors)
    - L5: Did Claude report QoR? (WNS/TNS numbers in left pane)

---

## 5. Project Structure

```
hipilot/
├── bin/hipilot                     # THE product: 5-agent tmux workspace launcher
├── bin/hipilot-simple              # Legacy 2-pane mode (for comparison/debug)
├── src/team/                       # 5-Agent Team module (v0.8.0+)
│   ├── index.js                    #   Team registry, AGENT_REGISTRY, createTeamMode()
│   └── agents/                     #   Agent implementations
│       ├── SupervisorAgent.js      #   Flow coordination, validation
│       ├── KnowledgeAgent.js       #   Owns all 3 brains (ASIC + EDA + Project)
│       ├── PlannerAgent.js         #   Strategy formulation
│       ├── ExecutorAgent.js        #   Tcl execution via EDA MCP
│       └── ArchivistAgent.js       #   QoR recording, pattern learning
├── servers/                        # 3 MCP servers (Node.js processes, JSON-RPC over stdio)
│   ├── eda/index.js                #   54 tools — Tcl gen, execute, QoR, mode
│   ├── tmux/index.js               #   8 tools — pane control, status bar
│   └── knowledge/index.js          #   7 tools — skill lookup, doc search, LittleBrain
├── skills/                         # 36 markdown files — expert workflows
├── templates/                      # 22 Tcl files — Nunjucks templates
│   ├── synopsys/                   #   ICC2/PrimeTime/DesignCompiler
│   └── cadence/                    #   Innovus
├── data/command-reference.json     # EDA command syntax
├── src/
│   ├── index.js                    # CLI entry point
│   ├── cli.js                      # TUI dashboard (React/Ink)
│   ├── lib/                        # Shared utilities
│   └── hitestbot/                  # HiTestBot — tests HiPilot like a human
├── deploy/eda-server/              # Files deployed TO the EDA server
├── test/                           # Unit tests (vitest)
└── docs/                           # Reference documentation
├── deploy/eda-server/              # Files deployed TO the EDA server (not used on dev machine)
│   ├── CLAUDE.md                   #   HiPilot's identity — Claude Code reads this on startup
│   ├── .claude/settings.json       #   Registers 3 MCP servers with absolute EDA server paths
│   └── .claude/commands/           #   10 slash commands that appear in Claude Code
├── test/                           # Unit tests (vitest, 118 tests)
└── docs/                           # Reference documentation
```

---

## 6. The Tmux Socket Chain

Every component must use the **same tmux socket** (`-L hipilot`). Here is why:

`bin/hipilot` creates the tmux session with `tmux -L hipilot new-session`. The `-L hipilot` flag creates a **named tmux server** — a separate tmux instance with its own socket file. Regular `tmux` commands (without `-L`) talk to the default tmux server, which is a DIFFERENT instance. If an MCP server runs `tmux capture-pane` without `-L hipilot`, it reads from the wrong tmux server and sees nothing.

The chain:
1. `bin/hipilot` creates session → `tmux -L hipilot`
2. `~/.claude/settings.json` passes `HIPILOT_SESSION=hipilot` to each MCP server as an env var
3. MCP servers read `process.env.HIPILOT_SESSION` and use it in all tmux commands: `tmux -L ${HIPILOT_SESSION}`
4. HiTestBot's FlowCertifier uses `this.socket` (defaults to `hipilot`) for the same reason

If any component omits `-L` or uses a different socket name, that component cannot see or control the workspace.

---

## 7. Rules

1. **tmux send-keys**: Use `-l` flag for literal text. Use `C-m` (unquoted, outside quotes) for Enter. Never write `'text Enter'` — tmux treats quoted `Enter` as the five characters E-n-t-e-r, not the Enter key.
2. **tmux socket**: Every tmux command must include `-L ${HIPILOT_SESSION}`. See §6 for why.
3. **settings.json env on EDA server**: The `env` section of each MCP server config in `~/.claude/settings.json` stores API keys. The deployment script (`deploy_hipilot.js`) deep-merges env — it adds `HIPILOT_SESSION` without removing existing keys. Never replace the env object wholesale.
4. **deploy/eda-server/CLAUDE.md**: This file is HiPilot's identity. Never put SSH credentials, test infrastructure, HiTestBot references, or developer context in it. Claude Code on the EDA server should believe it is HiPilot — nothing else.
5. **HiTestBot is a human**: It launches `bin/hipilot`, types in the left pane, reads both panes, presses keyboard shortcuts. It never calls MCP tools, never sends commands to the right pane, never reads MCP logs during the test (only after).
6. **Claude orchestrates stage by stage**: The modular stage slash commands (`/synthesis`, `/floorplan`, etc.) tell Claude to drive each flow stage individually using `execute_and_verify`. Claude must never call `workflow.run` or `eda.rtl2gds.run_full_flow` — those are dumb sequential executors that bypass Claude's intelligence.
7. **Paths resolve from `__dirname`**: Each MCP server finds `PROJECT_ROOT` by going up two directories from its own file location (`join(__dirname, '..', '..')`). This works on both dev machine and EDA server. Never use `process.cwd()` — it depends on where Claude Code was launched, which is unpredictable.
8. **Self-contained deployment**: The tarball sent to the EDA server includes `node_modules`. No `npm install` runs on the EDA server. HiPilot and HiTestBot are deployed as ready-to-run tools.

---

## 8. Development Commands

```bash
npm run install:all                    # Install deps in all 4 locations (root + 3 servers)
npm test                               # Unit tests (vitest, 118 tests)
bin/hipilot                            # Launch the HiPilot workspace (the product)
node src/cli.js status                 # TUI status dashboard
node src/cli.js skills                 # List 36 skills
node src/cli.js templates              # List 22 templates
```

Test MCP servers locally (pipe JSON-RPC, check they respond):
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/tmux/index.js
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/knowledge/index.js
```

Deploy to EDA server and run tests:
```bash
node src/hitestbot/infra/deploy_hipilot.js     # Build tarball, upload, swap, configure MCP
bin/hitestbot-eda /synthesis                   # Run HiTestBot on EDA server via SSH
bin/hitestbot-pull                             # Download evidence to dev machine
```

---

## 9. Rules for AI Coding CLIs Working on This Project

These rules exist because previous AI coding sessions caused real problems.

1. **Never use sed, perl, or awk to modify source code.** Use your editor/IDE tools. Unix text tools corrupt files (wrong encoding, missing newlines, broken escapes).
2. **Never overwrite `~/.claude/settings.json` on the EDA server.** It contains API keys and base URLs. The deployment script (`deploy_hipilot.js`) patches only `command` and `args` fields. If you need to change settings, read the file first, modify in memory, validate, write back, verify.
3. **Never fabricate evidence.** Screenshots must come from `import -window root` (X11). Video must come from ffmpeg recording display :0. Pane logs must come from `tmux capture-pane`. MCP logs must come from files HiPilot wrote. If evidence doesn't exist, report that it doesn't exist — don't create fake evidence.
4. **Never give HiTestBot the ability to call MCP tools or control the EDA pane.** HiTestBot is a virtual human. Its only interface is typing in the left pane and reading the screen. If you add code that bypasses this, you've broken the testing model.
5. **SSH to the EDA server is unreliable.** Always use `sshpass` with retry logic and timeouts. The deploy script has 3 retries with exponential backoff.
6. **CentOS 7 is old.** glibc 2.17, no modern shell features. Test bash scripts for compatibility. Node.js v20 works because it's a static build.
7. **Always run `npm test` before committing.** If tests fail, fix them before pushing.
8. **Never mock EDA tools.** All tests use real `innovus`, `dc_shell`, `pt_shell`. Never use `puts` or `echo` to fake EDA tool output. If a tool can't run, mark the test SKIPPED.
9. **Each test starts with a clean design.** HiTestBot extracts `ibex_demo.tar` into a timestamped directory. Never run tests on the same design directory as a previous run — old results cause false positives.

---

## 10. LittleBrain (Knowledge-Based Orchestration)

**LittleBrain** is the "little brain" that acts like a dedicated LLM for EDA tasks. It's implemented in `servers/knowledge/littlebrain/`.

### Components

| Component | Purpose |
|-----------|---------|
| `index.js` | Main LittleBrain class — unified interface |
| `tcl-generator.js` | Generate Tcl from natural language intent |
| `output-parser.js` | Parse EDA tool output, extract errors/QoR |
| `orchestrator.js` | Stage definitions, flow context, prerequisites |
| `self-improvement.js` | Error pattern DB, success tracking |
| `logger.js` | Activity logging for auditability |

### Key Capabilities

1. **Tcl Generation & Validation** — Generate Tcl from intent, sanitize scripts, validate syntax, auto-fix errors
2. **EDA Output Understanding** — Parse tool output, extract QoR metrics (WNS, TNS, area, power), classify errors
3. **Workflow Orchestration** — Stage definitions for RTL2GDS, prerequisite checking, flow context
4. **Self-Improvement** — ErrorPatternDB learns from errors, SuccessTracker records best practices
5. **Activity Logging** — All reasoning steps logged for auditability

### Latest Test Results (2026-03-09)

| Metric | Value |
|--------|-------|
| **Score** | 5.0/6.0 (83%) |
| **GPA** | 3.37/4.0 (B) |
| **Human-Like** | **100%** (was 30%) |
| **Duration** | 1202s (20 min) |
| **MCP Calls** | 6,839 |

**Key Achievement:** Human-Like behavior improved from 30% (Machine-like) to 100% (Human-like) through incremental interaction patterns.

**L4 Failure:** Real EDA error — LEF file loading failed in Innovus (PDK/environment issue).

---

## 11. Technology

- **Runtime:** Node.js v20+ with ES Modules (`"type": "module"` in package.json)
- **Language:** Plain JavaScript — no TypeScript, no build step
- **MCP SDK:** `@modelcontextprotocol/sdk` — provides `Server`, `StdioServerTransport`, request schemas
- **Templates:** Nunjucks (Jinja2-compatible template engine for Tcl generation)
- **TUI:** React 19 + Ink 6 (renders React components to the terminal)
- **Testing:** Vitest (unit tests), HiTestBot (E2E on EDA server)
- **Storage:** Filesystem only — skills as `.md`, state as JSON, history as `.tcl` files

---

## 12. EDA Server

- **Host:** `ssh EDA@192.168.112.163` (password: `eda2020`)
- **OS:** CentOS 7.9 with GNOME desktop
- **Node.js:** v20.18.3 at `/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/`
- **EDA Tools:** Innovus v20.10, ICC2 T-2022.03, PrimeTime T-2022.03
- **Demo Design:** Ibex RISC-V CPU (Skywater 130nm, ~7000 cells) at `/home/EDA/ibex_work_upload/`
- **Deployed HiPilot:** `/home/EDA/hipilot/current/`
- **Settings:** `~/.claude/settings.json` (MCP server registration — NOT in the repo, created by deployment)
