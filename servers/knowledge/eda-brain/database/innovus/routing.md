---
tool: innovus
command_category: routing
version: 20.10+
source: Cadence Innovus Text Command Reference
---

# route_design

## Syntax
```tcl
route_design [-global]
             [-detail]
             [-timing_driven]
             [-congestion_driven]
             [-incremental]
             [-global_detail]
             [-via_opt]
             [-wire_opt]
             [-optimize]
```

## Description
Performs global and detailed routing of the design. This is the main routing command in Innovus that connects all nets according to design rules.

## Arguments

| Option | Description |
|--------|-------------|
| `-global` | Run global routing only |
| `-detail` | Run detailed routing only |
| `-timing_driven` | Enable timing-driven routing |
| `-congestion_driven` | Enable congestion-driven routing |
| `-incremental` | Incremental routing |
| `-global_detail` | Run both global and detailed routing |
| `-via_opt` | Via optimization only |
| `-wire_opt` | Wire optimization only |
| `-optimize` | Post-route optimization |

## Examples

### Standard Routing
```tcl
# Run full routing flow
route_design
```

### Global Routing Only
```tcl
# Global routing for congestion analysis
route_design -global
```

### Detailed Routing Only
```tcl
# Detailed routing after global route
route_design -detail
```

### Timing-Driven Routing
```tcl
# Route with timing optimization
route_design -timing_driven
```

### Post-Route Optimization
```tcl
# Optimize routed design
route_design -optimize
```

## Related Commands

### setNanoRouteMode
```tcl
setNanoRouteMode -mode value
```

Configures nanoRoute (the Innovus routing engine).

| Option | Description | Default |
|--------|-------------|---------|
| `-route_with_timing_driven` | Timing-driven routing | true |
| `-route_with_congestion_driven` | Congestion-driven routing | true |
| `-route_with_si_driven` | SI-driven routing | false |
| `-route_antenna_diode_insertion` | Insert antenna diodes | false |
| `-route_insert_antenna_diode` | Insert antenna diodes | false |
| `-route_top_routing_layer` | Top routing layer | - |
| `-route_bottom_routing_layer` | Bottom routing layer | - |
| `-route_strictly_honor_layer_range` | Honor layer constraints | false |

**Example:**
```tcl
setNanoRouteMode -route_with_timing_driven true
setNanoRouteMode -route_with_congestion_driven true
setNanoRouteMode -route_top_routing_layer M6
setNanoRouteMode -route_bottom_routing_layer M2
route_design
```

### setRouteMode
```tcl
setRouteMode -mode value
```

General routing mode settings.

| Option | Description |
|--------|-------------|
| `-earlyGlobalRoute` | Enable early global route |
| `-earlyGlobalRoutePartitionPin` | Route partition pins |

### verify_drc
```tcl
verify_drc [-report report_file]
           [-limit limit]
           [-area {x1 y1 x2 y2}]
```

Verifies design rule compliance.

**Example:**
```tcl
verify_drc -report drc.rpt
```

### verifyConnectivity
```tcl
verifyConnectivity [-report report_file]
                   [-type {all|open|short}]
```

Verifies net connectivity.

**Example:**
```tcl
verifyConnectivity -report connectivity.rpt
```

### verifyProcessAntenna
```tcl
verifyProcessAntenna [-report report_file]
                     [-error_limit limit]
```

Checks for antenna violations.

**Example:**
```tcl
verifyProcessAntenna -report antenna.rpt
```

### addFiller
```tcl
addFiller [-cell filler_cells]
          [-prefix prefix]
          [-mark]
          [-area {x1 y1 x2 y2}]
```

Adds filler cells to complete the layout.

**Example:**
```tcl
addFiller -cell "FILL1 FILL2 FILL4 FILL8" -prefix FILLER_
```

### deleteFiller
```tcl
deleteFiller [-cell filler_cells] [-all]
```

Removes filler cells.

**Example:**
```tcl
deleteFiller -all
```

## Routing Flow Example
```tcl
# Configure routing
setNanoRouteMode -route_with_timing_driven true
setNanoRouteMode -route_with_congestion_driven true
setNanoRouteMode -route_top_routing_layer M6
setNanoRouteMode -route_bottom_routing_layer M2

# Run global routing
route_design -global

# Check congestion
reportCongestion

# Run detailed routing
route_design -detail

# Verify routing
verify_drc -report drc.rpt
verifyConnectivity -report connectivity.rpt

# Check antenna violations
verifyProcessAntenna -report antenna.rpt

# Post-route optimization
route_design -optimize

# Add filler cells
addFiller -cell "FILL1 FILL2 FILL4 FILL8" -prefix FILLER_

# Final verification
verify_drc -report final_drc.rpt

# Save checkpoint
saveDesign routed.enc
```

## ECO Routing
```tcl
# ECO changes - incremental routing
ecoRoute -target {modified_nets}

# Or use incremental route_design
route_design -incremental
```

## Common Errors

### Error: Routing congestion
```
**ERROR: (NR-1): Global routing congestion exceeds limit
```
**Solution**: Increase core area, reduce placement density, or add routing resources

### Error: DRC violations
```
**ERROR: (NR-2): Detailed routing completed with DRC violations
```
**Solution**: Run route_design -optimize or manual ECO

### Error: Unrouted nets
```
**ERROR: (NR-3): N nets remain unrouted
```
**Solution**: Check for routing blockages or layer constraints

### Error: Antenna violations
```
**ERROR: (ANT-1): Antenna violations detected
```
**Solution**: Enable antenna diode insertion with setNanoRouteMode

## Best Practices
1. Set appropriate top/bottom routing layers
2. Enable timing-driven routing for performance
3. Check congestion after global routing
4. Verify DRC and connectivity after detailed routing
5. Run antenna check before signoff
6. Add filler cells after routing completion
7. Save checkpoint before and after routing

## Source
- [Cadence Innovus Text Command Reference](https://studylib.net/doc/26088395/innovus-text-command-reference)
- [Innovus User Guide](https://studylib.net/doc/26203625/innovusguide)
