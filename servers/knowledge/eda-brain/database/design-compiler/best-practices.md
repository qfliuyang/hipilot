# Design Compiler Best Practices

Recommended workflows and common pitfalls for Synopsys Design Compiler.

## Library Setup

**Rule:** Always set both target_library and link_library

**Rationale:**
- `target_library`: Cells for synthesis mapping
- `link_library`: Cells for link resolution (includes target + memory)

**Correct:**
```tcl
set target_library "tech.db"
set link_library "* $target_library"
```

**Explanation:**
- `"*"` represents designs in memory
- Must include target_library in link_library

---

## Compile Strategy

**Rule:** Use `compile_ultra -scan` for DFT-ready netlists

**Benefits:**
- Better QoR than basic compile
- Scan insertion during synthesis
- Clock gating support
- Retiming support

**Recommended Flow:**
```tcl
# First pass
compile_ultra -scan -gate_clock

# Incremental for fine-tuning
compile_ultra -scan -incremental
```

---

## Path Groups

**Rule:** Define path groups for reg2reg, in2reg, reg2out

**Rationale:** Better optimization control and reporting.

**Recommended:**
```tcl
# Clear existing
group_path -name reg2reg -from [all_registers] -to [all_registers]
group_path -name in2reg -from [all_inputs] -to [all_registers]
group_path -name reg2out -from [all_registers] -to [all_outputs]

# Add weights for critical paths
group_path -name critical_path -from [get_pins reg1/CK] \
  -to [get_pins reg2/D] -weight 5
```

---

## Clock Gating

**Rule:** Enable clock gating for power reduction

**Implementation:**
```tcl
# Enable clock gating
set_clock_gating_style -max_fanout 16
compile_ultra -gate_clock
```

**Benefits:**
- Reduces dynamic power
- Integrated into synthesis

---

## Retiming

**Rule:** Use retiming for critical path optimization

**Implementation:**
```tcl
set_optimize_registers true
compile_ultra -retime
```

**Note:** Moves registers across combinational logic to balance paths.

---

## Constraint Management

### Input/Output Delays

**Rule:** Set realistic input/output delays

**Recommended:**
```tcl
# Input delay (relative to clock edge)
set_input_delay 2.0 -clock clk [remove_from_collection [all_inputs] clk]

# Output delay
set_output_delay 2.0 -clock clk [all_outputs]
```

### False Paths

**Rule:** Identify and declare false paths

```tcl
# Asynchronous paths
set_false_path -from [get_ports reset_n]

# Test mode paths
set_false_path -from [get_ports test_mode]
```

### Multicycle Paths

**Rule:** Declare multicycle paths where applicable

```tcl
set_multicycle_path 2 -setup -from [get_pins reg1/CK] -to [get_pins reg2/D]
```

---

## Common Pitfalls

### Pitfall 1: Missing Libraries

**Problem:** Unresolved references during link.

**Prevention:**
```tcl
# Check all required libraries are loaded
list_libs

# Verify link succeeds
link
```

### Pitfall 2: Over-constraining

**Problem:** Unrealistic timing targets cause excessive optimization.

**Solution:**
- Use realistic constraints from spec
- Check feasibility with initial synthesis
- Relax if optimization fails

### Pitfall 3: Ignoring Warnings

**Problem:** Latches inferred unintentionally.

**Detection:**
```tcl
# Check for latches
report_timing -delay_type max
# Or look for LINT-1 warnings
```

**Prevention:**
```tcl
# Use full case/parallel case directives
# Or explicit default assignments
```

### Pitfall 4: Wrong Tool Context

**Problem:** Trying to run DC commands from within Innovus or another tool.

**Solution:** Exit current tool, start DC from shell.

```bash
exit
dc_shell -f script.tcl
```

---

## Recommended Flow

```tcl
# 1. Setup
set target_library "tech.db"
set link_library "* $target_library"

# 2. Read RTL
analyze -format sverilog [glob rtl/*.v]
elaborate top
current_design top
link

# 3. Apply constraints
source constraints.sdc

# 4. Path groups
group_path -name reg2reg -from [all_registers] -to [all_registers]
group_path -name in2reg -from [all_inputs] -to [all_registers]
group_path -name reg2out -from [all_registers] -to [all_outputs]

# 5. DFT setup
set_scan_configuration -chain_count 8

# 6. Compile
compile_ultra -scan -gate_clock

# 7. Reports
report_timing
report_area
report_power
report_qor

# 8. Output
write_file -format verilog -output design.v
write_sdc design.sdc
write_scan_def -output scan.def
```

---

## Performance Tips

### Runtime Optimization

1. **Use `compile_ultra`** instead of multiple `compile` passes
2. **Set proper effort levels** - don't always use high
3. **Use incremental** for small changes
4. **Disable unnecessary reports** during compilation

### Memory Management

1. **Remove unused designs:** `remove_design -all`
2. **Clear large collections** after use
3. **Use 64-bit mode** for large designs

---

## QoR Checklist

Before signoff, verify:

- [ ] All libraries loaded correctly
- [ ] Design links without errors
- [ ] All clocks defined
- [ ] Input/output delays set
- [ ] False paths declared
- [ ] Multicycle paths declared
- [ ] Timing constraints realistic
- [ ] No unintended latches
- [ ] Scan chains inserted (if required)
- [ ] Clock gating inserted (if required)
- [ ] Timing met or signed off
- [ ] Area within budget
- [ ] Power within budget

---

## Debugging Tips

```tcl
# Check design hierarchy
report_hierarchy

# Check specific path
report_timing -from [get_pins ...] -to [get_pins ...]

# Check cell usage
report_cell

# Check netlist statistics
report_design

# Check constraint coverage
report_constraint -all_violators -verbose
```
