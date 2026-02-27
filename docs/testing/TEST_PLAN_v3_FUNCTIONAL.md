# HiPilot Functional E2E Test Plan (v3)

> **Scope:** Validate core HiPilot functionality on EDA server using HiTestBot virtual human testing
> **Runner:** HiTestBot only (`bin/hitestbot-eda`)
> **Duration:** ~45 minutes total
> **Target:** New code version regression validation

---

## Pre-Test Setup

### On Dev Machine
```bash
# Deploy latest code to EDA server
node src/hitestbot/infra/deploy_hipilot.js

# Verify deployment
bin/hitestbot-eda "echo 'deployment check'"
```

### On EDA Server (Pre-Test Cleanup)
```bash
# Kill stale processes
pkill -9 -f "innovus|icc2_shell|pt_shell|ffmpeg" 2>/dev/null
tmux -L hipilot kill-server 2>/dev/null
rm -f /tmp/hipilot-EDA/mcp_calls.jsonl

# Verify clean state
ls /home/EDA/hipilot/current/servers/eda/index.js
cat ~/.claude/settings.json | python -m json.tool | grep -A5 hipilot-eda
```

---

## Test Suite: Core Functionality

### Test 1: Basic Connectivity & Mode System (5 min)

**Command:**
```bash
bin/hitestbot-eda "what is your current mode"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Understands mode query | Mentions "manual" or "auto" | 1.0 |
| L3 | Uses `eda.get_mode` or `eda.get_status` | MCP call in logs | 1.0 |
| L4 | Mode status returned | "🔒 Manual" or "⚡ Auto" visible | 1.0 |
| L5 | N/A | No QoR for this test | 0.0 |

**Pass Criteria:** Score ≥ 3.0/5.0

**Evidence:**
- `mcp_calls.jsonl` should show `eda.get_mode` or `eda.get_status`
- Status bar shows mode indicator

---

### Test 2: Mode Toggle (5 min)

**Command:**
```bash
bin/hitestbot-eda "switch to auto mode"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude acknowledges | Response confirms mode change | 1.0 |
| L2 | Correct intent | "auto mode" or "Claude has the conn" | 1.0 |
| L3 | Uses `eda.set_mode` or `eda.toggle_mode` | MCP call with mode="auto" | 1.0 |
| L4 | Status bar updates | Shows "⚡ Claude has conn" (green) | 1.0 |
| L5 | Mode persists | `eda.get_mode` returns "auto" | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

**Post-Test:** Toggle back to manual mode for safety
```bash
bin/hitestbot-eda "switch to manual mode"
```

---

### Test 3: EDA Tool Detection (5 min)

**Command:**
```bash
bin/hitestbot-eda "check what EDA tools are available"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Understands query | Mentions EDA tool detection | 1.0 |
| L3 | Uses `eda.detect_tool` or `eda.get_status` | MCP call in logs | 1.0 |
| L4 | Tool status reported | "No tool detected" or tool name | 1.0 |
| L5 | N/A | No QoR for this test | 0.0 |

**Pass Criteria:** Score ≥ 3.0/5.0

**Evidence Check:**
```bash
# On EDA server after test
grep -c "eda.detect_tool" /tmp/hipilot-EDA/mcp_calls.jsonl
# Should be >= 1
```

---

### Test 4: Start EDA Tool (10 min)

**Command:**
```bash
bin/hitestbot-eda "start innovus for the ibex design at /home/EDA/ibex_work_upload"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude acknowledges | Response within 60s | 1.0 |
| L2 | Correct intent | Mentions starting Innovus | 1.0 |
| L3 | Uses `eda.start_tool` | MCP call with tool="innovus" | 1.0 |
| L4 | Innovus starts | Right pane shows `innovus 1>` prompt | 1.0 |
| L5 | Design loaded | No errors, ready for commands | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

**Failure Modes:**
- `ENVIRONMENT`: License server down, design path wrong
- `AI_BEHAVIOR`: Used Bash instead of MCP (check `mcp_calls.jsonl`)
- `HIPILOT_BUG`: `eda.start_tool` returned error

---

### Test 5: Tcl Generation (Template) (5 min)

**Prerequisite:** Test 4 passed (Innovus running)

**Command:**
```bash
bin/hitestbot-eda "generate a timing report using the template"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Correct intent | Mentions timing report | 1.0 |
| L3 | Uses `eda.generate_tcl` | MCP call with operation="report_timing" | 1.0 |
| L4 | Template used | `[✓ Template]` badge visible | 1.0 |
| L5 | Tcl content valid | Valid Innovus timing commands | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

**Evidence Check:**
```bash
# Verify template path in MCP log
grep -A5 "generate_tcl" /tmp/hipilot-EDA/mcp_calls.jsonl | grep "template_path"
# Should show: cadence/innovus_report_timing.tcl
```

---

### Test 6: Tcl Execution (Auto Mode) (10 min)

**Prerequisite:** Test 4 passed

**Setup:** Ensure in AUTO mode first
```bash
bin/hitestbot-eda "switch to auto mode"
```

**Command:**
```bash
bin/hitestbot-eda "run a timing report and show me the WNS"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 120s | 1.0 |
| L2 | Correct intent | Mentions timing report + WNS | 1.0 |
| L3 | Uses `eda.execute_and_verify` or non-blocking + peek | MCP call in logs | 1.0 |
| L4 | Tcl executes | Right pane shows `report_timing` output | 1.0 |
| L5 | QoR reported | WNS value visible in Claude's response | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

**Post-Test:** Return to manual mode
```bash
bin/hitestbot-eda "switch to manual mode"
```

---

### Test 7: Progressive Disclosure (Peek) (10 min)

**Prerequisite:** Test 4 passed

**Command:**
```bash
bin/hitestbot-eda "run placement and check progress with peek"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|------- |
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Correct intent | Mentions placement + progress check | 1.0 |
| L3 | Uses `eda.send_tcl_nonblocking` + `eda.peek` | Non-blocking send, then peek calls | 1.0 |
| L4 | Progress monitored | Multiple `eda.peek` calls during execution | 1.0 |
| L5 | Final QoR reported | Placement completes, metrics reported | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

**Evidence Check:**
```bash
# Count peek calls during execution
grep -c "eda.peek" /tmp/hipilot-EDA/mcp_calls.jsonl
# Should be >= 2 (shows progressive disclosure working)
```

---

### Test 8: Risk Analysis & Manual Approval (10 min)

**Prerequisite:** Test 4 passed, in MANUAL mode

**Command:**
```bash
bin/hitestbot-eda "optimize the design for setup timing"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Correct intent | Mentions optimization | 1.0 |
| L3 | Risk analysis shown | Shows risk level (Moderate/Dangerous) | 1.0 |
| L4 | Tcl queued (not executed) | "⏳ pending" in status bar | 1.0 |
| L5 | Approval prompt | HiTestBot presses prefix+y to approve | 1.0 |

**After Approval:**
- Tcl executes in right pane
- QoR reported

**Pass Criteria:** Score ≥ 4.0/5.0

**Note:** HiTestBot automatically approves pending Tcl with `prefix+y`

---

### Test 9: QoR Extraction (5 min)

**Prerequisite:** Test 6 passed (timing report executed)

**Command:**
```bash
bin/hitestbot-eda "extract QoR metrics from the last report"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Correct intent | Mentions QoR/metrics | 1.0 |
| L3 | Uses `eda.extract_qor` or `eda.capture_and_analyze` | MCP call in logs | 1.0 |
| L4 | Metrics extracted | WNS, TNS visible in response | 1.0 |
| L5 | Structured data | JSON or formatted metrics | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

---

### Test 10: Skill System (5 min)

**Command:**
```bash
bin/hitestbot-eda "list available HiPilot skills"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Correct intent | Lists skills | 1.0 |
| L3 | Uses `knowledge.list_skills` | MCP call in logs | 1.0 |
| L4 | Skills returned | >= 5 skills listed | 1.0 |
| L5 | N/A | No QoR for this test | 0.0 |

**Pass Criteria:** Score ≥ 3.0/5.0

---

### Test 11: Checkpoint System (10 min)

**Prerequisite:** Test 4 passed

**Command:**
```bash
bin/hitestbot-eda "save a checkpoint named test_checkpoint"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Correct intent | Mentions checkpoint | 1.0 |
| L3 | Uses `session.save_checkpoint` or `eda.save_design` | MCP call in logs | 1.0 |
| L4 | Checkpoint created | `.enc` file exists on EDA server | 1.0 |
| L5 | Metadata saved | Checkpoint info with QoR | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

**Evidence Check:**
```bash
# On EDA server
ls -la /home/EDA/ibex_work_upload/result/pr/data/*test_checkpoint* 2>/dev/null || \
ls -la ~/.hipilot/checkpoints/test_checkpoint.json 2>/dev/null
```

---

### Test 12: Error Diagnosis (10 min)

**Prerequisite:** Test 4 passed

**Command:**
```bash
bin/hitestbot-eda "run a command that will fail: report_timing -invalid_option"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 60s | 1.0 |
| L2 | Correct intent | Attempted timing report | 1.0 |
| L3 | Uses `eda.execute_and_verify` | MCP call in logs | 1.0 |
| L4 | Error detected | Claude acknowledges error | 1.0 |
| L5 | Diagnosis provided | Explains what went wrong | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

**Note:** Tests error handling path

---

## Test Suite: Integration Flow

### Test 13: Single Stage Execution (20 min)

**Command:**
```bash
bin/hitestbot-eda "run the design init stage for ibex"
```

**Validation:**

| Layer | Check | Expected | Score |
|-------|-------|----------|-------|
| L1 | Claude responds | Response within 30s | 1.0 |
| L2 | Loads correct skill | `knowledge.get_skill` for design-init | 1.0 |
| L3 | Generates Tcl | `eda.generate_tcl` or `eda.run_skill` | 1.0 |
| L4 | Stage completes | `init_design.enc` created | 1.0 |
| L5 | QoR reported | Design metrics visible | 1.0 |

**Pass Criteria:** Score ≥ 4.0/5.0

---

### Test 14: Multi-Stage Flow (60 min)

**Command:**
```bash
bin/hitestbot-eda "run rtl2gds flow for ibex"
```

**Validation (per stage):**

| Stage | Checkpoint | Min Score |
|-------|-----------|-----------|
| 1. Design Init | `init_design.enc` | 4.0 |
| 2. Floorplan | `floor_plan.enc` | 4.0 |
| 3. Power | `powerplan.enc` | 4.0 |
| 4. Placement | `placement.enc` | 3.0 |

**Early Exit:** Stop if 2 consecutive stages fail

**Pass Criteria:** ≥ 3 stages completed with score ≥ 3.0 each

---

## Evidence Collection Checklist

After each test, verify:

```bash
bin/hitestbot-pull

cd test-evidence/<timestamp>

# Check evidence exists
[ -f FLOW_REPORT.md ] && echo "✓ Report exists"
[ -f logs/mcp_calls.jsonl ] && echo "✓ MCP logs exist"
[ -f logs/claude_full.log ] && echo "✓ Claude pane log exists"
[ -f logs/eda_full.log ] && echo "✓ EDA pane log exists"
[ -f recordings/test_recording.mp4 ] && echo "✓ Video exists"

# Verify MCP logging worked
wc -l logs/mcp_calls.jsonl
# Should show > 0 lines
```

---

## Summary Scorecard

| Test | Description | Weight | Pass Criteria |
|------|-------------|--------|---------------|
| 1 | Basic Connectivity | Required | ≥ 3.0 |
| 2 | Mode Toggle | Required | ≥ 4.0 |
| 3 | EDA Tool Detection | Required | ≥ 3.0 |
| 4 | Start EDA Tool | Required | ≥ 4.0 |
| 5 | Tcl Generation (Template) | Required | ≥ 4.0 |
| 6 | Tcl Execution (Auto) | High | ≥ 4.0 |
| 7 | Progressive Disclosure | High | ≥ 4.0 |
| 8 | Risk Analysis & Approval | High | ≥ 4.0 |
| 9 | QoR Extraction | Medium | ≥ 4.0 |
| 10 | Skill System | Medium | ≥ 3.0 |
| 11 | Checkpoint System | Medium | ≥ 4.0 |
| 12 | Error Diagnosis | Medium | ≥ 4.0 |
| 13 | Single Stage | High | ≥ 4.0 |
| 14 | Multi-Stage Flow | Critical | ≥ 3 stages |

**Overall Pass:** All "Required" tests pass + ≥ 80% of weighted tests pass

---

## Quick Run Commands

```bash
# Run all tests sequentially
bin/hitestbot-eda "what is your current mode"
bin/hitestbot-eda "switch to auto mode"
bin/hitestbot-eda "check what EDA tools are available"
bin/hitestbot-eda "start innovus for the ibex design at /home/EDA/ibex_work_upload"
bin/hitestbot-eda "generate a timing report using the template"
bin/hitestbot-eda "run a timing report and show me the WNS"
bin/hitestbot-eda "switch to manual mode"

# Pull all evidence
bin/hitestbot-pull
```

---

## Regression Tracking

| Date | Tests Passed | Total Score | Blocking Issue |
|------|-------------|-------------|----------------|
| YYYY-MM-DD | X/14 | XX/70 | - |

---

*Test Plan Version: 3.0*
*Last Updated: 2026-02-27*
*Runner: HiTestBot Only*
