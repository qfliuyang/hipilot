---
tool: innovus
command_category: power_planning
version: 20.10+
source: Cadence Innovus Text Command Reference
---

# Power Planning Commands

## addRing

### Syntax
```tcl
addRing [-nets netList] [-type core|block|pad]
        [-layer {topLayer bottomLayer leftLayer rightLayer}]
        [-width width | -width {topW bottomW leftW rightW}]
        [-spacing spacing | -spacing {topS bottomS leftS rightS}]
        [-offset offset | -offset {topO bottomO leftO rightO}]
        [-center 0|1]
        [-jogDistance distance]
        [-threshold threshold]
        [-follow core]
```

### Description
Creates power/ground rings around the core, blocks, or pads.

### Arguments
| Option | Description | Default |
|--------|-------------|---------|
| `-nets` | List of power/ground nets | Required |
| `-type` | Ring type: core, block, or pad | core |
| `-layer` | Metal layer(s) for ring | Required |
| `-width` | Ring width in microns | Required |
| `-spacing` | Spacing between rings | 0 |
| `-offset` | Offset from boundary | 0 |
| `-center` | Center rings on boundary | 0 |
| `-jogDistance` | Maximum jog distance | 0 |

### Examples
```tcl
# Simple power ring around core
addRing -nets {VDD VSS} \
        -layer {M5 M5 M4 M4} \
        -width 2.0 \
        -spacing 1.0 \
        -offset 2.0

# Different widths per side
addRing -nets {VDD VSS} \
        -layer {M5 M5 M4 M4} \
        -width {5.0 5.0 4.0 4.0} \
        -spacing 1.0 \
        -offset 2.0

# Centered ring
addRing -nets {VDD VSS} \
        -layer {M5 M5 M4 M4} \
        -width 2.0 \
        -center 1
```

## addStripe

### Syntax
```tcl
addStripe [-nets netList] -layer layer
          [-direction {horizontal|vertical}]
          [-width width]
          [-spacing spacing]
          [-set_to_set_distance distance]
          [-start offset]
          [-stop offset]
          [-area {x1 y1 x2 y2}]
          [-number_of_sets n]
          [-extend_to design|core|rows|none]
          [-snap_wire_center_to_grid grid]
```

### Description
Creates power/ground stripes (vertical or horizontal) across the design.

### Arguments
| Option | Description | Default |
|--------|-------------|---------|
| `-nets` | List of power/ground nets | Required |
| `-layer` | Metal layer | Required |
| `-direction` | Stripe direction | vertical |
| `-width` | Stripe width | Required |
| `-spacing` | Spacing between VDD/VSS stripes | Required |
| `-set_to_set_distance` | Distance between stripe pairs | Required |
| `-start` | Starting offset | 0 |
| `-stop` | Ending offset | design edge |
| `-area` | Restrict to area | full design |
| `-extend_to` | Extension mode | design |

### Examples
```tcl
# Vertical stripes on M4
addStripe -nets {VDD VSS} \
          -layer M4 \
          -direction vertical \
          -width 1.0 \
          -spacing 0.5 \
          -set_to_set_distance 20.0 \
          -start 10.0

# Horizontal stripes on M5
addStripe -nets {VDD VSS} \
          -layer M5 \
          -direction horizontal \
          -width 1.5 \
          -spacing 0.5 \
          -set_to_set_distance 30.0

# Stripes in specific area
addStripe -nets {VDD VSS} \
          -layer M4 \
          -direction vertical \
          -width 1.0 \
          -spacing 0.5 \
          -set_to_set_distance 20.0 \
          -area {100 100 900 700}
```

## sroute

### Syntax
```tcl
sroute [-nets netList] [-connect {corePin|blockPin|padPin}]
       [-layerChangeRange {minLayer maxLayer}]
       [-allowJogging {true|false}]
       [-allowLayerChange {true|false}]
       [-crossoverViaLayerRange {minLayer maxLayer}]
       [-targetViaLayerRange {minLayer maxLayer}]
       [-blockPinTarget {nearestTarget|boundaryWithPin}]
       [-padPinTarget {nearestTarget|boundaryWithPin}]
       [-corePinTarget {firstAfterRowEnd|boundaryWithPin}]
```

### Description
Routes power/ground connections from rings/stripes to pins (sroute = special route).

### Arguments
| Option | Description | Default |
|--------|-------------|---------|
| `-nets` | Nets to route | all P/G nets |
| `-connect` | What to connect | all |
| `-layerChangeRange` | Layer range for routing | all layers |
| `-allowJogging` | Allow jogs in routing | true |
| `-allowLayerChange` | Allow via stacking | true |
| `-blockPinTarget` | Block pin connection target | nearestTarget |
| `-padPinTarget` | Pad pin connection target | nearestTarget |

### Examples
```tcl
# Route all power nets to all targets
sroute -nets {VDD VSS}

# Route only to core pins
sroute -nets {VDD VSS} -connect corePin

# Route with layer constraints
sroute -nets {VDD VSS} \
       -layerChangeRange {M1 M4} \
       -allowLayerChange true

# Route to block pins with specific target
sroute -nets {VDD VSS} \
       -connect blockPin \
       -blockPinTarget nearestTarget
```

## Complete Power Planning Example
```tcl
# Set power/ground nets
set_power_net -net VDD -power
set_ground_net -net VSS -ground

# Add power ring around core
addRing -nets {VDD VSS} \
        -type core \
        -layer {M5 M5 M4 M4} \
        -width 3.0 \
        -spacing 1.0 \
        -offset 2.0

# Add vertical stripes on M4
addStripe -nets {VDD VSS} \
          -layer M4 \
          -direction vertical \
          -width 1.0 \
          -spacing 0.5 \
          -set_to_set_distance 20.0

# Add horizontal stripes on M5
addStripe -nets {VDD VSS} \
          -layer M5 \
          -direction horizontal \
          -width 1.5 \
          -spacing 0.5 \
          -set_to_set_distance 30.0

# Route power to core pins
sroute -nets {VDD VSS} -connect corePin

# Route power to block pins
sroute -nets {VDD VSS} -connect blockPin

# Verify power integrity
verifyPower
```

## Power Planning Modes

### setSrouteMode
```tcl
setSrouteMode -mode value
```

Common modes:
- `-viaConnectToShape {noshape|stripe|ring|all}`
- `-allowSingleStepVia {true|false}`
- `-maxLayer layer`
- `-minLayer layer`

## Common Errors

### Error: Layer not found
```
**ERROR: (PWR-1): Layer 'M6' not found in technology
```
**Solution**: Check available layers with `get_db layers`

### Error: Net not defined as power/ground
```
**ERROR: (PWR-2): Net 'VDD' not defined as power net
```
**Solution**: Use `set_power_net -net VDD -power`

### Error: Stripe spacing too large
```
**ERROR: (PWR-3): Stripe spacing exceeds set-to-set distance
```
**Solution**: Ensure spacing < set_to_set_distance/2

## Best Practices
1. Use wider rings for lower resistance
2. Place stripes closer together in high-current areas
3. Use higher metal layers for rings (less resistance)
4. Ensure adequate via stacking between layers
5. Verify EM/IR constraints after power planning

## Source
- [Cadence Innovus Text Command Reference](https://studylib.net/doc/26088395/innovus-text-command-reference)
- [Power Planning and Routing Guide](https://support1.cadence.com/public/docs/content/20485822.html)
