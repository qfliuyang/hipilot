##############################################################################
# innovus_report_area.tcl
# HiPilot Template: Area Report in Cadence Innovus
#
# Description:
#   Reports physical design area metrics using report_area and summaryReport.
#   Produces cell count, core utilization, and optional hierarchical area
#   breakdown per module. Suitable for area sign-off and capacity planning.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_report_area.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
##############################################################################

##############################################################################
# PARAMETERS - Edit these before sourcing or let HiPilot substitute them
##############################################################################

# Enable hierarchical area breakdown: 1 = yes, 0 = top-level only
set hierarchical        1

# Number of hierarchy levels to report (0 = all levels)
set hierarchy_depth     3

# Output report file for consolidated area summary
set report_file         "./reports/area_report.rpt"

# Report prefix for sub-reports
set report_prefix       "./reports/area"

# Include filler cells in utilization calculation: 1 = yes, 0 = no
set include_fillers     0

# Minimum instance area threshold for hierarchy report (um^2; filters small cells)
set min_area_threshold  100.0

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp [exec date +%Y%m%d_%H%M%S]
file mkdir [file dirname $report_prefix]

##############################################################################
# PRE-CHECK
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Area Report"
puts "INFO: Timestamp      : $timestamp"
puts "INFO: Hierarchical   : $hierarchical"
puts "INFO: Hierarchy depth: $hierarchy_depth"
puts "INFO: Include fillers: $include_fillers"
puts "INFO: =================================================="

# Confirm design is loaded
set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Please load a design before generating area report."
}
puts "INFO: Design: $design_name"

# Check floorplan exists
set core_box [dbget top.fPlan.coreBox -e]
if { $core_box eq "" || $core_box eq {} } {
    puts "WARNING: No floorplan found. Utilization will be zero or inaccurate."
    puts "         Run floorplanDesign or restoreDesign before this script."
}

##############################################################################
# STEP 1: report_area - Top-level area summary
##############################################################################

puts "\nINFO: ---- Step 1: report_area (top-level) ----"

# report_area reports:
# - Core area (inside power ring)
# - Die area (full chip boundary)
# - Standard cell area
# - Macro/block area
# - Filler area (if placed)
# - Core utilization (%)
report_area \
    > "${report_prefix}_area_${timestamp}.rpt"
puts "INFO: Area report written to: ${report_prefix}_area_${timestamp}.rpt"

##############################################################################
# STEP 2: summaryReport - Comprehensive design summary
##############################################################################

puts "\nINFO: ---- Step 2: summaryReport ----"

# summaryReport provides a broader design summary including:
# - Instance count by type
# - Net statistics
# - Timing overview
# - Power summary
# - DRC marker count
summaryReport \
    -noHtml \
    > "${report_prefix}_summary_${timestamp}.rpt"
puts "INFO: Summary report written to: ${report_prefix}_summary_${timestamp}.rpt"

##############################################################################
# STEP 3: Hierarchical area breakdown
##############################################################################

if { $hierarchical } {
    puts "\nINFO: ---- Step 3: Hierarchical area breakdown ----"

    # report_area -hier provides per-module area breakdown.
    # Each module shows: number of cells, area, and % of total.
    # This helps identify area hotspots in the hierarchy.
    if { $hierarchy_depth == 0 } {
        report_area \
            -hier \
            > "${report_prefix}_hierarchy_${timestamp}.rpt"
    } else {
        report_area \
            -hier \
            -depth $hierarchy_depth \
            > "${report_prefix}_hierarchy_${timestamp}.rpt"
    }
    puts "INFO: Hierarchy report written to: ${report_prefix}_hierarchy_${timestamp}.rpt"
} else {
    puts "\nINFO: Step 3: Hierarchical report SKIPPED (hierarchical=0)"
}

##############################################################################
# STEP 4: Extract area metrics from Innovus database
##############################################################################

puts "\nINFO: ---- Step 4: Extracting area metrics ----"

# Query the Innovus internal floorplan database for area values.
# All values are in um^2.
set core_box    [dbget top.fPlan.coreBox   -e]
set die_box     [dbget top.fPlan.dieBox    -e]

# Compute core area from bounding box coordinates [x1 y1 x2 y2]
if { $core_box ne "" && [llength $core_box] == 4 } {
    set core_w    [expr {[lindex $core_box 2] - [lindex $core_box 0]}]
    set core_h    [expr {[lindex $core_box 3] - [lindex $core_box 1]}]
    set core_area [expr {$core_w * $core_h}]
} else {
    set core_area 0.0
}

if { $die_box ne "" && [llength $die_box] == 4 } {
    set die_w    [expr {[lindex $die_box 2] - [lindex $die_box 0]}]
    set die_h    [expr {[lindex $die_box 3] - [lindex $die_box 1]}]
    set die_area [expr {$die_w * $die_h}]
} else {
    set die_area 0.0
}

# Standard cell area: sum of all placed standard cell bounding boxes
set stdcell_instances [dbget top.insts.cell.subClass core -p]
set stdcell_area 0.0
foreach inst $stdcell_instances {
    set iarea [dbget ${inst}.cell.size_x -e]
    set iarey [dbget ${inst}.cell.size_y -e]
    if { $iarea ne "" && $iarey ne "" } {
        set stdcell_area [expr {$stdcell_area + $iarea * $iarey}]
    }
}

# Macro area: sum of hard macro bounding boxes
set macro_instances [dbget top.insts.cell.subClass block -p]
set macro_area 0.0
foreach inst $macro_instances {
    set mx [dbget ${inst}.cell.size_x -e]
    set my [dbget ${inst}.cell.size_y -e]
    if { $mx ne "" && $my ne "" } {
        set macro_area [expr {$macro_area + $mx * $my}]
    }
}

# Cell counts
set total_cells   [llength [dbget top.insts.cell.subClass core  -e]]
set macro_cells   [llength [dbget top.insts.cell.subClass block -e]]
set filler_cells  [llength [dbget top.insts.cell.subClass filler -e]]

# Utilization
if { $core_area > 0 } {
    if { $include_fillers } {
        set total_placed_area [expr {$stdcell_area + $macro_area}]
    } else {
        set total_placed_area [expr {$stdcell_area + $macro_area}]
    }
    set utilization  [expr {$total_placed_area / $core_area * 100.0}]
    set sc_util      [expr {$core_area > 0 ? $stdcell_area / $core_area * 100.0 : 0.0}]
} else {
    set utilization 0.0
    set sc_util     0.0
}

##############################################################################
# STEP 5: Write consolidated report
##############################################################################

set rpt_fd [open $report_file w]
puts $rpt_fd "##############################################################################"
puts $rpt_fd "# Area Report - HiPilot"
puts $rpt_fd "# Design    : $design_name"
puts $rpt_fd "# Timestamp : $timestamp"
puts $rpt_fd "# Date      : [exec date]"
puts $rpt_fd "##############################################################################"
puts $rpt_fd ""
puts $rpt_fd "AREA SUMMARY"
puts $rpt_fd [format "  %-30s %14s" "Metric" "Value (um^2)"]
puts $rpt_fd [format "  %-30s %14s" [string repeat "-" 30] [string repeat "-" 14]]
puts $rpt_fd [format "  %-30s %14.4f" "Core Area"          $core_area]
puts $rpt_fd [format "  %-30s %14.4f" "Die Area"            $die_area]
puts $rpt_fd [format "  %-30s %14.4f" "Standard Cell Area"  $stdcell_area]
puts $rpt_fd [format "  %-30s %14.4f" "Macro Area"          $macro_area]
puts $rpt_fd ""
puts $rpt_fd [format "  %-30s %13.2f%%" "Total Utilization"   $utilization]
puts $rpt_fd [format "  %-30s %13.2f%%" "StdCell Utilization" $sc_util]
puts $rpt_fd ""
puts $rpt_fd "CELL COUNT"
puts $rpt_fd [format "  %-30s %14d" "Standard Cells"   $total_cells]
puts $rpt_fd [format "  %-30s %14d" "Macro/Block Cells" $macro_cells]
puts $rpt_fd [format "  %-30s %14d" "Filler Cells"      $filler_cells]
puts $rpt_fd [format "  %-30s %14d" "Total"             [expr {$total_cells + $macro_cells}]]
puts $rpt_fd ""
puts $rpt_fd "Sub-reports:"
puts $rpt_fd "  Area     : ${report_prefix}_area_${timestamp}.rpt"
puts $rpt_fd "  Summary  : ${report_prefix}_summary_${timestamp}.rpt"
if {$hierarchical} {
    puts $rpt_fd "  Hierarchy: ${report_prefix}_hierarchy_${timestamp}.rpt"
}
close $rpt_fd

##############################################################################
# QoR SUMMARY
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: AREA REPORT SUMMARY"
puts "INFO: =================================================="
puts [format "INFO: %-30s %14.4f um^2" "Core Area"           $core_area]
puts [format "INFO: %-30s %14.4f um^2" "Die Area"             $die_area]
puts [format "INFO: %-30s %14.4f um^2" "Standard Cell Area"   $stdcell_area]
puts [format "INFO: %-30s %14.4f um^2" "Macro Area"           $macro_area]
puts [format "INFO: %-30s %13.2f%%"    "Total Utilization"    $utilization]
puts [format "INFO: %-30s %13.2f%%"    "StdCell Utilization"  $sc_util]
puts "INFO: --------------------------------------------------"
puts [format "INFO: %-30s %14d"        "Standard Cells"       $total_cells]
puts [format "INFO: %-30s %14d"        "Macro/Block Cells"    $macro_cells]
puts [format "INFO: %-30s %14d"        "Filler Cells"         $filler_cells]
puts "INFO: =================================================="

if { $utilization > 90.0 } {
    puts "WARNING: Utilization > 90%. Routing congestion likely. Consider enlarging floorplan."
} elseif { $utilization < 40.0 } {
    puts "INFO: Utilization < 40%. Floorplan may be oversized."
} else {
    puts "INFO: Utilization is within normal range (40-90%)."
}

puts "INFO: Report: $report_file"
puts "INFO: innovus_report_area.tcl COMPLETE"
puts "INFO: =================================================="
