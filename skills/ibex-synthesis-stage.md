---
name: ibex-synthesis-stage
description: >
  Stage 0: RTL Synthesis for Ibex RISC-V CPU using Design Compiler.
  Synthesizes RTL Verilog into gate-level netlist with DFT scan chain insertion.
  Input: RTL Verilog files. Output: ibex_core.syn.v netlist.

hipilot:
  stage_number: 0
  stage_name: "Synthesis"
  tool: "dc_shell"
  vendor: "synopsys"
  input_checkpoint: null
  output_checkpoint: "result/syn/data/ibex_core.syn.v"
  timeout: 600
  prior_stages: []
  triggers:
    - "ibex stage 0"
    - "ibex synthesis"
  qor_metrics: [WNS, TNS, Area, Cell_Count]
  risk_level: moderate
  typical_duration: "3-5 minutes"
  design: "ibex"
---

# Stage 0: Synthesis (dc_shell)

## Overview

Synthesize Ibex RISC-V RTL into a gate-level netlist using Synopsys Design Compiler.

**Tool**: `dc_shell` (MUST use dc_shell - Innovus cannot synthesize RTL)

**Input**: RTL Verilog files in `designs/src/ibex/`

**Output**: `result/syn/data/ibex_core.syn.v`

**Duration**: ~3-5 minutes

## Execution

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR || "/home/EDA/hipilot_test/ibex_work_upload";

// Step 1: Start dc_shell
eda.start_tool({tool: "dc_shell", design_dir: designDir});

// Step 2: Setup directories
eda.send_tcl_nonblocking({tcl: `file mkdir ${designDir}/result/syn/data ${designDir}/result/syn/log ${designDir}/result/syn/report ${designDir}/result/syn/work`, description: "Create syn directories"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `file mkdir ${designDir}/result/scanchain/data ${designDir}/result/scanchain/report ${designDir}/result/scanchain/log`, description: "Create scanchain directories"});
eda.await_idle({timeout: 10});

// Step 3: Setup design library
eda.send_tcl_nonblocking({tcl: `define_design_lib work -path ${designDir}/result/syn/work`, description: "Define design library"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `set sh_command_log_file ${designDir}/result/syn/work/command.log`, description: "Set command log"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `set_app_var alib_library_analysis_path ${designDir}/result/syn/work`, description: "Set alib path"});
eda.await_idle({timeout: 10});

// Step 4: Setup libraries
const techLib = `${designDir}/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db`;
eda.send_tcl_nonblocking({tcl: `set target_library "${techLib}"`, description: "Set target library"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `set link_library "* ${techLib}"`, description: "Set link library"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `lappend link_library {dw_foundation.sldb}`, description: "Add dw foundation"});
eda.await_idle({timeout: 10});

// Step 5: Read RTL
const rtlFiles = [
  "ibex_alu.sv", "ibex_branch_predict.sv", "ibex_compressed_decoder.sv",
  "ibex_controller.sv", "ibex_core.sv", "ibex_counter.sv",
  "ibex_csr.sv", "ibex_cs_registers.sv", "ibex_decoder.sv",
  "ibex_dummy_instr.sv", "ibex_ex_block.sv", "ibex_fetch_fifo.sv",
  "ibex_icache.sv", "ibex_id_stage.sv", "ibex_if_stage.sv",
  "ibex_load_store_unit.sv", "ibex_lockstep.sv", "ibex_multdiv_fast.sv",
  "ibex_multdiv_slow.sv", "ibex_pmp.sv", "ibex_prefetch_buffer.sv",
  "ibex_register_file_ff.sv", "ibex_register_file_fpga.sv",
  "ibex_register_file_latch.sv", "ibex_top.sv", "ibex_top_tracking.sv",
  "ibex_tracer.sv", "ibex_tracer_pkg.sv", "ibex_wb_stage.sv",
  "prim_buf.sv", "prim_clock_gating.sv", "prim_flop.sv",
  "prim_generic_buf.sv", "prim_generic_clock_gating.sv",
  "prim_generic_flop.sv", "prim_pkg.sv", "prim_secded_pkg.sv",
  "prim_secded_28_22_dec.sv", "prim_secded_28_22_enc.sv",
  "prim_secded_39_32_dec.sv", "prim_secded_39_32_enc.sv",
  "prim_secded_72_64_dec.sv", "prim_secded_72_64_enc.sv"
];

// Analyze RTL files
eda.send_tcl_nonblocking({tcl: `set search_path "${designDir}/designs/src/ibex ${designDir}/designs/src/lowrisc_prim ${designDir}/designs/src/lowrisc_prim_abstract"`, description: "Set search path"});
eda.await_idle({timeout: 10});

// Analyze each file
for (const file of rtlFiles) {
  eda.send_tcl_nonblocking({tcl: `analyze -format sverilog ${file}`, description: `Analyze ${file}`});
  eda.await_idle({timeout: 30});
}

// Step 6: Elaborate design
eda.send_tcl_nonblocking({tcl: `elaborate ibex_core`, description: "Elaborate ibex_core"});
eda.await_idle({timeout: 60});

// Step 7: Link design
eda.send_tcl_nonblocking({tcl: `link`, description: "Link design"});
eda.await_idle({timeout: 30});

// Step 8: Apply constraints
eda.send_tcl_nonblocking({tcl: `source ${designDir}/designs/sky130hd/ibex/constraint.sdc`, description: "Source constraints"});
eda.await_idle({timeout: 10});

// Step 9: Set optimization constraints
eda.send_tcl_nonblocking({tcl: `set_max_area 0`, description: "Set max area"});
eda.await_idle({timeout: 10});

// Step 10: Compile
eda.send_tcl_nonblocking({tcl: `compile_ultra -gate_clock`, description: "Compile ultra"});
eda.await_idle({timeout: 300}); // Longest step

// Step 11: DFT - Insert scan chain
eda.send_tcl_nonblocking({tcl: `set_dft_signal -view existing_dft -type ScanClock -port clk_i -timing [list 45 55]`, description: "Set DFT clock"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `create_test_protocol -infer_clock -infer_async`, description: "Create test protocol"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `dft_drc`, description: "DFT DRC"});
eda.await_idle({timeout: 30});

eda.send_tcl_nonblocking({tcl: `preview_dft`, description: "Preview DFT"});
eda.await_idle({timeout: 30});

eda.send_tcl_nonblocking({tcl: `insert_dft`, description: "Insert DFT"});
eda.await_idle({timeout: 60});

// Step 12: Reports
eda.send_tcl_nonblocking({tcl: `report_timing > ${designDir}/result/syn/report/timing.rpt`, description: "Report timing"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `report_area > ${designDir}/result/syn/report/area.rpt`, description: "Report area"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `report_power > ${designDir}/result/syn/report/power.rpt`, description: "Report power"});
eda.await_idle({timeout: 10});

// Step 13: Extract QoR for L5 reporting
eda.send_tcl_nonblocking({tcl: `report_timing -delay max -nworst 1`, description: "Get WNS"});
eda.await_idle({timeout: 10});
const timingResult = eda.get_last_result({lines: 50});

// Parse WNS from timing report
const wnsMatch = timingResult.output.match(/Data\s+Required\s+Time.*\n.*\n.*Slack\s*\(\w+\)\s+([\-\d\.]+)/);
const wns = wnsMatch ? wnsMatch[1] : "N/A";

// Step 14: Write outputs
eda.send_tcl_nonblocking({tcl: `write -format verilog -hierarchy -output ${designDir}/result/syn/data/ibex_core.syn.v`, description: "Write netlist"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `write -format ddc -hierarchy -output ${designDir}/result/syn/data/ibex_core.syn.ddc`, description: "Write DDC"});
eda.await_idle({timeout: 10});

eda.send_tcl_nonblocking({tcl: `write_sdc ${designDir}/result/syn/data/ibex_core.syn.sdc`, description: "Write SDC"});
eda.await_idle({timeout: 10});

// Step 15: Exit dc_shell
eda.send_tcl_nonblocking({tcl: `exit`, description: "Exit dc_shell"});
eda.await_idle({timeout: 10});

// Step 16: Report QoR (L5 REQUIREMENT)
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Stage 0: Synthesis Complete");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  WNS: ${wns} ns`);
console.log(`  Output: ${designDir}/result/syn/data/ibex_core.syn.v`);
console.log("═══════════════════════════════════════════════════════════\n");

// Verify checkpoint exists
// (Actual verification would check file existence)
```

## Tcl Syntax Notes (CRITICAL)

When sending Tcl commands to dc_shell, you MUST use proper Tcl syntax:

### ❌ WRONG - Shell pipes do NOT work in dc_shell
```tcl
report_qor | tee qor.rpt
report_timing | head -30
```

### ✅ CORRECT - Tcl redirection only
```tcl
report_qor > qor.rpt
report_timing -max_paths 10 > timing.rpt
```

**NO shell pipes (`|`), NO `tee`, NO `head` inside dc_shell!**

## QoR Reporting (L5 Requirement)

**CRITICAL**: Report timing in this exact format:
```
Stage 0 Synthesis: WNS: X.XXX ns
```

The HiTestBot L5 scorer looks for: `WNS[:\s]*([\-\d\.]+)`

## Error Handling

| Error | Recovery |
|-------|----------|
| Library not found | Check `designs/sky130hd/pdk/lib/` exists |
| RTL syntax error | Check specific file in error message |
| Constraint violation | Review SDC file |
| Link failure | Check all files analyzed successfully |

## Output Files

```
result/syn/data/
├── ibex_core.syn.v          # Gate-level netlist (main output)
├── ibex_core.syn.ddc        # Design Compiler database
└── ibex_core.syn.sdc        # Constraints

result/syn/report/
├── timing.rpt               # Timing report (for QoR)
├── area.rpt                 # Area report
└── power.rpt                # Power report
```

## Prerequisites

- RTL files in `designs/src/ibex/`
- Technology library: `sky130_fd_sc_hd__tt_025C_1v80.db`
- Constraint file: `designs/sky130hd/ibex/constraint.sdc`

## Next Stage

After this stage completes successfully, run:
- **Stage 1**: `ibex-design-init-stage`
