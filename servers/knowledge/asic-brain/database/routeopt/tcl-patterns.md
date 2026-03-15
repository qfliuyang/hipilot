# Route Opt Tcl Patterns

Common Tcl snippets for post-route optimization stage.

## Configure Optimization Mode

### Innovus

```tcl
# Optimization settings
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -usefulSkew true
setOptMode -holdTargetSlack 0.02
setOptMode -setupTargetSlack 0.0
```

## Run Setup Optimization

### Innovus

```tcl
# Post-route setup optimization
optDesign -postRoute -setup

# Higher effort
optDesign -postRoute -setup -effort high
```

### ICC2

```tcl
# Post-route optimization
route_opt -size_only
```

## Run Hold Optimization

### Innovus

```tcl
# Post-route hold optimization
optDesign -postRoute -hold

# Combined
optDesign -postRoute -setup
optDesign -postRoute -hold
```

## Fix DRC Violations

### Innovus

```tcl
# Fix antenna violations
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

# Verify DRC
verify_drc
```

## Final Cleanup

### Innovus

```tcl
# Remove dangling nets
deleteDanglingNet

# Remove empty modules
deleteEmptyModule

# Remove assigns
remove_assigns -buffering
```

## Final QoR Analysis

### Timing Summary

```tcl
# Report final timing
report_timing -max_paths 20

# Summary
report_qor

# Path groups
report_timing -max_paths 5 -group
```

### DRC Summary

```tcl
# Verify connectivity
verifyConnectivity -type all

# Verify geometry
verify_drc -limit 1000

# Report violations
report_constraint -all_violators
```

### Area Summary

```tcl
# Report area
report_area

# Cell utilization
report_utilization
```

## Optimization Options

### Setup-Only

```tcl
# Focus on setup timing
optDesign -postRoute -setup
```

### Hold-Only

```tcl
# Focus on hold timing
optDesign -postRoute -hold
```

### Combined (Recommended)

```tcl
# Setup + hold
optDesign -postRoute -setup
optDesign -postRoute -hold
```

### With Useful Skew

```tcl
# Enable useful skew optimization
setOptMode -usefulSkew true
optDesign -postRoute -setup
```

## DRC Fixing

### Antenna Violations

```tcl
# Enable antenna fixing
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

# Check antenna
verify_drc -antenna
```

### Max Transition/Capacitance

```tcl
# Fix max transition
setOptMode -fixDrc true
optDesign -postRoute

# Verify
report_constraint -all_violators -max_transition
report_constraint -all_violators -max_capacitance
```

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# routing_opt.tcl - Post-routing optimization

#===========================================
# Configuration
#===========================================
set SETUP_TARGET_SLACK 0.0
set HOLD_TARGET_SLACK 0.02

#===========================================
# Optimization Mode
#===========================================
echo "Configuring optimization mode..."
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -usefulSkew true
setOptMode -holdTargetSlack $HOLD_TARGET_SLACK
setOptMode -setupTargetSlack $SETUP_TARGET_SLACK

#===========================================
# Pre-Optimization Report
#===========================================
echo "Pre-optimization timing..."
report_timing -max_paths 10 > reports/pre_route_opt_timing.rpt

#===========================================
# Setup Optimization
#===========================================
echo "Running setup optimization..."
optDesign -postRoute -setup

#===========================================
# Hold Optimization
#===========================================
echo "Running hold optimization..."
optDesign -postRoute -hold

#===========================================
# DRC Fixing
#===========================================
echo "Fixing DRC violations..."
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

#===========================================
# Cleanup
#===========================================
echo "Cleaning up design..."
remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

#===========================================
# Final Verification
#===========================================
echo "Running final verification..."
verifyConnectivity -type all -error 1000 -warning 50
verify_drc -limit 1000

#===========================================
# Post-Optimization Report
#===========================================
echo "Generating final reports..."
report_timing -max_paths 20 > reports/final_timing.rpt
report_qor > reports/final_qor.rpt
report_area > reports/final_area.rpt

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/routing_opt.enc

echo "Post-routing optimization complete!"
```
