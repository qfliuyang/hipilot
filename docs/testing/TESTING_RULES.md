# HiPilot Testing Rules - 5-Agent Team Mode

**Version:** 1.5
**Date:** 2026-03-15
**Status:** Active

**Latest Update:**
- **Cheat Prevention (NEW Principle 10)**: Multi-layer cheat detection ensures tests measure real behavior, not fake/simulated output. Detects echo commands, fake processes, stale evidence, static video.
- **5-Agent Team Testing**: Tests MUST verify all 5 agents coordinate through hub-and-spoke pattern.
- **Mission Pack Driven Testing (v1.4)**: Mission packs are now Markdown (natural language), not YAML. Tests validate natural language parsing and agent coordination.
- **Platinum Certification (NEW)**: Highest tier requiring full agent coordination + mission pack target achievement.
- **Phase 4.5 & Phase 8 Testing**: New test phases for mission pack loading and full agent-driven RTL2GDS flow.
- **EDA Server Testing Mandate (Principle 7)**: ALL tests MUST run on EDA server (192.168.112.163) with real tools (Innovus, DC Shell, PrimeTime). No local testing, no mocks, no simulations.
- Renumbered principles: Clean Environment is now Principle 8, Heartbeat System is Principle 9
- Added EDA server environment specification and validation checklist
- Added deployment workflow: deploy → test on server → pull evidence → analyze
- Added "No Exceptions Rule" - strict enforcement of EDA server testing
- Added Heartbeat System testing rules (event-driven monitoring)
- Added Clean Environment Charter (no contamination from previous runs)
- Added Phase 0.5 Heartbeat verification requirements
- Updated pre-test checklist with heartbeat cleanup and EDA server checks
- Added evidence freshness validation for heartbeat files
- Added Phase 3.5 Manual Mode Workflow testing
- Added Mission Pack validation section (updated for Markdown format)
- Added L3b Process Validation (correct tool per stage)
- Updated for modular stage commands (/synthesis, /floorplan, etc.)

---

## 1. Purpose

This document defines the testing philosophy, rules, and report format for HiPilot's E2E test framework (HiTestBot). The goal is to replace binary PASS/FAIL results with **layered evidence reports** that enable debugging, improvement tracking, and certification of AI-driven EDA flows.

### The North Star

> **HiPilot 5-Agent Team can conduct a complete RTL-to-GDS flow driven by Claude Code, MCP tools, and skills — proving that an AI Agent Team can replace a human for standard flow execution.**

Every test exists to measure progress toward this goal.

HiTestBot runs **only on the EDA server** ("test like real human"). Each run creates a timestamped evidence dir. Use `bin/hitestbot-eda`, `bin/hitestbot-pull`, `bin/hitestbot-push` for run and sync. See [hitestbot-guide.md](hitestbot-guide.md) for execution model and sync scripts.

---

## 1.5 Test Type Clarification: Unit Tests vs. E2E Tests

**This Document (TESTING_RULES.md) and TEST_PLAN.md cover END-TO-END (E2E) TESTING ONLY.**

HiPilot has two completely different test categories:

| Aspect | Unit Tests (`npm test`) | E2E Tests (This Document) |
|--------|------------------------|---------------------------|
| **Location** | Local development machine | EDA server (192.168.112.163) |
| **Purpose** | Verify JavaScript code correctness | Verify full HiPilot-EDA integration |
| **Tools** | Jest/Vitest, mocked dependencies | Real Innovus, DC Shell, PrimeTime |
| **Duration** | ~200 milliseconds | 15 minutes to 2+ hours |
| **Coverage** | Functions, utilities, logic | Complete RTL-to-GDS flow |
| **Cost** | Free (developer machine) | Expensive (EDA licenses, server time) |
| **When to Run** | On every code change, before commit | After deployment, before release |

**Unit Tests (`npm test` on dev machine):**
- Test individual JavaScript functions in isolation
- Mock all external dependencies (file system, EDA tools)
- Run in Node.js without any real EDA software
- **Purpose:** Catch syntax errors, logic bugs, regressions quickly
- **Limitation:** Cannot test actual EDA tool integration
- **Example:** `test/shell-escape.test.js` verifies string escaping logic

**E2E Tests (HiTestBot on EDA server):**
- Test complete HiPilot workflow with real hardware and licenses
- Execute actual EDA tool commands (placement, routing, etc.)
- Generate real deliverables (GDS files, timing reports, checkpoints)
- **Purpose:** Verify HiPilot works in production environment
- **Requirement:** EDA server access, real licenses, real design data
- **Example:** "Run synthesis stage and verify checkpoint created"

**The Relationship:**

```
Development Workflow:
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Code Changes                                                     │
│       │                                                            │
│       ▼                                                            │
│   ┌─────────────┐    PASS    ┌──────────────┐    PASS    ┌──────┐ │
│   │ npm test    │ ─────────▶ │ deploy to    │ ─────────▶ │ E2E  │ │
│   │ (unit tests)│            │ EDA server   │            │ test │ │
│   └─────────────┘            └──────────────┘            └──────┘ │
│        │                           │                        │     │
│        ▼                           ▼                        ▼     │
│   Quick feedback              Code transfer            Validation │
│   (~200ms)                    (30s)                    (hours)    │
│                                                                    │
│   Unit tests = "Does the code work?"                               │
│   E2E tests  = "Does HiPilot control real EDA tools?"              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Important Distinctions:**

1. **Passing unit tests ≠ Working system**
   - Unit tests verify JavaScript code is syntactically correct
   - Only E2E tests can reveal EDA tool integration issues
   - Example: Unit test passes for `shellEscape()`, but E2E test reveals Innovus rejects the escaped command

2. **E2E tests are the ONLY valid certification**
   - HiPilot's purpose is controlling real EDA tools
   - Mocked tests prove nothing about production viability
   - All certification levels (Bronze, Silver, Gold, Platinum) require E2E tests

3. **Unit tests are NOT a substitute**
   - Running `npm test` locally does NOT validate HiPilot
   - Never claim "tests pass" based solely on unit tests
   - Always refer to E2E test results for HiPilot validation

**This Document Covers:**
- ✅ E2E test methodology
- ✅ EDA server testing requirements
- ✅ Real tool validation
- ✅ HiTestBot operation
- ✅ Evidence collection
- ✅ Scoring and certification

**This Document Does NOT Cover:**
- ❌ Unit test implementation
- ❌ JavaScript testing frameworks
- ❌ Mock/stub strategies
- ❌ Code coverage metrics

For unit tests, see `test/*.test.js` files in the repository.

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

### Principle 7: EDA Server Testing Mandate — Real Tools, Real Flows

**ALL testing MUST be performed on the EDA server (192.168.112.163) with real EDA tools.**

**Why This Matters:**

HiPilot's purpose is to control real EDA tools (Innovus, DC Shell, PrimeTime) in real chip design workflows. Testing with mocked tools or on development machines proves nothing about whether HiPilot actually works in production.

| What | Requirement | Violation |
|------|-------------|-----------|
| **Test Location** | EDA server ONLY (`EDA@192.168.112.163`) | Running tests on dev machine |
| **EDA Tools** | Real Innovus, DC Shell, PrimeTime | Mocked/simulated tool responses |
| **License Server** | Real flexlm licenses | Bypassing license checks |
| **Design** | Real Ibex RISC-V design | Toy/example designs |
| **Flow** | Real RTL-to-GDS flow | Shortened/simplified flows |
| **Evidence** | Screenshots/video from EDA server | Locally-generated mock evidence |

**EDA Server Environment:**

| Component | Value |
|-----------|-------|
| Host | `ssh EDA@192.168.112.163` (password: `eda2020`) |
| OS | CentOS 7.9 |
| EDA Tools | Innovus v20.10, DC Shell L-2016.03-SP2, PrimeTime T-2022.03 |
| License | flexlm @ localhost:27000 |
| Design | `/home/EDA/ibex_demo.tar` (Ibex RISC-V, Skywater 130nm) |
| HiPilot | `/home/EDA/hipilot/current/` |
| Node.js | v20.18.3 |
| Display | `:0` (GNOME desktop for video/screenshots) |

**Code Deployment Synchronization - MANDATORY:**

> **The EDA server MUST run the EXACT same code as the development machine. Verification is REQUIRED before EVERY test.**

**Deployment Protocol:**

```bash
# BEFORE EVERY TEST:

# 1. Check git status - NO uncommitted changes allowed!
git status
# Expected: "nothing to commit, working tree clean"

# 2. Get local commit hash
git rev-parse --short HEAD
# Example: a1b2c3d

# 3. Deploy to EDA server
node src/hitestbot/infra/deploy_hipilot.js

# 4. VERIFY deployment - hash MUST match!
ssh EDA@192.168.112.163 "cd /home/EDA/hipilot/current && git rev-parse --short HEAD"
# Expected: a1b2c3d (same as local!)

# 5. Only proceed if hashes match
```

**Code Sync Requirements:**

| Requirement | Why | Enforcement |
|-------------|-----|-------------|
| Clean git status | Uncommitted changes won't be deployed | `git status` must show "clean" |
| Verified deployment | Ensure code actually transferred | Hash comparison local vs EDA |
| Pre-test verification | Catch stale code before wasting time | Automated in test scripts |
| Post-change deployment | Any code change requires redeploy | No exceptions, no matter how small |

**Deployment Failures:**

| Failure | Detection | Fix |
|---------|-----------|-----|
| Uncommitted changes | `git status` shows modified files | Commit before testing |
| SSH connection failed | Deploy script timeout | Check network/server status |
| Hash mismatch | Local ≠ EDA commit hash | Re-run deployment |
| Partial deployment | Some files old, some new | Full redeploy required |

**Strict Rules:**

- ❌ **NO** testing with uncommitted local changes
- ❌ **NO** testing without deployment verification
- ❌ **NO** assuming code is current without checking hash
- ✅ **ALWAYS** deploy after EVERY change
- ✅ **ALWAYS** verify commit hash matches

**Test Workflow:**

```bash
# 1. Verify clean git status
git status  # Must be clean!

# 2. Deploy and verify code sync
node src/hitestbot/infra/deploy_hipilot.js
ssh EDA@192.168.112.163 "cd /home/EDA/hipilot/current && git rev-parse --short HEAD"

# 3. Run test ON EDA SERVER (only if hashes match!)
bin/hitestbot-eda "run synthesis"

# 4. Pull evidence to dev machine
bin/hitestbot-pull <test_id>

# 5. Analyze
open test-evidence/<test_id>/FLOW_REPORT.md
```

**Validation:**

- All screenshots show EDA server desktop (CentOS 7, GNOME)
- All logs contain real tool output (not `echo` or mock commands)
- MCP logs show real tool calls to real EDA software
- Evidence pulled from `/home/EDA/hipilot_test/evidence/`

### Principle 8: Clean Environment — No Contamination

Each test MUST start from a completely clean state. No evidence, logs, heartbeat files, or design outputs from previous runs may influence the current test.

**Contamination Sources to Eliminate:**

| Source | Risk | Cleanup Action |
|--------|------|----------------|
| Stale heartbeat files | HiTestBot reads old state as current | `rm -f /tmp/hipilot-*-heartbeat.json` |
| Leftover EDA processes | License conflicts, port contention | `pkill -f innovus; pkill -f dc_shell` |
| Old tmux sessions | Session name conflicts | `tmux -L hipilot kill-server` |
| Existing checkpoints | Stages appear complete without running | Use timestamped directories only |
| Previous MCP logs | Old tool calls look like current activity | Fresh `HIPILOT_TEST_LOG` per test |

**Freshness Validation Rule:**
All output files must have timestamps AFTER the current test start time. Any file created before test start is considered STALE_EVIDENCE and invalidates the test.

### Principle 9: Heartbeat System — Event-Driven Monitoring

HiPilot uses a file-based heartbeat system (`/tmp/hipilot-{session}-heartbeat.json`) for event-driven state monitoring. This reduces CPU usage 50-100x during idle periods and improves reaction time to <50ms.

**Testing Requirements:**

| Aspect | Without Heartbeat | With Heartbeat |
|--------|------------------|----------------|
| Polling interval | 1-2 seconds | 5 seconds (adaptive) |
| CPU usage (idle) | 5-10% | ~0.1% |
| Reaction time | 1-2 seconds | <50ms on state change |
| Fallback behavior | N/A | Standard polling if heartbeat stale |

**Verification:**
- Heartbeat file must be created during test (timestamp > test start)
- HiTestBot must log "Heartbeat monitoring active" when available
- Heartbeat stats (wakeups count) must be reported at test completion
- Environment variable `HIPILOT_HEARTBEAT=false` can disable for comparison testing

---

### Principle 10: Cheat Prevention — Authenticity Verification

HiTestBot implements comprehensive cheat detection to ensure tests measure **real behavior**, not simulated or fabricated outputs. This prevents scenarios where fake status messages (e.g., `echo "Status: Running"`) are presented as evidence without actual execution.

**The "Echo" Cheat Pattern (What We're Defending Against):**

The most common cheating method is using shell `echo` commands to print fake status messages:
```bash
# FAKE - Echo commands that simulate status without real execution
echo -e "\033[32m✓\033[0m Supervisor: Running"
echo -e "\033[32m✓\033[0m Knowledge: Running"
echo -e "\033[32m✓\033[0m Planner: Running"
```

This creates the **illusion** of 5 agents running, but there are no actual Claude Code processes.

**Cheat Detection Mechanisms (8 Layers):**

| Layer | Detection Method | Catches |
|-------|------------------|---------|
| **1. Process Verification** | `ps aux \| grep claude` | Fake processes, missing agents |
| **2. Echo Command Detection** | Regex patterns in pane text | Echo-based status faking |
| **3. Pane Content Authenticity** | Claude Code interface indicators | Static images, replays |
| **4. MCP Log Integrity** | JSON validation, timestamp checks | Fabricated MCP logs |
| **5. Cross-Reference Validation** | Correlate pane+MCP+video | Inconsistent evidence |
| **6. Interactive Verification** | Send unique test command | Non-interactive/static displays |
| **7. Video Motion Detection** | ffprobe frame count, file size | Static image as video |
| **8. Evidence Freshness** | File timestamps vs test start | Reused old evidence |

**Implementation:**

```javascript
// HiTestBot runs these checks automatically
const cheatDetector = new CheatDetector({ socket, session });

// Early check (immediately after launch)
const processCheck = cheatDetector.verifyClaudeProcesses();
if (!processCheck.valid) {
  throw new Error(`Cheat detected: ${processCheck.message}`);
}

// Full verification (after test completion)
const results = await cheatDetector.runFullVerification({
  paneText: combinedPaneText,
  mcpLogPath: 'mcp_calls.jsonl',
  videoPath: 'video.mp4',
  evidenceFiles: ['screenshot.png', 'pane0.log'],
});

if (results.cheatDetected) {
  scorecard.authenticity = 0; // Automatic fail
}
```

**Automatic Fail Conditions:**
- Any critical cheat detection = automatic score of 0 for Authenticity subject
- Authenticity has 10x weight in GPA calculation (one cheat = automatic FAIL regardless of other scores)
- Test report includes `cheat_detection_report.json` with full details

**Golden Rule:**
> If a human would be fooled, HiTestBot catches it. If HiTestBot is fooled, the cheating was sophisticated enough to fool a human — which is itself a finding worth documenting.

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

**L3b: Process Validation (New in v1.2)**

In addition to the five evidence layers, HiTestBot validates that the **correct tool is used for each stage**:

| Stage | Required Tool | Wrong Tool Examples |
|-------|---------------|---------------------|
| Synthesis (Stage 0) | dc_shell | innovus, pt_shell |
| Physical Design (Stages 1-9) | innovus | dc_shell, pt_shell |
| Signoff (Stage 10) | pt_shell | innovus, dc_shell |

**Scoring:**
- **1.0** - Correct tool used for the stage
- **0.0** - Wrong tool used (critical error)

**Why this matters:** A human engineer would never try to run synthesis in Innovus or physical design in DC Shell. Using the wrong tool indicates a fundamental process error that would fail in real usage, even if the AI managed to make the tool execute without errors.

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

## 6.8 Long-Running Flow Adjustments (New in v1.1)

For flows exceeding 2 hours (e.g., full RTL-to-GDS), HiTestBot's pane capture may lose EDA output due to tmux scrollback limits or session resets. This causes artificially low L3/L4 scores despite successful flow completion.

### Evidence Timeline Verification Protocol

When pane logs show minimal content but flow completion is suspected:

1. **Verify Server-Side File Timestamps:**
   ```bash
   # Check GDS creation time on EDA server
   ssh EDA@192.168.112.163 "stat /home/EDA/ibex_work_upload/result/pr/data/ibex_core.gds"
   ```

2. **Validate Time Window Alignment:**
   | Event | UTC Time | Local (UTC+8) |
   |-------|----------|---------------|
   | Test Start | 03:53:35 | 11:53:35 |
   | /synthesis Typed | 03:57:35 | 11:57:35 |
   | GDS Created | ~04:44:26 | ~12:44:26 ← Must be after test start |
   | Test End | 05:57:38 | 13:57:38 |

3. **Multi-Factor Verification Matrix:**\n   | Factor | Weight | Pass Criteria |
   |--------|--------|---------------|
   | GDS File Freshness | HIGH | >10MB, created during test window |
   | Claude Output | HIGH | Shows "Flow Complete" or equivalent |
   | EDA Log Snippet | MEDIUM | Final 50 lines show "STAGE X COMPLETE" |
   | QoR Metrics | HIGH | WNS/TNS reported in Claude's summary |

4. **Adjusted Scoring Rules:**
   - If GDS file is fresh (>10MB, created during test) → L4 ≥ 0.5 regardless of pane capture
   - If WNS/TNS reported in Claude's summary → L5 ≥ 0.5
   - If "STAGE X COMPLETE" visible in any evidence → L3 ≥ 0.5

### Example: Test 20260304035335 (Phase 7 Gold Certification)

**Observed Scores (without adjustment):**
- L1: 1.0 (Claude responded)
- L2: 1.0 (Understood task)
- L3: 0.5 (MCP tools used - partial evidence)
- L4: 0.5 (EDA active - partial evidence)
- L5: 0.5 (QoR discussed but no WNS/TNS numbers in pane)
- **Total: 3.5/5.0** ⚠️ PARTIAL

**Evidence Verification:**
- GDS file: 19MB, created at 12:44:26 (within test window 11:53-13:57) ✓
- EDA log: "STAGE 9 COMPLETE: Chip finish and GDS export done" ✓
- QoR: WNS +0.136ns, TNS 0.000ns, 0 violating paths ✓

**Adjusted Verdict:**
- Flow completed successfully with timing closure
- Score artificially low due to pane capture limitations
- **Final Status: GOLD CERTIFIED** ✓

---

## 6.9 Mission Pack Testing (New in v1.3)

The Project Mission Pack is a **human-written Markdown document** that defines design-specific configuration in natural language. Tests MUST validate mission pack parsing, agent coordination, and gap detection.

### Mission Pack Format Support

| Format | Extension | Status | Use Case |
|--------|-----------|--------|----------|
| **Markdown** | `.md` | **Preferred** | Natural language, human-readable |
| YAML | `.yaml`, `.yml` | Legacy | Structured data, backward compatibility |
| JSON | `.json` | Legacy | Programmatic generation |

### Mission Pack Validation Tests

| Test | Command | Expected Result |
|------|---------|-----------------|
| Load Markdown mission pack | `bin/hitestbot-eda "load the mission pack and show flow stages"` | Natural language parsed, RTL files extracted, stages identified |
| Parse natural language | Verify pane output | Project name, top module, target frequency, technology extracted from text |
| Auto-detect legacy design | `bin/hitestbot-eda "load design from /path/to/legacy"` | Auto-detection creates mission pack |
| Agent coordination | Monitor pane 0.0 | All 5 agents activate and report status |
| Gap detection | After stage completion | Actual vs mission pack target metrics compared |

### Natural Language Parsing Validation

HiTestBot MUST verify the Knowledge Agent correctly parses:

| Element | Example Text | Extracted Value |
|---------|--------------|-----------------|
| Project name | "# Mission Pack: Ibex RISC-V Core" | `project.name: "ibex_core"` |
| Top module | "Top module is `ibex_core`" | `design.rtl.top_module: "ibex_core"` |
| RTL files | "Files: `rtl/ibex_core.sv`, `rtl/ibex_alu.sv`" | `design.rtl.files: ["rtl/ibex_core.sv", ...]` |
| Target frequency | "Target 100 MHz" | `flow.targets.timing.freq: 100` |
| Technology | "Skywater 130nm PDK" | `technology.node: "130nm"`, `technology.foundry: "skywater"` |
| Flow stages | "Run synthesis, floorplan, placement, CTS, routing, chip finish" | `flow.stages: ["synthesis", "floorplan", ...]` |

### Gap Detection Scoring

When MissionPackCertifier validates QoR against mission pack targets:

| Severity | Deviation | Example |
|----------|-----------|---------|
| 🔴 CRITICAL | >20% from target | WNS target 0ns, actual -0.5ns (50% deviation) |
| 🟡 WARNING | 10-20% from target | Utilization target 68%, actual 85% (25% over) |
| 🟢 MINOR | <10% from target | Utilization target 68%, actual 71% (4% over) |
| ✅ PASSED | Meeting or exceeding target | WNS +0.05ns (better than 0ns target) |

### Mission Pack Evidence

Evidence bundle MUST include:
- `hipilot-mission.md` (original human-written Markdown)
- `mission_pack_parsed.json` (parsed structured data from natural language)
- `agent_coordination.log` (evidence of 5-agent activation)
- `mission_pack_validation.json` (validation results)
- `gap_analysis.json` (per-stage gap detection results vs targets)

---

## 6.10 Phase 3.5: Manual Mode Workflow Testing (New in v1.2)

HiPilot supports two execution modes:
- **Auto mode** (default): Tcl executes immediately
- **Manual mode**: Tcl is previewed and requires `prefix+y` (Ctrl+B then y) to approve

### Manual Mode Test Procedure

```bash
# Step 1: Enable manual mode and generate Tcl
bin/hitestbot-eda "enable manual mode, then generate a timing report Tcl"

# Step 2: Approve the pending Tcl
# HiTestBot presses: prefix+y (Ctrl+B, then y)

# Step 3: Verify execution
# HiTestBot waits for EDA completion and QoR output
```

### Manual Mode Scoring

| Step | Verification | Evidence |
|------|--------------|----------|
| 1 | Command typed and acknowledged | Status bar shows `MODE: MANUAL` |
| 2 | Tcl pending state | Left pane shows `[⏳ Pending Approval]` badge |
| 3 | Approval sent | HiTestBot sends `Ctrl+B` then `y` via tmux |
| 4 | EDA executes AFTER approval | Timestamp: EDA activity after `prefix+y` sent |
| 5 | QoR reported | WNS/TNS numbers in Claude output |

### Critical Checks

**L3: Approval Gate Verification**
- MCP log MUST show `awaiting_approval` state before `send_to_terminal`
- Tcl MUST NOT execute before `prefix+y` is pressed

**L4: Execution Timing**
- EDA activity MUST start after approval timestamp
- No premature execution in EDA pane

### Status Bar Verification

| State | Expected Status Bar |
|-------|---------------------|
| Initial | `MODE: AUTO` |
| After manual cmd | `MODE: MANUAL` |
| Tcl pending | `MODE: MANUAL \| PENDING` |
| Executing | `MODE: MANUAL \| RUNNING` |
| Complete | `MODE: MANUAL` |

---

## 6.11 Phase 0.5: Heartbeat System & Clean Environment Testing (New in v1.3)

### Heartbeat System Testing

Tests MUST verify the event-driven heartbeat monitoring system is working correctly.

**Heartbeat File Location:** `/tmp/hipilot-{session}-heartbeat.json`

**Test Sequence:**

| Step | Action | Verification | Evidence |
|------|--------|--------------|----------|
| 1 | Start test | Verify no stale heartbeat exists | `ls /tmp/hipilot-*-heartbeat.json` fails |
| 2 | Launch HiPilot | Start EDA operation that uses `await_idle` | run_log.txt shows launch |
| 3 | Check heartbeat created | Heartbeat file exists with recent timestamp | File mtime > test start time |
| 4 | Monitor state changes | Heartbeat shows `running` → `waiting` → `idle` | JSON state transitions logged |
| 5 | Complete test | Heartbeat shows `complete` or `idle` | Final state recorded |
| 6 | Check stats | HiTestBot reports heartbeat stats | `heartbeat_wakeups: N` in results |

**Pass Criteria:**
- Heartbeat file created during test (not from previous run)
- State transitions logged in heartbeat file
- HiTestBot uses reduced polling (5s vs 1-2s) when heartbeat available
- Heartbeat wakeups count > 0 for tests with EDA activity

**Failure Modes:**

| Failure | Symptom | Detection |
|---------|---------|-----------|
| Stale heartbeat | Heartbeat timestamp < test start time | Freshness validation fails |
| No heartbeat emission | No heartbeat file created during test | File check fails |
| Heartbeat not consumed | HiTestBot uses fast polling (1-2s) throughout | run_log.txt shows short intervals |
| Stuck heartbeat | State frozen at `running` despite EDA complete | State change timeout |

### Clean Environment Verification

Tests MUST verify no contamination from previous test runs.

**Pre-Test Cleanup Checklist:**

```bash
# 1. Kill stale EDA processes
pkill -f innovus; pkill -f dc_shell; pkill -f pt_shell

# 2. Remove stale heartbeat files
rm -f /tmp/hipilot-*-heartbeat.json

# 3. Kill old tmux sessions
tmux -L hipilot kill-server 2>/dev/null || true

# 4. Clean temp directories
rm -rf /tmp/hipilot-${USER}/

# 5. Verify clean state
ls /tmp/hipilot-*-heartbeat.json 2>&1  # Should fail
ls /tmp/hipilot-${USER}/ 2>&1          # Should fail
tmux -L hipilot list-sessions 2>&1     # Should fail
```

**Freshness Validation:**

All output files must pass freshness validation:

```javascript
function validateFreshness(file, testStartTime) {
  const stats = fs.statSync(file);
  const createTime = stats.birthtimeMs;

  // 5-second buffer for filesystem precision
  if (createTime < testStartTime - 5000) {
    return {
      valid: false,
      error: 'STALE_EVIDENCE',
      file: file,
      ageMinutes: Math.round((testStartTime - createTime) / 60000)
    };
  }
  return { valid: true };
}
```

**Contamination Detection:**

| Contamination | Detection | Action |
|---------------|-----------|--------|
| Stale heartbeat | File exists before test starts | Delete and log warning |
| Existing GDS | `*.gds` in work directory | Fail test - unclean state |
| Existing checkpoints | `*.enc` files present | Delete or use new timestamp |
| Running EDA | `pgrep innovus` returns PID | Kill processes before test |
| Old tmux | `tmux -L hipilot list-sessions` succeeds | Kill server before test |

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

#### Gold Certification (Full RTL-to-GDS Flow)

The RTL-to-GDS Flow Certification is considered **Gold** when:

- [ ] All 10 stages complete (score ≥ 3.5 each, adjusted for long-running flows)
- [ ] GDS file > 10MB created during test window (verified via server timestamps)
- [ ] Final checkpoint (chip_done.enc) exists
- [ ] Timing closure achieved: WNS ≥ 0 (or within signoff tolerance)
- [ ] No `HIPILOT_BUG` failures in any stage
- [ ] AI used MCP tools (L3 ≥ 0.5)
- [ ] Complete evidence bundle with video or timeline

**Phase 7 Gold Example (Test 20260304035335):**
```
Score: 3.5/5.0 (adjusted from 2.5 due to evidence verification)
Stages: 9/9 complete (single Innovus session)
GDS: 19MB (fresh creation during test)
WNS: +0.136 ns (positive slack, timing met)
TNS: 0.000 ns
Violating Paths: 0
Duration: 7203s (2 hours)
Status: GOLD CERTIFIED ✓
```

#### Platinum Certification (3 Consecutive Passes)

For **Platinum** certification:
- [ ] 3 consecutive Gold certifications
- [ ] All runs within 10% of target runtime
- [ ] Consistent QoR (WNS variation < 20%)
- [ ] No environment-related failures

---

### Legacy Graduation Criteria (Pre-v1.1)

The following criteria applied to earlier test phases:

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

---

## Appendix H: 5-Agent Team Mode Testing (NEW)

### H.1 Team Architecture

HiPilot v0.8.0+ uses a 5-Agent Team as the default architecture:

- Supervisor: Flow coordination
- Knowledge: Owns all 3 brains (hub)
- Planner: Strategy via Knowledge
- Executor: Tcl via Knowledge
- Archivist: Records via Knowledge

Hub-and-Spoke: All agents communicate through Knowledge Agent only.

### H.2 Team-Specific Test Requirements

Agent Pane Creation: 6 panes (5 agents + EDA)
Knowledge Hub: All queries route through Knowledge
Agent Communication: Hub-and-spoke pattern
Brain Ownership: Knowledge owns all 3 brains
QoR Recording: Archivist - Knowledge - Project-Brain

### H.3 Testing Team Mode

HiTestBot tests Team Mode by launching bin/hipilot (default), verifying 6 panes, typing in Supervisor pane, observing coordination.

#### Agent Activation Verification

HiTestBot MUST verify all 5 agents activate when a mission pack driven command is issued:

| Verification | Method | Expected Evidence |
|--------------|--------|-------------------|
| Supervisor active | `tmux capture-pane -t 0.0` | Text contains "Supervisor:" or "Supervisor Agent" |
| Knowledge active | `tmux capture-pane -t 0.0` | Text contains "Knowledge:" or "Knowledge Agent" |
| Planner active | `tmux capture-pane -t 0.0` | Text contains "Planner:" or "Planner Agent" |
| Executor active | `tmux capture-pane -t 0.0` | Text contains "Executor:" or "Executor Agent" |
| Archivist active | `tmux capture-pane -t 0.0` | Text contains "Archivist:" or "Archivist Agent" |

#### Hub-and-Spoke Communication Verification

| Test | Expected Behavior | Anti-Pattern |
|------|-------------------|--------------|
| Planner queries flow | Planner → Knowledge → ASIC-Brain | ❌ Planner calling ASIC-Brain directly |
| Executor gets Tcl | Executor → Knowledge → ASIC-Brain | ❌ Executor generating Tcl without Knowledge |
| Archivist records QoR | Archivist → Knowledge → Project-Brain | ❌ Archivist writing to disk directly |
| Supervisor coordinates | Supervisor → Knowledge (status queries) | ❌ Supervisor controlling agents directly |

#### Agent Coordination Test Commands

```bash
# Test mission pack loading and agent coordination
bin/hitestbot-eda "load the mission pack and show me what flow stages are defined"

# Expected agent sequence in pane 0.0:
# 1. Supervisor: "Validating mission pack..."
# 2. Knowledge: "Loading mission pack for ibex_core..."
# 3. Planner: "Created execution plan for 10 stages..."
# 4. Executor: "Standing by for stage execution..."
# 5. Archivist: "QoR tracking initialized..."

# Test full agent-driven flow
bin/hitestbot-eda "execute the complete RTL2GDS flow from the mission pack"

# Expected: All 5 agents coordinate through flow execution
# - Supervisor validates each stage prerequisite
# - Knowledge provides tool commands and recipes
# - Planner adapts strategy based on QoR feedback
# - Executor runs Tcl and monitors output
# - Archivist records QoR after each stage
```

#### Agent Failure Detection

| Failure Mode | Symptom | Detection Method |
|--------------|---------|------------------|
| Agent not activating | Missing agent name in pane output | Regex pattern matching on capture-pane |
| Direct agent-to-agent communication | Message from one agent to another without Knowledge | Check for "Agent X → Agent Y" patterns |
| Brain access bypass | Tool commands without Knowledge query | Check MCP logs for direct brain access |
| Agent deadlock | Flow stuck, no progress for >10 min | Timeout detection with state checking |

### H.4 5-Agent Team Scoring

When testing 5-Agent Team mode, HiTestBot scores:

| Layer | Criteria | Score |
|-------|----------|-------|
| L1 (Response) | Command typed, Supervisor responds | 1.0 if "Supervisor:" visible |
| L2 (Understanding) | Mission pack keywords present | 1.0 if all keywords found |
| L3 (Tool Use) | Knowledge queries via MCP | 1.0 if `knowledge.query` calls detected |
| L3b (Agent Coord) | ≥4 agents activated | 1.0 if 5 agents, 0.8 if 4, 0.5 if 3, 0 if <3 |
| L4 (Execution) | Mission pack parsed, stages extracted | 1.0 if all 10 stages identified |
| L5 (QoR Tracking) | Archivist recorded QoR vs targets | 1.0 if gap analysis generated |

### H.5 Certification Tiers for Agentic Flows

| Tier | Requirements | Evidence |
|------|--------------|----------|
| **PLATINUM** | All 10 stages complete, GDS exported, timing closed, QoR targets met, all 5 agents coordinated | 5 agents active in logs, gap analysis shows targets met |
| **GOLD** | All 10 stages complete, GDS exported, timing closed | 10 .enc files, GDS >10MB, WNS ≥ 0 |
| **SILVER** | 8-9 stages complete, GDS exported | 8-9 .enc files, GDS exists |
| **BRONZE** | 5-7 stages complete | 5-7 .enc files |
| **FAIL** | <5 stages complete or agents don't coordinate | <5 .enc files or <3 agents active |
