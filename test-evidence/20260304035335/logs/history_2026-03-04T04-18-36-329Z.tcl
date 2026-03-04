# Sent at: 2026-03-04T04:18:36.329Z
# Pane: eda

source /home/EDA/ibex_work_upload/result/pr/data/placement.enc

set_ccopt_property use_inverters true

# Enable CTS inverter cells
foreach cts_inv_cell {
    sky130_fd_sc_hd__lpflow_clkinvkapwr_1
    sky130_fd_sc_hd__lpflow_clkinvkapwr_2
    sky130_fd_sc_hd__lpflow_clkinvkapwr_4
    sky130_fd_sc_hd__lpflow_clkinvkapwr_8
    sky130_fd_sc_hd__lpflow_clkinvkapwr_16
} {
    setDontUse [get_lib_cells */$cts_inv_cell] false
}
set_ccopt_property inverter_cells [get_lib_cells "sky130_fd_sc_hd__lpflow_clkinvkapwr_*"]

# NDR for clock nets (2x width/spacing)
add_ndr -name cts_1 -width_multiplier "met2:met4 2" -spacing_multiplier "met2:met4 2"
create_route_type -name clk_net_rule -non_default_rule cts_1 -top_preferred_layer met2 -bottom_preferred_layer met4
set_ccopt_property route_type clk_net_rule -net_type trunk
setNanoRouteMode -quiet -routeTopRoutingLayer 6 -routeBottomRoutingLayer 2

create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
timeDesign -postCTS -pathReports -drvReports -slackReports -numPaths 50 -prefix postCTS -outDir result/pr/report/cts_timing
saveDesign result/pr/data/cts.enc
puts "STAGE 5 COMPLETE: CTS done"
exit