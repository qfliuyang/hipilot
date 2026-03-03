# HiPilot Flow Certification Report

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | PARTIAL PASS |
| Workflow | /rtl2gds |
| Progress | 1/1 stages (100%) |
| Score | 3.5/5 |
| Duration | 1803.5s |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 3.5/5.0 | ⚠️ PARTIAL | ENVIRONMENT: EDA error: unknown command |

**Progress: 1/1 stages (100%)**
**Total Score: 3.5/5**

---

## Stage Scorecards

### full_flow (3.5/5.0) ⚠️

| Layer | Score | Detail |
|-------|-------|--------|
| L1 prompt_delivery | 1.0 | Claude responded to the command |
| L2 intent_recognition | 1.0 | Claude understood the task (mentions: stage, placement, routing, cts) |
| L3 mcp_tool_usage | 0.5 | Partial: MCP(none), EDA(active) |
| L4 eda_execution | 0.0 | EDA error: unknown command |
| L5 qor_assessment | 1.0 | QoR reported: WNS=-0.529, TNS=-287.383 |

**Failure:** ENVIRONMENT — EDA error: unknown command
**Action:** Fix EDA server setup

---

## Diagnostic Summary

*All debug information comes from the evidence package. EDA server has no source code.*

### Pane Previews (last observation)

**Claude pane (last 50 lines):**
```

     **Name:** after_placement
     … +4 lines (ctrl+o to expand)

● Stage 5: CTS (Clock Tree Synthesis) - Running...

● Bash(cd /home/EDA/ibex_work_upload && make cts 2>&1 | tail -100)
  ⎿  -     sky130_fd_sc_hd__clkinv_16  rise   0.139   0.670   0.130  0.187  (520.030,192.610)    1.2
     60      4
     CTS_ccl_a_inv_00089/A
     … +59 lines (ctrl+o to expand)
  ⎿  Shell cwd was reset to /home/EDA/hipilot/current
  ⎿  (timeout 5m)

● ✅ Stage 5: CTS COMPLETE            )

  - WNS: -0.529 ns | TNS: -287.383 ns | Violations: 1041 paths
  - Timing degradation expected after CTS (clock buffers added)
  - Checkpoint saved: result/pr/data/cts.enc

  Stage 6: Post-CTS Optimization - Running (this will fix the CTS-induced violations)...

● Bash(cd /home/EDA/ibex_work_upload && make post_cts_opt 2>&1 | tail -80)
  ⎿  Saving AAE Data ...
     % End Save AAE data ... (date=03/02 22:03:28, total cpu=0:00:00.0, real=0:00:00.0, peak res=996
     .8M, current mem=996.8M)
     … +45 lines (ctrl+o to expand)
  ⎿  Shell cwd was reset to /home/EDA/hipilot/current
  ⎿  (timeout 5m)

● ✅ Stage 6: Post-CTS Optimization COMPLETE

  - WNS: 0.001 ns | TNS: 0.000 | Violations: 0 paths
  - Timing recovered completely! Post-CTS optimization fixed all 1041 violations
  - Checkpoint saved: result/pr/data/post_cts_opt.enc

  Stage 7: Routing - Running (this is a longer stage, typically 5-10 minutes)...

● Bash(cd /home/EDA/ibex_work_upload && make routing 2>&1 | tail -100)
  ⎿  Running… (31s · timeout 10m)
     ctrl+b ctrl+b (twice) to run in background

✶ Beboppin'… (30m 5s · ↓ 7.1k tokens)

─────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
─────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt


```

**EDA pane (last 50 lines):**
```
Date:		Mon Mar  2 21:34:39 2026
Host:		EDA2035 (x86_64 w/Linux 3.10.0-1160.119.1.el7.x86_64) (3cores*6cpus*Intel(R) Core(TM) i7-8
559U CPU @ 2.70GHz 8192KB)
OS:		CentOS Linux release 7.9.2009 (Core)

License:
		invs	Innovus Implementation System	20.1	checkout succeeded
		8 CPU jobs allowed with the current license(s). Use setMultiCpuUsage to set your required
CPU count.
**WARN: (IMPOPT-801):	Genus executable not found in PATH. Install Genus, add the path to the genus execu
table in the PATH variable and rerun Innovus.
Create and set the environment variable TMPDIR to /tmp/innovus_temp_48154_EDA2035_EDA_bLU4DT.

The soft stacksize limit is either up to the hard limit or larger than 0.2% of RAM. No change is needed.

**INFO:  MMMC transition support version v31-84

innovus 1> cd /home/EDA/ibex_work_upload
innovus 2> icc2_shell



                              IC Compiler II (TM)

                  Version T-2022.03 for linux64 - Feb 28, 2022
  This release has significant feature enhancements. Please review the Release
                       Notes associated with this release.

                    Copyright (c) 1988 - 2022 Synopsys, Inc.
   This software and the associated documentation are proprietary to Synopsys,
 Inc. This software may only be used in accordance with the terms and conditions
 of a written license agreement with Synopsys, Inc. All other use, reproduction,
   or distribution of this software is strictly prohibited.  Licensed Products
     communicate with Synopsys servers for the purpose of providing software
    updates, detecting software piracy and verifying that customers are using
    Licensed Products in conformity with the applicable License Key for such
  Licensed Products. Synopsys will use information gathered in connection with
    this process to deliver software updates and pursue software pirates and
                                   infringers.

 Inclusivity & Diversity - Visit SolvNetPlus to read the "Synopsys Statement on
            Inclusivity and Diversity" (Refer to article 000036315 at
                        https://solvnetplus.synopsys.com)

icc2_shell> cd /home/EDA/ibex_work_upload
icc2_shell> innovus -no_gui
Error: unknown command 'innovus' (CMD-005)
icc2_shell> child killed: kill signal
innovus 3>

```

See `run_log.txt`, `mcp_calls.jsonl`, `stage_*/scorecard.json` for full evidence.

---

## Recommendations

- Some stages passed with warnings; review partial scorecards for improvement.
- **Evidence:** See `stage_*/` directories for per-stage artifacts and scorecards.
- **Video:** See `video.mp4` with timestamps in `video_timestamps.json` for observation offsets.

---

*Generated by HiTestBot v2 at 2026-03-02T14:04:39.570Z*
