---
title: Post-CTS Optimization
stage: 6
tool: innovus / icc2_shell
prerequisites:
  - CTS completed
  - Clock tree built
  - Timing libraries loaded
next_stage: routing
qor_metrics: [WNS, TNS, Setup_Violations, Hold_Violations]
risk_level: moderate
duration: 5-15 minutes
---

# Post-CTS Optimization (Stage 6)

Post-CTS optimization for setup and hold timing. Covers clock propagation,
optimization mode settings, and timing analysis after CTS.

## Quick Reference

```
Input: CTS completed design
Output: Timing optimized design
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Post-CTS Optimization Workflow

1. **Set Clocks to Propagated** - Enable real clock delays
2. **Configure Optimization Mode** - Set targets
3. **Run Setup Optimization** - Fix setup violations
4. **Run Hold Optimization** - Fix hold violations
5. **Analyze Results** - Check timing

### Optimization Strategies

#### Setup-Only

```tcl
optDesign -postCTS -setup
```

#### Hold-Only

```tcl
optDesign -postCTS -hold
```

#### Combined (Recommended)

```tcl
optDesign -postCTS -setup
optDesign -postCTS -hold
```

### Expected Results

| Metric | Target | Warning | Error |
|--------|--------|---------|-------|
| Setup WNS | > 0 | < -0.1ns | < -0.5ns |
| Hold WNS | > 0 | < -0.05ns | < -0.1ns |
| Setup TNS | 0 | < 10ns | < 50ns |
| Hold TNS | 0 | < 5ns | < 20ns |

## Next Stage

After post-CTS optimization, proceed to [Routing](../routing/INDEX.md).

Required state:
- Setup timing clean (WNS >= 0)
- Hold timing clean (WNS >= 0)
- No DRC violations
- Checkpoint saved
