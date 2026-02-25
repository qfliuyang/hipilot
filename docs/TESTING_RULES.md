# HiPilot Testing Rules

**Version:** 1.0 (Draft)
**Date:** 2026-02-25
**Status:** Under Discussion

---

## 1. Purpose

This document defines the testing philosophy, rules, and report format for HiPilot's E2E test framework (HiTestBot). The goal is to replace binary PASS/FAIL results with **layered evidence reports** that enable debugging, improvement tracking, and certification of AI-driven EDA flows.

### The North Star

> **HiPilot can conduct a complete RTL-to-GDS flow driven by Claude Code, MCP tools, and skills — proving that an AI Agent can replace a human for standard flow execution.**

Every test exists to measure progress toward this goal.

---

## 2. Core Principles

### Principle 1: Progress Over Pass/Fail

A test that completes 7 of 10 flow stages and reports exactly where it failed is **more valuable** than a test that says "FAIL" after the first error.

Tests MUST report **how far the AI got**, not just whether it finished.

### Principle 2: Evidence at Every Layer

The AI-to-EDA pipeline has multiple layers. A failure at any layer looks the same from the outside ("it didn't work"), but requires completely different fixes. Tests MUST collect evidence at each layer so failures can be diagnosed without re-running.

### Principle 3: Classify the Failure

When something goes wrong, the report MUST answer: **is this a HiPilot bug, an AI behavior issue, or an environment issue?** These require different people and different fixes.

### Principle 4: Every Test is Replayable

All evidence (pane captures, MCP logs, generated Tcl, screenshots) MUST be saved so that any test result can be analyzed after the fact without needing to reproduce the failure.

---

## 3. Test Result Levels

Every HiTestBot test MUST produce results at three levels:

### Level 1: Flow Progress Map

Shows how far through the flow the AI progressed.

```
═══════════════════════════════════════════════════
  Flow Progress: Ibex RTL-to-GDS
═══════════════════════════════════════════════════

  #   Stage          Score  Status     Duration
  ──  ─────────────  ─────  ─────────  ────────
  1   Init           5/5    ✅ PASS     2m 13s
  2   Floorplan      5/5    ✅ PASS     1m 47s
  3   Power          5/5    ✅ PASS     3m 02s
  4   Placement      4/5    ⚠️ PARTIAL  8m 15s
  5   CTS            1/5    ❌ FAIL     0m 32s
  6   Post-CTS       0/5    ⏭ SKIPPED  -
  7   Routing        0/5    ⏭ SKIPPED  -
  8   Route Opt      0/5    ⏭ SKIPPED  -
  9   Chip Done      0/5    ⏭ SKIPPED  -
  10  Signoff        0/5    ⏭ SKIPPED  -

  Progress: 4.0 / 10 stages (40%)
  Total Duration: 15m 49s
  Blocking Stage: CTS
```

**Status values:**
- `✅ PASS` — Stage completed successfully, all evidence layers scored ≥ 0.8
- `⚠️ PARTIAL` — Stage completed but with issues (score between 0.4 and 0.8)
- `❌ FAIL` — Stage did not complete successfully (score < 0.4)
- `⏭ SKIPPED` — Stage was not attempted because a prior stage failed

**Rule:** A failed stage MUST NOT automatically skip all subsequent stages if they are independent. For example, if CTS fails, but the test design supports physical-only routing, routing MAY still be attempted. The `SKIPPED` status is for stages that truly cannot proceed.

### Level 2: Per-Stage Scorecard

Each stage is evaluated across 5 evidence layers, each scored 0.0 to 1.0:

```
═══════════════════════════════════════════════════
  Stage Scorecard: CTS (Stage 5)
  Score: 1.5 / 5.0
═══════════════════════════════════════════════════

  Layer                   Score  Detail
  ──────────────────────  ─────  ──────────────────────────────
  L1  Prompt Delivery     1.0    Claude received prompt, echoed in pane
  L2  Intent Recognition  0.5    Claude mentioned CTS but did not select
                                 the run-cts-flow skill
  L3  MCP Tool Usage      0.0    No MCP tool call detected in logs;
                                 Claude used direct tmux send-keys instead
  L4  EDA Execution       0.0    Innovus error: "No clock tree spec found"
  L5  QoR Assessment      0.0    Not reached (blocked by L4)
```

**Evidence layers defined:**

| Layer | Name | What It Measures | Score 0.0 | Score 0.5 | Score 1.0 |
|-------|------|-----------------|-----------|-----------|-----------|
| L1 | Prompt Delivery | Did the AI receive and acknowledge the test input? | No response from AI | AI responded but to wrong prompt | AI clearly received and acknowledged prompt |
| L2 | Intent Recognition | Did the AI understand the goal and select the right skill/operation? | Wrong intent or no understanding | Partially correct (right domain, wrong operation) | Correct skill/operation selected |
| L3 | MCP Tool Usage | Did the AI use the correct MCP tools with correct arguments? | No MCP tools used (or used direct tmux) | Right tool, wrong arguments | Correct tool + correct arguments |
| L4 | EDA Execution | Did the generated Tcl execute successfully in the EDA tool? | Tcl not sent or fatal error | Tcl sent but non-fatal errors/warnings | Clean execution, no errors |
| L5 | QoR Assessment | Did the AI capture and report quality metrics after execution? | No QoR reported | Partial metrics (e.g., WNS but not TNS) | Full QoR captured (WNS, TNS, violations, etc.) |

### Level 3: Diagnostic Evidence Bundle

Raw evidence files for post-mortem analysis:

```
evidence/20260225_103045/
├── flow_progress.json              # Machine-readable progress map
├── stage_scorecards.json           # All stage scores
├── FLOW_REPORT.md                  # Human-readable report (Levels 1+2)
│
├── stage_01_init/
│   ├── claude_pane.log             # Claude Code pane capture
│   ├── eda_pane.log                # EDA tool pane capture
│   ├── mcp_calls.jsonl             # MCP tool call log
│   ├── generated.tcl               # Tcl that was generated
│   ├── screenshot.png              # Visual state after stage
│   └── qor_snapshot.json           # QoR metrics
│
├── stage_02_floorplan/
│   └── ...
│
├── stage_05_cts/
│   ├── claude_pane.log
│   ├── eda_pane.log
│   ├── mcp_calls.jsonl             # Shows: no MCP calls made
│   ├── generated.tcl               # Empty or wrong Tcl
│   ├── screenshot.png
│   ├── failure_classification.json # Category + root cause
│   └── qor_snapshot.json           # null/empty
│
└── video.mp4                       # Full session recording
```

---

## 4. Failure Classification

When a stage fails (score < 0.4), the test framework MUST classify the failure into one of three categories:

### Category A: HIPILOT_BUG

A defect in HiPilot's code (MCP servers, templates, skills, TUI).

**Indicators:**
- MCP server returned an error for valid input
- Template rendered incorrect Tcl
- Skill file has wrong triggers or parameters
- Tool crashed or timed out unexpectedly

**Example:**
```json
{
  "category": "HIPILOT_BUG",
  "stage": "CTS",
  "layer": "L3",
  "summary": "eda.generate_tcl rejected operation 'cts' — should be 'run_cts'",
  "evidence": "mcp_calls.jsonl line 3: error 'Unknown operation: cts'",
  "action": "Fix operation enum in EDA MCP server to accept 'cts' as alias"
}
```

### Category B: AI_BEHAVIOR

The AI (Claude Code) made a suboptimal decision. HiPilot code is correct, but the AI didn't use it properly.

**Indicators:**
- AI bypassed MCP tools and used direct tmux/bash commands
- AI selected wrong skill or operation
- AI provided wrong parameters to correct tool
- AI didn't wait for EDA completion before proceeding
- AI hallucinated a command that doesn't exist

**Example:**
```json
{
  "category": "AI_BEHAVIOR",
  "stage": "CTS",
  "layer": "L3",
  "summary": "Claude used 'tmux send-keys' directly instead of eda.send_to_terminal",
  "evidence": "claude_pane.log line 47: 'tmux send-keys -t hipilot:0.1 ...'",
  "action": "Improve system prompt to reinforce MCP-only tool usage"
}
```

### Category C: ENVIRONMENT

The test environment was not properly set up. HiPilot and AI behavior are both correct.

**Indicators:**
- EDA tool not running or not licensed
- Design not loaded or in wrong state
- Missing files (libraries, netlists, constraints)
- SSH/tmux connectivity issues
- Timeout due to server load

**Example:**
```json
{
  "category": "ENVIRONMENT",
  "stage": "CTS",
  "layer": "L4",
  "summary": "Innovus error: 'No clock tree spec' — design in physical-only mode",
  "evidence": "eda_pane.log line 112: **ERROR: No clock tree specification found",
  "action": "Fix init stage to include MMMC timing setup before running CTS"
}
```

### Classification Rules

1. Check L4 first. If EDA execution failed with an environment error (missing files, no design), classify as `ENVIRONMENT`.
2. Check L3 next. If no MCP tools were called, or wrong tools were called, classify as `AI_BEHAVIOR`.
3. Check L3 MCP response. If MCP tool returned an error for valid input, classify as `HIPILOT_BUG`.
4. If L3 succeeded but L4 failed due to bad Tcl content, check the Tcl: template bug = `HIPILOT_BUG`, AI-generated inline Tcl = `AI_BEHAVIOR`.
5. When ambiguous, classify as the category that is **most actionable** — the one where a fix would have the biggest impact.

---

## 5. MCP Call Logging (Infrastructure Requirement)

To enable Layer 3 (MCP Tool Usage) evidence collection, MCP servers MUST log all tool calls when running in test mode.

### Activation

Set environment variable `HIPILOT_TEST_LOG=/path/to/mcp_calls.jsonl` before starting MCP servers.

### Log Format

One JSON object per line (JSONL):

```jsonl
{"ts":"2026-02-25T10:23:45.123Z","server":"eda","tool":"generate_tcl","args":{"intent":"run CTS on design","operation":"run_cts","tool":"innovus"},"status":"ok","duration_ms":127,"meta":{"template":"cadence/innovus_cts.tcl","badge":"[✓ Template]","file":"/tmp/hipilot-EDA/generated/hipilot_generated_001.tcl"}}
{"ts":"2026-02-25T10:23:46.250Z","server":"eda","tool":"send_to_terminal","args":{"tcl":"source /tmp/hipilot-EDA/generated/hipilot_generated_001.tcl"},"status":"ok","duration_ms":45,"meta":{}}
{"ts":"2026-02-25T10:24:46.300Z","server":"eda","tool":"wait_for_prompt","args":{"timeout":60},"status":"error","duration_ms":60012,"error":"Timeout waiting for prompt after 60s","meta":{}}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO 8601 | Timestamp of tool call |
| `server` | string | MCP server name: `eda`, `tmux`, `knowledge` |
| `tool` | string | Full tool name (e.g., `generate_tcl`, `send_to_terminal`) |
| `args` | object | Arguments passed to the tool |
| `status` | string | `ok` or `error` |
| `duration_ms` | number | Call duration in milliseconds |
| `error` | string | Error message (only if status is `error`) |
| `meta` | object | Server-specific metadata (template used, file path, badge, etc.) |

---

## 6. Flow Stage Definitions

### RTL-to-GDS Flow (Ibex Design)

The reference flow for certification testing. Each stage has defined entry criteria, expected actions, and exit criteria.

| # | Stage | Entry Criteria | Expected AI Actions | Exit Criteria |
|---|-------|---------------|-------------------|---------------|
| 1 | Init | Innovus running, netlist available | Use `eda.generate_tcl` or `eda.run_skill` for design-init, include MMMC setup | Design loaded, timing data available |
| 2 | Floorplan | Design initialized | Use floorplan skill/template, set die area, core utilization | Floorplan saved, utilization 60-80% |
| 3 | Power | Floorplan complete | Create power rings and stripes, verify connectivity | Power connectivity verified |
| 4 | Placement | Power plan complete | Run placement, check congestion and pre-CTS timing | Cells placed, no overlaps, WNS reported |
| 5 | CTS | Placement complete, timing data present | Build clock tree, set NDR rules, run CTS | Clock tree built, skew within budget |
| 6 | Post-CTS Opt | CTS complete | Fix setup/hold with propagated clocks | Setup WNS improved, hold WNS ≥ 0 |
| 7 | Routing | Post-CTS complete | Route all signal nets | 100% routed, no DRC from router |
| 8 | Route Opt | Routing complete | Post-route timing optimization | Timing improved or maintained |
| 9 | Chip Done | Route optimization complete | Generate outputs (GDS, netlist, reports) | Output files exist, final QoR reported |
| 10 | Signoff | Chip done | Run PrimeTime STA, Calibre DRC/LVS | Timing clean, DRC = 0, LVS = CORRECT |

### Per-Stage QoR Metrics

Each stage SHOULD capture relevant QoR metrics into `qor_snapshot.json`:

```json
{
  "stage": "placement",
  "timestamp": "2026-02-25T10:30:00Z",
  "metrics": {
    "wns": -0.15,
    "tns": -12.3,
    "violation_count": 47,
    "utilization": 0.72,
    "congestion": 0.023,
    "cell_count": 12500,
    "area": 45000
  },
  "source": "timeDesign -preCTS report"
}
```

Metrics that are not available at a given stage (e.g., clock skew before CTS) SHOULD be `null`, not omitted.

---

## 7. Test Report Format

### FLOW_REPORT.md

Every test run produces a human-readable markdown report. This is the primary artifact for reviewing test results.

```markdown
# HiPilot Flow Certification Report

**Test:** Ibex RTL-to-GDS Flow
**Date:** 2026-02-25 10:30:45
**Duration:** 47m 23s
**Framework:** HiTestBot v2.0

---

## Flow Progress

| # | Stage | Score | Status | Duration | QoR Summary |
|---|-------|-------|--------|----------|-------------|
| 1 | Init | 5.0/5 | ✅ PASS | 2m 13s | Design loaded, timing OK |
| 2 | Floorplan | 5.0/5 | ✅ PASS | 1m 47s | Util: 72% |
| 3 | Power | 5.0/5 | ✅ PASS | 3m 02s | Connectivity verified |
| 4 | Placement | 4.0/5 | ⚠️ PARTIAL | 8m 15s | WNS: -0.15ns |
| 5 | CTS | 1.5/5 | ❌ FAIL | 0m 32s | No clock tree built |
| 6-10 | (skipped) | - | ⏭ SKIP | - | - |

**Progress: 4.0 / 10 stages (40%)**

---

## Blocking Issue

**Stage:** CTS (Stage 5)
**Category:** AI_BEHAVIOR
**Summary:** Claude used direct tmux command instead of MCP tool
**Root Cause:** System prompt did not sufficiently enforce MCP-only usage
**Suggested Fix:** Add explicit constraint in system prompt; add MCP-only
                   validation in HiTestBot

---

## Stage Scorecards

### Stage 5: CTS (Score: 1.5/5.0) ❌

| Layer | Score | Evidence |
|-------|-------|---------|
| L1 Prompt Delivery | 1.0 | Claude acknowledged CTS request |
| L2 Intent Recognition | 0.5 | Mentioned CTS but didn't pick skill |
| L3 MCP Tool Usage | 0.0 | Used tmux send-keys directly |
| L4 EDA Execution | 0.0 | Error: no clock tree spec |
| L5 QoR Assessment | 0.0 | Not reached |

**Failure Classification:**
- Category: AI_BEHAVIOR
- Evidence: claude_pane.log line 47
- Action: Reinforce MCP-only usage in system prompt

### Stage 4: Placement (Score: 4.0/5.0) ⚠️

| Layer | Score | Evidence |
|-------|-------|---------|
| L1 Prompt Delivery | 1.0 | Prompt received |
| L2 Intent Recognition | 1.0 | Selected placement skill |
| L3 MCP Tool Usage | 1.0 | eda.generate_tcl + eda.send_to_terminal |
| L4 EDA Execution | 1.0 | Placement completed |
| L5 QoR Assessment | 0.0 | WNS reported but TNS and congestion not captured |

(Stages 1-3: all 5.0/5.0, details omitted for brevity)

---

## QoR Trend

| Stage | WNS (ns) | TNS (ns) | Violations | Notes |
|-------|----------|----------|------------|-------|
| Init | -0.45 | -89.2 | 234 | Pre-place estimate |
| Placement | -0.15 | -12.3 | 47 | Improved from init |
| CTS | - | - | - | Stage failed |

---

## Evidence Files

```
evidence/20260225_103045/
├── FLOW_REPORT.md          (this file)
├── flow_progress.json
├── stage_scorecards.json
├── stage_01_init/          (5 files)
├── stage_02_floorplan/     (5 files)
├── stage_03_power/         (5 files)
├── stage_04_placement/     (6 files)
├── stage_05_cts/           (6 files + failure_classification.json)
└── video.mp4               (47m 23s)
```

---

## Comparison with Previous Run

| Metric | Previous (02-24) | Current (02-25) | Delta |
|--------|-----------------|-----------------|-------|
| Progress | 3/10 (30%) | 4/10 (40%) | +10% |
| Blocking Stage | Placement | CTS | Advanced 1 stage |
| Total Score | 15.0/50 | 20.5/50 | +5.5 |

---

*Generated by HiTestBot at 2026-02-25T10:30:45Z*
```

### flow_progress.json

Machine-readable version for trend tracking:

```json
{
  "test_name": "Ibex RTL-to-GDS Flow",
  "timestamp": "2026-02-25T10:30:45Z",
  "duration_s": 2843,
  "total_stages": 10,
  "completed_stages": 4,
  "progress_pct": 40,
  "total_score": 20.5,
  "max_score": 50,
  "blocking_stage": "cts",
  "blocking_category": "AI_BEHAVIOR",
  "stages": [
    {"name": "init", "score": 5.0, "status": "pass", "duration_s": 133},
    {"name": "floorplan", "score": 5.0, "status": "pass", "duration_s": 107},
    {"name": "power", "score": 5.0, "status": "pass", "duration_s": 182},
    {"name": "placement", "score": 4.0, "status": "partial", "duration_s": 495},
    {"name": "cts", "score": 1.5, "status": "fail", "duration_s": 32},
    {"name": "post_cts", "score": 0.0, "status": "skipped", "duration_s": 0},
    {"name": "routing", "score": 0.0, "status": "skipped", "duration_s": 0},
    {"name": "route_opt", "score": 0.0, "status": "skipped", "duration_s": 0},
    {"name": "chip_done", "score": 0.0, "status": "skipped", "duration_s": 0},
    {"name": "signoff", "score": 0.0, "status": "skipped", "duration_s": 0}
  ]
}
```

---

## 8. Test Rules Checklist

### Rules for Test Authors

1. **MUST** produce all three result levels (flow progress, stage scorecards, evidence bundle).
2. **MUST** collect evidence at all 5 layers for every attempted stage, even if earlier layers fail.
3. **MUST** classify failures using the three-category system (HIPILOT_BUG, AI_BEHAVIOR, ENVIRONMENT).
4. **MUST** save all raw evidence (pane logs, MCP logs, generated Tcl, screenshots) to the evidence directory.
5. **MUST** capture QoR metrics at every stage where they are available.
6. **MUST NOT** stop the test at the first failure if subsequent stages could still be attempted.
7. **MUST NOT** use bare `assert(passed >= N)` as the final verdict. Use the scoring system.
8. **SHOULD** compare results against the previous run to show improvement or regression.
9. **SHOULD** include a video recording of the full test session.

### Rules for Evidence Collection

1. **Pane captures** MUST include at least 300 lines of scrollback from both Claude and EDA panes.
2. **MCP call logs** MUST be enabled via `HIPILOT_TEST_LOG` for every E2E test run.
3. **Generated Tcl** MUST be copied to the evidence directory (not just referenced by temp path).
4. **Screenshots** SHOULD be captured at stage transitions and at any failure point.
5. **QoR snapshots** MUST use a consistent JSON schema across all stages and test runs.

### Rules for Scoring

1. Each evidence layer is scored 0.0 to 1.0. Half scores (0.5) are allowed for partial success.
2. A stage score is the sum of its 5 layer scores (max 5.0).
3. Stage status thresholds: `PASS` ≥ 4.0, `PARTIAL` ≥ 2.0, `FAIL` < 2.0.
4. Flow progress is the count of stages with status `PASS` or `PARTIAL`.
5. The overall test result is expressed as **progress fraction** (e.g., "4/10 stages, 40%") and **total score** (e.g., "20.5/50"), never just "PASS" or "FAIL".

---

## 9. Improvement Tracking

### The Progress Dashboard

Over time, test results SHOULD be collected into a historical trend:

```
Date        Progress   Score   Blocking Stage   Category
──────────  ─────────  ──────  ───────────────  ────────────
2026-02-20  1/10 (10%) 5.0/50  Floorplan        ENVIRONMENT
2026-02-22  2/10 (20%) 10.0/50 Placement        HIPILOT_BUG
2026-02-23  3/10 (30%) 15.0/50 Placement        AI_BEHAVIOR
2026-02-24  3/10 (30%) 16.5/50 CTS              ENVIRONMENT
2026-02-25  4/10 (40%) 20.5/50 CTS              AI_BEHAVIOR
```

This tells a clear story: progress is improving, the blocking stage is advancing, and the failure category shifts from environment setup to AI behavior — meaning the infrastructure is maturing and the focus is moving to AI quality.

### Graduation Criteria

The RTL-to-GDS Flow Certification is considered **passed** when:

- [ ] All 10 stages reach `PASS` status (score ≥ 4.0 each)
- [ ] Total score ≥ 45/50
- [ ] No `HIPILOT_BUG` failures in any stage
- [ ] AI used MCP tools exclusively (no direct tmux/bash)
- [ ] Final QoR: DRC = 0, LVS = CORRECT, timing clean or explained
- [ ] Complete evidence bundle with video

---

## 10. Relationship to Existing Tests

### How current tests map to this framework

| Current Test | Role in New Framework |
|-------------|----------------------|
| `MCPControlTest` | Component test — validates L3 (MCP Tool Usage) in isolation |
| `QuickCommandsTest` | Component test — validates L1-L3 for slash commands |
| `EvidenceOutputTest` | Component test — validates L5 (QoR Assessment) output format |
| `SideEffectTest` | Component test — validates risk analysis (part of L3) |
| `RTL2GDSFlowTest` | **Flow Certification Test** — needs refactoring to new rules |
| `IbexRTL2GDSFlowTest` | **Flow Certification Test** — needs refactoring to new rules |

### Test Hierarchy

```
Flow Certification Tests (top level)
  └── Tests full RTL-to-GDS with layered scoring
      │
      ├── uses → Stage Verifiers (per-stage)
      │           └── Collects 5-layer evidence for one stage
      │
      ├── uses → MCP Call Logger (infrastructure)
      │           └── Records all tool calls for L3 evidence
      │
      └── uses → Component Tests (building blocks)
                  └── MCPControlTest, QuickCommandsTest, etc.
```

Component tests remain useful for fast regression. Flow certification tests are the source of truth for the north star goal.

---

## Appendix A: Scoring Examples

### Example: Perfect Stage (5.0/5.0)

```
Stage: Routing
L1  Prompt Delivery     1.0  Claude received "route the design" prompt
L2  Intent Recognition  1.0  Selected route-design skill correctly
L3  MCP Tool Usage      1.0  Called eda.run_skill(skill="route-design")
                              → eda.generate_tcl(operation="route_design", tool="innovus")
                              → eda.send_to_terminal(tcl="source /tmp/...")
                              → eda.wait_for_prompt(timeout=120)
L4  EDA Execution       1.0  routeDesign completed, 100% routed, 0 DRC
L5  QoR Assessment      1.0  Reported: WNS=+0.01ns, TNS=0, DRC=0
```

### Example: Partial Stage (3.0/5.0)

```
Stage: Placement
L1  Prompt Delivery     1.0  Prompt received
L2  Intent Recognition  1.0  Selected placement operation
L3  MCP Tool Usage      1.0  Used eda.generate_tcl correctly
L4  EDA Execution       0.0  place_opt_design completed but 15 cells unplaced
                              (WARNING: 15 unplaced instances)
L5  QoR Assessment      0.0  Claude did not run timeDesign after placement
```

### Example: Failed Stage (0.5/5.0)

```
Stage: Signoff (PrimeTime)
L1  Prompt Delivery     0.5  Claude received prompt but misunderstood scope
                              (ran Innovus timing instead of PrimeTime)
L2  Intent Recognition  0.0  Did not recognize this requires a different tool
L3  MCP Tool Usage      0.0  No MCP call for PrimeTime flow
L4  EDA Execution       0.0  Not attempted
L5  QoR Assessment      0.0  Not reached
```

---

## Appendix B: Implementation Roadmap

### Phase 1: MCP Call Logging
Add `HIPILOT_TEST_LOG` support to all three MCP servers. This is the foundation for L3 evidence.

### Phase 2: Stage Verifier
Create a `StageVerifier` class that collects evidence at all 5 layers for a single stage and produces a scorecard.

### Phase 3: Flow Certification Test
Refactor `RTL2GDSFlowTest` to use `StageVerifier` for each stage, produce `FLOW_REPORT.md`, and save the full evidence bundle.

### Phase 4: Failure Classifier
Implement automatic failure classification based on the evidence patterns described in Section 4.

### Phase 5: Progress Dashboard
Build a simple tool that reads `flow_progress.json` files across runs and produces the improvement trend table.

---

*This is a living document. Update as the testing framework evolves.*
