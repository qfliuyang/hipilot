# Sent at: 2026-03-02T11:44:47.939Z
# Pane: eda

# CTS setup - simple version
set_ccopt_property use_inverters true

create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTS -outDir result/pr/report/cts_timing
saveDesign result/pr/data/cts.enc
puts "STAGE 5 COMPLETE — checkpoint saved at result/pr/data/cts.enc"
exit