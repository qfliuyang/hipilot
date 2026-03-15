# Power Planning Common Issues

Error patterns, root causes, and fixes for power planning stage.

## Issue 1: Unconnected Pins

### Pattern
```
verifyConnectivity reports errors
Floating power pins
```

### Root Cause
Global nets not properly connected

### Fix
```tcl
# Re-run sroute with different options
sroute -connect {corePin blockPin} \
       -nets {VDD VSS} \
       -layerChangeRange {li1 met5}

# Verify global net connections
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
```

## Issue 2: Power Shorts

### Pattern
```
VDD-VSS shorts reported
Power grid DRC violations
```

### Root Cause
Insufficient spacing between power stripes

### Fix
```tcl
# Check for shorts
verify_drc -nets {VDD VSS}

# Increase spacing
addStripe -spacing 4 ...  ;# Doubled spacing
```

## Issue 3: IR Drop Issues

### Pattern
```
High IR drop reported
Voltage drop exceeds limit
```

### Root Cause
Insufficient power grid density

### Fix
```tcl
# Add more stripes
addStripe -nets {VSS VDD} -layer met4 \
          -set_to_set_distance 20  ;# Closer spacing

# Increase stripe width
addStripe -nets {VSS VDD} -layer met4 \
          -width 10  ;# Wider stripes
```

## Issue 4: Layer Not Available

### Pattern
```
Layer not found in technology
Invalid layer name
```

### Fix
```tcl
# Check available layers
report_layer

# Use correct layer names from LEF
# Skywater 130nm: li1, met1-met5
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| Unconnected pins | "connectivity" | High | Yes |
| Power short | "VDD-VSS short" | High | Yes |
| IR drop | "IR drop" | Medium | Yes |
| Layer error | "not found" | High | No |
