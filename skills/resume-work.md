---
name: resume-work
description: >
  Restore session context from a saved checkpoint. Lists available checkpoints,
  shows QoR at checkpoint time, and restores context for continuing work.
  Note: This restores context only, not EDA tool state.

hipilot:
  vendor: [synopsys, cadence]
  uses_mcp_tools:
    - session.list_checkpoints
    - session.restore_checkpoint
    - session.get_context
    - context.detect
    - context.suggest_next
  autonomous: false
  flow_stages: [all]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `checkpoint` | string | `""` | Checkpoint name or ID to restore (empty = list all) |
| `show_qor` | boolean | `true` | Show QoR at checkpoint time |
| `suggest_next` | boolean | `true` | Suggest next steps after restore |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `session.list_checkpoints` | List available checkpoints |
| `session.restore_checkpoint` | Restore checkpoint context |
| `session.get_context` | Get session context |
| `context.detect` | Detect current design context |
| `context.suggest_next` | Suggest next actions |

---

## Workflow

### Step 1 — List Checkpoints (if no checkpoint specified)

**MCP Call:**
```
session.list_checkpoints
```

**Response:**
```
checkpoints:
  1. pre_cts (ckpt_1740100000000)
     Saved: 2026-02-23 10:00:00
     WNS: -0.15ns
     
  2. post_cts (ckpt_1740110000000)
     Saved: 2026-02-23 12:00:00
     WNS: -0.10ns
     
  3. pre_route (ckpt_1740120000000)
     Saved: 2026-02-23 14:00:00
     WNS: -0.08ns
```

---

### Step 2 — Restore Checkpoint

**MCP Call:**
```
session.restore_checkpoint checkpoint_id="pre_cts"
```

**Response:**
```
restored: true
checkpoint:
  name: pre_cts
  saved_at: 2026-02-23T10:00:00Z
  context:
    tool: innovus
    stage: post_place
    qor:
      wns: -0.15
      tns: -5.2
```

---

### Step 3 — Detect Current Context

**MCP Call:**
```
context.detect
```

---

### Step 4 — Suggest Next Steps

**MCP Call:**
```
context.suggest_next
```

**Response:**
```
suggestions:
  1. Run CTS (clock tree synthesis) - High priority
     Reason: Currently at post_place stage
  2. Continue timing optimization - Medium priority
     Reason: WNS still negative (-0.15ns)
```

---

## Example Usage

### List and Select

```
User: Resume work

> session.list_checkpoints
  📋 Available Checkpoints:
  
  1. pre_cts (WNS: -0.15ns, saved 2026-02-23 10:00)
  2. post_cts (WNS: -0.10ns, saved 2026-02-23 12:00)
  3. pre_route (WNS: -0.08ns, saved 2026-02-23 14:00)
  
  Which checkpoint to restore?

User: post_cts

> session.restore_checkpoint checkpoint_id="post_cts"
  ✓ Checkpoint restored: post_cts
  
  Restored Context:
    Tool: Innovus
    Stage: post_cts
    QoR at save: WNS -0.10ns, TNS -2.5ns
    
> context.suggest_next
  💡 Next Steps:
    1. Run routing (high priority)
    2. Continue timing optimization (medium priority)
```

### Direct Restore

```
User: Resume from pre_route

> session.restore_checkpoint checkpoint_id="pre_route"
  ✓ Checkpoint restored: pre_route
  
  Context loaded:
    Tool: Innovus
    Stage: post_cts
    QoR: WNS -0.08ns
    
  Ready to continue with routing.
```

---

## Important Notes

### What Is Restored
- ✅ Session context (tool, stage, design)
- ✅ QoR metrics at checkpoint time
- ✅ Command history
- ✅ Checkpoint metadata

### What Is NOT Restored
- ❌ EDA tool state (must reload design)
- ❌ Physical database changes
- ❌ Cell placements/routing

### Full Restore Workflow

To fully restore to a checkpoint state:
1. Run `resume-work` to get context
2. Reload design in EDA tool from saved checkpoint
3. Continue from where you left off

---

## Integration with Other Skills

**After ECO rollback:**
```
resume-work checkpoint="pre_eco"
eco-flow  # Retry ECO with different approach
```

**Continue previous session:**
```
resume-work checkpoint="last"
auto-fix-timing  # Continue timing fixes
```

**Compare approaches:**
```
resume-work checkpoint="approach_a"
# Note results
resume-work checkpoint="approach_b"
# Compare approaches
```

---

## Success Criteria

- [ ] Checkpoints listed if no ID provided
- [ ] Selected checkpoint restored
- [ ] Context displayed to user
- [ ] Next steps suggested (if enabled)
- [ ] User ready to continue work
