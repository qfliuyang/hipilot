# PrimeTime Best Practices

Recommended workflows and common pitfalls for Synopsys PrimeTime.

## Design Loading

**Rule:** Use .db format when available

**Rationale:** .db contains design + constraints, faster loading.

**Preferred:**
```tcl
read_db design.db
link_design
```

**Alternative:**
```tcl
read_verilog design.v
read_lib tech.lib
link_design top
read_sdc constraints.sdc
```

---

## Constraint Validation

**Rule:** Validate constraints before signoff

**Checklist:**
```tcl
# Check all clocks defined
report_clock

# Check constraint coverage
report_analysis_coverage

# Check for violations
report_constraint -all_violators
```

---

## Parasitic Annotation

**Rule:** Always use SPEF for accurate analysis

**Workflow:**
```tcl
# Read parasitics
read_parasitics design.spef

# Check annotation
report_annotated_parasitics

# Update timing
update_timing
```

**Coverage Target:** >95% nets annotated

---

## Multi-Corner Analysis

**Rule:** Analyze all PVT corners

**Setup:**
```tcl
# Read libraries for each corner
read_lib tech_ss.lib
read_lib tech_ff.lib
read_lib tech_tt.lib

# Set operating conditions
set_operating_conditions -library tech_ss WCCOM
```

---

## Path Group Analysis

**Rule:** Group paths for better analysis

**Benefits:**
- Better reporting
- Focused optimization

**Example:**
```tcl
# Define path groups (in SDC)
group_path -name reg2reg -from [all_registers] -to [all_registers]
group_path -name in2reg -from [all_inputs] -to [all_registers]
```

---

## Common Pitfalls

### Pitfall 1: Wrong Tool Context

**Problem:** Running PT commands from within another tool.

**Solution:** Exit and start PT from shell.

```bash
exit
pt_shell -f script.tcl
```

### Pitfall 2: Missing Parasitics

**Problem:** Analyzing without parasitics gives optimistic results.

**Detection:**
```tcl
report_annotated_parasitics
```

**Solution:** Always read SPEF for signoff.

### Pitfall 3: Incomplete Constraints

**Problem:** Unconstrained paths not analyzed.

**Detection:**
```tcl
report_analysis_coverage
```

**Solution:** Ensure all paths have constraints.

### Pitfall 4: Not Checking Hold

**Problem:** Only checking setup, missing hold violations.

**Solution:**
```tcl
# Check both setup and hold
report_timing -delay_type max
report_timing -delay_type min
```

---

## Recommended Flow

```tcl
# 1. Load design
read_db design.db
link_design

# 2. Load parasitics
read_parasitics design.spef
report_annotated_parasitics

# 3. Update timing
update_timing

# 4. Reports
report_timing -max_paths 100
report_constraint -all_violators
report_analysis_coverage
report_qor

# 5. ECO (if needed)
fix_eco_timing -setup
write_changes -format dctcl -output eco.tcl
```

---

## Signoff Checklist

Before signoff, verify:

- [ ] Design loaded and linked correctly
- [ ] All clocks defined
- [ ] All constraints loaded
- [ ] Parasitics annotated (>95%)
- [ ] All corners analyzed
- [ ] Setup timing clean
- [ ] Hold timing clean
- [ ] No unconstrained paths
- [ ] Clock gating checks pass
- [ ] Analysis coverage >99%

---

## Performance Tips

### Runtime Optimization

1. **Use .db format** instead of Verilog + Liberty
2. **Use update_timing -incremental** for small changes
3. **Save/restore sessions** for large designs
4. **Use multi-threading** if available

### Memory Management

1. **Remove unused designs**
2. **Clear large collections**
3. **Use 64-bit mode**

---

## Debugging Tips

```tcl
# Check specific path
report_timing -from [get_pins ...] -to [get_pins ...]

# Check cell delays
report_delay_calculation -from ... -to ...

# Check attribute values
get_attribute [get_cell ...] <attribute>

# Check constraint source
report_constraint -verbose
```
