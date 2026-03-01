# HiPilot Test Plan v4 — Implementation Summary

> **Status**: IMPLEMENTED
> **Date**: 2026-02-27
> **Files Created**: 2
> **Tests Status**: 118/118 passing

---

## Overview

Test Plan v4 merges the **Self-Improving Test Plan v3** with the **RTL2GDS Flow Test Plan v2**, wrapped in a **Ralph-loop style persistence mechanism**.

### Key Principles

1. **NEVER GIVE UP** — Retry failed phases automatically
2. **EVIDENCE-BASED** — Fresh evidence required for each iteration
3. **PROGRESSIVE DISCLOSURE** — Only proceed when current phase passes
4. **STATE PERSISTENCE** — Track progress across iterations

---

## Files Created

### 1. `src/hitestbot/RalphLoopCertifier.js`

The main implementation file (26KB) containing:

| Component | Description |
|-----------|-------------|
| `PHASES` | 8-phase configuration (Infrastructure → Full RTL2GDS) |
| `SCORING` | L1-L5 scoring weights (max 6.0 points) |
| `loadState()` / `saveState()` | JSON state persistence |
| `validateEvidenceFreshness()` | Timestamp validation (5s buffer) |
| `validateToolExecution()` | Detect echo-only vs actual tool execution |
| `validateResultFilesFreshness()` | Verify GDS/netlist creation time |
| `RalphLoopCertifier` class | Main certification engine |

**Key Methods:**
- `run()` — Main loop orchestration
- `_runIteration()` — Single iteration with clean design
- `_runPhase()` — Execute one phase using FlowCertifier
- `_verifyGraduation()` — 5-step graduation verification
- `_extractCleanDesign()` — Fresh design extraction per iteration

### 2. `bin/hitestbot-ralph`

CLI wrapper script supporting:

```bash
# Run full certification
bin/hitestbot-ralph

# Target specific phase
bin/hitestbot-ralph --target-phase 4

# Limit iterations
bin/hitestbot-ralph --max-iterations 5

# Enable strict validation
bin/hitestbot-ralph --validate-evidence --graduation-requirements strict
```

**Environment Variables:**
- `RALPH_MAX_ITERATIONS` (default: 10)
- `RALPH_TARGET_PHASE` (default: 7)
- `RALPH_CLEAN_DESIGN` (default: /home/EDA/ibex_demo.tar)
- `RALPH_WORK_DIR` (default: /home/EDA/hipilot_test)
- `RALPH_VALIDATE_EVIDENCE` (default: true)

---

## Phase Structure

| Phase | Name | Duration | Command |
|-------|------|----------|---------|
| 0 | Infrastructure | 5 min | `/status` |
| 1 | Tool Launch | 5 min | `start innovus` |
| 2 | Tcl Execution | 10 min | `/tcl report_timing` |
| 3 | QoR Extraction | 10 min | `/qor` |
| 4 | Synthesis | 30 min | `/synthesis` |
| 5 | Floorplan | 30 min | `/floorplan` |
| 6 | Placement | 60 min | `/placement` |
| 7 | Full RTL2GDS | 120 min | `/rtl2gds` |

---

## Scoring

| Level | Criteria | Weight | Required |
|-------|----------|--------|----------|
| L1 | Claude responds | 1.0 | Yes |
| L2 | Understands intent | 1.0 | Yes |
| L3 | MCP tools used | 1.0 | Yes |
| L4 | **Actual tool execution** | 2.0 | **Mandatory** |
| L5 | Fresh QoR reported | 1.0 | Yes |

**Phase PASS**: Score ≥ 4.0/6.0 AND L4 = 2.0
**Phase FAIL**: Score < 4.0 OR L4 < 2.0 OR stale evidence

---

## State Persistence

State is saved to `test-evidence/v4/${TEST_ID}/state.json`:

```json
{
  "testId": "ralph_v4_20260227_220000",
  "iteration": 3,
  "startedAt": "2026-02-27T22:00:00Z",
  "passedPhases": [0, 1, 2, 3],
  "currentPhase": 4,
  "failures": [...],
  "notes": [...],
  "graduationReady": false
}
```

---

## Evidence Validation

### 1. Timestamp Validation
All evidence files must be created AFTER iteration start (5s buffer).

### 2. Tool Execution Validation
Detects "echo-only" output vs actual tool activity:
- **Invalid**: `[EDA@...]$ echo innovus`, tool list messages only
- **Valid**: `innovus 1>` prompt, `Loading design`, `Compiling`, etc.

### 3. Result File Validation
Critical files checked:
- `result/syn/data/*.v` (synthesis netlist)
- `result/pr/data/*.enc` (placement/routing checkpoints)
- `result/pr/gds/*.gds` (final GDS)

---

## Graduation Criteria

To **GRADUATE** from Ralph-Loop testing:

| Criterion | Requirement |
|-----------|-------------|
| All Phases | Phases 0-7 all PASS |
| Evidence | All files fresh (timestamp validated) |
| Tool Execution | L4 = 2.0 for Phase 7 |
| Results | Fresh GDS file created |
| Architect Review | Independent verification |

---

## Clean Design Protocol

Each iteration extracts a fresh design:

```bash
# Extract from verified clean tar
tar -xf /home/EDA/ibex_demo.tar -C "${ITERATION_DIR}/"
mv "${ITERATION_DIR}/ibex_demo" "${ITERATION_DIR}/design/ibex"

# Verify no stale results
if [ -d "${DESIGN_DIR}/result" ]; then exit 1; fi
```

Design directory: `/home/EDA/hipilot_test/runs/${TEST_ID}/iteration_${N}/design/ibex`

---

## Usage Example

```bash
# Full certification with strict validation
bin/hitestbot-ralph \
  --target-phase 7 \
  --max-iterations 10 \
  --validate-evidence \
  --graduation-requirements strict
```

Sample output:
```
═══════════════════════════════════════════════════════════
  RALPH-LOOP: HiPilot Test Certification v4
═══════════════════════════════════════════════════════════

Test ID: ralph_v4_20260227_220000
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
  ACTION: Check MCP server connectivity and tool availability

[00:06:15] Fix logged. Will retry in iteration 2

───────────────────────────────────────────────────────────
ITERATION 2/10
───────────────────────────────────────────────────────────

[00:06:20] Phase 0-3: Already passed, skipping
[00:06:25] Phase 4: Synthesis... PASS (5.0/6.0)
...

═══════════════════════════════════════════════════════════
  GRADUATION ACHIEVED
═══════════════════════════════════════════════════════════
```

---

## Comparison: v3 vs v4

| Aspect | v3 Self-Improving | v4 Ralph-Loop |
|--------|-------------------|---------------|
| Structure | Sequential phases | Iterative with persistence |
| On Failure | Stop, fix, manual retry | Auto-retry with state |
| State | Per-run only | Persistent across runs |
| Design | May reuse | Fresh every iteration |
| Fix Tracking | Manual notes | Automatic |
| Graduation | Phase-by-phase | All phases + architect verify |
| Evidence | Basic timestamp check | Strict validation |
| Max Attempts | Manual | Configurable (default 10) |

---

## Testing

All unit tests pass:

```bash
$ npm test
✓ 118 tests passing (9 test files)
```

Syntax validation:
```bash
$ node --check src/hitestbot/RalphLoopCertifier.js
# No errors
```

---

## Next Steps

To run the v4 Ralph-loop certification:

1. Deploy to EDA server:
   ```bash
   node src/hitestbot/infra/deploy_hipilot.js
   ```

2. Run certification:
   ```bash
   bin/hitestbot-ralph --target-phase 7
   ```

3. Pull evidence:
   ```bash
   bin/hitestbot-pull
   ```

---

*Implementation complete. Ready for testing on EDA server.*
