# HiPilot MCP Servers

**Model Context Protocol Integration Guide**

---

## Overview

HiPilot uses three MCP (Model Context Protocol) servers to extend Claude Code's capabilities for EDA tool automation.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Claude Code                                 │
│                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │   EDA MCP   │  │  Tmux MCP   │  │Knowledge MCP│            │
│   │  (57 tools) │  │  (8 tools)  │  │  (7 tools)  │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### MCP Server Registration

Add to `~/.claude/settings.json`:

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
      "args": ["/path/to/hipilot/servers/knowledge/index.js"]
    }
  }
}
```

### Claude Code MCP Configuration (Important)

Claude Code v2.1.63+ may have a feature gate that prevents MCP tool discovery even when servers are configured in `settings.json`. To ensure MCP tools are available, launch Claude Code with the `--mcp-config` flag:

```bash
claude --mcp-config /path/to/mcp-config.json --strict-mcp-config
```

The `--strict-mcp-config` flag ensures only the specified MCP configuration is used, bypassing the feature gate.

**Example `/tmp/force_mcp.json`:**
```json
{
  "mcpServers": {
    "hipilot-eda": {
      "command": "/path/to/node",
      "args": ["/path/to/hipilot/servers/eda/index.js"],
      "env": {"HIPILOT_SESSION": "hipilot"}
    },
    "hipilot-tmux": {
      "command": "/path/to/node",
      "args": ["/path/to/hipilot/servers/tmux/index.js"],
      "env": {"HIPILOT_SESSION": "hipilot"}
    },
    "hipilot-knowledge": {
      "command": "/path/to/node",
      "args": ["/path/to/hipilot/servers/knowledge/index.js"]
    }
  }
}
```

**HiPilot automatically handles this** - the `bin/hipilot` launcher creates this configuration and launches Claude Code with the appropriate flags.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HIPILOT_SESSION` | tmux session name | `hipilot` |
| `HIPILOT_PATH` | HiPilot installation path | Auto-detected |
| `NODE_PATH` | Node.js module path | System default |

---

## EDA MCP Server

**Location:** `servers/eda/index.js`

**Purpose:** EDA tool integration, Tcl generation, QoR extraction

### Tools (57 total)

Tools are organized by category. Required parameters are marked with `*`.

#### Tcl Generation & Execution

| Tool | Description | Parameters |
|------|-------------|-----------|
| `generate_tcl` | Generate Tcl from natural language intent using templates | `intent*`, `operation*`, `tool`, `targets`, `variables` |
| `send_to_terminal` | Send Tcl to EDA pane (mode-aware: queues in manual, executes in auto) | `tcl*`, `pane` |
| `quick` | One-call solution: generate + risk-analyze + send in one step | `operation*`, `params` |
| `save_tcl` | Save Tcl to project scripts directory | `tcl*`, `filename`, `directory` |
| `edit_tcl` | Open Tcl in $EDITOR for manual modification | `tcl`, `use_pending` |
| `validate_tcl` | Validate Tcl syntax before sending to EDA | `tcl*` |
| `list_templates` | List available Tcl templates by vendor | (none) |
| `run_skill` | Execute a HiPilot skill by name | `skill*`, `params` |

**Example — generate_tcl:**
```json
{
  "intent": "Fix setup timing violations on pcie_rx",
  "operation": "fix_setup_timing",
  "tool": "icc2",
  "targets": "pcie_rx"
}
```

`operation` values: `fix_setup_timing`, `fix_hold_timing`, `route_design`, `report_timing`, `report_power`, `report_area`, `check_drc`, `run_cts`, `optimize_design`, `read_design`, `save_design`, `compare_qor`

#### EDA Tool Interaction

| Tool | Description | Parameters |
|------|-------------|-----------|
| `detect_tool` | Detect running EDA tool (ICC2, Innovus, PrimeTime, Tempus) | (none) |
| `start_tool` | Start EDA tool in the right pane via tmux (innovus, icc2_shell, pt_shell). Use before workflows so user does not launch manually. | `tool`, `design_dir`, `pane`, `timeout` |
| `execute_and_verify` | **Complete pipeline: send Tcl, wait for completion, detect errors, extract QoR. Preferred over separate send+wait+capture calls.** | `tcl*`, `timeout`, `description`, `extract_qor`, `pane` |
| `capture_and_analyze` | Capture EDA pane output and extract QoR metrics | `pane`, `lines`, `report_type` |
| `capture_and_wait` | Send Tcl, wait for prompt, return output with result analysis | `tcl*`, `timeout`, `pane` |
| `wait_for_prompt` | Wait for EDA tool prompt (auto-detected per tool) | `timeout`, `pane` |
| `wait_for_pattern` | Wait for regex pattern in EDA output | `pattern*`, `timeout`, `pane` |
| `get_last_result` | Parse last EDA command output for success/failure | `lines`, `pane` |
| `extract_qor` | Extract QoR metrics from report text or file | `report_path`, `report_content` |
| `get_job_status` | Check status of running EDA jobs (LSF or local) | `job_id` |
| `analyze_report` | AI-powered analysis of EDA reports | `report_content`, `report_path`, `report_type` |
| `get_analysis_cache` | Get or clear report analysis cache | `action` |
| `diagnose_error` | Analyze EDA error output with fix suggestions | `output*`, `tool` |

#### Execution Mode Control

| Tool | Description | Parameters |
|------|-------------|-----------|
| `get_mode` | Get current mode (manual/auto) | (none) |
| `set_mode` | Set execution mode | `mode*` |
| `toggle_mode` | Toggle between manual and auto | (none) |
| `get_pending` | Get pending Tcl waiting for approval | (none) |
| `approve_pending` | Approve and execute pending Tcl | (none) |
| `reject_pending` | Reject and discard pending Tcl | (none) |
| `get_risk_analysis` | Analyze risk level of Tcl without executing | `tcl*` |
| `confirm_dangerous` | Confirm dangerous/critical Tcl operation | `confirmation_text*` |
| `get_status` | Get comprehensive system status | (none) |

#### Session & Context

| Tool | Description | Parameters |
|------|-------------|-----------|
| `session.save_checkpoint` | Save session state as named checkpoint | `name*`, `description` |
| `session.list_checkpoints` | List all saved checkpoints | (none) |
| `session.restore_checkpoint` | Restore session context from checkpoint | `checkpoint_id*` |
| `session.get_history` | Get command history with result summaries | `limit` |
| `session.get_context` | Get current session context summary | (none) |
| `context.detect` | Auto-detect design context from EDA output | (none) |
| `context.get_stage` | Get current flow stage with confidence level | (none) |
| `context.suggest_next` | Suggest next logical step based on stage and QoR | (none) |

#### QoR Tracking

| Tool | Description | Parameters |
|------|-------------|-----------|
| `qor.snapshot` | Capture QoR metrics as named snapshot | `name*`, `description` |
| `qor.list_snapshots` | List all saved QoR snapshots | (none) |
| `qor.compare` | Compare two QoR snapshots, show delta | `snapshot1*`, `snapshot2*` |
| `qor.get_trend` | Show QoR trend over last N snapshots | `metric`, `snapshots` |

#### Workflow Automation

| Tool | Description | Parameters |
|------|-------------|-----------|
| `workflow.define` | Define multi-step workflow with error handling | `name*`, `description`, `steps*` |
| `workflow.list` | List all defined workflows | (none) |
| `workflow.run` | Execute a defined workflow | `name*`, `params` |
| `workflow.get_status` | Get status of a workflow run | `run_id*` |
| `workflow.cancel` | Cancel a running workflow | `run_id*` |

#### Smart Suggestions

| Tool | Description | Parameters |
|------|-------------|-----------|
| `suggest.analyze` | Analyze design state and suggest improvements | `focus` |
| `suggest.for_violation` | Get fix suggestions for a violation type | `violation_type*`, `path_group` |
| `suggest.next_optimization` | Suggest next optimization step based on QoR | `goal` |

---

### Execution Mode System

| Mode | Behavior | Status Bar |
|------|----------|------------|
| **Manual** | Tcl queued for approval | 🔒 Manual |
| **Auto** | Tcl executes immediately | ⚡ Claude has conn |

**Mode Flow:**
```
User Command → Tcl Generated
       │
       ▼
Mode Check ──────┬── Manual ──→ Queue → Approval → Execute
                 │
                 └── Auto ───→ Execute Immediately
```

---

## Tmux MCP Server

**Location:** `servers/tmux/index.js`

**Purpose:** Workspace management, pane control

### Tools (8 total)

| Tool | Description | Parameters |
|------|-------------|-----------|
| `send_keys` | Send keystrokes to a pane ("chat" for left, "eda" for right) | `pane*`, `keys*` |
| `capture_pane` | Capture current content of a pane | `pane*`, `lines` |
| `get_pane_output` | Get last N lines from pane scrollback buffer | `pane*`, `lines` |
| `setup_layout` | Create or attach to HiPilot workspace (50/50 split) | `working_dir` |
| `update_status` | Update status bar with context | `tool`, `skill`, `job_status`, `design`, `wns`, `mode`, `pending` |
| `set_mode_status` | Update mode indicator in status bar | `mode*`, `pending` |
| `list_panes` | List all panes in the session | (none) |
| `resize_pane` | Resize a pane by percentage or absolute size | `pane*`, `width`, `height` |

**Example — send_keys:**
```json
{ "pane": "eda", "keys": "report_timing -max_paths 10" }
```

**Example — update_status:**
```json
{ "tool": "innovus", "skill": "fix-setup-timing", "mode": "manual", "design": "ibex_core" }
```

---

### Workspace Layout

```
tmux session: hipilot
├── Window 0
│   ├── Pane 0 (Left): Claude Code
│   └── Pane 1 (Right): EDA Tool
└── Status Bar: Mode | Tool | Design
```

---

## Knowledge MCP Server

**Location:** `servers/knowledge/index.js`

**Purpose:** Skill and documentation management

### Tools (7 total)

| Tool | Description | Parameters |
|------|-------------|-----------|
| `search_docs` | Full-text search across project, user, and team docs | `query*`, `max_results` |
| `get_command_ref` | Get EDA command reference (syntax, options, examples) | `command*`, `tool` |
| `search_commands` | Search EDA commands by keyword or category | `query*`, `category`, `tool` |
| `list_skills` | List all skills (3-level: project > user > built-in) | (none) |
| `get_skill` | Get full content of a specific skill | `name*` |
| `match_skill` | Match user intent to best skill via trigger phrases | `intent*` |
| `get_methodology` | Get methodology guide for a flow stage | `topic*`, `vendor` |

**Example — search_docs:**
```json
{ "query": "how to fix setup violations", "max_results": 5 }
```

**Example — match_skill:**
```json
{ "intent": "fix setup timing on pcie_rx group" }
```

**Example — get_methodology:**
```json
{ "topic": "timing closure", "vendor": "synopsys" }
```

---

## Direct Tool Usage from Claude Code

When Claude Code is running, use these patterns:

### EDA Tools
```
"Use the eda MCP server to generate a timing report"
"What is the current execution mode?"
"Send this Tcl to Innovus: report_timing -max_paths 5"
```

### Tmux Tools
```
"Capture the output from the EDA pane"
"What panes are available?"
"Update the status bar to show timing complete"
```

### Knowledge Tools
```
"List all skills related to timing"
"Show me the CTS skill content"
"Search for documentation on clock tree synthesis"
```

---

## Troubleshooting

### MCP Servers Not Connecting

1. **Check configuration:**
```bash
cat ~/.claude/settings.json | grep -A10 mcpServers
```

2. **Verify paths:**
```bash
ls servers/*/index.js
```

3. **Test server directly:**
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
```

4. **Verify MCP tools are loaded in Claude Code:**
```
# In Claude Code, check if tools have mcp__ prefix:
Look for: mcp__hipilot-eda__*, mcp__hipilot-tmux__*, mcp__hipilot-knowledge__*
```

If MCP tools are not showing (no `mcp__` prefix), Claude Code may have a feature gate blocking MCP discovery. Use the `--mcp-config` flag as described in the [Claude Code MCP Configuration](#claude-code-mcp-configuration-important) section above.

### tmux Commands Failing

1. **Check session exists:**
```bash
tmux list-sessions
```

2. **Check pane IDs:**
```bash
tmux list-panes -t hipilot
```

3. **Verify tmux version:**
```bash
tmux -V  # Should be 1.8+ or 3.4+
```

### Commands Not Reaching EDA Tool

1. **Check mode:** Manual mode requires approval
2. **Check pending queue:** `eda.get_pending()`
3. **Approve commands:** `eda.approve_pending()`

---

## API Reference Summary

### EDA MCP (49 Tools)

| Category | Tools |
|----------|-------|
| **Tcl Generation** | `generate_tcl`, `send_to_terminal`, `quick`, `save_tcl`, `edit_tcl`, `validate_tcl`, `list_templates`, `run_skill` |
| **EDA Interaction** | `detect_tool`, `execute_and_verify`, `capture_and_analyze`, `capture_and_wait`, `wait_for_prompt`, `wait_for_pattern`, `get_last_result`, `extract_qor`, `get_job_status`, `analyze_report`, `get_analysis_cache`, `diagnose_error` |
| **Mode Control** | `get_mode`, `set_mode`, `toggle_mode`, `get_pending`, `approve_pending`, `reject_pending`, `get_risk_analysis`, `confirm_dangerous`, `get_status` |
| **Session** | `session.save_checkpoint`, `session.list_checkpoints`, `session.restore_checkpoint`, `session.get_history`, `session.get_context` |
| **Context** | `context.detect`, `context.get_stage`, `context.suggest_next` |
| **QoR** | `qor.snapshot`, `qor.list_snapshots`, `qor.compare`, `qor.get_trend` |
| **Workflow** | `workflow.define`, `workflow.list`, `workflow.run`, `workflow.get_status`, `workflow.cancel` |
| **Suggestions** | `suggest.analyze`, `suggest.for_violation`, `suggest.next_optimization` |

### Tmux MCP (8 Tools)

| Tool | Purpose |
|------|---------|
| `send_keys` | Send keystrokes to pane |
| `capture_pane` | Read pane content |
| `get_pane_output` | Get scrollback lines |
| `setup_layout` | Create 50/50 workspace |
| `update_status` | Update status bar context |
| `set_mode_status` | Update mode indicator |
| `list_panes` | List all panes |
| `resize_pane` | Resize pane |

### Knowledge MCP (7 Tools)

| Tool | Purpose |
|------|---------|
| `search_docs` | Full-text search across docs |
| `get_command_ref` | EDA command reference |
| `search_commands` | Search commands by keyword/category |
| `list_skills` | List all available skills |
| `get_skill` | Get full skill content |
| `match_skill` | Match intent to best skill |
| `get_methodology` | Flow stage methodology guide |

---

**Last Updated:** 2026-03-01

## MCP Configuration Verification

To verify MCP tools are being used correctly (not bash workarounds), check the Claude Code pane output:

**✅ Correct (Native MCP):**
```
● hipilot-eda - eda.detect_tool (MCP)
● hipilot-eda - eda.start_tool (MCP)
● hipilot-eda - eda.execute_and_verify (MCP)
```

**❌ Wrong (Bash Workaround):**
```
● Bash(echo '{"jsonrpc":"2.0",...}' | node servers/eda/index.js)
```

If you see bash workarounds instead of native MCP tools, ensure Claude Code is launched with `--mcp-config /path/to/mcp-config.json --strict-mcp-config`.
