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
│   │  (48 tools) │  │  (8 tools)  │  │  (7 tools)  │            │
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
    "eda": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/eda/index.js"],
      "env": {
        "HIPILOT_SESSION": "hipilot"
      }
    },
    "tmux": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/tmux/index.js"],
      "env": {
        "HIPILOT_SESSION": "hipilot"
      }
    },
    "knowledge": {
      "command": "node",
      "args": ["/path/to/hipilot/servers/knowledge/index.js"]
    }
  }
}
```

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

### Tools

#### 1. generate_tcl

Generate Tcl from natural language intent.

**Parameters:**
```json
{
  "intent": "Generate timing report",
  "template": "report_timing",
  "params": {
    "max_paths": 10,
    "slack_threshold": 0
  }
}
```

**Returns:** Generated Tcl script with trust badge

---

#### 2. send_to_terminal

Send Tcl to EDA tool for execution.

**Parameters:**
```json
{
  "tcl": "report_timing -max_paths 10"
}
```

**Returns:** Execution result

**Mode-Aware:** In manual mode, queues for approval. In auto mode, executes immediately.

---

#### 3. extract_qor

Extract QoR metrics from reports.

**Parameters:**
```json
{
  "report_text": "... timing report content ...",
  "type": "timing"
}
```

**Returns:**
```json
{
  "WNS": 0.05,
  "TNS": 0.0,
  "violating_paths": 0
}
```

---

#### 4. detect_tool

Detect currently running EDA tool.

**Parameters:** None

**Returns:**
```json
{
  "tool": "innovus",
  "version": "20.10",
  "design": "ibex_core"
}
```

---

#### 5. get_mode / set_mode / toggle_mode

Control execution mode.

**get_mode:**
```json
// Returns
{ "mode": "manual", "pending": false }
```

**set_mode:**
```json
{ "mode": "auto" }
// or
{ "mode": "manual" }
```

**toggle_mode:**
```json
// Switches between manual and auto
{ "mode": "auto" }
```

---

#### 6. get_pending / approve_pending / reject_pending

Manage pending Tcl commands (manual mode).

**get_pending:**
```json
// Returns
{
  "tcl": "report_timing -max_paths 10",
  "risk": "low",
  "queued_at": "2026-02-24T00:00:00Z"
}
```

**approve_pending:**
```json
// Executes queued Tcl
{ "executed": true, "result": "..." }
```

**reject_pending:**
```json
// Discards queued Tcl
{ "discarded": true }
```

---

#### 7. list_templates

List available Tcl templates.

**Parameters:** None

**Returns:**
```json
{
  "templates": [
    "icc2_fix_setup_timing.tcl",
    "icc2_report_timing.tcl",
    "innovus_init_design.tcl"
  ]
}
```

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

### Tools

#### 1. send_keys

Send keystrokes to a tmux pane.

**Parameters:**
```json
{
  "pane": "hipilot:0.1",
  "keys": "report_timing -max_paths 10",
  "enter": true
}
```

---

#### 2. capture_pane

Read content from a tmux pane.

**Parameters:**
```json
{
  "pane": "hipilot:0.1",
  "lines": 100
}
```

**Returns:**
```json
{
  "content": "... pane output ..."
}
```

---

#### 3. get_pane_output

Get last N lines from pane.

**Parameters:**
```json
{
  "pane": "hipilot:0.1",
  "n": 50
}
```

---

#### 4. update_status

Update tmux status bar.

**Parameters:**
```json
{
  "left": "⚙ HiPilot │ 🔒 Manual",
  "right": "innovus │ ibex_core"
}
```

---

#### 5. set_mode_status

Update mode indicator in status bar.

**Parameters:**
```json
{
  "mode": "auto",
  "pending": false
}
```

---

#### 6. list_panes

List all panes in the session.

**Parameters:** None

**Returns:**
```json
{
  "panes": [
    { "id": "0", "title": "Claude Code" },
    { "id": "1", "title": "Innovus" }
  ]
}
```

---

#### 7. resize_pane

Resize a pane.

**Parameters:**
```json
{
  "pane": "hipilot:0.0",
  "width": 120,
  "height": 60
}
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

### Tools

#### 1. search_docs

Search documentation for relevant content.

**Parameters:**
```json
{
  "query": "how to fix setup violations",
  "max_results": 5
}
```

**Returns:**
```json
{
  "results": [
    {
      "source": "skills/fix-setup-timing.md",
      "relevance": 0.95,
      "excerpt": "..."
    }
  ]
}
```

---

#### 2. get_command_ref

Get EDA command reference.

**Parameters:**
```json
{
  "tool": "innovus",
  "command": "report_timing"
}
```

**Returns:**
```json
{
  "syntax": "report_timing [-max_paths N] [-delay_type max|min]",
  "description": "Generate timing report",
  "examples": ["report_timing -max_paths 10"]
}
```

---

#### 3. list_skills

List all available skills.

**Parameters:**
```json
{
  "filter": "timing"
}
```

**Returns:**
```json
{
  "skills": [
    { "name": "fix-setup-timing", "triggers": ["fix setup"] },
    { "name": "report-timing", "triggers": ["timing report"] }
  ]
}
```

---

#### 4. get_skill

Get full skill content.

**Parameters:**
```json
{
  "name": "cts"
}
```

**Returns:** Full skill Markdown content

---

## MCP Wrapper Script

For environments where MCP feature gate is disabled, use the wrapper:

**Location:** `scripts/mcp_wrapper.sh`

**Usage:**
```bash
# Set mode to auto
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'

# Send Tcl command
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "report_timing -max_paths 10"
}'

# Get current mode
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda get_mode '{}'
```

**How it works:**
1. Accepts server name, tool name, and JSON arguments
2. Formats as JSON-RPC request
3. Sends to MCP server via stdin
4. Returns response via stdout

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

### EDA MCP (48 Tools)
| Tool | Purpose |
|------|---------|
| generate_tcl | Create Tcl from intent |
| send_to_terminal | Execute Tcl |
| extract_qor | Parse metrics |
| detect_tool | Identify tool |
| get_mode | Get mode |
| set_mode | Set mode |
| toggle_mode | Toggle mode |
| get_pending | Get queued Tcl |
| approve_pending | Approve Tcl |
| reject_pending | Reject Tcl |
| list_templates | List templates |
| get_job_status | Check job status |
| get_risk_analysis | Analyze command risk |
| confirm_dangerous | Confirm dangerous operations |
| get_status | Get overall status |
| quick | Quick command execution |
| capture_and_analyze | Capture and analyze output |
| run_skill | Execute a skill |
| edit_tcl | Edit Tcl template |

### Tmux MCP (8 Tools)
| Tool | Purpose |
|------|---------|
| send_keys | Send commands |
| capture_pane | Read output |
| get_pane_output | Get lines |
| update_status | Update status |
| set_mode_status | Update mode |
| list_panes | List panes |
| resize_pane | Resize |

### Knowledge MCP (7 Tools)
| Tool | Purpose |
|------|---------|
| search_docs | Search docs |
| get_command_ref | Get reference |
| list_skills | List skills |
| get_skill | Get content |

---

**Last Updated:** 2026-02-24
