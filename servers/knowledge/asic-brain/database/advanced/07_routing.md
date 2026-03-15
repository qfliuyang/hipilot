---
topic: routing
sources:
  - https://enicslabs.com/wp-content/uploads/2025/06/Lecture-9-Routing.pdf
  - https://fusionproceedings.com/fmr/1/article/view/106
  - https://vlsigensys.com/the-vlsi-physical-design-journey-mapping-a-netlist-to-a-silicon-ready-gdsii/
---

# Routing: Detailed Routing, DRC, and Signal Integrity

## Overview

Routing is the process of creating physical interconnections between cells using the available metal layers. It transforms the logical netlist into a physical layout that can be manufactured.

## Routing Phases

### 1. Global Routing
- Assign nets to routing regions (global routing cells - GRCs)
- Determine approximate paths for all nets
- Optimize for congestion and wirelength
- Fast but less accurate

### 2. Track Assignment
- Assign nets to specific routing tracks within each GRC
- Consider layer preferences and constraints
- Prepare for detailed routing

### 3. Detailed Routing
- Create actual wire geometries
- Handle design rules (spacing, width, via rules)
- Resolve conflicts and violations
- Iterative refinement (~20 iterations default)

## Detailed Routing Process

From the VLSI design lecture notes, detailed routing involves:
- Using global route plans within each global routing cell (GRC)
- Assigning nets to tracks and laying down wires
- Connecting pins to nets
- **Solving DRC violations**
- **Reducing cross-couple capacitance** (crosstalk mitigation)
- Applying special routing rules

## Design Rule Checking (DRC)

### Critical Checks During Routing

| Check | Description |
|-------|-------------|
| **Spacing** | Minimum distance between wires (min spacing, thin/fat spacing) |
| **Width** | Minimum wire width per layer |
| **Via Rules** | Via spacing, enclosure, stacking rules |
| **Antenna Rules** | Maximum metal area without discharge path |
| **Density** | Metal density requirements for CMP |

### DRC Fixing Flow
```
Route -> Check DRC -> Identify Violations -> Fix -> Re-check
```

## Signal Integrity (SI) and Crosstalk

### Crosstalk Fundamentals

Signal Integrity during routing is synonymous with **crosstalk**.

| Term | Definition |
|------|------------|
| **Aggressor** | The switching signal that affects neighboring nets |
| **Victim** | The affected net experiencing interference |
| **Signal Slow Down** | When aggressor and victim switch in opposite directions |
| **Signal Speed Up** | When aggressor and victim switch in same direction |

### Crosstalk Mitigation Techniques

| Technique | Implementation |
|-----------|---------------|
| **Spacing** | Increase distance between aggressor and victim |
| **Shielding** | Insert grounded shield wires between critical nets |
| **Net Ordering** | Route critical nets first, away from aggressors |
| **Buffer Insertion** | Break long nets to reduce coupling window |
| **Layer Selection** | Route critical nets on less congested layers |
| **Wire Spreading** | Distribute wires to reduce local congestion |

### SI Analysis Methods
- **Infinite Window Analysis**: Older pre-90nm technologies
- **Propagated Noise Analysis**: Modern approaches using timing window overlap

## Antenna Effect

### Problem
During **plasma etching**, long metal wires act as **antennas**, collecting static charge that can damage fragile transistor gates below.

### Solutions

| Solution | Description |
|----------|-------------|
| **Jumper Insertion** | Jump up a metal layer and back down to break long runs |
| **Antenna Diodes** | Insert diodes to dissipate charge safely |
| **Layer Hopping** | Break antenna by changing layers |

### Antenna Ratio
```
Antenna Ratio = Metal Area / Gate Area

Must be < Maximum allowed ratio (technology dependent)
```

## Advanced Routing Considerations

### Multi-Patterning (Advanced Nodes)
- At 7nm and below, adjacent wires may need different masks
- **Color-aware routing**: Assign "colors" to wires for different photomasks
- Double/Quadruple patterning constraints

### Timing-Driven Routing
- Prioritize critical paths during routing
- Use net weights from timing analysis
- Minimize detours for critical nets

### SI-Driven Routing
- Built-in crosstalk and noise fixing
- Consider coupling capacitance during path search
- Shield critical nets automatically

## Routing Tcl Commands (Innovus)

```tcl
# Set routing mode
setNanoRouteMode -routeWithTimingDriven true \
                 -routeWithSiDriven true \
                 -drouteAutoStop false

# Run global routing
routeDesign -globalDetail

# Run detailed routing
routeDesign -detail

# Post-route optimization
optDesign -postRoute

# Check DRC
verify_drc -report drc.rpt

# Check antenna rules
verifyProcessAntenna -report antenna.rpt

# Fix antenna violations
fixProcessAntenna
```

## Routing Challenges & Solutions Summary

| Challenge | Impact | Solution Approach |
|-----------|--------|-------------------|
| **Crosstalk** | Timing degradation, noise, functional errors | Spacing, shielding, net ordering, buffering |
| **Antenna Effect** | Gate oxide damage during fabrication | Jumper insertion, antenna diodes, layer hopping |
| **DRC Violations** | Manufacturing failures | Iterative fixing, track assignment optimization |
| **Signal Integrity** | Setup/hold violations, reliability issues | SI-driven routing, timing window analysis |
| **Congestion** | Routing failures, detours | Global routing planning, congestion-driven optimization |

## Best Practices

1. **Use SI-driven routing** - Enable crosstalk avoidance from the start
2. **Check antenna early** - Fix antenna before they become critical
3. **Reserve space for clock** - Critical clock nets need special handling
4. **Consider multi-patterning** - At advanced nodes, color-aware routing is essential
5. **Iterate with timing** - Post-route timing may require ECO fixes
6. **Verify all checks** - DRC, LVS, antenna, EM must all pass
