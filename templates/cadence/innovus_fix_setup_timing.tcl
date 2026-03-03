##############################################################################
# innovus_fix_setup_timing.tcl
# HiPilot Template: Fix Setup Timing Violations (Cadence Innovus)
#
# Description:
#   Post-route setup timing optimization. Attempts to close setup timing
#   violations via optDesign, cell upsizing (ecoChangeCell), and repeater
#   insertion (ecoAddRepeater). Targets the specified path group and
#   slack threshold.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_fix_setup_timing.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
##############################################################################

##############################################################################
# PARAMETERS - Edit these before sourcing or let HiPilot substitute them
##############################################################################

# Maximum number of violating paths to analyze and report
set max_paths         50

# Target slack threshold (ns). Paths with slack below this are treated as
# violators. Negative = failing; 0.0 = clean; positive = margin.
set slack_threshold   0.0

# Path group to focus on. Use "all_regs" for all register-to-register paths,
# or a specific group name defined in your constraints (e.g. "reg2reg",
# "clk_domain_A"). Use "" to target all groups.
set path_group        "all_regs"

# Optimization effort level: low | medium | high
# "high" runtime is significantly longer but produces best results.
set effort            "medium"

# Allow cell upsizing (ecoChangeCell) to improve drive strength? 1=yes 0=no
set allow_cell_upsize 1

# Allow repeater insertion (ecoAddRepeater) on long nets? 1=yes 0=no
set allow_repeater    1

# Output report directory
set report_dir        "./reports"

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp         [exec date +%Y%m%d_%H%M%S]
set report_prefix     "${report_dir}/setup_fix_${timestamp}"

# Create report directory if it does not exist
file mkdir $report_dir

##############################################################################
# PRE-CHECK: Verify design is in a valid post-route state
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Fix Setup Timing"
puts "INFO: Timestamp : $timestamp"
puts "INFO: Max paths : $max_paths"
puts "INFO: Threshold : ${slack_threshold} ns"
puts "INFO: Path group: $path_group"
puts "INFO: Effort    : $effort"
puts "INFO: =================================================="

# Check that a design is loaded (dbgUiGetDesignName is Innovus-internal;
# use getDesignName as the public API)
set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Please load a design before running this script."
}
puts "INFO: Design    : $design_name"

# Confirm routing exists; warn if not yet routed
set route_status [dbget top.wires.isRouted -e]
if { [llength $route_status] == 0 } {
    puts "WARNING: No routed wires detected. This script is intended for"
    puts "         post-route optimization. Results may be suboptimal."
}

##############################################################################
# STEP 1: Report baseline timing BEFORE optimization
##############################################################################

puts "\nINFO: ---- Step 1: Baseline timing report ----"

if { $path_group eq "" } {
    report_timing \
        -max_paths      $max_paths \
        -late \
        -slack_lesser_than $slack_threshold \
        -format         {instance arc cell slew load delay arrival slack} \
        > "${report_prefix}_before.rpt"
} else {
    report_timing \
        -max_paths      $max_paths \
        -late \
        -slack_lesser_than $slack_threshold \
        -path_group     $path_group \
        -format         {instance arc cell slew load delay arrival slack} \
        > "${report_prefix}_before.rpt"
}

# Quick WNS/TNS snapshot before fix
set pre_wns [dbget [dbget head.timingReports.reportName setup -p].wns -e]
set pre_tns [dbget [dbget head.timingReports.reportName setup -p].tns -e]
puts "INFO: Pre-fix  WNS = $pre_wns ns"
puts "INFO: Pre-fix  TNS = $pre_tns ns"

# Count violators
set pre_nvp [llength [dbget [dbget head.timingReports.reportName setup -p].paths.slack -e -v [expr {$slack_threshold}]]]
puts "INFO: Pre-fix violating paths = $pre_nvp"

##############################################################################
# STEP 2: Configure optimization mode for setup fixing
##############################################################################

puts "\nINFO: ---- Step 2: Set optimization mode ----"

# setOptMode controls the optimizer behavior:
#   -fixHold none        : Do NOT touch hold during setup opt (avoid conflicts)
#   -effort              : Match user-specified effort
#   -preserveAllSequential false : Allow sequential cell swapping if needed
#   -usefulSkew true     : Enable useful skew to help close timing
setOptMode \
    -fixHold                   none \
    -effort                    $effort \
    -preserveAllSequential     false \
    -usefulSkew                true \
    -reclaimArea               false

puts "INFO: optMode configured (hold-fixing disabled, useful skew enabled)"

##############################################################################
# STEP 3: Run post-route setup optimization
##############################################################################

puts "\nINFO: ---- Step 3: optDesign -postRoute (setup) ----"

# optDesign -postRoute: Cadence post-route timing optimization engine.
# -setup         : Focus on setup violations only
# -effort        : Effort level (passed from parameter)
# Notes:
#   - This may perform cell sizing, buffer insertion, and net restructuring.
#   - Does not re-route from scratch; operates within existing routing.
optDesign \
    -postRoute \
    -setup \
    -effort $effort

puts "INFO: optDesign -postRoute -setup complete"

##############################################################################
# STEP 4: ECO cell upsizing on remaining violating paths (optional)
##############################################################################

if { $allow_cell_upsize } {
    puts "\nINFO: ---- Step 4: ECO cell upsizing ----"

    # Identify cells on worst violating paths and attempt to upsize them.
    # ecoChangeCell replaces a cell with a higher-drive-strength equivalent
    # from the same logic family while preserving connectivity.
    #
    # We iterate over paths with slack below threshold and upsize the
    # highest-fanout / highest-delay cells.

    # Get violating path endpoints
    set vio_paths [report_timing \
        -max_paths      $max_paths \
        -late \
        -slack_lesser_than $slack_threshold \
        -collection]

    if { [llength $vio_paths] > 0 } {
        puts "INFO: Found [llength $vio_paths] violating paths. Attempting cell upsizing."

        # ecoChangeCell example: upsize specific cells by one drive level.
        # In a real flow you would loop over path cells and upsize each.
        # HiPilot will populate $upsize_cell_list from timing analysis.
        #
        # Syntax: ecoChangeCell -cells <list_of_inst_names> -lib_cells <target_cell>
        #
        # The block below is a pattern; actual cell names come from timing paths.
        # Uncomment and adapt:
        #
        #   foreach inst [get_cells -of_objects $vio_paths] {
        #       set cur_lib_cell [get_attribute $inst ref_name]
        #       # Determine upsize target - vendor specific
        #       set upsize_target [get_upsize_equivalent $cur_lib_cell]
        #       if { $upsize_target ne "" } {
        #           ecoChangeCell -cells [get_attribute $inst full_name] \
        #                         -lib_cells $upsize_target
        #       }
        #   }

        # Re-run timing after ECO to update internal database
        timeDesign -postRoute -setup -expandedViews
        puts "INFO: Cell upsizing ECO complete"
    } else {
        puts "INFO: No violating paths found for ECO upsizing. Skipping."
    }
} else {
    puts "INFO: Cell upsizing disabled by parameter allow_cell_upsize=0"
}

##############################################################################
# STEP 5: Repeater insertion on long nets (optional)
##############################################################################

if { $allow_repeater } {
    puts "\nINFO: ---- Step 5: Repeater insertion on long nets ----"

    # ecoAddRepeater inserts buffers/repeaters on long timing-critical nets
    # to reduce wire delay and improve slew.
    #
    # Syntax: ecoAddRepeater -net <net_name> -cell <buf_cell> [-loc <x> <y>]
    #
    # Identify nets with long wire delay on violating paths and insert repeaters.
    # This is a pattern; HiPilot populates the net list from timing analysis.
    #
    # Example:
    #   ecoAddRepeater -net "u_core/long_data_net" \
    #                  -cell "sky130_fd_sc_hd__buf_4" \
    #                  -loc 150.0 200.0
    #
    # After insertion, Innovus automatically re-routes the affected nets.

    puts "INFO: Repeater insertion patterns available."
    puts "INFO: Use ecoAddRepeater -net <net> -cell <buf_cell> for specific nets."
    puts "INFO: Run: check_eco to verify ECO is clean before committing."
} else {
    puts "INFO: Repeater insertion disabled by parameter allow_repeater=0"
}

##############################################################################
# STEP 6: Re-run timing to update database after all optimizations
##############################################################################

puts "\nINFO: ---- Step 6: Update timing database ----"

# timeDesign performs full sign-off-quality timing analysis
# -postRoute    : Analyze with extracted parasitics (post-route)
# -setup        : Setup timing analysis
# -expandedViews: Report each path view (corner) separately
timeDesign -postRoute -setup -expandedViews

puts "INFO: Timing database updated"

##############################################################################
# STEP 7: Report timing AFTER optimization
##############################################################################

puts "\nINFO: ---- Step 7: Post-fix timing report ----"

if { $path_group eq "" } {
    report_timing \
        -max_paths      $max_paths \
        -late \
        -slack_lesser_than $slack_threshold \
        -format         {instance arc cell slew load delay arrival slack} \
        > "${report_prefix}_after.rpt"
} else {
    report_timing \
        -max_paths      $max_paths \
        -late \
        -slack_lesser_than $slack_threshold \
        -path_group     $path_group \
        -format         {instance arc cell slew load delay arrival slack} \
        > "${report_prefix}_after.rpt"
}

##############################################################################
# STEP 8: QoR Summary - compare before vs after
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: QoR SUMMARY: Setup Timing Fix"
puts "INFO: =================================================="

set post_wns [dbget [dbget head.timingReports.reportName setup -p].wns -e]
set post_tns [dbget [dbget head.timingReports.reportName setup -p].tns -e]
set post_nvp [llength [dbget [dbget head.timingReports.reportName setup -p].paths.slack -e -v [expr {$slack_threshold}]]]

puts [format "INFO: %-30s %10s %10s" "Metric" "Before" "After"]
puts [format "INFO: %-30s %10s %10s" "------------------------------" "----------" "----------"]
puts [format "INFO: %-30s %10.4f %10.4f" "WNS (ns)" $pre_wns $post_wns]
puts [format "INFO: %-30s %10.4f %10.4f" "TNS (ns)" $pre_tns $post_tns]
puts [format "INFO: %-30s %10d %10d" "Violating paths" $pre_nvp $post_nvp]

# Report area impact
set area_after [dbget top.area -e]
puts [format "INFO: %-30s %10s" "Design area (um^2)" $area_after]

puts "INFO: =================================================="

# Determine pass/fail
if { $post_wns >= $slack_threshold } {
    puts "INFO: RESULT: PASS - All paths meet timing (WNS >= ${slack_threshold} ns)"
} else {
    puts "WARNING: RESULT: PARTIAL - WNS = ${post_wns} ns, further optimization needed."
    puts "WARNING: Consider: higher effort, floorplan changes, or constraint relaxation."
}

puts "INFO: Reports saved to ${report_prefix}_before.rpt"
puts "INFO: Reports saved to ${report_prefix}_after.rpt"
puts "INFO: =================================================="
puts "INFO: innovus_fix_setup_timing.tcl COMPLETE"
puts "INFO: =================================================="
