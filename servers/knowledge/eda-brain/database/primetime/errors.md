# PrimeTime Error Patterns

Common error patterns, their root causes, and solutions for Synopsys PrimeTime.

## Design Input Errors

### READ-001

**Pattern:** `Error reading file`

**Severity:** Error

**Description:** Cannot read input file (db, verilog, lib, etc.).

**Root Causes:**
- File not found
- Wrong format
- Corrupted file
- Permission denied

**Solution:**
```tcl
# Verify file exists
file exists design.db

# Check file format
```

---

### LINK-001

**Pattern:** `Link failed`

**Severity:** Error

**Description:** Design linking failed.

**Root Causes:**
- Missing library references
- Unresolved cells
- Multiple definitions

**Solution:**
```tcl
# Check libraries
list_libs

# Check link
link_design
```

---

### LIB-001

**Pattern:** `Library cell not found`

**Severity:** Error

**Description:** Referenced cell not in loaded libraries.

**Solution:**
```tcl
# Load missing library
read_lib missing.lib

# Re-link
link_design
```

---

## Constraint Errors

### SDC-001

**Pattern:** `Error reading SDC file`

**Severity:** Error

**Description:** SDC constraint file has errors.

**Root Causes:**
- Syntax errors
- Undefined objects
- Invalid constraints

**Solution:**
```tcl
# Source SDC to see errors
source constraints.sdc

# Check specific constraint
report_clock
report_timing -check_only
```

---

### NO_CLOCKS_DEFINED

**Pattern:** `No clocks defined`

**Severity:** Error

**Description:** No clock constraints in design.

**Solution:**
```tcl
# Define clocks
create_clock -name clk -period 10.0 [get_ports clk]

# Verify
report_clock
```

---

### TIMING-001

**Pattern:** `No timing paths found`

**Severity:** Warning

**Description:** Cannot find timing paths.

**Root Causes:**
- No clocks defined
- No registers in design
- Constraints filtering all paths

**Solution:**
```tcl
# Check clocks
report_clock

# Check design
report_design

# Try without filters
report_timing
```

---

## Parasitic Errors

### SPEF-001

**Pattern:** `Error reading SPEF file`

**Severity:** Error

**Description:** Cannot read parasitic data.

**Root Causes:**
- Wrong SPEF format
- Mismatched netlist
- Missing nets

**Solution:**
```tcl
# Verify SPEF matches netlist
# Check for warnings during read
read_parasitics design.spef
report_annotated_parasitics
```

---

### ANNOTATE-001

**Pattern:** `Parasitic annotation incomplete`

**Severity:** Warning

**Description:** Not all nets have parasitic data.

**Solution:**
```tcl
# Check annotation coverage
report_annotated_parasitics

# Annotate remaining nets with wire load
set_wire_load_model -name <model>
```

---

## Timing Errors

### VIOLATION-001

**Pattern:** `Setup violations detected`

**Severity:** Warning

**Description:** Design has setup timing violations.

**Solution:**
```tcl
# Report violations
report_constraint -all_violators

# Generate ECO fixes
fix_eco_timing -setup
```

---

### VIOLATION-002

**Pattern:** `Hold violations detected`

**Severity:** Warning

**Description:** Design has hold timing violations.

**Solution:**
```tcl
# Report violations
report_constraint -all_violators -delay_type min

# Generate ECO fixes
fix_eco_timing -hold
```

---

### ANALYSIS-001

**Pattern:** `Timing analysis incomplete`

**Severity:** Warning

**Description:** Not all paths analyzed.

**Root Causes:**
- Disabled timing checks
- False path settings
- Case analysis

**Solution:**
```tcl
# Check coverage
report_analysis_coverage

# Enable all checks
set timing_enable_through_paths true
```

---

## Variation Errors

### AOCV-001

**Pattern:** `AOCV table not found`

**Severity:** Warning

**Description:** AOCV derating tables not loaded.

**Solution:**
```tcl
# Read AOCV tables
read_aocvm aocvm_table.txt

# Enable AOCV
timing_enable_aocvm true
```

---

### POCV-001

**Pattern:** `POCV library not found`

**Severity:** Warning

**Description:** POCV data not in libraries.

**Solution:**
```tcl
# Use libraries with POCV data
# Or use AOCV instead
```

---

## License Errors

### LM-001

**Pattern:** `License checkout failed.*PrimeTime`

**Severity:** Fatal

**Description:** Cannot check out PrimeTime license.

**Solution:**
1. Check license server
2. Verify license availability
3. Contact CAD administrator

---

## Warning Patterns

### WARN-001

**Pattern:** `Unconstrained endpoints`

**Severity:** Warning

**Description:** Some endpoints have no timing constraints.

**Impact:** May miss timing violations.

**Solution:**
```tcl
# Find unconstrained endpoints
report_analysis_coverage

# Add constraints
set_input_delay / set_output_delay
```

---

### WARN-002

**Pattern:** `Clock gating check failed`

**Severity:** Warning

**Description:** Clock gating setup/hold violations.

**Solution:**
```tcl
# Report clock gating checks
report_clock_gating_check

# Adjust constraints if needed
```

---

### WARN-003

**Pattern:** `Disabled timing arc`

**Severity:** Info

**Description:** Some timing arcs are disabled.

**Solution:** Review if intentional (case analysis, false paths).

---

## Error Severity Legend

| Severity | Action Required |
|----------|-----------------|
| Fatal | Cannot continue, fix immediately |
| Error | Results incorrect, must fix |
| Warning | Review, may proceed with caution |
| Info | Informational only |

## Quick Diagnostic Commands

```tcl
# Check design status
report_design
report_hierarchy

# Check constraints
report_clock
report_constraint -all_violators

# Check timing
update_timing
report_timing
report_analysis_coverage

# Check parasitics
report_annotated_parasitics

# Check libraries
list_libs
```
