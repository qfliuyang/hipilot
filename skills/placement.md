---
name: placement
description: >
  Standard cell placement for digital designs. Covers timing-driven placement,
  congestion optimization, and pre-CTS timing analysis. Designed for Innovus.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell]
  flow_stages: [placement]
  triggers:
    - "place cells"
    - "run placement"
    - "place design"
    - "place_opt_design"
    - "timing driven placement"
  qor_metrics: [WNS, TNS, Congestion, Utilization]
  risk_level: moderate
  typical_duration: "5-20 minutes depending on design size"
---

# Standard Cell Placement

## Quick Reference

```
User: "run placement"
```

HiPilot will:
1. Configure placement mode (timing-driven)
2. Run placement optimization
3. Report timing and congestion
4. Save checkpoint

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| After power planning | Run initial placement |
| Timing issues | Re-run with higher effort |
| Congestion | Adjust density targets |
| ECO changes | Incremental placement |

**Prerequisites:**
- Floorplan created
- Power grid connected
- Timing libraries loaded
- SDC constraints applied

---

## Placement Workflow

### Step 1: Configure Placement Mode

**Innovus:**
```tcl
# Reset placement mode
setPlaceMode -reset

# Timing-driven placement
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_detail_legalization_inst_gap 2

# For congested designs
setPlaceMode -cong_effort medium
setPlaceMode -place_global_cong_effort high
```

**ICC2:**
```tcl
# Placement configuration
set_app_options -name place.coarse.cong_effort -value high
set_app_options -name place.coarse.timing_effort -value high
```

### Step 2: Set Timing Derates

**Innovus:**
```tcl
# OCV derating for placement
set_timing_derate -early 0.97 -late 1.03 -clock
set_timing_derate -late 1.05 -data
setAnalysisMode -cppr both
```

### Step 3: Run Placement

**Innovus:**
```tcl
# Basic placement
place_opt_design

# With higher effort
place_opt_design -effort high

# Incremental placement
place_opt_design -incremental
```

**ICC2:**
```tcl
# Initial placement
create_placement

# Legalize
legalize_placement

# Optimize
place_opt
```

### Step 4: Analyze Results

**Innovus:**
```tcl
# Report timing
report_timing -max_paths 10

# Report congestion
report_congestion

# Report utilization
report_utilization
```

---

## Placement Options

### Timing-Driven (Default)

```tcl
# Maximum timing optimization
setPlaceMode -timing_effort high
place_opt_design
```

### Congestion-Driven

```tcl
# For congested designs
setPlaceMode -cong_effort high
setPlaceMode -place_global_cong_effort high
place_opt_design
```

### Density-Constrained

```tcl
# Limit local density
setPlaceMode -place_global_max_density 0.75
place_opt_design
```

---

## Pre-CTS Timing Analysis

### Check Timing

**Innovus:**
```tcl
# Report pre-CTS timing
report_timing -max_paths 20 -slack_lesser_than 0

# Report path groups
report_timing -max_paths 5 -group

# Expected timing at pre-CTS:
# - Some negative slack is normal (no clock tree yet)
# - Setup violations: Will be fixed during CTS and routing
# - Focus on identifying critical paths
```

### Check Congestion

**Innovus:**
```tcl
# Global congestion
report_congestion -hotspot

# Detailed analysis
globalRoute -congestion
```

---

## Common Issues

### Issue 1: High Congestion

**Symptoms:** Congestion > 1.0 in hotspots

**Fix:**
```tcl
# Reduce local density
setPlaceMode -place_global_max_density 0.70
place_opt_design -incremental

# Add placement blockages in congested areas
createPlaceBlockage -type partial -density 0.3 -box {x1 y1 x2 y2}
```

### Issue 2: Large Negative Slack

**Symptoms:** WNS < -20% of clock period

**Fix:**
```tcl
# Higher timing effort
setPlaceMode -timing_effort ultra
place_opt_design

# Check path groups for critical paths
report_timing -max_paths 50 -slack_lesser_than 0
```

### Issue 3: Overlap Violations

**Symptoms:** Cell overlaps reported

**Fix:**
```tcl
# Legalize placement
place_detail -legalize_only

# Or re-run with better settings
setPlaceMode -place_detail_legalization_inst_gap 2
place_opt_design -incremental
```

---

## Complete Script Template

**Innovus:**
```tcl
#!/usr/bin/tclsh
# placement.tcl - Standard cell placement

#===========================================
# Configuration
#===========================================
set TARGET_DENSITY 0.70
set TIMING_EFFORT "high"

#===========================================
# Placement Mode Setup
#===========================================
echo "Configuring placement mode..."
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
setPlaceMode -place_global_reorder_scan false
setPlaceMode -place_detail_legalization_inst_gap 2

#===========================================
# Timing Setup
#===========================================
echo "Setting timing derates..."
set_timing_derate -early 0.97 -late 1.03 -clock
set_timing_derate -late 1.05 -data
setAnalysisMode -cppr both

#===========================================
# Run Placement
#===========================================
echo "Running placement..."
place_opt_design

#===========================================
# Reports
#===========================================
echo "Generating reports..."
report_timing -max_paths 20 > reports/pre_cts_timing.rpt
report_congestion > reports/congestion.rpt
report_utilization > reports/placement_util.rpt

#===========================================
# Save Checkpoint
#===========================================
saveDesign result/pr/data/placement.enc

echo "Placement complete!"
```

---

## MCP Commands (For Claude Code)

### Configure Placement Mode
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "setPlaceMode -reset; setPlaceMode -place_global_ignore_scan true; setPlaceMode -place_global_reorder_scan false; setPlaceMode -place_detail_legalization_inst_gap 2"
}'
```

### Set Timing Derates
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "set_timing_derate -early 0.97 -late 1.03 -clock; set_timing_derate -late 1.05 -data; setAnalysisMode -cppr both"
}'
```

### Run Placement
```bash
bash /home/EDA/hipilot/current/scripts/mcp_wrapper.sh eda send_to_terminal '{
  "tcl": "place_opt_design"
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
  "tcl": "saveDesign /home/EDA/hipilot_test/ibex_work_upload/result/pr/data/placement.enc"
}'
```

---

## Related Skills

- `/power-planning` - Before placement
- `/cts` - After placement
- `/report-timing` - Timing analysis
- `/post-cts-opt` - Post-CTS optimization

---

## Checklist

Before placement:
- [ ] Floorplan created
- [ ] Power grid connected
- [ ] Timing libraries loaded
- [ ] SDC constraints applied

After placement:
- [ ] No overlap violations
- [ ] Congestion acceptable
- [ ] Timing analyzed
- [ ] Checkpoint saved
