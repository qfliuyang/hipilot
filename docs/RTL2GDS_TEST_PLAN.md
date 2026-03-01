# HiPilot RTL2GDS Test Plan

> Progressive testing strategy using HiTestBot to achieve full RTL-to-GDS flow execution

## Overview

This test plan uses HiTestBot (virtual human testing) to progressively validate HiPilot's capabilities, exposing and fixing issues along the way until the full RTL2GDS flow can be executed successfully.

## Test Philosophy

1. **Progressive Complexity**: Start with infrastructure, build to full flow
2. **Evidence-Based**: Every test produces screenshots, logs, and L1-L5 scores
3. **Visual Verification**: HiPilot's UI (two-pane layout, status bar, TUI) must be visible in screenshots
4. **Download and Review**: All evidence automatically downloaded to dev machine for human review
5. **Fix-Forward**: Exposed issues are fixed before proceeding to next phase
6. **Black-Box Testing**: HiTestBot uses HiPilot exactly as a human would
7. **No False Evidence**: All evidence must be real - screenshots from X11, logs from actual execution
8. **Evidence Integrity**: Check file creation dates to verify evidence is fresh from current test

---

## HiPilot Visual Components to Verify

HiPilot has several UI components that must be visible in test screenshots:

### 1. Two-Pane Tmux Layout
```
┌─ Left Pane (50%) ──────────┬─ Right Pane (50%) ─────────┐
│                            │                            │
│  Claude Code               │  EDA Tool Terminal         │
│  (claude --dangerously-    │  (innovus/icc2_shell/      │
│   skip-permissions)        │   pt_shell)                │
│                            │                            │
│  User types here           │  HiPilot sends Tcl here    │
│                            │                            │
├────────────────────────────┴────────────────────────────┤
│ Status Bar: Mode │ Tool │ Job │ Design │ WNS │ TNS      │
└─────────────────────────────────────────────────────────┘
```

### 2. Status Bar Elements
| Element | Description |
|---------|-------------|
| **Tool** | Current EDA tool name |
| **Job** | `▶ idle` / `▶ Running` |
| **Design** | Design name or `—` |
| **QoR** | WNS/TNS values |

### 3. TUI Components (React/Ink)
When `hipilot status` or `hipilot skills` is run:
- **Dashboard**: Shows active tool, job status
- **Skills list**: 36 skills with descriptions
- **Templates list**: 22 templates with trust badges
- **QoR panel**: Current timing/power metrics

### 4. Window Size Requirement (4x Larger)
HiPilot workspace is sized at **95% of screen** (was 2/3) for better visibility:
- Window dimensions: ~95% of desktop resolution
- Centered with small margin for visual context
- Ensures UI elements are clearly visible in screenshots and video

**Implementation**: HiTestBot `_openTerminalOnDesktop()` uses `wmctrl` to resize after opening.

### 5. What Screenshots Must Show
Every test phase must capture:
- [ ] **Initial state**: Clean two-pane layout after launch (95% window size)
- [ ] **Command input**: Text being typed in left pane
- [ ] **EDA activity**: Tool output in right pane
- [ ] **Final state**: Completed workflow, final status

---

## Critical Issues Found & Fixed

### Issue 1: Claude Code Trust Prompt Blocks Startup (FIXED)
**Problem**: `--dangerously-skip-permissions` flag doesn't bypass the "Quick safety check" trust prompt in newer Claude Code versions.

**Symptom**: HiTestBot types commands but Claude doesn't process them because it's waiting for "1. Yes, I trust this folder" confirmation.

**Solution**: Updated `bin/hipilot` to poll for the trust prompt and auto-send "1" + Enter:
```bash
# Poll for up to 30 seconds until trust prompt appears
for i in $(seq 1 60); do
  sleep 0.5
  if tmux capture-pane shows "Quick safety check"; then
    send-keys "1" + Enter
    break
  fi
  if tmux capture-pane shows "Welcome back"; then
    break  # Already acknowledged
  fi
done
```

**Verification**: Claude Code now starts without manual intervention.

---

### Issue 2: MCP Servers Missing node_modules (FIXED)
**Problem**: Deployed HiPilot is missing `node_modules` in MCP server directories.

**Symptom**: MCP servers fail to start with `ERR_MODULE_NOT_FOUND` for `@modelcontextprotocol/sdk`.

**Solution**: Copy `node_modules` from backup `_old` directory to `current/` and all `servers/*/`:
```bash
cp -r /home/EDA/hipilot/_old/node_modules /home/EDA/hipilot/current/
for d in servers/*; do cp -r node_modules "$d/"; done
```

**Verification**: All 3 MCP servers respond to `tools/list` JSON-RPC requests.

---

### Issue 3: settings.json Blocks MCP Servers (FIXED)
**Problem**: `~/.claude/settings.json` has `permissions.deny` rules that block Bash(tmux *), preventing MCP servers from functioning.

**Solution**: Removed Bash-related deny rules, keeping only EDA tool restrictions:
```json
"deny": [
  "Bash(*innovus*)", "Bash(*icc2_shell*)", ...
  // REMOVED: "Bash(tmux *)", "Bash(*send-keys*)", "Bash(*capture-pane*)",
  // REMOVED: "Bash(source *)"
]
```

**Note**: The MCP servers internally use tmux commands, so these restrictions broke HiPilot entirely.

---

### Issue 4: Claude Code Not Loading MCP Servers (OPEN)
**Problem**: Even with fixed settings.json and working MCP servers, Claude Code shows "MCP not available via bash" and doesn't use MCP tools.

**Current Status**: Under investigation. Possible causes:
- Claude Code may need restart to pick up MCP config changes
- Settings.json format may need adjustment
- May need to check Claude Code's MCP initialization logs

---

## Pre-Test Setup (Required Before Each Phase)

### Test Environment Isolation

Each test run must have a **unique, isolated environment** to prevent interference and enable tracking:

```bash
# Generate unique test ID
export TEST_ID="hipilot_$(date +%Y%m%d_%H%M%S)_phase${PHASE_NUM}"
export TEST_PURPOSE="${PHASE_NAME}"  # e.g., "infrastructure", "eda_launch"

# Unique paths for this test
export TEST_WORK_DIR="/home/EDA/hipilot_test/runs/${TEST_ID}"
export TEST_EVIDENCE_DIR="/tmp/hipilot-test-evidence/${TEST_ID}"
export TEST_TMUX_SESSION="${TEST_ID}"
export TEST_LOG="${TEST_WORK_DIR}/test.log"
```

### Directory Structure per Test

```
/home/EDA/hipilot_test/runs/
└── hipilot_20260226_143022_phase0_infrastructure/   # Unique test directory
    ├── test.log                                     # Test execution log
    ├── test_metadata.json                           # Test config & purpose
    ├── design/                                      # Isolated design copy
    │   └── ibex/                                    # Ibex design for this test
    ├── hipilot/                                     # HiPilot installation
    │   ├── bin/
    │   ├── servers/
    │   └── ...
    └── output/                                      # EDA tool outputs
        ├── innovus.log
        ├── reports/
        └── gds/

/tmp/hipilot-test-evidence/
└── hipilot_20260226_143022_phase0_infrastructure/   # Isolated evidence
    ├── video.mp4
    ├── screenshots/
    ├── mcp_calls.jsonl
    └── FLOW_REPORT.md
```

### Test Metadata File

Each test creates a metadata file for tracking:

```json
{
  "test_id": "hipilot_20260226_143022_phase0",
  "timestamp": "2026-02-26T14:30:22Z",
  "phase": 0,
  "phase_name": "infrastructure_verification",
  "purpose": "Verify HiTestBot and HiPilot infrastructure",
  "test_work_dir": "/home/EDA/hipilot_test/runs/hipilot_20260226_143022_phase0",
  "tmux_session": "hipilot_20260226_143022_phase0",
  "evidence_dir": "/tmp/hipilot-test-evidence/hipilot_20260226_143022_phase0",
  "design_dir": "/home/EDA/hipilot_test/runs/hipilot_20260226_143022_phase0/design/ibex",
  "hipilot_version": "v0.2.1",
  "git_commit": "abc123",
  "status": "running",
  "started_at": "2026-02-26T14:30:22Z",
  "completed_at": null,
  "result": null
}
```

### Environment Variables for Test Isolation

```bash
# Must be exported to all processes
export HIPILOT_SESSION="${TEST_ID}"        # Unique tmux session
export HIPILOT_WORK_DIR="${TEST_WORK_DIR}" # Working directory
export HIPILOT_EVIDENCE_DIR="${TEST_EVIDENCE_DIR}"
export HIPILOT_TEST_LOG="${TEST_EVIDENCE_DIR}/mcp_calls.jsonl"

# HiPilot uses these env vars internally
export HIPILOT_TMPDIR="${TEST_WORK_DIR}/tmp"
```

---

### 1. Kill All Remaining Processes (CRITICAL - UPDATED)
Stale processes cause test failures and false results. Must clean thoroughly **before EVERY test**:

```bash
# Kill ALL EDA tools (prevent database lock issues)
pkill -9 -f "innovus" 2>/dev/null || true
pkill -9 -f "icc2_shell" 2>/dev/null || true
pkill -9 -f "pt_shell" 2>/dev/null || true
pkill -9 -f "dc_shell" 2>/dev/null || true
pkill -9 -f "tempus" 2>/dev/null || true
pkill -9 -f "genus" 2>/dev/null || true
pkill -9 -f "voltus" 2>/dev/null || true

# Kill Claude Code and related processes
pkill -9 -f "claude" 2>/dev/null || true
pkill -9 -f "claude-code" 2>/dev/null || true

# Kill all tmux sessions (both named socket and default)
tmux -L hipilot kill-server 2>/dev/null || true
tmux kill-server 2>/dev/null || true
pkill -9 -f "tmux.*hipilot" 2>/dev/null || true

# Kill video recording
pkill -9 -f "ffmpeg.*x11grab" 2>/dev/null || true
pkill -9 -f "ffmpeg.*hipilot" 2>/dev/null || true

# Kill lingering MCP server node processes
pkill -9 -f "node.*hipilot.*server" 2>/dev/null || true

sleep 2

# Verify nothing remains - CRITICAL CHECK
ps aux | grep -E "(innovus|icc2_shell|pt_shell|claude|ffmpeg|tmux)" | grep -v grep
# ^^ Should return NOTHING. If processes remain, test may fail.
```

**Automated in HiTestBot**: `_cleanStaleProcesses()` now includes all these kills.

### 2. Clean Temp Directories and Files

```bash
# Clean temp directories
rm -rf /tmp/hipilot-$(whoami)/
rm -rf /tmp/hipilot-test-evidence/
rm -f /tmp/hipilot_*.log
rm -f /tmp/tmux-$(id - u)/hipilot

# Remove old HiPilot installation (keep backup)
if [ -d /home/EDA/hipilot/current ]; then
    mv /home/EDA/hipilot/current /home/EDA/hipilot/current.bak.$(date +%s)
fi
```

### 3. Deploy Tools Only (Not Entire Code)
Deploy only the minimal required components:
- `servers/` - MCP servers (eda, tmux, knowledge)
- `skills/` - Workflow documentation
- `templates/` - Tcl templates
- `bin/hipilot` - Launcher script
- `src/lib/` - Shared libraries
- `deploy/eda-server/` - Runtime configuration

Exclude from deployment:
- `test/` - Unit tests (run on dev machine)
- `docs/` - Documentation
- `src/hitestbot/` - Testing tool (runs on dev machine)

### 4. EDA Server Connection (Retry Until Success)
**CRITICAL**: SSH connection to EDA server is unreliable. Must use retry logic.

**Working approach** (use SSHPASS environment variable):
```bash
# Set password as environment variable (more reliable than command line)
export SSHPASS='eda2020'

# Retry with exponential backoff
for i in 1 2 3 4 5; do
    sshpass -e ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no \
        EDA@192.168.112.163 'echo connected' && break
    echo "Attempt $i failed, retrying..."
    sleep $((i * 5))
done
```

**Why this matters**: SSH fails intermittently. All remote commands must use retry logic.

**Required**: Verify connection before proceeding with deployment.

### 5. Test Design Setup (Ibex Reference)
Use the reference Ibex RISC-V design:

**Source**: `/home/EDA/ibex_work_upload/` (verified location)
**Test Copy**: Create fresh copy for each test run:
```bash
# On EDA server
TEST_DESIGN="/home/EDA/hipilot_test/runs/${TEST_ID}/design/ibex"
mkdir -p "/home/EDA/hipilot_test/runs/${TEST_ID}/design"
cp -r /home/EDA/ibex_work_upload "$TEST_DESIGN"
echo "Test design copied to: $TEST_DESIGN"
```

Verify design contents:
- RTL files: `designs/src/ibex/ibex_core.sv`
- Constraints: `designs/sky130hd/ibex/constraint.sdc`
- Config: `designs/sky130hd/ibex/config.mk`
- Library files (Skywater 130nm)
- ~7000 cells expected

### 6. HiTestBot Only Testing - STRICT RULES

**CRITICAL**: All tests MUST be performed by HiTestBot following these strict rules:

#### ✅ What HiTestBot CAN Do (Virtual Human Behavior)
- Launch HiPilot (`bin/hipilot`)
- Type commands in **left pane only** (Claude Code)
- Read both panes (capture-pane)
- Observe execution results
- Collect evidence (screenshots, logs, video)

#### Claude Code on EDA Server - MCP ONLY

**CRITICAL**: Claude Code in the left pane must **ONLY use MCP tools**, never bash:

| Allowed | NOT Allowed |
|---------|-------------|
| `mcp__hipilot-eda__eda.generate_tcl` | `bash` tool to run EDA commands |
| `mcp__hipilot-tmux__tmux.send_keys` | `bash` tool to check tool status |
| `mcp__hipilot-eda__eda.execute_and_verify` | `bash` tool to parse reports |
| `mcp__hipilot-knowledge__knowledge.get_skill` | `bash` tool for file operations |

**Why**: HiPilot is architected around MCP servers. Using bash bypasses:
- Risk analysis and approval workflow
- QoR extraction and caching
- Error diagnosis
- Trust badge system
- Evidence logging

**Detection**: Check MCP call logs - if you see `bash` tool calls instead of `mcp__hipilot-*` calls, HiPilot is not being used correctly.

#### ❌ What HiTestBot MUST NEVER Do (Anti-Cheat)
- **NEVER send commands to right pane (EDA pane)**
- **NEVER send `puts`, `echo`, or any Tcl to EDA pane directly**
- **NEVER start EDA tools directly via tmux** (only via Claude Code in left pane)
- **NEVER call MCP tools directly** (only Claude uses MCP)
- **NEVER fabricate evidence**

#### tmux send-keys Best Practices

**CRITICAL**: When HiTestBot sends commands to tmux, it must handle Enter correctly:

```bash
# WRONG: "Enter" becomes literal text
send-keys -t target -l "hello Enter"   # Types "hello Enter" literally

# CORRECT: Send text literally, then send Enter separately
send-keys -t target -l "hello"         # Types "hello" literally
send-keys -t target C-m                 # Presses Enter key
```

**Implementation** (in servers/tmux/index.js):
1. Text sent with `-l` flag (literal, safe from shell injection)
2. Enter/C-m stripped from text body
3. `C-m` sent unquoted as separate command for actual keypress

**Verification**: If commands appear to not execute, check screenshots - literal "Enter" text visible means the key wasn't sent correctly.

#### Correct Flow
```
┌─ Left Pane (Chat) ────────┬─ Right Pane (EDA) ────────┐
│                           │                           │
│  Human: "start innovus"   │                           │
│       ↓                   │                           │
│  Claude Code              │                           │
│       ↓                   │       ┌─────────────────┐ │
│  MCP: tmux.send_keys ─────┼──────→│ innovus         │ │
│                           │       │ innovus 1>      │ │
│       ↓                   │       └─────────────────┘ │
│  HiTestBot observes       │                           │
│  (capture-pane)           │                           │
└───────────────────────────┴───────────────────────────┘
```

**Key Principle**: HiTestBot is a VIRTUAL HUMAN. It can only do what a human can do:
- Type in left pane (Chat with Claude)
- Read both panes (observe what's on screen)
- Observe pane content and execution results

**A human cannot** send commands directly to the EDA pane - neither can HiTestBot.

**Only Claude Code** can send commands to the EDA pane via MCP tools (`tmux.send_keys` to right pane).

---

## Phase 0: Infrastructure Verification

**Goal**: Verify HiTestBot and HiPilot infrastructure works

### Tests
1. **MCP Infrastructure Test** (McpInfraTest.js)
   - Verify all 3 MCP servers respond to tool/list
   - Check JSON-RPC communication

2. **Basic Workspace Launch**
   - Run `bin/hipilot --no-terminal`
   - Verify tmux session created with `-L hipilot`
   - Confirm 50/50 split layout

3. **Claude Code Readiness**
   - Poll left pane until prompt detected
   - Timeout: 120 seconds

4. **Simple Command**
   - Type "hello" or basic query
   - Verify Claude responds

### Success Criteria
- [ ] All MCP servers return tool lists
- [ ] tmux session `hipilot` exists
- [ ] Claude prompt detected within timeout
- [ ] Response appears in left pane

### Evidence
- screenshots at each stage
- mcp_calls.jsonl
- both pane logs

### Exit Criteria
**PASS**: All tests succeed → Proceed to Phase 1
**FAIL**: Fix infrastructure issues before proceeding

---

## Phase 1: Basic EDA Tool Launch

**Goal**: HiPilot can launch and interact with EDA tools

### Anti-Cheat Reminder
HiTestBot types commands in **left pane only**. Claude Code uses MCP tools to start EDA tools and send commands. HiTestBot never sends commands directly to the EDA pane.

### Tests
1. **Launch Innovus**
   - HiTestBot types in left pane: "start innovus"
   - Claude Code calls MCP to launch innovus in right pane
   - Verify `innovus 1>` prompt appears in right pane

2. **Launch ICC2**
   - HiTestBot types in left pane: "switch to ICC2"
   - Claude Code launches ICC2 in right pane
   - Verify `icc2_shell>` prompt appears

3. **Tool Detection**
   - Verify `eda.detect_tool` returns correct tool/version

4. **Simple Tcl Execution**
   - HiTestBot types in left pane: "report design status"
   - Claude Code generates and sends Tcl to EDA pane
   - Verify command executes, output appears

### Success Criteria
- [ ] EDA tool prompt appears in right pane
- [ ] Tool correctly detected
- [ ] Simple command executes without error

### Evidence
- screenshot of both panes showing tool running
- pane logs showing tool startup
- MCP call log showing successful execution

### Exit Criteria
**PASS**: Both tools launch successfully → Proceed to Phase 2
**FAIL**: Debug tool launch mechanism

---

## Phase 2: Tcl Generation

**Goal**: Tcl generation works with trust badges

### Tests
1. **Tcl Generation (Template)**
   - Prompt: "/timing" or "generate timing report"
   - Verify `[✓ Template]` badge appears

2. **Trust Badges**
   - Test template → `[✓ Template]`
   - Test unknown command → `[⚠ Unverified]`

3. **Tcl Execution**
   - Commands execute immediately in EDA pane
   - Verify output appears in right pane

### Success Criteria
- [ ] Tcl generates with proper badge
- [ ] Commands execute in EDA pane
- [ ] Output visible in right pane

### Evidence
- screenshot showing Tcl generation
- EDA output showing command executed

### Exit Criteria
**PASS**: Tcl generation works → Proceed to Phase 3
**FAIL**: Fix Tcl generation

---

## Phase 3: QoR Extraction and Reporting

**Goal**: HiPilot extracts and reports QoR metrics correctly

### Tests
1. **Timing Report Extraction**
   - Run setup timing report
   - Verify WNS/TNS extracted from output

2. **Claude Reporting**
   - Verify QoR appears in left pane
   - Check natural language summary

3. **Status Bar Update**
   - Verify WNS value appears in status bar

4. **Violation Analysis**
   - Introduce timing violation (if possible)
   - Verify violations identified and counted

### Success Criteria
- [ ] WNS/TNS extracted from EDA output
- [ ] QoR reported in left pane
- [ ] Status bar shows WNS
- [ ] Violations correctly identified

### Evidence
- screenshot showing QoR in left pane
- MCP log showing extracted metrics
- status bar capture

### Exit Criteria
**PASS**: QoR extraction works → Proceed to Phase 4
**FAIL**: Fix report parsing/extraction

---

## Phase 4: Skill System and Templates

**Goal**: Skill/template system guides workflows

### Tests
1. **Skill Matching**
   - Prompt: "fix setup timing violations"
   - Verify correct skill matched (fix-setup-timing)

2. **Template Generation**
   - Verify `[✓ Template]` badge
   - Check vendor-specific Tcl generated

3. **Multi-Step Workflow**
   - Follow skill steps
   - Verify each step completes before next

4. **Knowledge Queries**
   - Test command reference lookup
   - Test documentation search

### Success Criteria
- [ ] Correct skill matched
- [ ] Template Tcl generated
- [ ] Multi-step workflow progresses
- [ ] Knowledge tools respond

### Evidence
- skill content retrieved
- template Tcl generated
- step-by-step execution logs

### Exit Criteria
**PASS**: Skill system works → Proceed to Phase 5
**FAIL**: Fix skill/template loading

---

## Phase 5: Multi-Stage Flow (Synthesis to Placement)

**Goal**: Execute partial flow successfully

### Tests
Execute stages: Synthesis → Floorplan → Placement

1. **Synthesis** (if starting from RTL)
   - Run synthesis
   - Verify completion, report QoR

2. **Floorplan**
   - Initialize floorplan
   - Verify floorplan created

3. **Placement**
   - Run placement
   - Verify placed design

4. **Timing Analysis**
   - Post-placement timing
   - Verify QoR trends

### Success Criteria
- [ ] Each stage completes
- [ ] QoR reported after each stage
- [ ] Stage transitions work
- [ ] No fatal errors

### Evidence
- L1-L5 scores for each stage
- QoR trends across stages
- screenshots at stage boundaries

### Exit Criteria
**PASS**: Multi-stage works → Proceed to Phase 6
**FAIL**: Debug stage transitions

---

## Phase 6: Full RTL2GDS Flow (Ibex Design)

**Goal**: Execute complete RTL-to-GDS flow on Ibex RISC-V design

### Test Design
- **Design**: Ibex RISC-V CPU (lowRISC)
- **Technology**: Skywater 130nm
- **Complexity**: ~7000 cells
- **Source**: Fresh copy from `/home/EDA/ibex_work_upload/`
- **Working Dir**: `$TEST_DESIGN` (created in Pre-Test Setup)

### Full Flow Stages
1. **Synthesis** - RTL to gate-level netlist
2. **Floorplan** - Die area, IO, macros
3. **Placement** - Standard cell placement
4. **CTS** - Clock tree synthesis
5. **Routing** - Signal routing
6. **DRC/LVS** - Physical verification
7. **GDS Export** - Final layout

### Command
```
/rtl2gds
```

**Or staged**:
```
/rtl2gds --from synthesis --to gds
```

### Success Criteria
- [ ] All stages complete
- [ ] Final GDS file generated
- [ ] QoR meets targets (or understood)
- [ ] Summary report provided

### Evidence
- Complete timeline.jsonl
- L1-L5 scores for all stages
- Final QoR summary
- Video recording
- GDS file exists

### Exit Criteria
**PASS**: Full flow works → Proceed to Phase 7
**FAIL**: Analyze failures, fix and retry

---

## Phase 7: Error Handling and Recovery

**Goal**: HiPilot handles errors gracefully

### Tests
1. **Tool Crash Recovery**
   - Kill EDA tool mid-flow
   - Verify HiPilot detects crash
   - Check recovery proposal

2. **Command Errors**
   - Execute invalid Tcl
   - Verify error detection
   - Check error reporting

3. **Timeout Handling**
   - Long-running command
   - Verify timeout detection

4. **Recovery**
   - Kill EDA tool mid-flow
   - Verify recovery works

### Success Criteria
- [ ] Errors detected from output
- [ ] Recovery actions proposed
- [ ] Can resume after error
- [ ] Clear error reporting

### Evidence
- error detection logs
- recovery attempts
- resume success/failure

---

## Execution Schedule

| Phase | Duration | Depends On | Parallelizable |
|-------|----------|------------|----------------|
| Phase 0 | 15 min | - | No |
| Phase 1 | 30 min | Phase 0 | No |
| Phase 2 | 30 min | Phase 1 | No |
| Phase 3 | 30 min | Phase 2 | No |
| Phase 4 | 30 min | Phase 3 | No |
| Phase 5 | 2-4 hours | Phase 4 | No |
| Phase 6 | 4-8 hours | Phase 5 | No |
| Phase 7 | 1 hour | Phase 6 | No |

**Total Estimated Time**: 8-14 hours (excluding fix time)

---

## Issue Tracking

| ID | Phase | Description | Severity | Status |
|----|-------|-------------|----------|--------|
| | | | | |

---

## Evidence Collection Checklist

Every phase produces:
- [ ] **Video recording** (ffmpeg) - Full desktop at 10fps
- [ ] **Screenshots** at key moments showing HiPilot UI:
  - [ ] Two-pane layout visible (50/50 split)
  - [ ] Status bar with mode indicator
  - [ ] Left pane: Claude Code interface
  - [ ] Right pane: EDA tool prompt/output
- [ ] **Both pane logs** (claude + eda) - Full scrollback
- [ ] **MCP call logs** (mcp_calls.jsonl)
- [ ] **timeline.jsonl** (correlated events)
- [ ] **FLOW_REPORT.md** (L1-L5 scores)
- [ ] **Downloaded to dev machine** for review

## Evidence Collection and Download

### Automatic Download to Dev Machine

HiTestBot automatically downloads all evidence after each phase using the unique test ID:

```bash
# Pull evidence using test ID
bin/hitestbot-pull --test-id hipilot_20260226_143022_phase0

# Local evidence location (mirrors EDA server structure)
test-evidence/
└── hipilot_20260226_143022_phase0_infrastructure/    # Unique test directory
    ├── test_metadata.json                             # Test config & purpose
    ├── video.mp4                                      # Full test recording
    ├── screenshots/
    │   ├── 00_launch.png                              # HiPilot startup
    │   ├── 01_claude_ready.png
    │   ├── 02_command_typed.png
    │   ├── 03_approval_needed.png
    │   ├── 04_eda_running.png
    │   └── 05_completion.png
    ├── pane_logs/
    │   ├── claude_pane.log                            # Left pane
    │   └── eda_pane.log                               # Right pane
    ├── mcp_calls.jsonl                                # MCP tool calls
    ├── timeline.jsonl                                 # Correlated events
    └── FLOW_REPORT.md                                 # L1-L5 scores

# Create symlink to latest for convenience
ln -sfn hipilot_20260226_143022_phase0_infrastructure test-evidence/latest
```

**Verify download succeeded**:
```bash
# Check evidence directory exists and has content
ls -la test-evidence/hipilot_20260226_143022_phase0_infrastructure/
du -sh test-evidence/hipilot_20260226_143022_phase0_infrastructure/  # > 10MB

# Verify metadata
cat test-evidence/latest/test_metadata.json | jq .
```

---

## Test Registry and Progress Tracking

### Test Registry Location

```
test-evidence/
├── .registry/
│   └── test_registry.jsonl    # Append-only log of all tests
```

### Registry Entry Format

```json
{
  "test_id": "hipilot_20260226_143022_phase0",
  "timestamp": "2026-02-26T14:30:22Z",
  "phase": 0,
  "phase_name": "infrastructure_verification",
  "purpose": "Verify HiTestBot and HiPilot infrastructure",
  "local_path": "test-evidence/hipilot_20260226_143022_phase0",
  "eda_path": "/tmp/hipilot-test-evidence/hipilot_20260226_143022_phase0",
  "status": "completed",
  "result": "PASS",
  "l1_score": 100,
  "l2_score": 100,
  "l3_score": 100,
  "l4_score": null,
  "l5_score": null,
  "duration_seconds": 180,
  "issues_found": [],
  "git_commit": "abc123"
}
```

### Viewing Test Progress

```bash
# List all tests in registry
cat test-evidence/.registry/test_registry.jsonl | jq -s '.[] | {id: .test_id, phase: .phase, result: .result, status: .status}'

# View phase completion status
bin/hitestbot-eda --status

# Expected output:
# Phase 0 (Infrastructure): PASS ✓
# Phase 1 (EDA Tool Launch): PASS ✓
# Phase 2 (Tcl Generation): PASS ✓
# Phase 3 (QoR Extraction): RUNNING ▶
# Phase 4 (Skill System): PENDING ○
# Phase 5 (Multi-Stage Flow): PENDING ○
# Phase 6 (Full RTL2GDS): PENDING ○
# Phase 7 (Error Recovery): PENDING ○
```

### Visual Review Required

Every test must include visual verification of HiPilot's UI:

| Screenshot | What to Verify |
|------------|----------------|
| **Launch** | Two-pane layout (50/50 split), status bar visible |
| **Status Bar** | Tool name, job status, WNS/TNS values |
| **Left Pane** | Claude Code prompt visible, readable text |
| **Right Pane** | EDA tool prompt (e.g., `innovus 1>`), command output |
| **Approval** | Pending indicator (⏳) in status bar, Tcl visible in left pane |
| **TUI** | React/Ink dashboard if `hipilot status` or `hipilot skills` used |

**HiPilot Layout Verification**:
```
┌─ Left Pane (50%) ──────────┬─ Right Pane (50%) ─────────┐
│                            │                            │
│  Claude Code               │  EDA Tool                  │
│  (claude CLI)              │  (innovus/icc2_shell)      │
│                            │                            │
├────────────────────────────┴────────────────────────────┤
│ Status: [Mode] │ [Tool] │ [Job] │ [Design] │ [WNS]     │
└─────────────────────────────────────────────────────────┘
```

## Evidence Verification (Anti-Cheat)

Before accepting any evidence, verify:

### 1. File Creation Dates
All evidence files must have timestamps **after** test start time:
```bash
# Check file creation dates
find test-evidence/ -type f -exec ls -la {} \; | head -20

# Verify files are fresh (not from previous runs)
find test-evidence/ -type f -mmin +120  # Files older than 2 hours = stale
```

### 2. Screenshot Integrity
Screenshots must come from X11 (ImageMagick `import`):
- Use `identify -verbose screenshot.png` to check image properties
- Verify display :0 reference in metadata
- Dimensions should match EDA server display (1920x1080)
- **Visual check**: Open screenshots and verify HiPilot layout is visible

### 3. Video Integrity
Video must be continuous recording:
```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 video.mp4
```
Duration should match test runtime.

### 4. Log Correlation
- MCP call timestamps must align with video timeline
- Pane output must match what EDA tool would produce
- EDA tool log files must exist and contain expected content

### 5. Visual Verification Checklist
For each phase, verify screenshots show:
- [ ] **Two-pane layout** correctly rendered
- [ ] **Status bar** at bottom with tool and QoR
- [ ] **Left pane**: Claude Code interface visible
- [ ] **Right pane**: EDA tool prompt/output visible
- [ ] **No display corruption** or rendering artifacts

### 6. No Fabricated Evidence
**NEVER** create:
- Fake screenshots
- Edited log files
- Synthetic MCP call logs
- Modified timestamps

Evidence integrity is critical. Stale or fabricated evidence invalidates the test.

---

## Success Metrics

| Metric | Target | Phase 0-4 | Phase 5 | Phase 6 |
|--------|--------|-----------|---------|---------|
| L1 (Response) | 100% | Required | Required | Required |
| L2 (Understanding) | >80% | Required | Required | Required |
| L3 (MCP Usage) | >80% | Required | Required | Required |
| L4 (EDA Success) | >70% | N/A | Required | Required |
| L5 (QoR Report) | >60% | N/A | Required | Required |

---

## Running the Tests

### All Tests Via HiTestBot Only with Unique Environment

**NO MANUAL INTERVENTION** - HiTestBot is the sole testing mechanism.

Each test gets a unique timestamped environment:

```bash
# Generate unique test ID
export TEST_ID="hipilot_$(date +%Y%m%d_%H%M%S)_phase0_infrastructure"
export TEST_PHASE=0

# 1. Clean environment (dev machine → EDA server)
ssh EDA@192.168.112.163 "
  # Kill all processes
  pkill -9 -f 'innovus|icc2_shell|pt_shell|claude|ffmpeg' 2>/dev/null || true
  tmux -L hipilot kill-server 2>/dev/null || true

  # Create unique test directory
  mkdir -p /home/EDA/hipilot_test/runs/${TEST_ID}
  mkdir -p /tmp/hipilot-test-evidence/${TEST_ID}

  # Copy Ibex design to isolated location
  cp -r /home/EDA/ibex_work_upload \
        /home/EDA/hipilot_test/runs/${TEST_ID}/design/ibex
"

# 2. Deploy tools to unique location
node src/hitestbot/infra/deploy_hipilot.js \
  --destination /home/EDA/hipilot_test/runs/${TEST_ID}/hipilot \
  --test-id ${TEST_ID}

# 3. Run Phase 0 via HiTestBot with unique session
HIPILOT_SESSION=${TEST_ID} \
HIPILOT_WORK_DIR=/home/EDA/hipilot_test/runs/${TEST_ID} \
  bin/hitestbot-eda \
    --phase 0 \
    --test-id ${TEST_ID} \
    --purpose "infrastructure_verification"

# 4. Pull evidence back using test ID
bin/hitestbot-pull --test-id ${TEST_ID}

# 5. Verify evidence
ls -la test-evidence/${TEST_ID}/
cat test-evidence/${TEST_ID}/test_metadata.json

# 6. Review FLOW_REPORT.md
# 7. Fix issues if any
# 8. Register test result
bin/hitestbot-eda --register-result ${TEST_ID} --result PASS

# 9. Proceed to next phase only if PASS
```

### Quick Test Execution (Single Command)

```bash
# Run complete test with unique environment
bin/hitestbot-eda --run-phase 0 \
  --isolate \
  --design /home/EDA/ibex_work_upload

# This automatically:
# 1. Generates TEST_ID with timestamp
# 2. Creates isolated directories
# 3. Kills stale processes
# 4. Deploys tools
# 5. Runs test
# 6. Downloads evidence
# 7. Registers result
```

### Deployment Options

```bash
# Deploy minimal (tools only, no tests/docs)
node src/hitestbot/infra/deploy_hipilot.js --minimal

# Deploy with specific components
node src/hitestbot/infra/deploy_hipilot.js \
  --include servers,skills,templates,bin,src/lib,deploy/eda-server \
  --exclude test,docs,src/hitestbot
```

---

## Test Artifacts Location

Each test has an isolated, timestamped environment:

### On EDA Server
```
/home/EDA/hipilot_test/runs/
└── hipilot_20260226_143022_phase0_infrastructure/     # Unique test work dir
    ├── hipilot/                                        # HiPilot installation
    ├── design/ibex/                                    # Isolated design
    ├── output/                                         # EDA tool outputs
    └── test.log                                        # Execution log

/tmp/hipilot-test-evidence/
└── hipilot_20260226_143022_phase0_infrastructure/     # Unique evidence dir
    ├── video.mp4
    ├── screenshots/
    ├── mcp_calls.jsonl
    └── FLOW_REPORT.md
```

### On Dev Machine
```
test-evidence/
├── .registry/
│   └── test_registry.jsonl                             # Test tracking
├── hipilot_20260226_143022_phase0_infrastructure/     # Downloaded evidence
│   ├── test_metadata.json
│   ├── video.mp4
│   ├── screenshots/
│   └── ...
└── latest -> hipilot_20260226_143022_phase0_infrastructure/  # Symlink
```

---

*Document Version: 1.0*
*Created: 2026-02-26*
*Next Review: After Phase 0 completion*
