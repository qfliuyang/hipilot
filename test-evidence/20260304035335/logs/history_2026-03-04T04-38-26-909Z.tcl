# Sent at: 2026-03-04T04:38:26.909Z
# Pane: eda

source /home/EDA/ibex_work_upload/result/pr/data/routing.enc

optDesign -postRoute -setup

timeDesign -postRoute -prefix postRouteOpt -outDir result/pr/report/routing_opt_timing
saveDesign result/pr/data/routing_opt.enc
puts "STAGE 8 COMPLETE: Routing optimization done"
exit