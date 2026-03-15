---
topic: power_planning
sources:
  - https://chipedge.com/resources/power-planning-in-vlsi-design-balancing-efficiency-and-performance/
  - https://www.physicaldesign4u.com/2020/01/power-planning.html
  - https://www.vlsi4freshers.com/2020/01/power-planning.html
  - https://resources.pcb.cadence.com/blog/2024-power-grid-design-in-vlsi-challenges-techniques-and-optimization
  - https://www.vlsiuniverse.com/power-calculations-and-planning-pd/
---

# Power Planning: Rings, Stripes, and Rails

## Overview

Power planning is a critical stage in VLSI physical design (typically part of floorplanning) that creates a power grid network to distribute VDD (power) and VSS (ground) uniformly across the chip. The primary objective is to ensure all on-chip components receive adequate power within IR-drop limits while avoiding electromigration (EM) issues.

## Three Levels of Power Distribution

| Level | Description | Function |
|-------|-------------|----------|
| **Rings** | Carry VDD and VSS **around the chip** | Form a continuous loop around the core and/or macros to distribute power from pads |
| **Stripes** (Straps) | Carry VDD and VSS **from rings across the chip** | Vertical/horizontal lines that distribute power throughout the core region |
| **Rails** | **Connect VDD and VSS to standard cells** | Horizontal lines in M1 that directly feed individual cell power/ground pins |

## Detailed Architecture

### 1. Power Rings
- Formed around the **core** and around **critical macros/IP blocks** if needed
- Created using higher metal layers (e.g., Metal3, Metal4, Metal8, Metal9)
- Width typically calculated based on current-carrying requirements
- Connected to power pads through **trunks**

### 2. Power Stripes (Straps)
- Extend from rings into the core area in a mesh/grid pattern
- Spacing and width determined by:
  - Power consumption of the chip
  - Current density requirements
  - Metal layer current-carrying capacity (A/m)
  - IR drop budget

**Example:** In a 180nm design, stripes might be 10um wide with 100um spacing using Metal4

### 3. Power Rails
- Run horizontally in **M1** (lowest metal layer) along standard cell rows
- Standard cells are placed side-by-side, creating continuous power/ground lines
- Tapped from the stripes above through vias
- Filler cells are inserted to maintain continuity where gaps exist

## Power Planning Management Categories

| Category | Implementation |
|----------|---------------|
| **Core Cell Power Management** | Rings around core -> straps to macros -> rails to standard cells |
| **I/O Cell Power Management** | Separate rings for I/O cells; trunks connect core rings to power pads |

## Key Design Considerations

### Metal Layer Selection
- Higher metal layers preferred for rings/stripes (wider, lower resistance)
- Modern technologies (7nm, 28nm) use 9-13 metal layers
- Example stack: M1 for rails, M4/M5 for intermediate, M8/M9 for power mesh

### Critical Calculations
- Number of power pins/pads required
- Core current = Core Power / Core Voltage
- Ring and stripe widths based on EM limits
- IR drop analysis

### Ideal Power Distribution Network Properties
- Stable voltage with minimal noise
- Avoids EM wear-out and self-heating
- Minimal chip area and wiring overhead
- Easy to layout and verify

## Example Calculation

For a chip with:
- Power = 100mW, Voltage = 1V -> **Current = 100mA**
- 4 VDD pads -> **25mA per pad**
- M8 metal: 1um width carries 10mA
- 2.5um ring width -> carries 25mA
- Core size 1mm x 1mm, 25um spacing -> **40 vertical + 40 horizontal stripes**
- Stripe width = 2.5um / 40 = **0.625um**

## Modern Techniques & Challenges

| Challenge | Solution |
|-----------|----------|
| IR drop | Wider metals, more stripes, decoupling capacitors |
| Electromigration | Current density-aware width calculation |
| Power gating | Shut down inactive blocks |
| Multi-voltage domains | Separate power grids for different voltage regions |
| Thermal management | Proper heat spreading through metal planes |

## Power Planning Tcl Commands (Innovus)

```tcl
# Create power rings
addRing -nets {VDD VSS} -type core_rings \
        -layer {top M9 bottom M9 left M8 right M8} \
        -width 5 -spacing 2

# Create power stripes
addStripe -nets {VDD VSS} -layer M8 -direction vertical \
          -width 2 -spacing 50 -set_to_set_distance 100 \
          -start 50

# Create power rails (during placement)
sroute -nets {VDD VSS} -connect {corePin}

# Verify power integrity
verifyPowerVia -report power_via.rpt
```

## Electromigration (EM) Considerations

### EM Rules
- Maximum current density per metal layer (typically specified in tech file)
- Width calculation: W = I / Jmax
  - W = required width
  - I = current
  - Jmax = maximum current density

### EM Prevention
- Use wider metals for high-current paths
- Add multiple vias for layer transitions
- Distribute current across multiple parallel paths

## IR Drop Analysis

### Causes
- Resistance in power grid (R)
- Current draw (I)
- Voltage drop = I x R

### Mitigation
- Reduce grid resistance (wider metals, more parallel paths)
- Add decoupling capacitors near switching blocks
- Optimize power pad placement

## Best Practices

1. **Start with power budget** - Calculate total current and distribution
2. **Follow EM rules** - Ensure all segments meet current density limits
3. **Plan for IR drop** - Target < 10% of VDD for static IR drop
4. **Use higher metals** - Lower resistance for main distribution
5. **Add sufficient vias** - Minimize resistance at layer transitions
6. **Verify with analysis** - Run EM and IR drop checks early and often
