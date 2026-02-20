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

**Purpose:** Signoff-quality timing verification

**Command:**
```bash
make run_pt
```

**What happens:**
1. Load design in PrimeTime
2. Apply signoff corners
3. Report setup/hold timing
4. Generate signoff reports

**Output:**
```
result/sta/report/
```

**Success criteria:**
- Setup WNS > 0 (all corners)
- Hold WNS > 0 (all corners)
- No timing violations

**Check results:**
```tcl
# In PrimeTime report
grep -E "(slack|WNS|TNS)" result/sta/report/*.rpt

# Target:
# Setup WNS: > 0 ps
# Hold WNS: > 0 ps
```

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
