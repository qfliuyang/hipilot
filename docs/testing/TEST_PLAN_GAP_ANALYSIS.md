# Test Plan vs Test Results - Gap Analysis

**Date:** 2026-03-04
**Test ID:** 20260304105823
**Test Plan Version:** 3.1

---

## Executive Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Overall Score** | 5.0/5.0 | 4.5/5.0 | ⚠️ Near Pass |
| **L1 Prompt Delivery** | 1.0 | 1.0 | ✅ Pass |
| **L2 Intent Recognition** | 1.0 | 1.0 | ✅ Pass |
| **L3 MCP Tool Usage** | 1.0 | 1.0 | ✅ Pass |
| **L4 EDA Execution** | 1.0 | 1.0 | ✅ Pass |
| **L5 QoR Assessment** | 1.0 | 0.5 | ❌ Gap |

**Flow Status:** All 9 stages completed, GDS exported (19.2 MB)

---

## 1. Test Plan Requirements (Phase 7)

### 1.1 Graduation Criteria (from TEST_PLAN.md Section 6)

| Requirement | Specification | Verification Method |
|-------------|---------------|---------------------|
| All 10 stages complete | 9 P&R stages + synthesis | checkpoint files exist |
| GDS file exists | > 10MB | `ls -lh result/pr/data/ibex_core.gds` |
| Final timing report | Generated | `result/pr/report/final_timing/` |
| Fresh evidence | Timestamps after test start | File timestamps |
| Timing closure | WNS ≥ 0 or within tolerance | Timing report |

### 1.2 L5 Scoring Requirements (from TEST_PLAN.md Section 2.2)

> **L5 (Reports QoR):** WNS/TNS/metrics in Claude's response

Scoring rubric (implied from FlowCertifier.js):
- **1.0:** Explicit WNS and TNS values reported
- **0.5:** Metrics discussed but no specific numbers
- **0.0:** No QoR assessment

---

## 2. Test Results Analysis

### 2.1 What Passed ✅

| Requirement | Evidence | Location |
|-------------|----------|----------|
| All 9 P&R stages complete | 9 checkpoints saved | `chip_done.enc` exists |
| GDS exported | 19.2 MB file | `result/pr/data/ibex_core.gds` |
| Timing reports generated | Multiple report directories | `result/pr/report/*_timing/` |
| Flow completion reported | Stage completion table | `obs_after_flow_claude.log` |
| L1-L4 perfect scores | 1.0 each | `FLOW_REPORT.md` |

### 2.2 What Failed ❌ (L5 Gap)

**Issue:** Final summary did not include explicit WNS/TNS values

**Evidence from obs_after_flow_claude.log:**
```
  Final Deliverables:
  - GDS: result/pr/data/ibex_core.gds
  - DEF: result/pr/data/ibex_routing.def
  ...

  Timing Reports Available:
  - Post-Placement: result/pr/report/placement_timing/
  - Post-CTS: result/pr/report/cts_timing/
  ...

  (User then typed: "check timing")
```

**Missing:** The "Final QoR Summary" table with WNS/TNS values was NOT displayed

### 2.3 Root Cause Analysis

| Factor | Analysis |
|--------|----------|
| **Timing reports exist** | Yes - multiple timing reports were generated during flow |
| **qor.snapshot called** | Yes - but only saves data, doesn't display it |
| **CLAUDE.md instructs WNS/TNS** | Yes - line 311 says "Always report WNS..." |
| **rtl2gds.md requires metrics** | Partial - says "Final WNS and TNS" but doesn't enforce extraction |
| **Actual behavior** | HiPilot showed completion table without timing metrics |

**Root Cause:** The flow completion summary displayed stage status but did not extract and display actual WNS/TNS numbers from the timing reports.

---

## 3. Comparison with Previous Test

| Test ID | Score | WNS/TNS Shown | Difference |
|---------|-------|---------------|------------|
| 20260304084837 | 3.5/5.0 | ✅ Yes (-0.059ns / -0.921ns) | Had QoR table |
| 20260304105823 | 4.5/5.0 | ❌ No | Missing QoR table |

**Observation:** L5 score dropped from 1.0 to 0.5 despite other scores improving. This indicates **non-deterministic behavior** - HiPilot sometimes reports QoR, sometimes doesn't.

---

## 4. Fixes Applied

### 4.1 Fixes That Worked ✅

| Fix | File | Result |
|-----|------|--------|
| L3 MCP log detection | `FlowCertifier.js` | Now detects 84 MCP calls |
| L4 completion priority | `FlowCertifier.js` | No longer false-positive on early errors |
| MCP log environment | `FlowCertifier.js` | HIPILOT_TEST_LOG now set |

### 4.2 Fix Applied for L5 (Pending Verification)

| Fix | File | Change |
|-----|------|--------|
| Explicit QoR extraction | `rtl2gds.md` | Added Section 4 requiring explicit timing metric extraction and table display |

**Change Summary:**
- Added explicit step to extract WNS/TNS using `timeDesign` + `get_metric`
- Added requirement to display "Final QoR Summary" table
- Made timing metrics MANDATORY ("You MUST include the actual WNS and TNS numbers")

---

## 5. Remaining Gap to 5.0/5.0

### 5.1 What Needs to Happen

To achieve 5.0/5.0, the next test must show:

```
✅ RTL-to-GDS Flow Complete!

Final QoR Summary:
┌──────────────────┬───────────────────────────────────────────┐
│      Metric      │                   Value                   │
├──────────────────┼───────────────────────────────────────────┤
│ WNS (Setup)      │ X.XXX ns                                  │  ← REQUIRED
├──────────────────┼───────────────────────────────────────────┤
│ TNS (Setup)      │ X.XXX ns                                  │  ← REQUIRED
├──────────────────┼───────────────────────────────────────────┤
│ Setup Violations │ N paths                                   │  ← REQUIRED
└──────────────────┴───────────────────────────────────────────┘
```

### 5.2 Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| HiPilot ignores new instructions | Medium | Updated CLAUDE.md with stronger language ("MUST") |
| Timing extraction fails | Low | Using standard Innovus commands |
| get_metric returns empty | Low | Using post-route timing analysis which always has data |
| Test timeout | Low | 2-hour timeout sufficient for full flow |

---

## 6. Recommendations

### 6.1 Immediate Actions

1. **Deploy updated CLAUDE.md** - Already done
2. **Run new test** - Verify L5 fix works
3. **If L5 still 0.5** - Consider extracting timing from report files as fallback

### 6.2 Long-term Improvements

1. **Make L5 scoring more robust** - Accept timing report file paths as evidence
2. **Add deterministic QoR extraction** - Add tool to `qor.snapshot` that returns values
3. **Update graduation criteria** - Clarify if 4.5/5.0 is acceptable for Gold certification

---

## 7. Conclusion

**Current State:** 4.5/5.0 (90% of target)
**Gap:** L5 QoR reporting (0.5 vs 1.0)
**Fix Applied:** Updated rtl2gds.md to mandate explicit timing extraction
**Next Step:** Run test to verify fix

The test plan's Gold certification criteria (Section 6) focus on flow completion and artifacts, not L1-L5 scores. However, the 5.0/5.0 goal requires deterministic QoR reporting from HiPilot.

---

*Generated: 2026-03-04*
*Test Evidence: test-evidence/20260304105823/*
