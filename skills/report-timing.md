---
name: report-timing
description: >
  Run, configure, and interpret timing reports at any flow stage. Covers
  setup and hold analysis, path group filtering, multi-corner multi-mode
  (MCMM) reporting, understanding slack/WNS/TNS, and common options for
  both ICC2 and Innovus. Also covers PrimeTime signoff reporting.

hipilot:
  vendor: [synopsys, cadence, synopsys_pt]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    synopsys_pt: "pt_shell T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: false
  auto_generated: false
  flexible: true
  flow_stages: [post_synth, post_place, post_cts, post_route, signoff]
  report_inputs: []
  qor_metrics: [WNS, TNS, failing_endpoints, setup_WNS, hold_WNS]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `analysis_type` | string | `setup` | `setup`, `hold`, or `both`. |
| `path_group` | string | `""` | Filter to a specific path group. Empty = all. |
| `max_paths` | integer | `10` | Number of paths per path group in detailed report. |
| `corners` | list | `[all]` | List of scenario/corner names, or `all`. |
| `detail_level` | string | `full` | `summary`, `short`, or `full`. |
| `output_file` | string | `""` | Write report to this file path. Empty = stdout. |
| `cppr` | boolean | `true` | Enable clock path pessimism removal. Should always be true for propagated-clock analysis. |

---

## Workflow

### Step 1 — Understand what you are asking for

Before running, clarify the intent:

| Intent | Command to use |
|--------|---------------|
| "Is my design timing clean?" | Summary report across all scenarios |
| "What are my worst setup paths?" | Detailed `max` paths, worst slack first |
| "Where are my hold violations?" | `min` path report with `slack_lesser_than 0` |
| "What is the QoR for this stage?" | `report_constraint` or `report_analysis_summary` |
| "Debug why this specific path is failing" | `from/through/to` targeted path report |
| "Signoff check" | PrimeTime `report_timing` with SI and CPPR |

---

### Step 2 — Quick timing summary (fast, first look)

Run this after every major step to get a headline number.

**ICC2:**
```tcl
# Setup summary across all scenarios
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.5

# Hold summary
report_timing -type min \
              -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.0
```

**ICC2 — full QoR table (all path groups, all scenarios):**
```tcl
report_constraint -all_violators \
                  -scenarios [all_scenarios] \
                  -verbose
```

**Innovus:**
```tcl
# Quick summary
report_timing -max_paths 1 -slack_lesser_than 0 -path_type summary

# Full analysis summary (generates HTML + text)
report_analysis_summary
```

**PrimeTime (signoff):**
```tcl
report_timing -path_type summary \
              -delay_type max \
              -group [all_path_groups] \
              -slack_lesser_than 0.5 \
              -nosplit
```

---

### Step 3 — Detailed setup (max) timing report

Use this to understand exactly where setup violations come from.

**ICC2:**
```tcl
report_timing -scenario func_ss_0p72v_125c \
              -path_group reg2reg \
              -path_type full_clock_expanded \
              -max_paths 20 \
              -nworst 3 \
              -slack_lesser_than 0.0 \
              -input_pins \
              -nets \
              -transition_time \
              -capacitance \
              -crosstalk_delta \
              -derate \
              > /tmp/setup_detail.rpt
```

**Innovus:**
```tcl
report_timing -path_type full \
              -max_paths 20 \
              -nworst 3 \
              -slack_lesser_than 0 \
              -input_pins \
              -net \
              -skew \
              > /tmp/setup_detail.rpt
```

**PrimeTime:**
```tcl
report_timing -delay_type max \
              -path_type full_clock_expanded \
              -max_paths 20 \
              -nworst 3 \
              -slack_lesser_than 0 \
              -input_pins \
              -nets \
              -transition_time \
              -capacitance \
              -nosplit \
              > /tmp/setup_detail_pt.rpt
```

---

### Step 4 — Detailed hold (min) timing report

**ICC2:**
```tcl
report_timing -type min \
              -scenario func_ff_m40c \
              -path_group reg2reg \
              -path_type full_clock_expanded \
              -max_paths 20 \
              -slack_lesser_than 0.0 \
              -input_pins \
              -nets \
              -skew \
              > /tmp/hold_detail.rpt
```

**Innovus:**
```tcl
report_timing -type hold \
              -max_paths 20 \
              -slack_lesser_than 0 \
              -input_pins -net \
              > /tmp/hold_detail.rpt
```

**PrimeTime:**
```tcl
report_timing -delay_type min \
              -path_type full_clock_expanded \
              -max_paths 20 \
              -slack_lesser_than 0 \
              -input_pins \
              -nets \
              -nosplit \
              > /tmp/hold_detail_pt.rpt
```

---

### Step 5 — Interpreting a timing report

A typical path entry looks like this (ICC2 format):

```
  Point                                   Incr       Path
  ------------------------------------------------------------
  clock clk (rise edge)                   0.000      0.000
  clock network delay (propagated)        0.312      0.312
  u_core/reg_a/CK (DFFRX1)               0.000      0.312 r
  u_core/reg_a/Q (DFFRX1)                0.134      0.446 r
  u_core/U42/A (NAND2X1)                 0.000      0.446 r
  u_core/U42/Y (NAND2X1)                 0.087      0.533 f
  u_core/U18/A (INVX1)                   0.000      0.533 f
  u_core/U18/Y (INVX1)                   0.052      0.585 r
  u_core/reg_b/D (DFFRX1)                0.000      0.585 r
  data arrival time                                  0.585

  clock clk (rise edge)                   1.000      1.000
  clock network delay (propagated)        0.278      1.278
  u_core/reg_b/CK (DFFRX1)               0.000      1.278 r
  library setup time                     -0.032      1.246
  data required time                                 1.246
  ------------------------------------------------------------
  data required time                                 1.246
  data arrival time                                 -0.585
  slack (MET)                                        0.661
```

**Key fields to understand:**

| Field | Meaning |
|-------|---------|
| `data arrival time` | How long data takes from launch FF Q to capture FF D |
| `data required time` | Latest time data can arrive at capture D (= clock_period + capture_clock_latency - setup_time) |
| `slack` | `required - arrival`. Positive = timing met. Negative = violation. |
| `WNS` | Worst Negative Slack — the single worst slack value across all failing paths |
| `TNS` | Total Negative Slack — sum of all negative slacks (measure of how much work remains) |
| `clock network delay` | Time from clock source to the register's clock pin (clock tree latency) |
| `Incr` column | Incremental delay through each stage (gate + net + RC) |
| `r` / `f` suffix | Rising or falling transition at that pin |
| `library setup time` | Negative value subtracted from required time — setup margin consumed by the FF |

**Identifying the bottleneck:**

Look at the `Incr` column. The largest single increment is the bottleneck:
- Large increment at a **cell output** → undersized driver (upsize the cell)
- Large increment at a **net** → long or high-capacitance net (insert buffer)
- Many small increments across 10+ gates → deep logic (restructure or retime)

---

### Step 6 — Path group filtering

Path groups determine which endpoints are grouped in WNS/TNS reporting. Understanding them prevents misinterpreting headlines.

**Common default path groups:**

| Group name | What it covers |
|-----------|---------------|
| `reg2reg` | Register-to-register paths (sequential logic) |
| `in2reg` | Input port to register (constrained by `set_input_delay`) |
| `reg2out` | Register to output port |
| `in2out` | Input directly to output (combinational) |
| `REGIN` | ICC2 default name for input-constrained paths |
| `REGOUT` | ICC2 default name for output-constrained paths |

**ICC2 — report one group only:**
```tcl
report_timing -path_group reg2reg \
              -max_paths 10 \
              -slack_lesser_than 0
```

**Innovus — report one group only:**
```tcl
report_timing -pathGroup reg2reg \
              -max_paths 10 \
              -slack_lesser_than 0
```

**Tip:** `in2out` paths through combinational logic often have very large slack numbers that inflate TNS. If WNS looks fine but TNS is enormous, check if `in2out` paths are constrained correctly.

---

### Step 7 — Multi-corner multi-mode (MCMM) reporting

Real designs have multiple scenarios (combinations of corner + mode). Always check all relevant scenarios.

**ICC2 — list all scenarios and their active status:**
```tcl
report_scenarios

# Check which scenarios are active
get_scenarios -active
```

**ICC2 — report WNS per scenario:**
```tcl
foreach_in_collection sc [get_scenarios] {
    set name [get_attribute $sc name]
    set wns [get_attribute [get_timing_paths -max_paths 1 \
                            -scenario $name \
                            -slack_lesser_than 0] slack]
    echo "Scenario $name : WNS = $wns"
}
```

**Innovus — report all active analysis views:**
```tcl
report_analysis_summary -views [all_views]

# Or per-view detail
foreach view [get_analysis_views] {
    report_timing -view $view -max_paths 1 -path_type summary
}
```

**Typical scenario set for a full-chip design:**

| Scenario | Mode | Corner | Purpose |
|----------|------|--------|---------|
| `func_ss_125c` | functional | SS, 125°C | Worst-case setup |
| `func_ff_m40c` | functional | FF, -40°C | Worst-case hold |
| `func_tt_25c` | functional | TT, 25°C | Typical performance |
| `scan_shift_ff` | scan_shift | FF | Scan shift hold |
| `scan_capture_ss` | scan_capture | SS | Scan capture setup |

---

### Step 8 — Report timing on a specific path (debug mode)

When you need to debug exactly one path:

**ICC2:**
```tcl
# By specific endpoints
report_timing -from [get_pins u_core/reg_a/CK] \
              -to   [get_pins u_core/reg_b/D] \
              -path_type full_clock_expanded \
              -input_pins -nets -transition_time -capacitance

# Through a specific cell
report_timing -through [get_cells u_core/U_critical_gate] \
              -max_paths 5 \
              -path_type full_clock_expanded
```

**Innovus:**
```tcl
report_timing -from u_core/reg_a/CK \
              -to   u_core/reg_b/D \
              -path_type full \
              -input_pins -net

# Through a net
report_timing -through_net u_core/data_critical \
              -max_paths 5
```

**PrimeTime:**
```tcl
report_timing -from [get_pins u_core/reg_a/CK] \
              -to   [get_pins u_core/reg_b/D] \
              -delay_type max \
              -path_type full_clock_expanded \
              -input_pins -nets -nosplit
```

---

### Step 9 — Clock timing report

Understand clock tree quality (latency, skew, slew) independently of data paths.

**ICC2:**
```tcl
# Clock latency to all FFs on a clock
report_clock_timing -type latency \
                    -clock clk \
                    -scenario func_ss_125c

# Skew summary
report_clock_timing -type skew \
                    -clock clk \
                    -scenario func_ss_125c \
                    -max_paths 10

# Clock transition (slew)
report_clock_timing -type transition \
                    -clock clk \
                    -max_trans 0.2
```

**Innovus:**
```tcl
report_clock_timing -type summary
report_clock_timing -type skew -clk clk
```

---

### Step 10 — Generate reports for signoff (PrimeTime)

For formal signoff, reports must be generated in PrimeTime with SI (signal integrity) enabled.

```tcl
# In pt_shell
set_app_var si_enable_analysis true

# Load design, parasitics, and constraints (already done in flow)

# Setup signoff report
report_timing -delay_type max \
              -path_type full_clock_expanded \
              -max_paths 100 \
              -nworst 10 \
              -slack_lesser_than 0.0 \
              -input_pins \
              -nets \
              -transition_time \
              -capacitance \
              -crosstalk_delta \
              -nosplit \
              > ./reports/pt_setup_signoff.rpt

# Hold signoff report
report_timing -delay_type min \
              -path_type full_clock_expanded \
              -max_paths 100 \
              -slack_lesser_than 0.0 \
              -input_pins \
              -nets \
              -nosplit \
              > ./reports/pt_hold_signoff.rpt

# QoR summary
report_constraint -all_violators -nosplit > ./reports/pt_constraint.rpt
```

---

## PrimeTime Static Timing Analysis

PrimeTime is the industry-standard signoff timing analysis tool. It provides gold-standard timing verification after physical design.

### PrimeTime vs Innovus STA

| Aspect | Innovus | PrimeTime |
|--------|---------|-----------|
| Purpose | Optimization during P&R | Signoff verification |
| Timing accuracy | Estimated | Signoff-quality |
| Library format | .lib or .db | **.db only** |
| SDC support | Extended | Standard only |

### Library Setup (CRITICAL)

**IMPORTANT:** PrimeTime requires `.db` format libraries, NOT `.lib` files.

```tcl
# CORRECT: Use .db files
set target_library $lib_path/sky130_fd_sc_hd__tt_025C_1v80.db
set link_library "* $target_library"

# WRONG: .lib files require Library Compiler
# PrimeTime will fail with "Library Compiler executable path is not set"
```

### SDC Compatibility

PrimeTime uses strict SDC syntax. Some Design Compiler constructs are not valid:

```tcl
# WRONG in PrimeTime SDC
current_design ibex_core  ;# Not valid SDC, remove this

# WRONG in some PrimeTime versions
set non_clock_inputs [all_inputs -no_clock]  ;# -no_clock may not work

# CORRECT alternative
set non_clock_inputs [get_ports -filter "direction == in && name != clk_i"]
```

### Complete PrimeTime Script Template

```tcl
#!/usr/bin/tclsh
# pt_sta.tcl - PrimeTime STA script

#===========================================
# Configuration
#===========================================
set design ibex_core
set lib_path /path/to/pdk/lib
set netlist_path /path/to/netlist.v

#===========================================
# Library Setup (use .db files!)
#===========================================
set target_library $lib_path/sky130_fd_sc_hd__tt_025C_1v80.db
set link_library "* $target_library"

#===========================================
# Read Design
#===========================================
read_verilog $netlist_path
current_design $design
link_design

#===========================================
# Constraints (SDC without current_design!)
#===========================================
# Do NOT include "current_design" in SDC file
read_sdc constraints.sdc

# Or define inline:
# create_clock -name clk_i -period 10.0 [get_ports clk_i]
# set_input_delay 0.5 -clock clk_i [get_ports -filter "direction == in && name != clk_i"]
# set_output_delay 0.5 -clock clk_i [all_outputs]

#===========================================
# Update and Report
#===========================================
update_timing

# Setup timing (max delay)
echo "=== SETUP TIMING ==="
report_timing -max_paths 10 -delay max

# Hold timing (min delay)
echo "=== HOLD TIMING ==="
report_timing -max_paths 10 -delay min

# QoR summary
report_qor

exit
```

### Running PrimeTime

```bash
# Run PrimeTime with script
pt_shell -f pt_sta.tcl

# Or interactively
pt_shell
```

### Common Errors

#### "Library Compiler executable path is not set"

**Cause:** Trying to read .lib file instead of .db
**Fix:** Convert .lib to .db, or use existing .db file

#### "No constrained timing paths found"

**Cause:** SDC constraints not applied correctly
**Fix:**
1. Remove `current_design` from SDC file
2. Check clock was created: `report_clocks`
3. Check ports match: `get_ports *`

#### "unknown option '-no_clock'"

**Cause:** PrimeTime version doesn't support this option
**Fix:** Use `get_ports -filter` instead

### Skywater 130nm Example

```bash
# Tested on PrimeTime T-2022.03
cd /home/EDA/hipilot_test/ibex_work_upload
pt_shell -f scripts/pt_sta.tcl

# Expected output:
# Setup WNS: >= 0 (MET)
# Hold WNS: >= 0 (MET)
# Clock: core_clock, Period: 17.40ns
```

---

## Core Principles

1. **Always report with propagated clocks.** Ideal-clock timing reports are useful only in synthesis. Post-CTS and post-route reports must use propagated clocks to include real clock tree latency and skew.

2. **WNS is the headline; TNS is the workload.** WNS tells you how far you are from closure. TNS tells you how much ECO work remains. Both matter — a design with WNS = -0.01 but TNS = -500 ns has hundreds of paths to fix.

3. **Report all scenarios before claiming clean.** A design can be setup-clean in the TT corner and violating badly in SS. Never report only the typical corner.

4. **CPPR must be on for hold.** Clock path pessimism removal (CPPR) is essential for accurate hold analysis. Without it, the tool double-counts on-chip variation on the common portion of the clock path, leading to pessimistic hold violations.

5. **`path_type full_clock_expanded` for debugging.** The default path type hides clock network detail. Use `full_clock_expanded` when debugging to see the full clock arrival breakdown.

6. **Signoff is in PrimeTime, not in the P&R tool.** ICC2 and Innovus are "implementation timers" — they give good guidance but are not the authoritative signoff tool. Always run PrimeTime before tape-out.

---

## What Can Go Wrong

- **Large TNS but WNS looks good.** Check if path groups are configured correctly. If `in2out` paths are not properly constrained, they can contribute bogus TNS.
- **`report_timing` hangs on large designs.** Add `-max_paths` to limit. Without it, the tool may attempt to enumerate millions of paths. Start with `-max_paths 10` for interactive use.
- **Clock timing not propagated.** If you see `ideal` in the clock network section of a path report, propagated clocks are not set up. Run `propagate_clocks` (ICC2) or `set_propagated_clock` (PT) first.
- **Scenarios missing from report.** If you recently changed the constraint set, run `update_timing -full` (ICC2) or `update_timing` (Innovus) before reporting.
- **Output report is empty.** Check `slack_lesser_than` threshold. If all paths meet timing, no paths will appear with `slack_lesser_than 0`. Use `slack_lesser_than 0.5` to see paths with margin less than 0.5 ns.

---

## Example Usage

```
/report-timing

# or with parameters:
/report-timing analysis_type=both corners=[func_ss_125c,func_ff_m40c] max_paths=50
/report-timing analysis_type=setup detail_level=summary
```

**Typical session dialogue:**

> "I just finished post-CTS optimization. Can you run a timing report and tell me where I stand?"

HiPilot will:
1. Detect the current flow stage (post-CTS from design state)
2. Run `report_timing` with propagated clocks across all scenarios
3. Parse WNS, TNS, and failing endpoint count per path group
4. Show a formatted summary table
5. Highlight the worst path and identify the likely root cause
6. Suggest next action (continue to routing, or run fix-setup/fix-hold first)
