---
name: auto-recover
description: >
  Automatic error recovery using MCP tools. Diagnoses failures, generates
  fixes, validates them, and applies automatically. For non-critical errors
  where automatic recovery is safe.

hipilot:
  vendor: [synopsys, cadence]
  uses_mcp_tools:
    - eda.diagnose_error
    - eda.validate_tcl
    - eda.capture_and_wait
    - eda.get_last_result
    - suggest.for_violation
    - session.save_checkpoint
  autonomous: true
  flow_stages: [all]
---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_retries` | integer | `3` | Maximum recovery attempts |
| `safe_mode` | boolean | `true` | Only apply non-destructive fixes |
| `save_checkpoint` | boolean | `true` | Save checkpoint before recovery |
| `require_validation` | boolean | `true` | Validate Tcl before applying |

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `eda.diagnose_error` | Identify error type |
| `suggest.for_violation` | Get fix suggestions |
| `eda.validate_tcl` | Validate fix before applying |
| `eda.capture_and_wait` | Apply fix |
| `eda.get_last_result` | Verify fix worked |

---

## Workflow

### Step 1 — Capture Error

**MCP Call:**
```
eda.get_last_result lines=100
```

If failed, continue to diagnosis.

---

### Step 2 — Diagnose Error

**MCP Call:**
```
eda.diagnose_error output="<error_output>"
```

**Response:**
```
category: syntax
explanation: "Unknown command 'size_cells'"
suggested_fixes:
  - "Use 'size_cell' instead of 'size_cells'"
```

---

### Step 3 — Get Fix

**MCP Call:**
```
suggest.for_violation violation_type="<category>"
```

**Response:**
```
suggestions:
  1. fix: Correct command name
     tcl: size_cell $cell $new_lib_cell
     expected_impact: Command will execute successfully
```

---

### Step 4 — Validate Fix

**MCP Call:**
```
eda.validate_tcl tcl="<fix_tcl>"
```

**Response:**
```
valid: true
errors: []
```

If invalid, try next suggestion or fail.

---

### Step 5 — Save Checkpoint

Before applying fix:

**MCP Call:**
```
session.save_checkpoint name="pre_recovery" description="Before auto-recovery"
```

---

### Step 6 — Apply Fix

**MCP Call:**
```
eda.capture_and_wait tcl="<fix_tcl>" timeout=60
```

---

### Step 7 — Verify Recovery

**MCP Call:**
```
eda.get_last_result lines=50
```

**Response:**
```
success: true
summary: "Command completed successfully"
```

---

## Recovery Flow

```
┌─────────────────────────────────────────────┐
│  Command Failed                             │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  eda.get_last_result                        │
│  → Get error output                         │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  eda.diagnose_error                         │
│  → Categorize: syntax/constraint/timing/etc │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  suggest.for_violation                      │
│  → Get fix suggestions with Tcl             │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  eda.validate_tcl                           │
│  → Check fix syntax                         │
└──────────────┬──────────────────────────────┘
               │
         ┌─────┴─────┐
         │ Valid?    │
         └─────┬─────┘
          Yes  │  No → Try next suggestion
               │
               ▼
┌─────────────────────────────────────────────┐
│  session.save_checkpoint                    │
│  → Save state before applying               │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  eda.capture_and_wait                       │
│  → Apply fix                                │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  eda.get_last_result                        │
│  → Verify fix worked                        │
└──────────────┬──────────────────────────────┘
               │
         ┌─────┴─────┐
         │ Success?  │
         └─────┬─────┘
          Yes  │  No → Retry or escalate
               │
               ▼
┌─────────────────────────────────────────────┐
│  ✓ Recovery Complete                        │
└─────────────────────────────────────────────┘
```

---

## Safe Mode Restrictions

When `safe_mode=true`, these fixes are NOT auto-applied:

| Category | Auto-Apply? | Reason |
|----------|-------------|--------|
| Syntax errors | ✅ Yes | Low risk |
| Missing constraints | ✅ Yes | Can be reverted |
| Timing violations | ⚠️ Review | May need judgment |
| DRC violations | ⚠️ Review | May affect timing |
| Database changes | ❌ No | Cannot auto-undo |
| File deletions | ❌ No | Destructive |

---

## Example Session

```
User: The last command failed, auto-recover

[Step 1] Analyzing failure...
  Error: unknown command "size_cells"
  Category: syntax
  
[Step 2] Getting fix suggestions...
  Suggestion: Use 'size_cell' instead of 'size_cells'
  Tcl: size_cell [get_cells buf_*] BUF_X4
  
[Step 3] Validating fix...
  ✓ Tcl syntax valid
  
[Step 4] Saving checkpoint...
  ✓ pre_recovery saved
  
[Step 5] Applying fix...
  ✓ Fix applied successfully
  
[Step 6] Verifying...
  ✓ Command completed successfully

✓ Auto-recovery successful in 1 attempt
```

---

## Escalation

If recovery fails after max retries:

```
❌ Auto-recovery failed after 3 attempts

Last error: Resource constraint violation
Requires: Manual intervention

Options:
  1. debug-failure → Full diagnosis
  2. session.restore_checkpoint → Rollback
  3. Manual fix → User intervention required
```

---

## Success Criteria

- [ ] Error diagnosed correctly
- [ ] Fix suggestions generated
- [ ] Tcl validated before applying
- [ ] Checkpoint saved
- [ ] Fix applied successfully
- [ ] Result verified
