# EDA Tcl Workflow with HiPilot

When working with EDA tools (Innovus, ICC2, PrimeTime), ALWAYS use the HiPilot MCP tools instead of direct Bash commands.

## ⚠️ IMPORTANT: Use MCP Tools, Not Bash

```
❌ DO NOT: Use Bash to send commands to EDA tools
   - tmux send-keys via Bash
   - echo to /dev/pts
   - Direct shell commands

✅ DO: Use HiPilot MCP tools
   - eda.generate_tcl()
   - eda.send_to_terminal()
   - eda.approve_pending()
```

## Standard Workflow

### Step 1: Check Status
```
Call: eda.get_mode()
Call: eda.detect_tool()
```

### Step 2: Generate Tcl
```
Call: eda.generate_tcl({
  intent: "natural language description",
  operation: "report_timing|fix_setup_timing|...",
  tool: "auto|icc2|innovus"
})
```

### Step 3: Send to Terminal
```
Call: eda.send_to_terminal({
  tcl: "generated tcl content"
})
```

This will:
- In Manual mode: Queue Tcl and return approval prompt
- In Auto mode: Execute immediately (unless dangerous)

### Step 4: Handle Approval (Manual Mode Only)

For Safe/Moderate operations:
```
User says "yes" → Call: eda.approve_pending()
User says "no" → Call: eda.reject_pending()
```

For Dangerous operations (🟠):
```
User must type "CONFIRM" → Call: eda.confirm_dangerous({confirmation_text: "CONFIRM"})
```

For Critical operations (🔴):
```
User must type full phrase → Call: eda.confirm_dangerous({confirmation_text: "full phrase"})
```

## Risk Levels

| Level | Color | Approval |
|-------|-------|----------|
| Safe | 🟢 | Say "yes" |
| Moderate | 🟡 | Say "yes" |
| Dangerous | 🟠 | Type "CONFIRM" |
| Critical | 🔴 | Type full phrase |

## Check Before Each Operation

1. **Mode**: Is it Manual or Auto?
2. **Pending**: Is there already Tcl waiting?
3. **Tool**: Which EDA tool is running?

## Common Operations

### Report Timing
```
1. eda.generate_tcl({intent: "report timing", operation: "report_timing"})
2. eda.send_to_terminal({tcl: result.tcl})
3. If Manual mode: Ask user for approval
```

### Fix Setup Timing
```
1. eda.generate_tcl({intent: "fix setup violations", operation: "fix_setup_timing"})
2. eda.send_to_terminal({tcl: result.tcl})
3. If Manual mode: Ask user for approval
```

### Analyze Risk Without Executing
```
1. eda.get_risk_analysis({tcl: "your tcl here"})
2. Show risk level to user
3. Proceed based on risk level
```

## Never Do This

```
❌ Bash(tmux send-keys ...)
❌ Bash(echo "command" > /dev/pts/1)
❌ Write directly to /tmp files and source them manually
```

These bypass the approval system and defeat the purpose of HiPilot's safety features.
