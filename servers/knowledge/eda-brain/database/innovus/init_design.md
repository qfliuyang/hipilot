---
tool: innovus
command_category: design_initialization
version: 20.10+
source: Cadence Innovus Text Command Reference
---

# init_design

## Syntax
```tcl
init_design
```

## Description
The `init_design` command initializes the design by reading in all specified files including Verilog netlist, LEF files, MMMC (Multi-Mode Multi-Corner) configuration, and IO files. This is the first command executed after setting up the design initialization variables.

## Prerequisites
Before running `init_design`, you must set the following variables:

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `init_verilog` | Verilog netlist file(s) | `set init_verilog "design.v"` |
| `init_lef_file` | LEF technology and cell files | `set init_lef_file "tech.lef stdcells.lef"` |
| `init_mmmc_file` | MMMC configuration file | `set init_mmmc_file "mmmc.tcl"` |
| `init_top_cell` | Top-level design name | `set init_top_cell "TOP"` |

### Optional Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `init_io_file` | IO placement file | - |
| `init_power_net` | Power net name(s) | VDD |
| `init_ground_net` | Ground net name(s) | VSS |
| `init_design_set_top` | Auto-assign top cell | 0 |
| `init_gds_file` | GDSII file for LEF generation | - |

## Examples

### Basic Design Initialization
```tcl
# Set design files
set init_verilog "synth.v"
set init_lef_file "tech.lef stdcells.lef macros.lef"
set init_mmmc_file "mmmc.tcl"
set init_top_cell "my_design"
set init_power_net "VDD"
set init_ground_net "VSS"

# Initialize the design
init_design
```

### Multiple Verilog Files
```tcl
set init_verilog [list "file1.v" "file2.v" "file3.v"]
set init_top_cell "top"
set init_design_set_top 1
init_design
```

### With IO File
```tcl
set init_verilog "design.v"
set init_lef_file "tech.lef cells.lef"
set init_mmmc_file "mmmc.tcl"
set init_io_file "design.io"
set init_top_cell "TOP"
init_design
```

## MMMC File Format (mmmc.tcl)
```tcl
# Create library sets
create_library_set -name typical_libs \
    -timing [list "typical.lib"]

create_library_set -name worst_libs \
    -timing [list "slow.lib"]

create_library_set -name best_libs \
    -timing [list "fast.lib"]

# Create RC corners
create_rc_corner -name typical_rc \
    -cap_table "typical.cap" \
    -preRoute_res 1.0 \
    -preRoute_cap 1.0 \
    -postRoute_res 1.0 \
    -postRoute_cap 1.0

# Create delay corners
create_delay_corner -name typical_delay \
    -library_set typical_libs \
    -rc_corner typical_rc

# Create constraint modes
create_constraint_mode -name functional \
    -sdc_files [list "constraints.sdc"]

# Create analysis views
create_analysis_view -name typical_view \
    -constraint_mode functional \
    -delay_corner typical_delay

# Set active views
set_analysis_view -setup [list typical_view] -hold [list typical_view]
```

## Common Errors

### Error: Cannot find LEF file
```
**ERROR: (IMPDF-2): Could not open LEF file 'tech.lef'
```
**Solution**: Check file path and ensure LEF file exists

### Error: Verilog syntax error
```
**ERROR: (VERILOG-1): Syntax error in file design.v
```
**Solution**: Verify Verilog syntax and check for unsupported constructs

### Error: Missing MMMC file
```
**ERROR: (MMMC-1): Cannot open MMMC file
```
**Solution**: Ensure mmmc.tcl exists and is properly formatted

### Error: Top cell not found
```
**ERROR: (IMPDF-10): Top cell 'TOP' not found in netlist
```
**Solution**: Verify `init_top_cell` matches module name in Verilog

## Best Practices
1. Always use MMMC for accurate timing analysis
2. Verify LEF files match the technology node
3. Check that power/ground net names match the LEF definitions
4. Source any technology-specific setup files before init_design
5. Use `checkDesign -all` after initialization to verify setup

## Related Commands
- `source` - Source a Tcl script
- `checkDesign` - Verify design integrity
- `saveDesign` - Save design checkpoint
- `restoreDesign` - Restore from checkpoint

## Source
- [Cadence Innovus Text Command Reference](https://studylib.net/doc/26088395/innovus-text-command-reference)
- [Cadence Innovus User Guide](https://studylib.net/doc/26203625/innovusguide)
