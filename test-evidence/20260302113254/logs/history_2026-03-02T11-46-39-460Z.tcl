# Sent at: 2026-03-02T11:46:39.460Z
# Pane: eda

# Try to specify scan chains to satisfy the checker
# Get all scan flops and create a simple chain
set scan_flops [all_registers -filter "is_scan_cell == true"]
puts "Found [llength $scan_flops] scan flops"

# Create a simple scan chain specification
if {[llength $scan_flops] > 0} {
    specifyScanChain ibex_scan -class int  -terminator tx_scan_scan_chain_single_bit_inst_SI terminator_cell_name=A
}

# Now try placement
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setDesignMode -process 130

place_design
puts "PLACEMENT COMPLETE"
saveDesign result/pr/data/placement.enc
exit