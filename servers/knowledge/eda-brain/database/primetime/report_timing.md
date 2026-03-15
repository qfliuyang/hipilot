---
tool: primetime
command_category: analysis
version: T-2022.03+
source: Synopsys PrimeTime User Guide
---

# report_timing

## Syntax
```tcl
report_timing [-from from_list]
              [-to to_list]
              [-through through_list]
              [-delay_type {max|min}]
              [-nworst n]
              [-max_paths n]
              [-path_type {full|short|end|only}]
              [-format {column|wide|narrow}]
              [-significant_digits n]
              [-transition_time]
              [-capacitance]
              [-nets]
              [-attributes]
              [-crosstalk_delta]
              [-variation]
              [-report report_name]
              [-nosplit]
              [-unique_pins]
              [-group group_name]
              [-slack_greater_than slack]
              [-slack_lesser_than slack]
```

## Description
Reports timing paths with detailed delay information. This is the primary command for static timing analysis in PrimeTime.

## Arguments

| Option | Description | Default |
|--------|-------------|---------|
| `-from` | Start points (registers/inputs/ports) | - |
| `-to` | End points (registers/outputs/ports) | - |
| `-through` | Intermediate points | - |
| `-delay_type max` | Setup analysis (max delay) | max |
| `-delay_type min` | Hold analysis (min delay) | - |
| `-nworst` | Worst paths per endpoint | 1 |
| `-max_paths` | Total paths to report | 100 |
| `-path_type` | Path detail level | full |
| `-format` | Output format | column |
| `-significant_digits` | Decimal places | 2 |
| `-transition_time` | Show transition times | - |
| `-capacitance` | Show capacitances | - |
| `-nets` | Show net delays | - |
| `-unique_pins` | Unique paths only | - |
| `-group` | Report specific path group | - |

## Examples

### Basic Setup Report
```tcl
# Report worst setup paths
report_timing

# Report 20 worst paths
report_timing -max_paths 20
```

### Hold Analysis
```tcl
# Report worst hold paths
report_timing -delay_type min

# Report 10 worst hold paths
report_timing -delay_type min -max_paths 10
```

### Specific Path
```tcl
# Report path between specific points
report_timing -from [get_pins reg1/CK] -to [get_pins reg2/D]

# Report through specific point
report_timing -through [get_pins mux1/Z]
```

### Detailed Report
```tcl
# Full detail with transition and capacitance
report_timing -max_paths 10 \
    -transition_time \
    -capacitance \
    -nets \
    -significant_digits 4
```

### Path Groups
```tcl
# Report specific group
report_timing -group reg2reg

# Report all groups
foreach group [get_path_groups] {
    report_timing -group $group -max_paths 10
}
```

### Slack Filtering
```tcl
# Report paths with slack less than 0 (violations)
report_timing -slack_lesser_than 0.0

# Report paths with slack greater than -0.5
report_timing -slack_greater_than -0.5
```

## report_timing Options

### Path Types
| Type | Description |
|------|-------------|
| `full` | Complete path with all details |
| `short` | Summary only |
| `end` | Endpoint summary |
| `only` | Only specified segment |

### Output Formats
| Format | Description |
|--------|-------------|
| `column` | Aligned columns |
| `wide` | Wider columns |
| `narrow` | Compact format |

## Related Commands

### get_timing_paths
```tcl
get_timing_paths [-from from_list]
                 [-to to_list]
                 [-delay_type max|min]
                 [-nworst n]
                 [-max_paths n]
                 [-slack_lesser_than slack]
                 [-slack_greater_than slack]
```

Returns timing path objects for scripting.

**Example:**
```tcl
set paths [get_timing_paths -max_paths 10]
foreach_in_collection path $paths {
    set slack [get_attribute $path slack]
    puts "Slack: $slack"
}
```

### report_constraint
```tcl
report_constraint [-all_violators]
                  [-verbose]
                  [-significant_digits n]
```

Reports constraint violations summary.

### report_delay_calculation
```tcl
report_delay_calculation -from pin -to pin
```

Reports detailed delay calculation for a specific segment.

## Complete Analysis Flow
```tcl
# Setup analysis
report_timing -delay_type max -max_paths 100 -report setup.rpt

# Hold analysis
report_timing -delay_type min -max_paths 100 -report hold.rpt

# Violations only
report_timing -delay_type max -slack_lesser_than 0 -report violations.rpt

# Detailed path analysis
report_timing -max_paths 10 \
    -transition_time \
    -capacitance \
    -nets \
    -significant_digits 4 \
    -report detailed.rpt

# Constraint report
report_constraint -all_violators -report constraints.rpt
```

## Report Interpretation

### Typical Setup Report Header
```
Path Group: reg2reg
Path Type: max (setup)

Point                                    Cap    Trans      Incr       Path
-----------------------------------------------------------------------------
clock clk (rise edge)                                          0.00      0.00
clock source latency                                           0.20      0.20
clk (in)                                           0.10      0.00      0.20
...
data arrival time                                                        5.20

clock clk (rise edge)                                         10.00     10.00
clock source latency                                           0.20     10.20
clock uncertainty                                             -0.20     10.00
library setup time                                            -0.10      9.90
-----------------------------------------------------------------------------
required time                                                            9.90
-----------------------------------------------------------------------------
slack (MET)                                                              4.70
```

## Common Errors

### Error: No timing paths found
```
Warning: No timing paths found (TIM-1)
```
**Solution**: Check constraints and design connectivity

### Error: Unconstrained endpoints
```
Warning: N endpoints are unconstrained (TIM-2)
```
**Solution**: Add input/output delays or clock definitions

## Best Practices

1. **Always check both setup and hold** - Both can have violations
2. **Report enough paths** - Default 100 may miss issues
3. **Use -unique_pins** - Avoid duplicate path reporting
4. **Check transition and capacitance** - Identify driver issues
5. **Filter by slack** - Focus on real violations
6. **Save reports** - Document analysis results

## Source
- [Synopsys PrimeTime User Guide](https://picture.iczhiku.com/resource/eetop/SykdfdRlrLPEQBBX.pdf)
- [PrimeTime Advanced Timing Analysis User Guide](https://picture.iczhiku.com/resource/eetop/wYkddifjjPrgOvMb.pdf)
