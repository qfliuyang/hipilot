---
tool: innovus
command_category: floorplanning
version: 20.10+
source: Cadence Innovus Text Command Reference
---

# floorPlan

## Syntax
```tcl
floorPlan [-site siteName] [-s coreWidth coreHeight]
          [-a aspectRatio coreUtilization]
          [-d dieWidth dieHeight]
          [-b coreToLeft coreToBottom coreToRight coreToTop]
          [-r coreToLeft coreToBottom coreToRight coreToTop]
          [-noSnap]
```

## Description
Creates the floorplan for the design, defining the die area, core area, and placement rows. This is typically the first step after design initialization.

## Arguments

| Option | Description | Default |
|--------|-------------|---------|
| `-site siteName` | Site name for row creation | First site in LEF |
| `-s w h` | Core size in microns | - |
| `-a ratio util` | Aspect ratio and core utilization | - |
| `-d w h` | Die size in microns | - |
| `-b l b r t` | Core to die boundary spacing (balanced) | - |
| `-r l b r t` | Core to die boundary spacing (relative) | - |
| `-noSnap` | Don't snap to manufacturing grid | - |

## Examples

### Using Aspect Ratio and Utilization
```tcl
# Create floorplan with aspect ratio 1.0 (square) and 70% utilization
floorPlan -site coreSite -a 1.0 0.70
```

### Using Core Size
```tcl
# Create floorplan with specific core dimensions
floorPlan -site coreSite -s 1000 800
```

### Using Die Size with Margins
```tcl
# Create floorplan with specific die size
floorPlan -site coreSite -d 1200 1000 -b 100 100 100 100
```

### Relative Margins
```tcl
# Create floorplan with relative core-to-die margins
floorPlan -site coreSite -a 1.0 0.75 -r 10 10 10 10
```

## Related Commands

### place_pins
```tcl
place_pins [-ports portList] [-pinList pinList]
           [-side side] [-offset offset]
           [-layer layer] [-width width] [-depth depth]
```

Places pins on the specified side of the die boundary.

**Example:**
```tcl
# Place all pins on left and right sides
place_pins -ports [get_ports *] -side {left right}

# Place specific pins with specific layers
place_pins -pinList [get_pins clk reset] -side top -layer M3
```

### editPin
```tcl
editPin -pin pinName -side side -layer layer
        -offset offset -spreadType type
```

Edits pin placement for specific pins.

**Example:**
```tcl
editPin -pin clk -side top -layer M3 -offset 100
```

### createRow
```tcl
createRow -site siteName -area {x1 y1 x2 y2}
```

Creates placement rows in a specific area.

**Example:**
```tcl
createRow -site coreSite -area {100 100 900 700}
```

### cutRow
```tcl
cutRow -area {x1 y1 x2 y2}
```

Cuts/removes rows in a specific area (for macro placement).

**Example:**
```tcl
# Cut rows for macro placement
cutRow -area {400 300 600 500}
```

### createTrack
```tcl
createTrack -layer layerName -direction {X|Y}
            -start start -step step -count count
```

Creates routing tracks for a layer.

**Example:**
```tcl
createTrack -layer M1 -direction X -start 0.5 -step 0.5 -count 2000
```

## Complete Floorplan Example
```tcl
# Initialize design
init_design

# Create floorplan with 70% utilization
floorPlan -site coreSite -a 1.0 0.70

# Place pins
place_pins -ports [get_ports *] -side {left right top bottom}

# Cut rows for macros
foreach macro [get_cells -filter "is_macro==true"] {
    set bbox [get_cell_bbox $macro]
    cutRow -area $bbox
}

# Place macros
place_macros -macros [get_cells -filter "is_macro==true"]

# Create placement blockages around macros
createPlaceBlockage -area [get_macro_bbox] -type hard

# Verify floorplan
checkFloorplan
```

## Common Errors

### Error: Site not found
```
**ERROR: (FPLAN-1): Site 'coreSite' not found in LEF
```
**Solution**: Check LEF file for correct site name using `get_db site_names`

### Error: Invalid aspect ratio
```
**ERROR: (FPLAN-2): Aspect ratio must be positive
```
**Solution**: Use positive value for aspect ratio (width/height)

### Error: Core utilization too high
```
**ERROR: (FPLAN-3): Core utilization exceeds 100%
```
**Solution**: Reduce utilization or increase core area

## Best Practices
1. Keep core utilization between 60-80% for initial floorplan
2. Leave adequate space for power routing
3. Place macros before cutting rows
4. Use consistent site names from LEF
5. Verify pin accessibility after placement

## Source
- [Cadence Innovus Text Command Reference](https://studylib.net/doc/26088395/innovus-text-command-reference)
- [Innovus Floorplan Tutorial](https://s2.smu.edu/~manikas/CAD_Tools/CPR/lib/Innovus_PR_Tutorial2019Feb.pdf)
