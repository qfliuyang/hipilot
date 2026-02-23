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
    "eda": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/eda/index.js"]
    },
    "tmux": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/tmux/index.js"]
    },
    "knowledge": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/knowledge/index.js"]
    }
  }
}
```

**IMPORTANT:** Replace `/path/to/hipilot/` with your actual path.

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

Expected: 35 skills covering RTL-to-GDS flow.

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

To run the complete RTL-to-GDS flow:

```
"Execute the Ibex RTL2GDS flow from init through chip finish"
```

HiPilot will:
1. Load design into Innovus
2. Create floorplan
3. Build power grid
4. Place cells
5. Run CTS
6. Optimize timing
7. Route design
8. Export outputs

---

## Common Commands Reference

| Task | Command |
|------|---------|
| List skills | `"List all available skills"` |
| Check status | `"What is the design status?"` |
| Run timing report | `"Generate timing report with 10 paths"` |
| Fix setup violations | `"/fix-setup-timing"` |
| Run CTS | `"/cts"` |
| Save checkpoint | `"/save-design"` |
| Run full flow | `"/ibex-rtl2gds-flow"` |

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

- Read [SKILLS_GUIDE.md](SKILLS_GUIDE.md) for detailed skill documentation
- Read [RTL2GDS_FLOW.md](RTL2GDS_FLOW.md) for complete flow guide
- Check [e2e_evidence/](../e2e_evidence/) for real execution examples

---

## Getting Help

- Check `docs_latest/` for detailed documentation
- Review `e2e_evidence/` for real-world examples
- Open an issue on GitHub

---

**Ready to go!** Start with simple commands and work up to the full flow.
