---
topic: placement
sources:
  - https://course.ece.cmu.edu/~ee760/760docs/lec12.pdf
  - https://the-openroad-project.github.io/micro2022tutorial/assets/openroad_tutorial_slides_micro2022.pdf
  - https://www.makinarocks.ai/en/blog/application-specific-integrated-circuit-asic-floorplan-automation-part-ii/
---

# Placement Optimization Techniques

## Overview

Placement is the process of determining the physical locations of standard cells within the core area while optimizing for timing, congestion, and power. It heavily influences timing closure and overall design quality.

## Three-Phase Placement Process

### 1. Global Placement
- Rough positioning of cells to minimize wirelength and congestion
- Cells may overlap during this phase
- Uses analytical algorithms (quadratic placement, force-directed)

### 2. Legalization
- Remove overlaps between cells
- Snap cells to placement grid
- Maintain relative ordering from global placement
- Minimize displacement from global placement positions

### 3. Detailed Placement
- Fine-tune cell positions for timing closure
- Local optimizations: cell swapping, row assignment
- Timing-driven optimizations

## Placement Objectives

| Objective | Description |
|-----------|-------------|
| **Wirelength Minimization** | Reduce total interconnect length (HPWL, RSMT) |
| **Timing Optimization** | Meet setup and hold constraints |
| **Congestion Management** | Ensure routability |
| **Power Reduction** | Minimize dynamic and leakage power |
| **Area Efficiency** | Optimize cell density and spacing |

## Timing-Driven Placement

### Net Weighting
- Assign higher weights to timing-critical nets
- Critical paths get priority in placement decisions
- Weight calculation based on slack

```tcl
# Example: Set net weights based on timing criticality
setNetWeight -net critical_net -weight 10.0
```

### Path-Based Optimization
- Identify critical paths from timing analysis
- Optimize placement of cells on critical paths
- Iterative refinement with timing feedback

## Congestion-Driven Placement

### Congestion Estimation
- Predict routing demand based on placement density
- Use global routing for accurate estimation
- Identify congestion hotspots

### Mitigation Techniques
| Technique | Description |
|-----------|-------------|
| **Cell Spreading** | Reduce density in congested areas |
| **Virtual Padding** | Add artificial spacing around congested cells |
| **Region Constraints** | Guide placement away from congested regions |
| **Macro Channel Optimization** | Ensure sufficient channels between macros |

## Power-Aware Placement

### Techniques
- **Activity-Based Placement**: Place high-activity cells closer to reduce dynamic power
- **Multi-Vt Optimization**: Use high-Vt cells for non-critical paths
- **Clock Gating Integration**: Place clock gating cells optimally

## Placement Constraints

### Region Constraints
```tcl
# Create placement region
createRegion -name region1 -box {100 100 500 500}
addInstToRegion -inst my_inst -region region1
```

### Placement Blockages
```tcl
# Hard blockage - no cells allowed
createPlaceBlockage -box {0 0 1000 100} -type hard

# Soft blockage - cells discouraged but allowed
createPlaceBlockage -box {200 200 400 400} -type soft

# Partial blockage - limited density allowed
createPlaceBlockage -box {300 300 500 500} -type partial -density 30
```

### Fixed Cells
```tcl
# Fix cell placement
setPlaceStatus -inst my_inst -fixed true
```

## Special Cells During Placement

### End-Cap Cells
- Placed at ends of cell rows
- Prevent DRC violations at row boundaries
- Ensure proper well continuity

### Tap Cells (Well Taps)
- Prevent latch-up in substrate
- Placed at regular intervals based on technology rules
- Typically every 20-50 microns

### Filler Cells
- Fill gaps between standard cells
- Maintain power rail continuity
- Added after detailed placement

## Advanced Placement Techniques

### ML-Based Placement
- **Google's Circuit Training**: Reinforcement learning for macro placement
- **Graph Neural Networks**: Capture connectivity for better decisions
- **Predictive Models**: Estimate QoR before full placement

### Placement Optimization Iterations
```
Initial Placement
      |
      v
Timing Analysis -> Critical Path Identification
      |
      v
Incremental Optimization (swapping, sizing)
      |
      v
Legalization -> Detailed Placement
      |
      v
Convergence Check -> Repeat or Done
```

## Placement Tcl Commands (Innovus)

```tcl
# Set placement mode
setPlaceMode -timingDriven true \
             -congEffort high \
             -modulePlan true

# Run placement
place_opt_design

# Incremental placement refinement
placeDesign -incremental

# Add end-cap cells
addEndCap -prefix ENDCAP

# Add tap cells
addWellTap -cell TAPCELL -prefix WELLTAP -interval 25

# Check placement quality
checkPlace
```

## Placement Quality Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Total Wirelength** | Sum of all net lengths | Minimized |
| **Maximum Cell Density** | Highest local cell density | < 80% |
| **Timing Slack** | Worst negative slack | > 0 |
| **Congestion** | Routing overflow estimate | < 5% |
| **Displacement** | Movement from global to detailed | Minimized |

## Best Practices

1. **Start with good floorplan** - Macro placement drives placement quality
2. **Use realistic constraints** - Don't over-constrain initially
3. **Balance timing and congestion** - Aggressive timing can cause congestion
4. **Iterate with timing analysis** - Placement and timing are interdependent
5. **Check for placement issues** - Use checkPlace to identify problems early
6. **Consider CTS impact** - Leave space for clock tree buffers
