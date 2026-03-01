# HiPilot RTL2GDS Operational Test Plan

> **Mission**: Validate the complete RTL-to-GDS flow using real EDA tools with evidence-based testing that drives development toward production readiness.
>
> **Principles**: (1) Never mock tools — use real dc_shell/innovus/pt_shell, (2) Record everything — evidence drives decisions, (3) Tests lead development — failures guide fixes.

---

## Table of Contents

1. [Test Philosophy](#1-test-philosophy)
2. [Test Architecture](#2-test-architecture)
3. [8-Phase Test Sequence](#3-8-phase-test-sequence)
4. [Evidence Standards](#4-evidence-standards)
5. [Failure Response Protocol](#5-failure-response-protocol)
6. [Running Tests](#6-running-tests)
7. [Test Records](#7-test-records)

---

## 1. Test Philosophy

### 1.1 Use Real Tools, Always

```
❌ NEVER: Mock EDA tool output with echo/puts
❌ NEVER: Use fake timing reports
❌ NEVER: Run on synthetic "test mode" data

✅ ALWAYS: Use real dc_shell for synthesis
✅ ALWAYS: Use real innovus for P&R
✅ ALWAYS: Use real pt_shell for signoff
✅ ALWAYS: Run on actual Ibex RISC-V design
```

**Why**: Mocked tests give false confidence. Only real tool execution reveals:
- License server issues
- Actual timing constraints behavior
- Real congestion and routing problems
- True GDS generation with DRC/LVS

### 1.2 Clean Design Every Iteration

Each test iteration starts with a **fresh design extraction**:

```bash
# Anti-contamination protocol
rm -rf /home/EDA/hipilot_test/runs/${TEST_ID}/iteration_${N}/design/ibex
tar -xf /home/EDA/ibex_demo.tar -C ${RUN_DIR}
# Verify: no result/ directory exists (would indicate stale data)
```

**Why**: Old results cause false positives. A synthesis from 3 days ago can mask a broken constraint file.

### 1.3 Evidence Over Assertions

Every claim must have evidence:

| Claim | Required Evidence |
|-------|-------------------|
| "Synthesis passed" | `ibex_core.syn.v` exists, >500KB, timestamp after test start |
| "Placement completed" | `placement.enc` exists, Innovus log shows "Placement completed" |
| "Timing is clean" | `qor.rpt` shows WNS ≥ 0, timestamp fresh |
| "GDS generated" | `ibex_core.gds` exists, >10MB, streamOut success in log |

---

## 2. Test Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEST ORCHESTRATOR                                  │
│                      (RalphLoopCertifier.js)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │   HiTestBot     │    │  State Manager  │    │  Evidence Vault │
    │  (Virtual Human)│    │  (state.json)   │    │ (timeline.jsonl)│
    └─────────────────┘    └─────────────────┘    └─────────────────┘
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                         HiPilot Workspace                        │
    │  ┌─────────────────────────┬───────────────────────────────┐    │
    │  │      Left Pane          │        Right Pane             │    │
    │  │    (Claude Code)        │      (EDA Tools)              │    │
    │  │                         │                               │    │
    │  │  User types: /rtl2gds   │   innovus> place_opt_design   │    │
    │  │                         │   innovus> routeDesign          │    │
    │  │  MCP calls:             │   innovus> streamOut ...      │    │
    │  │  eda.generate_tcl()     │                               │    │
    │  │  eda.execute_and_verify()│                              │    │
    │  │                         │                               │    │
    │  └─────────────────────────┴───────────────────────────────┘    │
    └─────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │   Ibex Design   │    │   EDA Server    │    │   Output GDS    │
    │  (37 Verilog)   │    │  (CentOS 7)     │    │  + Reports      │
    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 Test Entry Points

```bash
# Full certification (8 phases, max 10 iterations, stop on graduation)
bin/hitestbot-ralph --plan v4 --target-phase 7 --max-iterations 10

# Quick smoke test (first 4 phases only)
bin/hitestbot-ralph --plan v4 --target-phase 3 --max-iterations 3

# Single phase (for debugging)
bin/hitestbot-ralph --plan v4 --target-phase 5 --max-iterations 1

# Resume from previous state
bin/hitestbot-ralph --resume ${TEST_ID}
```

---

## 3. 8-Phase Test Sequence

### Phase 0: Infrastructure (5 min)
**Goal**: MCP, tmux, display work

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| MCP connectivity | `HiPilot status check` or `eda.get_status` | Returns status without error |
| Tmux socket | `tmux -L hipilot list-sessions` | Session exists |
| Display | Screenshot captured | Image >10KB, valid PNG |

**Evidence**: Screenshot of workspace, MCP call log

---

### Phase 1: Tool Launch (5 min)
**Goal**: EDA tools start in right pane

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Innovus starts | `/start-eda` or `start_eda tool="innovus"` | `innovus>` prompt appears |
| DC Shell starts | `/start-eda` or `start_eda tool="dc_shell"` | `dc_shell>` prompt appears |
| PT Shell starts | `/start-eda` or `start_eda tool="pt_shell"` | `pt_shell>` prompt appears |

**Evidence**: Pane log showing tool prompt, timestamp validated

---

### Phase 2: Tcl Execution (10 min)
**Goal**: Commands execute, output captured

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Basic Tcl | `/report-timing` | Output appears in right pane |
| Complex Tcl | `/fix-setup-timing` | Optimization completes |
| Error handling | Invalid command | Error caught and reported |

**Evidence**: Full pane capture showing command + output

---

### Phase 3: QoR Extraction (10 min)
**Goal**: Metrics extracted and reported

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Timing report | `/qor timing` | WNS/TNS extracted |
| Congestion | `/qor congestion` | Overflow metrics reported |
| Power | `/qor power` | Leakage/dynamic power extracted |

**Evidence**: QoR report file, parsed metrics JSON

---

### Phase 4: Synthesis (30 min)
**Goal**: dc_shell completes successfully

**Tool**: Synopsys Design Compiler
**Input**: 37 Verilog files (`designs/src/ibex/*.v`)
**Output**: `result/syn/data/ibex_core.syn.v`

| Stage | Tcl Block | Duration | Validation |
|-------|-----------|----------|------------|
| Setup | Library, paths | 30s | No errors |
| Read RTL | `analyze -format sverilog` | 60s | All files parsed |
| Elaborate | `elaborate ibex_core` | 30s | Design linked |
| Constraints | `source constraint.sdc` | 30s | No violations |
| Compile | `compile_ultra -scan` | 15min | Timing met |
| DFT | `insert_dft` | 5min | Scan chains inserted |
| Output | `write -format verilog` | 30s | Netlist >500KB |

**Pass Criteria**:
- `ibex_core.syn.v` exists and >500KB
- `qor.rpt` shows no critical violations
- Synthesis log shows "SYNTHESIS COMPLETE"

**Evidence**: Netlist file, QoR report, synthesis log

---

### Phase 5: Floorplan (30 min)
**Goal**: Innovus init + floorplan done

**Tool**: Cadence Innovus
**Input**: `ibex_core.syn.v`
**Output**: `result/pr/data/floor_plan.enc`

| Stage | Tcl Block | Duration | Validation |
|-------|-----------|----------|------------|
| MMMC setup | `create_rc_corner`, `create_library_set` | 30s | Views created |
| Design init | `init_design` | 60s | No errors |
| Floorplan | `floorPlan -site unithd` | 30s | Core area set |
| IO placement | `loadIoFile io.file` | 30s | Pins placed |
| Save | `saveDesign` | 30s | .enc file created |

**Pass Criteria**:
- `floor_plan.enc` exists
- `ibex.floorplan.def` created
- No "check_design" errors

**Evidence**: Floorplan DEF, checkpoint file, timing report

---

### Phase 6: Placement (60 min)
**Goal**: `place_opt_design` completes

**Tool**: Cadence Innovus
**Input**: `powerplan.enc`
**Output**: `placement.enc`

| Stage | Tcl Block | Duration | Validation |
|-------|-----------|----------|------------|
| Load | `source powerplan.enc` | 30s | Previous stage loaded |
| Timing setup | `set_timing_derate`, path groups | 30s | Constraints applied |
| Place | `place_opt_design` | 45min | Placement complete |
| Congestion | `reportCongestion` | 1min | Overflow < 10% |
| Timing | `timeDesign -preCTS` | 5min | WNS reported |
| Save | `saveDesign placement.enc` | 30s | Checkpoint created |

**Pass Criteria**:
- `placement.enc` exists
- Congestion report shows acceptable overflow
- Pre-CTS timing report generated

**Evidence**: Placement checkpoint, congestion report, timing report

---

### Phase 7: Full RTL2GDS (120 min)
**Goal**: All 10 stages to GDS

| # | Stage | Tool | Input | Output | Duration |
|---|-------|------|-------|--------|----------|
| 0 | Synthesis | dc_shell | RTL | .syn.v | 30 min |
| 1 | Design Init | innovus | .syn.v | init_design.enc | 2 min |
| 2 | Floorplan | innovus | init_design.enc | floor_plan.enc | 1 min |
| 3 | Power Planning | innovus | floor_plan.enc | powerplan.enc | 1 min |
| 4 | Placement | innovus | powerplan.enc | placement.enc | 5 min |
| 5 | CTS | innovus | placement.enc | cts.enc | 5 min |
| 6 | Post-CTS Opt | innovus | cts.enc | post_cts_opt.enc | 3 min |
| 7 | Routing | innovus | post_cts_opt.enc | routing.enc | 10 min |
| 8 | Route Opt | innovus | routing.enc | routing_opt.enc | 3 min |
| 9 | Chip Finish + GDS | innovus | routing_opt.enc | chip_done.enc + .gds | 3 min |

**Command**: `/rtl2gds`

**Pass Criteria**:
1. All 10 stages complete without error
2. `ibex_core.gds` exists and >10MB
3. `chip_done.enc` exists
4. Final timing report shows WNS (can be negative but documented)
5. All evidence files fresh (timestamp after iteration start)

**Evidence**:
- GDS file (with size)
- Final checkpoint
- Timing reports from all stages
- Full pane logs
- Video recording

---

## 4. Evidence Standards

### 4.1 Required Evidence per Phase

```javascript
// Evidence structure
{
  "testId": "ralph_v4_20260228_120000",
  "iteration": 3,
  "phase": 7,
  "timestamp": "2026-02-28T12:45:00Z",
  "evidence": {
    "screenshots": {
      "launch.png": { "size": 245760, "timestamp": "2026-02-28T12:30:00Z" },
      "command_typed.png": { "size": 245760, "timestamp": "2026-02-28T12:31:00Z" },
      "completion.png": { "size": 245760, "timestamp": "2026-02-28T14:30:00Z" }
    },
    "paneLogs": {
      "claude_full.log": { "lines": 10000, "timestamp": "2026-02-28T14:30:00Z" },
      "eda_full.log": { "lines": 10000, "timestamp": "2026-02-28T14:30:00Z" }
    },
    "mcpLog": "mcp_calls.jsonl",
    "video": "desktop_recording.mp4",
    "results": {
      "ibex_core.gds": { "size": 19300000, "timestamp": "2026-02-28T14:29:00Z" },
      "chip_done.enc": { "size": 5000000, "timestamp": "2026-02-28T14:28:00Z" }
    }
  }
}
```

### 4.2 Freshness Validation

```javascript
// Reject stale evidence
function validateFreshness(file, iterationStartTime) {
  const stats = statSync(file);
  const createTime = stats.birthtimeMs || stats.mtimeMs;

  // 5-second buffer for filesystem precision
  if (createTime < iterationStartTime - 5000) {
    return {
      valid: false,
      error: 'STALE_EVIDENCE',
      file: basename(file),
      created: new Date(createTime).toISOString(),
      iterationStart: new Date(iterationStartTime).toISOString(),
      ageMinutes: Math.round((iterationStartTime - createTime) / 60000)
    };
  }
  return { valid: true };
}
```

### 4.3 Tool Execution Validation

```javascript
// Detect fake tool execution (echo only)
function validateToolExecution(edaPaneLog) {
  const echoOnlyPatterns = [
    /^\[EDA@.*\]\$ echo/,
    /^\s*innovus.*Cadence Innovus/,  // Just the banner, no prompt
    /^\s*Start your EDA tool/,
  ];

  const lines = edaPaneLog.split('\n').filter(l => l.trim());
  const allEchoOnly = lines.every(line =>
    echoOnlyPatterns.some(p => p.test(line))
  );

  if (allEchoOnly) {
    return { valid: false, error: 'ECHO_ONLY_NO_TOOL_EXECUTION' };
  }

  // Must see actual tool activity
  const validPatterns = [
    /innovus\s*\d+>/,        // Innovus prompt
    /dc_shell>/,              // DC Shell prompt
    /pt_shell>/,              // PT Shell prompt
    /Loading.*design/i,       // Loading message
    /Placement completed/i,   // Stage completion
    /Routing completed/i,
    /streamOut.*completed/i,  // GDS generation
  ];

  const hasValidActivity = validPatterns.some(p =>
    lines.some(line => p.test(line))
  );

  if (!hasValidActivity) {
    return { valid: false, error: 'NO_TOOL_ACTIVITY_DETECTED' };
  }

  return { valid: true };
}
```

---

## 5. Failure Response Protocol

### 5.1 Failure Classification

| Severity | Examples | Response |
|----------|----------|----------|
| **Fatal** | MCP not available, tmux session broken | Stop, investigate infrastructure |
| **Tool Error** | License unavailable, disk full | Log, retry with fix |
| **Flow Error** | Congestion > 20%, timing violated | Log, continue to next iteration with adjusted parameters |
| **Validation Error** | Stale evidence, missing file | Log, retry with clean design |

### 5.2 Iteration Loop

```
ITERATION N:
  FOR each phase 0..target:
    IF phase already passed: SKIP
    RUN phase test
    IF phase passes:
      MARK passed
      SAVE state
    ELSE:
      DIAGNOSE failure
      RECORD note (category, issue, fix)
      APPLY fix if automatic
      STOP iteration (will retry next iteration)

  IF all phases passed:
    VERIFY graduation criteria
    IF verified: GRADUATE
    ELSE: CONTINUE to next iteration
```

### 5.3 Note-Taking Protocol

Every failure is recorded:

```json
{
  "timestamp": "2026-02-28T13:15:00Z",
  "iteration": 2,
  "phase": 4,
  "category": "license_error",
  "issue": "dc_shell license unavailable",
  "detail": "License server connection timeout after 30s",
  "fix": "Restarted flexlm: lmutil lmdown -c license.dat && lmutil lmdown -c license.dat",
  "fixType": "infrastructure",
  "autoRetry": true
}
```

Categories:
- `infrastructure`: License, disk, network
- `configuration`: Paths, constraints, tool settings
- `methodology`: Flow steps, Tcl commands
- `design`: Congestion, timing, DRC
- `tool_bug`: Actual tool defects

---

## 6. Running Tests

### 6.1 Pre-Flight Checklist

```bash
# 1. Verify EDA server connectivity
ssh EDA@192.168.112.163 "echo 'SSH OK'"

# 2. Verify license server
ssh EDA@192.168.112.163 "lmutil lmstat -c 27000@localhost"

# 3. Verify design tarball exists
ssh EDA@192.168.112.163 "ls -la /home/EDA/ibex_demo.tar"

# 4. Verify display :0 available
ssh EDA@192.168.112.163 "DISPLAY=:0 xset q"

# 5. Clean up stale sessions
ssh EDA@192.168.112.163 "pkill -f innovus; pkill -f dc_shell; pkill -f pt_shell"
```

### 6.2 Execute Test

```bash
# Full certification
bin/hitestbot-ralph \
  --plan v4 \
  --target-phase 7 \
  --max-iterations 10 \
  --clean-design-source /home/EDA/ibex_demo.tar \
  --validate-evidence \
  --graduation-requirements strict

# Environment variables
export RALPH_MAX_ITERATIONS=10
export RALPH_TARGET_PHASE=7
export HIPILOT_SESSION=hipilot
export HIPILOT_TEST_LOG=/tmp/hipilot_test_mcp.jsonl
```

### 6.3 Monitor Progress

```bash
# Watch state file
tail -f test-evidence/v4/${TEST_ID}/state.json

# Watch logs
tail -f test-evidence/v4/${TEST_ID}/iteration_*/phase_*/pane_logs/eda_full.log
```

### 6.4 Collect Results

```bash
# Download evidence to dev machine
bin/hitestbot-pull ${TEST_ID}

# Generate report
cat test-evidence/v4/${TEST_ID}/FLOW_REPORT.md
```

---

## 7. Test Records

### 7.1 State Persistence

```json
// test-evidence/v4/${TEST_ID}/state.json
{
  "testId": "ralph_v4_20260228_120000",
  "iteration": 3,
  "startedAt": "2026-02-28T12:00:00Z",
  "passedPhases": [0, 1, 2, 3, 4, 5],
  "currentPhase": 6,
  "failures": [
    {
      "iteration": 1,
      "phase": 4,
      "issue": "dc_shell license unavailable",
      "fix": "Restarted flexlm"
    },
    {
      "iteration": 2,
      "phase": 6,
      "issue": "High congestion at 80% utilization",
      "fix": "Reduced target utilization to 70%"
    }
  ],
  "notes": [
    {
      "category": "decision",
      "content": "Using physical-only mode for initial testing"
    }
  ],
  "graduationReady": false,
  "lastUpdated": "2026-02-28T13:30:00Z"
}
```

### 7.2 Graduation Criteria

| Criterion | Requirement | Evidence |
|-----------|-------------|----------|
| All Phases | Phases 0-7 all PASS | state.passedPhases.length === 8 |
| Fresh Evidence | All files created after iteration start | validateFreshness() passes |
| Tool Execution | Actual EDA tools ran | validateToolExecution() passes |
| GDS Output | GDS file generated | ibex_core.gds > 10MB |
| Timing Report | QoR metrics available | qor.rpt exists with WNS/TNS |
| No Stale Results | All result files fresh | resultValidation passes |

### 7.3 Graduation Report

```
═══════════════════════════════════════════════════════════
  GRADUATION ACHIEVED
═══════════════════════════════════════════════════════════

Test ID: ralph_v4_20260228_120000
Total Iterations: 3
Total Time: 145 minutes
Phases Completed: 8/8
Final Score: 5.3/6.0

Fix History:
  Iteration 1: dc_shell license unavailable → Restarted flexlm
  Iteration 2: High congestion → Reduced utilization 80% → 70%

Evidence Summary:
  Screenshots: 12
  Video: desktop_recording.mp4 (2.3GB)
  Pane Logs: 20,000 lines
  MCP Calls: 1,247
  Result Files:
    - ibex_core.gds: 19.3 MB
    - chip_done.enc: 5.1 MB
    - qor.rpt: 245 KB

Quality Metrics:
  WNS: +0.01ns
  TNS: 0.00ns
  Congestion: 3.2%
  DRC Violations: 0

Evidence Location: test-evidence/v4/ralph_v4_20260228_120000/
```

---

## Appendix A: File Locations

| File | Purpose |
|------|---------|
| `docs/testing/RTL2GDS_TEST_PLAN_OPERATIONAL.md` | This document |
| `docs/TEST_PLAN_v4_RALPH.md` | Ralph-loop specification |
| `src/hitestbot/RalphLoopCertifier.js` | Test orchestrator |
| `src/hitestbot/core/FlowCertifier.js` | Virtual human tester |
| `skills/ibex-rtl2gds-flow.md` | Complete flow Tcl |
| `deploy/eda-server/.claude/commands/rtl2gds.md` | Slash command |
| `test-evidence/v4/${TEST_ID}/` | Test evidence |
| `test-evidence/v4/${TEST_ID}/state.json` | Persistence |

---

## Appendix B: Quick Reference

```bash
# Run full test
bin/hitestbot-ralph --plan v4 --target-phase 7

# Check status
cat test-evidence/v4/$(ls -t test-evidence/v4/ | head -1)/state.json

# View latest report
cat test-evidence/v4/$(ls -t test-evidence/v4/ | head -1)/FLOW_REPORT.md

# Clean all test evidence
rm -rf test-evidence/v4/
```

---

*Version: 1.0*
*Based on: TEST_PLAN_v4_RALPH.md*
*Pattern: Operational Test Execution with Real Tools*
