# Floorplan Common Issues

Error patterns, root causes, and fixes for floorplanning stage.

## Issue 1: Utilization Too High

### Pattern
```
>80% utilization after floorplan
Core area insufficient
```

### Root Cause
Target utilization too high for design density

### Fix
```tcl
# Increase die size
set core_area [expr $cell_area / 0.7]  ;# Target 70%
set side [expr sqrt($core_area)]
floorPlan -site unithd -r 1.0 0.70 10 10 10 10
```

## Issue 2: Congestion Near Macros

### Pattern
```
Local congestion hotspots
High density near macro boundaries
```

### Root Cause
Macros placed without sufficient spacing

### Fix
```tcl
# Add macro halo
addHaloToBlock -allBlocks 15 15 15 15

# Add partial blockage near macros
createPlaceBlockage -type partial -density 0.5 \
                    -box {100 100 200 200}
```

## Issue 3: IO Spacing Violations

### Pattern
```
DRC violations on pins
Pin spacing errors
```

### Root Cause
Pins placed too close together

### Fix
```tcl
# Increase minimum pin spacing
setPinAssignMode -minPinDistance 2.0

# Re-spread pins
editPin -layer M4 -side TOP -spreadType side \
        -pin [all_inputs] -spreadDirection clockwise
```

## Issue 4: Power Grid Shorts

### Pattern
```
VDD-VSS shorts
Power grid DRC violations
```

### Root Cause
Insufficient spacing between power stripes

### Fix
```tcl
# Check and fix
verify_drc -nets {VDD VSS}

# Increase spacing
addStripe -spacing 1.0 -width 1.0 ...  ;# Doubled spacing
```

## Issue 5: Invalid Command create_floorplan

### Pattern
```
invalid command name "create_floorplan"
-utilization is not a legal option
```

### Root Cause
Innovus version incompatibility (v20.10+)

### Fix
```tcl
# Use floorPlan instead
create_floorplan -core_utilization 0.7 ...  ;# May fail

# CORRECT for v20.10+
floorPlan -site unithd -r 1.0 0.70 10 10 10 10
```

## Issue 6: Site Not Found

### Pattern
```
Site not found
Invalid site name
```

### Root Cause
Site name doesn't match LEF definition

### Fix
```tcl
# Check available sites
report_site

# Use correct site name from LEF
# For Skywater 130nm HD: "unithd"
floorPlan -site unithd -r 1.0 0.70 10 10 10 10
```

## Issue 7: IO File Not Found

### Pattern
```
Cannot load IO file
IO constraints file not found
```

### Fix
```tcl
# Check file path
if {![file exists io/io_constraints.io]} {
    puts "ERROR: IO file not found"
}

# Use absolute path
loadIoFile /absolute/path/to/io_constraints.io
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| High utilization | ">80%" | Medium | Yes |
| Congestion | "congestion" | Medium | Yes |
| IO spacing | "spacing violation" | Medium | Yes |
| Power short | "VDD-VSS short" | High | Yes |
| Command error | "invalid command" | High | Yes |
| Site error | "Site not found" | High | No |
| IO file error | "Cannot load" | Medium | No |
