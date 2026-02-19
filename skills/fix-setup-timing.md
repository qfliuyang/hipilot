---
name: fix-setup-timing
description: >
  Diagnose and fix setup timing violations in a placed-and-routed or
  post-CTS design. Identifies root causes (undersized buffers, long nets,
  high fanout, excessive logic depth) and applies ECO fixes using cell
  sizing, buffer insertion, and net restructuring. Works for both
  pre-tapeout closure and ECO iterations.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  has_template: true
  template_path: templates/fix_setup_timing.tcl.j2
  auto_generated: false
  flexible: true
  flow_stages: [post_place, post_cts, post_route]
  report_inputs:
    - timing report (report_timing output)
    - constraint file (SDC)
  qor_metrics: [WNS, TNS, failing_endpoints]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path_group` | string | `""` | Limit fixes to a specific path group (e.g. `reg2reg`, `in2reg`). Empty = all groups. |
| `max_paths` | integer | `50` | Number of violating paths to analyze per path group. |
| `wns_threshold` | float | `-0.05` | Only fix paths with slack worse than this value (ns). |
| `corners` | list | `[func_ss_125c]` | Timing corners to fix for. ECO fixes applied at worst corner. |
| `eco_mode` | boolean | `true` | If true, preserve placement; fix cells in-place. If false, allow re-placement. |
| `size_up_only` | boolean | `false` | If true, only upsize cells; do not insert buffers or restructure. |
| `max_iterations` | integer | `5` | Maximum fix-verify loop iterations before stopping. |

---

## Workflow

### Step 1 — Establish baseline WNS/TNS

Capture the current timing state before any changes.

**ICC2:**
```tcl
# Report summary across all path groups and corners
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.0

# Full worst-path detail for the violating corner
report_timing -scenario func_ss_125c \
              -path_group reg2reg \
              -max_paths 50 \
              -slack_lesser_than 0.0 \
              -input_pins \
              -nets \
              -transition_time \
              -capacitance \
              > /tmp/setup_violations_baseline.rpt
```

**Innovus:**
```tcl
# Summary across all modes/corners
report_timing -machine_readable \
              -max_paths 1 \
              -slack_lesser_than 0

# Detailed worst paths
report_timing -path_type full_clock \
              -max_paths 50 \
              -slack_lesser_than 0 \
              -input_pins \
              -net \
              > /tmp/setup_violations_baseline.rpt
```

Record baseline WNS and TNS. AI will parse and summarize violation counts.

---

### Step 2 — Identify root causes

Analyze the worst 10–20 paths to find systematic root causes before fixing.

**Common root causes and symptoms:**

| Root Cause | What you see in the path | Fix strategy |
|------------|--------------------------|--------------|
| Undersized drive-strength cell | High output transition time on a driver | `size_cell` to higher drive strength |
| Long net (>100 µm) | High net delay dominating path | Insert repeater buffer mid-net |
| High fanout net | High net capacitance, high transition | Insert buffers to split fanout |
| Deep logic cone | Many gates in combinational path | Restructure (retime, pipeline, or swap to faster cells) |
| Clock skew eating slack | Clock arrival late at capture FF | Adjust CTS skew groups or add delay to launch |
| Input port constraint too tight | First stage after input port is critical | Negotiate SDC or add repeater at port |

**ICC2 — identify high-fanout drivers:**
```tcl
foreach_in_collection cell [get_cells -hierarchical -filter "fanout_load > 20"] {
    echo "[get_attribute $cell full_name] fanout=[get_attribute $cell fanout_load]"
}
```

**Innovus — identify high-fanout nets:**
```tcl
set viols [get_timing_paths -max_paths 20 -slack_lesser_than 0]
foreach_in_collection p $viols {
    report_timing -path $p -input_pins -net -transition_time
}
```

---

### Step 3 — Apply cell sizing fixes

Upsize the weakest driver on each critical path. Always check setup slack does not degrade at the launch side before committing.

**ICC2:**
```tcl
# Check available drive strengths in the library
get_lib_cells */BUF_X* -filter "dont_use == false"

# Resize a specific cell (in-place ECO)
size_cell [get_cells u_datapath/u_adder/g_fa_0/U3] \
          sky130_fd_sc_hd__buf_8

# After resizing, verify timing on that path
report_timing -through [get_cells u_datapath/u_adder/g_fa_0/U3] \
              -max_paths 5 \
              -slack_lesser_than 0.5
```

**Innovus:**
```tcl
# ECO cell resize (preserves placement location)
ecoChangeCell -inst u_datapath/u_adder/g_fa_0/U3 \
              -cell sky130_fd_sc_hd__buf_8

# Incremental timing update after ECO
setECOMode -honorDontUse true -honorDontTouch true
ecoRoute -target timing
```

**Sizing strategy:**
1. Start with the cell that has the worst output transition on the critical path.
2. Upsize by one drive strength step (e.g. X4 → X8). Do not jump more than two steps — you may cause hold violations downstream.
3. Re-run incremental timing. If slack improves by less than 0.02 ns, the bottleneck is the net, not the cell — move to Step 4.

---

### Step 4 — Insert repeater buffers for long nets

Any net where `net_delay > 0.3 ns` (at 130nm; scale proportionally for other nodes) is a candidate for buffering.

**ICC2:**
```tcl
# Identify nets with high capacitance
report_net -connections -capacitance [get_nets u_datapath/data_bus[7]]

# Insert a buffer at the midpoint of the net
insert_buffer -net u_datapath/data_bus[7] \
              -cell sky130_fd_sc_hd__buf_4 \
              -location {500.0 300.0}

# Legalize placement after insertion
legalize_placement -incremental
```

**Innovus:**
```tcl
# Add buffer on net (Innovus places it automatically)
addBuffer -net u_datapath/data_bus[7] \
          -cell sky130_fd_sc_hd__buf_4

# Route the new segment
ecoRoute -target timing -fixHoldAllowSetupTnsDegrade false
```

**Buffer selection guidelines:**
- Use `BUF_X4` or equivalent for nets up to 200 µm.
- Use `BUF_X8` for nets 200–500 µm.
- For clocks or high-fanout data signals, prefer `CLKBUF` cells if available to avoid hold issues from extra delay.
- Never insert buffers in clock nets unless the CTS engine is aware — coordinate with CTS team.

---

### Step 5 — Handle high-fanout nets

Split fanout > 20 by inserting a balanced buffer tree.

**ICC2:**
```tcl
# Insert a fanout-of-4 buffer tree automatically
insert_clock_tree -net u_ctrl/scan_enable \
                  -cell sky130_fd_sc_hd__buf_4 \
                  -max_fanout 8

# Or manual split:
insert_buffer -net u_ctrl/scan_enable -cell sky130_fd_sc_hd__buf_4 \
              -location {200.0 100.0} -new_net u_ctrl/scan_enable_b0
insert_buffer -net u_ctrl/scan_enable -cell sky130_fd_sc_hd__buf_4 \
              -location {600.0 100.0} -new_net u_ctrl/scan_enable_b1
```

**Innovus:**
```tcl
# Set max fanout constraint and re-optimize
setOptMode -maxFanoutEndPointCount 16
optDesign -postPlace -setup
```

---

### Step 6 — Verify timing improvement

After each round of fixes, run incremental timing and compare against baseline.

**ICC2:**
```tcl
update_timing -full
report_timing -scenario func_ss_125c \
              -path_group reg2reg \
              -max_paths 50 \
              -slack_lesser_than 0.0 \
              > /tmp/setup_violations_iter1.rpt

# Quick WNS/TNS summary
report_timing -scenarios [all_scenarios] \
              -path_type summary \
              -max_paths 1 \
              -slack_lesser_than 0.0
```

**Innovus:**
```tcl
timeDesign -postRoute -pathReports -dataReports -outDir ./timing_rpt/iter1
```

Compare WNS improvement. If `|new_WNS| < |baseline_WNS| * 0.8`, continue iterating. If improvement stalls after 2 iterations, escalate to restructuring or SDC negotiation.

---

### Step 7 — Check hold timing has not degraded

Every setup fix (upsizing, buffering) can introduce additional delay that causes hold violations. Always check hold after setup fixes.

**ICC2:**
```tcl
report_timing -type min \
              -scenario func_ss_125c \
              -max_paths 20 \
              -slack_lesser_than 0.0
```

**Innovus:**
```tcl
timeDesign -postRoute -hold -pathReports -outDir ./timing_rpt/hold_check
```

If hold violations appear, see the `fix-hold-timing` skill before proceeding to signoff.

---

### Step 8 — Save checkpoint

**ICC2:**
```tcl
save_block -as post_eco_setup_fix
write_verilog -hierarchy -pg ./outputs/netlist_eco_setup.v
```

**Innovus:**
```tcl
saveDesign ./checkpoints/post_eco_setup_fix.enc
```

---

## Core Principles

1. **Fix worst paths first.** The path with the worst WNS often shares logic with the next 5–10 worst paths. One upsize can fix a cluster.

2. **One step at a time.** Never apply hundreds of fixes and then verify. Fix 10–20 cells, verify, iterate. This isolates regressions.

3. **Upsizing ripples.** When you upsize a driver, the increased load on its inputs can degrade upstream paths. Always run incremental timing on the 3 levels above the fixed cell.

4. **ECO mode preserves LVS.** In ECO mode (`eco_mode: true`), only change cell types — do not change connectivity. Any connectivity change (buffer insertion) requires ECO LVS verification.

5. **Hold is not free.** Every ns of setup fix = potential hold degradation at the receiving flip-flop. Budget hold margin before aggressive setup fixing at post-route.

6. **Don't touch clock nets.** Unless you are doing a CTS ECO with full clock timing awareness, do not insert or resize cells in clock paths — this changes skew globally.

---

## What Can Go Wrong

- **Upsizing causes DRC violations.** A larger cell may not fit in place without legalization. Always run `legalize_placement -incremental` after every upsize batch.
- **Buffer insertion changes logic depth perceived by STA.** If the buffer is on a timing arc that feeds both a short and long path, the short path may get a hold violation. Check hold after every buffer insertion.
- **High-fanout fix degrades a previously clean path.** Splitting a net with buffers adds delay to all loads. Verify all downstream endpoints, not just the worst one.
- **size_cell fails with "cell not in library."** Check `dont_use` and `dont_touch` attributes. Use `get_lib_cells` to confirm the target cell is legal.
- **Incremental timing diverges from full timing.** After more than 3 ECO iterations, run `update_timing -full` to reset the incremental database.

---

## Example Usage

```
/fix-setup-timing

# or with parameters:
/fix-setup-timing path_group=reg2reg wns_threshold=-0.1 max_paths=100 eco_mode=true
```

**Typical session dialogue:**

> "I have 47 setup violations after post-route opt. WNS is -0.23 ns on the func_ss_125c corner. The worst path is through the ALU carry chain."

HiPilot will:
1. Run `report_timing` and parse the worst 20 paths
2. Identify that carry chain uses minimum-drive cells
3. Propose upsizing 8 specific cells to `BUF_X8` and `AND2_X4`
4. Show the Tcl, attribute it to the sky130hd library cell list
5. After approval, send to EDA pane and report the new WNS

---

## Lessons Learned (from real tapeout experience)

- On sky130hd at 1 GHz targets: WNS worse than -0.5 ns usually requires RTL restructuring, not ECO. Escalate early.
- `fix_eco_timing` in ICC2 can be overly aggressive — always set `-effort low` first and inspect what it touched.
- Innovus `optDesign -postRoute -setup` is safe to run iteratively; ICC2 `route_opt` is not — it re-runs full routing.
- PrimeTime ECO flow (`pt_shell` → `write_changes`) gives higher-quality fixes for critical paths than in-tool ECO; worth the extra step for the 10 worst paths.
