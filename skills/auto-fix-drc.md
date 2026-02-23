---
name: auto-fix-drc
description: >
  Autonomous DRC fix loop using MCP feedback tools. Analyzes DRC violations,
  applies fixes, verifies results, and iterates until clean or max iterations.
  Supports multiple DRC types: spacing, short, width, enclosure.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  uses_mcp_tools:
    - eda.capture_and_wait
    - eda.wait_for_prompt
    - eda.get_last_result
    - eda.diagnose_error
    - qor.snapshot
    - qor.compare
    - session.save_checkpoint
  autonomous: true
  max_iterations: 5
  flow_stages: [post_route, signoff]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `drc_types` | list | `[all]` | DRC types to fix: `spacing`, `short`, `width`, `enclosure`, `all` |
| `max_iterations` | integer | `5` | Maximum fix-verify loop iterations |
| `target_violations` | integer | `0` | Target number of violations (0 = clean) |
| `preserve_timing` | boolean | `true` | Don't degrade timing while fixing DRC |
| `auto_commit` | boolean | `false` | Save checkpoint after each successful iteration |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `eda.capture_and_wait` | Run DRC check and capture results |
| `eda.wait_for_prompt` | Wait for EDA commands to complete |
| `eda.get_last_result` | Parse DRC results |
| `eda.diagnose_error` | Analyze DRC failures |
| `qor.snapshot` | Track DRC count over iterations |
| `session.save_checkpoint` | Save progress |

---

## Workflow

### Step 1 — Capture Baseline DRC

**MCP Call:**
```
eda.capture_and_wait tcl="verify_drc" timeout=300
```

**Parse Results:**
```
drc_violations: 47
by_type:
  spacing: 23
  short: 12
  width: 8
  enclosure: 4
```

**Save Baseline:**
```
qor.snapshot name="drc_baseline" description="47 DRC violations before fix"
```

---

### Step 2 — Analyze Violations

Get detailed DRC report:

**ICC2:**
```tcl
report_drc -verbose > /tmp/drc_report.rpt
```

**Innovus:**
```tcl
verify_drc -report /tmp/drc_report.rpt
```

---

### Step 3 — Get Fix Strategy

Based on violation type, apply appropriate fix:

| Violation Type | Fix Strategy |
|----------------|--------------|
| Spacing | eco_route with increased spacing |
| Short | Ripup and reroute |
| Width | Resize metal |
| Enclosure | Adjust via placement |

---

### Step 4 — Apply DRC Fixes

**MCP Call:**
```
eda.capture_and_wait tcl="<drc_fix_tcl>" timeout=300
```

**ICC2 Example:**
```tcl
# Fix spacing violations
eco_route -fix_drc -fix_spacing

# Fix shorts
eco_route -fix_drc -fix_short
```

**Innovus Example:**
```tcl
# Fix all DRC types
ecoRoute -fix_drc
```

---

### Step 5 — Verify Fixes

**MCP Call:**
```
eda.wait_for_prompt timeout=120
eda.get_last_result lines=100
```

**Re-run DRC:**
```
eda.capture_and_wait tcl="verify_drc" timeout=300
```

---

### Step 6 — Compare Progress

**MCP Call:**
```
qor.snapshot name="drc_after_iter_1"
qor.compare snapshot1="drc_baseline" snapshot2="drc_after_iter_1"
```

**Response:**
```
delta:
  drc_violations: -25 (47 → 22)
improved: true
```

---

### Step 7 — Iterate or Stop

**If violations remain and improved:**
- Continue to Step 3 with refined strategy

**If violations = 0:**
- DRC CLEAN! Report success

**If degraded or stuck:**
- Diagnose: `eda.diagnose_error`
- Consider manual intervention

---

## Example Session

```
User: Run auto-fix-drc with max_iterations=3

[Iteration 1]
> verify_drc → 47 violations
  - Spacing: 23, Short: 12, Width: 8, Enclosure: 4
  
> qor.snapshot "drc_baseline"
> eco_route -fix_drc -fix_spacing
> verify_drc → 22 violations
  
> qor.compare → -25 violations (improved!)

[Iteration 2]  
> eco_route -fix_drc -fix_short
> verify_drc → 8 violations

> qor.compare → -14 violations (improved!)

[Iteration 3]
> eco_route -fix_drc -fix_all
> verify_drc → 0 violations

✓ DRC CLEAN in 3 iterations!
  Total fixed: 47 violations
```

---

## DRC Type-Specific Fixes

### Spacing Violations
```tcl
# ICC2
eco_route -fix_drc -fix_spacing -spacing_increment 0.02

# Innovus  
ecoRoute -fix_drc -fix_spacing
```

### Short Violations
```tcl
# ICC2
eco_route -fix_drc -fix_short -reroute_shorts

# Innovus
ecoRoute -fix_drc -fix_short
```

### Width Violations
```tcl
# ICC2
eco_route -fix_drc -fix_metal_width

# Innovus
ecoRoute -fix_drc -fix_width
```

---

## Error Recovery

If ECO routing fails:

```
eda.diagnose_error output="<error>"
→ Category: resource
  Fix: Increase routing resources or manual intervention
```

**Options:**
1. Increase routing tracks
2. Remove some routing blockages
3. Manual DRC fix

---

## Success Criteria

- [ ] Baseline DRC count captured
- [ ] Violations categorized by type
- [ ] Fixes applied based on type
- [ ] Each iteration verified
- [ ] Progress tracked via QoR compare
- [ ] Loop stops at DRC clean or max iterations
