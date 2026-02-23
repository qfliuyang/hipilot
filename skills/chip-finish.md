---
name: chip-finish
description: >
  Final chip finishing and output generation. Covers DEF/GDS export,
  netlist generation, and final verification. Designed for Innovus.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus, calibre]
    synopsys: [icc2_shell]
  flow_stages: [chip_finish]
  triggers:
    - "chip finish"
    - "export gds"
    - "output def"
    - "save netlist"
    - "stream out"
  qor_metrics: [DEF_Size, GDS_Size, Netlist_Cells]
  risk_level: low
  typical_duration: "2-10 minutes"
---

# Chip Finish

## Quick Reference

```
User: "chip finish"
```

HiPilot will:
1. Clean up design (assigns, dangling nets)
2. Verify connectivity
3. Export DEF file
4. Export Verilog netlist
5. Export GDS stream
6. Generate final reports

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| After routing optimization | Export final outputs |
| Signoff preparation | Generate all deliverables |
| Tape-out | Final GDS export |
| Verification prep | Export for DRC/LVS |

**Prerequisites:**
- Routing completed
- Timing optimized
- DRC clean (or acceptable)

---

## Chip Finish Workflow

### Step 1: Final Cleanup

**Innovus:**
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

### Step 2: Final Verification

**Innovus:**
```tcl
# Verify connectivity
verifyConnectivity -type all -error 1000 -warning 50

# Verify geometry (optional)
verify_drc -limit 1000
```

### Step 3: Export DEF

**Innovus:**
```tcl
# Export DEF with all components
defOut -floorplan -netlist -routing result/pr/data/ibex_routing.def

# Export for STA
defOut -routing result/pr/data/ibex_final.def
```

### Step 4: Export Verilog Netlist

**Innovus:**
```tcl
# Power-aware netlist for simulation
saveNetlist result/pr/data/ibex_routing.vg

# LVS netlist (no power pins)
saveNetlist -excludeLeafCell -includePowerGround -flattenBus \
            result/pr/data/ibex_lvs.vg

# Functional netlist (for simulation)
saveNetlist result/pr/data/ibex_func.v
```

### Step 5: Export GDS

**Innovus:**
```tcl
# Stream out GDS
streamOut result/pr/data/ibex_core.gds \
          -mapFile designs/sky130hd/pdk/gds/gds.map \
          -libName DesignLib \
          -units 1000 \
          -mode ALL

# Alternative with merge
streamOut result/pr/data/ibex_core_merged.gds \
          -mapFile designs/sky130hd/pdk/gds/gds.map \
          -mergeWithLeafCells \
          -libName DesignLib \
          -units 1000
```

### Step 6: Generate Final Reports

**Innovus:**
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

---

## Output Files

### DEF Files

| File | Purpose |
|------|---------|
| `ibex_routing.def` | Full design with routing |
| `ibex_final.def` | Final signoff DEF |

### Verilog Netlists

| File | Purpose |
|------|---------|
| `ibex_routing.vg` | Gate-level with power |
| `ibex_lvs.vg` | LVS netlist |
| `ibex_func.v` | Functional simulation |

### GDS Files

| File | Purpose |
|------|---------|
| `ibex_core.gds` | Layout for verification |
| `ibex_core_merged.gds` | Merged with standard cells |

### SPEF Files (for STA)

**Innovus:**
```tcl
# Export SPEF for STA
rcOutSpef -rcCorner rc_tt result/pr/data/ibex.spef
```

---

## GDS Map File

The GDS map file maps layer names to GDS layer numbers. For Skywater 130nm:

```tcl
# Typical Skywater 130nm GDS map
# Layer names from LEF -> GDS numbers
# li1    -> 66:20
# met1   -> 68:20
# met2   -> 69:20
# met3   -> 70:20
# met4   -> 71:20
# met5   -> 72:20
```

---

## Complete Script Template

**Innovus:**
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

---

## MCP Commands (For Claude Code)

### Final Cleanup
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "remove_assigns -buffering; deleteDanglingNet; deleteEmptyModule; globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *; globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *"
}'
```

### Verify Connectivity
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "verifyConnectivity -type all -error 1000 -warning 50"
}'
```

### Export DEF
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "defOut -floorplan -netlist -routing /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_routing.def"
}'
```

### Export Netlists
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveNetlist /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_routing.vg; saveNetlist -excludeLeafCell -includePowerGround -flattenBus /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_lvs.vg"
}'
```

### Export GDS
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "streamOut /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/ibex_core.gds -mapFile /home/EDA/hipilot_test/ibex_work_upload/designs/sky130hd/pdk/gds/gds.map -libName DesignLib -units 1000 -mode ALL"
}'
```

---

## Related Skills

- `/routing-opt` - Post-routing optimization
- `/sta` - PrimeTime STA
- `/verification` - DRC/LVS verification
- `/save-design` - Save checkpoint

---

## Checklist

Before chip finish:
- [ ] Routing completed
- [ ] Timing optimized
- [ ] DRC verified

After chip finish:
- [ ] DEF exported
- [ ] Netlists generated
- [ ] GDS exported
- [ ] SPEF exported
- [ ] Reports generated
