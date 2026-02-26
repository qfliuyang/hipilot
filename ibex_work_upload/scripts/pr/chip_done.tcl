source $::env(RESULT_DIR)/pr/data/routing_opt.enc
# -------------------------------------------------------------
# Remove the unused net&module
# -------------------------------------------------------------
remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

# -------------------------------------------------------------
# Re-connect the PG net after add physical cell
# -------------------------------------------------------------
globalNetConnect VDD -type pgpin -pin {VPB} -inst *
globalNetConnect VDD -type pgpin -pin {VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPB} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND} -inst *
globalNetConnect VSS -type pgpin -pin {VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND} -inst *
globalNetConnect VSS -type tielo -pin {VNB} -inst *
globalNetConnect VSS -type net -net VSS
verifyConnectivity -type all -error 1000 -warning 50

# ----------------------------------------------------------------
# Write out the routing def
# ----------------------------------------------------------------
set lefDefOutVersion 5.8
defOut -floorplan -netlist -routing $::env(RESULT_DIR)/pr/data/ibex_routing.def

# -----------------------------------------------------------------
# write out the spef by QRC
# -----------------------------------------------------------------
setExtractRCMode -engine postRoute
reset_parasitics
extractRC
#rcOut -spef $::env(DESIGN_HOME)/sky130hd/ibex/ibex_mine.spef

# -----------------------------------------------------------------
# Write out the netlist
# ibex_routing.vg does not contain the PG port&net
# ibex_lvs.vg contain the PG port&net for run v2lvs 
# -----------------------------------------------------------------
saveNetlist $::env(RESULT_DIR)/pr/data/ibex_routing.vg
saveNetlist -excludeLeafCell -includePowerGround -flattenBus $::env(RESULT_DIR)/pr/data/ibex_lvs.vg

# -----------------------------------------------------------------
# Create_text_ibex.tcl is created for adding text when run lvs
# VDD.pp&VSS.pp is created for run ir-drop analysis 
# -----------------------------------------------------------------
set text_layer_number $::env(LAYER_TEXT_NUM)
set file [open $::env(SCRIPTS_DIR)/pv/create_text_ibex.tcl w+]
set vdd_ploc_file [open $::env(SCRIPTS_DIR)/ir_v/VDD.pp w+]
set vss_ploc_file [open $::env(SCRIPTS_DIR)/ir_v/VSS.pp w+]

puts $file "set  GDS_FILE \[layout create $::env(RESULT_DIR)/pr/data/ibex_core.merge.gds -dt_expand\]"
puts $file "\$GDS_FILE create layer $text_layer_number"

set net VDD
set special_wire [dbGet [dbGet top.pgNets.name $net -p].sWires.layer.name $::env(H_STRIPE_METAL) -p2]
set count 0 
foreach sw $special_wire {
    set llx [dbGet $sw.box_llx]
    set lly [dbGet $sw.box_lly]
    set urx [dbGet $sw.box_urx]
    set ury [dbGet $sw.box_ury]

    set x [expr ($llx + $urx) / 2.0*1000]
    set y [expr ($lly + $ury) / 2.0*1000]

    set x_ploc [expr ($llx + $urx) / 2.0]
    set y_ploc [expr ($lly + $ury) / 2.0]

    puts $file "\$GDS_FILE create text ibex_core $text_layer_number $x $y $net"
    puts $vdd_ploc_file "VDD_$count $x_ploc $y_ploc $::env(H_STRIPE_METAL)"
    set count [expr $count + 1]
}
close $vdd_ploc_file

set net VSS
set count 0
set special_wire [dbGet [dbGet top.pgNets.name $net -p].sWires.layer.name $::env(H_STRIPE_METAL) -p2]
foreach sw $special_wire {
    set llx [dbGet $sw.box_llx]
    set lly [dbGet $sw.box_lly]
    set urx [dbGet $sw.box_urx]
    set ury [dbGet $sw.box_ury]

    set x [expr ($llx + $urx) / 2.0*1000]
    set y [expr ($lly + $ury) / 2.0*1000]
    set x_ploc [expr ($llx + $urx) / 2.0]
    set y_ploc [expr ($lly + $ury) / 2.0]

    puts $file "\$GDS_FILE create text ibex_core $text_layer_number $x $y $net"
    puts $vss_ploc_file "VSS_$count $x_ploc $y_ploc $::env(H_STRIPE_METAL)"
    set count [expr $count + 1]
}
close $vss_ploc_file
puts $file "\$GDS_FILE gdsout $::env(RESULT_DIR)/pr/data/ibex_core.text.gds ibex_core"
close $file

# -----------------------------------------------------------------
# output the hcell list for lvs & ir-drop analysis
# -----------------------------------------------------------------
set hcell_file [open $::env(SCRIPTS_DIR)/pv/hcell_list w]
set hcell_list_ir [open $::env(SCRIPTS_DIR)/ir_v/cell_list w]
set cells [dbGet [dbGet top.insts.isPhysOnly 0 -p].cell.name]
set cells [lsort -u $cells]
foreach cell $cells {
    puts $hcell_file "$cell $cell"
    puts $hcell_list_ir "$cell"
}
close $hcell_file
close $hcell_list_ir

# -----------------------------------------------------------------
# Gds streamOut
# -----------------------------------------------------------------
setStreamOutMode -textSize 5
setStreamOutMode -virtualConnection true
setStreamOutMode -uniquifyCellNamesPrefix true
setStreamOutMode -check_map_file true
streamOut $::env(RESULT_DIR)/pr/data/ibex_core.gds -mapFile $::env(GDS_MAP_FILE) -libName DesignLib  -units 1000 -mode ALL

saveDesign $::env(RESULT_DIR)/pr/data/chip_done.enc
#exit




