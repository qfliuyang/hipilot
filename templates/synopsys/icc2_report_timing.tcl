##############################################################################
# icc2_report_timing.tcl
# HiPilot Template: Comprehensive Timing Reporting in Synopsys IC Compiler II
#
# Description:
#   Generates a complete timing analysis package: detailed path reports,
#   constraint summary, QoR report, clock summary, and a formatted human-
#   readable summary. Covers both setup (max) and hold (min) analysis.
#   Suitable for sign-off checkpoints and design reviews.
#
# Usage:
#   source icc2_report_timing.tcl
#
# Prerequisites:
#   - Design loaded with constraints applied
#   - Parasitics estimated (pre-route) or extracted (post-route)
#   - For hold: clock tree must be propagated (post-CTS)
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Number of paths to report per path group
set max_paths           25

# Delay type for primary analysis: max (setup) | min (hold) | both
set delay_type          "both"

# Specific path group to report. "all" reports all groups.
# Example: "reg2reg", "in2reg", "INPUTS", "OUTPUTS"
set path_group          "all"

# Number of significant digits in timing values
set significant_digits  4

# Output file base path. Leave empty to print to stdout only.
# When set, reports are also written to files with suffixes.
set output_dir          "./reports/timing"

# Output file name tag (e.g. "preRoute", "postCTS", "postRoute", "signoff")
set report_tag          "checkpoint"

# Slack threshold for flagging violating paths (ns)
# Paths with slack below this are highlighted as violations
set violation_threshold 0.0

# Report paths with slack worse than this for detailed analysis (ns)
# Set to a positive value to also report near-miss paths
set slack_report_limit  0.100

# Include input pin arrival times in path reports: 1 = yes, 0 = no
set report_input_pins   1

# Include clock network latency in reports: 1 = yes, 0 = no
set report_clock_path   1

# Report multi-corner (all active scenarios): 1 = yes, 0 = current only
set multi_corner        1

# Create a consolidated text summary at the end: 1 = yes, 0 = no
set create_summary      1

##############################################################################
# SECTION 2: SETUP - DIRECTORY AND SCENARIO PREP
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_report_timing.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  max_paths          = $max_paths"
puts "  delay_type         = $delay_type"
puts "  path_group         = $path_group"
puts "  significant_digits = $significant_digits"
puts "  output_dir         = $output_dir"
puts "  report_tag         = $report_tag"
puts "  violation_threshold= $violation_threshold ns"
puts "  multi_corner       = $multi_corner"
puts ""

# Verify design is open
set current_design_name [get_attribute [current_design] full_name]
if {$current_design_name eq ""} {
    error "ERROR: No design is currently open."
}
puts "Design: $current_design_name"

# Create output directory if needed
if {$output_dir ne ""} {
    file mkdir $output_dir
    puts "Output directory: $output_dir"
}

# Helper proc: build output file path or return "" for stdout
proc rpt_file {dir tag suffix} {
    if {$dir eq ""} { return "" }
    return "${dir}/${tag}_${suffix}.rpt"
}

# Helper proc: redirect to file if path given, else stdout
proc write_report {rpt_cmd output_file} {
    if {$output_file ne ""} {
        uplevel 1 "$rpt_cmd > $output_file"
        puts "  Written: $output_file"
    } else {
        uplevel 1 $rpt_cmd
    }
}

# Collect scenarios to report
if {$multi_corner} {
    set active_scenarios [get_scenarios -filter "is_active == true" -quiet]
    set scenario_list    [get_attribute $active_scenarios name]
    puts "Active scenarios: $scenario_list"
} else {
    set scenario_list [list [current_scenario]]
    puts "Reporting scenario: $scenario_list"
}

# Full timing update
puts ""
puts "Updating timing..."
update_timing -full
puts "Timing update complete."

##############################################################################
# SECTION 3: TIMING PATH REPORTS
# report_timing with full options for both setup and hold paths.
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 3: TIMING PATH REPORTS"
puts "======================================================================"

# Determine which delay types to loop over
if {$delay_type eq "both"} {
    set dtypes [list max min]
} else {
    set dtypes [list $delay_type]
}

foreach dtype $dtypes {
    if {$dtype eq "max"} {
        set dtype_label "SETUP (max)"
    } else {
        set dtype_label "HOLD (min)"
    }

    puts ""
    puts "--- $dtype_label paths ---"

    # Build report_timing arguments
    set rpt_args [list]
    lappend rpt_args -delay_type $dtype
    lappend rpt_args -max_paths  $max_paths
    lappend rpt_args -significant_digits $significant_digits
    lappend rpt_args -nosplit

    if {$report_input_pins} {
        lappend rpt_args -input_pins
    }

    if {$report_clock_path} {
        lappend rpt_args -path_type full_clock_expanded
    } else {
        lappend rpt_args -path_type full
    }

    # Limit to paths near or worse than violation threshold + margin
    set report_slack [expr {$violation_threshold - $slack_report_limit}]

    if {$path_group ne "all"} {
        lappend rpt_args -path_group $path_group
    }

    # Violations only: paths worse than violation threshold
    set viol_file [rpt_file $output_dir $report_tag "${dtype}_violations"]
    if {$path_group ne "all"} {
        report_timing \
            {*}$rpt_args \
            -slack_lesser_than $violation_threshold \
            > $viol_file
    } else {
        report_timing \
            {*}$rpt_args \
            -slack_lesser_than $violation_threshold \
            > $viol_file
    }
    if {$viol_file ne ""} { puts "  Violations: $viol_file" }

    # Near-miss paths: within slack_report_limit of passing
    set near_file [rpt_file $output_dir $report_tag "${dtype}_nearmiss"]
    report_timing \
        {*}$rpt_args \
        -slack_lesser_than [expr {$violation_threshold + $slack_report_limit}] \
        -slack_greater_than [expr {$violation_threshold - 0.001}] \
        > $near_file
    if {$near_file ne ""} { puts "  Near-miss: $near_file" }

    # Top N paths regardless of slack (most critical paths)
    set top_file [rpt_file $output_dir $report_tag "${dtype}_top${max_paths}"]
    report_timing \
        {*}$rpt_args \
        > $top_file
    if {$top_file ne ""} { puts "  Top paths: $top_file" }

    # Per-path-group breakdown
    if {$path_group eq "all"} {
        set all_groups [get_path_groups -quiet]
        foreach grp [get_attribute $all_groups name] {
            set grp_file [rpt_file $output_dir $report_tag "${dtype}_group_${grp}"]
            report_timing \
                {*}$rpt_args \
                -path_group $grp \
                -max_paths  5 \
                > $grp_file
            # Only print file name if violations exist in this group
            set grp_viol [get_timing_paths \
                -delay_type $dtype \
                -path_group $grp \
                -slack_lesser_than $violation_threshold \
                -max_paths 1 \
                -quiet]
            if {[sizeof_collection $grp_viol] > 0} {
                puts "  Group '$grp' has violations -> $grp_file"
            }
        }
    }
}

##############################################################################
# SECTION 4: CONSTRAINT REPORT
# report_constraint shows all timing constraints and their slack/margin.
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 4: CONSTRAINT REPORT"
puts "======================================================================"

set constraint_file [rpt_file $output_dir $report_tag "constraints"]
report_constraint \
    -all_violators \
    -significant_digits $significant_digits \
    -nosplit \
    > $constraint_file
if {$constraint_file ne ""} { puts "  Constraints (violators): $constraint_file" }

# Full constraint report (all constraints, not just violators)
set constraint_full_file [rpt_file $output_dir $report_tag "constraints_all"]
report_constraint \
    -significant_digits $significant_digits \
    -nosplit \
    > $constraint_full_file
if {$constraint_full_file ne ""} { puts "  Constraints (all): $constraint_full_file" }

##############################################################################
# SECTION 5: QoR REPORT
# report_qor provides a high-level quality-of-results summary.
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 5: QoR REPORT"
puts "======================================================================"

# Full QoR report
set qor_file [rpt_file $output_dir $report_tag "qor"]
report_qor \
    -nosplit \
    > $qor_file
if {$qor_file ne ""} { puts "  QoR: $qor_file" }

# QoR summary only (compact)
set qor_summary_file [rpt_file $output_dir $report_tag "qor_summary"]
report_qor \
    -summary \
    > $qor_summary_file
if {$qor_summary_file ne ""} { puts "  QoR summary: $qor_summary_file" }

# Per-scenario QoR if multi-corner
if {$multi_corner && [llength $scenario_list] > 1} {
    foreach scen $scenario_list {
        set scen_qor_file [rpt_file $output_dir $report_tag "qor_${scen}"]
        report_qor \
            -scenarios $scen \
            -nosplit \
            > $scen_qor_file
        if {$scen_qor_file ne ""} { puts "  QoR ($scen): $scen_qor_file" }
    }
}

##############################################################################
# SECTION 6: CLOCK REPORTS
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 6: CLOCK REPORTS"
puts "======================================================================"

# Clock network latency and skew summary
set clock_file [rpt_file $output_dir $report_tag "clocks"]
report_clock_settings \
    -nosplit \
    > $clock_file
if {$clock_file ne ""} { puts "  Clock settings: $clock_file" }

# Clock timing (propagated latency for each clock endpoint)
set clk_timing_file [rpt_file $output_dir $report_tag "clock_timing"]
report_clock_timing \
    -type latency \
    -significant_digits $significant_digits \
    -nosplit \
    > $clk_timing_file
if {$clk_timing_file ne ""} { puts "  Clock timing (latency): $clk_timing_file" }

# Clock skew report
set clk_skew_file [rpt_file $output_dir $report_tag "clock_skew"]
report_clock_timing \
    -type skew \
    -significant_digits $significant_digits \
    -nosplit \
    > $clk_skew_file
if {$clk_skew_file ne ""} { puts "  Clock timing (skew): $clk_skew_file" }

##############################################################################
# SECTION 7: COLLECT METRICS FOR SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 7: COLLECTING METRICS"
puts "======================================================================"

# Per-scenario metrics collection
set summary_lines [list]
lappend summary_lines "======================================================================"
lappend summary_lines "TIMING ANALYSIS SUMMARY"
lappend summary_lines "Design    : $current_design_name"
lappend summary_lines "Tag       : $report_tag"
lappend summary_lines "Timestamp : [clock format [clock seconds] -format {%Y-%m-%d %H:%M:%S}]"
lappend summary_lines "======================================================================"

foreach scen $scenario_list {
    current_scenario $scen

    # Setup WNS and TNS
    set setup_paths [get_timing_paths \
        -delay_type max \
        -max_paths 1 \
        -quiet \
        -scenarios $scen]
    set setup_wns [expr {[sizeof_collection $setup_paths] > 0 \
        ? [get_attribute $setup_paths slack] : "N/A"}]

    # Hold WNS and TNS
    set hold_paths [get_timing_paths \
        -delay_type min \
        -max_paths 1 \
        -quiet \
        -scenarios $scen]
    set hold_wns [expr {[sizeof_collection $hold_paths] > 0 \
        ? [get_attribute $hold_paths slack] : "N/A"}]

    # Count violations
    set setup_viol_count [sizeof_collection [get_timing_paths \
        -delay_type max \
        -slack_lesser_than $violation_threshold \
        -max_paths 9999 \
        -quiet \
        -scenarios $scen]]

    set hold_viol_count [sizeof_collection [get_timing_paths \
        -delay_type min \
        -slack_lesser_than $violation_threshold \
        -max_paths 9999 \
        -quiet \
        -scenarios $scen]]

    set scen_pass [expr {$setup_viol_count == 0 && $hold_viol_count == 0 \
        ? "PASS" : "FAIL"}]

    lappend summary_lines ""
    lappend summary_lines "Scenario: $scen  [$scen_pass]"
    lappend summary_lines [format "  %-28s %12s" "Setup WNS" \
        [expr {$setup_wns ne "N/A" ? [format "%.4f ns" $setup_wns] : "N/A"}]]
    lappend summary_lines [format "  %-28s %12d" "Setup Violations" $setup_viol_count]
    lappend summary_lines [format "  %-28s %12s" "Hold WNS" \
        [expr {$hold_wns ne "N/A" ? [format "%.4f ns" $hold_wns] : "N/A"}]]
    lappend summary_lines [format "  %-28s %12d" "Hold Violations"  $hold_viol_count]

    puts "  Scenario $scen: Setup WNS=$setup_wns, Hold WNS=$hold_wns, Setup viol=$setup_viol_count, Hold viol=$hold_viol_count"
}

lappend summary_lines ""
lappend summary_lines "======================================================================"
lappend summary_lines "Reports written to: $output_dir/"
lappend summary_lines "======================================================================"

##############################################################################
# SECTION 8: WRITE SUMMARY
##############################################################################

if {$create_summary} {
    puts ""
    puts "======================================================================"
    puts "TIMING SUMMARY"
    puts "======================================================================"

    set summary_text [join $summary_lines "\n"]
    puts $summary_text

    if {$output_dir ne ""} {
        set summary_file "${output_dir}/${report_tag}_SUMMARY.rpt"
        set fh [open $summary_file w]
        puts $fh $summary_text
        close $fh
        puts ""
        puts "Summary written to: $summary_file"
    }
}

puts ""
puts "HiPilot: icc2_report_timing.tcl COMPLETE"
puts "======================================================================"
