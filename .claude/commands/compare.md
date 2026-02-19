Compare QoR metrics between current state and a baseline.

Arguments: $ARGUMENTS
If "last" is provided, compare with the most recent checkpoint in .hipilot/checkpoints/
If a checkpoint name is provided, compare with that specific checkpoint.

Steps:
1. Load baseline metrics from checkpoint
2. Run current timing/power/area reports
3. Extract metrics from both
4. Compute deltas for: WNS, TNS, violations, total power, area
5. Present comparison table with ↑/↓ indicators
6. Highlight any regressions (metrics that got worse)
