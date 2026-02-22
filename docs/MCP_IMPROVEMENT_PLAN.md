# HiPilot MCP Improvement Plan

**Version:** 1.0  
**Date:** 2026-02-22  
**Status:** Draft  
**Goal:** Transform MCP servers from basic tools into an intelligent, autonomous foundation for HiPilot skills

---

## Executive Summary

The MCP servers are the backbone of HiPilot. This plan outlines 7 major improvement areas across 3 phases, transforming the current state (basic tools) into a future state (intelligent autonomous system).

**Current State:**
- Claude sends Tcl → EDA runs → No automatic feedback
- No memory of session history or design context
- Manual orchestration of multi-step workflows
- No QoR tracking or comparison

**Future State:**
- Autonomous feedback loop with self-correction
- Full session awareness and design context
- Automated workflow execution
- Continuous QoR improvement tracking

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Feedback Loop System

**Problem:** Claude sends Tcl, but doesn't automatically see results or know if commands succeeded.

**New Tools:**

```
eda.wait_for_pattern(pattern, timeout=60)
  - Wait for specific regex pattern in EDA output
  - Returns: { matched: bool, match: string, elapsed_ms: number }
  - Use case: Wait for "innovus 1>" prompt after command

eda.wait_for_prompt(timeout=30)
  - Wait for EDA tool prompt (tool-specific)
  - Auto-detects prompt patterns: "innovus \d+>", "icc2_shell>", "pt_shell>"
  - Returns: { ready: bool, prompt: string }

eda.get_last_result()
  - Parse last command output for success/failure
  - Returns: { success: bool, error_type: string|null, error_line: string|null, summary: string }

eda.capture_and_wait(command, wait_pattern, timeout=60)
  - Combined: send command, wait for pattern, return output
  - Returns: { output: string, success: bool, elapsed_ms: number }

tmux.wait_for_change(pane, timeout=10)
  - Wait for pane content to change
  - Returns: { changed: bool, new_lines: string[] }
```

**Success Criteria:**
- [ ] Claude can detect when EDA command completes
- [ ] Claude can parse success/failure from output
- [ ] Claude can automatically retry on transient failures

**Files to Create/Modify:**
- `servers/eda/tools/feedback.js` (new)
- `servers/tmux/tools/wait.js` (new)

---

### 1.2 Session State Tracking

**Problem:** No memory of what's been done. Every interaction starts from scratch.

**New Tools:**

```
session.save_checkpoint(name, description)
  - Save current session state
  - Stores: timestamp, last N commands, QoR snapshot, active design
  - Returns: { checkpoint_id: string, saved_at: timestamp }

session.list_checkpoints()
  - List all saved checkpoints
  - Returns: { checkpoints: [{ id, name, description, saved_at, command_count }] }

session.restore_checkpoint(checkpoint_id)
  - Restore to previous state (doesn't undo EDA changes, just context)
  - Returns: { restored: bool, state: object }

session.add_to_history(command, result_summary, success)
  - Add command to session history
  - Returns: { history_id: string }

session.get_history(limit=50)
  - Get command history with results
  - Returns: { history: [{ timestamp, command, result_summary, success }] }

session.get_context()
  - Get current session context summary
  - Returns: { design_name, tool, stage, last_command, pending_actions, qor_summary }
```

**Storage:**
- `{project}/.hipilot/session/checkpoints.json`
- `{project}/.hipilot/session/history.jsonl`
- `{project}/.hipilot/session/context.json`

**Success Criteria:**
- [ ] Can save/restore checkpoints
- [ ] Full command history is available
- [ ] Context summary helps Claude understand current state

**Files to Create/Modify:**
- `servers/knowledge/tools/session.js` (new)
- `src/lib/session-store.js` (new)

---

### 1.3 Design Context Detection

**Problem:** Claude doesn't know the design context (what design, what stage, what tool).

**New Tools:**

```
context.detect()
  - Auto-detect current design context
  - Reads from EDA output, project config, file system
  - Returns: { design_name, technology, stage, tool, corners, constraints }

context.set(context_obj)
  - Manually set context (override detection)
  - Returns: { set: bool, context: object }

context.get_stage()
  - Get current flow stage
  - Returns: { stage: "synthesis"|"floorplan"|"place"|"cts"|"route"|"signoff", confidence: number }

context.suggest_next()
  - Suggest next logical step based on stage and QoR
  - Returns: { suggestions: [{ action, reason, priority }] }

context.get_design_info()
  - Get design summary (from previous runs or config)
  - Returns: { name, tech, area, cells, nets, corners, constraints }
```

**Success Criteria:**
- [ ] Auto-detects which EDA tool is running
- [ ] Identifies current flow stage
- [ ] Can suggest logical next steps

**Files to Create/Modify:**
- `servers/eda/tools/context.js` (new)
- `src/lib/context-detector.js` (new)

---

## Phase 2: Intelligence (Week 3-4)

### 2.1 QoR Tracking & Comparison

**Problem:** No way to compare before/after or track improvement over time.

**New Tools:**

```
qor.snapshot(name)
  - Capture current QoR metrics
  - Reads timing, power, area, DRC from reports
  - Returns: { snapshot_id, metrics: { wns, tns, violations, power, area } }

qor.list_snapshots()
  - List all saved QoR snapshots
  - Returns: { snapshots: [{ id, name, timestamp, metrics }] }

qor.compare(id1, id2)
  - Compare two QoR snapshots
  - Returns: { 
      delta: { wns, tns, violations, power, area },
      improved: bool,
      summary: "WNS improved by 0.15ns, TNS reduced by 2.3ns"
    }

qor.get_trend(metric="wns", snapshots=10)
  - Show trend over last N snapshots
  - Returns: { trend: "improving"|"degrading"|"stable", data: [{ snapshot, value }] }

qor.set_target(metrics)
  - Set QoR targets
  - Returns: { targets: { wns, tns, violations }, current_gap: { wns, tns, violations } }

qor.check_target()
  - Check if targets are met
  - Returns: { met: bool, gaps: { wns: number|null, tns: number|null } }
```

**Success Criteria:**
- [ ] Can save/compare QoR snapshots
- [ ] Trend visualization available
- [ ] Target tracking works

**Files to Create/Modify:**
- `servers/eda/tools/qor.js` (new, extract from existing)
- `src/lib/qor-tracker.js` (new)

---

### 2.2 Error Diagnosis & Recovery

**Problem:** When Tcl fails, Claude doesn't know why or how to fix it.

**New Tools:**

```
eda.diagnose_error(output)
  - Parse EDA error output and explain
  - Categorizes: syntax, constraint, timing, DRC, license, resource
  - Returns: { 
      error_type, 
      error_category,
      explanation: "The clock buffer 'clk_buf_1' is undersized...",
      likely_cause: "...",
      suggested_fixes: ["Size up clk_buf_1 to X4", "Check clock tree balance"]
    }

eda.suggest_fix(error_type, context)
  - Get fix suggestions based on error type
  - Returns: { fixes: [{ action, tcl_template, confidence }] }

eda.validate_tcl(tcl)
  - Validate Tcl syntax before sending
  - Returns: { valid: bool, errors: [{ line, message }] }

eda.explain_output(output)
  - Explain EDA output in plain English
  - Returns: { summary, key_points: [], actionable_items: [] }
```

**Error Categories:**
1. **Syntax Errors** - Tcl syntax, wrong command names
2. **Constraint Errors** - Missing clocks, invalid constraints
3. **Timing Violations** - Setup/hold violations
4. **DRC Violations** - Design rule checks
5. **Resource Errors** - Memory, CPU, license
6. **Data Errors** - Missing files, corrupt data

**Success Criteria:**
- [ ] Can diagnose common error types
- [ ] Provides actionable fix suggestions
- [ ] Tcl validation catches syntax errors

**Files to Create/Modify:**
- `servers/eda/tools/diagnosis.js` (new)
- `src/lib/error-patterns.json` (new)
- `src/lib/tcl-validator.js` (new)

---

### 2.3 Workflow Automation

**Problem:** Multi-step workflows require manual orchestration.

**New Tools:**

```
workflow.define(name, steps)
  - Define a multi-step workflow
  - Steps: [{ name, tool, tcl_template, success_check, on_failure }]
  - Returns: { workflow_id, step_count }

workflow.list()
  - List defined workflows
  - Returns: { workflows: [{ id, name, step_count, description }] }

workflow.run(name, params)
  - Execute a workflow
  - Runs steps sequentially with automatic error handling
  - Returns: { run_id, status: "running", current_step }

workflow.get_status(run_id)
  - Get workflow execution status
  - Returns: { status, current_step, completed_steps, failed_step, results }

workflow.pause(run_id)
  - Pause running workflow
  - Returns: { paused: bool, at_step: string }

workflow.resume(run_id)
  - Resume paused workflow
  - Returns: { resumed: bool, from_step: string }

workflow.cancel(run_id)
  - Cancel running workflow
  - Returns: { cancelled: bool }
```

**Built-in Workflows:**
1. `fix_setup_timing` - Analyze → Generate fixes → Apply → Verify
2. `fix_hold_timing` - Analyze → Generate fixes → Apply → Verify
3. `run_cts` - Build CTS → Optimize → Verify
4. `eco_flow` - Analyze changes → Apply ECO → Verify

**Success Criteria:**
- [ ] Can define and run workflows
- [ ] Automatic error handling works
- [ ] Can pause/resume/cancel

**Files to Create/Modify:**
- `servers/eda/tools/workflow.js` (new)
- `src/lib/workflow-engine.js` (new)
- `data/workflows/` (new directory)

---

## Phase 3: Advanced (Week 5-6)

### 3.1 Documentation Integration

**Problem:** Claude guesses Tcl syntax instead of using authoritative docs.

**New Tools:**

```
docs.get_syntax(tool, command)
  - Get exact syntax for EDA command
  - Returns: { syntax, parameters: [{ name, type, required, default }], examples: [] }

docs.search(query, tool=null)
  - Search documentation
  - Returns: { results: [{ title, tool, relevance, snippet, source }] }

docs.get_examples(tool, command)
  - Get real usage examples
  - Returns: { examples: [{ tcl, description, source }] }

docs.explain_option(tool, command, option)
  - Explain specific command option
  - Returns: { option, type, description, values, impact }

docs.get_methodology(stage, tool)
  - Get methodology guide for flow stage
  - Returns: { guide: string, best_practices: [], common_mistakes: [] }
```

**Documentation Sources:**
1. Built-in command reference (`data/command-reference.json`)
2. Tool man pages (parsed from EDA tools)
3. Team methodology docs (`.hipilot/docs/`)
4. Synopsys/Cadence documentation (indexed)

**Success Criteria:**
- [ ] Command syntax is accurate
- [ ] Examples are from real documentation
- [ ] Methodology guides available per stage

**Files to Create/Modify:**
- `servers/knowledge/tools/docs.js` (enhance existing)
- `data/command-reference.json` (expand)
- `data/methodology/` (new directory)

---

### 3.2 Smart Suggestions

**Problem:** Claude doesn't proactively suggest improvements.

**New Tools:**

```
suggest.analyze()
  - Analyze current design state and suggest improvements
  - Returns: { suggestions: [{ action, impact, effort, priority }] }

suggest.for_violation(violation_type)
  - Get suggestions for specific violation type
  - Returns: { suggestions: [{ fix, tcl, expected_impact }] }

suggest.next_optimization()
  - Suggest next optimization step based on QoR
  - Returns: { optimization: string, reason: string, expected_gain: string }
```

**Success Criteria:**
- [ ] Proactive suggestions based on context
- [ ] Prioritized by impact/effort
- [ ] Actionable with Tcl templates

**Files to Create/Modify:**
- `servers/eda/tools/suggest.js` (new)
- `src/lib/suggestion-engine.js` (new)

---

### 3.3 Collaboration & Sharing

**Problem:** No way to share workflows, fixes, or learnings.

**New Tools:**

```
share.export_session()
  - Export session as shareable file
  - Returns: { export_path, includes: ["history", "qor", "workflows"] }

share.import_session(path)
  - Import shared session
  - Returns: { imported: bool, summary: object }

share.export_workflow(name)
  - Export workflow definition
  - Returns: { export_path, workflow: object }

share.create_runbook(session_id)
  - Generate runbook from session
  - Returns: { runbook_path, markdown_content }
```

**Success Criteria:**
- [ ] Sessions can be exported/imported
- [ ] Runbooks generated automatically
- [ ] Workflows can be shared

**Files to Create/Modify:**
- `servers/knowledge/tools/share.js` (new)
- `src/lib/runbook-generator.js` (new)

---

## Tool Summary by Phase

### Phase 1: Foundation (12 new tools)

| Tool | Server | Purpose |
|------|--------|---------|
| `eda.wait_for_pattern` | EDA | Wait for specific output |
| `eda.wait_for_prompt` | EDA | Wait for tool prompt |
| `eda.get_last_result` | EDA | Parse command result |
| `eda.capture_and_wait` | EDA | Combined send + wait |
| `tmux.wait_for_change` | Tmux | Wait for pane change |
| `session.save_checkpoint` | Knowledge | Save state |
| `session.list_checkpoints` | Knowledge | List saved states |
| `session.restore_checkpoint` | Knowledge | Restore state |
| `session.get_history` | Knowledge | Command history |
| `session.get_context` | Knowledge | Current context |
| `context.detect` | EDA | Auto-detect context |
| `context.suggest_next` | EDA | Next step suggestion |

### Phase 2: Intelligence (15 new tools)

| Tool | Server | Purpose |
|------|--------|---------|
| `qor.snapshot` | EDA | Save QoR |
| `qor.list_snapshots` | EDA | List QoR snapshots |
| `qor.compare` | EDA | Compare snapshots |
| `qor.get_trend` | EDA | QoR trend |
| `qor.set_target` | EDA | Set targets |
| `qor.check_target` | EDA | Check targets |
| `eda.diagnose_error` | EDA | Error diagnosis |
| `eda.suggest_fix` | EDA | Fix suggestions |
| `eda.validate_tcl` | EDA | Tcl validation |
| `eda.explain_output` | EDA | Output explanation |
| `workflow.define` | EDA | Define workflow |
| `workflow.list` | EDA | List workflows |
| `workflow.run` | EDA | Execute workflow |
| `workflow.get_status` | EDA | Workflow status |
| `workflow.pause/resume/cancel` | EDA | Workflow control |

### Phase 3: Advanced (10 new tools)

| Tool | Server | Purpose |
|------|--------|---------|
| `docs.get_syntax` | Knowledge | Command syntax |
| `docs.search` | Knowledge | Doc search |
| `docs.get_examples` | Knowledge | Usage examples |
| `docs.explain_option` | Knowledge | Option details |
| `docs.get_methodology` | Knowledge | Methodology guides |
| `suggest.analyze` | EDA | Proactive suggestions |
| `suggest.for_violation` | EDA | Violation fixes |
| `suggest.next_optimization` | EDA | Next optimization |
| `share.export_session` | Knowledge | Export session |
| `share.create_runbook` | Knowledge | Generate runbook |

---

## Implementation Priority

### Critical Path (Must Have)

1. **Feedback Loop** - Without this, nothing else works autonomously
2. **Session State** - Required for context awareness
3. **Error Diagnosis** - Required for self-correction

### High Value (Should Have)

4. **QoR Tracking** - Core value proposition
5. **Workflow Automation** - Multi-step skill execution
6. **Context Detection** - Smart suggestions

### Nice to Have

7. **Documentation Integration** - Better accuracy
8. **Smart Suggestions** - Proactive improvement
9. **Collaboration** - Team sharing

---

## Skill Integration

Each MCP improvement enables new skills:

| MCP Improvement | New Skills Enabled |
|-----------------|-------------------|
| Feedback Loop | `auto_fix_timing`, `iterative_optimization` |
| Session State | `resume_work`, `create_checkpoint`, `undo_changes` |
| QoR Tracking | `track_progress`, `compare_implementations`, `set_targets` |
| Error Diagnosis | `debug_failure`, `auto_recover`, `explain_error` |
| Workflow | `run_cts_flow`, `eco_flow`, `signoff_flow` |
| Documentation | `learn_command`, `get_examples`, `best_practices` |

---

## Success Metrics

| Metric | Current | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| Autonomous fix rate | 0% | 30% | 60% | 80% |
| Error recovery rate | 0% | 20% | 50% | 70% |
| Workflow automation | Manual | Partial | Full | Optimized |
| QoR tracking | None | Basic | Trend | Predictive |
| Context awareness | None | Detected | Tracked | Predictive |

---

## File Structure

```
hipilot/
├── servers/
│   ├── eda/
│   │   ├── index.js
│   │   └── tools/
│   │       ├── feedback.js      (Phase 1)
│   │       ├── context.js       (Phase 1)
│   │       ├── qor.js           (Phase 2)
│   │       ├── diagnosis.js     (Phase 2)
│   │       ├── workflow.js      (Phase 2)
│   │       └── suggest.js       (Phase 3)
│   ├── tmux/
│   │   ├── index.js
│   │   └── tools/
│   │       └── wait.js          (Phase 1)
│   └── knowledge/
│       ├── index.js
│       └── tools/
│           ├── session.js       (Phase 1)
│           ├── docs.js          (Phase 3)
│           └── share.js         (Phase 3)
├── src/lib/
│   ├── session-store.js         (Phase 1)
│   ├── context-detector.js      (Phase 1)
│   ├── qor-tracker.js           (Phase 2)
│   ├── error-patterns.json      (Phase 2)
│   ├── tcl-validator.js         (Phase 2)
│   ├── workflow-engine.js       (Phase 2)
│   ├── suggestion-engine.js     (Phase 3)
│   └── runbook-generator.js     (Phase 3)
├── data/
│   ├── command-reference.json   (expand)
│   ├── methodology/             (Phase 3)
│   └── workflows/               (Phase 2)
└── .hipilot/
    └── session/
        ├── checkpoints.json
        ├── history.jsonl
        └── context.json
```

---

## Next Steps

1. **Review this plan** - Get stakeholder approval
2. **Start Phase 1** - Begin with feedback loop
3. **Iterate** - Implement, test, refine
4. **Document** - Update skill authoring guide
5. **Train** - Help team use new capabilities

---

*This plan will be updated as implementation progresses.*
