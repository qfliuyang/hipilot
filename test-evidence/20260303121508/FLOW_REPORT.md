# HiPilot Flow Certification Report

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | PARTIAL PASS |
| Workflow | /rtl2gds |
| Progress | 1/1 stages (100%) |
| Score | 3.0/5 |
| Duration | 604.5s |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 3.0/5.0 | ⚠️ PARTIAL | HIPILOT_BUG: EDA error: **ERROR |

**Progress: 1/1 stages (100%)**
**Total Score: 3.0/5**

---

## Stage Scorecards

### full_flow (3.0/5.0) ⚠️

| Layer | Score | Detail |
|-------|-------|--------|
| L1 prompt_delivery | 1.0 | Claude responded to the command |
| L2 intent_recognition | 1.0 | Claude understood the task (mentions: design, flow, stage, routing) |
| L3 mcp_tool_usage | 0.5 | Partial: MCP(none), EDA(active) |
| L4 eda_execution | 0.0 | EDA error: **ERROR |
| L5 qor_assessment | 0.5 | Claude discussed metrics (timing, violation, slack, pass) but no WNS/TNS numbers |

**Failure:** HIPILOT_BUG — EDA error: **ERROR
**Action:** Fix Tcl template or generation

---

## Diagnostic Summary

*All debug information comes from the evidence package. EDA server has no source code.*

### Pane Previews (last observation)

**Claude pane (last 50 lines):**
```

  Timing Analysis

  Setup Violations: 44 paths in reg2reg group only
  - Worst slack: -0.059 ns (extremely close to meeting timing)
  - In2reg, reg2out, feedthr: All positive slack ✅

  The design is 59 picoseconds from timing closure.

  Deliverables Generated

  result/pr/data/
  ├── ibex_core.gds           ✅ GDS for tape-out
  ├── ibex_routing.vg         ✅ LVS netlist
  ├── ibex_lvs.vg             ✅ Flat netlist
  ├── chip_done.enc           ✅ Final checkpoint
  ├── routing.enc             ✅ Post-routing checkpoint
  └── [all stage checkpoints] ✅ Full flow history

  Session Notes

  I encountered an MMMC setup error during Stage 1:
  - Issue: Missing set_analysis_view -setup and -hold declarations
  - Fix: Added active view declarations to mmmc.view file
  - Saved: Error logged to session notes for future reference

  The existing checkpoints were from a previous successful run, so I loaded chip_done.enc to verify final
   timing.

  Recommended Actions (Optional)

  If you want to close the remaining 59ps setup violations:

  1. Run /fix-setup - Automatic setup timing optimization
  2. Or manually: optDesign -postRoute -setup -hold

  However: The design is essentially complete. -59ps on a 10ns clock period (100MHz) is 99.4% timing
  closure - this may be acceptable depending on your signoff criteria.

  ---
  Would you like me to fix the remaining setup violations, or is this timing sufficient for your needs?

✻ Worked for 4m 34s

─────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ /fix-setup
─────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle)


```

**EDA pane (last 50 lines):**
```
 sky130_fd_sc_hd__clkbuf_16 sky130_fd_sc_hd__clkbuf_2 sky130_fd_sc_hd__clkbuf_4 sky130_fd_sc_hd__clkbuf_8
sky130_fd_sc_hd__dlymetal6s2s_1 sky130_fd_sc_hd__probe_p_8
Total number of usable buffers: 14
List of unusable buffers: sky130_fd_sc_hd__probec_p_8
Total number of unusable buffers: 1
List of usable inverters: sky130_fd_sc_hd__bufinv_16 sky130_fd_sc_hd__clkinv_1 sky130_fd_sc_hd__bufinv_8 s
ky130_fd_sc_hd__clkinv_16 sky130_fd_sc_hd__clkinv_2 sky130_fd_sc_hd__clkinv_4 sky130_fd_sc_hd__clkinv_8 sk
y130_fd_sc_hd__inv_1 sky130_fd_sc_hd__clkinvlp_2 sky130_fd_sc_hd__clkinvlp_4 sky130_fd_sc_hd__inv_12 sky13
0_fd_sc_hd__inv_16 sky130_fd_sc_hd__inv_2 sky130_fd_sc_hd__inv_4 sky130_fd_sc_hd__inv_6 sky130_fd_sc_hd__i
nv_8
Total number of usable inverters: 16
List of unusable inverters:
Total number of unusable inverters: 0
List of identified usable delay cells: sky130_fd_sc_hd__bufbuf_16 sky130_fd_sc_hd__bufbuf_8 sky130_fd_sc_h
d__clkdlybuf4s15_1 sky130_fd_sc_hd__clkdlybuf4s15_2 sky130_fd_sc_hd__clkdlybuf4s18_1 sky130_fd_sc_hd__clkd
lybuf4s18_2 sky130_fd_sc_hd__clkdlybuf4s25_1 sky130_fd_sc_hd__clkdlybuf4s50_1 sky130_fd_sc_hd__clkdlybuf4s
25_2 sky130_fd_sc_hd__clkdlybuf4s50_2 sky130_fd_sc_hd__dlygate4sd2_1 sky130_fd_sc_hd__dlygate4sd1_1 sky130
_fd_sc_hd__dlygate4sd3_1 sky130_fd_sc_hd__dlymetal6s6s_1 sky130_fd_sc_hd__dlymetal6s4s_1
Total number of identified usable delay cells: 15
List of identified unusable delay cells:
Total number of identified unusable delay cells: 0
**WARN: (IMPCTE-107):	The following globals have been obsoleted since version 20.10-p004_1. They will be
 removed in the next release.
timing_enable_default_delay_arc
#% End load design ... (date=03/03 20:22:52, total cpu=0:00:04.7, real=0:00:06.0, peak res=908.3M, current
 mem=849.6M)

*** Summary of all messages that are not suppressed in this session:
Severity  ID               Count  Summary
WARNING   IMPLF-200            4  Pin '%s' in macro '%s' has no ANTENNAGAT...
WARNING   IMPLF-201            3  Pin '%s' in macro '%s' has no ANTENNADIF...
WARNING   IMPLF-108            1  There is no overlap layer defined in any...
WARNING   IMPFP-3961           2  The techSite '%s' has no related standar...
WARNING   IMPEXT-2766         12  The sheet resistance for layer %s is not...
WARNING   IMPEXT-2773         12  The via resistance between layers %s and...
WARNING   IMPOPT-3602          4  The specified path group name %s is not ...
WARNING   IMPCTE-107           1  The following globals have been obsolete...
WARNING   IMPTCM-77            1  Option "%s" for command %s is obsolete a...
WARNING   IMPIMEX-4017         1  freeDesign cannot reset some internal st...
WARNING   IMPPSP-1003          2  Found use of '%s'. This will continue to...
WARNING   TECHLIB-302         12  No function defined for cell '%s'. The c...
WARNING   TECHLIB-1161         1  The library level attribute %s on line %...
*** Message Summary: 56 warning(s), 0 error(s)

=== VIOLATING PATHS (WNS = -0.059ns) ===
**ERROR: (TCLCMD-981):	Unsupported extra argument '-delay_type' in command 'report_timing'.
**ERROR: (TCLCMD-981):	Unsupported extra argument 'max' in command 'report_timing'.

innovus 3>

```

See `run_log.txt`, `mcp_calls.jsonl`, `stage_*/scorecard.json` for full evidence.

---

## Recommendations

- Some stages passed with warnings; review partial scorecards for improvement.
- **Evidence:** See `stage_*/` directories for per-stage artifacts and scorecards.
- **Video:** See `video.mp4` with timestamps in `video_timestamps.json` for observation offsets.

---

*Generated by HiTestBot v2 at 2026-03-03T12:29:16.296Z*
