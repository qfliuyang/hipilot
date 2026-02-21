# /fix-hold - Fix Hold Timing in One Command

Analyze hold timing violations and generate fix Tcl in a single command.

## Usage
```
/fix-hold [path_group]
```

## Parameters
- `path_group` (optional): Specific path group to fix. If omitted, analyzes all path groups.

## What This Command Does

This command executes the complete hold timing fix workflow:

1. **Detect EDA Tool** - Identify ICC2, Innovus, or PrimeTime
2. **Run Hold Timing Report** - Generate and capture min-delay analysis
3. **Analyze Violations** - Extract worst hold slack, violating paths
4. **Identify Root Causes** - Common patterns:
   - Excessive clock skew
   - Short data paths
   - Fast corner timing
   - Clock tree imbalance
5. **Generate Fix Tcl** - Create targeted ECO script:
   - Add delay elements
   - Resize clock buffers
   - Insert detour routing
6. **Show Side Effects** - Warn about potential setup impact
7. **Present for Review** - Show Tcl with evidence

## Output Format

```
## Hold Timing Analysis

**Tool:** [ICC2/Innovus]

### Violations Found
| Metric | Value |
|--------|-------|
| Worst Hold Slack | -X.XXX ns |
| Hold Violations | XX |

### Root Cause
[Identified patterns]

## Generated Fix Tcl
```tcl
[Generated commands]
```

## Side Effects
Setup Timing Risk: Adding delay may degrade setup slack
Recommendation: Run /timing after applying fixes

## Next Steps
1. Review and execute the Tcl
2. Verify hold timing with /timing --hold
3. Check setup timing with /timing
```

## Notes
- Hold fixes often trade off with setup timing
- Run timing reports after each fix iteration
- Consider incremental fixes vs batch changes
