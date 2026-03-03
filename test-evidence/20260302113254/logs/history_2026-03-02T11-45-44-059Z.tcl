# Sent at: 2026-03-02T11:45:44.059Z
# Pane: eda

# Floorplan
floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file
puts "STAGE 2 COMPLETE - FLOORPLAN"

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
puts "STAGE 3 COMPLETE - POWER"

# Placement - ignore scan chain errors
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_place_io_pins false
setDesignMode -process 130
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]

place_design
puts "STAGE 4 COMPLETE - PLACEMENT"

# CTS
set_ccopt_property use_inverters true
create_ccopt_clock_tree_spec -file result/pr/data/clk.spec
source result/pr/data/clk.spec
ccopt_design -cts

report_ccopt_skew_groups
saveDesign result/pr/data/cts.enc
puts "STAGE 5 COMPLETE - CTS"
exit