##############################################################################
# innovus_compare_qor.tcl
# HiPilot Template: Compare QoR Between Two Checkpoints in Cadence Innovus
#
# Description:
#   Extracts and compares WNS, TNS, violation count, power, and area
#   metrics between a baseline checkpoint (the "before" reference) and
#   a current checkpoint (the "after" version). Produces a side-by-side
#   diff table to quantify improvement or detect regression.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_compare_qor.tcl
#
# Note: This script restores each checkpoint in sequence. The current
#       design state will be the current_dir checkpoint after completion.
#
# Tested with: Cadence Innovus v20.10 / v21.x
##############################################################################

##############################################################################
# PARAMETERS - Edit these before sourcing or let HiPilot substitute them
##############################################################################

# Path to the baseline (before) Innovus checkpoint directory
# This is the directory passed to saveDesign, e.g., "./checkpoints/post_place"
set baseline_dir        "./checkpoints/baseline"

# Top-level cell name (same for both checkpoints)
set top_cell            "ibex_top"

# Path to the current (after) Innovus checkpoint directory
set current_dir         "./checkpoints/current"

# Slack threshold for violation counting (ns)
# Paths with slack below this value are counted as violating
set slack_threshold     0.0

# Output report file for the comparison table
set report_file         "./reports/qor_comparison.rpt"

# Report prefix for sub-reports generated during extraction
set report_prefix       "./reports/qor_compare"

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp [exec date +%Y%m%d_%H%M%S]
file mkdir [file dirname $report_prefix]
file mkdir [file dirname $report_file]

##############################################################################
# HELPER PROCEDURE: extract_innovus_qor
# Restores a checkpoint and extracts key QoR metrics into a dict.
##############################################################################

proc extract_innovus_qor {enc_dir top_cell threshold rpt_prefix label} {
    puts "INFO: Restoring checkpoint: $enc_dir"

    # Find the .enc.dat file in the checkpoint directory
    set enc_dat [glob -nocomplain "${enc_dir}/*.enc.dat"]
    if { [llength $enc_dat] == 0 } {
        # Try alternate naming: saveDesign writes <design>.enc.dat
        set enc_dat [glob -nocomplain "${enc_dir}.enc.dat"]
        if { [llength $enc_dat] == 0 } {
            error "ERROR: No .enc.dat file found in: $enc_dir\n       Check baseline_dir / current_dir paths."
        }
    }
    set enc_file [lindex $enc_dat 0]
    restoreDesign $enc_file $top_cell
    puts "INFO: Restored from: $enc_file"

    set metrics [dict create]

    # Run timing analysis to populate timing database
    timeDesign -postRoute -setup -hold \
        -outDir "${rpt_prefix}_${label}"

    # Setup WNS
    set setup_wns [dbget [dbget head.timingReports.reportName setup -p].wns -e]
    if { $setup_wns eq "" || $setup_wns eq {} } { set setup_wns 0.0 }
    dict set metrics setup_wns $setup_wns

    # Setup TNS
    set setup_tns [dbget [dbget head.timingReports.reportName setup -p].tns -e]
    if { $setup_tns eq "" || $setup_tns eq {} } { set setup_tns 0.0 }
    dict set metrics setup_tns $setup_tns

    # Hold WNS
    set hold_wns [dbget [dbget head.timingReports.reportName hold -p].wns -e]
    if { $hold_wns eq "" || $hold_wns eq {} } { set hold_wns 0.0 }
    dict set metrics hold_wns $hold_wns

    # Violation count: paths with slack < threshold
    set viol_paths [dbget [dbget head.timingReports.reportName setup -p].paths.slack -e]
    set viol_count 0
    foreach s $viol_paths {
        if { [string is double $s] && $s < $threshold } { incr viol_count }
    }
    dict set metrics viol_count $viol_count

    # Power analysis
    report_power \
        -leakage \
        -dynamic \
        -outfile "${rpt_prefix}_${label}_power.rpt"

    set lkg [dbget top.power.leakage   -e]
    set itn [dbget top.power.internal  -e]
    set swt [dbget top.power.switching -e]
    set tot [dbget top.power.total     -e]
    if { $lkg eq "" || $lkg eq {} } { set lkg 0.0 }
    if { $itn eq "" || $itn eq {} } { set itn 0.0 }
    if { $swt eq "" || $swt eq {} } { set swt 0.0 }
    if { $tot eq "" || $tot eq {} } { set tot [expr {$lkg + $itn + $swt}] }
    dict set metrics leakage_power  $lkg
    dict set metrics internal_power $itn
    dict set metrics switching_power $swt
    dict set metrics total_power    $tot

    # Area from floorplan
    set core_box [dbget top.fPlan.coreBox -e]
    if { $core_box ne "" && [llength $core_box] == 4 } {
        set ca [expr {([lindex $core_box 2] - [lindex $core_box 0]) * \
                      ([lindex $core_box 3] - [lindex $core_box 1])}]
    } else {
        set ca 0.0
    }
    dict set metrics core_area $ca

    # Standard cell area (sum of all core-class instances)
    set sc_insts [dbget top.insts.cell.subClass core -p]
    set sc_area 0.0
    foreach inst $sc_insts {
        set sx [dbget ${inst}.cell.size_x -e]
        set sy [dbget ${inst}.cell.size_y -e]
        if { $sx ne "" && $sy ne "" } {
            set sc_area [expr {$sc_area + $sx * $sy}]
        }
    }
    dict set metrics cell_area  $sc_area
    dict set metrics cell_count [llength $sc_insts]

    # DRC violation count
    verify_drc -limit 10000 -reportFile "${rpt_prefix}_${label}_drc.drc"
    dict set metrics drc_count [llength [dbget top.markers -e]]

    puts "INFO: Extraction complete for $label"
    puts "INFO:   Setup WNS   = [dict get $metrics setup_wns] ns"
    puts "INFO:   Total power = [dict get $metrics total_power] W"
    puts "INFO:   Cell area   = [dict get $metrics cell_area] um^2"
    puts "INFO:   DRC markers = [dict get $metrics drc_count]"

    return $metrics
}

##############################################################################
# PRE-CHECK
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Compare QoR"
puts "INFO: Timestamp      : $timestamp"
puts "INFO: Baseline dir   : $baseline_dir"
puts "INFO: Current dir    : $current_dir"
puts "INFO: Top cell       : $top_cell"
puts "INFO: Slack threshold: $slack_threshold ns"
puts "INFO: Report file    : $report_file"
puts "INFO: =================================================="

# Validate both checkpoint directories exist
foreach chk_entry [list "baseline=$baseline_dir" "current=$current_dir"] {
    set label [lindex [split $chk_entry "="] 0]
    set path  [lindex [split $chk_entry "="] 1]
    if { ![file exists $path] } {
        error "ERROR: $label checkpoint directory not found: $path"
    }
}
puts "INFO: Both checkpoint directories validated"
puts ""

##############################################################################
# STEP 1: Extract baseline metrics
##############################################################################

puts "INFO: =================================================="
puts "INFO: STEP 1: Extracting baseline metrics"
puts "INFO: =================================================="
set baseline_metrics [extract_innovus_qor \
    $baseline_dir $top_cell $slack_threshold \
    $report_prefix "baseline"]

##############################################################################
# STEP 2: Extract current metrics
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: STEP 2: Extracting current metrics"
puts "INFO: =================================================="
set current_metrics [extract_innovus_qor \
    $current_dir $top_cell $slack_threshold \
    $report_prefix "current"]

##############################################################################
# STEP 3: Compute deltas
##############################################################################

puts "\nINFO: ---- Step 3: Computing deltas ----"

set d_setup_wns    [expr {[dict get $current_metrics setup_wns]    - [dict get $baseline_metrics setup_wns]}]
set d_setup_tns    [expr {[dict get $current_metrics setup_tns]    - [dict get $baseline_metrics setup_tns]}]
set d_hold_wns     [expr {[dict get $current_metrics hold_wns]     - [dict get $baseline_metrics hold_wns]}]
set d_viol_count   [expr {[dict get $current_metrics viol_count]   - [dict get $baseline_metrics viol_count]}]
set d_total_power  [expr {[dict get $current_metrics total_power]  - [dict get $baseline_metrics total_power]}]
set d_cell_area    [expr {[dict get $current_metrics cell_area]    - [dict get $baseline_metrics cell_area]}]
set d_cell_count   [expr {[dict get $current_metrics cell_count]   - [dict get $baseline_metrics cell_count]}]
set d_drc_count    [expr {[dict get $current_metrics drc_count]    - [dict get $baseline_metrics drc_count]}]

##############################################################################
# STEP 4: Write comparison report
##############################################################################

proc fmt_cmp_row {label base cur delta unit} {
    if { [string is double -strict $delta] } {
        set sign [expr {$delta >= 0 ? "+" : ""}]
        return [format "  %-28s %14s %14s %14s  %s" \
            $label $base $cur "${sign}${delta}" $unit]
    } else {
        return [format "  %-28s %14s %14s %14s  %s" \
            $label $base $cur $delta $unit]
    }
}

set lines {}
lappend lines "##############################################################################"
lappend lines "# QoR Comparison Report - HiPilot (Innovus)"
lappend lines "# Baseline  : $baseline_dir"
lappend lines "# Current   : $current_dir"
lappend lines "# Top cell  : $top_cell"
lappend lines "# Threshold : $slack_threshold ns"
lappend lines "# Timestamp : $timestamp"
lappend lines "# Date      : [exec date]"
lappend lines "##############################################################################"
lappend lines ""
lappend lines [format "  %-28s %14s %14s %14s  %s" \
    "Metric" "Baseline" "Current" "Delta" "Unit"]
lappend lines [format "  %-28s %14s %14s %14s  %s" \
    [string repeat "-" 28] [string repeat "-" 14] \
    [string repeat "-" 14] [string repeat "-" 14] ""]

lappend lines "  -- TIMING --"
lappend lines [fmt_cmp_row "Setup WNS" \
    [format "%.4f" [dict get $baseline_metrics setup_wns]] \
    [format "%.4f" [dict get $current_metrics  setup_wns]] \
    [format "%.4f" $d_setup_wns] "ns"]
lappend lines [fmt_cmp_row "Setup TNS" \
    [format "%.4f" [dict get $baseline_metrics setup_tns]] \
    [format "%.4f" [dict get $current_metrics  setup_tns]] \
    [format "%.4f" $d_setup_tns] "ns"]
lappend lines [fmt_cmp_row "Hold WNS" \
    [format "%.4f" [dict get $baseline_metrics hold_wns]] \
    [format "%.4f" [dict get $current_metrics  hold_wns]] \
    [format "%.4f" $d_hold_wns] "ns"]
lappend lines [fmt_cmp_row "Violating Paths" \
    [dict get $baseline_metrics viol_count] \
    [dict get $current_metrics  viol_count] \
    [expr {$d_viol_count >= 0 ? "+$d_viol_count" : "$d_viol_count"}] "paths"]
lappend lines ""
lappend lines "  -- POWER --"
lappend lines [fmt_cmp_row "Total Power" \
    [format "%.6e" [dict get $baseline_metrics total_power]] \
    [format "%.6e" [dict get $current_metrics  total_power]] \
    [format "%.6e" $d_total_power] "W"]
lappend lines [fmt_cmp_row "Leakage Power" \
    [format "%.6e" [dict get $baseline_metrics leakage_power]] \
    [format "%.6e" [dict get $current_metrics  leakage_power]] \
    [format "%.6e" [expr {[dict get $current_metrics leakage_power] - [dict get $baseline_metrics leakage_power]}]] "W"]
lappend lines ""
lappend lines "  -- AREA --"
lappend lines [fmt_cmp_row "Cell Area" \
    [format "%.4f" [dict get $baseline_metrics cell_area]] \
    [format "%.4f" [dict get $current_metrics  cell_area]] \
    [format "%.4f" $d_cell_area] "um^2"]
lappend lines [fmt_cmp_row "Cell Count" \
    [dict get $baseline_metrics cell_count] \
    [dict get $current_metrics  cell_count] \
    [expr {$d_cell_count >= 0 ? "+$d_cell_count" : "$d_cell_count"}] "cells"]
lappend lines ""
lappend lines "  -- PHYSICAL --"
lappend lines [fmt_cmp_row "DRC Violations" \
    [dict get $baseline_metrics drc_count] \
    [dict get $current_metrics  drc_count] \
    [expr {$d_drc_count >= 0 ? "+$d_drc_count" : "$d_drc_count"}] "markers"]

set rpt_fd [open $report_file w]
foreach line $lines { puts $rpt_fd $line }
close $rpt_fd
puts "INFO: Comparison report written to: $report_file"

##############################################################################
# QoR SUMMARY
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: QoR COMPARISON SUMMARY"
puts "INFO: =================================================="
puts [format "INFO: %-28s %14s %14s %14s" "Metric" "Baseline" "Current" "Delta"]
puts [format "INFO: %-28s %14s %14s %14s" \
    [string repeat "-" 28] [string repeat "-" 14] [string repeat "-" 14] [string repeat "-" 14]]

foreach line $lines {
    if { [string match "  *" $line] && ![string match "  --*" $line] } {
        puts "INFO: $line"
    }
}

puts "INFO: =================================================="

# Regression detection and summary
set regressions 0
if { $d_setup_wns < -0.001 } {
    puts "WARNING: Setup WNS REGRESSED by [format %.4f [expr {abs($d_setup_wns)}]] ns"
    incr regressions
}
if { $d_hold_wns < -0.001 } {
    puts "WARNING: Hold WNS REGRESSED by [format %.4f [expr {abs($d_hold_wns)}]] ns"
    incr regressions
}
if { $d_drc_count > 0 } {
    puts "WARNING: DRC violations INCREASED by $d_drc_count"
    incr regressions
}
if { $d_total_power > 0 } {
    puts "INFO: Total power increased by [format %.6e $d_total_power] W"
}
if { $d_cell_area > 0 } {
    puts "INFO: Cell area increased by [format %.4f $d_cell_area] um^2"
}

if { $regressions == 0 } {
    puts "INFO: RESULT: No regressions detected across timing, power, area, DRC."
} else {
    puts "WARNING: RESULT: $regressions regression(s) detected."
    puts "WARNING:         Review: $report_file"
}

puts "INFO: =================================================="
puts "INFO: innovus_compare_qor.tcl COMPLETE"
puts "INFO: Current design state: $current_dir"
puts "INFO: =================================================="
