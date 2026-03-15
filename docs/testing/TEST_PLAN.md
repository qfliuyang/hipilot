# HiPilot Unified Test Plan v3.3

> **One test plan to rule them all.** Self-improving, evidence-based, progressive certification.

**Version:** 3.3
**Status:** Active
**Replaces:** TEST_PLAN_v2.md, TEST_PLAN_v3_*.md, RTL2GDS_TEST_PLAN_OPERATIONAL.md

**Latest Update:** 2026-03-15 - Added Anti-Cheat Charter with explicit No Mock/No Bypass rules

---

## 1. Philosophy

### 1.1 Core Principles

| Principle | Meaning |
|-----------|---------|
| **Progress Over Pass/Fail** | 7/10 stages with detailed failure analysis > binary FAIL |
| **Evidence at Every Layer** | Logs + Screenshots + Video = Three-view correlation |
| **Test Like a Human** | HiTestBot uses HiPilot like a real engineer would |
| **Self-Improving** | Every failure feeds back into the next iteration |
| **Real Tools Only** | No mocks. Real dc_shell, innovus, pt_shell. |

### 1.2 Anti-Cheat Charter: No Mock, No Bypass, Real Human Testing

> **This test plan enforces STRICT human-like testing. Any method that bypasses HiPilot's normal operation is FORBIDDEN.**

**HiTestBot is a VIRTUAL HUMAN, not an API client.**

| Rule | Description | Violation Example |
|------|-------------|-------------------|
| **R1: No Direct MCP Calls** | HiTestBot NEVER calls MCP tools directly. It ONLY types in the left pane like a human. | Calling `eda.detect_tool()` directly via API |
| **R2: tmux-Only Interaction** | HiTestBot ONLY interacts through tmux commands: `send-keys`, `capture-pane`, `list-panes` | Reading MCP logs during test execution |
| **R3: No Right Pane Injection** | HiTestBot NEVER sends commands directly to the EDA pane (right pane) | Using `tmux send-keys -t 0.1` to inject Tcl |
| **R4: Real EDA Tools Only** | Tests MUST use real EDA tools. Simulated/fake output is prohibited. | Using `echo "innovus>"` to fake tool output |
| **R5: Post-Test Evidence Only** | MCP logs and EDA logs are read AFTER the test completes, never during | Tailing logs during test to check progress |
| **R6: Keyboard-Only Input** | All input is via keyboard keystrokes, not API calls | Setting MCP parameters programmatically |
| **R7: Visual Verification** | HiTestBot verifies by reading the screen (pane capture), not internal state | Checking internal variables instead of visible output |

**Why This Matters:**
- If HiTestBot bypasses HiPilot's UI, it could miss bugs a real human would encounter
- If HiTestBot reads MCP logs during the test, it gains "superhuman" knowledge
- If synthetic EDA output is used, the test proves nothing about real-world operation

**Enforcement:**
- FlowCertifier.js has anti-cheat checks (lines 45-71)
- Any test with direct MCP calls is marked `CHEAT_DETECTED` and invalid
- Evidence must show tmux-based interaction only

### 1.2 The North Star

> **HiPilot can conduct a complete RTL-to-GDS flow driven by Claude Code, MCP tools, and skills — proving that an AI Agent can replace a human for standard flow execution.**

### 1.3 Why Anti-Cheat Matters

**The Trap of Synthetic Testing:**

Many AI test frameworks "cheat" by:
1. Calling APIs directly instead of using the UI
2. Reading internal logs to verify behavior
3. Using simulated/mocked dependencies
4. Injecting commands into the backend

**Why This Destroys Trust:**

| Cheat Method | Why It Fails in Production |
|--------------|---------------------------|
| Direct MCP calls | Real users type in the left pane; API bypass misses UI bugs |
| Log tailing during test | Real users watch the screen, not JSON logs |
| Simulated EDA output | Mock results don't prove real tool integration works |
| Right pane injection | Bypasses HiPilot's approval workflows entirely |

**Our Commitment:**

HiTestBot is a **virtual human**, not a test API. It:
- Types in the left pane using `tmux send-keys` (like fingers on a keyboard)
- Reads the screen using `tmux capture-pane` (like eyes watching)
- Presses keyboard shortcuts (Ctrl+B, y) for approval (like a human reviewing)
- Collects evidence AFTER the test (like a human reviewing recordings)

**When tests pass under these constraints, you can trust that a real human will have the same experience.**

---

## 2. Test Architecture

### 2.1 Three-View Evidence System

```
┌─────────────────────────────────────────────────────────────────┐
│                     HiTestBot (Virtual Human)                    │
│                         ┌─────────────┐                         │
│                         │  TIMELINE   │                         │
│                         │  MERGER     │                         │
│                         └──────┬──────┘                         │
│              ┌──────────────────┼──────────────────┐            │
│              ▼                  ▼                  ▼            │
│    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│    │  VIEW 1: LOGS   │ │ VIEW 2: SCREEN  │ │ VIEW 3: VIDEO   │ │
│    │                 │ │                 │ │                 │ │
│    │ claude_full.log │ │ screenshots/    │ │ recording.mp4   │ │
│    │ eda_full.log    │ │ • launch.png    │ │                 │ │
│    │ mcp_calls.jsonl │ │ • complete.png  │ │                 │ │
│    │ timeline.jsonl  │ │                 │ │                 │ │
│    └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** Disagreement between views → Human/AI observer review required. Observer judgment > programmatic score.

### 2.2 Five-Layer Scoring (L1-L5)

| Layer | Score | What | How to Verify | Anti-Cheat Note |
|-------|-------|------|---------------|-----------------|
| **L1** | 0-1.0 | Claude responds | Left pane changes from initial state | Must be triggered by `tmux send-keys`, not API |
| **L2** | 0-1.0 | Understands task | Keywords match intent (timing, route, etc.) | Must appear in pane capture, not direct log read |
| **L3** | 0-1.0 | Uses MCP tools | Tool calls visible in left pane | HiTestBot NEVER calls MCP directly |
| **L4** | 0-1.0 | EDA tool responds | Right pane shows tool activity | Real tool output, never simulated/fake |
| **L5** | 0-1.0 | Reports QoR | WNS/TNS/metrics in Claude's response | Metrics from real EDA execution |

**Cheating Detection by Layer:**
- **L1/L2 Cheat:** Reading Claude's internal state instead of pane capture
- **L3 Cheat:** HiTestBot calling MCP tools directly (e.g., `eda.detect_tool()`)
- **L4 Cheat:** Injecting fake tool output with `echo` or simulated responses
- **L5 Cheat:** Using hardcoded metrics instead of actual EDA tool output

**Golden Rule:** If a real human typing at the keyboard couldn't do it the same way, it's cheating.

**Stage Score** = Average of all 5 layers (0.0 to 1.0)

---

## 3. Progressive Test Phases

### Phase 0: Infrastructure (5 min)
**Goal:** HiPilot workspace creates successfully

| Check | Command | Pass Criteria | Evidence |
|-------|---------|---------------|----------|
| tmux session | `bin/hipilot --no-terminal` | Session `hipilot` created | `tmux -L hipilot list-sessions` |
| Display | gnome-terminal | Window opens, 80% desktop | Screenshot |
| Claude starts | Auto-launched | ❯ prompt within 60s | claude_full.log |
| MCP servers | Auto-registered | 3 servers in settings.json | mcp_calls.jsonl entries |

**Failure Modes:**
- `tmux` not installed → Install tmux
- `claude` not found → Check PATH
- Display unavailable → Verify :0 accessible

---

### Phase 1: Claude Responds (5 min)
**Goal:** Basic interaction works

```bash
bin/hitestbot-eda "hello"
```

| Check | Expected | Score |
|-------|----------|-------|
| L1: Claude responds | Left pane shows response | ≥ 1.0 |
| L2: Coherent | Response makes sense | ≥ 0.5 |

**Failure Modes:**
- Trust prompt not handled → Fix bin/hipilot auto-acknowledge
- Bypass permissions blocked → Check --dangerously-skip-permissions

---

### Phase 2: MCP Tool Call (10 min)
**Goal:** MCP infrastructure functional

```bash
bin/hitestbot-eda "check what EDA tools are available"
```

| Check | Expected | Score |
|-------|----------|-------|
| L3: Uses MCP | `eda.detect_tool` or `eda.get_status` called | ≥ 0.5 |
| Result | Tool status reported | Any result acceptable |

**Failure Modes:**
- MCP feature gate → Use --mcp-config workaround
- Bash deny pattern → Fix settings.json permissions

---

### Phase 3: Start EDA Tool (15 min)
**Goal:** EDA tool launches in right pane

```bash
bin/hitestbot-eda "start innovus for the ibex design"
```

| Check | Expected | Score |
|-------|----------|-------|
| L3: Tool call | `eda.start_tool` with tool="innovus" | ≥ 0.5 |
| L4: Tool responds | `innovus 1>` prompt appears | ≥ 0.5 |

**Failure Modes:**
- License unavailable → Check lmstat, restart flexlm
- Design path wrong → Verify /home/EDA/ibex_work_upload exists
- Tool crashes → Check tool setup scripts

---

### Phase 3.5: Manual Mode Workflow (20 min)
**Goal:** HiPilot manual approval workflow works for safety-critical operations

**Background:** HiPilot has two modes:
- **Auto mode** (default): Tcl executes immediately
- **Manual mode**: Tcl is previewed and requires `prefix+y` (Ctrl+B then y) to approve

This phase tests that a human can safely review and approve Tcl before execution.

```bash
# Step 1: Enable manual mode and generate Tcl
bin/hitestbot-eda "enable manual mode, then generate a timing report Tcl"

# Step 2: Approve the pending Tcl
# HiTestBot presses: prefix+y (Ctrl+B, then y)

# Step 3: Verify execution
# HiTestBot waits for EDA completion and QoR output
```

**HiTestBot Actions (Virtual Human):**

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Type command to enable manual mode | Status bar shows `MODE: MANUAL` |
| 2 | Request Tcl generation | Left pane shows `[⏳ Pending Approval]` badge |
| 3 | **Press `prefix+y`** (Ctrl+B, y) | HiTestBot sends keystrokes via tmux |
| 4 | Wait for execution | Right pane shows EDA activity |
| 5 | Verify QoR reported | WNS/TNS numbers in Claude response |

**Scoring (L1-L5):**

| Layer | Criteria | Evidence |
|-------|----------|----------|
| L1 | Command typed and acknowledged | Screenshot shows prompt response |
| L2 | Manual mode understood | Keywords: "manual", "pending", "approval" |
| L3 | No premature MCP execution | MCP log shows `awaiting_approval` state before `send_to_terminal` |
| L4 | EDA executes AFTER approval | Timestamp: EDA activity after `prefix+y` sent |
| L5 | QoR reported | WNS/TNS in Claude output |

**Status Bar Verification:**

| State | Expected Status Bar | Screenshot Check |
|-------|---------------------|------------------|
| Initial | `MODE: AUTO` | `obs_stage_start.png` |
| After manual cmd | `MODE: MANUAL` | `obs_ai_responded.png` |
| Tcl pending | `MODE: MANUAL | PENDING` | Screenshot before approval |
| Executing | `MODE: MANUAL | RUNNING` | Screenshot during execution |
| Complete | `MODE: MANUAL` | `obs_stage_complete.png` |

**Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| Mode toggle fails | Status bar still shows AUTO | `hipilot-tmux` server not updating status | Check `mode.js` file-based state |
| `prefix+y` ignored | No EDA activity after approval | Wrong tmux socket or key sequence | Verify `-L hipilot` and key timing |
| Tcl executes without approval | No pending state visible | Manual mode not actually enabled | Check `eda.generate_tcl` respects mode flag |
| Approval too slow | Timeout waiting for prompt | Human-like delay needed between Ctrl+B and y | HiTestBot should wait 100ms between keys |

**Pass Criteria:**
- L3 ≥ 0.5 (approval gate actually worked — Tcl didn't execute before `prefix+y`)
- L4 ≥ 0.5 (EDA executed after approval)
- Status bar transitions verified in screenshots
- MCP log shows correct state sequence: `generating → pending → approved → executing → complete`

**HiTestBot Implementation Note:**

```javascript
// In FlowCertifier.js - manual mode approval sequence
async approvePendingTcl() {
  // Send prefix key (Ctrl+B)
  execSync(`tmux -L ${this.socket} send-keys -t 0.0 C-b`);
  await sleep(100); // Human-like pause

  // Send 'y' to approve
  execSync(`tmux -L ${this.socket} send-keys -t 0.0 y`);

  // Log the approval action
  this._runLog('Sent prefix+y to approve pending Tcl');
}
```

**Anti-Cheat Verification for Phase 3.5:**

| Check | Expected | Why It Matters |
|-------|----------|----------------|
| Input method | `tmux send-keys` only | Human-like typing, not API calls |
| Approval trigger | Physical key sequence (Ctrl+B, y) | Tests actual keyboard shortcut |
| No premature execution | MCP log shows `awaiting_approval` BEFORE `send_to_terminal` | Verifies approval gate works |
| Evidence timing | Screenshots show state transitions | Visual proof, not just logs |
| Right pane activity | EDA tool runs AFTER approval | Confirms execution only after human approval |

**FAILURE TO CHEAT DETECTION:**
- If HiTestBot calls `eda.approve_pending()` directly → `CHEAT_DETECTED`
- If Tcl executes without `prefix+y` being sent → Test fails (L3 = 0)
- If MCP logs show activity before pane capture shows it → `EVIDENCE_MISMATCH`

---

### Phase 4: Generate and Execute Tcl (15 min)
**Goal:** End-to-end Tcl execution pipeline

```bash
bin/hitestbot-eda "generate a timing report and execute it"
```

| Check | Expected | Score |
|-------|----------|-------|
| L3: Tcl generated | `[✓ Template]` badge visible | ≥ 0.5 |
| L4: Tcl executed | Right pane shows report_timing output | ≥ 0.5 |
| L5: QoR reported | WNS/TNS numbers in response | ≥ 0.5 |

**Failure Modes:**
- Template not found → Check template_path in skill metadata
- Tcl syntax error → Check EDA server version compatibility
- No timing data → Design may be in physical-only mode

---

### Phase 5: Single Stage Execution (30 min)
**Goal:** One complete P&R stage (design init)

```bash
bin/hitestbot-eda "run stage 1: design init with MMMC setup"
```

| Check | Expected | Evidence |
|-------|----------|----------|
| Skill loaded | `knowledge.get_skill` called | mcp_calls.jsonl |
| Tcl sent | MMMC setup + init_design | eda_full.log |
| Checkpoint saved | `init_design.enc` exists | File check |
| Tool exits | Innovus exits cleanly | eda_full.log |

**Pass Criteria:**
- L4 ≥ 0.5 (tool ran)
- Checkpoint file exists
- No ERROR in logs

---

### Phase 6: Multi-Stage Flow (60 min)
**Goal:** 4+ stages in sequence

```bash
bin/hitestbot-eda "/synthesis"
bin/hitestbot-eda "/floorplan"
bin/hitestbot-eda "/powerplan"
bin/hitestbot-eda "/placement"
```

| Stage | Checkpoint | Duration | Verify |
|-------|------------|----------|--------|
| 1. Synthesis | synthesis.enc | 5 min | File exists |
| 2. Floorplan | floorplan.enc | 1 min | File exists |
| 3. Power Plan | powerplan.enc | 1 min | File exists |
| 4. Placement | placement.enc | 5 min | WNS reported |

**Pass Criteria:**
- All 4 checkpoints exist
- L5 ≥ 0.5 (QoR reported)
- No stage fails

---

### Phase 7: Full RTL2GDS to GDS (120 min)
**Goal:** Complete flow, GDS output

```bash
bin/hitestbot-eda "/synthesis"
bin/hitestbot-eda "/floorplan"
bin/hitestbot-eda "/powerplan"
bin/hitestbot-eda "/placement"
bin/hitestbot-eda "/cts"
bin/hitestbot-eda "/postcts-opt"
bin/hitestbot-eda "/routing"
bin/hitestbot-eda "/routeopt"
bin/hitestbot-eda "/chipfinish"
```

| Stage | Checkpoint | Verify |
|-------|------------|--------|
| 5. CTS | cts.enc | Clock tree built |
| 6. Post-CTS Opt | post_cts_opt.enc | Hold fixed |
| 7. Routing | routing.enc | 100% routed |
| 8. Route Opt | routing_opt.enc | DRC clean |
| 9. Chip Finish | chip_done.enc | Final checkpoint |
| 10. GDS Export | ibex_core.gds | File > 10MB |

**Graduation Criteria:**
- All 10 stages complete
- GDS file exists and > 10MB
- Final timing report generated
- Fresh evidence (timestamps after test start)
- Timing closure achieved (WNS ≥ 0 or within signoff tolerance)

**Gold Certification Example (Test 20260304035335):**
```
Score: 3.5/5 (improvement from 2.5/5)
Duration: 7203s (2 hours)
Stages: 9/9 complete (all stages in single Innovus session)
GDS: 19 MB (fresh creation during test)
WNS: +0.136 ns (positive slack, timing met)
TNS: 0.000 ns
Violating Paths: 0
Status: GOLD CERTIFIED ✓
```

**Known Limitations for Long-Running Flows:**
- HiTestBot pane capture may show empty EDA pane after ~2 hours (scrollback limits)
- L3/L4 scores may be artificially low due to observation gaps
- Workaround: Verify via server-side file timestamps (see Section 5.3)

---

## 4. Self-Improvement System

### 4.1 Failure Classification

Every failure is classified into one of these categories:

| Category | Owner | Fix Type | Examples |
|----------|-------|----------|----------|
| `infrastructure` | DevOps | Environment | License, disk, network |
| `configuration` | User | Setup | Paths, constraints, settings |
| `methodology` | HiPilot Team | Code | Flow steps, Tcl commands |
| `ai_behavior` | CLAUDE.md | Prompt | Misunderstanding, wrong tool |
| `tool_bug` | Vendor | Workaround | Actual EDA tool defects |

### 4.2 Iteration Loop

```
ITERATION N:
  FOR phase 0..target:
    RUN phase test
    IF phase passes:
      MARK passed
    ELSE:
      CLASSIFY failure (category, root cause)
      RECORD fix (what changed)
      APPLY fix if automatic
      UPDATE knowledge base
      STOP (retry in next iteration)

  IF all phases passed:
    VERIFY graduation criteria
    IF verified: GRADUATE
    ELSE: CONTINUE with stricter criteria
```

### 4.3 Knowledge Base Updates

After each iteration, update:

```yaml
# test-evidence/knowledge_base.yaml
failures:
  - id: F001
    pattern: "license checkout failed"
    category: infrastructure
    fix: "Restart flexlm: lmutil lmdown && lmutil lmdown -c license.dat"
    auto_apply: true

  - id: F002
    pattern: "No paths with slack less than 0.000"
    category: configuration
    fix: "Check SDC constraints for current_design command"
    auto_apply: false

  - id: F003
    pattern: "physical-only mode"
    category: methodology
    fix: "Use init_design with MMMC, not just LEF"
    skill_update: skills/design-init.md
```

### 4.4 Skill Auto-Update

When a `methodology` failure is detected:

1. Analyze the failure pattern
2. Check if skill documentation needs update
3. Propose skill improvement PR
4. Track skill version vs failure rate

---

## 5. Evidence Standards

### 5.1 Required Evidence Structure

```
test-evidence/<test_id>/
├── FLOW_REPORT.md              # L1-L5 scores, stage-by-stage
├── test_metadata.json          # Test config, duration, result
├── run_log.txt                 # HiTestBot actions and state transitions
├── knowledge_base_updates.yaml # New failures/Fixes discovered
├── logs/
│   ├── claude_full.log         # Left pane (10000 lines)
│   ├── eda_full.log            # Right pane (10000 lines)
│   └── mcp_calls.jsonl         # MCP tool call log
├── screenshots/
│   ├── 00_launch.png
│   ├── 01_command_typed.png
│   ├── 02_during_execution.png
│   └── 03_completion.png
├── recordings/
│   └── desktop_recording.mp4   # Full test video
└── timeline.jsonl              # Synchronized event timeline
```

### 5.2 Freshness Validation

```javascript
function validateFreshness(file, testStartTime) {
  const stats = fs.statSync(file);
  const createTime = stats.birthtimeMs;

  // 5-second buffer for filesystem precision
  if (createTime < testStartTime - 5000) {
    return {
      valid: false,
      error: 'STALE_EVIDENCE',
      ageMinutes: Math.round((testStartTime - createTime) / 60000)
    };
  }
  return { valid: true };
}
```

### 5.3 Evidence Timeline Verification (Post-Test)

For long-running flows (>1 hour), HiTestBot pane capture may lose EDA output due to scrollback limits or session resets. Verify flow completion via server-side file timestamps:

**Verification Steps:**

1. **Collect Test Timeline from Evidence:**
   ```bash
   # Test start (from timeline.jsonl)
   test_start=$(head -1 timeline.jsonl | jq -r '.timestamp')
   test_end=$(tail -1 timeline.jsonl | jq -r '.timestamp')

   # Convert to server timezone (if different)
   # EDA server: UTC+8, Evidence collected: UTC
   ```

2. **Check Server-Side File Timestamps:**
   ```bash
   # GDS file must be created DURING test window
   ssh EDA@192.168.112.163 "stat /home/EDA/ibex_work_upload/result/pr/data/ibex_core.gds"

   # Expected output format:
   # Modify: 2026-03-04 12:44:26.987149273 +0800
   ```

3. **Validate Time Window Alignment:**
   | Timezone | Test Start | Test End | GDS Created | Status |
   |----------|------------|----------|-------------|--------|
   | UTC | 03:53:35 | 05:57:38 | 04:44:26 | ✓ Within window |
   | UTC+8 (Server) | 11:53:35 | 13:57:38 | 12:44:26 | ✓ Within window |

4. **Required Artifacts for Gold Certification:**
   - GDS file > 10MB with timestamp after test start
   - Final checkpoint (chip_done.enc) timestamp matches GDS
   - EDA log shows "STAGE 9 COMPLETE" or equivalent
   - 0 ERROR messages in final stage log

**Example Timeline (Test 20260304035335):**
```
Timeline Event                     UTC Time        Local (UTC+8)
─────────────────────────────────────────────────────────────────
HiTestBot test start               03:53:35        11:53:35
/synthesis command typed           03:54:00        11:54:00
/floorplan command typed           03:59:00        11:59:00
/powerplan command typed           04:00:00        12:00:00
/placement command typed           04:01:00        12:01:00
/cts command typed                 04:06:00        12:06:00
/postcts-opt command typed         04:11:00        12:11:00
/routing command typed             04:16:00        12:16:00
/routeopt command typed            04:26:00        12:26:00
/chipfinish command typed          04:36:00        12:36:00
Stage 9 complete (GDS exported)    ~04:44:00       ~12:44:00  ← GDS created
HiTestBot observation end          05:57:38        13:57:38
Evidence downloaded                05:59:00        13:59:00
─────────────────────────────────────────────────────────────────
Duration: 2 hours 4 minutes
Result: GDS created at 12:44:26 (within test window) ✓
```

### 5.4 Tool Execution Validation

```javascript
function validateToolExecution(edaLog) {
  const echoOnly = /^\[EDA@.*\]\$ echo/;
  const toolPatterns = [
    /innovus\s*\d+>/,
    /dc_shell>/,
    /pt_shell>/,
    /Placement completed/,
    /Routing completed/,
    /streamOut.*completed/
  ];

  const lines = edaLog.split('\n').filter(l => l.trim());

  if (lines.every(l => echoOnly.test(l))) {
    return { valid: false, error: 'ECHO_ONLY_NO_TOOL_EXECUTION' };
  }

  if (!toolPatterns.some(p => lines.some(l => p.test(l)))) {
    return { valid: false, error: 'NO_TOOL_ACTIVITY_DETECTED' };
  }

  return { valid: true };
}
```

### 5.5 Scoring Adjustments for Long-Running Flows

**Problem:** For flows exceeding 2 hours, HiTestBot may lose EDA pane output due to tmux scrollback limits or session resets. This causes artificially low L3/L4 scores despite successful flow completion.

**Solution:** Use multi-factor verification when pane logs are incomplete:

| Factor | Weight | Verification Method |
|--------|--------|---------------------|
| File timestamps | High | Server-side `stat` of output files |
| Claude output | High | Success message in left pane |
| EDA pane snippet | Medium | Final 50 lines showing completion |
| QoR metrics | High | WNS/TNS numbers in Claude response |

**Adjusted Scoring Rules:**
- If GDS file is fresh (>10MB, created during test) → L4 ≥ 0.5 regardless of pane capture
- If WNS/TNS reported in Claude's summary → L5 ≥ 0.5
- If "STAGE X COMPLETE" visible in any evidence → L3 ≥ 0.5
```

---

## 6. Graduation Criteria

### 6.1 Flow Certification Levels

| Level | Phases Required | Evidence | Use Case |
|-------|-----------------|----------|----------|
| **Bronze** | 0-4 | MCP works, Tcl executes | Development, debugging |
| **Silver** | 0-6 | Multi-stage flow | CI/CD integration |
| **Gold** | 0-7 + GDS | Full RTL2GDS | Production release |
| **Platinum** | 0-7 + GDS, 3 consecutive passes | Reliable automation | Customer deployment |

### 6.2 Graduation Report Template

```
═══════════════════════════════════════════════════════════
  HiPilot Flow Certification: GOLD
═══════════════════════════════════════════════════════════

Test ID: hipilot_v3_20260301_120000
Total Iterations: 3
Total Time: 145 minutes
Phases Completed: 8/8
Certification Level: GOLD

Iteration History:
  Iteration 1: Phase 6 failed (congestion) → Reduced utilization 80%→70%
  Iteration 2: Phase 4 failed (license) → Restarted flexlm
  Iteration 3: ALL PHASES PASSED

Evidence Summary:
  Screenshots: 12
  Video: desktop_recording.mp4 (2.3GB)
  MCP Calls: 1,247
  Result Files:
    - ibex_core.gds: 19.3 MB ✓
    - chip_done.enc: 5.1 MB ✓
    - qor.rpt: 245 KB ✓

Quality Metrics:
  WNS: +0.01ns
  TNS: 0.00ns
  Congestion: 3.2%
  DRC Violations: 0

Knowledge Base Updates:
  + Added fix F004: "High congestion at 80% utilization"
  + Updated skill: skills/floorplan.md (utilization guidance)

Next Test Recommendation:
  Platinum certification: Run 2 more consecutive passes

Evidence Location: test-evidence/hipilot_v3_20260301_120000/
```

---

## 7. Execution Guide

### 7.1 Pre-Flight Checklist

```bash
# 1. EDA server connectivity
ssh EDA@192.168.112.163 "echo 'SSH OK'"

# 2. License server
ssh EDA@192.168.112.163 "lmutil lmstat -c 27000@localhost"

# 3. Design tarball
ssh EDA@192.168.112.163 "ls -la /home/EDA/ibex_demo.tar"

# 4. Display
ssh EDA@192.168.112.163 "DISPLAY=:0 xset q"

# 5. Clean state
ssh EDA@192.168.112.163 "pkill -f innovus; pkill -f dc_shell"
```

### 7.2 Run Test

```bash
# Bronze certification (Phases 0-4)
bin/hitestbot-eda "hello"
bin/hitestbot-eda "check what EDA tools are available"
bin/hitestbot-eda "start innovus"
bin/hitestbot-eda "generate timing report"

# Silver certification (Phases 0-6)
bin/hitestbot-eda "/synthesis"
bin/hitestbot-eda "/floorplan"
bin/hitestbot-eda "/powerplan"
bin/hitestbot-eda "/placement"

# Gold certification (Full modular stage flow)
bin/hitestbot-eda "/synthesis"
bin/hitestbot-eda "/floorplan"
bin/hitestbot-eda "/powerplan"
bin/hitestbot-eda "/placement"
bin/hitestbot-eda "/cts"
bin/hitestbot-eda "/postcts-opt"
bin/hitestbot-eda "/routing"
bin/hitestbot-eda "/routeopt"
bin/hitestbot-eda "/chipfinish"

# With environment variables
export HIPILOT_TEST_LOG=/tmp/hipilot_test_mcp.jsonl
export RALPH_TARGET_PHASE=7
bin/hitestbot-eda "/synthesis"
```

### 7.3 Collect and Review Evidence

```bash
# Download from EDA server
bin/hitestbot-pull <test_id>

# View report
cat test-evidence/<test_id>/FLOW_REPORT.md

# Analyze timeline
cat test-evidence/<test_id>/timeline.jsonl | jq -c 'select(.type=="mcp_call")'

# Check knowledge base updates
cat test-evidence/<test_id>/knowledge_base_updates.yaml
```

### 7.4 Anti-Cheat Verification Checklist

Before trusting test results, verify:

```bash
# 1. HiTestBot used tmux-only interaction
grep -E "tmux (send-keys|capture-pane)" test-evidence/<test_id>/run_log.txt
# Should see: tmux -L hipilot send-keys -t 0.0 ...
# Should NOT see: direct MCP tool calls from HiTestBot

# 2. No direct MCP calls from HiTestBot
grep -i "cheat\|direct.*mcp\|bypass" test-evidence/<test_id>/FLOW_REPORT.md
# Should NOT see: CHEAT_DETECTED

# 3. Real EDA tool execution
ssh EDA@192.168.112.163 "head -50 /home/EDA/ibex_work_upload/result/pr/log/innovus.log"
# Should see: Real Innovus output, not echo/fake output

# 4. Evidence timestamps are fresh
ls -la test-evidence/<test_id>/logs/
# All files should have timestamps AFTER test start time

# 5. Screenshots show actual UI state
file test-evidence/<test_id>/screenshots/*.png
# Should be valid PNG files with reasonable sizes (>10KB)
```

**Red Flags (Test Invalidated):**

| Flag | Meaning | Action |
|------|---------|--------|
| `CHEAT_DETECTED` in report | HiTestBot called MCP directly | Review FlowCertifier.js anti-cheat checks |
| Empty screenshots | tmux interaction failed | Check tmux socket and display |
| EDA log shows only `echo` commands | Fake tool execution | Verify real EDA tools are installed |
| Evidence older than test start | Stale/staged evidence | Run fresh test with clean state |
| MCP log shows calls before pane capture | Superhuman knowledge | HiTestBot read logs during test |

---

## 8. Maintenance

### 8.1 When to Update This Plan

- New MCP tools added → Update Phase 2/3/4 expectations
- New skills added → Update Phase 5/6/7 stages
- Tool versions change → Update EDA tool versions
- New failure patterns discovered → Update Section 4.3

### 8.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.3 | 2026-03-15 | **Anti-Cheat Charter** (Section 1.2): Explicit No Mock/No Bypass rules. Human-like testing enforcement. Anti-cheat verification for Phase 3.5. Trust through real behavior testing. |
| 3.2 | 2026-03-15 | Added Phase 3.5 Manual Mode Workflow test, HiTestBot approval sequence, status bar verification criteria |
| 3.1 | 2026-03-04 | Added evidence timeline verification (Section 5.3), scoring adjustments for long-running flows (Section 5.5), Phase 7 Gold certification achieved |
| 3.0 | 2026-03-01 | Unified all test plans, added self-improvement system |
| 2.0 | 2026-02-25 | Progressive phase testing, MCP feature gate workarounds |
| 1.0 | 2026-02-20 | Initial test plan |

---

## Appendix A: Quick Reference

```bash
# Full modular stage flow certification run
bin/hitestbot-eda "/synthesis"
bin/hitestbot-eda "/floorplan"
bin/hitestbot-eda "/powerplan"
bin/hitestbot-eda "/placement"
bin/hitestbot-eda "/cts"
bin/hitestbot-eda "/postcts-opt"
bin/hitestbot-eda "/routing"
bin/hitestbot-eda "/routeopt"
bin/hitestbot-eda "/chipfinish"

# Check latest test
cat test-evidence/$(ls -t test-evidence/ | head -1)/FLOW_REPORT.md

# Clean evidence
rm -rf test-evidence/

# Deploy latest code
node src/hitestbot/infra/deploy_hipilot.js
```

## Appendix B: File Locations

| File | Purpose |
|------|---------|
| `docs/testing/TEST_PLAN.md` | This document (single source of truth) |
| `docs/testing/TESTING_RULES.md` | Scoring methodology and principles |
| `src/hitestbot/core/FlowCertifier.js` | Test orchestrator |
| `skills/synthesis-stage.md` | Synthesis stage skill |
| `skills/floorplan-stage.md` | Floorplan stage skill |
| `skills/powerplan-stage.md` | Power planning stage skill |
| `skills/placement-stage.md` | Placement stage skill |
| `skills/cts-stage.md` | CTS stage skill |
| `skills/postcts-opt-stage.md` | Post-CTS optimization skill |
| `skills/routing-stage.md` | Routing stage skill |
| `skills/routeopt-stage.md` | Route optimization skill |
| `skills/chipfinish-stage.md` | Chip finish stage skill |
| `deploy/eda-server/.claude/commands/synthesis.md` | Synthesis slash command |
| `deploy/eda-server/.claude/commands/floorplan.md` | Floorplan slash command |
| `deploy/eda-server/.claude/commands/placement.md` | Placement slash command |
