---
title: Post-Route Optimization
stage: 8
tool: innovus / icc2_shell
prerequisites:
  - Routing completed
  - Design routed (global + detail)
  - Timing libraries loaded
next_stage: chipfinish
qor_metrics: [WNS, TNS, DRC_Violations, Antenna_Violations]
risk_level: moderate
duration: 10-30 minutes
---

# Route Opt (Stage 8)

Post-routing optimization for timing and DRC. Covers timing-driven
optimization, antenna fixing, and final cleanup.

## Quick Reference

```
Input: Routed design
Output: Optimized routed design
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Post-Route Optimization Workflow

1. **Configure Optimization Mode** - Set DRC and timing targets
2. **Run Setup Optimization** - Fix setup violations
3. **Run Hold Optimization** - Fix hold violations
4. **Fix DRC Violations** - Clean up DRCs
5. **Final Cleanup** - Remove dangling nets, assigns
6. **Final Verification** - Verify connectivity and DRC

### Optimization Options

#### Setup-Only

```tcl
optDesign -postRoute -setup
```

#### Hold-Only

```tcl
optDesign -postRoute -hold
```

#### Combined (Recommended)

```tcl
optDesign -postRoute -setup
optDesign -postRoute -hold
```

#### With Useful Skew

```tcl
setOptMode -usefulSkew true
optDesign -postRoute -setup
```

## Key Principles

1. **Post-route opt can re-introduce DRC** - Always re-verify DRC after optimization
2. **Never run route_opt with > 100 DRC violations** - Fix DRC first
3. **Filler cells last** - Insert fillers only after all ECOs

## Next Stage

After route optimization, proceed to [Chip Finish](../chipfinish/INDEX.md).

Required state:
- Setup timing clean (WNS >= 0)
- Hold timing clean (WNS >= 0)
- DRC violations fixed
- Antenna violations fixed
- Checkpoint saved
