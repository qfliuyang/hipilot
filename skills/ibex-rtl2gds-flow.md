---
name: ibex-rtl2gds-flow
description: >
  Complete RTL2GDS flow for Ibex design using Claude Code and MCP.
  Replicates the original Makefile-based flow with skills.
  Stages: Init → Floorplan → Power → Placement → CTS → Post-CTS Opt → Routing → Routing Opt → Chip Done

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus, voltus]
    synopsys: [dc_shell, pt_shell]
  flow_stages: [init, floorplan, power, placement, cts, routing, signoff]
  triggers:
    - "run rtl2gds"
    - "ibex flow"
    - "complete flow"
    - "run_all"
  qor_metrics: [WNS, TNS, Area, Power, DRC_Violations]
  risk_level: high
  typical_duration: "30-60 minutes"
---

# Ibex RTL2GDS Flow - Complete Skill

## Overview

This skill replicates the original Ibex RTL2GDS Makefile flow using Claude Code and MCP commands. The flow consists of:

```
Synthesis (dc_shell) → PR (Innovus) → STA (pt_shell) → Verification (Calibre)
```

## Environment Setup

Before starting, Claude Code must set environment variables via MCP:

```bash
# Set MCP to auto mode
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'
```

### Required Environment Variables

```bash
# Design paths
export RESULT_DIR=/home/EDA/hipilot_test/ibex_work_upload/result
export DESIGN_NAME=ibex_core
export SCRIPTS_DIR=/home/EDA/hipilot_test/ibex_work_upload/scripts

# PDK paths
export LEF_FILES="/home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef"

# For MMMC
export LIB_FILES=/home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib

# SDC
export SDC_FILE=/home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc

# Floorplan
export PLACE_DENSITY=0.4
export PLACE_SITE=unithd

# CTS
export CTS_INV_CELL="sky130_fd_sc_hd__clkinv_1 sky130_fd_sc_hd__clkinv_2 sky130_fd_sc_hd__clkinv_4"
export CTS_ROUTING_MUL=2

# Routing
export MIN_ROUTING_LAYER=2
export MAX_ROUTING_LAYER=6
```

## Flow Stages

### Stage 1: Design Initialization

**MCP Command:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "set defHierChar {/}; set init_gnd_net VSS; set init_pwr_net VDD; set init_verilog /home/EDA/hipilot_test/ibex_work_upload/result/syn/data/ibex_core.syn.v; set init_top_cell ibex_core; set init_lef_file [list /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]; set init_mmmc_file /home/EDA/hipilot_test/ibex_work_upload/scripts/pr/mmmc.view; init_design"
}'
```

**Expected Output:**
- Instance count: ~7000
- Library loaded: sky130_fd_sc_hd

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/init_design.enc"
}'
```

---

### Stage 2: Floorplan

**MCP Command:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/init_design.enc; floorPlan -site unithd -su 1 0.4 1 1 1 1"
}'
```

**Expected Output:**
- Die area created
- Core area defined

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/floor_plan.enc; defOut -floorplan -noStdCells /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex.floorplan.def"
}'
```

---

### Stage 3: Power Planning

**MCP Command:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/floor_plan.enc; globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *; globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *; globalNetConnect VDD -type net -net VDD; globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *; globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *; globalNetConnect VSS -type net -net VSS"
}'
```

**Add Power Stripes:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1; addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1"
}'
```

**Add Power Rails:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "sroute -connect {corePin} -layerChangeRange {li1 met4} -corePinTarget {none} -allowJogging 1 -crossoverViaLayerRange {li1 met4} -nets {VDD VSS} -allowLayerChange 1 -targetViaLayerRange {li1 met4}"
}'
```

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/powerplan.enc"
}'
```

---

### Stage 4: Placement

**Set Timing Derate:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/powerplan.enc; set_timing_derate -early 0.97 -late 1.03 -clock; set_timing_derate -late 1.05 -data; setAnalysisMode -cppr both"
}'
```

**Place Design:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "setPlaceMode -reset; setPlaceMode -place_global_ignore_scan true; setPlaceMode -place_global_reorder_scan false; setPlaceMode -place_detail_legalization_inst_gap 2; place_opt_design"
}'
```

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/placement.enc"
}'
```

---

### Stage 5: Clock Tree Synthesis (CTS)

**Setup CCOPT:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/placement.enc; set_ccopt_property use_inverters true; set_ccopt_property inverter_cells [get_lib_cells {sky130_fd_sc_hd__clkinv_1 sky130_fd_sc_hd__clkinv_2 sky130_fd_sc_hd__clkinv_4}]"
}'
```

**Run CTS:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "create_ccopt_clock_tree_spec -file /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/clk.spec; source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/clk.spec; ccopt_design -cts"
}'
```

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/cts.enc"
}'
```

---

### Stage 6: Post-CTS Optimization

**MCP Command:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/cts.enc; set_interactive_constraint_modes [all_constraint_modes -active]; set_propagated_clock [all_clocks]; setOptMode -fixDrc true -fixFanoutLoad true; optDesign -postCTS; optDesign -postCTS -hold"
}'
```

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/post_cts_opt.enc"
}'
```

---

### Stage 7: Routing

**Setup NanoRoute:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/post_cts_opt.enc; setNanoRouteMode -quiet -routeWithTimingDriven true; setAnalysisMode -analysisType onChipVariation; setNanoRouteMode -quiet -drouteEndIteration 70; setNanoRouteMode -quiet -drouteFixAntenna true; setNanoRouteMode -quiet -routeTopRoutingLayer 6; setNanoRouteMode -quiet -routeBottomRoutingLayer 2"
}'
```

**Route Design:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "routeDesign -globalDetail"
}'
```

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing.enc"
}'
```

---

### Stage 8: Routing Optimization

**MCP Command:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing.enc; optDesign -postRoute -setup"
}'
```

**Save Checkpoint:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing_opt.enc"
}'
```

---

### Stage 9: Chip Finish

**Cleanup and Output:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing_opt.enc; remove_assigns -buffering; deleteDanglingNet; deleteEmptyModule; globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *; globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *; verifyConnectivity -type all -error 1000 -warning 50"
}'
```

**Output Files:**
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "defOut -floorplan -netlist -routing /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_routing.def; saveNetlist /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_routing.vg; saveNetlist -excludeLeafCell -includePowerGround -flattenBus /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_lvs.vg; streamOut /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_core.gds -mapFile /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL"
}'
```

---

## Complete Flow Script

Run the entire flow with this single prompt:

```
Execute the complete Ibex RTL2GDS flow using MCP commands.

Start Innovus with logging:
innovus -nowin -log /home/EDA/hipilot_test/ibex_work_upload/result/pr/log/flow.log

Then execute each stage:
1. init_design (load netlist, LEF, MMMC)
2. floorPlan -site unithd -su 1 0.4 1 1 1 1
3. Power planning (globalNetConnect, addStripe, sroute)
4. place_opt_design
5. CTS (create_ccopt_clock_tree_spec, ccopt_design -cts)
6. Post-CTS opt (optDesign -postCTS, optDesign -postCTS -hold)
7. routeDesign -globalDetail
8. optDesign -postRoute -setup
9. Output files (defOut, saveNetlist, streamOut)

Save checkpoints after each stage.
```

## QoR Metrics to Track

| Stage | Key Metrics |
|-------|-------------|
| Init | Instance count, Library status |
| Floorplan | Die area, Utilization |
| Placement | Congestion, Pre-CTS WNS/TNS |
| CTS | Clock skew, Post-CTS WNS/TNS |
| Routing | DRC violations, Post-route WNS/TNS |
| Final | Total area, Power, DRC clean |

## Flow Stage Skills

| Stage | Skill | Description |
|-------|-------|-------------|
| Synthesis | `/synthesis` | RTL synthesis with DC |
| Init | `/design-init` | Load design into Innovus |
| Floorplan | `/floorplan` | Die/core area and IO placement |
| Power | `/power-planning` | Power grid creation |
| Placement | `/placement` | Standard cell placement |
| CTS | `/cts` | Clock tree synthesis |
| Post-CTS Opt | `/post-cts-opt` | Setup/hold optimization |
| Routing | `/route-design` | Global and detail routing |
| Route Opt | `/routing-opt` | Post-route optimization |
| Chip Finish | `/chip-finish` | DEF/GDS/netlist export |
| STA | `/sta` | PrimeTime signoff |
| Verification | `/verification` | DRC/LVS |

## Quick Skill Reference

- `/synthesis` - RTL synthesis with Design Compiler
- `/design-init` - Initialize design in Innovus
- `/floorplan` - Create floorplan
- `/power-planning` - Create power grid
- `/placement` - Place standard cells
- `/cts` - Build clock tree
- `/post-cts-opt` - Optimize timing after CTS
- `/route-design` - Route design
- `/routing-opt` - Post-route optimization
- `/chip-finish` - Export final outputs
- `/sta` - PrimeTime timing signoff
- `/verification` - DRC/LVS verification
- `/report-timing` - Timing analysis
- `/save-design` - Save checkpoint
