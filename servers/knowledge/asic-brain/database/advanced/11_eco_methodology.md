---
topic: eco_methodology
sources:
  - https://www.synopsys.com/glossary/what-is-functional-eco.html
  - https://www.design-reuse.com/article/61618-implementation-of-metal-eco-using-mask-programmable-cell-for-hold-timing-violations/
  - https://www.design-reuse.com/articles/?id=38868&print=yes
  - https://www.cadence.com/en_US/home/resources/datasheets/conformal-eco-designer-ds.html
  - https://teamvlsi.com/2021/02/eco-flow-in-physical-design.html
---

# Engineering Change Order (ECO) Methodology

## Overview

**Engineering Change Order (ECO)** is a process to implement design changes at later stages of development without requiring a complete chip redesign. It provides a cost-effective and time-efficient solution to address:
- Design errors
- Performance issues
- Design specification changes
- Bugs found during silicon validation

## Types of ECO by Mask Stage

| Type | Description | When Applied |
|------|-------------|------------|
| **Pre-Mask ECO** | Changes made before mask fabrication; can modify both metal and base layers | Before tapeout |
| **Post-Mask ECO** | Changes made after mask fabrication; limited to metal layers only | After tapeout |

### Key Difference
- **Pre-mask ECO**: Full flexibility - can add/delete/move cells, change any layer
- **Post-mask ECO**: Restricted to metal layer changes only; uses **spare cells** or **mask-programmable cells**

## Metal Mask ECO (Post-Mask ECO)

### Definition
**Metal ECO** is a process carried out by changing only the **metal connections (metal layers and vias)**, while keeping the **base layers (FEOL - Front End of Line)** unchanged.

### Why Metal-Only?
- **Base layer masks represent ~70% of total mask set cost**
- Metal-only changes cost only tens of thousands vs. millions for full mask changes
- Faster time-to-market
- Avoids complete silicon re-spin

## Functional ECO vs. Physical ECO

| Aspect | **Functional ECO** | **Physical ECO** |
|--------|-------------------|------------------|
| **Purpose** | Fix logic/functional bugs, modify RTL functionality | Fix timing, DRC, IR drop, routing issues |
| **Changes** | Add/remove/modify logic gates | Cell sizing, buffer insertion, placement tweaks |
| **Netlist Impact** | Modifies gate-level netlist | Typically preserves netlist topology |
| **Tools Used** | Conformal ECO Designer, Formality, Genus | ICC/Innovus ECO flow, manual routing |

### Functional ECO Process
1. Determine minimum RTL portion requiring re-synthesis
2. Identify smallest patch area for iteration
3. Verify correctness using formal equivalence checking (LEC)

## Metal ECO Implementation Methods

### Method 1: Spare Cells (Traditional Approach)

- Pre-inserted during synthesis/P&R as "spare modules"
- Contains variety of cells: INV, BUF, NAND, NOR, MUX, FF, Latch
- Distributed evenly across chip

**Limitations**:
- Limited cell types/drive strengths
- Placement may not be optimal
- Can cause DRV (Design Rule Violation) issues

### Method 2: Mask-Programmable Cells (Advanced Approach)

- **ECO filler cells** that can be converted to functional cells
- Same FEOL footprint, only contact/metal layers differ

**Advantages**:
- Overcomes spare cell limitations
- Flexible functionality
- Supported by major EDA tools and library vendors

**Implementation Flow**:
1. Map filler/decap cells to functional cells using vendor mapping
2. Get VT, orientation, location of target cells
3. Delete filler cells -> add mapped functional cells
4. Maintain same orientation/location for base layer consistency
5. PG connect and route
6. Run PV, STA, and LVL (Layout vs. Layout) checks

## Physical Design ECO Flow

### Pre-Mask ECO Steps
1. Describe ECO specification
2. Capture the specification
3. Compare ECO netlist with design netlist
4. Update placement with ECO changes
5. Perform ECO routing
6. Insert filler cells

### Post-Mask ECO Steps
1. Describe and capture specification
2. Compare ECO netlist with design netlist
3. Check spare cell feasibility
4. Spare cell mapping
5. Incremental routing + DRC fix
6. Formal verification

## Key Industry Tools

| Tool | Vendor | Purpose |
|------|--------|---------|
| **Conformal ECO Designer** | Cadence | Functional ECO analysis, optimization, generation |
| **Genus Synthesis Solution** | Cadence | Logic synthesis and ECO optimization |
| **Innovus Implementation System** | Cadence | Physical implementation of ECO changes |
| **ICC/ICC2** | Synopsys | Physical ECO implementation |
| **Formality** | Synopsys | Equivalence checking |

## ECO Tcl Commands (Innovus)

```tcl
# Load original design
loadDesign top.enc.dat top

# Load ECO netlist
loadECO eco_changes.v

# Apply ECO
ecoPlace
ecoRoute

# Verify ECO
verify_eco

# Save ECO design
saveDesign top_eco.enc
```

## Metal Mask ECO vs. Full Mask ECO

| Parameter | **Metal Mask ECO** | **Full Mask ECO** |
|-----------|-------------------|-------------------|
| **Layers Changed** | Metal/BEOL only | All layers (FEOL + BEOL) |
| **Cost** | ~$10K-$100K | ~$1M+ |
| **Time** | Weeks | Months |
| **Complexity** | Minor fixes only | Major redesigns |
| **New Cells** | Limited (spare cells only) | Unlimited |
| **Designation** | 1p1, 1p2, A1, A2... | 2p0, B0, C0... |

## Common ECO Scenarios

| Scenario | ECO Type | Solution |
|----------|----------|----------|
| Logic bug fix | Functional | Spare cell mapping, re-route |
| Setup violation | Physical | Upsize cells, add buffers |
| Hold violation | Physical | Add delay cells, use spare inverters |
| Clock skew issue | Physical | Adjust clock tree |
| DRC violation | Physical | Local re-route |
| Antenna violation | Physical | Add jumper or diode |

## Best Practices

1. **Plan for ECO** - Insert spare cells during initial implementation
2. **Document changes** - Maintain clear ECO specification
3. **Verify equivalence** - Always run LEC after functional ECO
4. **Check timing** - Re-run STA after any ECO
5. **Minimize changes** - Smaller ECOs are less risky
6. **Preserve base layers** - For post-mask ECO, maintain FEOL consistency
