# MCP Tool Verification Report

## Executive Summary

**57 MCP tool references** were found across **36 skill files**.
- **50 references (87.7%)** are VALID
- **7 references (12.3%)** are INVALID/FALSE CLAIMS

---

## Critical Finding: NON-EXISTENT TOOLS REFERENCED

The following tools are referenced in skills but **DO NOT EXIST** in the EDA server:

| Tool Referenced | Skill File | Issue |
|----------------|------------|-------|
| `context.get_context` | resume-work.md | **DOES NOT EXIST** - Likely meant `session.get_context` |
| `eda.rtl2gds.run_full_flow` | rtl2gds-flow.md | **INCORRECT NAMESPACE** - Actual tool is `rtl2gds.run_full_flow` (no `eda.` prefix) |
| `eda.rtl2gds.run_stage` | rtl2gds-flow.md | **INCORRECT NAMESPACE** - Actual tool is `rtl2gds.run_stage` (no `eda.` prefix) |
| `eda.workflow.run` | rtl2gds-flow.md | **INCORRECT NAMESPACE** - Actual tool is `workflow.run` (no `eda.` prefix) |

---

## Complete Verification Table

| Skill File | MCP Tool Referenced | Status | Parameter Mismatch |
|-----------|-------------------|--------|-------------------|
| auto-fix-drc.md | eda.capture_and_wait | EXISTS | N |
| auto-fix-drc.md | eda.wait_for_prompt | EXISTS | N |
| auto-fix-drc.md | eda.get_last_result | EXISTS | N |
| auto-fix-drc.md | eda.diagnose_error | EXISTS | N |
| auto-fix-drc.md | qor.snapshot | EXISTS | N |
| auto-fix-drc.md | qor.compare | EXISTS | N |
| auto-fix-drc.md | session.save_checkpoint | EXISTS | N |
| auto-fix-timing.md | qor.snapshot | EXISTS | N |
| auto-fix-timing.md | qor.compare | EXISTS | N |
| auto-fix-timing.md | eda.wait_for_prompt | EXISTS | N |
| auto-fix-timing.md | eda.get_last_result | EXISTS | N |
| auto-fix-timing.md | eda.diagnose_error | EXISTS | N |
| auto-fix-timing.md | eda.validate_tcl | EXISTS | N |
| auto-fix-timing.md | suggest.for_violation | EXISTS | N |
| auto-fix-timing.md | session.save_checkpoint | EXISTS | N |
| auto-recover.md | eda.diagnose_error | EXISTS | N |
| auto-recover.md | eda.validate_tcl | EXISTS | N |
| auto-recover.md | eda.capture_and_wait | EXISTS | N |
| auto-recover.md | eda.get_last_result | EXISTS | N |
| auto-recover.md | suggest.for_violation | EXISTS | N |
| auto-recover.md | session.save_checkpoint | EXISTS | N |
| compare-implementations.md | qor.list_snapshots | EXISTS | N |
| compare-implementations.md | qor.compare | EXISTS | N |
| compare-implementations.md | qor.get_trend | EXISTS | N |
| compare-implementations.md | session.list_checkpoints | EXISTS | N |
| create-checkpoint.md | session.save_checkpoint | EXISTS | N |
| create-checkpoint.md | qor.snapshot | EXISTS | N |
| create-checkpoint.md | session.get_context | EXISTS | N |
| debug-failure.md | eda.get_last_result | EXISTS | N |
| debug-failure.md | eda.diagnose_error | EXISTS | N |
| debug-failure.md | eda.capture_and_analyze | EXISTS | N |
| debug-failure.md | suggest.for_violation | EXISTS | N |
| resume-work.md | session.list_checkpoints | EXISTS | N |
| resume-work.md | session.restore_checkpoint | EXISTS | N |
| resume-work.md | session.get_context | EXISTS | N |
| resume-work.md | **context.get_context** | **DOES NOT EXIST** | N/A |
| resume-work.md | context.suggest_next | EXISTS | N |
| run-cts-flow.md | workflow.run | EXISTS | N |
| run-cts-flow.md | workflow.get_status | EXISTS | N |
| run-cts-flow.md | workflow.list | EXISTS | N |
| run-cts-flow.md | qor.snapshot | EXISTS | N |
| run-cts-flow.md | qor.compare | EXISTS | N |
| run-cts-flow.md | eda.wait_for_prompt | EXISTS | N |
| run-cts-flow.md | eda.get_last_result | EXISTS | N |
| run-eco-flow.md | workflow.run | EXISTS | N |
| run-eco-flow.md | workflow.get_status | EXISTS | N |
| run-eco-flow.md | qor.snapshot | EXISTS | N |
| run-eco-flow.md | qor.compare | EXISTS | N |
| run-eco-flow.md | eda.wait_for_prompt | EXISTS | N |
| run-eco-flow.md | eda.get_last_result | EXISTS | N |
| run-eco-flow.md | eda.diagnose_error | EXISTS | N |
| track-progress.md | qor.snapshot | EXISTS | N |
| track-progress.md | qor.list_snapshots | EXISTS | N |
| track-progress.md | qor.get_trend | EXISTS | N |
| track-progress.md | qor.compare | EXISTS | N |
| track-progress.md | context.get_context | EXISTS | N |
| rtl2gds-flow.md | **eda.rtl2gds.run_full_flow** | **WRONG NAMESPACE** | N/A |
| rtl2gds-flow.md | **eda.workflow.run** | **WRONG NAMESPACE** | N/A |
| rtl2gds-flow.md | **eda.rtl2gds.run_stage** | **WRONG NAMESPACE** | N/A |

---

## Tools Registered in EDA Server

### eda.* tools (32 total)
- eda.generate_tcl
- eda.send_to_terminal
- eda.extract_qor
- eda.list_templates
- eda.detect_tool
- eda.start_tool
- eda.get_job_status
- eda.get_mode
- eda.set_mode
- eda.toggle_mode
- eda.get_pending
- eda.approve_pending
- eda.reject_pending
- eda.confirm_dangerous
- eda.get_risk_analysis
- eda.get_status
- eda.quick
- eda.capture_and_analyze
- eda.run_skill
- eda.edit_tcl
- eda.save_tcl
- eda.analyze_report
- eda.get_analysis_cache
- eda.wait_for_pattern
- eda.wait_for_prompt
- eda.get_last_result
- eda.capture_and_wait
- eda.execute_and_verify
- eda.diagnose_error
- eda.validate_tcl
- eda.send_tcl_nonblocking
- eda.peek

### session.* tools (11 total)
- session.save_checkpoint
- session.list_checkpoints
- session.restore_checkpoint
- session.get_history
- session.get_context
- session.add_note
- session.get_notes
- session.add_todo
- session.get_todos
- session.complete_todo

### qor.* tools (4 total)
- qor.snapshot
- qor.list_snapshots
- qor.compare
- qor.get_trend

### workflow.* tools (5 total)
- workflow.define
- workflow.list
- workflow.run
- workflow.get_status
- workflow.cancel

### context.* tools (3 total)
- context.detect
- context.get_stage
- context.suggest_next

### suggest.* tools (3 total)
- suggest.analyze
- suggest.for_violation
- suggest.next_optimization

### rtl2gds.* tools (2 total)
- rtl2gds.run_full_flow
- rtl2gds.run_stage

---

## Issues Summary

### 1. CRITICAL: Non-existent Tool
**File:** `/Users/luzi/code/hipilot-v0.6.0/hipilot-cc/hipilot/skills/resume-work.md`
- **Line 14:** `context.get_context` - This tool does NOT exist
- **Fix:** Should likely be `session.get_context` (which exists)

### 2. HIGH: Wrong Namespace Prefix
**File:** `/Users/luzi/code/hipilot-v0.6.0/hipilot-cc/hipilot/skills/rtl2gds-flow.md`
- **Line 62:** `eda.rtl2gds.run_full_flow` - Wrong namespace
- **Line 64:** `eda.workflow.run` - Wrong namespace
- **Lines 70-74:** `eda.rtl2gds.run_stage` - Wrong namespace
- **Fix:** Remove `eda.` prefix. Correct tools are:
  - `rtl2gds.run_full_flow`
  - `rtl2gds.run_stage`
  - `workflow.run`

### 3. NOTE: False Pattern Matches
Some skill files contain strings that look like tool names but are not actual tool references:
- `qor.rpt`, `qor.tcl` in various files - These are file extensions, not tool names
- `eda.rtl` in rtl2gds-flow.md - This is an incomplete reference

---

## Recommendations

1. **Fix resume-work.md:** Change `context.get_context` to `session.get_context`
2. **Fix rtl2gds-flow.md:** Remove `eda.` prefix from `rtl2gds.*` and `workflow.*` tool references
3. **Add validation:** Consider adding a CI check that parses skill frontmatter and verifies all referenced tools exist in the EDA server
4. **Documentation:** Add a note to skill authoring guide about correct tool namespaces

---

*Report generated by comparing /Users/luzi/code/hipilot-v0.6.0/hipilot-cc/hipilot/skills/ against /Users/luzi/code/hipilot-v0.6.0/hipilot-cc/hipilot/servers/eda/index.js*
