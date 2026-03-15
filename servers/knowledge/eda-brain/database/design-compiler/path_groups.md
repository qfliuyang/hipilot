---
tool: design_compiler
command_category: optimization
version: L-2016.03+
source: Synopsys Design Compiler User Guide
---

# Path Groups and Optimization

## group_path

### Syntax
```tcl
group_path -name group_name
           -weight weight_value
           -from from_list
           -to to_list
           -through through_list
           -critical_range range
           -default
```

## Description
Creates path groups for prioritized optimization. Design Compiler optimizes each group separately, allowing you to focus effort on critical paths.

## Arguments

| Option | Description | Default |
|--------|-------------|---------|
| `-name` | Group name | Required |
| `-weight` | Optimization weight (1-100) | 1 |
| `-from` | Path start points | - |
| `-to` | Path end points | - |
| `-through` | Path through points | - |
| `-critical_range` | Critical path range | 0 |
| `-default` | Modify default group | - |

## Examples

### Basic Path Group
```tcl
# Create group for critical paths
group_path -name critical_paths -weight 5 \
    -from [get_ports critical_in] \
    -to [get_ports critical_out]
```

### Register-to-Register Group
```tcl
# Group all register paths
group_path -name reg2reg -weight 2 \
    -from [all_registers -clock_pins] \
    -to [all_registers -data_pins]
```

### Input-to-Register Group
```tcl
# Group input paths
group_path -name in2reg -weight 3 \
    -from [all_inputs] \
    -to [all_registers -data_pins]
```

### Register-to-Output Group
```tcl
# Group output paths
group_path -name reg2out -weight 3 \
    -from [all_registers -clock_pins] \
    -to [all_outputs]
```

### Input-to-Output Group
```tcl
# Group feedthrough paths
group_path -name in2out -weight 1 \
    -from [all_inputs] \
    -to [all_outputs]
```

## Standard Path Group Setup
```tcl
# Clear existing groups
remove_path_group -all

# Register-to-register (highest priority)
group_path -name reg2reg -weight 5 \
    -from [all_registers -clock_pins] \
    -to [all_registers -data_pins]

# Input paths
group_path -name in2reg -weight 3 \
    -from [all_inputs] \
    -to [all_registers -data_pins]

# Output paths
group_path -name reg2out -weight 3 \
    -from [all_registers -clock_pins] \
    -to [all_outputs]

# Feedthrough paths
group_path -name in2out -weight 1 \
    -from [all_inputs] \
    -to [all_outputs]
```

## Path Group Weights

| Weight | Usage |
|--------|-------|
| 1 | Default, low priority |
| 2 | Standard priority |
| 3 | Elevated priority |
| 5 | High priority (critical paths) |
| 10 | Maximum priority |

## Related Commands

### report_path_group
```tcl
report_path_group [-verbose]
```

Reports all path groups and their weights.

### remove_path_group
```tcl
remove_path_group group_name | -all
```

Removes path groups.

### set_critical_range
```tcl
set_critical_range range [group_name]
```

Sets the critical range for a path group.

## Optimization with Path Groups
```tcl
# Setup path groups
group_path -name clk_domain1 -weight 5 \
    -from [get_clocks clk1] \
    -to [get_clocks clk1]

group_path -name clk_domain2 -weight 3 \
    -from [get_clocks clk2] \
    -to [get_clocks clk2]

# Compile with path groups
compile_ultra

# Report by path group
report_timing -group clk_domain1
report_timing -group clk_domain2
```

## Critical Range
```tcl
# Set critical range for near-critical path optimization
set_critical_range 0.5 reg2reg

# This optimizes paths within 0.5ns of the critical path
```

## Complete Example
```tcl
# Read design
read_file -format verilog design.v

# Set constraints
source constraints.sdc

# Create path groups
group_path -name reg2reg -weight 5 \
    -from [all_registers -clock_pins] \
    -to [all_registers -data_pins]

group_path -name in2reg -weight 3 \
    -from [remove_from_collection [all_inputs] [get_ports clk]] \
    -to [all_registers -data_pins]

group_path -name reg2out -weight 3 \
    -from [all_registers -clock_pins] \
    -to [all_outputs]

# Set critical range
set_critical_range 0.2 reg2reg

# Synthesis
compile_ultra

# Report results by group
report_path_group -verbose
report_timing -group reg2reg -max_paths 10
```

## Best Practices

1. **Always create reg2reg group** - Most important for timing
2. **Use appropriate weights** - Higher for critical paths
3. **Set critical range** - Optimize near-critical paths
4. **Separate clock domains** - Different groups per clock
5. **Report by group** - Analyze each group separately
6. **Don't over-group** - Too many groups reduce effectiveness

## Source
- [Synopsys Design Compiler User Guide](https://picture.iczhiku.com/resource/eetop/WhIEDLIWLEUyevnv.pdf)
- [Design Compiler Optimization Reference Manual](https://picture.iczhiku.com/resource/eetop/SHidRGQWtQruovNN.pdf)
