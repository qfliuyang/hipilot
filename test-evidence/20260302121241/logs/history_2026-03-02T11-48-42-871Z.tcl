# Sent at: 2026-03-02T11:48:42.871Z
# Pane: eda

# Check actual placement status
set cell_count [dbGet head.insts.count]
set placed_count [dbGet head.insts.placed.count]
puts "Total instances: $cell_count"
puts "Placed instances: $placed_count"

if {$placed_count < 100} {
    puts "Design is NOT placed. Running placement now..."
    # Force placement by removing scan chain assertions
    setPlaceMode -reset
    setPlaceMode -place_global_ignore_scan true
    setPlaceMode -place_global_place_io_pins false
    setDesignMode -process 130
    
    # Don't set constraints first - just place
    place_design -noPrePlaceOpt
}

puts "Checking placement again..."
set placed_count2 [dbGet head.insts.placed.count]
puts "Placed instances after placement: $placed_count2"

if {$placed_count2 > 100} {
    puts "Placement successful! Proceeding to CTS..."
    
    # CTS
    set_ccopt_property use_inverters true
    create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
    source result/pr/data/clk.spec
    ccopt_design -cts
    
    saveDesign result/pr/data/cts.enc
    puts "=== FLOW COMPLETE UP TO CTS ==="
    exit
} else {
    puts "ERROR: Placement still failed"
    exit
}