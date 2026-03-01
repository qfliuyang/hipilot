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
Scripts:     /home/EDA/ibex_work_upload/scripts

Synthesis:
  RTL src:   /home/EDA/ibex_work_upload/designs/src/ibex/*.v (37 Verilog files)
  DB lib:    /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db
  SDC:       /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint.sdc
  Syn data:  /home/EDA/ibex_work_upload/result/syn/data/
  Syn rpt:   /home/EDA/ibex_work_upload/result/syn/report/

P&R (Innovus):
  Netlist:   /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v (from synthesis)
  LEF:       /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef
             /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef
  LIB:       /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
  PR SDC:    /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc
  IO file:   /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file
  PR data:   /home/EDA/ibex_work_upload/result/pr/data/
  GDS map:   /home/EDA/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map
```

## Flow Order and Tool Usage

| # | Stage | Tool | Input | Output | Duration |
|---|-------|------|-------|--------|----------|
| 0 | Synthesis + DFT | dc_shell | RTL Verilog | ibex_core.syn.v | 5 min |
| 1 | Design Init + MMMC | innovus | ibex_core.syn.v | init_design.enc | 2 min |
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

## Stage 0: Synthesis + DFT (dc_shell, timeout: 300s)

Runs Design Compiler to synthesize RTL Verilog into a gate-level netlist. Includes DFT scan chain insertion. The output netlist (`ibex_core.syn.v`) is the input for all P&R stages.

**Tool:** `dc_shell -f -64` (Synopsys Design Compiler, 64-bit mode)

**Note:** If the synthesized netlist already exists at `result/syn/data/ibex_core.syn.v`, you can skip this stage and go directly to Stage 1 (Design Init).

```tcl
cd /home/EDA/ibex_work_upload

# Skip synthesis if netlist already exists (allows restarting from P&R)
if {[file exists result/syn/data/ibex_core.syn.v]} {
    puts "SYNTHESIS ALREADY COMPLETE — using existing netlist at result/syn/data/ibex_core.syn.v"
    exit 0
}

file mkdir result/syn/data result/syn/log result/syn/report result/syn/work
file mkdir result/scanchain/data result/scanchain/report result/scanchain/log

# Setup
define_design_lib work -path result/syn/work
set sh_command_log_file result/syn/work/command.log
set_app_var alib_library_analysis_path result/syn/work

# Library
set target_library /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db
set link_library "* $target_library"
lappend link_library {dw_foundation.sldb}

# Read RTL
analyze -format sverilog [glob /home/EDA/ibex_work_upload/designs/src/ibex/*.v]
elaborate ibex_core
current_design ibex_core
link
check_design

# Timing constraints
source /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint.sdc

# Path groups
reset_path_group -all
set reg [filter_collection [all_registers] "is_clock_gate != true"]
group_path -name reg2reg -weight 50 -critical_range 6 -from $reg -to $reg
group_path -name in2reg -weight 10 -critical_range 0.5 -from [all_inputs] -to $reg
group_path -name reg2out -weight 10 -critical_range 0.5 -from $reg -to [all_outputs]

# Dont-use cells
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cell */$cell]
}
redirect result/syn/report/check_timing.rpt {check_timing}

# Compile (high effort + scan)
set_fix_multiple_port_nets -all -buffer_constants [get_designs *]
compile_ultra -timing_high_effort_script -scan

# DFT: scan chain insertion
set_dft_insertion_configuration -preserve_design_name true
set_dft_signal -view existing_dft -type ScanClock -timing {45 55} -port {clk_i}
set_dft_signal -view existing_dft -port rst_ni -type Reset -active_state 0
set_dft_signal -view existing_dft -port test_en_i -type ScanEnable -active_state 1
set_dft_insertion_configuration -synthesis none -preserve_design_name true
set_autofix_configuration -type bidirectional -method input
create_test_protocol -infer_async -infer_clock
preview_dft -show all -verbose > result/scanchain/report/preview_dft.rpt
insert_dft
dft_drc -verbose > result/scanchain/report/pre_dft_drc.rpt

# Incremental compile after DFT
compile_ultra -scan -incremental

# Reports
redirect result/syn/report/check_design_after_syn.rpt {check_design}
redirect result/syn/report/qor.rpt {report_qor -nosplit}
redirect result/syn/report/violation.rpt {report_constraint -all_violators}

# Output netlist (this is the input for Innovus P&R)
write -format verilog -h -output result/syn/data/ibex_core.syn.v
write -format ddc -h -output result/syn/data/ibex_core.rpt.ddc
write_scan_def -output result/scanchain/data/ibex_core.scan.def
set_svf result/syn/data/ibex_core.svf

puts "SYNTHESIS COMPLETE — netlist at result/syn/data/ibex_core.syn.v"
exit
```

---

## Stage 1: Design Init + MMMC (innovus, timeout: 180s)

First stage — no checkpoint to load. Sets up MMMC, loads LEF/netlist, initializes design.

```tcl
cd /home/EDA/ibex_work_upload
file mkdir result/pr/data result/pr/log result/pr/report

# Check that timing library exists
set timing_lib /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
if {![file exists $timing_lib]} {
    puts "ERROR: Timing library not found: $timing_lib"
    exit 1
}

# MMMC setup (must be before init_design for timing-driven flow)
create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05
create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1
create_library_set -name lib_set_max -timing $timing_lib
create_library_set -name lib_set_min -timing $timing_lib
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
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 2: Floorplan (innovus, timeout: 120s)

```tcl
# For continuous flow: design already loaded from Stage 1
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/init_design.enc

floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file

# Dont-use cells (Sky130 low-power cells cause issues)
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cells */$cell] true
}

saveDesign result/pr/data/floor_plan.enc
defOut -floorplan -noStdCells result/pr/data/ibex.floorplan.def
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 3: Power Planning (innovus, timeout: 120s)

```tcl
# For continuous flow: design already loaded from Stage 2
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/floor_plan.enc

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
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 4: Placement (innovus, timeout: 300s)

**CRITICAL:** DO NOT use `loadDefFile` or `loadDef` in this stage. The design is already loaded from the checkpoint. Loading DEF will cause "lib cell exists" error.

If scan chain errors occur, delete existing scan chains (as shown below) - do NOT try to load scan DEF files.

```tcl
# For continuous flow: design already loaded from Stage 3
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/powerplan.enc

# Delete any existing scan chains that aren't properly defined
# This avoids "Scan chains exist but are not defined" error during placement
# NOTE: Do NOT use loadDefFile to load scan chains - it causes conflicts
set scan_chains [getScanChains -quiet]
if {$scan_chains != ""} {
    foreach chain $scan_chains {
        deleteScanChain $chain
    }
}

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

# Place settings - ignore scan since we deleted the chains
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

place_opt_design
reportCongestion -overflow

timeDesign -preCTS -idealClock -pathReports -drvReports -slackReports -numPaths 50 -prefix preCTS -outDir result/pr/report/placement_timing
saveDesign result/pr/data/placement.enc
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 5: CTS (innovus, timeout: 300s)

```tcl
# For continuous flow: design already loaded from Stage 4
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/placement.enc

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
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 6: Post-CTS Optimization (innovus, timeout: 300s)

```tcl
# For continuous flow: design already loaded from Stage 5
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/cts.enc

set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true
optDesign -postCTS
optDesign -postCTS -hold

timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTSOpt -outDir result/pr/report/cts_opt_timing
saveDesign result/pr/data/post_cts_opt.enc
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 7: Routing (innovus, timeout: 600s)

```tcl
# For continuous flow: design already loaded from Stage 6
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/post_cts_opt.enc

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
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 8: Routing Optimization (innovus, timeout: 300s)

```tcl
# For continuous flow: design already loaded from Stage 7
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/routing.enc

optDesign -postRoute -setup
timeDesign -postRoute -prefix postRouteOpt -outDir result/pr/report/routing_opt_timing
saveDesign result/pr/data/routing_opt.enc
# Note: For continuous flow, do not exit - continue to next stage
```

## Stage 9: Chip Finish + GDS Export (innovus, timeout: 300s)

```tcl
# For continuous flow: design already loaded from Stage 8
# For stage-by-stage: source /home/EDA/ibex_work_upload/result/pr/data/routing_opt.enc

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
# Flow complete - exit to return to shell
exit
```
