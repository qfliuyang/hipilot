# Changelog

All notable changes to HiPilot will be documented in this file.

## [0.2.1] - 2026-02-20

### Added
- **Mode System ("Claude Has the Conn")** - Two-mode safety system for Tcl execution
  - 🔒 **MANUAL mode** (default) - Each Tcl command requires user approval via `prefix+y`
  - ⚡ **AUTO mode** ("Claude has the conn") - Commands execute immediately
  - Mode state persisted in `/tmp/hipilot_mode`
  - Pending Tcl queued in `/tmp/hipilot_pending.tcl`

### New MCP Tools (6 added)
- `eda.get_mode` - Get current execution mode
- `eda.set_mode` - Set manual/auto mode
- `eda.toggle_mode` - Toggle between modes
- `eda.get_pending` - Get pending Tcl waiting for approval
- `eda.approve_pending` - Approve and execute pending Tcl
- `eda.reject_pending` - Reject pending Tcl
- `tmux.set_mode_status` - Update status bar with current mode

### New Module
- `src/lib/mode.js` - Mode state management library
  - `getMode()`, `setMode()`, `toggleMode()`
  - `queuePending()`, `getPending()`, `approvePending()`, `rejectPending()`
  - `getModeStatus()` for display

### Enhanced
- **Status Bar** - Now shows mode indicator:
  - MANUAL: `⚙ HiPilot │ 🔒 MANUAL` (yellow)
  - AUTO: `⚡ CLAUDE HAS CONN` (green background)
  - Pending: Adds `⏳` indicator when Tcl is queued

### Keyboard Shortcuts
- `Ctrl+M` - Toggle mode (manual ↔ auto)
- `prefix+y` - Approve pending Tcl
- `prefix+n` - Reject pending Tcl
- `prefix+M` - Show mode status

### Tested
- Deployed and tested on EDA server (CentOS 7)
- Verified with Claude Code + Innovus running in tmux 50/50 split
- Recording available: `recordings/hipilot_proper_demo.mp4`

## [0.2.0] - 2026-02-19

### Added
- 3 MCP Servers (EDA, Tmux, Knowledge) with 19 tools total
- 10 skills for common EDA workflows
- 20 Tcl templates (10 Synopsys + 10 Cadence)
- 6 slash commands (/timing, /drc, /power, /area, /compare, /history)
- 50/50 tmux split layout with status bar
- Test stand for automated E2E testing
- Screen recording infrastructure

### Verified
- AI + EDA feedback loop via tmux (proven working Feb 19, 2026)
- Claude Code autonomously fixed Tcl template error from Innovus feedback
