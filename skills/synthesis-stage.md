---
name: synthesis-stage
description: >
  Stage 0: RTL Synthesis using Design Compiler or Genus.
  Synthesizes RTL Verilog into gate-level netlist.
  Design-independent: uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME env vars.

hipilot:
  stage_number: 0
  stage_name: "Synthesis"
  tool: "dc_shell"
  vendor: "synopsys"
  input_checkpoint: null
  output_checkpoint: "result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v"
  timeout: 600
  prior_stages: []
  triggers:
    - "stage 0"
    - "run synthesis"
    - "synthesis"
  qor_metrics: [WNS, TNS, Area, Cell_Count]
  risk_level: moderate
  typical_duration: "3-30 minutes"
---

# Stage 0: Synthesis (dc_shell)

## Overview

Synthesize RTL into a gate-level netlist using Synopsys Design Compiler.

**Tool**: `dc_shell` (MUST use dc_shell - Innovus cannot synthesize RTL)

**Input**: RTL files in `${HIPILOT_DESIGN_DIR}/rtl/`

**Output**: `${HIPILOT_DESIGN_DIR}/result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v`

**Duration**: ~3-30 minutes (depends on design size)

## Required Environment Variables

```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
export HIPILOT_DESIGN_NAME="my_design"
```

## Required Design Files

Your design directory must contain:

```
${HIPILOT_DESIGN_DIR}/
├── rtl/                      # RTL source files (*.v, *.sv)
├── constraints/              # Constraint files (*.sdc)
├── tech/                     # Technology files
│   ├── lib/                  # Liberty files (*.db, *.lib)
│   └── lef/                  # LEF files (for reference)
└── scripts/                  # Optional: setup.tcl
```

## Execution

```javascript
// Read design configuration from environment
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME;

if (!designDir || !designName) {
  console.error("ERROR: Set HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME");
  return { success: false };
}

// Paths (design-independent patterns)
const rtlDir = `${designDir}/rtl`;
const constraintDir = `${designDir}/constraints`;
const techDir = `${designDir}/tech`;
const resultDir = `${designDir}/result`;
const synDataDir = `${resultDir}/syn/data`;
const synLogDir = `${resultDir}/syn/log`;
const synRptDir = `${resultDir}/syn/report`;
const synWorkDir = `${resultDir}/syn/work`;

// Step 1: Start dc_shell
eda.start_tool({tool: "dc_shell", design_dir: designDir});

// Step 2: Setup directories
eda.send_tcl_nonblocking({tcl: `file mkdir ${synDataDir} ${synLogDir} ${synRptDir} ${synWorkDir}`, description: "Create directories"});
eda.await_idle({timeout: 10});

// Step 3: Setup design library
eda.send_tcl_nonblocking({tcl: `define_design_lib work -path ${synWorkDir}`, description: "Define design library"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `set sh_command_log_file ${synWorkDir}/command.log`, description: "Set command log"});
eda.await_idle({timeout: 10});

// Step 4: Load setup script if exists
eda.send_tcl_nonblocking({tcl: `if {[file exists ${designDir}/scripts/dc_setup.tcl]} { source ${designDir}/scripts/dc_setup.tcl }`, description: "Load setup"});
eda.await_idle({timeout: 10});

// Step 5: Setup libraries (from setup script or default)
// Users should define target_library and link_library in dc_setup.tcl
// Or we can auto-detect from tech/lib/

// Step 6: Read all RTL files
eda.send_tcl_nonblocking({tcl: `set rtl_files [glob ${rtlDir}/*.v ${rtlDir}/*.sv ${rtlDir}/*.vhd]`, description: "Find RTL files"});
eda.await_idle({timeout: 10});

// Analyze RTL
eda.send_tcl_nonblocking({tcl: `analyze -format sverilog $rtl_files`, description: "Analyze RTL"});
eda.await_idle({timeout: 60});

// Step 7: Elaborate design
eda.send_tcl_nonblocking({tcl: `elaborate ${designName}`, description: "Elaborate design"});
eda.await_idle({timeout: 60});

// Step 8: Link design
eda.send_tcl_nonblocking({tcl: `link`, description: "Link design"});
eda.await_idle({timeout: 30});

// Step 9: Apply constraints
eda.send_tcl_nonblocking({tcl: `source ${constraintDir}/${designName}.sdc`, description: "Source constraints"});
eda.await_idle({timeout: 10});

// Step 10: Compile
eda.send_tcl_nonblocking({tcl: `compile_ultra -gate_clock`, description: "Compile"});
eda.await_idle({timeout: 300});

// Step 11: Reports
eda.send_tcl_nonblocking({tcl: `report_timing > ${synRptDir}/timing.rpt`, description: "Report timing"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `report_area > ${synRptDir}/area.rpt`, description: "Report area"});
eda.await_idle({timeout: 10});

// Step 12: Get timing for QoR
eda.send_tcl_nonblocking({tcl: `report_timing -delay max -nworst 1`, description: "Get WNS"});
eda.await_idle({timeout: 10});

// Step 13: Write outputs
eda.send_tcl_nonblocking({tcl: `write -format verilog -hierarchy -output ${synDataDir}/${designName}.syn.v`, description: "Write netlist"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `write -format ddc -hierarchy -output ${synDataDir}/${designName}.syn.ddc`, description: "Write DDC"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `write_sdc ${synDataDir}/${designName}.syn.sdc`, description: "Write SDC"});
eda.await_idle({timeout: 10});

// Step 14: Exit
eda.send_tcl_nonblocking({tcl: `exit`, description: "Exit dc_shell"});
eda.await_idle({timeout: 10});

// Step 15: Report QoR (L5 REQUIREMENT)
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  Stage 0: Synthesis Complete - ${designName}`);
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Output: ${synDataDir}/${designName}.syn.v`);
console.log("  Check timing.rpt for WNS/TNS");
console.log("═══════════════════════════════════════════════════════════\n");
```

## Design Setup Script (Optional)

Create `${HIPILOT_DESIGN_DIR}/scripts/dc_setup.tcl`:

```tcl
# Library setup
set target_library "tech/lib/your_lib.db"
set link_library "* $target_library"

# Search path
set search_path ". rtl constraints tech/lib"

# Design variables
set design_name $env(HIPILOT_DESIGN_NAME)
```

## QoR Reporting (L5 Requirement)

After synthesis, check:
```bash
${HIPILOT_DESIGN_DIR}/result/syn/report/timing.rpt
```

Report format:
```
Stage 0 Synthesis: WNS: X.XXX ns, TNS: X.XXX ns
```

## Next Stage

After this stage completes, run:
- **Stage 1**: `design-init-stage`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Library not found | Check `tech/lib/` exists with .db files |
| RTL not found | Verify `rtl/` directory with .v/.sv files |
| Constraint error | Check SDC file in `constraints/` |
