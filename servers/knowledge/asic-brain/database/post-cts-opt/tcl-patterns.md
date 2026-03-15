# Post-CTS Opt Tcl Patterns

Common Tcl snippets for post-CTS optimization stage.

## Set Clocks to Propagated

### Innovus

```tcl
# Set all clocks to propagated mode
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
```

### ICC2

```tcl
# Propagate clocks
set_propagated_clock [all_clocks]
```

## Configure Optimization Mode

### Innovus

```tcl
# Optimization settings
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -holdTargetSlack 0.05
setOptMode -setupTargetSlack 0.0
```

## Run Setup Optimization

### Innovus

```tcl
# Post-CTS setup optimization
optDesign -postCTS -setup

# Higher effort
optDesign -postCTS -effort high -setup
```

### ICC2

```tcl
# Post-CTS optimization
place_opt -cts
route_opt -cts
```

## Run Hold Optimization

### Innovus

```tcl
# Post-CTS hold optimization
optDesign -postCTS -hold

# Combined setup + hold
optDesign -postCTS -setup
optDesign -postCTS -hold
```

## Analyze Results

### Innovus

```tcl
# Report timing
report_timing -max_paths 20

# Report violations
report_constraint -all_violators

# Compare pre/post optimization
report_qor
```

## Optimization Strategies

### Setup-Only (Default)

```tcl
# Focus on setup timing
optDesign -postCTS -setup
```

### Hold-Only

```tcl
# Focus on hold timing (after setup)
optDesign -postCTS -hold
```

### Combined (Recommended)

```tcl
# Setup first, then hold
optDesign -postCTS -setup
optDesign -postCTS -hold
```

### High Effort

```tcl
# Maximum optimization
setOptMode -effort high
optDesign -postCTS
optDesign -postCTS -hold
```

## Timing Analysis

### Check Setup Timing

```tcl
# Report setup violations
report_timing -max_paths 20 -slack_lesser_than 0 -delay_type max

# Summary
report_constraint -all_violators -max_delay
```

### Check Hold Timing

```tcl
# Report hold violations
report_timing -max_paths 20 -slack_lesser_than 0 -delay_type min

# Summary
report_constraint -all_violators -min_delay
```

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# post_cts_opt.tcl - Post-CTS optimization

#===========================================
# Configuration
#===========================================
set SETUP_TARGET_SLACK 0.0
set HOLD_TARGET_SLACK 0.05

#===========================================
# Propagate Clocks
#===========================================
echo "Setting clocks to propagated mode..."
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]

#===========================================
# Optimization Mode
#===========================================
echo "Configuring optimization mode..."
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -holdTargetSlack $HOLD_TARGET_SLACK
setOptMode -setupTargetSlack $SETUP_TARGET_SLACK

#===========================================
# Pre-Optimization Report
#===========================================
echo "Pre-optimization timing..."
report_timing -max_paths 10 > reports/pre_opt_timing.rpt

#===========================================
# Setup Optimization
#===========================================
echo "Running setup optimization..."
optDesign -postCTS -setup

#===========================================
# Hold Optimization
#===========================================
echo "Running hold optimization..."
optDesign -postCTS -hold

#===========================================
# Post-Optimization Report
#===========================================
echo "Generating reports..."
report_timing -max_paths 20 > reports/post_cts_opt_timing.rpt
report_constraint -all_violators > reports/violations.rpt
report_qor > reports/qor.rpt

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/post_cts_opt.enc

echo "Post-CTS optimization complete!"
```
