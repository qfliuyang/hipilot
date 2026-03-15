# Chip Finish Tcl Patterns

Common Tcl snippets for chip finish stage.

## Final Cleanup

### Innovus

```tcl
# Remove assign statements
remove_assigns -buffering

# Remove dangling nets
deleteDanglingNet

# Remove empty modules
deleteEmptyModule

# Reconnect power
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
```

## Final Verification

### Innovus

```tcl
# Verify connectivity
verifyConnectivity -type all -error 1000 -warning 50

# Verify geometry (optional)
verify_drc -limit 1000
```

## Export DEF

### Innovus

```tcl
# Export DEF with all components
defOut -floorplan -netlist -routing result/pr/data/design_routing.def

# Export for STA
defOut -routing result/pr/data/design_final.def
```

## Export Verilog Netlist

### Innovus

```tcl
# Power-aware netlist for simulation
saveNetlist result/pr/data/design_routing.vg

# LVS netlist (no power pins)
saveNetlist -excludeLeafCell -includePowerGround -flattenBus \
            result/pr/data/design_lvs.vg

# Functional netlist (for simulation)
saveNetlist result/pr/data/design_func.v
```

## Export GDS

### Innovus

```tcl
# Stream out GDS
streamOut result/pr/data/design_core.gds \
          -mapFile designs/sky130hd/pdk/gds/gds.map \
          -libName DesignLib \
          -units 1000 \
          -mode ALL

# Alternative with merge
streamOut result/pr/data/design_core_merged.gds \
          -mapFile designs/sky130hd/pdk/gds/gds.map \
          -mergeWithLeafCells \
          -libName DesignLib \
          -units 1000
```

## Export SPEF

### Innovus

```tcl
# Export SPEF for STA
rcOutSpef -rcCorner rc_tt result/pr/data/design.spef
```

## Generate Final Reports

### Innovus

```tcl
# Timing summary
report_timing -max_paths 20 > reports/final_timing.rpt

# Area summary
report_area > reports/final_area.rpt

# Power summary
report_power > reports/final_power.rpt

# QoR summary
report_qor > reports/final_qor.rpt

# Connectivity summary
report_connectivity > reports/connectivity.rpt
```

## ICC2 Equivalents

### Export DEF

```tcl
write_def -version 5.8 result/pr/data/design.def
```

### Export Netlist

```tcl
write_verilog -hierarchy result/pr/data/design.v
```

### Export GDS

```tcl
write_gds -layer_map mapfile.map result/pr/data/design.gds
```

### Export SPEF

```tcl
write_parasitics -format SPEF -output result/pr/data/design.spef
```

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# chip_done.tcl - Chip finish and output generation

#===========================================
# Configuration
#===========================================
set DESIGN_NAME "ibex_core"
set RESULT_DIR "result/pr/data"
set GDS_MAP "designs/sky130hd/pdk/gds/gds.map"

#===========================================
# Final Cleanup
#===========================================
echo "Cleaning up design..."
remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

# Reconnect power
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *

#===========================================
# Final Verification
#===========================================
echo "Running final verification..."
verifyConnectivity -type all -error 1000 -warning 50

#===========================================
# Export DEF
#===========================================
echo "Exporting DEF..."
defOut -floorplan -netlist -routing ${RESULT_DIR}/${DESIGN_NAME}_routing.def

#===========================================
# Export Netlists
#===========================================
echo "Exporting netlists..."
saveNetlist ${RESULT_DIR}/${DESIGN_NAME}_routing.vg
saveNetlist -excludeLeafCell -includePowerGround -flattenBus \
            ${RESULT_DIR}/${DESIGN_NAME}_lvs.vg

#===========================================
# Export GDS
#===========================================
echo "Exporting GDS..."
streamOut ${RESULT_DIR}/${DESIGN_NAME}.gds \
          -mapFile ${GDS_MAP} \
          -libName DesignLib \
          -units 1000 \
          -mode ALL

#===========================================
# Export SPEF
#===========================================
echo "Exporting SPEF..."
rcOutSpef -rcCorner rc_tt ${RESULT_DIR}/${DESIGN_NAME}.spef

#===========================================
# Final Reports
#===========================================
echo "Generating final reports..."
report_timing -max_paths 20 > reports/final_timing.rpt
report_area > reports/final_area.rpt
report_power > reports/final_power.rpt
report_qor > reports/final_qor.rpt

echo "Chip finish complete!"
```
