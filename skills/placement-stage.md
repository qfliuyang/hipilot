---
name: placement-stage
description: >
  Stage 4: Placement - Place standard cells and optimize timing.
  Runs place_opt_design for initial placement and timing optimization.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 4
  stage_name: "Placement"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/pp/design.enc"
  output_checkpoint: "result/placement/design.enc"
  timeout: 900
  prior_stages: ["power_plan"]
  triggers:
    - "stage 4"
    - "run placement"
    - "placement"
  qor_metrics: [WNS, TNS, Cell_Density, Congestion]
  risk_level: high
  typical_duration: "5-30 minutes"
---

# Stage 4: Placement (innovus)

## Overview

Place standard cells and optimize timing using Cadence Innovus.

**Tool**: `innovus` (physical design)

**Input**: Power-planned design checkpoint from Stage 3

**Output**: `result/placement/design.enc`

**Duration**: ~5-30 minutes

## Prerequisites

- Stage 3 (Power Plan) must be complete
- Input checkpoint: `result/pp/design.enc`
- Power grid created

## Tcl Template

Use template: `templates/cadence/innovus_placement.tcl`

## Key Commands

```tcl
# Load previous checkpoint
source result/pp/design.enc

# Run placement and optimization
place_opt_design

# Save checkpoint
saveDesign result/placement/design.enc
```

## Success Criteria

- All cells placed
- WNS within 10% of target
- No high congestion areas (>90%)
- Timing constraints met

## QoR Metrics to Report

- WNS (Worst Negative Slack)
- TNS (Total Negative Slack)
- Cell density
- Congestion hotspots
