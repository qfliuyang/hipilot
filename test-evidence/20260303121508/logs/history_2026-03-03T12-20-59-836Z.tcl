# Sent at: 2026-03-03T12:20:59.836Z
# Pane: eda

cd /home/EDA/ibex_work_upload
source result/pr/data/chip_done.enc
puts "Chip loaded successfully"
report_timing -max_paths 10 -delay max -fields {slew cap input nets fanout} -no_widgets
exit