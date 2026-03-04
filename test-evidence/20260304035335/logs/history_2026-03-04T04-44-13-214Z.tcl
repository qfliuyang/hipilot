# Sent at: 2026-03-04T04:44:13.214Z
# Pane: eda

source /home/EDA/ibex_work_upload/result/pr/data/routing_opt.enc

remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

globalNetConnect VDD -type pgpin -pin {VPB} -inst *
globalNetConnect VDD -type pgpin -pin {VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND} -inst *
globalNetConnect VSS -type pgpin -pin {VNB} -inst *
verifyConnectivity -type all -error 1000 -warning 50

# Export
defOut -floorplan -netlist -routing result/pr/data/ibex_routing.def
saveNetlist result/pr/data/ibex_routing.vg
saveNetlist -excludeLeafCell -includePowerGround -flattenBus result/pr/data/ibex_lvs.vg

# RC extraction
setExtractRCMode -engine postRoute
reset_parasitics
extractRC

# GDS
setStreamOutMode -textSize 5 -virtualConnection true -uniquifyCellNamesPrefix true
streamOut result/pr/data/ibex_core.gds -mapFile /home/EDA/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL

saveDesign result/pr/data/chip_done.enc
puts "STAGE 9 COMPLETE: Chip finish and GDS export done"
puts "GDS output: result/pr/data/ibex_core.gds"
exit