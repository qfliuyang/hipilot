---
title: Power Planning
stage: 3
tool: innovus / icc2_shell
prerequisites:
  - Floorplan created
  - Core area defined
  - Power/ground nets named (VDD/VSS)
next_stage: placement
qor_metrics: [IR_Drop, Power_Grid_Resistance, Connectivity]
risk_level: low
duration: 1-5 minutes
---

# Power Planning (Stage 3)

Power grid creation for digital designs. Covers global net connections, power rings,
power stripes, and rail routing.

## Quick Reference

```
Input: Floorplan with core defined
Output: Power grid connected
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Power Planning Workflow

1. **Global Net Connections** - Connect VDD/VSS to pins
2. **Power Rings** - Create core ring (optional)
3. **Power Stripes** - Add upper metal layer stripes
4. **Rail Routing** - Connect standard cell rails
5. **Verification** - Check connectivity

### Power Grid Design Guidelines

#### Layer Selection

| Layer | Typical Use | Width Range |
|-------|-------------|-------------|
| M1 | Standard cell rails | 0.1-0.2 um |
| M2-M3 | Local distribution | 0.5-1.0 um |
| M4-M5 | Power stripes | 1.0-6.0 um |
| M6+ | Top-level ring | 5.0-10.0 um |

#### Skywater 130nm Example

```tcl
# Met4: Vertical stripes
addStripe -nets {VSS VDD} -layer met4 -direction vertical \
          -width 6 -spacing 2 -set_to_set_distance 30

# Met5: Horizontal stripes
addStripe -nets {VSS VDD} -layer met5 -direction horizontal \
          -width 6 -spacing 2 -set_to_set_distance 30
```

## Next Stage

After power planning complete, proceed to [Placement](../placement/INDEX.md).

Required state:
- All global nets connected
- Power stripes added
- Rails routed
- Connectivity verified
