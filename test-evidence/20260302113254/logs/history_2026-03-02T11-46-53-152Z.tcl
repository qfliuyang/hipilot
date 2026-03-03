# Sent at: 2026-03-02T11:46:53.152Z
# Pane: eda

# Check if placement was done
set placed [dbGet top.fInst.placed.count]
puts "Placed instances: $placed"

if {$placed > 0} {
    puts "Design already placed! Saving checkpoint."
    saveDesign result/pr/data/placement.enc
} else {
    puts "Design not placed. Running placement now..."
    setPlaceMode -place_global_ignore_scan true
    place_design
    saveDesign result/pr/data/placement.enc
}

# Continue to CTS
set_ccopt_property use_inverters true
create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
saveDesign result/pr/data/cts.enc
puts "CTS COMPLETE"
exit