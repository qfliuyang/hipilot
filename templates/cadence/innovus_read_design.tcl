##############################################################################
# innovus_read_design.tcl
# HiPilot Template: Read Design in Cadence Innovus
#
# Description:
#   Opens an existing Innovus design checkpoint using restoreDesign, or
#   initializes a new design from DEF + LEF files using defIn. Verifies
#   that the design loaded correctly and reports basic design statistics
#   (cell count, area, routing completeness) for confirmation.
#
# Usage (in Innovus or via HiPilot):
#   source innovus_read_design.tcl
#
# Tested with: Cadence Innovus v20.10 / v21.x
##############################################################################

##############################################################################
# PARAMETERS - Edit these before sourcing or let HiPilot substitute them
##############################################################################

# Load mode: "restore" = restore from .enc checkpoint,
#             "def"    = read DEF + LEF to initialize design
set load_mode           "restore"

# For load_mode="restore": path to the saved Innovus design directory (.enc)
# Innovus saveDesign writes a directory (not a single file)
set design_dir          "./checkpoints/post_route"

# For load_mode="restore": top-level cell (module) name
set top_cell            "ibex_top"

# For load_mode="def": path to top-level DEF file
set def_file            "./floorplan/ibex_top.def"

# For load_mode="def": list of LEF files (tech LEF first, then cell LEFs)
set lef_files           [list \
    "/tech/sky130hd/sky130hd.tlef" \
    "/tech/sky130hd/sky130hd.lef"]

# Timing libraries to load after reading design (Lib files, .lib or .ldb)
# Leave empty to skip library loading (use if libs already configured)
set timing_libs         {}

# Output report file for post-load statistics
set report_file         "./reports/read_design_stats.rpt"

##############################################################################
# DERIVED SETTINGS
##############################################################################

set timestamp [exec date +%Y%m%d_%H%M%S]
file mkdir [file dirname $report_file]

##############################################################################
# PRE-CHECK
##############################################################################

puts "INFO: =================================================="
puts "INFO: HiPilot - Read Design"
puts "INFO: Timestamp  : $timestamp"
puts "INFO: Load mode  : $load_mode"
if { $load_mode eq "restore" } {
    puts "INFO: Design dir : $design_dir"
    puts "INFO: Top cell   : $top_cell"
} else {
    puts "INFO: DEF file   : $def_file"
    puts "INFO: LEF files  : $lef_files"
}
puts "INFO: =================================================="

# Validate inputs based on load mode
if { $load_mode eq "restore" } {
    if { ![file exists $design_dir] } {
        error "ERROR: Design checkpoint directory not found: $design_dir\n       Verify design_dir path."
    }
    puts "Pre-check: Checkpoint directory found"
} elseif { $load_mode eq "def" } {
    if { ![file exists $def_file] } {
        error "ERROR: DEF file not found: $def_file"
    }
    foreach lf $lef_files {
        if { ![file exists $lf] } {
            puts "WARNING: LEF file not found: $lf (will attempt load anyway)"
        }
    }
    puts "Pre-check: DEF and LEF files validated"
} else {
    error "ERROR: Unknown load_mode='$load_mode'. Use 'restore' or 'def'."
}

##############################################################################
# STEP 1: Load design
##############################################################################

puts "\nINFO: ---- Step 1: Loading design ----"

if { $load_mode eq "restore" } {
    # restoreDesign loads a full Innovus checkpoint saved by saveDesign.
    # The checkpoint includes: placement, routing, timing, power intent.
    # Format: restoreDesign <dir>/<design>.enc.dat <top_cell>
    set enc_file [glob -nocomplain "${design_dir}/*.enc.dat"]
    if { [llength $enc_file] == 0 } {
        # Try direct path: some versions write <dir>.enc.dat
        set enc_file "${design_dir}.enc.dat"
    } else {
        set enc_file [lindex $enc_file 0]
    }
    restoreDesign $enc_file $top_cell
    puts "INFO: Design restored from: $enc_file"

} else {
    # DEF-based initialization: read technology LEF, then cell LEFs, then DEF.
    # Step 1a: Read LEF files (defines layers, via rules, cell footprints)
    foreach lf $lef_files {
        puts "INFO: Reading LEF: $lf"
        read_lef $lf
    }

    # Step 1b: Read DEF file (defines die, floorplan, cell placement, routing)
    puts "INFO: Reading DEF: $def_file"
    defIn $def_file
    puts "INFO: DEF-based design initialization complete"
}

##############################################################################
# STEP 2: Load timing libraries (optional)
##############################################################################

if { [llength $timing_libs] > 0 } {
    puts "\nINFO: ---- Step 2: Loading timing libraries ----"
    foreach lib $timing_libs {
        if { [file exists $lib] } {
            read_lib $lib
            puts "INFO: Loaded lib: $lib"
        } else {
            puts "WARNING: Timing lib not found: $lib (skipping)"
        }
    }
} else {
    puts "\nINFO: Step 2: Timing library loading SKIPPED (timing_libs is empty)"
}

##############################################################################
# STEP 3: Verify design loaded correctly
##############################################################################

puts "\nINFO: ---- Step 3: Verifying loaded design ----"

set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: Design load failed. getDesignName returned empty string."
}
puts "INFO: Design name: $design_name"

# Extract design statistics
set total_insts   [llength [dbget top.insts -e]]
set total_nets    [llength [dbget top.nets  -e]]
set total_ports   [llength [dbget top.terms -e]]

# Core area from floorplan database
set core_box [dbget top.fPlan.coreBox -e]
if { $core_box ne "" && [llength $core_box] == 4 } {
    set core_area [expr {([lindex $core_box 2] - [lindex $core_box 0]) * \
                         ([lindex $core_box 3] - [lindex $core_box 1])}]
} else {
    set core_area 0.0
}

# Check placement status
set unplaced [llength [dbget top.insts.pStatus unplaced -e]]
set placed   [llength [dbget top.insts.pStatus placed   -e]]
set fixed    [llength [dbget top.insts.pStatus fixed    -e]]

# Check routing status
set routed_wires  [llength [dbget top.wires.isRouted 1 -e]]
set unrouted_nets [llength [dbget top.specialNets.wires.isRouted 0 -e]]

puts [format "INFO: %-25s %d"          "Total instances"   $total_insts]
puts [format "INFO: %-25s %d"          "Total nets"        $total_nets]
puts [format "INFO: %-25s %d"          "Total ports"       $total_ports]
puts [format "INFO: %-25s %.4f um^2"   "Core area"         $core_area]
puts [format "INFO: %-25s %d"          "Placed cells"      $placed]
puts [format "INFO: %-25s %d"          "Fixed cells"       $fixed]
puts [format "INFO: %-25s %d"          "Unplaced cells"    $unplaced]
puts [format "INFO: %-25s %d"          "Routed wires"      $routed_wires]

if { $unplaced > 0 } {
    puts "WARNING: $unplaced unplaced cells. Design is in pre-placement state."
}

##############################################################################
# STEP 4: Write statistics report
##############################################################################

set rpt_fd [open $report_file w]
puts $rpt_fd "##############################################################################"
puts $rpt_fd "# Read Design Statistics - HiPilot"
puts $rpt_fd "# Load mode  : $load_mode"
if { $load_mode eq "restore" } {
    puts $rpt_fd "# Source     : $design_dir"
} else {
    puts $rpt_fd "# DEF        : $def_file"
}
puts $rpt_fd "# Timestamp  : $timestamp"
puts $rpt_fd "# Date       : [exec date]"
puts $rpt_fd "##############################################################################"
puts $rpt_fd ""
puts $rpt_fd "DESIGN STATISTICS"
puts $rpt_fd [format "  %-25s %s"          "Design name"     $design_name]
puts $rpt_fd [format "  %-25s %d"          "Total instances" $total_insts]
puts $rpt_fd [format "  %-25s %d"          "Total nets"      $total_nets]
puts $rpt_fd [format "  %-25s %d"          "Total ports"     $total_ports]
puts $rpt_fd [format "  %-25s %.4f um^2"   "Core area"       $core_area]
puts $rpt_fd ""
puts $rpt_fd "PLACEMENT STATUS"
puts $rpt_fd [format "  %-25s %d" "Placed"    $placed]
puts $rpt_fd [format "  %-25s %d" "Fixed"     $fixed]
puts $rpt_fd [format "  %-25s %d" "Unplaced"  $unplaced]
puts $rpt_fd ""
puts $rpt_fd "ROUTING STATUS"
puts $rpt_fd [format "  %-25s %d" "Routed wires"    $routed_wires]
puts $rpt_fd [format "  %-25s %d" "Unrouted nets"   $unrouted_nets]
close $rpt_fd

##############################################################################
# QoR SUMMARY
##############################################################################

puts "\nINFO: =================================================="
puts "INFO: READ DESIGN SUMMARY"
puts "INFO: =================================================="
puts [format "INFO: %-25s %s"        "Design"         $design_name]
puts [format "INFO: %-25s %d"        "Instances"      $total_insts]
puts [format "INFO: %-25s %d"        "Nets"           $total_nets]
puts [format "INFO: %-25s %.4f um^2" "Core area"      $core_area]
puts [format "INFO: %-25s %d"        "Unplaced cells" $unplaced]
puts [format "INFO: %-25s %d"        "Routed wires"   $routed_wires]
puts "INFO: =================================================="

if { $total_insts == 0 } {
    puts "WARNING: Zero instances loaded. Verify load_mode and file paths."
} else {
    puts "INFO: RESULT: Design loaded successfully. Ready for downstream operations."
}

puts "INFO: Stats written to: $report_file"
puts "INFO: innovus_read_design.tcl COMPLETE"
puts "INFO: =================================================="
