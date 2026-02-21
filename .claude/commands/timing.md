# /timing - Run Timing Analysis

Run a comprehensive timing analysis and provide actionable insights.

## Usage
```
/timing [path_group]
```

## Parameters
- `path_group` (optional): Specific path group to analyze (e.g., `reg2reg`, `in2reg`, `in2out`). If omitted, analyzes all path groups.

## Examples
- `/timing` - Analyze all path groups
- `/timing reg2reg` - Focus on register-to-register paths
- `/timing in2out` - Focus on input-to-output paths

## What This Command Does

When the user runs `/timing`, you should:

1. **Detect the EDA tool** - Use `eda.detect_tool` to identify if ICC2, Innovus, or PrimeTime is running
2. **Generate timing report Tcl** - Use `eda.generate_tcl` with intent "report timing" and the specified path_group
3. **Execute the Tcl** - Use `eda.send_to_terminal` to send the generated Tcl to the EDA pane
4. **Capture the output** - Use `tmux.capture_pane` on the EDA pane to get the timing report
5. **Analyze the results** - Extract and present:
   - WNS (Worst Negative Slack)
   - TNS (Total Negative Slack)
   - Number of violating endpoints
   - Top 5 worst paths with their slack values
   - Root cause analysis if violations exist
6. **Provide recommendations** - Based on the analysis, suggest specific actions

## Output Format

Present the results in a clear, actionable format:

```
## Timing Analysis Results

**Tool:** [ICC2/Innovus/PrimeTime]
**Path Group:** [All/specified]

### Summary
| Metric | Value | Status |
|--------|-------|--------|
| WNS | X.XXX ns | ✅ MET / ❌ VIOLATED |
| TNS | X.XXX ns | - |
| Violating Endpoints | XX | - |

### Top Violating Paths
1. [Path 1] - Slack: -X.XXX ns
2. [Path 2] - Slack: -X.XXX ns
...

### Root Cause Analysis
[If violations exist, identify common patterns]

### Recommendations
[Specific actions to fix timing if needed]
```

## MCP Tools Used
- `eda.detect_tool` - Detect running EDA tool
- `eda.generate_tcl` - Generate timing report Tcl
- `eda.send_to_terminal` - Execute Tcl in EDA pane
- `tmux.capture_pane` - Capture EDA output
- `eda.extract_qor` - Extract QoR metrics (optional, for structured parsing)

## Notes
- This command respects the current execution mode (manual/auto)
- If in manual mode, the Tcl will require approval before execution
- The analysis is based on the actual timing report from the EDA tool
