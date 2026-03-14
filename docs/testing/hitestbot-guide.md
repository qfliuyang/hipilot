# HiPilot E2E Testing Guide

**Version:** 1.2
**Date:** 2026-03-10
**Status:** Complete Testing Reference

---

## Table of Contents

1. [Overview](#overview)
2. [HiTestBot Execution Model](#hitestbot-execution-model)
3. [Environment Setup](#environment-setup)
4. [Development Workflow](#development-workflow)
5. [SSH Connection Guide](#ssh-connection-guide)
6. [Code Upload with sshpass](#code-upload-with-sshpass)
7. [Screen Recording](#screen-recording)
8. [Video Transfer](#video-transfer)
9. [Pre-Test Cleanup](#pre-test-cleanup)
10. [Problems Encountered](#problems-encountered)
11. [Standard E2E Test Procedure](#standard-e2e-test-procedure)
12. [Quick Reference](#quick-reference)

---

## Overview

This document provides a complete guide for E2E testing of HiPilot on the EDA server, including:
- Development workflow (code locally, test remotely)
- SSH connection and file transfer
- Screen recording on real desktop
- Cleanup procedures for clean test recordings

### HiTestBot Execution Model

**HiTestBot runs ONLY on the EDA server** ("test like real human"). That's where humans run HiPilot. Each test run creates its own timestamped directory; tests never reference old runs. HiPilot is deployed as a **tool** on the EDA server (e.g. `/home/EDA/hipilot/current/`); do not upload source code for each test — it would fill Claude Code context.

| Principle | Meaning |
|-----------|---------|
| EDA-only execution | HiTestBot executes on EDA server; dev machine triggers via `bin/hitestbot-eda` (SSH) |
| Per-run isolation | Each run creates `/tmp/hipilot-test-evidence/{timestamp}/` or `sessions/{name}_{timestamp}/` — no reuse of prior runs |
| HiPilot as tool | Deploy HiPilot once to EDA server; use `bin/hitestbot-push` for small updates (test_plan, skills, deploy config), not full source |
| Sync for feedback | `bin/hitestbot-pull` downloads evidence to dev machine; `bin/hitestbot-push` uploads test plan/config |

**From dev machine:**
```bash
bin/hitestbot-eda synthesis  # SSH + run HiTestBot on EDA server (individual stage)
bin/hitestbot-eda floorplan  # Test floorplan stage
bin/hitestbot-eda placement  # Test placement stage
bin/hitestbot-eda cts        # Test CTS stage
bin/hitestbot-eda routing    # Test routing stage
bin/hitestbot-pull           # Download evidence to e2e_evidence/
bin/hitestbot-push skills/   # Upload test plan or config (not full source)
```

**On EDA server directly:**
```bash
cd /home/EDA/hipilot/current
node src/hitestbot/tests/FlowCertificationTest.js synthesis  # Test individual stage
node src/hitestbot/tests/FlowCertificationTest.js floorplan  # Test floorplan stage
node src/hitestbot/tests/FlowCertificationTest.js placement  # Test placement stage
node src/hitestbot/tests/FlowCertificationTest.js cts        # Test CTS stage
node src/hitestbot/tests/FlowCertificationTest.js routing    # Test routing stage
```

See [docs/testing/TESTING_RULES.md](TESTING_RULES.md) for testing philosophy; [src/hitestbot/README.md](../../src/hitestbot/README.md) for HiTestBot architecture.

### Verbose Logging and Evidence-Only Debugging

**The EDA server has no source code.** All debugging information must come from the evidence package retrieved to the dev machine via `bin/hitestbot-pull`. HiPilot and HiTestBot logs are therefore **deliberately verbose**.

| Artifact | Purpose |
|----------|---------|
| `run_log.txt` | Timestamped test steps, observations, MCP calls, parse results |
| `mcp_calls.jsonl` | Full MCP call log with `result_preview`, `error`, `args` (verbose when `HIPILOT_TEST_LOG` or `HIPILOT_VERBOSE_LOG=1`) |
| `FLOW_REPORT.md` | Includes **Diagnostic Summary** (MCP breakdown, error excerpts, pane previews) |
| `stage_*/scorecard.json` | Per-stage evidence and failure classification |

Set `HIPILOT_TEST_LOG=/path/to/mcp_calls.jsonl` and optionally `HIPILOT_VERBOSE_LOG=1` when running HiPilot on the EDA server to enable full result previews and error text in MCP logs.

---

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

# HiPilot versions
HIPILOT_BASE="/home/EDA/hipilot_test"
HIPILOT_V030="$HIPILOT_BASE/hipilot-v0.3.0"

# Recordings directory
RECORDINGS_DIR="$HIPILOT_BASE/recordings"
```

---

## Development Workflow

### Where to Write Code

**ALWAYS write code on your LOCAL machine**, then upload to EDA server for testing.

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL MACHINE (macOS/Linux)                                    │
│                                                                 │
│  /Users/you/codes/hipilot/                                      │
│  ├── src/lib/risk-analyzer.js    ← Write code here             │
│  ├── servers/eda/index.js        ← Write code here             │
│  └── ...                                                        │
│                                                                 │
│  Benefits:                                                      │
│  - Use your favorite IDE                                        │
│  - Git version control                                          │
│  - Fast editing                                                 │
│  - Test locally with node test.js                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  EDA SERVER (CentOS 7)                                          │
│                                                                 │
│  /home/EDA/hipilot_test/hipilot-v0.3.0/                        │
│  ├── src/lib/risk-analyzer.js    ← Uploaded for testing        │
│  ├── servers/eda/index.js        ← Uploaded for testing        │
│  └── ...                                                        │
│                                                                 │
│  Purpose:                                                       │
│  - Test with real EDA tools (Innovus, ICC2)                    │
│  - Record screen for demos                                     │
│  - Validate on target platform                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Typical Workflow

```bash
# 1. Write/edit code locally
vim /Users/you/codes/hipilot/src/lib/risk-analyzer.js

# 2. Test locally (if possible)
node /Users/you/codes/hipilot/test-risk-analyzer.js

# 3. Upload to EDA server
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  /Users/you/codes/hipilot/src/lib/risk-analyzer.js \
  EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/src/lib/

# 4. Test on EDA server
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 \
  'cd /home/EDA/hipilot_test/hipilot-v0.3.0 && node test-risk-analyzer.js'

# 5. Run E2E test with recording
# (see Standard E2E Test Procedure below)

# 6. Download video
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/demo_*.mp4 \
  /Users/you/codes/hipilot/
```

---

## SSH Connection Guide

### Basic SSH Connection

```bash
# Interactive SSH
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163

# Run single command
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 'ls -la'

# Run multiple commands (use single quotes for outer, double for inner)
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
  export PATH="/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH"
  cd /home/EDA/hipilot_test/hipilot-v0.3.0
  node test.js
'

# Run with here-doc for complex scripts
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 << 'EOF'
export PATH="/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH"
cd /home/EDA/hipilot_test/hipilot-v0.3.0
echo "Running tests..."
node test.js
EOF
```

### SSH Options Explained

```bash
sshpass -p 'eda2020' \              # Password for non-interactive login
  ssh -o StrictHostKeyChecking=no \ # Don't prompt for host key verification
  EDA@192.168.112.163               # User@Host
```

### Setting Up SSH Alias (Optional)

```bash
# Add to ~/.ssh/config
Host eda
  HostName 192.168.112.163
  User EDA
  StrictHostKeyChecking no

# Then use:
sshpass -p 'eda2020' ssh eda 'command'
```

---

## Code Upload with sshpass

### Upload Single File

```bash
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  /LOCAL/PATH/file.js \
  EDA@192.168.112.163:/REMOTE/PATH/file.js
```

### Upload Multiple Files

```bash
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  /local/file1.js /local/file2.js \
  EDA@192.168.112.163:/remote/path/
```

### Upload Directory

```bash
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no -r \
  /local/directory/ \
  EDA@192.168.112.163:/remote/path/
```

### Common Upload Commands for HiPilot

```bash
# Upload risk analyzer
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./src/lib/risk-analyzer.js \
  EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/src/lib/

# Upload EDA MCP server
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./servers/eda/index.js \
  EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/servers/eda/

# Upload tmux MCP server
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./servers/tmux/index.js \
  EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/servers/tmux/

# Upload Claude commands
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no -r \
  ./.claude/commands/ \
  EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/.claude/

# Upload all changes at once
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./src/lib/risk-analyzer.js \
  ./servers/eda/index.js \
  ./servers/tmux/index.js \
  EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/src/lib/

sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  ./servers/eda/index.js \
  EDA@192.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/servers/eda/
```

### Update MCP Settings on EDA Server

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
cat > ~/.claude/settings.json << "EOF"
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your_token",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "skipDangerousModePermissionPrompt": true,
  "mcpServers": {
    "hipilot-eda": {
      "command": "/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node",
      "args": ["/home/EDA/hipilot_test/hipilot-v0.3.0/servers/eda/index.js"],
      "env": {"HIPILOT_SESSION": "hipilot"}
    },
    "hipilot-tmux": {
      "command": "/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node",
      "args": ["/home/EDA/hipilot_test/hipilot-v0.3.0/servers/tmux/index.js"],
      "env": {"HIPILOT_SESSION": "hipilot"}
    },
    "hipilot-knowledge": {
      "command": "/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node",
      "args": ["/home/EDA/hipilot_test/hipilot-v0.3.0/servers/knowledge/index.js"],
      "env": {}
    }
  }
}
EOF
echo "MCP settings updated"
'
```

---

## Screen Recording

### Recording Requirements

- **Always record on display :0** (real desktop, NOT Xvfb)
- **Use H.264 with yuv420p** for macOS compatibility
- **Clean up before recording** (see Pre-Test Cleanup)

### Start Recording

```bash
# Get display resolution first
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 \
  'DISPLAY=:0 xdpyinfo | grep dimensions'
# Output: dimensions: 2880x1800 pixels

# Start recording
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
VIDEO_FILE="/home/EDA/hipilot_test/recordings/demo_$(date +%Y%m%d_%H%M%S).mp4"

DISPLAY=:0 ffmpeg -y -f x11grab \
  -video_size 2880x1800 \
  -framerate 15 \
  -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  "$VIDEO_FILE" < /dev/null > /tmp/ffmpeg.log 2>&1 &

FFMPEG_PID=$!
echo "Recording started (PID: $FFMPEG_PID)"
echo "Video file: $VIDEO_FILE"
echo $VIDEO_FILE > /tmp/ffmpeg_video_file
echo $FFMPEG_PID > /tmp/ffmpeg_pid
'
```

### Stop Recording

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
FFMPEG_PID=$(cat /tmp/ffmpeg_pid 2>/dev/null)
kill $FFMPEG_PID 2>/dev/null || true
sleep 2

VIDEO_FILE=$(cat /tmp/ffmpeg_video_file 2>/dev/null)
ls -la "$VIDEO_FILE"
echo "Recording stopped: $VIDEO_FILE"
'
```

### Recording with Visible Terminal

**CRITICAL:** The terminal must be visible on display :0 for recording to capture it.

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
# Start recording
DISPLAY=:0 ffmpeg -y -f x11grab -video_size 2880x1800 -framerate 15 -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  /home/EDA/hipilot_test/recordings/demo.mp4 < /dev/null > /tmp/ffmpeg.log 2>&1 &
FFMPEG_PID=$!
sleep 2

# Open terminal on display :0 - THIS IS CRITICAL!
DISPLAY=:0 gnome-terminal --title="HiPilot Demo" --geometry=160x45+100+100 -- \
  /home/EDA/hipilot_test/demo_script.sh

# Wait for demo to complete
sleep 60

# Stop recording
kill $FFMPEG_PID
'
```

### ffmpeg Parameters Explained

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `-f x11grab` | - | Capture X11 display |
| `-video_size` | 2880x1800 | Match display resolution |
| `-framerate` | 15 | Smooth recording, reasonable file size |
| `-i :0` | - | Capture from display :0 |
| `-c:v libx264` | - | H.264 codec (widely compatible) |
| `-preset fast` | - | Encoding speed |
| `-crf 23` | - | Quality (lower = better, larger) |
| `-pix_fmt yuv420p` | - | **REQUIRED** for macOS QuickTime |

---

## Video Transfer

### Download Single Video

```bash
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/demo_20260220_120000.mp4 \
  ./hipilot_demo.mp4
```

### Download Latest Video

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 \
  'ls -t /home/EDA/hipilot_test/recordings/*.mp4 | head -1' | \
  xargs -I {} sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  EDA@192.168.112.163:{} ./latest_demo.mp4
```

### Download All Videos

```bash
sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no \
  EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/*.mp4 \
  ./videos/
```

### Verify Video Locally

```bash
# Check file type
file hipilot_demo.mp4
# Expected: ISO Media, MP4 Base Media v1 [ISO 14496-12:2003]

# Check with ffprobe (if installed)
ffprobe hipilot_demo.mp4

# Open on macOS
open hipilot_demo.mp4
```

---

## Pre-Test Cleanup

**ALWAYS clean up before each test** to ensure clean recordings.

### Complete Cleanup Script

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 '
echo "=== Pre-Test Cleanup ==="

# 1. Kill all tmux sessions (prevents old windows in recording)
echo "Killing tmux sessions..."
pkill -u EDA tmux 2>/dev/null || true

# 2. Kill ffmpeg recordings
echo "Killing ffmpeg..."
pkill -u EDA ffmpeg 2>/dev/null || true

# 3. Kill any hanging terminal windows
echo "Killing terminal windows..."
pkill -u EDA gnome-terminal 2>/dev/null || true
pkill -u EDA xterm 2>/dev/null || true

# 4. Clean temp files
echo "Cleaning temp files..."
rm -f /tmp/hipilot_*.tcl 2>/dev/null || true
rm -f /tmp/hipilot_mode 2>/dev/null || true
rm -f /tmp/hipilot_pending.tcl 2>/dev/null || true
rm -f /tmp/hipilot_pending_meta.json 2>/dev/null || true
rm -f /tmp/ffmpeg*.log 2>/dev/null || true
rm -f /tmp/ffmpeg_*.txt 2>/dev/null || true

# 5. Reset mode to manual
echo "manual" > /tmp/hipilot_mode

# 6. Wait for processes to fully terminate
sleep 2

echo "=== Cleanup Complete ==="
echo "Ready for testing."
'
```

### Quick Cleanup (One-Liner)

```bash
sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163 \
  'pkill -u EDA tmux; pkill -u EDA ffmpeg; rm -f /tmp/hipilot_*; echo manual > /tmp/hipilot_mode'
```

### Why Cleanup is Critical

Without cleanup, recordings may show:
- Old tmux windows from previous sessions
- Multiple overlapping terminals
- Stale Innovus/ICC2 sessions
- Confusing leftover output

---

## Problems Encountered

### Problem 1: SSH Commands Not Visible on Desktop

**Issue:** Commands run via SSH execute in background and don't show on the desktop.

```bash
❌ ssh EDA@server 'echo "hello"'  # Runs in background, not visible
```

**Solution:** Use `DISPLAY=:0` and launch visible terminal emulators:

```bash
✅ DISPLAY=:0 gnome-terminal -- bash -c "echo hello; read"
✅ DISPLAY=:0 xterm -e "echo hello; read"
```

---

### Problem 2: tmux send-keys Enter vs C-m

**Issue:** Sending `Enter` as a string creates a newline instead of submitting.

```bash
❌ tmux send-keys -t session "command" "Enter"    # Prints "Enter" literally
❌ tmux send-keys -t session "command" Enter       # Sometimes just newline
```

**Solution:** Use `C-m` (carriage return):

```bash
✅ tmux send-keys -t session "command" C-m         # Properly submits
```

**Verify command was submitted:**
```bash
tmux capture-pane -t session -p -S -5
```

---

### Problem 3: tmux Protocol Version Mismatch

**Issue:** System tmux (1.8) and custom tmux (3.4) use different protocols.

```
Error: protocol version mismatch (client 7, server 8)
```

**Root Cause:** MCP server was calling system `/usr/bin/tmux` instead of custom `~/.local/bin/tmux`.

**Solution:** Always use explicit path:

```bash
# In MCP server or scripts:
TMUX_PATH="/home/EDA/hipilot_test/.local/bin/tmux"
$TMUX_PATH -L hipilot new-session -d -s hipilot
```

---

### Problem 4: MCP Settings Pointing to Wrong Version

**Issue:** `~/.claude/settings.json` pointed to old version after code update.

```json
❌ "args": ["/home/EDA/hipilot_test/hipilot-v0.2.0/servers/eda/index.js"]
✅ "args": ["/home/EDA/hipilot_test/hipilot-v0.3.0/servers/eda/index.js"]
```

**Solution:** Always verify MCP settings after deploying new code:

```bash
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  'cat ~/.claude/settings.json | grep -o "hipilot-v[0-9.]*"'
```

---

### Problem 5: Claude Code Not Responding

**Issue:** Claude Code shows prompt but doesn't process it.

```
❯ Generate Tcl for timing report
  ⏵⏵ bypass permissions on (shift+tab to cycle)
```

**Causes:**
1. API latency (wait longer)
2. Permission prompt blocking
3. MCP server not connected

**Solution:** Wait longer and check MCP connection:

```bash
# Check if Claude Code is still processing
tmux capture-pane -t hipilot:0.0 -p -S -20

# Test MCP server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/eda/index.js
```

---

### Problem 6: ffmpeg Recording Wrong Content

**Issue:** Video only shows desktop background, not terminal content.

**Root Cause:** Terminal window not opened on display :0.

**Solution:** Always open visible terminal:

```bash
# Start recording
ffmpeg -f x11grab -i :0 output.mp4 &

# Open terminal on same display
DISPLAY=:0 gnome-terminal -- script.sh
```

---

### Problem 7: Environment Variables Not Set

**Issue:** Scripts fail because PATH or other variables not set.

```bash
❌ node test.js          # node not found
❌ tmux attach           # wrong tmux version
```

**Solution:** Always set environment at the start of scripts:

```bash
#!/bin/bash
export PATH="/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH"
export HIPILOT_SESSION="hipilot"
```

---

## Standard E2E Test Procedure

### Complete Test Script Template

Save this as `run_e2e_test.sh` locally:

```bash
#!/bin/bash
# HiPilot E2E Test Script
# Run from LOCAL machine

set -e

# ========== CONFIGURATION ==========
SSH="sshpass -p 'eda2020' ssh -o StrictHostKeyChecking=no EDA@192.168.112.163"
SCP="sshpass -p 'eda2020' scp -o StrictHostKeyChecking=no"
SERVER="EDA@192.168.112.163"

LOCAL_DIR="/Users/you/codes/hipilot"
REMOTE_DIR="/home/EDA/hipilot_test/hipilot-v0.3.0"
RECORDINGS_DIR="/home/EDA/hipilot_test/recordings"

# ========== STEP 1: UPLOAD CODE ==========
echo "[1/5] Uploading code..."
$SCP "$LOCAL_DIR/src/lib/risk-analyzer.js" "$SERVER:$REMOTE_DIR/src/lib/"
$SCP "$LOCAL_DIR/servers/eda/index.js" "$SERVER:$REMOTE_DIR/servers/eda/"
echo "Code uploaded."

# ========== STEP 2: CLEANUP ==========
echo "[2/5] Cleaning up old sessions..."
$SSH '
pkill -u EDA tmux 2>/dev/null || true
pkill -u EDA ffmpeg 2>/dev/null || true
rm -f /tmp/hipilot_*.tcl /tmp/hipilot_mode 2>/dev/null || true
echo "manual" > /tmp/hipilot_mode
sleep 2
'
echo "Cleanup complete."

# ========== STEP 3: START RECORDING ==========
echo "[3/5] Starting screen recording..."
$SSH '
VIDEO_FILE="/home/EDA/hipilot_test/recordings/demo_$(date +%Y%m%d_%H%M%S).mp4"
DISPLAY=:0 ffmpeg -y -f x11grab -video_size 2880x1800 -framerate 15 -i :0 \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  "$VIDEO_FILE" < /dev/null > /tmp/ffmpeg.log 2>&1 &
echo $VIDEO_FILE > /tmp/ffmpeg_video_file
echo $! > /tmp/ffmpeg_pid
sleep 2
echo "Recording to: $(cat /tmp/ffmpeg_video_file)"
'

# ========== STEP 4: RUN TEST ==========
echo "[4/5] Running test..."
$SSH '
export PATH="/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH"
TMUX_PATH="/home/EDA/hipilot_test/.local/bin/tmux"
HIPILOT_DIR="/home/EDA/hipilot_test/hipilot-v0.3.0"
export HIPILOT_SESSION="hipilot"

# Create tmux workspace
$TMUX_PATH -L hipilot new-session -d -s hipilot -c "$HIPILOT_DIR"
$TMUX_PATH -L hipilot split-window -h -l 50% -c "$HIPILOT_DIR"

# Set status bar
$TMUX_PATH -L hipilot set-option status on
$TMUX_PATH -L hipilot set-option status-left "#[fg=#00d4ff] HiPilot #[fg=#ffd700] Manual "

# Start Innovus in right pane
$TMUX_PATH -L hipilot send-keys -t hipilot:0.1 "innovus -nowin" C-m
sleep 15

# Start Claude Code in left pane
$TMUX_PATH -L hipilot send-keys -t hipilot:0.0 "claude --dangerously-skip-permissions" C-m
sleep 20

# Open visible terminal
DISPLAY=:0 gnome-terminal --title="HiPilot" --geometry=200x55+40+40 -- \
  $TMUX_PATH -L hipilot attach-session -t hipilot &

# Send test prompt
sleep 5
$TMUX_PATH -L hipilot send-keys -t hipilot:0.0 "list the eda tools available" C-m

# Wait for response
sleep 60

# Capture output
$TMUX_PATH -L hipilot capture-pane -t hipilot:0.0 -p -S -30
'

# ========== STEP 5: STOP RECORDING & DOWNLOAD ==========
echo "[5/5] Stopping recording and downloading video..."
$SSH '
kill $(cat /tmp/ffmpeg_pid) 2>/dev/null || true
sleep 2
cat /tmp/ffmpeg_video_file
'

# Get video path and download
VIDEO_PATH=$($SSH 'cat /tmp/ffmpeg_video_file')
VIDEO_NAME=$(basename "$VIDEO_PATH")

$SCP "$SERVER:$VIDEO_PATH" "$LOCAL_DIR/$VIDEO_NAME"

echo ""
echo "=========================================="
echo "Test Complete!"
echo "Video saved to: $LOCAL_DIR/$VIDEO_NAME"
echo "=========================================="
```

---

## Quick Reference

### Essential Commands

```bash
# === CLEANUP ===
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  'pkill -u EDA tmux; pkill -u EDA ffmpeg; rm -f /tmp/hipilot_*; echo manual > /tmp/hipilot_mode'

# === UPLOAD FILE ===
sshpass -p 'eda2020' scp file.js EDA@192.168.112.163:/home/EDA/hipilot_test/hipilot-v0.3.0/src/lib/

# === RUN COMMAND ===
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'cd /path && node test.js'

# === START RECORDING ===
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  'DISPLAY=:0 ffmpeg -y -f x11grab -video_size 2880x1800 -framerate 15 -i :0 \
   -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p /home/EDA/hipilot_test/recordings/demo.mp4 &'

# === STOP RECORDING ===
sshpass -p 'eda2020' ssh EDA@192.168.112.163 'pkill -u EDA ffmpeg'

# === DOWNLOAD VIDEO ===
sshpass -p 'eda2020' scp EDA@192.168.112.163:/home/EDA/hipilot_test/recordings/demo.mp4 ./

# === OPEN VISIBLE TERMINAL ===
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  'DISPLAY=:0 gnome-terminal --title="Demo" -- /path/to/script.sh'
```

### Wait Times

| Operation | Recommended Wait |
|-----------|------------------|
| tmux session creation | 1-2 seconds |
| Innovus startup | 15-20 seconds |
| Claude Code startup | 20-30 seconds |
| Claude Code response | 30-90 seconds |
| Tcl execution | 1-5 seconds |
| MCP tool call | 1-2 seconds |
| ffmpeg start | 2 seconds |
| ffmpeg stop | 2 seconds |

### Check System State

```bash
# tmux sessions
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  '/home/EDA/hipilot_test/.local/bin/tmux -L hipilot list-sessions'

# Running processes
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  'ps aux | grep -E "(innovus|icc2|claude|ffmpeg)"'

# Mode and pending files
sshpass -p 'eda2020' ssh EDA@192.168.112.163 \
  'cat /tmp/hipilot_mode; echo "---"; cat /tmp/hipilot_pending.tcl'
```

---

**Last Updated:** 2026-02-20
**Author:** Claude Code (learned from painful experience)
