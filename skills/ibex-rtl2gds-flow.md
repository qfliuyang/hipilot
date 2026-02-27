---
name: ibex-rtl2gds-flow
description: >
  Complete RTL-to-GDS flow for Ibex RISC-V CPU on Skywater 130nm.
  Each stage is a standalone tool invocation: start tool, load checkpoint, run, save, exit.
  Tools: dc_shell (synthesis), innovus (P&R), pt_shell (signoff STA).
hipilot:
  vendors: [cadence, synopsys]
  tools:
    synopsys: [dc_shell, pt_shell]
    cadence: [innovus]
  triggers:
    - "run rtl2gds"
    - "ibex flow"
    - "/rtl2gds"
  risk_level: high
  typical_duration: "45-90 minutes"
---

# Ibex RTL2GDS Flow

Each stage is a **standalone Tcl script**. The tool starts fresh, loads the previous checkpoint, runs the stage, saves a new checkpoint, and exits. This gives a clean environment for each stage and enables branching/recovery.

## How to execute each stage

For each stage, Claude should:
1. Write the Tcl to a temp file using `eda.execute_and_verify` OR call `eda.start_tool` to start the tool fresh and then pipe the script
2. The Tcl includes `source checkpoint.enc` at the top (load previous stage) and `saveDesign checkpoint.enc` + `exit` at the bottom
3. Wait for the tool to complete (the tool exits after each stage)
4. Restart the tool for the next stage

This matches how `make` runs the flow: each Makefile target is `innovus -files stage.tcl`.

## Design Paths

```
Work dir:    /home/EDA/ibex_work_upload
Result dir:  /home/EDA/ibex_work_upload/result
PR data:     /home/EDA/ibex_work_upload/result/pr/data
PR reports:  /home/EDA/ibex_work_upload/result/pr/report
PR logs:     /home/EDA/ibex_work_upload/result/pr/log
Scripts:     /home/EDA/ibex_work_upload/scripts
LEF:         /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef
             /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef
LIB:         /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
SDC:         /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc
IO file:     /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file
Netlist:     /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v
GDS map:     /home/EDA/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map
```

## Flow Order and Tool Usage

| # | Stage | Tool | Input Checkpoint | Output Checkpoint | Duration |
|---|-------|------|-----------------|-------------------|----------|
| 1 | Design Init + MMMC | innovus | (none — fresh init) | init_design.enc | 2 min |
| 2 | Floorplan | innovus | init_design.enc | floor_plan.enc | 1 min |
| 3 | Power Planning | innovus | floor_plan.enc | powerplan.enc | 1 min |
| 4 | Placement | innovus | powerplan.enc | placement.enc | 5 min |
| 5 | CTS | innovus | placement.enc | cts.enc | 5 min |
| 6 | Post-CTS Optimization | innovus | cts.enc | post_cts_opt.enc | 3 min |
| 7 | Routing | innovus | post_cts_opt.enc | routing.enc | 10 min |
| 8 | Routing Optimization | innovus | routing.enc | routing_opt.enc | 3 min |
| 9 | Chip Finish + GDS | innovus | routing_opt.enc | chip_done.enc | 3 min |

Each stage: `cd /home/EDA/ibex_work_upload && innovus -no_gui -files /tmp/stage_N.tcl -log result/pr/log/stage_N`

---

## Stage 1: Design Init + MMMC (innovus, timeout: 180s)

First stage — no checkpoint to load. Sets up MMMC, loads LEF/netlist, initializes design.

```tcl
cd /home/EDA/ibex_work_upload
file mkdir result/pr/data result/pr/log result/pr/report

# MMMC setup (must be before init_design for timing-driven flow)
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
exit
```

## Stage 2: Floorplan (innovus, timeout: 120s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/init_design.enc

floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file

# Dont-use cells (Sky130 low-power cells cause issues)
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cells */$cell] true
}

saveDesign result/pr/data/floor_plan.enc
defOut -floorplan -noStdCells result/pr/data/ibex.floorplan.def
exit
```

## Stage 3: Power Planning (innovus, timeout: 120s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/floor_plan.enc

globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB VPWR} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS

addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1 -uda power_stripe_v
addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1 -uda power_stripe_h

sroute -connect { corePin } -layerChangeRange { li1(1) met4(4) } -corePinTarget { none } -allowJogging 1 -crossoverViaLayerRange { li1(1) met4(4) } -nets { VDD VSS } -allowLayerChange 1 -targetViaLayerRange { li1(1) met4(4) }

verifyConnectivity -type special -noAntenna -noWeakConnect -noUnroutedNet -error 1000 -warning 50
verify_PG_short -no_routing_blkg
saveDesign result/pr/data/powerplan.enc
exit
```

## Stage 4: Placement (innovus, timeout: 300s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/powerplan.enc

# Timing derate
set_timing_derate -delay_corner delay_max -early 0.97 -late 1.03 -clock
set_timing_derate -delay_corner delay_max -late 1.05 -data
setAnalysisMode -cppr both

# Path groups
reset_path_group -all
set reg [filter_collection [all_registers] "is_integrated_clock_gating_cell != true"]
set ckgating [filter_collection [all_registers] "is_integrated_clock_gating_cell == true"]
group_path -name reg2reg -from $reg -to $reg
group_path -name reg2cg -from $reg -to $ckgating
group_path -name in2reg -from [all_inputs]
group_path -name reg2out -to [all_outputs]
group_path -name feedthr -from [all_inputs] -to [all_outputs]
setPathGroupOptions reg2reg -effortLevel high
setPathGroupOptions reg2cg -effortLevel high
setPathGroupOptions in2reg -effortLevel low
setPathGroupOptions reg2out -effortLevel low
setPathGroupOptions feedthr -effortLevel low
setOptMode -ignorePathGroupsForHold {in2reg reg2out feedthr}

# Place settings
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

place_opt_design
reportCongestion -overflow

timeDesign -preCTS -idealClock -pathReports -drvReports -slackReports -numPaths 50 -prefix preCTS -outDir result/pr/report/placement_timing
saveDesign result/pr/data/placement.enc
exit
```

## Stage 5: CTS (innovus, timeout: 300s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/placement.enc

set_ccopt_property use_inverters true

# NDR for clock nets (2x width/spacing)
add_ndr -name cts_1 -width_multiplier "met2:met4 2" -spacing_multiplier "met2:met4 2"
create_route_type -name clk_net_rule -non_default_rule cts_1 -top_preferred_layer met2 -bottom_preferred_layer met4
set_ccopt_property route_type clk_net_rule -net_type trunk
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRouting 2

create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTS -outDir result/pr/report/cts_timing
saveDesign result/pr/data/cts.enc
exit
```

## Stage 6: Post-CTS Optimization (innovus, timeout: 300s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/cts.enc

set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true
optDesign -postCTS
optDesign -postCTS -hold

timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTSOpt -outDir result/pr/report/cts_opt_timing
saveDesign result/pr/data/post_cts_opt.enc
exit
```

## Stage 7: Routing (innovus, timeout: 600s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/post_cts_opt.enc

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
exit
```

## Stage 8: Routing Optimization (innovus, timeout: 300s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/routing.enc

optDesign -postRoute -setup
timeDesign -postRoute -prefix postRouteOpt -outDir result/pr/report/routing_opt_timing
saveDesign result/pr/data/routing_opt.enc
exit
```

## Stage 9: Chip Finish + GDS Export (innovus, timeout: 300s)

```tcl
source /home/EDA/ibex_work_upload/result/pr/data/routing_opt.enc

remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

globalNetConnect VDD -type pgpin -pin {VPB} -inst *
globalNetConnect VDD -type pgpin -pin {VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND} -inst *
globalNetConnect VSS -type pgpin -pin {VNB} -inst *
verifyConnectivity -type all -error 1000 -warning 50

# Export
defOut -floorplan -netlist -routing result/pr/data/ibex_routing.def
saveNetlist result/pr/data/ibex_routing.vg
saveNetlist -excludeLeafCell -includePowerGround -flattenBus result/pr/data/ibex_lvs.vg

# RC extraction
setExtractRCMode -engine postRoute
reset_parasitics
extractRC

# GDS
setStreamOutMode -textSize 5 -virtualConnection true -uniquifyCellNamesPrefix true
streamOut result/pr/data/ibex_core.gds -mapFile /home/EDA/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL

saveDesign result/pr/data/chip_done.enc
exit
```
