---
name: floorplan-stage
description: >
  Stage 2: Floorplanning - Define die area, place macros, insert IOs.
  Sets up the physical layout foundation for the design.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 2
  stage_name: "Floorplan"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/init/design.enc"
  output_checkpoint: "result/fp/design.enc"
  timeout: 300
  prior_stages: ["design_init"]
  triggers:
    - "stage 2"
    - "run floorplan"
    - "floorplan"
  qor_metrics: [Utilization, Aspect_Ratio, IO_Count]
  risk_level: moderate
  typical_duration: "1-5 minutes"
---

# Stage 2: Floorplan (innovus)

## Overview

Define die area, place macros, and insert IO pins using Cadence Innovus.

**Tool**: `innovus` (physical design)

**Input**: Initialized design checkpoint from Stage 1

**Output**: `result/fp/design.enc`

**Duration**: ~1-5 minutes

## Prerequisites

- Stage 1 (Design Init) must be complete
- Input checkpoint: `result/init/design.enc`
- Technology LEF and cell LEFs loaded

## Tcl Template

Use template: `templates/cadence/innovus_floorplan.tcl`

## Manual Steps (if needed)

```tcl
# Load previous checkpoint
source result/init/design.enc

# Create floorplan
floorPlan -site <site_name> -s <width> <height> <utilization> <aspect_ratio>

# Place macros
placeMacros

# Insert IOs
loadIoFile <io_file>

# Save checkpoint
saveDesign result/fp/design.enc
```

## Success Criteria

- Floorplan created without errors
- Utilization target met (typically 70-80%)
- All macros placed
- IO pins inserted

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| High congestion | Utilization too high | Reduce target utilization |
| Macro overlap | Incorrect macro placement | Use `placeMacros` with constraints |
| IO spacing | Insufficient core area | Increase die size |
