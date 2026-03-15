---
title: Floorplanning
stage: 2
tool: innovus / icc2_shell
prerequisites:
  - Design initialized
  - Synthesized netlist loaded
  - LEF/tech library loaded
  - Target utilization known
next_stage: power-planning
qor_metrics: [Utilization, Core_Area, Die_Area, Row_Utilization]
risk_level: moderate
duration: 2-10 minutes
---

# Floorplanning (Stage 2)

Complete floorplanning workflow. Covers die/core area definition, IO placement,
macro placement, and placement blockages.

## Quick Reference

```
Input: Initialized design
Output: Floorplan with core, die, IO
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Floorplan Workflow

1. **Create Basic Floorplan** - Define core size and utilization
2. **Place IO Pins** - Assign pin locations
3. **Place Macros** - Position hard macros
4. **Create Power Grid** - Add power rings and stripes
5. **Add Placement Blockages** - Define keepout areas

### Key Concepts

#### Utilization Targets

| Design Type | Target Util | Max Util |
|-------------|-------------|----------|
| High-performance | 60-70% | 75% |
| Standard | 70-75% | 80% |
| Density-focused | 75-80% | 85% |
| Congested design | 50-60% | 65% |

#### Aspect Ratio Guidelines

| Aspect Ratio | Use Case |
|--------------|----------|
| 1:1 | General purpose, balanced |
| 2:1 | Data path oriented |
| 1:2 | Memory-like structures |
| Custom | Match pad frame |

## Innovus Version-Specific Commands

**IMPORTANT:** Different Innovus versions have different floorplan command syntax.

### Innovus v20.10 and Later

```tcl
# CORRECT for Innovus v20.10+
floorPlan -site unithd -r 1.0 0.70 10 10 10 10
```

### Version Compatibility

| Command | v19.x | v20.x | Notes |
|---------|-------|-------|-------|
| `floorPlan -site -r ...` | ✓ | ✓ | Recommended |
| `create_floorplan -core_utilization` | ✓ | ⚠️ | May fail in v20.10 |

## Next Stage

After floorplan complete, proceed to [Power Planning](../power-planning/INDEX.md).

Required state:
- Core area defined
- IO pins placed
- Target utilization achieved
