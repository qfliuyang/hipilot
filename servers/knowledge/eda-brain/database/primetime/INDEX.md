---
tool: pt_shell
name: Synopsys PrimeTime
vendor: Synopsys
version: "T-2022.03"
category: signoff
description: Static timing analysis (STA) tool for signoff
capabilities:
  - timing_analysis
  - signoff
  - ecos
  - constraints_validation
  - variation_analysis
prompt_pattern: "pt_shell"
file_extensions:
  - .db
  - .v
  - .sdc
  - .spef
  - .sdf
updated: 2026-03-15
---

# Synopsys PrimeTime

Static timing analysis (STA) tool for signoff. PrimeTime is the industry standard for timing signoff, analyzing design timing without requiring simulation vectors.

## Capabilities

- **Static Timing Analysis**: Path-based timing calculation
- **Constraints Validation**: SDC constraint checking
- **Multi-Corner Analysis**: Process/voltage/temperature variations
- **Signal Integrity**: Crosstalk and noise analysis
- **ECO Generation**: Timing fix suggestions
- **Variation Analysis**: AOCV, POCV, SOCV support

## Navigation

| Topic | File | Description |
|-------|------|-------------|
| Commands | [commands.md](commands.md) | Full command reference |
| Error Patterns | [errors.md](errors.md) | Common errors and fixes |
| Best Practices | [best-practices.md](best-practices.md) | Tool-specific recommendations |

## Detailed Command Reference

| Command | File | Description |
|---------|------|-------------|
| read_db/read_verilog | [read_design.md](read_design.md) | Design loading commands |
| read_sdc | [read_sdc.md](read_sdc.md) | Constraint loading |
| report_timing | [report_timing.md](report_timing.md) | Timing reports and analysis |
| check_timing | [check_timing.md](check_timing.md) | Constraint validation |

## STA Methodology

```
1. Design Loading
   └── read_db OR read_verilog + read_lib

2. Design Linking
   └── link_design

3. Constraint Loading
   └── read_sdc

4. Parasitics (post-route)
   └── read_parasitics

5. Timing Update
   └── update_timing

6. Analysis & Reporting
   └── report_timing, check_timing, report_constraint
```

## Quick Start

```tcl
# Read design
read_db design.db
# Or
read_verilog design.v
read_lib tech.lib

# Link design
link_design

# Read constraints
read_sdc constraints.sdc

# Read parasitics (optional)
read_parasitics design.spef

# Update timing
update_timing

# Report timing
report_timing -max_paths 100
```

## Tool Detection

PrimeTime is running when prompt shows:
```
pt_shell>
```

## Related Tools

| Tool | Relationship |
|------|--------------|
| Design Compiler | Provides netlist and constraints |
| StarRC | Provides parasitics (SPEF) |
| IC Compiler II | Physical design, timing closure |
| PrimeTime PX | Power analysis |
