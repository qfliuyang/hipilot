# HiPilot Flow Certification Report

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | PARTIAL PASS |
| Workflow | /rtl2gds |
| Progress | 1/1 stages (100%) |
| Score | 2.5/5 |
| Duration | 601.1s |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 2.5/5.0 | ⚠️ PARTIAL | ENVIRONMENT: EDA pane has text but no tool activity detected |

**Progress: 1/1 stages (100%)**
**Total Score: 2.5/5**

---

## Stage Scorecards

### full_flow (2.5/5.0) ⚠️

| Layer | Score | Detail |
|-------|-------|--------|
| L1 prompt_delivery | 1.0 | Claude responded to the command |
| L2 intent_recognition | 1.0 | Claude understood the task (mentions: design, innovus, stage, placement, routing) |
| L3 mcp_tool_usage | 0.5 | Partial: MCP(start_tool), EDA(active) |
| L4 eda_execution | 0.0 | EDA pane has text but no tool activity detected |
| L5 qor_assessment | 0.0 | No QoR assessment in Claude output |

**Failure:** ENVIRONMENT — EDA pane has text but no tool activity detected
**Action:** Fix EDA server setup

---

## Diagnostic Summary

*All debug information comes from the evidence package. EDA server has no source code.*

### Pane Previews (last observation)

**Claude pane (last 50 lines):**
```
                                            -type net -net VDD\nglobalNetConnect VSS -type pgpin -pin
                                            {VGND VNB} -inst *\nglobalNetConnect VSS -type tielo -pin
                                            {VGND VNB} -inst *\nglobalNetConnect VSS -type net -net
                                            VSS\n\naddStripe -nets {VSS VDD} -layer met4 -direction
                                            vertical -width 6 -spacing 2 -set_to_set_distance 30
                                            -start_from left -start_offset 1 -uda
                                            power_stripe_v\naddStripe -nets {VSS VDD} -layer met5
                                            -direction horizontal -width 6 -spacing 2
                                            -set_to_set_distance 30 -start_from bottom -start_offset 1
                                            -uda power_stripe_h\n\nsroute -connect { corePin }
                                            -layerChangeRange { li1(1) met4(4) } -corePinTarget { none }
                                            -allowJogging 1 -crossoverViaLayerRange { li1(1) met4(4) }
                                            -nets { VDD VSS } -allowLayerChange 1 -targetViaLayerRange {
                                            li1(1) met4(4) }\n\nverifyConnectivity -type special
                                            -noAntenna -noWeakConnect -noUnroutedNet -error 1000 -warning
                                             50\nverify_PG_short -no_routing_blkg\nsaveDesign
                                            result/pr/data/powerplan.enc\nputs \"STAGE 3 COMPLETE:
                                            powerplan.enc saved\"\nexit")
  ⎿  ⏳ **Pending Approval**

     **Description:** Stage 3: Power Planning
     … +4 lines (ctrl+o to expand)

● hipilot-eda - eda.approve_pending (MCP)
  ⎿  ✓ Approved and executed: Sent to eda pane via: source /tmp/hipilot-EDA/exec/hipilot_exec_177253
     9696202.tcl

● hipilot-eda - eda.wait_for_prompt (MCP)(timeout: 120)
  ⎿  Error: ⏱ Timeout waiting for EDA prompt

● hipilot-eda - eda.peek (MCP)(lines: 50)
  ⎿  👁️ **EDA Pane Snapshot** (94 lines)

     **State:** no_tool — shell prompt detected — no EDA tool running
     … +23 lines (ctrl+o to expand)

● Stage 3 Complete! Power planning done (with 2 errors - likely connectivity warnings). Proceeding to
  Stage 4: Placement.

● hipilot-eda - eda.start_tool (MCP)(design_dir: "/home/EDA/ibex_work_upload", tool: "innovus")
  ⎿  Running…

✢ Effecting… (10m 3s · ↓ 4.6k tokens · thought for 1s)

─────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
─────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt


```

**EDA pane (last 50 lines):**
```
*** Completed savePGFile (cpu=0:00:00.0 real=0:00:00.0 mem=896.8M) ***
Saving Drc markers ...
... No Drc file written since there is no markers found.
% Begin Save placement data ... (date=03/03 20:08:24, mem=774.2M)
** Saving stdCellPlacement_binary (version# 2) ...
Save Adaptive View Pruning View Names to Binary file
% End Save placement data ... (date=03/03 20:08:24, total cpu=0:00:00.0, real=0:00:00.0, peak res=774.4M,
current mem=774.4M)
% Begin Save routing data ... (date=03/03 20:08:24, mem=774.4M)
Saving route file ...
*** Completed saveRoute (cpu=0:00:00.0 real=0:00:00.0 mem=896.8M) ***
% End Save routing data ... (date=03/03 20:08:24, total cpu=0:00:00.1, real=0:00:00.0, peak res=774.6M, cu
rrent mem=774.6M)
Saving property file result/pr/data/powerplan.enc.dat.tmp/ibex_core.prop
*** Completed saveProperty (cpu=0:00:00.0 real=0:00:00.0 mem=899.8M) ***
% Begin Save power constraints data ... (date=03/03 20:08:24, mem=775.1M)
% End Save power constraints data ... (date=03/03 20:08:24, total cpu=0:00:00.0, real=0:00:00.0, peak res=
775.2M, current mem=775.2M)
Generated self-contained design powerplan.enc.dat.tmp
#% End save design ... (date=03/03 20:08:28, total cpu=0:00:04.8, real=0:00:06.0, peak res=778.0M, current
 mem=778.0M)
*** Message Summary: 0 warning(s), 0 error(s)

STAGE 3 COMPLETE: powerplan.enc saved

*** Memory Usage v#1 (Current mem = 937.141M, initial mem = 249.227M) ***
*** Message Summary: 62 warning(s), 2 error(s)

--- Ending "Innovus" (totcpu=0:00:36.2, real=0:00:37.0, mem=937.1M) ---

[EDA@EDA2035 ibex_work_upload]$ cd /home/EDA/ibex_work_upload
[EDA@EDA2035 ibex_work_upload]$ innovus -no_gui
C: unknown locale

Cadence Innovus(TM) Implementation System.
Copyright 2020 Cadence Design Systems, Inc. All rights reserved worldwide.

Version:	v20.10-p004_1, built Thu May 7 20:02:41 PDT 2020
Options:	-no_gui
Date:		Tue Mar  3 20:10:26 2026
Host:		EDA2035 (x86_64 w/Linux 3.10.0-1160.119.1.el7.x86_64) (3cores*6cpus*Intel(R) Core(TM) i7-8
559U CPU @ 2.70GHz 8192KB)
OS:		CentOS Linux release 7.9.2009 (Core)

License:
		invs	Innovus Implementation System	20.1	checkout succeeded
		8 CPU jobs allowed with the current license(s). Use setMultiCpuUsage to set your required
CPU count.


```

See `run_log.txt`, `mcp_calls.jsonl`, `stage_*/scorecard.json` for full evidence.

---

## Recommendations

- Some stages passed with warnings; review partial scorecards for improvement.
- **Evidence:** See `stage_*/` directories for per-stage artifacts and scorecards.
- **Video:** See `video.mp4` with timestamps in `video_timestamps.json` for observation offsets.

---

*Generated by HiTestBot v2 at 2026-03-03T12:10:37.951Z*
