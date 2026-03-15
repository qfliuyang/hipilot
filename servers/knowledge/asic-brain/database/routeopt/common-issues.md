# Route Opt Common Issues

Error patterns, root causes, and fixes for post-route optimization stage.

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
optDesign -postRoute -hold

# If still failing, increase target slack
setOptMode -holdTargetSlack 0.05
optDesign -postRoute -hold
```

## Issue 2: DRC Violations Increase

### Pattern
```
DRC count increases after route_opt
New violations introduced
```

### Root Cause
Cell sizing/moving during optimization

### Fix
```tcl
# Re-verify DRC after optimization
verify_drc -check_only

# Fix DRC
setOptMode -fixDrc true
optDesign -postRoute

# If still failing, reduce effort
optDesign -postRoute -effort medium
```

## Issue 3: Antenna Violations

### Pattern
```
Antenna violations reported
Diode insertion needed
```

### Fix
```tcl
# Enable antenna fixing
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

# Verify
verify_drc -antenna
```

## Issue 4: Timing Not Improving

### Pattern
```
WNS remains negative after optimization
No timing improvement
```

### Root Cause
Constraints too tight or physical limitations

### Fix
```tcl
# Check critical paths
report_timing -max_paths 50 -slack_lesser_than 0

# May need to revisit floorplan or CTS
# Or accept current timing if within spec
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| Hold violations | "hold" | Medium | Yes |
| DRC increase | "DRC" | High | Yes |
| Antenna | "antenna" | Medium | Yes |
| No improvement | "WNS remains" | High | No |
