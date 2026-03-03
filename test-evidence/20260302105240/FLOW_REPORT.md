# HiPilot Flow Certification Report

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | PARTIAL PASS |
| Workflow | /rtl2gds |
| Progress | 1/1 stages (100%) |
| Score | 2.0/5 |
| Duration | 1800.5s |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 2.0/5.0 | ⚠️ PARTIAL | HIPILOT_BUG: EDA pane has text but no tool activity detected |

**Progress: 1/1 stages (100%)**
**Total Score: 2.0/5**

---

## Stage Scorecards

### full_flow (2.0/5.0) ⚠️

| Layer | Score | Detail |
|-------|-------|--------|
| L1 prompt_delivery | 1.0 | Claude responded to the command |
| L2 intent_recognition | 0.5 | Partial recognition (mentions: design, placement) |
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

     **State:** running — Output is changing — command may still be running. Last line: "Set Default
     … +23 lines (ctrl+o to expand)

● hipilot-eda - eda.wait_for_prompt (MCP)(timeout: 300)
  ⎿  Error: ⏱ Timeout waiting for EDA prompt

● hipilot-eda - eda.peek (MCP)(lines: 40)
  ⎿  👁️ **EDA Pane Snapshot** (91 lines)

     **State:** running — Output is changing — command may still be running. Last line: "Set Default
     … +23 lines (ctrl+o to expand)

● hipilot-eda - eda.wait_for_prompt (MCP)(timeout: 300)
  ⎿  Error: ⏱ Timeout waiting for EDA prompt

● hipilot-eda - eda.peek (MCP)(lines: 50)
  ⎿  👁️ **EDA Pane Snapshot** (101 lines)

     **State:** running — Output is changing — command may still be running. Last line: "Set Default
     … +23 lines (ctrl+o to expand)

● hipilot-eda - eda.wait_for_prompt (MCP)(timeout: 300)
  ⎿  Error: ⏱ Timeout waiting for EDA prompt

● hipilot-eda - eda.peek (MCP)(lines: 100)
  ⎿  👁️ **EDA Pane Snapshot** (139 lines)

     **State:** error — Error detected: **ERROR
     … +24 lines (ctrl+o to expand)

● hipilot-eda - eda.capture_and_analyze (MCP)(lines: 200, report_type: "auto")
  ⎿  📊 **EDA Output Analysis: AREA**

     **Captured:** 258 lines from eda pane
     … +167 lines (ctrl+o to expand)

● The design is being initialized. Let me continue waiting for the placement to complete:

  hipilot-eda - eda.wait_for_prompt (MCP)(timeout: 300)
  ⎿  Running…

✽ Skedaddling… (30m 2s · ↓ 14.5k tokens · thought for 3s)

─────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
─────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt


```

**EDA pane (last 50 lines):**
```
b)
**WARN: (TECHLIB-302):	No function defined for cell 'sky130_fd_sc_hd__decap_4'. The cell will only be use
d for analysis. (File /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.li
b)
**WARN: (TECHLIB-302):	No function defined for cell 'sky130_fd_sc_hd__decap_3'. The cell will only be use
d for analysis. (File /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.li
b)
**WARN: (TECHLIB-302):	No function defined for cell 'sky130_fd_sc_hd__decap_12'. The cell will only be us
ed for analysis. (File /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.l
ib)
Read 428 cells in library 'sky130_fd_sc_hd__tt_025C_1v80'
*** End library_loading (cpu=0.01min, real=0.00min, mem=18.9M, fe_cpu=0.44min, fe_real=0.85min, fe_mem=595
.9M) ***
#% Begin Load netlist data ... (date=03/02 19:07:33, mem=475.1M)
*** Begin netlist parsing (mem=595.9M) ***
Created 428 new cells from 1 timing libraries.
Reading netlist ...
Backslashed names will retain backslash and a trailing blank character.
Reading verilog netlist '/home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v'

*** Memory Usage v#1 (Current mem = 595.871M, initial mem = 249.227M) ***
*** End netlist parsing (cpu=0:00:00.1, real=0:00:00.0, mem=595.9M) ***
#% End Load netlist data ... (date=03/02 19:07:33, total cpu=0:00:00.2, real=0:00:00.0, peak res=487.2M, c
urrent mem=487.2M)
Set top cell to ibex_core.
Hooked 428 DB cells to tlib cells.
Starting recursive module instantiation check.
No recursion found.
Building hierarchical netlist for Cell ibex_core ...
*** Netlist is unique.
** info: there are 443 modules.
** info: there are 11078 stdCell insts.

*** Memory Usage v#1 (Current mem = 621.805M, initial mem = 249.227M) ***
**WARN: (IMPFP-3961):	The techSite 'unithddbl' has no related standard cells in LEF/OA library. Cannot m
ake calculations for this site type unless standard cell models of this type exist in the LEF/OA library.
If the SITE is not used by the library you can ignore this warning or remove the SITE definition from the
LEF/OA to avoid this message.
Type 'man IMPFP-3961' for more detail.
Adjust met3 preferred direction offset from 0.34 to 0.17.
Adjust met4 preferred direction offset from 0.46 to 0.23.
Adjust met5 preferred direction offset from 1.7 to 0.17.
Generated pitch 3.66 in met5 is different from 3.4 defined in technology file in preferred direction.
Generated pitch 0.69 in met4 is different from 0.92 defined in technology file in preferred direction.
Generated pitch 0.61 in met3 is different from 0.68 defined in technology file in preferred direction.
Set Default Net Delay as 1000 ps.
Set Default Net Load as 0.5 pF.
Set Default Input Pin Transition as 0.1 ps.


```

See `run_log.txt`, `mcp_calls.jsonl`, `stage_*/scorecard.json` for full evidence.

---

## Recommendations

- Some stages passed with warnings; review partial scorecards for improvement.
- **Evidence:** See `stage_*/` directories for per-stage artifacts and scorecards.
- **Video:** See `video.mp4` with timestamps in `video_timestamps.json` for observation offsets.

---

*Generated by HiTestBot v2 at 2026-03-02T11:26:44.107Z*
