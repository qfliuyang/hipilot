# Sent at: 2026-03-02T14:51:07.016Z
# Pane: eda

# Create a dummy scan chain to satisfy Innovus
# Just pick one flop as start and end
set all_flops [all_registers -edge_triggered]
if {[sizeof_collection $all_flops] > 0} {
    set first_flop [index_collection $all_flops 0]
    set last_flop [index_collection $all_flops [expr {[sizeof_collection $all_flops] - 1}]]
    specifyScanChain chain1 -start $first_flop -stop $last_flop
}

# Now run placement
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
