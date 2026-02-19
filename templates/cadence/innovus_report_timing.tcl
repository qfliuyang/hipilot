##############################################################################
# innovus_report_timing.tcl
# HiPilot Template: Comprehensive Timing Report (Cadence Innovus)
#
# Description:
#   Generates a comprehensive timing report package: per-path detail,
#   analysis summary, constraint check, slack histogram, and a formatted
#   QoR banner. Suitable for sign-off review, tapeout checklists, and
#   sharing with the wider project team.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_report_timing.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
# Output files written to $report_dir (see PARAMETERS below).
##############################################################################

##############################################################################
# PARAMETERS
##############################################################################

# Number of paths per path group to include in detailed report.
# For full sign-off use 100+; for quick checks 20-50 is sufficient.
set max_paths       100

# Timing analysis type: max (setup) | min (hold) | both
# "both" generates separate setup and hold reports.
set delay_type      "both"

# Specific path group to report. Use "" for all path groups.
# Common values: "reg2reg", "in2reg", "reg2out", "clkgate", "all_regs"
set path_group      ""

# Output file prefix. Actual filenames will be:
#   ${output_file}_setup.rpt, ${output_file}_hold.rpt, etc.
# Use an absolute path or a path relative to Innovus launch directory.
set output_file     "./reports/timing_report"

# Slack threshold for flagging violations in summary (ns).
set slack_threshold 0.0

# Report unconstrained paths? 1=yes, 0=no.
# Useful for identifying missing constraints.
set report_unconstrained 0

# Include path-level slew and load information? 1=yes, 0=no.
# Adds slew/load columns; useful for signal integrity analysis.
set show_slew_load  1

# Number of worst slack bins for histogram (approximate)
set histogram_bins  10

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp       [exec date +%Y%m%d_%H%M%S]
set report_dir      [file dirname $output_file]
set report_base     [file tail $output_file]

file mkdir $report_dir

# Build format string based on show_slew_load parameter
if { $show_slew_load } {
    set timing_format {instance arc cell slew load delay arrival slack}
} else {
    set timing_format {instance arc cell delay arrival slack}
}

##############################################################################
# PRE-CHECK
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Comprehensive Timing Report"
puts "INFO: Timestamp  : $timestamp"
puts "INFO: Max paths  : $max_paths"
puts "INFO: Delay type : $delay_type"
if { $path_group eq "" } {
    puts "INFO: Path group : (all)"
} else {
    puts "INFO: Path group : $path_group"
}
puts "INFO: Output     : $output_file"
puts "INFO: =================================================="

set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Please load a design before running this script."
}
puts "INFO: Design     : $design_name"

# Detect current flow stage for context
set has_routing [expr { [llength [dbget top.wires.isRouted -e]] > 0 }]
set has_cts     [expr { [llength [dbget top.nets.isClock -e]]  > 0 }]

if { $has_routing } {
    puts "INFO: Stage      : Post-route (full parasitics available)"
} elseif { $has_cts } {
    puts "INFO: Stage      : Post-CTS (estimated parasitics)"
} else {
    puts "INFO: Stage      : Pre-CTS / Placement (estimated parasitics)"
    puts "WARNING: Pre-CTS timing is estimated. Results are not sign-off quality."
}

##############################################################################
# STEP 1: Run timing analysis engine to update database
##############################################################################

puts "\nINFO: ---- Step 1: Run timing analysis ----"

if { $has_routing } {
    # Post-route: use extracted parasitics
    timeDesign -postRoute -setup -hold -expandedViews
    puts "INFO: timeDesign -postRoute (setup + hold) complete"
} elseif { $has_cts } {
    timeDesign -postCTS -setup -hold -expandedViews
    puts "INFO: timeDesign -postCTS (setup + hold) complete"
} else {
    timeDesign -preCTS -setup -expandedViews
    puts "INFO: timeDesign -preCTS (setup only) complete"
}

##############################################################################
# STEP 2: Setup timing report (max delay)
##############################################################################

if { $delay_type eq "max" || $delay_type eq "both" } {
    puts "\nINFO: ---- Step 2a: Setup timing report (max delay) ----"

    set setup_rpt "${report_dir}/${report_base}_setup_${timestamp}.rpt"

    # Build report_timing command based on parameters
    set rt_cmd "report_timing"
    append rt_cmd " -max_paths $max_paths"
    append rt_cmd " -delay_type max"
    if { $path_group ne "" } {
        append rt_cmd " -path_group $path_group"
    }
    append rt_cmd " -slack_lesser_than 99999"  ;# report all paths, not just violators
    append rt_cmd " -format \{$timing_format\}"

    # Execute and capture
    set rt_result [eval $rt_cmd]
    set fh [open $setup_rpt w]
    puts $fh "# HiPilot Timing Report - Setup"
    puts $fh "# Design   : $design_name"
    puts $fh "# Generated: $timestamp"
    puts $fh "# Command  : $rt_cmd"
    puts $fh "# =========================================="
    puts $fh $rt_result
    close $fh

    puts "INFO: Setup timing report written to: $setup_rpt"

    # Also write a focused violators-only report
    set setup_vio_rpt "${report_dir}/${report_base}_setup_violations_${timestamp}.rpt"
    if { $path_group ne "" } {
        report_timing \
            -max_paths          $max_paths \
            -delay_type         max \
            -path_group         $path_group \
            -slack_lesser_than  $slack_threshold \
            -format             $timing_format \
            > $setup_vio_rpt
    } else {
        report_timing \
            -max_paths          $max_paths \
            -delay_type         max \
            -slack_lesser_than  $slack_threshold \
            -format             $timing_format \
            > $setup_vio_rpt
    }
    puts "INFO: Setup violations report written to: $setup_vio_rpt"
}

##############################################################################
# STEP 3: Hold timing report (min delay)
##############################################################################

if { $delay_type eq "min" || $delay_type eq "both" } {
    puts "\nINFO: ---- Step 2b: Hold timing report (min delay) ----"

    set hold_rpt "${report_dir}/${report_base}_hold_${timestamp}.rpt"

    set rt_cmd "report_timing"
    append rt_cmd " -max_paths $max_paths"
    append rt_cmd " -delay_type min"
    if { $path_group ne "" } {
        append rt_cmd " -path_group $path_group"
    }
    append rt_cmd " -slack_lesser_than 99999"
    append rt_cmd " -format \{$timing_format\}"

    set rt_result [eval $rt_cmd]
    set fh [open $hold_rpt w]
    puts $fh "# HiPilot Timing Report - Hold"
    puts $fh "# Design   : $design_name"
    puts $fh "# Generated: $timestamp"
    puts $fh "# Command  : $rt_cmd"
    puts $fh "# =========================================="
    puts $fh $rt_result
    close $fh

    puts "INFO: Hold timing report written to: $hold_rpt"

    set hold_vio_rpt "${report_dir}/${report_base}_hold_violations_${timestamp}.rpt"
    if { $path_group ne "" } {
        report_timing \
            -max_paths          $max_paths \
            -delay_type         min \
            -path_group         $path_group \
            -slack_lesser_than  $slack_threshold \
            -format             $timing_format \
            > $hold_vio_rpt
    } else {
        report_timing \
            -max_paths          $max_paths \
            -delay_type         min \
            -slack_lesser_than  $slack_threshold \
            -format             $timing_format \
            > $hold_vio_rpt
    }
    puts "INFO: Hold violations report written to: $hold_vio_rpt"
}

##############################################################################
# STEP 4: Analysis summary (report_analysis_summary)
##############################################################################

puts "\nINFO: ---- Step 3: Analysis summary ----"

# report_analysis_summary provides a compact per-path-group overview:
# WNS, TNS, number of violating endpoints per group and per corner.
set summary_rpt "${report_dir}/${report_base}_analysis_summary_${timestamp}.rpt"

report_analysis_summary > $summary_rpt
puts "INFO: Analysis summary written to: $summary_rpt"

# Echo to console for immediate feedback
puts "INFO: --- Analysis Summary (console echo) ---"
set fh [open $summary_rpt r]
while { [gets $fh line] >= 0 } {
    puts "INFO: $line"
}
close $fh

##############################################################################
# STEP 5: Constraint report (report_constraint)
##############################################################################

puts "\nINFO: ---- Step 4: Constraint report ----"

# report_constraint lists all timing constraints (create_clock,
# set_input_delay, set_output_delay, set_max_delay, etc.) and flags
# any that are violated or unconstrained.
set constraint_rpt "${report_dir}/${report_base}_constraints_${timestamp}.rpt"

if { $report_unconstrained } {
    report_constraint \
        -all_violators \
        -verbose \
        > $constraint_rpt
} else {
    report_constraint \
        -all_violators \
        > $constraint_rpt
}
puts "INFO: Constraint report written to: $constraint_rpt"

##############################################################################
# STEP 6: Path group breakdown
##############################################################################

puts "\nINFO: ---- Step 5: Per-path-group breakdown ----"

set pg_rpt "${report_dir}/${report_base}_path_groups_${timestamp}.rpt"
set fh [open $pg_rpt w]
puts $fh "# HiPilot Per-Path-Group Timing Breakdown"
puts $fh "# Design   : $design_name"
puts $fh "# Generated: $timestamp"
puts $fh "# =========================================="

# Get list of all defined path groups
set all_groups [get_path_groups]

foreach pg $all_groups {
    puts $fh "\n## Path Group: $pg"

    # Setup (max)
    set pg_setup [report_timing \
        -max_paths  5 \
        -delay_type max \
        -path_group $pg \
        -format     {instance delay arrival slack} \
        -collection]
    puts $fh "  Setup WNS: [lindex [lindex $pg_setup 0] end]"

    # Hold (min)
    set pg_hold [report_timing \
        -max_paths  5 \
        -delay_type min \
        -path_group $pg \
        -format     {instance delay arrival slack} \
        -collection]
    puts $fh "  Hold  WNS: [lindex [lindex $pg_hold 0] end]"
}

close $fh
puts "INFO: Path group breakdown written to: $pg_rpt"

##############################################################################
# STEP 7: Slack histogram (console only)
##############################################################################

puts "\nINFO: ---- Step 6: Slack histogram ----"

# Pull all setup path slacks from timing database
set all_slacks [dbget [dbget head.timingReports.reportName setup -p].paths.slack -e]

if { [llength $all_slacks] > 0 } {
    # Find min and max slack
    set min_slack [lindex [lsort -real $all_slacks] 0]
    set max_slack [lindex [lsort -real $all_slacks] end]
    set bin_width [expr { ($max_slack - $min_slack) / double($histogram_bins) }]

    if { $bin_width == 0 } { set bin_width 0.001 }

    puts "INFO: Slack histogram (setup, $histogram_bins bins)"
    puts "INFO: [format %-20s %8s] %s" "Slack range (ns)" "Count" "Bar"

    for { set b 0 } { $b < $histogram_bins } { incr b } {
        set lo [expr { $min_slack + $b * $bin_width }]
        set hi [expr { $lo + $bin_width }]
        set count 0
        foreach s $all_slacks {
            if { $s >= $lo && $s < $hi } { incr count }
        }
        set bar [string repeat "*" [expr { min($count, 40) }]]
        set flag [expr { $hi <= $slack_threshold ? " <-- VIOLATION" : "" }]
        puts "INFO: [format %8.3f %8.3f %6d] %s%s" $lo $hi $count $bar $flag
    }
} else {
    puts "INFO: No timing data available for histogram."
}

##############################################################################
# STEP 8: Formatted QoR Banner
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: QoR SUMMARY: Timing Report"
puts "INFO: =================================================="
puts "INFO: Design   : $design_name"
puts "INFO: Timestamp: $timestamp"
puts "INFO: Stage    : [expr { $has_routing ? \"post-route\" : ($has_cts ? \"post-CTS\" : \"pre-CTS\") }]"
puts "INFO: --------------------------------------------------"

# Setup metrics
set su_wns [dbget [dbget head.timingReports.reportName setup -p].wns -e]
set su_tns [dbget [dbget head.timingReports.reportName setup -p].tns -e]
set su_nvp [llength [dbget [dbget head.timingReports.reportName setup -p].paths.slack \
    -e -v [expr {$slack_threshold}]]]

# Hold metrics
set ho_wns [dbget [dbget head.timingReports.reportName hold  -p].wns -e]
set ho_tns [dbget [dbget head.timingReports.reportName hold  -p].tns -e]
set ho_nvp [llength [dbget [dbget head.timingReports.reportName hold -p].paths.slack \
    -e -v [expr {$slack_threshold}]]]

puts [format "INFO: %-28s %12s" "Metric" "Value"]
puts [format "INFO: %-28s %12s" "----------------------------" "------------"]
puts [format "INFO: %-28s %12.4f" "Setup WNS (ns)"   $su_wns]
puts [format "INFO: %-28s %12.4f" "Setup TNS (ns)"   $su_tns]
puts [format "INFO: %-28s %12d"   "Setup viol. paths" $su_nvp]
puts [format "INFO: %-28s %12.4f" "Hold WNS (ns)"    $ho_wns]
puts [format "INFO: %-28s %12.4f" "Hold TNS (ns)"    $ho_tns]
puts [format "INFO: %-28s %12d"   "Hold viol. paths"  $ho_nvp]
puts "INFO: --------------------------------------------------"

# Overall pass/fail
set setup_pass [expr { $su_wns >= $slack_threshold }]
set hold_pass  [expr { $ho_wns >= $slack_threshold }]

puts [format "INFO: %-28s %12s" "Setup timing" [expr { $setup_pass ? "PASS" : "FAIL" }]]
puts [format "INFO: %-28s %12s" "Hold timing"  [expr { $hold_pass  ? "PASS" : "FAIL" }]]
puts "INFO: =================================================="

# List all generated report files
puts "INFO: Generated reports:"
foreach rpt [glob -nocomplain "${report_dir}/${report_base}_*_${timestamp}.rpt"] {
    puts "INFO:   $rpt"
}

puts "INFO: =================================================="
puts "INFO: innovus_report_timing.tcl COMPLETE"
puts "INFO: =================================================="
