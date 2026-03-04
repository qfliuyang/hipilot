# Sent at: 2026-03-04T04:23:04.923Z
# Pane: eda

source /home/EDA/ibex_work_upload/result/pr/data/cts.enc

set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
setOptMode -fixDrc true -fixFanoutLoad true
optDesign -postCTS
optDesign -postCTS -hold

timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTSOpt -outDir result/pr/report/cts_opt_timing
saveDesign result/pr/data/post_cts_opt.enc
puts "STAGE 6 COMPLETE: Post-CTS optimization done"
exit