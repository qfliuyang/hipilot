---
name: auto-fix-timing
description: >
  Autonomous timing fix loop using MCP feedback tools. Analyzes setup timing 
  violations, applies fixes, verifies results, and iterates until timing is 
  clean or max iterations reached. Uses QoR tracking to measure progress.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  uses_mcp_tools:
    - qor.snapshot
    - qor.compare
    - eda.wait_for_prompt
    - eda.get_last_result
    - eda.diagnose_error
    - eda.validate_tcl
    - suggest.for_violation
    - session.save_checkpoint
  autonomous: true
  max_iterations: 5
  flow_stages: [post_place, post_cts, post_route]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timing_type` | string | `setup` | Type of timing to fix: `setup` or `hold` |
| `max_iterations` | integer | `5` | Maximum fix-verify loop iterations |
| `wns_target` | float | `0.0` | Target WNS to achieve (0.0 = timing clean) |
| `corners` | list | `[all]` | Timing corners to fix for |
| `path_group` | string | `""` | Limit fixes to specific path group (empty = all) |
| `auto_commit` | boolean | `false` | If true, save checkpoint after each successful iteration |

---

## MCP Tools Used

This skill leverages new MCP tools for autonomous operation:

| Tool | Purpose |
|------|---------|
| `qor.snapshot` | Capture baseline and after-fix QoR |
| `qor.compare` | Measure improvement between iterations |
| `eda.wait_for_prompt` | Wait for EDA tool to complete command |
| `eda.get_last_result` | Parse command output for success/failure |
| `eda.diagnose_error` | Analyze failures and suggest fixes |
| `eda.validate_tcl` | Validate Tcl before sending |
| `suggest.for_violation` | Get targeted fix suggestions |
| `session.save_checkpoint` | Save progress for rollback |

---

## Workflow

### Step 1 — Capture Baseline QoR

Before making any changes, capture current timing state.

**MCP Call:**
```
qor.snapshot name="baseline" description="Before auto-fix-timing"
```

**Expected Response:**
```
snapshot_id: snap_xxx
metrics: { wns: -0.250, tns: -15.5, setup_violations: 47 }
```

---

### Step 2 — Generate Timing Report

Get detailed timing violations for analysis.

**ICC2:**
```tcl
report_timing -scenario [all_scenarios] \
              -max_paths 50 \
              -slack_lesser_than 0 \
              -input_pins \
              -nets \
              > /tmp/timing_violations.rpt
```

**Innovus:**
```tcl
report_timing -max_paths 50 \
              -slack_lesser_than 0 \
              -input_pins \
              -net \
              > /tmp/timing_violations.rpt
```

**MCP Call:**
```
eda.capture_and_wait tcl="report_timing -max_paths 50 -slack_lesser_than 0"
```

---

### Step 3 — Get Fix Suggestions

Analyze violations and get targeted fix suggestions.

**MCP Call:**
```
suggest.for_violation violation_type="setup" path_group="<path_group>"
```

**Expected Response:**
```
suggestions:
  1. Size up drivers on critical paths
     Tcl: size_cell $cells $larger_size
     Expected Impact: 0.1-0.3ns improvement
  2. Insert buffers for long nets
     Tcl: insert_buffer $net $buffer_cell
     Expected Impact: 0.05-0.15ns improvement
```

---

### Step 4 — Validate Fix Tcl

Before applying, validate the generated fix Tcl.

**MCP Call:**
```
eda.validate_tcl tcl="<fix_tcl>"
```

**Expected Response:**
```
valid: true
errors: []
```

If validation fails, diagnose and fix before proceeding.

---

### Step 5 — Apply Fixes

Send fix Tcl to EDA terminal.

**ICC2 Fix Example:**
```tcl
# Size up critical path drivers
foreach_in_collection cell [get_cells -of [get_timing_paths -max_paths 10 -slack_lesser_than 0]] {
  set lib_cell [get_lib_cell -of $cell]
  set larger_cell [get_alternative_lib_cells $lib_cell -filter "size > [get_attribute $lib_cell size]" -limit 1]
  if {$larger_cell != ""} {
    size_cell $cell $larger_cell
  }
}
```

**Innovus Fix Example:**
```tcl
# Size up critical path drivers
foreach cell [get_cells -of [get_timing_paths -max_paths 10 -slack_lesser_than 0]] {
  set lib_cell [get_lib_cell -of $cell]
  set larger_cell [get_alternative_lib_cells $lib_cell -filter "size > [get_attribute $lib_cell size]" -limit 1]
  if {$larger_cell != ""} {
    size_cell $cell $larger_cell
  }
}
```

**MCP Call:**
```
eda.capture_and_wait tcl="<fix_tcl>" timeout=120
```

---

### Step 6 — Wait for Completion

Wait for EDA tool to process changes.

**MCP Call:**
```
eda.wait_for_prompt timeout=120
```

---

### Step 7 — Check Result

Parse the output to determine if fix succeeded.

**MCP Call:**
```
eda.get_last_result lines=100
```

**Expected Response:**
```
success: true
error_type: null
summary: "Command completed successfully"
```

If failed:
```
success: false
error_type: "constraint"
summary: "Clock 'clk' not found"
```

---

### Step 8 — Capture After-Fix QoR

Measure the impact of fixes.

**MCP Call:**
```
qor.snapshot name="after_fix_iter_1" description="After iteration 1"
```

---

### Step 9 — Compare Progress

Compare current QoR to baseline.

**MCP Call:**
```
qor.compare snapshot1="baseline" snapshot2="after_fix_iter_1"
```

**Expected Response:**
```
delta:
  wns: +0.15  (improved from -0.25 to -0.10)
  tns: +5.2   (improved from -15.5 to -10.3)
  violations: -15  (reduced from 47 to 32)
improved: true
summary: "WNS improved by 0.15ns, TNS improved by 5.2ns"
```

---

### Step 10 — Iterate or Stop

**If improved and WNS < target:**
- Continue to Step 3 for another iteration
- Use different fix strategy (buffer insertion, restructuring)

**If degraded:**
- Diagnose error: `eda.diagnose_error output="<error_output>"`
- Consider rollback using `session.restore_checkpoint`

**If WNS >= target (timing clean):**
- Save final checkpoint: `session.save_checkpoint name="timing_clean"`
- Report success

---

### Step 11 — Save Checkpoint (Optional)

After each successful iteration, optionally save progress.

**MCP Call:**
```
session.save_checkpoint name="timing_fix_iter_N" description="WNS improved to X.XXX"
```

---

## Error Recovery

If an iteration fails:

### Diagnose Error

**MCP Call:**
```
eda.diagnose_error output="<error_output>"
```

**Response Example:**
```
category: "syntax"
explanation: "Detected syntax error: missing brace"
suggested_fixes:
  - "Check Tcl syntax around line 15"
```

### Auto-Recover

Based on error category, apply recovery:
- **Syntax errors:** Validate Tcl, fix syntax, retry
- **Constraint errors:** Check clocks, SDC, retry
- **Resource errors:** Wait and retry, or reduce scope

---

## Example Session

```
User: Run auto-fix-timing with max_iterations=3

[Iteration 1]
> qor.snapshot "baseline" → WNS: -0.250ns, 47 violations
> suggest.for_violation "setup" → 3 fix suggestions
> eda.validate_tcl → Valid
> eda.capture_and_wait → Applied size_cell fixes
> eda.wait_for_prompt → Done (12.3s)
> eda.get_last_result → Success
> qor.snapshot "after_fix_1" → WNS: -0.150ns, 32 violations
> qor.compare → Improved +0.100ns

[Iteration 2]
> suggest.for_violation "setup" → 2 fix suggestions (buffer insertion)
> eda.capture_and_wait → Applied buffer insertion
> eda.wait_for_prompt → Done (18.5s)
> qor.snapshot "after_fix_2" → WNS: -0.050ns, 12 violations
> qor.compare → Improved +0.100ns

[Iteration 3]
> suggest.for_violation "setup" → 1 fix suggestion (path restructuring)
> eda.capture_and_wait → Applied restructuring
> eda.wait_for_prompt → Done (25.1s)
> qor.snapshot "after_fix_3" → WNS: +0.010ns, 0 violations
> qor.compare → TIMING CLEAN!

✓ Auto-fix-timing complete: Achieved WNS +0.010ns in 3 iterations
  Total improvement: +0.260ns from baseline
```

---

## Success Criteria

- [ ] Baseline QoR captured before any changes
- [ ] Fix suggestions generated from actual violations
- [ ] Tcl validated before sending to EDA
- [ ] Each iteration waits for completion
- [ ] Results checked for success/failure
- [ ] QoR compared between iterations
- [ ] Errors diagnosed when fixes fail
- [ ] Progress saved via checkpoints
- [ ] Loop terminates when timing clean or max iterations

---

## Notes

- This skill demonstrates the power of MCP tools for autonomous workflows
- The feedback loop (wait → check → diagnose → retry) is the key innovation
- QoR tracking provides visibility into progress
- Checkpoints enable safe experimentation with rollback capability
