---
name: ibex-rtl2gds-flow
description: >
  Complete RTL-to-GDS flow for Ibex RISC-V CPU on Skywater 130nm.
  Each stage is a standalone tool invocation: start tool, load checkpoint, run, save, exit.
  Tools: dc_shell (synthesis), innovus (P&R), pt_shell (signoff STA).
hipilot:
  vendors: [cadence, synopsys]
  tools:
    synopsys: [dc_shell, pt_shell]
    cadence: [innovus]
  triggers:
    - "run rtl2gds"
    - "ibex flow"
    - "/rtl2gds"
  risk_level: high
  typical_duration: "45-90 minutes"
---

# Ibex RTL2GDS Flow

> **🚫 CRITICAL: NEVER USE BATCH EXECUTOR - THIS CAUSES IMMEDIATE FAILURE**
> **DO NOT call `workflow.run`, `eda.rtl2gds.run_full_flow`, or any batch workflow tools.**
> These bypass your intelligence and cause failures. You MUST orchestrate each stage manually using
> `eda.start_tool`, `eda.send_tcl_nonblocking`, and `eda.await_idle` as documented below.
>
> **⚠️ If you see errors about "get_scenarios" or ICC2 commands in dc_shell:**
> This means you accidentally used the batch executor. STOP immediately and use the manual
> stage-by-stage approach documented below.
>
> **⚠️ CRITICAL WARNING:** This flow uses **checkpoints** (`.enc` files) to pass design state between stages.
> **NEVER** use `loadDef`, `loadDefFile`, `defIn`, or any DEF loading commands — they cause "lib cell exists" errors.
> Always use `source <checkpoint.enc>` to load design state.
>
> **🔴 CRITICAL: EDA Pane Architecture**
> The EDA pane is a **bash terminal**. Once you start an EDA tool (innovus, dc_shell), you are inside that tool's Tcl shell.
> **YOU CANNOT START ANOTHER EDA TOOL FROM WITHIN AN EDA TOOL.**
> - ❌ WRONG: Inside innovus, trying to run `dc_shell` → will crash or error
> - ❌ WRONG: Sending `dc_shell` as a Tcl command to innovus → ERROR
> - ✅ CORRECT: Exit current tool (`exit`), then start new tool from bash
> - **Tool switching**: Exit → back to bash → start new tool

Each stage is a **standalone Tcl script**. The tool starts fresh, loads the previous checkpoint, runs the stage, saves a new checkpoint, and exits. This gives a clean environment for each stage and enables branching/recovery.

## How to execute each stage (using eda.await_idle for human-like awareness)

For each stage, Claude should use the **NEW definitive pattern** with `eda.await_idle`:

### The Correct Pattern (CRITICAL: Use the RIGHT tool for each stage):

```javascript
// === STAGE 0 (Synthesis ONLY): Use dc_shell ===
eda.start_tool({tool: "dc_shell", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage0_tcl, description: "Stage 0: Synthesis + DFT"})
eda.await_idle({timeout: 600, expected_tool: "dc_shell"})  // VERIFY tool!
eda.get_last_result({lines: 50})

// === STAGES 1-9 (P&R): Use innovus ===
eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage1_tcl, description: "Stage 1: Design Init"})
eda.await_idle({timeout: 300, expected_tool: "innovus"})  // VERIFY tool!
eda.get_last_result({lines: 50})

// Continue for each stage...
```

**⚠️ CRITICAL TOOL ASSIGNMENT:**
- **Stage 0 (Synthesis):** MUST use `dc_shell` — do NOT use innovus for synthesis
- **Stages 1-9 (P&R):** MUST use `innovus` — do NOT use dc_shell for placement

**Why this matters:** Synthesis requires Synopsys Design Compiler (dc_shell) to read RTL and generate netlists. Innovus cannot synthesize RTL — it only works with gate-level netlists.

### Why `eda.await_idle` is the definitive solution:

**OLD WAY (manual polling):** Claude calls `eda.peek` repeatedly, guessing if done
**NEW WAY (human-like):** `eda.await_idle` watches the pane every 500ms and returns immediately when:
- Output hasn't changed for 1.5 seconds (no more scrolling)
- AND either a prompt is visible OR enough polls completed

This is exactly how a human knows a terminal is ready: **they see it stop changing and see a prompt/cursor**.

### Stage-by-stage execution (with smart idle detection):

| Stage | Tool | Max Timeout* | Typical Duration | Key Checkpoint |
|-------|------|--------------|------------------|----------------|
| 0 | dc_shell | 600s | 3-5 min | `result/syn/data/ibex_core.syn.v` |
| 1 | innovus | 300s | 1-2 min | `result/pr/data/init_design.enc` |
| 2 | innovus | 300s | 30-60s | `result/pr/data/floor_plan.enc` |
| 3 | innovus | 300s | 30-60s | `result/pr/data/powerplan.enc` |
| 4 | innovus | 600s | 3-5 min | `result/pr/data/placement.enc` |
| 5 | innovus | 600s | 3-5 min | `result/pr/data/cts.enc` |
| 6 | innovus | 600s | 2-3 min | `result/pr/data/post_cts_opt.enc` |
| 7 | innovus | 1200s | 8-12 min | `result/pr/data/routing.enc` |
| 8 | innovus | 600s | 2-3 min | `result/pr/data/routing_opt.enc` |
| 9 | innovus | 600s | 2-3 min | `result/pr/data/chip_done.enc` + GDS |

\* **Timeout is a SAFETY MAXIMUM, not a fixed wait.** `eda.await_idle` returns **immediately** when the tool finishes. If placement takes 3 minutes, you wait ~3 min + 1.5s stability check — not the full 600s.

**Example:** Stage 4 (Placement)
```javascript
eda.send_tcl_nonblocking({tcl: stage4_tcl, description: "Stage 4: Placement"})
eda.await_idle({timeout: 600, expected_tool: "innovus"})  // Returns in ~3-5 min when placement finishes
eda.get_last_result({lines: 50})
```

Each stage's Tcl includes `source <input.enc>` at top and `saveDesign <output.enc>\nexit` at bottom.

---

## COMPLETE STEP-BY-STEP EXECUTION GUIDE

Execute these steps IN ORDER. Do not skip steps.

### Stage Tracking and Resumption (CRITICAL for Long Flows)

The full RTL2GDS flow takes 45-90 minutes. To handle timeouts and errors efficiently:

**ALWAYS check if a stage was already completed before re-running it:**

```javascript
// Check for existing checkpoints before each stage
// If checkpoint exists AND is recent (> 1 min old), SKIP the stage

function checkCheckpoint(checkpointPath) {
  // Use knowledge.parse_output or eda.peek to check if file exists
  // If exists, read the file age
}
```

**Resumption Strategy:**
1. At startup, scan `result/pr/data/` for existing `.enc` checkpoints
2. Find the HIGHEST numbered completed stage
3. Resume from that stage instead of starting from Stage 0
4. Report to user: "Resuming from Stage X (checkpoint found)"

**Checkpoint Priority (highest wins):**
- Stage 9: `chip_done.enc` → Flow complete, report QoR
- Stage 8: `routing_opt.enc` → Start Stage 9
- Stage 7: `routing.enc` → Start Stage 8
- Stage 6: `post_cts_opt.enc` → Start Stage 7
- Stage 5: `cts.enc` → Start Stage 6
- Stage 4: `placement.enc` → Start Stage 5
- Stage 3: `powerplan.enc` → Start Stage 4
- Stage 2: `floor_plan.enc` → Start Stage 3
- Stage 1: `init_design.enc` → Start Stage 2
- Stage 0: `ibex_core.syn.v` → Start Stage 1

### Pre-flight Check
```javascript
eda.detect_tool({})  // Check if any tool is running
// If running: eda.stop_tool({}) or continue if it's the right tool

// Check for existing progress
// List result/pr/data/ and result/syn/data/ to find highest checkpoint
// Resume from there instead of Stage 0 if checkpoints exist
```

### Stage 0: Synthesis (dc_shell) - ~3-5 minutes
**Skip if:** `result/syn/data/ibex_core.syn.v` exists and is > 100KB
```javascript
// 1. Start the CORRECT tool
eda.start_tool({tool: "dc_shell", design_dir: "$design_dir"})

// 2. Send synthesis Tcl
eda.send_tcl_nonblocking({
  tcl: stage0_tcl,  // From "Stage 0: Synthesis + DFT" section below
  description: "Stage 0: Synthesis + DFT"
})

// 3. Wait for completion (idle detection)
eda.await_idle({timeout: 600, expected_tool: "dc_shell"})

// 4. Check result
eda.get_last_result({lines: 50})

// 5. Verify output exists
// Check: result/syn/data/ibex_core.syn.v should exist
```

### Stage 1: Design Init (innovus) - ~1-2 minutes
**Skip if:** `result/pr/data/init_design.enc` exists

```javascript
// Check if already done
// If result/pr/data/init_design.enc exists, print "Stage 1 already complete, skipping" and continue to Stage 2

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage1_tcl, description: "Stage 1: Design Init"})
eda.await_idle({timeout: 300, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/init_design.enc exists
```

### Stage 2: Floorplan (innovus) - ~30-60 seconds
**Skip if:** `result/pr/data/floor_plan.enc` exists

```javascript
// Check if already done
// If result/pr/data/floor_plan.enc exists, skip to Stage 3

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage2_tcl, description: "Stage 2: Floorplan"})
eda.await_idle({timeout: 300, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/floor_plan.enc exists
```

### Stage 3: Power Planning (innovus) - ~30-60 seconds
**Skip if:** `result/pr/data/powerplan.enc` exists

```javascript
// Check if already done
// If result/pr/data/powerplan.enc exists, skip to Stage 4

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage3_tcl, description: "Stage 3: Power Planning"})
eda.await_idle({timeout: 300, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/powerplan.enc exists
```

### Stage 4: Placement (innovus) - ~3-5 minutes
**Skip if:** `result/pr/data/placement.enc` exists

```javascript
// Check if already done
// If result/pr/data/placement.enc exists, skip to Stage 5

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage4_tcl, description: "Stage 4: Placement"})
eda.await_idle({timeout: 600, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/placement.enc exists
```

### Stage 5: CTS (innovus) - ~3-5 minutes
**Skip if:** `result/pr/data/cts.enc` exists

```javascript
// Check if already done
// If result/pr/data/cts.enc exists, skip to Stage 6

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage5_tcl, description: "Stage 5: CTS"})
eda.await_idle({timeout: 600, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/cts.enc exists
```

### Stage 6: Post-CTS Optimization (innovus) - ~2-3 minutes
**Skip if:** `result/pr/data/post_cts_opt.enc` exists

```javascript
// Check if already done
// If result/pr/data/post_cts_opt.enc exists, skip to Stage 7

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage6_tcl, description: "Stage 6: Post-CTS Optimization"})
eda.await_idle({timeout: 600, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/post_cts_opt.enc exists
```

### Stage 7: Routing (innovus) - ~8-12 minutes
**Skip if:** `result/pr/data/routing.enc` exists

```javascript
// Check if already done
// If result/pr/data/routing.enc exists, skip to Stage 8

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage7_tcl, description: "Stage 7: Routing"})
eda.await_idle({timeout: 1200, expected_tool: "innovus"})  // Stage 7: Routing - longest stage
eda.get_last_result({lines: 50})
// Verify: result/pr/data/routing.enc exists
```

### Stage 8: Routing Optimization (innovus) - ~2-3 minutes
**Skip if:** `result/pr/data/routing_opt.enc` exists

```javascript
// Check if already done
// If result/pr/data/routing_opt.enc exists, skip to Stage 9

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage8_tcl, description: "Stage 8: Routing Optimization"})
eda.await_idle({timeout: 600, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/routing_opt.enc exists
```

### Stage 9: Chip Finish + GDS Export (innovus) - ~2-3 minutes
**Skip if:** `result/pr/data/chip_done.enc` exists (flow already complete!)

```javascript
// Check if already done
// If result/pr/data/chip_done.enc exists, flow is complete! Skip to QoR reporting.

eda.start_tool({tool: "innovus", design_dir: "$design_dir"})
eda.send_tcl_nonblocking({tcl: stage9_tcl, description: "Stage 9: Chip Finish + GDS"})
eda.await_idle({timeout: 600, expected_tool: "innovus"})
eda.get_last_result({lines: 50})
// Verify: result/pr/data/chip_done.enc AND result/pr/data/ibex_core.gds exist
```

### Flow Complete - MANDATORY QoR REPORTING (L5 Requirement)

⚠️ **WITHOUT EXACT WNS/TNS NUMBERS, YOU WILL GET L5 SCORE OF 0.5 INSTEAD OF 1.0**

You MUST complete ALL of the following steps:

1. **Run final timing report** (get timing with actual numbers):
```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 10 -slack_lesser_than 0", description: "Final timing report"})
eda.await_idle({timeout: 60, expected_tool: "innovus"})
```

2. **Extract QoR from the output** (CRITICAL - use knowledge.parse_output):
```javascript
const output = await eda.get_last_result({lines: 100})

// EXTRACT QoR using LittleBrain knowledge tool
const parsed = await knowledge.parse_output({
  output: output.content,
  tool: "innovus",
  extract_qor: true
})

// Get exact numbers
const wns = parsed.qor?.wns ?? 'N/A'
const tns = parsed.qor?.tns ?? 'N/A'
const setupVio = parsed.qor?.setup_violations ?? 'N/A'
const holdVio = parsed.qor?.hold_violations ?? 'N/A'
```

3. **Report EXACT NUMBERS to user** (MANDATORY FORMAT):
```
=== FINAL QoR RESULTS ===
WNS: 0.23 ns
TNS: 0.00 ns
Setup Violations: 0
Hold Violations: 0
========================
```

❌ **WRONG** (will score 0.5 on L5): "Timing looks good, no violations found"
✅ **CORRECT** (will score 1.0 on L5): "WNS: 0.23 ns, TNS: 0.00 ns, Setup violations: 0, Hold violations: 0"

**The engineer needs EXACT NUMBERS, not qualitative descriptions.**

Also report:
- GDS file location: `result/pr/data/ibex_core.gds`
- Total runtime
- Any DRC violations
- Flow completion status

```javascript
// 1. Run final timing report
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 10", description: "Final timing report"})
eda.await_idle({timeout: 60, expected_tool: "innovus"})

// 2. Get the output
const output = await eda.get_last_result({lines: 100})

// 3. Parse with LittleBrain to extract WNS/TNS
const parsed = await knowledge.parse_output({
  output: output.content,
  tool: "innovus",
  extract_qor: true
})

// 4. Report EXACT numbers to engineer (CRITICAL for L5 score)
// Format: "WNS: X.XX ns, TNS: Y.YY ns"
console.log(`Final QoR Results:`)
console.log(`  WNS: ${parsed.qor?.wns ?? 'N/A'} ns`)
console.log(`  TNS: ${parsed.qor?.tns ?? 'N/A'} ns`)
console.log(`  Setup violations: ${parsed.qor?.setup_violations ?? 'N/A'}`)
console.log(`  Hold violations: ${parsed.qor?.hold_violations ?? 'N/A'}`)
console.log(`  DRC violations: ${parsed.qor?.drc_violations ?? 'N/A'}`)
```

**L5 Requirement: You MUST report exact numeric WNS/TNS values.**
Saying "timing looks good" or "no violations" is NOT sufficient.
Report: "WNS: 0.12 ns, TNS: 0.00 ns" (specific numbers from the tool output)

Also report:
- GDS file location: `result/pr/data/ibex_core.gds`
- Total runtime
- Any DRC violations

---

## ⚠️ COMMON MISTAKES TO AVOID

### 1. WRONG TOOL FOR STAGE 0 (CRITICAL)
**❌ WRONG:** Starting innovus for synthesis
```javascript
eda.start_tool({tool: "innovus"})  // WRONG! Innovus cannot synthesize RTL
```

**✅ CORRECT:** Use dc_shell for Stage 0
```javascript
eda.start_tool({tool: "dc_shell"})  // CORRECT for synthesis
```

### 2. NOT WAITING FOR IDLE
**❌ WRONG:** Sending next command immediately
```javascript
eda.send_tcl_nonblocking({tcl: stage1_tcl})
eda.send_tcl_nonblocking({tcl: stage2_tcl})  // WRONG! Tool still running stage 1
```

**✅ CORRECT:** Wait for idle before next stage
```javascript
eda.send_tcl_nonblocking({tcl: stage1_tcl})
eda.await_idle({timeout: 300, expected_tool: "innovus"})  // Wait for stage 1 to complete
// Then start stage 2
```

### 3. NOT VERIFYING CHECKPOINTS
Always verify the output checkpoint exists before proceeding to next stage:
```javascript
// After each stage:
eda.get_last_result({lines: 50})
// Check that result/pr/data/STAGE_NAME.enc was created
```

### 4. WRONG CHECKPOINT INPUT
**❌ WRONG:** Sourcing the wrong checkpoint
```tcl
source result/pr/data/placement.enc  // Wrong! Should be powerplan.enc for CTS stage
```

**✅ CORRECT:** Use the checkpoint from the PREVIOUS stage
```tcl
# Stage 5 (CTS) should source from Stage 4 (Placement):
source result/pr/data/placement.enc
```

### 5. STALLS DUE TO TOOL CONFUSION
If the flow stalls, check:
1. Is the right tool running? (`eda.detect_tool`)
2. Did the previous stage actually complete? (`eda.get_last_result`)
3. Is the checkpoint file missing? (Check file exists)
4. Did you forget `eda.await_idle`? (Tool still running previous command)

## ERROR RECOVERY PATTERNS

### MMMC Configuration Error After Tool Restart
**Error:** `ERROR: The MMMC configuration specified is incomplete - a set_analysis_view command was not found`

**When it happens:** Innovus crashes or is restarted, and you try to `restoreDesign` without reloading MMMC configuration.

**Root Cause:** The MMMC views are set up during `init_design` (Stage 1). When Innovus restarts, this configuration is lost.

**Recovery Procedure:**

```javascript
// 1. If Innovus crashed, restart it
eda.start_tool({tool: "innovus", design_dir: "$design_dir"})

// 2. CRITICAL: Reload MMMC configuration BEFORE restoreDesign
// Source the mmmc.view file first
eda.send_tcl_nonblocking({
  tcl: `source result/pr/data/mmmc.view`,
  description: "Reload MMMC configuration"
})
eda.await_idle({timeout: 30})

// 3. Set analysis views (required after MMMC reload)
eda.send_tcl_nonblocking({
  tcl: `set_analysis_view -setup {max_view} -hold {min_view}`,
  description: "Set analysis views for setup and hold"
})
eda.await_idle({timeout: 30})

// 4. NOW you can restore the checkpoint
eda.send_tcl_nonblocking({
  tcl: `restoreDesign result/pr/data/CHECKPOINT.enc.dat ibex_core`,
  description: "Restore checkpoint after MMMC setup"
})
eda.await_idle({timeout: 60})
```

**Prevention:** Avoid restarting Innovus mid-flow. If you must restart, always reload MMMC config first.

### Power Ring Spacing Error
**Error:** Power ring creation fails due to spacing constraints

**Recovery:** Use power stripes instead:
```tcl
addStripe -nets {VDD VSS} -layer met4 -direction vertical -width 1.0 -spacing 0.5 -set_to_set_distance 50
```

### Floorplan Site Error
**Error:** `Site unithd not found` or similar site-related errors

**Recovery:** Check available sites first:
```tcl
getAllSites -quiet
# Or use a simpler floorplan approach without explicit site
floorPlan -su 1 0.4 1 1 1 1
```

## Design Paths

```
Work dir:    $design_dir
Result dir:  $design_dir/result
Scripts:     $design_dir/scripts

Synthesis:
  RTL src:   $design_dir/designs/src/ibex/*.v (37 Verilog files)
  DB lib:    $design_dir/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db
  SDC:       $design_dir/designs/sky130hd/ibex/constraint.sdc
  Syn data:  $design_dir/result/syn/data/
  Syn rpt:   $design_dir/result/syn/report/

P&R (Innovus):
  Netlist:   $design_dir/result/syn/data/ibex_core.syn.v (from synthesis)
  LEF:       $design_dir/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef
             $design_dir/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef
  LIB:       $design_dir/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
  PR SDC:    $design_dir/designs/sky130hd/ibex/constraint_for_pr.sdc
  IO file:   $design_dir/designs/sky130hd/ibex/io.file
  PR data:   $design_dir/result/pr/data/
  GDS map:   $design_dir/designs/sky130hd/pdk/gds/gds.map
```

## Flow Order and Tool Usage

| # | Stage | Tool | Input | Output | Duration |
|---|-------|------|-------|--------|----------|
| 0 | Synthesis + DFT | dc_shell | RTL Verilog | ibex_core.syn.v | 5 min |
| 1 | Design Init + MMMC | innovus | ibex_core.syn.v | init_design.enc | 2 min |
| 2 | Floorplan | innovus | init_design.enc | floor_plan.enc | 1 min |
| 3 | Power Planning | innovus | floor_plan.enc | powerplan.enc | 1 min |
| 4 | Placement | innovus | powerplan.enc | placement.enc | 5 min |
| 5 | CTS | innovus | placement.enc | cts.enc | 5 min |
| 6 | Post-CTS Optimization | innovus | cts.enc | post_cts_opt.enc | 3 min |
| 7 | Routing | innovus | post_cts_opt.enc | routing.enc | 10 min |
| 8 | Routing Optimization | innovus | routing.enc | routing_opt.enc | 3 min |
| 9 | Chip Finish + GDS | innovus | routing_opt.enc | chip_done.enc | 3 min |

Each stage: `cd $design_dir && innovus -no_gui -files /tmp/stage_N.tcl -log result/pr/log/stage_N`

---

## Stage 0: Synthesis + DFT (dc_shell, timeout: 300s)

Runs Design Compiler to synthesize RTL Verilog into a gate-level netlist. Includes DFT scan chain insertion. The output netlist (`ibex_core.syn.v`) is the input for all P&R stages.

**Tool:** `dc_shell -f -64` (Synopsys Design Compiler, 64-bit mode)

**⚠️ CRITICAL:** NEVER skip synthesis even if netlist exists. HiPilot must run the COMPLETE flow. Pre-existing outputs are removed before testing.

### Stage 0: Incremental Interactive Execution

Send commands ONE AT A TIME like a human engineer. Observe output after each command.

```javascript
// 1. Start the correct tool
eda.start_tool({tool: "dc_shell", design_dir: "$design_dir"})

// 2. Setup directories
eda.send_tcl_nonblocking({tcl: "file mkdir result/syn/data result/syn/log result/syn/report result/syn/work"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "file mkdir result/scanchain/data result/scanchain/report result/scanchain/log"})
eda.await_idle({timeout: 10})

// 3. Setup design library
eda.send_tcl_nonblocking({tcl: "define_design_lib work -path result/syn/work"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "set sh_command_log_file result/syn/work/command.log"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "set_app_var alib_library_analysis_path result/syn/work"})
eda.await_idle({timeout: 10})

// 4. Setup libraries
eda.send_tcl_nonblocking({tcl: "set target_library $design_dir/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "set link_library \"* $target_library\""})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "lappend link_library {dw_foundation.sldb}"})
eda.await_idle({timeout: 10})

// 5. Read RTL
eda.send_tcl_nonblocking({tcl: "analyze -format sverilog [glob $design_dir/designs/src/ibex/*.v]"})
eda.await_idle({timeout: 60})
// CHECK: Did analyze succeed? Look for errors in output

eda.send_tcl_nonblocking({tcl: "elaborate ibex_core"})
eda.await_idle({timeout: 60})
// CHECK: Did elaboration succeed?

eda.send_tcl_nonblocking({tcl: "current_design ibex_core"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "link"})
eda.await_idle({timeout: 30})
// CHECK: Any link errors?

eda.send_tcl_nonblocking({tcl: "check_design"})
eda.await_idle({timeout: 30})
// CHECK: Any design issues?

// 6. Load constraints
eda.send_tcl_nonblocking({tcl: "source $design_dir/designs/sky130hd/ibex/constraint.sdc"})
eda.await_idle({timeout: 30})

// 7. Setup path groups
eda.send_tcl_nonblocking({tcl: "remove_path_group -all"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "set reg [filter_collection [all_registers] \"is_clock_gate != true\"]"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "group_path -name reg2reg -weight 50 -critical_range 6 -from $reg -to $reg"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "group_path -name in2reg -weight 10 -critical_range 0.5 -from [all_inputs] -to $reg"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "group_path -name reg2out -weight 10 -critical_range 0.5 -from $reg -to [all_outputs]"})
eda.await_idle({timeout: 10})

// 8. Set dont-use cells
eda.send_tcl_nonblocking({tcl: "set_dont_use [get_lib_cell */sky130_fd_sc_hd__probec_p_8]"})
eda.await_idle({timeout: 5})
// ... (set other dont-use cells similarly)

eda.send_tcl_nonblocking({tcl: "redirect result/syn/report/check_timing.rpt {check_timing}"})
eda.await_idle({timeout: 30})

// 9. Compile
eda.send_tcl_nonblocking({tcl: "set_fix_multiple_port_nets -all -buffer_constants [get_designs *]"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "compile_ultra -timing_high_effort_script -scan"})
eda.await_idle({timeout: 300})  // Long operation - synthesis takes time
// CHECK: Did compilation succeed? Look for timing/area reports

// 10. DFT insertion
eda.send_tcl_nonblocking({tcl: "set_dft_insertion_configuration -preserve_design_name true"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "set_dft_signal -view existing_dft -type ScanClock -timing {45 55} -port {clk_i}"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "set_dft_signal -view existing_dft -port rst_ni -type Reset -active_state 0"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "set_dft_signal -view existing_dft -port test_en_i -type ScanEnable -active_state 1"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "create_test_protocol -infer_async -infer_clock"})
eda.await_idle({timeout: 30})

eda.send_tcl_nonblocking({tcl: "insert_dft"})
eda.await_idle({timeout: 60})

eda.send_tcl_nonblocking({tcl: "dft_drc -verbose > result/scanchain/report/pre_dft_drc.rpt"})
eda.await_idle({timeout: 30})

// 11. Incremental compile after DFT
eda.send_tcl_nonblocking({tcl: "compile_ultra -scan -incremental"})
eda.await_idle({timeout: 120})

// 12. Generate reports
eda.send_tcl_nonblocking({tcl: "redirect result/syn/report/check_design_after_syn.rpt {check_design}"})
eda.await_idle({timeout: 30})

eda.send_tcl_nonblocking({tcl: "redirect result/syn/report/qor.rpt {report_qor -nosplit}"})
eda.await_idle({timeout: 30})

eda.send_tcl_nonblocking({tcl: "redirect result/syn/report/violation.rpt {report_constraint -all_violators}"})
eda.await_idle({timeout: 30})

// 13. Write outputs
eda.send_tcl_nonblocking({tcl: "write -format verilog -h -output result/syn/data/ibex_core.syn.v"})
eda.await_idle({timeout: 30})

eda.send_tcl_nonblocking({tcl: "write -format ddc -h -output result/syn/data/ibex_core.rpt.ddc"})
eda.await_idle({timeout: 30})

eda.send_tcl_nonblocking({tcl: "write_scan_def -output result/scanchain/data/ibex_core.scan.def"})
eda.await_idle({timeout: 30})

eda.send_tcl_nonblocking({tcl: "set_svf result/syn/data/ibex_core.svf"})
eda.await_idle({timeout: 10})

eda.send_tcl_nonblocking({tcl: "exit"})
eda.await_idle({timeout: 10})
```

### Batch Alternative (ONLY if incremental fails - NOT RECOMMENDED)

> **⚠️ WARNING: This batch approach is NOT RECOMMENDED.** Only use if the incremental approach above fails multiple times.
> **CRITICAL:** You MUST run Stage 0 (Synthesis with dc_shell) BEFORE running Stages 1-9. The synthesis output (netlist) is required input for the P&R stages.

If you absolutely must use batch mode:

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
cd $design_dir

file mkdir result/syn/data result/syn/log result/syn/report result/syn/work
file mkdir result/scanchain/data result/scanchain/report result/scanchain/log

define_design_lib work -path result/syn/work
set sh_command_log_file result/syn/work/command.log
set_app_var alib_library_analysis_path result/syn/work

set target_library $design_dir/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db
set link_library "* $target_library"
lappend link_library {dw_foundation.sldb}

analyze -format sverilog [glob $design_dir/designs/src/ibex/*.v]
elaborate ibex_core
current_design ibex_core
link
check_design

source $design_dir/designs/sky130hd/ibex/constraint.sdc

# Remove existing path groups before creating new ones
remove_path_group -all
set reg [filter_collection [all_registers] "is_clock_gate != true"]
group_path -name reg2reg -weight 50 -critical_range 6 -from $reg -to $reg
group_path -name in2reg -weight 10 -critical_range 0.5 -from [all_inputs] -to $reg
group_path -name reg2out -weight 10 -critical_range 0.5 -from $reg -to [all_outputs]

foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cell */$cell]
}
redirect result/syn/report/check_timing.rpt {check_timing}

set_fix_multiple_port_nets -all -buffer_constants [get_designs *]
compile_ultra -timing_high_effort_script -scan

set_dft_insertion_configuration -preserve_design_name true
set_dft_signal -view existing_dft -type ScanClock -timing {45 55} -port {clk_i}
set_dft_signal -view existing_dft -port rst_ni -type Reset -active_state 0
set_dft_signal -view existing_dft -port test_en_i -type ScanEnable -active_state 1
create_test_protocol -infer_async -infer_clock
insert_dft
dft_drc -verbose > result/scanchain/report/pre_dft_drc.rpt

compile_ultra -scan -incremental

redirect result/syn/report/check_design_after_syn.rpt {check_design}
redirect result/syn/report/qor.rpt {report_qor -nosplit}
redirect result/syn/report/violation.rpt {report_constraint -all_violators}

write -format verilog -h -output result/syn/data/ibex_core.syn.v
write -format ddc -h -output result/syn/data/ibex_core.rpt.ddc
write_scan_def -output result/scanchain/data/ibex_core.scan.def

set_svf result/syn/data/ibex_core.svf

puts "SYNTHESIS COMPLETE — netlist at result/syn/data/ibex_core.syn.v"
exit
```

---

## Stage 1: Design Init + MMMC (innovus, timeout: 180s)

First stage — no checkpoint to load. Sets up MMMC, loads LEF/netlist, initializes design.

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
cd $design_dir
file mkdir result/pr/data result/pr/log result/pr/report

# Check that timing library exists
set timing_lib $design_dir/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
if {![file exists $timing_lib]} {
    puts "ERROR: Timing library not found: $timing_lib"
    exit 1
}

# Create MMMC setup file first
set mmmc_file [open "result/pr/data/mmmc.view" w]
puts $mmmc_file "create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05"
puts $mmmc_file "create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1"
puts $mmmc_file "create_library_set -name lib_set_max -timing $timing_lib"
puts $mmmc_file "create_library_set -name lib_set_min -timing $timing_lib"
puts $mmmc_file "create_constraint_mode -name common -sdc_files $design_dir/designs/sky130hd/ibex/constraint_for_pr.sdc"
puts $mmmc_file "create_delay_corner -name delay_max -library_set lib_set_max -rc_corner rc_max"
puts $mmmc_file "create_delay_corner -name delay_min -library_set lib_set_min -rc_corner rc_min"
puts $mmmc_file "create_analysis_view -name max_view -constraint_mode common -delay_corner delay_max"
puts $mmmc_file "create_analysis_view -name min_view -constraint_mode common -delay_corner delay_min"
close $mmmc_file

# Set MMMC file BEFORE init_design
set init_mmmc_file result/pr/data/mmmc.view

# Design init (loads LEF, netlist, and MMMC)
set defHierChar {/}
set init_gnd_net VSS
set init_pwr_net VDD
set init_verilog $design_dir/result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_lef_file [list $design_dir/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef $design_dir/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]
init_design

checkDesign -netList -noHtml -outfile result/pr/report/check_data_init.report
timeDesign -prePlace -pathReports -drvReports -slackReports -numPaths 50 -prefix prePlace -outDir result/pr/report/init_data_timing
saveDesign result/pr/data/init_design.enc
exit
```

## Stage 2: Floorplan (innovus, timeout: 120s)

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/init_design.enc

floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile $design_dir/designs/sky130hd/ibex/io.file

# Dont-use cells (Sky130 low-power cells cause issues)
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cells */$cell] true
}

saveDesign result/pr/data/floor_plan.enc
defOut -floorplan -noStdCells result/pr/data/ibex.floorplan.def
exit
```

## Stage 3: Power Planning (innovus, timeout: 120s)

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/floor_plan.enc

globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB VPWR} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS

addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1 -uda power_stripe_v
addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1 -uda power_stripe_h

sroute -connect { corePin } -layerChangeRange { li1(1) met4(4) } -corePinTarget { none } -allowJogging 1 -crossoverViaLayerRange { li1(1) met4(4) } -nets { VDD VSS } -allowLayerChange 1 -targetViaLayerRange { li1(1) met4(4) }

verifyConnectivity -type special -noAntenna -noWeakConnect -noUnroutedNet -error 1000 -warning 50
verify_PG_short -no_routing_blkg
saveDesign result/pr/data/powerplan.enc
exit
```

## Stage 4: Placement (innovus, timeout: 300s)

**CRITICAL:** Use `defIn` (NOT `loadDef` or `loadDefFile`) to load scan chain definitions. The `defIn` command properly merges DEF data with the existing design. The scan DEF file is generated by Stage 0 (synthesis) via `write_scan_def`.

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/powerplan.enc

# Load scan chain definitions from synthesis (required for DFT-aware placement)
# This file is generated by Stage 0 (synthesis) via write_scan_def
defIn $design_dir/result/scanchain/data/ibex_core.scan.def

# Timing derate
set_timing_derate -delay_corner delay_max -early 0.97 -late 1.03 -clock
set_timing_derate -delay_corner delay_max -late 1.05 -data
setAnalysisMode -cppr both

# Path groups
reset_path_groups -all
set reg [filter_collection [all_registers] "is_integrated_clock_gating_cell != true"]
set ckgating [filter_collection [all_registers] "is_integrated_clock_gating_cell == true"]
group_path -name reg2reg -from $reg -to $reg
group_path -name reg2cg -from $reg -to $ckgating
group_path -name in2reg -from [all_inputs]
group_path -name reg2out -to [all_outputs]
group_path -name feedthr -from [all_inputs] -to [all_outputs]
setPathGroupOptions reg2reg -effortLevel high
setPathGroupOptions reg2cg -effortLevel high
setPathGroupOptions in2reg -effortLevel low
setPathGroupOptions reg2out -effortLevel low
setPathGroupOptions feedthr -effortLevel low
setOptMode -ignorePathGroupsForHold {in2reg reg2out feedthr}

# Place settings - match original flow: scan chains loaded via defIn, but ignored during placement
# This allows proper connectivity while optimizing for timing (not scan chain length)
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

place_opt_design
reportCongestion -overflow

timeDesign -preCTS -idealClock -pathReports -drvReports -slackReports -numPaths 50 -prefix preCTS -outDir result/pr/report/placement_timing
saveDesign result/pr/data/placement.enc
exit
```

## Stage 5: CTS (innovus, timeout: 300s)

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/placement.enc

set_ccopt_property use_inverters true

# Enable CTS inverter cells (they are in DONT_USE_CELLS but needed for CTS)
# Original flow uses: sky130_fd_sc_hd__lpflow_clkinvkapwr_1/2/4/8/16
foreach cts_inv_cell {
    sky130_fd_sc_hd__lpflow_clkinvkapwr_1
    sky130_fd_sc_hd__lpflow_clkinvkapwr_2
    sky130_fd_sc_hd__lpflow_clkinvkapwr_4
    sky130_fd_sc_hd__lpflow_clkinvkapwr_8
    sky130_fd_sc_hd__lpflow_clkinvkapwr_16
} {
    setDontUse [get_lib_cells */$cts_inv_cell] false
}
set_ccopt_property inverter_cells [get_lib_cells "sky130_fd_sc_hd__lpflow_clkinvkapwr_*"]

# NDR for clock nets (2x width/spacing)
add_ndr -name cts_1 -width_multiplier "met2:met4 2" -spacing_multiplier "met2:met4 2"
create_route_type -name clk_net_rule -non_default_rule cts_1 -top_preferred_layer met2 -bottom_preferred_layer met4
set_ccopt_property route_type clk_net_rule -net_type trunk
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRouting 2

create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTS -outDir result/pr/report/cts_timing
saveDesign result/pr/data/cts.enc
exit
```

## Stage 6: Post-CTS Optimization (innovus, timeout: 300s)

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/cts.enc

set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true
optDesign -postCTS
optDesign -postCTS -hold

timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTSOpt -outDir result/pr/report/cts_opt_timing
saveDesign result/pr/data/post_cts_opt.enc
exit
```

## Stage 7: Routing (innovus, timeout: 600s)

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/post_cts_opt.enc

# Re-establish timing library (needed after checkpoint restore)
# The library must be explicitly read after source since checkpoint doesn't preserve lib refs
read_libs $design_dir/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib

setNanoRouteMode -quiet -routeWithTimingDriven true
setAnalysisMode -analysisType onChipVariation
setNanoRouteMode -quiet -drouteEndIteration 70
setNanoRouteMode -quiet -drouteFixAntenna true
setNanoRouteMode -quiet -drouteUseMultiCutViaEffort medium
setNanoRouteMode -quiet -routeTopRoutingLayer 6
setNanoRouteMode -quiet -routeBottomRoutingLayer 2
setDelayCalMode -engine default -siAware true

routeDesign -globalDetail

timeDesign -postRoute -prefix postRoute -outDir result/pr/report/routing_timing
saveDesign result/pr/data/routing.enc
exit
```

## Stage 8: Routing Optimization (innovus, timeout: 300s)

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/routing.enc

optDesign -postRoute -setup
timeDesign -postRoute -prefix postRouteOpt -outDir result/pr/report/routing_opt_timing
saveDesign result/pr/data/routing_opt.enc
exit
```

## Stage 9: Chip Finish + GDS Export (innovus, timeout: 300s)

```tcl
# Use HIPILOT_DESIGN_DIR env var if set, otherwise fallback to default
set design_dir [expr {[info exists ::env(HIPILOT_DESIGN_DIR)] ? $::env(HIPILOT_DESIGN_DIR) : "/home/EDA/ibex_work_upload"}]
source $design_dir/result/pr/data/routing_opt.enc

remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

globalNetConnect VDD -type pgpin -pin {VPB} -inst *
globalNetConnect VDD -type pgpin -pin {VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND} -inst *
globalNetConnect VSS -type pgpin -pin {VNB} -inst *
verifyConnectivity -type all -error 1000 -warning 50

# Export
defOut -floorplan -netlist -routing result/pr/data/ibex_routing.def
saveNetlist result/pr/data/ibex_routing.vg
saveNetlist -excludeLeafCell -includePowerGround -flattenBus result/pr/data/ibex_lvs.vg

# RC extraction
setExtractRCMode -engine postRoute
reset_parasitics
extractRC

# GDS
setStreamOutMode -textSize 5 -virtualConnection true -uniquifyCellNamesPrefix true
streamOut result/pr/data/ibex_core.gds -mapFile $design_dir/designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL

saveDesign result/pr/data/chip_done.enc
exit
```
