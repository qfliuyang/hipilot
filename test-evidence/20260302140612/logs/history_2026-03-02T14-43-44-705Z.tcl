# Sent at: 2026-03-02T14:43:44.705Z
# Pane: eda

# ========== STAGE 4: Placement (RETRY) ==========
puts "========================================="
puts "STAGE 4: Placement (retry)"
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
puts "STAGE 4 COMPLETE - placement.enc saved"
