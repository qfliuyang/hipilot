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

HiTestBot runs **only on the EDA server** ("test like real human"). Each run creates a timestamped evidence dir. Use `bin/hitestbot-eda`, `bin/hitestbot-pull`, `bin/hitestbot-push` for run and sync. See [hitestbot-guide.md](hitestbot-guide.md) for execution model and sync scripts.

---

## 2. Core Principles

### Principle 1: Progress Over Pass/Fail

A test that completes 7 of 10 flow stages and reports exactly where it failed is **more valuable** than a test that says "FAIL" after the first error.

Tests MUST report **how far the AI got**, not just whether it finished.

### Principle 2: Evidence at Every Layer

The AI-to-EDA pipeline has multiple layers. A failure at any layer looks the same from the outside ("it didn't work"), but requires completely different fixes. Tests MUST collect evidence at each layer so failures can be diagnosed without re-running.

### Principle 3: Test Like a Human — Three-View Correlation

A test framework that only grades its own programmatic checks is **grading its own homework**. A real human engineer judges quality by correlating three independent views:

1. **Logs** — What the system _recorded_ happened (pane captures, MCP call logs, EDA tool logs)
2. **Screenshots** — What the screen _actually looked like_ at key moments
3. **Video** — What _actually happened_ over time, including things no log captures (hesitation, confusion, recovery, ordering)

These three views may tell different stories. The log might say "PASS" (keyword found), but the video shows Claude was confused and stumbling. The log might say "FAIL" (keyword not found), but the screenshot shows the task was actually completed using different wording. **The truth lives in the correlation of all three, not in any single view.**

### Principle 4: Observer Review — Independent Judgment

Every test MUST produce artifacts that can be reviewed by an **independent observer** (human or AI) who was not part of the test framework. The observer forms their own judgment from the raw evidence, and that judgment is captured separately from the programmatic score. When programmatic scoring and observer review disagree, the observer review takes precedence.

### Principle 5: Classify the Failure

When something goes wrong, the report MUST answer: **is this a HiPilot bug, an AI behavior issue, or an environment issue?** These require different people and different fixes.

### Principle 6: Every Test is Replayable

All evidence (pane captures, MCP logs, generated Tcl, screenshots, video) MUST be saved with synchronized timestamps so that any test result can be analyzed after the fact without needing to reproduce the failure.

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

Raw evidence files for post-mortem analysis. Designed so an **independent observer** (human or AI) can reconstruct and judge the entire test from these artifacts alone, without access to the test framework's internal state.

```
evidence/20260225_103045/
├── flow_progress.json              # Machine-readable progress map
├── stage_scorecards.json           # All stage scores (programmatic)
├── observation_points.jsonl        # Timeline of all observation points
├── FLOW_REPORT.md                  # Human-readable report (Levels 1+2)
├── OBSERVER_REVIEW.md              # Observer's independent review (Section 6)
│
├── stage_01_init/
│   ├── claude_pane.log             # Claude Code pane capture (final)
│   ├── eda_pane.log                # EDA tool pane capture (final)
│   ├── mcp_calls.jsonl             # MCP tool call log for this stage
│   ├── generated.tcl               # Tcl that was generated
│   ├── qor_snapshot.json           # QoR metrics after stage
│   ├── obs_stage_start.png         # Screenshot: before prompt sent
│   ├── obs_stage_start_claude.log  # Pane capture: before prompt
│   ├── obs_ai_responded.png        # Screenshot: after AI responded
│   ├── obs_stage_complete.png      # Screenshot: after EDA finished
│   └── obs_stage_complete_eda.log  # Pane capture: after EDA finished
│
├── stage_05_cts/
│   ├── claude_pane.log
│   ├── eda_pane.log
│   ├── mcp_calls.jsonl             # Shows: no MCP calls made
│   ├── generated.tcl               # Empty or wrong Tcl
│   ├── qor_snapshot.json           # null/empty
│   ├── obs_stage_start.png
│   ├── obs_ai_responded.png        # Shows what Claude actually said
│   ├── obs_on_error.png            # Screenshot at error detection
│   ├── obs_on_error_eda.log        # EDA pane at error moment
│   ├── obs_stage_complete.png      # Final state
│   └── failure_classification.json # Category + root cause
│
├── video.mp4                       # Full session recording
└── video_timestamps.json           # Video offset for each observation point
```

**Key principle:** The evidence bundle must be **self-contained**. An observer who receives only this directory (no access to the test framework, no ability to re-run) should be able to fully reconstruct what happened and form their own judgment.

**Evidence-only debugging:** The EDA server has no source code. All diagnostic information must come from the evidence package pulled to the dev machine. Therefore HiPilot and HiTestBot logs are **deliberately verbose**:
- `run_log.txt` — timestamped steps, observations, MCP calls, parse results
- `mcp_calls.jsonl` — full MCP log with `result_preview`, `error`, `args` when `HIPILOT_TEST_LOG` is set
- `FLOW_REPORT.md` — includes **Diagnostic Summary** (MCP breakdown, error excerpts, pane previews)

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

## 6. Observer Review Protocol

The programmatic scoring system (Sections 3-4) catches what it's programmed to look for. The observer review catches **everything else** — context, intent, quality of reasoning, subtle failures, near-misses, and unexpected successes.

### 6.1 The Three-View Model

Every test produces three independent streams of evidence. An observer (human or AI) reviews all three and forms a judgment that is **separate from and independent of** the programmatic score.

```
┌─────────────────────────────────────────────────────────────┐
│                    Three-View Correlation                     │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  VIEW 1:     │  │  VIEW 2:      │  │  VIEW 3:            │  │
│  │  Logs        │  │  Screenshots  │  │  Video              │  │
│  │              │  │               │  │                      │  │
│  │  What the    │  │  What the     │  │  What actually       │  │
│  │  system      │  │  screen       │  │  happened over       │  │
│  │  recorded    │  │  showed at    │  │  time, including     │  │
│  │              │  │  key moments  │  │  things no log       │  │
│  │  • pane logs │  │               │  │  captures            │  │
│  │  • MCP logs  │  │  • stage      │  │                      │  │
│  │  • EDA logs  │  │    transitions│  │  • AI hesitation     │  │
│  │  • Tcl files │  │  • error      │  │  • error recovery    │  │
│  │              │  │    states     │  │  • decision flow     │  │
│  │              │  │  • final      │  │  • timing of actions │  │
│  │              │  │    result     │  │  • unexpected events │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                       │
│                   ┌──────▼───────┐                               │
│                   │  CORRELATION  │                               │
│                   │              │                               │
│                   │  Do all three │                               │
│                   │  views tell   │                               │
│                   │  the same     │                               │
│                   │  story?       │                               │
│                   └──────┬───────┘                               │
│                          │                                       │
│                   ┌──────▼───────┐                               │
│                   │  OBSERVER     │                               │
│                   │  VERDICT      │                               │
│                   └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Timeline Synchronization

All three views MUST be aligned on a shared timeline so the observer can correlate events across them.

**Rule:** Every artifact MUST carry a timestamp that can be mapped to the test session clock.

| Artifact | Timestamp Method |
|----------|-----------------|
| Pane captures | Captured at defined **observation points** (see 6.3); filename includes timestamp |
| MCP call logs | Each log line has ISO 8601 `ts` field |
| EDA tool logs | Innovus/ICC2 log files have built-in timestamps |
| Screenshots | Captured at observation points; filename includes timestamp |
| Video | Continuous; ffmpeg embeds wall-clock time; observation points are annotated with frame offsets |
| Generated Tcl | Saved at generation time with timestamp in filename |

**Correlation example:**
```
Timeline    View 1 (Log)                View 2 (Screenshot)     View 3 (Video)
──────────  ─────────────────────────── ─────────────────────── ──────────────────
10:23:45    MCP: eda.generate_tcl       -                       Claude typing...
            args: {op: "run_cts"}
10:23:46    MCP: result OK              -                       Tcl block appears
            template: innovus_cts.tcl                           in Claude's output
10:23:47    MCP: eda.send_to_terminal   screenshot_stage5.png   Command appears
            tcl: "source /tmp/..."      [shows Innovus pane]    in EDA pane
10:24:15    MCP: wait_for_prompt        -                       Innovus still
            status: timeout                                     processing...
10:25:15    -                           screenshot_stage5_err   ERROR visible in
                                        [shows error message]   EDA pane
10:25:20    Pane capture: "**ERROR:     -                       Claude reads
            No clock tree spec found"                           the error output
```

With this timeline, the observer can see the full story: the MCP tools were used correctly (L3 = 1.0 programmatically), but the underlying Tcl failed because the design state was wrong. The video shows Claude noticed the error and attempted recovery — something the programmatic score might miss entirely.

### 6.3 Observation Points

An **observation point** is a defined moment during the test where all three views are captured simultaneously. This creates a "snapshot in time" that the observer can review.

**Mandatory observation points:**

| Observation Point | When | What to Capture |
|------------------|------|-----------------|
| `STAGE_START` | Before sending the stage prompt to Claude | Screenshot, pane captures (both panes), note video timestamp |
| `PROMPT_SENT` | Immediately after the prompt is delivered | Screenshot showing prompt in Claude's input |
| `AI_RESPONDED` | When Claude finishes its response | Screenshot, pane captures, save any generated Tcl |
| `EDA_EXECUTING` | While the EDA tool is processing | Screenshot showing EDA pane activity |
| `STAGE_COMPLETE` | After EDA execution finishes (or times out) | Screenshot, pane captures (both panes), QoR snapshot, note video timestamp |
| `ON_ERROR` | Whenever an error is detected in any pane | Screenshot, pane captures, note video timestamp |

**Implementation:** At each observation point, the test framework records:
```json
{
  "observation": "STAGE_COMPLETE",
  "stage": "placement",
  "timestamp": "2026-02-25T10:30:15.000Z",
  "video_offset_s": 423.5,
  "artifacts": {
    "screenshot": "stage_04_placement/obs_stage_complete.png",
    "claude_pane": "stage_04_placement/obs_stage_complete_claude.log",
    "eda_pane": "stage_04_placement/obs_stage_complete_eda.log"
  },
  "notes": "Placement finished, Innovus prompt returned"
}
```

### 6.4 Observer Review Questions

At each stage, the observer answers these questions by examining the three views. These are **not** automated checks — they require contextual judgment.

**Per-Stage Observer Questions:**

| # | Question | What to Look At | Answer Format |
|---|----------|----------------|---------------|
| Q1 | Did the AI understand what this stage requires? | Claude pane: read AI's response text for reasoning | Yes / Partially / No + explanation |
| Q2 | Did the AI's approach make engineering sense? | Claude pane + generated Tcl: is this how an engineer would do it? | Yes / Partially / No + explanation |
| Q3 | Did the AI use the right tools? | MCP logs + video: did it use MCP or bypass with direct commands? | MCP only / Mixed / Direct only |
| Q4 | Was the generated Tcl correct for this design and stage? | Generated Tcl file: review actual content, not just "was a template used" | Correct / Minor issues / Major issues / Wrong |
| Q5 | Did the EDA tool execute successfully? | EDA pane + EDA logs + screenshot: look for actual completion, not just prompt return | Clean / Warnings / Errors / Crash |
| Q6 | Did the AI handle the result appropriately? | Video + Claude pane: did AI acknowledge success/failure? Did it adapt? | Appropriate / Missed issues / Wrong conclusion |
| Q7 | Does the QoR make sense for this stage? | QoR snapshot + EDA reports: are the numbers reasonable? | Reasonable / Suspicious / Wrong |
| Q8 | Was there anything the programmatic score missed? | Compare all views against programmatic scorecard | Free-form observation |

**Overall Flow Observer Questions (asked once after all stages):**

| # | Question | Answer Format |
|---|----------|---------------|
| F1 | Did the AI drive the flow autonomously, or did it need hand-holding? | Autonomous / Mostly autonomous / Needed guidance / Failed |
| F2 | Did the AI make reasonable decisions at transition points between stages? | Yes / Mostly / No |
| F3 | When errors occurred, did the AI recover gracefully? | Recovered / Partial recovery / No recovery / No errors |
| F4 | Would a junior engineer watching this video trust the AI's work? | Yes / With reservations / No |
| F5 | What is the single biggest improvement that would advance the flow further? | Free-form |

### 6.5 Observer Verdict

The observer produces a separate verdict for each stage and for the overall flow. This verdict exists alongside (not replacing) the programmatic score.

```
═══════════════════════════════════════════════════
  Observer Review: Ibex RTL-to-GDS Flow
  Reviewer: [Human / AI Model Name]
  Date: 2026-02-25
═══════════════════════════════════════════════════

  Stage        Programmatic  Observer   Alignment
  ───────────  ────────────  ─────────  ─────────
  Init         5.0/5 PASS    PASS       ✅ Agree
  Floorplan    5.0/5 PASS    PASS       ✅ Agree
  Power        5.0/5 PASS    PARTIAL    ⚠️ Disagree
               (grep found     (video shows Claude
                keywords)       hesitated, tried wrong
                                command first, then
                                recovered)
  Placement    4.0/5 PARTIAL PASS       ⚠️ Disagree
               (TNS not         (observer: TNS was
                reported)        reported verbally in
                                 Claude's response,
                                 just not in expected
                                 format)
  CTS          1.5/5 FAIL    FAIL       ✅ Agree

  Overall Flow:
    Programmatic: 4/10 stages (40%)
    Observer:     3.5/10 stages (35%)
    Note: Observer downgraded Power from PASS to PARTIAL
          because the video showed non-confident AI behavior
          that the grep-based checks missed.

  Key Observer Finding:
    "The AI successfully drives stages 1-3 but lacks confidence
     in power planning (tried 3 approaches before succeeding).
     CTS failure is an environment issue (physical-only mode),
     not an AI capability issue. Fixing init to include MMMC
     would likely advance the flow to stage 7+."
```

### 6.6 Disagreement Resolution

When the programmatic score and observer verdict disagree:

| Scenario | Resolution | Rationale |
|----------|-----------|-----------|
| Programmatic PASS, Observer FAIL | **Use Observer** | Programmatic test has a false positive (grep matched but outcome was wrong) |
| Programmatic FAIL, Observer PASS | **Use Observer** | Programmatic test has a false negative (keyword missing but task succeeded) |
| Programmatic PARTIAL, Observer PASS | **Use Observer** | Programmatic test was too strict |
| Programmatic PARTIAL, Observer FAIL | **Use Observer** | Programmatic test was too lenient |

**Rule:** The observer verdict is the **source of truth** for the final report. The programmatic score is a useful first-pass filter, but the observer has the final word.

**Action on disagreement:** When a disagreement is found, the test framework SHOULD log it as a **test quality issue** — the programmatic check needs to be improved to match what the observer sees.

```json
{
  "type": "test_quality_issue",
  "stage": "power",
  "programmatic_score": 5.0,
  "observer_verdict": "PARTIAL",
  "reason": "Programmatic check only verified keywords; missed that AI tried 3 wrong approaches before succeeding",
  "action": "Add check for retry count or time-to-success in power stage verifier"
}
```

### 6.7 Who is the Observer?

The observer can be:

**Human engineer** — Reviews artifacts after the test run. Best for nuanced judgment, worst for scalability.

**AI model with vision** — Analyzes screenshots and video frames, reads logs, answers the observer questions. Good for scalability, requires careful prompting. The observer AI MUST be a different invocation than the AI being tested (Claude Code driving the flow). It reviews artifacts after the fact, not during execution.

**Both** — AI does first-pass review, human validates disagreements. Best balance of scalability and accuracy.

**Rule:** Regardless of who the observer is, they MUST answer the same structured questions (Section 6.4) and produce the same verdict format (Section 6.5). This ensures consistency across reviews.

---

## 7. Flow Stage Definitions

### 7.1 RTL-to-GDS Flow (Ibex Design)

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

## 8. Test Report Format

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

## 9. Test Rules Checklist

### Rules for Test Authors

1. **MUST** produce all three result levels (flow progress, stage scorecards, evidence bundle).
2. **MUST** collect evidence at all 5 layers for every attempted stage, even if earlier layers fail.
3. **MUST** classify failures using the three-category system (HIPILOT_BUG, AI_BEHAVIOR, ENVIRONMENT).
4. **MUST** save all raw evidence (pane logs, MCP logs, generated Tcl, screenshots) to the evidence directory.
5. **MUST** capture QoR metrics at every stage where they are available.
6. **MUST NOT** stop the test at the first failure if subsequent stages could still be attempted.
7. **MUST NOT** use bare `assert(passed >= N)` as the final verdict. Use the scoring system.
8. **SHOULD** compare results against the previous run to show improvement or regression.
9. **MUST** include a video recording of the full test session.
10. **MUST** capture screenshots at every mandatory observation point (Section 6.3).

### Rules for Evidence Collection

1. **Pane captures** MUST include at least 300 lines of scrollback from both Claude and EDA panes.
2. **MCP call logs** MUST be enabled via `HIPILOT_TEST_LOG` for every E2E test run.
3. **Generated Tcl** MUST be copied to the evidence directory (not just referenced by temp path).
4. **Screenshots** MUST be captured at every mandatory observation point (STAGE_START, PROMPT_SENT, AI_RESPONDED, EDA_EXECUTING, STAGE_COMPLETE, ON_ERROR).
5. **QoR snapshots** MUST use a consistent JSON schema across all stages and test runs.
6. **Video** MUST run for the full test duration. Video timestamps for each observation point MUST be recorded in `video_timestamps.json`.
7. **Observation points** MUST be logged to `observation_points.jsonl` with timestamp, video offset, and artifact paths.
8. The evidence bundle MUST be **self-contained** — an observer with only the evidence directory and no access to the test framework MUST be able to fully reconstruct what happened.

### Rules for Observer Review

1. Every flow certification test MUST be reviewed by an observer (human, AI, or both).
2. The observer MUST answer all per-stage questions (Section 6.4) and all overall flow questions.
3. The observer MUST produce an `OBSERVER_REVIEW.md` that is saved in the evidence bundle.
4. The observer's verdict is the **source of truth**. When it disagrees with the programmatic score, the observer wins.
5. Disagreements between programmatic score and observer verdict MUST be logged as test quality issues with an action item to improve the programmatic check.
6. The observer MUST NOT have access to the programmatic scorecard until after completing their own review (to avoid anchoring bias).

### Rules for Scoring

1. Each evidence layer is scored 0.0 to 1.0. Half scores (0.5) are allowed for partial success.
2. A stage score is the sum of its 5 layer scores (max 5.0).
3. Stage status thresholds: `PASS` ≥ 4.0, `PARTIAL` ≥ 2.0, `FAIL` < 2.0.
4. Flow progress is the count of stages with status `PASS` or `PARTIAL`.
5. The overall test result is expressed as **progress fraction** (e.g., "4/10 stages, 40%") and **total score** (e.g., "20.5/50"), never just "PASS" or "FAIL".
6. The **final reported result** uses the observer verdict where it disagrees with programmatic scoring. The programmatic score is included for reference but is not the final word.

---

## 10. Improvement Tracking

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

## 11. Current Implementation

HiTestBot (`src/hitestbot/tests/FlowCertificationTest.js`) implements these rules. It:

1. Launches HiPilot (`bin/hipilot`)
2. Opens gnome-terminal on display :0 (workspace visible on desktop)
3. Records video with ffmpeg
4. Types a command into Claude Code
5. Watches both panes, approves when asked, answers questions
6. Collects evidence after the test (pane dumps, MCP logs, EDA logs, screenshots)
7. Scores L1-L5 by reading what's on screen
8. Builds a correlated timeline (video ↔ panes ↔ MCP logs)

See `src/hitestbot/README.md` for the complete evidence bundle structure.

---

*This is a living document. Update as the testing framework evolves.*
