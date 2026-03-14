---
name: powerplan-stage
description: >
  Stage 3: Power Planning - Create power grid and connect power nets.
  Builds the power distribution network (PDN) with rings and stripes.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 3
  stage_name: "Power Plan"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/fp/design.enc"
  output_checkpoint: "result/pp/design.enc"
  timeout: 600
  prior_stages: ["floorplan"]
  triggers:
    - "stage 3"
    - "run powerplan"
    - "powerplan"
    - "power planning"
  qor_metrics: [IR_Drop, EM_Violations, Power_Routing]
  risk_level: moderate
  typical_duration: "2-10 minutes"
---

# Stage 3: Power Planning (innovus)

## Overview

Create power distribution network with rings, stripes, and connections.

**Tool**: `innovus` (physical design)

**Input**: Floorplan checkpoint from Stage 2

**Output**: `result/pp/design.enc`

**Duration**: ~2-10 minutes

## Prerequisites

- Stage 2 (Floorplan) must be complete
- Input checkpoint: `result/fp/design.enc`
- Floorplan defined
- Power nets defined (VDD, VSS)

## Tcl Template

Use template: `templates/cadence/innovus_powerplan.tcl`

## Key Commands

```tcl
# Load previous checkpoint
source result/fp/design.enc

# Connect power nets
globalNetConnect VDD -type pgpin -pin VDD -inst *
globalNetConnect VSS -type pgpin -pin VSS -inst *

# Add power rings
addRing -nets {VDD VSS} -width 2 -spacing 1 -layer {met4 met5}

# Add power stripes
addStripe -nets {VDD VSS} -set_to_set_distance 20 -width 1 -layer met5

# Route power
sroute -nets {VDD VSS}

# Save checkpoint
saveDesign result/pp/design.enc
```

## Success Criteria

- Power rings created
- Stripes distributed
- Standard cells connected to power
- No power shorts/opens

## QoR Metrics to Report

- IR drop estimate
- EM violations (if checked)
- Power routing coverage
