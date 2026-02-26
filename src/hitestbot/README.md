# HiTestBot v2 — Uses HiPilot Like a Human

HiTestBot is a virtual human that uses HiPilot exactly as a real engineer would. It launches HiPilot, types commands, watches Claude work, approves when asked, and judges the result by reading what's on screen.

## How It Works

```
HiTestBot does exactly what a human does:

  1. Run bin/hipilot         ← launches tmux workspace
  2. Open gnome-terminal     ← workspace pops up on desktop (display :0)
  3. Start video recording   ← ffmpeg captures the desktop
  4. Wait for Claude Code    ← watches left pane for ready prompt
  5. Type "/rtl2gds"         ← types into Claude Code's input
  6. Watch Claude work       ← polls both panes every 5s, screenshots every 60s
  7. Answer questions        ← types "yes" when Claude asks
  8. Approve when asked      ← presses prefix+y for pending Tcl
  9. Read the result         ← captures final state of both panes
 10. Collect all logs        ← pane dumps, MCP log, EDA logs, Tcl history
 11. Build timeline          ← correlates video ↔ panes ↔ MCP ↔ logs
 12. Score the outcome       ← L1-L5 based on what's visible on screen
```

## What HiTestBot NEVER Does

- Never calls MCP tools directly
- Never sends commands to the EDA pane
- Never reads MCP logs during the test
- Never bypasses any part of HiPilot

If HiTestBot can't do it, a human can't do it. If a human would hit a bug, HiTestBot hits the same bug.

## Quick Start

```bash
# On EDA server:
cd /home/EDA/hipilot/current
node src/hitestbot/tests/FlowCertificationTest.js /rtl2gds

# From dev machine (via SSH):
bin/hitestbot-eda /rtl2gds
bin/hitestbot-pull    # download evidence
```

## 5-Layer Scoring

HiTestBot judges the result the way a human would — by reading the screen:

| Layer | What a Human Checks | How HiTestBot Checks |
|-------|--------------------|--------------------|
| L1 Prompt Delivery | Did Claude respond? | Left pane output changed after typing |
| L2 Intent Recognition | Did Claude understand the task? | Left pane mentions rtl2gds/design/flow keywords |
| L3 Tool Usage | Did Claude use MCP tools? | Left pane shows tool calls, right pane has activity |
| L4 EDA Execution | Did the EDA tool run? | Right pane has output, no error patterns |
| L5 QoR Assessment | Did Claude report results? | Left pane contains WNS/TNS numbers |

Status: **PASS** (≥4.0) / **PARTIAL** (≥2.0) / **FAIL** (<2.0)

## Failure Classification

| Category | Meaning | Example |
|----------|---------|---------|
| `ENVIRONMENT` | Setup issue | Claude not ready, MCP not connected |
| `AI_BEHAVIOR` | Claude made wrong choice | Used bash instead of MCP |
| `HIPILOT_BUG` | HiPilot code is broken | Template produces bad Tcl |

## Evidence Bundle

```
evidence/20260226_103045/
├── FLOW_REPORT.md                     # Human-readable summary with scores
├── timeline.jsonl                     # Correlated timeline (video ↔ panes ↔ MCP)
├── pane_log.jsonl                     # Both panes captured every 5s with timestamps
├── flow_progress.json                 # Machine-readable scores
├── stage_scorecards.json              # L1-L5 detail
├── observation_points.json            # Key moment snapshots
├── run_log.txt                        # HiTestBot execution log
├── screenshot_workspace_visible.png   # Desktop after launch
├── screenshot_after_type.png          # After typing command
├── screenshot_progress_*.png          # Every 60s during flow
├── screenshot_flow_done.png           # Final state
├── recordings/
│   └── test_recording.mp4            # Full desktop video (display :0)
├── logs/
│   ├── claude_full.log               # Left pane complete scrollback
│   ├── eda_full.log                  # Right pane complete scrollback
│   ├── mcp_calls.jsonl               # Every MCP tool call (post-test collection)
│   ├── eda_innovus_*.log             # EDA tool's own log files
│   └── history_*.tcl                 # Every Tcl sent to EDA tool
├── obs_before_command_claude.log
├── obs_before_command_eda.log
├── obs_after_flow_claude.log
└── obs_after_flow_eda.log
```

## Architecture

```
src/hitestbot/
├── core/
│   ├── FlowCertifier.js       # The virtual human (launch → type → watch → score)
│   ├── ObservationPoint.js     # Capture pane state at a moment
│   ├── FlowReporter.js         # Generate FLOW_REPORT.md
│   └── ProgressTracker.js      # Cross-run improvement tracking
│
├── infra/
│   ├── deploy_hipilot.js       # Deploy HiPilot to EDA server
│   ├── TmuxController.js       # Tmux operations helper
│   └── ...
│
└── tests/
    ├── FlowCertificationTest.js # Main test (uses HiPilot like a human)
    └── McpInfraTest.js          # MCP infrastructure check (standalone)
```
