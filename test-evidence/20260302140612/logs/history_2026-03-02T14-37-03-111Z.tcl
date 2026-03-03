# Sent at: 2026-03-02T14:37:03.111Z
# Pane: eda

# Load scan chain DEF from synthesis
loadDefFile /home/EDA/ibex_work_upload/result/scanchain/data/ibex_core.scan.def

# Now run placement with scan chains defined
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan false
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false
setPlaceMode -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

place_opt_design

saveDesign result/pr/data/placement.enc
puts "STAGE 4 COMPLETE - placement.enc saved"
