# IC Compiler II Best Practices

Recommended workflows and common pitfalls for Synopsys IC Compiler II.

## Library Management

**Rule:** Use .nlib format for designs

**Rationale:** Binary format is faster and more compact than ASCII.

**Workflow:**
```tcl
# Create library once
create_lib design.nlib -technology tech.tf

# Reuse for subsequent sessions
open_lib design.nlib
```

---

## Design Initialization

**Rule:** Load all data before floorplanning

**Correct Order:**
```tcl
open_lib design.nlib
open_block top

# Load netlist if not already in library
read_verilog design.v

# Load constraints
read_sdc constraints.sdc

# Now proceed to floorplan
initialize_floorplan ...
```

---

## Floorplanning

**Rule:** Define core utilization 65-75%

**Rationale:** Leaves room for optimization and routing.

**Example:**
```tcl
# Calculate based on cell area
# If cell area = 50000 um^2, target 70% utilization
# Core area = 50000 / 0.70 = ~71400 um^2
# For square: side = sqrt(71400) = ~267 um

initialize_floorplan -shape rectangular -side_length {300 250}
```

---

## Power Planning

**Rule:** Create robust power mesh early

**Benefits:**
- Better IR drop characteristics
- Easier ECOs later

**Recommended:**
```tcl
# Create power mesh before placement
create_pg_mesh ...

# Connect all instances
connect_pg_net -net VDD -pin VDD -inst *
connect_pg_net -net VSS -pin VSS -inst *
```

---

## Placement Strategy

**Rule:** Use timing and congestion-driven placement

**Implementation:**
```tcl
create_placement -timing_driven -congestion_driven -effort high
```

**Follow-up:**
```tcl
# Legalize and optimize
legalize_placement
place_opt
```

---

## Clock Tree Synthesis

**Rule:** Use high effort for CTS

**Implementation:**
```tcl
# Pre-CTS optimization
place_opt

# CTS with high effort
clock_opt -effort high

# Post-CTS optimization
route_opt
```

---

## Routing Strategy

**Rule:** Use route_auto for complete flow

**Implementation:**
```tcl
# Complete routing
route_auto -effort high

# Check and fix
verify_drc
check_routes
```

**Incremental:**
```tcl
# For small ECOs
route_eco
```

---

## Common Pitfalls

### Pitfall 1: Wrong Tool Context

**Problem:** Running ICC2 commands from within another tool.

**Solution:** Exit and start ICC2 from shell.

```bash
exit
icc2_shell -f script.tcl
```

### Pitfall 2: Missing Block Save

**Problem:** Forgetting to save block before exit.

**Prevention:**
```tcl
# Save after major stages
save_block -as placed
save_block -as cts
save_block -as routed
```

### Pitfall 3: Not Checking Design

**Problem:** Proceeding without checking for errors.

**Prevention:**
```tcl
# Check after each major stage
check_design
```

### Pitfall 4: Ignoring Congestion

**Problem:** High congestion causing routing failures.

**Detection:**
```tcl
report_congestion
```

**Solution:**
```tcl
create_placement -congestion_driven
```

---

## Recommended Flow

```tcl
# 1. Setup
open_lib design.nlib
open_block top
read_sdc constraints.sdc

# 2. Floorplan
initialize_floorplan -shape rectangular -side_length {1000 800}
place_macro -macro ...
create_placement_blockage ...

# 3. Power
create_pg_mesh ...
connect_pg_net ...

# 4. Placement
create_placement -timing_driven -congestion_driven
place_opt
save_block -as placed

# 5. CTS
clock_opt -effort high
save_block -as cts

# 6. Routing
route_auto -effort high
save_block -as routed

# 7. Verification
check_design
check_routes
verify_drc

# 8. Reports
report_timing
report_power
report_qor
```

---

## Performance Tips

### Runtime Optimization

1. **Use binary .nlib** instead of ASCII
2. **Set appropriate effort levels**
3. **Save checkpoints** to resume
4. **Use multi-threading** if available

### Memory Management

1. **Close unused libraries**
2. **Clear large collections**
3. **Use 64-bit mode**

---

## QoR Checklist

Before signoff, verify:

- [ ] Library and block opened correctly
- [ ] Constraints loaded and valid
- [ ] Floorplan meets area targets
- [ ] Power grid complete
- [ ] Placement legalized
- [ ] CTS complete with acceptable skew
- [ ] Routing complete
- [ ] No DRC violations
- [ ] Timing constraints met
- [ ] Power within budget
- [ ] Design checked for errors
