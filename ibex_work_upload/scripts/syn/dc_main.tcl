# -------------------------------------------------------------
# Set env variable
# -------------------------------------------------------------
source $::env(SCRIPTS_DIR)/syn/dc_setup.tcl

# -------------------------------------------------------------
# Lib set up
# -------------------------------------------------------------
set target_library $::env(DB_FILES)
set link_library "* $target_library"
lappend link_library {dw_foundation.sldb}
puts $::env(VERILOG_FILES)

# -------------------------------------------------------------
# Design in
# -------------------------------------------------------------
#foreach file [ split $::env(VERILOG_FILES) {' '} ] {
#    read_file -format sverilog $file
#}
analyze -format sverilog $::env(VERILOG_FILES)
elaborate $::env(DESIGN_NAME)
current_design $::env(DESIGN_NAME)
link
check_design

# -------------------------------------------------------------
# Read sdc
# -------------------------------------------------------------
source $::env(SDC_FILE)

# -------------------------------------------------------------
# Group setting
# -------------------------------------------------------------
reset_path_group -all
set reg [filter_collection [all_registers] "is_clock_gate != true"]
set input [all_inputs]
set output [all_outputs]
group_path -name reg2reg -weight 50 -critical_range 6 -from $reg -to $reg
group_path -name in2reg -weight 10 -critical_range 0.5 -from $input -to $reg
group_path -name reg2out -weight 10 -critical_range 0.5 -from $reg -to $output

# -------------------------------------------------------------
# Setting dontuse cell 
# -------------------------------------------------------------
#set dont use cell
puts "DONTUSE"
foreach cell [split $::env(DONT_USE_CELLS)] {
    get_lib_cell  */$cell
    set_dont_use [get_lib_cell */$cell]
}
redirect $::env(RESULT_DIR)/syn/report/check_timing.rpt {check_timing}

# -------------------------------------------------------------
# Compile design
# -------------------------------------------------------------
set_fix_multiple_port_nets -all -buffer_constants [get_designs *]
compile_ultra -timing_high_effort_script -scan

# -------------------------------------------------------------
# Dft configuration
# -------------------------------------------------------------
set_dft_insertion_configuration -preserve_design_name true
set_dft_signal -view existing_dft -type ScanClock -timing {45 55} -port {clk_i}
set_dft_signal -view existing_dft -port rst_ni -type Reset -active_state 0
set_dft_signal -view existing_dft -port test_en_i -type ScanEnable -active_state 1
set_dft_insertion_configuration -synthesis none -preserve_design_name true
set_autofix_configuration -type bidirectional -method input
create_test_protocol -infer_async -infer_clock

# -------------------------------------------------------------
# Scanchain insert
# -------------------------------------------------------------
preview_dft -show all -verbose -test_points all -test_wrappers all > $::env(RESULT_DIR)/scanchain/report/preview_dft.rpt
insert_dft
report_dft_signal > $::env(RESULT_DIR)/scanchain/report/dft_signal.rpt
write_test_protocol -output $::env(RESULT_DIR)/scanchain/data/test_protocol.stil
dft_drc  -verbose > $::env(RESULT_DIR)/scanchain/report/pre_dft_drc.rpt

# -------------------------------------------------------------
# Compile design incremental
# -------------------------------------------------------------
compile_ultra -scan -incremental

# -------------------------------------------------------------
# post-syn report&data out
# -------------------------------------------------------------
source $::env(SCRIPTS_DIR)/syn/dc_report.tcl
#exit




