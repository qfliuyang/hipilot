---
topic: floorplanning
sources:
  - https://vlsiweb.com/core-and-io-placement-in-pd/
  - https://www.makinarocks.ai/en/blog/application-specific-integrated-circuit-asic-floorplan-automation-part-ii/
  - https://vlsiguru.com/blog/understanding-floorplanning-vlsi-tips-for-beginners
  - https://www.physicaldesign4u.com/2019/12/floorplanning-floor-planning-is-art-of.html
  - https://course.ece.cmu.edu/~ee760/760docs/lec12.pdf
---

# Floorplanning: Strategies and Best Practices

## Floorplanning Fundamentals

Floorplanning is the critical first step in physical design that establishes the chip's architectural layout. Key considerations include:

| Aspect | Best Practice |
|--------|-------------|
| **Core Area** | Calculate based on standard cell count, utilization target, and aspect ratio |
| **Die Size** | Determine if design is **core-limited** (core defines size) or **pad-limited** (IO pads define size) |
| **Utilization** | Typically 70-80% for initial floorplan; leave room for optimization |
| **Manufacturing Grid** | Adhere to foundry-specific grid requirements |

## Macro Placement Best Practices

### Placement Strategy
- **Place hard macros first** (SRAMs, PLLs, analog IP) as they have fixed shapes and critical timing requirements
- Position macros **around the core boundary**, leaving buffer space for optimization
- Use **fly-lines** (connectivity visualization) to minimize interconnect length between macros and to IO pins

### Key Guidelines

| Guideline | Rationale |
|-----------|-----------|
| Keep macros of **same hierarchy together** | Reduces routing complexity and improves timing |
| Maintain **sufficient channel width** between macros | Ensures routability |
| Place macros communicating with **IO pins near core boundary** | Minimizes critical path delays |
| Add **keep-out margins** around macros | Prevents standard cell placement near macro pins |
| Use **placement blockages** at macro corners | Avoids routing congestion hotspots |
| **Avoid notches** in macro placement | Use hard blockages if unavoidable |
| Ensure **power strap pairs** between adjacent macros | Maintains power integrity |

### Channel Width Calculation

```
Channel width = (Number of pins x Pitch) / Number of routing layers

For 100 pins total, 0.6um pitch, 6 horizontal layers:
Channel width = (100 x 0.6) / 6 = 10um
```

## IO Placement Best Practices

### IO Ring Design
- Design the **IO ring around the chip periphery** for optimal signal quality and power distribution
- Use specialized pad types based on noise sensitivity:
  - **PVDD3A**: For analog pads requiring cleaner power
  - **PVDD3AC**: For quieter core power to analog circuits

### Power and Signal Integrity
- Separate **analog and digital IO** areas to prevent noise coupling
- Manage **cell density near power lines** to avoid routing problems
- Consider **voltage domain isolation** for mixed-signal designs

### Advanced IO Placement (IOPlace Algorithm)
Research from University of Toronto proposes a **greedy algorithm** for electrically sound IO buffer placement:
1. Sort IO buffers by current consumption (highest first)
2. Calculate voltage drop slack at all grid nodes
3. Place buffers at nodes with highest allowable current margin
4. Update slack iteratively to prevent IR drop violations

## Power Planning Integration

| Component | Implementation |
|-----------|---------------|
| **Power Rings** | Around core and IO periphery |
| **Power Straps** | Vertical/horizontal distribution across core |
| **Power Rails** | Standard cell row power distribution |
| **Tap Cells** | Prevent latch-up in substrate |
| **End-cap Cells** | Terminate standard cell rows |

## Modern Automation Approaches

### Machine Learning-Based Placement
- **Reinforcement Learning (RL)** for macro placement
- **Graph Neural Networks (GNN)** to capture netlist connectivity
- **CNN-based position prediction** for placement optimization

### Heuristics for RL-Based Placement

| Technique | Purpose |
|-----------|---------|
| **Single Cluster** | Group standard cells together to reduce complexity |
| **Bounding Box** | Restrict macro placement to periphery, standard cells to core |
| **Invalid Action Masking** | Prevent illegal placements (overlaps, out-of-bounds) |

## Validation Checklist

Before proceeding to detailed placement:
- [ ] All macros set to `dont_touch` attribute
- [ ] Placement blockages correctly added (hard/soft/partial)
- [ ] TLU+ files configured for accurate RC/timing estimation
- [ ] All scenarios activated (MCMM designs)
- [ ] Clock networks set as ideal networks
- [ ] Routing layers properly configured
- [ ] Preliminary congestion analysis completed
- [ ] Early timing analysis performed
- [ ] DRC and power integrity checks passed

## Key Trade-offs

| Decision | Core-Limited Design | Pad-Limited Design |
|----------|---------------------|---------------------|
| **Die Size** | Determined by core logic area | Determined by IO pad count |
| **IO Count** | Relatively fewer IOs | Many IOs required |
| **Macro Placement** | More flexible | Constrained by pad ring |
| **Power Planning** | Standard approach | May need creative power distribution |
| **Typical Applications** | High-performance computing, AI accelerators | Interface chips, microcontrollers |

## Floorplanning Tcl Commands (Innovus)

```tcl
# Initialize floorplan
floorPlan -site coreSite -s 1000 1000 100 100 100 100

# Place macros
placeInstance macro1 100 200 R0
placeInstance macro2 500 200 MY

# Create placement blockages
createPlaceBlockage -box {0 0 1000 100} -name "IO_BLOCKAGE"

# Create routing blockages
createRouteBlk -box {200 200 400 400} -layer {M1 M2}

# Set placement constraints
setPlaceMode -congEffort high -timingDriven true

# Place standard cells
place_opt_design
```

## Best Practices Summary

1. **Start with area estimation** - Calculate based on gate count and target utilization
2. **Place macros first** - They have fixed positions and drive routing topology
3. **Leave channels for routing** - Don't pack macros too tightly
4. **Consider timing critical paths** - Place communicating macros near each other
5. **Plan for power** - Reserve space for power grid (rings, straps)
6. **Iterate with placement** - Floorplan and placement are iterative processes
