# HiTestBot Test Progress Tracker

**Project:** HiPilot RTL-to-GDS Flow Certification
**Started:** 2026-02-26
**Target Completion:** 2026-04-30

---

## Current Status

| Level | Status | Pass Rate | Blocking Issue |
|-------|--------|-----------|----------------|
| L1 Infrastructure | ✅ CERTIFIED | 12 / 12 | None |
| L2 Single Commands | ⚠️ IN PROGRESS | 1 / 8 | AI_BEHAVIOR: Claude using Bash |
| L3 Single Stages | ⬜ Not Started | - / 7 | - |
| L4 Multi-Stage | ⬜ Not Started | - / 5 | - |
| L5 Full Flow | ⬜ Not Started | - / 10 | - |
|-------|--------|-----------|----------------|
| L1 Infrastructure | ✅ CERTIFIED | 12 / 12 | None |
| L2 Single Commands | ⏳ Ready | - / 8 | Requires HiTestBot E2E |
| L3 Single Stages | ⬜ Not Started | - / 7 | - |
| L4 Multi-Stage | ⬜ Not Started | - / 5 | - |
| L5 Full Flow | ⬜ Not Started | - / 10 | - |

---

## Test Run Log

### Level 1: Infrastructure Tests

| Date | Test ID | Result | Score | Issue | Fix |
|------|---------|--------|-------|-------|-----|
| 2026-02-26 | L1-01 | ✅ | PASS | - | - |
| 2026-02-26 | L1-02 | ✅ | PASS | - | - |
| 2026-02-26 | L1-03 | ✅ | PASS | - | - |
| 2026-02-26 | L1-04 | ✅ | PASS | - | - |
| 2026-02-26 | L1-05 | ✅ | PASS | - | - |
| 2026-02-26 | L1-06 | ✅ | PASS | workflow.list bug | Fixed wf.steps.length |
| 2026-02-26 | L1-07 | ✅ | PASS | - | - |
| 2026-02-26 | L1-08 | ✅ | PASS | - | - |
| 2026-02-26 | L1-09 | ✅ | PASS | - | - |
| 2026-02-26 | L1-10 | ✅ | PASS | - | - |
| 2026-02-26 | L1-11 | ✅ | PASS | - | - |
| 2026-02-26 | L1-12 | ✅ | PASS | - | - |

**Level 1 Exit Criteria:**
- [x] All 12 tests pass
- [x] No errors in MCP server startup
- [x] Template rendering produces valid Tcl

**Level 1 Status: ✅ CERTIFIED** (2026-02-26)

---

### Level 2: Single Command Tests

| Date | Test ID | Command | L1 | L2 | L3 | L4 | L5 | Total | Status | Category |
|------|---------|---------|----|----|----|----|----|----|--------|----------|
| 2026-02-26 | L2-01 | /timing | 1.0 | 1.0 | 0.0 | 1.0 | 0.5 | 3.5/5 | ⚠️ PARTIAL | AI_BEHAVIOR |
| 2026-02-26 | L2-02 | /timing (2nd) | 1.0 | 0.5 | 0.0 | 0.0 | 0.0 | 1.5/5 | ❌ FAIL | AI_BEHAVIOR |
| 2026-02-26 | L2-03 | /drc | - | - | - | - | - | -/5 | ⏳ BLOCKED | AI-001 |
| 2026-02-26 | L2-04 | /power | - | - | - | - | - | -/5 | ⏳ BLOCKED | AI-001 |
| 2026-02-26 | L2-05 | /area | - | - | - | - | - | -/5 | ⏳ BLOCKED | AI-001 |
| 2026-02-26 | L2-06 | start innovus | - | - | - | - | - | -/5 | ⏳ BLOCKED | AI-001 |
| 2026-02-26 | L2-07 | save design | - | - | - | - | - | -/5 | ⏳ BLOCKED | AI-001 |
| 2026-02-26 | L2-08 | list templates | - | - | - | - | - | -/5 | ⏳ BLOCKED | AI-001 |
|------|---------|---------|----|----|----|----|----|----|--------|----------|
| 2026-02-26 | L2-01 | /timing | 1.0 | 1.0 | 0.0 | 1.0 | 0.5 | 3.5/5 | ⚠️ PARTIAL | AI_BEHAVIOR |
| | L2-02 | /report-timing | | | | | | /5 | | |
| | L2-03 | /drc | | | | | | /5 | | |
| | L2-04 | /power | | | | | | /5 | | |
| | L2-05 | /area | | | | | | /5 | | |
| | L2-06 | start innovus | | | | | | /5 | | |
| | L2-07 | save design | | | | | | /5 | | |
| | L2-08 | list templates | | | | | | /5 | | |
|------|---------|---------|----|----|----|----|----|----|--------|----------|
| | L2-01 | /timing | | | | | | /5 | | |
| | L2-02 | /report-timing | | | | | | /5 | | |
| | L2-03 | /drc | | | | | | /5 | | |
| | L2-04 | /power | | | | | | /5 | | |
| | L2-05 | /area | | | | | | /5 | | |
| | L2-06 | start innovus | | | | | | /5 | | |
| | L2-07 | save design | | | | | | /5 | | |
| | L2-08 | list templates | | | | | | /5 | | |

**Score Legend:** 1.0=Full, 0.5=Partial, 0.0=Fail
**Status:** ✅ PASS (≥4.0), ⚠️ PARTIAL (2.0-3.9), ❌ FAIL (<2.0)
**Category:** HIPILOT_BUG, AI_BEHAVIOR, ENVIRONMENT

**Level 2 Exit Criteria:**
- [ ] At least 6/8 tests pass (score ≥ 3.0)
- [ ] No AI_BEHAVIOR failures (Claude using bash)
- [ ] All tests use MCP tools

---

### Level 3: Single Stage Tests

| Date | Test ID | Stage | L1 | L2 | L3 | L4 | L5 | Total | Duration | Blocking |
|------|---------|-------|----|----|----|----|----|----|----------|----------|
| | L3-01 | init | | | | | | /5 | | |
| | L3-02 | floorplan | | | | | | /5 | | |
| | L3-03 | power | | | | | | /5 | | |
| | L3-04 | placement | | | | | | /5 | | |
| | L3-05 | cts | | | | | | /5 | | |
| | L3-06 | routing | | | | | | /5 | | |
| | L3-07 | postroute | | | | | | /5 | | |

**Level 3 Exit Criteria:**
- [ ] At least 4/7 stages pass
- [ ] Init + Floorplan + Placement must pass
- [ ] CTS may fail if physical-only mode (acceptable initially)

---

### Level 4: Multi-Stage Flow Tests

| Date | Test ID | Stages | Completed | Score | Duration | Blocking Stage | Category |
|------|---------|--------|-----------|-------|----------|----------------|----------|
| | L4-01 | Init→FP | /2 | /10 | | | |
| | L4-02 | Init→Power | /3 | /15 | | | |
| | L4-03 | Init→Place | /4 | /20 | | | |
| | L4-04 | Init→CTS | /5 | /25 | | | |
| | L4-05 | Full P&R | /7 | /35 | | | |

**Level 4 Exit Criteria:**
- [ ] L4-01 passes (2-stage)
- [ ] L4-02 passes (3-stage)
- [ ] L4-03 passes (4-stage)
- [ ] L4-05: 80%+ of stages pass

---

### Level 5: Full RTL-to-GDS Flow

| Date | Run # | Stages Completed | Score | Duration | Blocking | Category | Notes |
|------|-------|------------------|-------|----------|----------|----------|-------|
| | 1 | /10 | /50 | | | | |
| | 2 | /10 | /50 | | | | |
| | 3 | /10 | /50 | | | | |
| | 4 | /10 | /50 | | | | |
| | 5 | /10 | /50 | | | | |

**Graduation Criteria:**
- [ ] All 10 stages reach PASS (≥4.0 each)
- [ ] Total score ≥ 45/50
- [ ] No HIPILOT_BUG failures
- [ ] Claude uses MCP exclusively
- [ ] Final QoR: DRC=0, LVS=CORRECT

---

## Failure Analysis Log

### HIPILOT_BUG Issues

| ID | Date | Component | Description | Fix | Status |
|----|------|-----------|-------------|-----|--------|
| BUG-001 | 2026-02-26 | workflow.list | wf.steps.length failed when steps is number | Check typeof before .length | ✅ Fixed |
| BUG-002 | | | | | ⬜ |
| BUG-003 | | | | | ⬜ |

### AI_BEHAVIOR Issues

| ID | Date | Behavior | Root Cause | Fix (Prompt/Skill) | Status |
|----|------|----------|------------|-------------------|--------|
| AI-001 | 2026-02-26 | Claude uses Bash instead of MCP tools | **Root cause investigation:** Model treats MCP tool names like `eda.detect_tool` as bash commands instead of direct tool invocations. Even with explicit "NEVER use Bash" instructions, model types `Bash: mcp__hipilot-eda__detect_tool` which fails. MCP servers are correctly configured and working when tested directly via `node servers/eda/index.js`. **Investigation needed:** Why model doesn't recognize MCP tools as available direct tool calls. | **Attempted fixes:** (1) Added CRITICAL warning at top of CLAUDE.md (2) Updated /timing slash command with explicit "use MCP tools directly" instructions (3) Cleaned up CLAUDE.md duplicates. **Status:** Still failing. Model continues to use Bash. May need different approach - possibly MCP tool naming convention or Claude Code configuration issue. | 🔴 BLOCKING |
| AI-002 | | | | | ⬜ |
| AI-003 | | | | | ⬜ |

| ID | Date | Behavior | Root Cause | Fix (Prompt/Skill) | Status |
|----|------|----------|------------|-------------------|--------|
| AI-001 | 2026-02-26 | Claude uses Bash instead of MCP tools | CLAUDE.md instructions not followed; /timing command uses `innovus -no_gui -files` via Bash instead of eda.start_tool + eda.execute_and_verify | Need to strengthen CLAUDE.md MCP tool instructions; Add explicit "NEVER use Bash" examples; Consider tool permission restrictions | 🔴 BLOCKING |
| AI-002 | | | | | ⬜ |
| AI-003 | | | | | ⬜ |
|----|------|----------|------------|-------------------|--------|
| AI-001 | | | | | ⬜ |
| AI-002 | | | | | ⬜ |
| AI-003 | | | | | ⬜ |

### ENVIRONMENT Issues

| ID | Date | Issue | Fix | Status |
|----|------|-------|-----|--------|
| ENV-001 | | | | ⬜ |
| ENV-002 | | | | ⬜ |
| ENV-003 | | | | ⬜ |

---

## Weekly Progress Summary

| Week | L1 | L2 | L3 | L4 | L5 | Key Achievement | Main Blocker |
|------|----|----|----|----|----|-----------------|--------------|
| 1 | ✅ 12/12 | ⚠️ 1/8 | - | - | - | L1 certified; L2-01 partial (3.5/5) | AI-001: Claude uses Bash instead of MCP tools |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
|------|----|----|----|----|----|-----------------|--------------|
| 1 | ✅ 12/12 | ⏳ | - | - | - | L1 Infrastructure certified on dev + EDA server | L2+ requires E2E testing with Claude Code |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |

---

## Quick Commands Reference

```bash
# Run tests
bin/hitestbot-test infra          # Level 1
bin/hitestbot-test l2             # Level 2
bin/hitestbot-test l3 init        # Level 3
bin/hitestbot-test l4 4           # Level 4
bin/hitestbot-test full           # Level 5

# Analyze results
bin/hitestbot-test analyze
bin/hitestbot-pull

# Deploy updates
node src/hitestbot/infra/deploy_hipilot.js

# Check progress
node src/hitestbot/tests/FlowCertificationTest.js /rtl2gds
```

---

## Notes

### 2026-02-26 Test Session

**L1 Infrastructure Tests:**
- All 12 tests pass on dev machine (cloud VM)
- All 12 tests pass on EDA server after deployment
- Fixed BUG-001: workflow.list was accessing .length on number type

**EDA Server Verification:**
- Host: EDA@192.168.112.163 (accessible via sshpass)
- Node.js: v20.18.3 at /home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/
- Innovus: v20.10 at /opt/cadence/INNOVUS20.10/
- ICC2: T-2022.03 at /opt/synopsys/icc2_2022.03/
- PrimeTime: T-2022.03 at /opt/synopsys/prime_2022.03/
- Ibex design: /home/EDA/ibex_work_upload/
- Display :0 available (X running)

**Deployment Notes:**
- Must clean /home/EDA/hipilot/ before fresh deploy
- Tarball must include servers/ directory with all MCP server code
- package.json must have "type": "module"

**L2-01 /timing Test (2026-02-26):**
- **Setup:** Claude Code running from /home/EDA/ibex_work_upload with CLAUDE.md (HiPilot AI identity)
- **Result:** 3.5/5.0 (PARTIAL)
- **Issue:** AI_BEHAVIOR - Claude used Bash commands instead of MCP tools
  - Used: `innovus -no_gui -files /tmp/run_timing_analysis.tcl` (Bash)
  - Should have used: `eda.start_tool`, `eda.generate_tcl`, `eda.execute_and_verify` (MCP)
- **Root Cause:** CLAUDE.md instructions about using MCP tools are not being followed by the model
- **Impact:** CRITICAL - L3 score = 0.0 because no MCP tools were used at all
- **Recommendation:** Strengthen CLAUDE.md with explicit "NEVER use Bash" examples; Consider removing Bash access to EDA tools

**L2 Test Round 2 (2026-02-26):**
- **Changes made:** Updated CLAUDE.md with prominent "CRITICAL: Use MCP Tools ONLY" header, explicit examples of wrong vs right, updated /timing.md slash command
- **Result:** Still failing - model still tries `Bash: mcp__hipilot-eda__detect_tool` instead of direct tool invocation
- **Observation:** Model sees MCP tool names in prompt but treats them as bash commands, not as available tool calls
- **MCP Server Status:** Verified working - direct invocation via `node servers/eda/index.js` returns 52 tools correctly
- **Claude Code Config:** settings.json has correct MCP server registration, permissions applied
- **Conclusion:** This appears to be a model behavior issue where it doesn't recognize MCP tools as invokable tools. May require:
  1. Investigation of Claude Code's tool discovery mechanism
  2. Possible naming convention issue (mcp__ prefix?)
  3. Alternative approach to tool registration

**L2 Status:** BLOCKED by AI-001. Cannot proceed until model properly invokes MCP tools.
- **Setup:** Claude Code running from /home/EDA/ibex_work_upload with CLAUDE.md (HiPilot AI identity)
- **Result:** 3.5/5.0 (PARTIAL)
- **Issue:** AI_BEHAVIOR - Claude used Bash commands instead of MCP tools
  - Used: `innovus -no_gui -files /tmp/run_timing_analysis.tcl` (Bash)
  - Should have used: `eda.start_tool`, `eda.generate_tcl`, `eda.execute_and_verify` (MCP)
- **Root Cause:** CLAUDE.md instructions about using MCP tools are not being followed by the model
- **Impact:** CRITICAL - L3 score = 0.0 because no MCP tools were used at all
- **Recommendation:** Strengthen CLAUDE.md with explicit "NEVER use Bash" examples; Consider removing Bash access to EDA tools
- Must clean /home/EDA/hipilot/ before fresh deploy
- Tarball must include servers/ directory with all MCP server code
- package.json must have "type": "module"

---

*Last Updated: 2026-02-26*
