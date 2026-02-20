---
name: synthesis
description: >
  RTL synthesis with Design Compiler or Genus. Covers library setup, constraint
  application, optimization strategies, and timing/area QoR analysis. Designed
  to produce clean gate-level netlist ready for place & route.

hipilot:
  vendors: [synopsys, cadence]
  tools:
    synopsys: [dc_shell, dc_shell-topo]
    cadence: [genus]
  flow_stages: [synthesis]
  triggers:
    - "run synthesis"
    - "synthesize"
    - "compile"
    - "elaborate design"
    - "dc shell"
    - "synthesis report"
  qor_metrics: [WNS, TNS, Area, Cell_Count, Leakage_Power, Dynamic_Power]
  risk_level: moderate
  typical_duration: "5-30 minutes depending on design size"
---

# RTL Synthesis

## Quick Reference

```
User: "run synthesis"
```

HiPilot will:
1. Source setup files (libraries, variables)
2. Read RTL and elaborate design
3. Apply timing/area constraints
4. Run compile/optimization
5. Generate reports and netlist

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| New design | Full synthesis from RTL |
| RTL changes | Re-synthesize affected modules |
| Constraint update | Re-synthesize with new SDC |
| Timing regression | Re-synthesize with higher effort |
| Area optimization | Re-synthesize with area focus |

**Prerequisites:**
- RTL files (Verilog/SystemVerilog/VHDL)
- Technology libraries (.db or .lib)
- Constraint file (SDC)
- Synthesis setup script

---

## Synthesis Tools

### Design Compiler (Synopsys)

**Command:** `dc_shell` or `dc_shell-topo` (topographical mode)

**Topographical mode recommended:** Better correlation with P&R results

```bash
# Start DC in topographical mode
dc_shell-topo
```

### Genus (Cadence)

**Command:** `genus`

```bash
# Start Genus
genus
```

---

## Complete Synthesis Flow

### Stage 1: Environment Setup

**Design Compiler:**
```tcl
# dc_setup.tcl - Environment setup

# Library setup
set search_path [list ./rtl ./scripts ./constraints \
    /tech/sky130hd/liberty \
    /tech/sky130hd/lef]

set target_library "sky130hd_ss.db sky130hd_tt.db sky130hd_ff.db"
set link_library "* sky130hd_ss.db sky130hd_tt.db sky130hd_ff.db"
set synthetic_library "standard.sldb"

# Design variables
set DESIGN_NAME "ibex_core"
set CLOCK_NAME "clk_i"
set CLOCK_PERIOD 10.0  ;# 100 MHz
```

**Genus:**
```tcl
# genus_setup.tcl - Environment setup

set_db init_lib_search_path {./rtl ./scripts ./constraints \
    /tech/sky130hd/liberty}

set_db library "sky130hd_ss.lib"
set_db lef_library "/tech/sky130hd/lef/sky130hd.lef"

# Design variables
set DESIGN_NAME "ibex_core"
set CLOCK_PERIOD 10.0
```

### Stage 2: Read Design

**Design Compiler:**
```tcl
# Read RTL files
analyze -format verilog [glob rtl/*.v]

# Elaborate top-level
elaborate $DESIGN_NAME

# Link design
current_design $DESIGN_NAME
link

# Check design integrity
check_design > reports/check_design.rpt
```

**Genus:**
```tcl
# Read RTL files
read_hdl [glob rtl/*.v]

# Elaborate
elaborate $DESIGN_NAME

# Check design
check_design > reports/check_design.rpt
```

### Stage 3: Apply Constraints

**Design Compiler:**
```tcl
# Read SDC constraints
read_sdc constraints/${DESIGN_NAME}.sdc

# Or define inline
create_clock -name $CLOCK_NAME -period $CLOCK_PERIOD [get_ports clk_i]
set_input_delay -clock $CLOCK_NAME 0.5 [all_inputs]
set_output_delay -clock $CLOCK_NAME 0.5 [all_outputs]
set_load 0.1 [all_outputs]
set_driving_cell -lib_cell BUF_X4 [all_inputs]

# Timing exceptions (if any)
set_false_path -from [get_ports rst_ni]
set_multicycle_path 2 -setup -from [get_cells slow_reg*]
```

**Genus:**
```tcl
# Read constraints
read_sdc constraints/${DESIGN_NAME}.sdc

# Or define inline
create_clock -name clk_i -period 10.0 [get_ports clk_i]
set_input_delay 0.5 -clock clk_i [all_inputs]
set_output_delay 0.5 -clock clk_i [all_outputs]
```

### Stage 4: Compile/Optimize

**Design Compiler - Basic:**
```tcl
# Basic compile
compile

# With higher effort
compile_ultra

# With area optimization
compile_ultra -area_effort high

# With timing recovery
compile_ultra -timing_effort high -area_effort medium
```

**Design Compiler - Incremental:**
```tcl
# After initial compile, for timing closure
compile_ultra -incremental

# For specific paths
compile_ultra -incremental -from [get_cells slow_path_start*]
```

**Genus:**
```tcl
# Basic synthesis
synthesize -to_mapped

# With higher effort
synthesize -to_mapped -effort high

# Area recovery
synthesize -to_mapped -effort high -area
```

### Stage 5: Generate Reports

**Design Compiler:**
```tcl
# Timing report
report_timing -max_paths 10 > reports/timing.rpt
report_timing -max_paths 50 -slack_lesser_than 0 > reports/timing_violations.rpt

# Area report
report_area -hierarchy > reports/area.rpt
report_reference -hierarchy > reports/references.rpt

# Power report
report_power -hierarchy > reports/power.rpt

# Constraint report
report_constraint -all_violators > reports/constraints.rpt

# QoR summary
report_qor > reports/qor.rpt
```

**Genus:**
```tcl
# Timing report
report_timing -max_paths 10 > reports/timing.rpt
report_timing -nworst 50 -slack_lesser_than 0 > reports/timing_violations.rpt

# Area report
report_area -hierarchy > reports/area.rpt

# Power report
report_power -hierarchy > reports/power.rpt

# Summary
report_summary > reports/summary.rpt
```

### Stage 6: Write Outputs

**Design Compiler:**
```tcl
# Gate-level netlist (Verilog)
change_names -rules verilog -hierarchy
write -format verilog -hierarchy -output netlist/${DESIGN_NAME}.v

# SDC for P&R
write_sdc -nosplit constraints/${DESIGN_NAME}_syn.sdc

# Database (for checkpoint)
write -format ddc -hierarchy -output db/${DESIGN_NAME}.ddc

# DEF for floorplan reference (topo mode)
write_def -hierarchy output/${DESIGN_NAME}.def

# SPEF for timing estimation (topo mode)
write_spef output/${DESIGN_NAME}.spef
```

**Genus:**
```tcl
# Netlist
write_hdl -mapped > netlist/${DESIGN_NAME}.v

# SDC
write_sdc > constraints/${DESIGN_NAME}_syn.sdc

# Database
write_design ${DESIGN_NAME} -to_file db/${DESIGN_NAME}
```

---

## Optimization Strategies

### Strategy A: Timing-Driven (Default)

```tcl
# Maximum timing optimization
compile_ultra -timing_effort high

# For tough timing
set_optimize_effort -high
compile_ultra
```

### Strategy B: Area-Optimized

```tcl
# Area-first approach
compile_ultra -area_effort high -timing_effort low

# Maximum area reduction
compile_ultra -area_effort high -boundary_optimization
```

### Strategy C: Balanced

```tcl
# Good balance of timing and area
compile_ultra -timing_effort medium -area_effort medium
```

### Strategy D: Low Power

```tcl
# Enable clock gating
set_clock_gating_style -max_fanout 16 -minimum_bitwidth 3
compile_ultra -gate_clock

# With leakage optimization
compile_ultra -gate_clock -leakage_optimization
```

---

## QoR Targets

| Metric | Good | Acceptable | Action Required |
|--------|------|------------|-----------------|
| WNS | > 0 | > -10% clock | Re-optimize if < -10% |
| TNS | 0 | < 100ns | Check individual paths |
| Area Util | < 70% | 70-85% | Reduce if > 85% |
| Leakage | < 10% total | 10-20% | Consider HVT cells |

---

## Common Issues and Fixes

### Issue 1: Elaboration Errors

**Symptoms:** `Error: Can't find module`, undefined references

**Fix:**
```tcl
# Check library paths
echo $search_path
echo $link_library

# Verify files are readable
foreach file [glob rtl/*.v] {
    if {[catch {analyze -format verilog $file} err]} {
        puts "ERROR in $file: $err"
    }
}
```

### Issue 2: Timing Not Met

**Symptoms:** Negative slack after compile

**Fix:**
```tcl
# Analyze worst paths
report_timing -max_paths 10 -slack_lesser_than 0

# Try higher effort
compile_ultra -incremental

# Try retiming
compile_ultra -retime

# Try adaptive retiming
compile_ultra -adaptive_retime
```

### Issue 3: High Area

**Symptoms:** Area exceeds target

**Fix:**
```tcl
# Identify large modules
report_area -hierarchy -designware

# Enable area optimization
compile_ultra -area_effort high -incremental

# Remove unused logic
remove_unconnected_ports -blast_buses [current_design]
compile_ultra -boundary_optimization
```

### Issue 4: Design Rule Violations

**Symptoms:** Max transition/capacitance violations

**Fix:**
```tcl
# Report violations
report_constraint -all_violators -max_transition
report_constraint -all_violators -max_capacitance

# Fix with auto fix
set_fix_multiple_port_nets -all -buffer_constants
compile_ultra -incremental
```

---

## Complete Script Template

**Design Compiler:**
```tcl
#!/usr/bin/tclsh
# syn.tcl - Complete synthesis script

#===========================================
# Configuration
#===========================================
set DESIGN_NAME "ibex_core"
set CLOCK_PERIOD 10.0

#===========================================
# Library Setup
#===========================================
source scripts/dc_setup.tcl

#===========================================
# Read Design
#===========================================
echo "Reading RTL..."
analyze -format verilog [glob rtl/*.v]
elaborate $DESIGN_NAME
link

#===========================================
# Constraints
#===========================================
echo "Applying constraints..."
read_sdc constraints/${DESIGN_NAME}.sdc

#===========================================
# Check Design
#===========================================
check_design > reports/check_design.rpt
check_timing > reports/check_timing.rpt

#===========================================
# Compile
#===========================================
echo "Compiling..."
compile_ultra

#===========================================
# Reports
#===========================================
echo "Generating reports..."
report_timing -max_paths 20 > reports/timing.rpt
report_area -hierarchy > reports/area.rpt
report_power -hierarchy > reports/power.rpt
report_qor > reports/qor.rpt

#===========================================
# Outputs
#===========================================
echo "Writing outputs..."
change_names -rules verilog -hierarchy
write -format verilog -hierarchy -output netlist/${DESIGN_NAME}.v
write_sdc -nosplit constraints/${DESIGN_NAME}_syn.sdc

echo "Synthesis complete!"
exit
```

---

## Makefile Integration

```makefile
# Makefile - Synthesis targets

DESIGN = ibex_core
DC = dc_shell-topo

syn:
	$(DC) -f scripts/syn.tcl -output_log_file logs/syn.log

syn_report:
	cat reports/timing.rpt
	cat reports/area.rpt
	cat reports/qor.rpt

syn_clean:
	rm -rf netlist/* reports/* db/*

syn_debug:
	$(DC) -f scripts/syn.tcl -gui
```

---

## Real Example: Ibex Synthesis

**Design:** Ibex RISC-V CPU (RV32IMC)
**Technology:** Skywater 130nm HD
**Target:** 100 MHz

```bash
cd /home/EDA/hipilot_test/ibex_work_upload
make syn
```

**Expected Results:**
```
Design: ibex_core
Technology: sky130hd

Timing:
  WNS: -0.15ns (acceptable for P&R)
  TNS: -2.3ns
  Violating paths: 12

Area:
  Total: 45,230 um²
  Sequential: 18,450 um² (41%)
  Combinational: 26,780 um² (59%)
  Cell count: 12,456

Power:
  Total: 2.3 mW
  Leakage: 0.4 mW (17%)
  Dynamic: 1.9 mW (83%)

Time: 5 minutes
```

---

## Related Skills

- `/read-design` - Load design into P&R
- `/floorplan` - Floorplanning after synthesis
- `/report-timing` - Detailed timing analysis
- `/compare-qor` - Compare synthesis runs

---

## Checklist

Before synthesis:
- [ ] RTL compiles without errors
- [ ] Libraries accessible
- [ ] SDC constraints defined
- [ ] Clock period specified

After synthesis:
- [ ] Check timing report for WNS
- [ ] Check area report for utilization
- [ ] Check for design rule violations
- [ ] Verify netlist is complete
- [ ] Save checkpoint
