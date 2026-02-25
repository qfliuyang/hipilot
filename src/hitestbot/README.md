# HiTestBot v2 — Evidence-Based Testing Framework

Tests HiPilot like a human engineer: correlates MCP logs, screenshots, and video to produce diagnostic reports with 5-layer scoring, failure classification, and improvement tracking.

## Quick Start

```bash
# MCP infrastructure test (no EDA server needed)
node src/hitestbot/tests/McpInfraTest.js

# Flow certification test (requires tmux session)
node src/hitestbot/tests/FlowCertificationTest.js rtl2gds

# Run on EDA server (from Mac via SSH, or directly on EDA server)
bin/hitestbot-eda rtl2gds
```

## EDA Server Only ("Test Like Real Human")

**HiTestBot runs ONLY on the EDA server.** That's where humans run HiPilot. Commands (tmux, ffmpeg, MCP) run locally there.

**From dev machine:**
```bash
bin/hitestbot-eda rtl2gds    # SSH + run on EDA server
bin/hitestbot-pull           # Download evidence to dev machine
bin/hitestbot-push skills/   # Upload test plan/config to EDA server
```

**On EDA server directly:**
```bash
cd /home/EDA/hipilot/current
node src/hitestbot/tests/FlowCertificationTest.js rtl2gds
```

See [docs/testing/hitestbot-guide.md](../../docs/testing/hitestbot-guide.md) for execution model, sync workflow, and env vars.

## Architecture

```
src/hitestbot/
├── core/                        # v2 evidence-based framework
│   ├── McpLogCollector.js       # Parse MCP JSONL logs
│   ├── ObservationPoint.js      # Synchronized multi-view capture
│   ├── StageVerifier.js         # 5-layer scoring (L1-L5)
│   ├── FlowCertifier.js         # Flow test orchestrator
│   ├── FlowReporter.js          # FLOW_REPORT.md generation
│   └── ProgressTracker.js       # Cross-run improvement tracking
│
├── infra/                       # v1 infrastructure (preserved)
│   ├── TestRunner.js            # Base test class
│   ├── E2ETestRunner.js         # E2E test with SSH/video
│   ├── TmuxController.js        # tmux operations
│   ├── VideoRecorder.js         # ffmpeg recording
│   ├── TestReporter.js          # Simple reports
│   └── TestUtils.js             # Assertions, waits, file ops
│
└── tests/                       # Test implementations
    ├── FlowCertificationTest.js # RTL-to-GDS flow certification
    ├── McpInfraTest.js          # MCP server infrastructure
    └── (12 v1 tests)            # Legacy tests (still work)
```

## 5-Layer Scoring

Each stage is scored across 5 evidence layers (0.0-1.0 each, max 5.0):

| Layer | What It Measures |
|-------|-----------------|
| L1 Prompt Delivery | Did the AI receive and respond? |
| L2 Intent Recognition | Did it pick the right skill/operation? |
| L3 MCP Tool Usage | Did it use MCP tools (not direct tmux)? |
| L4 EDA Execution | Did the EDA tool execute without errors? |
| L5 QoR Assessment | Were QoR metrics captured and reported? |

Status: **PASS** (≥4.0) / **PARTIAL** (≥2.0) / **FAIL** (<2.0)

## Failure Classification

When a stage fails, the system classifies the root cause:

| Category | Meaning | Example |
|----------|---------|---------|
| `HIPILOT_BUG` | HiPilot code is broken | Template produces bad Tcl |
| `AI_BEHAVIOR` | AI made wrong decision | Claude used bash instead of MCP |
| `ENVIRONMENT` | Setup issue | No design loaded, missing libraries |

## Evidence Bundle

Each test produces a self-contained evidence directory:

```
evidence/20260225_103045/
├── FLOW_REPORT.md            # Human-readable report
├── flow_progress.json        # Machine-readable progress
├── mcp_calls.jsonl           # Full MCP call log
├── stage_scorecards.json     # All stage scores
├── observation_points.json   # Timeline bookmarks
└── stage_01_init/            # Per-stage evidence
    ├── obs_stage_start.png
    ├── obs_stage_complete.png
    ├── obs_stage_complete_claude.log
    ├── obs_stage_complete_eda.log
    └── scorecard.json
```

## Test Modes

| Mode | What It Tests | AI Involved? |
|------|--------------|-------------|
| **Workflow-driven** | Full pipeline via workflow.run | Yes (Claude calls it) |
| **MCP-direct** | MCP infrastructure only | No |
| **Prompt-driven** | AI behavior per stage | Yes (one prompt per stage) |

## Progress Tracking

```
Date        Progress   Score    Blocking Stage   Category
──────────  ─────────  ──────── ───────────────  ────────────
2026-02-25  4/10 (40%) 20.5/50  CTS              AI_BEHAVIOR
2026-02-26  6/10 (60%) 30.0/50  Routing          ENVIRONMENT
2026-02-27  8/10 (80%) 38.0/50  Signoff          HIPILOT_BUG
```

## Key Rules (from TESTING_RULES.md)

1. **Progress over pass/fail** — report how far, not just whether
2. **Evidence at every layer** — MCP log is ground truth
3. **Three-view correlation** — logs + screenshots + video must agree
4. **Classify failures** — different categories need different fixes
5. **Self-contained bundles** — reviewable without re-running
