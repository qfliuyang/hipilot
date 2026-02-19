---
name: compare-qor
description: >
  Compare Quality of Results (QoR) metrics between two design states or
  checkpoints. Extracts timing (WNS, TNS, violations), power (leakage,
  dynamic, total), area (utilization, cell count), and DRC metrics from
  both states. Computes signed deltas, highlights regressions, and presents
  a formatted comparison table.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path:
    synopsys: templates/synopsys/icc2_compare_qor.tcl
    cadence: templates/cadence/innovus_compare_qor.tcl
  auto_generated: false
  flexible: true
  flow_stages: [post_place, post_cts, post_route, signoff]
  report_inputs:
    - baseline report files or checkpoint
    - current report files or checkpoint
  qor_metrics: [wns_delta, tns_delta, power_delta, area_delta, drc_delta]
  triggers: ["compare results", "qor delta", "compare timing", "compare qor", "before after"]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `baseline` | string | `last` | Baseline checkpoint name, directory, or `last` for most recent in .hipilot/checkpoints/. |
| `current` | string | `now` | Current state: `now` runs live reports, or a checkpoint name/directory. |
| `metrics` | list | `[timing, power, area, drc]` | Which metric categories to compare. |
| `report_path` | string | `./reports/qor_compare.rpt` | File to write comparison report. |
| `regression_threshold` | float | `0.01` | Flag timing regression if WNS degrades by more than this (ns). |
| `power_threshold` | float | `5.0` | Flag power regression if total power increases by more than this percentage. |

---

## Workflow

### Step 1: Locate Baseline Data

Resolve the baseline checkpoint or reports:

- `last` → scan `.hipilot/checkpoints/` for most recent CHECKPOINT_INFO.txt
- Named checkpoint → look for `{name}_timing.rpt`, `{name}_qor.rpt`, etc.
- Directory → scan directory for report files

### Step 2: Gather Current Data

If `current` is `now`, run live reports in the current design state:

**ICC2:**
```tcl
report_timing -max_paths 100 > /tmp/hipilot_current_timing.rpt
report_qor > /tmp/hipilot_current_qor.rpt
report_power > /tmp/hipilot_current_power.rpt
report_design -physical > /tmp/hipilot_current_area.rpt
check_routes > /tmp/hipilot_current_drc.rpt
```

**Innovus:**
```tcl
timeDesign -postRoute > /tmp/hipilot_current_timing.rpt
report_power > /tmp/hipilot_current_power.rpt
report_area > /tmp/hipilot_current_area.rpt
verify_drc > /tmp/hipilot_current_drc.rpt
```

### Step 3: Extract Metrics from Both

Parse baseline and current reports to extract:

| Category | Metrics |
|----------|---------|
| **Timing** | WNS (ns), TNS (ns), setup violations, hold violations |
| **Power** | Leakage (mW), Dynamic (mW), Total (mW) |
| **Area** | Cell count, Utilization (%), Total area (µm²) |
| **DRC** | Total violations, by type (short, spacing, width) |

### Step 4: Compute Deltas

For each metric, compute:
- **Delta** = current - baseline
- **Percentage change** = (current - baseline) / |baseline| × 100%
- **Direction**: ↑ (increased), ↓ (decreased), → (unchanged)
- **Regression flag**: ⚠ if metric got worse beyond threshold

### Step 5: Present Comparison Table

```
QoR Comparison: post_place vs post_route_opt
─────────────────────────────────────────────────────────
                    Baseline    Current     Delta    Δ%
─────────────────────────────────────────────────────────
Timing:
  WNS (ns)          -0.312      -0.015     +0.297  ✓  improved
  TNS (ns)          -4.870      -0.089     +4.781  ✓  improved
  Setup violations   47          3          -44     ✓  improved
  Hold violations    0           0           0      →  unchanged

Power:
  Leakage (mW)       12.3        12.8      +0.5    ↑  +4.1%
  Dynamic (mW)       45.6        44.2      -1.4    ↓  -3.1%
  Total (mW)         57.9        57.0      -0.9    ↓  -1.6%

Area:
  Cell count         18,432      19,876    +1,444  ↑  +7.8%
  Utilization (%)    75.0        78.2      +3.2    ↑  +4.3%

DRC:
  Total violations   23          3          -20     ✓  improved
─────────────────────────────────────────────────────────

Summary: Timing significantly improved. Power stable. Area
increased 7.8% from buffer insertion. DRC improved.
```

### Step 6: Highlight Regressions

If any metric regressed beyond threshold, call out specifically:

```
⚠ REGRESSIONS DETECTED:
  - Cell count increased 7.8% (buffer insertion during opt)
  - Leakage power up 4.1% (more cells = more leakage)

These are expected side effects of timing optimization.
No action needed unless power budget is tight.
```

---

## Core Principles

1. **Compare apples to apples** — ensure both states use the same corners and scenarios
2. **Timing improvements often cost area/power** — buffer insertion fixes timing but
   increases cell count, leakage, and area
3. **DRC should trend to zero** — DRC violations should decrease with each optimization step
4. **Relative deltas matter more than absolutes** — a 0.01ns WNS improvement on a
   tight design matters more than 1ns improvement when WNS was -5ns
5. **Track across flow stages** — compare post_place vs post_route, not just sequential checkpoints

## What Can Go Wrong

- **Different corners**: Comparing timing from different MCMM scenarios gives meaningless results
- **Missing reports**: Baseline checkpoint may not have all report types
- **Report format changes**: Different tool versions may change report format
- **Stale baseline**: Comparing against a very old baseline may not be meaningful
- **Incomplete optimization**: Current state may be mid-optimization — wait for tool to finish

---

## Example Usage

```
you: compare my current timing with the post_place checkpoint

hipilot: Let me gather QoR from both states.

  📖 Loading baseline from checkpoints/post_place...
  📖 Running current timing/power/area reports...

  QoR Comparison: post_place → current
  ┌────────────────────┬──────────┬──────────┬─────────┐
  │ Metric             │ Baseline │ Current  │ Delta   │
  ├────────────────────┼──────────┼──────────┼─────────┤
  │ WNS (ns)           │ -0.312   │ -0.015   │ +0.297 ✓│
  │ TNS (ns)           │ -4.870   │ -0.089   │ +4.781 ✓│
  │ Setup violations   │ 47       │ 3        │ -44    ✓│
  │ Total power (mW)   │ 57.9     │ 57.0     │ -0.9   ✓│
  │ Cell count         │ 18,432   │ 19,876   │ +1,444 ↑│
  │ DRC violations     │ 23       │ 3        │ -20    ✓│
  └────────────────────┴──────────┴──────────┴─────────┘

  Timing closure improved significantly. Cell count increased
  by 7.8% from buffer insertion — this is normal. DRC count
  down from 23 to 3.

  Want me to fix the remaining 3 DRC violations?
```

---

## Template Reference

- **Synopsys**: `templates/synopsys/icc2_compare_qor.tcl`
- **Cadence**: `templates/cadence/innovus_compare_qor.tcl`
