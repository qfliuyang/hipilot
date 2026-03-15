# Post-CTS Opt Common Issues

Error patterns, root causes, and fixes for post-CTS optimization stage.

## Issue 1: Hold Violations After Setup Opt

### Pattern
```
Hold violations appear after setup optimization
WNS (hold) negative
```

### Root Cause
Setup optimization can worsen hold timing

### Fix
```tcl
# Run hold optimization
optDesign -postCTS -hold

# If still failing, increase target slack
setOptMode -holdTargetSlack 0.1
optDesign -postCTS -hold
```

## Issue 2: Setup Still Negative

### Pattern
```
Setup WNS still negative after optimization
Critical paths remain
```

### Root Cause
Timing too tight or optimization insufficient

### Fix
```tcl
# Higher effort
optDesign -postCTS -effort high -setup

# Check critical paths
report_timing -max_paths 50 -slack_lesser_than 0

# May need to revisit floorplan or CTS
```

## Issue 3: DRC Violations

### Pattern
```
Max transition/capacitance violations
DRC errors after optimization
```

### Root Cause
Cells sized without DRC consideration

### Fix
```tcl
# Enable DRC fixing
setOptMode -fixDrc true
optDesign -postCTS

# Check violations
report_constraint -all_violators -max_transition
report_constraint -all_violators -max_capacitance
```

## Issue 4: Clocks Not Propagated

### Pattern
```
Timing analysis using ideal clocks
No clock delays considered
```

### Root Cause
Clocks not set to propagated mode

### Fix
```tcl
# Set clocks to propagated
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]

# Verify
report_clock_timing -type latency
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| Hold violations | "hold" | Medium | Yes |
| Setup negative | "setup" | High | Partial |
| DRC violations | "max transition" | Medium | Yes |
| Ideal clocks | "ideal" | High | Yes |
