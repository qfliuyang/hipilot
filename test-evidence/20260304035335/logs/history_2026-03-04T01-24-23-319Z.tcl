# Sent at: 2026-03-04T01:24:23.319Z
# Pane: eda

cd /home/EDA/hipilot/current
exec innovus -no_gui -files /tmp/stage1_clean.tcl -log /home/EDA/ibex_work_upload/result/pr/log/stage1.log &
after 3000
exit
