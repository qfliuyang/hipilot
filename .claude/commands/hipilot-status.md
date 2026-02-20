# HiPilot Status Check

Use this skill to check the current HiPilot system status before performing EDA operations.

## What This Does

Checks and reports:
1. Available MCP tools (EDA, Tmux, Knowledge)
2. Current execution mode (Manual/Auto)
3. Pending Tcl waiting for approval
4. EDA tool detection (Innovus/ICC2/PrimeTime)
5. tmux workspace status

## Usage

Simply say "check hipilot status" or "what's the current status" before starting EDA work.

## Workflow

1. Call `eda.get_mode()` to check execution mode
2. Call `eda.get_pending()` to check for pending Tcl
3. Call `eda.detect_tool()` to identify running EDA tool
4. Report status to user

## Example Output

```
📊 HiPilot Status Report

Mode: 🔒 Manual (approval required for each command)
EDA Tool: Innovus v20.10 (detected)
Pending Tcl: None
tmux Session: hipilot (2 panes, 50/50 split)

Available Tools:
- eda.generate_tcl     Generate Tcl from intent
- eda.send_to_terminal Send Tcl to EDA pane (with approval)
- eda.get_risk_analysis Analyze risk level of Tcl
- eda.approve_pending  Approve queued Tcl
- eda.reject_pending   Reject queued Tcl

Ready for commands.
```

## Why This Matters

Before generating and sending Tcl, Claude should:
1. Know the current mode (Manual requires approval, Auto executes immediately)
2. Check if there's already pending Tcl (avoid conflicts)
3. Verify the correct EDA tool is running
4. Use MCP tools instead of Bash commands for proper approval flow
