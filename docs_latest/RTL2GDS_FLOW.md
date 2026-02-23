# RTL-to-GDS Flow Execution Guide

**Complete Physical Design Flow with HiPilot**

---

## Overview

This guide demonstrates how to execute a complete RTL-to-GDS flow using HiPilot skills and MCP commands. The flow has been validated on the Ibex RISC-V CPU design with Skywater 130nm technology.

---

## Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RTL-to-GDS Flow                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   RTL Verilog ──▶ Synthesis ──▶ Gate Netlist                            │
│        │              │              │                                  │
│        │              ▼              ▼                                  │
│        │         dc_shell      ibex_core.syn.v                          │
│        │                             │                                  │
│        └─────────────────────────────┼─────────────────────────────────▶│
│                                      │                                  │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │                    Innovus Place & Route                      │     │
│   │                                                              │     │
│   │  init_design ──▶ floorPlan ──▶ power_plan ──▶ placement      │     │
│   │       │              │              │              │          │     │
│   │       ▼              ▼              ▼              ▼          │     │
│   │   load netlist   define area   add stripes   place cells     │     │
│   │                                                              │     │
│   │  cts ──▶ post_cts_opt ──▶ routing ──▶ routing_opt ──▶ finish │     │
│   │   │           │              │            │            │     │     │
│   │   ▼           ▼              ▼            ▼            ▼     │     │
│   │ build tree  optimize     route nets   fix DRC    export      │     │
│   │                                                              │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                      │                                  │
│                                      ▼                                  │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │                        Signoff                                │     │
│   │                                                              │     │
│   │  PrimeTime STA ──▶ Calibre DRC ──▶ Calibre LVS              │     │
│   │                                                              │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                                                          │
│   Outputs: ibex_routing.def, ibex_routing.vg, ibex_core.gds             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Environment

| Requirement | Value |
|-------------|-------|
| EDA Server | 192.168.112.163 (CentOS 7) |
| Node.js | v20.18.3 (glibc-217 build) |
| Synthesis Tool | Design Compiler |
| P&R Tool | Innovus v20.10+ |
| STA Tool | PrimeTime T-2022.03 |
| Verification | Calibre |

### Design

| Attribute | Value |
|-----------|-------|
| Design | Ibex RISC-V CPU (RV32IMC) |
| Technology | Skywater 130nm HD |
| Target Frequency | 100 MHz (10ns period) |
| Expected Cells | ~7,000 instances |

---

## Flow Stages

### Stage 1: Synthesis

**Tool:** Design Compiler (dc_shell)

**Input:** RTL Verilog files
**Output:** Gate-level netlist (`ibex_core.syn.v`)

**Commands:**
```bash
# Run synthesis via Makefile
make syn
```

**Verification:**
```bash
ls -la result/syn/data/ibex_core.syn.v
```

**Expected Metrics:**
- WNS: > -0.5ns (acceptable for P&R)
- Cell count: ~12,000 cells
- Area: ~45,000 um²

---

### Stage 2: Design Initialization

**Tool:** Innovus

**Input:** Gate-level netlist, LEF files, MMMC setup
**Output:** Initialized design database

**MCP Commands:**
```bash
# Set auto mode for continuous execution
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'

# Initialize design
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "set defHierChar {/}; set init_gnd_net VSS; set init_pwr_net VDD; set init_verilog /home/EDA/hipilot_test/ibex_work_upload/result/syn/data/ibex_core.syn.v; set init_top_cell ibex_core; set init_lef_file [list /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]; set init_mmmc_file /home/EDA/hipilot_test/ibex_work_upload/scripts/pr/mmmc.view; init_design"
}'

# Save checkpoint
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/init_design.enc"
}'
```

**Verification:**
- Instance count: ~7,000
- Library loaded: sky130_fd_sc_hd

---

### Stage 3: Floorplan

**Tool:** Innovus

**Input:** Initialized design
**Output:** Floorplan with core area

**MCP Commands:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/init_design.enc; floorPlan -site unithd -su 1 0.4 1 1 1 1"
}'

bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/floor_plan.enc; defOut -floorplan -noStdCells /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex.floorplan.def"
}'
```

**Expected Output:**
- Die area created
- Core area defined
- Utilization: ~70%

---

### Stage 4: Power Planning

**Tool:** Innovus

**Input:** Floorplan
**Output:** Power grid with rings and stripes

**MCP Commands:**
```bash
# Connect global nets
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/floor_plan.enc; globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *; globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *; globalNetConnect VDD -type net -net VDD; globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *; globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *; globalNetConnect VSS -type net -net VSS"
}'

# Add power stripes
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1; addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1"
}'

# Route rails
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "sroute -connect {corePin} -layerChangeRange {li1 met4} -corePinTarget {none} -allowJogging 1 -crossoverViaLayerRange {li1 met4} -nets {VDD VSS} -allowLayerChange 1 -targetViaLayerRange {li1 met4}"
}'

# Save checkpoint
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/powerplan.enc"
}'
```

---

### Stage 5: Placement

**Tool:** Innovus

**Input:** Power plan
**Output:** Placed standard cells

**MCP Commands:**
```bash
# Set timing derates
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/powerplan.enc; set_timing_derate -early 0.97 -late 1.03 -clock; set_timing_derate -late 1.05 -data; setAnalysisMode -cppr both"
}'

# Run placement
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "setPlaceMode -reset; setPlaceMode -place_global_ignore_scan true; setPlaceMode -place_global_reorder_scan false; setPlaceMode -place_detail_legalization_inst_gap 2; place_opt_design"
}'

# Save checkpoint
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/placement.enc"
}'
```

**Expected Output:**
- Cells placed
- Pre-CTS timing analyzed
- Congestion acceptable

---

### Stage 6: Clock Tree Synthesis (CTS)

**Tool:** Innovus CCOpt

**Input:** Placed design
**Output:** Clock tree with buffers

**MCP Commands:**
```bash
# Setup CCOPT
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/placement.enc; set_ccopt_property use_inverters true; set_ccopt_property inverter_cells [get_lib_cells {sky130_fd_sc_hd__clkinv_1 sky130_fd_sc_hd__clkinv_2 sky130_fd_sc_hd__clkinv_4}]"
}'

# Run CTS
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "create_ccopt_clock_tree_spec -file /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/clk.spec; source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/clk.spec; ccopt_design -cts"
}'

# Save checkpoint
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/cts.enc"
}'
```

**Expected Output:**
- Clock skew: < 100ps
- Clock latency: < 500ps
- Buffer count: ~76

---

### Stage 7: Post-CTS Optimization

**Tool:** Innovus

**Input:** CTS design
**Output:** Optimized timing

**MCP Commands:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/cts.enc; set_interactive_constraint_modes [all_constraint_modes -active]; set_propagated_clock [all_clocks]; setOptMode -fixDrc true -fixFanoutLoad true; optDesign -postCTS; optDesign -postCTS -hold"
}'

bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/post_cts_opt.enc"
}'
```

---

### Stage 8: Routing

**Tool:** Innovus NanoRoute

**Input:** Optimized design
**Output:** Routed design

**MCP Commands:**
```bash
# Setup NanoRoute
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/post_cts_opt.enc; setNanoRouteMode -quiet -routeWithTimingDriven true; setAnalysisMode -analysisType onChipVariation; setNanoRouteMode -quiet -drouteEndIteration 70; setNanoRouteMode -quiet -drouteFixAntenna true; setNanoRouteMode -quiet -routeTopRoutingLayer 6; setNanoRouteMode -quiet -routeBottomRoutingLayer 2"
}'

# Route design (long operation ~5 minutes)
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "routeDesign -globalDetail"
}'

bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing.enc"
}'
```

**Expected Output:**
- 100% nets routed
- DRC violations minimized

---

### Stage 9: Post-Route Optimization

**Tool:** Innovus

**Input:** Routed design
**Output:** Final optimized design

**MCP Commands:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing.enc; optDesign -postRoute -setup"
}'

bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing_opt.enc"
}'
```

**Expected Output:**
- Setup WNS >= 0
- Hold WNS >= 0

---

### Stage 10: Chip Finish

**Tool:** Innovus

**Input:** Optimized routed design
**Output:** Final outputs (DEF, GDS, netlists)

**MCP Commands:**
```bash
# Cleanup
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing_opt.enc; remove_assigns -buffering; deleteDanglingNet; deleteEmptyModule; globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *; globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *; verifyConnectivity -type all -error 1000 -warning 50"
}'

# Export outputs
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "defOut -floorplan -netlist -routing /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_routing.def; saveNetlist /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_routing.vg; saveNetlist -excludeLeafCell -includePowerGround -flattenBus /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_lvs.vg"
}'
```

---

## Flow Verification

### Checkpoints Created

```bash
ls -la result/pr/data/*.enc
```

Expected output:
```
init_design.enc
floor_plan.enc
powerplan.enc
placement.enc
cts.enc
post_cts_opt.enc
routing.enc
routing_opt.enc
final.enc
```

### Output Files

```bash
ls -la result/pr/data/ibex*
```

Expected output:
```
ibex.floorplan.def
ibex_routing.def    (17 MB)
ibex_routing.vg     (1.7 MB)
ibex_lvs.vg         (1.9 MB)
```

### Innovus Command Log

```bash
cat result/pr/log/flow_*.cmd
```

Should show real commands executed:
```
restoreDesign cts.enc.dat ibex_core
set_propagated_clock [all_clocks]
optDesign -postCTS
routeDesign -globalDetail
optDesign -postRoute -setup
defOut ibex_routing.def
saveNetlist ibex_routing.vg
```

---

## Makefile Equivalence

| Makefile Target | HiPilot Skill | Evidence |
|-----------------|---------------|----------|
| `syn` | `/synthesis` | `result/syn/data/ibex_core.syn.v` |
| `init` | `/design-init` | `result/pr/data/init_design.enc` |
| `floorplan` | `/floorplan` | `result/pr/data/floor_plan.enc` |
| `power_plan` | `/power-planning` | `result/pr/data/powerplan.enc` |
| `placement` | `/placement` | `result/pr/data/placement.enc` |
| `cts` | `/cts` | `result/pr/data/cts.enc` |
| `post_cts_opt` | `/post-cts-opt` | `result/pr/data/post_cts_opt.enc` |
| `routing` | `/route-design` | `result/pr/data/routing.enc` |
| `routing_opt` | `/routing-opt` | `result/pr/data/routing_opt.enc` |
| `chip_done` | `/chip-finish` | `ibex_routing.def`, `ibex_routing.vg` |

---

## Common Issues

### Issue: Timing Not Met After Routing

**Solution:**
```bash
# Run additional optimization
optDesign -postRoute -setup -hold
```

### Issue: DRC Violations

**Solution:**
```bash
# Fix antenna violations
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt
```

### Issue: Connectivity Errors

**Solution:**
```bash
# Reconnect power nets
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
verifyConnectivity -type all
```

---

## Flow Time Estimates

| Stage | Duration |
|-------|----------|
| Synthesis | 5-10 min |
| Init | 1-2 min |
| Floorplan | 1-2 min |
| Power Plan | 1-2 min |
| Placement | 5-10 min |
| CTS | 3-5 min |
| Post-CTS Opt | 3-5 min |
| Routing | 5-10 min |
| Route Opt | 5-10 min |
| Chip Finish | 2-5 min |
| **Total** | **~30-50 min** |

---

## Evidence Files

All flow execution evidence is stored in:
```
e2e_evidence/20260223_complete_rtl2gds/
├── innovus_main.cmd      # Command log
├── innovus_main.log      # Full log
├── visual_evidence.mp4   # Screen recording
└── claude_code_pane.log  # Claude interaction
```

---

**Last Updated:** 2026-02-24
**Tested Design:** Ibex RISC-V CPU
**Technology:** Skywater 130nm HD
