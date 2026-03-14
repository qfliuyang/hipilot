# Changelog

All notable changes to HiPilot will be documented in this file.

## [0.6.0-dev] - 2026-02-25

### Added — v0.6.0 Infrastructure (Phases 1-4)
- **System prompt & MCP config** (Phase 1) — `.claude/settings.json` with MCP server registration; `CLAUDE.md` operating instructions with 6 rules for AI behavior
- **MCP call logging** (Phase 2) — `src/lib/mcp-logger.js` with `HIPILOT_TEST_LOG` env var; all 3 servers log tool calls to JSONL with zero overhead when disabled
- **`eda.execute_and_verify`** (Phase 3) — Single MCP call that sends Tcl, waits for EDA prompt, detects errors/warnings, extracts QoR. Replaces fragile 4-step pattern.
- **Real `workflow.run`** (Phase 4) — Sequential step execution with error handling (`stop`/`skip`), QoR tracking per step, structured progress reports. Built-in workflows: `fix_setup_timing`, `fix_hold_timing`, `run_cts_flow`, `rtl2gds`

### Added — HiTestBot v2
- `core/FlowCertifier.js` — Flow certification orchestrator with 5-layer scoring (L1-L5)
- `core/ObservationPoint.js` — Synchronized multi-view evidence capture
- `core/FlowReporter.js` — FLOW_REPORT.md and flow_progress.json generation
- `core/ProgressTracker.js` — Cross-run improvement tracking and graduation criteria
- `tests/FlowCertificationTest.js` — Main flow certification test
- `tests/McpInfraTest.js` — 12 MCP infrastructure checks
- `RalphLoopCertifier.js` — Iterative test certification with persistence

### Changed
- HiTestBot restructured: `infra/` (v1 preserved), `core/` (v2 new), `tests/`
- 80+ junk files deleted (old scripts, evidence, temp files)

### Stats
- 74 EDA MCP tools, 8 Tmux MCP tools, 17 Knowledge MCP tools
- 34 skills, 22 Tcl templates
- 118 unit tests + 12 MCP infra tests passing

## [0.5.0] - 2026-02-25

### Changed
- **Documentation restructured** — Consolidated ~40 docs into clean hierarchy
- **Testing philosophy** — Added `docs/testing/TESTING_RULES.md`
- **AGENTS.md** — Added Cursor Cloud specific development instructions
- 80+ junk files cleaned up, `archive/` and `docs_latest/` removed

### Added
- 8 new RTL-to-GDS flow skills (synthesis through verification)
- HiTestBot E2E test framework (`src/hitestbot/`) with 12 test files
- TUI dashboard with React/Ink (`src/cli.js`)
- Session management, workflow, QoR tracking, error diagnosis tools

### Stats
- 35 skills, 20 Tcl templates
- 118 unit tests passing

## [0.4.0] - 2026-02-23

### Added
- Complete RTL-to-GDS flow execution on Ibex design
- MCP wrapper script for JSON-RPC testing
- 15 new MCP tools (capture_and_wait, wait_for_prompt, run_skill, etc.)
- Quick commands system (8 slash commands)
- Auto-analysis for EDA reports
- Side-effect warnings for Tcl operations
- Evidence-based output format with trust badges

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
