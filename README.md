# HiPilot — VLSI Physical Design Copilot

HiPilot is a 5-Agent AI team for EDA engineers. It creates a tmux workspace where specialized agents collaborate to run RTL-to-GDS flows:

- **Supervisor**: Flow coordination and validation
- **Knowledge**: Owns all 3 brains (ASIC + EDA + Project)
- **Planner**: Creates execution strategies by querying Knowledge
- **Executor**: Generates Tcl via Knowledge, executes via EDA MCP
- **Archivist**: Records QoR metrics and learnings to Project-Brain

The engineer types commands in the Supervisor pane. Agents communicate through the Knowledge Agent (hub-and-spoke pattern) to generate Tcl, control EDA tools (Innovus, ICC2, PrimeTime), and manage the flow.

**Core value:** 34 skills encode senior engineer expertise. The agent team reads these skills and collaborates to generate Tcl, execute it, check for errors, and report results. The engineer gets senior-level workflows without memorizing EDA tool commands.

## Quick Start

```bash
# Install dependencies (root + 3 MCP servers)
npm run install:all

# Launch HiPilot (creates the 5-agent + EDA workspace)
bin/hipilot
```

This opens a terminal with 6 panes:
- **Top row (4 panes):** Supervisor, Knowledge, Planner, Executor agents
- **Middle pane:** Archivist agent
- **Bottom pane:** EDA Tool (Innovus/ICC2/PrimeTime)

Type `/synthesis` in the Supervisor pane to start the flow, then `/floorplan`, `/placement`, `/cts`, `/routing`, `/chipfinish` for each stage. Or use `/timing` to check timing.

## Agent Architecture

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 🎯 Supervisor│ 📚 Knowledge │ 📋 Planner   │ ⚡ Executor  │
├──────────────┴──────────────┴──────────────┴──────────────┤
│ 💾 Archivist Agent (records QoR, learns from history)     │
├────────────────────────────────────────────────────────────┤
│ 🔧 EDA Tool Pane (Innovus / ICC2 / PrimeTime)             │
└────────────────────────────────────────────────────────────┘
```

**Communication Pattern:**
- All agents query Knowledge Agent for information
- Knowledge Agent owns all 3 brains (ASIC-Brain, EDA-Brain, Project-Brain)
- Hub-and-spoke: Agents don't talk directly to each other, only through Knowledge

### Agent Responsibilities

| Agent | Role | Key Duties |
|-------|------|------------|
| **Supervisor** | Coordinator | Validates prerequisites, coordinates flow phases, communicates with user |
| **Knowledge** | Brain Hub | Owns ASIC-Brain (Tcl gen), EDA-Brain (tool commands), Project-Brain (memory) |
| **Planner** | Strategist | Queries Knowledge for flow definitions, creates execution plans |
| **Executor** | Operator | Gets Tcl from Knowledge, executes via EDA MCP, monitors output |
| **Archivist** | Recorder | Records QoR metrics, stores error patterns, analyzes trends |

## 3-Brain System (Owned by Knowledge Agent)

The Knowledge Agent encapsulates all design knowledge:

| Brain | Type | Purpose | Scope |
|-------|------|---------|-------|
| **ASIC-Brain** | **Static** | Tcl generation, flow orchestration, output parsing | Universal ASIC design knowledge |
| **EDA-Brain** | **Static** | Tool commands, error patterns, best practices | Universal EDA tool knowledge |
| **Project-Brain** | **Dynamic** | Design memory, QoR tracking, error history | Per-project, built from actual design |

**Key Distinction:**
- **ASIC-Brain and EDA-Brain** are static — they contain universal knowledge shared across all projects (Tcl patterns, tool commands, error patterns)
- **Project-Brain** is dynamic — it is built from the actual design being worked on (QoR data, error history, design-specific learnings). Each project has its own Project-Brain.

Other agents query Knowledge Agent; they never access brains directly.

## Mission Pack System

HiPilot follows a **Mission Pack** — a human-written Markdown document that describes in natural language what HiPilot should do for a specific design.

### What is a Mission Pack?

A Mission Pack is a Markdown file (`hipilot-mission.md`) prepared by a real human engineer. Instead of writing rigid YAML, engineers write naturally about:
- **Project overview**: What design, what PDK, what goals
- **Design files**: RTL sources, constraints, libraries
- **Flow requirements**: Which stages to run, target QoR
- **Technology setup**: Process node, corners, special instructions

### Example Mission Pack

```markdown
# Mission Pack: Ibex RISC-V Core

## Project Overview

I want to implement a physical design flow for the **Ibex RISC-V Core**
using the **Skywater 130nm PDK**. This is a 32-bit RISC-V CPU with
approximately 7000 cells. The target frequency is 100 MHz.

## Design Files

### RTL Source
The RTL is written in SystemVerilog. The top module is `ibex_core`:

- `rtl/ibex_core.sv` - Top level core
- `rtl/ibex_alu.sv` - ALU
- `rtl/ibex_decoder.sv` - Instruction decoder
- Plus other supporting modules...

Use `SYNTHESIS` define during synthesis.

### Constraints
Timing constraints are in: `constraints/ibex_core.sdc`

### Libraries
- **Tech LEF**: `lef/sky130_fd_sc_hd.tlef` (must be first!)
- **Cell LEF**: `lef/sky130_fd_sc_hd.lef`
- **Liberty**: `lib/sky130_fd_sc_hd__tt_025C_1v80.lib`

## Flow Requirements

Run the full RTL-to-GDS flow:

1. **Synthesis** with Design Compiler - enable DFT scan insertion
2. **Design Init** in Innovus - load the synthesized netlist
3. **Floorplan** - target 68% core utilization
4. **Placement** - timing-driven placement
5. **CTS** - target skew under 100ps
6. **Routing** - enable antenna fixing
7. **Chip Finish** - export GDS

## Target QoR

Target frequency: 100 MHz. WNS should be 0 or positive.
Core utilization around 68%. Die area approximately 450x450 microns.

## Special Instructions

For CTS, use ccopt and set target max transition to 0.15ns.
Use 8 CPUs for multi-threading.
```

See `examples/mission-packs/ibex-mission.md` for the complete example.

### How Agents Use the Mission Pack

| Agent | Uses Mission Pack For |
|-------|----------------------|
| **Supervisor** | Overall flow definition, stage sequencing, validation |
| **Knowledge** | Library locations, PDK setup, tool versions, loading into brains |
| **Planner** | Stage recipes, target metrics, constraints, execution strategy |
| **Executor** | Tool commands, Tcl snippets, file paths, stage-specific recipes |
| **Archivist** | Design identity, checkpoint locations, QoR target comparison |

### Loading Priority

HiPilot looks for mission packs in this order:
1. `HIPILOT_MISSION_PACK` environment variable
2. `${HIPILOT_DESIGN_DIR}/hipilot-mission.md`
3. `${HIPILOT_DESIGN_DIR}/hipilot-mission.yaml` (legacy)
4. Auto-detect (if no mission pack exists)

## Project Structure

```
hipilot/
├── bin/hipilot              # The product: launches 5-agent tmux workspace
├── bin/hipilot-simple       # Legacy 2-pane mode (for comparison/debug)
├── bin/review-test          # Test Review Board: independent verification
├── src/team/                # 5-Agent team module
│   ├── index.js             # Team registry and coordinator
│   └── agents/              # Agent implementations
│       ├── SupervisorAgent.js
│       ├── KnowledgeAgent.js    # Owns all 3 brains
│       ├── PlannerAgent.js
│       ├── ExecutorAgent.js
│       └── ArchivistAgent.js
├── servers/                 # 3 MCP servers (eda, tmux, knowledge)
├── skills/                  # 34 expert workflow guides (.md files)
├── templates/               # 22 Tcl templates (Synopsys + Cadence)
├── src/hitestbot/           # HiTestBot: tests HiPilot like a human
├── deploy/eda-server/       # HiPilot identity files for the EDA server
├── test/                    # Unit tests (vitest, 118 tests)
└── docs/                    # Reference documentation
```

## Development

```bash
npm run install:all          # Install dependencies (root + 3 servers)
npm test                     # Unit tests (118 tests)
bin/hipilot                  # Launch 5-agent team workspace (default)
bin/hipilot --simple         # Launch legacy 2-pane mode
node src/cli.js status       # TUI status dashboard
node src/cli.js skills       # List 34 skills
node src/cli.js templates    # List 22 templates
```

## Testing & Verification

**HiTestBot** (E2E Testing):
```bash
bin/hitestbot-eda "/synthesis"           # Run E2E test on EDA server
bin/hitestbot-pull                       # Download evidence to local
bin/review-test latest                   # Independent third-party review
```

**Test Review Board** (Independent Verification):
```bash
# Review specific test evidence
bin/review-test test-evidence/20260315_121030/

# Review most recent test
bin/review-test latest
```

The Review Board is a **standalone third party** that independently verifies HiTestBot results:
- Reads evidence files directly (no trust in HiTestBot scoring)
- Re-implements verification logic (separate from HiTestBot)
- Detects mismatches between claims and actual evidence
- Cannot be cheated (uses its own CheatDetector instance)

See [docs/testing/TEST_PLAN.md](docs/testing/TEST_PLAN.md) for the complete 9-phase test plan.

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
| [docs/mcp-servers.md](docs/mcp-servers.md) | MCP tool reference (74 + 8 + 17 tools) |
| [docs/skills-guide.md](docs/skills-guide.md) | All 34 skills |
| [docs/deploy-guide.md](docs/deploy-guide.md) | Deployment to EDA server |
| [docs/testing/TEST_PLAN.md](docs/testing/TEST_PLAN.md) | 9-phase test plan for 5-Agent Team |
| [docs/testing/TESTING_RULES.md](docs/testing/TESTING_RULES.md) | Testing philosophy and rules |

## Technology

Node.js v20+ (ES Modules), plain JavaScript, MCP SDK, Nunjucks templates, React/Ink TUI, Vitest.

## License

MIT — See [LICENSE](LICENSE).
