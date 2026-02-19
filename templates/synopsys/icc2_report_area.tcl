##############################################################################
# icc2_report_area.tcl
# HiPilot Template: Area Report in Synopsys IC Compiler II
#
# Description:
#   Reports physical design area metrics using report_design -physical.
#   Produces cell count, utilization percentage, and optional hierarchical
#   area breakdown. Suitable for area sign-off and capacity monitoring.
#
# Usage:
#   source icc2_report_area.tcl
#   -- or --
#   icc2_shell> source icc2_report_area.tcl
#
# Prerequisites:
#   - Design must be loaded with a floorplan defined
#   - Cells should be placed for meaningful utilization numbers
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Enable hierarchical area breakdown: 1 = yes, 0 = top-level only
set hierarchical        1

# Hierarchy reporting depth (levels from top; -1 = all levels)
set hierarchy_depth     3

# Output report file
set report_file         "./reports/area_report.rpt"

# Report prefix for sub-reports
set report_prefix       "./reports/area"

# Minimum cell count to include in hierarchical report (filters noise)
set min_cell_count      10

# Include filler cells in utilization calculation: 1 = yes, 0 = no
set include_fillers     0

##############################################################################
# SECTION 2: PRE-CHECK
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_report_area.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  hierarchical    = $hierarchical"
puts "  hierarchy_depth = $hierarchy_depth"
puts "  report_file     = $report_file"
puts "  include_fillers = $include_fillers"
puts ""

# Verify design is open
set current_design_name [get_attribute [current_design] full_name]
if {$current_design_name eq ""} {
    error "ERROR: No design is currently open. Load a design first."
}
puts "Pre-check: Design loaded = $current_design_name"

# Check that a floorplan boundary exists
set boundary_area [get_attribute [current_design] boundary_area -quiet]
if {$boundary_area eq "" || $boundary_area == 0} {
    puts "WARNING: No floorplan boundary detected. Utilization calculation will be zero."
    puts "         Run initialize_floorplan or open_block with a placed design."
}
puts "Pre-check: Boundary area = $boundary_area um^2"

# Create output directory
file mkdir [file dirname $report_prefix]
puts ""

##############################################################################
# SECTION 3: PHYSICAL DESIGN REPORT
# Use report_design -physical for core physical metrics.
##############################################################################

puts "======================================================================"
puts "STEP 1: report_design -physical"
puts "======================================================================"

# report_design -physical outputs:
#   - Core area, die area, boundary area
#   - Standard cell area, macro area, filler area
#   - Cell count, utilization percentage
report_design \
    -physical \
    > "${report_prefix}_physical.rpt"
puts "  Physical design report written to: ${report_prefix}_physical.rpt"

##############################################################################
# SECTION 4: CELL COUNT REPORTS
# Break down cell population by type.
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 2: Cell count breakdown"
puts "======================================================================"

# Report all standard cells (excludes macros and fillers by default)
report_cell \
    -nosplit \
    > "${report_prefix}_cells.rpt"
puts "  Cell count report written to: ${report_prefix}_cells.rpt"

# Count cell populations by type for summary
set total_cells  [sizeof_collection [get_cells -filter "is_hierarchical == false" -quiet]]
set macro_cells  [sizeof_collection [get_cells -filter "is_hierarchical == false && is_hard_macro == true" -quiet]]
set seq_cells    [sizeof_collection [get_cells -filter "is_sequential == true" -quiet]]
set combo_cells  [sizeof_collection [get_cells -filter "is_combinational == true" -quiet]]

if {$include_fillers} {
    set filler_cells [sizeof_collection [get_cells -filter "is_filler == true" -quiet]]
} else {
    set filler_cells 0
}

puts "  Total cells (leaf)   = $total_cells"
puts "  Hard macro cells     = $macro_cells"
puts "  Sequential cells     = $seq_cells"
puts "  Combinational cells  = $combo_cells"
if {$include_fillers} {
    puts "  Filler cells         = $filler_cells"
}

##############################################################################
# SECTION 5: HIERARCHICAL AREA REPORT
##############################################################################

if {$hierarchical} {
    puts ""
    puts "======================================================================"
    puts "STEP 3: Hierarchical area breakdown (depth=$hierarchy_depth)"
    puts "======================================================================"

    # report_design -hierarchy -physical reports area per module/instance
    if {$hierarchy_depth == -1} {
        report_design \
            -hierarchy \
            -physical \
            > "${report_prefix}_hierarchy.rpt"
    } else {
        report_design \
            -hierarchy \
            -physical \
            -levels $hierarchy_depth \
            > "${report_prefix}_hierarchy.rpt"
    }
    puts "  Hierarchical area report written to: ${report_prefix}_hierarchy.rpt"
} else {
    puts "STEP 3: Hierarchical report SKIPPED (hierarchical=0)"
}

##############################################################################
# SECTION 6: EXTRACT AREA METRICS
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 4: Extracting area metrics"
puts "======================================================================"

# Read physical attributes from the current design object
set core_area      [get_attribute [current_design] core_area       -quiet]
set boundary_area  [get_attribute [current_design] boundary_area   -quiet]
set cell_area      [get_attribute [current_design] cell_area       -quiet]
set macro_area     [get_attribute [current_design] macro_area      -quiet]
set net_area       [get_attribute [current_design] net_area        -quiet]

# Defaults for missing attributes
foreach var {core_area boundary_area cell_area macro_area net_area} {
    if {[set $var] eq ""} { set $var 0.0 }
}

# Compute utilization (standard cell + macro area / core area)
if {$core_area > 0} {
    set utilization [expr {($cell_area + $macro_area) / $core_area * 100.0}]
    set stdcell_util [expr {$cell_area / $core_area * 100.0}]
} else {
    set utilization  0.0
    set stdcell_util 0.0
}

##############################################################################
# SECTION 7: WRITE COMBINED REPORT
##############################################################################

set rpt_fd [open $report_file w]
puts $rpt_fd "##############################################################################"
puts $rpt_fd "# Area Report - HiPilot"
puts $rpt_fd "# Design : $current_design_name"
puts $rpt_fd "# Date   : [exec date]"
puts $rpt_fd "##############################################################################"
puts $rpt_fd ""
puts $rpt_fd "AREA SUMMARY"
puts $rpt_fd [format "  %-30s %14s" "Metric" "Value (um^2)"]
puts $rpt_fd [format "  %-30s %14s" [string repeat "-" 30] [string repeat "-" 14]]
puts $rpt_fd [format "  %-30s %14.4f" "Core Area"       $core_area]
puts $rpt_fd [format "  %-30s %14.4f" "Die/Boundary Area" $boundary_area]
puts $rpt_fd [format "  %-30s %14.4f" "Standard Cell Area" $cell_area]
puts $rpt_fd [format "  %-30s %14.4f" "Macro Area"      $macro_area]
puts $rpt_fd [format "  %-30s %14.4f" "Net Area"        $net_area]
puts $rpt_fd ""
puts $rpt_fd [format "  %-30s %13.2f%%" "Total Utilization" $utilization]
puts $rpt_fd [format "  %-30s %13.2f%%" "StdCell Utilization" $stdcell_util]
puts $rpt_fd ""
puts $rpt_fd "CELL COUNT"
puts $rpt_fd [format "  %-30s %14d" "Total Leaf Cells"    $total_cells]
puts $rpt_fd [format "  %-30s %14d" "Hard Macro Cells"    $macro_cells]
puts $rpt_fd [format "  %-30s %14d" "Sequential Cells"    $seq_cells]
puts $rpt_fd [format "  %-30s %14d" "Combinational Cells" $combo_cells]
if {$include_fillers} {
puts $rpt_fd [format "  %-30s %14d" "Filler Cells"        $filler_cells]
}
puts $rpt_fd ""
puts $rpt_fd "Sub-reports:"
puts $rpt_fd "  Physical  : ${report_prefix}_physical.rpt"
puts $rpt_fd "  Cells     : ${report_prefix}_cells.rpt"
if {$hierarchical} {
puts $rpt_fd "  Hierarchy : ${report_prefix}_hierarchy.rpt"
}
close $rpt_fd

##############################################################################
# SECTION 8: QoR SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "AREA REPORT SUMMARY"
puts "======================================================================"
puts [format "  %-30s %14.4f um^2" "Core Area"           $core_area]
puts [format "  %-30s %14.4f um^2" "Die Area"             $boundary_area]
puts [format "  %-30s %14.4f um^2" "Standard Cell Area"   $cell_area]
puts [format "  %-30s %14.4f um^2" "Macro Area"           $macro_area]
puts [format "  %-30s %13.2f%%"    "Total Utilization"    $utilization]
puts [format "  %-30s %13.2f%%"    "StdCell Utilization"  $stdcell_util]
puts "----------------------------------------------------------------------"
puts [format "  %-30s %14d"        "Total Leaf Cells"     $total_cells]
puts [format "  %-30s %14d"        "Sequential Cells"     $seq_cells]
puts [format "  %-30s %14d"        "Combinational Cells"  $combo_cells]
puts "======================================================================"

if {$utilization > 90.0} {
    puts "WARNING: Utilization > 90%. Design may have routing congestion."
    puts "         Consider enlarging the floorplan or reducing cell count."
} elseif {$utilization < 50.0} {
    puts "INFO: Utilization < 50%. Floorplan may be oversized."
}

puts ""
puts "  Report written to: $report_file"
puts "HiPilot: icc2_report_area.tcl COMPLETE"
puts "======================================================================"
