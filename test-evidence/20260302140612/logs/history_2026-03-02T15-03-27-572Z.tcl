# Sent at: 2026-03-02T15:03:27.572Z
# Pane: eda

cd /home/EDA/ibex_work_upload
file mkdir result/pr/data result/pr/log result/pr/report

# Use the non-DFT netlist
set init_verilog /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.no_dft.v

# ========== STAGE 1: Design Init + MMMC ==========
puts "========================================="
puts "STAGE 1: Design Init + MMMC (NO DFT)"
puts "========================================="

set timing_lib designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
set mmmc_file [open "result/pr/data/mmmc.view" w]
puts $mmmc_file "create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05"
puts $mmmc_file "create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1"
puts $mmmc_file "create_library_set -name lib_set_max -timing $timing_lib"
puts $mmmc_file "create_library_set -name lib_set_min -timing $timing_lib"
puts $mmmc_file "create_constraint_mode -name common -sdc_files designs/sky130hd/ibex/constraint_for_pr.sdc"
puts $mmmc_file "create_delay_corner -name delay_max -library_set lib_set_max -rc_corner rc_max"
puts $mmmc_file "create_delay_corner -name delay_min -library_set lib_set_min -rc_corner rc_min"
puts $mmmc_file "create_analysis_view -name max_view -constraint_mode common -delay_corner delay_max"
puts $mmmc_file "create_analysis_view -name min_view -constraint_mode common -delay_corner delay_min"
puts $mmmc_file "set_analysis_view -setup max_view -hold min_view"
close $mmmc_file

set init_mmmc_file result/pr/data/mmmc.view
set defHierChar {/}
set init_gnd_net VSS
set init_pwr_net VDD
set init_top_cell ibex_core
set init_lef_file [list designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]
init_design
saveDesign result/pr/data/init_design.enc
puts "STAGE 1 COMPLETE"

# ========== STAGE 2: Floorplan ==========
puts "========================================="
puts "STAGE 2: Floorplan"
puts "========================================="
floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile designs/sky130hd/ibex/io.file
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cells */$cell] true
}
saveDesign result/pr/data/floor_plan.enc
puts "STAGE 2 COMPLETE"

# ========== STAGE 3: Power Planning ==========
puts "========================================="
puts "STAGE 3: Power Planning"
puts "========================================="
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB VPWR} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS
addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1
addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1
sroute -connect { corePin } -layerChangeRange { li1(1) met4(4) } -corePinTarget { none } -allowJogging 1 -crossoverViaLayerRange { li1(1) met4(4) } -nets { VDD VSS } -allowLayerChange 1 -targetViaLayerRange { li1(1) met4(4) }
saveDesign result/pr/data/powerplan.enc
puts "STAGE 3 COMPLETE"

# ========== STAGE 4: Placement ==========
puts "========================================="
puts "STAGE 4: Placement (NO DFT - should work)"
puts "========================================="
set_timing_derate -delay_corner delay_max -early 0.97 -late 1.03 -clock
set_timing_derate -delay_corner delay_max -late 1.05 -data
setAnalysisMode -cppr both
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
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false
setPlaceMode -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130
place_opt_design
saveDesign result/pr/data/placement.enc
puts "STAGE 4 COMPLETE - placement done!"

# ========== STAGE 5: CTS ==========
puts "========================================="
puts "STAGE 5: CTS"
puts "========================================="
set_ccopt_property use_inverters true
add_ndr -name cts_1 -width_multiplier "met2:met4 2" -spacing_multiplier "met2:met4 2"
create_route_type -name clk_net_rule -non_default_rule cts_1 -top_preferred_layer met2 -bottom_preferred_layer met4
set_ccopt_property route_type clk_net_rule -net_type trunk
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRouting 2
create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts
saveDesign result/pr/data/cts.enc
puts "STAGE 5 COMPLETE"

# ========== STAGE 6: Post-CTS Optimization ==========
puts "========================================="
puts "STAGE 6: Post-CTS Optimization"
puts "========================================="
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true
optDesign -postCTS
optDesign -postCTS -hold
saveDesign result/pr/data/post_cts_opt.enc
puts "STAGE 6 COMPLETE"

# ========== STAGE 7: Routing ==========
puts "========================================="
puts "STAGE 7: Routing"
puts "========================================="
setNanoRouteMode -quiet -routeWithTimingDriven true
setAnalysisMode -analysisType onChipVariation
setNanoRouteMode -quiet -drouteEndIteration 70
setNanoRouteMode -quiet -drouteFixAntenna true
setNanoRouteMode -quiet -drouteUseMultiCutViaEffort medium
setNanoRouteMode -quiet -routeTopRoutingLayer 6
setNanoRouteMode -quiet -routeBottomRoutingLayer 2
setDelayCalMode -engine default -siAware true
routeDesign -globalDetail
saveDesign result/pr/data/routing.enc
puts "STAGE 7 COMPLETE"

# ========== STAGE 8: Routing Optimization ==========
puts "========================================="
puts "STAGE 8: Routing Optimization"
puts "========================================="
optDesign -postRoute -setup
saveDesign result/pr/data/routing_opt.enc
puts "STAGE 8 COMPLETE"

# ========== STAGE 9: Chip Finish + GDS ==========
puts "========================================="
puts "STAGE 9: Chip Finish + GDS Export"
puts "========================================="
remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule
globalNetConnect VDD -type pgpin -pin {VPB} -inst *
globalNetConnect VDD -type pgpin -pin {VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND} -inst *
globalNetConnect VSS -type pgpin -pin {VNB} -inst *
verifyConnectivity -type all -error 1000 -warning 50
defOut -floorplan -netlist -routing result/pr/data/ibex_routing.def
saveNetlist result/pr/data/ibex_routing.vg
saveNetlist -excludeLeafCell -includePowerGround -flattenBus result/pr/data/ibex_lvs.vg
setExtractRCMode -engine postRoute
reset_parasitics
extractRC
setStreamOutMode -textSize 5 -virtualConnection true -uniquifyCellNamesPrefix true
streamOut result/pr/data/ibex_core.gds -mapFile designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL
saveDesign result/pr/data/chip_done.enc
puts "========================================="
puts "RTL-TO-GDS FLOW COMPLETE!"
puts "========================================="
puts "GDS: result/pr/data/ibex_core.gds"
exit