##############################################################################
# icc2_fix_setup_timing.tcl
# HiPilot Template: Fix Setup Timing Violations in Synopsys IC Compiler II
#
# Description:
#   Performs incremental optimization to close setup timing violations.
#   Strategy: upsizing critical cells and targeted buffer insertion on
#   high-fanout or long-wire paths, followed by re-timing verification.
#
# Usage:
#   source icc2_fix_setup_timing.tcl
#   -- or --
#   icc2_shell> source icc2_fix_setup_timing.tcl
#
# Prerequisites:
#   - Design must be loaded and placed (post-placement or post-route)
#   - Timing constraints (SDC) must be applied
#   - Parasitics must be estimated or extracted
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
# Modify these variables to match your design and target requirements.
##############################################################################

# Maximum number of violating paths to analyze and fix
set max_paths           50

# Slack threshold (ns): paths with slack worse than this value are targeted.
# Negative = setup violation. Example: -0.050 means fix paths with slack < -50ps
set slack_threshold     -0.050

# Path group to focus on. Use "all" to process all registered path groups,
# or specify a named group e.g. "clk_core", "reg2reg", "INPUTS"
set path_group          "all"

# Optimization effort level: low | medium | high
# high effort runs longer but achieves better results
set effort              "medium"

# Target corner for timing analysis (leave empty to use current scenario)
# Example: "func_ss_0p72v_125c"
set target_scenario     ""

# Maximum number of optimization iterations
set max_iterations      3

# Output report file prefix (reports will be written here)
set report_prefix       "./reports/fix_setup"

# Enable hold-aware optimization: 1 = protect hold slack, 0 = ignore hold
set hold_aware          1

# Minimum slack improvement per iteration to continue (ns)
# If WNS does not improve by at least this much, stop early
set min_improvement     0.005

##############################################################################
# SECTION 2: PRE-CHECK
# Verify design is in a valid state before making changes.
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_fix_setup_timing.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  max_paths       = $max_paths"
puts "  slack_threshold = $slack_threshold ns"
puts "  path_group      = $path_group"
puts "  effort          = $effort"
puts "  hold_aware      = $hold_aware"
puts "  max_iterations  = $max_iterations"
puts "  report_prefix   = $report_prefix"
puts ""

# Verify design is open
set current_design_name [get_attribute [current_design] full_name]
if {$current_design_name eq ""} {
    error "ERROR: No design is currently open. Load a design first."
}
puts "Pre-check: Design loaded = $current_design_name"

# Verify placement is complete (cells must be placed for meaningful ECO)
set unplaced_count [sizeof_collection [get_cells -filter "is_placed == false" -quiet]]
if {$unplaced_count > 0} {
    puts "WARNING: $unplaced_count unplaced cells found."
    puts "         Setup fix quality may be degraded. Run placement first."
}

# Verify timing constraints are loaded
set sdc_files [get_attribute [current_scenario] constraint_files -quiet]
if {[llength $sdc_files] == 0} {
    error "ERROR: No SDC constraints applied to current scenario. Apply timing constraints first."
}
puts "Pre-check: SDC constraints present"

# Switch to target scenario if specified
if {$target_scenario ne ""} {
    set_scenario_status $target_scenario -active true
    current_scenario $target_scenario
    puts "Pre-check: Switched to scenario $target_scenario"
} else {
    puts "Pre-check: Using current scenario [current_scenario]"
}

# Update timing before baseline measurement
puts ""
puts "Updating timing (full incremental)..."
update_timing -full

##############################################################################
# SECTION 3: BASELINE TIMING REPORT
# Capture timing before any changes for comparison at the end.
##############################################################################

puts ""
puts "======================================================================"
puts "BASELINE TIMING (before fix)"
puts "======================================================================"

# Report QoR summary for baseline
set baseline_file "${report_prefix}_baseline_qor.rpt"
report_qor \
    -summary \
    > $baseline_file
puts "  QoR summary written to: $baseline_file"

# Capture baseline WNS and TNS for comparison
if {$path_group eq "all"} {
    set baseline_timing [report_timing \
        -max_paths 1 \
        -slack_lesser_than 0 \
        -delay_type max \
        -input_pins \
        -nosplit \
        -return_string]
} else {
    set baseline_timing [report_timing \
        -max_paths 1 \
        -path_group $path_group \
        -slack_lesser_than 0 \
        -delay_type max \
        -input_pins \
        -nosplit \
        -return_string]
}

# Extract WNS from QoR (used for improvement tracking)
set baseline_wns [get_attribute [get_timing_paths -delay_type max -max_paths 1 -quiet] slack -quiet]
if {$baseline_wns eq ""} { set baseline_wns 0.0 }
puts "  Baseline WNS = $baseline_wns ns"

# Report violating paths detail to file
if {$path_group eq "all"} {
    report_timing \
        -max_paths $max_paths \
        -slack_lesser_than $slack_threshold \
        -delay_type max \
        -input_pins \
        -path_type full_clock_expanded \
        -significant_digits 4 \
        -nosplit \
        > "${report_prefix}_baseline_violations.rpt"
} else {
    report_timing \
        -max_paths $max_paths \
        -path_group $path_group \
        -slack_lesser_than $slack_threshold \
        -delay_type max \
        -input_pins \
        -path_type full_clock_expanded \
        -significant_digits 4 \
        -nosplit \
        > "${report_prefix}_baseline_violations.rpt"
}
puts "  Violating paths written to: ${report_prefix}_baseline_violations.rpt"

# Count violations at threshold
set viol_paths [get_timing_paths \
    -delay_type max \
    -slack_lesser_than $slack_threshold \
    -max_paths $max_paths \
    -quiet]
set viol_count [sizeof_collection $viol_paths]
puts "  Paths violating threshold ($slack_threshold ns): $viol_count"

if {$viol_count == 0} {
    puts ""
    puts "INFO: No setup violations found at threshold $slack_threshold ns."
    puts "      No optimization needed. Exiting."
    return
}

##############################################################################
# SECTION 4: OPTIMIZATION APP OPTIONS
# Configure ICC2 optimization settings appropriate for setup fixing.
##############################################################################

puts ""
puts "======================================================================"
puts "Configuring optimization options (effort = $effort)"
puts "======================================================================"

# Save current app options so they can be restored if needed
set saved_opt_effort [get_app_option_value -name opt.common.effort_level]

# Set optimization effort
set_app_options -name opt.common.effort_level        -value $effort

# Allow cell resizing (upsizing to drive longer wires faster)
set_app_options -name opt.eco.allow_size_cell        -value true

# Allow buffer insertion on critical paths
set_app_options -name opt.eco.allow_buffer_insertion -value true

# Limit transformations to fix timing only (no area recovery in this pass)
set_app_options -name opt.area.effort_level          -value none

# Protect hold slack if requested
if {$hold_aware} {
    set_app_options -name opt.hold.effort_level      -value low
    puts "  Hold-aware mode: ON (hold slack will be protected)"
} else {
    set_app_options -name opt.hold.effort_level      -value none
    puts "  Hold-aware mode: OFF"
}

# Enable critical path tracing for better optimization guidance
set_app_options -name time.enable_ccd                -value true

puts "  opt.common.effort_level        = $effort"
puts "  opt.eco.allow_size_cell        = true"
puts "  opt.eco.allow_buffer_insertion = true"

##############################################################################
# SECTION 5: ITERATIVE SETUP FIX
# Run optimization iterations until violations are closed or max_iterations
# is reached without sufficient improvement.
##############################################################################

puts ""
puts "======================================================================"
puts "Running iterative setup optimization"
puts "======================================================================"

set prev_wns $baseline_wns
set iteration 0

while {$iteration < $max_iterations} {
    incr iteration
    puts ""
    puts "--- Iteration $iteration of $max_iterations ---"

    # Check remaining violations before this iteration
    set pre_iter_paths [get_timing_paths \
        -delay_type max \
        -slack_lesser_than $slack_threshold \
        -max_paths $max_paths \
        -quiet]
    set pre_iter_count [sizeof_collection $pre_iter_paths]

    if {$pre_iter_count == 0} {
        puts "  All violations closed. Stopping early at iteration $iteration."
        break
    }
    puts "  Violations entering iteration $iteration: $pre_iter_count"

    # Run incremental optimization targeting setup
    # refine_opt focuses on fixing remaining violations without ripping up placement
    if {$path_group eq "all"} {
        refine_opt
    } else {
        # Focus optimization on the specific path group
        set_path_group_options $path_group \
            -weight 10.0 \
            -critical_range [expr {abs($slack_threshold) * 2}]
        refine_opt
        # Reset path group weight to neutral after optimization
        set_path_group_options $path_group -weight 1.0
    }

    # Update timing after optimization pass
    update_timing -full

    # Measure WNS after this iteration
    set cur_wns [get_attribute \
        [get_timing_paths -delay_type max -max_paths 1 -quiet] \
        slack -quiet]
    if {$cur_wns eq ""} { set cur_wns 0.0 }

    set improvement [expr {$cur_wns - $prev_wns}]
    puts "  WNS after iteration $iteration: $cur_wns ns  (improvement: $improvement ns)"

    # Check remaining violations
    set post_iter_paths [get_timing_paths \
        -delay_type max \
        -slack_lesser_than $slack_threshold \
        -max_paths $max_paths \
        -quiet]
    set post_iter_count [sizeof_collection $post_iter_paths]
    puts "  Violations after iteration $iteration: $post_iter_count"

    # Stop if improvement is below the minimum threshold
    if {$improvement < $min_improvement && $iteration > 1} {
        puts "  Improvement ($improvement ns) below minimum ($min_improvement ns). Stopping."
        break
    }

    set prev_wns $cur_wns
}

##############################################################################
# SECTION 6: POST-FIX VERIFICATION
# Report timing after optimization to quantify improvement.
##############################################################################

puts ""
puts "======================================================================"
puts "POST-FIX TIMING VERIFICATION"
puts "======================================================================"

# Final timing update
update_timing -full

# Report post-fix QoR
set postfix_qor_file "${report_prefix}_postfix_qor.rpt"
report_qor \
    -summary \
    > $postfix_qor_file
puts "  Post-fix QoR summary written to: $postfix_qor_file"

# Report remaining violations
if {$path_group eq "all"} {
    report_timing \
        -max_paths $max_paths \
        -slack_lesser_than $slack_threshold \
        -delay_type max \
        -input_pins \
        -path_type full_clock_expanded \
        -significant_digits 4 \
        -nosplit \
        > "${report_prefix}_postfix_violations.rpt"
} else {
    report_timing \
        -max_paths $max_paths \
        -path_group $path_group \
        -slack_lesser_than $slack_threshold \
        -delay_type max \
        -input_pins \
        -path_type full_clock_expanded \
        -significant_digits 4 \
        -nosplit \
        > "${report_prefix}_postfix_violations.rpt"
}
puts "  Post-fix violations written to: ${report_prefix}_postfix_violations.rpt"

# Capture final WNS
set final_wns [get_attribute \
    [get_timing_paths -delay_type max -max_paths 1 -quiet] \
    slack -quiet]
if {$final_wns eq ""} { set final_wns 0.0 }

set total_improvement [expr {$final_wns - $baseline_wns}]

# Count remaining violations at threshold
set final_viol_paths [get_timing_paths \
    -delay_type max \
    -slack_lesser_than $slack_threshold \
    -max_paths $max_paths \
    -quiet]
set final_viol_count [sizeof_collection $final_viol_paths]

# Verify hold has not been degraded
set hold_wns [get_attribute \
    [get_timing_paths -delay_type min -max_paths 1 -quiet] \
    slack -quiet]
if {$hold_wns eq ""} { set hold_wns 0.0 }

##############################################################################
# SECTION 7: SUMMARY REPORT
##############################################################################

puts ""
puts "======================================================================"
puts "SETUP FIX SUMMARY"
puts "======================================================================"
puts [format "  %-30s %10s" "Metric" "Value"]
puts [format "  %-30s %10s" [string repeat "-" 30] [string repeat "-" 10]]
puts [format "  %-30s %10.4f ns" "Baseline WNS"       $baseline_wns]
puts [format "  %-30s %10.4f ns" "Final WNS"           $final_wns]
puts [format "  %-30s %10.4f ns" "WNS Improvement"     $total_improvement]
puts [format "  %-30s %10d"    "Initial Violations"   $viol_count]
puts [format "  %-30s %10d"    "Remaining Violations" $final_viol_count]
puts [format "  %-30s %10d"    "Violations Closed"    [expr {$viol_count - $final_viol_count}]]
puts [format "  %-30s %10.4f ns" "Hold WNS (check)"   $hold_wns]
puts [format "  %-30s %10d"    "Iterations Run"       $iteration]
puts "======================================================================"

if {$final_viol_count == 0} {
    puts "RESULT: All setup violations CLOSED at threshold $slack_threshold ns"
} else {
    puts "RESULT: $final_viol_count violations remain. Review ${report_prefix}_postfix_violations.rpt"
    puts "        Consider: higher effort, relaxed constraints, or physical redesign."
}

if {$hold_wns < -0.010} {
    puts "WARNING: Hold WNS = $hold_wns ns. Hold violations introduced or worsened."
    puts "         Run icc2_fix_hold_timing.tcl to resolve."
}

puts ""
puts "Reports written to: $report_prefix*.rpt"
puts "HiPilot: icc2_fix_setup_timing.tcl COMPLETE"
puts "======================================================================"

# Restore saved app options
set_app_options -name opt.common.effort_level -value $saved_opt_effort
