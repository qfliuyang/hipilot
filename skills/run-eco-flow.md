---
name: run-eco-flow
description: >
  Execute automated ECO (Engineering Change Order) workflow. Analyzes design
  changes, applies ECO fixes, and verifies results. Used for post-tapeout
  fixes and late-stage modifications.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  uses_mcp_tools:
    - workflow.run
    - workflow.get_status
    - qor.snapshot
    - qor.compare
    - eda.wait_for_prompt
    - eda.get_last_result
    - eda.diagnose_error
  autonomous: true
  flow_stages: [post_route, signoff]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `eco_type` | string | `timing` | Type: `timing`, `functional`, `drc` |
| `preserve_routing` | boolean | `true` | Minimize routing changes |
| `max_iterations` | integer | `3` | Maximum ECO iterations |
| `save_checkpoint` | boolean | `true` | Save checkpoint before ECO |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `workflow.run` | Execute ECO workflow |
| `workflow.get_status` | Monitor ECO progress |
| `qor.snapshot` | Capture before/after |
| `qor.compare` | Measure ECO impact |
| `eda.diagnose_error` | Diagnose ECO failures |

---

## Workflow

### Step 1 — Pre-ECO Baseline

**MCP Call:**
```
session.save_checkpoint name="pre_eco" description="Before ECO flow"
qor.snapshot name="pre_eco" description="Baseline for ECO comparison"
```

---

### Step 2 — Start ECO Workflow

**MCP Call:**
```
workflow.run name="eco_flow" params={
  eco_type: "timing",
  preserve_routing: true
}
```

**Response:**
```
run_id: run_1740123456789
status: running
current_step: 1/3
```

---

### Step 3 — Monitor ECO Progress

**Step 1: Analyze Changes**
```
status: running
step_name: "Analyze ECO Changes"
elapsed: 30s
```

**Step 2: Apply ECO**
```
status: running
step_name: "Apply ECO Fixes"
elapsed: 90s
```

**Step 3: Verify**
```
status: running  
step_name: "Verify ECO Results"
elapsed: 120s
```

---

### Step 4 — Post-ECO Comparison

**MCP Call:**
```
qor.snapshot name="post_eco" description="After ECO flow"
qor.compare snapshot1="pre_eco" snapshot2="post_eco"
```

---

## Built-in Workflow Steps

### Step 1: Analyze Changes

**ICC2:**
```tcl
report_design -changes
eco_update_tree
```

**Innovus:**
```tcl
ecoAnalyzeDesign
```

### Step 2: Apply ECO

**ICC2:**
```tcl
eco_route -fix_drc
eco_optimize_timing
```

**Innovus:**
```tcl
ecoRoute -fix_drc
ecoOptimize
```

### Step 3: Verify

**Both:**
```tcl
verify_drc
verify_connectivity
report_timing -max_paths 10
```

---

## Example Output

```
🔧 Running ECO Flow (timing)

[Pre-ECO Baseline]
  WNS: -0.12ns, TNS: -3.5ns, DRC: 5 violations
  Checkpoint: pre_eco saved

[Step 1/3] Analyzing ECO Changes...
  ✓ 12 paths identified for fixing
  
[Step 2/3] Applying ECO Fixes...
  ✓ Cell sizing applied to 8 cells
  ✓ Buffer insertion on 3 nets
  
[Step 3/3] Verifying ECO Results...
  ✓ DRC clean
  ✓ Timing improved

📊 ECO Flow Complete

  QoR Comparison:
    WNS: -0.12ns → +0.02ns (+0.14ns) ✓ TIMING CLEAN
    TNS: -3.5ns → 0.0ns (+3.5ns) ✓
    DRC: 5 → 0 ✓
    
  Routing Impact:
    Modified nets: 15
    Rerouted: 3
    Preserved: 97%
```

---

## ECO Types

### Timing ECO
- Focus: Fix timing violations
- Strategy: Cell sizing, buffer insertion
- Preserve: Routing where possible

### Functional ECO
- Focus: Logic changes
- Strategy: Metal-only fixes, spare cells
- Preserve: All routing

### DRC ECO
- Focus: Fix design rule violations
- Strategy: Eco routing, filler removal
- Preserve: Non-violating areas

---

## Rollback on Failure

If ECO degrades QoR:

```
qor.compare snapshot1="pre_eco" snapshot2="post_eco"
→ WNS degraded by 0.05ns

session.restore_checkpoint checkpoint_id="pre_eco"
→ Checkpoint restored, ECO rolled back
```

---

## Success Criteria

- [ ] Baseline captured before ECO
- [ ] ECO type identified correctly
- [ ] Workflow executed successfully
- [ ] QoR improved or maintained
- [ ] DRC clean after ECO
- [ ] Routing preserved where possible
