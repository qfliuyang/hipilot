# /drc - Run Design Rule Check

Run a comprehensive DRC (Design Rule Check) and summarize the results.

## Usage
```
/drc
```

## What This Command Does

When the user runs `/drc`, you should:

1. **Detect the EDA tool** - Use `eda.detect_tool` to identify if ICC2, Innovus, or another tool is running
2. **Generate DRC Tcl** - Use `eda.generate_tcl` with intent "run DRC check"
3. **Execute the Tcl** - Use `eda.send_to_terminal` to send the generated Tcl to the EDA pane
4. **Capture the output** - Use `tmux.capture_pane` on the EDA pane to get the DRC report
5. **Analyze the results** - Extract and present:
   - Total violation count
   - Violations by category (metal spacing, min area, via enclosure, shorts, opens, antenna, etc.)
   - Critical vs warning classification
   - Top violation locations
6. **Provide fix recommendations** - Suggest specific actions to resolve violations

## Output Format

Present the results in a clear, actionable format:

```
## DRC Analysis Results

**Tool:** [ICC2/Innovus]

### Summary
| Category | Count | Severity |
|----------|-------|----------|
| Total Violations | XX | - |
| Critical | XX | 🔴 |
| Warnings | XX | 🟡 |
| Clean | XX | 🟢 |

### Violation Breakdown
- **Metal Spacing:** XX violations
- **Min Area:** XX violations
- **Via Enclosure:** XX violations
- **Shorts:** XX violations
- **Opens:** XX violations
- **Antenna:** XX violations
- **Other:** XX violations

### Top Violation Locations
1. [Location 1] - [Violation Type]
2. [Location 2] - [Violation Type]
...

### Recommendations
[Specific actions to fix DRC violations]
```

## MCP Tools Used
- `eda.detect_tool` - Detect running EDA tool
- `eda.generate_tcl` - Generate DRC Tcl
- `eda.send_to_terminal` - Execute Tcl in EDA pane
- `tmux.capture_pane` - Capture EDA output

## Notes
- DRC checks may take several minutes for large designs
- Results depend on the design's current state (placed, routed, etc.)
- Some violations may require design changes, others may be fixed automatically
