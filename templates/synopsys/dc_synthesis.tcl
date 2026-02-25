##############################################################################
# dc_synthesis.tcl
# HiPilot Template: RTL → Gate-Level Netlist (Synopsys Design Compiler)
#
# Description:
#   Generic DC synthesis script that:
#     - Reads RTL
#     - Applies libraries and constraints
#     - Runs compile_ultra
#     - Writes out netlist and SDC
#     - Generates basic timing/area reports
#
# This file is used by HiPilot via the EDA MCP server:
#   generate_tcl(intent, { tool: "dc_shell", operation: "synthesis", variables: { ... }})
# and should NOT be edited in-place for individual designs. Instead, pass
# design-specific paths via the variables map.
#
# Tested with: Design Compiler (dc_shell) 2019+ (T-2022.03 compatible)
##############################################################################

##############################################################################
# PARAMETERS (substituted by HiPilot via Nunjucks)
##############################################################################

# Top-level design name
set DESIGN_NAME "{{ design_name | default('top') }}"

# RTL files (glob pattern or explicit list)
# Example: "{{ rtl_glob }}" -> "designs/src/ibex/*.v"
set RTL_GLOB   "{{ rtl_glob | default('rtl/*.v') }}"

# Technology and link libraries (Liberty .lib or compiled .db)
# These should be absolute or design-root-relative paths.
set TARGET_LIBS [list{% for lib in target_libs | default([]) %} "{{ lib }}"{% endfor %}]
set LINK_LIBS   [list{% for lib in link_libs   | default(target_libs | default([])) %} "{{ lib }}"{% endfor %}]

# SDC constraint file (optional). If empty, a basic clock is created.
set SDC_FILE   "{{ sdc_file | default('') }}"

# Working/output directories (relative to current dc_shell working dir)
set WORK_DIR      "{{ work_dir      | default('result/syn') }}"
set NETLIST_DIR   "{{ netlist_dir   | default('result/syn/data') }}"
set REPORT_DIR    "{{ report_dir    | default('result/syn/report') }}"
set LOG_DIR       "{{ log_dir       | default('result/syn/log') }}"

# Output file names
set NETLIST_OUT   "{{ netlist_out   | default('$NETLIST_DIR/${DESIGN_NAME}.syn.v') }}"
set SDC_OUT       "{{ sdc_out       | default('$NETLIST_DIR/${DESIGN_NAME}.syn.sdc') }}"

# Clock name and period (ns) for default clock creation when no SDC provided
set CLK_PORT      "{{ clk_port      | default('clk_i') }}"
set CLK_PERIOD_NS {{ target_period_ns | default(10.0) }}

##############################################################################
# DIRECTORY SETUP
##############################################################################

file mkdir $WORK_DIR
file mkdir $NETLIST_DIR
file mkdir $REPORT_DIR
file mkdir $LOG_DIR

set_app_var search_path       [list . {{ search_path | default('') }}]
set_app_var target_library    $TARGET_LIBS
set_app_var link_library      [concat $LINK_LIBS {*}$TARGET_LIBS]

##############################################################################
# READ RTL AND CONSTRAINTS
##############################################################################

echo "======================================================================"
echo "HiPilot DC Synthesis - START"
echo "Design      : $DESIGN_NAME"
echo "RTL glob    : $RTL_GLOB"
echo "Target libs : $TARGET_LIBS"
echo "Link libs   : $LINK_LIBS"
echo "Work dir    : $WORK_DIR"
echo "Reports dir : $REPORT_DIR"
echo "======================================================================"

set RTL_FILES [glob $RTL_GLOB]
if { [llength $RTL_FILES] == 0 } {
  echo "ERROR: No RTL files matched pattern '$RTL_GLOB'"
  exit 1
}

analyze  -format verilog $RTL_FILES
elaborate $DESIGN_NAME
current_design $DESIGN_NAME

link

# Load constraints if provided, otherwise create a simple default clock
if { $SDC_FILE ne "" && [file exists $SDC_FILE] } {
  echo "Reading SDC constraints from $SDC_FILE"
  read_sdc $SDC_FILE
} else {
  echo "No SDC provided. Creating default clock on port $CLK_PORT with period $CLK_PERIOD_NS ns"
  create_clock -period $CLK_PERIOD_NS [get_ports $CLK_PORT]
  set_input_delay  [expr {$CLK_PERIOD_NS * 0.2}] -clock [get_clocks] [all_inputs]
  set_output_delay [expr {$CLK_PERIOD_NS * 0.2}] -clock [get_clocks] [all_outputs]
}

##############################################################################
# COMPILE
##############################################################################

set compile_log "$LOG_DIR/${DESIGN_NAME}_compile.log"
redirect $compile_log {
  compile_ultra
}

##############################################################################
# REPORTING
##############################################################################

set timing_rpt "$REPORT_DIR/${DESIGN_NAME}_timing.rpt"
set area_rpt   "$REPORT_DIR/${DESIGN_NAME}_area.rpt"
set power_rpt  "$REPORT_DIR/${DESIGN_NAME}_power.rpt"

report_timing -path full -max_paths 20          > $timing_rpt
report_area                                   > $area_rpt
catch { report_power > $power_rpt }

##############################################################################
# WRITE OUT NETLIST AND CONSTRAINTS
##############################################################################

write  -format verilog  -hierarchy -output $NETLIST_OUT
write_sdc $SDC_OUT

echo "======================================================================"
echo "HiPilot DC Synthesis - COMPLETE"
echo "Design        : $DESIGN_NAME"
echo "Netlist       : $NETLIST_OUT"
echo "SDC           : $SDC_OUT"
echo "Timing report : $timing_rpt"
echo "Area report   : $area_rpt"
echo "Power report  : $power_rpt"
echo "======================================================================"

