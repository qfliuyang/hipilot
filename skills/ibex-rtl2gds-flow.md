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
# Define die area with rows
floorPlan -site unithd -su 1 0.4 1 1 1 1

# Place block ports from IO file
loadIoFile /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file

# Set dont-use cells (low-power cells cause issues in Sky130)
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cells */$cell] true
}

saveDesign result/pr/data/floor_plan.enc
defOut -floorplan -noStdCells result/pr/data/ibex.floorplan.def
puts "FLOORPLAN COMPLETE"
```

## Stage 3: Power Planning (timeout: 120s)

```tcl
# Global PG net connections
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB VPWR} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS

# Vertical power stripes (met4)
addStripe -nets {VSS VDD} \
    -layer met4 -direction vertical \
    -width 6 -spacing 2 -set_to_set_distance 30 \
    -start_from left -start_offset 1 \
    -uda power_stripe_v

# Horizontal power stripes (met5)
addStripe -nets {VSS VDD} \
    -layer met5 -direction horizontal \
    -width 6 -spacing 2 -set_to_set_distance 30 \
    -start_from bottom -start_offset 1 \
    -uda power_stripe_h

# Power rail routing (connect stripes to standard cell VDD/VSS pins)
sroute -connect { corePin } \
    -layerChangeRange { li1(1) met4(4) } \
    -corePinTarget { none } \
    -allowJogging 1 \
    -crossoverViaLayerRange { li1(1) met4(4) } \
    -nets { VDD VSS } \
    -allowLayerChange 1 \
    -targetViaLayerRange { li1(1) met4(4) }

# Verify PG connectivity
verifyConnectivity -type special -noAntenna -noWeakConnect -noUnroutedNet -error 1000 -warning 50
verify_PG_short -no_routing_blkg

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
# CTS cell setup
set_ccopt_property use_inverters true

# Non-default routing rule for clock nets (2x width/spacing for signal integrity)
add_ndr -name cts_1 \
    -width_multiplier "met2:met4 2" \
    -spacing_multiplier "met2:met4 2"
create_route_type -name clk_net_rule \
    -non_default_rule cts_1 \
    -top_preferred_layer met2 \
    -bottom_preferred_layer met4
set_ccopt_property route_type clk_net_rule -net_type trunk

# Set CTS routing layers
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRouting 2

# Generate and source clock tree spec
create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec

# Run CTS
ccopt_design -cts

# Report and save
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
