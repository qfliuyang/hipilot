# Create MMMC file and initialize design
# Sent at: 2026-03-02T13:08:44.462Z

cd /home/EDA/ibex_work_upload

# Create MMMC view file with set_analysis_view included
set fp [open "result/pr/data/mmmc.view" w]
puts $fp "create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05"
puts $fp "create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1"
puts $fp "create_library_set -name lib_set_max -timing designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib"
puts $fp "create_library_set -name lib_set_min -timing designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib"
puts $fp "create_constraint_mode -name common -sdc_files designs/sky130hd/ibex/constraint_for_pr.sdc"
puts $fp "create_delay_corner -name delay_max -library_set lib_set_max -rc_corner rc_max"
puts $fp "create_delay_corner -name delay_min -library_set lib_set_min -rc_corner rc_min"
puts $fp "create_analysis_view -name max_view -constraint_mode common -delay_corner delay_max"
puts $fp "create_analysis_view -name min_view -constraint_mode common -delay_corner delay_min"
puts $fp "set_analysis_view -setup \{max_view\} -hold \{min_view\}"
close $fp

# Design init variables
set defHierChar {/}
set init_gnd_net VSS
set init_pwr_net VDD
set init_verilog result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_lef_file [list designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]
set init_mmmc_file result/pr/data/mmmc.view

# Initialize design
init_design