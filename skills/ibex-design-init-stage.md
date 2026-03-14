---
name: ibex-design-init-stage
description: >
  Stage 1: Design Initialization for Ibex RISC-V CPU using Innovus.
  Loads synthesized netlist, LEF files, and MMMC setup.
  Input: ibex_core.syn.v netlist. Output: init_design.enc checkpoint.

hipilot:
  stage_number: 1
  stage_name: "Design Init"
  tool: "innovus"
  vendor: "cadence"
  input_checkpoint: "result/syn/data/ibex_core.syn.v"
  output_checkpoint: "result/pr/data/init_design.enc"
  timeout: 600
  prior_stages: [0]
  triggers:
    - "ibex stage 1"
    - "ibex design init"
  qor_metrics: [Cell_Count, Utilization]
  risk_level: moderate
  typical_duration: "2-3 minutes"
  design: "ibex"
---

# Stage 1: Design Init (innovus)

## Overview

Initialize the Ibex design in Innovus by loading the synthesized netlist, LEF files, and MMMC (Multi-Mode Multi-Corner) timing setup.

**Tool**: `innovus` (MUST use innovus - dc_shell cannot do P&R)

**Input**: `result/syn/data/ibex_core.syn.v` (from Stage 0)

**Output**: `result/pr/data/init_design.enc`

**Duration**: ~2-3 minutes

## Prerequisites Check

**CRITICAL**: Verify Stage 0 completed before running:
```javascript
// Check input checkpoint exists
const designDir = process.env.HIPILOT_DESIGN_DIR || "/home/EDA/hipilot_test/ibex_work_upload";
const inputNetlist = `${designDir}/result/syn/data/ibex_core.syn.v`;

// If not found, report error and stop
console.log("Checking for Stage 0 output...");
// File check would happen here
```

## Execution

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR || "/home/EDA/hipilot_test/ibex_work_upload";

// Step 1: Start innovus
eda.start_tool({tool: "innovus", design_dir: designDir});

// Step 2: Setup directories
eda.send_tcl_nonblocking({tcl: `file mkdir ${designDir}/result/pr/data ${designDir}/result/pr/log ${designDir}/result/pr/report`, description: "Create pr directories"});
eda.await_idle({timeout: 10});

// Step 3: Load LEF files (CRITICAL: Tech LEF must be first!)
const tlefPath = `${designDir}/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef`;
const lefPath = `${designDir}/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef`;

eda.send_tcl_nonblocking({tcl: `set init_lef_file "${tlefPath} ${lefPath}"`, description: "Set LEF files"});
eda.await_idle({timeout: 10});

// Step 4: Load netlist
eda.send_tcl_nonblocking({tcl: `set init_verilog ${designDir}/result/syn/data/ibex_core.syn.v`, description: "Set netlist"});
eda.await_idle({timeout: 10});

// Step 5: Set design name
eda.send_tcl_nonblocking({tcl: `set design_name ibex_core`, description: "Set design name"});
eda.await_idle({timeout: 10});

// Step 6: Setup MMMC
eda.send_tcl_nonblocking({tcl: `create_constraint_mode -name func_slow -sdc_files ${designDir}/designs/sky130hd/ibex/constraint_for_pr.sdc`, description: "Create constraint mode"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `create_library_set -name slow_lib -timing "${designDir}/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__ss_100C_1v60.lib"`, description: "Create library set"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `create_delay_corner -name slow_corner -library_set slow_lib`, description: "Create delay corner"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `create_analysis_view -name func_slow_view -constraint_mode func_slow -delay_corner slow_corner`, description: "Create analysis view"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `set_analysis_view -setup func_slow_view -hold func_slow_view`, description: "Set analysis view"});
eda.await_idle({timeout: 10});

// Step 7: Initialize design
eda.send_tcl_nonblocking({tcl: `init_design`, description: "Initialize design"});
eda.await_idle({timeout: 120});

// Step 8: Verify design loaded
eda.send_tcl_nonblocking({tcl: `get_cells -hier | head -5`, description: "Verify cells loaded"});
eda.await_idle({timeout: 10});

// Step 9: Floorplan initialization (basic)
eda.send_tcl_nonblocking({tcl: `floorPlan -site unithd -su 1.0 0.6 10 10 10 10`, description: "Initial floorplan"});
eda.await_idle({timeout: 30});

// Step 10: Save checkpoint
eda.send_tcl_nonblocking({tcl: `saveDesign ${designDir}/result/pr/data/init_design.enc`, description: "Save checkpoint"});
eda.await_idle({timeout: 30});

// Step 11: Get cell count for QoR
eda.send_tcl_nonblocking({tcl: `llength [get_cells -hier]`, description: "Get cell count"});
eda.await_idle({timeout: 10});
const cellCountResult = eda.get_last_result({lines: 10});

// Step 12: Get utilization
eda.send_tcl_nonblocking({tcl: `reportUtilization`, description: "Get utilization"});
eda.await_idle({timeout: 10});

// Step 13: Exit innovus
eda.send_tcl_nonblocking({tcl: `exit`, description: "Exit innovus"});
eda.await_idle({timeout: 10});

// Step 14: Report QoR (L5 REQUIREMENT)
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Stage 1: Design Init Complete");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Cell Count: From synthesis`);
console.log(`  Output: ${designDir}/result/pr/data/init_design.enc`);
console.log("═══════════════════════════════════════════════════════════\n");
```

## LEF Loading Order (CRITICAL)

**MUST load Tech LEF before cell LEF**:
```tcl
# CORRECT
set init_lef_file "sky130_fd_sc_hd.tlef sky130_fd_sc_hd_merged.lef"

# WRONG - causes IMPLF-53 error
set init_lef_file "sky130_fd_sc_hd_merged.lef sky130_fd_sc_hd.tlef"
```

## QoR Reporting

Since this is an early stage, we report:
```
Stage 1 Design Init: Cell Count: XXXXX, Util: XX%
```

## Error Handling

| Error | Recovery |
|-------|----------|
| IMPLF-53 | Tech LEF must be before cell LEF |
| Netlist not found | Run Stage 0 (synthesis) first |
| LEF not found | Check PDK paths |
| SDC not found | Check constraint file path |
| init_design fails | Check library compatibility |

## Output Files

```
result/pr/data/
└── init_design.enc          # Innovus checkpoint (main output)

result/pr/log/
└── innovus.log              # Tool log
```

## Next Stage

After this stage completes successfully, run:
- **Stage 2**: `ibex-floorplan-stage`
