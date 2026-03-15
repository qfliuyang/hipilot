# Design Compiler Error Patterns

Common error patterns, their root causes, and solutions for Synopsys Design Compiler.

## Library Errors

### MISSING_TARGET_LIBRARY

**Pattern:** `target_library not set`

**Severity:** Error

**Description:** Target library variable not defined before synthesis.

**Root Cause:** Forgot to set library or script error.

**Solution:**
```tcl
set target_library "your_tech_library.db"
set link_library "* $target_library"
```

**Auto-fixable:** Yes

---

### UNRESOLVED_REFERENCE

**Pattern:** `Unresolved reference to`

**Severity:** Error

**Description:** Module or cell reference not found during link.

**Root Causes:**
- Missing library in link_library
- Typo in module name
- Missing RTL file
- Library not loaded

**Solution:**
```tcl
# Check link library includes all needed libraries
set link_library "* lib1.db lib2.db ram.db"

# Verify module exists
list_designs
```

**Auto-fixable:** No (requires identifying missing library)

---

### LIB-1

**Pattern:** `Error reading library file`

**Severity:** Error

**Description:** Cannot read technology library file.

**Root Causes:**
- File not found
- Corrupted library
- Wrong format
- Permission denied

**Solution:**
1. Check file path exists
2. Verify file is readable
3. Regenerate library if corrupted

---

### LINK-2

**Pattern:** `Linking failed`

**Severity:** Error

**Description:** Design linking process failed.

**Solution:**
```tcl
# Check for unresolved references
link
# Review error messages for specific cells
```

---

## RTL Errors

### ANALYZE-1

**Pattern:** `Syntax error in file`

**Severity:** Error

**Description:** RTL file has syntax errors.

**Root Causes:**
- Invalid Verilog/VHDL syntax
- Missing semicolons
- Mismatched brackets

**Solution:**
1. Check RTL with simulator
2. Review error line number
3. Fix syntax errors

---

### ELABORATE-1

**Pattern:** `Cannot find design`

**Severity:** Error

**Description:** Design not found in analyzed library.

**Root Causes:**
- Design name typo
- analyze step failed
- Wrong library specified

**Solution:**
```tcl
# Check analyzed designs
list_designs

# Re-analyze if needed
analyze -format sverilog design.v
elaborate correct_name
```

---

### ELABORATE-2

**Pattern:** `Multiple designs with name`

**Severity:** Warning/Error

**Description:** Multiple designs with same name in different libraries.

**Solution:**
```tcl
# Specify library explicitly
elaborate top -library WORK
```

---

## Constraint Errors

### CMD-036

**Pattern:** `No clock defined`

**Severity:** Warning

**Description:** No clock constraints defined.

**Solution:**
```tcl
create_clock -name clk -period 10.0 [get_ports clk]
```

---

### TIMING-1

**Pattern:** `No paths for timing analysis`

**Severity:** Warning

**Description:** Cannot find paths for timing analysis.

**Root Causes:**
- No clock defined
- No registers in design
- Design not linked

**Solution:**
1. Define clocks
2. Check design is linked
3. Verify design has sequential elements

---

### UITE-1

**Pattern:** `Input delay not specified`

**Severity:** Warning

**Description:** Input delays not constrained.

**Solution:**
```tcl
set_input_delay 2.0 -clock clk [all_inputs]
remove_input_delay clk
```

---

## Compilation Errors

### OPT-1

**Pattern:** `Optimization failed`

**Severity:** Error

**Description:** Optimization could not meet constraints.

**Root Causes:**
- Over-constrained design
- Unrealistic timing targets
- Missing timing exceptions

**Solution:**
1. Relax constraints if over-constrained
2. Review timing exceptions
3. Check library has required cells

---

### DFT-1

**Pattern:** `Scan insertion failed`

**Severity:** Error

**Description:** Could not insert scan chains.

**Root Causes:**
- No scan cells in library
- Scan configuration error
- Clock domain crossing issues

**Solution:**
```tcl
# Check library has scan cells
list_libs

# Verify scan configuration
report_scan_configuration
```

---

## Warning Patterns

### LINT-1

**Pattern:** `Latch inferred`

**Severity:** Warning

**Description:** Latch inferred from incomplete assignment.

**Impact:** May cause timing issues, not suitable for FPGA.

**Solution:**
```tcl
# Add else clause or default assignment
# Or use set_register_type if latch is intended
```

---

### LINT-2

**Pattern:** `Unloaded net`

**Severity:** Warning

**Description:** Net has no load (output not connected).

**Impact:** Logic will be optimized away.

**Solution:** Check RTL for missing connections.

---

### LINT-3

**Pattern:** `Multiply driven net`

**Severity:** Warning/Error

**Description:** Multiple drivers on same net.

**Solution:** Review RTL, use tri-state or mux if intentional.

---

## License Errors

### LM-1

**Pattern:** `License checkout failed.*Design-Compiler`

**Severity:** Fatal

**Description:** Could not check out DC license.

**Solution:**
1. Check license server status
2. Verify license file
3. Contact CAD administrator

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
# Check libraries
list_libs
report_lib <lib_name>

# Check design status
current_design
list_designs
report_hierarchy

# Check constraints
report_clock
report_constraint -all_violators

# Check timing
report_timing
report_qor
```
