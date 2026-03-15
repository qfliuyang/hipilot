---
tool: innovus
command_category: analysis_reporting
version: 20.10+
source: Cadence Innovus Text Command Reference
---

# Analysis and Reporting Commands

## report_timing

### Syntax
```tcl
report_timing [-from from_list]
              [-to to_list]
              [-through through_list]
              [-delay_type {max|min}]
              [-nworst n]
              [-max_paths n]
              [-path_type {full|short|end}]
              [-format {column|wide}]
              [-report report_file]
              [-verbose]
              [-significant_digits n]
```

### Description
Reports timing paths and slack information. This is the primary command for timing analysis.

### Arguments
| Option | Description | Default |
|--------|-------------|---------|
| `-from` | Start points (registers/ports) | - |
| `-to` | End points (registers/ports) | - |
| `-through` | Intermediate points | - |
| `-delay_type max` | Setup analysis | max |
| `-delay_type min` | Hold analysis | - |
| `-nworst` | Worst paths per endpoint | 1 |
| `-max_paths` | Total paths to report | 100 |
| `-path_type` | Path detail level | full |
| `-format` | Output format | column |
| `-report` | Output file | stdout |

### Examples
```tcl
# Report worst setup paths
report_timing -delay_type max -max_paths 10

# Report worst hold paths
report_timing -delay_type min -max_paths 10

# Report paths between specific points
report_timing -from [get_pins reg1/CK] -to [get_pins reg2/D]

# Report with more detail
report_timing -max_paths 20 -nworst 5 -verbose

# Save to file
report_timing -max_paths 100 -report timing.rpt
```

## report_power

### Syntax
```tcl
report_power [-out_file file]
             [-format {column|wide}]
             [-nosplit]
             [-verbose]
             [-hierarchy]
             [-instances instance_list]
             [-analysis_view view_name]
             [-corner corner_name]
```

### Description
Reports power consumption analysis including leakage, dynamic, and total power.

### Arguments
| Option | Description |
|--------|-------------|
| `-out_file` | Output file name |
| `-format` | Output format |
| `-hierarchy` | Report hierarchical power |
| `-instances` | Report for specific instances |
| `-analysis_view` | Specific analysis view |
| `-corner` | Specific corner |

### Examples
```tcl
# Basic power report
report_power

# Hierarchical power report
report_power -hierarchy

# Power for specific instances
report_power -instances [get_cells macro_*]

# Save to file
report_power -out_file power.rpt
```

## report_area

### Syntax
```tcl
report_area [-out_file file]
            [-format {column|wide}]
            [-hierarchy]
            [-physical]
            [-instances instance_list]
```

### Description
Reports area utilization and cell counts.

### Arguments
| Option | Description |
|--------|-------------|
| `-out_file` | Output file name |
| `-hierarchy` | Hierarchical area report |
| `-physical` | Include physical area |
| `-instances` | Specific instances |

### Examples
```tcl
# Basic area report
report_area

# Hierarchical area
report_area -hierarchy

# Physical area with utilization
report_area -physical
```

## report_qor

### Syntax
```tcl
report_qor [-format {column|wide}]
           [-out_file file]
           [-significant_digits n]
```

### Description
Reports comprehensive Quality of Results including timing, power, and area metrics.

### Examples
```tcl
# Full QoR report
report_qor

# Save to file
report_qor -out_file qor.rpt
```

## report_congestion

### Syntax
```tcl
report_congestion [-out_file file]
                  [-overflow]
                  [-hotspots]
```

### Description
Reports routing congestion analysis.

### Examples
```tcl
# Congestion report
report_congestion

# With overflow analysis
report_congestion -overflow

# Hotspot identification
report_congestion -hotspots
```

## report_design_metrics

### Syntax
```tcl
report_design_metrics [-out_file file]
                      [-format {column|wide}]
```

### Description
Reports comprehensive design metrics.

### Examples
```tcl
report_design_metrics
```

## checkDesign

### Syntax
```tcl
checkDesign [-all]
            [-netlist]
            [-floorplan]
            [-power]
            [-placement]
            [-routing]
            [-out_file file]
```

### Description
Checks design integrity and reports issues.

### Arguments
| Option | Description |
|--------|-------------|
| `-all` | Check all aspects |
| `-netlist` | Check netlist integrity |
| `-floorplan` | Check floorplan |
| `-power` | Check power setup |
| `-placement` | Check placement |
| `-routing` | Check routing |

### Examples
```tcl
# Full design check
checkDesign -all

# Check specific aspects
checkDesign -netlist -floorplan

# Save report
checkDesign -all -out_file check.rpt
```

## checkTiming

### Syntax
```tcl
checkTiming [-verbose]
            [-out_file file]
```

### Description
Checks timing constraints and reports issues.

### Examples
```tcl
checkTiming
checkTiming -verbose -out_file timing_check.rpt
```

## get_* Commands

### get_cells
```tcl
get_cells [-filter expression]
          [-of objects]
          [-hierarchical]
          [pattern]
```

**Examples:**
```tcl
# Get all cells
get_cells *

# Get registers
get_cells -filter "is_register==true"

# Get macros
get_cells -filter "is_macro==true"

# Hierarchical search
get_cells -hierarchical *reg*
```

### get_pins
```tcl
get_pins [-filter expression]
         [-of objects]
         [-hierarchical]
         [pattern]
```

**Examples:**
```tcl
# Get all pins
get_pins *

# Get clock pins
get_pins -filter "is_clock_pin==true"

# Get pins of specific cell
get_pins -of [get_cells reg1]
```

### get_nets
```tcl
get_nets [-filter expression]
         [-of objects]
         [-hierarchical]
         [pattern]
```

**Examples:**
```tcl
# Get all nets
get_nets *

# Get clock nets
get_nets -filter "is_clock_net==true"

# Get nets by name pattern
get_nets net_*
```

### get_ports
```tcl
get_ports [-filter expression]
          [-direction {in|out|inout}]
          [pattern]
```

**Examples:**
```tcl
# Get all ports
get_ports *

# Get input ports
get_ports -direction in

# Get clock ports
get_ports -filter "is_clock==true"
```

## Complete Analysis Flow
```tcl
# Check design integrity
checkDesign -all -out_file check.rpt

# Timing analysis
report_timing -delay_type max -max_paths 100 -report setup.rpt
report_timing -delay_type min -max_paths 100 -report hold.rpt

# QoR summary
report_qor -out_file qor.rpt

# Power analysis
report_power -hierarchy -out_file power.rpt

# Area report
report_area -physical -out_file area.rpt

# Congestion (if routed)
if {[is_routed]} {
    report_congestion -out_file congestion.rpt
    verify_drc -out_file drc.rpt
}

# Design metrics
report_design_metrics -out_file metrics.rpt
```

## Common Report Parsing
```tcl
# Extract WNS from timing report
set wns [report_timing -delay_type max -max_paths 1 -format wide]

# Get cell count
set cell_count [llength [get_cells *]]

# Get register count
set reg_count [llength [get_cells -filter "is_register==true"]]

# Get macro count
set macro_count [llength [get_cells -filter "is_macro==true"]]
```

## Source
- [Cadence Innovus Text Command Reference](https://studylib.net/doc/26088395/innovus-text-command-reference)
- [Innovus User Guide](https://studylib.net/doc/26203625/innovusguide)
