##############################################################################
# icc2_report_power.tcl
# HiPilot Template: Power Analysis in Synopsys IC Compiler II
#
# Description:
#   Runs power analysis using report_power with high analysis effort.
#   Produces a hierarchical breakdown of leakage, internal switching,
#   and total power. Suitable for post-route power sign-off.
#
# Usage:
#   source icc2_report_power.tcl
#   -- or --
#   icc2_shell> source icc2_report_power.tcl
#
# Prerequisites:
#   - Design must be loaded and placed/routed
#   - Timing constraints (SDC) and switching activity must be available
#   - Parasitics should be extracted or estimated for accurate results
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Switching activity source: "vectorless" | "vcd" | "saif"
# vectorless uses internal estimation based on toggle rates
set switching_activity  "vectorless"

# Path to VCD or SAIF file (only used when switching_activity != vectorless)
set activity_file       ""

# Analysis effort: low | medium | high
# high produces most accurate results but takes longer
set analysis_effort     "high"

# Default toggle rate for vectorless analysis (toggles per clock cycle)
set default_toggle_rate 0.2

# Clock period override in nanoseconds (leave 0 to use SDC value)
set clock_period_ns     0

# Hierarchical reporting depth (0 = flat, 1-5 = levels, -1 = full hierarchy)
set hierarchy_depth     3

# Output report file
set report_file         "./reports/power_analysis.rpt"

# Report prefix for individual sub-reports
set report_prefix       "./reports/power"

# Scenario to analyze (leave empty for current/active scenario)
set target_scenario     ""

##############################################################################
# SECTION 2: PRE-CHECK
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_report_power.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  switching_activity  = $switching_activity"
puts "  analysis_effort     = $analysis_effort"
puts "  default_toggle_rate = $default_toggle_rate"
puts "  hierarchy_depth     = $hierarchy_depth"
puts "  report_file         = $report_file"
puts ""

# Verify design is open
set current_design_name [get_attribute [current_design] full_name]
if {$current_design_name eq ""} {
    error "ERROR: No design is currently open. Load a design first."
}
puts "Pre-check: Design loaded = $current_design_name"

# Verify SDC constraints are present
set sdc_files [get_attribute [current_scenario] constraint_files -quiet]
if {[llength $sdc_files] == 0} {
    puts "WARNING: No SDC constraints in current scenario. Power analysis may be inaccurate."
}

# Switch to target scenario if specified
if {$target_scenario ne ""} {
    current_scenario $target_scenario
    puts "Pre-check: Switched to scenario $target_scenario"
} else {
    puts "Pre-check: Using current scenario [current_scenario]"
}

# Create output directory
file mkdir [file dirname $report_prefix]
puts ""

##############################################################################
# SECTION 3: SWITCHING ACTIVITY SETUP
# Configure the power analysis with the appropriate activity source.
##############################################################################

puts "======================================================================"
puts "STEP 1: Configuring switching activity"
puts "======================================================================"

if {$switching_activity eq "vectorless"} {
    # Vectorless power analysis: ICC2 estimates activity based on toggle rates.
    # set_switching_activity applies a default toggle rate to all nets.
    set_switching_activity \
        -toggle_rate    $default_toggle_rate \
        -static_prob    0.5 \
        -base_clock_period [expr {$clock_period_ns > 0 ? $clock_period_ns : ""}]
    puts "  Vectorless mode: toggle_rate=$default_toggle_rate, static_prob=0.5"

} elseif {$switching_activity eq "saif"} {
    # SAIF (Switching Activity Interchange Format) from simulation
    if {$activity_file eq ""} {
        error "ERROR: activity_file must be set when switching_activity=saif"
    }
    read_saif \
        -input     $activity_file \
        -instance  [get_attribute [current_design] full_name]
    puts "  SAIF file loaded: $activity_file"

} elseif {$switching_activity eq "vcd"} {
    # VCD (Value Change Dump) from RTL or gate-level simulation
    if {$activity_file eq ""} {
        error "ERROR: activity_file must be set when switching_activity=vcd"
    }
    read_vcd \
        -input     $activity_file \
        -instance  [get_attribute [current_design] full_name]
    puts "  VCD file loaded: $activity_file"

} else {
    error "ERROR: Unknown switching_activity='$switching_activity'. Use vectorless, saif, or vcd."
}

##############################################################################
# SECTION 4: POWER ANALYSIS
# Run report_power with configurable effort and output breakdown.
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 2: Running power analysis (effort=$analysis_effort)"
puts "======================================================================"

# Full design-level power summary
report_power \
    -analysis_effort    $analysis_effort \
    -verbose \
    > "${report_prefix}_summary.rpt"
puts "  Top-level power summary written to: ${report_prefix}_summary.rpt"

# Hierarchical breakdown by cell instance
if {$hierarchy_depth == 0} {
    # Flat report: all leaf cells listed individually
    report_power \
        -analysis_effort    $analysis_effort \
        -hierarchy          \
        -levels             1 \
        > "${report_prefix}_hierarchy.rpt"
} elseif {$hierarchy_depth == -1} {
    # Full hierarchy: all levels
    report_power \
        -analysis_effort    $analysis_effort \
        -hierarchy          \
        > "${report_prefix}_hierarchy.rpt"
} else {
    # Specified depth
    report_power \
        -analysis_effort    $analysis_effort \
        -hierarchy          \
        -levels             $hierarchy_depth \
        > "${report_prefix}_hierarchy.rpt"
}
puts "  Hierarchical power report written to: ${report_prefix}_hierarchy.rpt"

# Leakage-only report (useful for standby/retention mode analysis)
report_power \
    -analysis_effort    $analysis_effort \
    -leakage_only \
    > "${report_prefix}_leakage.rpt"
puts "  Leakage power report written to: ${report_prefix}_leakage.rpt"

##############################################################################
# SECTION 5: EXTRACT POWER METRICS
# Parse power results for QoR summary output.
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 3: Extracting power metrics"
puts "======================================================================"

# Extract total power values using get_attribute on the design object.
# ICC2 stores power results in the design attributes after report_power.
set leakage_power  [get_attribute [current_design] leakage_power  -quiet]
set internal_power [get_attribute [current_design] internal_power -quiet]
set switching_power [get_attribute [current_design] switching_power -quiet]

# Compute total dynamic and total power
if {$leakage_power  eq ""} { set leakage_power  0.0 }
if {$internal_power eq ""} { set internal_power 0.0 }
if {$switching_power eq ""} { set switching_power 0.0 }

set dynamic_power  [expr {$internal_power + $switching_power}]
set total_power    [expr {$dynamic_power  + $leakage_power}]

# Get design area for power density calculation
set design_area [get_attribute [current_design] boundary_area -quiet]
if {$design_area eq "" || $design_area == 0} { set design_area 1.0 }
set power_density [expr {$total_power / $design_area * 1.0e6}]  ;# uW/um^2

##############################################################################
# SECTION 6: WRITE COMBINED REPORT
##############################################################################

set rpt_fd [open $report_file w]
puts $rpt_fd "##############################################################################"
puts $rpt_fd "# Power Analysis Report - HiPilot"
puts $rpt_fd "# Design          : $current_design_name"
puts $rpt_fd "# Scenario        : [current_scenario]"
puts $rpt_fd "# Activity source : $switching_activity"
puts $rpt_fd "# Analysis effort : $analysis_effort"
puts $rpt_fd "# Date            : [exec date]"
puts $rpt_fd "##############################################################################"
puts $rpt_fd ""
puts $rpt_fd "POWER BREAKDOWN SUMMARY"
puts $rpt_fd [format "  %-25s %12s" "Power Component" "Value (W)"]
puts $rpt_fd [format "  %-25s %12s" [string repeat "-" 25] [string repeat "-" 12]]
puts $rpt_fd [format "  %-25s %12.6e" "Leakage Power"   $leakage_power]
puts $rpt_fd [format "  %-25s %12.6e" "Internal Power"  $internal_power]
puts $rpt_fd [format "  %-25s %12.6e" "Switching Power" $switching_power]
puts $rpt_fd [format "  %-25s %12.6e" "Dynamic Power"   $dynamic_power]
puts $rpt_fd [format "  %-25s %12.6e" "TOTAL Power"     $total_power]
puts $rpt_fd ""
puts $rpt_fd [format "  %-25s %12.4f" "Design Area (um^2)" $design_area]
puts $rpt_fd [format "  %-25s %12.6e" "Power Density (W/um^2)" [expr {$power_density * 1.0e-6}]]
puts $rpt_fd ""
puts $rpt_fd "Sub-reports:"
puts $rpt_fd "  Summary    : ${report_prefix}_summary.rpt"
puts $rpt_fd "  Hierarchy  : ${report_prefix}_hierarchy.rpt"
puts $rpt_fd "  Leakage    : ${report_prefix}_leakage.rpt"
close $rpt_fd
puts "  Combined report written to: $report_file"

##############################################################################
# SECTION 7: QoR SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "POWER ANALYSIS SUMMARY"
puts "======================================================================"
puts [format "  %-25s %12s" "Power Component" "Value (W)"]
puts [format "  %-25s %12s" [string repeat "-" 25] [string repeat "-" 12]]
puts [format "  %-25s %12.6e" "Leakage Power"   $leakage_power]
puts [format "  %-25s %12.6e" "Internal Power"  $internal_power]
puts [format "  %-25s %12.6e" "Switching Power" $switching_power]
puts [format "  %-25s %12.6e" "Dynamic Power"   $dynamic_power]
puts [format "  %-25s %12.6e" "TOTAL Power"     $total_power]
puts "======================================================================"
puts [format "  %-25s %12.4f" "Design Area (um^2)"    $design_area]
puts [format "  %-25s %12.4f" "Power Density (uW/um^2)" $power_density]
puts "======================================================================"

set leakage_pct [expr {$total_power > 0 ? $leakage_power / $total_power * 100.0 : 0.0}]
set dynamic_pct [expr {$total_power > 0 ? $dynamic_power / $total_power * 100.0 : 0.0}]
puts [format "  Leakage share  : %.1f%%" $leakage_pct]
puts [format "  Dynamic share  : %.1f%%" $dynamic_pct]
puts ""
puts "  Hierarchy report (top $hierarchy_depth levels): ${report_prefix}_hierarchy.rpt"
puts "HiPilot: icc2_report_power.tcl COMPLETE"
puts "======================================================================"
