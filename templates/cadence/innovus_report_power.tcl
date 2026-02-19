##############################################################################
# innovus_report_power.tcl
# HiPilot Template: Power Analysis in Cadence Innovus
#
# Description:
#   Runs power analysis using report_power with detailed breakdown of
#   leakage, dynamic (internal + switching), and total power. Supports
#   vectorless and activity-file (VCD/SAIF) modes. Produces hierarchical
#   power breakdown suitable for post-route power sign-off.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_report_power.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
##############################################################################

##############################################################################
# PARAMETERS - Edit these before sourcing or let HiPilot substitute them
##############################################################################

# Switching activity source: "vectorless" | "vcd" | "saif"
set switching_activity  "vectorless"

# Path to VCD or SAIF activity file (required when switching_activity != vectorless)
set activity_file       ""

# Analysis effort: low | medium | high
set analysis_effort     "high"

# Default toggle rate for vectorless analysis (0.0 - 1.0, toggles per cycle)
set default_toggle_rate 0.2

# Static probability for vectorless (fraction of time signal is logic 1)
set static_prob         0.5

# Output report file for consolidated power summary
set report_file         "./reports/power_analysis.rpt"

# Report directory prefix
set report_prefix       "./reports/power"

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp [exec date +%Y%m%d_%H%M%S]
file mkdir [file dirname $report_prefix]

##############################################################################
# PRE-CHECK
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Power Analysis"
puts "INFO: Timestamp        : $timestamp"
puts "INFO: Activity source  : $switching_activity"
puts "INFO: Analysis effort  : $analysis_effort"
if { $switching_activity eq "vectorless" } {
    puts "INFO: Toggle rate      : $default_toggle_rate"
    puts "INFO: Static prob      : $static_prob"
} else {
    puts "INFO: Activity file    : $activity_file"
}
puts "INFO: =================================================="

# Confirm design is loaded
set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: No design loaded. Please load a design before running power analysis."
}
puts "INFO: Design: $design_name"

##############################################################################
# STEP 1: Configure switching activity
##############################################################################

puts "\nINFO: ---- Step 1: Configuring switching activity ----"

if { $switching_activity eq "vectorless" } {
    # Vectorless: Innovus applies uniform toggle rate across all nets.
    # setVectorless sets the default activity for nets without explicit data.
    # This is the standard approach for early-stage power estimation.
    setVectorless \
        -toggleRate $default_toggle_rate \
        -staticProb $static_prob
    puts "INFO: Vectorless activity set (toggle=$default_toggle_rate, static=$static_prob)"

} elseif { $switching_activity eq "saif" } {
    # SAIF: Switching Activity Interchange Format from RTL/gate simulation.
    # readSaif annotates toggle counts and static probabilities onto nets.
    if { $activity_file eq "" } {
        error "ERROR: activity_file must be specified when switching_activity=saif"
    }
    if { ![file exists $activity_file] } {
        error "ERROR: SAIF file not found: $activity_file"
    }
    readSaif \
        -input   $activity_file \
        -scope   $design_name
    puts "INFO: SAIF file loaded: $activity_file"

} elseif { $switching_activity eq "vcd" } {
    # VCD: Value Change Dump from simulation. More detailed than SAIF.
    # readVcd reads the waveform and computes toggle rates per net.
    if { $activity_file eq "" } {
        error "ERROR: activity_file must be specified when switching_activity=vcd"
    }
    if { ![file exists $activity_file] } {
        error "ERROR: VCD file not found: $activity_file"
    }
    readVcd \
        -input   $activity_file \
        -scope   $design_name
    puts "INFO: VCD file loaded: $activity_file"

} else {
    error "ERROR: Unknown switching_activity='$switching_activity'. Use vectorless, saif, or vcd."
}

##############################################################################
# STEP 2: Run power analysis
##############################################################################

puts "\nINFO: ---- Step 2: Running power analysis ----"

# report_power performs complete power analysis:
# -leakage  : include leakage power in results
# -dynamic  : include dynamic (switching + internal) power
# -outfile  : write detailed report to file
report_power \
    -leakage \
    -dynamic \
    -outfile "${report_prefix}_summary_${timestamp}.rpt"
puts "INFO: Power summary written to: ${report_prefix}_summary_${timestamp}.rpt"

##############################################################################
# STEP 3: Hierarchical power report
##############################################################################

puts "\nINFO: ---- Step 3: Hierarchical power breakdown ----"

# report_power -hier provides per-instance power breakdown.
# Useful for identifying power hotspots in the hierarchy.
report_power \
    -hier   \
    -leakage \
    -dynamic \
    -outfile "${report_prefix}_hierarchy_${timestamp}.rpt"
puts "INFO: Hierarchical power report: ${report_prefix}_hierarchy_${timestamp}.rpt"

##############################################################################
# STEP 4: Leakage-only report for standby analysis
##############################################################################

puts "\nINFO: ---- Step 4: Leakage power report ----"

report_power \
    -leakage \
    -outfile "${report_prefix}_leakage_${timestamp}.rpt"
puts "INFO: Leakage power report: ${report_prefix}_leakage_${timestamp}.rpt"

##############################################################################
# STEP 5: Extract power metrics from Innovus database
##############################################################################

puts "\nINFO: ---- Step 5: Extracting power metrics ----"

# Query power values from the Innovus internal power database.
# These are populated after report_power is called.
set leakage_power   [dbget top.power.leakage   -e]
set internal_power  [dbget top.power.internal  -e]
set switching_power [dbget top.power.switching -e]
set total_power     [dbget top.power.total     -e]

# Apply defaults for any unset values
if { $leakage_power   eq "" || $leakage_power   eq {} } { set leakage_power   0.0 }
if { $internal_power  eq "" || $internal_power  eq {} } { set internal_power  0.0 }
if { $switching_power eq "" || $switching_power eq {} } { set switching_power 0.0 }
if { $total_power     eq "" || $total_power     eq {} } {
    set total_power [expr {$leakage_power + $internal_power + $switching_power}]
}

set dynamic_power [expr {$internal_power + $switching_power}]

# Get design area for power density
set design_area [dbget top.area -e]
if { $design_area eq "" || $design_area == 0 } { set design_area 1.0 }
set power_density [expr {$total_power / $design_area}]  ;# W/um^2

##############################################################################
# STEP 6: Write consolidated report
##############################################################################

set rpt_fd [open $report_file w]
puts $rpt_fd "##############################################################################"
puts $rpt_fd "# Power Analysis Report - HiPilot"
puts $rpt_fd "# Design           : $design_name"
puts $rpt_fd "# Activity source  : $switching_activity"
puts $rpt_fd "# Analysis effort  : $analysis_effort"
puts $rpt_fd "# Timestamp        : $timestamp"
puts $rpt_fd "# Date             : [exec date]"
puts $rpt_fd "##############################################################################"
puts $rpt_fd ""
puts $rpt_fd "POWER BREAKDOWN SUMMARY"
puts $rpt_fd [format "  %-25s %14s" "Power Component" "Value (W)"]
puts $rpt_fd [format "  %-25s %14s" [string repeat "-" 25] [string repeat "-" 14]]
puts $rpt_fd [format "  %-25s %14.6e" "Leakage Power"   $leakage_power]
puts $rpt_fd [format "  %-25s %14.6e" "Internal Power"  $internal_power]
puts $rpt_fd [format "  %-25s %14.6e" "Switching Power" $switching_power]
puts $rpt_fd [format "  %-25s %14.6e" "Dynamic Power"   $dynamic_power]
puts $rpt_fd [format "  %-25s %14.6e" "TOTAL Power"     $total_power]
puts $rpt_fd ""
puts $rpt_fd [format "  %-25s %14.4f" "Design Area (um^2)" $design_area]
puts $rpt_fd [format "  %-25s %14.6e" "Power Density (W/um^2)" $power_density]
puts $rpt_fd ""

if { $total_power > 0 } {
    set lkg_pct [expr {$leakage_power / $total_power * 100.0}]
    set dyn_pct [expr {$dynamic_power / $total_power * 100.0}]
    puts $rpt_fd [format "  Leakage share  : %.1f%%" $lkg_pct]
    puts $rpt_fd [format "  Dynamic share  : %.1f%%" $dyn_pct]
}

puts $rpt_fd ""
puts $rpt_fd "Sub-reports:"
puts $rpt_fd "  Summary    : ${report_prefix}_summary_${timestamp}.rpt"
puts $rpt_fd "  Hierarchy  : ${report_prefix}_hierarchy_${timestamp}.rpt"
puts $rpt_fd "  Leakage    : ${report_prefix}_leakage_${timestamp}.rpt"
close $rpt_fd

##############################################################################
# QoR SUMMARY
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: POWER ANALYSIS SUMMARY"
puts "INFO: =================================================="
puts [format "INFO: %-25s %14.6e W" "Leakage Power"   $leakage_power]
puts [format "INFO: %-25s %14.6e W" "Internal Power"  $internal_power]
puts [format "INFO: %-25s %14.6e W" "Switching Power" $switching_power]
puts [format "INFO: %-25s %14.6e W" "Dynamic Power"   $dynamic_power]
puts [format "INFO: %-25s %14.6e W" "TOTAL Power"     $total_power]
puts "INFO: --------------------------------------------------"
puts [format "INFO: %-25s %14.4f um^2" "Design Area"  $design_area]
puts [format "INFO: %-25s %14.6e W/um^2" "Power Density" $power_density]
puts "INFO: =================================================="
puts "INFO: Summary: $report_file"
puts "INFO: innovus_report_power.tcl COMPLETE"
puts "INFO: =================================================="
