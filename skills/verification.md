---
name: verification
description: >
  Physical verification with Calibre. Covers DRC (Design Rule Check)
  and LVS (Layout vs Schematic) verification for tape-out signoff.

hipilot:
  vendors: [mentor, synopsys, cadence]
  tools:
    mentor: [calibre]
    synopsys: [icv]
    cadence: [pvs]
  flow_stages: [drc, lvs]
  triggers:
    - "run drc"
    - "run lvs"
    - "calibre drc"
    - "calibre lvs"
    - "physical verification"
  qor_metrics: [DRC_Violations, LVS_Status, Shorts, Opens]
  risk_level: moderate
  typical_duration: "10-60 minutes depending on design size"
---

# Physical Verification (DRC/LVS)

## Quick Reference

```
User: "run DRC" or "run LVS"
```

HiPilot will:
1. Prepare input files (GDS, netlist, rules)
2. Run Calibre DRC/LVS
3. Analyze results
4. Report violations
5. Suggest fixes (if possible)

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| Post-route | Run initial DRC |
| Signoff preparation | Run full DRC + LVS |
| After ECO | Verify fixes |
| Tape-out | Final verification |

**Prerequisites:**
- GDS exported from P&R
- Verilog netlist (for LVS)
- Calibre rule deck

---

## DRC (Design Rule Check)

### DRC Workflow

```bash
# Run Calibre DRC
calibre -drc -hier -turbo 4 rules/drc.rules
```

### DRC Rule File Template

```tcl
# drc.rules - Calibre DRC rule file
LAYOUT PATH "ibex_core.gds"
LAYOUT PRIMARY "ibex_core"
LAYOUT SYSTEM GDSII

DRC RESULTS DATABASE "drc_results.db"
DRC SUMMARY REPORT "drc_summary.rpt"
DRC MAXIMUM RESULTS 1000

# Include technology rules
INCLUDE "/tech/sky130hd/calibre/drcRules"
```

### Common DRC Violations

| Violation | Description | Fix |
|-----------|-------------|-----|
| Min spacing | Metal too close | Increase spacing |
| Min width | Wire too narrow | Increase width |
| Enclosure | Metal not enclosing via | Extend metal |
| Overlap | Layers overlapping | Adjust shapes |
| Antenna | Gate connected to long metal | Add diode |

---

## LVS (Layout vs Schematic)

### LVS Workflow

```bash
# Run Calibre LVS
calibre -lvs -hier rules/lvs.rules
```

### LVS Rule File Template

```tcl
# lvs.rules - Calibre LVS rule file
LAYOUT PATH "ibex_core.gds"
LAYOUT PRIMARY "ibex_core"
LAYOUT SYSTEM GDSII

SOURCE PATH "ibex_lvs.vg"
SOURCE PRIMARY "ibex_core"
SOURCE SYSTEM VERILOG

MASK COMPOSITE EXCLUDE CELL PG_CELL

LVS REPORT "lvs_report.rpt"
LVS REPORT MAXIMUM 1000

# Include technology rules
INCLUDE "/tech/sky130hd/calibre/lvsRules"
```

### LVS Status

| Status | Meaning | Action |
|--------|---------|--------|
| CORRECT | Layout matches schematic | Pass |
| INCORRECT | Mismatches found | Debug and fix |
| FAILED | Extraction failed | Check GDS/rules |

---

## Calibre Commands

### DRC Commands

```bash
# Basic DRC
calibre -drc rules/drc.rules

# With hierarchy
calibre -drc -hier rules/drc.rules

# With parallel processing
calibre -drc -hier -turbo 8 rules/drc.rules

# With results database
calibre -drc -hier -turbo 4 -drc_results drc.db rules/drc.rules
```

### LVS Commands

```bash
# Basic LVS
calibre -lvs rules/lvs.rules

# With hierarchy
calibre -lvs -hier rules/lvs.rules

# With automatic comparison
calibre -lvs -hier -auto rules/lvs.rules

# With SVDB for debugging
calibre -lvs -hier -svdb lvs_svdb rules/lvs.rules
```

---

## Makefile Integration

```makefile
# Makefile - Physical verification targets

DRC_RULES = designs/sky130hd/calibre/drc.rules
LVS_RULES = designs/sky130hd/calibre/lvs.rules
GDS_FILE = result/pr/data/ibex_core.gds
NETLIST = result/pr/data/ibex_lvs.vg

drc:
	calibre -drc -hier -turbo 4 $(DRC_RULES)
	@echo "DRC results: drc_summary.rpt"

lvs:
	calibre -lvs -hier $(LVS_RULES)
	@echo "LVS results: lvs_report.rpt"

verify: drc lvs
	@echo "Verification complete"

drc_report:
	cat drc_summary.rpt

lvs_report:
	cat lvs_report.rpt
```

---

## Verification Flow

### Step 1: Prepare Files

```bash
# Ensure GDS exists
ls result/pr/data/ibex_core.gds

# Ensure LVS netlist exists
ls result/pr/data/ibex_lvs.vg

# Check rule files
ls designs/sky130hd/calibre/
```

### Step 2: Run DRC

```bash
cd /home/EDA/hipilot_test/ibex_work_upload
make drc
```

### Step 3: Review DRC Results

```bash
# View summary
cat drc_summary.rpt

# Open results in Calibre RVE
calibre -rve drc_results.db
```

### Step 4: Run LVS

```bash
make lvs
```

### Step 5: Review LVS Results

```bash
# View report
cat lvs_report.rpt

# Check for CORRECT status
grep -i "CORRECT\|INCORRECT" lvs_report.rpt
```

---

## Common Issues

### Issue 1: DRC Short Violations

**Symptoms:** Metal shorts reported

**Fix:**
1. Open GDS in layout viewer
2. Navigate to violation coordinates
3. Increase spacing or reroute
4. Re-export GDS
5. Re-run DRC

### Issue 2: LVS Mismatches

**Symptoms:** INCORRECT LVS status

**Fix:**
1. Check SVDB output
2. Compare layout vs source
3. Common causes:
   - Missing/extra cells
   - Net name mismatches
   - Power/ground issues
4. Fix in P&R or netlist

### Issue 3: Extraction Failures

**Symptoms:** FAILED status

**Fix:**
1. Check GDS integrity
2. Check rule file syntax
3. Check cell names match
4. Check layer mappings

---

## DRC Waivers

For acceptable violations:

```tcl
# In rule file, add waivers
DRC WAIVER "via_enclosure" {
  CELL "macro_name"
  LAYER via1
  CHECK "Enclosure"
}
```

---

## Complete Script Template

```bash
#!/bin/bash
# verify.sh - Physical verification script

DESIGN_NAME="ibex_core"
RESULT_DIR="result/pr/data"
RULES_DIR="designs/sky130hd/calibre"

echo "=== Physical Verification ==="

# Check input files
echo "Checking input files..."
if [ ! -f "${RESULT_DIR}/${DESIGN_NAME}.gds" ]; then
    echo "ERROR: GDS not found"
    exit 1
fi

if [ ! -f "${RESULT_DIR}/${DESIGN_NAME}_lvs.vg" ]; then
    echo "ERROR: LVS netlist not found"
    exit 1
fi

# Run DRC
echo "Running DRC..."
calibre -drc -hier -turbo 4 ${RULES_DIR}/drc.rules
if [ $? -ne 0 ]; then
    echo "WARNING: DRC completed with violations"
fi

# Check DRC results
echo "DRC Summary:"
head -50 drc_summary.rpt

# Run LVS
echo "Running LVS..."
calibre -lvs -hier ${RULES_DIR}/lvs.rules
if [ $? -ne 0 ]; then
    echo "ERROR: LVS failed"
    exit 1
fi

# Check LVS results
echo "LVS Status:"
grep -i "CORRECT\|INCORRECT" lvs_report.rpt

echo "=== Verification Complete ==="
```

---

## MCP Commands (For Claude Code)

### Run DRC (via bash)
```bash
# Note: DRC/LVS typically run as shell commands, not through EDA tools
ssh EDA@192.168.112.163 "cd /home/EDA/hipilot_test/ibex_work_upload && make drc"
```

### Run LVS (via bash)
```bash
ssh EDA@192.168.112.163 "cd /home/EDA/hipilot_test/ibex_work_upload && make lvs"
```

### Check DRC Results
```bash
ssh EDA@192.168.112.163 "cat /home/EDA/hipilot_test/ibex_work_upload/drc_summary.rpt | head -50"
```

### Check LVS Results
```bash
ssh EDA@192.168.112.163 "grep -i CORRECT /home/EDA/hipilot_test/ibex_work_upload/lvs_report.rpt"
```

---

## Related Skills

- `/chip-finish` - Export GDS and netlists
- `/sta` - Timing verification
- `/auto-fix-drc` - Automatic DRC fixing

---

## Checklist

Before verification:
- [ ] GDS exported
- [ ] LVS netlist exported
- [ ] Rule files available

After verification:
- [ ] DRC clean (or acceptable)
- [ ] LVS CORRECT
- [ ] Reports saved
