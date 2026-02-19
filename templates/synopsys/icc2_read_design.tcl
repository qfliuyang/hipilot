##############################################################################
# icc2_read_design.tcl
# HiPilot Template: Open Design in Synopsys IC Compiler II
#
# Description:
#   Opens an existing NDM library and block in ICC2 using open_lib and
#   open_block. Verifies that the design loaded correctly, reports basic
#   design statistics (cell count, area, scenario), and confirms readiness
#   for downstream operations.
#
# Usage:
#   source icc2_read_design.tcl
#   -- or --
#   icc2_shell> source icc2_read_design.tcl
#
# Prerequisites:
#   - NDM library must exist at lib_path
#   - block_name must identify a valid saved block within the library
#   - Technology file must be embedded in the NDM library
#
# Author:  HiPilot auto-generated template
# Version: 1.0
##############################################################################

##############################################################################
# SECTION 1: PARAMETERS
##############################################################################

# Full path to the NDM library directory (.ndm)
set lib_path            "./work/design.ndm"

# Block name to open (as saved with save_block -as <name>)
# Format is typically: <block_name>:<label>
# Example: "ibex_top:post_route" or just "ibex_top" for the latest label
set block_name          "design:latest"

# Scenario(s) to activate after opening (space-separated; leave empty for all)
# Example: "func_ss_0p72v_125c func_tt_0p80v_25c"
set active_scenarios    ""

# Perform a full design sanity check after loading: 1 = yes, 0 = skip
set run_sanity_check    1

# Report output file for post-load statistics
set report_file         "./reports/read_design_stats.rpt"

##############################################################################
# SECTION 2: PRE-CHECK
# Validate that the NDM library and block exist before attempting to open.
##############################################################################

puts "======================================================================"
puts "HiPilot: icc2_read_design.tcl"
puts "======================================================================"
puts "Parameters:"
puts "  lib_path         = $lib_path"
puts "  block_name       = $block_name"
puts "  active_scenarios = [expr {$active_scenarios eq {} ? {(all)} : $active_scenarios}]"
puts "  run_sanity_check = $run_sanity_check"
puts "  report_file      = $report_file"
puts ""

# Check that the NDM library path exists on disk
if {![file exists $lib_path]} {
    error "ERROR: NDM library not found at path: $lib_path\n       Verify lib_path is correct and the library was created."
}
puts "Pre-check: NDM library found at $lib_path"

# Check report directory is writable
file mkdir [file dirname $report_file]
puts "Pre-check: Report directory ready"
puts ""

##############################################################################
# SECTION 3: OPEN LIBRARY AND BLOCK
##############################################################################

puts "======================================================================"
puts "STEP 1: Opening NDM library"
puts "======================================================================"

# open_lib loads the NDM library into ICC2's memory.
# The library contains technology rules, cell views, and saved blocks.
open_lib $lib_path
puts "  Library opened: $lib_path"

puts ""
puts "======================================================================"
puts "STEP 2: Opening block '$block_name'"
puts "======================================================================"

# open_block loads a specific saved design state (block) from the library.
# -read_only flag can be added to prevent accidental modifications.
# Remove -read_only if you intend to make changes and save.
open_block $block_name
puts "  Block opened: $block_name"

##############################################################################
# SECTION 4: SCENARIO ACTIVATION
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 3: Configuring timing scenarios"
puts "======================================================================"

if {$active_scenarios ne ""} {
    # Deactivate all scenarios first, then enable only the requested ones
    set all_scenarios [get_scenarios -quiet]
    if {[sizeof_collection $all_scenarios] > 0} {
        set_scenario_status [get_scenarios] -active false
    }
    foreach scen $active_scenarios {
        if {[sizeof_collection [get_scenarios $scen -quiet]] > 0} {
            set_scenario_status $scen -active true
            puts "  Activated scenario: $scen"
        } else {
            puts "  WARNING: Scenario '$scen' not found in design. Skipping."
        }
    }
} else {
    # Activate all scenarios defined in the design
    set all_scenarios [get_scenarios -quiet]
    if {[sizeof_collection $all_scenarios] > 0} {
        set_scenario_status [get_scenarios] -active true
        puts "  All [sizeof_collection $all_scenarios] scenarios activated"
    } else {
        puts "  WARNING: No scenarios found in design."
    }
}

puts "  Current scenario: [current_scenario]"

##############################################################################
# SECTION 5: DESIGN VERIFICATION
# Confirm the design loaded correctly by reading basic attributes.
##############################################################################

puts ""
puts "======================================================================"
puts "STEP 4: Verifying loaded design"
puts "======================================================================"

# Get fundamental design attributes
set design_name    [get_attribute [current_design] full_name]
set cell_count     [sizeof_collection [get_cells -filter "is_hierarchical == false" -quiet]]
set net_count      [sizeof_collection [get_nets -quiet]]
set port_count     [sizeof_collection [get_ports -quiet]]
set core_area      [get_attribute [current_design] core_area     -quiet]
set boundary_area  [get_attribute [current_design] boundary_area -quiet]

if {$core_area      eq ""} { set core_area      0.0 }
if {$boundary_area  eq ""} { set boundary_area  0.0 }

puts "  Design name    : $design_name"
puts "  Leaf cells     : $cell_count"
puts "  Nets           : $net_count"
puts "  Ports          : $port_count"
puts "  Core area      : $core_area um^2"
puts "  Boundary area  : $boundary_area um^2"

# Check for unplaced cells (indicates incomplete placement)
set unplaced [sizeof_collection [get_cells -filter "is_placed == false" -quiet]]
if {$unplaced > 0} {
    puts "  WARNING: $unplaced unplaced cells found."
} else {
    puts "  Placement      : All cells placed"
}

# Check for unrouted nets
set unrouted [sizeof_collection [get_nets -filter "is_routed == false && net_type == signal" -quiet]]
if {$unrouted > 0} {
    puts "  INFO: $unrouted unrouted signal nets (pre-route or partial route state)"
} else {
    puts "  Routing        : All signal nets routed"
}

##############################################################################
# SECTION 6: SANITY CHECK
##############################################################################

if {$run_sanity_check} {
    puts ""
    puts "======================================================================"
    puts "STEP 5: Running design sanity check"
    puts "======================================================================"

    # check_design performs basic structural validation:
    # - unconnected ports, multi-driven nets, floating pins
    check_design \
        -checks           {design_mismatch unconnected_ports multi_driven_nets} \
        > "./reports/read_design_sanity.rpt"
    puts "  Sanity check report written to: ./reports/read_design_sanity.rpt"
} else {
    puts "STEP 5: Sanity check SKIPPED (run_sanity_check=0)"
}

##############################################################################
# SECTION 7: WRITE STATS REPORT
##############################################################################

set rpt_fd [open $report_file w]
puts $rpt_fd "##############################################################################"
puts $rpt_fd "# Read Design Statistics - HiPilot"
puts $rpt_fd "# Library    : $lib_path"
puts $rpt_fd "# Block      : $block_name"
puts $rpt_fd "# Date       : [exec date]"
puts $rpt_fd "##############################################################################"
puts $rpt_fd ""
puts $rpt_fd "DESIGN STATISTICS"
puts $rpt_fd [format "  %-25s %s" "Design name"    $design_name]
puts $rpt_fd [format "  %-25s %d" "Leaf cells"     $cell_count]
puts $rpt_fd [format "  %-25s %d" "Nets"           $net_count]
puts $rpt_fd [format "  %-25s %d" "Ports"          $port_count]
puts $rpt_fd [format "  %-25s %d" "Unplaced cells" $unplaced]
puts $rpt_fd [format "  %-25s %d" "Unrouted nets"  $unrouted]
puts $rpt_fd [format "  %-25s %.4f um^2" "Core area"  $core_area]
puts $rpt_fd [format "  %-25s %.4f um^2" "Die area"   $boundary_area]
puts $rpt_fd ""
puts $rpt_fd "Active scenarios:"
foreach scen [get_object_name [get_scenarios -active true -quiet]] {
    puts $rpt_fd "  - $scen"
}
close $rpt_fd

##############################################################################
# SECTION 8: QoR SUMMARY
##############################################################################

puts ""
puts "======================================================================"
puts "READ DESIGN SUMMARY"
puts "======================================================================"
puts [format "  %-25s %s"          "Library"        $lib_path]
puts [format "  %-25s %s"          "Block"          $block_name]
puts [format "  %-25s %s"          "Design name"    $design_name]
puts [format "  %-25s %d"          "Leaf cells"     $cell_count]
puts [format "  %-25s %d"          "Nets"           $net_count]
puts [format "  %-25s %.4f um^2"   "Core area"      $core_area]
puts [format "  %-25s %d"          "Unplaced cells" $unplaced]
puts [format "  %-25s %d"          "Unrouted nets"  $unrouted]
puts "======================================================================"

if {$cell_count == 0} {
    puts "WARNING: Zero cells loaded. Block may be empty or incorrectly specified."
} else {
    puts "RESULT: Design loaded successfully. Ready for downstream operations."
}

puts ""
puts "  Stats written to: $report_file"
puts "HiPilot: icc2_read_design.tcl COMPLETE"
puts "======================================================================"
