# HiTestBot v2 — Evidence-Based Testing Framework

**Goal:** HiTestBot v2 tests HiPilot like a human engineer would — by correlating logs, screenshots, and video, and producing diagnostic reports that expose problems and track improvement, not just say PASS/FAIL.

---

## What's Wrong with HiTestBot v1

### Problem 1: Grep-based assertions
v1 captures tmux pane output and greps for keywords. If the keyword appears → PASS. If not → FAIL. This misses:
- Claude using the right tool but with wrong parameters
- Correct output in a different format than expected
- Errors that happen before or after the captured window
- The sequence and timing of events

### Problem 2: No MCP visibility
v1 can't see what MCP tools were called, with what arguments, or what they returned. When a test fails, you can't tell if Claude called the right tool but got an error, or if Claude never called the tool at all.

### Problem 3: Binary results
v1 reports PASS/FAIL per step. A test that gets through 7/10 stages and fails on stage 8 looks the same as a test that fails on stage 1. No progress tracking, no trend analysis.

### Problem 4: No correlation
v1 captures logs, screenshots, and video independently but never correlates them. A human reviewing the evidence has to manually match timestamps across artifacts.

### Problem 5: No independent review
v1 is both the executor and the judge. There's no "second pair of eyes" that reviews the raw evidence and forms an independent opinion.

---

## HiTestBot v2 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          HiTestBot v2                                │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Test Executor    │  │  Evidence         │  │  Analyzer        │   │
│  │                   │  │  Collector        │  │                  │   │
│  │  - Run workflows  │  │                   │  │  - Score layers  │   │
│  │  - Send prompts   │  │  - MCP call log   │  │  - Classify      │   │
│  │  - Observation    │  │  - Pane captures  │  │    failures      │   │
│  │    points         │  │  - Screenshots    │  │  - Compare runs  │   │
│  │  - Timeline       │  │  - Video          │  │  - Generate      │   │
│  │    events         │  │  - QoR snapshots  │  │    FLOW_REPORT   │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                      │                      │             │
│           └──────────────────────┼──────────────────────┘             │
│                                  │                                    │
│                         ┌────────▼─────────┐                         │
│                         │  Evidence Bundle   │                        │
│                         │                    │                        │
│                         │  Self-contained    │                        │
│                         │  directory with    │                        │
│                         │  all artifacts     │                        │
│                         └────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## New Components

### 1. McpLogCollector

Reads the JSONL log produced by the MCP servers (Phase 2 infrastructure) and provides structured access to tool calls.

```javascript
class McpLogCollector {
  constructor(logPath) { ... }

  // Get all calls for a time range (for a specific stage)
  getCallsInRange(startTime, endTime) → McpCall[]

  // Get calls by tool name
  getCallsByTool(toolName) → McpCall[]

  // Check if a specific tool was called with expected args
  wasToolCalled(toolName, expectedArgs) → { called, call, match_quality }

  // Get the sequence of tools called (for pattern matching)
  getToolSequence() → string[]   // e.g., ['generate_tcl', 'execute_and_verify', 'qor.snapshot']

  // Summary statistics
  getStats() → { total_calls, by_server, by_status, total_duration_ms }
}
```

**Why this matters:** This is the Layer 3 (MCP Tool Usage) evidence source from TESTING_RULES.md. Without it, we're blind to what happened inside the MCP layer.

### 2. ObservationPoint

Captures a synchronized snapshot across all evidence streams at a defined moment.

```javascript
class ObservationPoint {
  static async capture(name, context) {
    return {
      name,                    // e.g., 'STAGE_COMPLETE'
      timestamp: Date.now(),
      video_offset_s: ...,     // seconds since recording started
      claude_pane: await capturePaneSafe('chat'),
      eda_pane: await capturePaneSafe('eda'),
      screenshot_path: await takeScreenshot(name),
      mcp_calls_since_last: ...,  // MCP calls since previous observation
      context,                 // custom data (stage name, QoR, etc.)
    };
  }
}
```

**Why this matters:** This is the Three-View Correlation mechanism from TESTING_RULES.md Section 6.3. Every observation point creates a "bookmark" that an observer (human or AI) can jump to and see all three views at once.

### 3. StageVerifier

Evaluates a single flow stage across all 5 evidence layers.

```javascript
class StageVerifier {
  constructor(mcpLog, observations) { ... }

  async verify(stageName, stageConfig) {
    return {
      stage: stageName,
      score: {
        L1_prompt_delivery:    this.scorePromptDelivery(observations),
        L2_intent_recognition: this.scoreIntentRecognition(observations, mcpLog),
        L3_mcp_tool_usage:     this.scoreMcpUsage(mcpLog, stageConfig.expected_tools),
        L4_eda_execution:      this.scoreEdaExecution(observations, mcpLog),
        L5_qor_assessment:     this.scoreQorAssessment(observations, mcpLog),
      },
      total_score: ...,   // sum of all layers (max 5.0)
      status: ...,        // 'pass' (≥4.0), 'partial' (≥2.0), 'fail' (<2.0)
      evidence: { ... },  // raw evidence for each layer
      failure_classification: this.classifyFailure(...),  // HIPILOT_BUG | AI_BEHAVIOR | ENVIRONMENT
    };
  }
}
```

**Scoring logic per layer:**

| Layer | Score 1.0 | Score 0.5 | Score 0.0 |
|-------|-----------|-----------|-----------|
| L1 | Claude pane shows response to prompt | Response but unclear if it understood | No response or wrong prompt |
| L2 | MCP log shows correct skill matched or correct operation used | Related skill/operation but not optimal | Wrong skill or no skill matching |
| L3 | Expected MCP tools called with correct args | Right tools, wrong args or extra tools | No MCP tools or used bash/tmux directly |
| L4 | EDA pane shows command completed without errors | Completed with warnings | Errors or timeout or command not sent |
| L5 | QoR metrics extracted and reported | Partial metrics (WNS but not TNS) | No QoR captured |

### 4. FlowCertifier

Orchestrates a complete flow test, using StageVerifier for each stage. Produces the FLOW_REPORT.md.

```javascript
class FlowCertifier extends TestRunner {
  constructor(options) {
    super(options);
    this.mcpLog = new McpLogCollector(logPath);
    this.stages = [];
    this.observations = [];
  }

  async runFlow(workflowName, params) {
    // Start MCP logging
    // Start video recording
    // Start Claude Code + EDA tool via tmux

    // Send the workflow command to Claude
    await this.sendPrompt(`Run the ${workflowName} workflow`);

    // Or: call workflow.run directly via MCP wrapper
    // await this.callMcp('workflow.run', { name: workflowName });

    // Observe at regular intervals and after each stage
    while (workflow is running) {
      await this.observe('STAGE_CHECK');
      // Detect stage transitions from pane output / MCP log
      // When stage changes, capture STAGE_COMPLETE observation
    }

    // After flow completes (or times out):
    // 1. Collect all MCP logs
    // 2. Score each stage with StageVerifier
    // 3. Generate FLOW_REPORT.md
    // 4. Save evidence bundle
  }
}
```

### 5. FlowReporter

Generates the FLOW_REPORT.md per TESTING_RULES.md format, plus machine-readable `flow_progress.json`.

```javascript
class FlowReporter {
  generate(stageResults, mcpStats, observations, metadata) {
    return {
      markdown: this.generateMarkdown(...),   // FLOW_REPORT.md
      json: this.generateJson(...),           // flow_progress.json
      scorecards: this.generateScorecards(...), // stage_scorecards.json
    };
  }
}
```

### 6. ProgressTracker

Reads `flow_progress.json` files across multiple runs and produces the improvement trend.

```javascript
class ProgressTracker {
  addRun(flowProgressJson) { ... }

  getTrend() {
    // Returns:
    // Date        Progress   Score   Blocking Stage   Category
    // 2026-02-25  4/10 (40%) 20.5/50 CTS              AI_BEHAVIOR
    // 2026-02-26  6/10 (60%) 30.0/50 Routing           ENVIRONMENT
  }
}
```

---

## Test Execution Modes

### Mode 1: Workflow-Driven (Recommended)

HiTestBot tells Claude to run a workflow, then observes and scores the result.

```
HiTestBot → Claude: "Run the rtl2gds workflow"
         → Claude calls workflow.run("rtl2gds")
         → Workflow executes 8 steps automatically
         → HiTestBot captures MCP log + pane output at each stage
         → StageVerifier scores each stage
         → FlowReporter generates FLOW_REPORT.md
```

This tests the full pipeline: system prompt → MCP tools → workflow engine → EDA execution.

### Mode 2: Prompt-Driven (For AI behavior testing)

HiTestBot sends natural language prompts (one per stage), observing how Claude handles each step independently. Tests whether Claude picks the right tools and sequence.

```
HiTestBot → Claude: "Initialize the Ibex design in Innovus"
         → Observe: did Claude call knowledge.match_skill? eda.generate_tcl?
         → Score L1-L5

HiTestBot → Claude: "Run floorplanning"
         → Observe: did Claude call the right tools?
         → Score L1-L5
```

### Mode 3: MCP-Direct (For infrastructure testing)

HiTestBot calls MCP tools directly via the wrapper script, bypassing Claude Code entirely. Tests whether the MCP infrastructure works independent of AI behavior.

```
HiTestBot → MCP: workflow.run("rtl2gds")
         → Check: each step executed, QoR captured, errors detected
         → No AI in the loop — pure infrastructure test
```

---

## Evidence Bundle Structure

```
evidence/20260225_103045/
├── FLOW_REPORT.md                  # Human-readable report
├── flow_progress.json              # Machine-readable progress
├── stage_scorecards.json           # All stage scores
├── observation_points.jsonl        # Timeline of observations
├── mcp_calls.jsonl                 # Full MCP log for this test
├── video.mp4                       # Session recording
├── video_timestamps.json           # Observation → video offset mapping
│
├── stage_01_init/
│   ├── obs_stage_start.png         # Screenshot at stage start
│   ├── obs_stage_start_claude.log  # Claude pane at start
│   ├── obs_stage_start_eda.log     # EDA pane at start
│   ├── obs_stage_complete.png      # Screenshot at completion
│   ├── obs_stage_complete_claude.log
│   ├── obs_stage_complete_eda.log
│   ├── generated.tcl               # Tcl that was generated
│   └── scorecard.json              # 5-layer score for this stage
│
├── stage_02_floorplan/
│   └── ...
│
└── stage_05_cts/
    ├── ...
    ├── obs_on_error.png            # Screenshot at error detection
    ├── obs_on_error_eda.log        # EDA pane showing error
    ├── failure_classification.json  # HIPILOT_BUG | AI_BEHAVIOR | ENVIRONMENT
    └── scorecard.json
```

---

## File Structure

```
src/hitestbot/
├── index.js                  # Exports + CLI entry
│
├── core/                     # Core framework (v2)
│   ├── McpLogCollector.js    # Parse and query MCP JSONL logs
│   ├── ObservationPoint.js   # Synchronized multi-view capture
│   ├── StageVerifier.js      # 5-layer scoring per stage
│   ├── FlowCertifier.js      # Full flow test orchestration
│   ├── FlowReporter.js       # FLOW_REPORT.md generation
│   └── ProgressTracker.js    # Cross-run improvement tracking
│
├── infra/                    # Infrastructure (carried from v1)
│   ├── TestRunner.js         # Base class (step tracking, SSH, timing)
│   ├── TmuxController.js     # Tmux operations
│   ├── VideoRecorder.js      # ffmpeg recording
│   └── TestUtils.js          # Assertions, waits, file ops
│
├── tests/                    # Test implementations
│   ├── FlowCertificationTest.js   # Main: RTL-to-GDS flow certification
│   ├── McpInfraTest.js            # Mode 3: MCP-direct infrastructure test
│   └── ComponentTests.js          # Quick regression tests for individual tools
│
└── README.md                 # Updated documentation
```

### What happens to v1 tests?

The 12 existing tests in `tests/` are superseded by the new framework:

| v1 Test | v2 Equivalent |
|---------|---------------|
| RTL2GDSFlowTest, IbexRTL2GDSFlowTest | FlowCertificationTest (workflow-driven) |
| MCPControlTest, MCPImprovementTest, MCPRtl2GdsTest | McpInfraTest (MCP-direct) |
| QuickCommandsTest, OneShotFixTest | ComponentTests |
| AutoAnalysisTest, EvidenceOutputTest, SideEffectTest | ComponentTests |
| SkillsImprovementTest, SkillsIntegrationTest | ComponentTests |

v1 tests are not deleted immediately — they continue working as-is. v2 tests are added alongside. Once v2 is validated, v1 tests can be retired.

---

## Implementation Phases

### Phase A: Core Framework (McpLogCollector + ObservationPoint + StageVerifier)

Build the three core components that enable evidence-based scoring. These can be tested locally without an EDA server.

**McpLogCollector** — tested against sample JSONL files
**ObservationPoint** — tested against a local tmux session
**StageVerifier** — tested with mock evidence data

### Phase B: FlowCertifier + FlowReporter

Build the flow orchestration and report generation. Requires tmux session for testing.

**FlowCertifier** — runs a workflow, collects observations, calls StageVerifier
**FlowReporter** — generates FLOW_REPORT.md and flow_progress.json

### Phase C: Integration Testing

Run FlowCertificationTest against the EDA server with real Innovus. This is the first real validation of the v0.6.0 infrastructure (system prompt + MCP logging + execute_and_verify + workflow engine + HiTestBot v2).

### Phase D: ProgressTracker + Trend Analysis

Build the cross-run tracking that shows improvement over time.

---

## Key Design Decisions

### 1. MCP log is the primary evidence source

In v1, the primary evidence was grepping tmux pane output. In v2, the MCP call log is the **ground truth** — it shows exactly which tools were called, with what arguments, and what they returned. Pane output and screenshots are **corroborating evidence**, not the primary source.

### 2. Evidence bundle is self-contained

An observer (human or AI) should be able to review a test result using **only** the evidence bundle directory. No access to the test framework, no ability to re-run, no live connection to the EDA server. Everything needed for judgment is in the bundle.

### 3. Scoring is deterministic, judgment is not

The 5-layer scoring (L1-L5) is deterministic — given the same evidence, the same score is always produced. The failure classification (HIPILOT_BUG vs AI_BEHAVIOR vs ENVIRONMENT) may require judgment and can be overridden by an observer.

### 4. v1 compatibility preserved

The new `core/` directory is added alongside existing files. `TestRunner`, `TmuxController`, `VideoRecorder`, and `TestUtils` are moved to `infra/` but re-exported from `index.js` for backward compatibility. Existing v1 tests continue to work without changes.

---

**Version:** 1.0 (Draft)
**Date:** 2026-02-25
