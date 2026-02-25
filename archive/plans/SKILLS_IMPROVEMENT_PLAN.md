# HiPilot Skills Improvement Plan

**Version:** 1.1
**Date:** 2026-02-23
**Status:** Phase 1 IN PROGRESS
**Goal:** Create new skills that leverage the new MCP tools for autonomous workflows

---

## Implementation Status

| Phase | Status | Skills Created |
|-------|--------|----------------|
| 1.1 Autonomous Fix | ✅ COMPLETE | `auto-fix-timing` |
| 1.2 QoR Tracking | ✅ COMPLETE | `track-progress` |
| 1.3 Session Management | ✅ COMPLETE | `create-checkpoint`, `resume-work` |
| 2.1 Workflow Automation | ✅ COMPLETE | `run-cts-flow`, `run-eco-flow` |
| 2.2 DRC Automation | ✅ COMPLETE | `auto-fix-drc` |
| 3.1 Error Recovery | ✅ COMPLETE | `debug-failure`, `auto-recover` |
| 3.2 QoR Comparison | ✅ COMPLETE | `compare-implementations` |

**Total Skills: 27** (17 original + 10 new MCP-powered skills)

---

## Current State

**Existing Skills:** 17 (report-timing, fix-setup-timing, fix-hold-timing, cts, floorplan, route-design, synthesis, etc.)

**Gap:** Existing skills don't use the new MCP tools:
- No automatic feedback loop
- No QoR tracking/progress
- No error recovery
- No checkpoint/resume capability

---

## New Skills to Create

### 1. Autonomous Fix Skills (Uses Feedback Loop + Error Diagnosis)

#### 1.1 `auto-fix-timing`
**Uses:** `eda.wait_for_prompt`, `eda.get_last_result`, `eda.diagnose_error`, `suggest.for_violation`

```
Workflow:
1. Capture baseline QoR (qor.snapshot)
2. Generate timing report (report_timing)
3. Analyze violations
4. Apply fixes (size cells, insert buffers)
5. Wait for completion (eda.wait_for_prompt)
6. Check result (eda.get_last_result)
7. If failed, diagnose (eda.diagnose_error) and retry
8. Capture new QoR (qor.snapshot)
9. Compare (qor.compare) - if improved, continue; else rollback
10. Repeat until clean or max iterations
```

#### 1.2 `auto-fix-drc`
**Uses:** Same feedback loop tools, but for DRC violations

### 2. Session Management Skills (Uses Session State)

#### 2.1 `create-checkpoint`
**Uses:** `session.save_checkpoint`, `qor.snapshot`

```
Workflow:
1. Capture current QoR (qor.snapshot)
2. Save session state (session.save_checkpoint)
3. Report checkpoint ID and metrics
```

#### 2.2 `resume-work`
**Uses:** `session.list_checkpoints`, `session.restore_checkpoint`, `context.get_context`

```
Workflow:
1. List available checkpoints (session.list_checkpoints)
2. Let user select checkpoint
3. Restore context (session.restore_checkpoint)
4. Show current state (context.get_context)
5. Suggest next steps (context.suggest_next)
```

### 3. QoR Tracking Skills

#### 3.1 `track-progress`
**Uses:** `qor.snapshot`, `qor.get_trend`, `session.get_context`

```
Workflow:
1. Capture QoR snapshot (qor.snapshot)
2. Get trend (qor.get_trend)
3. Compare to previous snapshots
4. Report progress/regression
```

#### 3.2 `compare-implementations`
**Uses:** `qor.list_snapshots`, `qor.compare`

```
Workflow:
1. List snapshots (qor.list_snapshots)
2. Compare two selected snapshots (qor.compare)
3. Generate comparison report
```

### 4. Workflow Automation Skills

#### 4.1 `run-cts-flow`
**Uses:** `workflow.run`, `workflow.get_status`, `eda.wait_for_prompt`

```
Workflow:
1. Start CTS workflow (workflow.run name="run_cts_flow")
2. Monitor progress (workflow.get_status)
3. Report completion status
```

#### 4.2 `run-eco-flow`
**Uses:** `workflow.run`, `eda.wait_for_prompt`, `qor.compare`

```
Workflow:
1. Capture baseline (qor.snapshot)
2. Run ECO workflow (workflow.run name="eco_flow")
3. Wait for completion
4. Capture result (qor.snapshot)
5. Compare (qor.compare)
```

### 5. Error Recovery Skills

#### 5.1 `debug-failure`
**Uses:** `eda.diagnose_error`, `eda.get_last_result`, `suggest.for_violation`

```
Workflow:
1. Get last command result (eda.get_last_result)
2. If failed, diagnose error (eda.diagnose_error)
3. Get fix suggestions (suggest.for_violation)
4. Present analysis and options to user
```

#### 5.2 `auto-recover`
**Uses:** `eda.diagnose_error`, `eda.validate_tcl`, `suggest.for_violation`

```
Workflow:
1. Diagnose error (eda.diagnose_error)
2. Get fix suggestions (suggest.for_violation)
3. Validate fix Tcl (eda.validate_tcl)
4. If valid, apply fix automatically
5. Verify fix worked (eda.get_last_result)
```

---

## Skill Enhancement Plan

### Enhance Existing Skills with MCP Tools

| Existing Skill | MCP Tools to Add | Enhancement |
|----------------|-----------------|-------------|
| `fix-setup-timing` | `qor.snapshot`, `qor.compare`, `eda.wait_for_prompt` | Track before/after WNS, wait for completion |
| `fix-hold-timing` | Same as above | Track before/after, auto-retry |
| `report-timing` | `qor.snapshot`, `session.save_checkpoint` | Auto-save QoR snapshot |
| `cts` | `workflow.run`, `eda.wait_for_prompt` | Use workflow automation |
| `route-design` | `eda.wait_for_prompt`, `eda.get_last_result` | Wait for completion, check result |
| `run-drc` | `eda.diagnose_error` | Auto-diagnose DRC failures |

---

## Implementation Priority

### Phase 1: High Impact (Week 1)
1. `auto-fix-timing` - Core autonomous fix capability
2. `track-progress` - Essential QoR tracking
3. `create-checkpoint` / `resume-work` - Session management

### Phase 2: Workflow Automation (Week 2)
4. `run-cts-flow` - CTS automation
5. `run-eco-flow` - ECO automation
6. `auto-fix-drc` - DRC fix automation

### Phase 3: Error Recovery (Week 3)
7. `debug-failure` - Diagnose failures
8. `auto-recover` - Automatic recovery
9. `compare-implementations` - Compare QoR

---

## Skill Template (Using New MCP Tools)

```markdown
---
name: auto-fix-timing
description: >
  Autonomous timing fix loop using MCP feedback tools. Analyzes violations,
  applies fixes, verifies results, and iterates until clean or max iterations.

hipilot:
  vendor: [synopsys, cadence]
  uses_mcp_tools:
    - eda.wait_for_prompt
    - eda.get_last_result
    - eda.diagnose_error
    - qor.snapshot
    - qor.compare
    - suggest.for_violation
  autonomous: true
  max_iterations: 5
---

## Workflow

### Step 1: Establish Baseline

Use `qor.snapshot` to capture baseline WNS/TNS:
- Call: qor.snapshot name="baseline"

### Step 2: Analyze Violations

Generate timing report and analyze:
- Call: eda.capture_and_wait tcl="report_timing -max_paths 50"

### Step 3: Get Fix Suggestions

Use `suggest.for_violation` to get targeted fixes:
- Call: suggest.for_violation violation_type="setup"

### Step 4: Apply Fixes

Execute fix Tcl and wait for completion:
- Call: eda.capture_and_wait tcl="<fix_tcl>"

### Step 5: Verify

Check result and compare:
- Call: eda.get_last_result
- Call: qor.snapshot name="after_fix_1"
- Call: qor.compare snapshot1="baseline" snapshot2="after_fix_1"

### Step 6: Iterate or Stop

If WNS improved, continue. If degraded, diagnose error:
- Call: eda.diagnose_error output="<error_output>"

### Step 7: Save Progress

Save checkpoint for potential rollback:
- Call: session.save_checkpoint name="timing_fix_iter_1"
```

---

## Success Metrics

| Metric | Current | After Phase 1 | After Phase 3 |
|--------|---------|---------------|---------------|
| Autonomous fix rate | 0% | 40% | 70% |
| Skills using MCP tools | 0/17 | 5/22 | 10/25 |
| Error recovery rate | 0% | 30% | 60% |
| Session continuity | Manual | Checkpoint | Full resume |

---

## Next Steps

1. Create `auto-fix-timing` skill as pilot
2. Test with Ibex design on EDA server
3. Iterate based on results
4. Create remaining Phase 1 skills
5. Update existing skills to use MCP tools

---

*This plan will be updated as skills are implemented.*
