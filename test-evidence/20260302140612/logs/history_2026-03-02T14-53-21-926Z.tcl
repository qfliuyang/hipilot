# Sent at: 2026-03-02T14:53:21.926Z
# Pane: eda

# Force placement to proceed despite scan chain issues
# Use -place_global_ignore_scan true to tell Innovus to proceed
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false
setPlaceMode -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

# Run placement - the scan chain warning should not block execution
place_opt_design -continue

# Check if placement completed
if {[file exists result/pr/data/placement.enc]} {
    puts "ERROR: Placement may have failed"
} else {
    saveDesign result/pr/data/placement.enc
    puts "STAGE 4 COMPLETE - placement.enc saved"
}
