# HiPilot Flow Certification Report

## Academic Transcript

| Subject | Score | Grade | Weight | Status |
|---------|-------|-------|--------|--------|
| Communication | 75% | C | 1x | ✅ PASS |
| Methodology | 50% | F | 1.5x | ❌ FAIL |
| Process | 0% | F | 2x | ❌ FAIL |
| Execution | 0% | F | 1.5x | ❌ FAIL |
| Results | 0% | F | 1x | ❌ FAIL |
| Human-Like | 50% | F | 2.5x | ❌ FAIL |
| Authenticity | 0% | F | 10x | ❌ FAIL |

**GPA: 0.1/4.0** | **Final Grade: F** | **Overall: 25%**

*Assessment: CHEAT DETECTOR VETO: Critical authenticity violations detected. Test automatically FAILED regardless of other scores.*

**Recommendations:**
- Review cheat_detection_report.json for details
- Ensure test was run with authentic HiPilot processes
- Check for echo commands or fabricated output
- Verify video recording shows actual EDA tool execution

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | FAIL |
| Workflow | /floorplan |
| Progress | 0/1 stages (0%) |
| GPA | 0.1/4.0 (F) |
| **Human Level** | 🟠 Partially human (50%) |
| Score | 2.0/6 |
| Duration | 1802.2s |
| Blocking Stage | full_flow (HIPILOT_BUG) |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 2.0/5.0 | ❌ FAIL | HIPILOT_BUG: EDA pane has text but no tool activity detected |

**Progress: 0/1 stages (0%)**
**Total Score: 2.0/6**

---

## Blocking Issue

**Stage:** full_flow
**Category:** HIPILOT_BUG
**Summary:** EDA pane has text but no tool activity detected
**Action:** Fix Tcl template or generation

---

## Stage Scorecards

### full_flow (2.0/6.0) ❌

**University Transcript:**
| Subject | Score | Grade | Weight |
|---------|-------|-------|--------|
| Communication | 75% | C | 1x ✓ |
| Methodology | 50% | F | 1.5x ✗ |
| Process | 0% | F | 2x ✗ |
| Execution | 0% | F | 1.5x ✗ |
| Results | 0% | F | 1x ✗ |
| Human-Like | 50% | F | 2.5x ✗ |
| Authenticity | 0% | F | 10x ✗ |

**GPA: 0.1/4.0** | **Grade: F**

**Detailed Scores:**

| Layer | Score | Detail |
|-------|-------|--------|
| L1 Prompt Delivery | 1.0 | Claude responded to the command |
| L2 Intent Recognition | 0.5 | Partial recognition (mentions: design, stage) |
| L3 Mcp Tool Usage | 0.5 | Partial: MCP(7485 calls), EDA(idle) |
| L3b Process Validation | 0.0 | No tool execution detected for process validation |
| L4 Eda Execution | 0.0 | EDA pane has text but no tool activity detected |
| L5 Qor Assessment | 0.0 | No flow activity detected - QoR may be stale |

**Failure:** HIPILOT_BUG — EDA pane has text but no tool activity detected
**Action:** Fix Tcl template or generation

---

## Diagnostic Summary

*All debug information comes from the evidence package. EDA server has no source code.*

### Pane Previews (last observation)

**Claude pane (last 50 lines):**
```
 ▐▛███▜▌   Claude Code v2.1.76
▝▜█████▛▘  Sonnet 4.6 · API Usage Billing
  ▘▘ ▝▝    ~/hipilot/current

❯ /floorplan

● I'll run Stage 2: Floorplanning for the current design.
  Let me first verify the prerequisites and current state.

● Bash(echo "HIPILOT_DESIGN_DIR: ${HIPILOT_DESIGN_DIR:-not
       set}")
  ⎿  HIPILOT_DESIGN_DIR: /home/EDA/hipilot_test/runs/
     20260315080246/ibex_work_upload

● Bash(if [ -n "$HIPILOT_DESIGN_DIR" ]; then ls -la
      "$HIPILOT_DESIGN_DIR/result/pr/data/" 2>/dev/null ||
       echo "No checkpoint directory yet"; else echo
      "HIPILOT_DESIGN_…)
  ⎿  No checkpoint directory yet

● hipilot-eda - eda.get_status (MCP)
  ⎿  📊 **HiPilot System Status**

     **Mode:** ⚡ AUTO (commands execute immediately)
     … +22 lines (ctrl+o to expand)

● I can see that HIPILOT_DESIGN_DIR is set, but the Stage
  1 checkpoint (init_design.enc) doesn't exist yet. Let me
   check if Stage 1 was completed and what files are
  available.

● Searched for 1 pattern, read 1 file (ctrl+o to expand)

● The design directory exists but Stage 1 (Design Init)
  has not been completed yet. The floorplanning stage
──────────────────────────────────────────────────────────
 ☐ Prerequisite

Floorplanning requires Stage 1 (Design Init) to complete
first. Would you like me to run Stage 1 now?

❯ 1. Run Stage 1 (Design Init)
     Load netlist, LEF files, and complete design
     initialization before floorplanning
  2. Skip for now
     Don't run anything. I'll handle it manually.
  3. Type something.
──────────────────────────────────────────────────────────
  4. Chat about this

Enter to select · ↑/↓ to navigate · Esc to cancel



```

**EDA pane (last 50 lines):**
```
 ▐▛███▜▌   Claude Code v2.1.76
▝▜█████▛▘  Sonnet 4.6 · API Usage Billing
  ▘▘ ▝▝    ~/hipilot/current

──────────────────────────────────────────────────────────
❯ Try "fix lint errors"
──────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle)






















```

See `run_log.txt`, `mcp_calls.jsonl`, `stage_*/scorecard.json` for full evidence.

---

## Recommendations

- **Focus:** Resolve blocking stage `full_flow` (HIPILOT_BUG)
- **Action:** Fix Tcl template or generation
- Inspect MCP logs and template output for tool or Tcl generation bugs.
- **Evidence:** See `stage_*/` directories for per-stage artifacts and scorecards.
- **Video:** See `video.mp4` with timestamps in `video_timestamps.json` for observation offsets.

---

*Generated by HiTestBot v2 at 2026-03-15T08:35:13.240Z*
