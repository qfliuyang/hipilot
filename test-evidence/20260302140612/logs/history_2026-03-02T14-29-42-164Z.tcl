# Sent at: 2026-03-02T14:29:42.164Z
# Pane: eda

source /home/EDA/ibex_work_upload/result/pr/data/powerplan.enc

# CRITICAL FIX: Re-establish MMMC views after loading checkpoint
source /home/EDA/ibex_work_upload/result/pr/data/mmmc.view

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
puts "STAGE 4 COMPLETE - placement.enc saved"
exit