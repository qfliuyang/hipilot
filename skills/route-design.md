---
name: route-design
description: >
  Route a placed design through global route, track assignment, detail
  route, DRC clean-up, antenna fixing, and post-route optimization. Covers
  both ICC2 and Innovus routing flows, congestion handling, timing-driven
  routing options, and the iterative DRC/antenna fixing loop required before
  signoff.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path:
    synopsys: templates/synopsys/icc2_route_design.tcl
    cadence: templates/cadence/innovus_route_design.tcl
  auto_generated: false
  flexible: true
  flow_stages: [post_cts, routing]
  report_inputs:
    - placement congestion report
    - post-CTS timing report (WNS/TNS baseline)
  qor_metrics: [DRC_count, antenna_count, post_route_WNS, post_route_TNS, total_wirelength]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `routing_effort` | string | `medium` | `low`, `medium`, or `high`. Higher effort = longer runtime but better QoR. |
| `timing_driven` | boolean | `true` | Enable timing-driven routing. Should always be true for timing-critical designs. |
| `congestion_driven` | boolean | `true` | Enable congestion-driven GR. Recommended when utilization > 70%. |
| `max_drc_iterations` | integer | `5` | Number of DRC fixing loops before stopping. |
| `fix_antenna` | boolean | `true` | Run antenna fixing after detail route. |
| `target_drc` | integer | `0` | Target DRC violation count. 0 = DRC clean. |
| `post_route_opt` | boolean | `true` | Run post-route optimization (timing, SI) after routing. |
| `layer_range` | string | `"M1:M9"` | Routing layer range. Adjust to match your PDK stackup. |

---

## Workflow

### Step 1 — Pre-route checklist

Verify the design is ready for routing. Routing on a bad placement or with open DRC will produce poor results.

**ICC2:**
```tcl
# Confirm placement is legalized
check_legality

# Check for pre-existing DRC (should be clean except for unrouted nets)
verify_drc -check_only

# Confirm power grid is intact
verify_pg_nets

# Check no floating power/ground pins
check_mv_design -verbose

# Baseline timing before routing
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.5
```

**Innovus:**
```tcl
# Check placement
checkPlace

# Verify power connections
verifyPowerVia

# Baseline timing
report_timing -max_paths 1 -path_type summary -slack_lesser_than 0.5

# Check congestion from placement
reportCongestion
```

**Pass criteria before routing:**
- [ ] Zero illegal placements
- [ ] Power grid passes verification
- [ ] Post-CTS WNS is known (document it — compare after routing)
- [ ] Congestion hotspots identified (any >90% GCell utilization)

---

### Step 2 — Global route (GR)

Global route assigns nets to routing regions (GCells) without placing actual wires. It detects congestion early and guides detail routing.

**ICC2:**
```tcl
# Run global route with congestion analysis
route_global -effort medium \
             -timing_driven true \
             -congestion_driven true \
             -xtalk_reduction true

# Report congestion — examine before proceeding to detail route
report_route_info -summary
report_congestion -gcell_summary
```

**Innovus:**
```tcl
# Global route
globalDetailRoute -mode global

# Check congestion
reportCongestion -hotspot
```

**Interpreting congestion:**

| GCell utilization | Action |
|------------------|--------|
| < 80% | Good — proceed to detail route |
| 80–90% | Moderate — consider `-congestion_effort high` |
| 90–95% | High — resolve before detail route; consider placement adjustment |
| > 95% | Overflow — routing will fail; must fix placement or change floorplan |

If congestion hotspots appear:
```tcl
# ICC2: identify which nets are causing congestion
report_net_fanout -threshold 20
report_congestion -gcell_hotspots -max_count 20

# ICC2: try spreading cells in the congested area
refine_placement -effort high -congestion_area {x1 y1 x2 y2}
```

---

### Step 3 — Track assignment (ICC2 only)

ICC2 has an explicit track assignment step between global and detail route. Innovus merges this into `globalDetailRoute`.

**ICC2:**
```tcl
route_track -effort medium \
            -timing_driven true

# Check intermediate state
report_route_info -summary
```

Track assignment assigns nets to specific routing tracks. It catches overflow before the more expensive detail route. If `route_track` reports high overflow, go back and fix congestion before proceeding.

---

### Step 4 — Detail route

Detail route places actual wires, vias, and fills in all routing details.

**ICC2:**
```tcl
route_detail -effort medium \
             -timing_driven true \
             -xtalk_reduction true \
             -max_number_iterations 10

# Report routing completion
report_route_info -summary
```

**ICC2 — timing-focused detail route:**
```tcl
# Use timing-driven detail route with higher effort for critical paths
route_detail -effort high \
             -timing_driven true \
             -timing_effort high \
             -xtalk_reduction true \
             -max_number_iterations 15
```

**Innovus:**
```tcl
# Combined global + detail route (standard flow)
routeDesign -globalDetail \
            -viaOpt \
            -wireOpt

# Or stage by stage:
globalDetailRoute -mode global
globalDetailRoute -mode track
globalDetailRoute -mode detail
```

**After detail route — check completeness:**
```tcl
# ICC2
report_route_info -summary
# Look for: "Number of unrouted connections: 0"

# Innovus
verify_drc -limit 1000
verifyConnectivity -nets all -type special
```

---

### Step 5 — DRC verification and fixing

After detail route, verify Design Rule Checks and fix violations iteratively.

**ICC2:**
```tcl
# Full DRC check
verify_drc -check_only

# Report DRC count
report_drc -summary

# Automatic DRC fixing loop
set iter 0
while {[get_drc_count] > 0 && $iter < 5} {
    incr iter
    echo "DRC fix iteration $iter"

    route_detail -effort high \
                 -timing_driven true \
                 -incremental true \
                 -fix_drc true

    verify_drc -check_only
    report_drc -summary
}
```

**Innovus:**
```tcl
# DRC check
verify_drc -report ./reports/drc_post_route.rpt

# Automatic DRC fixing (Innovus handles this in the routing flow)
setNanoRouteMode -routeWithDrc 1 \
                 -routeWithTimingDriven 1

# Re-run detail route with DRC fix focus
routeDesign -wireOpt

# Final DRC check
verify_drc -report ./reports/drc_iter1.rpt
```

**Common DRC violations and fixes:**

| DRC type | Typical cause | Fix |
|----------|--------------|-----|
| Spacing violation | Two wires too close | Re-route with wider spacing constraint |
| Width violation | Wire narrower than minimum | Increase minimum width via route settings |
| Via enclosure violation | Via not surrounded by enough metal | Use larger via or adjust layer assignment |
| End-of-line (EOL) spacing | Short wire ends too close | Reroute or merge segments |
| Min area violation | Stub too small | Add metal fill or reroute |
| Notch violation | Concave area in metal polygon | Reshape with wider routing |

**If DRC count is not reducing after 3 iterations:**
```tcl
# ICC2: identify persistent violating nets
report_drc -verbose -max_count 50 > /tmp/persistent_drc.rpt

# Try routing the violating nets with relaxed constraints
route_detail -fix_drc true \
             -effort high \
             -nets [list net1 net2 net3]  ;# target specific nets
```

---

### Step 6 — Antenna fixing

Antenna violations occur when long metal segments charge up during plasma etch and damage gate oxide. Fix after DRC is clean (or mostly clean).

**ICC2:**
```tcl
# Check antenna violations
check_antenna

# Report count
report_antenna -summary

# Automatic antenna fix (inserts diodes or re-routes jumpers)
fix_antenna -diode_cell sky130_fd_sc_hd__diode_2 \
            -diode_pin DIODE \
            -net_pin_reference VPWR \
            -verbose

# Re-check
check_antenna
```

**Innovus:**
```tcl
# Check and fix antenna
verify_antenna -report ./reports/antenna_pre_fix.rpt

# Fix using antenna diode insertion
setNanoRouteMode -routeInsertAntennaDiode 1 \
                 -routeAntennaCellName "sky130_fd_sc_hd__diode_2"

addAntennaIgnoreLayer -layer met1

# Re-route with antenna fixing
routeDesign -wireOpt

# Verify
verify_antenna -report ./reports/antenna_post_fix.rpt
```

**Antenna fix strategy:**
1. **Diode insertion (preferred):** Insert an antenna diode cell at the gate input. This is the cleanest fix — no routing change, just an extra cell.
2. **Metal jumper (if no diode available):** Route the net on a higher metal layer to break the antenna ratio. More complex and may introduce routing congestion.
3. **Re-route:** Force the router to find an alternative path. Use as a last resort.

**Diode cell selection for sky130hd:**
- `sky130_fd_sc_hd__diode_2` — standard antenna protection diode
- Place at gate input pins with high antenna ratio (> 400:1)

---

### Step 7 — Post-route timing verification

After routing, run timing to check how routing has affected WNS/TNS. Routing adds real RC parasitics that change timing.

**ICC2:**
```tcl
# Extract RC parasitics (if not auto-extracted)
extract_rc -coupling_cap true

# Update timing with real parasitics
update_timing -full

# Compare against post-CTS baseline
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.5 \
              > /tmp/timing_post_route.rpt

# Detailed report of any new violations
report_timing -scenario func_ss_125c \
              -max_paths 50 \
              -slack_lesser_than 0.0 \
              -input_pins -nets -transition_time
```

**Innovus:**
```tcl
timeDesign -postRoute \
           -pathReports \
           -dataReports \
           -outDir ./timing_rpt/post_route
```

**Expected WNS change after routing:**
- Routing typically degrades WNS by 0.05–0.15 ns versus post-CTS (real RC parasitic vs. estimated)
- If WNS degrades more than 0.3 ns, routing congestion is causing long detours on critical paths
- Check which paths degraded most — they will point to congested routing regions

---

### Step 8 — Post-route optimization

After routing is stable and DRC is clean (or near-clean), run post-route optimization to recover timing and reduce signal integrity issues.

**ICC2:**
```tcl
# Post-route optimization (timing + SI)
route_opt -effort medium \
          -timing_driven true \
          -xtalk_reduction true

# Check that DRC has not been re-introduced
verify_drc -check_only
report_drc -summary
```

**ICC2 — targeted setup fix post-route:**
```tcl
# Only fix setup, preserve hold
route_opt -effort medium \
          -timing_driven true \
          -setup_fixing true \
          -hold_fixing false
```

**Innovus:**
```tcl
setOptMode -fixDRC true \
           -fixFanoutLoad true \
           -holdTargetSlack 0.0 \
           -setupTargetSlack 0.05

optDesign -postRoute -setup

# If hold violations exist after setup opt:
optDesign -postRoute -hold
```

**After post-route opt — re-verify DRC:**
```tcl
# ICC2
verify_drc -check_only
check_antenna

# Innovus
verify_drc -report ./reports/drc_post_opt.rpt
verify_antenna
```

---

### Step 9 — Filler cell insertion

After routing and optimization are complete, insert filler cells to satisfy N-well continuity and metal density rules.

**ICC2:**
```tcl
create_stdcell_filler \
    -cell_without_metal "sky130_fd_sc_hd__fill_1 sky130_fd_sc_hd__fill_2" \
    -cell_with_metal "sky130_fd_sc_hd__tapvpwrvgnd_1" \
    -connect_to_power VDD \
    -connect_to_ground VSS

# Verify no gaps remain
verify_filler_cells
```

**Innovus:**
```tcl
addFiller -cell "sky130_fd_sc_hd__fill_1 sky130_fd_sc_hd__fill_2 sky130_fd_sc_hd__tapvpwrvgnd_1" \
          -prefix FILL

# Check for gaps
checkFiller
```

---

### Step 10 — Final routing verification and checkpoint

**ICC2:**
```tcl
# Final DRC
verify_drc -check_only
report_drc -summary

# Final antenna
check_antenna
report_antenna -summary

# Final connectivity
verify_connectivity -nets all -error_limit 100

# Final timing summary
update_timing -full
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.5

# Save
save_block -as post_route
write_gds -layer_map ./mapfiles/icc2_to_gds.map \
          ./outputs/design_post_route.gds
write_verilog -hierarchy ./outputs/netlist_post_route.v
```

**Innovus:**
```tcl
# Final checks
verify_drc -report ./reports/drc_final.rpt
verify_antenna -report ./reports/antenna_final.rpt
verifyConnectivity

# Final timing
timeDesign -postRoute -pathReports -outDir ./timing_rpt/final

# Save
saveDesign ./checkpoints/post_route.enc
streamOut -mapFile ./mapfiles/innovus_to_gds.map \
          -libName DesignLib \
          ./outputs/design_post_route.gds
```

---

## Core Principles

1. **Global route before detail route.** Never skip global route to "save time." GR catches congestion issues cheaply. Detail route on a congested placement will fail or produce massive DRC counts.

2. **Timing-driven routing is always on.** Unless you are doing a prototype with no timing constraints, always enable timing-driven routing. The overhead is small (10–15% runtime) and the improvement is significant for critical paths.

3. **DRC must reach zero before signoff.** Every DRC violation is a potential manufacturing defect. There is no acceptable DRC count for tapeout. Drive to zero, not to "fewer than last time."

4. **Antenna check after every routing change.** Antenna violations are introduced any time you change or add metal. Check and fix after each routing optimization step, not just at the end.

5. **Post-route timing is the truth.** Post-CTS timing uses estimated parasitics. Only after routing with real RC extraction do you have accurate timing. Never sign off on post-CTS timing alone.

6. **Post-route opt can re-introduce DRC.** Every cell sizing or buffer insertion during `route_opt` moves cells and can re-introduce DRC violations. Always re-verify DRC after any optimization.

7. **Filler cells last.** Insert fillers only after all ECOs and optimizations are done. Inserting fillers before optimization means you will need to remove and re-insert them after every ECO.

---

## What Can Go Wrong

- **Unrouted connections after detail route.** Check `report_route_info` for "unrouted" count. Caused by: too-tight spacing constraints, extreme congestion, or blocked routing layers. Fix by relaxing non-critical spacing rules or adjusting placement.
- **DRC count increases after `route_opt`.** Post-route optimization moves cells. Re-run DRC after every `route_opt` call. If DRC increases, reduce the effort level or add `-fix_drc true` explicitly.
- **Antenna violations not going away.** Check if the diode cell is in the `dont_use` list. Also verify that the diode cell is placed physically adjacent to the gate it is protecting (long connection from diode to gate creates its own antenna).
- **Routing runtime too long.** For large designs, set `-max_number_iterations 5` first. Run a quick pass to check convergence, then increase iterations for the final clean run.
- **Signal integrity (SI) violations post-route.** Crosstalk-induced glitches or delay. Run `route_opt -xtalk_reduction true` or use Innovus `optDesign -postRoute -si`. Check with `report_si` (ICC2) or `signalIntegrity` (Innovus).
- **Timing worse after routing than post-CTS by > 0.3 ns.** Indicates congestion forcing routing detours on critical paths. Report congestion, identify hotspots, and consider partial re-placement of the congested area before re-routing.

---

## Example Usage

```
/route-design

# or with parameters:
/route-design routing_effort=high timing_driven=true max_drc_iterations=5
/route-design routing_effort=medium fix_antenna=true post_route_opt=true
```

**Typical session dialogue:**

> "My design is placed and CTS is done. WNS is -0.08 ns post-CTS. I'm ready to route. Utilization is about 72%."

HiPilot will:
1. Run pre-route checklist (legality, power grid, congestion)
2. Execute `route_global` and report congestion — pause if > 90% GCell utilization detected
3. Run `route_track` (ICC2) then `route_detail` (or `routeDesign` in Innovus)
4. Parse DRC count, run fix loop up to `max_drc_iterations`
5. Run antenna check and fix with `sky130_fd_sc_hd__diode_2`
6. Run post-route timing, compare WNS against the post-CTS baseline of -0.08 ns
7. Run `route_opt` / `optDesign -postRoute` if timing degraded more than 0.1 ns
8. Report final: DRC count, antenna count, post-route WNS, and recommended next step

---

## Lessons Learned

- On sky130hd at 1 GHz: metal2/metal3 are the congestion bottleneck layers. Reserve metal4+ for power straps unless the PDK says otherwise.
- ICC2 `route_auto` (wrapper for GR + TA + DR) is convenient but gives less control. Use the individual commands (`route_global`, `route_track`, `route_detail`) for production flows so you can inspect each stage.
- Innovus `routeDesign -globalDetail` with `-viaOpt -wireOpt` in a single call produces slightly better QoR than separate calls because the optimizer sees the full picture.
- For designs with > 5% antenna violations post-route: set `routeInsertAntennaDiode` in Innovus or use `fix_antenna` in ICC2 before DRC fixing, not after. Antenna diodes change routing and can fix DRC simultaneously.
- Never run `route_opt` on a design with > 100 DRC violations. The optimizer will make DRC worse. Fix DRC to < 10 first, then optimize timing.
- The worst DRC to debug is EOL (end-of-line) spacing in advanced nodes. At sky130hd, check the `sky130A.tech` DRC rules section for the exact EOL conditions before manually editing routing.
