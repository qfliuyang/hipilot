# Innovus Best Practices

Recommended workflows and common pitfalls for Cadence Innovus.

## LEF Loading Order

**Rule:** Always load Tech LEF (.tlef) before cell LEFs (.lef)

**Rationale:** Tech LEF defines layers that cell LEFs reference. Loading cell LEFs first causes IMPLF-53 errors.

**Correct:**
```tcl
set init_lef_file "tech.tlef cells.lef"
```

**Incorrect:**
```tcl
set init_lef_file "cells.lef tech.tlef"
```

**Check:** Verify layer definitions exist before cell LEF load.

---

## Core Utilization Targets

**Rule:** Target 65-75% core utilization for initial floorplan

**Rationale:** Leaves room for:
- Optimization and sizing
- Clock tree synthesis buffers
- ECO changes
- Routing resources

**Recommended:**
```tcl
# Good starting point
floorPlan -site unit -su 1.0 0.70 10 10 10 10
```

**Too High (>85%):**
- Congestion issues
- Poor routability
- Timing closure difficult

**Too Low (<50%):**
- Wasted area
- Longer wire lengths
- Slower design

---

## Path Groups

**Rule:** Create path groups before placement for better QoR

**Rationale:** Helps tool prioritize critical paths during optimization.

**Recommended:**
```tcl
# Clear existing
clearPathGroups

# Create basic groups
createBasicPathGroups -expanded

# Or manual groups
group_path -name reg2reg -from [all_registers] -to [all_registers]
group_path -name in2reg -from [all_inputs] -to [all_registers]
group_path -name reg2out -from [all_registers] -to [all_outputs]
```

---

## Clock Tree Synthesis (CTS)

### NDR Rules

**Rule:** Apply Non-Default Rules for clock nets

**Rationale:** Improves clock skew and reduces crosstalk.

**Implementation:**
```tcl
set_ccopt_property use_default_ndr false
set_ccopt_property target_max_trans 0.1
set_ccopt_property target_skew 0.05
```

### Clock Spec

**Rule:** Always create clock tree spec before CTS

```tcl
create_ccopt_clock_tree_spec
ccopt_design
```

---

## Power Planning

### Stripe Spacing

**Rule:** Balance stripe density with routing resources

**Guidelines:**
- Wider spacing for lower power density
- Narrower spacing for high power density
- Consider IR drop requirements

**Example:**
```tcl
# For 1000um wide design with 40um pitch
addStripe -nets {VDD VSS} -layer M4 -direction vertical \
  -width 2.0 -spacing 1.0 -set_to_set_distance 40.0
```

### Power Connections

**Rule:** Connect power/ground to all instances

**Complete Setup:**
```tcl
# Connect to all instances
globalNetConnect VDD -type pgpin -pin VDD -inst *
globalNetConnect VSS -type pgpin -pin VSS -inst *

# Connect tie cells
globalNetConnect VDD -type tiehi -inst *
globalNetConnect VSS -type tielo -inst *

# Route standard cell pins
sroute -nets {VDD VSS} -connect {corePin}

# Route macro pins
sroute -nets {VDD VSS} -connect {blockPin}
```

---

## Optimization Settings

### Effort Levels

| Stage | Effort | Notes |
|-------|--------|-------|
| Initial placement | medium | Fast iteration |
| Final placement | high | Best QoR |
| Pre-CTS | medium | Balance runtime/quality |
| Post-route | high | Final optimization |

### DRC Fixing

**Rule:** Enable DRC fixing during optimization

```tcl
setOptMode -fixDRC true
setOptMode -fixCap true
setOptMode -fixTran true
```

---

## Common Pitfalls

### Pitfall 1: Wrong Tool Order

**Problem:** Trying to run Innovus commands from within another EDA tool.

**Solution:** Exit current tool, start Innovus from shell.

```tcl
# Exit current tool first
exit

# Then start Innovus
innovus -no_gui
```

### Pitfall 2: Missing MMMC Setup

**Problem:** Single-corner optimization leads to signoff failures.

**Solution:** Always use multi-corner multi-mode (MMMC) setup.

```tcl
# MMMC file should define:
# - PVT corners (ss, tt, ff)
# - Operating modes (func, test)
# - Delay corners
# - Constraint modes
```

### Pitfall 3: Over-optimization

**Problem:** Running too many optimization passes wastes time with diminishing returns.

**Solution:**
- Monitor QoR improvement
- Stop when improvement < 1%
- Use `-incremental` for fine-tuning

### Pitfall 4: Ignoring Warnings

**Problem:** Warnings about constraints or missing files are ignored.

**Solution:** Review all warnings, fix those related to:
- Timing constraints
- Library setup
- Design connectivity

---

## Recommended Flow

```tcl
# 1. Design Initialization
set init_verilog "design.v"
set init_lef_file "tech.tlef cells.lef"
set init_top_cell "top"
set init_mmmc_file "mmmc.tcl"
init_design
source constraints.sdc

# 2. Floorplan
floorPlan -site unit -su 1.0 0.70 10 10 10 10
placeInstance macros...
addHaloToBlock ...

# 3. Power Planning
globalNetConnect VDD -type pgpin -pin VDD -inst *
globalNetConnect VSS -type pgpin -pin VSS -inst *
addStripe -nets {VDD VSS} -layer M4 ...
sroute -nets {VDD VSS} -connect {corePin blockPin}

# 4. Placement
createBasicPathGroups -expanded
place_opt_design
saveDesign placed.enc

# 5. CTS
create_ccopt_clock_tree_spec
set_ccopt_property use_default_ndr false
ccopt_design
saveDesign cts.enc

# 6. Routing
routeDesign
verify_drc
saveDesign routed.enc

# 7. Export
streamOut design.gds
saveNetlist design.v
```

---

## Performance Tips

### Runtime Optimization

1. **Use `-no_gui`** for batch runs
2. **Set effort levels** appropriately per stage
3. **Save checkpoints** to resume from failures
4. **Parallel processing:** Use multi-threading where available

### Memory Management

1. **Close designs** when done: `closeDesign`
2. **Clear large collections** after use
3. **Use 64-bit executable** for large designs

---

## QoR Checklist

Before signoff, verify:

- [ ] Timing constraints complete and loaded
- [ ] All path groups defined
- [ ] Clocks properly constrained
- [ ] No DRC violations
- [ ] No LVS violations
- [ ] Power analysis complete
- [ ] Antenna checks pass
- [ ] Density within target
- [ ] All macros legally placed
- [ ] IO placement correct
