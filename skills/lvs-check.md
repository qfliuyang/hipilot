---
name: lvs-check
description: >
  Layout vs Schematic (LVS) verification for digital and mixed-signal designs.
  Covers Calibre LVS setup, debugging techniques, common mismatch patterns,
  and resolution strategies. Critical for tapeout signoff.

hipilot:
  vendors: [mentor, cadence, synopsys]
  tools:
    mentor: [calibre]
    cadence: [pvs]
    synopsys: [hercules]
  flow_stages: [signoff]
  triggers:
    - "lvs"
    - "run lvs"
    - "lvs check"
    - "layout vs schematic"
    - "verify connectivity"
    - "lvs debug"
  qor_metrics: [LVS_Result, Mismatches, Shorts, Opens]
  risk_level: safe
  typical_duration: "5-30 minutes depending on design size"
---

# LVS (Layout vs Schematic) Check

## Quick Reference

```
User: "run LVS"
```

HiPilot will:
1. Export netlist from layout (GDS)
2. Extract devices and connectivity
3. Compare with source netlist
4. Report CORRECT or mismatches
5. Help debug if issues found

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| Signoff | Final LVS before tapeout |
| Post-ECO | Verify ECO changes |
| Power route | Check power connectivity |
| Custom block | Verify custom circuit |
| Debugging | Find root cause of mismatch |

**Prerequisites:**
- Routed GDS/OASIS
- Source netlist (Verilog/SPICE)
- LVS rule deck (foundry provided)
- Calibre (or PVS/Hercules) installed

---

## LVS Fundamentals

### What LVS Checks

```
Source Netlist (Schematic)    Layout (GDS)
          │                        │
          ▼                        ▼
    Extract Topology    ←→    Extract Geometry
          │                        │
          ▼                        ▼
    Normalize Netlist    ←→    Extract Devices
          │                        │
          └────────┬───────────────┘
                   ▼
              COMPARE
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
      CORRECT   SHORTS    OPENS
```

### LVS Results

| Result | Meaning | Action |
|--------|---------|--------|
| **CORRECT** | Layout matches schematic | Proceed to tapeout |
| **INCORRECT** | Mismatches found | Debug and fix |
| **SHORTS** | Nets connected that shouldn't be | Fix routing |
| **OPENS** | Nets not connected that should be | Fix routing |

---

## LVS Workflow

### Step 1: Prepare Inputs

**Required files:**
```
design/
├── gds/design.gds         # Layout
├── netlist/design.v       # Source netlist
└── rules/lvs_runset       # LVS rules
```

**Prepare source netlist:**
```tcl
# In Innovus - export netlist for LVS
streamOut gds/design.gds -mapFile stream.map -units 1000

# Export netlist (no power/ground for LVS)
globalNetConnect VDD -type pgpin -pin VDD -inst *
globalNetConnect VSS -type pgpin -pin VSS -inst *
saveNetlist netlist/design.lvs.v -excludePGNet
```

### Step 2: Create LVS Runset

**Calibre runset (lvs_runset):**
```tcl
# Source layout
LAYOUT PATH "gds/design.gds"
LAYOUT PRIMARY "design"
LAYOUT SYSTEM GDSII

# Source netlist
SOURCE PATH "netlist/design.lvs.v"
SOURCE PRIMARY "design"
SOURCE SYSTEM VERILOG

# Rules
MASK SVDB_DIRECTORY "svdb" QUERY
LVS REPORT "reports/lvs.rpt"
LVS REPORT MAXIMUM 50

# Comparison options
LVS IGNORE TRIVIAL NAMED PORTS
LVS RECOGNIZE GATES ALL
LVS FILTER SHORT SHORTED NETS
LVS REPORT UNITS MICRON

# Output
LVS ERASE LAYOUT LABELS NO
```

### Step 3: Run LVS

**Using Calibre:**
```bash
# Command line
calibre -lvs -hier -turbo 4 lvs_runset

# Or via runset
calibre -lvs lvs_runset
```

**Via Makefile:**
```bash
make lvs
```

### Step 4: Interpret Results

**Check summary in report:**
```
# LVS Report
DATABASE: gds/design.gds
RULE FILE: rules/lvs_rules

COMPARISON RESULTS:

    CELL           SOURCE LAYOUT   RESULT
    ========================================
    design         45230   45230   CORRECT

# Or if incorrect:
    design         45230   45180   INCORRECT
    NETS:  45180 vs 45230 (50 difference)
    INSTS: 12456 vs 12456 (0 difference)
```

---

## LVS Result Interpretation

### CORRECT Result

```
DATABASE SUMMARY:
  Layout cells:        45230
  Source instances:    45230
  Matched instances:   45230

CORRECT. ALL MATCHED.
```

**Action:** LVS clean, proceed to tapeout!

### INCORRECT - Shorts

```
INCORRECT NETS:

  Shorted nets:
    net_a + net_b (should be separate)
    vdd + signal_x (power short!)

  Shorted instances:
    inst_a/A connected to inst_b/Z
```

**Common causes:**
- Missing routing cuts
- Metal overlap
- Power shorts

### INCORRECT - Opens

```
INCORRECT NETS:

  Open nets:
    net_x (disconnected into 2 pieces)
    clk_tree has 5 disconnected segments

  Open instances:
    inst_a missing connection to net_y
```

**Common causes:**
- Missing vias
- Unrouted nets
- Name mapping issues

### Property Mismatches

```
PROPERTY MISMATCHES:

  Instance: u_buf_1
    Source: BUF_X4
    Layout: BUF_X2 (different size)

  Device: u_res_1
    Source: 1000 ohm
    Layout: 1200 ohm (20% difference)
```

---

## Debugging LVS Mismatches

### Strategy 1: Identify the Problem

```bash
# Check summary first
grep -A 10 "COMPARISON RESULTS" reports/lvs.rpt

# Count mismatches
grep -c "INCORRECT" reports/lvs.rpt
```

### Strategy 2: Use Calibre RVE

**Interactive debug:**
```bash
# Open Calibre RVE for visual debugging
calibre -rve svdb/design.svdb

# Navigate to mismatches
# - Click on net names to highlight in layout
# - Cross-probe between source and layout
```

### Strategy 3: Check Common Issues

**Name Mapping Issues:**
```tcl
# In LVS runset - add name mapping
LAYOUT TEXT LAYER 100
LAYOUT CASE INSENSITIVE

# Verilog netlist names
SOURCE NAME MAP verilog_map
```

**Power/Ground Connection:**
```tcl
# Connect power nets explicitly
CONNECT VDD VDD_1 VDD_2 BY NAME
CONNECT VSS VSS_1 VSS_2 BY NAME
```

**Cell Recognition:**
```tcl
# Enable gate recognition
LVS RECOGNIZE GATES ALL

# If cells not recognized, add definitions
LVS DEVICE RESISTOR R LAYOUT RESISTOR [50,100]
```

---

## Common LVS Issues and Fixes

### Issue 1: Missing Power Connections

**Symptoms:**
```
INCORRECT NETS:
  Open nets: VDD (disconnected into 15 pieces)
  Open nets: VSS (disconnected into 15 pieces)
```

**Fix:**
```tcl
# In LVS runset
CONNECT VDD VDD_* BY NAME
CONNECT VSS VSS_* BY NAME

# Or in Innovus - check power routing
verifyConnectivity -nets {VDD VSS}
```

### Issue 2: Floating Pins

**Symptoms:**
```
INCORRECT PORTS:
  Floating pins: test_mode, scan_in
```

**Fix:**
```tcl
# Connect floating pins
LAYOUT PIN test_mode NO
LAYOUT PIN scan_in NO

# Or tie off in netlist
tie_hi inst_tie (.Z(test_mode));
```

### Issue 3: Name Mismatches

**Symptoms:**
```
INCORRECT NETS:
  Source net: data_bus[0]
  Layout net: data_bus_0_
```

**Fix:**
```tcl
# Add name mapping
LAYOUT RENAME NAME "data_bus\[(\d+)\]" "data_bus_\1"
SOURCE RENAME NAME "data_bus\[(\d+)\]" "data_bus_\1"

# Or use case insensitive matching
LAYOUT CASE INSENSITIVE
SOURCE CASE INSENSITIVE
```

### Issue 4: Unrecognized Devices

**Symptoms:**
```
UNRECOGNIZED DEVICES:
  5 instances of cell CUSTOM_MUX not recognized
```

**Fix:**
```tcl
# Add device recognition rules
LVS DEVICE CUSTOM_MUX LAYOUT CUSTOM_MUX CELL
LVS BOX CUSTOM_MUX

# Or black-box the cell
LVS BLACKBOX CUSTOM_MUX
```

### Issue 5: Shorts from Fill

**Symptoms:**
```
SHORTED NETS:
  signal_a + dummy_fill_net
```

**Fix:**
```tcl
# Filter metal fill
LVS FILTER FILL LAYER ALL SHORTED NETS
LVS FILTER FILL CELL * NO

# Or remove fill before LVS
LAYOUT EXCLUDE CELL FILL_*
```

---

## Hierarchical LVS

### For Large Designs

**Hierarchical LVS runset:**
```tcl
# Enable hierarchical mode
LVS CELL COMPARISON MODE AUTOMATIC
LVS CELL SUPPLY EXCLUDE YES
LVS CIRCUIT COMPARISON PUSH DEVICES YES

# Box cells that are clean
LVS BOX sub_module_1
LVS BOX sub_module_2

# Hierarchical comparison
LVS HCELL sub_module_1 sub_module_1
LVS HCELL sub_module_2 sub_module_2
```

### Box vs Compare

| Strategy | When to Use |
|----------|-------------|
| BOX | Cell is LVS clean, don't recheck |
| HCELL | Compare hierarchically |
| FLAT | Small designs or complex issues |

---

## Complete LVS Script

```tcl
# lvs_runset - Complete Calibre LVS runset

#===========================================
# Layout Input
#===========================================
LAYOUT PATH "gds/ibex_core.gds"
LAYOUT PRIMARY "ibex_core"
LAYOUT SYSTEM GDSII

#===========================================
# Source Input
#===========================================
SOURCE PATH "netlist/ibex_core.lvs.v"
SOURCE PRIMARY "ibex_core"
SOURCE SYSTEM VERILOG

#===========================================
# Rules
#===========================================
INCLUDE /tech/sky130hd/rules/lvs_rules

#===========================================
# Comparison Options
#===========================================
LVS REPORT "reports/lvs.rpt"
LVS REPORT MAXIMUM 100
LVS REPORT UNITS MICRON

LVS IGNORE TRIVIAL NAMED PORTS
LVS RECOGNIZE GATES ALL
LVS FILTER SHORT SHORTED NETS

# Power connections
CONNECT VDD VDD_* BY NAME
CONNECT VSS VSS_* BY NAME

# Name mapping for Verilog buses
SOURCE RENAME NAME "(\w+)\[(\d+)\]" "\1_\2"
LAYOUT RENAME NAME "(\w+)\[(\d+)\]" "\1_\2"

#===========================================
# Output
#===========================================
MASK SVDB_DIRECTORY "svdb" QUERY
LVS ERASE LAYOUT LABELS NO
```

---

## Makefile Integration

```makefile
# Makefile - LVS targets

DESIGN = ibex_core

lvs:
	calibre -lvs -hier -turbo 4 rules/lvs_runset

lvs_report:
	cat reports/lvs.rpt
	@echo ""
	@echo "LVS Status: $$(grep -c 'CORRECT' reports/lvs.rpt)"

lvs_debug:
	calibre -rve svdb/$(DESIGN).svdb

lvs_clean:
	rm -rf svdb reports/lvs.rpt
```

---

## Real Example: Ibex LVS

**Design:** Ibex RISC-V CPU
**Technology:** Skywater 130nm HD

```bash
cd /home/EDA/hipilot_test/ibex_work_upload
make lvs
```

**Expected Results (if clean):**
```
LVS Report Summary:
==================

Source Layout   Result
------ ------   ------
45230   45230   CORRECT

MATCHED SUMMARY:
  Instances: 12456 matched, 0 unmatched
  Nets:      45230 matched, 0 unmatched
  Ports:     156 matched, 0 unmatched

LVS Result: CORRECT
```

**Common Ibex LVS Issues:**
1. Debug pins floating - tie off or connect
2. Scan chain - connect or black-box
3. Power grid - verify connectivity first

---

## LVS Signoff Checklist

Before running LVS:
- [ ] GDS exported correctly
- [ ] Netlist exported without power
- [ ] Rule deck matches technology
- [ ] All required layers present

After LVS passes:
- [ ] Result is CORRECT
- [ ] No soft shorts
- [ ] All ports matched
- [ ] Instance counts match
- [ ] Save LVS report for records

---

## Related Skills

- `/drc-check` - Design rule check (run before LVS)
- `/save-design` - Export GDS for LVS
- `/synthesis` through `/chipfinish` - Complete flow including signoff

---

## Summary

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Basic LVS | `calibre -lvs runset` | CORRECT |
| Hierarchical | `calibre -lvs -hier runset` | All cells CORRECT |
| Debug | `calibre -rve svdb` | Identify mismatches |

**Remember:** LVS is a signoff requirement. NEVER tapeout with LVS violations!
