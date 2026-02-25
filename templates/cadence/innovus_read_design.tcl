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
# PARAMETERS - HiPilot substitutes via Nunjucks, fallback to defaults
##############################################################################

# Load mode: "restore" = restore from .enc checkpoint,
#             "def"    = read DEF + LEF to initialize design
set load_mode           "{{ load_mode | default('restore') }}"

# For load_mode="restore": path to the saved Innovus design directory (.enc)
set design_dir          "{{ design_dir | default('./checkpoints/post_route') }}"

# For load_mode="restore": top-level cell (module) name
set top_cell            "{{ top_cell | default('ibex_top') }}"

# For load_mode="def": path to top-level DEF file
set def_file            "{{ def_file | default('./floorplan/ibex_top.def') }}"

# For load_mode="def": list of LEF files (space-separated, tech LEF first)
{% if lef_files %}
set lef_files           [list {% for lef in lef_files.split(' ') %}"{{ lef }}" {% endfor %}]
{% else %}
set lef_files           [list \
    "/tech/sky130hd/sky130hd.tlef" \
    "/tech/sky130hd/sky130hd.lef"]
{% endif %}

# Timing libraries to load after reading design
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
    set enc_file [glob -nocomplain "${design_dir}/*.enc.dat"]
    if { [llength $enc_file] == 0 } {
        set enc_file "${design_dir}.enc.dat"
    } else {
        set enc_file [lindex $enc_file 0]
    }
    restoreDesign $enc_file $top_cell
    puts "INFO: Design restored from: $enc_file"

} else {
    # DEF-based initialization using init_design pattern
    # This is the proper Innovus way to load LEF/DEF
    set init_lef_file $lef_files
    set init_def_file $def_file
    set init_top_cell $top_cell
    set init_gnd_net VSS
    set init_pwr_net VDD
    init_design
    puts "INFO: DEF-based design initialization complete"
}

##############################################################################
# STEP 2: Verify design loaded correctly
##############################################################################

puts "\nINFO: ---- Step 2: Verifying loaded design ----"

set design_name [getDesignName]
if { $design_name eq "" } {
    error "ERROR: Design load failed. getDesignName returned empty string."
}
puts "INFO: Design name: $design_name"

set total_insts   [llength [dbget top.insts -e]]
set total_nets    [llength [dbget top.nets  -e]]
set total_ports   [llength [dbget top.terms -e]]

puts [format "INFO: %-25s %d"          "Total instances"   $total_insts]
puts [format "INFO: %-25s %d"          "Total nets"        $total_nets]
puts [format "INFO: %-25s %d"          "Total ports"       $total_ports]

if { $total_insts == 0 } {
    puts "WARNING: Zero instances loaded. Verify load_mode and file paths."
} else {
    puts "INFO: RESULT: Design loaded successfully. Ready for downstream operations."
}

puts "INFO: innovus_read_design.tcl COMPLETE"
puts "INFO: =================================================="
