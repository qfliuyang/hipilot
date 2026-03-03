# Sent at: 2026-03-02T14:34:13.687Z
# Pane: eda

# Load scan chain DEF from synthesis
if {[file exists /home/EDA/ibex_work_upload/result/scanchain/data/ibex_core.scan.def]} {
    loadDef -scan /home/EDA/ibex_work_upload/result/scanchain/data/ibex_core.scan.def
    puts "Scan chains loaded from synthesis DEF"
} else {
    puts "Warning: No scan DEF file found - ignoring scan chains for placement"
    setPlaceMode -place_global_ignore_scan true
}

# Now retry placement
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

place_opt_design

saveDesign result/pr/data/placement.enc
puts "STAGE 4 COMPLETE - placement.enc saved"
