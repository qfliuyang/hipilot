# Floorplan Tcl Patterns

Common Tcl snippets for floorplanning stage.

## Create Basic Floorplan

### Innovus v20.10+ (Recommended)

```tcl
# Syntax: floorPlan -site <site> -r <aspect_ratio> <util> <left> <bottom> <right> <top>
floorPlan -site unithd -r 1.0 0.70 10 10 10 10

# Result:
# - Aspect ratio 1.0 (square)
# - 70% utilization
# - 10um margins on all sides
```

### Innovus create_floorplan (Legacy)

```tcl
# Method 1: Specify dimensions
create_floorplan -core_utilization 0.7 \
                 -core_aspect_ratio 1.0 \
                 -core_margins_by die \
                 -core_to_left 10 \
                 -core_to_right 10 \
                 -core_to_top 10 \
                 -core_to_bottom 10

# Method 2: Specify exact size
create_floorplan -core_utilization 0.7 \
                 -core_aspect_ratio 1.0 \
                 -site core_site \
                 -flip_first_row true

# Method 3: From DEF
loadIoFile io/io_constraints.io
defIn floorplan/floorplan.def
```

### ICC2

```tcl
# Initialize floorplan
initialize_floorplan -core_utilization 0.7 \
                     -core_aspect_ratio 1.0 \
                     -core_margins {10 10 10 10}

# Or specify exact dimensions
initialize_floorplan -die_size {500 500 10 10 10 10}

# From template
initialize_floorplan -template floorplan_template.fp
```

## Place IO Pins

### Innovus

```tcl
# Load IO constraints file
loadIoFile io/io_constraints.io

# Or place pins manually
setPinAssignMode -pinEditInBatch true
editPin -pin clk_i -layer M4 -side TOP -assign 250 500
editPin -pin rst_ni -layer M4 -side TOP -assign 260 500

# Place all inputs/outputs on specific sides
editPin -layer M4 -side TOP -spreadType side \
        -pin [get_ports -filter "direction == in" -q] \
        -spreadDirection clockwise -offset 10
editPin -layer M4 -side BOTTOM -spreadType side \
        -pin [get_ports -filter "direction == out" -q] \
        -spreadDirection clockwise -offset 10
```

### ICC2

```tcl
# Place pins on boundaries
place_pins -self \
           -ports [get_ports -filter "direction == in"] \
           -layer M4 \
           -side top

place_pins -self \
           -ports [get_ports -filter "direction == out"] \
           -layer M4 \
           -side bottom

# With specific locations
set_pin_physical_constraint -pins clk_i -layers M4 -offset {250 500}
```

## Place Macros

### Innovus

```tcl
# List macros
foreach macro [dbGet top.insts.cell.name *RAM*] {
    puts "Macro: $macro"
}

# Place macro at specific location
placeInstance ram_inst 100 100 -orient R0

# With halo (keepout)
addHaloToBlock -allBlocks 10 10 10 10

# Auto-place macros
placeDesign -concurrentMacros
```

### ICC2

```tcl
# Set macro location
set_macro_location -macro ram_inst -coordinates {100 100} -orientation R0

# With keepout margin
set_keepout_margin -type hard -outer {10 10 10 10} ram_inst

# Auto-placement
place_macros -all
```

## Create Power Grid

### Innovus

```tcl
# Create power rings
addRing -spacing 0.5 -width 1.0 \
        -layer {top M9 bottom M9 left M8 right M8} \
        -jog_distance 0.1 -offset 0.5 \
        -nets {VDD VSS}

# Create power stripes
addStripe -spacing 0.5 -width 1.0 \
          -layer M8 \
          -nets {VDD VSS} \
          -direction horizontal \
          -start 50 -stop 450 \
          -set_to_set_distance 50

addStripe -spacing 0.5 -width 1.0 \
          -layer M9 \
          -nets {VDD VSS} \
          -direction vertical \
          -start 50 -stop 450 \
          -set_to_set_distance 50

# Connect standard cell rails
sroute -connect {corePin} \
       -layerChangeRange {M1 M2} \
       -corePinLayer M1 \
       -blockPinTarget {nearestTarget} \
       -allowJogging 1 \
       -allowLayerChange 1 \
       -nets {VDD VSS}
```

### ICC2

```tcl
# Create power mesh
create_pg_mesh -layers {M8 M9} \
               -widths {1.0 1.0} \
               -pitches {50 50} \
               -offsets {25 25} \
               -nets {VDD VSS}

# Create power rings
create_pg_ring -nets {VDD VSS} \
               -layers {M8 M9} \
               -widths {1.0 1.0} \
               -spacings {0.5 0.5}

# Connect standard cell rails
create_pg_std_cell_conn_pattern -layers M1 \
                                -rail_width 0.1 \
                                -nets {VDD VSS}

connect_pg -net VDD -all_blocks
connect_pg -net VSS -all_blocks
```

## Add Placement Blockages

### Innovus

```tcl
# Full blockage (no placement)
createPlaceBlockage -type hard \
                    -box {0 0 500 10} \
                    -name bottom_blockage

# Partial blockage (density limit)
createPlaceBlockage -type partial -density 0.3 \
                    -box {100 100 200 200}

# Routing blockage
createRouteBlk -box {50 50 100 100} \
               -layer {M4 M5 M6}
```

### ICC2

```tcl
# Placement blockage
create_placement_blockage -boundary {{0 0} {500 10}} \
                          -type hard \
                          -name bottom_blockage

# Partial density blockage
create_placement_blockage -boundary {{100 100} {200 200}} \
                          -type partial \
                          -density 30

# Routing blockage
create_routing_blockage -boundary {{50 50} {100 100}} \
                        -layers {M4 M5 M6}
```

## Floorplan Analysis

### Check Utilization

```tcl
# Report utilization
report_utilization

# Detailed breakdown
report_utilization -area_type all -site core_site

# Typical output:
# Total core area: 250000 um²
# Total cell area: 175000 um²
# Core utilization: 70%
```

### Check IO Placement

```tcl
# List all pins
report_pins -layer M4

# Check for overlaps
check_pin_spacing
```

### Check Power Grid

```tcl
# Verify connectivity
verifyConnectivity -nets {VDD VSS} -type regular

# Check for shorts
verify_drc -nets {VDD VSS}
```

## Common Floorplan Patterns

### Pattern A: Pin-Centric (Data Path)

```tcl
# Inputs on left, outputs on right
editPin -layer M4 -side LEFT -spreadType side \
        -pin [get_ports -filter "direction == in" -q]
editPin -layer M4 -side RIGHT -spreadType side \
        -pin [get_ports -filter "direction == out" -q]
```

### Pattern B: Block-Based (SoC)

```tcl
# Define regions for each block
createRegion -name cpu_region -box {0 0 250 250}
createRegion -name mem_region -box {250 0 500 250}
createRegion -name periph_region -box {0 250 500 500}

# Assign cells to regions
addInstToRegion cpu_region [get_cells -hier -filter "name =~ cpu_*"]
```

### Pattern C: Mesh-Based Power

```tcl
# Multi-layer power mesh
# M8: horizontal stripes
addStripe -layer M8 -direction horizontal \
          -nets {VDD VSS} -width 2.0 -spacing 1.0 \
          -set_to_set_distance 100

# M9: vertical stripes
addStripe -layer M9 -direction vertical \
          -nets {VDD VSS} -width 2.0 -spacing 1.0 \
          -set_to_set_distance 100

# M10: top-level ring
addRing -layer {top M10 bottom M10 left M10 right M10} \
        -nets {VDD VSS} -width 5.0 -spacing 2.0
```

## Complete Script Template

```tcl
#!/usr/bin/tclsh
# floorplan.tcl - Complete floorplan script

#===========================================
# Configuration
#===========================================
set TARGET_UTIL 0.7
set ASPECT_RATIO 1.0
set MARGIN 10

#===========================================
# Create Floorplan
#===========================================
echo "Creating floorplan..."
floorPlan -site unithd -r $ASPECT_RATIO $TARGET_UTIL $MARGIN $MARGIN $MARGIN $MARGIN

#===========================================
# Place IO Pins
#===========================================
echo "Placing IO pins..."
loadIoFile io/io_constraints.io

#===========================================
# Power Grid
#===========================================
echo "Creating power grid..."

# Ring
addRing -spacing 0.5 -width 1.0 \
        -layer {top M9 bottom M9 left M8 right M8} \
        -nets {VDD VSS}

# Stripes
addStripe -spacing 0.5 -width 1.0 \
          -layer M8 -direction horizontal \
          -nets {VDD VSS} \
          -set_to_set_distance 50

addStripe -spacing 0.5 -width 1.0 \
          -layer M9 -direction vertical \
          -nets {VDD VSS} \
          -set_to_set_distance 50

# Connect rails
sroute -connect {corePin} -layerChangeRange {M1 M2} \
       -nets {VDD VSS}

#===========================================
# Reports
#===========================================
echo "Generating reports..."
report_utilization > reports/floorplan_util.rpt
verifyConnectivity -nets {VDD VSS} > reports/power_connectivity.rpt

echo "Floorplan complete!"
```
