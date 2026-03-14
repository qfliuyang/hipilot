---
name: chipfinish-stage
description: >
  Stage 9: Chip Finish - Final optimization, fill insertion, and GDS export.
  Final stage: adds fill cells, optimizes, and exports GDS.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 9
  stage_name: "Chip Finish"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/routing_opt/design.enc"
  output_checkpoint: "result/chip_done/design.enc"
  final_output: "result/chip_done/design.gds"
  timeout: 600
  prior_stages: ["routing_opt"]
  triggers:
    - "stage 9"
    - "run chipfinish"
    - "chipfinish"
    - "final stage"
    - "export gds"
  qor_metrics: [DRC_Count, LVS_Clean, GDS_Size]
  risk_level: low
  typical_duration: "5-15 minutes"
---

# Stage 9: Chip Finish (innovus)

## Overview

Final stage: add fill cells, final optimizations, and export GDS.

**Tool**: `innovus` (physical design)

**Input**: Route-optimized checkpoint from Stage 8

**Outputs**:
- `result/chip_done/design.enc`
- `result/chip_done/design.gds`

**Duration**: ~5-15 minutes

## Prerequisites

- Stage 8 (Route Opt) must be complete
- Input checkpoint: `result/routing_opt/design.enc`
- Design DRC-clean

## Tcl Template

Use template: `templates/cadence/innovus_chip_finish.tcl`

## Key Commands

```tcl
# Load previous checkpoint
source result/routing_opt/design.enc

# Add fill cells
addFiller -cell <filler_cells>

# Final verification
verifyConnectivity
verifyGeometry

# Save checkpoint
saveDesign result/chip_done/design.enc

# Export GDS
streamOut result/chip_done/design.gds
```

## Success Criteria

- DRC clean (0 violations)
- LVS clean
- GDS file created and > 10MB
- Final checkpoint saved

## QoR Metrics to Report

- Final DRC count (should be 0)
- GDS file size
- Design area
- Final cell count

## Graduation

When this stage completes successfully, the RTL-to-GDS flow is complete.
