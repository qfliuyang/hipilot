# Sent at: 2026-03-02T11:48:52.722Z
# Pane: eda

# Check placement status
set all_cells [get_cells * -quiet]
set placed_cells [get_cells * -quiet -filter "is_placed == true"]
puts "Total cells: [llength $all_cells]"
puts "Placed cells: [llength $placed_cells]"

if {[llength $placed_cells] < 100} {
    puts "Design is NOT placed. Running placement..."
    setPlaceMode -reset
    setPlaceMode -place_global_ignore_scan true
    setPlaceMode -place_global_place_io_pins false
    setDesignMode -process 130
    
    place_design -noPrePlaceOpt
}

# Check again
set placed_cells2 [get_cells * -quiet -filter "is_placed == true"]
puts "After placement: [llength $placed_cells2] cells placed"

if {[llength $placed_cells2] > 100} {
    puts "PLACEMENT SUCCESSFUL - Running CTS..."
    
    set_ccopt_property use_inverters true
    create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
    source result/pr/data/clk.spec
    ccopt_design -cts
    
    saveDesign result/pr/data/cts.enc
    puts "=== CTS COMPLETE ==="
}

exit