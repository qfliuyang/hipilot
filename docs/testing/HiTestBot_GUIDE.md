# HiTestBot Guide — 5-Agent Team Mode Testing

**Version:** 1.4
**Date:** 2026-03-15
**Status:** Complete Testing Reference for HiPilot v0.8.0+

**What's New in v1.4:**
- **Test Review Board**: Independent third-party verification of test results
- **Cheat Prevention**: 8-layer detection system to ensure authentic testing
- **Authenticity Verification**: Automatic detection of fake/simulated outputs

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Architecture](#testing-architecture)
3. [HiTestBot Execution Model](#hitestbot-execution-model)
4. [Test Review Board](#test-review-board)
5. [5-Agent Team Testing](#5-agent-team-testing)
6. [Environment Setup](#environment-setup)
7. [Development Workflow](#development-workflow)
8. [SSH Connection Guide](#ssh-connection-guide)
9. [Code Upload with sshpass](#code-upload-with-sshpass)
10. [Screen Recording](#screen-recording)
11. [Video Transfer](#video-transfer)
12. [Pre-Test Cleanup](#pre-test-cleanup)
13. [Problems Encountered](#problems-encountered)
14. [Standard E2E Test Procedure](#standard-e2e-test-procedure)
15. [Quick Reference](#quick-reference)

---

## Table of Contents

1. [Overview](#overview)
2. [HiTestBot Execution Model](#hitestbot-execution-model)
3. [5-Agent Team Testing](#5-agent-team-testing)
4. [Environment Setup](#environment-setup)
5. [Development Workflow](#development-workflow)
6. [SSH Connection Guide](#ssh-connection-guide)
7. [Code Upload with sshpass](#code-upload-with-sshpass)
8. [Screen Recording](#screen-recording)
9. [Video Transfer](#video-transfer)
10. [Pre-Test Cleanup](#pre-test-cleanup)
11. [Problems Encountered](#problems-encountered)
12. [Standard E2E Test Procedure](#standard-e2e-test-procedure)
13. [Quick Reference](#quick-reference)

---

## Overview

This document provides a complete guide for E2E testing of HiPilot's **5-Agent Team Mode** on the EDA server.

### What's New in v0.8.0+

HiPilot now operates as a **5-Agent Team** by default:

| Agent | Pane | Role |
|-------|------|------|
| **Supervisor** | Top-left | Flow coordination, validates prerequisites, communicates with engineer |
| **Knowledge** | Top (center-left) | **Owns all 3 brains** (ASIC + EDA + Project). Central knowledge hub |
| **Planner** | Top (center-right) | Creates execution strategies by querying Knowledge |
| **Executor** | Top-right | Generates Tcl via Knowledge, executes via EDA MCP |
| **Archivist** | Middle | Records QoR metrics and learnings to Project-Brain |
| **EDA Tool** | Bottom | Innovus / ICC2 / PrimeTime |

### Hub-and-Spoke Communication

**All agents communicate through the Knowledge Agent:**

```
Supervisor → Knowledge ← Planner
      ↓         ↓           ↓
   (status)  (brains)   (strategy)
      ↑         ↑           ↑
Archivist → Knowledge ← Executor
```

- Agents **NEVER** talk directly to each other
- All queries go through **Knowledge Agent** (the brain hub)
- Knowledge Agent is the **only** interface to the 3-brain system

---

## HiTestBot Execution Model

**HiTestBot runs ONLY on the EDA server** ("test like real human"). Each test run creates its own timestamped directory; tests never reference old runs.

| Principle | Meaning |
|-----------|---------|
| EDA-only execution | HiTestBot executes on EDA server; dev machine triggers via `bin/hitestbot-eda` (SSH) |
| Per-run isolation | Each run creates `/tmp/hipilot-test-evidence/{timestamp}/` — no reuse of prior runs |
| HiPilot as tool | Deploy HiPilot once to EDA server; use `bin/hitestbot-push` for small updates |
| Sync for feedback | `bin/hitestbot-pull` downloads evidence; `bin/hitestbot-push` uploads test plan/config |

**From dev machine:**
```bash
bin/hitestbot-eda synthesis   # SSH + run HiTestBot on EDA server (individual stage)
bin/hitestbot-eda floorplan   # Test floorplan stage
bin/hitestbot-eda placement   # Test placement stage
bin/hitestbot-eda cts         # Test CTS stage
bin/hitestbot-eda routing     # Test routing stage
bin/hitestbot-eda mission     # Test full mission pack flow
bin/hitestbot-pull            # Download evidence to e2e_evidence/
bin/hitestbot-push skills/    # Upload test plan or config
```

**On EDA server directly:**
```bash
cd /home/EDA/hipilot/current
node src/hitestbot/tests/FlowCertificationTest.js synthesis
node src/hitestbot/tests/FlowCertificationTest.js floorplan
node src/hitestbot/tests/FlowCertificationTest.js mission  # Full mission pack test
```

See [docs/testing/TESTING_RULES.md](TESTING_RULES.md) for testing philosophy and [docs/testing/TEST_PLAN.md](TEST_PLAN.md) for test phases.

---

## Test Review Board

### Overview

The **Test Review Board** is a **standalone third-party verifier** that independently reviews HiTestBot results. It cannot be cheated because it:

1. Reads evidence files directly (doesn't trust HiTestBot APIs)
2. Re-implements verification logic (separate scoring)
3. Uses its own CheatDetector instance
4. Reports mismatches between claims and reality

### Why We Need Independent Verification

HiTestBot generates test results, but those results could theoretically be manipulated. The Review Board provides **authoritative final assessment** by verifying everything independently.

### Usage

```bash
# Review specific test evidence
bin/review-test test-evidence/20260315_121030/

# Review most recent test
bin/review-test latest

# Review from within project
bin/review-test test-evidence-phase3-4/20260315_121030/
```

### What the Review Board Checks

| Phase | Verification | Catches |
|-------|--------------|---------|
| **Evidence Inventory** | Lists all evidence files | Missing screenshots, logs |
| **Cheat Detection** | Independent 8-layer check | Echo commands, fake processes |
| **Claim Validation** | Reads HiTestBot's claims | Overstated scores |
| **L1-L5 Verification** | Re-implements scoring | Wrong tool usage claims |
| **Mismatch Detection** | Compares claims vs reality | L3 claimed but no MCP calls |
| **TEST_PLAN Alignment** | Maps to test phases | Missing requirements |

### Example Output

```
╔══════════════════════════════════════════════════════════════════╗
║     HiPilot Test Result Review Board — Independent Audit       ║
╚══════════════════════════════════════════════════════════════════╝

Reviewing: test-evidence/20260315_121030/

📁 Evidence Files: 12
   - ✓ Video recording
   - ✓ Screenshots
   - ✓ Pane logs
   - ✓ MCP call log
   - ✓ Flow report

🔍 Phase 2: Independent Cheat Verification...
   Result: ✓ CLEAN

📋 Phase 3: Reading HiTestBot Claims...
   Claimed Score: 8.2/10.0
   Claimed Grade: B+

🔎 Phase 4: Independent Evidence Verification...
   L1 (Response): ✓
   L2 (Understanding): ✓
   L3 (MCP Usage): ✓
   L4 (EDA Execution): ✓
   L5 (QoR Reported): ✓

⚖️  Phase 5: Detecting Mismatches...
   Mismatches Found: 0

╔══════════════════════════════════════════════════════════════════╗
║                    FINAL REVIEW BOARD VERDICT                    ║
╠══════════════════════════════════════════════════════════════════╣
║  Verdict:  APPROVED — Test Passed                                ║
║  Score:    8.5/10.0 (Independent)                                ║
║  HiTestBot Claimed: 8.2/10.0                                     ║
╚══════════════════════════════════════════════════════════════════╝
```

### Review Board Reports

The Review Board generates `REVIEW_BOARD_REPORT.md` in the evidence directory:

```bash
# View the authoritative report
cat test-evidence/20260315_121030/REVIEW_BOARD_REPORT.md
```

This report is the **authoritative assessment**. HiTestBot reports are advisory only.

---

## Cheat Prevention

### The "Echo" Cheat Pattern

The most common cheating method is using shell `echo` to fake status:

```bash
# FAKE — Echo commands simulate status without real execution
echo -e "\033[32m✓\033[0m Supervisor: Running"
echo -e "\033[32m✓\033[0m Knowledge: Running"
echo -e "\033[32m✓\033[0m Planner: Running"
```

This creates the **illusion** of 5 agents without actual Claude processes.

### 8-Layer Cheat Detection

| Layer | Detection | Catches |
|-------|-----------|---------|
| **Process Verification** | `ps aux \| grep claude` | Fake processes |
| **Echo Detection** | Regex patterns | Echo-based faking |
| **Pane Authenticity** | Claude interface check | Static images |
| **MCP Integrity** | JSON/timestamp validation | Fabricated logs |
| **Cross-Reference** | Pane+MCP+video alignment | Inconsistent evidence |
| **Interactive Test** | Unique command challenge | Non-interactive displays |
| **Video Motion** | ffprobe frame analysis | Static image as video |
| **Evidence Freshness** | Timestamp verification | Reused old evidence |

### Automatic Failure

- Any critical cheat detection = **automatic score of 0**
- Authenticity subject has **10x weight** in GPA
- One cheat = automatic **FAIL** regardless of other scores

### Evidence Files Generated

| File | Purpose |
|------|---------|
| `cheat_detection_report.json` | Full detection results |
| `REVIEW_BOARD_REPORT.md` | Independent verification |

---

## 5-Agent Team Testing

### Testing the Agent Architecture

HiTestBot validates the 5-Agent Team through these verification points:

| Test Point | What HiTestBot Checks | Evidence |
|------------|----------------------|----------|
| **Agent Activation** | All 5 agent panes created | `tmux list-panes` shows 6 panes |
| **Hub-and-Spoke** | Knowledge Agent queried | MCP logs show `knowledge.query` calls |
| **Mission Pack Loading** | Markdown mission pack parsed | Pane content shows mission summary |
| **QoR Recording** | Archivist records metrics | Project-Brain updated with WNS/TNS |
| **Agent Coordination** | Stages execute in sequence | Timeline shows agent handoffs |

### Mission Pack Testing

HiPilot follows a **Mission Pack** — a human-written Markdown document describing the design flow.

**Example Mission Pack:** `examples/mission-packs/ibex-mission.md`

HiTestBot tests mission pack loading:
1. Places mission pack in design directory
2. Launches HiPilot
3. Verifies agents parse and acknowledge the mission
4. Confirms flow executes according to mission requirements

### L1-L5 Scoring (Updated for Team Mode)

| Level | Criteria | Team Mode Addition |
|-------|----------|-------------------|
| **L1** | Claude responds | Supervisor pane shows activity |
| **L2** | Understands task | Knowledge Agent queries mission pack |
| **L3** | Uses MCP tools | Executor calls EDA tools via Knowledge |
| **L4** | EDA tool runs | All stages complete, checkpoints saved |
| **L5** | Reports QoR | Archivist records metrics, compares to targets |

### Verbose Logging and Evidence-Only Debugging

**The EDA server has no source code.** All debugging comes from evidence retrieved via `bin/hitestbot-pull`.

| Artifact | Purpose |
|----------|---------|
| `run_log.txt` | Timestamped test steps, observations, agent coordination |
| `mcp_calls.jsonl` | MCP calls with `result_preview`, `error`, `args` |
| `FLOW_REPORT.md` | Diagnostic Summary (agent breakdown, error excerpts) |
| `agent_timeline.jsonl` | Per-agent activity and coordination events |
| `stage_*/scorecard.json` | Per-stage evidence and failure classification |

Set `HIPILOT_TEST_LOG=/path/to/mcp_calls.jsonl` when running HiPilot for full logging.

---

## Environment Setup

### Local Machine Requirements

```bash
# Install sshpass (for non-interactive SSH)
brew install sshpass      # macOS
apt install sshpass       # Ubuntu/Debian

# Verify installation
sshpass -V
```

### EDA Server Paths

```bash
# Node.js (glibc-217 compatible)
NODE_PATH="/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217"

# Custom tmux 3.4
TMUX_PATH="/home/EDA/hipilot_test/.local/bin/tmux"

# HiPilot deployment
HIPILOT_CURRENT="/home/EDA/hipilot/current"

# Recordings directory
RECORDINGS_DIR="/home/EDA/hipilot_test/recordings"
```

### Target Environment

| Item | Value |
|------|-------|
| **EDA Server** | 192.168.112.163 |
| **User** | EDA |
| **Password** | eda2020 |
| **OS** | CentOS 7.9.2009 (glibc 2.17) |
| **Node.js** | v20.18.3 (glibc-217 build) |
| **tmux** | 3.4 (custom build) |
| **Display** | :0 (real desktop, NOT Xvfb) |
| **Default Panes** | 6 (5 agents + EDA tool pane) |

---

## Development Workflow

### Where to Write Code

**ALWAYS write code on your LOCAL machine**, then upload to EDA server for testing.

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL MACHINE (macOS/Linux)                                    │
│                                                                 │
│  /Users/you/codes/hipilot/                                      │
│  ├── src/team/agents/            ← Agent implementations       │
│  ├── src/mission-pack/           ← Mission pack parser         │
│  ├── servers/knowledge/          ← Knowledge MCP server        │
│  └── ...                                                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  EDA SERVER (CentOS 7)                                          │
│                                                                 │
│  /home/EDA/hipilot/current/                                     │
│  ├── src/team/agents/            ← Uploaded for testing        │
│  └── ...                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Typical Workflow

```bash
# 1. Write/edit code locally
vim /Users/you/codes/hipilot/src/team/agents/KnowledgeAgent.js

# 2. Test locally (if possible)
node /Users/you/codes/hipilot/test-knowledge-agent.js

# 3. Upload to EDA server
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  /Users/you/codes/hipilot/src/team/agents/*.js \
  EDA@192.168.112.163:/home/EDA/hipilot/current/src/team/agents/

# 4. Run E2E test with HiTestBot
bin/hitestbot-eda synthesis

# 5. Download evidence
bin/hitestbot-pull
```

---

## SSH Connection Guide

### Basic SSH Connection

```bash
# Interactive SSH
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163

# Run single command
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 'ls -la'

# Run multiple commands
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
  export PATH="/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH"
  cd /home/EDA/hipilot/current
  node test.js
'
```

---

## Code Upload with sshpass

### Upload Single File

```bash
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./src/team/agents/KnowledgeAgent.js \
  EDA@192.168.112.163:/home/EDA/hipilot/current/src/team/agents/
```

### Upload Team Module

```bash
# Upload all agent files
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./src/team/agents/*.js \
  EDA@192.168.112.163:/home/EDA/hipilot/current/src/team/agents/

# Upload mission pack parser
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./src/mission-pack/*.js \
  EDA@192.168.112.163:/home/EDA/hipilot/current/src/mission-pack/
```

### Upload Mission Pack

```bash
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./examples/mission-packs/ibex-mission.md \
  EDA@192.168.112.163:/home/EDA/ibex_work_upload/hipilot-mission.md
```

---

## Screen Recording

### Recording Requirements

- **Always record on display :0** (real desktop)
- **Use H.264 with yuv420p** for macOS compatibility
- **Clean up before recording** (see Pre-Test Cleanup)

### Start Recording

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
VIDEO_FILE="/home/EDA/hipilot_test/recordings/demo_$(date +%Y%m%d_%H%M%S).mp4"

DISPLAY=:0 ffmpeg -y -f x11grab \
  -video_size 2880x1800 \
  -framerate 15 \
  -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  "$VIDEO_FILE" < /dev/null > /tmp/ffmpeg.log 2>&1 &

echo $VIDEO_FILE > /tmp/ffmpeg_video_file
echo $! > /tmp/ffmpeg_pid
echo "Recording started"
'
```

### Stop Recording

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
kill $(cat /tmp/ffmpeg_pid) 2>/dev/null || true
sleep 2
cat /tmp/ffmpeg_video_file
'
```

---

## Video Transfer

### Download Latest Video

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 \
  'ls -t /home/EDA/hipilot_test/recordings/*.mp4 | head -1' | \
  xargs -I {} sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  EDA@192.168.112.163:{} ./latest_demo.mp4
```

---

## Pre-Test Cleanup

**ALWAYS clean up before each test** to ensure clean recordings.

### Complete Cleanup Script

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
echo "=== Pre-Test Cleanup ==="

# Kill all tmux sessions
pkill -u EDA tmux 2>/dev/null || true

# Kill ffmpeg recordings
pkill -u EDA ffmpeg 2>/dev/null || true

# Kill terminal windows
pkill -u EDA gnome-terminal 2>/dev/null || true

# Clean temp files
rm -f /tmp/hipilot_*.tcl 2>/dev/null || true
rm -f /tmp/hipilot_mode 2>/dev/null || true
rm -f /tmp/hipilot_pending.tcl 2>/dev/null || true

# Reset mode to manual
echo "manual" > /tmp/hipilot_mode

sleep 2
echo "=== Cleanup Complete ==="
'
```

---

## Problems Encountered

### Problem 1: Agent Pane Not Responding

**Issue:** One of the 5 agent panes shows no activity.

**Solution:** Check pane creation and restart:
```bash
# Check pane count
tmux -L hipilot list-panes

# Should show 6 panes (0.0 - 0.5)
# If not, kill and restart
pkill -u EDA tmux
bin/hipilot
```

### Problem 2: Knowledge Agent Not Responding

**Issue:** Other agents can't query Knowledge Agent.

**Check:**
```bash
# Verify Knowledge Agent pane is active
tmux -L hipilot capture-pane -t hipilot:0.1 -p -S -10

# Should show Knowledge Agent initialization
```

### Problem 3: Mission Pack Not Loading

**Issue:** Agents don't recognize mission pack.

**Solution:** Verify mission pack location and format:
```bash
# Check mission pack exists
cat /home/EDA/ibex_work_upload/hipilot-mission.md

# Should be Markdown format (not YAML)
# Must have # Mission Pack: header
```

### Problem 4: Wrong Number of Panes (Legacy Mode)

**Issue:** Only 2 panes instead of 6.

**Cause:** Using `bin/hipilot --simple` (legacy mode).

**Solution:** Use default team mode:
```bash
bin/hipilot  # Creates 6 panes (5 agents + EDA)
```

### Problem 5: Review Board Detects Cheating

**Issue:** Review Board reports `⚠️ CHEAT DETECTED` or mismatches.

**Common Causes:**
- Using `echo` commands to simulate agent status (FAKE)
- Reusing evidence from previous test runs
- Video is static image instead of real recording
- No actual Claude processes running

**Solution:**
1. Verify real processes: `ps aux | grep claude`
2. Check pane content shows real Claude Code interface
3. Ensure video has motion (not static image)
4. Always use clean design directory for each test
5. Check `cheat_detection_report.json` for specific issues

**DO NOT attempt to bypass cheat detection.** The Review Board is designed to catch all forms of fakery. Fix the underlying issue instead.

---

## Standard E2E Test Procedure

### Testing 5-Agent Team Mode with Verification

```bash
#!/bin/bash
# 5-Agent Team Mode Test with Independent Verification

set -e

SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"
SCP="sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no"

# Step 1: Cleanup
$SSH 'pkill -u EDA tmux; pkill -u EDA ffmpeg; rm -f /tmp/hipilot_*; echo manual > /tmp/hipilot_mode'

# Step 2: Upload mission pack
$SCP ./examples/mission-packs/ibex-mission.md \
  EDA@192.168.112.163:/home/EDA/ibex_work_upload/hipilot-mission.md

# Step 3: Run HiTestBot
bin/hitestbot-eda mission

# Step 4: Pull evidence
bin/hitestbot-pull

# Step 5: Independent Review (CRITICAL — never skip)
bin/review-test latest

# Step 6: Check Review Board verdict
cat test-evidence/*/REVIEW_BOARD_REPORT.md | grep "Verdict:"
```

### Complete Testing Checklist

- [ ] Clean environment (killed old tmux/ffmpeg)
- [ ] Mission pack uploaded to design directory
- [ ] HiTestBot test executed on EDA server
- [ ] Evidence downloaded via `hitestbot-pull`
- [ ] **Review Board verification completed** (`review-test`)
- [ ] No critical mismatches detected
- [ ] Video recording available
- [ ] Cheat detection passed

**⚠️ IMPORTANT:** Never accept HiTestBot results without Review Board verification. The Review Board is the authoritative source.

---

## Quick Reference

### Essential Commands

```bash
# === CLEANUP ===
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  'pkill -u EDA tmux; pkill -u EDA ffmpeg; rm -f /tmp/hipilot_*'

# === CHECK AGENT PANES ===
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  '/home/EDA/hipilot_test/.local/bin/tmux -L hipilot list-panes'

# === UPLOAD TEAM MODULE ===
sshpass -p 'eda2020' scp ./src/team/agents/*.js \
  EDA@192.168.112.163:/home/EDA/hipilot/current/src/team/agents/

# === RUN TEST ===
bin/hitestbot-eda synthesis
bin/hitestbot-eda mission    # Full mission pack flow

# === DOWNLOAD EVIDENCE ===
bin/hitestbot-pull

# === INDEPENDENT REVIEW (CRITICAL) ===
bin/review-test latest                    # Review most recent test
bin/review-test test-evidence/20260315/   # Review specific test
cat test-evidence/*/REVIEW_BOARD_REPORT.md | grep "Verdict:"  # Check verdict

### Wait Times

| Operation | Recommended Wait |
|-----------|------------------|
| tmux session creation | 1-2 seconds |
| Agent initialization | 5-10 seconds |
| Innovus startup | 15-20 seconds |
| Claude Code startup | 20-30 seconds |
| Agent coordination | 10-30 seconds |
| Stage execution | 5-15 minutes |

---

## Testing Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    HiPilot Testing Stack                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   TEST_PLAN │────▶│  HiTestBot  │────▶│   Evidence  │       │
│  │   (9 phases)│     │  (E2E test) │     │   (logs)    │       │
│  └─────────────┘     └──────┬──────┘     └──────┬──────┘       │
│                             │                    │              │
│                             ▼                    ▼              │
│                      ┌─────────────┐     ┌─────────────┐       │
│                      │CheatDetector│     │Review Board │       │
│                      │(8 layers)   │     │(3rd party)  │       │
│                      └──────┬──────┘     └──────┬──────┘       │
│                             │                    │              │
│                             ▼                    ▼              │
│                      ┌─────────────────────────────────┐       │
│                      │      Authoritative Verdict      │       │
│                      │  (REVIEW_BOARD_REPORT.md)       │       │
│                      └─────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Trust Hierarchy:**
1. **Review Board Report** (authoritative)
2. **HiTestBot Report** (advisory)
3. **Raw Evidence** (primary source)

---

**Last Updated:** 2026-03-15
**Author:** Claude Code
**Version:** HiPilot v0.8.0+ (5-Agent Team Mode with Cheat Prevention & Test Review Board)
**Guide Version:** 1.4
