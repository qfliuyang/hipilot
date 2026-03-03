# Stage 1: Design Init (direct commands)
# Sent at: 2026-03-02T13:08:23.158Z

cd /home/EDA/ibex_work_upload
file mkdir result/pr/data result/pr/log result/pr/report

# Clear any existing design
catch {deleteObj lib}
catch {deleteObj mw_lib}
catch {exec rm -rf ./*.enc}

# Set MMMC variables directly
set timing_lib /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05
create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1
create_library_set -name lib_set_max -timing $timing_lib
create_library_set -name lib_set_min -timing $timing_lib
create_constraint_mode -name common -sdc_files /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc
create_delay_corner -name delay_max -library_set lib_set_max -rc_corner rc_max
create_delay_corner -name delay_min -library_set lib_set_min -rc_corner rc_min
create_analysis_view -name max_view -constraint_mode common -delay_corner delay_max
create_analysis_view -name min_view -constraint_mode common -delay_corner delay_min
set_analysis_view -setup [list max_view] -hold [list min_view]

# Design initialization variables
set defHierChar {/}
set init_gnd_net VSS
set init_pwr_net VDD
set init_verilog /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_lef_file [list /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]

# Initialize design
init_design -setup max_view -hold min_view