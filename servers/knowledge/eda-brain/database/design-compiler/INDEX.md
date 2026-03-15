---
tool: dc_shell
name: Synopsys Design Compiler
vendor: Synopsys
version: "L-2016.03-SP2"
category: synthesis
description: RTL synthesis and optimization tool
capabilities:
  - synthesis
  - optimization
  - dft
  - constraints
prompt_pattern: "dc_shell"
file_extensions:
  - .db
  - .v
  - .sdc
  - .ddc
updated: 2026-03-15
---

# Synopsys Design Compiler

RTL synthesis and optimization tool. Design Compiler transforms RTL (Verilog/VHDL) into gate-level netlists using target technology libraries.

## Capabilities

- **RTL Analysis**: Parse and analyze Verilog/SystemVerilog/VHDL
- **Elaboration**: Build design hierarchy and infer components
- **Synthesis**: Map RTL to technology library cells
- **Optimization**: Area, timing, and power optimization
- **DFT**: Scan insertion and testability
- **Constraints**: SDC constraint handling

## Navigation

| Topic | File | Description |
|-------|------|-------------|
| Commands | [commands.md](commands.md) | Full command reference |
| Error Patterns | [errors.md](errors.md) | Common errors and fixes |
| Best Practices | [best-practices.md](best-practices.md) | Tool-specific recommendations |

## Detailed Command Reference

| Command | File | Description |
|---------|------|-------------|
| analyze/elaborate | [analyze_elaborate.md](analyze_elaborate.md) | RTL reading and parsing |
| compile_ultra | [compile_ultra.md](compile_ultra.md) | Synthesis and optimization |
| group_path | [path_groups.md](path_groups.md) | Path grouping strategies |
| write_file | [write_commands.md](write_commands.md) | Output generation |

## Synthesis Flow

```
1. Library Setup
   └── Set target_library, link_library

2. RTL Reading
   └── analyze → elaborate OR read_file

3. Design Constraints
   └── source constraints.sdc

4. Compile
   └── compile_ultra [-scan] [-retime]

5. Optimization
   └── set_max_delay, group_path, set_critical_range

6. Output Generation
   └── write_file, write_sdc, write_scan_def
```

## Quick Start

```tcl
# Setup libraries
set target_library "cells.db"
set link_library "* cells.db"

# Read RTL
analyze -format sverilog [glob *.v]
elaborate top

# Apply constraints
source constraints.sdc

# Compile
compile_ultra -scan

# Save results
write_file -format verilog -output design.v
write_sdc design.sdc
```

## Tool Detection

Design Compiler is running when prompt shows:
```
dc_shell>
```

## Related Tools

| Tool | Relationship |
|------|--------------|
| PrimeTime | Signoff timing (uses DC output) |
| IC Compiler II | Physical design (uses DC netlist) |
| TetraMAX | ATPG testing |
| Formality | Formal verification |
