---
name: power-planning
description: >
  Power grid creation for digital designs. Covers global net connections,
  power rings, power stripes, and rail routing. Designed for Innovus.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus, voltus]
    synopsys: [icc2_shell]
  flow_stages: [power]
  triggers:
    - "power plan"
    - "power grid"
    - "create power"
    - "add stripes"
    - "sroute"
    - "connect power"
  qor_metrics: [IR_Drop, Power_Grid_Resistance, Connectivity]
  risk_level: low
  typical_duration: "1-5 minutes"
---

# Power Planning

## Quick Reference

```
User: "create power grid"
```

HiPilot will:
1. Connect global nets (VDD, VSS) to pins
2. Create power rings (if needed)
3. Add power stripes on upper metal layers
4. Route standard cell rails
5. Verify connectivity

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| After floorplan | Create initial power grid |
| IR drop issues | Add more stripes |
| Power shorts | Debug and fix connections |
| Design resize | Redo power grid |

**Prerequisites:**
- Floorplan created
- Core area defined
- Power/ground nets named (VDD/VSS)

---

## Power Planning Workflow

### Step 1: Global Net Connections

**Innovus:**
```tcl
# Connect power pins to global nets
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *
globalNetConnect VDD -type net -net VDD

globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS
```

**ICC2:**
```tcl
# Connect power nets
connect_pg_net -net VDD -automatic
connect_pg_net -net VSS -automatic
```

### Step 2: Power Rings (Optional)

**Innovus:**
```tcl
# Create power ring around core
addRing -spacing 0.5 -width 1.0 \
        -layer {top met5 bottom met5 left met4 right met4} \
        -jog_distance 0.1 -offset 0.5 \
        -nets {VSS VDD}
```

### Step 3: Power Stripes

**Innovus (Met4 - Vertical):**
```tcl
# Add vertical stripes on met4
addStripe -nets {VSS VDD} \
          -layer met4 \
          -direction vertical \
          -width 6 \
          -spacing 2 \
          -set_to_set_distance 30 \
          -start_from left \
          -start_offset 1
```

**Innovus (Met5 - Horizontal):**
```tcl
# Add horizontal stripes on met5
addStripe -nets {VSS VDD} \
          -layer met5 \
          -direction horizontal \
          -width 6 \
          -spacing 2 \
          -set_to_set_distance 30 \
          -start_from bottom \
          -start_offset 1
```

**ICC2:**
```tcl
# Create power mesh
create_pg_mesh -layers {M4 M5} \
               -widths {6 6} \
               -pitches {30 30} \
               -offsets {1 1} \
               -nets {VDD VSS}
```

### Step 4: Rail Routing (Standard Cell Connections)

**Innovus:**
```tcl
# Connect standard cell rails to power grid
sroute -connect {corePin} \
       -layerChangeRange {li1 met4} \
       -corePinTarget {none} \
       -allowJogging 1 \
       -crossoverViaLayerRange {li1 met4} \
       -nets {VDD VSS} \
       -allowLayerChange 1 \
       -targetViaLayerRange {li1 met4}
```

**ICC2:**
```tcl
# Connect standard cells to power
create_pg_std_cell_conn_pattern -layers M1 \
                                -rail_width 0.1 \
                                -nets {VDD VSS}
connect_pg -net VDD -all_blocks
connect_pg -net VSS -all_blocks
```

---

## Power Grid Design Guidelines

### Layer Selection

| Layer | Typical Use | Width Range |
|-------|-------------|-------------|
| M1 | Standard cell rails | 0.1-0.2 um |
| M2-M3 | Local distribution | 0.5-1.0 um |
| M4-M5 | Power stripes | 1.0-6.0 um |
| M6+ | Top-level ring | 5.0-10.0 um |

### Skywater 130nm Example

```tcl
# Skywater 130nm HD power grid
# Met4: Vertical stripes
addStripe -nets {VSS VDD} \
          -layer met4 \
          -direction vertical \
          -width 6 \
          -spacing 2 \
          -set_to_set_distance 30 \
          -start_from left \
          -start_offset 1

# Met5: Horizontal stripes
addStripe -nets {VSS VDD} \
          -layer met5 \
          -direction horizontal \
          -width 6 \
          -spacing 2 \
          -set_to_set_distance 30 \
          -start_from bottom \
          -start_offset 1
```

---

## Verification

### Check Connectivity

**Innovus:**
```tcl
# Verify all cells connected to power
verifyConnectivity -type special -nets {VDD VSS} -error 1000

# Check for floating pins
verifyConnectivity -type regular -nets {VDD VSS}
```

### IR Drop Analysis

**Innovus (Voltus):**
```tcl
# Run static IR drop analysis
analyze_design -power_grid
report_power_grid -ir_drop
```

---

## Common Issues

### Issue 1: Unconnected Pins

**Symptoms:** `verifyConnectivity` reports errors

**Fix:**
```tcl
# Re-run sroute with different options
sroute -connect {corePin blockPin} \
       -nets {VDD VSS} \
       -layerChangeRange {li1 met5}
```

### Issue 2: Power Shorts

**Symptoms:** VDD-VSS shorts reported

**Fix:**
```tcl
# Check for shorts
verify_drc -nets {VDD VSS}

# Increase spacing
addStripe -spacing 4 ...  ;# Doubled spacing
```

---

## Complete Script Template

**Innovus:**
```tcl
#!/usr/bin/tclsh
# power_plan.tcl - Power grid creation

#===========================================
# Global Net Connections
#===========================================
echo "Connecting global nets..."
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS

#===========================================
# Power Stripes
#===========================================
echo "Adding power stripes..."
addStripe -nets {VSS VDD} -layer met4 -direction vertical \
          -width 6 -spacing 2 -set_to_set_distance 30 \
          -start_from left -start_offset 1

addStripe -nets {VSS VDD} -layer met5 -direction horizontal \
          -width 6 -spacing 2 -set_to_set_distance 30 \
          -start_from bottom -start_offset 1

#===========================================
# Rail Routing
#===========================================
echo "Routing standard cell rails..."
sroute -connect {corePin} -layerChangeRange {li1 met4} \
       -nets {VDD VSS} -allowJogging 1 -allowLayerChange 1

#===========================================
# Verification
#===========================================
echo "Verifying connectivity..."
verifyConnectivity -type special -nets {VDD VSS}

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/powerplan.enc

echo "Power planning complete!"
```

---

## MCP Commands (For Claude Code)

### Set Mode to Auto
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'
```

### Connect Global Nets
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *; globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *; globalNetConnect VDD -type net -net VDD; globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *; globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *; globalNetConnect VSS -type net -net VSS"
}'
```

### Add Power Stripes
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "addStripe -nets {VSS VDD} -layer met4 -direction vertical -width 6 -spacing 2 -set_to_set_distance 30 -start_from left -start_offset 1; addStripe -nets {VSS VDD} -layer met5 -direction horizontal -width 6 -spacing 2 -set_to_set_distance 30 -start_from bottom -start_offset 1"
}'
```

### Route Rails
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "sroute -connect {corePin} -layerChangeRange {li1 met4} -corePinTarget {none} -allowJogging 1 -crossoverViaLayerRange {li1 met4} -nets {VDD VSS} -allowLayerChange 1 -targetViaLayerRange {li1 met4}"
}'
```

### Save Checkpoint
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/powerplan.enc"
}'
```

---

## Related Skills

- `/floorplan` - Create floorplan before power planning
- `/placement` - Place cells after power grid
- `/chip-finish` - Final verification

---

## Checklist

Before power planning:
- [ ] Floorplan created
- [ ] Core area defined
- [ ] Power/ground net names confirmed

After power planning:
- [ ] All global nets connected
- [ ] Power stripes added
- [ ] Rails routed
- [ ] Connectivity verified
- [ ] Checkpoint saved
