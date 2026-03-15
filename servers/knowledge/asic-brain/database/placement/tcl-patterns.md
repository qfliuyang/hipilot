# Placement Tcl Patterns

Common Tcl snippets for placement stage.

## Configure Placement Mode

### Innovus

```tcl
# Reset placement mode
setPlaceMode -reset

# Timing-driven placement
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_detail_legalization_inst_gap 2

# For congested designs
setPlaceMode -cong_effort medium
setPlaceMode -place_global_cong_effort high
```

### ICC2

```tcl
# Placement configuration
set_app_options -name place.coarse.cong_effort -value high
set_app_options -name place.coarse.timing_effort -value high
```

## Set Timing Derates

### Innovus

```tcl
# OCV derating for placement
set_timing_derate -early 0.97 -late 1.03 -clock
set_timing_derate -late 1.05 -data
setAnalysisMode -cppr both
```

## Run Placement

### Innovus

```tcl
# Basic placement
place_opt_design

# With higher effort
place_opt_design -effort high

# Incremental placement
place_opt_design -incremental
```

### ICC2

```tcl
# Initial placement
create_placement

# Legalize
legalize_placement

# Optimize
place_opt
```

## Analyze Results

### Innovus

```tcl
# Report timing
report_timing -max_paths 10

# Report congestion
report_congestion

# Report utilization
report_utilization
```

## Placement Options

### Timing-Driven (Default)

```tcl
# Maximum timing optimization
setPlaceMode -timing_effort high
place_opt_design
```

### Congestion-Driven

```tcl
# For congested designs
setPlaceMode -cong_effort high
setPlaceMode -place_global_cong_effort high
place_opt_design
```

### Density-Constrained

```tcl
# Limit local density
setPlaceMode -place_global_max_density 0.75
place_opt_design
```

## Pre-CTS Timing Analysis

### Check Timing

```tcl
# Report pre-CTS timing
report_timing -max_paths 20 -slack_lesser_than 0

# Report path groups
report_timing -max_paths 5 -group

# Expected timing at pre-CTS:
# - Some negative slack is normal (no clock tree yet)
# - Setup violations: Will be fixed during CTS and routing
# - Focus on identifying critical paths
```

### Check Congestion

```tcl
# Global congestion
report_congestion -hotspot

# Detailed analysis
globalRoute -congestion
```

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# placement.tcl - Standard cell placement

#===========================================
# Configuration
#===========================================
set TARGET_DENSITY 0.70
set TIMING_EFFORT "high"

#===========================================
# Placement Mode Setup
#===========================================
echo "Configuring placement mode..."
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_detail_legalization_inst_gap 2

#===========================================
# Timing Setup
#===========================================
echo "Setting timing derates..."
set_timing_derate -early 0.97 -late 1.03 -clock
set_timing_derate -late 1.05 -data
setAnalysisMode -cppr both

#===========================================
# Run Placement
#===========================================
echo "Running placement..."
place_opt_design

#===========================================
# Reports
#===========================================
echo "Generating reports..."
report_timing -max_paths 20 > reports/pre_cts_timing.rpt
report_congestion > reports/congestion.rpt
report_utilization > reports/placement_util.rpt

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/placement.enc

echo "Placement complete!"
```
