# /fix-setup - Fix Setup Timing in One Command

Analyze timing violations and generate fix Tcl in a single command.

## Usage
```
/fix-setup [path_group]
```

## Parameters
- `path_group` (optional): Specific path group to fix (e.g., `reg2reg`, `in2reg`). If omitted, analyzes all path groups.

## Examples
- `/fix-setup` - Analyze all paths and generate fixes
- `/fix-setup reg2reg` - Focus on register-to-register paths
- `/fix-setup PCIe` - Focus on PCIe domain

## What This Command Does

This command executes the complete timing fix workflow in one step:

1. **Detect EDA Tool** - Identify ICC2, Innovus, or PrimeTime
2. **Run Timing Report** - Generate and capture timing report
3. **Analyze Violations** - Extract WNS, TNS, violating paths
4. **Identify Root Causes** - Find common patterns:
   - Undersized clock buffers
   - Long nets (>100µm)
   - High fanout nets
   - Deep logic cones
5. **Generate Fix Tcl** - Create targeted ECO script:
   - Cell sizing commands
   - Buffer insertion for long nets
   - Fanout splitting
6. **Show Side Effects** - Warn about potential hold violations
7. **Present for Review** - Show Tcl with evidence and recommendations

## Output Format

```
## Timing Analysis

**Tool:** [ICC2/Innovus]
**Path Group:** [All/specified]

### Violations Found
| Metric | Value |
|--------|-------|
| WNS | -X.XXX ns |
| TNS | -X.XXX ns |
| Violating Paths | XX |

### Root Cause Analysis
[Identified patterns and common factors]

## Generated Fix Tcl

```tcl
[Generated Tcl commands]
```

## Source
**Based on:** fix-setup-timing skill workflow
**Template:** templates/fix_setup_timing.tcl.j2

## Side Effects
Hold Timing Risk: Cell sizing may introduce hold violations
Recommendation: Run /timing --hold after applying fixes

## Next Steps
1. Review the generated Tcl
2. Say "execute" to run in EDA terminal
3. Run /timing to verify improvement
4. Run /timing --hold to check for new violations
```

## MCP Tools Used
- `eda.detect_tool` - Detect running EDA tool
- `eda.generate_tcl` - Generate timing report and fix Tcl
- `eda.send_to_terminal` - Execute Tcl (with approval)
- `tmux.capture_pane` - Capture timing report output
- `eda.extract_qor` - Extract WNS/TNS metrics
- `knowledge.get_skill` - Load fix-setup-timing workflow

## Notes
- This command respects manual/auto mode
- Fix Tcl requires approval before execution
- Always verify hold timing after setup fixes
- Multiple iterations may be needed for full closure
