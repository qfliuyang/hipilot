# Sent at: 2026-03-03T12:22:08.141Z
# Pane: eda

cd /home/EDA/ibex_work_upload
set restore_db_stop_at_design_in_memory 0
source result/pr/data/chip_done.enc
puts "=== FINAL TIMING REPORT ==="
timeDesign -postRoute -prefix final -outDir result/pr/report
puts "=== SETUP TIMING ==="
report_timing -max_paths 10 -no_widgets
exit