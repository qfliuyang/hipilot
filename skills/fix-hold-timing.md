---
name: fix-hold-timing
description: >
  Diagnose and fix hold timing violations, primarily post-CTS and
  post-route. Inserts delay (hold) buffers on violating paths, handles
  the interaction with setup slack, and verifies both min and max timing
  after fixes. Covers functional hold and scan hold separately.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path:
    synopsys: templates/synopsys/icc2_fix_hold_timing.tcl
    cadence: templates/cadence/innovus_fix_hold_timing.tcl
  auto_generated: false
  flexible: true
  flow_stages: [post_cts, post_route]
  report_inputs:
    - hold timing report (report_timing -type min)
    - setup timing report (to verify no setup regression)
  qor_metrics: [hold_WNS, hold_TNS, hold_failing_endpoints, setup_WNS]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fix_mode` | string | `post_route` | `post_cts` or `post_route`. Determines whether ideal or propagated clocks are used. |
| `path_group` | string | `""` | Limit to a path group (e.g. `reg2reg`). Empty = all groups. |
| `hold_slack_threshold` | float | `-0.01` | Fix paths with hold slack worse than this (ns). |
| `setup_guard_band` | float | `0.05` | Do not insert hold buffer if it would reduce setup slack below this value (ns). |
| `max_paths` | integer | `200` | Max violating paths to process per iteration. |
| `buffer_cell` | string | `"auto"` | Delay buffer cell to use. `auto` selects from library based on delay needed. |
| `fix_scan_hold` | boolean | `true` | If true, also fix hold violations in the scan capture mode/corner. |
| `max_iterations` | integer | `3` | Hold fix loop limit before stopping. |

---

## Workflow

### Step 1 — Verify this is a real hold problem (not a false path)

Before fixing, confirm the violating paths are real timing paths that must meet hold.

**ICC2:**
```tcl
# Report worst hold violations with full path detail
report_timing -type min \
              -scenario func_ss_125c \
              -path_group reg2reg \
              -max_paths 20 \
              -slack_lesser_than 0.0 \
              -input_pins \
              -nets \
              -skew \
              > /tmp/hold_violations.rpt

# Also check if violations only appear in one scenario
report_timing -type min \
              -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.0
```

**Innovus:**
```tcl
timeDesign -postRoute -hold \
           -pathReports \
           -dataReports \
           -outDir ./timing_rpt/hold_check

# Or quick interactive check
report_timing -type hold \
              -max_paths 20 \
              -slack_lesser_than 0 \
              -input_pins -net
```

**Checklist before proceeding:**
- [ ] Violations appear in propagated-clock scenarios (not ideal-clock modes)
- [ ] Launch and capture clocks are not false-path or multi-cycle constrained
- [ ] Violations are not caused by a CDC path that should be false-pathed
- [ ] Both functional (`func_ss`) and hold-specific (`func_ff_m40c`) corners checked

---

### Step 2 — Understand hold violation anatomy

A hold violation means:
```
data_arrival_time < capture_clock_arrival_time + hold_time
```
i.e., the data arrives so fast (or the clock is so late at the capture FF) that the capture register samples the new data before it has a chance to "hold" the old value.

**Common causes:**

| Cause | What you see | Fix |
|-------|-------------|-----|
| Clock arriving late at capture (positive skew) | Large `clock_skew` in report, capture clock latency >> launch latency | CTS skew adjustment OR hold buffer on data |
| Very short data path (near-zero logic) | Path is a direct D→Q connection with few gates | Insert delay buffer on data path |
| Hold corner (FF, low temp) — fast cells | Violations only in `ff_m40c` or `ff_0.9v_m40c` corner | Expected; fix with delay buffers |
| Regenerated clock with extra skew | CTS added skew group; one domain faster than another | Skew group rebalancing or hold buffers |
| ECO setup fix introduced new hold violation | Hold violation appeared after setup ECO | Hold buffer on path affected by ECO |

---

### Step 3 — Run automated hold fixing

**ICC2 — post-CTS hold fix:**
```tcl
# Set effort level: low, medium, high
# Always start with low; inspect results before escalating
fix_eco_timing -type hold \
               -scenarios {func_ss_125c func_ff_m40c} \
               -path_group reg2reg \
               -slack_lesser_than 0.0 \
               -effort low

# After fix, legalize
legalize_placement -incremental
```

**ICC2 — post-route hold fix (ECO route after insertion):**
```tcl
fix_eco_timing -type hold \
               -scenarios {func_ss_125c func_ff_m40c} \
               -slack_lesser_than 0.0 \
               -effort medium

legalize_placement -incremental

# Re-route only the modified nets
route_eco -max_detail_route_iterations 5
```

**Innovus — post-CTS hold fix:**
```tcl
setOptMode -holdFixing true \
           -holdTargetSlack 0.0 \
           -setupTargetSlack 0.05

optDesign -postCTS -hold
```

**Innovus — post-route hold fix:**
```tcl
setOptMode -holdFixing true \
           -holdTargetSlack 0.0 \
           -setupTargetSlack 0.05 \
           -maxDensity 0.95

optDesign -postRoute -hold

# Re-route ECO nets after hold buffer insertion
routeDesign -globalDetail
```

---

### Step 4 — Manual hold buffer insertion (for residual or targeted fixes)

Use this when automated fixing leaves residual violations on specific paths, or when the automatic fixer is making poor cell choices.

**Find delay needed:**
```
hold_buffer_delay_needed = |hold_slack| + hold_time_of_FF + margin (0.02 ns)
```

**ICC2 — insert a specific delay buffer:**
```tcl
# Insert DLYB (delay buffer) on a specific net
insert_buffer -net u_core/result_valid \
              -cell sky130_fd_sc_hd__dlygate4sd3_1 \
              -location {320.5 410.2}

# Check the delay provided by the chosen cell
report_lib_cell -lib sky130_fd_sc_hd__dlygate4sd3_1 -timing
```

**Innovus — insert buffer on specific net:**
```tcl
addBuffer -net u_core/result_valid \
          -cell sky130_fd_sc_hd__dlygate4sd3_1

# Verify new hold slack on this path
report_timing -from [get_pins u_core/reg_out/D] \
              -type hold \
              -max_paths 1
```

**sky130hd delay buffer options (smallest to largest delay):**

| Cell | Typical delay (tt_25c) | Use when |
|------|----------------------|----------|
| `sky130_fd_sc_hd__buf_1` | ~0.05 ns | Need < 0.1 ns hold fix |
| `sky130_fd_sc_hd__dlygate4sd1_1` | ~0.15 ns | Need 0.1–0.2 ns hold fix |
| `sky130_fd_sc_hd__dlygate4sd2_1` | ~0.25 ns | Need 0.2–0.35 ns hold fix |
| `sky130_fd_sc_hd__dlygate4sd3_1` | ~0.4 ns | Need 0.35–0.55 ns hold fix |

Cascade two cells if needed; never insert more than 3 in series (creates long path that is hard to route and risks setup degradation).

---

### Step 5 — Verify setup slack has not degraded

Every hold buffer adds delay to the data path. This directly consumes setup slack margin at the capture FF.

**ICC2:**
```tcl
# Check both min and max timing after hold fixes
update_timing -full

report_timing -type max \
              -scenario func_ss_125c \
              -path_group reg2reg \
              -max_paths 50 \
              -slack_lesser_than 0.1 \
              > /tmp/setup_after_hold_fix.rpt

report_timing -type min \
              -scenario func_ff_m40c \
              -path_group reg2reg \
              -max_paths 50 \
              -slack_lesser_than 0.0 \
              > /tmp/hold_after_fix.rpt
```

**Innovus:**
```tcl
timeDesign -postRoute -pathReports -dataReports -outDir ./timing_rpt/after_hold_fix
timeDesign -postRoute -hold -pathReports -outDir ./timing_rpt/after_hold_fix
```

**Pass criteria:**
- Hold WNS >= 0.0 ns in all corners
- Setup WNS has not degraded more than `setup_guard_band` (default 0.05 ns)
- If setup regresses beyond the guard band: remove the hold buffers on those paths and use a CTS skew adjustment instead (see Step 6)

---

### Step 6 — Address skew-induced hold (alternative to buffering)

When hold violations are caused by large positive clock skew (capture clock significantly later than launch), adding data-path delay is wasteful. A better fix is to reduce the skew.

**ICC2 — adjust CTS skew group:**
```tcl
# Check current skew between two flip-flops
report_clock_timing -type skew \
                    -clock clk \
                    -from_pin u_mac/reg_a/CK \
                    -to_pin u_mac/reg_b/CK

# Add a skew constraint (balance the tree more tightly)
set_clock_tree_options -target_skew 0.08 \
                       -clock clk

# Re-run CTS for the affected sub-tree (only if not in post-route)
clock_opt -from build_clock -to build_clock
```

**Innovus — adjust CTS skew target:**
```tcl
setCTSMode -targetSkew 0.08 -engine ccopt
ccopt_design

# Verify skew improvement
report_clock_timing -type summary
```

Note: CTS re-runs are only feasible pre-route. Post-route, use hold buffers.

---

### Step 7 — Fix scan hold violations

Scan hold violations (in `scan_capture` or `shift` mode) are separate from functional hold. They are caused by the scan chain topology, not clock skew.

**ICC2:**
```tcl
# Check scan mode hold
report_timing -type min \
              -scenario scan_capture_ff \
              -max_paths 20 \
              -slack_lesser_than 0.0

fix_eco_timing -type hold \
               -scenarios {scan_capture_ff} \
               -effort low
```

**Innovus:**
```tcl
setAnalysisMode -analysisType onChipVariation \
                -cppr both

setOptMode -holdFixing true
optDesign -postRoute -hold
```

Scan hold buffers are inserted in scan paths. Verify that scan chain connectivity is preserved after ECO:
```tcl
# ICC2
check_scan_chain -design [current_design]

# Innovus
verifyScanChain
```

---

### Step 8 — Final verification and checkpoint

**ICC2:**
```tcl
update_timing -full

# Final hold report
report_timing -type min \
              -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.0

# Final setup report (confirm no regression)
report_timing -type max \
              -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.0

save_block -as post_hold_fix
```

**Innovus:**
```tcl
timeDesign -postRoute -hold -pathReports -outDir ./timing_rpt/hold_final
timeDesign -postRoute       -pathReports -outDir ./timing_rpt/setup_final
saveDesign ./checkpoints/post_hold_fix.enc
```

---

## Core Principles

1. **Post-CTS is the right time to fix hold.** Pre-CTS hold fixes are often undone by CTS. Post-route hold fixes require re-routing. Post-CTS is the sweet spot.

2. **Hold violations at FF corner only are expected.** If violations only exist in `ff_m40c` or equivalent, that is the correct behavior — fast cells at cold temperature produce short paths. This is the primary use case for hold buffers.

3. **Never fix hold pre-CTS with real delay buffers** unless you are working in a skew-aware flow. CTS will route around your buffers and undo the fix.

4. **Hold fix consumes setup margin.** Every 0.1 ns of hold buffer = 0.1 ns less setup slack at that endpoint. Track the setup margin budget as you add hold buffers.

5. **Scan hold is separate from functional hold.** Always verify both modes independently. A functional hold fix may not affect scan paths at all.

6. **Prefer skew reduction over buffering for skew-dominated violations.** If `clock_skew > 0.5 * hold_slack`, fixing skew is more efficient than buffering.

---

## What Can Go Wrong

- **`fix_eco_timing` inserts too many buffers.** At `effort high`, the tool can insert hundreds of buffers and degrade setup across the chip. Always start at `effort low` and check the count of inserted cells before proceeding.
- **Hold buffer placed in congested area causes DRC.** Run `verify_drc` after placement legalization. If violations appear, move the buffer to a less congested site manually.
- **Scan chain broken by ECO.** Buffer insertion in scan paths can disconnect the scan chain if not done carefully. Always run `check_scan_chain` / `verifyScanChain` after hold ECO.
- **Violations only at `ideal_clock` corner.** This is not a real problem — ideal clocks do not model skew. Only fix violations seen in propagated-clock corners.
- **Hold fix at post-CTS undone at post-route.** Route optimization (`route_opt`, `optDesign -postRoute`) can remove hold buffers it deems unnecessary. Always re-check hold after every routing optimization step.

---

## Example Usage

```
/fix-hold-timing

# or with parameters:
/fix-hold-timing fix_mode=post_route hold_slack_threshold=-0.02 setup_guard_band=0.08
```

**Typical session dialogue:**

> "After post-route opt, I have 23 hold violations in func_ff_m40c. WNS is -0.08 ns. Setup looks clean at -0.02 ns WNS."

HiPilot will:
1. Parse the hold report, confirm violations are in propagated-clock corner
2. Check whether skew or short paths are the root cause
3. Select appropriate delay buffer cells from sky130hd
4. Show Tcl for `fix_eco_timing` with `effort low` first
5. After approval and execution, parse new hold WNS and setup WNS
6. Confirm both are clean or propose next iteration

---

## Lessons Learned

- On sky130hd, `dlygate4sd3_1` is the go-to hold buffer — well-characterized across corners.
- Innovus `optDesign -postRoute -hold` is generally safe but can be slow on large designs (>500k cells). Use `-incr` flag for incremental mode.
- ICC2's `fix_eco_timing` will not touch nets marked `dont_touch`. Check for unintentional `dont_touch` constraints if violations are not being fixed.
- At -40°C (FF corner), hold violations are typically 2–3× worse than at 25°C. Size your delay buffer with the cold-temperature delay table.
- Always run hold verification in CPPR (clock path pessimism removal) mode. Without CPPR, hold violations are over-pessimistic and lead to over-fixing.
