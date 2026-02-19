##############################################################################
# innovus_fix_hold_timing.tcl
# HiPilot Template: Fix Hold Timing Violations (Cadence Innovus)
#
# Description:
#   Post-route hold timing closure. Inserts delay buffers / delay cells on
#   hold-violating paths using optDesign -postRoute -hold, then performs
#   targeted ecoAddRepeater for paths that remain violating. Verifies that
#   setup timing is not degraded after hold fixing.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_fix_hold_timing.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
# WARNING: Hold fixing adds cells and increases area/power. Run after
#          setup timing is clean to avoid compounding the problem.
##############################################################################

##############################################################################
# PARAMETERS
##############################################################################

# Maximum violating paths to analyze in timing reports
set max_paths           50

# Hold slack threshold (ns). Paths with hold slack below this are treated
# as violators. For sign-off this is typically 0.0; use a positive margin
# (e.g. 0.050) to add guard-band for manufacturing variation.
set slack_threshold     0.0

# Preferred delay/buffer cell to insert for hold fixing.
# Must exist in the loaded timing library. Use a cell with low drive
# (to minimize area) but sufficient strength for the fanout.
# Examples: "sky130_fd_sc_hd__buf_1", "SC8T_BUFX2_CSC28SLP", "BUFX2"
set buffer_cell         "sky130_fd_sc_hd__dlygate4sd3_1"

# Optimization effort: low | medium | high
set effort              "medium"

# Allow Innovus to also fix setup degradation introduced by hold buffers?
# Recommended: 1 (yes). Setting to 0 may leave setup violations uncorrected.
set fix_setup_after     1

# Maximum hold-fixing iterations. Each iteration re-checks hold and tries
# again. Avoids infinite loops on pathological cases.
set max_iterations      3

# Output report directory
set report_dir          "./reports"

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp           [exec date +%Y%m%d_%H%M%S]
set report_prefix       "${report_dir}/hold_fix_${timestamp}"

file mkdir $report_dir

##############################################################################
# PRE-CHECK
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Fix Hold Timing"
puts "INFO: Timestamp  : $timestamp"
puts "INFO: Max paths  : $max_paths"
puts "INFO: Threshold  : ${slack_threshold} ns"
puts "INFO: Buffer cell: $buffer_cell"
puts "INFO: Effort     : $effort"
puts "INFO: Max iters  : $max_iterations"
puts "INFO: =================================================="

set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Please load a design before running this script."
}
puts "INFO: Design     : $design_name"

# Verify the requested buffer cell exists in the library
set cell_check [get_lib_cells $buffer_cell -quiet]
if { [llength $cell_check] == 0 } {
    puts "WARNING: buffer_cell '$buffer_cell' not found in loaded libraries."
    puts "WARNING: Innovus will use its internal default hold buffer selection."
    puts "WARNING: Set buffer_cell to a valid cell name from your tech library."
}

# Warn if post-route state is not confirmed
set route_status [dbget top.wires.isRouted -e]
if { [llength $route_status] == 0 } {
    puts "WARNING: No routed wires detected. Hold fixing is a post-route operation."
}

##############################################################################
# STEP 1: Report baseline hold timing BEFORE fixing
##############################################################################

puts "\nINFO: ---- Step 1: Baseline hold timing report ----"

report_timing \
    -max_paths          $max_paths \
    -delay_type         min \
    -slack_lesser_than  $slack_threshold \
    -format             {instance arc cell slew load delay arrival slack} \
    > "${report_prefix}_hold_before.rpt"

# Also capture baseline setup WNS/TNS so we can check for degradation later
report_timing \
    -max_paths          $max_paths \
    -delay_type         max \
    -format             {instance arc cell slew load delay arrival slack} \
    > "${report_prefix}_setup_before.rpt"

# Snapshot WNS/TNS before fix
set pre_hold_wns  [dbget [dbget head.timingReports.reportName hold -p].wns  -e]
set pre_hold_tns  [dbget [dbget head.timingReports.reportName hold -p].tns  -e]
set pre_setup_wns [dbget [dbget head.timingReports.reportName setup -p].wns -e]

set pre_hold_nvp [llength [dbget [dbget head.timingReports.reportName hold -p].paths.slack \
    -e -v [expr {$slack_threshold}]]]

puts "INFO: Pre-fix hold  WNS = $pre_hold_wns ns"
puts "INFO: Pre-fix hold  TNS = $pre_hold_tns ns"
puts "INFO: Pre-fix hold violating paths = $pre_hold_nvp"
puts "INFO: Pre-fix setup WNS = $pre_setup_wns ns (reference - must not degrade)"

##############################################################################
# STEP 2: Configure optimization mode for hold fixing
##############################################################################

puts "\nINFO: ---- Step 2: Set optimization mode for hold fixing ----"

# setOptMode controls optimizer behavior:
#   -holdFixing all      : Fix hold violations on ALL paths (not just critical)
#   -holdTargetSlack     : Target slack to achieve (we target slack_threshold)
#   -effort              : Optimization effort
#   -fixSetupHoldTogether: Attempt to fix both setup and hold simultaneously
#                          (set false here; we handle sequentially for control)
#   -usefulSkew true     : Allow useful clock skew to help hold
setOptMode \
    -holdFixing             all \
    -holdTargetSlack        $slack_threshold \
    -effort                 $effort \
    -fixSetupHoldTogether   false \
    -usefulSkew             true

puts "INFO: optMode set: holdFixing=all, target=${slack_threshold}ns"

##############################################################################
# STEP 3: Iterative hold optimization loop
##############################################################################

puts "\nINFO: ---- Step 3: Hold optimization loop (max $max_iterations iters) ----"

set iteration 0
set hold_clean 0

while { $iteration < $max_iterations && !$hold_clean } {
    incr iteration
    puts "\nINFO: Hold fix iteration $iteration of $max_iterations"

    # optDesign -postRoute -hold: Cadence post-route hold optimization.
    # Inserts delay buffers on hold-violating paths to increase minimum delay.
    # -hold          : Target hold violations only
    # -effort        : Inherited from setOptMode
    # Notes:
    #   - Innovus selects buffer cells automatically; it may or may not use
    #     the specific buffer_cell you specified (depends on library/timing).
    #   - Each call may increase cell count and routing congestion slightly.
    optDesign \
        -postRoute \
        -hold \
        -effort $effort

    puts "INFO: optDesign -postRoute -hold iteration $iteration complete"

    # Update timing database after each iteration
    timeDesign -postRoute -hold -expandedViews

    # Check remaining hold violations
    set cur_hold_wns [dbget [dbget head.timingReports.reportName hold -p].wns -e]
    set cur_hold_nvp [llength [dbget [dbget head.timingReports.reportName hold -p].paths.slack \
        -e -v [expr {$slack_threshold}]]]

    puts "INFO: After iter $iteration: hold WNS = $cur_hold_wns ns, violators = $cur_hold_nvp"

    if { $cur_hold_nvp == 0 } {
        puts "INFO: All hold violations resolved at iteration $iteration."
        set hold_clean 1
    }
}

if { !$hold_clean } {
    puts "WARNING: Hold violations remain after $max_iterations iterations."
    puts "WARNING: Remaining violators may require manual ECO or constraint review."
}

##############################################################################
# STEP 4: Manual delay cell insertion for persistent hold violators
##############################################################################

puts "\nINFO: ---- Step 4: ecoAddRepeater for persistent hold violators ----"

# ecoAddRepeater can insert delay/buffer cells on specific nets that
# optDesign could not fix automatically. This is useful for:
#   - Paths with very tight hold requirements (e.g. scan chains)
#   - Paths that optDesign skipped due to congestion
#
# Syntax: ecoAddRepeater -net <net_name> -cell <delay_cell> [-loc <x> <y>]
#
# Example - inserting a delay cell on a specific hold-violating net:
#   ecoAddRepeater -net "u_scan/scan_data_net" \
#                  -cell "sky130_fd_sc_hd__dlygate4sd3_1" \
#                  -loc 85.32 112.48
#
# HiPilot will populate a list of persistent violating nets here.
# Pattern for batch insertion:
#
#   set hold_vio_nets [list \
#       "u_core/net_a" \
#       "u_core/net_b" \
#   ]
#   foreach net $hold_vio_nets {
#       ecoAddRepeater -net $net -cell $buffer_cell
#   }

puts "INFO: Use ecoAddRepeater -net <net> -cell $buffer_cell for manual ECO."
puts "INFO: Run check_eco after manual ECO to verify clean state."

##############################################################################
# STEP 5: Update timing for both setup and hold
##############################################################################

puts "\nINFO: ---- Step 5: Update timing database (setup + hold) ----"

timeDesign -postRoute -setup -hold -expandedViews
puts "INFO: Timing database updated (setup + hold)"

##############################################################################
# STEP 6: Verify setup has not degraded
##############################################################################

puts "\nINFO: ---- Step 6: Setup degradation check ----"

set post_setup_wns [dbget [dbget head.timingReports.reportName setup -p].wns -e]
set setup_delta    [expr { $post_setup_wns - $pre_setup_wns }]

puts "INFO: Setup WNS before hold fix : $pre_setup_wns ns"
puts "INFO: Setup WNS after  hold fix : $post_setup_wns ns"
puts "INFO: Setup WNS delta           : [format %.4f $setup_delta] ns"

if { $setup_delta < -0.010 } {
    puts "WARNING: Setup timing degraded by [format %.4f [expr {abs($setup_delta)}]] ns."
    if { $fix_setup_after } {
        puts "INFO: fix_setup_after=1: Running incremental setup optimization..."
        setOptMode -holdFixing none -effort low
        optDesign -postRoute -setup -effort low
        timeDesign -postRoute -setup -expandedViews
        puts "INFO: Incremental setup fix complete."
    } else {
        puts "WARNING: fix_setup_after=0: Setup degradation not corrected. Review manually."
    }
} else {
    puts "INFO: Setup timing preserved (delta within 10ps tolerance)."
}

##############################################################################
# STEP 7: Final hold timing report
##############################################################################

puts "\nINFO: ---- Step 7: Final hold timing report ----"

report_timing \
    -max_paths          $max_paths \
    -delay_type         min \
    -slack_lesser_than  $slack_threshold \
    -format             {instance arc cell slew load delay arrival slack} \
    > "${report_prefix}_hold_after.rpt"

report_timing \
    -max_paths          $max_paths \
    -delay_type         max \
    -format             {instance arc cell slew load delay arrival slack} \
    > "${report_prefix}_setup_after.rpt"

##############################################################################
# STEP 8: QoR Summary
##############################################################################

set post_hold_wns [dbget [dbget head.timingReports.reportName hold  -p].wns -e]
set post_hold_tns [dbget [dbget head.timingReports.reportName hold  -p].tns -e]
set post_hold_nvp [llength [dbget [dbget head.timingReports.reportName hold -p].paths.slack \
    -e -v [expr {$slack_threshold}]]]

puts "\nINFO: =================================================="
puts "INFO: QoR SUMMARY: Hold Timing Fix"
puts "INFO: =================================================="
puts [format "INFO: %-30s %10s %10s" "Metric" "Before" "After"]
puts [format "INFO: %-30s %10s %10s" "------------------------------" "----------" "----------"]
puts [format "INFO: %-30s %10.4f %10.4f" "Hold WNS (ns)"      $pre_hold_wns  $post_hold_wns]
puts [format "INFO: %-30s %10.4f %10.4f" "Hold TNS (ns)"      $pre_hold_tns  $post_hold_tns]
puts [format "INFO: %-30s %10d %10d" "Hold violating paths"   $pre_hold_nvp  $post_hold_nvp]
puts [format "INFO: %-30s %10.4f %10.4f" "Setup WNS (ns)"     $pre_setup_wns $post_setup_wns]
puts "INFO: =================================================="

if { $post_hold_nvp == 0 } {
    puts "INFO: RESULT: PASS - Hold timing clean (WNS >= ${slack_threshold} ns)"
} else {
    puts "WARNING: RESULT: PARTIAL - $post_hold_nvp hold violators remain."
    puts "WARNING: Consider: additional iterations, constraint review, or manual ECO."
}

set area_after [dbget top.area -e]
puts [format "INFO: %-30s %10s" "Final area (um^2)" $area_after]
puts "INFO: Hold reports: ${report_prefix}_hold_before.rpt / _after.rpt"
puts "INFO: Setup reports: ${report_prefix}_setup_before.rpt / _after.rpt"
puts "INFO: =================================================="
puts "INFO: innovus_fix_hold_timing.tcl COMPLETE"
puts "INFO: =================================================="
