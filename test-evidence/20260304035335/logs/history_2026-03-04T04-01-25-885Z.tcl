# Sent at: 2026-03-04T04:01:25.885Z
# Pane: eda

cd /home/EDA/ibex_work_upload
file mkdir result/pr/data result/pr/log result/pr/report

# Set MMMC file BEFORE init_design
set init_mmmc_file result/pr/data/mmmc_setup.tcl

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
puts "STAGE 1 COMPLETE: Design initialized and saved to init_design.enc"
exit