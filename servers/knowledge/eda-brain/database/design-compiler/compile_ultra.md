---
tool: design_compiler
command_category: synthesis
version: L-2016.03+
source: Synopsys Design Compiler Optimization Reference Manual
---

# compile_ultra

## Syntax
```tcl
compile_ultra [-no_automatic]
              [-no_boundary_optimization]
              [-no_seq_output_inversion]
              [-retime]
              [-scan]
              [-gate_clock]
              [-exact_map]
              [-area_high_effort_script]
              [-timing_high_effort_script]
              [-spg]
              [-top]
              [-incremental]
              [-no_design_rule]
              [-no_ungroup]
              [-ungroup_all]
              [-no_mux_optimization]
```

## Description
Performs high-effort synthesis and optimization of the design. This is the primary synthesis command for Design Compiler, providing better QoR than the basic `compile` command.

## Arguments

| Option | Description |
|--------|-------------|
| `-no_automatic` | Disable automatic ungrouping and flattening |
| `-no_boundary_optimization` | Disable boundary optimization |
| `-no_seq_output_inversion` | Disable sequential output inversion |
| `-retime` | Enable register retiming |
| `-scan` | Insert scan chains |
| `-gate_clock` | Enable clock gating |
| `-exact_map` | Exact mapping (no optimization) |
| `-area_high_effort_script` | High effort for area optimization |
| `-timing_high_effort_script` | High effort for timing optimization |
| `-spg` | Enable physical guidance (DC-Graphical) |
| `-top` | Compile top level only |
| `-incremental` | Incremental optimization |
| `-no_design_rule` | Ignore design rule constraints |
| `-no_ungroup` | Prevent automatic ungrouping |
| `-ungroup_all` | Ungroup all hierarchies |
| `-no_mux_optimization` | Disable MUX optimization |

## Examples

### Basic compile_ultra
```tcl
# Standard high-effort synthesis
compile_ultra
```

### With Scan and Clock Gating
```tcl
# Synthesis with DFT features
compile_ultra -scan -gate_clock
```

### With Retiming
```tcl
# Synthesis with register retiming for timing
compile_ultra -retime
```

### Physical Guidance (DC-Graphical)
```tcl
# Synthesis with physical guidance
compile_ultra -spg
```

### Incremental Optimization
```tcl
# Incremental optimization after ECO
compile_ultra -incremental
```

### Area Optimization
```tcl
# High effort area optimization
compile_ultra -area_high_effort_script
```

### Timing Optimization
```tcl
# High effort timing optimization
compile_ultra -timing_high_effort_script
```

## Related Commands

### set_optimize_registers
```tcl
set_optimize_registers [-design design_name]
                       [-minimum_bit_width n]
                       [-synchronous_reset]
                       [-asynchronous_reset]
                       [-clock_clock_name]
                       [-include_instances instance_list]
                       [-exclude_instances instance_list]
```

Enables register retiming with specific options.

**Example:**
```tcl
# Enable retiming with minimum 8-bit width
set_optimize_registers -minimum_bit_width 8
compile_ultra -retime
```

### set_compile_ultra_optimization
```tcl
set_compile_ultra_optimization -feature value
```

Configures specific compile_ultra optimizations.

### compile
```tcl
compile [-map_effort {low | medium | high}]
        [-area_effort {low | medium | high}]
        [-power_effort {low | medium | high}]
```

Basic synthesis command (legacy, use compile_ultra).

## Optimization Strategies

### Strategy 1: Timing Focus
```tcl
# Setup timing optimization
set_max_delay 2.0 -from [all_inputs] -to [all_outputs]
compile_ultra -timing_high_effort_script

# Report timing
report_timing -max_paths 10
```

### Strategy 2: Area Focus
```tcl
# Area optimization
set_max_area 10000
compile_ultra -area_high_effort_script

# Report area
report_area
```

### Strategy 3: Power Focus
```tcl
# Power optimization setup
set_max_dynamic_power 100
set_max_leakage_power 10

# Synthesis with clock gating
compile_ultra -gate_clock

# Report power
report_power
```

### Strategy 4: DFT-Aware
```tcl
# DFT setup
set_scan_configuration -chain_count 4
set_dft_signal -view existing_dft -type ScanClock -port clk

# Synthesis with scan insertion
compile_ultra -scan

# Preview and insert scan
preview_dft
insert_dft
```

## Complete Synthesis Flow
```tcl
# Setup
set target_library "typical.db"
set link_library "* typical.db"

# Read design
read_file -format verilog design.v

# Set design constraints
source constraints.sdc

# First pass synthesis
compile_ultra -gate_clock

# Check QoR
report_qor

# Second pass with retiming if needed
compile_ultra -retime -incremental

# Final reports
report_timing -max_paths 100
report_area
report_power
report_qor
```

## Common Errors

### Error: Design not linked
```
Error: Design 'top' is not linked (DCSH-1)
```
**Solution**: Run `link` before compile_ultra

### Error: No target library
```
Error: No target library specified (DCSH-2)
```
**Solution**: Set `target_library` before synthesis

### Error: Constraint violations
```
Warning: Design has unoptimized paths (OPT-1)
```
**Solution**: Check constraints with `check_timing`

### Error: Retiming not possible
```
Warning: Cannot retime design (OPT-2)
```
**Solution**: Check for preserved registers or dont_retime attributes

## Best Practices

1. **Always use compile_ultra instead of compile** - Better QoR
2. **Use -gate_clock for power reduction** - Automatic clock gating
3. **Use -scan for DFT** - Integrates scan insertion
4. **Use -spg with DC-Graphical** - Physical awareness
5. **Run incremental for fine-tuning** - Faster iteration
6. **Check timing before and after** - Verify improvements
7. **Use retiming carefully** - May affect verification

## Source
- [Synopsys Design Compiler Optimization Reference Manual](https://picture.iczhiku.com/resource/eetop/SHidRGQWtQruovNN.pdf)
- [Design Compiler User Guide](https://picture.iczhiku.com/resource/eetop/WhIEDLIWLEUyevnv.pdf)
