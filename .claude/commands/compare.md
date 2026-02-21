# /compare - Compare QoR with Baseline

Compare current QoR (Quality of Results) metrics with a saved baseline.

## Usage
```
/compare [baseline_name]
```

## Parameters
- `baseline_name` (optional): Name of the baseline to compare against. If omitted, compares with the most recent checkpoint. Use "last" for the most recent checkpoint.

## Examples
- `/compare` - Compare with most recent checkpoint
- `/compare last` - Compare with most recent checkpoint
- `/compare pre_cts` - Compare with the "pre_cts" checkpoint
- `/compare baseline` - Compare with the "baseline" checkpoint

## What This Command Does

When the user runs `/compare`, you should:

1. **Get current QoR** - Capture current timing, area, power, and DRC status
2. **Load baseline** - Use `knowledge.get_skill` or read from `.hipilot/checkpoints/` directory
3. **Compare metrics** - Calculate deltas for:
   - WNS (Worst Negative Slack)
   - TNS (Total Negative Slack)
   - Total negative endpoints
   - Total area
   - Total power
   - DRC violation count
4. **Highlight changes** - Show improvements (🟢), regressions (🔴), and unchanged (⚪)
5. **Provide analysis** - Explain what changed and why

## Output Format

Present the results in a clear comparison table:

```
## QoR Comparison: Current vs [baseline_name]

**Baseline:** [baseline_name] (timestamp)
**Current:** [timestamp]

### Timing Metrics
| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| WNS (ns) | -0.520 | -0.150 | +0.370 | 🟢 Improved |
| TNS (ns) | -12.450 | -3.200 | +9.250 | 🟢 Improved |
| Setup Violations | 47 | 12 | -35 | 🟢 Fixed |
| Hold Violations | 0 | 3 | +3 | 🔴 New |

### Area Metrics
| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| Total Area (µm²) | 125000 | 128000 | +3000 | 🟡 Increased |
| Utilization (%) | 72.5 | 74.2 | +1.7 | 🟡 Higher |

### Power Metrics
| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| Total Power (mW) | 45.2 | 47.8 | +2.6 | 🟡 Higher |

### DRC Metrics
| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| Total Violations | 23 | 15 | -8 | 🟢 Improved |

### Summary
- ✅ Timing improved significantly (+0.37ns WNS recovery)
- ⚠️ Hold violations introduced (3 new) - may need attention
- ⚠️ Area increased by 2.4% due to cell sizing
- ✅ DRC violations reduced by 35%

### Recommended Next Steps
1. Run `/timing --hold` to analyze new hold violations
2. Consider hold fix before proceeding
```

## MCP Tools Used
- `eda.get_status` - Get current design status
- `eda.extract_qor` - Extract current QoR metrics
- `tmux.capture_pane` - Capture EDA output for current metrics

## Checkpoint Management

Checkpoints are stored in `.hipilot/checkpoints/`:
- `baseline.json` - Initial baseline
- `pre_cts.json` - Before CTS
- `post_route.json` - After routing
- `final.json` - Final signoff

To create a checkpoint, use the `/save checkpoint [name]` command (if available).

## Notes
- Comparison requires a saved baseline checkpoint
- If no checkpoint exists, suggest creating one first
- Delta calculations show absolute change and percentage where applicable
