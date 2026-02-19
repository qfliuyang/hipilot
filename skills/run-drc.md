---
name: run-drc
description: >
  Run Design Rule Check (DRC) on a placed-and-routed design. Captures routing
  and placement violations, categorizes them by type (spacing, width, via,
  density, antenna), and proposes targeted fixes or ECO strategies. Works in
  ICC2 (check_routes + report_design), Innovus (verify_drc), and Calibre
  (external signoff). Intended for use at post-route, post-route-opt, and
  pre-tapeout stages.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path: templates/run_drc.tcl.j2
  auto_generated: false
  flexible: true
  flow_stages: [post_route, post_route_opt, signoff]
  report_inputs:
    - routed DEF or saved block
    - design rule file (TF/LEF)
  qor_metrics: [drc_total, drc_by_type, antenna_violations]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_violations` | integer | `1000` | Cap the number of violations reported. Use 0 for unlimited (slow on large designs). |
| `report_path` | string | `./reports/drc_run.rpt` | File path to write the DRC report. |
| `fix_mode` | string | `manual` | `auto` to attempt in-tool ECO fixes, `manual` to report only, `interactive` to walk through violations one by one. |
| `layer_filter` | list | `[]` | Limit DRC to specific metal layers (e.g. `[M1, M2, VIA1]`). Empty = all layers. |
| `check_antenna` | boolean | `true` | Include antenna rule check in the DRC run. |
| `check_density` | boolean | `true` | Include metal density checks (min/max fill rules). |
| `incremental` | boolean | `false` | If true, only check changed regions since last DRC run (faster for ECO iterations). |

---

## Workflow

### Step 1 — Verify design state before running DRC

DRC on an incompletely routed design produces misleading results. Confirm routing
completion before proceeding.

**ICC2:**
```tcl
# Check routing completion status
report_route_status

# Check that all nets are routed (zero unrouted)
report_route_status -summary
# Look for: "Total unrouted: 0"

# Optionally check for open nets
check_routes -open_nets
```

**Innovus:**
```tcl
# Check routing summary
report_route -summary

# Verify no unrouted connections
getUnroutedNets
# Should return: 0
```

If unrouted nets exist, complete routing before running DRC. Violations on
unrouted nets are not genuine DRC errors.

---

### Step 2 — Run in-tool DRC (fast check)

**ICC2 — primary DRC via check_routes:**
```tcl
# Full routing DRC
check_routes \
    -max_errors ${max_violations} \
    -open_nets \
    -short_nets \
    -off_grid \
    -spacing

# Write violations to file
redirect -file ${report_path} { check_routes -verbose }
```

**ICC2 — design-level DRC (placement, density, antenna):**
```tcl
report_design \
    -drc_violations \
    -antenna_violations \
    -verbose \
    > ${report_path}.design
```

**Innovus — integrated DRC:**
```tcl
# Run full DRC
verify_drc \
    -limit ${max_violations} \
    -reportFile ${report_path}

# Antenna check (separate pass)
verify_ac \
    -reportFile ${report_path}.antenna
```

---

### Step 3 — Categorize violations by type

AI will read the raw DRC report and group violations into categories. Key
categories to identify:

| Category | Typical cause | Fix strategy |
|----------|---------------|--------------|
| **Spacing** | Two wires too close on same layer | Reroute one segment; adjust spacing constraints |
| **Width** | Wire segment below minimum width | Widen segment in affected region |
| **Via** | Missing or mis-sized via | Re-route via; check via rule table |
| **Short** | Two nets touching on same layer | Reroute one net; check pin access |
| **Density** | Metal fill below minimum or above maximum | Add/remove metal fill tiles |
| **Antenna** | Long wire accumulates charge during etch | Insert antenna diode; shorten wire; move via up |
| **Off-grid** | Wire endpoint not on routing grid | Fix in router; re-snap to grid |
| **DRC-exempt** | Waived by PDK (e.g. sram macro boundary) | Mark as waived; do not attempt to fix |

**ICC2 — count by type:**
```tcl
# Summarize violation counts by rule
report_design -drc_violations -summary | grep -E "(Total|Spacing|Width|Short|Via|Antenna)"
```

**Innovus — summary table:**
```tcl
verify_drc -limit 0 -reportFile /dev/null -summary
```

---

### Step 4 — Inspect worst violation clusters

DRC violations are rarely random — they cluster in congested regions (e.g.
high-utilization areas, power domain crossings, pin access bottlenecks).

**ICC2 — show violation locations:**
```tcl
# Get violation objects for GUI inspection
set viols [get_drc_violations]
foreach_in_collection v $viols {
    set rule  [get_attribute $v rule_name]
    set layer [get_attribute $v layer_name]
    set bbox  [get_attribute $v bounding_box]
    echo "Rule: $rule  Layer: $layer  BBox: $bbox"
}
```

**Innovus — export violations for inspection:**
```tcl
# Write Tcl list of violations with coordinates
set viols [get_drc_results]
foreach v $viols {
    puts "Rule: [lindex $v 0]  Layer: [lindex $v 1]  Coord: [lindex $v 2]"
}
```

Identify: are violations concentrated in one macro's pin area? In a specific
power domain? On a specific layer pair? This guides the fix strategy.

---

### Step 5 — Apply fixes

#### Fix mode: auto

**ICC2 — attempt automatic ECO re-route:**
```tcl
# Re-route violating segments (preserves non-violating routes)
route_eco \
    -fix_drc_violations \
    -max_detail_route_iterations 3

# Re-check after fix
check_routes -verbose > ${report_path}.after_eco
```

**Innovus — targeted re-route:**
```tcl
# Route only DRC-violating nets
routeDesign -globalDetail -viaOpt -wireOpt -fixDRC
verify_drc -limit ${max_violations} -reportFile ${report_path}.after_eco
```

#### Fix mode: manual

For spacing and width violations, identify the violating net and adjust:

**ICC2:**
```tcl
# Force re-route a specific net
route_detail -nets [get_nets u_core/data_bus[3]] \
             -fix_drc true
```

**Innovus:**
```tcl
# Re-route a specific net with DRC-clean target
sroute -nets {u_core/data_bus[3]} -fixDRC 1
```

#### Antenna fixes

**ICC2:**
```tcl
# Insert diode on violating wire
insert_antenna_diode \
    -nets [get_nets ${antenna_net}] \
    -cell sky130_fd_sc_hd__diode_2 \
    -location adjacent_pin
```

**Innovus:**
```tcl
# Auto-insert antenna diodes
addAntennaFix -all
```

---

### Step 6 — Density violations (metal fill)

Density violations require adding or trimming metal fill tiles, not re-routing
signal nets.

**ICC2:**
```tcl
# Remove all existing fill and re-compute
remove_metal_fill [get_metal_fills *]

# Add fill respecting density rules
create_metal_fill \
    -layers {M1 M2 M3 M4 M5 M6 M7 M8} \
    -non_uniform_fill true \
    -with_drc_check
```

**Innovus:**
```tcl
# Delete and re-run fill
deleteFiller -cell {FILL1 FILL2 FILL4 FILL8 FILL16 FILL32 FILL64}
addFiller -cell {FILL64 FILL32 FILL16 FILL8 FILL4 FILL2 FILL1} \
          -prefix FILL
```

---

### Step 7 — Re-run DRC and compare

After fixes, re-run the full DRC and compare violation counts.

**ICC2:**
```tcl
check_routes -max_errors ${max_violations} > ${report_path}.final
report_design -drc_violations -summary
```

**Innovus:**
```tcl
verify_drc -limit ${max_violations} -reportFile ${report_path}.final
```

Compare: `violations_before` vs `violations_after`. Target is zero violations
for tapeout. For intermediate stages, track the trend — each iteration should
reduce count by at least 50%. If count is not falling, escalate to a layout
engineer for manual intervention.

---

### Step 8 — Save checkpoint after clean DRC

**ICC2:**
```tcl
save_block -as post_drc_clean
```

**Innovus:**
```tcl
saveDesign ./checkpoints/post_drc_clean.enc
```

---

## Core Principles

1. **Never run DRC on an incompletely routed design.** Unrouted nets produce
   false opens and shorts. Confirm routing completion first (Step 1).

2. **Fix by category, not by count.** Fixing 10 shorts is more valuable than
   fixing 50 spacing violations. Shorts block LVS; spacing violations may be
   waivable. Prioritize shorts > opens > spacing > density.

3. **Antenna violations are parasitic, not routing errors.** They cannot be
   fixed by re-routing alone — you need either a diode or a via-up strategy
   (connect to a higher metal layer early in the wire). Understand the rule
   before applying the fix.

4. **DRC waivers must be documented.** Any violation marked as waived (sram
   macro boundary violations, seal ring rules) must be recorded with the PDK
   rule number, the justification, and the engineer who approved it.

5. **Calibre is the signoff authority.** ICC2 `check_routes` and Innovus
   `verify_drc` are implementation checkers — they catch most violations but
   are not the legal signoff. Always run Calibre DRC before tapeout.

6. **Incremental DRC saves time on ECO iterations.** After fixing violations
   in a local area, use `incremental: true` to re-check only the changed
   region instead of the full chip.

---

## What Can Go Wrong

- **DRC count goes up after re-route.** The router fixed one violation but
  introduced others in adjacent areas. Run global DRC again and look for
  new violation clusters near the fix area.
- **Antenna diode placement fails.** The area near the pin is full. Try
  `adjacent_cell` instead of `adjacent_pin`, or shorten the wire by moving
  to a via on a higher metal layer earlier.
- **Density violations persist after fill.** Check if a power or blockage
  region is preventing fill. Verify the fill pattern covers the violating
  tile. Also check that routing blockages are not masking as fill-able area.
- **`check_routes` reports zero violations but Calibre finds violations.**
  This happens when the in-tool DRC rule deck is not synchronized with the
  PDK DRC deck. Always run Calibre before tapeout — treat in-tool DRC as a
  fast sanity check only.
- **Off-grid violations in macros.** SRAM and IP macros sometimes have pins
  at non-standard grid points. These require routing to a via at the macro
  boundary, not re-routing the macro internals. Check the macro integration
  guide for correct access patterns.

---

## Example Usage

```
/run-drc

# or with parameters:
/run-drc max_violations=500 fix_mode=auto report_path=./reports/drc_postroute.rpt
/run-drc fix_mode=manual check_antenna=true incremental=false
```

**Typical session dialogue:**

> "I finished routing. Can you run DRC and tell me how bad it is?"

HiPilot will:
1. Check routing completion (zero unrouted nets)
2. Run `check_routes` (ICC2) or `verify_drc` (Innovus)
3. Read raw output and categorize by rule type
4. Show a summary table: shorts=3, spacing=47, antenna=12, density=0
5. Identify the worst cluster (e.g. "47 spacing violations in top-left macro pin area")
6. Propose fix strategy: auto re-route + antenna diode insertion
7. After approval, send fix Tcl to EDA pane and report new violation count

---

## Lessons Learned (from real tapeout experience)

- On sky130hd, the most common post-route DRC failure is M1 spacing violation
  near standard cell pin access. Innovus `routeDesign -viaOpt` reduces these
  significantly before the final DRC run.
- Antenna violations on sky130hd: use the `sky130_fd_sc_hd__diode_2` cell.
  The PDK ships antenna diode cells specifically for this — do not improvise
  with other structures.
- Calibre DRC on the Ibex design (sky130hd) typically finds 5–15% more
  violations than Innovus `verify_drc`. Plan for a Calibre cleanup pass even
  if Innovus reports clean.
- After metal fill, always run DRC one more time — fill cells sometimes
  violate spacing rules against signal wires in congested regions.
