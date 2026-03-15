# Placement Common Issues

Error patterns, root causes, and fixes for placement stage.

## Issue 1: High Congestion

### Pattern
```
Congestion > 1.0 in hotspots
Global routing congestion high
```

### Root Cause
Cell density too high in certain areas

### Fix
```tcl
# Reduce local density
setPlaceMode -place_global_max_density 0.70
place_opt_design -incremental

# Add placement blockages in congested areas
createPlaceBlockage -type partial -density 0.3 -box {x1 y1 x2 y2}
```

## Issue 2: Large Negative Slack

### Pattern
```
WNS < -20% of clock period
Critical paths too long
```

### Root Cause
Timing constraints too tight or placement not timing-driven

### Fix
```tcl
# Higher timing effort
setPlaceMode -timing_effort ultra
place_opt_design

# Check path groups for critical paths
report_timing -max_paths 50 -slack_lesser_than 0
```

## Issue 3: Overlap Violations

### Pattern
```
Cell overlaps reported
Placement not legalized
```

### Root Cause
Legalization issues during placement

### Fix
```tcl
# Legalize placement
place_detail -legalize_only

# Or re-run with better settings
setPlaceMode -place_detail_legalization_inst_gap 2
place_opt_design -incremental
```

## Issue 4: Scan Chain Issues

### Pattern
```
Scan chain reordering fails
Scan placement issues
```

### Fix
```tcl
# Ignore scan during placement
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| High congestion | "congestion > 1.0" | High | Yes |
| Negative slack | "WNS <" | Medium | Partial |
| Overlaps | "overlap" | High | Yes |
| Scan issues | "scan" | Low | Yes |
