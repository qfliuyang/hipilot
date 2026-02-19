##############################################################################
# icc2_route_design.tcl
# HiPilot Template: Route Design in Synopsys IC Compiler II
#
# Description:
#   Executes the complete routing flow in ICC2: pre-route checks, global
#   routing (route_auto), detail routing cleanup, DRC violation fixing,
#   antenna rule checking, and a post-route verification summary.
#   Designed for use after placement and CTS are complete.
#
# Usage:
#   source icc2_route_design.tcl
#
# Prerequisites:
#   - Design must be placed and CTS-complete
#   - Power straps (VDD/VSS) must exist
#   - RC tech file and routing rules must be loaded
#   - Design rule constraints applied
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Routing effort: low | medium | high
# high effort improves DRC closure but takes significantly longer
set effort              "medium"

# Enable antenna fix during routing: 1 = yes, 0 = no
# Antenna violations can cause gate oxide damage in manufacturing
set antenna_fix         1

# Number of DRC fix iterations to run after initial route_auto
# Each iteration attempts to resolve remaining DRC violations
set drc_fix_iterations  3

# Run detail route (route_detail) after route_auto to clean up shorts/opens
# Recommended: always 1 for production signoff flows
set run_detail_route    1

# Maximum number of DRC violations to report in the summary
set max_drc_report      50

# Output report directory
set report_dir          "./reports/routing"

# Report tag for file naming (e.g. "postRoute", "iter2")
set report_tag          "postRoute"

# Enable timing-driven routing: routes critical paths with tighter constraints
set timing_driven       1

# Enable SI (signal integrity) aware routing: prevents crosstalk-sensitive
# nets from being routed adjacent to aggressor nets
set si_driven           1

# Save design after routing: 1 = yes, 0 = no
set save_design_after   1

# Checkpoint name for saving (used if save_design_after = 1)
set checkpoint_name     "./checkpoints/post_route"

##############################################################################
# SECTION 2: PRE-ROUTE CHECKS
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_route_design.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  effort              = $effort"
puts "  antenna_fix         = $antenna_fix"
puts "  drc_fix_iterations  = $drc_fix_iterations"
puts "  run_detail_route    = $run_detail_route"
puts "  timing_driven       = $timing_driven"
puts "  si_driven           = $si_driven"
puts "  save_design_after   = $save_design_after"
puts "  report_dir          = $report_dir"
puts ""

# Verify design is open
set current_design_name [get_attribute [current_design] full_name]
if {$current_design_name eq ""} {
    error "ERROR: No design is currently open."
}
puts "Pre-check: Design = $current_design_name"

# Create output directory
file mkdir $report_dir

# Run check_design to identify issues before routing
puts ""
puts "--- Running pre-route check_design ---"
set precheck_file "${report_dir}/${report_tag}_precheck.rpt"
check_design \
    -checks pre_route_stage \
    > $precheck_file
puts "  check_design report: $precheck_file"

# Verify power and ground nets exist
set pwr_nets [get_nets -filter "net_type == power"  -quiet]
set gnd_nets [get_nets -filter "net_type == ground" -quiet]
if {[sizeof_collection $pwr_nets] == 0 || [sizeof_collection $gnd_nets] == 0} {
    puts "WARNING: Power or ground nets not found."
    puts "         Routing may fail without proper power mesh."
} else {
    puts "Pre-check: Power nets = [sizeof_collection $pwr_nets], Ground nets = [sizeof_collection $gnd_nets]"
}

# Check placement is legalized (no overlapping cells)
set unplaced [get_cells -filter "is_placed == false" -quiet]
if {[sizeof_collection $unplaced] > 0} {
    error "ERROR: [sizeof_collection $unplaced] unplaced cells found. Complete placement first."
}
puts "Pre-check: All cells placed"

# Verify routing layers are enabled
set routing_layers [get_layers -filter "layer_type == routing" -quiet]
set layer_count [sizeof_collection $routing_layers]
if {$layer_count == 0} {
    error "ERROR: No routing layers found. Check technology file."
}
puts "Pre-check: Routing layers available = $layer_count"

# Verify clock tree is synthesized (propagated clocks expected post-CTS)
set propagated_clk_count [sizeof_collection \
    [get_clocks -filter "is_propagated == true" -quiet]]
if {$propagated_clk_count == 0} {
    puts "WARNING: No propagated clocks found. Is CTS complete?"
    puts "         Timing-driven routing quality may be degraded."
} else {
    puts "Pre-check: Propagated clocks = $propagated_clk_count (CTS complete)"
}

puts ""
puts "Pre-route checks complete."

##############################################################################
# SECTION 3: CONFIGURE ROUTING APP OPTIONS
##############################################################################

puts ""
puts "======================================================================"
puts "Configuring routing options"
puts "======================================================================"

# Routing effort
set_app_options -name route.common.effort_level             -value $effort

# Timing-driven routing: routes critical nets with spacing and via rules
# that minimize parasitic resistance and coupling
if {$timing_driven} {
    set_app_options -name route.common.timing_driven_route  -value true
    puts "  Timing-driven routing: ON"
} else {
    set_app_options -name route.common.timing_driven_route  -value false
    puts "  Timing-driven routing: OFF"
}

# Signal integrity aware routing
if {$si_driven} {
    set_app_options -name route.common.crosstalk_driven_route -value true
    puts "  SI/crosstalk-driven routing: ON"
} else {
    set_app_options -name route.common.crosstalk_driven_route -value false
    puts "  SI/crosstalk-driven routing: OFF"
}

# Antenna fixing during routing
if {$antenna_fix} {
    set_app_options -name route.detail.antenna             -value true
    set_app_options -name route.detail.antenna_fixing      -value true
    puts "  Antenna fixing: ON"
} else {
    set_app_options -name route.detail.antenna             -value false
    puts "  Antenna fixing: OFF"
}

# Spread wires where space allows (improves SI and manufacturability)
set_app_options -name route.detail.spread_wires            -value true

# Enable loop removal (removes redundant wiring created during fixing)
set_app_options -name route.detail.remove_redundant_connection -value true

puts "  route.common.effort_level = $effort"

##############################################################################
# SECTION 4: ROUTE_AUTO (GLOBAL + TRACK ASSIGNMENT + DETAIL)
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 4: ROUTE_AUTO"
puts "======================================================================"
puts "Starting route_auto at [clock format [clock seconds] -format {%H:%M:%S}] ..."
puts "This may take several minutes for large designs."
puts ""

# route_auto runs the full routing flow:
#   1. Global routing  - assigns nets to routing regions
#   2. Track assignment - maps global routes to specific tracks
#   3. Detail routing  - resolves individual wire segments and vias
route_auto

puts ""
puts "route_auto complete at [clock format [clock seconds] -format {%H:%M:%S}]"

##############################################################################
# SECTION 5: POST ROUTE_AUTO DRC CHECK AND FIX
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 5: DRC CHECK AND INCREMENTAL FIX"
puts "======================================================================"

for {set iter 1} {$iter <= $drc_fix_iterations} {incr iter} {
    puts ""
    puts "--- DRC fix iteration $iter of $drc_fix_iterations ---"

    # Check routing DRC violations
    check_routes

    # Capture DRC violation count from route status
    set drc_count [get_attribute [current_design] \
        route_drc_error_count -quiet]
    if {$drc_count eq ""} { set drc_count "unknown" }
    puts "  DRC violations after iteration $iter: $drc_count"

    if {$drc_count eq "0" || $drc_count == 0} {
        puts "  No DRC violations. Stopping DRC fix loop."
        break
    }

    # Run detail routing to fix remaining violations
    if {$run_detail_route} {
        puts "  Running route_detail to resolve violations..."
        route_detail \
            -incremental true \
            -initial_drc_from_input true
    }

    # Also attempt ECO route to fix any opens created during DRC fixing
    route_eco
}

##############################################################################
# SECTION 6: ANTENNA RULE CHECK (if antenna_fix enabled)
##############################################################################

if {$antenna_fix} {
    puts ""
    puts "======================================================================"
    puts "SECTION 6: ANTENNA RULE CHECK"
    puts "======================================================================"

    set antenna_file "${report_dir}/${report_tag}_antenna.rpt"

    # check_antenna verifies wire segments do not exceed antenna ratio rules
    # from the PDK. Violations can cause oxide damage during manufacturing.
    check_antenna \
        > $antenna_file
    puts "  Antenna check written to: $antenna_file"

    # Count antenna violations
    set ant_viol_count [get_attribute [current_design] \
        antenna_violation_count -quiet]
    if {$ant_viol_count eq ""} { set ant_viol_count "see report" }
    puts "  Antenna violations: $ant_viol_count"
}

##############################################################################
# SECTION 7: POST-ROUTE DRC REPORT
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 7: POST-ROUTE VERIFICATION"
puts "======================================================================"

# Run verify_drc for a comprehensive design rule check
set drc_file "${report_dir}/${report_tag}_drc.rpt"
verify_drc \
    -max_errors $max_drc_report \
    > $drc_file
puts "  DRC report: $drc_file"

# Check for shorts and opens specifically
set connectivity_file "${report_dir}/${report_tag}_connectivity.rpt"
verify_connectivity \
    -check_all \
    > $connectivity_file
puts "  Connectivity check: $connectivity_file"

# check_routes final pass - summary of routing status
set routes_file "${report_dir}/${report_tag}_check_routes.rpt"
check_routes \
    > $routes_file
puts "  Route check: $routes_file"

##############################################################################
# SECTION 8: TIMING SNAPSHOT AFTER ROUTING
##############################################################################

puts ""
puts "======================================================================"
puts "SECTION 8: POST-ROUTE TIMING SNAPSHOT"
puts "======================================================================"

# Update timing with post-route parasitics
puts "Updating timing with post-route parasitics..."
update_timing -full

# Quick timing QoR
set timing_file "${report_dir}/${report_tag}_qor.rpt"
report_qor \
    -summary \
    > $timing_file
puts "  Post-route QoR: $timing_file"

# Report top setup violations
set setup_file "${report_dir}/${report_tag}_setup.rpt"
report_timing \
    -delay_type max \
    -max_paths 20 \
    -input_pins \
    -path_type full_clock_expanded \
    -significant_digits 4 \
    -nosplit \
    > $setup_file
puts "  Post-route setup timing: $setup_file"

# Report hold violations
set hold_file "${report_dir}/${report_tag}_hold.rpt"
report_timing \
    -delay_type min \
    -max_paths 20 \
    -slack_lesser_than 0.100 \
    -input_pins \
    -path_type full_clock_expanded \
    -significant_digits 4 \
    -nosplit \
    > $hold_file
puts "  Post-route hold timing: $hold_file"

# Collect key metrics for summary
set setup_wns [get_attribute \
    [get_timing_paths -delay_type max -max_paths 1 -quiet] \
    slack -quiet]
if {$setup_wns eq ""} { set setup_wns 0.0 }

set hold_wns [get_attribute \
    [get_timing_paths -delay_type min -max_paths 1 -quiet] \
    slack -quiet]
if {$hold_wns eq ""} { set hold_wns 0.0 }

set setup_viol [sizeof_collection [get_timing_paths \
    -delay_type max \
    -slack_lesser_than 0.0 \
    -max_paths 9999 \
    -quiet]]

set hold_viol [sizeof_collection [get_timing_paths \
    -delay_type min \
    -slack_lesser_than 0.0 \
    -max_paths 9999 \
    -quiet]]

# Final DRC count
set final_drc [get_attribute [current_design] route_drc_error_count -quiet]
if {$final_drc eq ""} { set final_drc "see DRC report" }

##############################################################################
# SECTION 9: SAVE CHECKPOINT
##############################################################################

if {$save_design_after} {
    puts ""
    puts "======================================================================"
    puts "SECTION 9: SAVING DESIGN CHECKPOINT"
    puts "======================================================================"
    puts "Saving design to: $checkpoint_name ..."

    file mkdir [file dirname $checkpoint_name]
    save_block -as $checkpoint_name

    puts "  Checkpoint saved: $checkpoint_name"
}

##############################################################################
# SECTION 10: ROUTING SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "ROUTING SUMMARY"
puts "======================================================================"
puts [format "  %-30s %12s" "Metric" "Value"]
puts [format "  %-30s %12s" [string repeat "-" 30] [string repeat "-" 12]]
puts [format "  %-30s %12s" "Design"           $current_design_name]
puts [format "  %-30s %12s" "Routing Effort"   $effort]
puts [format "  %-30s %12s" "DRC Violations"   $final_drc]
puts [format "  %-30s %12.4f ns" "Setup WNS"   $setup_wns]
puts [format "  %-30s %12d" "Setup Violations" $setup_viol]
puts [format "  %-30s %12.4f ns" "Hold WNS"    $hold_wns]
puts [format "  %-30s %12d" "Hold Violations"  $hold_viol]
puts [format "  %-30s %12s" "Antenna Fix"      [expr {$antenna_fix ? "ON" : "OFF"}]]
puts [format "  %-30s %12s" "Checkpoint"       [expr {$save_design_after ? $checkpoint_name : "NOT SAVED"}]]
puts "======================================================================"

# Status assessment
set routing_clean 1
if {$final_drc ne "0" && $final_drc ne "see DRC report"} {
    if {$final_drc > 0} { set routing_clean 0 }
}
if {$setup_viol > 0} { set routing_clean 0 }
if {$hold_viol  > 0} { set routing_clean 0 }

if {$routing_clean} {
    puts "RESULT: Routing CLEAN - No DRC, setup, or hold violations"
} else {
    if {$final_drc ne "0" && $final_drc > 0} {
        puts "RESULT: $final_drc DRC violations remain. Review $drc_file"
    }
    if {$setup_viol > 0} {
        puts "RESULT: $setup_viol setup violations. Run icc2_fix_setup_timing.tcl"
    }
    if {$hold_viol > 0} {
        puts "RESULT: $hold_viol hold violations. Run icc2_fix_hold_timing.tcl"
    }
}

puts ""
puts "Reports written to: $report_dir/"
puts "HiPilot: icc2_route_design.tcl COMPLETE"
puts "======================================================================"
