---
tool: innovus
name: Cadence Innovus
vendor: Cadence
version: "20.10"
category: pnr
description: Implementation system for digital IC design
capabilities:
  - design_init
  - floorplan
  - power_planning
  - placement
  - cts
  - routing
  - optimization
  - signoff
prompt_pattern: "innovus"
file_extensions:
  - .enc
  - .def
  - .gds
  - .lef
  - .tlef
updated: 2026-03-15
---

# Cadence Innovus

Implementation system for digital IC design. Innovus provides a complete place-and-route solution from design initialization through GDSII export.

## Capabilities

- **Design Initialization**: Load netlist, libraries, constraints
- **Floorplanning**: Die area, core area, IO placement, macros
- **Power Planning**: Power grid, stripes, rings, vias
- **Placement**: Standard cell placement with timing/congestion awareness
- **Clock Tree Synthesis**: Multi-corner multi-mode CTS optimization
- **Routing**: Global and detailed routing with DRC fixing
- **Optimization**: Post-route optimization for timing and power
- **Signoff**: Physical verification, timing analysis

## Navigation

| Topic | File | Description |
|-------|------|-------------|
| Commands | [commands.md](commands.md) | Full command reference |
| Error Patterns | [errors.md](errors.md) | Common errors and fixes |
| Best Practices | [best-practices.md](best-practices.md) | Tool-specific recommendations |

## Detailed Command Reference

| Stage | File | Key Commands |
|-------|------|--------------|
| Design Init | [init_design.md](init_design.md) | `init_design`, `set init_*` |
| Floorplan | [floorplan.md](floorplan.md) | `floorPlan`, `loadIoFile` |
| Power Planning | [power_planning.md](power_planning.md) | `addStripe`, `sroute`, `globalNetConnect` |
| Placement | [placement.md](placement.md) | `place_opt_design`, `setPlaceMode` |
| CTS | [cts.md](cts.md) | `ccopt_design`, `create_ccopt_clock_tree_spec` |
| Routing | [routing.md](routing.md) | `routeDesign`, `setNanoRouteMode` |
| Analysis | [analysis.md](analysis.md) | `report_timing`, `report_congestion` |

## Quick Start

```tcl
# Design initialization
set init_verilog "design.v"
set init_lef_file "tech.tlef cells.lef"
set init_top_cell "top"
init_design

# Floorplan
floorPlan -site unit -su 1.0 0.70 10 10 10 10

# Power planning
globalNetConnect VDD -type pgpin -pin VDD -inst *
globalNetConnect VSS -type pgpin -pin VSS -inst *
addStripe -nets {VDD VSS} -layer M4 -width 2.0 -spacing 2.0

# Placement
place_opt_design

# CTS
ccopt_design

# Routing
routeDesign

# Export
streamOut design.gds
saveNetlist design.v
```

## Tool Detection

Innovus is running when prompt shows:
```
innovus 1>
```

## Related Tools

| Tool | Relationship |
|------|--------------|
| Genus | Predecessor (synthesis) |
| Tempus | Signoff timing (alternative to PrimeTime) |
| Voltus | Power analysis |
| Quantus | Parasitic extraction |
