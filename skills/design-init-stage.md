---
name: design-init-stage
description: >
  Stage 1: Design Initialization using Innovus.
  Loads synthesized netlist, LEF files, and MMMC setup.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 1
  stage_name: "Design Init"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v"
  output_checkpoint: "result/pr/data/init_design.enc"
  timeout: 600
  prior_stages: [0]
  triggers:
    - "stage 1"
    - "design init"
    - "init design"
  qor_metrics: [Cell_Count, Utilization]
  risk_level: moderate
  typical_duration: "2-5 minutes"
---

# Stage 1: Design Init (innovus)

## Overview

Initialize the design in Innovus by loading the synthesized netlist, LEF files, and MMMC timing setup.

**Tool**: `innovus`

**Input**: `${HIPILOT_DESIGN_DIR}/result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v`

**Output**: `${HIPILOT_DESIGN_DIR}/result/pr/data/init_design.enc`

**Duration**: ~2-5 minutes

## Prerequisites

**Stage 0 must complete first** (synthesis produces netlist)

## Required Environment Variables

```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
export HIPILOT_DESIGN_NAME="my_design"
```

## Required Design Files

```
${HIPILOT_DESIGN_DIR}/
├── result/syn/data/
│   └── ${HIPILOT_DESIGN_NAME}.syn.v    # From Stage 0
├── tech/
│   ├── lef/                            # LEF files (*.lef, *.tlef)
│   └── lib/                            # Liberty files (*.lib)
└── constraints/
    └── ${HIPILOT_DESIGN_NAME}.sdc      # Constraints for P&R
```

## Execution

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME;

// Check prerequisites
const netlist = `${designDir}/result/syn/data/${designName}.syn.v`;
console.log(`Loading netlist: ${netlist}`);

// Start innovus
eda.start_tool({tool: "innovus", design_dir: designDir});

// Setup directories
eda.send_tcl_nonblocking({tcl: `file mkdir ${designDir}/result/pr/data ${designDir}/result/pr/log ${designDir}/result/pr/report`, description: "Create directories"});
eda.await_idle({timeout: 10});

// Load LEF files (CRITICAL: Tech LEF first!)
eda.send_tcl_nonblocking({tcl: `set lef_files [glob ${designDir}/tech/lef/*.tlef ${designDir}/tech/lef/*.lef]`, description: "Find LEF files"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `set init_lef_file $lef_files`, description: "Set LEF files"});
eda.await_idle({timeout: 10});

// Load netlist
eda.send_tcl_nonblocking({tcl: `set init_verilog ${netlist}`, description: "Set netlist"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `set design_name ${designName}`, description: "Set design name"});
eda.await_idle({timeout: 10});

// Setup MMMC
eda.send_tcl_nonblocking({tcl: `create_constraint_mode -name func -sdc_files ${designDir}/constraints/${designName}.sdc`, description: "Create constraint mode"});
eda.await_idle({timeout: 10});

// Initialize design
eda.send_tcl_nonblocking({tcl: `init_design`, description: "Initialize design"});
eda.await_idle({timeout: 120});

// Save checkpoint
eda.send_tcl_nonblocking({tcl: `saveDesign ${designDir}/result/pr/data/init_design.enc`, description: "Save checkpoint"});
eda.await_idle({timeout: 30});

// Exit
eda.send_tcl_nonblocking({tcl: `exit`, description: "Exit innovus"});
eda.await_idle({timeout: 10});

// Report
console.log(`\nStage 1 Complete: ${designDir}/result/pr/data/init_design.enc`);
```

## LEF Loading Order

**MUST load Tech LEF (.tlef) before cell LEF (.lef)**

## Next Stage

- **Stage 2**: `floorplan-stage`
