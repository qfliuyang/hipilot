# HiPilot Quick Start Guide

**For First-Time Users**

This guide will get you running HiPilot in under 10 minutes.

---

## Prerequisites Check

Before starting, ensure you have:

- [ ] Node.js v20+ installed
- [ ] Claude Code CLI installed
- [ ] SSH access to EDA server (or local EDA tools)
- [ ] Git installed

---

## Step 1: Installation

### 1.1 Clone Repository

```bash
git clone https://github.com/qfliuyang/hipilot.git
cd hipilot
```

### 1.2 Install Dependencies

```bash
# Install all dependencies (main + MCP servers)
npm run install:all
```

### 1.3 Configure MCP Servers

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "hipilot-eda": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/eda/index.js"],
      "env": { "HIPILOT_SESSION": "hipilot" }
    },
    "hipilot-tmux": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/tmux/index.js"],
      "env": { "HIPILOT_SESSION": "hipilot" }
    },
    "hipilot-knowledge": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/knowledge/index.js"],
      "env": { "HIPILOT_SESSION": "hipilot" }
    }
  }
}
```

**IMPORTANT:** Replace `/path/to/hipilot/` with your actual absolute path. On CentOS 7 (EDA server), use the full node binary path instead of just `node`.

---

## Step 2: Start HiPilot

### Option A: With tmux Workspace (Recommended)

```bash
# Create tmux session with split layout
./bin/hipilot
```

This creates:
- Left pane (50%): Claude Code with HiPilot
- Right pane (50%): EDA tool terminal

### Option B: Claude Code Only

```bash
# Start Claude Code with HiPilot context
claude --dangerously-skip-permissions
```

---

## Step 3: Verify Installation

### 3.1 Check MCP Servers

In Claude Code, ask:
```
"What MCP tools are available?"
```

Expected response should list tools from:
- EDA MCP: generate_tcl, send_to_terminal, extract_qor, etc.
- Tmux MCP: send_keys, capture_pane, etc.
- Knowledge MCP: list_skills, get_skill, etc.

### 3.2 List Available Skills

```
"List all available skills"
```

Expected: 34 skills covering RTL-to-GDS flow.

---

## Step 4: First Commands

### 4.1 Check EDA Tool Status

```
"What is the current EDA tool status?"
```

### 4.2 Load a Design (if using EDA server)

```
"Load the synthesized Ibex design from result/syn/data/ibex_core.syn.v"
```

### 4.3 Generate a Timing Report

```
"Generate a timing report with max_paths 10"
```

---

## Step 5: Run Complete Flow

Execute the RTL-to-GDS flow stage by stage:

```
"Run synthesis on the Ibex design"
```

Then continue with each stage:
```
"/design-init"     → Load synthesized netlist
"/floorplan"      → Create die area and place IOs
"/powerplan"      → Build power grid (VDD/VSS)
"/placement"      → Place standard cells
"/cts"            → Build clock tree
"/postcts-opt"    → Fix timing with real clocks
"/routing"        → Route all nets
"/routeopt"       → Optimize and fix DRCs
"/chipfinish"     → Add fillers and export GDS
```

**Why stages?** Each stage saves a checkpoint. If something fails, resume from the last good checkpoint.

---

## Common Commands Reference

| Task | Command |
|------|---------|
| List skills | `"List all available skills"` |
| Check status | `"What is the design status?"` |
| Run synthesis | `"/synthesis"` |
| Run floorplan | `"/floorplan"` |
| Run placement | `"/placement"` |
| Run CTS | `"/cts"` |
| Run routing | `"/routing"` |
| Fix setup violations | `"/fix-setup-timing"` |
| Save checkpoint | `"/save-design"` |
| **Team Mode** | `"Run team mode on this design"` |

---

## Troubleshooting

### MCP Servers Not Connecting

1. Check paths in `~/.claude/settings.json`
2. Verify Node.js v20+ is in PATH
3. Restart Claude Code

### EDA Tool Not Responding

1. Check EDA tool is running in right pane
2. Verify tool license is available
3. Check tmux session exists: `tmux list-sessions`

### Commands Not Executing

1. Check execution mode (manual vs auto)
2. Approve pending commands: `"Approve pending Tcl"`
3. Check for errors in EDA pane

---

## Next Steps

- Read [skills-guide.md](skills-guide.md) for detailed skill documentation
- Explore the modular stage skills for each step of the RTL-to-GDS flow:
  - [Synthesis Stage](../skills/synthesis-stage.md) - Logic synthesis with Design Compiler
  - [Design Initialization Stage](../skills/design-init-stage.md) - Load design into Innovus
  - [Floorplan Stage](../skills/floorplan.md) - Create die area and place IOs
  - [Power Planning Stage](../skills/power-planning.md) - Build power grid (VDD/VSS)
  - [Placement Stage](../skills/placement.md) - Place standard cells
  - [CTS Stage](../skills/cts.md) - Build clock tree
  - [Post-CTS Optimization Stage](../skills/post-cts-opt.md) - Fix timing with real clocks
  - [Routing Stage](../skills/route-design.md) - Route all nets
  - [Routing Optimization Stage](../skills/routing-opt.md) - Optimize and fix DRCs
  - [Chip Finish Stage](../skills/chip-finish.md) - Add fillers and export GDS

---

## Getting Help

- Check other docs in this directory for detailed documentation
- Open an issue on GitHub

---

**Ready to go!** Start with simple commands and work up to the full flow.
