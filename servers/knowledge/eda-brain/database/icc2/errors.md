# IC Compiler II Error Patterns

Common error patterns, their root causes, and solutions for Synopsys IC Compiler II.

## Library Errors

### LIB-001

**Pattern:** `Cannot open library`

**Severity:** Error

**Description:** Cannot open the specified .nlib file.

**Root Causes:**
- Library doesn't exist
- Wrong path
- Library corrupted
- Permission denied

**Solution:**
```tcl
# Check library exists
file exists design.nlib

# Create new if needed
create_lib design.nlib -technology tech.tf
```

---

### LIB-002

**Pattern:** `Library already exists`

**Severity:** Warning/Error

**Description:** Attempting to create library that already exists.

**Solution:**
```tcl
# Open existing instead
create_lib -overwrite design.nlib
# Or
open_lib design.nlib
```

---

### BLOCK-001

**Pattern:** `Block not found in library`

**Severity:** Error

**Description:** Specified block doesn't exist in the library.

**Solution:**
```tcl
# List available blocks
list_blocks

# Create block if needed
create_block top
```

---

## Design Input Errors

### READ-001

**Pattern:** `Error reading Verilog file`

**Severity:** Error

**Description:** Cannot parse Verilog netlist.

**Root Causes:**
- Syntax errors in Verilog
- Missing modules
- Unsupported constructs

**Solution:**
1. Validate Verilog with simulator
2. Check for syntax errors
3. Ensure all submodules are included

---

### SDC-001

**Pattern:** `Error reading SDC file`

**Severity:** Error

**Description:** Cannot parse SDC constraints.

**Solution:**
```tcl
# Check SDC syntax
source constraints.sdc
# Review error messages
```

---

## Floorplan Errors

### FP-001

**Pattern:** `Floorplan initialization failed`

**Severity:** Error

**Description:** Cannot initialize floorplan.

**Root Causes:**
- Missing technology data
- Invalid dimensions
- Core larger than die

**Solution:**
```tcl
# Check technology is loaded
report_technology

# Verify dimensions
initialize_floorplan -shape rectangular -side_length {1000 1000}
```

---

### MACRO-001

**Pattern:** `Macro placement out of bounds`

**Severity:** Error

**Description:** Macro placed outside die area.

**Solution:**
```tcl
# Check die area
report_die_area

# Adjust macro location
place_macro -macro ram_0 -location {100 200} -orientation R0
```

---

## Placement Errors

### PLACE-001

**Pattern:** `Placement density exceeds limit`

**Severity:** Warning

**Description:** Target density too high for placement.

**Solution:**
```tcl
# Increase floorplan area or reduce density target
set_app_options -name place.coarse.max_density -value 0.75
```

---

### PLACE-002

**Pattern:** `Congestion too high`

**Severity:** Warning

**Description:** Placement has high congestion.

**Solution:**
```tcl
# Enable congestion-driven placement
create_placement -congestion_driven

# Or increase core area
```

---

## CTS Errors

### CTS-001

**Pattern:** `No clocks defined`

**Severity:** Error

**Description:** Cannot run CTS without clock definitions.

**Solution:**
```tcl
# Define clocks
read_sdc constraints.sdc
# Or
create_clock -name clk -period 10.0 [get_ports clk]
```

---

### CTS-002

**Pattern:** `Clock tree synthesis failed`

**Severity:** Error

**Description:** CTS could not complete.

**Root Causes:**
- Missing clock buffers in library
- Constraints too tight
- Clock gating issues

**Solution:**
1. Check library has clock buffers
2. Relax clock constraints
3. Review clock gating setup

---

## Routing Errors

### ROUTE-001

**Pattern:** `Routing failed to complete`

**Severity:** Error

**Description:** Could not route all nets.

**Root Causes:**
- High congestion
- Missing routing layers
- DRC conflicts

**Solution:**
```tcl
# Check congestion
report_congestion

# Re-run with higher effort
route_auto -effort high
```

---

### DRC-001

**Pattern:** `DRC violations found`

**Severity:** Error

**Description:** Design rule violations after routing.

**Solution:**
```tcl
# Run DRC repair
route_detail -incremental

# Or full re-route
route_auto
```

---

## Timing Errors

### TIMING-001

**Pattern:** `No timing paths found`

**Severity:** Warning

**Description:** Cannot find timing paths for analysis.

**Root Causes:**
- No clocks defined
- No registers in design
- Design not properly linked

**Solution:**
```tcl
# Check clocks
report_clocks

# Check design
report_design
```

---

### TIMING-002

**Pattern:** `Setup violations detected`

**Severity:** Warning

**Description:** Timing does not meet setup requirements.

**Solution:**
```tcl
# Fix timing
fix_eco_timing -setup

# Or re-run optimization
place_opt
route_opt
```

---

## Application Options Errors

### OPT-001

**Pattern:** `Unknown application option`

**Severity:** Error

**Description:** Invalid option name specified.

**Solution:**
```tcl
# List valid options
report_app_options

# Check option name
get_app_option_value -name <option>
```

---

## License Errors

### LM-001

**Pattern:** `License checkout failed.*ICC2`

**Severity:** Fatal

**Description:** Cannot check out IC Compiler II license.

**Solution:**
1. Check license server status
2. Verify license availability
3. Contact CAD administrator

---

## Warning Patterns

### WARN-001

**Pattern:** `Unconnected pins`

**Severity:** Warning

**Description:** Some pins are not connected.

**Impact:** May cause functional issues.

**Solution:**
```tcl
# Check unconnected pins
check_design -checks unconnected_ports
```

---

### WARN-002

**Pattern:** `Multi-driven net`

**Severity:** Warning

**Description:** Multiple drivers on same net.

**Solution:** Review design, use tri-state if intentional.

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
# Check library status
list_libs
list_blocks

# Check design
check_design
report_design

# Check timing
report_clocks
report_timing

# Check physical
report_die_area
report_congestion

# Check routing
check_routes
verify_drc
```
