---
name: fix-setup-timing
description: >
  Complete workflow for diagnosing and fixing setup timing violations in
  post-CTS and post-route stages. Covers root cause analysis, fix strategies
  (cell sizing, buffer insertion, cloning, restructuring), tool-specific Tcl
  for Innovus/ICC2/PrimeTime, and verification methodology.

hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2, pt_shell]
  flow_stages: [post_place, post_cts, post_route, signoff]
  triggers:
    - "fix setup"
    - "setup violations"
    - "negative setup slack"
    - "WNS is negative"
    - "setup timing not met"
    - "failing setup"
  qor_metrics: [WNS, TNS, violating_paths, endpoint_count]
  risk_level: moderate
  typical_duration: "5-30 minutes depending on violation count"
---

# Fix Setup Timing Violations

## Quick Reference (90% of Cases)

If you just need to fix setup violations quickly:

```
User: "fix setup timing"
```

HiPilot will:
1. Run timing report to assess violations
2. Apply `optDesign -postRoute -setup` (Innovus) or `opt_design -setup` (ICC2)
3. Re-report to verify improvement

**Typical result:** WNS improves by 50-200ps per iteration.

---

## When to Use This Skill

| Scenario | Action |
|----------|--------|
| WNS < 0 after placement | Run post-place optimization |
| WNS < 0 after CTS | Run post-CTS optimization |
| WNS < 0 after routing | Run post-route optimization |
| Large TNS but small WNS | Many small violations - incremental opt |
| Small TNS but large WNS | Few critical paths - targeted fix |
| Regression after ECO | Analyze what changed, targeted fix |

**Prerequisites:**
- Design must be placed (for post-place opt)
- Clock tree must be built (for post-CTS opt)
- Routing must be complete (for post-route opt)

---

## Diagnosis Workflow

### Step 1: Quick Assessment

Get the headline numbers first.

**Innovus:**
```tcl
# Quick setup summary
report_timing -delay_type max -max_paths 1 -path_type summary

# Full QoR snapshot
report_qor -out_file /tmp/qor_before.rpt

# Count violating endpoints
set viol_count [sizeof_collection [get_timing_paths -slack_lesser_than 0]]
puts "Violating endpoints: $viol_count"
```

**ICC2:**
```tcl
# Setup summary across all scenarios
report_timing -scenarios [all_scenarios] \
              -delay_type max \
              -max_paths 1 \
              -path_type summary

# Full constraint report
report_constraint -all_violators -scenarios [all_scenarios]

# Count violations
set viol_count [sizeof_collection [get_timing_paths -slack_lesser_than 0 -max_paths 10000]]
puts "Violating endpoints: $viol_count"
```

**PrimeTime (for signoff verification):**
```tcl
report_timing -delay_type max \
              -max_paths 1 \
              -path_type summary \
              -slack_lesser_than 0
```

### Step 2: Identify Violation Pattern

Understanding the pattern helps choose the right fix strategy.

**Innovus:**
```tcl
# Group violations by path group
report_timing -delay_type max \
              -max_paths 0 \
              -slack_lesser_than 0 \
              -path_type summary \
              -format "path_group endpoint slack"

# Find worst path group
set worst_group ""
set worst_slack 0
foreach group [get_path_groups] {
    set wns [get_property [get_timing_paths -path_group $group -max_paths 1] slack]
    if {$wns < $worst_slack} {
        set worst_slack $wns
        set worst_group $group
    }
}
puts "Worst path group: $worst_group with WNS = $worst_slack"
```

**ICC2:**
```tcl
# Report violations by path group
foreach_in_collection pg [get_path_groups] {
    set pg_name [get_object_name $pg]
    set paths [get_timing_paths -path_group $pg_name -slack_lesser_than 0 -max_paths 1]
    if {[sizeof_collection $paths] > 0} {
        set wns [get_property $paths slack]
        puts "$pg_name: WNS = $wns"
    }
}
```

### Step 3: Root Cause Analysis

Look at the worst path to understand why it's failing.

**Innovus:**
```tcl
# Detailed report of worst path
report_timing -delay_type max \
              -max_paths 1 \
              -path_type full \
              -slack_lesser_than 0 \
              -input_pins \
              -net \
              -capacitance \
              -transition_time \
              > /tmp/worst_path.rpt
```

**ICC2:**
```tcl
# Detailed report with clock expansion
report_timing -delay_type max \
              -max_paths 1 \
              -path_type full_clock_expanded \
              -slack_lesser_than 0 \
              -input_pins \
              -nets \
              -capacitance \
              -transition_time \
              -derate \
              > /tmp/worst_path.rpt
```

**What to look for in the report:**

| Observation | Likely Cause | Fix Strategy |
|-------------|--------------|--------------|
| Large cell delay | Undersized driver | Cell sizing |
| Large net delay | High capacitance, long net | Buffer insertion |
| Deep logic (20+ levels) | Too many gates in path | Logic restructuring |
| Large clock latency | Clock tree too deep | CTS optimization |
| Large clock skew | Unbalanced clock tree | CTS rebalancing |
| High input transition | Weak driver at source | Upsize source |

---

## Fix Strategies

### Strategy A: Automatic Optimization (Recommended First)

Let the tool figure it out. Works 80% of the time.

**Innovus:**
```tcl
# Post-place optimization
optDesign -postPlace -setup

# Post-CTS optimization
optDesign -postCTS -setup

# Post-route optimization (most common)
optDesign -postRoute -setup -hold

# With higher effort (if standard doesn't close)
setOptMode -effort high
optDesign -postRoute -setup

# With aggressive settings (last resort)
setOptMode -effort high -fixFanoutLoad 1 -reclaimArea 0
setCCOptMode -fixHoldAllowSetupDegrade 1
optDesign -postRoute -setup -hold
```

**ICC2:**
```tcl
# Post-place optimization
optimize_timing -post_placement

# Post-CTS optimization
optimize_timing -post_cts

# Post-route optimization
optimize_timing -post_route

# With higher effort
set_app_options -name opt.timing.effort -value high
optimize_timing -post_route

# With incremental compilation (faster for small fixes)
compile_fabric -incremental -timing_high_effort
```

### Strategy B: Targeted Cell Sizing

When automatic opt doesn't fix specific paths.

**Innovus:**
```tcl
# Size up cells on worst paths
set worst_paths [get_timing_paths -slack_lesser_than 0 -max_paths 50]
foreach_in_collection path $worst_paths {
    set start [get_property $path startpoint]
    set end [get_property $path endpoint]
    puts "Fixing path: $start -> $end"

    # Get cells on this path and size them up
    set cells [get_property $path cells]
    foreach_in_collection cell $cells {
        set lib_cell [get_property $cell lib_cell]
        set bigger_cell [get_alternative_lib_cells $lib_cell -filter "is_bigger == true"]
        if {$bigger_cell != ""} {
            sizeof_collection $bigger_cell
            ecoUpdateCell -inst $cell -cell $bigger_cell
        }
    }
}

# Verify
report_timing -max_paths 5 -slack_lesser_than 0
```

**ICC2:**
```tcl
# Size up cells on violating paths
set paths [get_timing_paths -slack_lesser_than 0 -max_paths 50]
foreach_in_collection path $paths {
    set cells [get_property $path cells]
    foreach_in_collection cell $cells {
        set current_size [get_property $cell ref_name]
        # Get next larger size
        set sizes [get_alternative_lib_cells $cell]
        # Logic to pick larger cell...
        size_cell $cell $larger_cell_name
    }
}
```

### Strategy C: Buffer Insertion

For long nets with high capacitance.

**Innovus:**
```tcl
# Find high-capacitance nets
set high_cap_nets [get_nets -filter "total_capacitance > 0.1"]
foreach net $high_cap_nets {
    puts "High cap net: $net, cap = [get_property $net total_capacitance]"
}

# Insert buffers automatically
setBufferMode -effort high
addBufferOnTracks

# Or manually insert buffer
addBuffer -inst buffer_inst_name -net high_cap_net -cell BUFFD1
```

**ICC2:**
```tcl
# Insert buffers on long nets
insert_buffer -on_nets [get_nets -filter "capacitance > 0.1"] \
              -lib_cell [get_lib_cells */BUF_X4]
```

### Strategy D: Cloning High-Fanout Cells

When one driver feeds many loads, causing high cap.

**Innovus:**
```tcl
# Find high fanout nets
set hfn_nets [get_nets -filter "fanout > 20"]
foreach net $hfn_nets {
    set driver [get_property $net driver]
    set fanout [get_property $net fanout]
    puts "HFN: $net driven by $driver, fanout = $fanout"
}

# Clone driver to reduce fanout
cloneInstance -inst $driver -new_inst clone_1
# Re-route nets to new clone...
```

**ICC2:**
```tcl
# Clone high fanout drivers
clone_cell -cell [get_cells -filter "is_high_fanout == true"] \
           -num_copies 2
```

### Strategy E: Logic Restructuring

For paths that are just too deep.

**When needed:**
- Path has 20+ logic levels
- Automatic optimization can't close timing
- Architecture changes are acceptable

**Approach:**
1. Identify the logic cone
2. Work with RTL designer to restructure
3. May require RTL changes (out of scope for P&R)

---

## Complete Workflow Script

**Innovus - One-shot fix:**
```tcl
#!/usr/bin/tclsh
# fix_setup_timing_innovus.tcl
# Complete workflow to fix setup timing

puts "=========================================="
puts "Setup Timing Fix Workflow - Innovus"
puts "=========================================="

# Step 1: Capture initial state
puts "\n[Step 1] Initial timing assessment..."
report_timing -max_paths 1 -path_type summary -slack_lesser_than 0
set initial_wns [get_property [get_timing_paths -max_paths 1 -slack_lesser_than 999] slack]
puts "Initial WNS: $initial_wns"

# Step 2: Run optimization
puts "\n[Step 2] Running post-route optimization..."
setOptMode -effort high -fixFanoutLoad 1
optDesign -postRoute -setup

# Step 3: Check improvement
puts "\n[Step 3] Checking results..."
report_timing -max_paths 1 -path_type summary -slack_lesser_than 0
set final_wns [get_property [get_timing_paths -max_paths 1 -slack_lesser_than 999] slack]
puts "Final WNS: $final_wns"

# Step 4: Calculate improvement
set improvement [expr $final_wns - $initial_wns]
puts "\n=========================================="
puts "Result: WNS improved by $improvement ps"
if {$final_wns >= 0} {
    puts "Status: TIMING CLEAN!"
} else {
    puts "Status: Additional iterations may be needed"
}
puts "=========================================="
```

**ICC2 - One-shot fix:**
```tcl
#!/usr/bin/tclsh
# fix_setup_timing_icc2.tcl
# Complete workflow to fix setup timing

puts "=========================================="
puts "Setup Timing Fix Workflow - ICC2"
puts "=========================================="

# Step 1: Capture initial state
puts "\n[Step 1] Initial timing assessment..."
report_timing -delay_type max -max_paths 1 -path_type summary
set initial_wns [get_property [get_timing_paths -max_paths 1] slack]
puts "Initial WNS: $initial_wns"

# Step 2: Run optimization
puts "\n[Step 2] Running post-route optimization..."
set_app_options -name opt.timing.effort -value high
optimize_timing -post_route

# Step 3: Check improvement
puts "\n[Step 3] Checking results..."
report_timing -delay_type max -max_paths 1 -path_type summary
set final_wns [get_property [get_timing_paths -max_paths 1] slack]
puts "Final WNS: $final_wns"

# Step 4: Calculate improvement
set improvement [expr $final_wns - $initial_wns]
puts "\n=========================================="
puts "Result: WNS improved by $improvement ps"
if {$final_wns >= 0} {
    puts "Status: TIMING CLEAN!"
} else {
    puts "Status: Additional iterations may be needed"
}
puts "=========================================="
```

---

## Verification Workflow

After running fixes, always verify.

**Innovus:**
```tcl
# Full timing verification
report_timing -delay_type max \
              -max_paths 100 \
              -slack_lesser_than 0 \
              -path_type summary

# Check for new hold violations (setup opt can hurt hold)
report_timing -delay_type min \
              -max_paths 10 \
              -slack_lesser_than 0

# Generate signoff-quality report
report_timing -delay_type max \
              -path_type full_clock_expanded \
              -max_paths 20 \
              -input_pins \
              -net \
              -capacitance \
              -transition_time \
              > reports/setup_final.rpt
```

**ICC2:**
```tcl
# Verify across all scenarios
report_timing -scenarios [all_scenarios] \
              -delay_type max \
              -max_paths 10 \
              -slack_lesser_than 0

# Check hold wasn't broken
report_timing -scenarios [all_scenarios] \
              -delay_type min \
              -max_paths 10 \
              -slack_lesser_than 0

# Signoff report
report_timing -scenarios [all_scenarios] \
              -delay_type max \
              -path_type full_clock_expanded \
              -max_paths 20 \
              -input_pins \
              -nets \
              -capacitance \
              > reports/setup_final.rpt
```

**PrimeTime (Final Signoff):**
```tcl
# Load design and parasitics first
read_verilog design.v
read_sdc constraints.sdc
read_parasitics design.spef

# Setup signoff
report_timing -delay_type max \
              -path_type full_clock_expanded \
              -max_paths 100 \
              -slack_lesser_than 0.01 \
              -input_pins \
              -nets \
              -transition_time \
              -capacitance \
              -nosplit \
              > reports/pt_setup_signoff.rpt

# Check if clean
set wns [get_property [get_timing_paths -max_paths 1 -slack_lesser_than 0] slack]
if {$wns >= 0} {
    puts "SETUP TIMING CLEAN IN PRIMETIME!"
} else {
    puts "Setup WNS = $wns - needs more work"
}
```

---

## Common Pitfalls

### Pitfall 1: Optimizing Without Updating Timing

```tcl
# WRONG - timing not updated
optDesign -postRoute -setup
report_timing  # May show stale data

# CORRECT - force timing update
optDesign -postRoute -setup
update_timing
report_timing
```

### Pitfall 2: Breaking Hold While Fixing Setup

Setup optimization can make hold worse. Always check both.

```tcl
# Fix setup
optDesign -postRoute -setup

# ALWAYS check hold after
report_timing -delay_type min -max_paths 10 -slack_lesser_than 0

# If hold broken, fix it
optDesign -postRoute -hold
```

### Pitfall 3: Over-constraining

Setting unrealistic goals prevents convergence.

```tcl
# WRONG - too aggressive
setOptMode -effort high -targetSetupSlack 0.5
# Tool may give up if it can't reach 0.5

# CORRECT - realistic goals
setOptMode -effort high -targetSetupSlack 0.0
```

### Pitfall 4: Ignoring Clock Quality

Bad clock tree = bad timing that opt can't fix.

```tcl
# Check clock tree before blaming logic
report_clock_timing -type summary
report_clock_timing -type skew -max_paths 10

# If skew is > 100ps, fix CTS first
ccopt_design
```

### Pitfall 5: Not Saving Checkpoints

Always save before and after optimization.

```tcl
# Save before
saveDesign checkpoint_before_opt

# Optimize
optDesign -postRoute -setup

# Save after
saveDesign checkpoint_after_opt
```

---

## Real Examples

### Example 1: Simple Setup Fix

**Scenario:** WNS = -45ps, 23 violating endpoints after routing

**Actions:**
```tcl
# Innovus
optDesign -postRoute -setup

# Result: WNS = +12ps, 0 violations
# Time: 8 minutes
```

### Example 2: Stubborn Violations

**Scenario:** WNS = -120ps, automatic opt not helping

**Diagnosis:**
- 3 critical paths with same startpoint
- Driver cell too small (X2)
- Fanout = 15

**Actions:**
```tcl
# Manual fix
ecoUpdateCell -inst u_core/data_driver -cell BUF_X8

# Re-optimize
optDesign -postRoute -setup

# Result: WNS = +5ps
# Time: 15 minutes (including diagnosis)
```

### Example 3: Clock Skew Problem

**Scenario:** WNS = -80ps, but logic delay is fine

**Diagnosis:**
- Clock skew = 150ps (way too high)
- One clock branch much longer

**Actions:**
```tcl
# Fix clock tree
ccopt_design -postRoute

# Re-check timing
report_timing -delay_type max -max_paths 1

# Result: WNS = +20ps, skew reduced to 35ps
# Time: 25 minutes
```

---

## Expected Results

| Starting WNS | Typical Fix | Expected Result | Time |
|--------------|-------------|-----------------|------|
| -10 to -50ps | 1 opt iteration | Clean (+5 to +20ps) | 5-10 min |
| -50 to -100ps | 2-3 iterations | Clean or small neg | 15-30 min |
| -100 to -200ps | Targeted fixes | Significant improvement | 30-60 min |
| > -200ps | May need RTL changes | Partial improvement | Hours |

---

## Related Skills

- `/report-timing` - For detailed timing analysis
- `/fix-hold-timing` - After setup is clean
- `/compare-qor` - To track improvement across iterations
- `/save-design` - Before and after optimization

---

## Summary Checklist

Before running setup fix:
- [ ] Design is at appropriate stage (post-CTS or post-route)
- [ ] Timing is up to date (`update_timing`)
- [ ] Checkpoint saved

After running setup fix:
- [ ] Verify WNS improved
- [ ] Check hold wasn't broken
- [ ] Count remaining violations
- [ ] Save checkpoint

If not clean after 3 iterations:
- [ ] Analyze root cause (clock? logic depth? capacitance?)
- [ ] Consider targeted manual fixes
- [ ] May need CTS or RTL changes
