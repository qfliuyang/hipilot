---
name: create-checkpoint
description: >
  Save current session state including QoR metrics, command history, and design
  context. Enables rollback and resume capabilities. Always create checkpoints
  before major operations.

hipilot:
  vendor: [synopsys, cadence]
  uses_mcp_tools:
    - session.save_checkpoint
    - qor.snapshot
    - session.get_context
  autonomous: false
  flow_stages: [all]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | required | Checkpoint name (e.g., "pre_cts", "before_eco") |
| `description` | string | `""` | Optional description of checkpoint |
| `include_qor` | boolean | `true` | Include QoR snapshot |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `session.save_checkpoint` | Save session state |
| `qor.snapshot` | Capture QoR metrics |
| `session.get_context` | Get current context |

---

## Workflow

### Step 1 — Capture QoR (Optional)

If `include_qor=true`, capture current QoR:

**MCP Call:**
```
qor.snapshot name="checkpoint_<name>" description="QoR at checkpoint"
```

---

### Step 2 — Save Checkpoint

**MCP Call:**
```
session.save_checkpoint name="<name>" description="<description>"
```

**Response:**
```
checkpoint_id: ckpt_1740123456789
name: pre_cts
saved_at: 2026-02-23T16:30:00Z
qor:
  wns: -0.15
  tns: -5.2
  violations: 12
context:
  tool: innovus
  stage: post_place
```

---

## Example Usage

```
User: Create checkpoint before CTS

> qor.snapshot "checkpoint_pre_cts"
  ✓ QoR captured: WNS -0.15ns

> session.save_checkpoint name="pre_cts" description="Before CTS insertion"
  ✓ Checkpoint saved: ckpt_1740123456789

📋 Checkpoint Summary:
  ID: ckpt_1740123456789
  Name: pre_cts
  Time: 2026-02-23 16:30:00
  QoR: WNS -0.15ns, TNS -5.2ns, 12 violations
  
To restore: resume-work checkpoint="pre_cts"
To list all: session.list_checkpoints
```

---

## Best Practices

### When to Create Checkpoints

| Event | Checkpoint Name |
|-------|----------------|
| After floorplan | `post_floorplan` |
| After placement | `post_place` |
| Before CTS | `pre_cts` |
| After CTS | `post_cts` |
| Before routing | `pre_route` |
| After routing | `post_route` |
| Before ECO | `pre_eco` |
| Before major optimization | `pre_opt` |
| At timing clean | `timing_clean` |

### Naming Convention

```
<action>_<stage>[_<iteration>]

Examples:
- pre_cts
- post_route_iter_2
- before_hold_fix
- timing_clean_final
```

---

## Integration with Other Skills

**Before risky operations:**
```
create-checkpoint name="pre_eco"
eco-flow
```

**At major milestones:**
```
create-checkpoint name="post_cts"
track-progress compare_to="post_place"
```

**Before iterative fixes:**
```
create-checkpoint name="pre_timing_fix"
auto-fix-timing max_iterations=5
```

---

## Success Criteria

- [ ] QoR snapshot captured (if enabled)
- [ ] Checkpoint saved with unique ID
- [ ] Context (tool, stage) recorded
- [ ] User notified of checkpoint ID for restore
