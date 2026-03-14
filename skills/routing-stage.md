---
name: routing-stage
description: >
  Stage 7: Routing - Route all nets using nanoRoute.
  Completes detailed routing of all signal nets.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 7
  stage_name: "Routing"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/post_cts_opt/design.enc"
  output_checkpoint: "result/routing/design.enc"
  timeout: 1800
  prior_stages: ["post_cts_opt"]
  triggers:
    - "stage 7"
    - "run routing"
    - "routing"
  qor_metrics: [Route_DRC, Antenna_Violations, WNS, TNS]
  risk_level: high
  typical_duration: "15-60 minutes"
---

# Stage 7: Routing (innovus)

## Overview

Route all signal nets using Cadence Innovus nanoRoute.

**Tool**: `innovus` (physical design)

**Input**: Post-CTS optimized checkpoint from Stage 6

**Output**: `result/routing/design.enc`

**Duration**: ~15-60 minutes

## Prerequisites

- Stage 6 (Post-CTS Opt) must be complete
- Input checkpoint: `result/post_cts_opt/design.enc`
- Clock tree optimized

## Tcl Template

Use template: `templates/cadence/innovus_routing.tcl`

## Key Commands

```tcl
# Load previous checkpoint
source result/post_cts_opt/design.enc

# Route design
routeDesign

# Save checkpoint
saveDesign result/routing/design.enc
```

## Success Criteria

- 100% nets routed
- DRC violations within repairable range
- No major antenna violations
- Timing preserved

## QoR Metrics to Report

- Route DRC count
- Antenna violations
- WNS after routing
- TNS after routing
