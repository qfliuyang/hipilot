# Chip Finish Common Issues

Error patterns, root causes, and fixes for chip finish stage.

## Issue 1: Connectivity Errors

### Pattern
```
verifyConnectivity reports errors
Floating pins or open nets
```

### Root Cause
Power not properly reconnected or dangling nets

### Fix
```tcl
# Reconnect power
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *

# Remove dangling nets
deleteDanglingNet

# Re-verify
verifyConnectivity -type all
```

## Issue 2: GDS Export Fails

### Pattern
```
streamOut fails
GDS map file error
```

### Root Cause
Missing or incorrect GDS map file

### Fix
```tcl
# Check map file exists
file exists designs/sky130hd/pdk/gds/gds.map

# Verify layer mappings in map file
# Format: LAYER_NAME GDS_LAYER GDS_DATATYPE
```

## Issue 3: LVS Netlist Issues

### Pattern
```
LVS netlist missing cells
Hierarchy issues
```

### Root Cause
Incorrect netlist export options

### Fix
```tcl
# Correct LVS netlist export
saveNetlist -excludeLeafCell -includePowerGround -flattenBus \
            result/pr/data/design_lvs.vg

# Or include leaf cells if needed
saveNetlist -includePowerGround -flattenBus \
            result/pr/data/design_lvs.vg
```

## Issue 4: SPEF Export Fails

### Pattern
```
rcOutSpef fails
No RC corners defined
```

### Root Cause
RC corner not defined or extraction not run

### Fix
```tcl
# Define RC corner if missing
create_rc_corner -name rc_tt

# Run extraction first
extract_rc -coupling_cap true

# Then export SPEF
rcOutSpef -rcCorner rc_tt result/pr/data/design.spef
```

## Issue 5: Assign Statements Remain

### Pattern
```
Assign statements in netlist
LVS fails due to assigns
```

### Root Cause
remove_assigns not run or failed

### Fix
```tcl
# Remove assigns with buffering
remove_assigns -buffering

# Verify no assigns remain
grep "assign" netlist.v
```

## Error Pattern Summary

| Error Pattern | Keyword | Severity | Auto-fixable |
|--------------|---------|----------|--------------|
| Connectivity | "connectivity" | High | Yes |
| GDS export | "streamOut" | High | No |
| LVS netlist | "LVS" | Medium | Yes |
| SPEF export | "rcOutSpef" | Medium | Yes |
| Assigns | "assign" | Medium | Yes |
