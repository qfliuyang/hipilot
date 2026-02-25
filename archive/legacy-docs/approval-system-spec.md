# HiPilot Tcl Approval System Specification

**Version:** 0.3.0
**Date:** 2026-02-20
**Status:** Draft

---

## Overview

This specification defines a user-friendly approval system for Tcl script execution in HiPilot, with:
- Batch-level granularity (approve/reject entire script)
- Risk categorization for dangerous/slow commands
- GUI-style interaction (popups, clickable)
- Manual mode as default (safety first)

---

## User Requirements

| Requirement | Description |
|-------------|-------------|
| **Batch granularity** | One prompt generates one Tcl script → one approval decision |
| **Dangerous commands** | Extra confirmation for destructive or time-consuming operations |
| **GUI interaction** | Buttons/popups instead of keyboard shortcuts |
| **Default manual** | Always start in Manual mode for safety |

---

## Command Risk Categories

### Category 0: Safe (Green) 🟢
Instant operations, read-only, no side effects.

| Command | Description |
|---------|-------------|
| `report_timing` | Read timing information |
| `report_power` | Read power information |
| `report_area` | Read area information |
| `report_qor` | Quality of results report |
| `check_routes` | Verify routing |
| `verify_drc` | Check DRC (read-only) |
| `get_*` | Any get command |
| `all_*` | Any all command |

**Approval:** Single confirmation

### Category 1: Moderate (Yellow) 🟡
Operations that modify design but are easily reversible.

| Command | Description |
|---------|-------------|
| `optDesign` | Optimization (incremental) |
| `routeDesign` | Routing (re-runnable) |
| `placeDesign` | Placement (re-runnable) |
| `synthesize` | Synthesis (re-runnable) |
| `ccopt_design` | Clock tree synthesis |

**Approval:** Standard confirmation with estimated time

### Category 2: Dangerous (Orange) 🟠
Destructive operations that may lose work.

| Command | Description |
|---------|-------------|
| `remove_*` | Remove cells/nets/etc |
| `delete_*` | Delete objects |
| `clear_*` | Clear data |
| `reset_*` | Reset state |
| `undo` | Undo operations (can't redo) |

**Approval:** **Double confirmation** required

### Category 3: Critical (Red) 🔴
Irreversible operations or very time-consuming jobs.

| Command | Description | Risk |
|---------|-------------|------|
| `remove_design` | Remove entire design | Data loss |
| `delete_all` | Delete everything | Data loss |
| `saveDesign` / `save_block` | Overwrite checkpoint | Can corrupt |
| `exit` / `quit` | Exit tool | Lose unsaved work |
| Runs > 30 min | Long-running jobs | Time investment |

**Approval:** **Triple confirmation** with explicit typing

---

## Approval Flow Design

### Standard Flow (Category 0-1)

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code Interface                                          │
│                                                                 │
│  I've generated Tcl to report timing:                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # Report timing on pcie_rx path group                   │   │
│  │ report_timing -max_paths 10 -delay_type max \           │   │
│  │   -path_group pcie_rx -significant_digits 4             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🟢 Safe operation (~2 seconds)                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  ✅ Execute  │  │  ❌ Cancel   │  │  ⚡ Auto this session │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│                                                                 │
│  Or say: "yes", "run it", "execute"                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Dangerous Flow (Category 2)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ DANGEROUS OPERATION DETECTED                                │
│                                                                 │
│  The following script contains DESTRUCTIVE commands:           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ # Clean up clock tree for re-synthesis                  │   │
│  │ remove_clock_tree -all                                  │   │
│  │ remove_clock_latency -all                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🟠 Category: DANGEROUS                                        │
│  This will remove clock tree structures.                       │
│  Make sure you have a checkpoint saved!                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Type "CONFIRM" to proceed with this dangerous operation: │  │
│  │ [________________________] [Cancel]                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Flow (Category 3)

```
┌─────────────────────────────────────────────────────────────────┐
│  🚨 CRITICAL OPERATION - IRREVERSIBLE                           │
│                                                                 │
│  You are about to:                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ remove_design -all                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🔴 Category: CRITICAL                                        │
│  ⚠️ This will DELETE THE ENTIRE DESIGN                        │
│  ⚠️ This operation CANNOT BE UNDONE                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ To proceed, please type the exact phrase:                │  │
│  │ "DELETE DESIGN AND LOSE ALL WORK"                        │  │
│  │                                                          │  │
│  │ [____________________________________]                    │  │
│  │                                                          │  │
│  │ [I understand, proceed] [Cancel]                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code (Pane 0)                     │
│                                                                 │
│  User: "fix setup timing"                                       │
│    ↓                                                            │
│  Claude calls: eda.generate_tcl(intent, params)                 │
│    ↓                                                            │
│  Claude calls: eda.send_to_terminal(tcl, {preview: true})       │
│    ↓                                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ EDA MCP Server Response                                     ││
│  │                                                              ││
│  │ {                                                            ││
│  │   status: "pending_approval",                               ││
│  │   risk_category: 0,                                         ││
│  │   estimated_time: "2 seconds",                              ││
│  │   tcl_preview: "...",                                       ││
│  │   approval_actions: [                                       ││
│  │     { label: "✅ Execute", action: "approve" },            ││
│  │     { label: "❌ Cancel", action: "reject" },              ││
│  │     { label: "⚡ Auto mode", action: "enable_auto" }       ││
│  │   ],                                                         ││
│  │   dangerous_commands: []                                    ││
│  │ }                                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│    ↓                                                            │
│  Claude displays approval UI (text-based buttons)               │
│    ↓                                                            │
│  User says "yes" or clicks button                               │
│    ↓                                                            │
│  Claude calls: eda.approve_pending()                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        EDA Tool (Pane 1)                        │
│                                                                 │
│  Tcl executes here after approval                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### MCP Tool API Changes

#### eda.send_to_terminal (Enhanced)

```javascript
{
  name: 'eda.send_to_terminal',
  description: 'Send Tcl script to EDA terminal with approval workflow',
  inputSchema: {
    type: 'object',
    properties: {
      tcl: {
        type: 'string',
        description: 'Tcl script content to send'
      },
      pane: {
        type: 'string',
        enum: ['eda', 'chat', '0', '1'],
        default: 'eda'
      },
      preview: {
        type: 'boolean',
        default: true,
        description: 'Show preview before execution'
      },
      skip_risk_check: {
        type: 'boolean',
        default: false,
        description: 'Skip risk categorization (internal use)'
      }
    },
    required: ['tcl']
  }
}
```

#### Response Format

```javascript
// Manual mode response
{
  content: [{
    type: 'text',
    text: `
🔒 **Approval Required** (Manual Mode)

**Risk Level:** 🟢 Safe
**Estimated Time:** ~2 seconds

**Tcl Script:**
\`\`\`tcl
${tcl}
\`\`\`

---

**Actions:**
- Say **"yes"** or **"execute"** to run
- Say **"no"** or **"cancel"** to reject
- Say **"enable auto mode"** for faster execution

${dangerousCommands ? `⚠️ **Warning:** Contains: ${dangerousCommands.join(', ')}` : ''}
    `
  }],
  // Metadata for programmatic handling
  metadata: {
    status: 'pending_approval',
    risk_category: 0,
    pending_file: '/tmp/hipilot_pending.tcl',
    dangerous_commands: [],
    estimated_time_seconds: 2
  }
}
```

### Risk Categorization Engine

```javascript
// src/lib/risk-analyzer.js

const RISK_PATTERNS = {
  // Category 0: Safe
  SAFE: {
    patterns: [
      /^report_/i,
      /^check_/i,
      /^verify_/i,
      /^get_/i,
      /^all_/i,
      /^echo/i,
      /^puts/i,
    ],
    category: 0,
    color: '🟢',
    label: 'Safe',
    estimated_time: '< 5 seconds'
  },

  // Category 1: Moderate
  MODERATE: {
    patterns: [
      /^optDesign/i,
      /^routeDesign/i,
      /^placeDesign/i,
      /^synthesize/i,
      /^ccopt_design/i,
      /^route_opt/i,
      /^fix_eco_timing/i,
    ],
    category: 1,
    color: '🟡',
    label: 'Moderate',
    estimated_time: '1-10 minutes'
  },

  // Category 2: Dangerous
  DANGEROUS: {
    patterns: [
      /^remove_(?!clock_latency)/i,  // remove_* except clock_latency
      /^delete_(?!all)/i,             // delete_* except delete_all
      /^clear_/i,
      /^reset_/i,
      /^undo/i,
    ],
    category: 2,
    color: '🟠',
    label: 'Dangerous',
    confirmation_required: 'single_type',
    confirmation_text: 'CONFIRM'
  },

  // Category 3: Critical
  CRITICAL: {
    patterns: [
      /^remove_design.*-all/i,
      /^delete_all/i,
      /^remove.*-all.*-all/i,
      /^exit/i,
      /^quit/i,
    ],
    category: 3,
    color: '🔴',
    label: 'Critical',
    confirmation_required: 'double_type',
    confirmation_text: 'DELETE DESIGN AND LOSE ALL WORK'
  }
};

function analyzeRisk(tcl) {
  const lines = tcl.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const detectedRisks = [];
  let maxCategory = 0;
  let estimatedTime = 0;

  for (const line of lines) {
    for (const [level, config] of Object.entries(RISK_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(line)) {
          detectedRisks.push({
            line,
            category: config.category,
            level: config.label,
            color: config.color
          });
          maxCategory = Math.max(maxCategory, config.category);
          break;
        }
      }
    }
  }

  // Estimate time based on category
  const timeEstimates = {
    0: 5,      // seconds
    1: 300,    // 5 minutes
    2: 60,     // 1 minute
    3: 30      // seconds (but irreversible)
  };

  return {
    category: maxCategory,
    color: RISK_PATTERNS[Object.keys(RISK_PATTERNS)[maxCategory]]?.color || '🟢',
    label: RISK_PATTERNS[Object.keys(RISK_PATTERNS)[maxCategory]]?.label || 'Safe',
    detected_risks: detectedRisks,
    dangerous_commands: detectedRisks.filter(r => r.category >= 2).map(r => r.line),
    estimated_time_seconds: timeEstimates[maxCategory] || 5,
    requires_confirmation: maxCategory >= 2,
    confirmation_type: maxCategory === 3 ? 'double_type' : (maxCategory === 2 ? 'single_type' : 'none')
  };
}
```

---

## Approval UI in Terminal

Since terminal apps don't have native buttons, we provide multiple approval methods:

### Method 1: Natural Language (Primary)

User simply says:
- "yes" / "execute" / "run it" / "do it" → Approve
- "no" / "cancel" / "skip" / "don't" → Reject

Claude Code handles this via conversation.

### Method 2: tmux Popup (For tmux 3.2+)

```bash
# When Tcl is pending, show popup
tmux display-popup -E -w 80 -h 15 "
  echo '╔═══════════════════════════════════════════════════════════╗'
  echo '║           HiPilot - Tcl Approval Required                 ║'
  echo '╚═══════════════════════════════════════════════════════════╝'
  echo ''
  cat /tmp/hipilot_pending.tcl
  echo ''
  echo '───────────────────────────────────────────────────────────'
  echo 'Press Y to execute, N to cancel, or Escape to close'
" &
```

### Method 3: Web Companion (Optional)

For users who prefer GUI, launch a local web server:

```bash
hipilot web-ui
# Opens http://localhost:3456 with approval buttons
```

---

## Mode System

### Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Manual** 🔒 | Every script requires approval | Default, safest |
| **Auto** ⚡ | Scripts execute immediately | Trusted workflows, experts |
| **Auto-Safe** 🔓 | Safe scripts auto-execute, dangerous still require approval | Balanced |

### Mode Persistence

- Mode stored in `~/.hipilot/mode` (persists across sessions)
- **Always defaults to Manual** on first run
- Auto mode expires after 1 hour of inactivity (safety timeout)

```javascript
// Mode settings
{
  "mode": "manual",
  "auto_expires_at": null,
  "auto_timeout_minutes": 60
}
```

---

## Implementation Checklist

### Phase 1: Risk Analysis (Day 1)
- [ ] Create `src/lib/risk-analyzer.js`
- [ ] Define risk patterns for all categories
- [ ] Add time estimation logic
- [ ] Write unit tests

### Phase 2: MCP Response Enhancement (Day 2)
- [ ] Update `eda.send_to_terminal` response format
- [ ] Add risk metadata to responses
- [ ] Add dangerous command warnings
- [ ] Test with Claude Code

### Phase 3: Approval Flow (Day 3)
- [ ] Implement natural language approval
- [ ] Add confirmation for dangerous commands
- [ ] Add double-confirmation for critical commands
- [ ] Update system prompt

### Phase 4: UI Enhancements (Day 4)
- [ ] Add tmux popup for approval (optional)
- [ ] Improve status bar indicators
- [ ] Add approval history logging
- [ ] Documentation

---

## Testing Scenarios

### Scenario 1: Safe Operation
```
User: "report timing on pcie_rx"
Expected: 🟢 Safe, single "yes" to approve
```

### Scenario 2: Dangerous Operation
```
User: "remove the clock tree"
Expected: 🟠 Dangerous, must type "CONFIRM"
```

### Scenario 3: Critical Operation
```
User: "remove the entire design"
Expected: 🔴 Critical, must type full phrase
```

### Scenario 4: Mixed Script
```
User: "clean up and re-run timing"
Expected: Risk = max(report_timing, remove_*) = 🟠 Dangerous
```

---

## Summary

| Feature | Implementation |
|---------|----------------|
| **Batch granularity** | One Tcl script = one approval |
| **Risk categories** | 4 levels (Safe → Critical) |
| **Dangerous commands** | Require typed confirmation |
| **GUI interaction** | Natural language + optional popup |
| **Default mode** | Manual (safety first) |
| **Auto timeout** | 1 hour inactivity |

---

**End of Specification**
