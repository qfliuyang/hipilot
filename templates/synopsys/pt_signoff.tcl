##############################################################################
# pt_signoff.tcl
# HiPilot Template: Signoff STA (Synopsys PrimeTime)
#
# Description:
#   Generic PrimeTime signoff script that:
#     - Reads timing libraries (.db)
#     - Reads routed netlist and SPEF
#     - Applies SDC constraints
#     - Runs setup and hold analysis
#     - Writes summary timing reports
#
# Used via EDA MCP:
#   generate_tcl(intent, { tool: "pt_shell", operation: "signoff_timing", variables: { ... }})
##############################################################################

##############################################################################
# PARAMETERS (substituted by HiPilot via Nunjucks)
##############################################################################

# Design name and top module
set DESIGN_NAME "{{ design_name | default('top') }}"

# Library search path and timing libs (.db recommended)
set LIB_SEARCH_PATH "{{ lib_search_path | default('.') }}"
set TIMING_LIBS [list{% for lib in timing_libs | default([]) %} "{{ lib }}"{% endfor %}]

# Netlist and SPEF
set NETLIST_FILE "{{ netlist_file | default('result/pr/data/${DESIGN_NAME}.vg') }}"
set SPEF_FILE    "{{ spef_file    | default('result/pr/data/${DESIGN_NAME}.spef') }}"

# SDC constraints (should NOT contain current_design)
set SDC_FILE     "{{ sdc_file     | default('constraints/${DESIGN_NAME}.sdc') }}"

# Output directory for reports
set REPORT_DIR   "{{ report_dir   | default('result/sta/report') }}"

file mkdir $REPORT_DIR

##############################################################################
# SETUP LIBRARIES AND DESIGN
##############################################################################

puts "======================================================================"
puts "HiPilot PrimeTime Signoff - START"
puts "Design       : $DESIGN_NAME"
puts "Netlist      : $NETLIST_FILE"
puts "SPEF         : $SPEF_FILE"
puts "SDC          : $SDC_FILE"
puts "Libs         : $TIMING_LIBS"
puts "Report dir   : $REPORT_DIR"
puts "======================================================================"

set_app_var search_path [list . $LIB_SEARCH_PATH]

if { [llength $TIMING_LIBS] == 0 } {
  puts "ERROR: No timing libraries specified (timing_libs is empty)."
  exit 1
}

foreach lib $TIMING_LIBS {
  if { [file exists $lib] } {
    read_db $lib
  } else {
    puts "WARNING: Timing library not found: $lib"
  }
}

if { ![file exists $NETLIST_FILE] } {
  puts "ERROR: Netlist file not found: $NETLIST_FILE"
  exit 1
}
read_verilog $NETLIST_FILE

current_design $DESIGN_NAME

if { [file exists $SPEF_FILE] } {
  read_parasitics $SPEF_FILE
} else {
  puts "WARNING: SPEF file not found: $SPEF_FILE (running ideal-only analysis)."
}

if { [file exists $SDC_FILE] } {
  read_sdc $SDC_FILE
} else {
  puts "WARNING: SDC file not found: $SDC_FILE (no constraints applied)."
}

update_timing

##############################################################################
# REPORTING
##############################################################################

set SETUP_RPT "$REPORT_DIR/${DESIGN_NAME}_setup.rpt"
set HOLD_RPT  "$REPORT_DIR/${DESIGN_NAME}_hold.rpt"
set SUM_RPT   "$REPORT_DIR/${DESIGN_NAME}_summary.rpt"

report_timing \
  -delay max \
  -max_paths 50 \
  -path_type full_clock_expanded \
  -significant_digits 4 \
  > $SETUP_RPT

report_timing \
  -delay min \
  -max_paths 50 \
  -path_type full_clock_expanded \
  -significant_digits 4 \
  > $HOLD_RPT

report_qor \
  -summary \
  > $SUM_RPT

set setup_wns [get_attribute [get_timing_paths -delay_type max -max_paths 1 -quiet] slack]
set hold_wns  [get_attribute [get_timing_paths -delay_type min -max_paths 1 -quiet] slack]

if { $setup_wns eq "" } { set setup_wns 0.0 }
if { $hold_wns  eq "" } { set hold_wns  0.0 }

puts "======================================================================"
puts "HiPilot PrimeTime Signoff - COMPLETE"
puts "Design        : $DESIGN_NAME"
puts [format "Setup WNS (ns) : %.4f" $setup_wns]
puts [format "Hold  WNS (ns) : %.4f" $hold_wns]
puts "Reports:"
puts "  Setup  : $SETUP_RPT"
puts "  Hold   : $HOLD_RPT"
puts "  Summary: $SUM_RPT"
puts "======================================================================"

