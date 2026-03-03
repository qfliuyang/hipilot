# Sent at: 2026-03-02T14:35:33.190Z
# Pane: eda

# Force placement to ignore all scan chain issues
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false
setPlaceMode -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

# Set optimization mode to ignore scan
setOptMode -ignoreScanChainsForTiming true

# Run placement
place_opt_design

saveDesign result/pr/data/placement.enc
puts "STAGE 4 COMPLETE - placement.enc saved"
