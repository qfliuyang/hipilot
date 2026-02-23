# HiPilot - VLSI Physical Design Copilot

**Version:** 0.5.0
**Status:** Production Ready
**Last Updated:** 2026-02-24

---

## What is HiPilot?

HiPilot is an **AI-powered VLSI Physical Design Copilot** that helps EDA engineers generate Tcl scripts, run EDA tools, and manage physical design flows. It extends Claude Code with specialized MCP servers and skills for semiconductor design automation.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Tcl Generation** | Generate vendor-specific Tcl from natural language |
| **EDA Tool Control** | Control Innovus, ICC2, PrimeTime via MCP |
| **35 Built-in Skills** | Complete RTL-to-GDS flow coverage |
| **Real Design Tested** | Validated on Ibex RISC-V CPU (7,000+ cells) |
| **Multi-Vendor Support** | Synopsys (ICC2, DC, PT) and Cadence (Innovus) |

---

## Quick Start

### Prerequisites

- Node.js v20+ (glibc 2.17 compatible for CentOS 7)
- Claude Code CLI
- SSH access to EDA server (or local EDA tools)

### Installation

```bash
# Clone the repository
git clone https://github.com/qfliuyang/hipilot.git
cd hipilot

# Install dependencies
npm run install:all

# Configure MCP servers in Claude Code
# Add to ~/.claude/settings.json
```

### Running HiPilot

```bash
# Start HiPilot with EDA workspace
hipilot

# Or with tmux split layout
./bin/hipilot
```

### First Command

Once running, try:
```
"List all available skills"
"Run timing report on current design"
"What is the design status?"
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        HiPilot System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Claude    │    │  MCP Layer  │    │  EDA Tools  │         │
│  │    Code     │───▶│  (3 Servers)│───▶│ Innovus/ICC2│         │
│  │             │    │             │    │ PT/DC/etc.  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   35        │    │  tmux       │    │  Log Files  │         │
│  │   Skills    │    │  Workspace  │    │  Reports    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| **Claude Code** | AI interface for natural language interaction |
| **EDA MCP Server** | Tcl generation, tool control, QoR extraction |
| **Tmux MCP Server** | Workspace management, pane control |
| **Knowledge MCP Server** | Skill loading, documentation search |
| **Skills (35)** | Workflow definitions with MCP commands |

---

## Skills System

HiPilot includes 35 built-in skills covering the complete RTL-to-GDS flow:

### RTL-to-GDS Flow Skills

| Stage | Skill | Description |
|-------|-------|-------------|
| Synthesis | `/synthesis` | RTL synthesis with Design Compiler |
| Init | `/design-init` | Load design into Innovus |
| Floorplan | `/floorplan` | Die/core area and IO placement |
| Power | `/power-planning` | Power grid creation |
| Placement | `/placement` | Standard cell placement |
| CTS | `/cts` | Clock tree synthesis |
| Post-CTS Opt | `/post-cts-opt` | Setup/hold optimization |
| Routing | `/route-design` | Global and detail routing |
| Route Opt | `/routing-opt` | Post-route optimization |
| Chip Finish | `/chip-finish` | DEF/GDS/netlist export |
| STA | `/sta` | PrimeTime timing signoff |
| Verification | `/verification` | DRC/LVS with Calibre |

### Utility Skills

| Category | Skills |
|----------|--------|
| **Reports** | `/report-timing`, `/report-power`, `/report-area` |
| **Fixes** | `/fix-setup-timing`, `/fix-hold-timing`, `/auto-fix-drc`, `/auto-fix-timing` |
| **Flow** | `/rtl2gds-flow`, `/run-eco-flow`, `/run-cts-flow` |
| **Design** | `/save-design`, `/read-design`, `/create-checkpoint`, `/resume-work` |
| **Analysis** | `/compare-qor`, `/compare-implementations`, `/debug-failure` |
| **Tracking** | `/track-progress`, `/auto-recover` |

---

## MCP Servers

### EDA MCP Server (20 Tools)

| Tool | Purpose |
|------|---------|
| `generate_tcl` | Generate Tcl from natural language |
| `send_to_terminal` | Send Tcl to EDA tool |
| `extract_qor` | Parse WNS/TNS from reports |
| `detect_tool` | Detect current EDA tool |
| `get_mode` / `set_mode` | Execution mode control |
| `get_pending` / `approve_pending` | Command approval |

### Tmux MCP Server (7 Tools)

| Tool | Purpose |
|------|---------|
| `send_keys` | Send commands to panes |
| `capture_pane` | Read pane output |
| `update_status` | Update status bar |
| `list_panes` | List all panes |

### Knowledge MCP Server (4 Tools)

| Tool | Purpose |
|------|---------|
| `search_docs` | Search documentation |
| `get_command_ref` | Get EDA command reference |
| `list_skills` | List available skills |
| `get_skill` | Get skill content |

---

## Tested Design: Ibex RISC-V CPU

HiPilot has been validated on a real design:

| Attribute | Value |
|-----------|-------|
| **Design** | Ibex Core (RV32IMC) |
| **Technology** | Skywater 130nm HD |
| **Cells** | ~7,000 instances |
| **Target Frequency** | 100 MHz (10ns period) |
| **Flow Time** | ~20 minutes |

### Flow Completion Evidence

```
✅ Synthesis (dc_shell) → ibex_core.syn.v
✅ Init (Innovus) → init_design.enc
✅ Floorplan → floor_plan.enc, ibex.floorplan.def
✅ Power Planning → powerplan.enc
✅ Placement → placement.enc
✅ CTS → cts.enc
✅ Post-CTS Opt → post_cts_opt.enc
✅ Routing → routing.enc
✅ Route Opt → routing_opt.enc
✅ Chip Finish → ibex_routing.def, ibex_routing.vg, ibex_lvs.vg
```

---

## Project Structure

```
hipilot/
├── bin/                    # Executable scripts
│   ├── hipilot            # Main launcher
│   └── setup.sh           # Installation script
├── servers/               # MCP servers
│   ├── eda/               # EDA tool integration
│   ├── tmux/              # Workspace management
│   └── knowledge/         # Skills & docs
├── skills/                # 35 skill definitions
│   ├── synthesis.md
│   ├── floorplan.md
│   ├── cts.md
│   ├── routing-opt.md
│   ├── chip-finish.md
│   └── ... (30 more)
├── src/                   # Core source code
│   ├── lib/               # Utilities
│   ├── tui/               # Terminal UI
│   └── cli.js             # CLI interface
├── scripts/               # Helper scripts
│   └── mcp_wrapper.sh     # MCP JSON-RPC wrapper
├── templates/             # Tcl templates
├── docs_latest/           # Latest documentation
└── e2e_evidence/          # Test evidence
```

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | This file - project overview |
| [QUICK_START.md](QUICK_START.md) | First-time user guide |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design details |
| [SKILLS_GUIDE.md](SKILLS_GUIDE.md) | All 35 skills documented |
| [MCP_SERVERS.md](MCP_SERVERS.md) | MCP integration guide |
| [RTL2GDS_FLOW.md](RTL2GDS_FLOW.md) | Complete flow execution |
| [EDA_SERVER_SETUP.md](EDA_SERVER_SETUP.md) | Server configuration |

---

## Environment Requirements

### Development Machine

| Requirement | Version |
|-------------|---------|
| Node.js | v20.18.3+ |
| npm | 10.x |
| Git | 2.x |

### EDA Server (CentOS 7)

| Requirement | Notes |
|-------------|-------|
| Node.js v20 | glibc-2.17 compatible build |
| tmux | 1.8+ (3.4 recommended) |
| EDA Tools | Innovus v20.10+, ICC2 T-2022.03+ |

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** https://github.com/qfliuyang/hipilot/issues
- **Documentation:** See `docs_latest/` directory
- **Examples:** See `e2e_evidence/` for real flow execution logs

---

**Last Updated:** 2026-02-24
**Version:** 0.5.0
