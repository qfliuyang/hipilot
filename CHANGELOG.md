# Changelog

All notable changes to HiPilot will be documented in this file.

## [0.3.0] - 2026-02-20

### Added
- **Risk-Based Approval System** - 4-level risk categorization for Tcl scripts
  - 🟢 **Safe** - Read-only operations (report_timing, check_*)
  - 🟡 **Moderate** - Design modifications (optDesign, routeDesign)
  - 🟠 **Dangerous** - Destructive operations (remove_*, delete_*)
  - 🔴 **Critical** - Irreversible operations (remove_design -all, exit)
  - Each category requires different confirmation levels

### New MCP Tools (3 added)
- `eda.get_status` - Comprehensive system status (mode, tool, pending Tcl)
- `eda.get_risk_analysis` - Analyze Tcl risk level without executing
- `eda.confirm_dangerous` - Explicit confirmation for dangerous/critical operations

### New Module
- `src/lib/risk-analyzer.js` - Risk analysis engine
  - `analyzeRisk()` - Categorize Tcl by risk level
  - `generateApprovalPrompt()` - Create formatted approval prompt
  - `validateConfirmation()` - Validate user confirmation text

### New Documentation
- `docs/TESTING_GUIDE.md` - Complete E2E testing reference
  - SSH connection with sshpass
  - Code upload workflow
  - Screen recording on display :0
  - Pre-test cleanup procedures
  - Problems encountered and solutions
- `docs/specs/approval-system-spec.md` - Full approval system specification
- `docs/research/MODE_SYSTEM_RESEARCH.md` - Research on mode improvements

### New Claude Commands
- `/hipilot-status` - Check system status before EDA operations
- `/eda-workflow` - Guide for using MCP tools vs Bash commands
- `/eda-approval-protocol` - Documentation for approval flow

### Enhanced
- **eda.send_to_terminal** - Now includes risk analysis in response
- **Approval prompt** - Shows risk level, estimated time, and Tcl preview
- **MCP response format** - Rich metadata for programmatic handling

### Tested
- E2E test on EDA server (CentOS 7) with Claude Code + Innovus
- Approval flow validated: Claude asks → User approves → Tcl executes
- Screen recording workflow documented and tested
- Demo video: `hipilot_e2e_final.mp4` (17 MB)

### Key Findings
- Claude Code uses its own approval UI ("Your choice: y/n/e/view")
- MCP tools available but Claude prefers Bash + tmux for sending
- Simple approval flow works effectively in practice

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
