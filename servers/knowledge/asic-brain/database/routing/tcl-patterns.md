# Routing Tcl Patterns

Common Tcl snippets for routing stage.

## Pre-route Checklist

### Innovus

```tcl
# Check placement
checkPlace

# Verify power connections
verifyPowerVia

# Baseline timing
report_timing -max_paths 1 -path_type summary -slack_lesser_than 0.5

# Check congestion from placement
reportCongestion
```

### ICC2

```tcl
# Confirm placement is legalized
check_legality

# Check for pre-existing DRC
verify_drc -check_only

# Confirm power grid is intact
verify_pg_nets

# Baseline timing
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.5
```

## Global Route

### Innovus

```tcl
# Global route
globalDetailRoute -mode global

# Check congestion
reportCongestion -hotspot
```

### ICC2

```tcl
# Run global route with congestion analysis
route_global -effort medium \
             -timing_driven true \
             -congestion_driven true \
             -xtalk_reduction true

# Report congestion
report_route_info -summary
report_congestion -gcell_summary
```

## Track Assignment (ICC2)

```tcl
# ICC2 track assignment
route_track -effort medium \
            -timing_driven true

# Check intermediate state
report_route_info -summary
```

## Detail Route

### Innovus

```tcl
# Combined global + detail route
routeDesign -globalDetail \
            -viaOpt \
            -wireOpt

# Or stage by stage:
globalDetailRoute -mode global
globalDetailRoute -mode track
globalDetailRoute -mode detail
```

### ICC2

```tcl
# Detail route
route_detail -effort medium \
             -timing_driven true \
             -xtalk_reduction true \
             -max_number_iterations 10

# Timing-focused detail route
route_detail -effort high \
             -timing_driven true \
             -timing_effort high \
             -xtalk_reduction true \
             -max_number_iterations 15
```

## DRC Verification and Fixing

### Innovus

```tcl
# DRC check
verify_drc -report ./reports/drc_post_route.rpt

# Automatic DRC fixing
setNanoRouteMode -routeWithDrc 1 \
                 -routeWithTimingDriven 1

# Re-run detail route with DRC fix focus
routeDesign -wireOpt

# Final DRC check
verify_drc -report ./reports/drc_iter1.rpt
```

### ICC2

```tcl
# Full DRC check
verify_drc -check_only

# Report DRC count
report_drc -summary

# Automatic DRC fixing loop
set iter 0
while {[get_drc_count] > 0 && $iter < 5} {
    incr iter
    echo "DRC fix iteration $iter"

    route_detail -effort high \
                 -timing_driven true \
                 -incremental true \
                 -fix_drc true

    verify_drc -check_only
    report_drc -summary
}
```

## Antenna Fixing

### Innovus

```tcl
# Check and fix antenna
verify_antenna -report ./reports/antenna_pre_fix.rpt

# Fix using antenna diode insertion
setNanoRouteMode -routeInsertAntennaDiode 1 \
                 -routeAntennaCellName "sky130_fd_sc_hd__diode_2"

addAntennaIgnoreLayer -layer met1

# Re-route with antenna fixing
routeDesign -wireOpt

# Verify
verify_antenna -report ./reports/antenna_post_fix.rpt
```

### ICC2

```tcl
# Check antenna violations
check_antenna

# Report count
report_antenna -summary

# Automatic antenna fix
fix_antenna -diode_cell sky130_fd_sc_hd__diode_2 \
            -diode_pin DIODE \
            -net_pin_reference VPWR \
            -verbose

# Re-check
check_antenna
```

## Post-route Timing Verification

### Innovus

```tcl
# Post-route timing
timeDesign -postRoute \
           -pathReports \
           -dataReports \
           -outDir ./timing_rpt/post_route
```

### ICC2

```tcl
# Extract RC parasitics
extract_rc -coupling_cap true

# Update timing with real parasitics
update_timing -full

# Compare against post-CTS baseline
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.5 \
              > /tmp/timing_post_route.rpt
```

## Filler Cell Insertion

### Innovus

```tcl
# Add filler cells
addFiller -cell "sky130_fd_sc_hd__fill_1 sky130_fd_sc_hd__fill_2 sky130_fd_sc_hd__tapvpwrvgnd_1" \
          -prefix FILL

# Check for gaps
checkFiller
```

### ICC2

```tcl
# Create filler cells
create_stdcell_filler \
    -cell_without_metal "sky130_fd_sc_hd__fill_1 sky130_fd_sc_hd__fill_2" \
    -cell_with_metal "sky130_fd_sc_hd__tapvpwrvgnd_1" \
    -connect_to_power VDD \
    -connect_to_ground VSS

# Verify no gaps remain
verify_filler_cells
```

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# routing.tcl - Complete routing script

#===========================================
# Pre-route Checks
#===========================================
echo "Running pre-route checks..."
checkPlace
verifyPowerVia

#===========================================
# Global Route
#===========================================
echo "Running global route..."
globalDetailRoute -mode global
reportCongestion -hotspot

#===========================================
# Detail Route
#===========================================
echo "Running detail route..."
routeDesign -globalDetail -viaOpt -wireOpt

#===========================================
# DRC Check
#===========================================
echo "Checking DRC..."
verify_drc -report ./reports/drc_post_route.rpt

#===========================================
# Antenna Fix
#===========================================
echo "Fixing antenna violations..."
setNanoRouteMode -routeInsertAntennaDiode 1 \
                 -routeAntennaCellName "sky130_fd_sc_hd__diode_2"
routeDesign -wireOpt
verify_antenna -report ./reports/antenna_post_fix.rpt

#===========================================
# Post-route Timing
#===========================================
echo "Running post-route timing..."
timeDesign -postRoute -pathReports -outDir ./timing_rpt/post_route

#===========================================
# Filler Insertion
#===========================================
echo "Adding filler cells..."
addFiller -cell "sky130_fd_sc_hd__fill_1 sky130_fd_sc_hd__fill_2 sky130_fd_sc_hd__tapvpwrvgnd_1" \
          -prefix FILL

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/routing.enc

echo "Routing complete!"
```
