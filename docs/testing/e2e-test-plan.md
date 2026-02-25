# HiPilot E2E Test Plan

**Date:** 2026-02-21
**Version:** v0.5.0
**Test Framework:** HiTestBot

---

## Executive Summary

This test plan validates all improvements from `IMPROVEMENT_PLAN_20260221.md`:
- Quick Commands (8 slash commands)
- Auto-Analysis (no manual prompt step)
- Evidence-Based Output (structured Tcl generation)
- Side-Effect Warnings (proactive risk alerts)
- One-Shot Fix Flow (single-command timing fixes)
- Improved Onboarding (better CLI status)

---

## Test Environment

| Component | Value |
|-----------|-------|
| **EDA Server** | 192.168.112.163 |
| **OS** | CentOS 7.9.2009 (glibc 2.17) |
| **Node.js** | v20.18.3 (glibc-217 build) |
| **EDA Tools** | Innovus v20.10, ICC2 T-2022.03, PrimeTime T-2022.03 |
| **Test Framework** | HiTestBot |
| **Video Recording** | Xvfb + ffmpeg |

---

## Test Suite Overview

| Test ID | Test Name | Priority | Duration | Status |
|---------|-----------|----------|----------|--------|
| TC-001 | QuickCommandsTest | P0 | 5 min | Ready |
| TC-002 | AutoAnalysisTest | P0 | 3 min | Ready |
| TC-003 | EvidenceOutputTest | P1 | 3 min | Ready |
| TC-004 | SideEffectTest | P1 | 4 min | Ready |
| TC-005 | OneShotFixTest | P1 | 5 min | Ready |
| TC-006 | OnboardingTest | P2 | 1 min | Ready |

---

## TC-001: QuickCommandsTest

### Objective
Verify all quick commands (`/timing`, `/drc`, `/power`, `/area`, `/compare`, `/history`) work in Claude Code.

### Prerequisites
- HiPilot workspace launched
- Innovus running in EDA pane (no design required for basic command tests)
- Claude Code running in chat pane

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `/timing` in Claude Code | Claude acknowledges, triggers timing workflow |
| 2 | Wait 45 seconds | Tcl generated and/or sent to EDA pane |
| 3 | Capture Claude pane output | Contains "timing", "WNS", or "report_timing" |
| 4 | Capture EDA pane output | Contains `report_timing` Tcl command |
| 5 | Type `/drc` in Claude Code | Claude triggers DRC workflow |
| 6 | Wait 45 seconds | DRC workflow executed |
| 7 | Type `/history` in Claude Code | Shows session command history |

### Verification Criteria
- [ ] `/timing` triggers timing analysis workflow
- [ ] Tcl is generated and visible in output
- [ ] `/drc` triggers DRC workflow
- [ ] `/history` shows previous commands

### Test File
```bash
node src/hitestbot/tests/QuickCommandsTest.js
```

### Evidence Required
- Video recording (MP4)
- Claude pane capture (claude_pane.log)
- EDA pane capture (eda_pane.log)
- Screenshot after each command

---

## TC-002: AutoAnalysisTest

### Objective
Verify reports are automatically analyzed without requiring manual "analyze this" step.

### Prerequisites
- Same as TC-001

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `/timing` in Claude Code | Command executes |
| 2 | Wait 60 seconds | Analysis appears |
| 3 | Capture output | Check for manual prompt instruction |
| 4 | Verify NO manual prompt | Should NOT contain "ask Claude to analyze" |

### Verification Criteria
- [ ] Output does NOT contain "ask Claude to analyze"
- [ ] Output does NOT contain "To get AI analysis, ask"
- [ ] Output DOES contain analysis insights (root cause, recommendations)

### Test File
```bash
node src/hitestbot/tests/AutoAnalysisTest.js
```

### Evidence Required
- Claude pane capture showing analysis output
- No manual prompt instructions in output

---

## TC-003: EvidenceOutputTest

### Objective
Verify Tcl generation output shows structured Analysis, Source, and Actions sections.

### Prerequisites
- Same as TC-001

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Request Tcl generation: "generate timing report Tcl" | Claude generates Tcl |
| 2 | Capture output | Check structure |
| 3 | Verify Analysis section | Contains intent/operation info |
| 4 | Verify Source section | Contains template name or "Generated" |
| 5 | Verify Actions section | Contains file path and execution options |
| 6 | Verify NO bare badges | Should NOT show just "[✓ Template]" |

### Verification Criteria
- [ ] Output has "## Analysis" or "Analysis:" section
- [ ] Output has "## Source" or "Source:" section
- [ ] Output shows template path or generation method
- [ ] No bare trust badges without context

### Test File
```bash
node src/hitestbot/tests/EvidenceOutputTest.js
```

### Evidence Required
- Claude pane capture showing structured output

---

## TC-004: SideEffectTest

### Objective
Verify side-effect warnings appear before executing potentially problematic operations.

### Prerequisites
- Same as TC-001
- Design loaded (optional, for more realistic test)

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Request setup timing fix: "generate Tcl to fix setup timing" | Tcl generated |
| 2 | Check for side-effect warning | Should warn about hold violations |
| 3 | Verify approval required | Should show approval prompt |
| 4 | Verify Tcl NOT auto-executed | EDA pane should NOT show size_cell |

### Verification Criteria
- [ ] Output contains side-effect warning (Hold Timing Risk, etc.)
- [ ] Output shows approval prompt
- [ ] Tcl was NOT executed without approval
- [ ] Warning includes recommendation ("Run /timing --hold")

### Test File
```bash
node src/hitestbot/tests/SideEffectTest.js
```

### Evidence Required
- Claude pane capture showing side-effect warning
- EDA pane capture proving no auto-execution

---

## TC-005: OneShotFixTest

### Objective
Verify `/fix-setup` command executes complete workflow in single command.

### Prerequisites
- Innovus running
- Design loaded (optional, for realistic timing data)

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type `/fix-setup reg2reg` in Claude Code | Single command sent |
| 2 | Wait 90 seconds | Complete workflow executes |
| 3 | Verify timing report generated | Claude output mentions timing/WNS |
| 4 | Verify analysis performed | Claude identifies violations/patterns |
| 5 | Verify fix Tcl generated | Contains size_cell or similar |
| 6 | Verify side effects warned | Hold timing risk mentioned |

### Verification Criteria
- [ ] Single command triggers complete workflow
- [ ] Timing report generated (WNS/TNS mentioned)
- [ ] Root cause analysis performed
- [ ] Fix Tcl generated
- [ ] Side-effect warning shown

### Test File
```bash
node src/hitestbot/tests/OneShotFixTest.js
```

### Evidence Required
- Complete video of workflow
- Claude pane capture showing all stages
- EDA pane capture showing timing report

---

## TC-006: OnboardingTest

### Objective
Verify improved CLI status and onboarding flow.

### Prerequisites
- SSH access to server (local or EDA)

### Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `hipilot` (no arguments) | Status displayed |
| 2 | Check for Quick Start section | Shows numbered steps |
| 3 | Check for command examples | Shows `/timing`, `/drc`, etc. |
| 4 | Check for color coding | Uses cyan/green/dim colors |
| 5 | Check status icons | Shows ✓, ✗, ⚠ icons |

### Verification Criteria
- [ ] Shows "Quick Start" section
- [ ] Lists numbered steps (1, 2, 3, 4)
- [ ] Shows available commands with descriptions
- [ ] Uses color formatting (not plain text)

### Test Command
```bash
hipilot
```

### Expected Output Structure
```
╔════════════════════════════════════════════════════════╗
║         HiPilot - VLSI Physical Design Copilot         ║
║                    v0.5.0                              ║
╚════════════════════════════════════════════════════════╝

  ✓ Dependencies: installed
  ✓ MCP servers: hipilot-eda, hipilot-tmux, hipilot-knowledge
  ✓ Skills: 35 loaded
  ✓ Templates: 20 available
  ✓ Command reference: 50 commands
  ✓ Quick commands: 8 available

  Quick Start:
    1. Launch workspace:
       hipilot workspace
    2. Start Claude Code (left pane):
       claude
    ...

  Available Commands:
    /timing [group]    Run timing analysis
    /drc               Check design rules
    ...
```

---

## Test Execution Order

### Automated Execution (All Tests)
```bash
# Run all HiTestBot tests sequentially
for test in QuickCommandsTest AutoAnalysisTest EvidenceOutputTest SideEffectTest OneShotFixTest; do
  echo "Running $test..."
  node src/hitestbot/tests/${test}.js
  echo "Completed $test"
  sleep 10
done
```

### Individual Test Execution
```bash
# TC-001
node src/hitestbot/tests/QuickCommandsTest.js

# TC-002
node src/hitestbot/tests/AutoAnalysisTest.js

# TC-003
node src/hitestbot/tests/EvidenceOutputTest.js

# TC-004
node src/hitestbot/tests/SideEffectTest.js

# TC-005
node src/hitestbot/tests/OneShotFixTest.js

# TC-006 (local)
hipilot
```

---

## Evidence Collection

### Directory Structure
```
e2e_evidence/YYYYMMDD_HHMMSS/
├── QuickCommandsTest/
│   ├── video.mp4
│   ├── claude_pane.log
│   ├── eda_pane.log
│   ├── timing_test.png
│   ├── drc_test.png
│   └── history_test.png
├── AutoAnalysisTest/
│   ├── video.mp4
│   └── claude_pane.log
├── EvidenceOutputTest/
│   └── ...
├── SideEffectTest/
│   └── ...
├── OneShotFixTest/
│   └── ...
└── HITESTBOT_REPORT.md
```

### Evidence Review Checklist

After each test:
- [ ] Video plays without errors
- [ ] Claude pane shows expected output
- [ ] EDA pane shows Tcl execution (if applicable)
- [ ] No unexpected errors in either pane
- [ ] Screenshots captured at key moments
- [ ] Test report shows all steps passed

---

## Pass/Fail Criteria

### Overall Test Suite Pass
- All P0 tests pass (TC-001, TC-002)
- At least 3 of 4 P1 tests pass
- No critical errors in any test

### Individual Test Pass
- All verification criteria checked
- Evidence collected successfully
- No blocking errors in output

---

## Known Limitations

1. **Timing Analysis Without Design**: `/timing` may show limited output without a loaded design
2. **Innovus Startup**: Takes 15+ seconds to initialize
3. **Claude Response Time**: 30-60 seconds per complex command
4. **Video Recording**: Requires Xvfb setup on headless servers

---

## Regression Testing

After any code change:
```bash
# Quick regression (P0 only)
node src/hitestbot/tests/QuickCommandsTest.js
node src/hitestbot/tests/AutoAnalysisTest.js

# Full regression (all tests)
npm run hitestbot
```

---

## Test Report Template

```markdown
# HiTestBot Test Report

**Date:** YYYY-MM-DD HH:MM:SS
**Test Suite:** IMPROVEMENT_PLAN_20260221
**Overall Result:** ✅ PASS / ❌ FAIL

## Summary

| Test | Result | Duration |
|------|--------|----------|
| TC-001 QuickCommandsTest | ✅ PASS | 5m 23s |
| TC-002 AutoAnalysisTest | ✅ PASS | 3m 12s |
| TC-003 EvidenceOutputTest | ✅ PASS | 2m 45s |
| TC-004 SideEffectTest | ✅ PASS | 4m 01s |
| TC-005 OneShotFixTest | ⚠️ PARTIAL | 5m 30s |
| TC-006 OnboardingTest | ✅ PASS | 0m 15s |

## Issues Found
- [List any issues]

## Evidence Location
- `/path/to/e2e_evidence/YYYYMMDD_HHMMSS/`

## Recommendations
- [Next steps or fixes needed]
```

---

*Test Plan v1.0 - 2026-02-21*
