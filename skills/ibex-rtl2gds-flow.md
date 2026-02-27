---
name: ibex-rtl2gds-flow
description: >
  Complete P&R flow for Ibex RISC-V CPU on Skywater 130nm using Innovus.
  Each stage is a self-contained Tcl block for eda.execute_and_verify.
hipilot:
  vendors: [cadence]
  tools:
    cadence: [innovus]
  triggers:
    - "run rtl2gds"
    - "ibex flow"
    - "complete flow"
    - "/rtl2gds"
  risk_level: high
  typical_duration: "30-60 minutes"
---

# Ibex RTL2GDS Flow

Complete place-and-route for Ibex RISC-V CPU (Skywater 130nm, ~7000 cells).

**How to use this skill:** For each stage below, pass the Tcl to `mcp__hipilot-eda__eda.execute_and_verify` with the stage description and timeout. Check the result. If errors, call `mcp__hipilot-eda__eda.diagnose_error`. If success, call `mcp__hipilot-eda__qor.snapshot`.

## Design Paths (Absolute, EDA Server)

```
Design dir:  /home/EDA/ibex_work_upload
LEF files:   /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef
             /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef
Netlist:     /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v
SDC:         /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc
Timing lib:  /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
IO file:     /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file
Output dir:  /home/EDA/ibex_work_upload/result/pr/
```

## Stage 1: Design Init + MMMC (timeout: 180s)

Sets up MMMC (multi-mode multi-corner), loads LEF/netlist, initializes design.

```tcl
cd /home/EDA/ibex_work_upload
file mkdir result/pr/data result/pr/log result/pr/report

# MMMC setup (MUST be before init_design)
create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05
create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1
create_library_set -name lib_set_max -timing /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
create_library_set -name lib_set_min -timing /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
create_constraint_mode -name common -sdc_files /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc
create_delay_corner -name delay_max -library_set lib_set_max -rc_corner rc_max
create_delay_corner -name delay_min -library_set lib_set_min -rc_corner rc_min
create_analysis_view -name max_view -constraint_mode common -delay_corner delay_max
create_analysis_view -name min_view -constraint_mode common -delay_corner delay_min
set_analysis_view -setup {max_view} -hold {min_view}

# Design init
set defHierChar {/}
set init_gnd_net VSS
set init_pwr_net VDD
set init_verilog /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_lef_file [list /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]
init_design

checkDesign -netList -noHtml -outfile result/pr/report/check_data_init.report
timeDesign -prePlace -pathReports -drvReports -slackReports -numPaths 50 -prefix prePlace -outDir result/pr/report/init_data_timing
saveDesign result/pr/data/init_design.enc
puts "INIT COMPLETE"
```

## Stage 2: Floorplan (timeout: 120s)

```tcl
floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file
saveDesign result/pr/data/floor_plan.enc
defOut -floorplan -noStdCells result/pr/data/ibex.floorplan.def
puts "FLOORPLAN COMPLETE"
```

## Stage 3: Power Planning (timeout: 120s)

```tcl
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB VPWR} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS

addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1
addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1
sroute -connect { corePin } -layerChangeRange { li1(1) met4(4) } -nets { VDD VSS } -allowJogging 1 -allowLayerChange 1

verifyConnectivity -type special -noAntenna -noWeakConnect -noUnroutedNet -error 1000 -warning 50
saveDesign result/pr/data/powerplan.enc
puts "POWER PLAN COMPLETE"
```

## Stage 4: Placement (timeout: 300s)

```tcl
# Timing derate
set_timing_derate -delay_corner delay_max -early 0.97 -late 1.03 -clock
set_timing_derate -delay_corner delay_max -late 1.05 -data
setAnalysisMode -cppr both

# Path groups
reset_path_group -all
set reg [filter_collection [all_registers] "is_integrated_clock_gating_cell != true"]
group_path -name reg2reg -from $reg -to $reg
group_path -name in2reg -from [all_inputs]
group_path -name reg2out -to [all_outputs]
setPathGroupOptions reg2reg -effortLevel high

# Place settings
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

# Run placement
place_opt_design
reportCongestion -overflow

# Timing report
timeDesign -preCTS -idealClock -pathReports -drvReports -slackReports -numPaths 50 -prefix preCTS -outDir result/pr/report/placement_timing
saveDesign result/pr/data/placement.enc
puts "PLACEMENT COMPLETE"
```

## Stage 5: CTS (timeout: 300s)

```tcl
set_ccopt_property use_inverters true
create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTS -outDir result/pr/report/cts_timing
saveDesign result/pr/data/cts.enc
puts "CTS COMPLETE"
```

## Stage 6: Post-CTS Optimization (timeout: 300s)

```tcl
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true
optDesign -postCTS
optDesign -postCTS -hold

timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTSOpt -outDir result/pr/report/cts_opt_timing
saveDesign result/pr/data/post_cts_opt.enc
puts "POST-CTS OPT COMPLETE"
```

## Stage 7: Routing (timeout: 600s)

```tcl
setNanoRouteMode -quiet -routeWithTimingDriven true
setAnalysisMode -analysisType onChipVariation
setNanoRouteMode -quiet -drouteEndIteration 70
setNanoRouteMode -quiet -drouteFixAntenna true
setNanoRouteMode -quiet -drouteUseMultiCutViaEffort medium
setNanoRouteMode -quiet -routeTopRoutingLayer 6
setNanoRouteMode -quiet -routeBottomRoutingLayer 2
setDelayCalMode -engine default -siAware true

routeDesign -globalDetail

timeDesign -postRoute -prefix postRoute -outDir result/pr/report/routing_timing
saveDesign result/pr/data/routing.enc
puts "ROUTING COMPLETE"
```

## Stage 8: Route Optimization (timeout: 300s)

```tcl
optDesign -postRoute -setup
timeDesign -postRoute -prefix postRouteOpt -outDir result/pr/report/routing_opt_timing
saveDesign result/pr/data/routing_opt.enc
puts "ROUTE OPT COMPLETE"
```

## Stage 9: Chip Finish + Export (timeout: 300s)

```tcl
remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

# PG reconnect
globalNetConnect VDD -type pgpin -pin {VPB} -inst *
globalNetConnect VDD -type pgpin -pin {VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND} -inst *
globalNetConnect VSS -type pgpin -pin {VNB} -inst *
verifyConnectivity -type all -error 1000 -warning 50

# Export
defOut -floorplan -netlist -routing result/pr/data/ibex_routing.def
saveNetlist result/pr/data/ibex_routing.vg
saveNetlist -excludeLeafCell -includePowerGround -flattenBus result/pr/data/ibex_lvs.vg

# GDS
setStreamOutMode -textSize 5 -virtualConnection true -uniquifyCellNamesPrefix true
streamOut result/pr/data/ibex_core.gds -mapFile /home/EDA/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL

saveDesign result/pr/data/chip_done.enc
puts "CHIP FINISH COMPLETE — GDS exported"
```
