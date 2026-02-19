---
name: save-design
description: >
  Save the current design state as a named checkpoint. Creates a labeled
  snapshot with timestamp, captures QoR metrics (timing, DRC, area) at the
  save point for later comparison. Supports ICC2 (save_block) and Innovus
  (saveDesign) with optional export of DEF, Verilog, or GDS.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path:
    synopsys: templates/synopsys/icc2_save_design.tcl
    cadence: templates/cadence/innovus_save_design.tcl
  auto_generated: false
  flexible: true
  flow_stages: [any]
  report_inputs:
    - current open design with modifications
  qor_metrics: [wns, tns, drc_total, area]
  triggers: ["save design", "write checkpoint", "save block", "checkpoint"]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `checkpoint_name` | string | `auto` | Name for the checkpoint. `auto` generates from timestamp (e.g., `post_route_20260219_1430`). |
| `save_path` | string | `./checkpoints/` | Directory to save the checkpoint. |
| `include_reports` | boolean | `true` | Run and save timing/DRC/area reports alongside the checkpoint. |
| `export_def` | boolean | `false` | Also export DEF file. |
| `export_verilog` | boolean | `false` | Also export gate-level Verilog netlist. |
| `export_gds` | boolean | `false` | Also export GDS stream (for tapeout). |
| `label` | string | `""` | Human-readable label describing what changed (e.g., "after hold fix"). |

---

## Workflow

### Step 1: Verify Design State

Confirm a design is open and has been modified.

**ICC2:**
```tcl
current_block
# Check for unsaved changes
report_design -summary
```

**Innovus:**
```tcl
dbGet top.name
```

### Step 2: Generate Checkpoint Name

If `checkpoint_name` is `auto`, generate from flow stage and timestamp:

```
Format: {stage}_{YYYYMMDD}_{HHMM}
Example: post_route_20260219_1430
```

### Step 3: Capture QoR Before Save

If `include_reports` is true, run quick reports to snapshot the current QoR:

**Timing:**
```tcl
# ICC2
report_timing -max_paths 10 > ${save_path}/${checkpoint_name}_timing.rpt
report_qor > ${save_path}/${checkpoint_name}_qor.rpt

# Innovus
timeDesign -postRoute > ${save_path}/${checkpoint_name}_timing.rpt
```

**DRC:**
```tcl
# ICC2
check_routes > ${save_path}/${checkpoint_name}_drc.rpt

# Innovus
verify_drc > ${save_path}/${checkpoint_name}_drc.rpt
```

### Step 4: Save Checkpoint

**ICC2 (Synopsys):**
```tcl
# Save block with new name
save_block -as ${checkpoint_name}

# Or save to specific path
save_block -as ${checkpoint_name} -label "${label}"
```

**Innovus (Cadence):**
```tcl
# Save design checkpoint
saveDesign ${save_path}/${checkpoint_name}.enc.dat
```

### Step 5: Optional Exports

If requested, export additional formats:

```tcl
# DEF export
# ICC2: write_def ${save_path}/${checkpoint_name}.def
# Innovus: defOut ${save_path}/${checkpoint_name}.def

# Verilog export
# ICC2: write_verilog ${save_path}/${checkpoint_name}.v
# Innovus: saveNetlist ${save_path}/${checkpoint_name}.v

# GDS export
# ICC2: write_gds ${save_path}/${checkpoint_name}.gds
# Innovus: streamOut ${save_path}/${checkpoint_name}.gds
```

### Step 6: Write Manifest

Create a CHECKPOINT_INFO.txt file with metadata:

```
Checkpoint: post_route_20260219_1430
Label: after hold fix on pcie_rx
Saved: 2026-02-19 14:30:45
Tool: ICC2 T-2022.03
Design: ibex_core
WNS: -0.012 ns
TNS: -0.089 ns
DRC: 3 violations
Area: 245,000 µm²
Restore: open_lib design.nlib ; open_block post_route_20260219_1430
```

---

## Core Principles

1. **Always save before major changes** — checkpoint before each optimization step
2. **Name checkpoints meaningfully** — `post_cts_hold_fix` is better than `checkpoint_3`
3. **Include reports at save time** — QoR captured at save enables later comparison
4. **Don't overwrite previous checkpoints** — always save_block -as with new name
5. **Disk space awareness** — ICC2 blocks can be large (GBs), prune old checkpoints

## What Can Go Wrong

- **Disk space**: Save fails silently if disk is full — always check return status
- **Permission issues**: Save directory not writable
- **Name collision**: Checkpoint name already exists (ICC2 will error, Innovus may overwrite)
- **Incomplete save**: Interrupted save = corrupted checkpoint, always verify
- **Large designs**: Saving can take minutes for large designs, be patient

---

## Example Usage

```
you: save a checkpoint called "after_hold_fix"

hipilot: Saving design checkpoint with QoR snapshot.

  ┌─ Tcl [✓ Template] ──────────────────────────────┐
  │ # Save checkpoint: after_hold_fix                 │
  │ save_block -as after_hold_fix                     │
  │                                                    │
  │ # QoR snapshot                                     │
  │ report_timing -max_paths 10 \                      │
  │   > checkpoints/after_hold_fix_timing.rpt          │
  │ check_routes \                                     │
  │   > checkpoints/after_hold_fix_drc.rpt             │
  └──────────────────────────────────────────────────┘

  Source: templates/synopsys/icc2_save_design.tcl

  [▶ Run]  [✎ Edit]  [💾 Save]
```

---

## Template Reference

- **Synopsys**: `templates/synopsys/icc2_save_design.tcl`
- **Cadence**: `templates/cadence/innovus_save_design.tcl`
