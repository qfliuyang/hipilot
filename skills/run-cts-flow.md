---
name: run-cts-flow
description: >
  Execute automated CTS (Clock Tree Synthesis) workflow. Builds clock tree,
  optimizes for skew/latency, and verifies timing. Uses workflow automation
  for multi-step execution with progress tracking.

hipilot:
  vendor: [synopsys, cadence]
  tool_versions:
    synopsys: "icc2 T-2022.03+"
    cadence: "innovus 20.10+"
  uses_mcp_tools:
    - workflow.run
    - workflow.get_status
    - workflow.list
    - qor.snapshot
    - qor.compare
    - eda.wait_for_prompt
    - eda.get_last_result
  autonomous: true
  flow_stages: [post_place]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `target_skew` | float | `0.05` | Target clock skew in ns |
| `target_latency` | float | `0.3` | Target clock latency in ns |
| `corners` | list | `[all]` | Timing corners to optimize for |
| `save_checkpoint` | boolean | `true` | Save checkpoint before CTS |
| `verify_timing` | boolean | `true` | Run timing verification after CTS |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `workflow.run` | Execute CTS workflow |
| `workflow.get_status` | Monitor workflow progress |
| `qor.snapshot` | Capture before/after QoR |
| `qor.compare` | Compare CTS impact |
| `eda.wait_for_prompt` | Wait for CTS commands |

---

## Workflow

### Step 1 — Pre-CTS Checkpoint

**MCP Call:**
```
session.save_checkpoint name="pre_cts" description="Before CTS flow"
qor.snapshot name="pre_cts" description="Baseline before CTS"
```

---

### Step 2 — Start CTS Workflow

**MCP Call:**
```
workflow.run name="run_cts_flow" params={
  target_skew: 0.05,
  target_latency: 0.3
}
```

**Response:**
```
run_id: run_1740123456789
workflow_name: run_cts_flow
status: running
current_step: 1/3
```

---

### Step 3 — Monitor Progress

**MCP Call:**
```
workflow.get_status run_id="run_1740123456789"
```

**Response (Step 1 - Build CTS):**
```
status: running
current_step: 1/3
step_name: "Build Clock Tree"
elapsed: 45s
```

**Response (Step 2 - Optimize):**
```
status: running
current_step: 2/3
step_name: "Optimize Skew/Latency"
elapsed: 120s
```

**Response (Step 3 - Verify):**
```
status: running
current_step: 3/3
step_name: "Verify Timing"
elapsed: 150s
```

---

### Step 4 — Workflow Complete

**Response:**
```
status: completed
current_step: 3/3
elapsed: 180s
results:
  skew_achieved: 0.04ns
  latency_achieved: 0.28ns
  timing_clean: true
```

---

### Step 5 — Post-CTS QoR

**MCP Call:**
```
qor.snapshot name="post_cts" description="After CTS flow"
qor.compare snapshot1="pre_cts" snapshot2="post_cts"
```

---

## Built-in Workflow Steps

### Step 1: Build Clock Tree

**ICC2:**
```tcl
synthesize_clock_trees
report_clock_timing -type summary
```

**Innovus:**
```tcl
setCTSMode -engine ckSynthesis
clockDesign -specFile Clock.ctstch
report_clock_timing -type summary
```

### Step 2: Optimize

**ICC2:**
```tcl
set_optimize_clock_command -buffer_sizing true
optimize_clock_tree
```

**Innovus:**
```tcl
ccopt_design
```

### Step 3: Verify

**Both:**
```tcl
report_clock_timing -type summary
report_timing -check_type setup -max_paths 10
```

---

## Example Output

```
🔄 Running CTS Flow

[Step 1/3] Building Clock Tree...
  ⏱️ 45s elapsed
  ✓ Clock tree synthesized

[Step 2/3] Optimizing Skew/Latency...
  ⏱️ 75s elapsed
  ✓ Optimization complete

[Step 3/3] Verifying Timing...
  ⏱️ 60s elapsed
  ✓ Timing verified

📊 CTS Flow Complete (180s)
  
  Clock Metrics:
    Skew: 0.04ns (target: 0.05ns) ✓
    Latency: 0.28ns (target: 0.3ns) ✓
    
  Timing Impact:
    WNS: -0.15ns → -0.08ns (+0.07ns) ⬆️
    TNS: -5.2ns → -2.1ns (+3.1ns) ⬆️
    
  Checkpoint: post_cts saved
```

---

## Error Handling

If workflow fails:

```
workflow.get_status run_id="run_xxx"
→ status: failed
  failed_step: 2
  error: "Clock constraint not found"
```

**Recovery:**
```
eda.diagnose_error output="<error>"
→ Suggest fix: Check SDC for clock definitions
```

---

## Success Criteria

- [ ] Checkpoint saved before CTS
- [ ] Workflow started successfully
- [ ] All 3 steps completed
- [ ] Clock skew within target
- [ ] Clock latency within target
- [ ] QoR snapshot captured
- [ ] Progress tracked via workflow status
