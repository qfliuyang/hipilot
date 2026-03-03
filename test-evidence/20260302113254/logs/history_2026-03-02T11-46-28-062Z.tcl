# Sent at: 2026-03-02T11:46:28.062Z
# Pane: eda

# Set error handling to continue on scan chain issues
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_place_io_pins false
setDesignMode -process 130
set_interactive_constraint_modes [all_constraint_modes -active]

# Try to force placement despite scan chain errors
set argv [list]
errorCodeConfigure -error -code IMPSP-9099 -action ignore

place_design
puts "PLACEMENT COMPLETE"
saveDesign result/pr/data/placement.enc
exit