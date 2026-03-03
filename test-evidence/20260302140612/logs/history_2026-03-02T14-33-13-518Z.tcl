# Sent at: 2026-03-02T14:33:13.518Z
# Pane: eda

# Delete undefined scan chains from DFT synthesis
specifyScanChain -deleteAllScanChains

# Now retry placement
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true -place_global_reorder_scan false
setPlaceMode -place_global_place_io_pins false -place_detail_legalization_inst_gap 2
setRouteMode -earlyGlobalMinRouteLayer 2 -earlyGlobalMaxRouteLayer 5
setDesignMode -process 130

place_opt_design

saveDesign result/pr/data/placement.enc
puts "STAGE 4 COMPLETE - placement.enc saved"
