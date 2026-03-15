---
tool: primetime
command_category: verification
version: T-2022.03+
source: Synopsys PrimeTime User Guide
---

# check_timing

## Syntax
```tcl
check_timing [-verbose]
             [-significant_digits n]
             [-override_defaults check_list]
             [-include check_list]
             [-exclude check_list]
```

## Description
Checks the design for constraint completeness and consistency issues. This should be run after reading constraints to identify missing or conflicting constraints.

## Arguments

| Option | Description |
|--------|-------------|
| `-verbose` | Detailed output |
| `-significant_digits` | Decimal places |
| `-override_defaults` | Replace default checks |
| `-include` | Add checks to defaults |
| `-exclude` | Skip specific checks |

## Check Categories

### Default Checks
| Check | Description |
|-------|-------------|
| `no_clock` | Pins/ports without clock |
| `no_input_delay` | Input ports without delay |
| `no_output_delay` | Output ports without delay |
| `partial_input_delay` | Missing min/max input delay |
| `partial_output_delay` | Missing min/max output delay |
| `unconstrained_endpoints` | Unconstrained timing endpoints |
| `reference_not_clock` | Generated clock reference issues |
| `loops` | Combinational loops |
| `generated_clocks` | Generated clock issues |

## Examples

### Basic Check
```tcl
# Run all default checks
check_timing

# Verbose output
check_timing -verbose
```

### Include Additional Checks
```tcl
# Include specific checks
check_timing -include {multiple_clock data_check}
```

### Exclude Checks
```tcl
# Skip specific checks
check_timing -exclude {no_input_delay}
```

### Override Defaults
```tcl
# Only run specific checks
check_timing -override_defaults {no_clock no_input_delay}
```

## Related Commands

### report_transitive_fanin
```tcl
report_transitive_fanin -to pin/port
```

Reports transitive fanin of a pin.

### report_transitive_fanout
```tcl
report_transitive_fanout -from pin/port
```

Reports transitive fanout of a pin.

### report_case_analysis
```tcl
report_case_analysis
```

Reports case analysis settings.

### report_disable_timing
```tcl
report_disable_timing
```

Reports disabled timing arcs.

## Complete Verification Flow
```tcl
# Read design
read_verilog design.v
link_design

# Read constraints
read_sdc design.sdc

# Check constraints
check_timing -verbose

# Additional checks
report_case_analysis
report_disable_timing

# Check specific issues
report_transitive_fanin -to [get_pins problematic_pin]
```

## Common Issues and Solutions

### Issue: No clock
```
Warning: No clock is defined for 'N' pins/ports
```
**Solution**: Define clocks with create_clock

### Issue: No input delay
```
Warning: No input delay is set for 'N' input ports
```
**Solution**: Add set_input_delay constraints

### Issue: No output delay
```
Warning: No output delay is set for 'N' output ports
```
**Solution**: Add set_output_delay constraints

### Issue: Unconstrained endpoints
```
Warning: 'N' endpoints are unconstrained
```
**Solution**: Check clock and IO constraints

### Issue: Multiple clocks
```
Warning: 'N' pins have multiple clocks
```
**Solution**: Review clock definitions and use set_false_path if needed

## Best Practices

1. **Always run check_timing** - Before any analysis
2. **Fix all warnings** - Don't ignore constraint issues
3. **Review unconstrained endpoints** - May indicate missing constraints
4. **Check generated clocks** - Ensure proper master clock reference
5. **Verify case analysis** - Check constant propagation settings
6. **Document exceptions** - Note intentional constraint gaps

## Source
- [Synopsys PrimeTime User Guide](https://picture.iczhiku.com/resource/eetop/SykdfdRlrLPEQBBX.pdf)
- [PrimeTime Advanced Timing Analysis User Guide](https://picture.iczhiku.com/resource/eetop/wYkddifjjPrgOvMb.pdf)
