---
tool: innovus
command_category: placement
version: 20.10+
source: Cadence Innovus Text Command Reference
---

# place_opt_design

## Syntax
```tcl
place_opt_design [-pre_place_opt]
                 [-post_place_opt]
                 [-incremental]
                 [-no_pre_place_opt]
                 [-no_post_place_opt]
                 [-place]
                 [-opt]
                 [-cts]
```

## Description
Performs placement and optimization of the design. This includes standard cell placement, timing optimization, and congestion optimization. This is the main placement command in Innovus.

## Arguments

| Option | Description |
|--------|-------------|
| `-pre_place_opt` | Run pre-placement optimization only |
| `-post_place_opt` | Run post-placement optimization only |
| `-incremental` | Incremental placement and optimization |
| `-no_pre_place_opt` | Skip pre-placement optimization |
| `-no_post_place_opt` | Skip post-placement optimization |
| `-place` | Run placement only (no optimization) |
| `-opt` | Run optimization only |
| `-cts` | Prepare for CTS (clock-aware placement) |

## Examples

### Standard Placement
```tcl
# Run full placement and optimization
place_opt_design
```

### Placement Only
```tcl
# Place cells without optimization
place_opt_design -place
```

### Incremental Placement
```tcl
# Incremental placement after ECO changes
place_opt_design -incremental
```

### CTS-Aware Placement
```tcl
# Placement with CTS awareness
place_opt_design -cts
```

## Related Commands

### placeDesign
```tcl
placeDesign [-inPlaceOpt]
            [-noPrePlaceOpt]
            [-noOpt]
```
Legacy placement command (use place_opt_design for new designs).

### setPlaceMode
```tcl
setPlaceMode -mode value
```

Configure placement options:

| Option | Description | Default |
|--------|-------------|---------|
| `-place_detail_aware` | Detail route aware placement | false |
| `-place_global_cong_effort` | Congestion effort (low/med/high) | medium |
| `-place_global_timing_effort` | Timing effort (low/med/high) | medium |
| `-place_global_place_io_pins` | Place IO pins during global place | false |
| `-place_global_module_aware` | Module-aware placement | false |
| `-place_detail_color_aware` | Color-aware placement (DPT) | false |
| `-place_detail_dpt_aware` | DPT-aware detail placement | false |

**Example:**
```tcl
setPlaceMode -place_global_cong_effort high
setPlaceMode -place_global_timing_effort high
place_opt_design
```

### addTieHiLo
```tcl
addTieHiLo [-cell tieCell] [-prefix prefix]
```

Adds tie-high/tie-low cells for constant nets.

**Example:**
```tcl
addTieHiLo -cell TIEHI -prefix TIEHI_
addTieHiLo -cell TIELO -prefix TIELO_
```

### setOptMode
```tcl
setOptMode -mode value
```

Configure optimization options:

| Option | Description |
|--------|-------------|
| `-fixCap` | Fix capacitance violations |
| `-fixTran` | Fix transition violations |
| `-fixFanout` | Fix fanout violations |
| `-setupTargetSlack` | Target setup slack |
| `-holdTargetSlack` | Target hold slack |
| `-maxDensity` | Maximum placement density |
| `-drcMargin` | DRC margin factor |

**Example:**
```tcl
setOptMode -fixCap true -fixTran true -fixFanout true
setOptMode -maxDensity 0.85
place_opt_design
```

### refinePlace
```tcl
refinePlace [-incremental]
```

Fine-tunes cell placement after initial placement.

### createPlaceBlockage
```tcl
createPlaceBlockage [-area {x1 y1 x2 y2}]
                    [-type {hard|soft|partial}]
                    [-partial density]
                    [-name name]
```

Creates placement blockages.

| Type | Description |
|------|-------------|
| `hard` | No cells allowed |
| `soft` | Cells discouraged |
| `partial` | Density-limited placement |

**Example:**
```tcl
# Hard blockage for macro
createPlaceBlockage -area {400 300 600 500} -type hard -name macro_blk

# Soft blockage for routing channel
createPlaceBlockage -area {0 200 1000 250} -type soft -name channel_blk

# Partial blockage with 30% density
createPlaceBlockage -area {100 100 200 200} -type partial -partial 0.30
```

### deletePlaceBlockage
```tcl
deletePlaceBlockage [-name name] [-all]
```

Removes placement blockages.

## Complete Placement Flow
```tcl
# Pre-placement setup
setDesignMode -process 28

# Set placement mode
setPlaceMode -place_global_cong_effort high
setPlaceMode -place_global_timing_effort high

# Set optimization mode
setOptMode -fixCap true -fixTran true -fixFanout true
setOptMode -maxDensity 0.85

# Add tie cells
addTieHiLo -cell TIEHI -prefix TIEHI_
addTieHiLo -cell TIELO -prefix TIELO_

# Create placement blockages for macros
foreach macro [get_cells -filter "is_macro==true"] {
    set bbox [get_attr $macro bbox]
    set x1 [lindex $bbox 0 0]
    set y1 [lindex $bbox 0 1]
    set x2 [lindex $bbox 1 0]
    set y2 [lindex $bbox 1 1]
    createPlaceBlockage -area [list $x1 $y1 $x2 $y2] -type hard
}

# Run placement
place_opt_design

# Report placement quality
report_place

# Check congestion
reportCongestion

# Save checkpoint
saveDesign placed.enc
```

## Common Errors

### Error: Overlap detected
```
**ERROR: (PLACE-1): Cell overlap detected after placement
```
**Solution**: Check for conflicting placement blockages or fixed cells

### Error: Density too high
```
**ERROR: (PLACE-2): Target density exceeds maximum allowed
```
**Solution**: Increase core area or reduce target density with setOptMode

### Error: Unplaced cells
```
**ERROR: (PLACE-3): N cells remain unplaced
```
**Solution**: Check for hard blockages covering all available space

## Best Practices
1. Set appropriate target density (typically 70-85%)
2. Use congestion-driven placement for dense designs
3. Place macros before standard cells
4. Add placement blockages around macros
5. Run trial route to check congestion after placement
6. Verify timing after placement before proceeding to CTS

## Source
- [Cadence Innovus Text Command Reference](https://studylib.net/doc/26088395/innovus-text-command-reference)
- [Innovus User Guide](https://studylib.net/doc/26203625/innovusguide)
