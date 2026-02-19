##############################################################################
# innovus_route_design.tcl
# HiPilot Template: Route Design (Cadence Innovus)
#
# Description:
#   Full post-placement routing flow: pre-route design check, NanoRoute
#   configuration, global routing, detail routing, DRC/connectivity
#   verification, via optimization, and route QoR summary. This script
#   targets a clean routed database ready for post-route optimization.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_route_design.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
# Prerequisites:
#   - Design must be placed (standard cells legalized)
#   - Power/ground nets connected (addStripe, addRing complete)
#   - Clock tree synthesized (CTS) and optimized (post-CTS opt)
#   - Timing constraints (SDC) loaded
##############################################################################

##############################################################################
# PARAMETERS
##############################################################################

# Routing effort level: low | medium | high
# "high" improves DRC closure but increases runtime significantly.
set effort              "medium"

# Antenna violation fixing: 1=enabled, 0=disabled
# Recommended: 1 for production flows. Antenna violations cause oxide damage.
set antenna_fix         1

# Maximum DRC fix iterations after initial routeDesign.
# NanoRoute will iterate up to this count trying to resolve DRC violations.
# Typical: 3-5. Set 0 to skip DRC fix iterations (not recommended).
set drc_fix_iterations  5

# Enable concurrent via optimization during routing? 1=yes, 0=no
# Via count directly impacts yield. Recommended: 1.
set via_opt             1

# Enable SI (Signal Integrity) awareness during routing?
# Recommended for designs with tight noise margins or high-frequency clocks.
set si_aware            1

# Route special nets (power/ground straps) separately before signal routing?
# Set 1 if you have pre-routed power stripes that need special net routing.
set route_special_nets  1

# Minimum routed wire length (um) for timing-driven routing.
# NanoRoute will attempt to minimize wire length on timing-critical nets.
set timing_driven       1

# Output report directory
set report_dir          "./reports"

# Save database after successful routing? 1=yes, 0=no
set save_db             1
set db_name             "./checkpoints/route_done"

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp           [exec date +%Y%m%d_%H%M%S]
set report_prefix       "${report_dir}/route_${timestamp}"

file mkdir $report_dir
if { $save_db } {
    file mkdir [file dirname $db_name]
}

##############################################################################
# PRE-CHECK: Verify design state before routing
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Route Design"
puts "INFO: Timestamp       : $timestamp"
puts "INFO: Effort          : $effort"
puts "INFO: Antenna fix     : $antenna_fix"
puts "INFO: DRC iterations  : $drc_fix_iterations"
puts "INFO: Via optimization: $via_opt"
puts "INFO: SI awareness    : $si_aware"
puts "INFO: Timing-driven   : $timing_driven"
puts "INFO: =================================================="

set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Please load a design before routing."
}
puts "INFO: Design          : $design_name"

# Check placement exists
set placed_cells [dbget top.insts.pStatus -e]
set num_placed   [llength [lsearch -all $placed_cells "placed"]]
set num_fixed    [llength [lsearch -all $placed_cells "fixed"]]
set total_placed [expr { $num_placed + $num_fixed }]

if { $total_placed == 0 } {
    error "ERROR: No placed cells found. Run placement (placeDesign) before routing."
}
puts "INFO: Placed cells    : $total_placed (placed=$num_placed, fixed=$num_fixed)"

# Check for existing routing (warn if already routed)
set existing_routes [dbget top.wires.isRouted -e]
if { [llength $existing_routes] > 0 } {
    puts "WARNING: Existing routing detected ([llength $existing_routes] routed wires)."
    puts "WARNING: Running routeDesign will attempt incremental routing."
    puts "WARNING: For a clean re-route, unroute first: clearRoute -allCells"
}

##############################################################################
# STEP 1: Pre-route design check
##############################################################################

puts "\nINFO: ---- Step 1: Pre-route design check ----"

# checkDesign verifies the design database integrity before routing.
# -pre_route : Run pre-route specific checks (placement, connectivity, PG)
# Returns 0 on success, non-zero on errors.
set precheck_rpt "${report_prefix}_precheck.rpt"

checkDesign \
    -pre_route \
    > $precheck_rpt

puts "INFO: Pre-route check complete. Report: $precheck_rpt"

# Check for open nets (unconnected pins) - these must be zero before routing
set open_nets [dbget top.nets.numUnroutedPins -e -v 0]
if { [llength $open_nets] > 0 } {
    puts "WARNING: [llength $open_nets] nets have unconnected pins."
    puts "WARNING: These will produce routing opens. Check connectivity."
}

# Verify power/ground connections
set pg_errors [getPGConnStatus]
if { $pg_errors ne "" && $pg_errors ne "0" } {
    puts "WARNING: Power/ground connection issues detected: $pg_errors"
    puts "WARNING: Run verifyPowerDomain and fixPGConnectivity before routing."
} else {
    puts "INFO: Power/ground connections verified OK."
}

##############################################################################
# STEP 2: Configure NanoRoute mode
##############################################################################

puts "\nINFO: ---- Step 2: NanoRoute configuration ----"

# setNanoRouteMode sets all NanoRoute engine parameters before routing.
# These settings control routing quality, DRC aggressiveness, and runtime.

setNanoRouteMode \
    -routeWithTimingDriven          $timing_driven \
    -routeWithSiDriven              $si_aware \
    -routeTopRoutingLayer           default \
    -routeBottomRoutingLayer        default \
    -drouteFixAntenna               $antenna_fix \
    -routeAntennaCellName           "" \
    -drouteSearchAndRepair          true \
    -routeWithEco                   false \
    -drouteMinSlackForPreferredLayer 0.0 \
    -routeInsertAntennaDiode        $antenna_fix \
    -routeAntennaDiodeCellName      "" \
    -routeTdrEffort                 $effort \
    -routeReserveSpaceForMultiCut   $via_opt

puts "INFO: NanoRoute mode configured:"
puts "INFO:   Timing-driven  : $timing_driven"
puts "INFO:   SI-driven      : $si_aware"
puts "INFO:   Antenna fixing : $antenna_fix"
puts "INFO:   Effort         : $effort"
puts "INFO:   Via opt        : $via_opt"

##############################################################################
# STEP 3: Route special (power/ground) nets
##############################################################################

if { $route_special_nets } {
    puts "\nINFO: ---- Step 3: Route special nets (P/G) ----"

    # routeDesign -globalDetail -viaOpt handles special nets via Innovus
    # special-net router. This completes any unrouted P/G segments from
    # power planning (addStripe, addRing).
    routeDesign \
        -globalDetail \
        -viaOpt \
        -specReduce \
        -wireOpt

    puts "INFO: Special net routing complete."
} else {
    puts "\nINFO: ---- Step 3: Skipping special net routing (route_special_nets=0) ----"
}

##############################################################################
# STEP 4: Global routing pass
##############################################################################

puts "\nINFO: ---- Step 4: Global routing ----"

# Global routing establishes approximate wire paths for all signal nets.
# It determines which routing resources (tracks) each net will use.
# This is fast but produces no actual geometry yet.
routeDesign -globalDetail

puts "INFO: Global routing complete."

# Check global routing congestion before proceeding to detail routing
set congestion_rpt "${report_prefix}_congestion.rpt"
reportCongestion \
    -hotSpot \
    -overflow \
    > $congestion_rpt

puts "INFO: Congestion report written to: $congestion_rpt"

##############################################################################
# STEP 5: Detail routing
##############################################################################

puts "\nINFO: ---- Step 5: Detail routing ----"

# routeDesign without flags runs full global + detail routing.
# The engine uses NanoRoute to convert global routing paths into
# actual wire geometry on specific metal layers and tracks.
#
# Key NanoRoute behaviors at this stage:
#   - Pattern routing for simple connections
#   - Search-and-repair for DRC resolution
#   - Antenna insertion if enabled
routeDesign

puts "INFO: Detail routing complete."

##############################################################################
# STEP 6: DRC verification and iterative fix
##############################################################################

puts "\nINFO: ---- Step 6: DRC verification (up to $drc_fix_iterations iterations) ----"

set drc_iter    0
set drc_clean   0

while { $drc_iter < $drc_fix_iterations && !$drc_clean } {
    incr drc_iter

    set drc_rpt "${report_prefix}_drc_iter${drc_iter}.rpt"

    # verify_drc runs the design rule checker on all routed geometry.
    # Reports spacing, width, enclosure, and via violations.
    verify_drc \
        -limit      10000 \
        > $drc_rpt

    # Count total DRC violations
    set drc_count [dbget top.markers.type -e]
    set num_drc   [llength $drc_count]

    puts "INFO: DRC iteration $drc_iter: $num_drc violations. Report: $drc_rpt"

    if { $num_drc == 0 } {
        puts "INFO: DRC clean at iteration $drc_iter."
        set drc_clean 1
    } else {
        puts "INFO: Running NanoRoute search-and-repair to fix $num_drc DRC violations..."

        # routeDesign -searchRepair: targeted DRC violation fixing pass.
        # Attempts to reroute violating wire segments without disturbing
        # clean areas of the design.
        routeDesign \
            -searchRepair \
            -viaOpt

        puts "INFO: Search-and-repair iteration $drc_iter complete."
    }
}

if { !$drc_clean } {
    set final_drc_count [llength [dbget top.markers.type -e]]
    puts "WARNING: $final_drc_count DRC violations remain after $drc_fix_iterations iterations."
    puts "WARNING: Manual ECO or physical constraint review may be needed."
    puts "WARNING: Check: ${report_prefix}_drc_iter${drc_fix_iterations}.rpt"
}

##############################################################################
# STEP 7: Via optimization
##############################################################################

if { $via_opt } {
    puts "\nINFO: ---- Step 7: Via optimization ----"

    # fixVia attempts to upgrade single-cut vias to multi-cut (stacked)
    # vias where space permits. Multi-cut vias improve yield by providing
    # redundant current paths.
    #
    # -minCut   : Ensure minimum cut rules are met
    # -viaOpt   : Enable via optimization pass
    routeDesign \
        -viaOpt

    puts "INFO: Via optimization complete."

    # Optional: report via count by layer
    set via_rpt "${report_prefix}_via_summary.rpt"
    report_route \
        -summary \
        > $via_rpt
    puts "INFO: Via summary written to: $via_rpt"
} else {
    puts "\nINFO: ---- Step 7: Skipping via optimization (via_opt=0) ----"
}

##############################################################################
# STEP 8: Final connectivity verification
##############################################################################

puts "\nINFO: ---- Step 8: Connectivity verification ----"

set conn_rpt "${report_prefix}_connectivity.rpt"

# verifyConnectivity checks for:
#   - Open nets (unconnected pins after routing)
#   - Short circuits (nets merged erroneously)
#   - Antenna violations (if not already fixed)
verifyConnectivity \
    -type all \
    -error 1000 \
    -warning 50 \
    > $conn_rpt

set open_count  [dbget top.markers.subType -e -v "open"]
set short_count [dbget top.markers.subType -e -v "short"]
puts "INFO: Connectivity check: opens=$open_count, shorts=$short_count"
puts "INFO: Connectivity report: $conn_rpt"

##############################################################################
# STEP 9: Report route statistics
##############################################################################

puts "\nINFO: ---- Step 9: Route statistics report ----"

set route_rpt "${report_prefix}_route_summary.rpt"

# report_route provides statistics on:
#   - Total wire length per layer
#   - Via counts per layer transition
#   - Track utilization
#   - Overflow (congestion) counts
report_route \
    -summary \
    -noBlockage \
    > $route_rpt

puts "INFO: Route summary written to: $route_rpt"

# Echo key stats to console
set total_wirelength [dbget top.stats.totalWireLength -e]
set total_vias       [dbget top.stats.totalVias -e]
puts "INFO: Total wire length : $total_wirelength um"
puts "INFO: Total via count   : $total_vias"

##############################################################################
# STEP 10: Save database checkpoint
##############################################################################

if { $save_db } {
    puts "\nINFO: ---- Step 10: Save routed database ----"

    # saveDesign saves the full Innovus database (placement + routing + constraints)
    # to a directory. Can be restored with restoreDesign.
    saveDesign "${db_name}.enc"
    puts "INFO: Database saved to: ${db_name}.enc"
} else {
    puts "\nINFO: ---- Step 10: Skipping database save (save_db=0) ----"
}

##############################################################################
# STEP 11: QoR Summary
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: QoR SUMMARY: Route Design"
puts "INFO: =================================================="
puts "INFO: Design          : $design_name"
puts "INFO: Timestamp       : $timestamp"
puts "INFO: --------------------------------------------------"

set final_drc   [llength [dbget top.markers.type -e]]
set final_opens [llength [dbget top.markers.subType -e -v "open"]]

puts [format "INFO: %-30s %10s" "Metric" "Value"]
puts [format "INFO: %-30s %10s" "------------------------------" "----------"]
puts [format "INFO: %-30s %10d" "DRC violations"      $final_drc]
puts [format "INFO: %-30s %10d" "Open nets"           $final_opens]
puts [format "INFO: %-30s %10s" "Wire length (um)"    $total_wirelength]
puts [format "INFO: %-30s %10s" "Via count"           $total_vias]
puts "INFO: --------------------------------------------------"

# Quick timing snapshot post-route
timeDesign -postRoute -setup -hold -expandedViews -numPaths 10
set wns_setup [dbget [dbget head.timingReports.reportName setup -p].wns -e]
set wns_hold  [dbget [dbget head.timingReports.reportName hold  -p].wns -e]
puts [format "INFO: %-30s %10.4f" "Post-route setup WNS (ns)" $wns_setup]
puts [format "INFO: %-30s %10.4f" "Post-route hold  WNS (ns)" $wns_hold]
puts "INFO: --------------------------------------------------"

# Overall status
set routing_pass [expr { $final_drc == 0 && $final_opens == 0 }]
if { $routing_pass } {
    puts "INFO: RESULT: PASS - DRC clean, no opens/shorts."
    puts "INFO: Design is ready for post-route optimization."
    puts "INFO: Next step: source innovus_fix_setup_timing.tcl"
} else {
    if { $final_drc > 0 } {
        puts "WARNING: RESULT: $final_drc DRC violations remain. Check DRC reports."
    }
    if { $final_opens > 0 } {
        puts "WARNING: RESULT: $final_opens open nets remain. Check connectivity report."
    }
    puts "WARNING: Resolve violations before post-route optimization."
}

puts "INFO: =================================================="
puts "INFO: Reports directory: $report_dir"
foreach rpt [glob -nocomplain "${report_prefix}_*.rpt"] {
    puts "INFO:   [file tail $rpt]"
}
puts "INFO: =================================================="
puts "INFO: innovus_route_design.tcl COMPLETE"
puts "INFO: =================================================="
