# HiPilot Test Score Improvement Plan

**Current Score:** 3.5/5.0 (Test 20260304035335)
**Target Score:** 5.0/5.0
**Gap Analysis:** L3, L4, L5 each at 0.5 - need to reach 1.0 each

---

## Score Breakdown Analysis

### Current State (Test 20260304035335)

| Layer | Score | Detail | Root Cause |
|-------|-------|--------|------------|
| L1 Prompt Delivery | 1.0 | Claude responded | ✓ Perfect |
| L2 Intent Recognition | 1.0 | Understood RTL2GDS | ✓ Perfect |
| L3 MCP Tool Usage | 0.5 | Partial: MCP(none), EDA(active) | MCP indicators scrolled out of capture |
| L4 EDA Execution | 0.5 | EDA tool active: floorplan | Innovus exited, shell prompt shown; no prompt pattern matched |
| L5 QoR Assessment | 0.5 | Metrics discussed but no WNS/TNS numbers | Regex didn't match table format |

**Total:** 3.5/5.0

---

## Root Cause Analysis

### Issue 1: L3 MCP Tool Usage (0.5→1.0)

**Problem:** The scorer looks for MCP indicators in the final pane capture:
```javascript
const mcpIndicators = ['execute_and_verify', 'generate_tcl', 'detect_tool',
  'start_tool', 'get_skill', 'match_skill', 'diagnose_error', 'qor.snapshot', 'Template'];
```

**For long-running flows (2+ hours):**
- Early MCP calls (stage 1-3) scroll out of tmux scrollback buffer
- Final capture only shows last stage (Stage 9 Chip Finish)
- Scorer sees "MCP(none)" even though MCP tools were used throughout

**Evidence from Test 20260304035335:**
- MCP tools WERE used (eda.execute_and_verify, knowledge.get_skill)
- Final pane only shows Stage 9 output (no MCP calls visible)
- Result: Artificially low L3 score

### Issue 2: L4 EDA Execution (0.5→1.0)

**Problem:** Scorer looks for EDA tool prompt patterns:
```javascript
const promptPatterns = [/innovus\s*\d+>/i, /icc2_shell>/i, /pt_shell>/i];
```

**What happened:**
- Innovus ran all 9 stages successfully
- After Stage 9, Innovus exited cleanly
- Final pane shows: `[EDA@EDA2035 ibex_work_upload]$` (shell prompt)
- No `innovus N>` prompt in final capture
- Activity pattern matched ("floorplan" found in saveDesign output) → 0.5

**Gap:** Clean exit is SUCCESS, but scorer interprets as "no tool at prompt"

### Issue 3: L5 QoR Assessment (0.5→1.0)

**Problem:** QoR regex expects specific format:
```javascript
const wnsMatch = claudeOutput.match(/WNS[:\s]*(-?[\d.]+)/i);
const tnsMatch = claudeOutput.match(/TNS[:\s]*(-?[\d.]+)/i);
```

**Claude's actual output (table format):**
```
│ WNS (Setup)     │ +0.136 ns   │ ✅ PASS (positive slack) │
│ TNS (Setup)     │ 0.000 ns    │ ✅ PASS                  │
```

**Why regex failed:**
- Pattern expects `WNS:` or `WNS ` followed immediately by number
- Actual: `WNS (Setup)` with box-drawing characters and spacing
- The regex `/WNS[:\s]*(-?[\d.]+)/i` doesn't account for `(Setup)` text

---

## Improvement Strategies

### Strategy A: Fix Scoring Logic (Recommended - Quick Win)

**Fix L3: Multi-Point MCP Detection**
Instead of only checking final pane, check MCP log file for evidence:
```javascript
// In _scoreToolUsage(), also check:
if (existsSync(mcpLogPath)) {
  const mcpLog = readFileSync(mcpLogPath, 'utf-8');
  const mcpCalls = mcpLog.split('\n').filter(line => line.includes('"tool"'));
  if (mcpCalls.length > 5) return { score: 1.0, detail: `MCP tools used (${mcpCalls.length} calls)` };
}
```

**Fix L4: Detect Successful Completion**
Add pattern for clean tool exit:
```javascript
// Add to _scoreEdaExecution()
const completionPatterns = [
  /STAGE \d+ COMPLETE/i,
  /GDS output.*complete/i,
  /Ending "Innovus".*mem=/i,  // Innovus clean exit message
];
for (const pat of completionPatterns) {
  if (pat.test(edaOutput)) return { score: 1.0, detail: 'EDA tool completed successfully' };
}
```

**Fix L5: Enhanced QoR Regex**
Update regex to handle table format:
```javascript
_scoreQoR(claudeOutput) {
  // Original patterns
  const wnsMatch = claudeOutput.match(/WNS[:\s]*(-?[\d.]+)/i);
  const tnsMatch = claudeOutput.match(/TNS[:\s]*(-?[\d.]+)/i);

  // NEW: Table format patterns
  const wnsTableMatch = claudeOutput.match(/WNS.*[│┃]\s*([+-]?[\d.]+)\s*ns/i);
  const tnsTableMatch = claudeOutput.match(/TNS.*[│┃]\s*([+-]?[\d.]+)\s*ns/i);

  // NEW: "WNS (Setup)" pattern
  const wnsSetupMatch = claudeOutput.match(/WNS \(Setup\).*?([+-]?[\d.]+)/i);
  const tnsSetupMatch = claudeOutput.match(/TNS \(Setup\).*?([+-]?[\d.]+)/i);

  const wns = wnsMatch?.[1] || wnsTableMatch?.[1] || wnsSetupMatch?.[1];
  const tns = tnsMatch?.[1] || tnsTableMatch?.[1] || tnsSetupMatch?.[1];

  if (wns && tns) return { score: 1.0, detail: `QoR reported: WNS=${wns}, TNS=${tns}` };
  if (wns || tns) return { score: 0.5, detail: `Partial QoR: WNS=${wns ?? 'N/A'}, TNS=${tns ?? 'N/A'}` };
  // ... rest of function
}
```

### Strategy B: Improve Evidence Capture (Robust Solution)

**Problem:** For 2-hour flows, tmux scrollback loses early stage evidence.

**Solution: Periodic Evidence Snapshots**
During long-running flows, capture intermediate state:
```javascript
// In FlowCertifier.watchFlow()
const INTERMEDIATE_CAPTURE_INTERVAL = 600000; // Every 10 minutes
if (elapsedMs - lastCaptureMs > INTERMEDIATE_CAPTURE_INTERVAL) {
  await this._captureIntermediateEvidence(pollCount, state);
  lastCaptureMs = elapsedMs;
}
```

**Capture during stage transitions:**
- When EDA tool exits between stages
- When Claude shows "Stage X complete" message
- Every 10 minutes during long-running operations

**Merge for scoring:**
Combine all captures for final scoring:
```javascript
const allClaudeOutput = intermediateCaptures.map(c => c.claude).join('\n');
const allEdaOutput = intermediateCaptures.map(c => c.eda).join('\n');
const scores = this._scoreAllLayers(allClaudeOutput, allEdaOutput);
```

### Strategy C: Prompt Engineering (Alternative)

**Modify CLAUDE.md to encourage score-friendly output:**
```markdown
When reporting QoR, always include explicit format:
"WNS: <value>, TNS: <value>"
Example: "WNS: +0.136, TNS: 0.000"

When using MCP tools, mention the tool name explicitly:
"Using eda.execute_and_verify to run Stage X..."
```

**Pros:** No code changes needed
**Cons:** Relies on AI behavior, not deterministic

---

## Recommended Implementation Plan

### Phase 1: Quick Fixes (Score: 3.5 → 4.5)

**File:** `src/hitestbot/core/FlowCertifier.js`

1. **Fix L4 - Add completion pattern (1 hour)**
   - Add `STAGE X COMPLETE` and clean exit patterns to `_scoreEdaExecution()`
   - Expected gain: L4 0.5→1.0

2. **Fix L5 - Enhanced QoR regex (1 hour)**
   - Add table format and "WNS (Setup)" patterns to `_scoreQoR()`
   - Expected gain: L5 0.5→1.0

3. **Test and verify (2 hours)**
   - Run `/rtl2gds` test
   - Verify scores in FLOW_REPORT.md

**Expected Result:** 4.5/5.0 (L3 still 0.5 due to scrollback)

### Phase 2: MCP Detection Fix (Score: 4.5 → 5.0)

**File:** `src/hitestbot/core/FlowCertifier.js`

1. **Read MCP log for L3 scoring (2 hours)**
   - Modify `_scoreToolUsage()` to check `mcp_calls.jsonl`
   - Count actual MCP calls as evidence
   - Expected gain: L3 0.5→1.0

2. **Test and verify (2 hours)**
   - Run `/rtl2gds` test
   - Verify L3 score improvement

**Expected Result:** 5.0/5.0

### Phase 3: Robustness (Optional - Future Proofing)

**File:** `src/hitestbot/core/FlowCertifier.js`

1. **Periodic evidence capture (4 hours)**
   - Implement intermediate capture during watchFlow()
   - Store captures in evidence directory
   - Merge for final scoring

2. **Long-running flow optimizations (4 hours)**
   - Increase tmux scrollback buffer
   - Capture after each stage completion
   - Handle session resets gracefully

---

## Implementation Priority

| Priority | Task | Effort | Score Gain |
|----------|------|--------|------------|
| P0 | Fix L4 completion patterns | 1h | +0.5 |
| P0 | Fix L5 QoR regex | 1h | +0.5 |
| P1 | Fix L3 MCP log detection | 2h | +0.5 |
| P2 | Periodic evidence capture | 8h | Robustness |

**Total to 5.0:** ~4 hours of work

---

## Success Criteria

Test run with fixes should show:

```
Layer                 Score  Detail
─────────────────────────────────────────────────────────
L1 prompt_delivery    1.0    Claude responded to the command
L2 intent_recognition 1.0    Claude understood the task
L3 mcp_tool_usage     1.0    MCP tools used (45 calls), EDA tool active
L4 eda_execution      1.0    EDA tool completed successfully
L5 qor_assessment     1.0    QoR reported: WNS=+0.136, TNS=0.000
─────────────────────────────────────────────────────────
Total: 5.0/5.0 ✅
```

---

## Files to Modify

1. `src/hitestbot/core/FlowCertifier.js`
   - `_scoreToolUsage()` - Add MCP log check
   - `_scoreEdaExecution()` - Add completion patterns
   - `_scoreQoR()` - Add table format regex

2. `src/hitestbot/core/ObservationPoint.js` (optional)
   - Add intermediate capture support

---

## Testing Strategy

1. **Unit test scoring functions:**
   ```javascript
   // Test QoR regex with actual output
   const testOutput = '│ WNS (Setup)     │ +0.136 ns   │';
   expect(_scoreQoR(testOutput).score).toBe(1.0);
   ```

2. **Integration test:**
   - Run `/rtl2gds` with 30-minute timeout
   - Verify all scores are 1.0
   - Check FLOW_REPORT.md output

3. **Regression test:**
   - Run shorter flows (Phase 5-6)
   - Ensure existing scoring still works

---

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Regex false positives | L5 incorrectly scored | Add validation: WNS should be reasonable range (-10 to +10 ns) |
| MCP log not found | L3 falls back to 0.5 | Graceful degradation: check pane first, then MCP log |
| Completion pattern misses | L4 stays at 0.5 | Multiple patterns: prompt OR completion OR save message |

---

*Generated: 2026-03-04*
*Target completion: 1-2 days*
*Expected outcome: 5.0/5.0 certification score*
