# Sent at: 2026-03-02T11:47:21.539Z
# Pane: eda

# Load the scan chain DEF file from synthesis
puts "Loading scan DEF file..."
loadDefFile /home/EDA/ibex_work_upload/result/scanchain/data/ibex_core.scan.def
puts "Scan DEF loaded"

# Now run placement
puts "Running placement..."
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan false
setPlaceMode -place_global_place_io_pins false
setDesignMode -process 130
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]

place_design
puts "PLACEMENT COMPLETE"

saveDesign result/pr/data/placement.enc

# CTS
puts "Starting CTS..."
set_ccopt_property use_inverters true
create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
saveDesign result/pr/data/cts.enc
puts "CTS COMPLETE - checkpoint saved at result/pr/data/cts.enc"
exit