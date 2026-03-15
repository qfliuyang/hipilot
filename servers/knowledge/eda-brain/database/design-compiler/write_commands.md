---
tool: design_compiler
command_category: output
version: L-2016.03+
source: Synopsys Design Compiler User Guide
---

# Output Commands

## write_file

### Syntax
```tcl
write_file [-format format]
           [-output file_name]
           [-hierarchy]
           design_list
```

## Description
Writes the design to a file in various formats. This is the primary command for saving synthesis results.

## Arguments

| Option | Description | Default |
|--------|-------------|---------|
| `-format` | Output format | ddc |
| `-output` | Output file name | design.format |
| `-hierarchy` | Write full hierarchy | false |
| `design_list` | Designs to write | current_design |

## Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| `ddc` | .ddc | Synopsys database (recommended) |
| `verilog` | .v | Verilog netlist |
| `vhdl` | .vhd | VHDL netlist |
| `db` | .db | Synopsys database (legacy) |

## Examples

### Write DDC (Recommended)
```tcl
# Write current design to DDC
write_file -format ddc -output design.ddc

# Write with hierarchy
write_file -format ddc -hierarchy -output design.ddc
```

### Write Verilog Netlist
```tcl
# Write Verilog netlist
write_file -format verilog -output design.v

# Write hierarchical Verilog
write_file -format verilog -hierarchy -output design.v
```

### Write VHDL Netlist
```tcl
write_file -format vhdl -output design.vhd
```

### Write Specific Design
```tcl
write_file -format ddc -output top.ddc top
```

## write_sdc

### Syntax
```tcl
write_sdc file_name
          [-nosplit]
          [-version version]
```

### Description
Writes timing constraints to an SDC file.

### Arguments
| Option | Description |
|--------|-------------|
| `-nosplit` | Don't split long lines |
| `-version` | SDC version |

### Examples
```tcl
# Write SDC constraints
write_sdc design.sdc

# Write with no line splitting
write_sdc design.sdc -nosplit
```

## write_scan_def

### Syntax
```tcl
write_scan_def [-output file_name]
               [-test_mode mode]
```

### Description
Writes scan chain definition for physical implementation.

### Examples
```tcl
# Write scan definition
write_scan_def -output design.scandef
```

## write_sdf

### Syntax
```tcl
write_sdf file_name
          [-version version]
          [-context context]
          [-instance instance]
```

### Description
Writes Standard Delay Format for back-annotation.

### Arguments
| Option | Description | Default |
|--------|-------------|---------|
| `-version` | SDF version | 2.1 |
| `-context` | Context (vhdl/verilog) | verilog |
| `-instance` | Instance path | top |

### Examples
```tcl
# Write SDF for simulation
write_sdf design.sdf

# Write specific version
write_sdf -version 3.0 design.sdf
```

## write_parasitics

### Syntax
```tcl
write_parasitics [-output file_name]
                 [-format format]
```

### Description
Writes parasitic information (for DC-Graphical).

### Examples
```tcl
write_parasitics -output design.spef
```

## write_floorplan

### Syntax
```tcl
write_floorplan [-output file_name]
                [-placement]
                [-routing]
```

### Description
Writes floorplan information (for DC-Graphical).

### Examples
```tcl
write_floorplan -output design.fp
```

## report_area

### Syntax
```tcl
report_area [-nosplit]
            [-hierarchy]
            [-physical]
            [-design design]
```

### Description
Reports area information.

### Examples
```tcl
# Basic area report
report_area

# Hierarchical area
report_area -hierarchy

# Physical area (DC-Graphical)
report_area -physical
```

## report_timing

### Syntax
```tcl
report_timing [-from from_list]
              [-to to_list]
              [-delay_type max|min]
              [-max_paths n]
              [-nworst n]
              [-significant_digits n]
```

### Description
Reports timing analysis results.

### Examples
```tcl
# Report worst paths
report_timing -max_paths 10

# Report hold timing
report_timing -delay_type min -max_paths 10

# Report specific path
report_timing -from [get_pins reg1/CK] -to [get_pins reg2/D]
```

## report_power

### Syntax
```tcl
report_power [-nosplit]
             [-hierarchy]
             [-analysis_view view]
             [-corner corner]
```

### Description
Reports power consumption.

### Examples
```tcl
# Basic power report
report_power

# Hierarchical power
report_power -hierarchy
```

## report_qor

### Syntax
```tcl
report_qor [-significant_digits n]
```

### Description
Reports comprehensive QoR metrics.

### Examples
```tcl
report_qor
```

## Complete Output Flow
```tcl
# Synthesis complete
compile_ultra

# Write netlist for P&R
write_file -format verilog -hierarchy -output design.v

# Write constraints
write_sdc design.sdc

# Write scan definition (if DFT)
write_scan_def -output design.scandef

# Write SDF for simulation
write_sdf design.sdf

# Write DDC for future use
write_file -format ddc -hierarchy -output design.ddc

# Generate reports
report_timing -max_paths 100 > timing.rpt
report_area -hierarchy > area.rpt
report_power -hierarchy > power.rpt
report_qor > qor.rpt
```

## Common Errors

### Error: Permission denied
```
Error: Cannot open file 'design.v' for writing (DCSH-3)
```
**Solution**: Check directory permissions

### Error: No design
```
Error: No current design (DCSH-4)
```
**Solution**: Read or elaborate design first

### Error: Format not supported
```
Error: Unknown format 'vhdl' (DCSH-5)
```
**Solution**: Use supported format

## Best Practices

1. **Always write DDC** - Preserves complete design information
2. **Write Verilog for P&R** - Standard interface to layout tools
3. **Write SDC for constraints** - Ensures consistent timing
4. **Write SDF for simulation** - Back-annotate timing
5. **Generate all reports** - Document QoR
6. **Use -hierarchy** - Include all sub-designs
7. **Version control outputs** - Track synthesis results

## Source
- [Synopsys Design Compiler User Guide](https://picture.iczhiku.com/resource/eetop/WhIEDLIWLEUyevnv.pdf)
