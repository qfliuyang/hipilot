---
title: Placement
stage: 4
tool: innovus / icc2_shell
prerequisites:
  - Floorplan created
  - Power grid connected
  - Timing libraries loaded
  - SDC constraints applied
next_stage: cts
qor_metrics: [WNS, TNS, Congestion, Utilization]
risk_level: moderate
duration: 5-20 minutes
---

# Placement (Stage 4)

Standard cell placement for digital designs. Covers timing-driven placement,
congestion optimization, and pre-CTS timing analysis.

## Quick Reference

```
Input: Power planned design
Output: Placed cells
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Placement Workflow

1. **Configure Placement Mode** - Set timing-driven options
2. **Set Timing Derates** - OCV derating
3. **Run Placement** - place_opt_design
4. **Analyze Results** - Timing and congestion

### Placement Options

#### Timing-Driven (Default)

```tcl
setPlaceMode -timing_effort high
place_opt_design
```

#### Congestion-Driven

```tcl
setPlaceMode -cong_effort high
place_opt_design
```

#### Density-Constrained

```tcl
setPlaceMode -place_global_max_density 0.75
place_opt_design
```

## Pre-CTS Timing Analysis

Expected timing at pre-CTS:
- Some negative slack is normal (no clock tree yet)
- Setup violations: Will be fixed during CTS and routing
- Focus on identifying critical paths

## Next Stage

After placement complete, proceed to [CTS](../cts/INDEX.md).

Required state:
- No overlap violations
- Congestion acceptable
- Timing analyzed
- Checkpoint saved
