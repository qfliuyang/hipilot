# Synthesis Common Issues

Error patterns, root causes, and fixes for synthesis stage.

## Issue 1: Elaboration Errors

### Pattern
```
Error: Can't find module
Error: Undefined reference
Error: Unable to resolve reference
```

### Root Cause
- Missing library paths
- Missing RTL files
- Incorrect module names

### Fix
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

# Check search_path includes library directory
set search_path [list ./rtl ./scripts ./constraints \
    /tech/sky130hd/liberty \
    /tech/sky130hd/lef]
```

## Issue 2: Timing Not Met

### Pattern
```
WNS: -0.5ns (negative slack)
TNS: -50ns
Violating paths: 50+
```

### Root Cause
- Clock period too tight
- Insufficient optimization effort
- Critical paths need attention

### Fix
```tcl
# Analyze worst paths
report_timing -max_paths 10 -slack_lesser_than 0

# Try higher effort
compile_ultra -incremental

# Try retiming
compile_ultra -retime

# Try adaptive retiming
compile_ultra -adaptive_retime

# Check path groups for critical paths
report_timing -max_paths 50 -slack_lesser_than 0
```

## Issue 3: High Area

### Pattern
```
Area exceeds target
Utilization > 85%
```

### Root Cause
- Area optimization not enabled
- Excessive buffering
- Unused logic

### Fix
```tcl
# Identify large modules
report_area -hierarchy -designware

# Enable area optimization
compile_ultra -area_effort high -incremental

# Remove unused logic
remove_unconnected_ports -blast_buses [current_design]
compile_ultra -boundary_optimization
```

## Issue 4: Design Rule Violations

### Pattern
```
Max transition violations
Max capacitance violations
```

### Root Cause
- Large fanout nets
- Long wires
- Missing buffer insertion

### Fix
```tcl
# Report violations
report_constraint -all_violators -max_transition
report_constraint -all_violators -max_capacitance

# Fix with auto fix
set_fix_multiple_port_nets -all -buffer_constants
compile_ultra -incremental
```

## Issue 5: Child Process Exited Abnormally

### Pattern
```
child process exited abnormally
```

### Root Cause
DC binaries not in PATH

### Fix
```bash
# Set PATH correctly
export PATH=/opt/synopsys/syn_2022.03/T-2022.03-SP2/bin:$PATH

# For Skywater 130nm on test server
export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:/opt/synopsys/syn_2022.03/T-2022.03-SP2/bin:$PATH
```

## Issue 6: Can't Find Library

### Pattern
```
Can't find library
Library not found
```

### Root Cause
Library path not in search_path

### Fix
```tcl
# Check search_path
echo $search_path

# Add library path
set search_path [list ./rtl ./scripts ./constraints \
    /tech/sky130hd/liberty]

# Verify library file exists
file exists /tech/sky130hd/liberty/sky130hd.db
```

## Issue 7: Synthesis Hangs

### Pattern
```
Process hangs, no output
License checkout failure
```

### Root Cause
- License issue
- Resource constraint
- Large design with high effort

### Fix
```bash
# Check license
lmstat -c $LM_LICENSE_FILE

# Monitor memory usage
top -p $(pgrep dc_shell)

# Reduce effort for large designs
compile_ultra -area_effort medium -timing_effort medium
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| Elaboration error | "Can't find module" | High | No |
| Timing violation | "negative slack" | Medium | Partial |
| High area | "exceeds target" | Low | Yes |
| DRC violation | "max transition" | Medium | Yes |
| PATH error | "exited abnormally" | High | Yes |
| Library error | "not found" | High | Yes |
| License error | "checkout failed" | High | No |
