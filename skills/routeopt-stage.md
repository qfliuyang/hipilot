---
name: routeopt-stage
description: >
  Stage 8: Route Optimization - Fix DRCs and optimize routed design.
  Post-route optimization to clean up DRCs and improve timing.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 8
  stage_name: "Route Opt"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/routing/design.enc"
  output_checkpoint: "result/routing_opt/design.enc"
  timeout: 1200
  prior_stages: ["routing"]
  triggers:
    - "stage 8"
    - "run routeopt"
    - "routeopt"
    - "route optimization"
  qor_metrics: [DRC_Count, WNS, TNS, Power]
  risk_level: moderate
  typical_duration: "10-30 minutes"
---

# Stage 8: Route Optimization (innovus)

## Overview

Fix DRC violations and optimize the routed design.

**Tool**: `innovus` (physical design)

**Input**: Routed design checkpoint from Stage 7

**Output**: `result/routing_opt/design.enc`

**Duration**: ~10-30 minutes

## Prerequisites

- Stage 7 (Routing) must be complete
- Input checkpoint: `result/routing/design.enc`
- Design fully routed

## Tcl Template

Use template: `templates/cadence/innovus_route_opt.tcl`

## Key Commands

```tcl
# Load previous checkpoint
source result/routing/design.enc

# Route optimization
optDesign -postRoute

# ECO routing for any remaining issues
ecoRoute

# Save checkpoint
saveDesign result/routing_opt/design.enc
```

## Success Criteria

- DRC count reduced to near-zero
- Timing maintained or improved
- Power optimized
- Design ready for final stage

## QoR Metrics to Report

- Final DRC count
- WNS after route opt
- TNS after route opt
- Leakage power
