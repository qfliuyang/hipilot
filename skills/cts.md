---
name: cts
description: >
  Clock Tree Synthesis (CTS) for digital designs. Covers clock tree
  specification, buffer/inverter selection, skew optimization, and
  post-CTS timing analysis. Designed for Innovus CCOpt and ICC2 CTS.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell]
  flow_stages: [cts]
  triggers:
    - "cts"
    - "clock tree"
    - "clock synthesis"
    - "run ccopt"
    - "build clock tree"
    - "optimize clock"
  qor_metrics: [Clock_Skew, Clock_Latency, Clock_Power, Buf_Count]
  risk_level: moderate
  typical_duration: "3-15 minutes depending on design size"
---

# Clock Tree Synthesis (CTS)

## Quick Reference

```
User: "run CTS"
```

HiPilot will:
1. Analyze clock ports and constraints
2. Configure clock tree (buffers, skew targets)
3. Run CTS engine
4. Report skew and latency
5. Optimize if needed

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| Post-placement | Run initial CTS |
| High skew | Re-run with tighter targets |
| Hold violations | Adjust skew budget |
| Power optimization | Use smaller buffers |
| Timing regression | Re-optimize clock tree |

**Prerequisites:**
- Design is placed
- Clock ports defined
- SDC constraints loaded

---

## CTS Concepts

### Key Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Skew** | Max clock arrival difference | < 10% of period |
| **Latency** | Clock insertion delay | < 30% of period |
| **Duty Cycle** | High/low ratio | 50% ± 5% |
| **Power** | Clock network power | Minimize |

### Clock Tree Structure

```
Clock Source (Port/Pin)
       │
    Buffer (Root)
       │
   ┌───┴───┐
   │       │
Buffer   Buffer  (Level 1)
   │       │
 ┌─┴─┐   ┌─┴─┐
 │   │   │   │
... ... ... ...  (Leaves -> Registers)
```

---

## CTS Workflow

### Step 1: Analyze Clocks

**Innovus:**
```tcl
# List all clocks
report_clocks

# Check clock tree status
report_ccopt_clock_trees

# Find clock roots
get_ccopt_clock_trees
```

**ICC2:**
```tcl
# List all clocks
report_clocks

# Check CTS status
report_clock_tree -summary
```

### Step 2: Configure CTS

**Innovus (CCOpt):**
```tcl
# Basic CTS configuration
set_ccopt_mode \
    -cts_target_skew 0.05 \
    -cts_target_max_transition 0.1 \
    -cts_target_max_capacitance 0.2 \
    -routing_top_layer M6 \
    -routing_bottom_layer M4

# Buffer/inverter selection
set_ccopt_property buffer_cells {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}
set_ccopt_property inverter_cells {CLKINV_X4 CLKINV_X8 CLKINV_X16}
set_ccopt_property clock_gating_cells {CLKGATE_X4 CLKGATE_X8}

# Skew group configuration
create_ccopt_skew_group -name reg2reg_skew \
                        -targets [get_clocks clk_i] \
                        -target_skew 0.05
```

**ICC2:**
```tcl
# CTS configuration
set_clock_tree_options -clock [get_clocks clk_i] \
                       -target_skew 0.05 \
                       -target_latency 0.3 \
                       -max_transition 0.1

# Buffer selection
set_clock_tree_references -clock [get_clocks clk_i] \
                          -references {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}

# Target skew
set_clock_tree_options -clock [get_clocks clk_i] \
                       -target_skew 50ps
```

### Step 3: Run CTS

**Innovus:**
```tcl
# Run CCOpt
ccopt_design

# With specific effort
ccopt_design -effort high

# Post-route refinement
ccopt_design -post_route
```

**ICC2:**
```tcl
# Run CTS
clock_opt

# With specific target
clock_opt -clock [get_clocks clk_i]

# With higher effort
set_app_options -name cts.compile.enable_local_skew_optimization -value true
clock_opt
```

### Step 4: Analyze Results

**Innovus:**
```tcl
# Summary report
report_ccopt_clock_trees -format summary

# Detailed timing
report_clock_timing -type skew -max_paths 10
report_clock_timing -type latency -max_paths 10

# Clock tree structure
report_ccopt_skew_groups

# Buffer usage
report_clock_cells
```

**ICC2:**
```tcl
# Summary
report_clock_tree -summary

# Detailed skew
report_clock_timing -type skew -max_paths 10

# Latency
report_clock_timing -type latency -max_paths 10

# Structure
report_clock_tree -structure
```

### Step 5: Optimize (if needed)

**Innovus:**
```tcl
# If skew is high, tighten target
set_ccopt_property target_skew -skew_group reg2reg_skew 0.03
ccopt_design -refine

# For hold issues
set_ccopt_mode -fix_hold true
ccopt_design

# For power reduction
set_ccopt_property use_inverters true
ccopt_design -refine
```

**ICC2:**
```tcl
# Reduce skew
set_clock_tree_options -clock [get_clocks clk_i] -target_skew 30ps
clock_opt -update_clock_latency

# Fix hold
set_clock_tree_options -fix_hold true
clock_opt
```

---

## CTS Configuration Options

### Buffer Selection

**Guidelines:**
- Use clock-specific buffers (CLKBUF, CLKINV)
- Start with medium sizes (X4, X8)
- Limit number of buffer types to 3-4
- Match drive strengths to load

```tcl
# Innovus
set_ccopt_property buffer_cells {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}
set_ccopt_property inverter_cells {CLKINV_X4 CLKINV_X8 CLKINV_X16}

# ICC2
set_clock_tree_references -references {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}
```

### Skew Targets

| Design Type | Skew Target | Rationale |
|-------------|-------------|-----------|
| High-speed | < 50ps | Tight timing margins |
| Standard | < 100ps | Balanced |
| Low-power | < 200ps | Relaxed is OK |

```tcl
# Tight skew
set_ccopt_mode -cts_target_skew 0.05  ;# 50ps

# Relaxed skew
set_ccopt_mode -cts_target_skew 0.10  ;# 100ps
```

### Routing Constraints

```tcl
# Innovus
set_ccopt_mode \
    -routing_top_layer M6 \
    -routing_bottom_layer M4 \
    -shield_rules {M4 M5}

# ICC2
set_clock_tree_options -routing_layer_range {M4 M6}
```

---

## Advanced CTS Features

### Multi-Corner CTS

**Innovus:**
```tcl
# Define corners for CTS
set_ccopt_mode -corner_list {ss_0.72v_125c ff_0.88v_0c}

# Balance across corners
ccopt_design -multi_corner
```

### Clock Gating Integration

**Innovus:**
```tcl
# Include clock gating cells
set_ccopt_property clock_gating_cells {CLKGATE_X4 CLKGATE_X8}

# Place clock gates near registers
set_ccopt_property placement_constraints -clock_gating_cells \
    -max_distance_from_registers 50
```

### Mesh Clock

**For high-performance designs:**
```tcl
# Create clock mesh
create_ccopt_mesh -name clk_mesh \
                  -layers {M8 M9} \
                  -width 2.0 \
                  -spacing 0.5

# Route to mesh
ccopt_design -use_mesh
```

---

## CTS Quality Checks

### Check 1: Skew

```tcl
# Report skew
report_clock_timing -type skew -max_paths 20

# Expected: All skew < target
# Warning: Any skew > 1.5x target
# Error: Any skew > 2x target
```

### Check 2: Latency

```tcl
# Report latency
report_clock_timing -type latency -max_paths 20

# Expected: Latency within target
# Warning: Latency > 30% of clock period
# Error: Latency > 50% of clock period
```

### Check 3: Transition

```tcl
# Check clock transitions
report_clock_timing -type transition -max_paths 20

# Target: < 10% of clock period
# Warning: > 15% of clock period
# Error: > 20% of clock period
```

### Check 4: DRC

```tcl
# Check clock net DRCs
verify_drc -nets [get_nets -of [get_clocks *]]

# Target: 0 violations
```

---

## Common Issues and Fixes

### Issue 1: High Skew

**Symptoms:** Skew > 100ps, timing violations

**Diagnosis:**
```tcl
# Check skew distribution
report_clock_timing -type skew -max_paths 50 -slack_lesser_than 0.1
```

**Fix:**
```tcl
# Tighten skew target
set_ccopt_property target_skew -skew_group reg2reg_skew 0.03
ccopt_design -refine

# Or add more levels
set_ccopt_mode -max_levels 15
ccopt_design
```

### Issue 2: High Latency

**Symptoms:** Latency > 500ps, OCV derating issues

**Fix:**
```tcl
# Use larger buffers
set_ccopt_property buffer_cells {CLKBUF_X8 CLKBUF_X16 CLKBUF_X32}

# Reduce tree levels
set_ccopt_mode -max_levels 8
ccopt_design
```

### Issue 3: Clock Duty Cycle Distortion

**Symptoms:** Duty cycle not 50%

**Fix:**
```tcl
# Enable duty cycle correction
set_ccopt_mode -fix_duty_cycle true

# Use symmetric buffers
set_ccopt_property use_inverters false
ccopt_design
```

### Issue 4: High Clock Power

**Symptoms:** Clock power > 30% of total

**Fix:**
```tcl
# Use smaller buffers where possible
set_ccopt_property buffer_cells {CLKBUF_X2 CLKBUF_X4 CLKBUF_X8}

# Enable clock gating
set_ccopt_property clock_gating_cells {CLKGATE_X2 CLKGATE_X4}
ccopt_design
```

---

## Complete Script Template

**Innovus:**
```tcl
#!/usr/bin/tclsh
# cts.tcl - Complete CTS script

#===========================================
# Configuration
#===========================================
set CLOCK_NAME "clk_i"
set TARGET_SKEW 0.05  ;# 50ps
set MAX_TRANSITION 0.1

#===========================================
# CTS Setup
#===========================================
echo "Configuring CTS..."

# Clock tree mode
set_ccopt_mode \
    -cts_target_skew $TARGET_SKEW \
    -cts_target_max_transition $MAX_TRANSITION \
    -routing_top_layer M6 \
    -routing_bottom_layer M4

# Buffer selection
set_ccopt_property buffer_cells {CLKBUF_X4 CLKBUF_X8 CLKBUF_X16}
set_ccopt_property inverter_cells {CLKINV_X4 CLKINV_X8 CLKINV_X16}

#===========================================
# Pre-CTS Report
#===========================================
echo "Pre-CTS analysis..."
report_clocks > reports/pre_cts_clocks.rpt

#===========================================
# Run CTS
#===========================================
echo "Running CTS..."
ccopt_design

#===========================================
# Post-CTS Reports
#===========================================
echo "Generating reports..."
report_ccopt_clock_trees -format summary > reports/cts_summary.rpt
report_clock_timing -type skew -max_paths 20 > reports/cts_skew.rpt
report_clock_timing -type latency -max_paths 20 > reports/cts_latency.rpt
report_clock_cells > reports/cts_cells.rpt

#===========================================
# Quality Check
#===========================================
set skew [get_ccopt_property worst_skew]
set latency [get_ccopt_property worst_latency]
puts "Worst skew: $skew ns"
puts "Worst latency: $latency ns"

echo "CTS complete!"
```

---

## Makefile Integration

```makefile
# Makefile - CTS targets

cts:
	innovus -files scripts/cts.tcl -log logs/cts.log

post_cts_opt:
	innovus -files scripts/post_cts_opt.tcl

cts_report:
	cat reports/cts_summary.rpt
	cat reports/cts_skew.rpt
```

---

## Real Example: Ibex CTS

**Design:** Ibex RISC-V CPU
**Technology:** Skywater 130nm HD
**Clock:** 100 MHz (10ns period)

```bash
cd /home/EDA/hipilot_test/ibex_work_upload
make cts
make post_cts_opt
```

**Expected Results:**
```
CTS Summary:
  Clock: clk_i
  Period: 10.0 ns

Clock Tree Results:
  Skew (global): 35 ps (target: 50 ps) ✓
  Skew (local): 12 ps
  Latency: 280 ps
  Max transition: 85 ps

Buffer Usage:
  CLKBUF_X4: 45
  CLKBUF_X8: 23
  CLKBUF_X16: 8
  Total buffers: 76

Clock Power:
  Total: 0.8 mW
  % of total: 35%

Time: 3 minutes
```

---

## Related Skills

- `/placement` - Before CTS
- `/fix-setup-timing` - Post-CTS optimization
- `/fix-hold-timing` - Hold fixing with real clocks
- `/report-timing` - Timing analysis

---

## Checklist

Before CTS:
- [ ] Design is placed
- [ ] Clocks are defined
- [ ] SDC constraints loaded
- [ ] Clock buffer cells available

After CTS:
- [ ] Skew < target
- [ ] Latency reasonable
- [ ] Transitions clean
- [ ] No clock DRCs
- [ ] Save checkpoint
