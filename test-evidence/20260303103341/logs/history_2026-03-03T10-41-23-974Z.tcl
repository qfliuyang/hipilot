# Sent at: 2026-03-03T10:41:23.974Z
# Pane: eda

source /home/EDA/ibex_work_upload/result/pr/data/floor_plan.enc

globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB VPWR} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS

addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1 -uda power_stripe_v
addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1 -uda power_stripe_h

sroute -connect { corePin } -layerChangeRange { li1(1) met4(4) } -corePinTarget { none } -allowJogging 1 -crossoverViaLayerRange { li1(1) met4(4) } -nets { VDD VSS } -allowLayerChange 1 -targetViaLayerRange { li1(1) met4(4) }

verifyConnectivity -type special -noAntenna -noWeakConnect -noUnroutedNet -error 1000 -warning 50
verify_PG_short -no_routing_blkg
saveDesign result/pr/data/powerplan.enc
puts "STAGE 3 COMPLETE - Power planning saved to result/pr/data/powerplan.enc"
exit