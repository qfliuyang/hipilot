---
title: Design Initialization
stage: 1
tool: innovus / icc2_shell
prerequisites:
  - Synthesized netlist (Verilog)
  - Technology LEF file
  - Standard cell LEF file
  - Timing library (Liberty .lib or .db)
  - SDC constraint file
next_stage: floorplan
qor_metrics: [Instance_Count, Net_Count, Library_Status]
risk_level: low
duration: 1-5 minutes
---

# Design Initialization (Stage 1)

Proper design initialization with timing libraries. Essential for enabling timing-driven
placement, CTS, and full STA capabilities.

## Quick Reference

```
Input: Netlist + LEF + Liberty + SDC
Output: Initialized ENC database
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Two Initialization Modes

#### Mode 1: Full Timing Setup (Recommended)

Enables: Timing-driven placement, CTS, full STA

```tcl
# MMMC Setup
create_library_set -name libs_tt -timing {sky130.lib}
create_rc_corner -name rc_tt
create_delay_corner -name delay_tt -library_set libs_tt -rc_corner rc_tt
create_constraint_mode -name const_mode -sdc_files {constraints.sdc}
create_analysis_view -name view_tt -constraint_mode const_mode -delay_corner delay_tt
set_analysis_view -setup {view_tt} -hold {view_tt}

init_design
```

#### Mode 2: Physical-Only Setup (Limited)

Enables: Floorplan, placement, routing (not timing-driven)

**WARNING:** CTS and timing-driven features will NOT work.

```tcl
# LEF and netlist only
set init_lef_file {tech.lef cell.lef}
set init_verilog design.v
set init_top_cell top

init_design
```

## Key Concepts

### MMMC Setup (CRITICAL)

```
library_set -> delay_corner -> constraint_mode -> analysis_view
```

### Verification Commands

```tcl
puts "Instances: [sizeof_collection [get_cells *]]"
puts "Nets: [sizeof_collection [get_nets *]]"
report_libs
report_analysis_view
report_clocks
```

## Prerequisites Detail

### LEF Files Required

- Technology LEF (tech.lef) - layer definitions
- Standard cell LEF (cells.lef) - cell geometries

### Timing Libraries

- Liberty format (.lib) or compiled (.db)
- Multiple corners: SS, TT, FF

## Next Stage

After successful initialization, proceed to [Floorplan](../floorplan/INDEX.md).

Required state:
- Design loaded with instances
- Timing libraries recognized
- Clocks defined in analysis view
