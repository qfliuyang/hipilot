##############################################################################
# innovus_save_design.tcl
# HiPilot Template: Save Design Checkpoint in Cadence Innovus
#
# Description:
#   Saves the current Innovus design state as a named checkpoint using
#   saveDesign. Exports QoR snapshot reports (timing, DRC) at the
#   checkpoint so the state is reproducible and reviewable. Optionally
#   exports DEF and GDS files for downstream tool handoff.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_save_design.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
##############################################################################

##############################################################################
# PARAMETERS - Edit these before sourcing or let HiPilot substitute them
##############################################################################

# Name for this checkpoint (used as directory and file name label)
# Example: "post_cts_opt", "post_route", "pre_signoff"
set checkpoint_name     "checkpoint"

# Parent directory where the checkpoint directory will be created
set save_dir            "./checkpoints"

# Export DEF file at checkpoint: 1 = yes, 0 = skip
set export_def          1

# Export GDSII file at checkpoint: 1 = yes, 0 = skip (slow for large designs)
set export_gds          0

# Export gate-level Verilog netlist: 1 = yes, 0 = skip
set export_netlist      1

# Run timing QoR snapshot before saving: 1 = yes, 0 = skip
set snapshot_timing     1

# Run DRC check snapshot before saving: 1 = yes, 0 = skip
set snapshot_drc        1

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp   [exec date +%Y%m%d_%H%M%S]
set chk_dir     "${save_dir}/${checkpoint_name}"
set rpt_dir     "${chk_dir}/reports"

file mkdir $chk_dir
file mkdir $rpt_dir

##############################################################################
# PRE-CHECK
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Save Design"
puts "INFO: Timestamp      : $timestamp"
puts "INFO: Checkpoint     : $checkpoint_name"
puts "INFO: Save directory : $chk_dir"
puts "INFO: Export DEF     : $export_def"
puts "INFO: Export GDS     : $export_gds"
puts "INFO: Export netlist : $export_netlist"
puts "INFO: =================================================="

# Confirm design is loaded
set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Open a design before saving."
}
puts "INFO: Design: $design_name"
puts ""

##############################################################################
# STEP 1: Pre-save timing QoR snapshot
##############################################################################

if { $snapshot_timing } {
    puts "INFO: ---- Step 1: Timing QoR snapshot ----"

    # Run setup timing analysis before saving
    timeDesign -postRoute -setup -outDir $rpt_dir
    puts "INFO: Setup timing analysis complete"

    # Also run hold analysis
    timeDesign -postRoute -hold -outDir $rpt_dir
    puts "INFO: Hold timing analysis complete"

    # Capture WNS/TNS for manifest
    set snap_setup_wns [dbget [dbget head.timingReports.reportName setup -p].wns -e]
    set snap_hold_wns  [dbget [dbget head.timingReports.reportName hold  -p].wns -e]
    if { $snap_setup_wns eq "" || $snap_setup_wns eq {} } { set snap_setup_wns "N/A" }
    if { $snap_hold_wns  eq "" || $snap_hold_wns  eq {} } { set snap_hold_wns  "N/A" }

    puts "INFO: Setup WNS = $snap_setup_wns ns"
    puts "INFO: Hold  WNS = $snap_hold_wns ns"
} else {
    puts "INFO: Step 1: Timing snapshot SKIPPED (snapshot_timing=0)"
    set snap_setup_wns "N/A"
    set snap_hold_wns  "N/A"
}

##############################################################################
# STEP 2: Pre-save DRC snapshot
##############################################################################

if { $snapshot_drc } {
    puts "\nINFO: ---- Step 2: DRC snapshot ----"

    # Quick verify_drc for checkpoint annotation
    verify_drc \
        -limit      1000 \
        -reportFile "${rpt_dir}/drc_${timestamp}.drc"
    puts "INFO: DRC snapshot written to: ${rpt_dir}/drc_${timestamp}.drc"

    # Get total violation count
    set drc_total [llength [dbget top.markers -e]]
    puts "INFO: Total DRC markers: $drc_total"
} else {
    puts "\nINFO: Step 2: DRC snapshot SKIPPED (snapshot_drc=0)"
    set drc_total "N/A"
}

##############################################################################
# STEP 3: saveDesign - Write Innovus checkpoint
##############################################################################

puts "\nINFO: ---- Step 3: saveDesign ----"

# saveDesign writes the complete design state to a directory.
# Innovus creates: <design>.enc and <design>.enc.dat
# The .enc.dat is the binary checkpoint; .enc is a wrapper script.
# restoreDesign <file>.enc.dat <top_cell> is used to reload.
saveDesign "${chk_dir}/${design_name}"
puts "INFO: Design saved to: ${chk_dir}/${design_name}"
puts "INFO: To restore: restoreDesign ${chk_dir}/${design_name}.enc.dat $design_name"

##############################################################################
# STEP 4: Export DEF
##############################################################################

if { $export_def } {
    puts "\nINFO: ---- Step 4: Exporting DEF ----"

    set def_file "${chk_dir}/${design_name}_${checkpoint_name}.def"

    # defOut exports the current design state in DEF format.
    # -routing : include routing information in the DEF
    # -floorplan: include floorplan data
    defOut \
        -routing \
        -floorplan \
        $def_file
    puts "INFO: DEF exported to: $def_file"
} else {
    puts "\nINFO: Step 4: DEF export SKIPPED (export_def=0)"
}

##############################################################################
# STEP 5: Export Verilog netlist
##############################################################################

if { $export_netlist } {
    puts "\nINFO: ---- Step 5: Exporting Verilog netlist ----"

    set vg_file "${chk_dir}/${design_name}_${checkpoint_name}.v"

    # saveNetlist writes the gate-level netlist in Verilog format.
    # Used for LVS, simulation, and STA in external tools.
    saveNetlist \
        -includePowerGround \
        $vg_file
    puts "INFO: Verilog netlist exported to: $vg_file"
} else {
    puts "\nINFO: Step 5: Netlist export SKIPPED (export_netlist=0)"
}

##############################################################################
# STEP 6: Export GDS (optional, can be slow)
##############################################################################

if { $export_gds } {
    puts "\nINFO: ---- Step 6: Exporting GDS (may take several minutes) ----"

    set gds_file "${chk_dir}/${design_name}_${checkpoint_name}.gds"

    # streamOut exports the physical layout in GDSII format.
    # -mapFile: layer map from Innovus layer names to GDS layer numbers
    # -libName: GDS library name for the top cell
    # -merge  : include all referenced cell GDS (requires access to cell GDS)
    streamOut \
        -mapFile    "" \
        -libName    $design_name \
        -units      1000 \
        $gds_file
    puts "INFO: GDS exported to: $gds_file"
} else {
    puts "\nINFO: Step 6: GDS export SKIPPED (export_gds=0)"
}

##############################################################################
# STEP 7: Write checkpoint manifest
##############################################################################

set manifest_file "${chk_dir}/CHECKPOINT_INFO.txt"
set mfd [open $manifest_file w]
puts $mfd "Innovus Checkpoint Manifest - HiPilot"
puts $mfd "======================================"
puts $mfd "Design       : $design_name"
puts $mfd "Checkpoint   : $checkpoint_name"
puts $mfd "Saved        : [exec date]"
puts $mfd "Innovus enc  : ${chk_dir}/${design_name}.enc"
puts $mfd ""
puts $mfd "QoR at checkpoint:"
puts $mfd "  Setup WNS  : $snap_setup_wns ns"
puts $mfd "  Hold  WNS  : $snap_hold_wns ns"
puts $mfd "  DRC total  : $drc_total"
puts $mfd ""
puts $mfd "Exports:"
if {$export_def}     { puts $mfd "  DEF        : ${design_name}_${checkpoint_name}.def" }
if {$export_netlist} { puts $mfd "  Verilog    : ${design_name}_${checkpoint_name}.v" }
if {$export_gds}     { puts $mfd "  GDS        : ${design_name}_${checkpoint_name}.gds" }
puts $mfd ""
puts $mfd "Reports:"
if {$snapshot_timing} { puts $mfd "  Timing     : reports/ (timeDesign output)" }
if {$snapshot_drc}    { puts $mfd "  DRC        : reports/drc_${timestamp}.drc" }
puts $mfd ""
puts $mfd "To restore this checkpoint:"
puts $mfd "  restoreDesign ${chk_dir}/${design_name}.enc.dat $design_name"
close $mfd
puts "INFO: Manifest written to: $manifest_file"

##############################################################################
# QoR SUMMARY
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: SAVE DESIGN SUMMARY"
puts "INFO: =================================================="
puts [format "INFO: %-25s %s" "Design"       $design_name]
puts [format "INFO: %-25s %s" "Checkpoint"   $checkpoint_name]
puts [format "INFO: %-25s %s" "Saved to"     $chk_dir]
puts [format "INFO: %-25s %s" "Setup WNS"    "$snap_setup_wns ns"]
puts [format "INFO: %-25s %s" "Hold WNS"     "$snap_hold_wns ns"]
puts [format "INFO: %-25s %s" "DRC markers"  $drc_total]
puts "INFO: =================================================="
puts "INFO: RESULT: Checkpoint '$checkpoint_name' saved successfully."
puts "INFO: Restore: restoreDesign ${chk_dir}/${design_name}.enc.dat $design_name"
puts "INFO: =================================================="
puts "INFO: innovus_save_design.tcl COMPLETE"
puts "INFO: =================================================="
