# Sent at: 2026-03-02T11:47:09.965Z
# Pane: eda

# Check if any cells are placed
set cell_count [llength [get_cells -filter "is_placed == true"]]
puts "Placed cells: $cell_count"

if {$cell_count < 100} {
    puts "Running placement..."
    setPlaceMode -reset
    setPlaceMode -place_global_ignore_scan true
    setPlaceMode -place_global_place_io_pins false
    setDesignMode -process 130
    set_interactive_constraint_modes [all_constraint_modes -active]
    set_propagated_clock [all_clocks]
    
    place_design
}

puts "Saving placement checkpoint..."
saveDesign result/pr/data/placement.enc

# CTS
puts "Starting CTS..."
set_ccopt_property use_inverters true
create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

saveDesign result/pr/data/cts.enc
puts "CTS COMPLETE - checkpoint saved"
exit