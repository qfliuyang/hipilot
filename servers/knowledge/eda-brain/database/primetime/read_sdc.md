---
tool: primetime
command_category: constraints
version: T-2022.03+
source: Synopsys PrimeTime User Guide
---

# read_sdc

## Syntax
```tcl
read_sdc file_name
          [-echo]
          [-verbose]
```

## Description
Reads Synopsys Design Constraints (SDC) file containing timing constraints, clock definitions, and design rules. This establishes the timing environment for analysis.

## Arguments

| Option | Description |
|--------|-------------|
| `-echo` | Echo commands while reading |
| `-verbose` | Verbose output |

## Examples

### Basic Usage
```tcl
# Read SDC constraints
read_sdc design.sdc

# With echo
read_sdc design.sdc -echo
```

## SDC File Contents

### Clock Definition
```tcl
# Create clock
create_clock -name clk -period 10 [get_ports clk]

# Create clock with waveform
create_clock -name clk -period 10 -waveform {0 5} [get_ports clk]

# Virtual clock
create_clock -name vclk -period 10
```

### Clock Constraints
```tcl
# Set clock uncertainty
set_clock_uncertainty -setup 0.2 [get_clocks clk]
set_clock_uncertainty -hold 0.1 [get_clocks clk]

# Set clock transition
set_clock_transition 0.1 [get_clocks clk]

# Set clock latency
set_clock_latency -source 0.5 [get_clocks clk]
set_clock_latency 0.2 [get_clocks clk]
```

### IO Constraints
```tcl
# Input delay
set_input_delay -clock clk -max 2.0 [get_ports data_in]
set_input_delay -clock clk -min 0.5 [get_ports data_in]

# Output delay
set_output_delay -clock clk -max 2.0 [get_ports data_out]
set_output_delay -clock clk -min 0.5 [get_ports data_out]

# Input transition
set_input_transition 0.1 [get_ports data_in]

# Drive strength
set_driving_cell -lib_cell BUFX2 [get_ports data_in]

# Output load
set_load 0.5 [get_ports data_out]
```

### Timing Exceptions
```tcl
# False paths
set_false_path -from [get_ports reset]
set_false_path -from [get_clocks clk1] -to [get_clocks clk2]

# Multicycle paths
set_multicycle_path -setup 2 -from [get_pins reg1/CK] -to [get_pins reg2/D]
set_multicycle_path -hold 1 -from [get_pins reg1/CK] -to [get_pins reg2/D]

# Max delay
set_max_delay 5.0 -from [get_ports in] -to [get_ports out]

# Min delay
set_min_delay 1.0 -from [get_ports in] -to [get_ports out]
```

### Design Rules
```tcl
# Max transition
set_max_transition 0.5 [current_design]

# Max capacitance
set_max_capacitance 1.0 [current_design]

# Max fanout
set_max_fanout 20 [current_design]
```

## Related Commands

### source
```tcl
source file_name
```

Alternative to read_sdc, sources any Tcl script.

### write_sdc
```tcl
write_sdc file_name
```

Writes current constraints to SDC file.

### check_timing
```tcl
check_timing
```

Checks constraints for completeness and consistency.

## Complete Constraints Flow
```tcl
# Read design
read_verilog design.v
link_design

# Read constraints
read_sdc design.sdc

# Check constraints
check_timing

# Report clocks
report_clock

# Report constraints
report_constraint -all_violators
```

## Common Errors

### Error: Clock not found
```
Error: Clock 'clk' not found (SDC-1)
```
**Solution**: Define clock with create_clock before using it

### Error: Port not found
```
Error: Port 'data_in' not found (SDC-2)
```
**Solution**: Check port names match the netlist

### Error: Constraint conflict
```
Warning: Overwriting existing constraint (SDC-3)
```
**Solution**: Review SDC for duplicate or conflicting constraints

## Best Practices

1. **Use consistent naming** - Match netlist names exactly
2. **Define all clocks** - Including virtual clocks for IO
3. **Set realistic constraints** - Don't over-constrain
4. **Use check_timing** - Verify constraint completeness
5. **Document exceptions** - Comment false paths and MCPs
6. **Version control SDC** - Track constraint changes

## Source
- [Synopsys PrimeTime User Guide](https://picture.iczhiku.com/resource/eetop/SykdfdRlrLPEQBBX.pdf)
- [PrimeTime Advanced Timing Analysis User Guide](https://picture.iczhiku.com/resource/eetop/wYkddifjjPrgOvMb.pdf)
