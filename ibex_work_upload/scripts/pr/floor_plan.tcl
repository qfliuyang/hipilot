set begin [clock format [clock seconds] -format %Y%m%d_%I:%M_%p]
puts "The FloorPlan Start: $begin"
source $::env(RESULT_DIR)/pr/data/init_design.enc

# -------------------------------------------------------------
# Define the block die area
# -------------------------------------------------------------
floorPlan -site $::env(PLACE_SITE) -su 1 $::env(PLACE_DENSITY) 1 1 1 1

# -------------------------------------------------------------
# Place the block port
# -------------------------------------------------------------
if {[info exists ::env(IO_FILE)]} {
    if {$::env(IO_FILE)!=""} {
        loadIoFile $::env(IO_FILE)
    } else {
        source $::env(SCRIPTS_DIR)/pr/place_io.tcl
    }
} else {
    source $::env(SCRIPTS_DIR)/pr/place_io.tcl
}

# -------------------------------------------------------------
# Set the dont use cell
# -------------------------------------------------------------
foreach cell [split $::env(DONT_USE_CELLS)] {
    get_lib_cell  */$cell
    set_dont_use [get_lib_cells */$cell] true
}

# -------------------------------------------------------------
# Add endcap cell ToDo
# -------------------------------------------------------------
set endcap_right "right_tap_cell_name"
set endcap_left "left_tap_cell_name"
set endcap_top "left_tap_cell_name"
set endcap_bottom "left_tap_cell_name"
setEndCapMode -reset
setEndCapMode -leftEdge $endcap_left -rightEdge $endcap_right -topEdge $endcap_top -bottomEdge $endcap_bottom -prefix ENDCAP

# -------------------------------------------------------------
# Add WellTap cell
# -------------------------------------------------------------
#addWellTap -cell $::env(TAP_CELL_NAME) -cellInterval 60 -prefix TAP

# -------------------------------------------------------------
# save Design
# -------------------------------------------------------------
saveDesign $::env(RESULT_DIR)/pr/data/floor_plan.enc
defOut -floorplan -noStdCells $::env(RESULT_DIR)/pr/data/ibex.floorplan.def

set end [clock format [clock seconds] -format %Y%m%d_%I:%M_%p]
puts "The FloorPlan End: $end"
exit
