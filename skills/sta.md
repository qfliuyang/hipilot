---
name: sta
description: >
  Static Timing Analysis with PrimeTime. Covers design loading,
  constraint application, timing analysis, and signoff reporting.

hipilot:
  vendors: [synopsys]
  tools:
    synopsys: [pt_shell]
  flow_stages: [sta]
  triggers:
    - "run sta"
    - "prime time"
    - "pt shell"
    - "timing signoff"
    - "static timing analysis"
  qor_metrics: [WNS, TNS, Setup_Violations, Hold_Violations]
  risk_level: low
  typical_duration: "5-30 minutes depending on design size"
---

# PrimeTime STA

## Quick Reference

```
User: "run STA"
```

HiPilot will:
1. Load design (netlist + SPEF)
2. Apply timing constraints
3. Run setup analysis
4. Run hold analysis
5. Generate signoff reports

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| Post-route signoff | Full STA analysis |
| Timing regression | Compare with previous |
| Hold analysis | Check hold violations |
| ECO verification | Verify ECO timing |

**Prerequisites:**
- Routed netlist (Verilog)
- SPEF file (parasitics)
- SDC constraints

---

## STA Workflow

### Step 1: Start PrimeTime

```bash
# Start PrimeTime shell
pt_shell

# Or with GUI
pt_shell -gui
```

### Step 2: Configure Environment

```tcl
# Set search paths
set search_path [list ./netlist ./constraints ./spef /tech/sky130hd/lib]

# Target libraries
set target_library "sky130_fd_sc_hd__tt_025C_1v80.db"
set link_library "* sky130_fd_sc_hd__tt_025C_1v80.db"

# For multi-corner
set target_library "sky130_fd_sc_hd__ss_025C_1v80.db sky130_fd_sc_hd__tt_025C_1v80.db sky130_fd_sc_hd__ff_025C_1v80.db"
set link_library "* $target_library"
```

### Step 3: Load Design

```tcl
# Read netlist
read_verilog netlist/ibex_routing.vg

# Set top-level
current_design ibex_core

# Link design
link
```

### Step 4: Load Parasitics

```tcl
# Read SPEF
read_spef -rc_corner rc_tt spef/ibex.spef

# For multi-corner
read_spef -rc_corner rc_ss spef/ibex_ss.spef
read_spef -rc_corner rc_ff spef/ibex_ff.spef
```

### Step 5: Apply Constraints

```tcl
# Read SDC
read_sdc constraints/ibex.sdc

# Or define inline
create_clock -name clk_i -period 10.0 [get_ports clk_i]
set_input_delay -clock clk_i 0.5 [all_inputs]
set_output_delay -clock clk_i 0.5 [all_outputs]
set_load 0.1 [all_outputs]
set_driving_cell -lib_cell BUF_X4 [all_inputs]
```

### Step 6: Run Timing Analysis

```tcl
# Update timing
update_timing

# Report timing
report_timing -max_paths 20

# Report violations
report_constraint -all_violators
```

---

## Multi-Corner Analysis

### Setup Analysis (Slow Corner)

```tcl
# Slow corner analysis
set_operating_conditions -analysis_type on_chip_variation \
    -max_library sky130_fd_sc_hd__ss_025C_1v80 \
    -max rc_ss

report_timing -delay_type max -max_paths 20
```

### Hold Analysis (Fast Corner)

```tcl
# Fast corner analysis
set_operating_conditions -analysis_type on_chip_variation \
    -min_library sky130_fd_sc_hd__ff_025C_1v80 \
    -min rc_ff

report_timing -delay_type min -max_paths 20
```

### Multi-Mode Multi-Corner (MMMC)

```tcl
# Define scenarios
create_scenario -name func_ss -mode functional -corner ss
create_scenario -name func_ff -mode functional -corner ff

# Run all scenarios
update_timing -scenarios {func_ss func_ff}

# Report per scenario
report_timing -scenario func_ss -max_paths 10
report_timing -scenario func_ff -delay_type min -max_paths 10
```

---

## Signoff Reports

### Timing Summary

```tcl
# Overall summary
report_timing -max_paths 50 > reports/sta_timing.rpt

# Setup violations
report_timing -delay_type max -slack_lesser_than 0 -max_paths 50 > reports/setup_violations.rpt

# Hold violations
report_timing -delay_type min -slack_lesser_than 0 -max_paths 50 > reports/hold_violations.rpt

# Path summary
report_timing -max_paths 20 -significant_digits 4 -path_type full_clock_expanded > reports/path_detail.rpt
```

### Constraint Report

```tcl
# All constraint violations
report_constraint -all_violators > reports/constraint_violations.rpt

# Max transition
report_constraint -max_transition -violators > reports/max_transition.rpt

# Max capacitance
report_constraint -max_capacitance -violators > reports/max_capacitance.rpt
```

### QoR Summary

```tcl
# Quality of results
report_qor > reports/qor.rpt

# Design stats
report_design > reports/design_stats.rpt
```

---

## Signoff Criteria

| Metric | Pass | Warning | Fail |
|--------|------|---------|------|
| Setup WNS | >= 0 | -0.01ns to 0 | < -0.01ns |
| Hold WNS | >= 0 | -0.005ns to 0 | < -0.005ns |
| Max Trans | Clean | < 10 violators | >= 10 violators |
| Max Cap | Clean | < 10 violators | >= 10 violators |

---

## Common Issues

### Issue 1: Setup Violations

**Symptoms:** Negative slack on setup paths

**Fix:**
```tcl
# Analyze critical paths
report_timing -slack_lesser_than 0 -max_paths 50

# Suggest ECO fix
# Note: ECO must be done in P&R tool
```

### Issue 2: Hold Violations

**Symptoms:** Negative slack on hold paths

**Fix:**
```tcl
# Analyze hold paths
report_timing -delay_type min -slack_lesser_than 0 -max_paths 50

# Suggest ECO fix (insert delay)
# Note: ECO must be done in P&R tool
```

### Issue 3: Unconstrained Paths

**Symptoms:** "No constrained timing paths found"

**Fix:**
```tcl
# Check clock definitions
report_clocks

# Check timing exceptions
report_timing_exceptions

# Verify all ports constrained
check_timing
```

---

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# sta.tcl - PrimeTime STA script

#===========================================
# Configuration
#===========================================
set DESIGN_NAME "ibex_core"
set CLOCK_NAME "clk_i"
set CLOCK_PERIOD 10.0

#===========================================
# Library Setup
#===========================================
set search_path [list ./netlist ./constraints ./spef /tech/sky130hd/lib]
set target_library "sky130_fd_sc_hd__ss_025C_1v80.db sky130_fd_sc_hd__tt_025C_1v80.db sky130_fd_sc_hd__ff_025C_1v80.db"
set link_library "* $target_library"

#===========================================
# Load Design
#===========================================
echo "Loading design..."
read_verilog netlist/${DESIGN_NAME}_routing.vg
current_design $DESIGN_NAME
link

#===========================================
# Load Parasitics
#===========================================
echo "Loading parasitics..."
read_spef -rc_corner rc_ss spef/${DESIGN_NAME}_ss.spef
read_spef -rc_corner rc_tt spef/${DESIGN_NAME}.spef
read_spef -rc_corner rc_ff spef/${DESIGN_NAME}_ff.spef

#===========================================
# Apply Constraints
#===========================================
echo "Applying constraints..."
read_sdc constraints/${DESIGN_NAME}.sdc

#===========================================
# Update Timing
#===========================================
echo "Updating timing..."
update_timing

#===========================================
# Setup Analysis (SS Corner)
#===========================================
echo "Running setup analysis..."
set_operating_conditions -max_library sky130_fd_sc_hd__ss_025C_1v80 -max rc_ss
report_timing -delay_type max -max_paths 50 > reports/sta_setup.rpt
report_constraint -all_violators -max_delay > reports/setup_violations.rpt

#===========================================
# Hold Analysis (FF Corner)
#===========================================
echo "Running hold analysis..."
set_operating_conditions -min_library sky130_fd_sc_hd__ff_025C_1v80 -min rc_ff
report_timing -delay_type min -max_paths 50 > reports/sta_hold.rpt
report_constraint -all_violators -min_delay > reports/hold_violations.rpt

#===========================================
# Summary Reports
#===========================================
echo "Generating summary reports..."
report_qor > reports/sta_qor.rpt
report_design > reports/design_stats.rpt

echo "STA complete!"
exit
```

---

## MCP Commands (For Claude Code)

### Load Design
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "read_verilog /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_routing.vg; current_design ibex_core; link"
}'
```

### Read SPEF
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "read_spef -rc_corner rc_tt /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex.spef"
}'
```

### Read SDC
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "read_sdc /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc"
}'
```

### Report Timing
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "update_timing; report_timing -max_paths 10"
}'
```

---

## Related Skills

- `/chip-finish` - Export netlists and SPEF
- `/report-timing` - Timing analysis in P&R
- `/verification` - DRC/LVS after STA

---

## Checklist

Before STA:
- [ ] Netlist exported
- [ ] SPEF exported
- [ ] SDC constraints ready

After STA:
- [ ] Setup timing clean (WNS >= 0)
- [ ] Hold timing clean (WNS >= 0)
- [ ] No DRC violations
- [ ] Reports generated
