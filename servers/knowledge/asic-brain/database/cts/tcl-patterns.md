# CTS Tcl Patterns

Common Tcl snippets for clock tree synthesis stage.

## Analyze Clocks

### Innovus

```tcl
# List all clocks
report_clocks

# Check clock tree status
report_ccopt_clock_trees

# Find clock roots
get_ccopt_clock_trees
```

### ICC2

```tcl
# List all clocks
report_clocks

# Check CTS status
report_clock_tree -summary
```

## Configure CTS

### Innovus (CCOpt)

```tcl
# Basic CTS configuration
set_ccopt_mode \
    -cts_target_skew 0.05 \
    -cts_target_max_transition 0.1 \
    -cts_target_max_capacitance 0.2 \
    -routing_top_layer M6 \
    -routing_bottom_layer M4

# Buffer/inverter selection
set_ccopt_property buffer_cells {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}
set_ccopt_property inverter_cells {CLKINV_X4 CLKINV_X8 CLKINV_X16}
set_ccopt_property clock_gating_cells {CLKGATE_X4 CLKGATE_X8}

# Skew group configuration
create_ccopt_skew_group -name reg2reg_skew \
                        -targets [get_clocks clk_i] \
                        -target_skew 0.05
```

### ICC2

```tcl
# CTS configuration
set_clock_tree_options -clock [get_clocks clk_i] \
                       -target_skew 0.05 \
                       -target_latency 0.3 \
                       -max_transition 0.1

# Buffer selection
set_clock_tree_references -clock [get_clocks clk_i] \
                          -references {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}

# Target skew
set_clock_tree_options -clock [get_clocks clk_i] \
                       -target_skew 50ps
```

## Run CTS

### Innovus

```tcl
# Run CCOpt
ccopt_design

# With specific effort
ccopt_design -effort high

# Post-route refinement
ccopt_design -post_route
```

### ICC2

```tcl
# Run CTS
clock_opt

# With specific target
clock_opt -clock [get_clocks clk_i]

# With higher effort
set_app_options -name cts.compile.enable_local_skew_optimization -value true
clock_opt
```

## Analyze Results

### Innovus

```tcl
# Summary report
report_ccopt_clock_trees -format summary

# Detailed timing
report_clock_timing -type skew -max_paths 10
report_clock_timing -type latency -max_paths 10

# Clock tree structure
report_ccopt_skew_groups

# Buffer usage
report_clock_cells
```

### ICC2

```tcl
# Summary
report_clock_tree -summary

# Detailed skew
report_clock_timing -type skew -max_paths 10

# Latency
report_clock_timing -type latency -max_paths 10

# Structure
report_clock_tree -structure
```

## Optimize

### Innovus

```tcl
# If skew is high, tighten target
set_ccopt_property target_skew -skew_group reg2reg_skew 0.03
ccopt_design -refine

# For hold issues
set_ccopt_mode -fix_hold true
ccopt_design

# For power reduction
set_ccopt_property use_inverters true
ccopt_design -refine
```

### ICC2

```tcl
# Reduce skew
set_clock_tree_options -clock [get_clocks clk_i] -target_skew 30ps
clock_opt -update_clock_latency

# Fix hold
set_clock_tree_options -fix_hold true
clock_opt
```

## Advanced CTS Features

### Multi-Corner CTS

```tcl
# Define corners for CTS
set_ccopt_mode -corner_list {ss_0.72v_125c ff_0.88v_0c}

# Balance across corners
ccopt_design -multi_corner
```

### Clock Gating Integration

```tcl
# Include clock gating cells
set_ccopt_property clock_gating_cells {CLKGATE_X4 CLKGATE_X8}

# Place clock gates near registers
set_ccopt_property placement_constraints -clock_gating_cells \
    -max_distance_from_registers 50
```

### Mesh Clock

```tcl
# Create clock mesh
create_ccopt_mesh -name clk_mesh \
                  -layers {M8 M9} \
                  -width 2.0 \
                  -spacing 0.5

# Route to mesh
ccopt_design -use_mesh
```

## CTS Quality Checks

### Check Skew

```tcl
# Report skew
report_clock_timing -type skew -max_paths 20

# Expected: All skew < target
# Warning: Any skew > 1.5x target
# Error: Any skew > 2x target
```

### Check Latency

```tcl
# Report latency
report_clock_timing -type latency -max_paths 20

# Expected: Latency within target
# Warning: Latency > 30% of clock period
# Error: Latency > 50% of clock period
```

### Check Transition

```tcl
# Check clock transitions
report_clock_timing -type transition -max_paths 20

# Target: < 10% of clock period
# Warning: > 15% of clock period
# Error: > 20% of clock period
```

### Check DRC

```tcl
# Check clock net DRCs
verify_drc -nets [get_nets -of [get_clocks *]]

# Target: 0 violations
```

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# cts.tcl - Complete CTS script

#===========================================
# Configuration
#===========================================
set CLOCK_NAME "clk_i"
set TARGET_SKEW 0.05  ;# 50ps
set MAX_TRANSITION 0.1

#===========================================
# CTS Setup
#===========================================
echo "Configuring CTS..."

# Clock tree mode
set_ccopt_mode \
    -cts_target_skew $TARGET_SKEW \
    -cts_target_max_transition $MAX_TRANSITION \
    -routing_top_layer M6 \
    -routing_bottom_layer M4

# Buffer selection
set_ccopt_property buffer_cells {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}
set_ccopt_property inverter_cells {CLKINV_X4 CLKINV_X8 CLKINV_X16}

#===========================================
# Pre-CTS Report
#===========================================
echo "Pre-CTS analysis..."
report_clocks > reports/pre_cts_clocks.rpt

#===========================================
# Run CTS
#===========================================
echo "Running CTS..."
ccopt_design

#===========================================
# Post-CTS Reports
#===========================================
echo "Generating reports..."
report_ccopt_clock_trees -format summary > reports/cts_summary.rpt
report_clock_timing -type skew -max_paths 20 > reports/cts_skew.rpt
report_clock_timing -type latency -max_paths 20 > reports/cts_latency.rpt
report_clock_cells > reports/cts_cells.rpt

#===========================================
# Quality Check
#===========================================
set skew [get_ccopt_property worst_skew]
set latency [get_ccopt_property worst_latency]
puts "Worst skew: $skew ns"
puts "Worst latency: $latency ns"

echo "CTS complete!"
```
