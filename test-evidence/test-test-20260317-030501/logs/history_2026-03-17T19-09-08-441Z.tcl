# Sent at: 2026-03-17T19:09:08.441Z
# Pane: eda

cd /home/EDA/runs/test-test-20260317-030501/ibex_work_upload
source scripts/syn/dc_setup.tcl
source scripts/syn/dc_main.tcl
source scripts/syn/dc_report.tcl
report_timing -max_paths 10 -slack_lesser_than 0.0