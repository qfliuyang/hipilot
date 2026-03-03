# Sent at: 2026-03-02T11:45:54.122Z
# Pane: eda

setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_place_io_pins false
setDesignMode -process 130
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]

place_design
puts "PLACEMENT COMPLETE"
exit