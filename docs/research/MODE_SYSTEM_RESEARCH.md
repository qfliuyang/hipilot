# Mode System Research & Improvement Proposal

**Date:** 2026-02-20
**Researcher:** Claude Code
**Topic:** Manual/Auto Mode for Tcl Execution Approval

---

## Current Implementation Analysis

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Claude Code (Pane 0)                     │
│                                                              │
│  User: "fix setup timing"                                    │
│    ↓                                                         │
│  Claude calls MCP tool: eda.send_to_terminal(tcl)            │
│    ↓                                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ EDA MCP Server (servers/eda/index.js)                   ││
│  │                                                          ││
│  │ sendToTerminal() checks mode:                           ││
│  │   - AUTO:    executeTcl() immediately                   ││
│  │   - MANUAL:  queuePending() → /tmp/hipilot_pending.tcl  ││
│  └─────────────────────────────────────────────────────────┘│
│    ↓                                                         │
│  Response: "Tcl queued for approval. Press prefix+y"        │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                     EDA Tool (Pane 1)                        │
│                                                              │
│  (Nothing happens until user approves)                       │
│                                                              │
│  User presses: Ctrl+B y (prefix+y)                           │
│    ↓                                                         │
│  bin/hipilot bind-key handler:                               │
│    - Reads /tmp/hipilot_pending.tcl                          │
│    - Sends "source /tmp/hipilot_exec_*.tcl" to EDA pane      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Current Components

| Component | File | Purpose |
|-----------|------|---------|
| Mode State | `/tmp/hipilot_mode` | Stores "manual" or "auto" |
| Pending Tcl | `/tmp/hipilot_pending.tcl` | Queued Tcl waiting for approval |
| Mode Library | `src/lib/mode.js` | Node.js module for mode management |
| EDA Server | `servers/eda/index.js` | Checks mode, queues or executes Tcl |
| Tmux Bindings | `bin/hipilot` | Keyboard shortcuts for mode toggle/approve |
| Status Bar | `bin/hipilot` + `servers/tmux/` | Shows mode indicator |

### Current Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `prefix+m` | Toggle mode (manual ↔ auto) |
| `prefix+y` | Approve and execute pending Tcl |
| `prefix+n` | Reject pending Tcl |
| `prefix+M` | Show mode status |
| `Ctrl+E` | Switch to EDA pane |
| `Ctrl+S` | Save last generated Tcl |

---

## Identified Problems

### Problem 1: No Visual Preview of Pending Tcl

**Issue:** When Tcl is queued for approval, the user cannot see WHAT they're approving.

```
Current flow:
1. Claude generates Tcl
2. Tcl written to /tmp/hipilot_pending.tcl (invisible!)
3. Status bar shows "⏳ pending"
4. User presses prefix+y blindly
```

**Expected:**
```
Better flow:
1. Claude generates Tcl
2. Tcl displayed to user for review
3. User sees the actual commands
4. User decides to approve or reject
```

### Problem 2: Dual Mode State Systems

**Issue:** Mode state is managed in two places that can get out of sync.

```javascript
// In bin/hipilot (shell script):
echo 'auto' > /tmp/hipilot_mode

// In src/lib/mode.js (Node.js):
export function setMode(mode) {
  writeFileSync(MODE_FILE, mode);
}

// These should be the same, but timing issues can cause drift
```

### Problem 3: Approval Requires Tmux Focus

**Issue:** User must be focused on the tmux session to approve.

```
Scenario:
1. User is working in EDA pane
2. Claude generates Tcl (queued)
3. User has to:
   - Remember prefix (usually Ctrl+B)
   - Press prefix+y
   - NOT be in a nested tmux or SSH session
```

This doesn't work well for:
- Remote SSH sessions
- Nested tmux
- Users who forget the prefix key

### Problem 4: No Integration with Claude Code Permissions

**Issue:** The mode system is completely separate from Claude Code's `--dangerously-skip-permissions`.

```
Claude Code has:
  --dangerously-skip-permissions  (skips ALL tool confirmations)

HiPilot has:
  Manual/Auto mode  (controls ONLY Tcl execution)

These are orthogonal but the user conflates them.
```

### Problem 5: Poor User Experience for "Click and Confirm"

**Issue:** Current implementation is NOT "click and confirm" - it's "remember to check and confirm".

```
User expectation:
  "I want to see what will run and click Approve"

Current reality:
  "Tcl is queued somewhere, press key combo to approve"
```

---

## Proposed Improvements

### Option A: Preview-in-Chat-Pane (Recommended)

**Concept:** Show Tcl in chat pane for review before execution.

```javascript
function sendToTerminal(tcl, pane = 'eda', metadata = {}) {
  const mode = getMode();

  if (mode === MODES.AUTO) {
    // Auto-execute
    return executeTcl(tcl, pane);
  }

  // Manual mode - show preview
  const previewFile = `/tmp/hipilot_preview_${Date.now()}.tcl`;
  writeFileSync(previewFile, tcl);

  // Show in chat pane
  const session = process.env.HIPILOT_SESSION || 'hipilot';
  execSync(`tmux send-keys -t ${session}:0.0 "echo '=== Tcl Preview ===' && cat ${previewFile} && echo '=== End Preview ==='" Enter`);

  // Queue for approval
  queuePending(tcl, { pane, ...metadata });

  // Show tmux message
  execSync(`tmux display-message -d 10000 'Tcl shown in chat pane. prefix+y=run, prefix+n=cancel'`);

  return {
    success: true,
    queued: true,
    mode: 'manual',
    message: `Tcl preview shown in chat pane. Review and press prefix+y to execute.`,
    previewFile,
  };
}
```

**Pros:**
- User can SEE what they're approving
- Uses existing tmux infrastructure
- Works in all environments

**Cons:**
- Clutters chat pane
- Requires tmux keypress still

### Option B: Paste-to-EDA-Pane (Direct Edit)

**Concept:** Paste Tcl directly to EDA command line, let user press Enter.

```javascript
function sendToTerminal(tcl, pane = 'eda', metadata = {}) {
  const mode = getMode();

  if (mode === MODES.AUTO) {
    // Auto-execute: send each line with Enter
    const lines = tcl.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      tmuxSendKeys(pane, line);
      tmuxSendKeys(pane, 'Enter');
    }
    return { success: true, mode: 'auto' };
  }

  // Manual mode: paste Tcl WITHOUT Enter
  // User reviews and decides
  const lines = tcl.split('\n').filter(l => l.trim());

  // Show header
  tmuxSendKeys(pane, '# === HiPilot Generated Tcl ===');

  // Paste each line (no Enter)
  for (const line of lines) {
    tmuxSendKeys(pane, line);
    // Don't send Enter - let user decide
  }

  // Show instructions
  execSync(`tmux display-message -d 10000 'Tcl pasted. Review in EDA pane. Enter=run, Ctrl+C=cancel'`);

  return {
    success: true,
    queued: true,
    mode: 'manual',
    message: `Tcl pasted to EDA pane. Review and press Enter to execute, Ctrl+C to cancel.`,
  };
}
```

**Pros:**
- User sees Tcl in the actual EDA tool context
- Single Enter keypress to execute (no prefix)
- Can edit before running

**Cons:**
- Multi-line paste can be problematic in some terminals
- User might accidentally press Enter
- Doesn't work well with comments

### Option C: Tmux Popup Confirmation (tmux 3.2+)

**Concept:** Use tmux's built-in popup for confirmation.

```bash
# In bin/hipilot
tmux bind-key y run-shell "\
  if [ -f /tmp/hipilot_pending.tcl ]; then \
    tmux display-popup -E -w 80 -h 20 \"\
      echo '=== Pending Tcl ===' && \
      cat /tmp/hipilot_pending.tcl && \
      echo '' && \
      read -p 'Execute? (y/n): ' CONFIRM && \
      if [ \"\$CONFIRM\" = 'y' ]; then \
        tmux send-keys -t $HIPILOT_SESSION:0.1 \"source \$(ls -t /tmp/hipilot_exec_*.tcl | head -1)\" Enter; \
        rm -f /tmp/hipilot_pending.tcl; \
      fi \
    \"; \
  fi"
```

**Pros:**
- Clean popup UI
- Shows Tcl content
- Explicit y/n confirmation

**Cons:**
- Requires tmux 3.2+ (not available on CentOS 7 with tmux 1.8)
- Complex shell escaping

### Option D: Claude Code Native Integration (Best UX)

**Concept:** Leverage Claude Code's tool system for approval.

```javascript
// When in manual mode, return a "pending" response
// Claude sees this and asks user for confirmation
// User clicks "Allow" in Claude Code's UI
// Claude then calls eda.approve_pending

function sendToTerminal(tcl, pane = 'eda', metadata = {}) {
  const mode = getMode();

  if (mode === MODES.AUTO) {
    return executeTcl(tcl, pane);
  }

  // Manual mode
  queuePending(tcl, { pane, ...metadata });

  // Return response that Claude understands as "needs approval"
  return {
    success: true,
    queued: true,
    mode: 'manual',
    requiresApproval: true,  // Signal to Claude
    tcl: tcl,                // Show Tcl to user
    message: `Tcl ready for execution. Say "yes" or "approve" to execute, "no" or "cancel" to reject.`,
    instructions: [
      'Review the Tcl commands above',
      'Say "yes" or "approve" to execute',
      'Say "no" or "cancel" to reject',
      'Or press prefix+y in tmux to execute',
    ],
  };
}
```

**System Prompt Addition:**
```
When eda.send_to_terminal returns requiresApproval=true:
1. Show the Tcl to the user
2. Ask "Should I execute this Tcl?"
3. Wait for user's yes/no response
4. If yes: call eda.approve_pending
5. If no: call eda.reject_pending
```

**Pros:**
- Best UX - approval happens in Claude Code's interface
- Works remotely via SSH
- No tmux keypresses needed
- Visual preview built-in

**Cons:**
- Requires Claude Code to follow the protocol
- Adds latency (two LLM calls)

---

## Recommended Solution: Hybrid Approach

Combine the best aspects of Options A and D:

### Implementation Plan

#### Phase 1: Improve Visual Feedback (Immediate)

1. **Show Tcl in MCP response** - Claude displays it
2. **Show preview in chat pane** - Via tmux send-keys
3. **Add single-key approval** - Map a direct key (not prefix+key)

```bash
# Add to bin/hipilot

# F5: Quick approve (no prefix needed)
tmux bind-key -n F5 run-shell "\
  if [ -f /tmp/hipilot_pending.tcl ]; then \
    TMPFILE=/tmp/hipilot_exec_\$(date +%s).tcl; \
    cp /tmp/hipilot_pending.tcl \$TMPFILE; \
    rm -f /tmp/hipilot_pending.tcl /tmp/hipilot_pending_meta.json; \
    tmux send-keys -t $HIPILOT_SESSION:0.1 \"source \$TMPFILE\" Enter; \
    tmux display-message '✓ Executed pending Tcl'; \
  fi"

# F6: Quick reject (no prefix needed)
tmux bind-key -n F6 run-shell "\
  if [ -f /tmp/hipilot_pending.tcl ]; then \
    rm -f /tmp/hipilot_pending.tcl /tmp/hipilot_pending_meta.json; \
    tmux display-message '✗ Rejected pending Tcl'; \
  fi"
```

#### Phase 2: Claude Code Integration (Better UX)

Update the MCP tool response format:

```javascript
case 'eda.send_to_terminal': {
  const { tcl, pane = 'eda' } = args;
  const result = sendToTerminal(tcl, pane);

  if (result.queued) {
    // Build a rich response for manual mode
    let text = `🔒 **Manual Mode - Approval Required**\n\n`;
    text += `**Tcl to execute:**\n\`\`\`tcl\n${tcl}\n\`\`\`\n\n`;
    text += `**To approve:**\n`;
    text += `- Say "yes" or "approve" to execute\n`;
    text += `- Or press F5 in tmux\n`;
    text += `- Or press prefix+y (Ctrl+B y)\n\n`;
    text += `**To reject:**\n`;
    text += `- Say "no" or "cancel"\n`;
    text += `- Or press F6 in tmux\n`;
    text += `- Or press prefix+n (Ctrl+B n)\n\n`;
    text += `**To switch to auto mode:** Say "enable auto mode" or press prefix+m`;

    return {
      content: [{ type: 'text', text }],
    };
  }

  // Auto mode - show what was executed
  return {
    content: [{
      type: 'text',
      text: `⚡ **Auto Mode - Executed Immediately**\n\n\`\`\`tcl\n${tcl}\n\`\`\`\n\n${result.message}`,
    }],
  };
}
```

#### Phase 3: System Prompt Enhancement

Add to `.claude/commands` or system prompt:

```markdown
# EDA Tcl Execution Protocol

When you generate Tcl for EDA tools:

1. **Show the Tcl to the user** - Always display what will be executed
2. **Check the mode:**
   - Manual mode: Ask for confirmation before calling eda.approve_pending
   - Auto mode: Tcl executes immediately
3. **Handle user responses:**
   - "yes", "approve", "execute", "run" → call eda.approve_pending
   - "no", "cancel", "reject" → call eda.reject_pending
   - "enable auto mode" → call eda.set_mode with "auto"
   - "disable auto mode" → call eda.set_mode with "manual"

## Mode Meanings

- **Manual (🔒):** Each Tcl command requires your approval. Safer, recommended for learning.
- **Auto (⚡):** "Claude has the conn" - commands execute immediately. Faster, for experienced users.

## Best Practices

- Always explain what the Tcl will do before asking for approval
- Show the expected outcome
- Warn about potentially destructive operations
```

---

## Summary Comparison

| Approach | Preview | Approval Method | Works Remotely | Complexity |
|----------|---------|-----------------|----------------|------------|
| Current | None | prefix+y | Yes | Low |
| Option A (Chat Preview) | Chat pane | prefix+y | Yes | Low |
| Option B (EDA Paste) | EDA pane | Enter key | Yes | Medium |
| Option C (Popup) | Popup | y/n in popup | Yes | High |
| Option D (Claude Native) | Claude UI | Click/say yes | Yes | Medium |
| **Hybrid (Recommended)** | Claude + Chat | F5/prefix+y/say yes | Yes | Medium |

---

## Action Items

1. **Immediate:**
   - [ ] Add F5/F6 single-key bindings for approve/reject
   - [ ] Update MCP response to include Tcl preview
   - [ ] Add better instructions in response text

2. **Short-term:**
   - [ ] Create system prompt for Tcl execution protocol
   - [ ] Add "say yes to approve" natural language support
   - [ ] Test on EDA server (CentOS 7)

3. **Long-term:**
   - [ ] Consider tmux popup for tmux 3.2+ systems
   - [ ] Add Tcl diff view (before/after)
   - [ ] Add approval history/logging

---

## Questions for User

1. **Approval granularity:** Should each Tcl command be approved separately, or approve entire script?

2. **Timeout:** Should pending Tcl have a timeout (auto-reject after N minutes)?

3. **Audit log:** Should all approvals/rejections be logged for compliance?

4. **Dangerous operations:** Should certain operations (e.g., `remove_design`, `delete_all`) require extra confirmation?

5. **Mode persistence:** Should mode persist across sessions, or always start in Manual?

---

**End of Research Document**
