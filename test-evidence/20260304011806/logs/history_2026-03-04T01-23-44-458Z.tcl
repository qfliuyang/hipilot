# Sent at: 2026-03-04T01:23:44.458Z
# Pane: eda

cd /home/EDA/ibex_work_upload
file mkdir result/pr/data result/pr/log result/pr/report

# Check that timing library exists
set timing_lib /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
if {![file exists $timing_lib]} {
    puts "ERROR: Timing library not found: $timing_lib"
    exit 1
}

# Create MMMC setup file first
set mmmc_file [open "result/pr/data/mmmc.view" w]
puts $mmmc_file "create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05"
puts $mmmc_file "create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1"
puts $mmmc_file "create_library_set -name lib_set_max -timing $timing_lib"
puts $mmmc_file "create_library_set -name lib_set_min -timing $timing_lib"
puts $mmmc_file "create_constraint_mode -name common -sdc_files /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc"
puts $mmmc_file "create_delay_corner -name delay_max -library_set lib_set_max -rc_corner rc_max"
puts $mmmc_file "create_delay_corner -name delay_min -library_set lib_set_min -rc_corner rc_min"
puts $mmmc_file "create_analysis_view -name max_view -constraint_mode common -delay_corner delay_max"
puts $mmmc_file "create_analysis_view -name min_view -constraint_mode common -delay_corner delay_min"
close $mmmc_file

# Set MMMC file BEFORE init_design
set init_mmmc_file result/pr/data/mmmc.view

# Design init (loads LEF, netlist, and MMMC)
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
puts "STAGE 1 COMPLETE: Design Init + MMMC"
exit