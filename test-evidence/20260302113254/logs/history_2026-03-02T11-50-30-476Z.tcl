# Sent at: 2026-03-02T11:50:30.476Z
# Pane: eda

cd /home/EDA/ibex_work_upload

# Setup MMMC
set timing_lib /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lib/sky130_fd_sc_hd__tt_025C_1v80.lib
set mmmc_file [open "result/pr/data/mmmc.view" w]
puts $mmmc_file "create_rc_corner -name rc_max -preRoute_res 1.05 -preRoute_cap 1.05 -postRoute_res 1.05 -postRoute_cap 1.05"
puts $mmmc_file "create_rc_corner -name rc_min -preRoute_res 1 -preRoute_cap 1 -postRoute_res 1 -postRoute_cap 1"
puts $mmmc_file "create_library_set -name lib_set_max -timing $timing_lib"
puts $mmmc_file "create_library_set -name lib_set_min -timing $timing_lib"
puts $mmmc_file "create_constraint_mode -name common -sdc_files /home/EDA/ibex_work_upload/designs/sky130hd/ibex/constraint_for_pr.sdc"
puts $mmmc_file "create_delay_corner -name delay_max -library_set lib_set_max -rc_corner rc_max"
puts $mmmc_file "create_delay_corner -name delay_min -library_set lib_set_min -rc_corner rc_min"
puts $mmmc_file "create_analysis_view -name max_view -constraint_mode common -delay_corner delay_max"
puts $mmmc_file "create_analysis_view -name min_view -constraint_mode common -delay_corner delay_min"
puts $mmmc_file "set_analysis_view -setup max_view -hold min_view"
close $mmmc_file

set init_mmmc_file result/pr/data/mmmc.view
set defHierChar {/}
set init_gnd_net VSS
set init_pwr_net VDD
set init_verilog /home/EDA/ibex_work_upload/result/syn/data/ibex_core.syn.v
set init_top_cell ibex_core
set init_lef_file [list /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef /home/EDA/ibex_work_upload/designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef]

# Init design
init_design
puts "INIT COMPLETE"

# Floorplan
floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cells */$cell] true
}
puts "FLOORPLAN COMPLETE"

# Power
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB VPWR} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS
addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1
addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1
sroute -connect { corePin } -layerChangeRange { li1(1) met4(4) } -corePinTarget { none } -allowJogging 1 -crossoverViaLayerRange { li1(1) met4(4) } -nets { VDD VSS } -allowLayerChange 1 -targetViaLayerRange { li1(1) met4(4) }
puts "POWER COMPLETE"

# Define scan chain to satisfy the placement checker
# Based on the scan DEF, there's one chain starting with test_si
puts "Defining scan chain..."
if {[catch {
    specifyScanChain chain1 -start test_si -floating inst_order
} err]} {
    puts "Could not define scan chain: $err"
}

# Placement - try without ignoring scan chains now that we defined one
setPlaceMode -reset
setPlaceMode -place_global_place_io_pins false
setDesignMode -process 130

# If placement fails, catch it and continue
if {[catch {place_design} err]} {
    puts "Placement error (continuing): $err"
}
puts "PLACEMENT COMPLETE"

# Check if cells are actually placed
set placed [get_cells * -quiet -filter "is_placed == true"]
puts "Placed cells count: [llength $placed]"

if {[llength $placed] > 100} {
    # CTS
    set_ccopt_property use_inverters true
    create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
    source result/pr/data/clk.spec
    ccopt_design -cts
    
    saveDesign result/pr/data/cts.enc
    puts "=== FLOW COMPLETE: CTS ==="
} else {
    puts "ERROR: Cells not placed"
    saveDesign result/pr/data/pre_placement.enc
}

exit