---
title: Clock Tree Synthesis
stage: 5
tool: innovus / icc2_shell
prerequisites:
  - Design is placed
  - Clock ports defined
  - SDC constraints loaded
  - Timing libraries loaded (CRITICAL)
next_stage: post-cts-opt
qor_metrics: [Clock_Skew, Clock_Latency, Clock_Power, Buf_Count]
risk_level: moderate
duration: 3-15 minutes
---

# CTS (Stage 5)

Clock Tree Synthesis for digital designs. Covers clock tree specification,
buffer/inverter selection, skew optimization, and post-CTS timing analysis.

## Quick Reference

```
Input: Placed design
Output: Clock tree built
Tool: innovus (Cadence) or icc2_shell (Synopsys)
```

## Tree Navigation

- [tcl-patterns.md](./tcl-patterns.md) - Common Tcl patterns
- [common-issues.md](./common-issues.md) - Errors and fixes

## Stage Overview

### CTS Workflow

1. **Analyze Clocks** - List clocks and check status
2. **Configure CTS** - Set skew targets, buffer selection
3. **Run CTS** - ccopt_design / clock_opt
4. **Analyze Results** - Skew, latency, buffer count
5. **Optimize** - Refine if needed

### Key Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Skew** | Max clock arrival difference | < 10% of period |
| **Latency** | Clock insertion delay | < 30% of period |
| **Duty Cycle** | High/low ratio | 50% ± 5% |
| **Power** | Clock network power | Minimize |

### CTS Configuration Options

#### Buffer Selection

```tcl
set_ccopt_property buffer_cells {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}
set_ccopt_property inverter_cells {CLKINV_X4 CLKINV_X8 CLKINV_X16}
```

#### Skew Targets

| Design Type | Skew Target |
|-------------|-------------|
| High-speed | < 50ps |
| Standard | < 100ps |
| Low-power | < 200ps |

## Prerequisites (CRITICAL)

### Timing Libraries Must Be Loaded

**IMPORTANT:** CTS requires timing libraries to be loaded during design initialization.
If the design is in "physical-only mode" (no timing libraries), CTS commands will fail.

**Signs of physical-only mode:**
- `create_ccopt_clock_tree_spec` fails with timing-related errors
- `report_timing` shows "No constrained timing paths found"
- Clock signals treated as regular ports

## Next Stage

After CTS complete, proceed to [Post-CTS Opt](../post-cts-opt/INDEX.md).

Required state:
- Skew < target
- Latency reasonable
- Transitions clean
- No clock DRCs
