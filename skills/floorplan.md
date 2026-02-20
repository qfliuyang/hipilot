---
name: floorplan
description: >
  Complete floorplanning workflow for digital designs. Covers die/core area
  definition, IO placement, macro placement, power grid creation, and
  placement blockages. Designed for Innovus and ICC2.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell]
  flow_stages: [floorplan]
  triggers:
    - "floorplan"
    - "create floorplan"
    - "place io"
    - "power grid"
    - "power planning"
    - "die area"
    - "core utilization"
  qor_metrics: [Utilization, Core_Area, Die_Area, Row_Utilization]
  risk_level: moderate
  typical_duration: "2-10 minutes depending on design complexity"
---

# Floorplanning

## Quick Reference

```
User: "create floorplan"
```

HiPilot will:
1. Calculate die size based on area estimate
2. Create floorplan with target utilization
3. Place IO pins (if specified)
4. Create power grid
5. Report utilization

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| New design | Create floorplan from scratch |
| Area change | Resize floorplan |
| IO assignment | Place/rearrange IO pins |
| Power optimization | Redesign power grid |
| Congestion issues | Adjust floorplan density |

**Prerequisites:**
- Synthesized netlist loaded
- LEF/tech library loaded
- Target utilization known
- IO list (if applicable)

---

## Floorplan Workflow

### Step 1: Create Basic Floorplan

**Innovus:**
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

**ICC2:**
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

### Step 2: Place IO Pins

**Innovus:**
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

**ICC2:**
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

### Step 3: Place Macros (if any)

**Innovus:**
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

**ICC2:**
```tcl
# Set macro location
set_macro_location -macro ram_inst -coordinates {100 100} -orientation R0

# With keepout margin
set_keepout_margin -type hard -outer {10 10 10 10} ram_inst

# Auto-placement
place_macros -all
```

### Step 4: Create Power Grid

**Innovus:**
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

**ICC2:**
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

### Step 5: Add Placement Blockages

**Innovus:**
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

**ICC2:**
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

---

## Floorplan Analysis

### Check Utilization

**Innovus:**
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

**ICC2:**
```tcl
# Report utilization
report_utilization

# With details
report_utilization -hierarchical
```

### Check IO Placement

**Innovus:**
```tcl
# List all pins
report_pins -layer M4

# Check for overlaps
check_pin_spacing
```

### Check Power Grid

**Innovus:**
```tcl
# Verify connectivity
verifyConnectivity -nets {VDD VSS} -type regular

# Check for shorts
verify_drc -nets {VDD VSS}
```

---

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

---

## Floorplan Guidelines

### Utilization Targets

| Design Type | Target Util | Max Util |
|-------------|-------------|----------|
| High-performance | 60-70% | 75% |
| Standard | 70-75% | 80% |
| Density-focused | 75-80% | 85% |
| Congested design | 50-60% | 65% |

### Aspect Ratio Guidelines

| Aspect Ratio | Use Case |
|--------------|----------|
| 1:1 | General purpose, balanced |
| 2:1 | Data path oriented |
| 1:2 | Memory-like structures |
| Custom | Match pad frame |

### Power Grid Design

| Layer | Purpose | Typical Width |
|-------|---------|---------------|
| M1 | Standard cell rails | 0.1-0.2 um |
| M2-M4 | Local distribution | 0.5-1.0 um |
| M5-M7 | Intermediate mesh | 1.0-2.0 um |
| M8-M9 | Top-level mesh | 2.0-5.0 um |
| M10+ | Ring/bumps | 5.0-10.0 um |

---

## Common Issues

### Issue 1: Utilization Too High

**Symptoms:** >80% utilization after floorplan

**Fix:**
```tcl
# Increase die size
set core_area [expr $cell_area / 0.7]  ;# Target 70%
set side [expr sqrt($core_area)]
create_floorplan -core_utilization 0.7 -core_aspect_ratio 1.0
```

### Issue 2: Congestion Near Macros

**Symptoms:** Local congestion hotspots

**Fix:**
```tcl
# Add macro halo
addHaloToBlock -allBlocks 15 15 15 15

# Add partial blockage near macros
createPlaceBlockage -type partial -density 0.5 \
                    -box {100 100 200 200}
```

### Issue 3: IO Spacing Violations

**Symptoms:** DRC violations on pins

**Fix:**
```tcl
# Increase minimum pin spacing
setPinAssignMode -minPinDistance 2.0

# Re-spread pins
editPin -layer M4 -side TOP -spreadType side \
        -pin [all_inputs] -spreadDirection clockwise
```

### Issue 4: Power Grid Shorts

**Symptoms:** VDD-VSS shorts

**Fix:**
```tcl
# Check and fix
verify_drc -nets {VDD VSS}

# Increase spacing
addStripe -spacing 1.0 -width 1.0 ...  ;# Doubled spacing
```

---

## Complete Script Template

**Innovus:**
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
create_floorplan -core_utilization $TARGET_UTIL \
                 -core_aspect_ratio $ASPECT_RATIO \
                 -core_margins_by die \
                 -core_to_left $MARGIN \
                 -core_to_right $MARGIN \
                 -core_to_top $MARGIN \
                 -core_to_bottom $MARGIN

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

---

## Makefile Integration

```makefile
# Makefile - Floorplan targets

floorplan:
	innovus -files scripts/floorplan.tcl -log logs/floorplan.log

place_io:
	innovus -files scripts/place_io.tcl

power_plan:
	innovus -files scripts/power_plan.tcl

floorplan_report:
	cat reports/floorplan_util.rpt
```

---

## Real Example: Ibex Floorplan

**Design:** Ibex RISC-V CPU
**Technology:** Skywater 130nm HD

```bash
cd /home/EDA/hipilot_test/ibex_work_upload
make floorplan
make place_io
make power_plan
```

**Expected Results:**
```
Floorplan Summary:
  Die area: 500 x 500 um
  Core area: 480 x 480 um
  Core utilization: 72%

IO Pins:
  Total pins: 156
  Inputs: 128 (left side)
  Outputs: 26 (right side)
  Clock: 1 (top center)
  Reset: 1 (top center)

Power Grid:
  VDD ring: M8/M9, width 1.0um
  VSS ring: M8/M9, width 1.0um
  M8 stripes: horizontal, 50um pitch
  M9 stripes: vertical, 50um pitch

Time: 2 minutes
```

---

## Related Skills

- `/synthesis` - Generate netlist for floorplan
- `/placement` - Place cells after floorplan
- `/cts` - Build clock tree
- `/save-design` - Save floorplan checkpoint

---

## Checklist

Before floorplan:
- [ ] Synthesized netlist loaded
- [ ] LEF/tech library loaded
- [ ] Target utilization determined
- [ ] IO constraints file ready

After floorplan:
- [ ] Utilization within target (70-75%)
- [ ] All pins placed
- [ ] Power grid connected
- [ ] No connectivity violations
- [ ] Save checkpoint
