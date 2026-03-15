# Design Init Common Issues

Error patterns, root causes, and fixes for design initialization stage.

## Issue 1: Timing Library Not Loaded

### Pattern
```
Timing Library is not loaded yet
No constrained timing paths found
```

### Root Cause
MMMC not set up before init_design

### Fix
```tcl
# MMMC must be set up BEFORE init_design
create_library_set -name libs_tt -timing {sky130.lib}
create_rc_corner -name rc_tt
create_delay_corner -name delay_tt -library_set libs_tt -rc_corner rc_tt
create_constraint_mode -name const_mode -sdc_files {constraints.sdc}
create_analysis_view -name view_tt -constraint_mode const_mode -delay_corner delay_tt
set_analysis_view -setup {view_tt} -hold {view_tt}

# THEN initialize
init_design
```

## Issue 2: Physical-Only Mode

### Pattern
```
No constrained timing paths found
report_libs returns empty
CTS commands fail
```

### Root Cause
Design initialized without timing libraries

### Fix
```tcl
# 1. Re-initialize with timing libraries
# Load timing libraries
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

## Issue 3: LEF File Not Found

### Pattern
```
LEF file not found
Cannot read LEF file
```

### Root Cause
Path incorrect or file doesn't exist

### Fix
```tcl
# Check init_lef_file paths
# Use absolute paths
set init_lef_file {
    /absolute/path/to/tech.lef
    /absolute/path/to/cells.lef
}

# Verify files exist
foreach lef $init_lef_file {
    if {![file exists $lef]} {
        puts "ERROR: LEF file not found: $lef"
    }
}
```

## Issue 4: Netlist Not Found

### Pattern
```
Cannot read Verilog file
Netlist file not found
```

### Fix
```tcl
# Check netlist path
set init_verilog /absolute/path/to/netlist.v

# Verify file exists
if {![file exists $init_verilog]} {
    puts "ERROR: Netlist not found: $init_verilog"
}
```

## Issue 5: Top Cell Mismatch

### Pattern
```
Top cell not found in netlist
Multiple top modules found
```

### Fix
```tcl
# Verify top cell name matches netlist
set init_top_cell ibex_core

# Check netlist for module names
grep "module " netlist.v
```

## Issue 6: SDC File Errors

### Pattern
```
Error reading SDC file
SDC constraint errors
```

### Fix
```tcl
# Verify SDC file exists and is readable
if {![file exists constraints.sdc]} {
    puts "ERROR: SDC file not found"
}

# Check SDC syntax
# Run in standalone mode first
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| Library not loaded | "not loaded yet" | High | Yes |
| Physical-only mode | "No constrained timing" | High | Yes |
| LEF not found | "LEF file not found" | High | No |
| Netlist error | "Cannot read" | High | No |
| Top cell error | "not found in netlist" | High | No |
| SDC error | "Error reading SDC" | Medium | No |
