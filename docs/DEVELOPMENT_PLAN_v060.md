# HiPilot v0.6.0 Development Plan

**Goal:** Close the gap between current implementation and the ultimate goal — Claude Code autonomously driving a complete RTL-to-GDS flow using MCP tools and skills.

**Current state (v0.5.0 → v0.6.0-dev):** 3 MCP servers (64 tools), 35 skills, 20 templates. Phases 1-4 implemented, HiTestBot v2 built.

**Target state (v0.6.0):** Claude Code can reliably execute a multi-stage EDA flow, with proper system context, debuggable MCP logging, a working feedback loop, and real workflow execution.

> **Implementation Status:** Phases 1-4 are COMPLETE. HiTestBot v2 is COMPLETE. Pending: real EDA server validation.

---

## Gap Analysis

| What's needed | Current state | Gap |
|--------------|---------------|-----|
| Claude knows it's HiPilot and how to use MCP tools | No system prompt, no MCP config in project | **Missing entirely** |
| MCP calls are logged for debugging | No logging infrastructure | **Missing entirely** |
| Execute Tcl → automatically get results back | Separate disconnected tools, Claude must orchestrate | **Fragile, depends on LLM** |
| Multi-stage flow execution | `workflow.run` is a stub (creates JSON, doesn't execute) | **Stub, not functional** |
| Test results show what happened at MCP layer | No MCP visibility in test evidence | **Blocked by logging gap** |

---

## Development Phases

### Phase 1: System Prompt & MCP Configuration
**Priority:** P0 — Without this, Claude doesn't know how to use HiPilot
**Effort:** Small (1-2 days)
**Risk:** Low

#### 1.1 Create `.claude/settings.json` with MCP server registration

Register all 3 MCP servers so Claude Code auto-connects on startup.

```json
{
  "permissions": {
    "allow": [
      "mcp__hipilot-eda__*",
      "mcp__hipilot-tmux__*",
      "mcp__hipilot-knowledge__*"
    ]
  },
  "mcpServers": {
    "hipilot-eda": {
      "command": "node",
      "args": ["servers/eda/index.js"],
      "env": { "HIPILOT_SESSION": "hipilot" }
    },
    "hipilot-tmux": {
      "command": "node",
      "args": ["servers/tmux/index.js"],
      "env": { "HIPILOT_SESSION": "hipilot" }
    },
    "hipilot-knowledge": {
      "command": "node",
      "args": ["servers/knowledge/index.js"]
    }
  }
}
```

**Note:** On the EDA server (CentOS 7), these need absolute paths in user-level `~/.claude/settings.json`. Project-level can use relative paths for development.

#### 1.2 Create HiPilot system prompt in CLAUDE.md

Add a dedicated section that Claude Code reads on every session start. This is different from the developer context — it's the **operational instructions** for when Claude is acting as the HiPilot copilot.

The system prompt must tell Claude:

1. **Identity:** You are HiPilot, a VLSI Physical Design copilot
2. **Tools:** Use `eda.*`, `tmux.*`, `knowledge.*` MCP tools — NEVER use direct bash/tmux commands to interact with EDA tools
3. **Pattern:** For every EDA operation: generate → send → wait → capture → analyze → report
4. **Mode:** Check `eda.get_status` before any EDA operation to understand current mode
5. **Safety:** Manual mode requires approval. Never skip risk warnings.
6. **Skills:** Use `knowledge.match_skill` to find relevant skills before starting a task
7. **Context:** Use `session.get_context` and `context.detect` to understand current design state
8. **Errors:** When EDA reports errors, use `eda.diagnose_error` before retrying

#### 1.3 Verification

- Start Claude Code in the HiPilot project directory
- Verify MCP servers auto-connect (Claude mentions hipilot tools in response)
- Test: ask Claude "what is the current EDA status?" — should call `eda.get_status`
- Test: ask Claude "list skills" — should call `knowledge.list_skills`

---

### Phase 2: MCP Call Logging
**Priority:** P0 — Without this, can't debug any test failure
**Effort:** Small-Medium (2-3 days)
**Risk:** Low

#### 2.1 Add logging infrastructure to all 3 MCP servers

When `HIPILOT_TEST_LOG` environment variable is set, log every tool call to that file path.

**Implementation in each server's tool handler:**

```javascript
function logMcpCall(server, tool, args, status, durationMs, meta = {}, error = null) {
  const logPath = process.env.HIPILOT_TEST_LOG;
  if (!logPath) return;
  
  const entry = {
    ts: new Date().toISOString(),
    server,
    tool,
    args,
    status,
    duration_ms: durationMs,
    ...(error && { error }),
    ...(Object.keys(meta).length > 0 && { meta }),
  };
  
  appendFileSync(logPath, JSON.stringify(entry) + '\n');
}
```

**Log every tool call:** Wrap each case in the switch statement with timing and logging.

#### 2.2 Add logging to EDA MCP server (28 eda.* + 5 session.* + 3 context.* + 4 qor.* + 5 workflow.* + 3 suggest.*)

For `eda.generate_tcl`, log includes metadata:
```jsonl
{"ts":"...","server":"eda","tool":"generate_tcl","args":{"intent":"...","operation":"fix_setup_timing"},"status":"ok","duration_ms":127,"meta":{"template":"synopsys/icc2_fix_setup_timing.tcl","badge":"[✓ Template]"}}
```

For `eda.send_to_terminal`, log includes mode decision:
```jsonl
{"ts":"...","server":"eda","tool":"send_to_terminal","args":{"tcl":"source /tmp/..."},"status":"ok","duration_ms":45,"meta":{"mode":"auto","risk_category":1}}
```

#### 2.3 Add logging to Tmux MCP server (8 tools)

#### 2.4 Add logging to Knowledge MCP server (7 tools)

#### 2.5 Verification

- Set `HIPILOT_TEST_LOG=/tmp/test_mcp.jsonl`
- Run a sequence of MCP calls manually (pipe JSON-RPC)
- Verify log file contains all calls with correct timestamps and metadata
- Verify no logging when env var is not set (zero overhead in production)

---

### Phase 3: Feedback Loop — `execute_and_verify`
**Priority:** P0 — The core reliability improvement
**Effort:** Medium (3-4 days)
**Risk:** Medium

#### 3.1 Implement `eda.execute_and_verify` tool

A single tool that replaces the fragile 4-step pattern Claude currently has to orchestrate manually:

```
Current (fragile):          New (reliable):
1. send_to_terminal         1. execute_and_verify
2. wait_for_prompt             (does all 4 internally)
3. capture_and_analyze
4. extract_qor
```

**Input:**
```json
{
  "tcl": "source /tmp/hipilot_generated_001.tcl",
  "timeout": 120,
  "expect_qor": true,
  "description": "CTS stage of RTL-to-GDS flow"
}
```

**Implementation:**
1. Risk analysis on Tcl
2. Mode check (queue if manual, execute if auto)
3. Write temp file, tmux send-keys
4. Poll for EDA prompt return (with timeout)
5. Capture pane output
6. Detect errors in output (regex patterns for ERROR, FATAL, etc.)
7. Extract QoR if requested
8. Return structured result

**Output:**
```json
{
  "status": "success|error|timeout|pending_approval",
  "execution_time_s": 45.2,
  "output_lines": 150,
  "errors_detected": [],
  "warnings_detected": ["WARN-042: 3 unplaced cells"],
  "qor": {
    "wns": -0.15,
    "tns": -12.3,
    "violations": 47
  },
  "output_summary": "CTS completed. Clock tree built with 234 buffers.",
  "captured_output": "... last 50 lines ..."
}
```

**Why this matters:** Claude calls ONE tool and gets back a structured result that tells it: did it work, what's the QoR, were there errors. No more "forgot to call wait_for_prompt" or "captured output too early."

#### 3.2 Add `eda.run_stage` tool (optional, builds on execute_and_verify)

Higher-level tool for flow stage execution:

```json
{
  "stage": "cts",
  "tool": "innovus",
  "params": {}
}
```

Implementation:
1. Load the stage's skill via `knowledge.get_skill`
2. Generate Tcl via `eda.generate_tcl`
3. Call `execute_and_verify` internally
4. Save QoR snapshot
5. Return stage result with before/after QoR comparison

#### 3.3 Verification

- Call `execute_and_verify` with a simple Tcl command (`puts "hello"`) against running Innovus
- Call with a failing command (typo) — verify error detection
- Call with timeout shorter than execution — verify timeout handling
- Call in manual mode — verify `pending_approval` status returned

---

### Phase 4: Workflow Execution
**Priority:** P1 — Enables the RTL-to-GDS flow
**Effort:** Medium-Large (4-5 days)
**Risk:** Medium

#### 4.1 Implement real `workflow.run`

Replace the current stub with actual step execution.

**Design:**

```javascript
async function runWorkflow(workflow, params) {
  const run = createRun(workflow, params);
  
  for (const step of workflow.steps) {
    updateRunStatus(run, step, 'running');
    
    try {
      // Generate Tcl for this step
      const tcl = await generateTclForStep(step, params);
      
      // Execute and verify
      const result = await executeAndVerify(tcl, step.timeout || 120);
      
      // Check result
      if (result.status === 'error') {
        if (step.on_failure === 'skip') {
          updateRunStatus(run, step, 'skipped', result);
          continue;
        } else if (step.on_failure === 'retry') {
          // Retry once
          const retry = await executeAndVerify(tcl, step.timeout || 120);
          if (retry.status === 'error') {
            updateRunStatus(run, step, 'failed', retry);
            break;
          }
        } else {
          updateRunStatus(run, step, 'failed', result);
          break; // default: stop
        }
      }
      
      // Save QoR checkpoint
      if (result.qor) {
        saveQorSnapshot(step.name, result.qor);
      }
      
      updateRunStatus(run, step, 'completed', result);
      
    } catch (err) {
      updateRunStatus(run, step, 'error', { error: err.message });
      break;
    }
  }
  
  finalizeRun(run);
  return run;
}
```

**Key design decisions:**
- Workflows execute synchronously (step by step) within a single MCP call — this is intentional because MCP calls can be long-running and the workflow needs sequential execution
- Each step uses `execute_and_verify` (Phase 3) for reliable execution
- Error handling per step: `stop` (default), `skip`, or `retry`
- QoR captured at each step for progress tracking
- Run status updated after each step (observable via `workflow.get_status`)

#### 4.2 Define built-in RTL-to-GDS workflow

Replace the current placeholder with a real workflow:

```json
{
  "name": "ibex_rtl2gds",
  "description": "Complete RTL-to-GDS flow for Ibex design",
  "steps": [
    {
      "name": "init",
      "operation": "read_design",
      "tcl_source": "skill:design-init",
      "timeout": 120,
      "success_check": "design loaded|init_design",
      "on_failure": "stop"
    },
    {
      "name": "floorplan",
      "operation": "floorplan",
      "tcl_source": "skill:floorplan",
      "timeout": 120,
      "success_check": "floorPlan|floorplan",
      "on_failure": "stop"
    },
    {
      "name": "power",
      "tcl_source": "skill:power-planning",
      "timeout": 120,
      "on_failure": "stop"
    },
    {
      "name": "placement",
      "tcl_source": "skill:placement",
      "timeout": 300,
      "success_check": "place_opt_design|placeDesign",
      "on_failure": "stop"
    },
    {
      "name": "cts",
      "tcl_source": "skill:cts",
      "timeout": 300,
      "success_check": "ccopt_design|clock_opt",
      "on_failure": "stop"
    },
    {
      "name": "post_cts_opt",
      "tcl_source": "skill:post-cts-opt",
      "timeout": 300,
      "on_failure": "stop"
    },
    {
      "name": "routing",
      "tcl_source": "skill:route-design",
      "timeout": 600,
      "success_check": "routeDesign|route_auto",
      "on_failure": "stop"
    },
    {
      "name": "route_opt",
      "tcl_source": "skill:routing-opt",
      "timeout": 300,
      "on_failure": "skip"
    },
    {
      "name": "chip_done",
      "tcl_source": "skill:chip-finish",
      "timeout": 300,
      "on_failure": "stop"
    },
    {
      "name": "signoff",
      "tcl_source": "skill:sta",
      "timeout": 300,
      "on_failure": "stop"
    }
  ]
}
```

#### 4.3 Verification

- Define a simple 2-step test workflow (init + report timing)
- Run it against Innovus on EDA server
- Verify: both steps execute, QoR captured, run status shows completion
- Test error handling: introduce a typo in step 2, verify step 2 fails but step 1 result preserved

---

### Phase 5: HiTestBot Integration
**Priority:** P1 — Validates everything above
**Effort:** Medium (3-4 days)
**Risk:** Low

#### 5.1 Add MCP log collection to E2ETestRunner

Set `HIPILOT_TEST_LOG` before starting MCP servers. Collect the log file as part of evidence.

#### 5.2 Implement `StageVerifier` class

Per the TESTING_RULES.md specification — collects 5-layer evidence for each flow stage:

```javascript
class StageVerifier {
  async verifyStage(stageName, stageResult) {
    return {
      stage: stageName,
      scores: {
        L1_prompt_delivery: this.scorePromptDelivery(),
        L2_intent_recognition: this.scoreIntentRecognition(),
        L3_mcp_tool_usage: this.scoreMcpUsage(),    // reads MCP log
        L4_eda_execution: this.scoreEdaExecution(),
        L5_qor_assessment: this.scoreQorAssessment(),
      },
      evidence: { ... },
      failure_classification: this.classifyFailure(),
    };
  }
}
```

#### 5.3 Update `RTL2GDSFlowTest` to use new infrastructure

- Use `workflow.run` instead of manual prompt orchestration
- Collect MCP logs as evidence
- Use `StageVerifier` for per-stage scoring
- Generate `FLOW_REPORT.md` per TESTING_RULES.md format

#### 5.4 Verification

- Run the updated RTL-to-GDS flow test
- Verify FLOW_REPORT.md is generated with proper scoring
- Verify MCP log evidence is included
- Verify failure classification is correct when stages fail

---

## Implementation Order & Dependencies

```
Phase 1: System Prompt        Phase 2: MCP Logging
(no dependencies)              (no dependencies)
    │                              │
    └──────────┬───────────────────┘
               │
         Phase 3: execute_and_verify
         (uses MCP logging for debug)
               │
         Phase 4: Workflow Execution
         (uses execute_and_verify)
               │
         Phase 5: HiTestBot Integration
         (uses MCP logging + workflow.run)
```

Phases 1 and 2 can be done in parallel. Phases 3-5 are sequential.

---

## Success Criteria for v0.6.0

### Must Have (release blockers)

- [ ] Claude Code auto-connects to HiPilot MCP servers on startup
- [ ] Claude Code uses MCP tools (not direct bash) for EDA operations
- [ ] Every MCP call is logged when `HIPILOT_TEST_LOG` is set
- [ ] `execute_and_verify` reliably sends Tcl, waits, captures, and returns structured results
- [ ] `workflow.run` executes steps sequentially with error handling
- [ ] Built-in `ibex_rtl2gds` workflow definition exists

### Should Have

- [ ] `run_stage` tool for single-stage execution
- [ ] `StageVerifier` class for flow certification scoring
- [ ] Updated `RTL2GDSFlowTest` using new infrastructure
- [ ] `FLOW_REPORT.md` generation with per-stage scores

### Nice to Have

- [ ] Observer review tool for AI-based evidence analysis
- [ ] Progress dashboard across test runs
- [ ] MCP log viewer/analyzer utility

---

## Estimated Timeline

| Phase | Effort | Can Parallel |
|-------|--------|-------------|
| Phase 1: System Prompt | 1-2 days | Yes (with Phase 2) |
| Phase 2: MCP Logging | 2-3 days | Yes (with Phase 1) |
| Phase 3: Feedback Loop | 3-4 days | No (needs Phase 2) |
| Phase 4: Workflow Execution | 4-5 days | No (needs Phase 3) |
| Phase 5: HiTestBot Integration | 3-4 days | No (needs Phase 2+4) |
| **Total** | **~2-3 weeks** | |

---

## What v0.6.0 Enables

After v0.6.0, the testing flow becomes:

```
1. Start Claude Code in HiPilot project
   → Auto-connects to MCP servers (Phase 1)
   → Knows it's HiPilot, knows the tool usage pattern

2. Ask: "Run RTL-to-GDS flow on Ibex"
   → Claude calls workflow.run("ibex_rtl2gds")  (Phase 4)
   → Workflow executes each stage via execute_and_verify (Phase 3)
   → Each stage: generate Tcl → send → wait → capture → check

3. Watch progress
   → Claude reports stage completion as workflow progresses
   → QoR tracked at each stage
   → Errors detected and reported with diagnosis

4. Review results
   → MCP call log shows exactly what happened (Phase 2)
   → FLOW_REPORT.md with per-stage scores (Phase 5)
   → Evidence bundle for observer review
```

This is the minimum viable path to proving the north star: **AI Agent driving RTL-to-GDS autonomously.**

---

**Version:** 1.0
**Date:** 2026-02-25
