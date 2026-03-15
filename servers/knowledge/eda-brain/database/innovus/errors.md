# Innovus Error Patterns

Common error patterns, their root causes, and solutions for Cadence Innovus.

## LEF Loading Errors

### IMPLF-53

**Pattern:** `IMPLF-53.*layer.*referenced in pin.*macro`

**Severity:** Error

**Description:** Tech LEF must be loaded before cell LEFs. A layer referenced in a cell LEF pin definition was not found because the technology LEF hasn't been loaded yet.

**Root Cause:**
- Cell LEFs reference layers defined in the technology LEF
- Loading cell LEFs before tech LEF causes unresolved layer references

**Solution:**
```tcl
# WRONG - cell LEF before tech LEF
set init_lef_file "cells.lef tech.tlef"

# CORRECT - tech LEF first
set init_lef_file "tech.tlef cells.lef"
```

**Auto-fixable:** Yes

---

### LEF_LOADING_FAILED

**Pattern:** `Loading LEF file\(s\) failed`

**Severity:** Error

**Description:** LEF files failed to load completely.

**Root Causes:**
- File not found (wrong path)
- Permission denied
- Corrupted LEF file
- Syntax error in LEF

**Solution:**
1. Check file paths are correct
2. Verify files exist and are readable
3. Check LEF syntax with a validator
4. Ensure tech LEF is loaded first

**Auto-fixable:** No (requires user intervention)

---

### LEF-58

**Pattern:** `LEF-58.*SITE.*not defined`

**Severity:** Error

**Description:** Site referenced in macro LEF is not defined.

**Root Cause:** Site definition missing from tech LEF or loaded after cell LEFs.

**Solution:** Ensure tech LEF with SITE definitions is loaded first.

---

## Timing Constraint Errors

### NO_TIMING_CONSTRAINTS

**Pattern:** `No timing constraints found`

**Severity:** Warning

**Description:** Design has no timing constraints loaded.

**Root Cause:** SDC file not loaded or empty.

**Solution:**
```tcl
# Load SDC constraints
source constraints.sdc
# Or specify in MMMC file
```

---

### TIMING-1

**Pattern:** `TIMING-1.*no clock defined`

**Severity:** Error

**Description:** No clock constraints defined in the design.

**Solution:**
```tcl
create_clock -name clk -period 10.0 [get_ports clk]
```

---

## Design Initialization Errors

### INIT-2

**Pattern:** `INIT-2.*init_top_cell not set`

**Severity:** Error

**Description:** Top cell name not specified before init_design.

**Solution:**
```tcl
set init_top_cell "your_top_module"
init_design
```

---

### INIT-3

**Pattern:** `INIT-3.*Verilog file not found`

**Severity:** Error

**Description:** Verilog netlist file not found.

**Solution:** Check `init_verilog` path is correct and file exists.

---

## Placement Errors

### PLACE-1

**Pattern:** `PLACE-1.*overlapping instances`

**Severity:** Error

**Description:** Instances overlap after placement.

**Root Causes:**
- Floorplan too small
- Macro placement causes overlap
- Halo not set around macros

**Solution:**
1. Increase floorplan size
2. Adjust macro placement
3. Add halos around macros:
```tcl
addHaloToBlock 10 10 10 10 macro_name
```

---

### PLACE-2

**Pattern:** `PLACE-2.*density exceeds max`

**Severity:** Warning

**Description:** Placement density exceeds maximum allowed.

**Solution:**
```tcl
# Increase max density
setOptMode -maxDensity 0.85
# Or increase floorplan area
floorPlan -site unit -su 1.0 0.60 10 10 10 10
```

---

## Routing Errors

### ROUTE-1

**Pattern:** `ROUTE-1.*DRC violations found`

**Severity:** Error

**Description:** Design rule check violations after routing.

**Solution:**
```tcl
# Run DRC repair
routeDesign -opt
# Or manually fix
editDeleteViolations
routeDesign
```

---

### ROUTE-2

**Pattern:** `ROUTE-2.*antenna violations`

**Severity:** Warning

**Description:** Antenna rule violations detected.

**Solution:**
```tcl
# Enable antenna fixing
setNanoRouteMode -drainOnlyAntennaRepair true
routeDesign
```

---

## License Errors

### LM-1

**Pattern:** `License checkout failed.*innovus`

**Severity:** Fatal

**Description:** Could not check out Innovus license.

**Root Causes:**
- No license server available
- All licenses in use
- Wrong license feature name

**Solution:**
1. Check license server: `lmstat -a`
2. Wait for license availability
3. Contact CAD team for license

---

## Warning Patterns (Non-fatal)

### WARN-1

**Pattern:** `.*clock gating.*not identified`

**Severity:** Warning

**Description:** Tool could not identify clock gating structures.

**Impact:** Power analysis may be inaccurate.

**Solution:**
```tcl
setOptMode -clockGateAware true
```

---

### WARN-2

**Pattern:** `.*dont_use.*attribute ignored`

**Severity:** Warning

**Description:** Library cell has dont_use attribute that is being ignored.

**Impact:** Tool may use cells that should be excluded.

---

## Error Severity Legend

| Severity | Action Required |
|----------|-----------------|
| Fatal | Tool cannot continue, must fix before proceeding |
| Error | Feature not working, should fix for correct results |
| Warning | Potential issue, review but may proceed |
| Info | Informational message only |

## Quick Diagnostic Commands

```tcl
# Check design status
report_design

# Check timing constraints
report_clocks
report_constraint

# Check placement
checkPlace

# Check routing
verify_drc
verifyConnectivity
```
