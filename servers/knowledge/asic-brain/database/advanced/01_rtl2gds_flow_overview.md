---
topic: rtl2gds_flow_overview
sources:
  - https://chipxpert.in/physical-design-flow-in-vlsi-from-netlist-to-gdsii/
  - https://chipxpert.in/understanding-the-asic-design-flow-key-steps-explained-for-aspiring-engineers/
  - https://nsemidesign.com/rtl-to-gdsii-a-complete-guide-to-end-to-end-vlsi-design-execution/
  - https://www.linkedin.com/pulse/from-rtl-gdsii-demystifying-asic-design-flow-abhay-goyal-3xfzf
---

# RTL-to-GDSII Physical Design Flow Overview

## Overview

The RTL-to-GDSII flow transforms a high-level hardware description (Register Transfer Level) into a manufacturable silicon layout format (GDSII). This process is critical for achieving first-pass silicon success and is typically divided into Front-End and Back-End (Physical Design) stages.

## Complete Flow Stages

### Stage 1: RTL Design & Functional Verification

| Aspect | Details |
|--------|---------|
| **Input** | Design specifications |
| **Output** | Verified RTL code (Verilog/VHDL) |
| **Tools** | ModelSim, VCS, Xcelium, Verilator |

**Key Activities:**
- Write synthesizable RTL code (no delays, no initial blocks)
- Hierarchical module design for reusability
- Proper clock domain crossing (CDC) handling
- Functional verification using testbenches, SystemVerilog, UVM
- This stage consumes 60-70% of project time

> "Finding bugs here is cheap. Finding them after fabrication costs millions."

### Stage 2: Logic Synthesis

| Aspect | Details |
|--------|---------|
| **Input** | RTL code, SDC constraints, technology library (.lib) |
| **Output** | Gate-level netlist |
| **Tools** | Synopsys Design Compiler, Cadence Genus, Yosys |

**Key Activities:**
- Convert RTL to gate-level representation using standard cells
- Boolean logic optimization
- Technology mapping to target library
- Physical synthesis: Virtual placement during synthesis to estimate real wire delays

### Stage 3: Design for Test (DFT)

| Aspect | Details |
|--------|---------|
| **Purpose** | Ensure chip testability post-manufacturing |
| **Techniques** | Scan chain insertion, BIST, boundary scan |

**Key Activities:**
- Scan insertion: Replace normal flip-flops with scan flip-flops
- Built-In Self-Test (BIST): Embed test pattern generators for memories
- ATPG (Automatic Test Pattern Generation)
- Fault coverage analysis

### Stage 4: Floorplanning

| Aspect | Details |
|--------|---------|
| **Input** | Netlist, design constraints |
| **Output** | Chip architectural blueprint |
| **Tools** | Cadence Innovus, Synopsys ICC2 |

**Key Decisions:**
| Parameter | Typical Values |
|-----------|---------------|
| Core utilization | 70-80% |
| Die size & aspect ratio | Based on area estimates |
| Macro placement | Memories, analog IP, hard blocks |
| I/O pad placement | Peripheral or area-array |
| Power grid | Rings, straps, rails reservation |

> "A bad floor plan creates routing congestion that no amount of later optimization can fix."

### Stage 5: Power Planning

| Aspect | Details |
|--------|---------|
| **Goal** | Stable power delivery network (PDN) |
| **Components** | Power rings, straps, rails, vias |

**Key Checks:**
- IR Drop analysis: Voltage drop across power network
- Electromigration (EM) analysis
- Power integrity verification

### Stage 6: Placement

| Aspect | Details |
|--------|---------|
| **Phases** | Global -> Legalization -> Detailed |
| **Optimizations** | Timing, congestion, power |

**Three-Phase Process:**
1. **Global placement** - Rough positioning (cells may overlap)
2. **Legalization** - Remove overlaps, snap to grid
3. **Detailed placement** - Fine-tune for timing closure

**Additional Steps:**
- End-cap cell insertion
- Tap cell placement (well tap/contacts)
- High-fanout net synthesis (HFNS)
- Congestion analysis

### Stage 7: Clock Tree Synthesis (CTS)

| Aspect | Details |
|--------|---------|
| **Goal** | Balanced clock distribution with minimal skew |
| **Target skew** | < 50ps (ideally zero) |
| **Techniques** | H-tree, X-tree, mesh |

**Key Metrics:**
| Parameter | Target |
|-----------|--------|
| Clock skew | Minimized |
| Insertion delay | Minimized |
| Clock power | 30-40% of total chip power |

### Stage 8: Routing

| Aspect | Details |
|--------|---------|
| **Phases** | Global -> Track assignment -> Detailed |
| **Layers** | Multiple metal layers (M1-MX) |

**Process:**
1. **Global routing** - Assign nets to routing regions
2. **Track assignment** - Assign specific tracks
3. **Detailed routing** - Create actual wire geometries

**Advanced Considerations:**
- Multi-patterning awareness (color-aware routing at advanced nodes)
- Signal integrity (crosstalk, antenna effects)
- Post-route optimization

### Stage 9: Static Timing Analysis (STA)

| Aspect | Details |
|--------|---------|
| **Checks** | Setup time, Hold time |
| **Corners** | Multi-Mode Multi-Corner (MMMC) |

**Critical Checks:**
| Check | Description | Violation Impact |
|-------|-------------|------------------|
| **Setup** | Data arrives before clock edge | Cannot run at target frequency |
| **Hold** | Data stable after clock edge | **Functional failure at ANY frequency** |

### Stage 10: Physical Verification & Signoff

| Check | Purpose | Tool Examples |
|-------|---------|---------------|
| **DRC** | Manufacturing rule compliance | Calibre, ICV, Pegasus |
| **LVS** | Layout vs. Schematic | Calibre, ICV |
| **ERC** | Floating gates, antenna violations | Various |
| **IR Drop/EM** | Power integrity | RedHawk, Voltus |

> "All three must pass 100%. No exceptions."

### Stage 11: Final Signoff & Tape-Out

| Aspect | Details |
|--------|---------|
| **Output** | GDSII file |
| **Deliverables** | Final layout, timing reports, verification signoff |

**Final Steps:**
- Design data generation (GDSII/OASIS)
- Metal fill insertion (density requirements)
- Reticle generation data
- Tape-out to foundry

## Stage Dependencies

```
RTL Design -> Synthesis -> DFT -> Floorplan -> Power Planning -> Placement
                                                                  |
                                                                  v
GDSII <- Signoff <- Physical Verification <- STA <- Routing <- CTS
```

## 2024 Industry Trends

| Category | Leading Tools |
|----------|---------------|
| Synthesis | Synopsys Design Compiler, Cadence Genus |
| Physical Design | Cadence Innovus, Synopsys ICC2 |
| STA | Synopsys PrimeTime, Cadence Tempus |
| Verification | Siemens Calibre, Synopsys ICV |
| Power Analysis | Ansys RedHawk, Cadence Voltus |

**Emerging Trends:**
- AI/ML-assisted placement and routing optimization
- Cloud-based EDA workflows
- 3D IC and chiplet integration considerations
- Advanced node challenges (2nm, GAA transistors)
