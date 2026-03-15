# Moravec's Paradox Compliance Report

**Date:** 2026-03-15
**Version:** 1.0
**Status:** ✅ COMPLIANT

---

## Executive Summary

Moravec's paradox states that:
- **High-level reasoning** (symbolic, logical) = **EASY for AI**, HARD for humans
- **Low-level sensorimotor** (visual, physical, timing) = **HARD for AI**, EASY for humans

**HiTestBot correctly tests the HARD AI skills** (visual perception, physical coordination, timing) rather than the EASY AI skills (symbolic reasoning, API calls, log parsing).

---

## Paradox Compliance Matrix

| Skill Type | Moravec Classification | HiTestBot Method | Compliant |
|------------|----------------------|------------------|-----------|
| **Visual Perception** | HARD for AI | `tmux capture-pane`, `import -window root`, `ffmpeg` | ✅ YES |
| **Physical Coordination** | HARD for AI | `tmux send-keys`, keyboard shortcuts | ✅ YES |
| **Timing/Jitter** | HARD for AI | Human-like polling with ±30% jitter | ✅ YES |
| **Symbolic Reasoning** | EASY for AI | NOT used during test | ✅ YES |
| **API Calls** | EASY for AI | Explicitly FORBIDDEN (Anti-Cheat R1) | ✅ YES |
| **Log Parsing** | EASY for AI | Post-test only (evidence collection) | ✅ YES |

---

## Evidence: HARD Skills Being Tested

### 1. Visual Perception (Hard for AI)

HiTestBot uses **visual methods** to detect state, not symbolic queries:

```javascript
// FlowCertifier.js:717 — Visual text extraction via tmux
tmux -L ${this.socket} capture-pane -t ${this.session}:0.${paneId} -p -S -10000

// FlowCertifier.js:516 — Visual screenshot via ImageMagick
execSync(`import -window root -display ${this.display} '${file}'`, { timeout: 10000 });

// FlowCertifier.js:442-454 — Video recording via ffmpeg
nohup ffmpeg -y -f x11grab -s ${resolution} -r 30 -i :0 ...
```

**Why this is HARD for AI:**
- Requires parsing unstructured visual text
- Must handle terminal formatting, colors, scrollback
- Cannot rely on structured API responses
- Must interpret visual state from pixel data

### 2. Physical Coordination (Hard for AI)

HiTestBot uses **physical keyboard simulation**:

```javascript
// FlowCertifier.js:1222-1227 — Physical keystroke simulation
spawnSync('tmux', ['-L', this.socket, 'send-keys', '-t', target, '-l', text]);
spawnSync('tmux', ['-L', this.socket, 'send-keys', '-t', target, 'C-m']);

// FlowCertifier.js:3023-3024 — Keyboard shortcut (prefix+y)
execSync(`tmux -L ${this.socket} send-keys -t ${this.session}:0.0 C-b`);
execSync(`tmux -L ${this.socket} send-keys -t ${this.session}:0.0 y`);
```

**Why this is HARD for AI:**
- Requires timing coordination between keypresses
- Must handle terminal state transitions
- Cannot directly invoke functions — must simulate human input
- Subject to timing races and input buffering

### 3. Timing with Jitter (Hard for AI)

```javascript
// FlowCertifier.js:58-90 — Human-like timing model
const HUMAN_JITTER_PERCENT = 0.3;  // ±30% variation
const ATTENTION_MODEL = {
  high: { responseMs: 500, jitter: 0.2 },
  normal: { responseMs: 1500, jitter: 0.4 },
  low: { responseMs: 3000, jitter: 0.5 },
};
```

**Why this is HARD for AI:**
- AI prefers deterministic, optimal timing
- Humans have variable attention and response times
- Jitter introduces non-determinism that AI struggles with

---

## Evidence: EASY Skills NOT Tested (Anti-Cheat)

### Anti-Cheat Rule R1: No Direct MCP Calls

From TEST_PLAN.md Section 1.2:

| Rule | Description | Violation Example |
|------|-------------|-------------------|
| **R1** | HiTestBot NEVER calls MCP tools directly | Calling `eda.detect_tool()` directly via API |

```javascript
// FlowCertifier.js:1972 — Detection of symbolic bypass attempts
if (claudeOutput.includes('tmux send-keys') || claudeOutput.includes('bash:')) {
  return { score: 0.0, detail: 'Claude used direct bash/tmux instead of MCP tools' };
}
```

### Anti-Cheat Rule R2: No Terminal Bypass

From CheatDetector.js:

```javascript
// Detects direct terminal writes (symbolic cheat)
/tee\s+\/dev\/tty/i,  // Write directly to terminal
```

### Post-Test Evidence Collection Only

From FlowCertifier.js:23:

```javascript
/**
 * These are post-test evidence collection, not test-time cheating.
 */
```

From FlowCertifier.js:2849-2862:

```javascript
// Phase 5: Collect all logs (post-test — not cheating)
// ... MCP logs collected AFTER test completes

// Phase 6: Run cheat detection verification
const cheatDetector = new CheatDetector({ ... });
const cheatResults = await cheatDetector.runFullVerification({ ... });
```

**Why this matters:**
- MCP logs are structured data (EASY for AI to parse)
- Screenshots are unstructured visual data (HARD for AI to parse)
- Collecting logs post-test ensures we test perception, not parsing

---

## Three-View Correlation: Testing Perception

From TESTING_RULES.md Principle 3:

> **Three-View Correlation** — All assertions must be independently verifiable through:
> 1. **Logs** (text evidence)
> 2. **Screenshots** (visual evidence)
> 3. **Video** (temporal evidence)

This correlation ensures we're testing **visual perception** (HARD) not just **log parsing** (EASY).

| View | Method | Difficulty for AI |
|------|--------|-------------------|
| Logs | `tmux capture-pane` | EASY (structured) |
| Screenshots | `import -window root` | HARD (visual) |
| Video | `ffmpeg x11grab` | HARD (temporal visual) |

The requirement for **all three views** means AI must:
1. Parse text (EASY — but this alone is insufficient)
2. Interpret screenshots (HARD)
3. Analyze video sequences (HARD)

---

## Human-Like Behavior Assessment

From FlowCertifier.js:2432-2537:

```javascript
/**
 * Human-like means:
 * - Irregular timing (not mechanically precise)
 * - Variable attention (not always watching)
 * - Perceptual limitations (only sees what's on screen)
 * - Physical constraints (typing speed, reaction time)
 */
```

| Behavior | Machine Pattern | Human Pattern | HiTestBot Implementation |
|----------|----------------|---------------|--------------------------|
| Polling | Every 5.0s exactly | Variable 3-7s | `+ jitter(0.3)` |
| Typing | Instant | 50-200ms/char | `send-keys -l` + natural delay |
| Attention | 100% | Fluctuating | `ATTENTION_MODEL` states |
| Screenshots | Every 10s | Event-driven | Key moments + periodic |

---

## Cheat Detection: Preventing Symbolic Shortcuts

From CheatDetector.js — detection patterns:

```javascript
// Symbolic shortcuts that violate Moravec's paradox
/mcp\s*\.\s*(eda|tmux|knowledge)/i,  // Direct MCP calls
/tee\s+\/dev\/tty/i,                   // Direct terminal write
/puts\s+".*\[SUCCESS\].*"/i,           // Fake success messages
echo\s+".*error.*"/i,                  // Simulated error output
```

These detections ensure:
- AI cannot use EASY symbolic methods
- AI must use HARD sensorimotor methods
- Testing validates human-like behavior, not superhuman API calls

---

## Compliance Verdict

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Tests visual perception | ✅ PASS | `capture-pane`, `import -window`, `ffmpeg` |
| Tests physical coordination | ✅ PASS | `send-keys`, keyboard shortcuts |
| Tests timing/jitter | ✅ PASS | `HUMAN_JITTER_PERCENT`, `ATTENTION_MODEL` |
| Forbids symbolic shortcuts | ✅ PASS | Anti-Cheat Rules R1-R10 |
| Post-test evidence only | ✅ PASS | MCP logs collected after test |
| Human-like behavior | ✅ PASS | Irregular polling, event-driven screenshots |

---

## Conclusion

**HiTestBot is fully compliant with Moravec's paradox principles.**

The test infrastructure correctly:
1. **Tests HARD AI skills**: Visual perception, physical coordination, timing
2. **Rejects EASY AI shortcuts**: No direct MCP calls, no symbolic bypasses
3. **Validates human-like behavior**: Jitter, irregular timing, perceptual limitations
4. **Uses Three-View Correlation**: Logs + Screenshots + Video for independent verification

By testing the hard problems (sensorimotor) rather than the easy problems (symbolic), HiTestBot ensures that HiPilot's testing validates real-world usability — not just theoretical correctness.

---

## References

- FlowCertifier.js: Visual methods at lines 109-117, 516, 717, 1222-1227, 2962-2968
- CheatDetector.js: Anti-cheat patterns at lines 14, 27-32
- TEST_PLAN.md: Anti-Cheat Charter Section 1.2
- TESTING_RULES.md: Principle 3 (Three-View Correlation), Principle 10 (Cheat Prevention)
