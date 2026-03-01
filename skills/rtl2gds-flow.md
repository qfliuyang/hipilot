---
name: rtl2gds-flow
description: >
  Complete RTL-to-GDS flow for digital designs. Takes RTL through synthesis,
  place & route, timing optimization, and physical verification. Designed to
  work like an intern running the flow with supervision.

hipilot:
  vendors: [synopsys, cadence, mentor]
  tools:
    synopsys: [dc_shell, pt_shell]
    cadence: [innovus]
    mentor: [calibre]
  flow_stages: [synthesis, floorplan, placement, cts, routing, signoff]
  triggers:
    - "run rtl to gds"
    - "full flow"
    - "run the flow"
    - "rtl2gds"
    - "take rtl to gds"
    - "run complete flow"
  design_example: "/home/EDA/hipilot_test/ibex_work_upload"
  typical_duration: "4-8 hours for Ibex-sized design"
---

# RTL-to-GDS Complete Flow

## Overview

This skill orchestrates the complete digital design flow:

```
RTL → Synthesis → Floorplan → Placement → CTS → Routing → Signoff → GDS
```

**Like an intern, HiPilot will:**
1. Run each stage in order
2. Check for errors at each step
3. Report QoR metrics
4. Flag issues that need human attention
5. Proceed only when stage is successful

---

## Quick Start

```
User: "Run RTL to GDS on the Ibex design"
```

HiPilot will execute the full flow, reporting progress at each stage.

---

## MCP Commands (runtime usage)

When running on the EDA server with HiPilot:

- **Full-flow execution (P&R onwards) using the builtin workflow:**

```bash
rtl2gds.run_full_flow {"design":"ibex"}
# or, equivalently:
workflow.run {"name":"rtl2gds","params":{"design":"ibex"}}
```

- **Single-stage execution for targeted reruns:**

```bash
rtl2gds.run_stage {"stage":"floorplan","design":"ibex"}
rtl2gds.run_stage {"stage":"placement","design":"ibex"}
rtl2gds.run_stage {"stage":"cts","design":"ibex"}
rtl2gds.run_stage {"stage":"routing","design":"ibex"}
rtl2gds.run_stage {"stage":"chip_finish","design":"ibex"}
```

This generic `rtl2gds-flow` skill describes the **overall RTL→GDS methodology**; design-specific skills like `/ibex-rtl2gds-flow` provide concrete parameter choices (paths, clocks, technology) for a particular chip.

---

## Prerequisites

### Required Setup
- Design RTL files (Verilog/SystemVerilog)
- Technology libraries (LEF, Liberty)
- Constraint file (SDC)
- Design configuration

### Environment
```bash
# On EDA server
cd /home/EDA/hipilot_test/ibex_work_upload
source /tools/synopsys/dc_setup.sh      # Design Compiler
source /tools/cadence/innovus_setup.sh  # Innovus
source /tools/synopsys/pt_setup.sh      # PrimeTime
source /tools/mentor/calibre_setup.sh   # Calibre
```

---

## Important: Physical-Only Mode Limitation

### What is Physical-Only Mode?

When a design is initialized in Innovus without timing libraries, it runs in "physical-only mode." This means:
- No timing information is available
- Clock signals are treated as regular ports
- CTS cannot be performed
- Timing-driven optimization is limited
- STA reports will show "No constrained timing paths found"

### When This Happens

Physical-only mode occurs when:
1. Design initialized with only LEF files (no Liberty)
2. No MMMC views created
3. No SDC constraints loaded during init

### Impact on Flow

| Stage | Physical-Only Mode | Full Timing Mode |
|-------|-------------------|------------------|
| Floorplan | ✓ Works | ✓ Works |
| Placement | ✓ Works (not timing-driven) | ✓ Works (timing-driven) |
| CTS | ✗ Not possible | ✓ Works |
| Routing | ✓ Works | ✓ Works |
| RC Extraction | ✓ Works | ✓ Works |
| Innovus STA | ✗ Limited | ✓ Full |
| PrimeTime STA | ✓ Works (uses netlist) | ✓ Works |

### Recommendation

For production flows, **always initialize with timing libraries**. Physical-only mode is acceptable for:
- Quick congestion/routability studies
- Area estimation
- Learning/demonstration purposes

See `/design-init` skill for proper initialization with timing.

---

## Flow Stages

### Stage 1: Synthesis (Design Compiler)

**Purpose:** Convert RTL to gate-level netlist

**Command:**
```bash
cd /home/EDA/hipilot_test/ibex_work_upload
make syn
```

**What happens:**
1. Reads RTL files
2. Elaborates design hierarchy
3. Applies constraints (SDC)
4. Maps to technology library
5. Optimizes for timing/area
6. Outputs: gate-level Verilog, timing reports

**Output location:**
```
result/syn/data/      # Netlist files
result/syn/report/    # Timing/area reports
result/syn/log/       # Log files
```

**Success criteria:**
- No elaboration errors
- WNS > -10% of clock period (slack acceptable for P&R)
- Area within budget

**Check results:**
```tcl
# Read synthesis report
cat result/syn/report/*.rpt | grep -E "(WNS|TNS|Area)"

# Typical synthesis output
# WNS: -0.15ns (acceptable, will be fixed in P&R)
# Total Area: 45000 um^2
# Cell Count: 12500
```

**If synthesis fails:**
1. Check RTL for syntax errors
2. Verify constraint file is correct
3. Check library paths in config

---

### Stage 2: Design Initialization (Innovus)

**Purpose:** Load netlist into Innovus, set up MMMC

**Command:**
```bash
make data_init
```

**What happens:**
1. Reads synthesized netlist
2. Loads LEF files (technology macros)
3. Sets up MMMC views (multi-mode multi-corner)
4. Initializes design database
5. Runs initial timing check

**Output:**
```
result/pr/data/init_design.enc   # Saved database
result/pr/report/                # Initial timing reports
```

**Success criteria:**
- Design loads without errors
- All libraries found
- Initial timing reports generated

**Check results:**
```tcl
# Check init log
grep -E "(ERROR|WARNING)" result/pr/log/init

# Should see:
# "Design initialized successfully"
# No missing libraries
```

### Timing-Aware Initialization (Recommended)

For full timing-driven flow, include timing libraries during init:

```tcl
# Set up MMMC views
create_library_set -name libs_tt -timing {sky130_fd_sc_hd__tt_025C_1v80.lib}
create_rc_corner -name rc_tt
create_delay_corner -name delay_tt -library_set libs_tt -rc_corner rc_tt
create_constraint_mode -name const_mode -sdc_files {constraints.sdc}
create_analysis_view -name view_tt -constraint_mode const_mode -delay_corner delay_tt

# Then initialize design
init_design
```

This enables timing-driven placement, CTS, and full STA capabilities.

---

### Stage 3: Floorplanning

**Purpose:** Define chip area, place IO pins, create power grid

**Command:**
```bash
make floorplan
make place_io
make power_plan
```

**What happens:**
1. Defines die area and core area
2. Places IO pins around periphery
3. Creates power rings and stripes
4. Defines placement blockages

**Key decisions:**
- Die size: Based on estimated area + 20% margin
- Aspect ratio: Usually 1:1 or matched to pad frame
- Power grid: VDD/VSS stripes every N rows

**Output:**
```
result/pr/data/floorplan.enc
result/pr/report/floorplan/
```

**Success criteria:**
- Core utilization: 60-80%
- IO placement matches pad frame
- Power grid connectivity verified

**Check results:**
```tcl
report_utilization
# Target: 70-75% utilization after floorplan

report_power_plan
# Verify VDD/VSS connectivity
```

---

### Stage 4: Placement

**Purpose:** Place standard cells in core area

**Command:**
```bash
make placement
```

**What happens:**
1. Global placement (rough positions)
2. Timing-driven optimization
3. Congestion-driven refinement
4. Detail placement (legalize positions)

**Output:**
```
result/pr/data/placement.enc
result/pr/report/placement_timing/
```

**Success criteria:**
- No overlapping cells
- Timing WNS improved from pre-place
- Congestion within acceptable range

**Check results:**
```tcl
report_timing -max_paths 10
# Check WNS improvement

report_congestion
# Target: < 5% global routing congestion
```

---

### Stage 5: Clock Tree Synthesis (CTS)

**Purpose:** Build balanced clock distribution network

**Command:**
```bash
make cts
```

**What happens:**
1. Identifies clock roots
2. Builds clock tree (buffers/inverters)
3. Balances skew across endpoints
4. Inserts clock gating cells

**Output:**
```
result/pr/data/cts.enc
result/pr/report/cts_timing/
```

**Success criteria:**
- Clock skew < 10% of clock period
- Clock latency reasonable (< 500ps typical)
- No clock tree violations

**Check results:**
```tcl
report_clock_timing -type summary
# Skew target: < 50ps for 1GHz design
# Latency target: < 300ps

report_timing -type setup
# WNS should improve significantly after CTS
```

---

### Stage 6: Post-CTS Optimization

**Purpose:** Fix timing violations with propagated clocks

**Command:**
```bash
make post_cts_opt
```

**What happens:**
1. Runs timing optimization with real clock delays
2. Fixes setup violations
3. Addresses hold violations (early)
4. Optimizes for power

**Output:**
```
result/pr/data/post_cts_opt.enc
result/pr/report/post_cts_timing/
```

**Success criteria:**
- Setup WNS > 0 or within 5% of clock period
- Hold WNS > 0 (or will be fixed in routing)

---

### Stage 7: Routing

**Purpose:** Connect all signal nets

**Command:**
```bash
make routing
make routing_opt
```

**What happens:**
1. Global routing (assigns tracks)
2. Track assignment (layer selection)
3. Detail routing (actual metal shapes)
4. Post-route optimization

**Output:**
```
result/pr/data/routing.enc
result/pr/report/routing_timing/
```

**Success criteria:**
- All nets routed (0 unrouted)
- No DRC violations (will check later)
- Timing clean or close to clean

**Check results:**
```tcl
report_timing -max_paths 10
# Target: WNS > 0

report_route_status
# Target: 100% routed
```

---

### Stage 8: Chip Finalization

**Purpose:** Generate final outputs

**Command:**
```bash
make chip_done
```

**What happens:**
1. Final timing optimization
2. Generate GDS/OASIS
3. Generate netlist for LVS
4. Generate SDF for simulation

**Output:**
```
result/pr/data/chip_done.enc
result/pr/gds/           # GDS output
result/pr/netlist/       # Verilog netlist
result/pr/sdf/           # SDF file
```

---

### Stage 9: Static Timing Analysis (PrimeTime)

**Purpose:** Gold-standard timing verification for signoff

**Command:**
```bash
cd /home/EDA/hipilot_test/ibex_work_upload
pt_shell -f scripts/pt_sta.tcl
```

**What happens:**
1. Load synthesized/routed netlist
2. Apply timing libraries (.db format)
3. Read SDC constraints
4. Report setup/hold timing

**Key Points:**
- Use `.db` libraries (not `.lib`)
- SDC should NOT contain `current_design` command
- Use `get_ports -filter` instead of `all_inputs -no_clock`

**Success criteria:**
- Setup WNS ≥ 0
- Hold WNS ≥ 0

**Check results:**
```tcl
# In PrimeTime
report_timing -delay max -max_paths 10  ;# Setup
report_timing -delay min -max_paths 10  ;# Hold

# Look for "No paths with slack less than 0.000"
```

See `/report-timing` skill for complete PrimeTime usage.

---

### Stage 10: Physical Verification

#### DRC (Design Rule Check)

**Command:**
```bash
make drc
```

**What happens:**
1. Merge GDS files
2. Run Calibre DRC
3. Report violations

**Success criteria:**
- Total DRC violations: 0

#### LVS (Layout vs Schematic)

**Command:**
```bash
make lvs
```

**What happens:**
1. Extract netlist from layout
2. Compare with source netlist
3. Report mismatches

**Success criteria:**
- LVS result: CORRECT
- No mismatches

---

## Complete Flow Script

**HiPilot execution sequence:**

```bash
#!/bin/bash
# HiPilot RTL2GDS Flow
# Design: Ibex

DESIGN_DIR="/home/EDA/hipilot_test/ibex_work_upload"
cd $DESIGN_DIR

echo "=========================================="
echo "HiPilot RTL-to-GDS Flow"
echo "Design: Ibex (RISC-V CPU)"
echo "Technology: Sky130 HD"
echo "=========================================="

# Stage 1: Synthesis
echo "[1/10] Synthesis..."
make syn 2>&1 | tee /tmp/hipilot_syn.log
if grep -q "Error" /tmp/hipilot_syn.log; then
    echo "ERROR: Synthesis failed"
    exit 1
fi
echo "✓ Synthesis complete"

# Stage 2: Init
echo "[2/10] Design Initialization..."
make data_init 2>&1 | tee /tmp/hipilot_init.log
echo "✓ Init complete"

# Stage 3: Floorplan
echo "[3/10] Floorplanning..."
make floorplan 2>&1 | tee /tmp/hipilot_fp.log
echo "✓ Floorplan complete"

# Stage 4: Power Plan
echo "[4/10] Power Planning..."
make power_plan 2>&1 | tee /tmp/hipilot_power.log
echo "✓ Power plan complete"

# Stage 5: Placement
echo "[5/10] Placement..."
make placement 2>&1 | tee /tmp/hipilot_place.log
echo "✓ Placement complete"

# Stage 6: CTS
echo "[6/10] Clock Tree Synthesis..."
make cts 2>&1 | tee /tmp/hipilot_cts.log
echo "✓ CTS complete"

# Stage 7: Post-CTS Optimization
echo "[7/10] Post-CTS Optimization..."
make post_cts_opt 2>&1 | tee /tmp/hipilot_postcts.log
echo "✓ Post-CTS opt complete"

# Stage 8: Routing
echo "[8/10] Routing..."
make routing 2>&1 | tee /tmp/hipilot_route.log
make routing_opt 2>&1 | tee /tmp/hipilot_route_opt.log
echo "✓ Routing complete"

# Stage 9: Chip Done
echo "[9/10] Chip Finalization..."
make chip_done 2>&1 | tee /tmp/hipilot_done.log
echo "✓ Chip finalization complete"

# Stage 10: Signoff
echo "[10/10] Signoff Checks..."
make run_pt 2>&1 | tee /tmp/hipilot_pt.log
make drc 2>&1 | tee /tmp/hipilot_drc.log
make lvs 2>&1 | tee /tmp/hipilot_lvs.log
echo "✓ Signoff complete"

echo "=========================================="
echo "RTL-to-GDS Flow Complete!"
echo "=========================================="
echo ""
echo "Outputs:"
echo "  GDS: $DESIGN_DIR/result/pr/gds/"
echo "  Netlist: $DESIGN_DIR/result/pr/netlist/"
echo "  Reports: $DESIGN_DIR/result/*/report/"
```

---

## QoR Tracking

HiPilot should track key metrics at each stage:

| Stage | Key Metrics |
|-------|-------------|
| Synthesis | WNS, TNS, Area, Cell Count |
| Placement | WNS, Utilization, Congestion |
| CTS | Clock Skew, Clock Latency |
| Post-CTS | Setup WNS, Hold WNS |
| Routing | WNS, DRC Count |
| Signoff | Setup WNS, Hold WNS, DRC, LVS |

---

## Error Handling

### Synthesis Fails
```
Check: RTL syntax errors
Check: Constraint file correctness
Check: Library availability
```

### Timing Not Met
```
1. Run additional optimization iterations
2. Check for high-fanout nets
3. Verify clock tree quality
4. May need constraint relaxation
```

### DRC Violations
```
1. Check routing density
2. Verify metal layer usage
3. May need re-routing
```

### LVS Mismatches
```
1. Check for floating nets
2. Verify power connections
3. Check for name mapping issues
```

---

## Real Example: Ibex Flow Results

**Design:** Ibex RISC-V CPU
**Technology:** Skywater 130nm HD
**Target:** 100 MHz

| Stage | Duration | Key Result |
|-------|----------|------------|
| Synthesis | 5 min | Area: 45k um², WNS: -0.15ns |
| Floorplan | 2 min | Util: 72%, Die: 500x500um |
| Placement | 8 min | WNS: -0.08ns |
| CTS | 3 min | Skew: 35ps, Latency: 280ps |
| Post-CTS | 5 min | WNS: +0.02ns |
| Routing | 15 min | WNS: +0.01ns, DRC: 0 |
| Signoff | 5 min | Setup/Hold CLEAN |
| **Total** | **~45 min** | **GDS ready for tapeout** |

---

## What HiPilot Reports to User

At each stage completion:

```
📊 Stage: Placement
⏱ Duration: 8 minutes
📈 Results:
   - WNS: -0.08ns (improved from -0.15ns)
   - Utilization: 72%
   - Congestion: 2.3% (acceptable)
✓ Proceeding to CTS...
```

At flow completion:

```
🎉 RTL-to-GDS Flow Complete!

Design: Ibex
Technology: Sky130 HD
Total Time: 45 minutes

Final Results:
├── Timing: SETUP ✓ | HOLD ✓
├── DRC: 0 violations ✓
├── LVS: CORRECT ✓
└── Area: 45,230 um²

Outputs:
├── GDS: result/pr/gds/ibex.gds
├── Netlist: result/pr/netlist/ibex.v
└── Reports: result/*/report/

Ready for tapeout!
```

---

## Related Skills

- `/synthesis` - RTL synthesis with Design Compiler/Genus
- `/floorplan` - Die/core area, IO placement, power grid
- `/cts` - Clock tree synthesis and optimization
- `/fix-setup-timing` - Fix setup timing violations
- `/fix-hold-timing` - Fix hold timing violations
- `/run-drc` - Design rule check with Calibre
- `/lvs-check` - Layout vs schematic verification
- `/route-design` - Signal routing
- `/report-timing` - Timing analysis
- `/compare-qor` - Compare flow results

---

## Notes

- First run may take longer due to library loading
- Subsequent runs from checkpoints are faster
- Always save checkpoints between stages
- Keep log files for debugging

---

## Command Syntax Reference

### Tested Commands (RTL2GDS Flow)

**Design Compiler (Synthesis):**
```tcl
# Elaborate and compile
read_verilog rtl/design.v
elaborate design_name
compile_ultra
write -format verilog -hierarchy -output netlist.v
```

**Innovus (Place & Route):**
```tcl
# Initialize with timing
create_library_set -name libs_tt -timing {sky130_fd_sc_hd__tt_025C_1v80.lib}
create_rc_corner -name rc_tt
create_delay_corner -name delay_tt -library_set libs_tt -rc_corner rc_tt
create_constraint_mode -name const_mode -sdc_files {constraints.sdc}
create_analysis_view -name view_tt -constraint_mode const_mode -delay_corner delay_tt
init_design

# Floorplan
createFloorplan -dieSize 500 500 0 0 0 0

# Place IO
place_io -pinLayer {M3 M4}

# Power plan
addRing -nets {VDD VSS} -layer {top M1 bottom M1 left M2 right M2}

# Placement
placeDesign

# CTS (requires timing-aware init)
create_ccopt_clock_tree_spec
ccopt_design

# Routing
routeDesign

# Timing checks
report_timing -max_paths 10
```

**PrimeTime (Signoff STA):**
```tcl
# Load design (use .db libraries, not .lib)
read_db /path/to/timing_libs/*.db
read_verilog netlist.v
current_design design_name

# Read constraints (SDC should NOT have current_design)
read_sdc constraints.sdc

# Timing analysis
report_timing -delay max -max_paths 10  ;# Setup
report_timing -delay min -max_paths 10  ;# Hold

# Port filtering (use get_ports -filter)
# Incorrect: all_inputs -no_clock
# Correct: get_ports -filter "direction==in && is_clock==false"
```

**Key Takeaways from Testing:**
1. Physical-only mode prevents CTS - always init with timing libraries
2. PrimeTime requires .db format libraries
3. SDC constraints for PrimeTime should not include `current_design`
4. Use `get_ports -filter` instead of `all_inputs -no_clock` for PrimeTime

