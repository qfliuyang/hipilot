---
name: post-cts-opt
description: >
  Post-CTS optimization for setup and hold timing. Covers clock propagation,
  optimization mode settings, and timing analysis after CTS. Designed for Innovus.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell]
  flow_stages: [post_cts_opt]
  triggers:
    - "post cts optimization"
    - "optimize post cts"
    - "fix setup hold"
    - "optDesign postCTS"
  qor_metrics: [WNS, TNS, Setup_Violations, Hold_Violations]
  risk_level: moderate
  typical_duration: "5-15 minutes"
---

# Post-CTS Optimization

## Quick Reference

```
User: "optimize post CTS"
```

HiPilot will:
1. Set clocks to propagated mode
2. Run setup optimization
3. Run hold optimization
4. Report timing improvements
5. Save checkpoint

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| After CTS | Run initial optimization |
| Setup violations | Higher setup effort |
| Hold violations | Run hold optimization |
| Timing regression | Re-optimize with higher effort |

**Prerequisites:**
- CTS completed
- Clock tree built
- Timing libraries loaded

---

## Post-CTS Optimization Workflow

### Step 1: Set Clocks to Propagated

**Innovus:**
```tcl
# Set all clocks to propagated mode
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]
```

**ICC2:**
```tcl
# Propagate clocks
set_propagated_clock [all_clocks]
```

### Step 2: Configure Optimization Mode

**Innovus:**
```tcl
# Optimization settings
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -holdTargetSlack 0.05
setOptMode -setupTargetSlack 0.0
```

### Step 3: Run Setup Optimization

**Innovus:**
```tcl
# Post-CTS setup optimization
optDesign -postCTS

# Higher effort
optDesign -postCTS -effort high
```

**ICC2:**
```tcl
# Post-CTS optimization
place_opt -cts
route_opt -cts
```

### Step 4: Run Hold Optimization

**Innovus:**
```tcl
# Post-CTS hold optimization
optDesign -postCTS -hold

# Combined setup + hold
optDesign -postCTS
optDesign -postCTS -hold
```

### Step 5: Analyze Results

**Innovus:**
```tcl
# Report timing
report_timing -max_paths 20

# Report violations
report_constraint -all_violators

# Compare pre/post optimization
report_qor
```

---

## Optimization Strategies

### Setup-Only (Default)

```tcl
# Focus on setup timing
optDesign -postCTS -setup
```

### Hold-Only

```tcl
# Focus on hold timing (after setup)
optDesign -postCTS -hold
```

### Combined (Recommended)

```tcl
# Setup first, then hold
optDesign -postCTS -setup
optDesign -postCTS -hold
```

### High Effort

```tcl
# Maximum optimization
setOptMode -effort high
optDesign -postCTS
optDesign -postCTS -hold
```

---

## Timing Analysis

### Check Setup Timing

**Innovus:**
```tcl
# Report setup violations
report_timing -max_paths 20 -slack_lesser_than 0 -delay_type max

# Summary
report_constraint -all_violators -max_delay
```

### Check Hold Timing

**Innovus:**
```tcl
# Report hold violations
report_timing -max_paths 20 -slack_lesser_than 0 -delay_type min

# Summary
report_constraint -all_violators -min_delay
```

### Expected Results

| Metric | Target | Warning | Error |
|--------|--------|---------|-------|
| Setup WNS | > 0 | < -0.1ns | < -0.5ns |
| Hold WNS | > 0 | < -0.05ns | < -0.1ns |
| Setup TNS | 0 | < 10ns | < 50ns |
| Hold TNS | 0 | < 5ns | < 20ns |

---

## Common Issues

### Issue 1: Hold Violations After Setup Opt

**Symptoms:** Hold violations appear after setup optimization

**Fix:**
```tcl
# Run hold optimization
optDesign -postCTS -hold

# If still failing, increase target slack
setOptMode -holdTargetSlack 0.1
optDesign -postCTS -hold
```

### Issue 2: Setup Still Negative

**Symptoms:** Setup WNS still negative after optimization

**Fix:**
```tcl
# Higher effort
optDesign -postCTS -effort high -setup

# Check critical paths
report_timing -max_paths 50 -slack_lesser_than 0

# May need to revisit floorplan or CTS
```

### Issue 3: DRC Violations

**Symptoms:** Max transition/cap violations

**Fix:**
```tcl
# Enable DRC fixing
setOptMode -fixDrc true
optDesign -postCTS

# Check violations
report_constraint -all_violators -max_transition
report_constraint -all_violators -max_capacitance
```

---

## Complete Script Template

**Innovus:**
```tcl
#!/usr/bin/tclsh
# post_cts_opt.tcl - Post-CTS optimization

#===========================================
# Configuration
#===========================================
set SETUP_TARGET_SLACK 0.0
set HOLD_TARGET_SLACK 0.05

#===========================================
# Propagate Clocks
#===========================================
echo "Setting clocks to propagated mode..."
set_interactive_constraint_modes [all_constraint_modes -active]
set_propagated_clock [all_clocks]

#===========================================
# Optimization Mode
#===========================================
echo "Configuring optimization mode..."
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -holdTargetSlack $HOLD_TARGET_SLACK
setOptMode -setupTargetSlack $SETUP_TARGET_SLACK

#===========================================
# Pre-Optimization Report
#===========================================
echo "Pre-optimization timing..."
report_timing -max_paths 10 > reports/pre_opt_timing.rpt

#===========================================
# Setup Optimization
#===========================================
echo "Running setup optimization..."
optDesign -postCTS -setup

#===========================================
# Hold Optimization
#===========================================
echo "Running hold optimization..."
optDesign -postCTS -hold

#===========================================
# Post-Optimization Report
#===========================================
echo "Generating reports..."
report_timing -max_paths 20 > reports/post_cts_opt_timing.rpt
report_constraint -all_violators > reports/violations.rpt
report_qor > reports/qor.rpt

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/post_cts_opt.enc

echo "Post-CTS optimization complete!"
```

---

## MCP Commands (For Claude Code)

### Propagate Clocks
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "set_interactive_constraint_modes [all_constraint_modes -active]; set_propagated_clock [all_clocks]"
}'
```

### Configure Optimization
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "setOptMode -fixDrc true -fixFanoutLoad true; setOptMode -holdTargetSlack 0.05 -setupTargetSlack 0.0"
}'
```

### Run Setup Optimization
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "optDesign -postCTS -setup"
}'
```

### Run Hold Optimization
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "optDesign -postCTS -hold"
}'
```

### Report Timing
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "report_timing -max_paths 10"
}'
```

### Save Checkpoint
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/post_cts_opt.enc"
}'
```

---

## Related Skills

- `/cts` - Clock tree synthesis
- `/report-timing` - Timing analysis
- `/routing` - Routing after optimization
- `/routing-opt` - Post-route optimization

---

## Checklist

Before post-CTS opt:
- [ ] CTS completed
- [ ] Clock tree built
- [ ] Timing libraries loaded

After post-CTS opt:
- [ ] Setup timing clean (WNS >= 0)
- [ ] Hold timing clean (WNS >= 0)
- [ ] No DRC violations
- [ ] Checkpoint saved
