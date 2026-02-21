# /area - Area and Utilization Report

Generate an area and utilization report for the current design.

## Usage
```
/area
```

## What This Command Does

When the user runs `/area`, you should:

1. **Detect the EDA tool** - Use `eda.detect_tool` to identify the running tool
2. **Generate area report Tcl** - Use `eda.generate_tcl` with intent "report area utilization"
3. **Execute the Tcl** - Use `eda.send_to_terminal` to send the generated Tcl to the EDA pane
4. **Capture the output** - Use `tmux.capture_pane` on the EDA pane to get the area report
5. **Analyze the results** - Extract and present:
   - Total design area
   - Cell count and breakdown by type
   - Utilization percentage
   - Memory vs logic area distribution
   - Congestion indicators
6. **Provide floorplan recommendations** - Suggest adjustments if needed

## Output Format

Present the results in a clear, actionable format:

```
## Area and Utilization Report

**Tool:** [ICC2/Innovus]

### Summary
| Metric | Value | Unit |
|--------|-------|------|
| Total Area | XX.XX | µm² |
| Core Area | XX.XX | µm² |
| Utilization | XX.X | % |
| Total Cells | XX,XXX | - |
| Sequential | XX,XXX | XX% |
| Combinational | XX,XXX | XX% |
| Memory | XX,XXX | XX% |

### Area Breakdown
- **Standard Cells:** XX.XX µm² (XX%)
- **Macros:** XX.XX µm² (XX%)
- **Other:** XX.XX µm² (XX%)

### Utilization by Region
[If hierarchical utilization data is available]

### Congestion Analysis
[Indicators of routing congestion if available]

### Floorplan Recommendations
[Suggestions for area optimization or floorplan adjustments]
```

## MCP Tools Used
- `eda.detect_tool` - Detect running EDA tool
- `eda.generate_tcl` - Generate area report Tcl
- `eda.send_to_terminal` - Execute Tcl in EDA pane
- `tmux.capture_pane` - Capture EDA output

## Notes
- Utilization target typically 70-80% for routable designs
- High utilization may cause routing congestion
- Consider area/power/performance tradeoffs
