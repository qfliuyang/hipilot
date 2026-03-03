# HiPilot Flow Certification Report

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall** | PARTIAL PASS |
| Workflow | /rtl2gds |
| Progress | 1/1 stages (100%) |
| Score | 2.5/5 |
| Duration | 1800.8s |

---

## Flow Progress

| # | Stage | Score | Status | Notes |
|---|-------|-------|--------|-------|
| full_flow | full_flow | 2.5/5.0 | ⚠️ PARTIAL | HIPILOT_BUG: EDA error: **ERROR |

**Progress: 1/1 stages (100%)**
**Total Score: 2.5/5**

---

## Stage Scorecards

### full_flow (2.5/5.0) ⚠️

| Layer | Score | Detail |
|-------|-------|--------|
| L1 prompt_delivery | 1.0 | Claude responded to the command |
| L2 intent_recognition | 1.0 | Claude understood the task (mentions: design, innovus, stage, placement, routing, cts) |
| L3 mcp_tool_usage | 0.5 | Partial: MCP(none), EDA(active) |
| L4 eda_execution | 0.0 | EDA error: **ERROR |
| L5 qor_assessment | 0.0 | No QoR assessment in Claude output |

**Failure:** HIPILOT_BUG — EDA error: **ERROR
**Action:** Fix Tcl template or generation

---

## Diagnostic Summary

*All debug information comes from the evidence package. EDA server has no source code.*

### Pane Previews (last observation)

**Claude pane (last 50 lines):**
```
● Update(~/ibex_work_upload/stage4_placement.tcl)
  ⎿  Added 4 lines, removed 1 line
      37  setPathGroupOptions feedthr -effortLevel low
      38  setOptMode -ignorePathGroupsForHold {in2reg reg2out feedthr}
      39
      40 -# Place settings - ignore scan chains
      40 +# Place settings - ignore scan chains and suppress scan chain errors
      41  puts "Configuring placement settings..."
      42  setPlaceMode -reset
      43  setPlaceMode -place_global_ignore_scan true
     ...
      45  setPlaceMode -place_global_place_io_pins false -place_detail_legalization_inst_gap 2
      46  setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
      47  setDesignMode -process 130
      48 +# Suppress scan chain messages
      49 +setMessage -config SUPPRESS -id IMPSP-9099
      50 +setMessage -config IGNORE -category IMPSP-9099
      51
      52  # Run placement
      53  puts "Running placement optimization..."

● Bash(innovus -no_gui -files /home/EDA/ibex_work_upload/stage4_placement.tcl -log
      /home/EDA/ibex_work_upload/result/pr/log/stage4_placement_retry4.log 2>&1 &
      echo "St…)
  ⎿  Started Stage 4 Placement retry4 (PID: 39563)
     C: unknown locale
     … +23 lines (ctrl+o to expand)
  ⎿  (timeout 10m)

● Bash(sleep 90)
  ⎿  Running… (33s)
     ctrl+b ctrl+b (twice) to run in background

✢ Running placement… (30m 2s · ↓ 21.9k tokens)
  ⎿  ✔ Floorplan (Stage 2)
     ◻ CTS (Stage 5)
     ✔ Power Planning (Stage 3)
     ◼ Placement (Stage 4)
     ◻ Routing Optimization (Stage 8)
     ◻ Chip Finish + GDS (Stage 9)
     ◻ Post-CTS Optimization (Stage 6)
     ◻ Routing (Stage 7)
     ✔ Run synthesis (Stage 0)

─────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
─────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt · ctrl+t to hide tasks


```

**EDA pane (last 50 lines):**
```
Ignoring scan chains for placement...

Usage: setOptMode [-help] [-reset] [-addAOFeedThruBuffer {true|false}] [-addInst {true|false}]
                  [-addInstancePrefix <PREFIX>] [-addNetPrefix <PREFIX>] [-addPortAsNeeded {true|false}]
                  [-allEndPoints {true|false}] [-allowOnlyCellSwapping {true|false}]
                  [-checkRoutingCongestion {auto|false|true}] [-deleteInst {true|false}]
                  [-detailDrvFailureReason {true|false}] [-detailDrvFailureReasonMaxNumNets <value>]
                  [-downsizeInst {true|false}] [-drcMargin <DOUBLE>]
                  [-enableDataToDataChecks {true|false}] [-fixClockDrv {true|false}]
                  [-fixDrc {true|false}] [-fixFanoutLoad {true|false}] [-fixGlitch {true|false}]
                  [-fixHoldAllowOverlap {auto|false|true}] [-fixHoldAllowResizing {false|true}]
                  [-fixHoldAllowSetupTnsDegrade {true|false}] [-fixHoldOnExcludedClockNets {true|false}]
                  [-fixMillerCapDrv {true|false}] [-fixSISlew {true|false}] [-highEffortOptCells <LIST>]
                  [-holdFixingCells <LIST>] [-holdSlackFixingThreshold <SLACK>] [-holdTargetSlack <SLACK>]
                  [-honorDensityScreenInOpt {true|false}] [-honorFence {true|false}]
                  [-ignorePathGroupsForHold <INST>] [-leakageToDynamicRatio <ratio>]
                  [-maxDensity <DENSITY>] [-maxLength <value>] [-moveInst {true|false}]
                  [-multiBitFlopOpt {false|true|mergeOnly|splitOnly}]
                  [-multiBitFlopOptIgnoreSDC {true|false}] [-ndrAwareOpt <LIST>]
                  [-optimizeConstantInputs {true|false}] [-optimizeConstantNet {true|false}]
                  [-optimizeFF {true|false}] [-optimizeTiedInputs {true|false}]
                  [-postRouteAllowOverlap {true|false}]
                  [-postRouteAreaReclaim {none|setupAware|holdAndSetupAware}]
                  [-postRouteCheckAntennaRules {true|false}] [-postRouteDrvRecovery <ENUM>]
                  [-postRouteSetupRecovery <ENUM>] [-powerEffort {none|low|high}]
                  [-preserveAllSequential {true|false}] [-preserveModuleFunction {true|false}]
                  [-reclaimArea {true|false|default}] [-resizePowerSwitchInsts {true|false}]
                  [-resizeShifterAndIsoInsts {true|false}] [-restruct {true|false}]
                  [-setupTargetSlack <SLACK>] [-setupTargetSlackForReclaim <SLACK>]
                  [-simplifyNetlist {true|false}] [-swapPin {true|false}] [-targetBasedOptFile <FILE>]
                  [-targetBasedOptFileOnly {false|true}] [-targetBasedOptHoldFile <FILE>]
                  [-timeDesignCompressReports {true|false}] [-timeDesignExpandedView {true|false}]
                  [-timeDesignNumPaths <value>] [-timeDesignReportNet {true|false}]
                  [-unfixClkInstForOpt {true|false}] [-useConcatDefaultsPrefix {true|false}]
                  [-usefulSkew {true|false}] [-usefulSkewCCOpt {none|standard|extreme}]
                  [-usefulSkewPostRoute {true|false}] [-usefulSkewPreCTS {true|false}]
                  [-verbose {true|false}] [-virtualPartition {true|false}]

**ERROR: (IMPTCM-48):	"-useScanChainForSEO" is not a legal option for command "setOptMode". Either the c
urrent option or an option prior to it is not specified correctly.

innovus 2> source /tmp/hipilot-EDA/exec/hipilot_exec_1772457484347.tcl

*** Memory Usage v#1 (Current mem = 866.109M, initial mem = 249.230M) ***
*** Message Summary: 52 warning(s), 1 error(s)

--- Ending "Innovus" (totcpu=0:00:29.7, real=0:00:33.0, mem=866.1M) ---

[EDA@EDA2035 ibex_work_upload]$

```

See `run_log.txt`, `mcp_calls.jsonl`, `stage_*/scorecard.json` for full evidence.

---

## Recommendations

- Some stages passed with warnings; review partial scorecards for improvement.
- **Evidence:** See `stage_*/` directories for per-stage artifacts and scorecards.
- **Video:** See `video.mp4` with timestamps in `video_timestamps.json` for observation offsets.

---

*Generated by HiTestBot v2 at 2026-03-02T13:25:59.479Z*
