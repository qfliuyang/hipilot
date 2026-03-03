# HiPilot Flow Certification Report

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | PARTIAL PASS |
| Workflow | /rtl2gds |
| Progress | 1/1 stages (100%) |
| Score | 3.5/5 |
| Duration | 1801.5s |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 3.5/5.0 | ⚠️ PARTIAL | HIPILOT_BUG: EDA error: **ERROR |

**Progress: 1/1 stages (100%)**
**Total Score: 3.5/5**

---

## Stage Scorecards

### full_flow (3.5/5.0) ⚠️

| Layer | Score | Detail |
|-------|-------|--------|
| L1 prompt_delivery | 1.0 | Claude responded to the command |
| L2 intent_recognition | 1.0 | Claude understood the task (mentions: stage, routing, cts) |
| L3 mcp_tool_usage | 0.5 | Partial: MCP(qor.snapshot), EDA(active) |
| L4 eda_execution | 0.0 | EDA error: **ERROR |
| L5 qor_assessment | 1.0 | QoR reported: WNS=0.019, TNS=0.0 |

**Failure:** HIPILOT_BUG — EDA error: **ERROR
**Action:** Fix Tcl template or generation

---

## Diagnostic Summary

*All debug information comes from the evidence package. EDA server has no source code.*

### Pane Previews (last observation)

**Claude pane (last 50 lines):**
```
  - Clock tree built: buffers and inverters inserted
  - Duration: 90 seconds

  ⚠️ Note: Timing degradation after CTS is normal. Stage 6 (Post-CTS Optimization) will fix these
  violations.

  Continuing to Stage 6: Post-CTS Optimization...

● hipilot-eda - qor.snapshot (MCP)(description: "QoR after Stage 5: CTS", name: "after_stage5_cts")
  ⎿  📊 **QoR Snapshot Saved**

     **Name:** after_stage5_cts
     … +4 lines (ctrl+o to expand)

● Bash(cd /home/EDA/ibex_work_upload && make post_cts_opt 2>&1 | tail -100)
  ⎿  |   max_tran     |      0 (0)       |   0.000    |      0 (0)       |
     |   max_fanout   |      0 (0)       |     0      |      0 (0)       |
     |   max_length   |      0 (0)       |     0      |      0 (0)       |
     … +59 lines (ctrl+o to expand)
  ⎿  Shell cwd was reset to /home/EDA/hipilot/current
  ⎿  (timeout 5m)

● ✓ Stage 6 (Post-CTS Optimization) COMPLETE!
  - WNS: 0.019 ns (timing FIXED! ✅)
  - TNS: 0.0 (all violations resolved)
  - Violations: 0 (was 1,015 before optimization)
  - Density: 41.05%
  - Duration: 142 seconds

  Continuing to Stage 7: Routing (this will take ~10 minutes)...

● hipilot-eda - qor.snapshot (MCP)(description: "QoR after Stage 6: Post-CTS Opt", name:
                                  "after_stage6_post_cts_opt")
  ⎿  📊 **QoR Snapshot Saved**

     **Name:** after_stage6_post_cts_opt
     … +4 lines (ctrl+o to expand)

  Bash(cd /home/EDA/ibex_work_upload && make routing 2>&1 | tail -100)
  ⎿  Running… (5m 0s · timeout 10m)
     ctrl+b ctrl+b (twice) to run in background

✻ Spelunking… (30m 3s · ↓ 12.3k tokens · thought for 2s)

─────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
─────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt


```

**EDA pane (last 50 lines):**
```

------ I/O Port summary

Number of Primary I/O Ports    : 266
Number of Input Ports          : 159
Number of Output Ports         : 107
Number of Bidirectional Ports  : 0
Number of Power/Ground Ports   : 0
Number of Floating Ports                     *: 8
Number of Ports Connected to Multiple Pads   *: 0
Number of Ports Connected to Core Instances   : 258
**WARN: (IMPREPO-200):	There are 8 Floating Ports in the top design.
**WARN: (IMPREPO-202):	There are 258 Ports connected to core instances.

------ Design Rule Checking:

Number of Output Pins connect to Power/Ground *: 0
Number of Insts with Input Pins tied together ?: 1230
Number of TieHi/Lo term nets not connected to instance's PG terms ?: 0
Number of Input/InOut Floating Pins            : 0
Number of Output Floating Pins                 : 0
Number of Output Term Marked TieHi/Lo         *: 0

**WARN: (IMPREPO-216):	There are 1230 Instances with input pins tied together.
Number of nets with tri-state drivers          : 0
Number of nets with parallel drivers           : 0
Number of nets with multiple drivers           : 0
Number of nets with no driver (No FanIn)       : 0
Number of Output Floating nets (No FanOut)     : 137
Number of High Fanout nets (>50)               : 68
**WARN: (IMPREPO-227):	There are 68 High Fanout nets (>50).
Design check done.


---
--- Please refer to file result/pr/report/check_data_init.report for detailed report.
---

*** Summary of all messages that are not suppressed in this session:
Severity  ID               Count  Summary
WARNING   IMPREPO-227          1  There are %d High Fanout nets (>50).
WARNING   IMPREPO-200          1  There are %d Floating Ports in the top d...
WARNING   IMPREPO-202          1  There are %d Ports connected to core ins...
WARNING   IMPREPO-216          1  There are %d Instances with input pins t...
*** Message Summary: 4 warning(s), 0 error(s)

**ERROR: (IMPOPT-6029):	Timing Library is not loaded yet.

innovus 5>

```

See `run_log.txt`, `mcp_calls.jsonl`, `stage_*/scorecard.json` for full evidence.

---

## Recommendations

- Some stages passed with warnings; review partial scorecards for improvement.
- **Evidence:** See `stage_*/` directories for per-stage artifacts and scorecards.
- **Video:** See `video.mp4` with timestamps in `video_timestamps.json` for observation offsets.

---

*Generated by HiTestBot v2 at 2026-03-02T12:46:46.389Z*
