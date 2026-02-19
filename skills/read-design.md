---
name: read-design
description: >
  Open or restore a design in the EDA tool. Handles library/block opening in
  ICC2 (open_lib + open_block) and checkpoint restoration in Innovus
  (restoreDesign or defIn). Verifies the design loaded correctly and reports
  basic statistics (cell count, nets, area, constraints).

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path:
    synopsys: templates/synopsys/icc2_read_design.tcl
    cadence: templates/cadence/innovus_read_design.tcl
  auto_generated: false
  flexible: true
  flow_stages: [init, any]
  report_inputs:
    - design library path (ICC2) or checkpoint directory (Innovus)
  qor_metrics: [cell_count, net_count]
  triggers: ["open design", "read design", "load design", "restore design"]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `design_path` | string | required | Path to the design library (ICC2) or checkpoint directory (Innovus). |
| `library_name` | string | `""` | ICC2 library name. Auto-detected from path if empty. |
| `block_name` | string | `""` | ICC2 block name. Uses first block if empty. |
| `top_cell` | string | `""` | Innovus top cell name. Required for DEF import. |
| `load_mode` | string | `auto` | `auto` (detect format), `checkpoint` (saved session), `def` (DEF + LEF import). |
| `read_sdc` | boolean | `true` | Read timing constraints after loading design. |
| `activate_scenarios` | boolean | `true` | ICC2: activate all scenarios after opening. |

---

## Workflow

### Step 1: Validate Design Path

Check that the design path exists and determine the format.

**ICC2:**
- Look for `.nlib` directory (Synopsys library format)
- If path ends in `.nlib`, it's a library
- Check for blocks inside the library

**Innovus:**
- Look for `.enc.dat` directory (checkpoint format)
- Or `.def` file + `.lef` files (import mode)

### Step 2: Open Design

**ICC2 (Synopsys):**
```tcl
# Open the library
open_lib /path/to/design.nlib

# List available blocks
get_blocks

# Open specific block (or first available)
open_block block_name

# Activate scenarios
set scenarios [get_scenarios -active false]
if {[llength $scenarios] > 0} {
    set_active_scenarios -all
}
```

**Innovus (Cadence) - Checkpoint:**
```tcl
# Restore from checkpoint
restoreDesign /path/to/checkpoint.enc.dat top_cell
```

**Innovus (Cadence) - DEF Import:**
```tcl
# Read LEF files first
read_lef /path/to/tech.lef
read_lef /path/to/stdcell.lef

# Read DEF
defIn /path/to/design.def

# Read timing constraints
read_sdc /path/to/constraints.sdc
```

### Step 3: Verify Design Loaded

**ICC2:**
```tcl
# Check current block
current_block

# Basic design info
report_design -summary
```

**Innovus:**
```tcl
# Check design loaded
dbGet top.name

# Basic stats
dbGet top.numInsts
dbGet top.numNets
```

### Step 4: Report Design Statistics

After loading, extract and display:

| Metric | Description |
|--------|-------------|
| **Design name** | Top-level module name |
| **Cell count** | Total instances |
| **Net count** | Total nets |
| **IO count** | Primary inputs/outputs |
| **Area** | Core area if placed |
| **Constraints** | SDC loaded, number of clocks |

### Step 5: Present Summary

```
Design Loaded Successfully:
┌──────────────────────┬────────────────────┐
│ Property             │ Value              │
├──────────────────────┼────────────────────┤
│ Design               │ ibex_core          │
│ Cells                │ 18,432             │
│ Nets                 │ 19,876             │
│ IOs                  │ 156                │
│ Clocks               │ 2 (clk, jtag_clk) │
│ Scenarios            │ 4 active           │
└──────────────────────┴────────────────────┘
```

---

## Core Principles

1. **Always verify after loading** — a design that loads without error may still be
   incomplete (missing LEF, broken netlist, etc.)
2. **Activate all scenarios in ICC2** — by default ICC2 may only activate a subset
3. **Read constraints after DEF import** — SDC must be loaded separately in import flow
4. **Check for unplaced cells** — a "loaded" design may not have placement data
5. **Save immediately after loading** — create a known-good checkpoint before making changes

## What Can Go Wrong

- **Library version mismatch**: ICC2 library created with a different tool version
- **Missing LEF**: Innovus DEF import fails if tech/stdcell LEF not loaded first
- **Wrong block name**: ICC2 library may have multiple blocks, specify the right one
- **Corrupted checkpoint**: Innovus checkpoint may be incomplete if save was interrupted
- **Missing libraries**: Design references cells not in the loaded LEF/library

---

## Example Usage

```
you: open the design at /proj/ibex/checkpoints/post_route

hipilot: Let me load that design.

  📖 Detecting format... Innovus checkpoint (.enc.dat) found.

  ┌─ Tcl [✓ Template] ──────────────────────────────┐
  │ restoreDesign /proj/ibex/checkpoints/post_route  │
  │   ibex_core                                       │
  └──────────────────────────────────────────────────┘

  Source: templates/cadence/innovus_read_design.tcl

  [▶ Run]  [✎ Edit]  [💾 Save]
```

---

## Template Reference

- **Synopsys**: `templates/synopsys/icc2_read_design.tcl`
- **Cadence**: `templates/cadence/innovus_read_design.tcl`
