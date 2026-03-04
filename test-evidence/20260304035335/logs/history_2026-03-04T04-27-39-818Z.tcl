# Sent at: 2026-03-04T04:27:39.818Z
# Pane: eda

source /home/EDA/ibex_work_upload/result/pr/data/post_cts_opt.enc

setNanoRouteMode -quiet -routeWithTimingDriven true
setAnalysisMode -analysisType onChipVariation
setNanoRouteMode -quiet -drouteEndIteration 70
setNanoRouteMode -quiet -drouteFixAntenna true
setNanoRouteMode -quiet -drouteUseMultiCutViaEffort medium
setNanoRouteMode -quiet -routeTopRoutingLayer 6
setNanoRouteMode -quiet -routeBottomRoutingLayer 2
setDelayCalMode -engine default -siAware true

routeDesign -globalDetail

timeDesign -postRoute -prefix postRoute -outDir result/pr/report/routing_timing
saveDesign result/pr/data/routing.enc
puts "STAGE 7 COMPLETE: Routing done"
exit