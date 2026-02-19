##############################################################################
# icc2_compare_qor.tcl
# HiPilot Template: Compare QoR Between Two Blocks in Synopsys ICC2
#
# Description:
#   Extracts and compares WNS, TNS, power, and area metrics between a
#   baseline block (e.g., pre-optimization) and the current block
#   (e.g., post-optimization). Produces a side-by-side diff table to
#   quantify improvement or regression clearly.
#
# Usage:
#   source icc2_compare_qor.tcl
#   -- or --
#   icc2_shell> source icc2_compare_qor.tcl
#
# Prerequisites:
#   - Both baseline_block and current_block must exist in the same NDM library
#   - The NDM library must be open (open_lib already called)
#   - Timing must have been run on both blocks before this comparison
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Path to the NDM library containing both blocks
set lib_path            "./work/design.ndm"

# Baseline block label to compare against (the "before" reference)
# Format: <block_name>:<label>  e.g., "ibex_top:post_place"
set baseline_block      "design:baseline"

# Current block label (the "after" version being evaluated)
# Format: <block_name>:<label>  e.g., "ibex_top:post_route_opt"
set current_block       "design:current"

# Timing scenario to use for both blocks (must exist in both)
set compare_scenario    ""

# Output report file for the comparison table
set report_file         "./reports/qor_comparison.rpt"

# Slack threshold for setup violation counting (ns)
set slack_threshold     0.0

##############################################################################
# SECTION 2: HELPER PROCEDURE
# Extracts key QoR metrics from the currently open block.
##############################################################################

proc extract_qor_metrics {scenario threshold} {
    set metrics [dict create]

    # Switch to the requested scenario if specified
    if {$scenario ne ""} {
        if {[sizeof_collection [get_scenarios $scenario -quiet]] > 0} {
            current_scenario $scenario
        } else {
            puts "  WARNING: Scenario '$scenario' not found. Using current scenario."
        }
    }

    # Update timing for fresh results
    update_timing -full

    # Setup WNS (worst negative slack, max delay)
    set setup_path [get_timing_paths -delay_type max -max_paths 1 -quiet]
    set wns [get_attribute $setup_path slack -quiet]
    dict set metrics setup_wns [expr {$wns  eq "" ? 0.0 : $wns}]

    # Setup TNS (total negative slack across all violating paths)
    set tns_paths [get_timing_paths \
        -delay_type max \
        -slack_lesser_than $threshold \
        -max_paths 10000 \
        -quiet]
    set tns 0.0
    foreach_in_collection p $tns_paths {
        set s [get_attribute $p slack -quiet]
        if {$s ne "" && $s < 0} { set tns [expr {$tns + $s}] }
    }
    dict set metrics setup_tns $tns

    # Violation count
    dict set metrics viol_count [sizeof_collection $tns_paths]

    # Hold WNS
    set hold_path [get_timing_paths -delay_type min -max_paths 1 -quiet]
    set hwns [get_attribute $hold_path slack -quiet]
    dict set metrics hold_wns [expr {$hwns eq "" ? 0.0 : $hwns}]

    # Power metrics from design attributes
    set lkg [get_attribute [current_design] leakage_power  -quiet]
    set dyn [get_attribute [current_design] switching_power -quiet]
    set itn [get_attribute [current_design] internal_power -quiet]
    dict set metrics leakage_power  [expr {$lkg eq "" ? 0.0 : $lkg}]
    dict set metrics switching_power [expr {$dyn eq "" ? 0.0 : $dyn}]
    dict set metrics internal_power [expr {$itn eq "" ? 0.0 : $itn}]
    dict set metrics total_power    [expr {[dict get $metrics leakage_power] + \
                                          [dict get $metrics switching_power] + \
                                          [dict get $metrics internal_power]}]

    # Area metrics
    set cell_a  [get_attribute [current_design] cell_area     -quiet]
    set core_a  [get_attribute [current_design] core_area     -quiet]
    set macro_a [get_attribute [current_design] macro_area    -quiet]
    dict set metrics cell_area  [expr {$cell_a  eq "" ? 0.0 : $cell_a}]
    dict set metrics core_area  [expr {$core_a  eq "" ? 0.0 : $core_a}]
    dict set metrics macro_area [expr {$macro_a eq "" ? 0.0 : $macro_a}]

    # Cell count
    dict set metrics cell_count [sizeof_collection \
        [get_cells -filter "is_hierarchical == false" -quiet]]

    return $metrics
}

##############################################################################
# SECTION 3: PRE-CHECK
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_compare_qor.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  lib_path        = $lib_path"
puts "  baseline_block  = $baseline_block"
puts "  current_block   = $current_block"
puts "  compare_scenario = [expr {$compare_scenario eq {} ? {(current)} : $compare_scenario}]"
puts "  slack_threshold = $slack_threshold ns"
puts "  report_file     = $report_file"
puts ""

# Verify NDM library exists
if {![file exists $lib_path]} {
    error "ERROR: NDM library not found: $lib_path"
}
puts "Pre-check: NDM library found"

file mkdir [file dirname $report_file]
puts ""

##############################################################################
# SECTION 4: EXTRACT BASELINE METRICS
##############################################################################

puts "======================================================================"
puts "STEP 1: Extracting baseline metrics from '$baseline_block'"
puts "======================================================================"

# Open library (in case it is not already open)
catch { open_lib $lib_path }

# Open baseline block (read-only to protect it)
open_block "${baseline_block}" -read_only
puts "  Baseline block opened"

set baseline_metrics [extract_qor_metrics $compare_scenario $slack_threshold]
puts "  Baseline extraction complete"
puts "    Setup WNS   = [dict get $baseline_metrics setup_wns] ns"
puts "    Viol count  = [dict get $baseline_metrics viol_count]"
puts "    Total power = [dict get $baseline_metrics total_power] W"
puts "    Cell area   = [dict get $baseline_metrics cell_area] um^2"

# Close baseline block before opening current
close_block -force

##############################################################################
# SECTION 5: EXTRACT CURRENT METRICS
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 2: Extracting current metrics from '$current_block'"
puts "======================================================================"

open_block "${current_block}"
puts "  Current block opened"

set current_metrics [extract_qor_metrics $compare_scenario $slack_threshold]
puts "  Current extraction complete"
puts "    Setup WNS   = [dict get $current_metrics setup_wns] ns"
puts "    Viol count  = [dict get $current_metrics viol_count]"
puts "    Total power = [dict get $current_metrics total_power] W"
puts "    Cell area   = [dict get $current_metrics cell_area] um^2"

##############################################################################
# SECTION 6: COMPUTE DELTAS
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 3: Computing deltas"
puts "======================================================================"

proc delta_pct {base cur} {
    if {$base == 0} { return "N/A" }
    return [format "%.2f%%" [expr {($cur - $base) / abs($base) * 100.0}]]
}

set d_setup_wns    [expr {[dict get $current_metrics setup_wns]    - [dict get $baseline_metrics setup_wns]}]
set d_setup_tns    [expr {[dict get $current_metrics setup_tns]    - [dict get $baseline_metrics setup_tns]}]
set d_hold_wns     [expr {[dict get $current_metrics hold_wns]     - [dict get $baseline_metrics hold_wns]}]
set d_viol_count   [expr {[dict get $current_metrics viol_count]   - [dict get $baseline_metrics viol_count]}]
set d_total_power  [expr {[dict get $current_metrics total_power]  - [dict get $baseline_metrics total_power]}]
set d_cell_area    [expr {[dict get $current_metrics cell_area]    - [dict get $baseline_metrics cell_area]}]
set d_cell_count   [expr {[dict get $current_metrics cell_count]   - [dict get $baseline_metrics cell_count]}]

##############################################################################
# SECTION 7: WRITE COMPARISON REPORT
##############################################################################

# Build formatted table rows
proc fmt_row {label base cur delta unit} {
    if {[string is double -strict $delta]} {
        set sign [expr {$delta >= 0 ? "+" : ""}]
        return [format "  %-28s %12s %12s %12s %s" \
            $label $base $cur "${sign}${delta}" $unit]
    } else {
        return [format "  %-28s %12s %12s %12s %s" \
            $label $base $cur $delta $unit]
    }
}

set lines {}
lappend lines "##############################################################################"
lappend lines "# QoR Comparison Report - HiPilot"
lappend lines "# Baseline : $baseline_block"
lappend lines "# Current  : $current_block"
lappend lines "# Date     : [exec date]"
lappend lines "##############################################################################"
lappend lines ""
lappend lines [format "  %-28s %12s %12s %12s" "Metric" "Baseline" "Current" "Delta"]
lappend lines [format "  %-28s %12s %12s %12s" \
    [string repeat "-" 28] [string repeat "-" 12] [string repeat "-" 12] [string repeat "-" 12]]
lappend lines [fmt_row "Setup WNS" \
    [format "%.4f" [dict get $baseline_metrics setup_wns]] \
    [format "%.4f" [dict get $current_metrics  setup_wns]] \
    [format "%.4f" $d_setup_wns] "ns"]
lappend lines [fmt_row "Setup TNS" \
    [format "%.4f" [dict get $baseline_metrics setup_tns]] \
    [format "%.4f" [dict get $current_metrics  setup_tns]] \
    [format "%.4f" $d_setup_tns] "ns"]
lappend lines [fmt_row "Hold WNS" \
    [format "%.4f" [dict get $baseline_metrics hold_wns]] \
    [format "%.4f" [dict get $current_metrics  hold_wns]] \
    [format "%.4f" $d_hold_wns] "ns"]
lappend lines [fmt_row "Violating Paths" \
    [dict get $baseline_metrics viol_count] \
    [dict get $current_metrics  viol_count] \
    $d_viol_count ""]
lappend lines ""
lappend lines [fmt_row "Total Power" \
    [format "%.6e" [dict get $baseline_metrics total_power]] \
    [format "%.6e" [dict get $current_metrics  total_power]] \
    [format "%.6e" $d_total_power] "W"]
lappend lines [fmt_row "Leakage Power" \
    [format "%.6e" [dict get $baseline_metrics leakage_power]] \
    [format "%.6e" [dict get $current_metrics  leakage_power]] \
    [format "%.6e" [expr {[dict get $current_metrics leakage_power] - [dict get $baseline_metrics leakage_power]}]] "W"]
lappend lines ""
lappend lines [fmt_row "Cell Area" \
    [format "%.4f" [dict get $baseline_metrics cell_area]] \
    [format "%.4f" [dict get $current_metrics  cell_area]] \
    [format "%.4f" $d_cell_area] "um^2"]
lappend lines [fmt_row "Cell Count" \
    [dict get $baseline_metrics cell_count] \
    [dict get $current_metrics  cell_count] \
    $d_cell_count "cells"]

set rpt_fd [open $report_file w]
foreach line $lines { puts $rpt_fd $line }
close $rpt_fd

##############################################################################
# SECTION 8: QoR SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "QoR COMPARISON SUMMARY"
puts "======================================================================"
puts [format "  %-28s %12s %12s %12s" "Metric" "Baseline" "Current" "Delta"]
puts [format "  %-28s %12s %12s %12s" \
    [string repeat "-" 28] [string repeat "-" 12] [string repeat "-" 12] [string repeat "-" 12]]
foreach line $lines {
    if {[string match "  *" $line]} { puts $line }
}
puts "======================================================================"

# Regression detection
set regressions 0
if {$d_setup_wns < -0.001} { puts "WARNING: Setup WNS regressed by [format %.4f $d_setup_wns] ns" ; incr regressions }
if {$d_hold_wns  < -0.001} { puts "WARNING: Hold WNS regressed by [format %.4f $d_hold_wns] ns"  ; incr regressions }
if {$d_total_power > 0}    { puts "INFO: Total power increased by [format %.6e $d_total_power] W" }
if {$d_cell_area > 0}      { puts "INFO: Cell area increased by [format %.4f $d_cell_area] um^2" }

if {$regressions == 0} {
    puts "RESULT: No timing regressions detected."
} else {
    puts "RESULT: $regressions regression(s) detected. Review $report_file."
}

puts ""
puts "  Report written to: $report_file"
puts "HiPilot: icc2_compare_qor.tcl COMPLETE"
puts "======================================================================"
