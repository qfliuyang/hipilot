# HiPilot Self-Improving Loop

**Purpose:** Guide ralph-loop (or similar auto-iteration tools) to drive HiPilot toward the ultimate goal through automated test–analyze–improve cycles. Each iteration produces **metrics and status** so the loop knows progress and keeps pushing until the goal is achieved.

---

## 1. Ultimate Goal (North Star)

> **HiPilot can conduct a complete RTL-to-GDS flow driven by Claude Code, MCP tools, and skills — proving that an AI Agent can replace a human for standard flow execution.**

**Graduation criteria** (all must be true):
- All stages complete (`completed_stages === total_stages`)
- Score ≥ 90% (`total_score >= max_score * 0.9`)
- No blocking stage (`blocking_stage === null`)
- No HIPILOT_BUG failures

When graduation is achieved, the loop **stops** and reports success.

---

## 2. Iteration Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Iteration N                                                             │
│                                                                          │
│  1. RUN      bin/hitestbot-eda rtl2gds   (on EDA server)                │
│  2. PULL     bin/hitestbot-pull          (evidence to dev machine)       │
│  3. READ     flow_progress.json, FLOW_REPORT.md, stage_scorecards       │
│  4. METRICS  Extract status (see Section 3)                             │
│  5. DECIDE   Goal achieved? → STOP. Else → improve per classification   │
│  6. IMPROVE  Fix code/skills/prompts per Section 5                       │
│  7. PUSH     bin/hitestbot-push (if needed)                              │
│  8. REPEAT   Next iteration                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Metrics and Status (Per Iteration)

After each run, read the **latest** evidence dir (e.g. `e2e_evidence/<timestamp>/` or `/tmp/hipilot-test-evidence/<timestamp>/`) and extract:

### Primary Metrics (from `flow_progress.json`)

| Metric | Path | Description | Target |
|--------|------|-------------|--------|
| `progress_pct` | `flow_progress.progress_pct` | Stages completed as % (0–100) | 100 |
| `completed_stages` | `flow_progress.completed_stages` | Stages passed or partial | = total_stages |
| `total_stages` | `flow_progress.total_stages` | Total flow stages | (baseline) |
| `total_score` | `flow_progress.total_score` | Sum of stage scores | ≥ max_score * 0.9 |
| `max_score` | `flow_progress.max_score` | total_stages * 5 | (baseline) |
| `blocking_stage` | `flow_progress.blocking_stage` | First failing stage, or null | null |
| `blocking_category` | `flow_progress.blocking_category` | HIPILOT_BUG / AI_BEHAVIOR / ENVIRONMENT | — |

### Status Summary (for ralph-loop)

```
ITERATION_STATUS:
  goal_achieved: false | true
  progress_pct: 40
  score_pct: 32.0
  blocking_stage: CTS
  blocking_category: AI_BEHAVIOR
  graduation_checks:
    - all_stages_pass: false
    - score_ge_90: false
    - no_blocking: false
    - no_hipilot_bug: true
  next_focus: Resolve blocking stage CTS (AI_BEHAVIOR)
```

**How to compute:**
- `goal_achieved` = all graduation checks pass (use ProgressTracker.checkGraduation or equivalent)
- `score_pct` = `(total_score / max_score) * 100`
- `next_focus` = from `FLOW_REPORT.md` → Recommendations, or from `failure_classification.action`

### Trend (optional, for multi-run)

If `flow_progress.json` from multiple runs exists (e.g. in `/tmp/hipilot-test-evidence/*/` or `e2e_evidence/*/`), FlowCertificationTest prints improvement trend and graduation:

```bash
node src/hitestbot/tests/FlowCertificationTest.js rtl2gds
```

For a single run, read the latest evidence dir directly:

```bash
LATEST=$(ls -t e2e_evidence 2>/dev/null | head -1)
cat e2e_evidence/$LATEST/flow_progress.json | jq '{progress_pct, total_score, max_score, blocking_stage, blocking_category}'
```

---

## 4. Decision Logic

```
IF goal_achieved:
  STOP. Report: "HiPilot RTL-to-GDS flow certified."
ELSE:
  IF blocking_category == "HIPILOT_BUG":
    → Fix HiPilot code (MCP servers, templates, skills, TUI)
  ELSE IF blocking_category == "AI_BEHAVIOR":
    → Improve CLAUDE.md, skills, prompts, or deploy/eda-server context
  ELSE IF blocking_category == "ENVIRONMENT":
    → Fix EDA setup, design state, or test environment
  ELSE:
    → Read FLOW_REPORT.md "Recommendations" and Diagnostic Summary
  PUSH changes if needed (bin/hitestbot-push)
  RUN next iteration
```

---

## 5. Improvement Guide by Failure Classification

### HIPILOT_BUG
- **Evidence:** MCP server error, template wrong Tcl, skill wrong triggers
- **Action:** Inspect `mcp_calls.jsonl`, `stage_*/scorecard.json`, `failure_classification.json`
- **Fix:** Edit `servers/*/index.js`, `templates/**/*.tcl`, `skills/*.md`
- **Push:** `bin/hitestbot-push servers/ templates/ skills/`

### AI_BEHAVIOR
- **Evidence:** Claude used direct tmux/bash, wrong skill, wrong params
- **Action:** Inspect `FLOW_REPORT.md` Diagnostic Summary, `claude_pane_last50`, `mcp_calls.jsonl`
- **Fix:** Edit `deploy/eda-server/CLAUDE.md`, skills, prompts, command triggers
- **Push:** `bin/hitestbot-push deploy/eda-server/ skills/`

### ENVIRONMENT
- **Evidence:** EDA tool error, design not loaded, missing files
- **Action:** Inspect `eda_pane_last50`, `stage_*/eda_pane.log`, EDA error messages
- **Fix:** Ensure design init, MMMC, libs; or adjust test expectations for environment limits
- **Push:** Usually none (environment fix on EDA server); or push `deploy/eda-server/` if config change

---

## 6. Commands Reference

| Step | Command | Where |
|------|---------|-------|
| Run test | `bin/hitestbot-eda rtl2gds` | EDA server (SSH) |
| Pull evidence | `bin/hitestbot-pull` | Dev machine |
| Push changes | `bin/hitestbot-push skills/` | Dev machine |
| Read status | Parse `e2e_evidence/<latest>/flow_progress.json` | Dev machine |
| Unit tests | `npm test` | Dev machine (before push) |

---

## 7. Evidence Package Layout (After Pull)

```
e2e_evidence/<timestamp>/
├── flow_progress.json      # PRIMARY: metrics for this iteration
├── FLOW_REPORT.md          # Human-readable report, Recommendations, Diagnostic Summary
├── stage_scorecards.json   # Per-stage scores and failure_classification
├── run_log.txt             # Timestamped steps, MCP calls
├── mcp_calls.jsonl         # Full MCP log (verbose)
├── observation_points.json
└── stage_*/
    ├── scorecard.json
    ├── failure_classification.json   # If stage failed
    ├── claude_pane.log
    └── eda_pane.log
```

---

## 8. ralph-loop Execution Checklist

For each iteration:

- [ ] Run `bin/hitestbot-eda rtl2gds` (or equivalent SSH invocation)
- [ ] Wait for completion (flow may take minutes)
- [ ] Run `bin/hitestbot-pull` to fetch evidence
- [ ] Read `flow_progress.json` from latest evidence dir
- [ ] Compute `goal_achieved` (graduation check)
- [ ] If goal achieved: STOP and report success
- [ ] Else: Read `FLOW_REPORT.md` Recommendations and blocking stage `failure_classification`
- [ ] Apply improvement per `blocking_category` (Section 5)
- [ ] Run `npm test` locally (optional but recommended)
- [ ] Push changes with `bin/hitestbot-push` if needed
- [ ] Start next iteration

---

## 9. Progress Snapshot Template

Use this format to log status at each iteration (for ralph-loop's own state):

```yaml
iteration: N
timestamp: "20260225_143022"
progress_pct: 40
score: "16.0/50.0"
blocking_stage: CTS
blocking_category: AI_BEHAVIOR
next_action: "Improve CLAUDE.md to reinforce MCP-only usage for CTS"
goal_achieved: false
```

---

*Generated for HiPilot v0.6.0. See [TESTING_RULES.md](testing/TESTING_RULES.md) for testing philosophy and [hitestbot-guide.md](testing/hitestbot-guide.md) for execution model.*
