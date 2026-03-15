---
title: Routing
stage: 7
tool: innovus / icc2_shell
prerequisites:
  - Post-CTS optimization complete
  - Timing clean
  - Design legalized
next_stage: routeopt
qor_metrics: [DRC_count, antenna_count, post_route_WNS, post_route_TNS, total_wirelength]
risk_level: moderate
duration: 10-30 minutes
---

# Routing (Stage 7)

Route a placed design through global route, track assignment, detail route,
DRC clean-up, and antenna fixing.

## Quick Reference

```
Input: Post-CTS optimized design
Output: Routed design
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### Routing Workflow

1. **Pre-route Checklist** - Verify design readiness
2. **Global Route** - Assign nets to routing regions
3. **Track Assignment** - Assign nets to tracks (ICC2)
4. **Detail Route** - Place actual wires
5. **DRC Verification** - Fix violations
6. **Antenna Fixing** - Fix antenna violations
7. **Post-route Timing** - Verify timing

### Congestion Guidelines

| GCell utilization | Action |
|------------------|--------|
| < 80% | Good — proceed to detail route |
| 80–90% | Moderate — consider high effort |
| 90–95% | High — resolve before detail route |
| > 95% | Overflow — fix placement |

### Expected WNS Change

- Routing typically degrades WNS by 0.05–0.15 ns versus post-CTS
- If WNS degrades more than 0.3 ns, congestion is causing detours

## Core Principles

1. **Global route before detail route** - Never skip global route
2. **Timing-driven routing** - Always enable for timing-critical designs
3. **DRC must reach zero** - Every violation is a potential defect
4. **Antenna check after every change** - Check and fix iteratively
5. **Post-route timing is truth** - Only after routing with real RC extraction

## Next Stage

After routing complete, proceed to [Route Opt](../routeopt/INDEX.md).

Required state:
- DRC count near zero
- Antenna violations fixed
- Timing verified
- Checkpoint saved
