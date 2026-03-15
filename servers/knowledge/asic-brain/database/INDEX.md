---
title: ASIC-Brain PageIndex Database
description: Tree-based knowledge navigation for RTL2GDS flow
version: 1.1.0
updated: 2026-03-15
---

# ASIC-Brain PageIndex Database

Tree-based knowledge navigation for RTL2GDS physical design flow.

## RTL2GDS Flow Overview

```
RTL2GDS 10-Stage Flow
=====================

Stage 0: Synthesis        -> dc_shell / genus
    |
Stage 1: Design Init      -> innovus / icc2_shell
    |
Stage 2: Floorplan        -> innovus / icc2_shell
    |
Stage 3: Power Planning   -> innovus / icc2_shell
    |
Stage 4: Placement        -> innovus / icc2_shell
    |
Stage 5: CTS              -> innovus / icc2_shell
    |
Stage 6: Post-CTS Opt     -> innovus / icc2_shell
    |
Stage 7: Routing          -> innovus / icc2_shell
    |
Stage 8: Route Opt        -> innovus / icc2_shell
    |
Stage 9: Chip Finish      -> innovus / icc2_shell
    |
   GDS Output
```

## Tree Navigation

Navigate using path syntax: `STAGE/SUBSECTION/ENTRY`

| Path | Description |
|------|-------------|
| `synthesis/` | RTL synthesis with Design Compiler or Genus |
| `design-init/` | Design initialization with MMMC setup |
| `floorplan/` | Die/core area definition, IO placement |
| `power-planning/` | Power grid creation, stripes, rails |
| `placement/` | Standard cell placement |
| `cts/` | Clock tree synthesis |
| `post-cts-opt/` | Post-CTS timing optimization |
| `routing/` | Global and detail routing |
| `routeopt/` | Post-route optimization |
| `chipfinish/` | Final outputs and GDS export |

## File Types

Each stage directory contains:

- **INDEX.md** - Stage overview, prerequisites, next stage
- **tcl-patterns.md** - Common Tcl snippets and patterns
- **common-issues.md** - Error patterns and fixes

## Quick Reference

| Stage | Tool | Key Command | Input | Output |
|-------|------|-------------|-------|--------|
| Synthesis | dc_shell | `compile_ultra` | RTL, SDC | Netlist, DDC |
| Design Init | innovus | `init_design` | Netlist, LEF | ENC database |
| Floorplan | innovus | `floorPlan` | ENC | Floorplan DEF |
| Power Plan | innovus | `addStripe` | Floorplan | Power grid |
| Placement | innovus | `place_opt_design` | Power plan | Placed cells |
| CTS | innovus | `ccopt_design` | Placed | Clock tree |
| Post-CTS Opt | innovus | `optDesign -postCTS` | CTS | Optimized |
| Routing | innovus | `routeDesign` | Post-CTS | Routed nets |
| Route Opt | innovus | `optDesign -postRoute` | Routed | Optimized |
| Chip Finish | innovus | `streamOut` | Routed | GDS, DEF |

## Advanced Topics

Detailed deep-dive documentation for each flow stage:

| Topic | File | Description |
|-------|------|-------------|
| RTL2GDS Flow Overview | [advanced/01_rtl2gds_flow_overview.md](advanced/01_rtl2gds_flow_overview.md) | Complete 10-stage flow walkthrough |
| Synthesis Deep Dive | [advanced/02_synthesis_deep_dive.md](advanced/02_synthesis_deep_dive.md) | Advanced synthesis techniques |
| Floorplanning | [advanced/03_floorplanning.md](advanced/03_floorplanning.md) | Die planning and macro placement |
| Power Planning | [advanced/04_power_planning.md](advanced/04_power_planning.md) | Power grid and network design |
| Clock Tree Synthesis | [advanced/05_clock_tree_synthesis.md](advanced/05_clock_tree_synthesis.md) | CTS strategies and optimization |
| Placement | [advanced/06_placement.md](advanced/06_placement.md) | Standard cell placement techniques |
| Routing | [advanced/07_routing.md](advanced/07_routing.md) | Global and detailed routing |
| Static Timing Analysis | [advanced/08_static_timing_analysis.md](advanced/08_static_timing_analysis.md) | STA methodology and constraints |
| DFT Methodology | [advanced/09_dft_methodology.md](advanced/09_dft_methodology.md) | Scan insertion and ATPG |
| Low Power Design | [advanced/10_low_power_design.md](advanced/10_low_power_design.md) | UPF and multi-voltage techniques |
| ECO Methodology | [advanced/11_eco_methodology.md](advanced/11_eco_methodology.md) | Engineering change orders |
| Signoff Checks | [advanced/12_signoff_checks.md](advanced/12_signoff_checks.md) | Final verification and signoff |

## Navigation Tree

```
ASIC-Brain/
├── INDEX.md                          # This file - root catalog
├── advanced/                         # Deep-dive topic documentation
│   ├── 01_rtl2gds_flow_overview.md
│   ├── 02_synthesis_deep_dive.md
│   ├── 03_floorplanning.md
│   ├── 04_power_planning.md
│   ├── 05_clock_tree_synthesis.md
│   ├── 06_placement.md
│   ├── 07_routing.md
│   ├── 08_static_timing_analysis.md
│   ├── 09_dft_methodology.md
│   ├── 10_low_power_design.md
│   ├── 11_eco_methodology.md
│   └── 12_signoff_checks.md
├── synthesis/                        # Stage-specific knowledge
├── design-init/
├── floorplan/
├── power-planning/
├── placement/
├── cts/
├── post-cts-opt/
├── routing/
├── routeopt/
└── chipfinish/
```

## PageIndex vs Vector RAG

| Aspect | Vector RAG | PageIndex (This) |
|--------|-----------|------------------|
| Storage | Embeddings | Tree structure |
| Retrieval | Similarity search | Tree navigation |
| Best for | Semantic match | Structured technical docs |
| EDA fit | Poor (commands look similar) | Excellent (hierarchical flow) |

## Usage

```javascript
// Query by path
const result = await asicBrain.query('synthesis/tcl-patterns/compile_ultra');

// Search by keyword
const results = await asicBrain.search('hold violation');

// Get stage info
const stage = await asicBrain.getStage('cts');

// Query advanced topics
const advanced = await asicBrain.query('advanced/synthesis_deep_dive');
```
