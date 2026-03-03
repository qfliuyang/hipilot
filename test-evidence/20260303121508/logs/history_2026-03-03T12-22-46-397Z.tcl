# Sent at: 2026-03-03T12:22:46.397Z
# Pane: eda

cd /home/EDA/ibex_work_upload
set restore_db_stop_at_design_in_memory 0
source result/pr/data/chip_done.enc
puts "=== VIOLATING PATHS (WNS = -0.059ns) ==="
report_timing -max_paths 20 -delay_type max -sort_by slack
exit