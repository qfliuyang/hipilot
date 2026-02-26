# HiPilot Test Progress Tracker

> Living document to track RTL2GDS test execution, findings, and fixes

## Test Execution Status

| Phase | Status | Started | Completed | Blockers |
|-------|--------|---------|-----------|----------|
| 0 | Infrastructure Verification | 🔴 NOT STARTED | - | - |
| 1 | Basic EDA Tool Launch | 🔴 NOT STARTED | - | - |
| 2 | Tcl Generation and Approval | 🔴 NOT STARTED | - | - |
| 3 | QoR Extraction and Reporting | 🔴 NOT STARTED | - | - |
| 4 | Skill System and Templates | 🔴 NOT STARTED | - | - |
| 5 | Multi-Stage Flow | 🔴 NOT STARTED | - | - |
| 6 | Full RTL2GDS Flow | 🔴 NOT STARTED | - | - |
| 7 | Error Handling and Recovery | 🔴 NOT STARTED | - | - |

---

## Issue Registry

| ID | Phase | Severity | Title | Status | Fix Commit |
|----|-------|----------|-------|--------|------------|
| AI-001 | Pre-test | BLOCKING | MCP tools not recognized by Claude Code | FIXED | `31c7f25` |

---

## Phase 0: Infrastructure Verification

### Test Metadata
- **Test ID**: _TBD_
- **Started**: _TBD_
- **Completed**: _TBD_
- **Duration**: _TBD_

### Objectives
- [ ] MCP servers respond to tool/list
- [ ] Tmux session created with correct layout
- [ ] Claude Code prompt detected
- [ ] HiTestBot can type and receive response

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 0-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`
- EDA Server: `/tmp/hipilot-test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1 (Response) | 100% | - | 🔴 NOT RUN |
| L2 (Understanding) | >80% | - | 🔴 NOT RUN |
| L3 (MCP Usage) | >80% | - | 🔴 NOT RUN |

### Exit Decision
- [ ] PASS - Proceed to Phase 1
- [ ] FAIL - Fix issues and retry

---

## Phase 1: Basic EDA Tool Launch

### Test Metadata
- **Test ID**: _TBD_
- **Depends On**: Phase 0
- **Started**: _TBD_
- **Completed**: _TBD_

### Objectives
- [ ] Launch Innovus in right pane
- [ ] Launch ICC2 in right pane
- [ ] Tool detection works
- [ ] Simple Tcl execution

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 1-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1 (Response) | 100% | - | 🔴 NOT RUN |
| L2 (Understanding) | >80% | - | 🔴 NOT RUN |
| L3 (MCP Usage) | >80% | - | 🔴 NOT RUN |
| L4 (EDA Success) | >70% | - | 🔴 NOT RUN |

### Exit Decision
- [ ] PASS - Proceed to Phase 2
- [ ] FAIL - Fix issues and retry

---

## Phase 2: Tcl Generation and Approval

### Test Metadata
- **Test ID**: _TBD_
- **Depends On**: Phase 1
- **Started**: _TBD_
- **Completed**: _TBD_

### Objectives
- [ ] Tcl generates with proper badge
- [ ] Manual mode queues to pending.tcl
- [ ] Approval executes Tcl
- [ ] Auto mode works

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 2-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1-L5 | Varies | - | 🔴 NOT RUN |

### Exit Decision
- [ ] PASS - Proceed to Phase 3
- [ ] FAIL - Fix issues and retry

---

## Phase 3: QoR Extraction and Reporting

### Test Metadata
- **Test ID**: _TBD_
- **Depends On**: Phase 2
- **Started**: _TBD_
- **Completed**: _TBD_

### Objectives
- [ ] WNS/TNS extracted from EDA output
- [ ] QoR reported in left pane
- [ ] Status bar shows WNS
- [ ] Violations correctly identified

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 3-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1-L5 | Varies | - | 🔴 NOT RUN |

### Exit Decision
- [ ] PASS - Proceed to Phase 4
- [ ] FAIL - Fix issues and retry

---

## Phase 4: Skill System and Templates

### Test Metadata
- **Test ID**: _TBD_
- **Depends On**: Phase 3
- **Started**: _TBD_
- **Completed**: _TBD_

### Objectives
- [ ] Correct skill matched
- [ ] Template Tcl generated
- [ ] Multi-step workflow progresses

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 4-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1-L5 | Varies | - | 🔴 NOT RUN |

### Exit Decision
- [ ] PASS - Proceed to Phase 5
- [ ] FAIL - Fix issues and retry

---

## Phase 5: Multi-Stage Flow (Synthesis to Placement)

### Test Metadata
- **Test ID**: _TBD_
- **Depends On**: Phase 4
- **Started**: _TBD_
- **Completed**: _TBD_
- **Design**: Ibex RISC-V (~7000 cells)

### Objectives
- [ ] Synthesis completes
- [ ] Floorplan initializes
- [ ] Placement runs
- [ ] QoR trends reported

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 5-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1-L5 | Varies | - | 🔴 NOT RUN |

### Exit Decision
- [ ] PASS - Proceed to Phase 6
- [ ] FAIL - Fix issues and retry

---

## Phase 6: Full RTL2GDS Flow

### Test Metadata
- **Test ID**: _TBD_
- **Depends On**: Phase 5
- **Started**: _TBD_
- **Completed**: _TBD_
- **Design**: Ibex RISC-V (~7000 cells)

### Objectives
- [ ] All stages complete
- [ ] Final GDS file generated
- [ ] QoR meets targets (or understood)
- [ ] Summary report provided

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 6-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1-L5 | Varies | - | 🔴 NOT RUN |

### Final GDS
- **Location**: _TBD_
- **File Size**: _TBD_
- **Verification**: _TBD_

### Exit Decision
- [ ] PASS - Proceed to Phase 7
- [ ] FAIL - Fix issues and retry

---

## Phase 7: Error Handling and Recovery

### Test Metadata
- **Test ID**: _TBD_
- **Depends On**: Phase 6
- **Started**: _TBD_
- **Completed**: _TBD_

### Objectives
- [ ] Tool crash detected
- [ ] Command errors handled
- [ ] Timeout handling works
- [ ] Recovery actions proposed

### Execution Log

```
YYYY-MM-DD HH:MM - [ACTION] Description
```

### Findings

#### Finding 7-1: _TBD_
- **Observation**:
- **Expected**:
- **Actual**:
- **Severity**:
- **Fix Applied**:

### Evidence Location
- Local: `test-evidence/{test_id}/`

### Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| L1-L5 | Varies | - | 🔴 NOT RUN |

---

## Summary

### Overall Progress
- **Total Phases**: 8
- **Completed**: 0
- **In Progress**: 0
- **Blocked**: 0
- **Not Started**: 8

### Critical Issues Found
| ID | Phase | Description | Status |
|----|-------|-------------|--------|
| - | - | - | - |

### Fixes Applied
| Commit | Description | Issues Fixed |
|--------|-------------|--------------|
| - | - | - |

### Next Steps
1. Execute Phase 0 (Infrastructure Verification)
2. Document findings
3. Apply fixes as needed
4. Proceed to next phase

---

*Last Updated: 2026-02-26*
*Next Action: Execute Phase 0*
