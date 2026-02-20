# EDA Tcl Execution Protocol

When generating and executing Tcl scripts for EDA tools (ICC2, Innovus, PrimeTime, etc.), follow this approval protocol.

## Overview

HiPilot uses a **risk-based approval system** for Tcl execution:

| Risk Level | Color | Approval Method |
|------------|-------|-----------------|
| Safe | 🟢 | Say "yes" to approve |
| Moderate | 🟡 | Say "yes" to approve |
| Dangerous | 🟠 | Must type "CONFIRM" |
| Critical | 🔴 | Must type full phrase |

## Workflow

### Step 1: Generate Tcl
When the user asks you to do something with an EDA tool, generate the appropriate Tcl script using `eda.generate_tcl`.

### Step 2: Send to Terminal
Send the generated Tcl using `eda.send_to_terminal`. This will:
- In **Manual mode**: Queue the Tcl for approval and return an approval prompt
- In **Auto mode**: Execute immediately (unless dangerous/critical)

### Step 3: Handle Approval Response

When `eda.send_to_terminal` returns with `pending_approval` status:

1. **Display the approval prompt** to the user exactly as provided
2. **Wait for user response**
3. **Process the response**:

#### For Safe/Moderate Operations (🟢/🟡)
```
User says: "yes", "execute", "run it", "do it", "approve", "confirm"
→ Call eda.approve_pending()

User says: "no", "cancel", "reject", "skip"
→ Call eda.reject_pending()
```

#### For Dangerous Operations (🟠)
```
User says: "CONFIRM" (exactly)
→ Call eda.confirm_dangerous({ confirmation_text: "CONFIRM" })

User says anything else
→ Tell user: "Please type 'CONFIRM' to proceed with this dangerous operation"
```

#### For Critical Operations (🔴)
```
User says the exact phrase shown (e.g., "I UNDERSTAND THE RISKS AND WANT TO PROCEED")
→ Call eda.confirm_dangerous({ confirmation_text: "..." })

User says anything else
→ Show the required phrase again
```

## Mode Commands

Users can switch modes:

| User Says | Action |
|-----------|--------|
| "enable auto mode" or "Claude has the conn" | `eda.set_mode({ mode: "auto" })` |
| "disable auto mode" or "manual mode" | `eda.set_mode({ mode: "manual" })` |
| "toggle mode" | `eda.toggle_mode()` |
| "what mode am I in" or "show mode" | `eda.get_mode()` |

## Safety Rules

1. **Never execute dangerous/critical operations without explicit confirmation**
   - Even in auto mode, dangerous operations are blocked

2. **Always show the Tcl script** before asking for approval
   - User must see what will be executed

3. **Warn about dangerous commands**
   - Highlight commands like `remove_*`, `delete_*`, `exit`, `quit`

4. **Default to Manual mode**
   - Safety first - always start in manual mode

5. **Preserve user intent**
   - If user says "cancel", always cancel - never argue

## Example Conversation

```
User: Fix setup timing on pcie_rx

Claude: I'll generate Tcl to fix setup timing. Let me create the script...

[Calls eda.generate_tcl]

Now sending to the EDA terminal...

[Calls eda.send_to_terminal]

🔒 **Approval Required** (Manual Mode)

**Risk Level:** 🟡 Moderate
**Estimated Time:** ~5 minutes

**Tcl Script:**
```tcl
setOptMode -effort high
optDesign -postRoute -setup
report_timing -max_paths 10 -delay_type max
```

**Actions:**
- Say **"yes"** or **"execute"** to run
- Say **"no"** or **"cancel"** to reject

---

User: yes

Claude: [Calls eda.approve_pending()]

✓ Approved and executed. The optimization is now running in the EDA pane.
```

## Dangerous Operation Example

```
User: Remove the clock tree

Claude: I'll generate Tcl to remove the clock tree...

[Calls eda.send_to_terminal]

⚠️ **DANGEROUS OPERATION DETECTED**

**Risk Level:** 🟠 Dangerous
**Estimated Time:** ~1 minute

**Tcl Script:**
```tcl
remove_clock_tree -all
remove_clock_latency -all
```

**Dangerous Commands Detected:**
- 🟠 `remove_clock_tree -all`
- 🟠 `remove_clock_latency -all`

**To execute:**
- Type **"CONFIRM"** to proceed
- Say **"cancel"** to abort

---

User: CONFIRM

Claude: [Calls eda.confirm_dangerous({ confirmation_text: "CONFIRM" })]

✓ Confirmed - dangerous operation approved
✓ Executed: source /tmp/hipilot_exec_xxx.tcl
```

## Risk Categories Reference

### 🟢 Safe (Category 0)
- `report_*` - Any report command
- `check_*` - Verification commands
- `verify_*` - DRC/LVS checks
- `get_*` - Query commands
- `all_*` - Collection commands

### 🟡 Moderate (Category 1)
- `optDesign` - Optimization
- `routeDesign` - Routing
- `placeDesign` - Placement
- `synthesize` - Synthesis
- `ccopt_design` - Clock tree synthesis

### 🟠 Dangerous (Category 2)
- `remove_*` - Remove operations (except remove_design -all)
- `delete_*` - Delete operations (except delete_all)
- `clear_*` - Clear operations
- `reset_*` - Reset operations
- `undo` - Undo operations

### 🔴 Critical (Category 3)
- `remove_design -all` - Remove entire design
- `delete_all` - Delete everything
- `exit` / `quit` - Exit tool
- `saveDesign` / `save_block` - Overwrite checkpoint

---

**Remember:** When in doubt, ask for confirmation. Safety first!
