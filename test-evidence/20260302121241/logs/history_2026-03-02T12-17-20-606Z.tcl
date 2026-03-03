# Sent at: 2026-03-02T12:17:20.606Z
# Pane: eda

cd /home/EDA/ibex_work_upload

# Skip synthesis if netlist already exists (allows restarting from P&R)
if {[file exists result/syn/data/ibex_core.syn.v]} {
    puts "SYNTHESIS ALREADY COMPLETE — using existing netlist at result/syn/data/ibex_core.syn.v"
    exit 0
}

file mkdir result/syn/data result/syn/log result/syn/report result/syn/work
file mkdir result/scanchain/data result/scanchain/report result/scanchain/log

# Setup
define_design_lib work -path result/syn/work
set sh_command_log_file result/syn/work/command.log
set_app_var alib_library_analysis_path result/syn/work

# Library
set target_library /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.db
set link_library "* $target_library"
lappend link_library {dw_foundation.sldb}

# Read RTL
analyze -format sverilog [glob /home/EDA/ibex_work_upload/designs/src/ibex/*.v]
elaborate ibex_core
current_design ibex_core
link
check_design

# Timing constraints
source /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint.sdc

# Path groups
reset_path_group -all
set reg [filter_collection [all_registers] "is_clock_gate != true"]
group_path -name reg2reg -weight 50 -critical_range 6 -from $reg -to $reg
group_path -name in2reg -weight 10 -critical_range 0.5 -from [all_inputs] -to $reg
group_path -name reg2out -weight 10 -critical_range 0.5 -from $reg -to [all_outputs]

# Dont-use cells
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cell */$cell]
}
redirect result/syn/report/check_timing.rpt {check_timing}

# Compile (high effort + scan)
set_fix_multiple_port_nets -all -buffer_constants [get_designs *]
compile_ultra -timing_high_effort_script -scan

# DFT: scan chain insertion
set_dft_insertion_configuration -preserve_design_name true
set_dft_signal -view existing_dft -type ScanClock -timing {45 55} -port {clk_i}
set_dft_signal -view existing_dft -port rst_ni -type Reset -active_state 0
set_dft_signal -view existing_dft -port test_en_i -type ScanEnable -active_state 1
set_dft_insertion_configuration -synthesis none -preserve_design_name true
set_autofix_configuration -type bidirectional -method input
create_test_protocol -infer_async -infer_clock
preview_dft -show all -verbose > result/scanchain/report/preview_dft.rpt
insert_dft
dft_drc -verbose > result/scanchain/report/pre_dft_drc.rpt

# Incremental compile after DFT
compile_ultra -scan -incremental

# Reports
redirect result/syn/report/check_design_after_syn.rpt {check_design}
redirect result/syn/report/qor.rpt {report_qor -nosplit}
redirect result/syn/report/violation.rpt {report_constraint -all_violators}

# Output netlist (this is the input for Innovus P&R)
write -format verilog -h -output result/syn/data/ibex_core.syn.v
write -format ddc -h -output result/syn/data/ibex_core.rpt.ddc
write_scan_def -output result/scanchain/data/ibex_core.scan.def
set_svf result/syn/data/ibex_core.svf

puts "SYNTHESIS COMPLETE — netlist at result/syn/data/ibex_core.syn.v"
exit