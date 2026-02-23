---
name: routing-opt
description: >
  Post-routing optimization for timing and DRC. Covers timing-driven
  optimization, antenna fixing, and final cleanup. Designed for Innovus.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell]
  flow_stages: [routing_opt]
  triggers:
    - "post route optimization"
    - "optimize post route"
    - "optDesign postRoute"
    - "route optimization"
  qor_metrics: [WNS, TNS, DRC_Violations, Antenna_Violations]
  risk_level: moderate
  typical_duration: "10-30 minutes"
---

# Post-Routing Optimization

## Quick Reference

```
User: "optimize post route"
```

HiPilot will:
1. Run setup timing optimization
2. Run hold timing optimization (if needed)
3. Fix DRC violations
4. Fix antenna violations
5. Report final QoR
6. Save checkpoint

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| After routing | Run initial optimization |
| Timing violations | Higher effort optimization |
| DRC violations | Enable DRC fixing |
| Antenna issues | Fix antenna violations |

**Prerequisites:**
- Routing completed
- Design routed (global + detail)
- Timing libraries loaded

---

## Post-Route Optimization Workflow

### Step 1: Configure Optimization Mode

**Innovus:**
```tcl
# Optimization settings
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -usefulSkew true
setOptMode -holdTargetSlack 0.02
setOptMode -setupTargetSlack 0.0
```

### Step 2: Run Setup Optimization

**Innovus:**
```tcl
# Post-route setup optimization
optDesign -postRoute -setup

# Higher effort
optDesign -postRoute -setup -effort high
```

**ICC2:**
```tcl
# Post-route optimization
route_opt -size_only
```

### Step 3: Run Hold Optimization

**Innovus:**
```tcl
# Post-route hold optimization
optDesign -postRoute -hold

# Combined
optDesign -postRoute -setup
optDesign -postRoute -hold
```

### Step 4: Fix DRC Violations

**Innovus:**
```tcl
# Fix antenna violations
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

# Verify DRC
verify_drc
```

### Step 5: Final Cleanup

**Innovus:**
```tcl
# Remove dangling nets
deleteDanglingNet

# Remove empty modules
deleteEmptyModule

# Remove assigns
remove_assigns -buffering
```

---

## Optimization Options

### Setup-Only

```tcl
# Focus on setup timing
optDesign -postRoute -setup
```

### Hold-Only

```tcl
# Focus on hold timing
optDesign -postRoute -hold
```

### Combined (Recommended)

```tcl
# Setup + hold
optDesign -postRoute -setup
optDesign -postRoute -hold
```

### With Useful Skew

```tcl
# Enable useful skew optimization
setOptMode -usefulSkew true
optDesign -postRoute -setup
```

---

## DRC Fixing

### Antenna Violations

**Innovus:**
```tcl
# Enable antenna fixing
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

# Check antenna
verify_drc -antenna
```

### Max Transition/Capacitance

**Innovus:**
```tcl
# Fix max transition
setOptMode -fixDrc true
optDesign -postRoute

# Verify
report_constraint -all_violators -max_transition
report_constraint -all_violators -max_capacitance
```

---

## Final QoR Analysis

### Timing Summary

**Innovus:**
```tcl
# Report final timing
report_timing -max_paths 20

# Summary
report_qor

# Path groups
report_timing -max_paths 5 -group
```

### DRC Summary

**Innovus:**
```tcl
# Verify connectivity
verifyConnectivity -type all

# Verify geometry
verify_drc -limit 1000

# Report violations
report_constraint -all_violators
```

### Area Summary

**Innovus:**
```tcl
# Report area
report_area

# Cell utilization
report_utilization
```

---

## Common Issues

### Issue 1: Hold Violations After Setup Opt

**Symptoms:** Hold violations appear after setup optimization

**Fix:**
```tcl
# Run hold optimization
optDesign -postRoute -hold

# If still failing, increase target slack
setOptMode -holdTargetSlack 0.05
optDesign -postRoute -hold
```

### Issue 2: DRC Violations

**Symptoms:** Max transition/cap violations

**Fix:**
```tcl
# Enable DRC fixing
setOptMode -fixDrc true
optDesign -postRoute

# Verify
verify_drc
```

### Issue 3: Antenna Violations

**Symptoms:** Antenna violations reported

**Fix:**
```tcl
# Enable antenna fixing
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

# Verify
verify_drc -antenna
```

---

## Complete Script Template

**Innovus:**
```tcl
#!/usr/bin/tclsh
# routing_opt.tcl - Post-routing optimization

#===========================================
# Configuration
#===========================================
set SETUP_TARGET_SLACK 0.0
set HOLD_TARGET_SLACK 0.02

#===========================================
# Optimization Mode
#===========================================
echo "Configuring optimization mode..."
setOptMode -fixDrc true
setOptMode -fixFanoutLoad true
setOptMode -usefulSkew true
setOptMode -holdTargetSlack $HOLD_TARGET_SLACK
setOptMode -setupTargetSlack $SETUP_TARGET_SLACK

#===========================================
# Pre-Optimization Report
#===========================================
echo "Pre-optimization timing..."
report_timing -max_paths 10 > reports/pre_route_opt_timing.rpt

#===========================================
# Setup Optimization
#===========================================
echo "Running setup optimization..."
optDesign -postRoute -setup

#===========================================
# Hold Optimization
#===========================================
echo "Running hold optimization..."
optDesign -postRoute -hold

#===========================================
# DRC Fixing
#===========================================
echo "Fixing DRC violations..."
setNanoRouteMode -drouteFixAntenna true
routeDesign -viaOpt

#===========================================
# Cleanup
#===========================================
echo "Cleaning up design..."
remove_assigns -buffering
deleteDanglingNet
deleteEmptyModule

#===========================================
# Final Verification
#===========================================
echo "Running final verification..."
verifyConnectivity -type all -error 1000 -warning 50
verify_drc -limit 1000

#===========================================
# Post-Optimization Report
#===========================================
echo "Generating final reports..."
report_timing -max_paths 20 > reports/final_timing.rpt
report_qor > reports/final_qor.rpt
report_area > reports/final_area.rpt

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/routing_opt.enc

echo "Post-routing optimization complete!"
```

---

## MCP Commands (For Claude Code)

### Configure Optimization
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "setOptMode -fixDrc true -fixFanoutLoad true -usefulSkew true; setOptMode -holdTargetSlack 0.02 -setupTargetSlack 0.0"
}'
```

### Run Setup Optimization
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "optDesign -postRoute -setup"
}'
```

### Run Hold Optimization
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "optDesign -postRoute -hold"
}'
```

### Fix Antenna
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "setNanoRouteMode -drouteFixAntenna true; routeDesign -viaOpt"
}'
```

### Cleanup
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "remove_assigns -buffering; deleteDanglingNet; deleteEmptyModule"
}'
```

### Verify Connectivity
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "verifyConnectivity -type all -error 1000 -warning 50"
}'
```

### Save Checkpoint
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/routing_opt.enc"
}'
```

---

## Related Skills

- `/route-design` - Routing before optimization
- `/chip-finish` - Final outputs
- `/report-timing` - Timing analysis
- `/sta` - PrimeTime signoff

---

## Checklist

Before post-route opt:
- [ ] Routing completed
- [ ] Design routed (global + detail)
- [ ] Timing libraries loaded

After post-route opt:
- [ ] Setup timing clean (WNS >= 0)
- [ ] Hold timing clean (WNS >= 0)
- [ ] DRC violations fixed
- [ ] Antenna violations fixed
- [ ] Checkpoint saved
