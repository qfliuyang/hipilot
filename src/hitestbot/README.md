# HiTestBot — Tests HiPilot By Using It Like a Human

HiTestBot is a Node.js program that tests HiPilot the same way a human engineer would use it. It opens a terminal, launches HiPilot, types commands, watches Claude Code work, approves when asked, answers questions, and judges the result by reading what appeared on screen.

**Why this design:** If HiTestBot called MCP tools directly or sent commands to the EDA pane, it would bypass HiPilot's code and miss bugs that a real human would encounter. HiTestBot must use HiPilot as a black box — the only interface is the keyboard and the screen.

## What HiTestBot Does (Step by Step)

```
 1. Kill old tmux session           ← clean start, like opening a fresh terminal
 2. Run bin/hipilot --no-terminal   ← creates the tmux workspace (two panes)
 3. Open gnome-terminal on display :0 ← workspace appears on the EDA server's desktop
 4. Start ffmpeg recording          ← records the desktop video (what a human would see)
 5. Wait for Claude Code to be ready ← polls left pane for the input prompt
 6. Type "/synthesis"               ← sends keystrokes to Claude Code's input
 7. Watch both panes every 5 seconds:
    - If Claude is working (left pane changing) → keep watching
    - If EDA tool is busy (right pane changing, left idle) → keep watching (patient)
    - If Claude asks a question → type "yes"
    - If manual mode approval needed → press prefix+y (Ctrl+B then y)
    - If fatal error detected → abort early
    - If Claude's input prompt reappears → done
 8. Take screenshots at key moments
 9. Stop video recording
10. Collect all logs (post-test, not during):
    - Full scrollback from both panes (10000 lines each)
    - MCP call log (written by HiPilot's servers during the test)
    - EDA tool log files (innovus.log, etc.)
    - Tcl execution history
11. Build correlated timeline (timeline.jsonl)
    - Every entry has a timestamp and video offset
    - You can find any MCP call → see what was on screen at that moment
12. Score L1-L5 by reading the screen (not internal logs)
```

## What HiTestBot NEVER Does

- **Never calls MCP tools.** It does not import any MCP server code or send JSON-RPC requests.
- **Never sends commands to the right pane.** Only Claude Code controls the EDA tool.
- **Never reads MCP logs during the test.** It collects them AFTER the test as evidence.
- **Never bypasses `bin/hipilot`.** It launches HiPilot the same way a human would.

## Scoring

HiTestBot scores by reading what's visible on screen — the same evidence a human would have:

| Layer | Question | How HiTestBot checks |
|---|---|---|
| L1 | Did Claude respond at all? | Left pane text changed after typing the command |
| L2 | Did Claude understand the task? | Left pane mentions keywords: rtl2gds, design, innovus, flow |
| L3 | Did Claude use MCP tools (not bash)? | Left pane shows MCP tool names; right pane has EDA activity |
| L4 | Did the EDA tool run without errors? | Right pane has output, no `**ERROR`/`FATAL` patterns |
| L5 | Did Claude report timing results? | Left pane contains WNS and TNS numbers |

**Total: 0-5 points.** PASS ≥ 4.0 / PARTIAL ≥ 2.0 / FAIL < 2.0

## Failure Classification

When a test fails, HiTestBot classifies why:

| Category | What it means | Example |
|---|---|---|
| `ENVIRONMENT` | Something is broken in the setup | Claude Code not running, MCP servers not connected |
| `AI_BEHAVIOR` | Claude made a wrong decision | Used bash instead of MCP, didn't follow the skill |
| `HIPILOT_BUG` | HiPilot's code produced wrong output | Template generated bad Tcl, MCP tool returned error |

## Evidence Bundle

Every test produces a self-contained evidence directory:

```
/tmp/hipilot-test-evidence/20260226_103045/
├── FLOW_REPORT.md                     # Summary with scores and recommendations
├── timeline.jsonl                     # All events with video timestamps
├── pane_log.jsonl                     # Both panes captured every 5 seconds
├── flow_progress.json                 # Machine-readable scores
├── stage_scorecards.json              # L1-L5 detail per stage
├── run_log.txt                        # HiTestBot's own log (what it did and why)
├── screenshot_workspace_visible.png   # Desktop after HiPilot launches
├── screenshot_after_type.png          # After typing the command
├── screenshot_progress_*.png          # Every 60 seconds during the flow
├── screenshot_flow_done.png           # Final state
├── recordings/
│   └── test_recording.mp4            # Full desktop video from display :0
├── logs/
│   ├── claude_full.log               # Left pane complete scrollback (10000 lines)
│   ├── eda_full.log                  # Right pane complete scrollback (10000 lines)
│   ├── mcp_calls.jsonl               # Every MCP tool call (post-test collection)
│   ├── eda_innovus_*.log             # EDA tool's own log files
│   └── history_*.tcl                 # Every Tcl command HiPilot sent to the EDA tool
├── obs_before_command_claude.log      # Left pane snapshot before typing
├── obs_before_command_eda.log         # Right pane snapshot before typing
├── obs_after_flow_claude.log          # Left pane snapshot after flow completes
└── obs_after_flow_eda.log             # Right pane snapshot after flow completes
```

## How to Run

On the EDA server directly:
```bash
cd /home/EDA/hipilot/current
node src/hitestbot/tests/FlowCertificationTest.js /synthesis
```

From your dev machine via SSH:
```bash
bin/hitestbot-eda /synthesis      # runs test on EDA server
bin/hitestbot-pull               # downloads evidence to your machine
```

## Code Structure

```
src/hitestbot/
├── core/
│   ├── FlowCertifier.js       # The virtual human — launches, types, watches, records, scores
│   ├── ObservationPoint.js     # Captures pane text + screenshot at one moment
│   ├── FlowReporter.js        # Generates FLOW_REPORT.md from scores
│   └── ProgressTracker.js      # Tracks improvement across multiple test runs
├── infra/
│   └── deploy_hipilot.js       # Deploys HiPilot to EDA server (tarball with node_modules)
└── tests/
    ├── FlowCertificationTest.js # Entry point — creates FlowCertifier and runs it
    └── McpInfraTest.js          # Standalone MCP server infrastructure check (no HiPilot needed)
```

That's it. 7 files. No legacy code, no unused infrastructure.
