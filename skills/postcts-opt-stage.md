---
name: postcts-opt-stage
description: >
  Stage 6: Post-CTS Optimization - Fix setup/hold violations after CTS.
  Runs post-CTS timing optimization to fix any new violations.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 6
  stage_name: "Post-CTS Opt"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/cts/design.enc"
  output_checkpoint: "result/post_cts_opt/design.enc"
  timeout: 900
  prior_stages: ["cts"]
  triggers:
    - "stage 6"
    - "run postcts-opt"
    - "postcts-opt"
    - "post cts optimization"
  qor_metrics: [WNS, TNS, Hold_Violations, Setup_Violations]
  risk_level: moderate
  typical_duration: "5-20 minutes"
---

# Stage 6: Post-CTS Optimization (innovus)

## Overview

Fix timing violations introduced by clock tree synthesis.

**Tool**: `innovus` (physical design)

**Input**: CTS design checkpoint from Stage 5

**Output**: `result/post_cts_opt/design.enc`

**Duration**: ~5-20 minutes

## Prerequisites

- Stage 5 (CTS) must be complete
- Input checkpoint: `result/cts/design.enc`
- Clock tree built

## Tcl Template

Use template: `templates/cadence/innovus_post_cts_opt.tcl`

## Key Commands

```tcl
# Load previous checkpoint
source result/cts/design.enc

# Post-CTS optimization
optDesign -postCTS -hold

# Save checkpoint
saveDesign result/post_cts_opt/design.enc
```

## Success Criteria

- All hold violations fixed
- Setup timing within 5% of pre-CTS
- No new critical paths

## QoR Metrics to Report

- WNS (before and after)
- TNS (before and after)
- Number of hold violations
- Setup violations remaining
