# HiTestBot - HiPilot E2E Testing Framework

Standardized E2E testing from requirement to evidence. No manual mistakes. No cheating.

## Quick Start

```bash
npm run hitestbot
```

## What HiTestBot Does

1. **Cleanup** - Kills all existing sessions
2. **Video Recording** - Starts ffmpeg with nohup (survives SSH disconnect)
3. **Code Upload** - Uploads HiPilot to EDA server
4. **Dependencies** - Runs npm install
5. **MCP Config** - Updates MCP server paths (preserves API key)
6. **Tmux Setup** - Creates split-pane workspace
7. **Innovus** - Starts Innovus in right pane
8. **Terminal** - Opens windowed gnome-terminal
9. **Claude Code** - Starts Claude Code in left pane
10. **HiPilot Test** - Sends "list all HiPilot skills" with C-m
11. **EDA Test** - Executes Innovus commands
12. **Evidence** - Captures screenshots and logs
13. **Download** - Downloads all evidence
14. **Report** - Generates HITESTBOT_REPORT.md

## Key Features

### Uses C-m (Ctrl+M) for Claude Code

```javascript
// CORRECT - HiTestBot uses C-m
await tmux.sendKeys('hipilot:0.0', 'list all HiPilot skills', true, 'C-m');

// WRONG - Don't use Enter for Claude Code
await tmux.sendKeys('hipilot:0.0', 'list all HiPilot skills', true, 'Enter');
```

### Windowed Terminal

Terminal is opened centered on desktop (not fullscreen):
- Geometry: 160x45
- Position: +560+419 (centered on 2560x1558)
- Desktop visible around window (prevents cheating)

### Reliable Video Recording

Uses `nohup` with stdin redirected to `/dev/null`:
```bash
nohup ffmpeg -f x11grab ... < /dev/null > /tmp/ffmpeg.log 2>&1 &
```

This ensures recording continues even if SSH disconnects.

## Evidence Structure

```
e2e_evidence/YYYYMMDD_HHMMSS/
├── *.mp4          Video recording (full desktop)
├── *.png          Screenshots
├── *_pane.log     Tmux pane captures
└── HITESTBOT_REPORT.md  Test report
```

## Architecture

```
HiTestBot
├── E2ETestRunner.js    # Main orchestrator
├── TmuxController.js   # Standardized tmux ops
├── VideoRecorder.js    # Reliable ffmpeg recording
├── TestReporter.js     # Report generation
└── index.js            # CLI entry
```

## Requirements

- EDA server access (EDA@192.168.112.163)
- sshpass for non-interactive SSH
- Valid API key in ~/.claude/settings.json

## No Manual Mistakes

HiTestBot avoids common errors:
- ✅ Uses C-m for Claude Code commands
- ✅ Uses nohup for video recording
- ✅ Opens windowed terminal (not fullscreen)
- ✅ Preserves API key when updating MCP config
- ✅ Waits appropriate times for initialization
- ✅ Captures evidence systematically

---
*Part of HiPilot v0.2.1*
