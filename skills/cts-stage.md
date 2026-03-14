---
name: cts-stage
description: >
  Stage 5: Clock Tree Synthesis - Build clock distribution network.
  Runs ccopt_design for clock tree synthesis and optimization.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 5
  stage_name: "CTS"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/placement/design.enc"
  output_checkpoint: "result/cts/design.enc"
  timeout: 1200
  prior_stages: ["placement"]
  triggers:
    - "stage 5"
    - "run cts"
    - "cts"
    - "clock tree"
  qor_metrics: [Clock_Skew, Max_Transition, Clock_Power, WNS]
  risk_level: high
  typical_duration: "10-45 minutes"
---

# Stage 5: Clock Tree Synthesis (innovus)

## Overview

Build clock tree distribution network using Cadence Innovus CCOpt.

**Tool**: `innovus` (physical design)

**Input**: Placed design checkpoint from Stage 4

**Output**: `result/cts/design.enc`

**Duration**: ~10-45 minutes

## Prerequisites

- Stage 4 (Placement) must be complete
- Input checkpoint: `result/placement/design.enc`
- Clock constraints defined in SDC

## Tcl Template

Use template: `templates/cadence/innovus_cts.tcl`

## Key Commands

```tcl
# Load previous checkpoint
source result/placement/design.enc

# Run clock tree synthesis
ccopt_design

# Save checkpoint
saveDesign result/cts/design.enc
```

## Success Criteria

- Clock tree built for all clocks
- Skew within specification
- Max transition constraints met
- No clock tree violations

## QoR Metrics to Report

- Global clock skew
- Max transition violations
- Clock power
- WNS after CTS
