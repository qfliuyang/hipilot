# HiPilot Test Plan v4 - Ralph-Loop Style Iterative Certification

> **Goal**: Achieve full RTL2GDS flow certification through persistent, iterative testing with automatic retry and evidence-based graduation
> **Philosophy**: Like Ralph — never give up until the task is verified complete

---

## Overview

Test Plan v4 merges the **incremental stages** of the Self-Improving Test with the **end-to-end validation** of the RTL2GDS Flow Test, wrapped in a **Ralph-loop style persistence mechanism**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RALPH-LOOP TEST CERTIFICATION                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Iteration 1: Phase 0 → (fail) → Fix → Retry                           │
│  Iteration 2: Phase 0 → Phase 1 → (fail) → Fix → Retry                 │
│  Iteration 3: Phase 0 → Phase 1 → Phase 2 → ... → Full Flow            │
│  Iteration N: ALL PHASES PASS → Architect Verify → GRADUATE            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Ralph-Loop Principles Applied to Testing

### 1. NEVER GIVE UP
- If a phase fails, diagnose, fix, and retry
- If blocked on one approach, try alternative
- Continue until graduation criteria met

### 2. EVIDENCE-BASED VERIFICATION
- Every claim backed by fresh evidence
- Timestamp validation mandatory
- Screenshots, logs, video correlation

### 3. PROGRESSIVE DISCLOSURE
- Start with Phase 0 (infrastructure)
- Only proceed to Phase N+1 when Phase N passes
- Track progress across iterations

### 4. VERIFICATION LOOP
```
Test → Score → Validate → (Pass? → Next Phase : Fix → Retry)
                ↓
         Architect Review (before graduation)
```

---

## Phase Structure (8 Stages)

| Phase | Name | Duration | Goal | Entry Criteria |
|-------|------|----------|------|----------------|
| 0 | Infrastructure | 5 min | MCP, tmux, display work | None |
| 1 | Tool Launch | 5 min | EDA tools start in right pane | Phase 0 PASS |
| 2 | Tcl Execution | 10 min | Commands execute, output captured | Phase 1 PASS |
| 3 | QoR Extraction | 10 min | Metrics extracted and reported | Phase 2 PASS |
| 4 | Synthesis | 30 min | dc_shell completes successfully | Phase 3 PASS |
| 5 | Floorplan | 30 min | Innovus init + floorplan done | Phase 4 PASS |
| 6 | Placement | 60 min | place_opt_design completes | Phase 5 PASS |
| 7 | Full RTL2GDS | 120 min | All 10 stages to GDS | Phase 6 PASS |

---

## Iteration Loop

### Iteration Structure

```javascript
// Pseudo-code for Ralph-Loop test execution
async function ralphLoopTest(targetPhase) {
  const state = loadState();  // Persist across runs
  const iteration = state.iteration + 1;

  log(`=== RALPH LOOP ITERATION ${iteration} ===`);

  for (let phase = 0; phase <= targetPhase; phase++) {
    // Skip phases already passed in previous iterations
    if (state.passedPhases.includes(phase)) {
      log(`Phase ${phase}: Already passed ✓`);
      continue;
    }

    // Run phase test
    const result = await runPhase(phase);

    if (result.status === 'PASS') {
      state.passedPhases.push(phase);
      saveState(state);
      log(`Phase ${phase}: PASS ✓`);
    } else {
      // FAILED - Diagnose and fix
      const diagnosis = await diagnoseFailure(result);
      await takeNote({
        category: 'error',
        phase: phase,
        issue: diagnosis.issue,
        fix: diagnosis.suggestedFix
      });

      // Apply fix
      await applyFix(diagnosis.fix);

      // Update state with failure info
      state.failures.push({
        iteration,
        phase,
        issue: diagnosis.issue,
        fix: diagnosis.suggestedFix
      });
      saveState(state);

      // Stop iteration, will retry in next iteration
      log(`Phase ${phase}: FAIL → Fix applied, will retry in iteration ${iteration + 1}`);
      return { status: 'PARTIAL', completedPhases: state.passedPhases };
    }
  }

  // All phases passed - verify graduation criteria
  if (await verifyGraduation(state)) {
    return { status: 'GRADUATED', completedPhases: state.passedPhases };
  }
}
```

### State Persistence

```json
{
  "testId": "hipilot_v4_20260227_220000",
  "iteration": 3,
  "startedAt": "2026-02-27T22:00:00Z",
  "passedPhases": [0, 1, 2, 3],
  "currentPhase": 4,
  "failures": [
    {
      "iteration": 1,
      "phase": 4,
      "issue": "dc_shell license not available",
      "fix": "Checked license server, restarted flexlm"
    },
    {
      "iteration": 2,
      "phase": 4,
      "issue": "SDC file path incorrect",
      "fix": "Updated constraint file path in config.mk"
    }
  ],
  "notes": [
    {
      "category": "decision",
      "content": "Using physical-only mode for initial testing"
    }
  ],
  "graduationReady": false
}
```

---

## Clean Design Protocol (Per Iteration)

### MANDATORY: Fresh Design Every Iteration

```bash
# Each iteration starts with CLEAN design
extractCleanDesign() {
  local ITERATION=$1
  local TEST_ID=$2

  local DESIGN_DIR="/home/EDA/hipilot_test/runs/${TEST_ID}/iteration_${ITERATION}/design/ibex"

  # Clean slate
  rm -rf "${DESIGN_DIR}"
  mkdir -p "$(dirname ${DESIGN_DIR})"

  # Extract fresh from verified clean tar
  tar -xf /home/EDA/ibex_demo.tar -C "$(dirname ${DESIGN_DIR})"
  mv "$(dirname ${DESIGN_DIR})/ibex_demo" "${DESIGN_DIR}"

  # Verify no stale results
  if [ -d "${DESIGN_DIR}/result" ]; then
    echo "ERROR: Clean design has results! Aborting."
    exit 1
  fi

  echo "Fresh design ready: ${DESIGN_DIR}"
  echo "Timestamp: $(date +%s)"
}
```

---

## Evidence Validation (Strict)

### 1. Timestamp Validation

All evidence must be created AFTER iteration start:

```javascript
function validateEvidenceFreshness(evidenceDir, iterationStartTime) {
  const files = globSync(`${evidenceDir}/**/*`, { nodir: true });
  const staleFiles = [];

  for (const file of files) {
    const stats = statSync(file);
    const createTime = stats.birthtimeMs || stats.mtimeMs;

    if (createTime < iterationStartTime - 5000) { // 5s buffer
      staleFiles.push({
        file: basename(file),
        created: new Date(createTime).toISOString(),
        iterationStart: new Date(iterationStartTime).toISOString(),
        ageMinutes: Math.round((iterationStartTime - createTime) / 60000)
      });
    }
  }

  if (staleFiles.length > 0) {
    return {
      valid: false,
      error: 'STALE_EVIDENCE',
      staleFiles,
      action: 'REJECT_EVIDENCE'
    };
  }

  return { valid: true };
}
```

### 2. Tool Execution Validation

Right pane must show actual tool activity:

```javascript
function validateToolExecution(edaPaneLog) {
  // INVALID: Only echo commands
  const echoOnlyPatterns = [
    /^\[EDA@.*\]\$ echo/,
    /^\s*icc2_shell.*Synopsys ICC2/,
    /^\s*innovus.*Cadence Innovus/,
    /^\s*Start your EDA tool/,
  ];

  const lines = edaPaneLog.split('\n').filter(l => l.trim());
  const allEchoOnly = lines.every(line =>
    echoOnlyPatterns.some(p => p.test(line))
  );

  if (allEchoOnly) {
    return {
      valid: false,
      error: 'ECHO_ONLY_NO_TOOL_EXECUTION',
      detail: 'Right pane shows only echo commands'
    };
  }

  // VALID: Tool prompt or activity detected
  const validPatterns = [
    /innovus\s*\d+>/,
    /dc_shell>/,
    /pt_shell>/,
    /Loading.*design/,
    /Compiling/,
    /Placement completed/,
    /Routing completed/
  ];

  const hasValidActivity = validPatterns.some(p =>
    lines.some(line => p.test(line))
  );

  if (!hasValidActivity) {
    return {
      valid: false,
      error: 'NO_TOOL_ACTIVITY_DETECTED',
      detail: 'No recognizable EDA tool output'
    };
  }

  return { valid: true };
}
```

---

## Scoring per Phase

| Level | Criteria | Weight |
|-------|----------|--------|
| L1 | Claude responds to command | 1.0 |
| L2 | Claude understands phase intent | 1.0 |
| L3 | MCP tools used correctly | 1.0 |
| L4 | **Actual EDA tool execution** | 2.0 |
| L5 | **Fresh QoR/results reported** | 1.0 |

**Phase PASS**: Score ≥ 4.0/6.0 AND L4 = 2.0 (tool actually ran)
**Phase FAIL**: Score < 4.0 OR L4 < 2.0 OR stale evidence detected

---

## Graduation Criteria

To **GRADUATE** from Ralph-Loop testing:

| Criterion | Requirement |
|-----------|-------------|
| All Phases | Phases 0-7 all PASS |
| Evidence | All evidence files fresh (timestamp validated) |
| Tool Execution | L4 = 2.0 for Phase 7 (full flow) |
| Results | GDS file created during final iteration |
| Architect Review | Independent verification of evidence |

### Graduation Verification

```javascript
async function verifyGraduation(state) {
  // 1. Check all phases passed
  if (state.passedPhases.length !== 8) {
    return { graduated: false, reason: 'Not all phases passed' };
  }

  // 2. Verify Phase 7 evidence
  const phase7Evidence = loadEvidence(state.testId, 7);
  const freshness = validateEvidenceFreshness(
    phase7Evidence.dir,
    phase7Evidence.iterationStartTime
  );

  if (!freshness.valid) {
    return { graduated: false, reason: 'Stale evidence detected', freshness };
  }

  // 3. Verify tool execution
  const toolValidation = validateToolExecution(phase7Evidence.edaPaneLog);
  if (!toolValidation.valid) {
    return { graduated: false, reason: 'Invalid tool execution', toolValidation };
  }

  // 4. Verify GDS file created
  const gdsFile = phase7Evidence.resultFiles.find(f => f.endsWith('.gds'));
  if (!gdsFile || !gdsFile.isFresh) {
    return { graduated: false, reason: 'Fresh GDS file not found' };
  }

  // 5. Architect verification
  const architectReview = await runArchitectReview(state);
  if (!architectReview.approved) {
    return {
      graduated: false,
      reason: 'Architect review rejected',
      review: architectReview
    };
  }

  return {
    graduated: true,
    totalIterations: state.iteration,
    totalTime: Date.now() - state.startedAt,
    finalScore: calculateFinalScore(state)
  };
}
```

---

## Running Ralph-Loop Tests

### Command

```bash
# Start Ralph-Loop test
bin/hitestbot-ralph \
  --plan v4 \
  --target-phase 7 \
  --max-iterations 10 \
  --clean-design-source /home/EDA/ibex_demo.tar \
  --validate-evidence \
  --graduation-requirements strict
```

### Iteration Log Output

```
═══════════════════════════════════════════════════════════
  RALPH-LOOP: HiPilot Test Certification v4
═══════════════════════════════════════════════════════════

Test ID: hipilot_v4_20260227_220000
Target: Phase 7 (Full RTL2GDS)
Max Iterations: 10

───────────────────────────────────────────────────────────
ITERATION 1/10
───────────────────────────────────────────────────────────

[00:00:05] Phase 0: Infrastructure... PASS (6.0/6.0)
[00:00:12] Phase 1: Tool Launch... PASS (5.5/6.0)
[00:00:25] Phase 2: Tcl Execution... PASS (5.0/6.0)
[00:00:40] Phase 3: QoR Extraction... PASS (5.5/6.0)
[00:05:30] Phase 4: Synthesis... FAIL

  ERROR: dc_shell license unavailable
  DETAIL: License server connection timeout

  ACTION: Restarting flexlm license server

[00:06:15] Fix applied. Saving state.
[00:06:15] Ending iteration 1. Progress: 4/8 phases.

───────────────────────────────────────────────────────────
ITERATION 2/10
───────────────────────────────────────────────────────────

[00:06:20] Phase 0-3: Already passed, skipping
[00:06:25] Phase 4: Synthesis... PASS (5.0/6.0)
[00:35:00] Phase 5: Floorplan... PASS (5.5/6.0)
[00:50:30] Phase 6: Placement... FAIL

  ERROR: High congestion at 80% utilization
  DETAIL: Placement failed with congestion > 10%

  ACTION: Reducing target utilization to 70%

[00:51:00] Fix applied. Saving state.
[00:51:00] Ending iteration 2. Progress: 6/8 phases.

───────────────────────────────────────────────────────────
ITERATION 3/10
───────────────────────────────────────────────────────────

[00:51:05] Phase 0-5: Already passed, skipping
[00:51:10] Phase 6: Placement... PASS (5.0/6.0)
[01:20:00] Phase 7: Full RTL2GDS... PASS (5.5/6.0)

  ✓ All 10 stages completed
  ✓ GDS file generated: 19.3 MB
  ✓ Timing clean: WNS=+0.01ns
  ✓ Evidence validated: All fresh
  ✓ Tool execution validated: Innovus ran

[01:20:30] Running architect verification...
[01:21:00] Architect review: APPROVED

═══════════════════════════════════════════════════════════
🎉 GRADUATION ACHIEVED
═══════════════════════════════════════════════════════════

Total Iterations: 3
Total Time: 81 minutes
Phases Completed: 8/8
Final Score: 5.3/6.0

Fix History:
  Iteration 1: License server restart
  Iteration 2: Utilization adjustment 80% → 70%

Evidence Location: test-evidence/hipilot_v4_20260227_220000/
```

---

## Comparison: v3 vs v4

| Aspect | v3 Self-Improving | v4 Ralph-Loop |
|--------|-------------------|---------------|
| **Structure** | Sequential phases | Iterative with persistence |
| **On Failure** | Stop, fix, manual retry | Auto-retry with state |
| **State** | Per-run only | Persistent across runs |
| **Design** | May reuse | Fresh every iteration |
| **Fix Tracking** | Manual notes | Automatic note-taking |
| **Graduation** | Phase-by-phase | All phases + architect verify |
| **Evidence** | Basic timestamp check | Strict validation |
| **Max Attempts** | Manual | Configurable (default 10) |

---

## Files

| File | Purpose |
|------|---------|
| `docs/TEST_PLAN_v4_RALPH.md` | This document |
| `src/hitestbot/RalphLoopCertifier.js` | Implementation (NEW) |
| `src/hitestbot/state/` | Persistence layer |
| `test-evidence/v4/${TEST_ID}/` | Evidence per test |
| `test-evidence/v4/${TEST_ID}/state.json` | Ralph-loop state |

---

## Summary

Test Plan v4 brings **Ralph-loop persistence** to HiPilot testing:

1. **Never give up** - Retry failed phases automatically
2. **Track progress** - State persists across iterations
3. **Learn from failures** - Automatic note-taking
4. **Strict validation** - Fresh evidence required
5. **Graduate with confidence** - Architect verification

**Use v4 when**: You need guaranteed completion with full evidence integrity.

---

*Version: 4.0*
*Based on: Self-Improving Test Plan v3 + RTL2GDS Flow Test v2*
*Pattern: Ralph-Loop Persistent Execution*
