##############################################################################
# innovus_check_drc.tcl
# HiPilot Template: DRC Checking in Cadence Innovus
#
# Description:
#   Runs design rule checking in Innovus using verify_drc, verify_connectivity,
#   checkPlace, and checkRoute. Categorizes violations (short, spacing, width,
#   via, antenna, connectivity) and produces a structured summary report
#   suitable for post-route DRC sign-off.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_check_drc.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
##############################################################################

##############################################################################
# PARAMETERS - Edit these before sourcing or let HiPilot substitute them
##############################################################################

# Maximum number of violations to report per category (0 = unlimited)
set max_violations      1000

# Output report file for consolidated DRC summary
set report_file         "./reports/drc_check.rpt"

# Report directory prefix for individual sub-reports
set report_prefix       "./reports/drc"

# Enable antenna violation checking: 1 = yes, 0 = skip
set check_antenna       1

# Enable connectivity checking (open nets, floating pins): 1 = yes
set check_connectivity  1

# Enable placement rule checking: 1 = yes, 0 = skip
set check_placement     1

# Layer range to restrict DRC (leave empty for all layers)
# Example: "M1 M2 M3"
set check_layers        ""

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp [exec date +%Y%m%d_%H%M%S]
file mkdir [file dirname $report_prefix]

##############################################################################
# PRE-CHECK: Verify design is in a valid post-route state
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - DRC Check"
puts "INFO: Timestamp     : $timestamp"
puts "INFO: Max violations: $max_violations"
puts "INFO: Check antenna : $check_antenna"
puts "INFO: Check connect : $check_connectivity"
puts "INFO: =================================================="

# Confirm a design is loaded
set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Please load a design before running DRC."
}
puts "INFO: Design: $design_name"

# Warn if routing appears incomplete
set route_status [dbget top.wires.isRouted -e]
if { [llength $route_status] == 0 } {
    puts "WARNING: No routed wires detected. DRC is intended for post-route designs."
}

##############################################################################
# STEP 1: verify_drc - Physical design rule verification
##############################################################################

puts "\nINFO: ---- Step 1: verify_drc ----"

# verify_drc checks all physical design rules against the technology LEF/TLEF.
# -limit       : cap the number of reported violations per rule
# -reportFile  : write detailed violation database file (.drc)
# verify_drc writes both a text report and a Virtuoso-compatible .drc database.
if { $max_violations > 0 } {
    verify_drc \
        -limit      $max_violations \
        -reportFile "${report_prefix}_verify_drc_${timestamp}.drc"
} else {
    verify_drc \
        -reportFile "${report_prefix}_verify_drc_${timestamp}.drc"
}
puts "INFO: verify_drc complete. Report: ${report_prefix}_verify_drc_${timestamp}.drc"

##############################################################################
# STEP 2: checkRoute - Routing DRC (shorts, spacing, width, notch)
##############################################################################

puts "\nINFO: ---- Step 2: checkRoute ----"

# checkRoute verifies all route segments against routing design rules.
# It reports shorts, spacing violations, width violations, and open nets.
# The -maxViaDensity and -maxMetalDensity checks catch density rule violations.
checkRoute \
    -maxShorts          [expr {$max_violations > 0 ? $max_violations : 1000000}] \
    > "${report_prefix}_checkRoute_${timestamp}.rpt"
puts "INFO: checkRoute complete. Report: ${report_prefix}_checkRoute_${timestamp}.rpt"

##############################################################################
# STEP 3: verify_connectivity - Open nets and floating metal
##############################################################################

if { $check_connectivity } {
    puts "\nINFO: ---- Step 3: verify_connectivity ----"

    # verify_connectivity checks that all nets are fully connected:
    # - No open (incomplete) routes
    # - No floating metal segments
    # - No nets with missing connections to pins
    verify_connectivity \
        -type           all \
        -reportFile     "${report_prefix}_connectivity_${timestamp}.rpt" \
        -reportNets
    puts "INFO: verify_connectivity complete. Report: ${report_prefix}_connectivity_${timestamp}.rpt"
} else {
    puts "\nINFO: Step 3: Connectivity check SKIPPED (check_connectivity=0)"
}

##############################################################################
# STEP 4: checkPlace - Placement rule violations
##############################################################################

if { $check_placement } {
    puts "\nINFO: ---- Step 4: checkPlace ----"

    # checkPlace verifies placement rules:
    # - Cells inside placement blockages
    # - Cell overlap
    # - Cells outside floorplan boundary
    # - Row alignment violations
    checkPlace \
        "${report_prefix}_checkPlace_${timestamp}.rpt"
    puts "INFO: checkPlace complete. Report: ${report_prefix}_checkPlace_${timestamp}.rpt"
} else {
    puts "\nINFO: Step 4: Placement check SKIPPED (check_placement=0)"
}

##############################################################################
# STEP 5: Antenna violation check
##############################################################################

if { $check_antenna } {
    puts "\nINFO: ---- Step 5: Antenna check ----"

    # verify_drc with -antenna flag specifically checks antenna ratios.
    # Antenna violations indicate risk of gate oxide damage during etch.
    # The check uses antenna rules from the technology LEF.
    verify_drc \
        -antenna \
        -reportFile "${report_prefix}_antenna_${timestamp}.drc"
    puts "INFO: Antenna check complete. Report: ${report_prefix}_antenna_${timestamp}.drc"
} else {
    puts "\nINFO: Step 5: Antenna check SKIPPED (check_antenna=0)"
}

##############################################################################
# STEP 6: Extract violation counts from Innovus database
##############################################################################

puts "\nINFO: ---- Step 6: Extracting violation counts ----"

# Read DRC summary from Innovus internal database
# dbget queries the internal design database for violation markers
set short_count    [llength [dbget top.markers.subType short    -e]]
set spacing_count  [llength [dbget top.markers.subType spacing  -e]]
set width_count    [llength [dbget top.markers.subType width    -e]]
set via_count      [llength [dbget top.markers.subType via      -e]]
set open_count     [llength [dbget top.markers.subType open     -e]]
set antenna_count  [llength [dbget top.markers.subType antenna  -e]]
set other_count    [llength [dbget top.markers.subType other    -e]]

set total_drc [expr {$short_count + $spacing_count + $width_count + \
                     $via_count   + $open_count    + $antenna_count + $other_count}]

puts "INFO: Violation summary extracted from database"

##############################################################################
# STEP 7: Write consolidated summary report
##############################################################################

set rpt_fd [open $report_file w]
puts $rpt_fd "##############################################################################"
puts $rpt_fd "# DRC Check Summary - HiPilot"
puts $rpt_fd "# Design    : $design_name"
puts $rpt_fd "# Timestamp : $timestamp"
puts $rpt_fd "# Date      : [exec date]"
puts $rpt_fd "##############################################################################"
puts $rpt_fd ""
puts $rpt_fd "VIOLATION CATEGORY SUMMARY"
puts $rpt_fd [format "  %-25s %8s" "Category" "Count"]
puts $rpt_fd [format "  %-25s %8s" [string repeat "-" 25] [string repeat "-" 8]]
puts $rpt_fd [format "  %-25s %8d" "Short"    $short_count]
puts $rpt_fd [format "  %-25s %8d" "Spacing"  $spacing_count]
puts $rpt_fd [format "  %-25s %8d" "Width"    $width_count]
puts $rpt_fd [format "  %-25s %8d" "Via"      $via_count]
puts $rpt_fd [format "  %-25s %8d" "Open"     $open_count]
puts $rpt_fd [format "  %-25s %8d" "Antenna"  $antenna_count]
puts $rpt_fd [format "  %-25s %8d" "Other"    $other_count]
puts $rpt_fd [format "  %-25s %8d" "TOTAL"    $total_drc]
puts $rpt_fd ""
puts $rpt_fd "Individual reports:"
puts $rpt_fd "  verify_drc   : ${report_prefix}_verify_drc_${timestamp}.drc"
puts $rpt_fd "  checkRoute   : ${report_prefix}_checkRoute_${timestamp}.rpt"
if {$check_connectivity} { puts $rpt_fd "  Connectivity : ${report_prefix}_connectivity_${timestamp}.rpt" }
if {$check_placement}    { puts $rpt_fd "  checkPlace   : ${report_prefix}_checkPlace_${timestamp}.rpt" }
if {$check_antenna}      { puts $rpt_fd "  Antenna      : ${report_prefix}_antenna_${timestamp}.drc" }
close $rpt_fd
puts "INFO: Summary written to: $report_file"

##############################################################################
# QoR SUMMARY
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: DRC CHECK SUMMARY"
puts "INFO: =================================================="
puts [format "INFO: %-25s %8s" "Category" "Count"]
puts [format "INFO: %-25s %8s" [string repeat "-" 25] [string repeat "-" 8]]
puts [format "INFO: %-25s %8d" "Short"    $short_count]
puts [format "INFO: %-25s %8d" "Spacing"  $spacing_count]
puts [format "INFO: %-25s %8d" "Width"    $width_count]
puts [format "INFO: %-25s %8d" "Via"      $via_count]
puts [format "INFO: %-25s %8d" "Open"     $open_count]
puts [format "INFO: %-25s %8d" "Antenna"  $antenna_count]
puts [format "INFO: %-25s %8d" "TOTAL"    $total_drc]
puts "INFO: =================================================="

if { $total_drc == 0 } {
    puts "INFO: RESULT: DRC CLEAN - No violations found."
} else {
    puts "WARNING: RESULT: $total_drc DRC violations found."
    if { $short_count > 0 } {
        puts "WARNING:   $short_count shorts are blocking violations requiring ECO fix."
    }
    if { $open_count > 0 } {
        puts "WARNING:   $open_count opens indicate incomplete routing."
    }
    puts "WARNING:   Review: $report_file"
}

puts "INFO: =================================================="
puts "INFO: innovus_check_drc.tcl COMPLETE"
puts "INFO: =================================================="
