# Power Planning Tcl Patterns

Common Tcl snippets for power planning stage.

## Global Net Connections

### Innovus

```tcl
# Connect power pins to global nets
globalNetConnect VDD -type pgpin -pin {VPB VPWR} -inst *
globalNetConnect VDD -type tiehi -pin {VPWR VPB} -inst *
globalNetConnect VDD -type net -net VDD

globalNetConnect VSS -type pgpin -pin {VGND VNB} -inst *
globalNetConnect VSS -type tielo -pin {VGND VNB} -inst *
globalNetConnect VSS -type net -net VSS
```

### ICC2

```tcl
# Connect power nets
connect_pg_net -net VDD -automatic
connect_pg_net -net VSS -automatic
```

## Power Rings

### Innovus

```tcl
# Create power ring around core
addRing -spacing 0.5 -width 1.0 \
        -layer {top met5 bottom met5 left met4 right met4} \
        -jog_distance 0.1 -offset 0.5 \
        -nets {VSS VDD}
```

## Power Stripes

### Innovus (Met4 - Vertical)

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

### Innovus (Met5 - Horizontal)

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

### ICC2

```tcl
# Create power mesh
create_pg_mesh -layers {M4 M5} \
               -widths {6 6} \
               -pitches {30 30} \
               -offsets {1 1} \
               -nets {VDD VSS}
```

## Rail Routing

### Innovus

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

### ICC2

```tcl
# Connect standard cells to power
create_pg_std_cell_conn_pattern -layers M1 \
                                -rail_width 0.1 \
                                -nets {VDD VSS}
connect_pg -net VDD -all_blocks
connect_pg -net VSS -all_blocks
```

## Skywater 130nm Example

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

## Verification

### Check Connectivity

```tcl
# Verify all cells connected to power
verifyConnectivity -type special -nets {VDD VSS} -error 1000

# Check for floating pins
verifyConnectivity -type regular -nets {VDD VSS}
```

### IR Drop Analysis

```tcl
# Run static IR drop analysis
analyze_design -power_grid
report_power_grid -ir_drop
```

## Complete Script Template

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
