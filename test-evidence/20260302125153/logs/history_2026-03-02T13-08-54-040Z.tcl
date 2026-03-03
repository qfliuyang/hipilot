# Sent at: 2026-03-02T13:08:54.040Z
# Pane: eda

cd /home/EDA/ibex_work_upload

# Run design checks
checkDesign -netList -noHtml -outfile result/pr/report/check_data_init.report

# Run pre-place timing analysis
timeDesign -prePlace -pathReports -drvReports -slackReports -numPaths 50 -prefix prePlace -outDir result/pr/report/init_data_timing

# Save checkpoint
saveDesign result/pr/data/init_design.enc

puts "========================================"
puts "Stage 1 COMPLETE!"
puts "Checkpoint: result/pr/data/init_design.enc"
puts "========================================"
exit