# HiPilot 5-Agent Team Test Plan v3.7

> **One test plan to rule them all.** Self-improving, evidence-based, progressive certification.

**Version:** 3.7
**Status:** Active
**Replaces:** TEST_PLAN_v2.md, TEST_PLAN_v3_*.md, RTL2GDS_TEST_PLAN_OPERATIONAL.md

**Latest Update:** 2026-03-19 - Added 3 new verification categories (Team Protocol, EDA Log, Cross-Reference) to CheatDetector → 17 layers total; unified FlowCertifier with TestReviewBoard 7-phase strict verification

---

## 1. Philosophy

### 1.1 Core Principles

| Principle | Meaning |
|-----------|---------|
| **Progress Over Pass/Fail** | 7/10 stages with detailed failure analysis > binary FAIL |
| **Evidence at Every Layer** | Logs + Screenshots + Video = Three-view correlation |
| **Test Like a Human** | HiTestBot uses HiPilot like a real engineer would |
| **Self-Improving** | Every failure feeds back into the next iteration |
| **Real Tools Only** | No mocks. Real dc_shell, innovus, pt_shell on EDA server. |

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
| **R8: Fresh Working Directory** | Each test uses a timestamped directory on EDA server | Reusing previous test results as evidence |
| **R9: EDA Server Location** | ALL evidence MUST be created on EDA server (192.168.112.163) | Creating evidence locally, then claiming it as EDA test |
| **R10: Minimum Duration** | Tests MUST take minimum realistic time (5+ min absolute minimum, 10+ min for full phases) | Completing 8-phase test in seconds/minutes |
| **R11: Live Video Recording** | ffmpeg MUST be actively recording the desktop during test | Static image as video, no recording, stalled ffmpeg |
| **R12: Remote Verification** | Leader MUST verify evidence exists on EDA server via SSH | Claims of completion without remote verification |
| **R13: EDA Pane Log Required** | EDA pane log (pane1_continuous.log) MUST exist with real tool output (innovus prompts, saveDesign, etc.) | Missing pane log or echo-only content |

**Why This Matters:**
- If HiTestBot bypasses HiPilot's UI, it could miss bugs a real human would encounter
- If HiTestBot reads MCP logs during the test, it gains "superhuman" knowledge
- If synthetic EDA output is used, the test proves nothing about real-world operation

**Enforcement (17-Layer Cheat Detection — Strict Defaults, Fail-Closed):**
- CheatDetector.js implements 17 mandatory verification layers organized into 3 categories (all required by default):

**Category A: Core Evidence Verification (Layers 1-7)**
  1. **Process Verification** - CRITICAL if < 5 Claude processes (5-Agent Team must be complete)
  2. **Echo Command Detection** - Detect fake status output patterns
  3. **Pane Content Verification** - Verify real Claude interface indicators
  4. **MCP Log Integrity** - Validate JSON structure, timestamps, and minimum 50 calls
  5. **Cross-Reference Validation** - Correlate pane logs with MCP logs
  6. **Interactive Verification** - Send test commands, verify real responses
  7. **Video Motion Detection** - Verify video shows actual activity

**Category B: Evidence Quality (Layers 8-14)**
  8. **Evidence Freshness** - Files must be < 15 minutes old (not 1 hour)
  9. **Evidence Location** - Verify evidence is on EDA server (not local)
  10. **Desktop Visibility** - Mandate screenshots showing EDA server desktop
  11. **Minimum Duration** - CRITICAL if < 5 minutes absolute (fail-fast on speed cheats)
  12. **Active Video Stream** - Verify ffmpeg is actively recording
  13. **Remote Verification** - SSH verify evidence exists on EDA server
  14. **EDA Pane Log** - CRITICAL: pane1_continuous.log must exist with real tool output (innovus prompt, saveDesign, compile_ultra, etc.); echo-only content = automatic FAIL

**Category C: Team Protocol & EDA Verification (Layers 15-17) [v3.7]**
  15. **Team Protocol Verification** (HIGH):
      - `verifyFiveAgentProcesses()` - Verify 5 actual Claude processes via process tree
      - `validateSendMessageStructure()` - Validate JSON structure of SendMessage calls
      - `verifyKnowledgeAsHub()` - Ensure hub-and-spoke communication pattern via Knowledge Agent
      - `verifyMessageSequence()` - Verify correct message ordering in team protocol
  16. **EDA Log Verification** (HIGH):
      - `extractQorMetrics()` - Parse WNS, TNS, area, cell count, power from EDA logs
      - `verifyCheckpointFiles()` - Verify .enc checkpoint files exist after saveDesign
      - `parseErrors()` - Extract ERROR/WARNING messages from EDA tool output
      - `verifyToolExecutionDuration()` - Verify >30s actual tool execution time
      - `verifyEdaPaneLogEnhanced()` - Combined EDA log verification
  17. **Cross-Reference Verification** (MEDIUM):
      - `verifyProcessStateDuringMcpCall()` - Confirm EDA process running during MCP tool calls
      - `verifyStageOrder()` - Verify stage N completed before N+1 begins

- **Fail-closed**: if MCP log, EDA log, or evidence files are absent → CRITICAL FAIL (not a warning)
- Any test with critical cheat detection = `CHEAT_DETECTED` and automatic FAIL
- Evidence must show tmux-based interaction from EDA server only

**Test Isolation Requirements:**
- Tests MUST run in timestamped directories on EDA server (e.g., `/home/EDA/hipilot_test/runs/ibex_20260315_143022/`)
- Evidence MUST be collected from the current test run only on EDA server
- Previous test results CANNOT be referenced as evidence for the current test
- EDA tool output files must be created DURING the test, not copied from previous runs
- Freshness validation: All output files must have timestamps after test start time (Section 5.2)
- **Location validation**: Evidence path must contain `/home/EDA/` or be verifiable via SSH to EDA server

### 1.3 The North Star

> **HiPilot 5-Agent Team can conduct a complete RTL-to-GDS flow driven by Claude Code, MCP tools, and skills — proving that an AI Agent Team can replace a human for standard flow execution.**

### 1.4 Why Anti-Cheat Matters

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

### 1.3 5-Agent Team Architecture (Default in v0.8.0+)

> **HiPilot v0.8.0+ operates as a 5-Agent Team by default.** The legacy 2-pane mode (`bin/hipilot --simple`) is deprecated and only for debugging.

**Agent Layout (6 Panes):**

```
┌────────────────────────────────────────────────────────────┐
│  Supervisor │  Knowledge   │   Planner    │   Executor    │  ← Top Row
│  (Pane 0)   │  (Pane 1)    │  (Pane 2)    │   (Pane 3)    │
├────────────────────────────────────────────────────────────┤
│              Archivist Agent (Pane 4)                     │  ← Middle
├────────────────────────────────────────────────────────────┤
│              EDA Tool Pane (Pane 5)                       │  ← Bottom
│              (Innovus / DC Shell / PrimeTime)             │
└────────────────────────────────────────────────────────────┘
```

**Agent Responsibilities:**

| Agent | Role | Primary Function |
|-------|------|------------------|
| **Supervisor** | Coordinator | Validates prerequisites, coordinates flow phases, communicates with engineer |
| **Knowledge** | Brain Hub | **Owns all 3 brains** (ASIC + EDA + Project). Central interface for all agent queries |
| **Planner** | Strategist | Creates execution strategies by querying Knowledge Agent |
| **Executor** | Operator | Generates Tcl via Knowledge, executes via EDA MCP, monitors output |
| **Archivist** | Recorder | Records QoR metrics and learnings to Project-Brain |

**Hub-and-Spoke Communication:**

All agents communicate **through the Knowledge Agent** — they never talk directly to each other.

```
Supervisor → Knowledge ← Planner
      ↓         ↓           ↓
   (status)  (brains)   (strategy)
      ↑         ↑           ↑
Archivist → Knowledge ← Executor
```

**Testing Implications:**

- HiTestBot interacts primarily with the **Supervisor pane (0.0)**
- Agent coordination is verified by checking that Knowledge Agent responds to queries
- The 3-brain system is owned exclusively by Knowledge Agent (other agents query it)
- All 5 agents must be active for a valid test (Phase 4.5: Agent Coordination Verification)

### 1.4 Legacy Mode vs Team Mode

| Aspect | Legacy Mode (Deprecated) | Team Mode (Default v0.8.0+) |
|--------|--------------------------|----------------------------|
| Command | `bin/hipilot --simple` | `bin/hipilot` |
| Panes | 2 (Claude + EDA) | 6 (5 agents + EDA) |
| Architecture | Single Claude | 5 specialized agents |
| Communication | Direct | Hub-and-spoke via Knowledge |
| Testing Focus | Individual tool execution | Agent coordination + execution |

### 1.5 EDA Server Testing Mandate: Real Tools, Real Flows, Real Hardware

> **ALL testing MUST be performed on the EDA server with real EDA tools. No local testing, no mocks, no simulations.**

**Why EDA Server Testing is Mandatory:**

HiPilot is designed to control real EDA tools (Innovus, DC Shell, PrimeTime) running on real hardware with real licenses. Testing anywhere else is meaningless because:

| Testing Location | Problem | Why It Fails |
|-----------------|---------|--------------|
| **Local development machine** | No EDA tools installed | Cannot test actual tool integration |
| **Mocked/simulated tools** | Fake tool responses | Doesn't prove real-world viability |
| **Container without licenses** | Tools won't start | Cannot test license interaction |
| **CI/CD cloud runner** | No EDA software available | Completely invalid test environment |

**The EDA Server (192.168.112.163):**

| Component | Specification | Purpose |
|-----------|---------------|---------|
| **Host** | `EDA@192.168.112.163` | Dedicated EDA workstation |
| **OS** | CentOS 7.9 | Compatible with EDA tool versions |
| **EDA Tools** | Innovus v20.10, DC Shell L-2016.03-SP2, PrimeTime T-2022.03 | Real tool versions used in production |
| **License Server** | flexlm @ localhost:27000 | Commercial licenses required |
| **Design** | Ibex RISC-V CPU (Skywater 130nm) | Real design with real constraints |
| **Node.js** | v20.18.3 | Runtime for HiPilot and HiTestBot |
| **Display** | :0 (GNOME desktop) | Required for video/screenshot evidence |

**Code Deployment Synchronization Rule:**

> **The EDA server MUST have the EXACT same code as the development machine before EVERY test. No exceptions.**

**Why This Matters:**

Testing with stale code on the EDA server produces meaningless results. If you fix a bug locally but don't deploy to the EDA server, the test will "fail" with the old bug, wasting time and creating confusion.

| Scenario | Risk | Result |
|----------|------|--------|
| Test without deploying | EDA server runs stale code | False failures, wasted debugging |
| Deploy outdated code | Test doesn't include latest fixes | Invalid test results |
| Manual file copy | Partial/inconsistent deployment | Unpredictable behavior |
| Skip deployment verification | Assume code is current when it's not | Misleading evidence |

**Mandatory Deployment Checklist:**

```bash
# BEFORE EVERY TEST - Run these steps:

# 1. Check git status - ensure all changes are committed
#    ANY uncommitted changes will NOT be deployed!
git status
# Expected: "nothing to commit, working tree clean"

# 2. Verify current commit hash
git rev-parse --short HEAD
# Save this hash: you'll verify it on the EDA server

# 3. Deploy to EDA server
node src/hitestbot/infra/deploy_hipilot.js

# 4. VERIFY deployment succeeded - check commit hash on EDA server
ssh EDA@192.168.112.163 "cd /home/EDA/hipilot/current && git rev-parse --short HEAD"
# MUST match the hash from step 2!

# 5. Only proceed if hashes match
# If mismatch → Re-run deployment, check for errors
```

**Deployment Verification Script:**

Add this to your test workflow to enforce deployment sync:

```bash
#!/bin/bash
# verify_deployment.sh - Run before every test

LOCAL_HASH=$(git rev-parse --short HEAD)
ssh EDA@192.168.112.163 "cd /home/EDA/hipilot/current && git fetch && git rev-parse --short HEAD" > /tmp/eda_hash.txt
EDA_HASH=$(cat /tmp/eda_hash.txt)

if [ "$LOCAL_HASH" != "$EDA_HASH" ]; then
    echo "ERROR: Code mismatch!"
    echo "Local:  $LOCAL_HASH"
    echo "EDA:    $EDA_HASH"
    echo "Run: node src/hitestbot/infra/deploy_hipilot.js"
    exit 1
fi

echo "✓ Code synchronized: $LOCAL_HASH"
exit 0
```

**Deployment Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| Uncommitted changes | `git status` shows modified files | Forgot to commit | `git add . && git commit -m "..."` |
| SSH connection failed | `ssh EDA@192.168.112.163` hangs | Network down, server offline | Check network, restart server |
| Permission denied | `scp` or `rsync` fails | Wrong user/password | Verify credentials in deploy script |
| Partial deployment | Some files updated, others not | Interrupted transfer | Re-run deployment |
| Wrong branch | EDA has different branch | Branch not pushed | `git push origin <branch>` |

**No Testing Without Deployment Rule:**

- ❌ **NO** testing if `git status` shows uncommitted changes
- ❌ **NO** testing without running `deploy_hipilot.js`
- ❌ **NO** testing if deployment verification fails
- ❌ **NO** assuming code is current "because I deployed earlier"
- ✅ **ALWAYS** verify commit hash matches before testing
- ✅ **ALWAYS** deploy after EVERY code change, no matter how small

**5-Agent Team Test Execution Model:**

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT MACHINE                             │
│  (Edit code, commit changes, verify git status clean)                  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1. git status (must be clean)
                                    │ 2. git rev-parse --short HEAD
                                    │ 3. node src/hitestbot/infra/deploy_hipilot.js
                                    │ 4. Verify EDA hash matches
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         EDA SERVER (192.168.112.163)                   │
│                                                                         │
│   ┌─────────────────────┐    ┌─────────────────────────────────────┐  │
│   │  HiTestBot          │    │  HiPilot 5-Agent Team Workspace     │  │
│   │  (Node.js)          │    │                                     │  │
│   │                     │    │  ┌──────────┬──────────┬──────────┐ │  │
│   │  • Launches HiPilot │    │  │Supervisor│Knowledge │ Planner  │ │  │
│   │  • Types commands   │    │  │ (pane 0) │ (pane 1) │ (pane 2) │ │  │
│   │  • Captures panes   │    │  └──────────┴──────────┴──────────┘ │  │
│   │  • Takes screenshots│    │  ┌──────────┬──────────┬──────────┐ │  │
│   │  • Records video    │    │  │ Executor │Archivist │   EDA    │ │  │
│   │                     │    │  │ (pane 3) │ (pane 4) │ (pane 5) │ │  │
│   │                     │    │  └──────────┴──────────┴──────────┘ │  │
│   │                     │    │                                     │  │
│   └─────────────────────┘    └─────────────────────────────────────┘  │
│                                                                         │
│   All testing happens HERE ↑                                           │
│   Real tools, real licenses, real flows                                │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ bin/hitestbot-pull
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT MACHINE                             │
│  (Analyze evidence, review FLOW_REPORT.md, iterate)                    │
└────────────────────────────────────────────────────────────────────────┘
```

**Deployment and Execution Workflow:**

```bash
# Step 1: Deploy code to EDA server
node src/hitestbot/infra/deploy_hipilot.js

# Step 2: Run test on EDA server
bin/hitestbot-eda "run synthesis"

# Step 3: Pull evidence back to dev machine
bin/hitestbot-pull <test_id>

# Step 4: Analyze results
cat test-evidence/<test_id>/FLOW_REPORT.md
```

**Pre-Flight EDA Server Checklist:**

| Check | Command | Expected Result |
|-------|---------|-----------------|
| SSH connectivity | `ssh EDA@192.168.112.163 "echo OK"` | `OK` |
| License server | `ssh EDA@192.168.112.163 "lmutil lmstat -c 27000@localhost"` | `License server UP` |
| Innovus available | `ssh EDA@192.168.112.163 "which innovus"` | `/path/to/innovus` |
| DC Shell available | `ssh EDA@192.168.112.163 "which dc_shell"` | `/path/to/dc_shell` |
| Design tarball | `ssh EDA@192.168.112.163 "ls /home/EDA/ibex_demo.tar"` | File exists |
| Display available | `ssh EDA@192.168.112.163 "DISPLAY=:0 xset q"` | Monitor settings |
| Node.js | `ssh EDA@192.168.112.163 "node --version"` | `v20.18.3` |
| HiPilot deployed | `ssh EDA@192.168.112.163 "ls /home/EDA/hipilot/current/bin/hipilot"` | File exists |

**Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| SSH timeout | Connection refused | Network down, server offline | Check network, restart server |
| License unavailable | `lmstat` shows DOWN | flexlm crashed, license expired | Restart flexlm, check license |
| Tool not found | `which innovus` fails | Tool not in PATH | Source tool setup scripts |
| Display error | `xset q` fails | X11 not running | Start GNOME session |
| Old HiPilot code | Test runs with stale version | Deployment failed | Re-run deploy_hipilot.js |
| Design missing | `ibex_demo.tar` not found | Archive deleted | Restore from backup |

**No Exceptions Rule:**

- ❌ **NO** local unit tests that mock EDA tools
- ❌ **NO** CI/CD testing without real EDA software
- ❌ **NO** container-based testing without licenses
- ❌ **NO** simulation or fake tool output
- ✅ **ONLY** real tests on the EDA server with real tools

### Understanding Test Types: Unit vs. E2E

**This Test Plan (TEST_PLAN.md) and TESTING_RULES.md cover END-TO-END (E2E) TESTING ONLY.**

| Aspect | Unit Tests (`npm test`) | E2E Tests (This Plan) |
|--------|------------------------|----------------------|
| **Location** | Local development machine | EDA server (192.168.112.163) |
| **Purpose** | Verify JavaScript code correctness | Verify full HiPilot workflow |
| **Tools Used** | None (mocked/stubbed) | Real Innovus, DC Shell, PrimeTime |
| **Duration** | ~200ms (fast) | 15 min - 2 hours (slow) |
| **What It Tests** | Functions, logic, syntax | Full RTL-to-GDS flow |
| **When to Run** | Before committing code | After deploying to EDA server |
| **Evidence** | Console output | Screenshots, video, EDA logs |

**Unit Tests (`npm test`):**
- Test JavaScript utility functions (shell-escape, paths, risk-analyzer)
- Run in Node.js without any EDA tools
- Verify code syntax and basic logic
- **Cannot** test actual EDA tool integration
- **Cannot** verify HiPilot works with real chip design flows

**E2E Tests (This Test Plan):**
- Test complete HiPilot workflow on real hardware
- Require EDA server with real licenses
- Execute actual RTL-to-GDS flow stages
- Generate real GDS files, timing reports, checkpoints
- **Only way** to verify HiPilot works in production

**Relationship:**
```
Developer Workflow:
┌─────────────────────────────────────────────────────────────┐
│  1. Code Changes → 2. npm test → 3. Deploy → 4. E2E Test    │
│     (local)          (local)      (to EDA)     (on EDA)     │
│                                                             │
│  • Unit tests catch syntax errors quickly                   │
│  • E2E tests verify real-world functionality                │
│  • Both required for production-ready code                  │
└─────────────────────────────────────────────────────────────┘
```

**Important:** Passing unit tests does NOT mean HiPilot works. Only E2E tests on the EDA server with real tools can validate the full system.

### 1.6 Clean Environment Charter: No Contamination, Fresh State Every Test

> **Each test MUST start from a completely clean state. No evidence, logs, or design files from previous runs may influence the current test.**

**Why Clean State Matters:**

| Contamination Source | How It Misleads | Prevention |
|---------------------|-----------------|------------|
| Stale heartbeat files | HiTestBot reads old heartbeat state | Delete `/tmp/hipilot-*-heartbeat.json` before test |
| Leftover EDA logs | Appears tools ran when they didn't | Clean `/tmp/hipilot-*` directories |
| Previous MCP logs | Old tool calls look like current activity | Fresh `HIPILOT_TEST_LOG` path per test |
| Existing checkpoints | Stages appear complete without running | Timestamped work directories |
| Old GDS/ENC files | Flow appears successful without execution | Freshness validation (Section 5.2) |

**Mandatory Pre-Test Cleanup (HiTestBot Responsibility):**

```bash
# FlowCertifier.js performs these steps BEFORE each test:

# 1. Kill any running EDA tools
pkill -f innovus; pkill -f dc_shell; pkill -f pt_shell

# 2. Remove stale heartbeat files
rm -f /tmp/hipilot-*-heartbeat.json

# 3. Clean HiPilot temp directories
rm -rf /tmp/hipilot-EDA-*/

# 4. Kill old tmux sessions
tmux -L hipilot kill-server 2>/dev/null || true

# 5. Create fresh timestamped work directory
mkdir -p /home/EDA/hipilot_test/runs/${timestamp}

# 6. Extract clean design tarball
tar xf /home/EDA/ibex_demo.tar -C ${work_dir}
```

**Verification Steps:**

| Check | Command | Expected Result |
|-------|---------|-----------------|
| No stale heartbeat | `ls /tmp/hipilot-*-heartbeat.json 2>&1` | "No such file or directory" |
| Fresh tmux | `tmux -L hipilot list-sessions 2>&1` | "no server running" |
| Clean temp | `ls /tmp/hipilot-${USER}/` | Empty or doesn't exist |
| Fresh design | `stat ${work_dir}/innovus.log 2>&1` | "No such file" (created during test) |

**Failure Modes:**

| Failure | Symptom | Detection | Fix |
|---------|---------|-----------|-----|
| Stale heartbeat | HiTestBot sees idle state before EDA starts | Heartbeat timestamp > test start time | Delete heartbeat file before test |
| Old EDA processes | "License in use" or port conflicts | Process list shows innovus/dc_shell | Kill all EDA processes before test |
| Contaminated work dir | GDS/checkpoint already exists | File timestamp < test start time | Use timestamped directories only |
| Leftover tmux session | "Session already exists" error | `tmux list-sessions` shows hipilot | Kill tmux server before creating session |

### 1.7 Heartbeat System: Event-Driven Monitoring

> **HiPilot now uses a file-based heartbeat system for event-driven state monitoring, reducing CPU usage and improving reaction time.**

**Architecture:**

```
┌──────────────────┐      emits      ┌──────────────────────────────┐
│  EDA MCP Server  │ ───────────────▶ │ /tmp/hipilot-{session}-      │
│  (await_idle)    │    heartbeat     │ heartbeat.json               │
└──────────────────┘                  └──────────────┬───────────────┘
                                                     │
                              fs.watch() or poll     │
                                                     ▼
                                            ┌──────────────────┐
                                            │  HiTestBot       │
                                            │  (FlowCertifier) │
                                            └──────────────────┘
```

**Heartbeat Schema:**

```json
{
  "timestamp": 1710528000123,
  "state": "running|idle|error|complete|waiting",
  "tool": "innovus",
  "stage": "placement",
  "progress": 75,
  "lastOutput": "...",
  "eta_seconds": 120,
  "metadata": { "polls": 42, "stable_ms": 1500 }
}
```

**HiTestBot Integration:**

| Mode | Polling Interval | CPU Usage | Reaction Time |
|------|-----------------|-----------|---------------|
| **Without Heartbeat** | 1-2 seconds (state-based) | 5-10% | 1-2 seconds |
| **With Heartbeat** | 5 seconds (heartbeat-driven) | ~0.1% | <50ms on state change |
| **Hybrid Fallback** | 5 seconds (if heartbeat stale) | ~0.1% | 5 seconds |

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HIPILOT_HEARTBEAT` | `true` | Enable/disable heartbeat system |
| `HIPILOT_SESSION` | `hipilot` | Session name for heartbeat file |

**Implementation in FlowCertifier.js:**

```javascript
// Start heartbeat monitoring
const heartbeatStarted = this._startHeartbeatWatch();

// Get adaptive poll interval (5s if heartbeat available, 1-2s otherwise)
const pollInterval = this._getPollInterval(lastState);

// Check for heartbeat wakeups during polling
if (this._heartbeatAvailable && this._lastHeartbeat) {
  const hb = this._lastHeartbeat;
  if (hb.state === 'idle' || hb.state === 'complete') {
    // React immediately to idle detection
  }
}
```

**Test Verification:**

| Check | Evidence | Pass Criteria |
|-------|----------|---------------|
| Heartbeat file created | `/tmp/hipilot-*-heartbeat.json` exists | File timestamp during test |
| State transitions logged | `run_log.txt` shows "Heartbeat:" entries | Contains state changes |
| Reduced polling | `run_log.txt` shows 5s intervals when waiting | Poll interval ≥ 5000ms |
| Heartbeat stats | Watch completion log | Shows "heartbeat_wakeups: N" |

**Backward Compatibility:**

- If heartbeat file doesn't exist → falls back to standard polling
- If heartbeat is stale (>10s old) → falls back to standard polling
- HiTestBot works with or without heartbeat system enabled

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

### 2.3 Quantitative Goals & Progress Tracking

**Certification Tier Progression (Quantified):**

| Tier | GPA | Agents Active | Stages Complete | Mission Target |
|------|-----|---------------|-----------------|----------------|
| **Bronze** | ≥ 2.0 | 1 | 1+ | No |
| **Silver** | ≥ 2.5 | 3+ | 3+ | No |
| **Gold** | ≥ 3.0 | 5 | 5+ | Partial |
| **Platinum** | ≥ 3.5 | 5 | 8+ | Yes |

**GPA Calculation:**
```
Stage GPA = (L1 + L2 + L3 + L4 + L5) / 5

Weighted GPA = (L1 + L2 + L3 + L4 + L5 + Authenticity×10) / 15

Where Authenticity = 0.0 if any critical cheat detected, else 1.0
```
**Critical:** Any critical cheat → Authenticity = 0 → **Automatic FAIL** regardless of other scores

**Stage Pass Thresholds:**

| Stage Type | L1 | L2 | L3 | L4 | L5 | Min GPA |
|------------|----|----|----|----|----|---------|
| Single-command | ≥ 1.0 | ≥ 0.5 | ≥ 0.5 | N/A | N/A | 2.0 |
| Tool start | ≥ 1.0 | ≥ 0.5 | ≥ 0.5 | ≥ 0.5 | N/A | 2.0 |
| Tcl execution | ≥ 1.0 | ≥ 0.5 | ≥ 0.5 | ≥ 0.5 | ≥ 0.5 | 2.5 |
| Full stage | ≥ 1.0 | ≥ 0.8 | ≥ 0.8 | ≥ 0.8 | ≥ 0.8 | 3.0 |

**Flow Completion Progress:**
```
Progress % = (Stages Successfully Completed / Total Stages in Flow) × 100
```

| Phase | Stages | Target | Minimum |
|-------|--------|--------|---------|
| Synthesis | 1 | 100% | 100% |
| Design Init | 1 | 100% | 50% |
| Floorplan | 1 | 100% | 50% |
| Placement | 1 | 100% | 50% |
| CTS | 1 | 100% | 50% |
| Routing | 1 | 100% | 50% |
| Chip Finish | 1 | 100% | 50% |
| **Full RTL2GDS** | **6** | **100%** | **67%** |

**Quality Metrics (QoR):**

| Metric | Target | Acceptable | Fails |
|--------|--------|------------|-------|
| **WNS** | ≥ 0 ns | ≥ -0.1 ns | < -0.1 ns |
| **TNS** | = 0 ns | < -1.0 ns | ≥ -1.0 ns |
| **Setup Violations** | = 0 | < 10 | ≥ 10 |
| **Core Utilization** | 65-70% | 50-80% | < 50% or > 80% |
| **DRC Violations** | = 0 | < 100 | ≥ 100 |

**Human-Like Behavior Metrics:**

| Parameter | Value | Range |
|-----------|-------|-------|
| Poll interval | 5000ms | ±30% jitter (3500-6500ms) |
| High attention response | 500ms | 400-600ms |
| Normal attention response | 1500ms | 900-2100ms |
| Low attention response | 3000ms | 1500-4500ms |

**Anti-Cheat Score:**
```
Anti-Cheat Score = 1.0 - (Critical Cheats × 0.5 + Warnings × 0.1)
If Critical Cheats > 0 → Score = 0.0 (FAIL)
```

**Three-View Correlation Score:**
```
Correlation Score = (Log_View_Match + Screenshot_View_Match + Video_View_Match) / 3
```
Where each view match = 1.0 if consistent, 0.5 if partial, 0.0 if contradictory

**Summary of Key Quantitative Targets:**

| Category | Metric | Target | Minimum |
|----------|--------|--------|---------|
| **Certification** | GPA | 3.5 (Platinum) | 2.0 (Bronze) |
| **Flow Completion** | Stages Passed | 8/8 (100%) | 5/8 (62%) |
| **Layer Scores** | L1-L5 Average | 0.8 | 0.5 |
| **Cheat Detection** | Anti-Cheat Score | 1.0 | 1.0 |
| **Human-Like** | Behavior Score | 0.85 | 0.5 |
| **Evidence** | Correlation Score | 1.0 | 0.8 |
| **QoR** | WNS | ≥ 0 | ≥ -0.1 |
| **Targets** | Mission Achievement | 100% | 75% |

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

### Phase 0.5: Clean Environment & Heartbeat System (2 min)
**Goal:** Verify clean state and heartbeat monitoring active

```bash
# Pre-test cleanup (automatic in FlowCertifier.js)
bin/hitestbot-eda --pre-check
```

| Check | Command | Pass Criteria | Evidence |
|-------|---------|---------------|----------|
| No stale heartbeat | `ls /tmp/hipilot-*-heartbeat.json 2>&1` | "No such file" | run_log.txt shows cleanup |
| Fresh tmux | `tmux -L hipilot list-sessions 2>&1` | "no server running" | run_log.txt shows kill |
| Clean work dir | `stat ${work_dir}/innovus.log 2>&1` | "No such file" | Freshness validation pass |
| Heartbeat active | `cat /tmp/hipilot-hipilot-heartbeat.json` | Valid JSON, recent timestamp | Heartbeat file exists during test |

**Heartbeat Verification:**

| State | Expected Heartbeat | Evidence |
|-------|-------------------|----------|
| Test start | `state: "running"`, `progress: 0` | First heartbeat entry |
| During EDA wait | `state: "waiting"`, `eta_seconds` present | Periodic updates |
| EDA complete | `state: "idle"`, `detected_tool` set | Final heartbeat |
| Test end | `state: "complete"` or watcher stopped | run_log.txt shows stats |

**Pass Criteria:**
- No stale files from previous runs
- Heartbeat file created during test (timestamp > test start)
- HiTestBot reports "Heartbeat monitoring active" in run_log.txt
- Heartbeat stats logged at completion (heartbeat_wakeups: N)

**Failure Modes:**
- Stale heartbeat detected → Cleanup failed, abort test
- Heartbeat not created → EDA MCP server not emitting, check heartbeat.js
- Old EDA processes found → License/port conflicts, kill processes

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

### Phase 4.5: Mission Pack Loading and Agent Coordination (20 min)
**Goal:** HiPilot loads mission pack and 5-Agent Team coordinates to execute Ibex RTL2GDS flow

**Background:** HiPilot now uses a 5-Agent Team architecture where:
- **Supervisor Agent**: Validates prerequisites, coordinates flow phases
- **Knowledge Agent**: Owns all 3 brains (ASIC + EDA + Project), parses mission pack
- **Planner Agent**: Creates execution strategies from mission pack
- **Executor Agent**: Generates Tcl via Knowledge, executes via EDA MCP
- **Archivist Agent**: Records QoR metrics and learnings to Project-Brain

Agents communicate through Knowledge Agent (hub-and-spoke pattern).

**Test Command:**

```bash
# HiTestBot types mission pack driven command
bin/hitestbot-eda "load the mission pack and show me what flow stages are defined"
```

**Scoring (L1-L5):**

| Layer | Criteria | Evidence |
|-------|----------|----------|
| L1 | Command typed and acknowledged | Screenshot shows prompt response |
| L2 | Mission pack understood | Keywords: "mission pack", "ibex", "RTL files", "flow stages" |
| L3 | Knowledge Agent queries | MCP log shows `knowledge.get_skill` and `knowledge.query` calls |
| L3b | Agent coordination | Evidence of multiple agents activating (status messages from different agents) |
| L4 | Mission pack parsed | Response includes correct RTL file list, stages, targets from `examples/mission-packs/ibex-mission.md` |
| L5 | Flow plan reported | Agent-generated execution plan visible with stage sequence |

**Expected Agent Behavior:**

| Agent | Expected Action | Evidence |
|-------|-----------------|----------|
| **Supervisor** | Validates mission pack exists, prerequisites met | "Supervisor: Validating mission pack..." in left pane |
| **Knowledge** | Parses mission pack, loads into 3 brains | "Knowledge: Loading mission pack for ibex_core..." |
| **Planner** | Creates stage execution strategy | "Planner: Created execution plan for 10 stages..." |
| **Executor** | Stands by, ready for execution | "Executor: Standing by for stage execution..." |
| **Archivist** | Prepares QoR tracking | "Archivist: QoR tracking initialized..." |

**Mission Pack Verification:**

| Check | Expected Value | Source |
|-------|----------------|--------|
| Project name | "ibex_core" | Mission pack header |
| Top module | "ibex_core" | ## Design Files section |
| RTL files | 20+ SystemVerilog files | File list in mission pack |
| Target frequency | 100 MHz | ## Target QoR section |
| Flow stages | 10 stages (synthesis → chip_finish) | ## Flow Requirements |
| Technology | Skywater 130nm | ## Technology Setup |

**Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| Mission pack not found | "No mission pack found" error | `hipilot-mission.md` not in design directory | Copy `examples/mission-packs/ibex-mission.md` to design dir |
| Parser error | Partial/incomplete data extraction | Natural language parser failed | Check parser.js regex patterns |
| Agent not activating | No agent status messages | Team module not loaded | Verify `src/team/index.js` exports |
| Wrong agent coordination | Direct agent-to-agent messages | Bypassing Knowledge Agent | Check hub-and-spoke implementation |

**HiTestBot Implementation:**

```javascript
// Verify agent coordination via pane status
async verifyAgentCoordination() {
  const pane0Text = await this.capturePane(0.0);

  // Check for agent status messages
  const agents = ['Supervisor', 'Knowledge', 'Planner', 'Executor', 'Archivist'];
  const activeAgents = agents.filter(agent =>
    pane0Text.includes(`${agent}:`) ||
    pane0Text.includes(`${agent} Agent`)
  );

  this._runLog(`Active agents: ${activeAgents.join(', ')}`);
  return activeAgents.length >= 3; // At least 3 agents should be active
}

// Verify mission pack content
async verifyMissionPackContent() {
  const pane0Text = await this.capturePane(0.0);

  // Check for mission pack data in response
  const checks = [
    { pattern: /ibex_core/i, name: 'Project name' },
    { pattern: /100\s*MHz/i, name: 'Target frequency' },
    { pattern: /sky130|skywater/i, name: 'Technology' },
    { pattern: /synthesis.*floorplan.*placement/i, name: 'Stage sequence' },
  ];

  return checks.map(check => ({
    name: check.name,
    found: check.pattern.test(pane0Text),
  }));
}
```

---

### Phase 4.6: Knowledge Base Query Test - PageIndex Navigation (15 min)
**Goal:** Verify Knowledge Agent correctly queries ASIC-Brain and EDA-Brain using PageIndex tree navigation

**Background:** The Knowledge Agent owns 3 brains with static knowledge stored in PageIndex format (tree-based, not vector RAG). This test verifies the Knowledge Agent can navigate the tree structure and retrieve contextually relevant information.

**Test Commands:**

```bash
# Test 1: Query ASIC-Brain for synthesis strategy
bin/hitestbot-eda "what are the best compile_ultra strategies for timing closure?"

# Test 2: Query EDA-Brain for Innovus CTS commands
bin/hitestbot-eda "how do I run clock tree synthesis in Innovus with ccopt?"

# Test 3: Query cross-brain knowledge
bin/hitestbot-eda "compare Design Compiler vs Innovus for power optimization"
```

**Scoring (L1-L5):**

| Layer | Criteria | Evidence |
|-------|----------|----------|
| L1 | Command acknowledged | Screenshot shows response |
| L2 | Query understood | Keywords: "compile_ultra", "CTS", "ccopt", "power optimization" |
| L3 | PageIndex navigation | MCP log shows `knowledge.query` with tree paths like `asic-brain/advanced/synthesis_deep_dive` |
| L3b | Tree traversal | Evidence of hierarchical navigation (parent → child → specific section) |
| L4 | Accurate content | Response includes specific commands/strategies from PageIndex files |
| L5 | Contextual relevance | Answer matches the tool and stage context of the query |

**PageIndex Verification:**

| Brain | Query | Expected PageIndex Path | Source File |
|-------|-------|------------------------|-------------|
| ASIC-Brain | Synthesis strategy | `advanced/synthesis_deep_dive/compile_ultra_strategies` | `asic-brain/database/advanced/02_synthesis_deep_dive.md` |
| EDA-Brain | Innovus CTS | `innovus/cts/ccopt_design` | `eda-brain/database/innovus/cts.md` |
| EDA-Brain | DC vs Innovus | `tool-comparison/power_optimization` | `eda-brain/database/tool-comparison.md` |

**Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| Generic response | Answer lacks specific commands | PageIndex not queried, using LLM training data | Check `knowledge.query` implementation |
| Wrong tree path | Query returns unrelated content | Incorrect tree navigation logic | Verify path construction in PageIndex.query() |
| File not found | "Knowledge not found" error | Missing database file or wrong path | Check file exists at `servers/knowledge/{brain}/database/` |
| Flat search | No tree traversal evidence | Using grep instead of tree navigation | Implement true tree-based PageIndex |

**HiTestBot Implementation:**

```javascript
// Verify PageIndex navigation via MCP logs
async verifyPageIndexQuery() {
  const mcpLog = await this.readMcpLog();

  // Check for tree path queries
  const treePaths = [
    /asic-brain\/\w+/,
    /eda-brain\/\w+/,
    /advanced\/\w+/,
    /innovus\/\w+/,
  ];

  const hasTreeQuery = treePaths.some(pattern =>
    mcpLog.some(call => pattern.test(JSON.stringify(call)))
  );

  return { pageIndexUsed: hasTreeQuery };
}

// Verify content accuracy
async verifyKnowledgeAccuracy() {
  const pane0Text = await this.capturePane(0.0);

  // Check for specific commands from PageIndex
  const specificCommands = [
    { pattern: /compile_ultra\s+-scan/i, name: 'DC compile_ultra -scan' },
    { pattern: /ccopt_design/i, name: 'Innovus ccopt_design' },
    { pattern: /setOptMode/i, name: 'Innovus setOptMode' },
  ];

  return specificCommands.map(cmd => ({
    name: cmd.name,
    found: cmd.pattern.test(pane0Text),
  }));
}
```

---

### Phase 4.7: Inter-Agent Communication Test - Hub-and-Spoke Pattern (15 min)
**Goal:** Verify all agents communicate exclusively through Knowledge Agent (hub-and-spoke), not direct agent-to-agent

**Background:** In the 5-Agent Team, the Knowledge Agent is the central hub. All communication flows through it - agents never talk directly to each other. This test verifies the hub-and-spoke pattern is enforced.

**Test Commands:**

```bash
# Trigger multi-agent coordination scenario
bin/hitestbot-eda "analyze the floorplan QoR and suggest improvements"
```

**Expected Communication Flow:**

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Supervisor │──────▶│  Knowledge  │◀─────│   Planner   │
│   (Pane 0)  │◀──────│   (Pane 1)  │──────▶│   (Pane 2)  │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌─────────┐   ┌─────────┐   ┌───────────┐
        │ Executor│   │Archivist│   │ 3 Brains  │
        │(Pane 3) │   │(Pane 4) │   │(In-Memory)│
        └─────────┘   └─────────┘   └───────────┘
```

**Communication Verification:**

| Flow | Path | Evidence in Pane 0 |
|------|------|-------------------|
| Supervisor → Knowledge | Request for QoR analysis | "Knowledge: Querying Project-Brain for floorplan QoR..." |
| Knowledge → Planner | Forward analysis request | "Planner: Received floorplan analysis request from Knowledge..." |
| Planner → Knowledge | Strategy recommendations | "Knowledge: Planner suggests macro reorganization..." |
| Knowledge → Supervisor | Consolidated response | "Supervisor: Knowledge reports: [consolidated answer]" |

**Anti-Pattern Detection (FAIL if found):**

| Violation | Example | Severity |
|-----------|---------|----------|
| Direct Supervisor→Planner | "Planner: Supervisor requests analysis..." | CRITICAL |
| Direct Executor→Archivist | "Archivist: Executor reports completion..." | CRITICAL |
| Bypassing Knowledge | Any agent reporting directly to another | CRITICAL |

**Scoring (L1-L5):**

| Layer | Criteria | Evidence |
|-------|----------|----------|
| L1 | Command acknowledged | Screenshot shows response |
| L2 | Multi-agent activation | ≥3 agents show status messages |
| L3 | Knowledge Agent queried | MCP log shows `knowledge.query` calls |
| L3b | Hub-and-spoke pattern | All responses routed through Knowledge Agent |
| L4 | No direct agent comms | No evidence of agent-to-agent messages (see Anti-Pattern) |
| L5 | Coordinated response | Final answer synthesized from multiple agents |

**Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| Direct messaging | Pane shows "Agent A → Agent B" messages | Bypassing Knowledge hub | Enforce all SendMessage routed through Knowledge |
| Knowledge not hub | Agents query brains directly | Wrong brain ownership | Verify only Knowledge Agent has direct brain access |
| Silent agents | Only Supervisor responds | Team module not active | Check `bin/hipilot` launches all 5 Claude instances |
| Conflicting responses | Multiple agents respond independently | No coordination | Implement request/response correlation via Knowledge |

**HiTestBot Implementation:**

```javascript
// Verify hub-and-spoke communication pattern
async verifyHubAndSpoke() {
  const pane0Text = await this.capturePane(0.0);
  const lines = pane0Text.split('\n');

  // Check for Knowledge Agent as central hub
  const knowledgeRouting = lines.filter(line =>
    line.includes('Knowledge:') &&
    (line.includes('from') || line.includes('to'))
  );

  // Check for anti-patterns (direct agent-to-agent)
  const directPatterns = [
    /Planner.*Supervisor/i,
    /Executor.*Planner/i,
    /Archivist.*Executor/i,
    /Supervisor.*(Planner|Executor|Archivist)/i,
  ];

  const directMessages = lines.filter(line =>
    directPatterns.some(pattern => pattern.test(line))
  );

  return {
    knowledgeRouting: knowledgeRouting.length,
    directMessages: directMessages.length,
    hubAndSpokeValid: knowledgeRouting.length > 0 && directMessages.length === 0,
  };
}
```

---

### Phase 4.8: 3-Brain Ownership Verification (10 min)
**Goal:** Verify Knowledge Agent is the sole owner of all 3 brains; other agents query through Knowledge

**Background:** The Knowledge Agent exclusively owns ASIC-Brain, EDA-Brain, and Project-Brain. Other agents (Supervisor, Planner, Executor, Archivist) must query Knowledge Agent to access any brain data.

**Test Commands:**

```bash
# Test queries that require each brain
bin/hitestbot-eda "what's the hold time fixing procedure?"  # ASIC-Brain
bin/hitestbot-eda "show me Innovus routeDesign options"     # EDA-Brain
bin/hitestbot-eda "what was the WNS after placement?"       # Project-Brain
```

**Brain Access Matrix:**

| Brain | Content Type | Access Method | Expected Query Path |
|-------|--------------|---------------|---------------------|
| ASIC-Brain | Design methodology, Tcl patterns | Knowledge Agent only | `knowledge.query({brain: 'asic', topic: '...'})` |
| EDA-Brain | Tool commands, error patterns | Knowledge Agent only | `knowledge.query({brain: 'eda', tool: '...'})` |
| Project-Brain | QoR history, design learnings | Knowledge Agent only | `knowledge.query({brain: 'project', design: '...'})` |

**Ownership Verification:**

| Agent | Can Query Brains Directly? | Must Use | Evidence |
|-------|---------------------------|----------|----------|
| Supervisor | ❌ NO | Knowledge Agent | "Supervisor: Asking Knowledge Agent..." |
| Planner | ❌ NO | Knowledge Agent | "Planner: Querying Knowledge for flow definition..." |
| Executor | ❌ NO | Knowledge Agent | "Executor: Requesting Tcl from Knowledge Agent..." |
| Archivist | ❌ NO | Knowledge Agent | "Archivist: Sending QoR to Knowledge Agent..." |
| Knowledge | ✅ YES | Direct access | "Knowledge: Querying [brain] directly..." |

**Scoring (L1-L5):**

| Layer | Criteria | Evidence |
|-------|----------|----------|
| L1 | Commands acknowledged | All 3 queries responded |
| L2 | Brain-specific responses | Keywords match each brain's domain |
| L3 | Knowledge Agent queried | MCP log shows `knowledge.query` for all requests |
| L3b | No direct brain access | No evidence of agents calling brain methods directly |
| L4 | Correct brain used | ASIC methodology → ASIC-Brain, Tool commands → EDA-Brain, etc. |
| L5 | Context-aware routing | Knowledge Agent selects correct brain based on query intent |

**Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| Agent queries brain directly | MCP log shows `asicBrain.query()` from non-Knowledge agent | Missing access control | Enforce brain access only through Knowledge Agent |
| Wrong brain queried | ASIC question answered with tool syntax | Brain routing logic error | Implement intent-based brain selection |
| Knowledge bypass | Agent responds without querying Knowledge | Direct LLM response | Require Knowledge Agent consultation |

**HiTestBot Implementation:**

```javascript
// Verify 3-brain ownership through MCP logs
async verifyBrainOwnership() {
  const mcpLog = await this.readMcpLog();

  // Extract knowledge.query calls
  const knowledgeQueries = mcpLog.filter(call =>
    call.method === 'knowledge.query' ||
    call.tool === 'knowledge.query'
  );

  // Check brain parameter distribution
  const brainUsage = {
    asic: knowledgeQueries.filter(q => q.params?.brain === 'asic').length,
    eda: knowledgeQueries.filter(q => q.params?.brain === 'eda').length,
    project: knowledgeQueries.filter(q => q.params?.brain === 'project').length,
  };

  // Check for direct brain access (should be 0)
  const directAccess = mcpLog.filter(call =>
    call.method?.match(/^(asic|eda|project)Brain\./) ||
    call.tool?.match(/^(asic|eda|project)Brain\./)
  ).length;

  return {
    brainUsage,
    directAccess,
    ownershipValid: directAccess === 0 && knowledgeQueries.length > 0,
  };
}
```

---

### Phase 4.9: Project-Brain Persistence Test - SQLite + PageIndex Hybrid (20 min)
**Goal:** Verify Project-Brain persists QoR metrics to SQLite and learnings to PageIndex; Archivist Agent records correctly

**Background:** Project-Brain uses a hybrid architecture:
- **SQLite**: Structured QoR metrics (WNS, TNS, area, power) with timestamps
- **PageIndex**: Dynamic learnings, error patterns, success patterns

This test verifies the Archivist Agent correctly records to both storage systems.

**Test Commands:**

```bash
# Step 1: Run a stage to generate QoR data
bin/hitestbot-eda "run placement and record the results"

# Step 2: Query Project-Brain for historical data
bin/hitestbot-eda "what was my WNS after placement?"

# Step 3: Query for learnings/patterns
bin/hitestbot-eda "have we seen this hold violation pattern before?"

# Step 4: Request QoR trend analysis
bin/hitestbot-eda "show me the timing trend across all stages"
```

**Hybrid Storage Verification:**

| Data Type | Storage | Table/File | Written By | Read By |
|-----------|---------|------------|------------|---------|
| QoR metrics | SQLite | `qor_metrics` table | Archivist Agent | Knowledge Agent |
| Checkpoints | SQLite | `checkpoints` table | Archivist Agent | Knowledge Agent |
| Error patterns | PageIndex | `learnings/error-patterns.md` | Archivist Agent | Knowledge Agent |
| Success patterns | PageIndex | `learnings/success-patterns.md` | Archivist Agent | Knowledge Agent |
| Design history | PageIndex | `learnings/INDEX.md` | Archivist Agent | Knowledge Agent |

**Scoring (L1-L5):**

| Layer | Criteria | Evidence |
|-------|----------|----------|
| L1 | Stage runs and reports QoR | Screenshot shows WNS/TNS numbers |
| L2 | Archivist acknowledges recording | "Archivist: Recording QoR to Project-Brain..." |
| L3 | SQLite writes confirmed | `db-interface.js` log shows INSERT to `qor_metrics` |
| L3b | PageIndex writes confirmed | `learnings/` directory updated with new content |
| L4 | Data retrieval works | Query returns correct historical values |
| L5 | Trend analysis accurate | QoR trends correctly calculated across stages |

**Data Integrity Checks:**

| Check | Method | Expected Result |
|-------|--------|-----------------|
| SQLite connectivity | Query `qor_metrics` table | Returns rows with timestamps |
| Metric values | WNS after placement | Matches EDA tool output |
| Timestamp accuracy | Check `recorded_at` column | Within 1 minute of execution |
| Learning recorded | Check `learnings/success-patterns.md` | Contains placement insights |
| Trend calculation | Query multi-stage WNS | Shows progression: synthesis → placement → CTS |

**Failure Modes:**

| Failure | Symptom | Root Cause | Fix |
|---------|---------|------------|-----|
| SQLite not writable | "Database locked" error | File permissions or concurrent access | Check `project-brain/database/` permissions |
| Metrics not recorded | Query returns empty | Archivist not activated | Verify Archivist Agent pane is running |
| Wrong values returned | QoR doesn't match tool output | Parsing error in output-parser.js | Fix regex patterns for QoR extraction |
| Learnings not persisted | PageIndex files unchanged | Write failure | Check file I/O in `self-improvement.js` |
| Stale data | Old metrics returned | No new INSERT | Verify Archivist triggers on stage completion |

**HiTestBot Implementation:**

```javascript
// Verify Project-Brain persistence
async verifyProjectBrainPersistence() {
  const checks = {
    sqliteWrites: false,
    pageIndexWrites: false,
    dataRetrieval: false,
    trendAccuracy: false,
  };

  // Check 1: SQLite metrics recorded
  const mcpLog = await this.readMcpLog();
  checks.sqliteWrites = mcpLog.some(call =>
    call.method === 'db.recordQoR' ||
    call.params?.table === 'qor_metrics'
  );

  // Check 2: Archivist messages
  const pane0Text = await this.capturePane(0.0);
  checks.pageIndexWrites = pane0Text.includes('Archivist:') &&
    pane0Text.includes('Project-Brain');

  // Check 3: Data retrieval works
  const retrievalQuery = await this.sendCommand(
    'what was my WNS after placement?'
  );
  checks.dataRetrieval = /-?\d+\.?\d*\s*(ps|ns)/i.test(pane0Text);

  return checks;
}

// Verify hybrid architecture
async verifyHybridStorage() {
  // Read Project-Brain directory structure
  const projectBrainDir = `${this.designDir}/.hipilot/project-brain/`;

  const structure = {
    hasSQLite: await this.fileExists(`${projectBrainDir}/project.db`),
    hasLearningsDir: await this.fileExists(`${projectBrainDir}/learnings/`),
    hasIndexMd: await this.fileExists(`${projectBrainDir}/learnings/INDEX.md`),
    hasErrorPatterns: await this.fileExists(`${projectBrainDir}/learnings/error-patterns.md`),
    hasSuccessPatterns: await this.fileExists(`${projectBrainDir}/learnings/success-patterns.md`),
  };

  return {
    ...structure,
    hybridValid: structure.hasSQLite && structure.hasLearningsDir,
  };
}
```

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

### Phase 8: Mission Pack Driven Full RTL2GDS Flow (150 min)
**Goal:** Complete Ibex RTL2GDS flow using ONLY the mission pack as input — the ultimate test of agentic HiPilot

**Background:** This phase tests the complete agentic architecture:
1. HiPilot reads `hipilot-mission.md` (natural language)
2. Knowledge Agent parses it into structured data
3. 5-Agent Team collaborates to execute the flow
4. Each stage uses the mission pack for configuration
5. Archivist tracks QoR against mission pack targets

**Test Setup:**

```bash
# 1. Ensure mission pack is in design directory
cp examples/mission-packs/ibex-mission.md /home/EDA/ibex_work_upload/hipilot-mission.md

# 2. Run HiTestBot with single command
bin/hitestbot-eda "execute the complete RTL2GDS flow from the mission pack"
```

**Agent Coordination Verification:**

| Check | Expected | How to Verify |
|-------|----------|---------------|
| Supervisor validates | "Supervisor: Mission pack validated" | Left pane text |
| Knowledge parses | "Knowledge: Parsed 20 RTL files, 10 stages, 3 corners" | Left pane text |
| Planner creates strategy | "Planner: Execution strategy created" | Left pane text |
| Executor runs stages | "Executor: Running synthesis..." etc | Left pane text per stage |
| Archivist records QoR | "Archivist: QoR snapshot saved" | Left pane after each stage |

**Mission Pack Target Validation:**

| Target | Mission Pack Value | Archivist Check |
|--------|-------------------|-----------------|
| Frequency | 100 MHz | Compare final frequency vs target |
| Utilization | 68% | Compare actual vs target utilization |
| WNS | >= 0 | Verify timing closure |
| Area | < 450x450 um | Verify die area constraints |

**Stage-by-Stage Progress (All 10 Stages):**

| Stage | Agent | Key Action | Success Evidence |
|-------|-------|------------|------------------|
| 0. Synthesis | Executor | Run dc_shell with mission pack RTL | `synthesis.enc` exists |
| 1. Design Init | Executor | Load netlist, setup MMMC from mission pack | `design_init.enc` exists |
| 2. Floorplan | Executor | Apply mission pack die area, utilization | `floorplan.enc` exists |
| 3. Power Plan | Executor | Build power grid per mission pack | `powerplan.enc` exists |
| 4. Placement | Executor | Place cells with mission pack targets | `placement.enc` exists |
| 5. CTS | Executor | Run ccopt with mission pack skew target | `cts.enc` exists |
| 6. Post-CTS Opt | Executor | Fix timing with propagated clocks | `post_cts_opt.enc` exists |
| 7. Routing | Executor | Route with mission pack DRC settings | `routing.enc` exists |
| 8. Route Opt | Executor | Optimize with mission pack targets | `route_opt.enc` exists |
| 9. Chip Finish | Executor | Export GDS, generate reports | `chip_done.enc`, `ibex_core.gds` |

**Platinum Certification Criteria:**

| Criteria | Requirement | Evidence |
|----------|-------------|----------|
| Mission pack parsed | All sections extracted correctly | Knowledge Agent output |
| All 10 stages complete | Checkpoints for each stage | 10 .enc files exist |
| GDS exported | File > 10MB, timestamped during test | `ibex_core.gds` |
| Timing closure | WNS >= 0 (or within signoff tolerance) | Final timing report |
| QoR targets met | Actual vs mission pack targets | Archivist comparison report |
| Agent coordination | All 5 agents activated | Pane logs show all agents |
| No manual intervention | No approval prompts during flow | Full auto mode |

**HiTestBot Implementation for Mission Pack Flow:**

```javascript
// New method for Phase 8 testing
async runMissionPackFlowTest() {
  const startTime = Date.now();

  // Step 1: Verify mission pack exists
  const missionCheck = await this.verifyMissionPackExists();
  if (!missionCheck.exists) {
    return { status: 'failed', reason: 'Mission pack not found' };
  }

  // Step 2: Send single command to execute flow
  await this.typeCommand('execute the complete RTL2GDS flow from the mission pack');

  // Step 3: Monitor for 2.5 hours, checking agent coordination
  const stages = [
    'synthesis', 'design_init', 'floorplan', 'powerplan',
    'placement', 'cts', 'post_cts_opt', 'routing', 'route_opt', 'chip_finish'
  ];

  const stageResults = [];
  for (const stage of stages) {
    const result = await this.waitForStageCompletion(stage, { timeout: 900000 }); // 15 min per stage
    stageResults.push({ stage, ...result });

    // Verify Archivist recorded QoR
    const qorRecorded = await this.verifyQoRRecorded(stage);
    if (!qorRecorded) {
      this._runLog(`Warning: Archivist may not have recorded QoR for ${stage}`);
    }
  }

  // Step 4: Verify final outputs
  const gdsExists = await this.verifyFileExists('ibex_core.gds', { minSize: 10 * 1024 * 1024 });
  const timingMet = await this.verifyTimingClosure({ wnsThreshold: 0 });

  // Step 5: Compare QoR against mission pack targets
  const missionPackTargets = await this.getMissionPackTargets();
  const qorComparison = await this.compareQoRAgainstTargets(missionPackTargets);

  return {
    status: gdsExists && timingMet ? 'passed' : 'failed',
    stageResults,
    gdsExists,
    timingMet,
    qorComparison,
    duration: Date.now() - startTime,
  };
}

// Verify agent coordination
async verifyAgentCoordination() {
  const paneText = await this.capturePane(0.0);

  const expectedAgents = [
    { name: 'Supervisor', pattern: /Supervisor.*(?:validating|coordinating|phase)/i },
    { name: 'Knowledge', pattern: /Knowledge.*(?:loading|parsing|brain)/i },
    { name: 'Planner', pattern: /Planner.*(?:strategy|plan|recipe)/i },
    { name: 'Executor', pattern: /Executor.*(?:running|executing|generating)/i },
    { name: 'Archivist', pattern: /Archivist.*(?:recording|tracking|QoR)/i },
  ];

  return expectedAgents.map(agent => ({
    name: agent.name,
    active: agent.pattern.test(paneText),
  }));
}

// Verify QoR recorded by Archivist
async verifyQoRRecorded(stage) {
  const paneText = await this.capturePane(0.0);
  const patterns = [
    new RegExp(`Archivist.*${stage}.*QoR`, 'i'),
    new RegExp(`QoR.*snapshot.*${stage}`, 'i'),
    /WNS:\s*[\d.-]+\s*ns/,
    /TNS:\s*[\d.-]+\s*ns/,
  ];

  return patterns.some(p => p.test(paneText));
}

// Compare actual QoR against mission pack targets
async compareQoRAgainstTargets(targets) {
  const paneText = await this.capturePane(0.0);

  // Extract actual QoR from pane
  const wnsMatch = paneText.match(/WNS:\s*([\d.-]+)\s*ns/i);
  const actualWNS = wnsMatch ? parseFloat(wnsMatch[1]) : null;

  return {
    timing: {
      target: targets.timing,
      actual: { wns: actualWNS },
      met: actualWNS !== null && actualWNS >= (targets.timing?.wns || 0),
    },
  };
}
```

**Pass/Fail Criteria:**

| Tier | Criteria | Result |
|------|----------|--------|
| **FAIL** | Mission pack not parsed or < 5 stages complete | Major agent architecture issue |
| **BRONZE** | 5-7 stages complete, GDS not exported | Partial flow execution |
| **SILVER** | 8-9 stages complete, GDS exported | Near-complete flow |
| **GOLD** | All 10 stages complete, GDS > 10MB, timing closed | Full flow success |
| **PLATINUM** | Gold + all QoR targets met + full agent coordination | Mission pack fully satisfied |

**Expected Output Example:**

```
═══════════════════════════════════════════════════════
  Mission Pack RTL2GDS Flow Test
  Duration: 8472s (2.3 hours)
  Status: PLATINUM CERTIFIED ✓
═══════════════════════════════════════════════════════

Agent Coordination:
  ✅ Supervisor: Validated mission pack, coordinated 10 phases
  ✅ Knowledge: Parsed mission pack, loaded 3 brains
  ✅ Planner: Created execution strategy for 10 stages
  ✅ Executor: Executed all stages successfully
  ✅ Archivist: Recorded QoR for all stages

Stage Completion:
  ✅ Synthesis (Stage 0) - dc_shell
  ✅ Design Init (Stage 1) - innovus
  ✅ Floorplan (Stage 2) - innovus
  ✅ Power Plan (Stage 3) - innovus
  ✅ Placement (Stage 4) - innovus
  ✅ CTS (Stage 5) - innovus
  ✅ Post-CTS Opt (Stage 6) - innovus
  ✅ Routing (Stage 7) - innovus
  ✅ Route Opt (Stage 8) - innovus
  ✅ Chip Finish (Stage 9) - innovus

Mission Pack Targets vs Actual:
  Target Frequency: 100 MHz | Actual: 100 MHz ✅
  Target WNS: >= 0 ns | Actual: +0.05 ns ✅
  Target Utilization: 68% | Actual: 67.5% ✅
  Target Die Area: 450x450 um | Actual: 448x448 um ✅

Outputs:
  GDS: ibex_core.gds (19.3 MB) ✅
  Final Checkpoint: chip_done.enc (5.1 MB) ✅
  Timing Report: timing.rpt (245 KB) ✅

Knowledge Base Updates:
  + Added 3 new error patterns
  + Updated skill: floorplan.md (utilization guidance)
  + Recorded optimal recipe for sky130/synthesis
═══════════════════════════════════════════════════════
```

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
| 3.5 | 2026-03-15 | **5-Agent Team Architecture Testing** (Phases 4.5-4.9, Phase 8): New test phases for agentic HiPilot with Supervisor/Knowledge/Planner/Executor/Archivist agents. **Phase 4.5**: Mission pack loading and parser. **Phase 4.6**: Knowledge Base Query Test (PageIndex navigation for ASIC/EDA brains). **Phase 4.7**: Inter-Agent Communication Test (hub-and-spoke pattern verification). **Phase 4.8**: 3-Brain Ownership Verification. **Phase 4.9**: Project-Brain Persistence Test (SQLite + PageIndex hybrid). Phase 8 tests complete RTL2GDS flow driven by natural language mission pack. **Platinum Certification**: New tier for mission pack target achievement. |
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

# Mission Pack driven full flow (Phase 8 - Platinum certification)
bin/hitestbot-eda "execute the complete RTL2GDS flow from the mission pack"

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
| `src/hitestbot/core/MissionPackCertifier.js` | Mission pack validation and QoR comparison |
| `src/team/index.js` | 5-Agent Team registry and coordinator |
| `src/team/agents/SupervisorAgent.js` | Supervisor agent - flow coordination |
| `src/team/agents/KnowledgeAgent.js` | Knowledge agent - owns 3 brains |
| `src/team/agents/PlannerAgent.js` | Planner agent - execution strategy |
| `src/team/agents/ExecutorAgent.js` | Executor agent - Tcl execution |
| `src/team/agents/ArchivistAgent.js` | Archivist agent - QoR tracking |
| `src/mission-pack/index.js` | Mission pack loader |
| `src/mission-pack/parser.js` | Natural language Markdown parser |
| `examples/mission-packs/ibex-mission.md` | Example mission pack (Markdown) |
| `deploy/eda-server/CLAUDE.md` | HiPilot AI identity (5-Agent Team) |
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
