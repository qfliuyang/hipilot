##############################################################################
# icc2_fix_hold_timing.tcl
# HiPilot Template: Fix Hold Timing Violations in Synopsys IC Compiler II
#
# Description:
#   Closes hold timing violations by inserting delay (buffer) cells on
#   violating paths. Hold violations typically appear after CTS when the
#   clock tree is balanced and short data paths are exposed. This script
#   uses ICC2's fix_eco_timing with hold mode and targeted delay insertion.
#
# Usage:
#   source icc2_fix_hold_timing.tcl
#
# Prerequisites:
#   - Design must be post-CTS (clock tree synthesized and propagated)
#   - Timing constraints (SDC) applied
#   - Parasitics estimated or extracted
#   - Clock propagation must be active (not ideal clocks)
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Maximum number of hold-violating paths to analyze and fix
set max_paths           100

# Slack threshold (ns): paths with hold slack worse than this are targeted.
# Negative = hold violation. Example: -0.020 means fix paths with slack < -20ps
set slack_threshold     -0.020

# Delay cell to use for hold fixing.
# Must be a real cell from your PDK. Common examples:
#   sky130hd: "sky130_fd_sc_hd__buf_1", "sky130_fd_sc_hd__dlygate4sd3_1"
#   TSMC 7FF:  "DLYB1BWP7T", "BUFFD1BWP7T"
#   Generic:   use your site's delay/buffer cells
# If empty, ICC2 will select automatically from the library
set buffer_cell         ""

# If buffer_cell is empty, ICC2 will pick from these prefixes (site-specific)
# Provide a library cell pattern that matches delay/buffer cells in your PDK
set delay_cell_pattern  "DLYB*"

# Maximum number of hold fix iterations
set max_iterations      5

# Minimum improvement per iteration to continue (ns)
set min_improvement     0.005

# Target scenario for hold analysis (leave empty for current scenario)
# Example: "func_ss_0p72v_m40c" -- cold corner is worst-case for hold
set target_scenario     ""

# Output report file prefix
set report_prefix       "./reports/fix_hold"

# Setup slack guard band (ns): do not degrade setup slack worse than this.
# This prevents hold fixes from creating new setup violations.
# Set to 0.0 to use the current setup WNS as guard band.
set setup_guard_band    0.0

# Enable auto ECO legalization after fixing
set legalize_after_fix  1

##############################################################################
# SECTION 2: PRE-CHECK
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_fix_hold_timing.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  max_paths         = $max_paths"
puts "  slack_threshold   = $slack_threshold ns"
puts "  buffer_cell       = [expr {$buffer_cell eq \"\" ? \"(auto-select)\" : $buffer_cell}]"
puts "  max_iterations    = $max_iterations"
puts "  target_scenario   = [expr {$target_scenario eq \"\" ? \"(current)\" : $target_scenario}]"
puts "  report_prefix     = $report_prefix"
puts "  setup_guard_band  = $setup_guard_band ns"
puts ""

# Verify design is open
set current_design_name [get_attribute [current_design] full_name]
if {$current_design_name eq ""} {
    error "ERROR: No design is currently open."
}
puts "Pre-check: Design = $current_design_name"

# Verify clock tree is synthesized (propagated clocks required for hold analysis)
set ideal_clocks [get_clocks -filter "is_propagated == false" -quiet]
set ideal_count  [sizeof_collection $ideal_clocks]
if {$ideal_count > 0} {
    puts "WARNING: $ideal_count clock(s) are still ideal (not propagated)."
    puts "         Hold analysis is only meaningful with propagated (CTS) clocks."
    puts "         Proceeding, but results may not reflect real hold risk."
} else {
    puts "Pre-check: All clocks propagated (CTS complete)"
}

# Switch to target scenario if specified
if {$target_scenario ne ""} {
    set_scenario_status $target_scenario -active true
    current_scenario $target_scenario
    puts "Pre-check: Switched to scenario $target_scenario"
} else {
    puts "Pre-check: Using scenario [current_scenario]"
}

# Verify buffer_cell exists in library if specified
if {$buffer_cell ne ""} {
    set cell_check [get_lib_cells -quiet $buffer_cell]
    if {[sizeof_collection $cell_check] == 0} {
        error "ERROR: buffer_cell '$buffer_cell' not found in loaded libraries."
    }
    puts "Pre-check: buffer_cell '$buffer_cell' found in library"
}

# Full timing update before baseline
puts ""
puts "Updating timing (full)..."
update_timing -full

##############################################################################
# SECTION 3: BASELINE HOLD TIMING REPORT
##############################################################################

puts ""
puts "======================================================================"
puts "BASELINE HOLD TIMING (before fix)"
puts "======================================================================"

# Report hold QoR for baseline
set baseline_qor_file "${report_prefix}_baseline_qor.rpt"
report_qor \
    -summary \
    > $baseline_qor_file
puts "  QoR summary written to: $baseline_qor_file"

# Report hold violating paths
report_timing \
    -delay_type min \
    -max_paths $max_paths \
    -slack_lesser_than [expr {$slack_threshold + 0.001}] \
    -input_pins \
    -path_type full_clock_expanded \
    -significant_digits 4 \
    -nosplit \
    > "${report_prefix}_baseline_hold_violations.rpt"
puts "  Hold violations written to: ${report_prefix}_baseline_hold_violations.rpt"

# Capture baseline hold WNS
set baseline_hold_wns [get_attribute \
    [get_timing_paths -delay_type min -max_paths 1 -quiet] \
    slack -quiet]
if {$baseline_hold_wns eq ""} { set baseline_hold_wns 0.0 }
puts "  Baseline Hold WNS = $baseline_hold_wns ns"

# Capture baseline setup WNS (to monitor for degradation)
set baseline_setup_wns [get_attribute \
    [get_timing_paths -delay_type max -max_paths 1 -quiet] \
    slack -quiet]
if {$baseline_setup_wns eq ""} { set baseline_setup_wns 0.0 }
puts "  Baseline Setup WNS = $baseline_setup_wns ns (guard band reference)"

# Determine setup guard threshold
if {$setup_guard_band == 0.0} {
    # Use current setup WNS: do not worsen it
    set setup_guard [expr {$baseline_setup_wns - 0.010}]
} else {
    set setup_guard [expr {-1.0 * abs($setup_guard_band)}]
}
puts "  Setup guard threshold = $setup_guard ns"

# Count violations
set hold_viol_paths [get_timing_paths \
    -delay_type min \
    -slack_lesser_than $slack_threshold \
    -max_paths $max_paths \
    -quiet]
set hold_viol_count [sizeof_collection $hold_viol_paths]
puts "  Hold paths violating threshold ($slack_threshold ns): $hold_viol_count"

if {$hold_viol_count == 0} {
    puts ""
    puts "INFO: No hold violations found at threshold $slack_threshold ns."
    puts "      No hold fixing needed. Exiting."
    return
}

##############################################################################
# SECTION 4: CONFIGURE HOLD FIX OPTIONS
##############################################################################

puts ""
puts "======================================================================"
puts "Configuring hold fix options"
puts "======================================================================"

# Configure eco hold fixing: protect setup, allow delay insertion
set_app_options -name opt.hold.effort_level              -value high
set_app_options -name opt.eco.allow_buffer_insertion     -value true
set_app_options -name opt.eco.allow_size_cell            -value false

# Prevent hold fixes from violating setup guard band
# ICC2 will not insert hold buffers that cause setup slack < guard band
set_app_options -name opt.hold.setup_slack_limit         -value $setup_guard

puts "  opt.hold.effort_level          = high"
puts "  opt.eco.allow_buffer_insertion = true"
puts "  opt.eco.allow_size_cell        = false (hold fix only)"
puts "  opt.hold.setup_slack_limit     = $setup_guard ns"

# Configure which cells ICC2 may use for hold fixing
if {$buffer_cell ne ""} {
    # Restrict to the specified delay/buffer cell
    set_dont_use [get_lib_cells -quiet "${delay_cell_pattern}"] true
    set_dont_use [get_lib_cells -quiet $buffer_cell] false
    puts "  Hold buffer cell restricted to: $buffer_cell"
} else {
    puts "  Hold buffer cell: auto-selected by ICC2"
}

##############################################################################
# SECTION 5: ITERATIVE HOLD FIX
##############################################################################

puts ""
puts "======================================================================"
puts "Running iterative hold fix"
puts "======================================================================"

set prev_hold_wns $baseline_hold_wns
set iteration     0
set cells_inserted 0

while {$iteration < $max_iterations} {
    incr iteration
    puts ""
    puts "--- Iteration $iteration of $max_iterations ---"

    # Count violations before this iteration
    set pre_viol [get_timing_paths \
        -delay_type min \
        -slack_lesser_than $slack_threshold \
        -max_paths $max_paths \
        -quiet]
    set pre_count [sizeof_collection $pre_viol]
    puts "  Hold violations entering iteration: $pre_count"

    if {$pre_count == 0} {
        puts "  All hold violations closed. Stopping early."
        break
    }

    # Fix hold timing using ICC2's eco engine
    # fix_eco_timing -type hold targets minimum-delay paths and inserts delay
    if {$buffer_cell ne ""} {
        fix_eco_timing \
            -type hold \
            -buffer_list [get_lib_cells $buffer_cell] \
            -slack_lesser_than $slack_threshold \
            -max_paths $max_paths
    } else {
        fix_eco_timing \
            -type hold \
            -slack_lesser_than $slack_threshold \
            -max_paths $max_paths
    }

    # Legalize cell positions after hold buffer insertion
    # Newly inserted buffers may overlap adjacent cells
    if {$legalize_after_fix} {
        legalize_placement -incremental
    }

    # Update timing after this iteration
    update_timing -full

    # Measure post-iteration hold WNS
    set cur_hold_wns [get_attribute \
        [get_timing_paths -delay_type min -max_paths 1 -quiet] \
        slack -quiet]
    if {$cur_hold_wns eq ""} { set cur_hold_wns 0.0 }

    set improvement [expr {$cur_hold_wns - $prev_hold_wns}]
    puts "  Hold WNS after iteration $iteration: $cur_hold_wns ns  (improvement: $improvement ns)"

    # Check setup slack has not been degraded beyond guard band
    set cur_setup_wns [get_attribute \
        [get_timing_paths -delay_type max -max_paths 1 -quiet] \
        slack -quiet]
    if {$cur_setup_wns eq ""} { set cur_setup_wns 0.0 }

    if {$cur_setup_wns < $setup_guard} {
        puts "WARNING: Setup WNS = $cur_setup_wns ns, below guard band $setup_guard ns."
        puts "         Hold fix is hurting setup. Stopping iteration."
        break
    }

    # Count remaining violations after iteration
    set post_viol [get_timing_paths \
        -delay_type min \
        -slack_lesser_than $slack_threshold \
        -max_paths $max_paths \
        -quiet]
    set post_count [sizeof_collection $post_viol]
    puts "  Hold violations after iteration $iteration: $post_count"

    # Stop if improvement below minimum threshold
    if {$improvement < $min_improvement && $iteration > 1} {
        puts "  Improvement ($improvement ns) below minimum ($min_improvement ns). Stopping."
        break
    }

    set prev_hold_wns $cur_hold_wns
}

##############################################################################
# SECTION 6: POST-FIX VERIFICATION
##############################################################################

puts ""
puts "======================================================================"
puts "POST-FIX HOLD VERIFICATION"
puts "======================================================================"

# Final timing update
update_timing -full

# Post-fix QoR
set postfix_qor_file "${report_prefix}_postfix_qor.rpt"
report_qor -summary > $postfix_qor_file
puts "  Post-fix QoR written to: $postfix_qor_file"

# Post-fix hold violations
report_timing \
    -delay_type min \
    -max_paths $max_paths \
    -slack_lesser_than [expr {$slack_threshold + 0.001}] \
    -input_pins \
    -path_type full_clock_expanded \
    -significant_digits 4 \
    -nosplit \
    > "${report_prefix}_postfix_hold_violations.rpt"
puts "  Post-fix hold violations written to: ${report_prefix}_postfix_hold_violations.rpt"

# Post-fix setup check (confirm no setup degradation)
report_timing \
    -delay_type max \
    -max_paths 20 \
    -slack_lesser_than 0 \
    -input_pins \
    -significant_digits 4 \
    -nosplit \
    > "${report_prefix}_postfix_setup_check.rpt"
puts "  Post-fix setup check written to: ${report_prefix}_postfix_setup_check.rpt"

# Final metrics
set final_hold_wns [get_attribute \
    [get_timing_paths -delay_type min -max_paths 1 -quiet] \
    slack -quiet]
if {$final_hold_wns eq ""} { set final_hold_wns 0.0 }

set final_setup_wns [get_attribute \
    [get_timing_paths -delay_type max -max_paths 1 -quiet] \
    slack -quiet]
if {$final_setup_wns eq ""} { set final_setup_wns 0.0 }

set final_hold_viol [get_timing_paths \
    -delay_type min \
    -slack_lesser_than $slack_threshold \
    -max_paths $max_paths \
    -quiet]
set final_hold_count [sizeof_collection $final_hold_viol]

set hold_improvement [expr {$final_hold_wns - $baseline_hold_wns}]
set setup_delta      [expr {$final_setup_wns - $baseline_setup_wns}]

##############################################################################
# SECTION 7: SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "HOLD FIX SUMMARY"
puts "======================================================================"
puts [format "  %-32s %10s" "Metric" "Value"]
puts [format "  %-32s %10s" [string repeat "-" 32] [string repeat "-" 10]]
puts [format "  %-32s %10.4f ns" "Baseline Hold WNS"     $baseline_hold_wns]
puts [format "  %-32s %10.4f ns" "Final Hold WNS"         $final_hold_wns]
puts [format "  %-32s %10.4f ns" "Hold WNS Improvement"   $hold_improvement]
puts [format "  %-32s %10d"    "Initial Hold Violations" $hold_viol_count]
puts [format "  %-32s %10d"    "Remaining Hold Violations" $final_hold_count]
puts [format "  %-32s %10d"    "Hold Violations Closed"  [expr {$hold_viol_count - $final_hold_count}]]
puts [format "  %-32s %10.4f ns" "Baseline Setup WNS"    $baseline_setup_wns]
puts [format "  %-32s %10.4f ns" "Final Setup WNS"        $final_setup_wns]
puts [format "  %-32s %10.4f ns" "Setup WNS Delta"        $setup_delta]
puts [format "  %-32s %10d"    "Iterations Run"          $iteration]
puts "======================================================================"

if {$final_hold_count == 0} {
    puts "RESULT: All hold violations CLOSED at threshold $slack_threshold ns"
} else {
    puts "RESULT: $final_hold_count hold violations remain."
    puts "        Review ${report_prefix}_postfix_hold_violations.rpt"
    puts "        Consider: larger delay cells, adjusted guard band, or physical re-floorplan."
}

if {$setup_delta < -0.030} {
    puts "WARNING: Setup WNS degraded by [expr {abs($setup_delta)}] ns."
    puts "         Review ${report_prefix}_postfix_setup_check.rpt"
    puts "         Run icc2_fix_setup_timing.tcl if setup violations were introduced."
}

puts ""
puts "Reports written to: $report_prefix*.rpt"
puts "HiPilot: icc2_fix_hold_timing.tcl COMPLETE"
puts "======================================================================"
