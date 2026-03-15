# Synthesis Tcl Patterns

Common Tcl snippets for synthesis stage.

## Library Setup

### Design Compiler

```tcl
# Basic library setup
set search_path [list ./rtl ./scripts ./constraints \
    /tech/sky130hd/liberty]

set target_library "sky130hd_ss.db sky130hd_tt.db sky130hd_ff.db"
set link_library "* sky130hd_ss.db sky130hd_tt.db sky130hd_ff.db"
set synthetic_library "standard.sldb"

# Design variables
set DESIGN_NAME "ibex_core"
set CLOCK_NAME "clk_i"
set CLOCK_PERIOD 10.0
```

### Genus

```tcl
# Library setup
set_db init_lib_search_path {./rtl ./scripts ./constraints \
    /tech/sky130hd/liberty}

set_db library "sky130hd_ss.lib"
set_db lef_library "/tech/sky130hd/lef/sky130hd.lef"

# Design variables
set DESIGN_NAME "ibex_core"
set CLOCK_PERIOD 10.0
```

## Read Design

### Design Compiler

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

### Genus

```tcl
# Read RTL files
read_hdl [glob rtl/*.v]

# Elaborate
elaborate $DESIGN_NAME

# Check design
check_design > reports/check_design.rpt
```

## Apply Constraints

### Design Compiler

```tcl
# Read SDC constraints
read_sdc constraints/${DESIGN_NAME}.sdc

# Or define inline
create_clock -name $CLOCK_NAME -period $CLOCK_PERIOD [get_ports clk_i]
set_input_delay -clock $CLOCK_NAME 0.5 [all_inputs]
set_output_delay -clock $CLOCK_NAME 0.5 [all_outputs]
set_load 0.1 [all_outputs]
set_driving_cell -lib_cell BUF_X4 [all_inputs]

# Timing exceptions
set_false_path -from [get_ports rst_ni]
set_multicycle_path 2 -setup -from [get_cells slow_reg*]
```

### Genus

```tcl
# Read constraints
read_sdc constraints/${DESIGN_NAME}.sdc

# Or define inline
create_clock -name clk_i -period 10.0 [get_ports clk_i]
set_input_delay 0.5 -clock clk_i [all_inputs]
set_output_delay 0.5 -clock clk_i [all_outputs]
```

## Compile/Optimize

### Design Compiler - Basic

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

### Design Compiler - Incremental

```tcl
# After initial compile, for timing closure
compile_ultra -incremental

# For specific paths
compile_ultra -incremental -from [get_cells slow_path_start*]
```

### Genus

```tcl
# Basic synthesis
synthesize -to_mapped

# With higher effort
synthesize -to_mapped -effort high

# Area recovery
synthesize -to_mapped -effort high -area
```

## Generate Reports

### Design Compiler

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

### Genus

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

## Write Outputs

### Design Compiler

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

### Genus

```tcl
# Netlist
write_hdl -mapped > netlist/${DESIGN_NAME}.v

# SDC
write_sdc > constraints/${DESIGN_NAME}_syn.sdc

# Database
write_design ${DESIGN_NAME} -to_file db/${DESIGN_NAME}
```

## Optimization Strategies

### Timing-Driven (Default)

```tcl
# Maximum timing optimization
compile_ultra -timing_effort high

# For tough timing
set_optimize_effort -high
compile_ultra
```

### Area-Optimized

```tcl
# Area-first approach
compile_ultra -area_effort high -timing_effort low

# Maximum area reduction
compile_ultra -area_effort high -boundary_optimization
```

### Balanced

```tcl
# Good balance of timing and area
compile_ultra -timing_effort medium -area_effort medium
```

### Low Power

```tcl
# Enable clock gating
set_clock_gating_style -max_fanout 16 -minimum_bitwidth 3
compile_ultra -gate_clock

# With leakage optimization
compile_ultra -gate_clock -leakage_optimization
```

## Complete Script Template

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
