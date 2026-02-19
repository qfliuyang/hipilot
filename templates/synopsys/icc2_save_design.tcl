##############################################################################
# icc2_save_design.tcl
# HiPilot Template: Save Design Checkpoint in Synopsys IC Compiler II
#
# Description:
#   Saves the current design state as a named block label in the NDM
#   library using save_block -as. Exports QoR snapshot reports at the
#   checkpoint so the state is reproducible and reviewable. Also supports
#   optional DEF/GDS export for handoff to downstream tools.
#
# Usage:
#   source icc2_save_design.tcl
#   -- or --
#   icc2_shell> source icc2_save_design.tcl
#
# Prerequisites:
#   - Design must be loaded (open_lib / open_block already called)
#   - NDM library must be writeable
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Label name for this checkpoint (appended to block name as <block>:<label>)
# Example: "post_cts_opt" -> saves as "ibex_top:post_cts_opt"
set checkpoint_name     "checkpoint"

# Directory where exported files (DEF, GDS, reports) will be written
set save_path           "./checkpoints"

# Export DEF file at checkpoint: 1 = yes, 0 = skip
set export_def          1

# Export GDSII file at checkpoint: 1 = yes, 0 = skip (slow for large designs)
set export_gds          0

# Export netlist (Verilog) at checkpoint: 1 = yes, 0 = skip
set export_netlist      1

# Run timing QoR snapshot before saving: 1 = yes, 0 = skip
set snapshot_timing     1

# Run DRC check snapshot before saving: 1 = yes, 0 = skip
set snapshot_drc        1

# Compress the NDM block after saving (saves disk space): 1 = yes, 0 = no
set compress_block      1

##############################################################################
# SECTION 2: PRE-CHECK
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_save_design.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  checkpoint_name = $checkpoint_name"
puts "  save_path       = $save_path"
puts "  export_def      = $export_def"
puts "  export_gds      = $export_gds"
puts "  export_netlist  = $export_netlist"
puts "  snapshot_timing = $snapshot_timing"
puts "  snapshot_drc    = $snapshot_drc"
puts ""

# Verify design is open
set current_design_name [get_attribute [current_design] full_name]
if {$current_design_name eq ""} {
    error "ERROR: No design is currently open. Open a design before saving."
}
puts "Pre-check: Design loaded = $current_design_name"

# Create checkpoint and report directories
set chk_dir  "${save_path}/${checkpoint_name}"
set rpt_dir  "${chk_dir}/reports"
file mkdir $chk_dir
file mkdir $rpt_dir
puts "Pre-check: Checkpoint directory = $chk_dir"
puts ""

##############################################################################
# SECTION 3: PRE-SAVE QoR SNAPSHOT
# Capture timing and DRC status before saving so the checkpoint is annotated.
##############################################################################

if {$snapshot_timing} {
    puts "======================================================================"
    puts "STEP 1: Timing QoR snapshot"
    puts "======================================================================"

    # Update timing before snapshot to ensure freshness
    update_timing -full

    # Write QoR summary to checkpoint report directory
    report_qor \
        -summary \
        > "${rpt_dir}/timing_qor.rpt"
    puts "  Timing QoR written to: ${rpt_dir}/timing_qor.rpt"

    # Capture WNS/TNS for summary
    set snap_wns [get_attribute \
        [get_timing_paths -delay_type max -max_paths 1 -quiet] \
        slack -quiet]
    set snap_hold_wns [get_attribute \
        [get_timing_paths -delay_type min -max_paths 1 -quiet] \
        slack -quiet]
    if {$snap_wns      eq ""} { set snap_wns      "N/A" }
    if {$snap_hold_wns eq ""} { set snap_hold_wns "N/A" }
    puts "  Setup WNS = $snap_wns ns"
    puts "  Hold  WNS = $snap_hold_wns ns"
} else {
    puts "STEP 1: Timing snapshot SKIPPED (snapshot_timing=0)"
    set snap_wns      "N/A"
    set snap_hold_wns "N/A"
}

if {$snapshot_drc} {
    puts ""
    puts "======================================================================"
    puts "STEP 2: DRC snapshot"
    puts "======================================================================"

    # Quick routing DRC check for checkpoint annotation
    check_routes \
        -open_net_severity  error \
        -short_severity     error \
        > "${rpt_dir}/drc_check.rpt"
    puts "  DRC report written to: ${rpt_dir}/drc_check.rpt"
} else {
    puts "STEP 2: DRC snapshot SKIPPED (snapshot_drc=0)"
}

##############################################################################
# SECTION 4: SAVE BLOCK (NDM checkpoint)
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 3: Saving block as '${current_design_name}:${checkpoint_name}'"
puts "======================================================================"

# save_block -as <label> writes the current design state as a new label
# in the NDM library. This is non-destructive; existing labels are preserved.
# -compress reduces the on-disk size of the saved block.
if {$compress_block} {
    save_block \
        -as         $checkpoint_name \
        -compress
} else {
    save_block \
        -as         $checkpoint_name
}
puts "  Block saved as: ${current_design_name}:${checkpoint_name}"

##############################################################################
# SECTION 5: EXPORT DEF
##############################################################################

if {$export_def} {
    puts ""
    puts "======================================================================"
    puts "STEP 4: Exporting DEF file"
    puts "======================================================================"

    set def_file "${chk_dir}/${current_design_name}_${checkpoint_name}.def"

    # write_def exports the physical design in DEF format.
    # -version 5.8: standard DEF version compatible with most tools.
    # -include_tech_via_definitions: embeds via definitions in the DEF.
    write_def \
        -version                        5.8 \
        -include_tech_via_definitions \
        -output                         $def_file
    puts "  DEF exported to: $def_file"
} else {
    puts "STEP 4: DEF export SKIPPED (export_def=0)"
}

##############################################################################
# SECTION 6: EXPORT NETLIST
##############################################################################

if {$export_netlist} {
    puts ""
    puts "======================================================================"
    puts "STEP 5: Exporting Verilog netlist"
    puts "======================================================================"

    set vg_file "${chk_dir}/${current_design_name}_${checkpoint_name}.v"

    # write_verilog exports the gate-level netlist.
    # -hierarchy: include hierarchy; -pg_netlist_only: only power/ground connections
    write_verilog \
        -hierarchy          all \
        -include_pg_netlist \
        $vg_file
    puts "  Netlist exported to: $vg_file"
} else {
    puts "STEP 5: Netlist export SKIPPED (export_netlist=0)"
}

##############################################################################
# SECTION 7: EXPORT GDS (optional, slow)
##############################################################################

if {$export_gds} {
    puts ""
    puts "======================================================================"
    puts "STEP 6: Exporting GDSII (this may take several minutes)"
    puts "======================================================================"

    set gds_file "${chk_dir}/${current_design_name}_${checkpoint_name}.gds"

    # write_gds exports the physical layout in GDSII format.
    # Used for mask data preparation and LVS/DRC with Calibre.
    write_gds \
        -hierarchy          all \
        -units              user \
        $gds_file
    puts "  GDS exported to: $gds_file"
} else {
    puts "STEP 6: GDS export SKIPPED (export_gds=0)"
}

##############################################################################
# SECTION 8: WRITE CHECKPOINT MANIFEST
##############################################################################

set manifest_file "${chk_dir}/CHECKPOINT_INFO.txt"
set mfd [open $manifest_file w]
puts $mfd "HiPilot Checkpoint Manifest"
puts $mfd "==========================="
puts $mfd "Design         : $current_design_name"
puts $mfd "Checkpoint     : $checkpoint_name"
puts $mfd "Block label    : ${current_design_name}:${checkpoint_name}"
puts $mfd "Saved          : [exec date]"
puts $mfd ""
puts $mfd "QoR at checkpoint:"
puts $mfd "  Setup WNS    : $snap_wns ns"
puts $mfd "  Hold  WNS    : $snap_hold_wns ns"
puts $mfd ""
puts $mfd "Exports:"
if {$export_def}     { puts $mfd "  DEF          : ${current_design_name}_${checkpoint_name}.def" }
if {$export_netlist} { puts $mfd "  Verilog      : ${current_design_name}_${checkpoint_name}.v" }
if {$export_gds}     { puts $mfd "  GDS          : ${current_design_name}_${checkpoint_name}.gds" }
puts $mfd ""
puts $mfd "Reports:"
if {$snapshot_timing} { puts $mfd "  Timing QoR   : reports/timing_qor.rpt" }
if {$snapshot_drc}    { puts $mfd "  DRC          : reports/drc_check.rpt" }
close $mfd
puts "  Manifest written to: $manifest_file"

##############################################################################
# SECTION 9: QoR SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "SAVE DESIGN SUMMARY"
puts "======================================================================"
puts [format "  %-25s %s" "Design"        $current_design_name]
puts [format "  %-25s %s" "Checkpoint"    $checkpoint_name]
puts [format "  %-25s %s" "Block label"   "${current_design_name}:${checkpoint_name}"]
puts [format "  %-25s %s" "Saved to dir"  $chk_dir]
puts [format "  %-25s %s" "Setup WNS"     "$snap_wns ns"]
puts [format "  %-25s %s" "Hold WNS"      "$snap_hold_wns ns"]
puts "----------------------------------------------------------------------"
puts "  Exports generated:"
if {$export_def}     { puts "    DEF, " }
if {$export_netlist} { puts "    Verilog, " }
if {$export_gds}     { puts "    GDS, " }
puts "======================================================================"
puts "RESULT: Checkpoint '${current_design_name}:${checkpoint_name}' saved successfully."
puts "  To restore: open_lib $lib_path ; open_block ${current_design_name}:${checkpoint_name}"
puts ""
puts "HiPilot: icc2_save_design.tcl COMPLETE"
puts "======================================================================"
