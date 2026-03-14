# HiPilot User Guide

**HiPilot** is an AI-powered VLSI Physical Design Copilot that brings the power of Claude Code to Electronic Design Automation (EDA) workflows. It creates a two-pane workspace where you interact with Claude on the left, and Claude controls EDA tools (Innovus, ICC2, PrimeTime) on the right.

---

## Table of Contents

1. [What is HiPilot?](#what-is-hipilot)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [The Workspace](#the-workspace)
5. [Commands](#commands)
6. [Workflows](#workflows)
7. [Tips and Best Practices](#tips-and-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## What is HiPilot?

HiPilot bridges the gap between natural language and complex EDA workflows. Instead of memorizing hundreds of Tcl commands, you describe what you want to achieve in plain English, and HiPilot generates and executes the appropriate commands.

### Key Features

- **Natural Language Interface**: Describe your goals, not the steps
- **Intelligent Orchestration**: Claude understands chip design workflows
- **Multi-Tool Support**: Works with Cadence Innovus, Synopsys ICC2 and PrimeTime
- **Safety First**: All Tcl execution requires approval (manual mode) or is verified (auto mode)
- **Context-Aware**: Remembers your design state across stages
- **Skill-Based**: Expert workflows embedded in 36+ skill files

---

## Installation

### Prerequisites

- Linux workstation (tested on CentOS 7.9, Ubuntu 20.04+)
- Node.js v20+ (static build recommended for CentOS 7)
- tmux (any recent version)
- EDA tools installed and licensed (Innovus v20.10+, ICC2 T-2022.03+, PrimeTime T-2022.03+)
- Claude Code CLI (`claude` command)

### Install HiPilot

1. **Download the latest release** or clone the repository:
   ```bash
   git clone https://github.com/yourorg/hipilot.git
   cd hipilot
   ```

2. **Install dependencies**:
   ```bash
   npm run install:all
   ```

3. **Configure Claude Code settings**:

   Create `~/.claude/settings.json` with MCP server registrations:
   ```json
   {
     "mcpServers": {
       "hipilot-eda": {
         "command": "/path/to/node",
         "args": ["/path/to/hipilot/servers/eda/index.js"],
         "env": {
           "HIPILOT_SESSION": "hipilot"
         }
       },
       "hipilot-tmux": {
         "command": "/path/to/node",
         "args": ["/path/to/hipilot/servers/tmux/index.js"],
         "env": {
           "HIPILOT_SESSION": "hipilot"
         }
       },
       "hipilot-knowledge": {
         "command": "/path/to/node",
         "args": ["/path/to/hipilot/servers/knowledge/index.js"],
         "env": {
           "HIPILOT_SESSION": "hipilot"
         }
       }
     }
   }
   ```

4. **Set up the project CLAUDE.md**:

   Copy `deploy/eda-server/CLAUDE.md` to your project root. This file tells Claude how to behave as HiPilot.

---

## Quick Start

### Launch HiPilot

```bash
bin/hipilot
```

This creates a tmux session with two panes:
- **Left pane**: Claude Code (where you type)
- **Right pane**: Empty terminal (where EDA tools run)

### Your First Command

Once Claude Code initializes, type:

```
Can you help me run synthesis on my design?
```

HiPilot will:
1. Identify the appropriate workflow (synthesis)
2. Load the synthesis skill
3. Check your design directory
4. Generate the necessary Tcl
5. Ask for approval before execution

### Approve Execution

By default, HiPilot runs in **manual mode**:
- Tcl appears with a `[✓ Pending Approval]` badge
- Press `Ctrl+B` then `y` to approve
- Or type `yes` if Claude asks

To switch to **auto mode** (approve all generated Tcl):
- Press `Ctrl+B` then `m`

---

## The Workspace

```
┌─── Left Pane ────────────────┬─── Right Pane ───────────────┐
│                               │                               │
│  Claude Code                  │  Terminal                     │
│  (Interactive AI)             │  (EDA Tool Output)            │
│                               │                               │
│  You type commands here       │  HiPilot controls this pane   │
│  Claude responds here         │  Shows tool output            │
│                               │                               │
├───────────────────────────────┴───────────────────────────────┤
│  [Manual] │ Design: ibex_core │ Tool: innovus │ Status: idle   │
└───────────────────────────────────────────────────────────────┘
```

### Status Bar

The bottom bar shows:
- **Mode**: `Manual` (approval required) or `Auto` (auto-approve)
- **Design**: Current design name
- **Tool**: Currently active EDA tool
- **Status**: `idle`, `running`, `error`, etc.

### Keyboard Shortcuts

All shortcuts use the tmux prefix (`Ctrl+B` by default):

| Shortcut | Action |
|----------|--------|
| `Ctrl+B y` | Approve pending Tcl execution |
| `Ctrl+B m` | Toggle manual/auto mode |
| `Ctrl+B s` | Open skill browser |
| `Ctrl+B t` | Open template browser |
| `Ctrl+B r` | View recent commands |
| `Ctrl+B h` | View command history |
| `Ctrl+B q` | Quit HiPilot |

---

## Commands

### Slash Commands

HiPilot provides slash commands for common workflows:

| Command | Description |
|---------|-------------|
| `/rtl2gds` | **Deprecated** - Use modular commands below (`/synthesis`, `/floorplan`, `/place`, `/cts`, `/route`, `/signoff`) |
| `/synthesis` | Run synthesis only |
| `/place` | Placement stage |
| `/cts` | Clock Tree Synthesis |
| `/route` | Routing stage |
| `/timing` | Timing analysis and closure |
| `/power` | Power analysis |
| `/drc` | Design Rule Checking |

### Natural Language Examples

You don't need to memorize commands. Just ask:

```
"I need to fix setup violations in my design"
→ Loads fix-setup-timing skill

"Run placement with timing-driven optimization"
→ Generates placement Tcl with timing constraints

"What's my current WNS and TNS?"
→ Runs timing report and extracts metrics

"Export GDS for fabrication"
→ Runs final verification and GDS export

"Switch to PrimeTime for signoff"
→ Exits current tool, starts pt_shell
```

---

## Workflows

### Complete RTL to GDS Flow

```
> /synthesis

HiPilot: I'll guide you through the complete RTL-to-GDS flow.
This involves 10 stages:
1. Design Initialization
2. Floorplan
3. Placement
4. Pre-CTS Optimization
5. Clock Tree Synthesis
6. Post-CTS Optimization
7. Routing
8. Post-Route Optimization
9. Signoff
10. GDS Export

Let's begin with Stage 1: Design Initialization...
```

HiPilot will:
1. Run each stage sequentially
2. Save checkpoints after each stage
3. Report QoR metrics (WNS, TNS, area, power)
4. Ask before proceeding to the next stage

### Stage-by-Stage Operation

You can run individual stages:

```
> Run placement on my design

HiPilot: I'll run the placement stage.
Loading placement skill...
Generating Tcl for timing-driven placement...
[✓ Pending Approval] Placement Tcl ready. Press prefix+y to execute.
```

### Design Exploration

Ask about your design:

```
> What's the current utilization?
> Show me the critical path
> Are there any DRC violations?
> Report clock skew
```

---

## Tips and Best Practices

### 1. Start with Manual Mode

New users should stay in manual mode to understand what HiPilot is doing. Switch to auto mode only after you're comfortable.

### 2. Review Tcl Before Approval

Before approving, read the Tcl that HiPilot generates. This helps you learn and catch any misunderstandings.

### 3. Use Checkpoints

HiPilot automatically saves checkpoints after each stage. If something goes wrong, you can:

```
> Restore the checkpoint from after placement
```

### 4. Be Specific

The more specific you are, the better HiPilot performs:

- ❌ "Fix timing"
- ✅ "Fix setup violations in the CPU core clock domain"

### 5. Check Status Bar

The status bar shows what's happening. If it says `running`, wait for completion. If `error`, check the right pane.

### 6. Skills Reference

Browse available skills:

```bash
node src/cli.js skills
```

Or use `Ctrl+B s` in HiPilot.

---

## Troubleshooting

### HiPilot Won't Start

**Problem**: `bin/hipilot` fails with "tmux not found"
```bash
# Check tmux installation
tmux -V

# If not installed:
sudo yum install tmux    # CentOS/RHEL
sudo apt install tmux    # Ubuntu/Debian
```

**Problem**: "MCP servers not available"
```bash
# Check settings.json exists and is valid
cat ~/.claude/settings.json | jq .

# Verify MCP server paths
ls -la /path/to/hipilot/servers/eda/index.js
```

### Tcl Execution Fails

**Problem**: EDA tool not found
```bash
# Check tool availability
which innovus
which icc2
which pt_shell

# Check license
innovus -check_license
```

**Problem**: Design files not found
```
> The design directory is empty

HiPilot: Please specify your design directory:
> Use design at /home/user/my_design
```

### Approval Not Working

**Problem**: `Ctrl+B y` does nothing
- Make sure you're focused on the left pane (Claude)
- Check that there is pending Tcl (look for `[✓ Pending Approval]`)
- Try typing `yes` instead

### Connection Issues

**Problem**: Claude Code can't connect to MCP servers
```bash
# Restart Claude Code within HiPilot
Ctrl+C  # Interrupt current session
tmux send-keys -L hipilot -t 0.0 "claude --dangerously-skip-permissions" Enter
```

### Getting Help

```
> Help me understand what went wrong
> Show me the last error
> What skills are available?
> How do I fix antenna violations?
```

---

## Advanced Usage

### Custom Skills

Create your own skills in `skills/`:

```markdown
# My Custom Flow

## When to Use
Describe when this skill applies.

## Prerequisites
- List required files
- List required tools

## Steps
1. Step one
2. Step two with Tcl:
   ```tcl
   set_my_variable value
   run_my_command
   ```

## Verification
How to check success.

## Common Issues
| Error | Solution |
|-------|----------|
| Error message | What to do |
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `HIPILOT_SESSION` | Tmux socket name (default: `hipilot`) |
| `HIPILOT_MODE` | `manual` or `auto` |
| `HIPILOT_DESIGN_DIR` | Default design directory |

### Batch Mode

Run HiPilot without the TUI:

```bash
bin/hipilot --no-terminal
```

Useful for CI/CD or remote execution.

---

## Support

- **Documentation**: See `docs/` directory
- **Issue Tracker**: GitHub Issues
- **Skills Reference**: Run `node src/cli.js skills`
- **Template Reference**: Run `node src/cli.js templates`

---

*HiPilot v0.7.0 - Making VLSI design accessible through AI*
