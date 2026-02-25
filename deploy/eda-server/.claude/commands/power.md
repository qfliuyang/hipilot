# /power - Power Analysis

Run a power analysis and report power consumption breakdown.

## Usage
```
/power
```

## What This Command Does

When the user runs `/power`, you should:

1. **Detect the EDA tool** - Use `eda.detect_tool` to identify the running tool
2. **Generate power report Tcl** - Use `eda.generate_tcl` with intent "report power"
3. **Execute the Tcl** - Use `eda.send_to_terminal` to send the generated Tcl to the EDA pane
4. **Capture the output** - Use `tmux.capture_pane` on the EDA pane to get the power report
5. **Analyze the results** - Extract and present:
   - Total power consumption
   - Leakage power vs dynamic power breakdown
   - Power by hierarchy (if available)
   - Power by clock domain (if available)
   - Identify power hotspots
6. **Provide optimization suggestions** - Suggest ways to reduce power if needed

## Output Format

Present the results in a clear, actionable format:

```
## Power Analysis Results

**Tool:** [ICC2/Innovus/PrimeTime-PX]

### Summary
| Metric | Value | Unit |
|--------|-------|------|
| Total Power | XX.XX | mW |
| Dynamic Power | XX.XX | mW (XX%) |
| Leakage Power | XX.XX | mW (XX%) |
| Internal Power | XX.XX | mW |
| Switching Power | XX.XX | mW |

### Power by Hierarchy (Top 5)
1. [Module 1] - XX.XX mW (XX%)
2. [Module 2] - XX.XX mW (XX%)
...

### Power Hotspots
[List any modules or nets with unexpectedly high power]

### Optimization Opportunities
[Suggestions for power reduction if applicable]
```

## MCP Tools Used
- `eda.detect_tool` - Detect running EDA tool
- `eda.generate_tcl` - Generate power report Tcl
- `eda.send_to_terminal` - Execute Tcl in EDA pane
- `tmux.capture_pane` - Capture EDA output

## Notes
- Power analysis requires switching activity (SAIF/VCD) for accurate results
- Without activity data, report shows estimated power based on toggle rates
- Consider both static and dynamic power optimization opportunities
