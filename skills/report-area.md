---
name: report-area
description: >
  Generate area and utilization report for a placed design. Extracts cell count,
  core utilization percentage, macro count, standard cell area, and density
  distribution. Flags over-utilized regions that may cause congestion or DRC
  issues. Works in ICC2 (report_design -physical) and Innovus (report_area).

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path:
    synopsys: templates/synopsys/icc2_report_area.tcl
    cadence: templates/cadence/innovus_report_area.tcl
  auto_generated: false
  flexible: true
  flow_stages: [post_place, post_cts, post_route]
  report_inputs:
    - placed or routed design (block or checkpoint)
  qor_metrics: [utilization, cell_count, total_area, macro_area]
  triggers: ["area report", "utilization", "cell count", "density"]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `report_type` | string | `summary` | `summary` for top-level metrics only, `detailed` for per-module breakdown. |
| `hierarchical` | boolean | `false` | If true, report area for each hierarchy level. |
| `hierarchy_depth` | integer | `2` | Max hierarchy depth for hierarchical reports. |
| `report_path` | string | `./reports/area.rpt` | File path to write the area report. |
| `include_macros` | boolean | `true` | Include macro cells in area breakdown. |
| `utilization_threshold` | float | `80.0` | Flag regions with utilization above this percentage. |

---

## Workflow

### Step 1: Verify Design is Loaded

Confirm a design/block is open and has placed cells.

**ICC2:**
```tcl
current_block
report_design -summary
```

**Innovus:**
```tcl
dbGet top.name
dbGet top.numInsts
```

If no design is loaded, prompt the user to open one first.

### Step 2: Run Area Report

**ICC2 (Synopsys):**
```tcl
# Summary area report
report_design -physical

# Detailed hierarchical breakdown
report_cell_usage -hierarchical -level 2

# Utilization by voltage area
report_utilization
```

**Innovus (Cadence):**
```tcl
# Summary area report
report_area

# Overall design summary
summaryReport

# Hierarchical breakdown
report_area -hier -depth 2
```

### Step 3: Extract Key Metrics

Parse the report output to extract:

| Metric | Description |
|--------|-------------|
| **Total area** | Die area or core area in square microns |
| **Cell count** | Number of standard cells placed |
| **Macro count** | Number of hard macros |
| **Utilization** | Standard cell area / core area × 100% |
| **Macro area** | Total area occupied by macros |
| **Buffer count** | Number of buffer/inverter cells (indicates optimization effort) |

### Step 4: Analyze Utilization

Check for potential issues:
- **> 85% utilization**: Likely congestion problems, DRC issues
- **> 80% utilization**: May need placement optimization
- **< 60% utilization**: Area could be reduced, or design has room for ECO
- **Uneven distribution**: Hot spots may cause local congestion

### Step 5: Present Results

Display area metrics in a formatted table:

```
Area Report Summary:
┌──────────────────────┬────────────┐
│ Metric               │ Value      │
├──────────────────────┼────────────┤
│ Core Area            │ 245,000 µm²│
│ Standard Cell Area   │ 183,750 µm²│
│ Macro Area           │  24,500 µm²│
│ Utilization          │     75.0%  │
│ Cell Count           │   18,432   │
│ Macro Count          │        4   │
│ Buffer Count         │    2,156   │
└──────────────────────┴────────────┘
```

If hierarchical mode is enabled, show per-module breakdown.

---

## Core Principles

1. **Utilization is context-dependent** — 75% is comfortable for most designs, but
   high-performance designs targeting maximum density may push to 85%+
2. **Macro placement dominates area** — check macro count and placement before
   optimizing standard cell utilization
3. **Buffer count indicates optimization pressure** — excessive buffers suggest
   timing closure is fighting placement, consider re-floorplanning
4. **Area after CTS increases** — clock tree buffers add 5-15% cell count, always
   re-check area after CTS
5. **Density uniformity matters** — uneven cell density causes local congestion
   even when overall utilization is acceptable

## What Can Go Wrong

- **Misleading utilization**: Total utilization may look fine but local hot spots exist
- **Macro area not excluded**: Some reports include macro area in utilization calculation
- **Post-route bloat**: Buffer insertion during route optimization can increase cell count 10-20%
- **Filler cells**: Don't count filler cells as "real" utilization — they're placeholders

---

## Example Usage

```
you: what's the area utilization of my design?

hipilot: Let me check the area metrics.

  📖 Running area report...

  Area Report Summary:
  ┌──────────────────────┬────────────┐
  │ Metric               │ Value      │
  ├──────────────────────┼────────────┤
  │ Core Area            │ 245,000 µm²│
  │ Standard Cell Area   │ 183,750 µm²│
  │ Utilization          │     75.0%  │
  │ Cell Count           │   18,432   │
  │ Buffer Count         │    2,156   │
  └──────────────────────┴────────────┘

  Your utilization is 75% which is healthy. Buffer count is
  reasonable at 11.7% of total cells.

  No congestion concerns at this utilization level.
```

---

## Template Reference

- **Synopsys**: `templates/synopsys/icc2_report_area.tcl`
- **Cadence**: `templates/cadence/innovus_report_area.tcl`
