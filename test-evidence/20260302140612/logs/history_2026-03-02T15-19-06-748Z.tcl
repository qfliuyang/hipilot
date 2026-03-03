# Sent at: 2026-03-02T15:19:06.748Z
# Pane: eda

cd /home/EDA/ibex_work_upload

# ========== STAGE 5: CTS ==========
puts "========================================="
puts "STAGE 5: CTS"
puts "========================================="
source result/pr/data/placement.enc
set_ccopt_property use_inverters true
add_ndr -name cts_1 -width_multiplier "met2:met4 2" -spacing_multiplier "met2:met4 2"
create_route_type -name clk_net_rule -non_default_rule cts_1 -top_preferred_layer met2 -bottom_preferred_layer met4
set_ccopt_property route_type clk_net_rule -net_type trunk
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRoutingLayer 2
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