# Sent at: 2026-03-03T12:21:06.805Z
# Pane: eda

cd /home/EDA/ibex_work_upload
set restore_db_stop_at_design_in_memory 0
source result/pr/data/chip_done.enc
puts "Chip loaded successfully"
report_timing -max_paths 10 -delay max -fields {slew cap input nets fanout} -no_widgets
exit