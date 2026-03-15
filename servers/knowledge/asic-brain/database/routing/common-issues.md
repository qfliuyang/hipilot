# Routing Common Issues

Error patterns, root causes, and fixes for routing stage.

## Issue 1: Congestion Overflow

### Pattern
```
GCell utilization > 95%
Global route congestion high
```

### Root Cause
Placement density too high for routing resources

### Fix
```tcl
# Check congestion hotspots
report_congestion -gcell_hotspots -max_count 20

# Spread cells in congested area (ICC2)
refine_placement -effort high -congestion_area {x1 y1 x2 y2}

# May need to go back to placement
```

## Issue 2: Unrouted Connections

### Pattern
```
Number of unrouted connections > 0
Detail route incomplete
```

### Root Cause
Extreme congestion or blocked routing layers

### Fix
```tcl
# Check unrouted nets
report_route_info -summary

# Relax spacing constraints if possible
# Or adjust placement to reduce congestion
```

## Issue 3: Persistent DRC Violations

### Pattern
```
DRC count not reducing after iterations
Same violations remain
```

### Root Cause
Difficult violations requiring manual intervention

### Fix
```tcl
# Identify persistent violating nets
report_drc -verbose -max_count 50 > /tmp/persistent_drc.rpt

# Try routing specific nets with relaxed constraints
route_detail -fix_drc true \
             -effort high \
             -nets [list net1 net2 net3]
```

## Issue 4: Antenna Violations Not Fixed

### Pattern
```
Antenna violations remain after fix
Diode insertion failed
```

### Root Cause
Diode cell not in library or not placed correctly

### Fix
```tcl
# Check diode cell availability
# Verify diode cell is not in dont_use list

# Place diodes manually if needed
placeInstance diode_inst x y
```

## Issue 5: Timing Degraded Significantly

### Pattern
```
WNS degraded > 0.3ns from post-CTS
Critical paths have detours
```

### Root Cause
Congestion forcing routing detours on critical paths

### Fix
```tcl
# Report congestion
report_congestion -hotspot

# Identify congested regions on critical paths
# Consider partial re-placement
```

## Issue 6: Signal Integrity Violations

### Pattern
```
Crosstalk-induced glitches
SI violations post-route
```

### Fix
```tcl
# ICC2
route_opt -xtalk_reduction true

# Innovus
optDesign -postRoute -si

# Check with
report_si  # ICC2
signalIntegrity  # Innovus
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| Congestion overflow | "utilization > 95%" | High | Partial |
| Unrouted nets | "unrouted" | High | Partial |
| Persistent DRC | "DRC not reducing" | High | Partial |
| Antenna | "antenna" | Medium | Yes |
| Timing degradation | "WNS degraded" | High | Partial |
| SI violations | "crosstalk" | Medium | Yes |
