---
tool: icc2
name: Synopsys IC Compiler II
vendor: Synopsys
version: "T-2022.03"
category: pnr
description: Place and route tool for digital IC design
capabilities:
  - design_init
  - floorplan
  - power_planning
  - placement
  - cts
  - routing
  - optimization
prompt_pattern: "icc2"
file_extensions:
  - .nlib
  - .def
  - .gds
  - .odb
---

# Synopsys IC Compiler II

Place and route tool for digital IC design. ICC2 is Synopsys' next-generation physical implementation tool, replacing the original IC Compiler.

## Capabilities

- **Design Initialization**: Load netlist, libraries, constraints (nlib-based)
- **Floorplanning**: Die/core area, IO placement, macro placement
- **Power Planning**: Power grid, stripes, vias
- **Placement**: Standard cell placement with timing/congestion awareness
- **Clock Tree Synthesis**: Advanced CTS with multi-corner optimization
- **Routing**: Global and detailed routing
- **Optimization**: Post-route optimization

## Navigation

| Topic | File |
|-------|------|
| Commands | [commands.md](commands.md) |
| Error Patterns | [errors.md](errors.md) |
| Best Practices | [best-practices.md](best-practices.md) |

## Quick Start

```tcl
# Open library and block
open_lib design.nlib
open_block top

# Read constraints
read_sdc constraints.sdc

# Floorplan
initialize_floorplan -shape rectangular -side_length {1000 1000}

# Power planning
create_pg_mesh ...

# Placement
create_placement -timing_driven -congestion_driven

# CTS
clock_opt

# Route
route_auto

# Save
save_block
```

## Tool Detection

ICC2 is running when prompt shows:
```
icc2_shell>
```

## Key Differences from Innovus

| Feature | ICC2 | Innovus |
|---------|------|---------|
| Library | .nlib (binary) | .lef/.lib (text) |
| Design | Block-based | Design-based |
| Floorplan | Tcl commands | floorPlan command |
| CTS | clock_opt | ccopt_design |

## Related Tools

| Tool | Relationship |
|------|--------------|
| Design Compiler | Predecessor (synthesis) |
| PrimeTime | Signoff timing |
| StarRC | Parasitic extraction |
| IC Validator | Physical verification |
