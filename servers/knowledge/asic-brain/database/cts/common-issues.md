# CTS Common Issues

Error patterns, root causes, and fixes for clock tree synthesis stage.

## Issue 1: High Skew

### Pattern
```
Skew > 100ps
Timing violations due to clock skew
```

### Root Cause
Skew target too loose or buffer selection inappropriate

### Fix
```tcl
# Check skew distribution
report_clock_timing -type skew -max_paths 50 -slack_lesser_than 0.1

# Tighten skew target
set_ccopt_property target_skew -skew_group reg2reg_skew 0.03
ccopt_design -refine

# Or add more levels
set_ccopt_mode -max_levels 15
ccopt_design
```

## Issue 2: High Latency

### Pattern
```
Latency > 500ps
OCV derating issues
```

### Root Cause
Tree too deep or buffers too small

### Fix
```tcl
# Use larger buffers
set_ccopt_property buffer_cells {CLKBUF_X8 CLKBUF_X16 CLKBUF_X32}

# Reduce tree levels
set_ccopt_mode -max_levels 8
ccopt_design
```

## Issue 3: Clock Duty Cycle Distortion

### Pattern
```
Duty cycle not 50%
Clock asymmetry
```

### Root Cause
Asymmetric buffers or unbalanced tree

### Fix
```tcl
# Enable duty cycle correction
set_ccopt_mode -fix_duty_cycle true

# Use symmetric buffers
set_ccopt_property use_inverters false
ccopt_design
```

## Issue 4: High Clock Power

### Pattern
```
Clock power > 30% of total
Excessive buffer count
```

### Root Cause
Buffers too large or too many levels

### Fix
```tcl
# Use smaller buffers where possible
set_ccopt_property buffer_cells {CLKBUF_X2 CLKBUF_X4 CLKBUF_X8}

# Enable clock gating
set_ccopt_property clock_gating_cells {CLKGATE_X2 CLKGATE_X4}
ccopt_design
```

## Issue 5: CTS Fails - Physical-Only Mode

### Pattern
```
create_ccopt_clock_tree_spec fails
report_timing shows "No constrained timing paths"
Clock signals treated as regular ports
```

### Root Cause
Design initialized without timing libraries

### Fix
```tcl
# 1. Re-initialize with timing libraries
read_libs sky130_fd_sc_hd__tt_025C_1v80.lib

# 2. Set up MMMC
create_library_set -name libs_tt -timing {sky130.lib}
create_rc_corner -name rc_tt
create_delay_corner -name delay_tt -library_set libs_tt -rc_corner rc_tt
create_constraint_mode -name const_mode -sdc_files {constraints.sdc}
create_analysis_view -name view_tt -constraint_mode const_mode -delay_corner delay_tt
set_analysis_view -setup {view_tt} -hold {view_tt}

# 3. Re-load design with timing
# (May need to restart and re-run init with proper libraries)
```

## Issue 6: Missing Clock Definitions

### Pattern
```
No clocks found
Clock ports not defined
```

### Root Cause
SDC not loaded or clock constraints missing

### Fix
```tcl
# Check if SDC is loaded
report_clocks

# Define clock if missing
create_clock -name clk_i -period 10.0 [get_ports clk_i]

# Reload SDC
source constraints.sdc
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| High skew | "skew >" | Medium | Yes |
| High latency | "latency >" | Medium | Yes |
| Duty cycle | "duty cycle" | Low | Yes |
| High power | "clock power" | Low | Yes |
| Physical-only | "No constrained timing" | High | Yes |
| Missing clock | "No clocks" | High | Yes |
