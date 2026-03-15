---
title: EDA-Brain Database
description: PageIndex-based knowledge base for EDA tools
created: 2026-03-15
updated: 2026-03-15
version: "1.1.0"
---

# EDA-Brain Database

PageIndex-based knowledge base for Electronic Design Automation (EDA) tools.

## Navigation Tree

```
EDA-Brain/
├── INDEX.md                          # This file - root catalog
├── innovus/
│   ├── INDEX.md                      # Cadence Innovus overview
│   ├── commands.md                   # Command reference
│   ├── errors.md                     # Error patterns and fixes
│   ├── best-practices.md             # Tool-specific recommendations
│   ├── init_design.md                # Design initialization
│   ├── floorplan.md                  # Floorplanning commands
│   ├── power_planning.md             # Power grid creation
│   ├── placement.md                  # Placement optimization
│   ├── cts.md                        # Clock tree synthesis
│   ├── routing.md                    # Global and detail routing
│   └── analysis.md                   # Timing and physical analysis
├── design-compiler/
│   ├── INDEX.md                      # Synopsys Design Compiler overview
│   ├── commands.md                   # Command reference
│   ├── errors.md                     # Error patterns and fixes
│   ├── best-practices.md             # Tool-specific recommendations
│   ├── analyze_elaborate.md          # RTL reading commands
│   ├── compile_ultra.md              # Synthesis command
│   ├── path_groups.md                # Path grouping strategies
│   └── write_commands.md             # Output generation
├── icc2/
│   ├── INDEX.md                      # Synopsys IC Compiler II overview
│   ├── commands.md                   # Command reference
│   ├── errors.md                     # Error patterns and fixes
│   └── best-practices.md             # Tool-specific recommendations
├── primetime/
│   ├── INDEX.md                      # Synopsys PrimeTime overview
│   ├── commands.md                   # Command reference
│   ├── errors.md                     # Error patterns and fixes
│   ├── best-practices.md             # Tool-specific recommendations
│   ├── read_design.md                # Design reading commands
│   ├── read_sdc.md                   # Constraint loading
│   ├── report_timing.md              # Timing reports
│   └── check_timing.md               # Constraint validation
├── tool-comparison.md                # When to use which tool
└── licensing/
    ├── INDEX.md                      # License management overview
    └── common-issues.md              # Common license problems
```

## Tool Catalog

| Tool | Vendor | Category | Primary Use |
|------|--------|----------|-------------|
| [Innovus](innovus/INDEX.md) | Cadence | P&R | Physical implementation, place and route |
| [Design Compiler](design-compiler/INDEX.md) | Synopsys | Synthesis | RTL synthesis, optimization |
| [IC Compiler II](icc2/INDEX.md) | Synopsys | P&R | Physical implementation (Synopsys flow) |
| [PrimeTime](primetime/INDEX.md) | Synopsys | Signoff | Static timing analysis |

## Quick Reference by Flow Stage

| Stage | Primary Tool | Alternative |
|-------|--------------|-------------|
| Synthesis | Design Compiler | Genus |
| Floorplan | Innovus / ICC2 | - |
| Placement | Innovus / ICC2 | - |
| CTS | Innovus / ICC2 | - |
| Routing | Innovus / ICC2 | - |
| Signoff STA | PrimeTime | Tempus |

## Detailed Command Documentation

### Innovus
| Command | File | Description |
|---------|------|-------------|
| init_design | [innovus/init_design.md](innovus/init_design.md) | Design initialization and library setup |
| floorPlan | [innovus/floorplan.md](innovus/floorplan.md) | Die and core area definition |
| addStripe | [innovus/power_planning.md](innovus/power_planning.md) | Power grid creation |
| place_opt_design | [innovus/placement.md](innovus/placement.md) | Standard cell placement |
| ccopt_design | [innovus/cts.md](innovus/cts.md) | Clock tree synthesis |
| routeDesign | [innovus/routing.md](innovus/routing.md) | Global and detailed routing |
| report_timing | [innovus/analysis.md](innovus/analysis.md) | Timing analysis commands |

### Design Compiler
| Command | File | Description |
|---------|------|-------------|
| analyze/elaborate | [design-compiler/analyze_elaborate.md](design-compiler/analyze_elaborate.md) | RTL reading and parsing |
| compile_ultra | [design-compiler/compile_ultra.md](design-compiler/compile_ultra.md) | Synthesis and optimization |
| group_path | [design-compiler/path_groups.md](design-compiler/path_groups.md) | Path grouping strategies |
| write_file | [design-compiler/write_commands.md](design-compiler/write_commands.md) | Output generation |

### PrimeTime
| Command | File | Description |
|---------|------|-------------|
| read_db/read_verilog | [primetime/read_design.md](primetime/read_design.md) | Design loading |
| read_sdc | [primetime/read_sdc.md](primetime/read_sdc.md) | Constraint loading |
| report_timing | [primetime/report_timing.md](primetime/report_timing.md) | Timing reports |
| check_timing | [primetime/check_timing.md](primetime/check_timing.md) | Constraint validation |

## Tcl Scripting Guide

Common Tcl patterns for EDA automation:

```tcl
# Variable setup
set design_name "my_design"
set lib_path "/path/to/libraries"

# Conditional execution
if {[file exists $input_file]} {
    read_verilog $input_file
} else {
    puts "Error: Input file not found"
    exit 1
}

# Looping
foreach lib $target_libraries {
    read_lib $lib
}

# Procedure definition
proc report_qor {stage} {
    report_timing -max_paths 100 > timing_${stage}.rpt
    report_area > area_${stage}.rpt
    report_power > power_${stage}.rpt
}
```

Query path examples:
```
innovus/commands/init_design
innovus.errors.LEF_LOADING_FAILED
design-compiler/best-practices/synthesis
primetime/report_timing/setup_analysis
```

## Query Path Syntax

Use dot-notation or slash-notation to navigate the knowledge tree:

```
innovus/commands/init_design
innovus.errors.LEF_LOADING_FAILED
design-compiler/best-practices/synthesis
```

## PageIndex vs Vector RAG

This database uses **PageIndex** (tree-based) instead of vector embeddings:

| Aspect | Vector RAG | PageIndex (This DB) |
|--------|-----------|---------------------|
| Storage | Embeddings | Tree structure |
| Retrieval | Similarity search | Path navigation |
| Best for | Semantic match | Structured technical docs |
| EDA fit | Poor (commands look similar) | Excellent (hierarchical flow) |

**Key insight**: Similarity != Relevance. For EDA tools, semantic similarity fails - you need reasoning about tool context and flow stage.
