# HiPilot Flow Certification Report

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | FAIL |
| Workflow | /rtl2gds |
| Progress | 0/1 stages (0%) |
| Score | 1.5/5 |
| Duration | 603.2s |
| Blocking Stage | full_flow (HIPILOT_BUG) |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 1.5/5.0 | ❌ FAIL | HIPILOT_BUG: EDA pane has text but no tool activity detected |

**Progress: 0/1 stages (0%)**
**Total Score: 1.5/5**

---

## Blocking Issue

**Stage:** full_flow
**Category:** HIPILOT_BUG
**Summary:** EDA pane has text but no tool activity detected
**Action:** Fix Tcl template or generation

---

## Stage Scorecards

### full_flow (1.5/5.0) ❌

| Layer | Score | Detail |
|-------|-------|--------|
| L1 prompt_delivery | 1.0 | Claude responded to the command |
| L2 intent_recognition | 0.0 | No evidence Claude understood the RTL2GDS task |
| L3 mcp_tool_usage | 0.5 | Partial: MCP(none), EDA(active) |
| L4 eda_execution | 0.0 | EDA pane has text but no tool activity detected |
| L5 qor_assessment | 0.0 | No QoR assessment in Claude output |

**Failure:** HIPILOT_BUG — EDA pane has text but no tool activity detected
**Action:** Fix Tcl template or generation

---

## Diagnostic Summary

*All debug information comes from the evidence package. EDA server has no source code.*

### Pane Previews (last observation)

**Claude pane (last 50 lines):**
```
● hipilot-eda - eda.peek (MCP)(lines: 80)
  ⎿  👁️ **EDA Pane Snapshot** (132 lines)

     **State:** running — Output is changing — command may still be running. Last line: "
     … +20 lines (ctrl+o to expand)

● hipilot-eda - eda.peek (MCP)(lines: 80)
  ⎿  👁️ **EDA Pane Snapshot** (132 lines)

     **State:** running — Output is changing — command may still be running. Last line: "
     … +20 lines (ctrl+o to expand)

● hipilot-eda - eda.peek (MCP)(lines: 80)
  ⎿  👁️ **EDA Pane Snapshot** (132 lines)

     **State:** running — Output is changing — command may still be running. Last line: "
     … +20 lines (ctrl+o to expand)

● hipilot-eda - eda.peek (MCP)(lines: 80)
  ⎿  👁️ **EDA Pane Snapshot** (132 lines)

     **State:** running — Output is changing — command may still be running. Last line: "
     … +20 lines (ctrl+o to expand)

● hipilot-eda - eda.peek (MCP)(lines: 80)
  ⎿  👁️ **EDA Pane Snapshot** (132 lines)

     **State:** running — Output is changing — command may still be running. Last line: "
     … +20 lines (ctrl+o to expand)

● hipilot-eda - eda.peek (MCP)(lines: 80)
  ⎿  👁️ **EDA Pane Snapshot** (132 lines)

     **State:** running — Output is changing — command may still be running. Last line: "
     … +20 lines (ctrl+o to expand)

● hipilot-eda - eda.peek (MCP)(lines: 80)
  ⎿  👁️ **EDA Pane Snapshot** (132 lines)

     **State:** running — Output is changing — command may still be running. Last line: "
     … +19 lines (ctrl+o to expand)

✻ Reticulating… (10m 4s · ↓ 11.1k tokens · thinking)

─────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
─────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt


```

**EDA pane (last 50 lines):**
```
[NR-eGR] Overflow after Early Global Route (GR compatible) 1.26% H + 3.59% V
[NR-eGR] Overflow after Early Global Route 1.62% H + 4.10% V
Early Global Route congestion estimation runtime: 0.51 seconds, mem = 1208.7M
Local HotSpot Analysis: normalized max congestion hotspot area = 6.00, normalized total congestion hotspot
 area = 34.44 (area is in unit of 4 std-cell row bins)

=== incrementalPlace Internal Loop 1 ===
*** Finished SKP initialization (cpu=0:00:01.9, real=0:00:02.0)***
Iteration  7: Total net bbox = 5.690e+05 (2.50e+05 3.19e+05)
              Est.  stn bbox = 7.260e+05 (3.16e+05 4.10e+05)
              cpu = 0:00:08.2 real = 0:00:09.0 mem = 1260.8M
Iteration  8: Total net bbox = 5.732e+05 (2.53e+05 3.20e+05)
              Est.  stn bbox = 7.291e+05 (3.20e+05 4.09e+05)
              cpu = 0:00:15.9 real = 0:00:16.0 mem = 1251.8M
Iteration  9: Total net bbox = 5.791e+05 (2.57e+05 3.22e+05)
              Est.  stn bbox = 7.340e+05 (3.23e+05 4.10e+05)
              cpu = 0:00:23.7 real = 0:00:24.0 mem = 1251.8M
Iteration 10: Total net bbox = 5.905e+05 (2.62e+05 3.28e+05)
              Est.  stn bbox = 7.452e+05 (3.28e+05 4.17e+05)
              cpu = 0:00:19.5 real = 0:00:20.0 mem = 1289.4M
Iteration 11: Total net bbox = 5.910e+05 (2.62e+05 3.29e+05)
              Est.  stn bbox = 7.457e+05 (3.28e+05 4.18e+05)
              cpu = 0:00:03.8 real = 0:00:04.0 mem = 1261.4M
Move report: Timing Driven Placement moves 11720 insts, mean move: 17.07 um, max move: 327.99 um
	Max move on inst (gen_regfile_ff.register_file_i/FE_OFC1605_n2560): (214.82, 147.90) --> (198.46,
459.53)

Finished Incremental Placement (cpu=0:01:15, real=0:01:15, mem=1261.4M)
*** Starting refinePlace (0:05:51 mem=1259.4M) ***
Total net bbox length = 6.011e+05 (2.714e+05 3.297e+05) (ext = 2.133e+04)
*** Checked 2 GNC rules.
*** Applying global-net connections...
*** Applied 2 GNC rules (cpu = 0:00:00.0)
**WARN: (IMPSP-315):	Found 1029 instances insts with no PG Term connections.
Type 'man IMPSP-315' for more detail.
Move report: Detail placement moves 11720 insts, mean move: 1.32 um, max move: 37.02 um
	Max move on inst (FE_OFC1324_multdiv_operand_a_ex_18): (318.33, 416.51) --> (281.98, 417.18)
	Runtime: CPU: 0:00:01.9 REAL: 0:00:02.0 MEM: 1261.4MB
Summary Report:
Instances move: 11720 (out of 11720 movable)
Instances flipped: 0
Mean displacement: 1.32 um
Max displacement: 37.02 um (Instance: FE_OFC1324_multdiv_operand_a_ex_18) (318.329, 416.512) -> (281.98, 4
17.18)
	Length: 3 sites, height: 1 rows, site name: unithd, cell type: sky130_fd_sc_hd__clkbuf_1
Total net bbox length = 5.889e+05 (2.585e+05 3.304e+05) (ext = 2.124e+04)
Runtime: CPU: 0:00:02.0 REAL: 0:00:02.0 MEM: 1261.4MB
*** Finished refinePlace (0:05:53 mem=1261.4M) ***


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

*Generated by HiTestBot v2 at 2026-03-03T10:47:51.328Z*
