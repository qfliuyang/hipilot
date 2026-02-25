---
name: ibex-rtl2gds-flow
description: >
  Complete RTL2GDS flow for Ibex design using Claude Code and MCP only.
  NO Makefile required - all scripts are self-contained with absolute paths.
  Stages: Synthesis → Init → Floorplan → Power → Placement → CTS → Post-CTS → Routing → RouteOpt → ChipDone

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [dc_shell, pt_shell]
  flow_stages: [synthesis, init, floorplan, power, placement, cts, postroute, signoff]
  triggers:
    - "run rtl2gds"
    - "ibex flow"
    - "complete flow"
    - "run_all_stages"
  qor_metrics: [WNS, TNS, Area, Power, DRC_Violations]
  risk_level: high
  typical_duration: "45-90 minutes"
---

# Ibex RTL2GDS Flow - Complete Skill (No Makefile)

## Overview

This skill executes the complete Ibex RTL2GDS flow using ONLY:
- Claude Code commands
- MCP tool calls
- tmux for terminal control

**NO Makefile, NO environment variables, NO pre-existing scripts.**

All Tcl scripts are generated inline with hardcoded absolute paths.

## Recommended HiPilot usage (MCP + skills only)

When running on the EDA server with HiPilot (Claude Code + MCP), prefer the **builtin rtl2gds workflow tools** instead of SSH shell scripts:

- **Stage 0: Start EDA tool (if not running)** — Before any flow, ensure Innovus is running in the right pane:
  - Call `eda.detect_tool`. If no tool detected → `eda.start_tool({"tool":"innovus","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`
  - This lets the user run `bin/hipilot` and type `/rtl2gds` without manually starting Innovus.

- **Full P&R flow (Innovus) from the current design context:**

```bash
# Convenience RTL2GDS tool (ensures Innovus is running first)
eda.rtl2gds.run_full_flow {"design":"ibex"}

# Equivalent generic workflow API
eda.workflow.run {"name":"rtl2gds","params":{"design":"ibex"}}
```

- **Single-stage reruns (for debug / incremental improvement):**

```bash
eda.rtl2gds.run_stage {"stage":"design_init","design":"ibex"}
eda.rtl2gds.run_stage {"stage":"floorplan","design":"ibex"}
eda.rtl2gds.run_stage {"stage":"placement","design":"ibex"}
eda.rtl2gds.run_stage {"stage":"cts","design":"ibex"}
eda.rtl2gds.run_stage {"stage":"routing","design":"ibex"}
eda.rtl2gds.run_stage {"stage":"chip_finish","design":"ibex"}
```

HiPilot should use this skill as the **methodology reference** for how to structure each stage, but execute commands via the MCP tools above (`workflow.run`, `rtl2gds.run_full_flow`, and `rtl2gds.run_stage`), not by sourcing monolithic flow scripts.

## Workspace

```
EDA Server: 192.168.112.163
User: EDA / Password: eda2020
Workspace: /home/EDA/hipilot_test/ibex_work_upload
Design: ibex_core (RISC-V CPU)
Technology: Skywater 130nm HD
```

## Quick Start (legacy standalone shell flow)

Run the complete flow with a single command sequence:

```bash
# 1. SSH and kill stale processes
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'pkill -f "innovus|dc_shell|ffmpeg" 2>/dev/null || true'

# 2. Create all Tcl scripts (see stages below)
# ... create each mcp_*.tcl file ...

# 3. Start recording and run full flow
sshpass -p 'eda2020' ssh EDA@192.168.112.163 '
cd /home/EDA/hipilot_test/ibex_work_upload
/home/EDA/hipilot_test/start_recording.sh "ibex_mcp_flow"
innovus -no_gui -files mcp_full_flow.tcl -log result/pr/log/mcp_full_flow.log
/home/EDA/hipilot_test/stop_recording.sh
'
```

---

## Stage 1: Design Init + MMMC Setup

**CRITICAL:** MMMC must be set up BEFORE `init_design` for timing-driven flow.

### Create Init Tcl Script

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_init.tcl << '\''EOF'\''
# MCP Init Script - All paths hardcoded
puts "=========================================="; puts "MCP Init: Starting"; puts "=========================================="
cd /home/EDA/hipilot_test/ibex_work_upload

# LEF Files
set init_lef_file {
    /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef
    /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef
}

# Netlist
set init_verilog /home/EDA/hipilot_test/ibex_work_upload/result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_gnd_net VSS
set init_pwr_net VDD

# MMMC Setup (BEFORE init_design!)
create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05
create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1
create_library_set -name lib_set_max -timing /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
create_library_set -name lib_set_min -timing /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
create_constraint_mode -name common -sdc_files /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc
create_delay_corner -name delay_max -library_set {lib_set_max} -rc_corner {rc_max}
create_delay_corner -name delay_min -library_set {lib_set_min} -rc_corner {rc_min}
create_analysis_view -name max_view -constraint_mode {common} -delay_corner {delay_max}
create_analysis_view -name min_view -constraint_mode {common} -delay_corner {delay_min}
set_analysis_view -setup {max_view} -hold {min_view}

# Initialize
init_design
checkDesign -netList -noHtml -outfile /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/check_init.report
timeDesign -prePlace -pathReports -drvReports -slackReports -numPaths 50 -prefix prePlace -outDir /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/init_timing
saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/init.enc
puts "Stage Complete: Init"; puts "=========================================="
EOF'
```

---

## Stage 2: Floorplan

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_floorplan.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP Floorplan: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/init.enc

floorPlan -site unithd -su 1 0.4 1 1 1 1
if {[file exists /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/ibex/io.file]} {
    loadIoFile /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/ibex/io.file
}

saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/floorplan.enc
defOut -floorplan -noStdCells /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/floorplan.def
puts "Stage Complete: Floorplan"; puts "=========================================="
EOF'
```

---

## Stage 3: Power Planning

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_power.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP Power: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/floorplan.enc

globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS

addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1
addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1

sroute -connect {corePin} -layerChangeRange {li1 met4} -corePinTarget {none} -allowJogging 1 -crossoverViaLayerRange {li1 met4} -nets {VDD VSS} -allowLayerChange 1 -targetViaLayerRange {li1 met4}

verifyConnectivity -type special -noAntenna -noWeakConnect -noUnroutedNet -error 1000 -warning 50
saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/power.enc
puts "Stage Complete: Power"; puts "=========================================="
EOF'
```

---

## Stage 4: Placement

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_placement.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP Placement: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/power.enc

if {[file exists /home/EDA/hipilot_test/ibex_work_upload/result/scanchain/data/ibex_core.scan.def]} {
    defIn /home/EDA/hipilot_test/ibex_work_upload/result/scanchain/data/ibex_core.scan.def
}

set_timing_derate -delay_corner {delay_max} -early 0.97 -late 1.03 -clock
set_timing_derate -delay_corner {delay_max} -late 1.05 -data
setAnalysisMode -cppr both

set reg [filter_collection [all_registers] "is_integrated_clock_gating_cell != true"]
set input [all_inputs]
set output [all_outputs]
group_path -name reg2reg -from $reg -to $reg
group_path -name in2reg -from $input
group_path -name reg2out -to $output
setPathGroupOptions reg2reg -effortLevel high

setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true -place_global_reorder_scan false -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

place_opt_design
reportCongestion -overflow
timeDesign -preCTS -idealClock -pathReports -drvReports -slackReports -numPaths 50 -prefix preCTS -outDir /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/placement_timing
saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/placement.enc
puts "Stage Complete: Placement"; puts "=========================================="
EOF'
```

---

## Stage 5: CTS

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_cts.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP CTS: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/placement.enc

set_ccopt_property use_inverters true
set cts_inv_cells {sky130_fd_sc_hd__clkinv_1 sky130_fd_sc_hd__clkinv_2 sky130_fd_sc_hd__clkinv_4 sky130_fd_sc_hd__clkinv_8}
foreach cell $cts_inv_cells { setDontUse sky130_fd_sc_hd__$cell false }
set_ccopt_property inverter_cells [get_lib_cells $cts_inv_cells]

add_ndr -name cts_ndr -width_multiplier "met2:met4 2" -spacing_multiplier "met2:met4 2"
create_route_type -name clk_route -non_default_rule cts_ndr -top_preferred_layer met4 -bottom_preferred_layer met2
set_ccopt_property route_type clk_route -net_type trunk
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRoutingLayer 2

create_ccopt_clock_tree_spec -file /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/clk.spec
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/clk.spec
ccopt_design -cts
report_ccopt_skew_groups
timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTS -outDir /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/cts_timing
saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/cts.enc
puts "Stage Complete: CTS"; puts "=========================================="
EOF'
```

---

## Stage 6: Post-CTS Optimization

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_postcts.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP Post-CTS: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/cts.enc

set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true

optDesign -postCTS
optDesign -postCTS -hold
timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTSopt -outDir /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/postcts_opt_timing
saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/postcts.enc
puts "Stage Complete: Post-CTS"; puts "=========================================="
EOF'
```

---

## Stage 7: Routing

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_routing.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP Routing: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/postcts.enc

setNanoRouteMode -quiet -routeWithTimingDriven true
setAnalysisMode -analysisType onChipVariation
setNanoRouteMode -quiet -drouteEndIteration 70 -drouteFixAntenna true -drouteUseMultiCutViaEffort medium
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRoutingLayer 2
setDelayCalMode -engine default -siAware true

routeDesign -globalDetail
timeDesign -postRoute -prefix postRoute -outDir /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/routing_timing
saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing.enc
puts "Stage Complete: Routing"; puts "=========================================="
EOF'
```

---

## Stage 8: Route Optimization

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_routeopt.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP RouteOpt: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing.enc

optDesign -postRoute -setup
timeDesign -postRoute -prefix postRouteOpt -outDir /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/routing_opt_timing
saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routeopt.enc
puts "Stage Complete: RouteOpt"; puts "=========================================="
EOF'
```

---

## Stage 9: Chip Finish

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_chipdone.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP ChipDone: Starting"; puts "=========================================="
source /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routeopt.enc

remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS
verifyConnectivity -type all -error 1000 -warning 50

setExtractRCMode -engine postRoute
reset_parasitics
extractRC

set lefDefOutVersion 5.8
defOut -floorplan -netlist -routing /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_core.final.def
saveNetlist /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_core.final.v
saveNetlist -excludeLeafCell -includePowerGround -flattenBus /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_core.lvs.v

if {[file exists /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map]} {
    setStreamOutMode -textSize 5 -virtualConnection true -uniquifyCellNamesPrefix true -check_map_file true
    streamOut /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_core.gds -mapFile /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL
}

reportTiming -maxPaths 10 > /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/final_timing.rpt
reportPower > /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/final_power.rpt
reportArea > /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/final_area.rpt

saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/final.enc
puts "=========================================="; puts "MCP FLOW COMPLETE!"; puts "=========================================="
puts "Outputs: result/pr/data/ibex_core.final.*"
puts "Reports: result/pr/report/final_*.rpt"
EOF'
```

---

## Full Flow Script

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cat > /home/EDA/hipilot_test/ibex_work_upload/mcp_full_flow.tcl << '\''EOF'\''
puts "=========================================="; puts "MCP FULL FLOW: Ibex RTL2GDS"; puts "=========================================="
cd /home/EDA/hipilot_test/ibex_work_upload
source mcp_init.tcl
source mcp_floorplan.tcl
source mcp_power.tcl
source mcp_placement.tcl
source mcp_cts.tcl
source mcp_postcts.tcl
source mcp_routing.tcl
source mcp_routeopt.tcl
source mcp_chipdone.tcl
puts "=========================================="; puts "MCP FULL FLOW COMPLETE!"; puts "=========================================="
exit
EOF'
```

---

## Execute Complete Flow

```bash
# Create all scripts first
# (Run each cat > ... command above)

# Then execute:
sshpass -p 'eda2020' ssh EDA@192.168.112.163 '
cd /home/EDA/hipilot_test/ibex_work_upload
pkill -f "innovus|ffmpeg" 2>/dev/null || true
/home/EDA/hipilot_test/start_recording.sh "ibex_mcp_flow_$(date +%Y%m%d_%H%M%S)"
innovus -no_gui -files mcp_full_flow.tcl -log result/pr/log/mcp_full_flow.log
/home/EDA/hipilot_test/stop_recording.sh
'
```

---

## Evidence Collection

```bash
# Collect logs and outputs
sshpass -p 'eda2020' ssh EDA@192.168.112.163 '
echo "=== LOG FILES ==="; ls -la /home/EDA/hipilot_test/ibex_work_upload/result/pr/log/
echo "=== OUTPUTS ==="; ls -la /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_core.final.*
echo "=== REPORTS ==="; ls -la /home/EDA/hipilot_test/ibex_work_upload/result/pr/report/final_*.rpt
echo "=== RECORDINGS ==="; ls -la /home/EDA/hipilot_test/recordings/
'

# Download to local
mkdir -p /Users/luzi/code/hipilot-0.3.0/hipilot-opencode/evidence/mcp_flow_$(date +%Y%m%d)
sshpass -p 'eda2020' scp -r EDA@192.168.112.163:/home/EDA/hipilot_test/ibex_work_upload/result/pr/log/*.log /Users/luzi/code/hipilot-0.3.0/hipilot-opencode/evidence/mcp_flow_$(date +%Y%m%d)/
sshpass -p 'eda2020' scp -r EDA@192.168.112.163:/home/EDA/hipilot_test/ibex_work_upload/result/pr/report/*.rpt /Users/luzi/code/hipilot-0.3.0/hipilot-opencode/evidence/mcp_flow_$(date +%Y%m%d)/
sshpass -p 'eda2020' scp -r EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/*.mp4 /Users/luzi/code/hipilot-0.3.0/hipilot-opencode/evidence/mcp_flow_$(date +%Y%m%d)/
```

---

## QoR Tracking

| Stage | Report | Key Metric |
|-------|--------|------------|
| Init | check_init.report | Instance count |
| Placement | placement_timing/ | Pre-CTS WNS |
| CTS | cts_timing/ | Post-CTS WNS, Skew |
| Routing | routing_timing/ | Post-route WNS |
| Final | final_timing.rpt | Final WNS/TNS |
